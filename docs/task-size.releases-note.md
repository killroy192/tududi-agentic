# Release Strategy: KAN-15 Task size estimate (S / M / L / XL)

[KAN-15](https://epam-team-ai-adoption.atlassian.net/browse/KAN-15) is still **To Do** in Jira. The product change is on branch `ifw8/mk8-1` (`83ca40c`) against `main` (`b914bfd`). Runtime scope is the task `size` column, the task PATCH/read path, and the web size control. The same branch also adds `.cursor/**` and `AGENTS.md`; those files are not part of this deploy.

Target: self-hosted, one container, one SQLite file (`docker-compose.yml` image `chrisvel/tududi:latest`, volume `./tududi_db`).

## 1. Change Analysis

- Blast radius:
  - **Database.** `backend/migrations/20260701000001-add-size-to-tasks.js` adds nullable `tasks.size` (`STRING`, default `null`). `down` removes that column only (lines 9–24). `backend/models/task.js` validates `isIn: [['S','M','L','XL']]` and exports `Task.SIZES`.
  - **Task write path.** `PATCH /api/task/:uid` is already behind `requireTaskWriteAccess` (`backend/modules/tasks/routes.js` line 578). A body that contains `size` must be `null` or S/M/L/XL or the route returns 400 (lines 580–587). `buildUpdateAttributes` copies `size` only when the key is present (`backend/modules/tasks/core/builders.js` lines 275–277). Create does not persist client `size`. Habit create/update strips `size` (`backend/modules/habits/service.js`); a habit PATCH deletes `size` before update (`routes.js` lines 621–626).
  - **Task read path.** Serializers spread the ORM task, so `size` is on task JSON. The same change batches `getTaskAccessMap` (`backend/services/permissionsService.js` line 122) and adds viewer `access_level` on list, metrics, subtasks, search, and project detail.
  - **Web.** `TaskSizeControl` PATCHes `{ size }` from task list layouts and task details, and publishes the value through Zustand (`useTaskSizeSync`). Other screens strip `size` on unrelated PATCHes so they do not clobber it. Read-only viewers see the value and cannot edit it (`frontend/utils/taskSize.ts`).
  - **Not extended.** CalDAV VTODO output does not gain a size property (`backend/tests/integration/task-size.test.js` lines 618–634). MCP task/habit tool inputs have no `size` (`task-size.test.js` lines 563–574). Search ignores `size` filter and `sort=size` but still returns `size` on each hit (lines 577–615). No Telegram files are in the diff.
  - **Tests in tree.** Integration: `task-size.test.js`, `task-access-level.test.js`. Unit: parsers, builders, `permissionsService` (including “keeps the query count constant as the task list grows”, `permissionsService.test.js` line 459). Frontend: `TaskSizeControl`, `TaskHeader.size`, store, screen sync, Kanban and Eisenhower move. E2E spec: `e2e/tests/task-size.spec.ts`. A prior note (`docs/task-size.verification.md` lines 23–35, run 2026-11-11) records those Jest suites green and Playwright not run. This review did not re-execute them.

- Impact checklist:

  | # | Question | True/False | Comment |
  |---|----------|------------|---------|
  | 1 | Affects critical/core functionality (auth, billing, primary data write paths)? | true | Extends primary task PATCH and the list/detail payload (`routes.js` 578–587, `builders.js` 275–277). Auth and billing code are unchanged. |
  | 2 | Touches multiple user-facing surfaces at once (web, API, mobile, bot, etc.)? | true | Web size control on list, details, Kanban, Eisenhower, Today, area/project/tag/view, plus the HTTP task API. No mobile or bot files in the diff. |
  | 3 | Affects data integrity and backward compatibility (migrations, irreversible writes, backfills)? | true | New nullable column, no backfill; existing rows stay `null` (migration lines 9–19). `down` drops stored S/M/L/XL values (lines 22–24). Create ignores client `size`. |
  | 4 | Affects security posture (authn/authz, secrets, input validation, CORS)? | true | Writes stay on `requireTaskWriteAccess`. Invalid `size` is 400 (`routes.js` 580–587). Responses gain viewer `access_level` from `getTaskAccessMap`. No secret, CORS, or authn change. |
  | 5 | Affects performance/scalability (hot paths, added latency, N+1 queries)? | true | List, metrics, search, and project detail now call `getTaskAccessMap` (`permissionsService.js` 122). Unit test expects that query count to stay flat as the list grows (`permissionsService.test.js` 459). |
  | 6 | Affects third-party/external contracts (webhooks, integrations, sync protocols)? | true | Task JSON gains optional `size` and `access_level`. CalDAV and MCP do not (`task-size.test.js` 563–574, 618–634). Telegram is untouched. |
  | 7 | Cleanly reversible without data loss? | false | Reverting the image and leaving the column keeps size values, but they disappear from the API. `migration:undo` deletes those values. |
  | 8 | Covered by existing automated tests (unit/integration/e2e)? | true | Unit, integration, and frontend tests are in the branch. Playwright spec exists and was not run (`docs/task-size.verification.md` line 35). |

## 2. Metrics

- Existing metrics tracked:
  - No Prometheus, OpenTelemetry, StatsD, Sentry, or SLO config for task writes. Repo search found none.
  - `morgan('combined')` logs every request’s status and duration to stdout (`backend/app.js` line 85). Nothing in-repo aggregates 4xx/5xx.
  - `GET /api/health` returns `{ status: 'ok' }` (`backend/app.js` lines 302–309). The image healthcheck is `wget` of that URL (`Dockerfile` lines 135–136).
  - `GET /api/tasks` sets `X-Response-Time` and `X-Query-Count` (`backend/modules/tasks/operations/list.js` lines 102–103). Those headers are not stored, and they are not set on PATCH, search, or project detail.
  - Task PATCH success is not logged. Invalid `size` returns 400 with no log (`routes.js` 580–587). A 403 from the write guard is not logged. `logTaskChanges` does not include `size` (`backend/modules/tasks/utils/logging.js` lines 29–42); a size-only PATCH creates no `TaskEvent` (`task-size.test.js` lines 557–560).
  - The web client shows a toast on failure (`task.sizeUpdateError` on details, `task.updateError` elsewhere) and `console.error` in `TaskSizeControl`. Success is silent. Toasts stay in the browser.

- New metrics to add:
  - **`task_size_patch_total{result}`** (success, 400, 403, 5xx) on `PATCH /api/task/:uid` when the body has `size`. Maps to **#1, #2, #4**. Web and API share this route, and today neither success nor the 400/403 branches are logged.
  - **TaskEvent for `size`.** Add `size` to `captureOldValues` / `logTaskChanges` (`logging.js` 4–42). Maps to **#1 and #3**: the previous value is recorded before any later column drop.
  - **Startup log `tasks.size present, non_null=<n>`** after `db-migrate.js`. Maps to **#3**. `start.sh` line 94 only prints “Migrations completed successfully”, so an operator cannot see how many estimates `down` would delete.
  - **Query count and duration** for the routes that now call `getTaskAccessMap` (list, metrics, search, project detail), using the same `X-Query-Count` / `X-Response-Time` pair list already sets (`list.js` 102–103). Maps to **#5**.
  - **Status counts from the existing morgan line** for `/api/task` and `/api/tasks`. Maps to **#2 and #6**. Extra JSON fields will not 500 a client that ignores unknown keys; this counter is the server-side signal (serialize 500s, invalid-size 400s). No CalDAV or MCP metric: those contracts are unchanged.

  No new metric for **#7** (the checklist item is false) or **#8** (tests already exist; the open gap is running Playwright, not a runtime series).

## 3. Rollback Strategy

- Trigger conditions:
  - No SLO is defined in this repo. Do not wait for a percentage threshold.
  - Container exits or the Docker healthcheck fails. `start.sh` line 93 runs `node scripts/db-migrate.js || exit 1`. The healthcheck requests `GET /api/health` (`Dockerfile` 135–136).
  - Any HTTP 500 on `GET /api/tasks`, `GET /api/task/:uid`, or `PATCH /api/task/:uid` in the morgan log after the new image starts.
  - `X-Query-Count` on `GET /api/tasks` grows with the number of tasks on the page, or list/search latency goes from interactive to multi-second. The unit test expects the access-map query count to stay flat (`permissionsService.test.js` 459).
  - A task owner gets 403 on a size PATCH. A read-only sharee’s 403 is expected (`task-access-level.test.js`). Owner 403s are not logged today; the visible signal is the “Failed to update task” toast.
  - `no such column: size` in stdout means the new binary is up and the migration did not apply. Fix forward by letting `db-migrate.js` finish. That is not a rollback.

- Rollback actions:
  1. Stop the new container. Do not restart that image. Startup only migrates up (`start.sh` lines 91–93).
  2. Confirm `db-backup-YYYYMMDDHHMMSS.sqlite3` sits next to the database. `backup_db` runs before migrate when the file already exists (`start.sh` lines 72–93). Retention deletes backups older than 7 days and keeps at most four from today (lines 34–67).
  3. Recreate the container from the **previous image tag or digest**. Compose only names `chrisvel/tududi:latest` (`docker-compose.yml` line 3), so that digest has to have been saved before the swap. Leave `tasks.size` in place. The `main` model has no `size` attribute, so the old process ignores the extra column and the values remain in SQLite.
  4. Do not run `npm run migration:undo` on this path.
  5. Drop the column only when the feature is abandoned. Copy the sqlite file first, then `npm run migration:undo` (`package.json` script `migration:undo`, sequelize-cli) from a checkout that contains this migration. `down` calls `safeRemoveColumn` and deletes `size` only (migration lines 22–24). Other columns are copied. S/M/L/XL values are gone.
  6. If task reads still fail after the image swap, stop, replace `DB_FILE` with the pre-start `db-backup-*.sqlite3`, and start the previous image. That restores the whole file, including discarding non-size writes made after the backup. Use it only when step 3 leaves the app unhealthy.
  7. Nothing to flush: there is no Redis, Bull queue, or server cache of `size`. Ask open browsers to reload so the in-memory Zustand size update is dropped.
  8. Tell the instance admin. There is no in-repo notify hook.

- Post-rollback verification:
  - `GET /api/health` returns 200 and `status: ok` (`app.js` 302–309). The container stays up (healthcheck, `Dockerfile` 135–136).
  - `GET /api/tasks` returns 200 and a known task opens.
  - PATCH of a non-size field (name or status) returns 200 and is still there after reload.
  - Morgan combined lines for those calls are 2xx (`app.js` 85).
  - Column kept: `PRAGMA table_info(tasks)` still lists `size`. Old API JSON omits `size`.
  - Column dropped: pragma has no `size`. Name, status, and project on a sample task match the backup.
  - The previous bundle has no size dropdown.
  - Stdout does not show `db-migrate.js` exiting 1.

## 4. Risk Management

- Feature flag: **no** — Flags that exist are `backups`, `caldav`, and `mcp` (`backend/modules/feature-flags/service.js` lines 7–14). Task size is not among them. A UI flag would not turn off `getTaskAccessMap` on list, search, metrics, and project payloads (`permissionsService.js` 122), which is the hot-path cost in checklist **#5**. A flag that also skipped that lookup would be a second branch on the primary read path. The previous image already tolerates the extra column, and size stays optional and write-gated. The reversible control is an image pin that leaves `tasks.size` in place, not a new flag.

- Rollout recommendation: **off-peak deploy of a pinned image tag on the single instance. Do not move `:latest` until that tag has been watched.** — One container and one SQLite file (`docker-compose.yml` lines 3–16). CI lints and tests; it does not deploy, and the repo has no canary or blue-green. The change covers the task PATCH path, the main task screens, a nullable column, and an extra permission lookup on list/search/metrics. Code rollback is a container recreate only if the previous digest was kept. Schema undo drops size values (migration lines 22–24), so it is not the first move. Off-peak makes the `start.sh` backup the restore point and keeps the number of new size writes small. Before calling the deploy done: health 200, one task list load whose `X-Query-Count` does not scale with list length, one owner size change that matches on list and details, one read-only share still 403, and morgan 2xx on those calls.
