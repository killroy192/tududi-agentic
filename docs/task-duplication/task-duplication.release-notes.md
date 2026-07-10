# Release Strategy: Task Duplication

## 1. Change Analysis

### Blast radius

**Scope of this analysis** is restricted to the task-duplication feature files (per explicit scoping — pre-existing unrelated uncommitted changes in CalDAV, Notes, Login, Profile, Calendar, etc. are excluded).

- **New backend surface**: `POST /task/:uid/duplicate` (`backend/modules/tasks/routes.js:1052-1076`), gated by `requireTaskReadAccess` (`backend/modules/tasks/middleware/access.js:3-9`), delegating to a new pure operation `backend/modules/tasks/operations/duplicate.js` (`duplicateTask()` / `buildCopyName()`). No changes to any existing endpoint's behavior.
- **No DB schema change**: `duplicate.js:14-39` only sets existing `Task` columns; `backend/migrations/` has no task-duplication migration.
- **Frontend component graph** (import chain, confirmed via subagent trace):
  `tasksService.duplicateTask()` → `TaskItem.tsx` (`handleDuplicate`, toasts, `TaskItem.tsx:322-336`) → `TaskHeader.tsx` (icon, desktop hover + mobile, `TaskHeader.tsx:467-488`, `:662-677`) → consumed by `TaskList.tsx` (7 parents) and `GroupedTaskList.tsx` (3 parents), plus two direct `TaskItem` consumers (`KanbanBoard.tsx`, `EisenhowerMatrix.tsx`).
- **9 list-view surfaces** wire `onTaskDuplicated`: Tasks, Today (+ Today Plan subsection), Project tasks, Area tasks, Saved Views, Tag tasks, Kanban, Eisenhower — exceeding the spec's 4 named surfaces (Tasks/Today/Project/Area). Not wired: task detail page, MCP, Telegram, mobile (explicitly out of scope per spec).
- **Test coverage**: `backend/tests/unit/modules/tasks/duplicate.test.js` (name-suffix logic, 5 cases) and `backend/tests/integration/task-duplicate.test.js` (happy path, tag re-link, suffix dedup, habit-task 400, recurring-field stripping, 401 unauth, 403 no-access). **Gaps**: no assertions for `area_id`/`assigned_to`/`involves` fields, no test for a `recurring_parent_id` instance, no frontend/e2e tests for the 9 wired UI surfaces, no test for rapid-click duplicate creation, and the plan document states non-existent task → 404 while the implemented/tested behavior is 403 (middleware default).

### Impact checklist

| # | Question | True/False | Comment |
|---|----------|-------------|---------|
| 1 | Affects critical/core functionality (auth, billing, primary data write paths)? | **True** | New endpoint performs a primary data write (`taskRepository.create()` in `duplicate.js:41`, invoked from `routes.js:1052`). |
| 2 | Affects data integrity (migrations, irreversible writes, backfills)? | **False** | No migration, no backfill; writes are ordinary, deletable `Task` rows (`duplicate.js:14-39`). |
| 3 | Backward compatible (API contracts, DB schema, config defaults)? | **True** | Purely additive endpoint + optional React props; no existing contract changed (`routes.js` diff adds a new route only; no schema/config touched). |
| 4 | Affects security posture (authn/authz, secrets, input validation, CORS)? | **True** | New route authorizes with **read** access (`requireTaskReadAccess`, `access.js:3-9`) yet performs a write, and copies `project_id`/`area_id` without the write-access check the spec requires (`task-duplication.spec.md:103` vs `duplicate.js:20-21`, deferred per `task-duplication.plan.md:124`). |
| 5 | Affects performance/scalability (hot paths, added latency, N+1 queries)? | **False** | On-demand POST only (not on list/read hot paths); bounded work per call: one create + `getTags`/`setTags` + one reload (`duplicate.js:41-48`). |
| 6 | Affects third-party/external contracts (webhooks, integrations, sync protocols)? | **False** | No CalDAV/MCP/Telegram code paths touched; explicitly out of scope in spec (`task-duplication.spec.md:124`). |
| 7 | Cleanly reversible without data loss? | **True** | Code/image revert removes the endpoint and UI; any duplicate rows already created remain as ordinary, harmless tasks — no migration to unwind. |
| 8 | Covered by existing automated tests (unit/integration/e2e)? | **True (partial)** | Backend unit + integration tests exist; no frontend component tests or e2e tests cover the 9 wired UI surfaces (see coverage gaps above). |
| 9 | Requires a database migration? | **False** | Confirmed no new columns/tables; `backend/migrations/` has no related migration. |
| 10 | Touches multiple user-facing surfaces at once (web, API, mobile, bot, etc.)? | **True** | 1 new API endpoint + UI wiring across 9 web list surfaces simultaneously; no mobile/bot changes. |
| 11 | Duplicate can be created with a `project_id`/`area_id` the user lacks write access to (spec constraint not implemented)? | **True** | Spec requires dropping `project_id`/`area_id` when the user lacks write access (`task-duplication.spec.md:103`); `duplicate.js:20-21` copies both unconditionally; explicitly deferred in the plan's Risks section (`task-duplication.plan.md:124`). |
| 12 | A user with only read (shared) access to a task can use it to create a new owned task via duplication? | **True** | Route uses `requireTaskReadAccess` (`routes.js:1052`) while the new task is always owned by the requester (`duplicate.js:24`), inheriting the source's `project_id`/`area_id` — a broader write-capability than the read grant implies. |
| 13 | Rapid repeated clicks on the duplicate icon can create multiple unintended copies? | **True** | `handleDuplicate` has no loading/disabled guard during the API call (`TaskItem.tsx:322-336`); risk explicitly flagged (unmitigated) in the plan (`task-duplication.plan.md:123`). |

