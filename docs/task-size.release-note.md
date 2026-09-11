# Release Strategy: Task Size (S / M / L / XL)

**Jira:** [KAN-15](https://epam-team-ai-adoption.atlassian.net/browse/KAN-15) — MK2/MK6: Task size estimate  
**Change:** commit `fffe6ab` (base `34ea189`; 78 files, +2359 / −505). Follow-up `fc140db` adds `docs/task-size.verification.md` only.  
**Target:** self-hosted Docker (SQLite volume). No in-repo SaaS / multi-tenant control plane.

---

## 1. Change Analysis

- Blast radius: **medium**. One optional nullable `tasks.size` column (INTEGER 1–4, NULL = unset), wired through task create/update builders and the shared `PATCH /task/:uid` write path; a new chip on every standard list row (`TaskHeader`) plus task details; 25 locale files; OpenAPI. **Broader than size:** `createValueObject` in `taskEventService.js` switched from truthiness to `=== undefined`, so timeline encoding for **all** fields changes in the same deploy. Not behind a feature flag. Out of scope held: sort/filter, Kanban/Eisenhower chips, MCP, CalDAV, import/export.

  **Core files:** `backend/migrations/20260701000001-add-size-to-tasks.js`; `backend/models/task.js`; `backend/modules/tasks/core/builders.js`, `parsers.js`; `backend/modules/tasks/utils/logging.js`; `backend/modules/tasks/taskEventService.js`; `backend/modules/tasks/routes.js` (`PATCH /task/:uid`); `frontend/components/Shared/TaskSizeControl.tsx`; `frontend/components/Task/TaskHeader.tsx`; `frontend/components/Task/TaskDetails/TaskDetailsHeader.tsx`. List parents patch local/store state: Tasks, Today, Area/Project/Tag/View details. Tests: unit (migration, model, parsers, control, locales, duplicate), integration (`tasks.test.js` size suite, recurring, RO share), e2e `e2e/tests/task-size.spec.ts`.

- Impact checklist:

  | # | Question | True/False | Comment |
  |---|----------|-------------|---------|
  | 1 | Affects critical/core functionality (auth, billing, primary data write paths)? | **true** | Size is mapped in `buildTaskAttributes` / `buildUpdateAttributes` (`builders.js`) and saved on the existing guarded `PATCH /task/:uid` (`routes.js`). Not auth/billing. |
  | 2 | Touches multiple user-facing surfaces at once (web, API, mobile, bot, etc.)? | **true** | Web list chip (`TaskHeader.tsx`) + details (`TaskDetailsHeader.tsx`) + REST create/update/read + OpenAPI. No mobile/bot. |
  | 3 | Affects data integrity and backward compatibility (migrations, irreversible writes, backfills)? | **true** | Idempotent nullable column, no default/backfill (`20260701000001-add-size-to-tasks.js:7-15`). `down()` drops the column and **destroys size values**. Timeline `createValueObject` change applies to every field (`taskEventService.js:3-5`). |
  | 4 | Affects security posture (authn/authz, secrets, input validation, CORS)? | **false** | Reuses `requireTaskWriteAccess` on the same PATCH; RO denial covered by `task-edit-shared-project.test.js`. New reject-not-coerce validation only (`parsers.js:15-27`). No new secrets/CORS. |
  | 5 | Affects performance/scalability (hot paths, added latency, N+1 queries)? | **true** | List `Task.findAll` has no attribute allowlist (`query-builders.js`), so `size` rides every list payload; chip renders per row. Updates are field-scoped `{ size }` (`TaskSizeControl.tsx:107`). No size-specific N+1. |
  | 6 | Affects third-party/external contracts (webhooks, integrations, sync protocols)? | **false** | Spec/plan exclude MCP/CalDAV/import (`task-size-spec.md` Out of Scope). Feature diff does not change those modules. |
  | 7 | Cleanly reversible without data loss? | **false** | `down()` calls `removeColumn('tasks','size')` (`migration.js:18-23`). No size feature flag (`FeatureFlagsService` only `backups`/`caldav`/`mcp`). Image revert without `down` keeps the column (compatible) but does not remove the schema. |
  | 8 | Covered by existing automated tests (unit/integration/e2e)? | **true** | Unit + integration + one e2e path exist. Verification Gate 1 still flags gaps: AC-7 revert test, AC-13 create-with-size, AC-18 timeline isolation, **AC-23 keyboard broken**, AC-28 contract test. |

---

## 2. Metrics

- Existing metrics tracked:
  - **Morgan `combined`** HTTP access logs (`backend/app.js`) — method, path, status, latency on every `PATCH /api/task/:uid` (including size-only).
  - **`console.error` via `logService`** on task update failure (`routes.js`) and timeline write failure (`logging.js`).
  - **Ad-hoc `console.log` before/after `task.update`** logs `status` / `completed_at` only — **not `size`**.
  - **Product timeline:** `logTaskChanges` records `size_changed` `TaskEvent` rows when size actually changes (`logging.js`, `taskEventService.js`). Create-with-size does **not** write a create timeline event on the API path.
  - **Docker `HEALTHCHECK`** → `GET /api/health` (`Dockerfile`, `app.js`) — liveness only; does not fire on size changes.
  - **Absent (repo search / `package.json`):** Prometheus, Grafana, Datadog, Sentry, OpenTelemetry/APM, Winston/Pino, dashboards, alerts, SLOs.

- New metrics to add (mapped to risk #):
  | Proposed signal | Maps to risk # | Why |
  |-----------------|----------------|-----|
  | Count/rate of `PATCH /api/task/:uid` by status class (2xx / 400 / 403 / 5xx), parsed from Morgan (or a one-line structured log that includes `size` present in body) | **#1, #2** | Primary write path + both UI surfaces share this route. A parser or builder regression shows up as 400/5xx here. |
  | Count of 400 responses whose error names the `size` field | **#1, #3** | Distinguishes size validation failures from other task-update errors (reject-not-coerce is a spec divergence from priority). |
  | Count of `logError('Error logging task update events')` / failed `logEvent` after deploy | **#3** | Timeline encoding change is repo-wide, not size-only. Spike means audit trail broken even when the size write succeeded. |
  | p95 latency of `GET` task list endpoints and `PATCH /task/:uid` (already in Morgan's combined timing field) | **#5** | Extra column on every list row + chip per row; watch list GET, not only PATCH. |
  | Count of tasks with non-null `size` (one-off SQL / admin query) plus “size column present” after migrate | **#7** | Tells operators whether `migration:undo` would destroy user data; image-only revert leaves the column in place. |

  Do not add metrics for risks #4 or #6 (both false). Product analytics on size adoption is explicitly out of spec.

---

## 3. Rollback Strategy

Deployment reality: self-hosted Docker image + mounted SQLite (`docker-compose.yml`). CI (`.github/workflows/ci.yml`) tests only — no deploy/revert job, Helm, or canary. Container start always runs **Umzug `up()`** (`start.sh` → `scripts/db-migrate.js`); it never auto-undos. SQLite is copied to `db-backup-*.sqlite3` before migrate (`start.sh`). No Redis/queue/CDN to purge. Size is **not** in `FeatureFlagsService`.

- Trigger conditions:
  1. **Morgan 5xx spike** on `PATCH /api/task/:uid` (or list `GET`) after the new image — risk #1/#2; stop if task updates fail for reasons unrelated to size as well, because builders/timeline code is shared.
  2. **Elevated 400s naming `size`** on otherwise valid clients — risk #3; parser/model contract broken.
  3. **Burst of timeline `logError`** after deploy — risk #3; `createValueObject` / `task_event` setter change harming all field history.
  4. **List GET p95 regression** or reports that rows overflow/scroll at 320–375px — risk #5 / AC-25.
  5. **Task create/update without `size` starts failing** — risk #1/#3; violates AC-29 backward compatibility; roll back immediately.

  Known pre-release defect (do **not** treat as a rollback trigger by itself): AC-23 keyboard navigation of the open dropdown is already broken (`docs/task-size.verification.md`). Treat as a follow-up fix, not a prod-incident signal, unless it ships worse (e.g. Enter on the chip navigates away from the list).

- Rollback actions:
  1. **Stop serving the new image.** Point compose/`docker run` at the previous known-good tag (volume `./tududi_db` stays mounted). Do **not** run `migration:undo` in this step.
  2. **Confirm leftover column is harmless.** Pre-size Sequelize models do not select `size`; the column is nullable with no default (`20260701000001-add-size-to-tasks.js:9-13`). Old code ignores it.
  3. **Do not drop `size` unless schema removal is required.** `down()` is `removeColumn` and **deletes all stored sizes**. Only if a later image cannot boot with the extra column (not expected): stop the app, copy the latest `db-backup-*.sqlite3`, run `npm run migration:undo` (or sequelize-cli undo) against that SQLite file, then start the old image. `start.sh` will not undo for you; a new image will migrate **up** again.
  4. **No cache/queue/CDN purge.** None exist for app data.
  5. **Notify operators/self-hosters** that size chips disappear with the old image; any sizes already written remain in SQLite until/unless `down()` is run.
  6. There is **no runtime kill-switch**; hiding the feature without a new image is not possible with current flags.

- Post-rollback verification:
  - `GET /api/health` returns 200 (`app.js` health handler; Docker HEALTHCHECK).
  - Morgan: `PATCH /api/task/:uid` and task list `GET` return 2xx at pre-change rates; no new 500s.
  - Smoke: create/update/complete a task **without** sending `size` (AC-29); recurring parent update of `name`/`priority` still behaves as before; activity timeline still records non-size field changes.
  - If `down()` was **not** run: `describeTable('tasks')` still has `size`; app must boot anyway.
  - If `down()` **was** run: confirm column absent and restore from `db-backup-*` if anything besides `size` looks wrong.
  - Automated: `npm run backend:test:integration` (tasks + recurring + shared-project RO) and `npx jest -- frontend/components/Shared/__tests__/TaskSizeControl.test.tsx` on the **reverted** tree should match the previous baseline (size tests will fail on old code — that is expected).

---

## 4. Risk Management

- Feature flag: **yes** — justification: this is a single-instance self-hosted Docker app with **no canary/CD**. Start always migrates **up**, so reverting the image does not hide the schema and cannot undo without a manual `removeColumn`. Size is painted on the shared list header (every task row) and rides the primary task PATCH. The existing env-flag pattern (`FF_ENABLE_BACKUPS` / `CALDAV` / `MCP` in `backend/modules/feature-flags/service.js`) is the only in-repo way to hide UI and reject size writes **without** dropping data. A flag would not isolate the bundled timeline encoding change — that part should be treated as a separate rollback reason (trigger 3). Shipping without the flag is still viable because the column is additive and old images ignore it; the flag is recommended as a kill-switch, not as a requirement to merge.

- Rollout recommendation: **tagged image, off-peak, staging compose first** — not canary or blue-green (no Helm/K8s/CD in repo). Reason: blast radius is the hot task list + shared PATCH + a **global** timeline encoder change; rollback is “swap image, keep SQLite,” which is simple but all-or-nothing per instance. Practical sequence:
  1. Do not move `chrisvel/tududi:latest` until a named tag has run on a staging volume (migration backup in `start.sh` is the safety net).
  2. Deploy off-peak so an image revert does not collide with users mid-PATCH; SQLite file backup happens at container start.
  3. Watch Morgan 5xx/400-on-size and list GET latency for one planning cycle before promoting `latest`.
  4. Keep `migration:undo` **off** the default rollback path so size data is not destroyed if the UI is reverted.
  5. Do not block the release on AC-23, but do not treat keyboard-only list editing as supported until that defect is fixed (`docs/task-size.verification.md`).