**Summary: 9 True / 4 False** (out of 13 checklist items).

## 2. Metrics

- **Existing metrics tracked**: None in the Prometheus/StatsD sense — no metrics library exists anywhere in the repo (backend or frontend). What does exist:
  - Morgan `'combined'` HTTP access logging to stdout for every request, including the new route (`backend/app.js:85`) — no user ID or request ID enrichment.
  - `logError('Error duplicating task:', error)` on failure in the new route handler (`backend/modules/tasks/routes.js:~1077-1081`), following the same pattern as the existing update route; no success-path logging (matches the existing create/update/delete convention — none of them log on success either).
  - `GET /api/health` liveness endpoint (`backend/app.js:301-309`) and Docker `HEALTHCHECK` (`Dockerfile:135-136`).
  - Domain-level "metrics" (`metrics-computation.js`, `taskEventService.js`) are product/UI analytics (task counts, productivity stats), not operational telemetry, and are not affected by duplication.
  - No `TaskEvent` audit row is written on duplicate (or on create/delete) — `logTaskCreated` exists but is only invoked from the dev seeder, not from routes.
  - **Constraint**: this environment has no access to the production Grafana Loki dashboards or Docker JSON log files described in the skill's operational context; the above is based on in-repo code inspection only. Live verification of request volume/error rate for `POST /task/:uid/duplicate` must be done directly against Loki/Docker logs on the VPS, which was out of reach here.

- **New metrics/logs to add** (each mapped to a checklist risk flagged **True**):
  1. **Success-path log line** for the duplicate route, e.g. `logInfo('Task duplicated', { sourceTaskUid, newTaskUid, userId })` — maps to **#1** (core write path) and **#8** (test/observability gap); today only failures are logged, so a successful-but-wrong duplication (e.g. wrong fields copied) would be invisible in logs.
  2. **Per-user rate signal** on the duplicate route (count of `POST /task/:uid/duplicate` calls per user per short window, derived from existing Morgan/Loki access logs by path+status, no new code required as a first cut) — maps to **#13** (rapid-click / duplicate storms).
  3. **Cross-owner access log line** when the requesting user does not own the source task's project/area but a `project_id`/`area_id` is still copied — e.g. log a warning in `duplicateTask()` when `sourceTask.project_id` belongs to a project the requester doesn't own/write — maps to **#4/#11/#12** (security posture / write-access gap); without this, the deferred write-access check has no way to be observed happening in production until a support ticket is filed.
  4. **Error-rate alert threshold** on the existing `logError('Error duplicating task:', ...)` line / HTTP 500s for the `/task/:uid/duplicate` path — maps to **#1** (core functionality) and **#7** (needs a first signal before rollback is even considered).

  No metrics are proposed for checklist items flagged **False** (#2, #5, #6, #9), per the skill's instruction to avoid speculative metrics for risks that don't apply.

## 3. Rollback Strategy

- **Trigger conditions** (informal — no alerting/dashboard infra exists in-repo, so these must be checked manually against Docker JSON logs / Loki):
  - Sustained 5xx responses or repeated `Error duplicating task:` log lines for `POST /task/:uid/duplicate` above baseline noise.
  - Support reports / manual DB spot-check showing habit tasks were duplicated (violates AC-3/business rule) or duplicated tasks missing expected copied fields (data-quality regression, ties to checklist #1).
  - Evidence of duplication being used to move tasks into a project/area the user lacks write access to (checklist #4/#11/#12 materializing as an actual abuse/bug report), or a burst of duplicate rows from a single user/session consistent with the unmitigated rapid-click risk (#13).
  - Any regression detected in the **unchanged** create/update/delete task endpoints after this deploy (since it shares `routes.js` and could indicate a bad merge/build), verified via `/api/health` and general task-CRUD smoke tests.

- **Rollback actions** (this repo has **no** feature flag for this capability, no canary/blue-green infra, and no CD automation — rollback is a manual redeploy):
  1. Confirm scope/severity: grep Docker JSON logs / Loki for the `/task/:uid/duplicate` path and `Error duplicating task:` lines; check `/api/health`.
  2. Notify stakeholders that the task-duplication feature is being reverted and why.
  3. Redeploy the previous known-good version: pin `docker-compose.yml`'s `image:` to the prior tag/digest (or, if built from source, `git checkout` the pre-duplication commit and `docker build`), then `docker compose down && docker compose up -d`. There is currently no versioned-tag convention in-repo (compose only references `:latest`) — treat establishing a pinned tag as a prerequisite step before this deploy, not just for rollback.
  4. **No migration undo required** — no schema change was introduced (`npm run migration:undo` is not applicable to this feature).
  5. **No cache/queue purge required** — no Redis/job queue exists in this stack; the only in-memory state is a per-request permission cache that clears itself.
  6. **No feature-flag disable step exists** — this repo's flag system (`FF_ENABLE_BACKUPS`, `FF_ENABLE_CALDAV`, `FF_ENABLE_MCP`) is env-var-based, read once at process start, and has no entry for task duplication; a flag was not implemented for this feature, so the only way to disable it is a full redeploy of the prior version.
  7. Leave any already-created `"<name> (copy)"` task rows in the database — they are ordinary, harmless tasks and do not need cleanup. Only if a specific data-quality incident is confirmed (e.g. habit tasks wrongly duplicated) should a targeted, manually-reviewed deletion be considered for the affected rows.

- **Post-rollback verification**:
  - `GET /api/health` returns 200.
  - `POST /task/:uid/duplicate` returns 404 (route no longer registered), confirming the prior version is running.
  - Duplicate icon no longer renders in the UI across the previously-wired surfaces (spot-check Tasks, Today, Project, Area at minimum).
  - `Error duplicating task:` log rate returns to zero / baseline in Docker/Loki logs.
  - Smoke-test unaffected task CRUD flows (create/update/delete) to confirm the shared `routes.js` file reverted cleanly with no collateral regression.

## 4. Risk Management

- **Feature flag: No.** Justification: the change is additive-only (new route + new optional UI affordance), has zero DB schema impact, and is read-access-gated with no changes to existing endpoints — the checklist's only elevated risks are a deferred authorization nuance (#4/#11/#12) and an unmitigated rapid-click edge case (#13), neither of which is data-destructive or hard to reverse. This repo's only existing flag mechanism is env-var-based and requires a container restart to toggle, so it would not provide meaningfully faster mitigation than the redeploy-based rollback already described in Section 3 — building one specifically for this feature would add complexity disproportionate to the risk. Recommend tracking the write-access gap (#11/#12) and the rapid-click guard (#13) as fast-follow hardening items instead of gating the initial release on them.

- **Rollout recommendation: Direct deploy during a low-traffic/off-peak window, with a pinned image tag captured beforehand — not a phased/canary rollout.** Reasoning: the blast radius is small (one new route, additive UI on 9 surfaces, no schema change) and the rollback path is a simple, low-cost full redeploy with no data cleanup, no migration undo, and no cache/queue purge (Section 3) — the complexity/cost of building a canary or blue-green mechanism (which doesn't exist in this repo today) would exceed the risk being mitigated. The one prerequisite is operational hygiene the repo currently lacks: pin the outgoing image to an explicit version tag/digest before deploying (compose only tracks `:latest` today) so that "rollback" is a one-line compose change rather than a source rebuild under time pressure. After deploy, manually smoke-test the endpoint and spot-check the 9 wired surfaces, and watch Docker/Loki logs for `Error duplicating task:` and 5xx on the new path for the following 24–48h given the absence of automated dashboards/alerts.
