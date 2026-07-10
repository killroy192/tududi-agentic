# Release Strategy: Task Dependencies (fe6f1a6)

Feature: blocker/blocked relationships between tasks. Recurring tasks may be a
blocker, but may not be blocked.

**SDLC context for this release:** develop locally → merge to `main` → deploy
manually to the VPS (there is no CD pipeline; `.github/workflows/ci.yml` only
runs lint/tests/build, confirmed to have no deploy job). Production
observability is via Docker logs on the VPS (`docker logs` / `docker compose
logs`, which capture the same Morgan/console output described in Metrics
below) or the shipped copy of those logs in Grafana Loki. There is no
Grafana/Loki configuration inside this repository — it is an external
platform the logs are shipped to — so all log-based checks below assume
querying Loki (or SSHing into the VPS) for the `tududi` container's stdout.

## 1. Change Analysis

- **Blast radius:** 18 files (+1,854 / −10 lines) across backend migration,
  model, operations, serializers, routes, repository, and frontend
  entity/service/component. The tasks module is the most-imported module in
  the app (`backend/models/index.js` has 50+ dependents). Recurring task
  expansion logic (`expandRecurringTasks` in `backend/modules/tasks/routes.js`)
  was converted from sync to async to accommodate the new per-template
  dependency lookup.

- **Impact checklist:**

  | # | Question | True/False | Comment |
  |---|----------|-------------|---------|
  | 1 | Affects critical/core functionality (auth, billing, primary data write paths)? | True | Modifies primary task read/write/delete paths; adds dependency writes via 3 new API routes; enriches task serialization (`backend/modules/tasks/routes.js:531,567,917`). |
  | 2 | Affects data integrity (migrations, irreversible writes, backfills)? | True | New `task_dependencies` table with FK CASCADE, unique constraint, explicit delete cleanup (`backend/migrations/20260710000001-create-task-dependencies.js:22-63`, `backend/modules/tasks/routes.js:990-995`). |
  | 3 | Backward compatible (API contracts, DB schema, config defaults)? | True | Additive schema (new table); new optional JSON fields only when `includeDependencies: true`; virtual occurrences gain optional `blocking` array. |
  | 4 | Affects security posture (authn/authz, secrets, input validation, CORS)? | True | New endpoints guarded by existing `requireTaskReadAccess`/`requireTaskWriteAccess` middleware; ownership re-checked via `findByIdAndUser`; cross-user access returns 403 (tested). |
  | 5 | Affects performance/scalability (hot paths, added latency, N+1 queries)? | True | N+1 `getDependencies` call per recurring template inside `expandRecurringTasks` on `GET /tasks`; BFS cycle check on add; extra DB call per task in serializer when `includeDependencies` is set. |
  | 6 | Affects third-party/external contracts (webhooks, integrations, sync protocols)? | False | CalDAV, Telegram, and MCP tooling are untouched; MCP task tools do not use `includeDependencies`. |
  | 7 | Cleanly reversible without data loss? | False | `migration:undo` drops `task_dependencies`, destroying all dependency relationships that were created. |
  | 8 | Covered by existing automated tests (unit/integration/e2e)? | True | 5 new test suites: unit model, unit operations, 2 backend integration suites, 1 frontend component suite (37 backend + 7 frontend tests). No e2e coverage. |
  | 9 | Requires a database migration? | True | `backend/migrations/20260710000001-create-task-dependencies.js` creates `task_dependencies` with indexes and FKs. |
  | 10 | Touches multiple user-facing surfaces at once (web, API, mobile, bot, etc.)? | True | Web UI (`TaskDependenciesCard`) + REST API (3 new endpoints, plus enriched existing task responses). |
  | 11 | Affects the existing recurring task expansion logic? | True | `expandRecurringTasks` converted sync→async; per-template `getDependencies` call injects a `blocking` array into virtual occurrences; recurring templates are blocked from being the *blocked* side of a dependency. |

---

## 2. Metrics

- **Existing metrics tracked** (all reach the VPS's Docker log stream, and
  from there Grafana Loki, since the app logs to stdout/stderr and Docker
  captures it — no separate metrics agent is configured):
  - Morgan `combined` HTTP access logs (`backend/app.js:85`) — captures method,
    path, status, and duration for all routes, including the new dependency
    endpoints. Query in Loki (or `docker logs`) by matching the container
    name/stream and filtering on the request path (`/task/` and
    `/dependencies`) and status code.
  - `logError`/`logInfo` console aliases from `backend/services/logService.js`
    — used in some but not all task route catch blocks; these are plain
    `console.error`/`console.log` lines with no structured fields, so Loki
    queries can only grep on message text, not on labels like `route` or
    `userId`.
  - `X-Response-Time` and `X-Query-Count` response headers, but only on
    `GET /tasks` (`backend/modules/tasks/operations/list.js:83-87`) — these
    are response headers, not logged, so they are **not** visible in Docker
    logs/Loki unless a client or reverse proxy logs response headers
    separately. Not currently usable for post-deploy monitoring without
    additional wiring.
  - Dev-only SQL query logging (`backend/middleware/queryLogger.js`), enabled
    only when `NODE_ENV=development` — not available in production.
  - `/api/health` endpoint (`backend/app.js:302-310`) for liveness — must be
    polled directly (e.g. `curl` from the VPS or an external uptime check);
    it does not emit its own log line.
  - No Prometheus, StatsD, OpenTelemetry, Sentry, or other external monitoring
    exists in this codebase; Loki is log aggregation only, not a metrics
    backend, so there are no dashboards/alerts to define thresholds on beyond
    log-based counts (e.g. Loki's `count_over_time` on 5xx lines).

- **New metrics to add** (each mapped to an impact-checklist risk marked
  `True` above; all designed to be greppable/queryable in Loki since that is
  the only production observability surface):

  | Proposed metric/log | Maps to risk | Location |
  |---|---|---|
  | Add `logError` to the `POST` and `DELETE` dependency route catch blocks (currently only the `GET` dependency route logs errors), with a consistent, greppable prefix (e.g. `[TaskDependencies]`) so it can be isolated in Loki | Risk #1 — core functionality | `backend/modules/tasks/routes.js:1141-1142` and `:1184-1185` |
  | Record dependency add/remove as task audit events, mirroring the existing `logTaskChanges` pattern used for other field updates | Risk #2 — data integrity | `backend/modules/tasks/operations/dependencies.js`, following `backend/modules/tasks/utils/logging.js` |
  | Log request duration for `GET /task/:uid/dependencies` (a header alone is invisible in Loki; log it) | Risk #5 — performance | `backend/modules/tasks/routes.js:1078-1093` |
  | Log wall-clock duration of the `getDependencies` call inside `expandRecurringTasks`, since this is a new N+1 point on a hot list endpoint, tagged so it is filterable in Loki (e.g. `[TaskDependencies] expandRecurringTasks getDependencies took Xms for task <id>`) | Risk #5, #11 — performance / recurring expansion | `backend/modules/tasks/routes.js:196-208` |

---

## 3. Incident Management Strategy

Deployment is manual (no CD pipeline), so there is no automated
detection→mitigation loop for this feature. Everything below is performed by
a human, either via Grafana Loki/VPS log access for detection or SSH on the
VPS for mitigation.

- **Detection — trigger conditions** (checked in Grafana Loki against the
  VPS container's logs, or directly via `docker logs`/`docker compose logs`
  on the VPS if Loki is unavailable):
  - Elevated 5xx rate on `/api/task*` routes visible in Morgan access log
    lines in Loki (e.g. `count_over_time` query on lines matching
    `"/task"` and a `5\d\d` status in the same log line).
  - New `[TaskDependencies]` error log lines appearing after deploy (once the
    new logging from Metrics §2 is added; until then, watch for uncaught
    exceptions / stack traces mentioning `dependencies.js` in the raw logs).
  - User-reported errors when opening task details or managing dependencies.
  - `/api/health` check failing when polled from the VPS (`curl
    localhost:3002/api/health` or the app's configured base path).
  - Migration failure on startup — visible as the deploy/start command
    exiting non-zero, or a stack trace in the container logs; the
    pre-migration SQLite backup already exists at that point (created by
    `backend/cmd/start.sh`).

- **Triage — scope the blast radius before acting:**
  1. Confirm in Loki/`docker logs` whether errors are isolated to
     `/task/:uid/dependencies*` endpoints or the whole `/api/task*` surface
     (the latter suggests the recurring-expansion N+1 change or a model
     association regression, not just the new endpoints — see Impact
     Checklist #5, #11).
  2. Confirm whether the migration applied successfully (`npm run
     db:status` on the VPS) — a failed migration is a different incident
     class than a runtime bug in already-migrated code.
  3. Decide severity: cosmetic/isolated (e.g. only the dependency UI card is
     broken) vs. systemic (task list/detail pages failing for all users).

- **Mitigation options, in order of preference:**
  1. **Disable via feature flag** (once `FF_ENABLE_TASK_DEPENDENCIES` exists
     per §4) — flip the env var and restart the container on the VPS. This
     is the fastest mitigation, requires no code changes, and does not touch
     the database, so dependency data already created is preserved for a
     later fix. Preferred for any issue confined to the dependency
     UI/endpoints (isolated severity above).
  2. **Hotfix forward** — if the bug is narrow (e.g. a serializer null
     check) and low-risk, patch on `main` and redeploy rather than rolling
     back, since redeploy and rollback require the same manual VPS steps
     either way.
  3. **Rollback** — see below. Reserved for systemic issues (the recurring
     expansion change breaking `GET /tasks` broadly, or a migration failure)
     where neither the flag nor a quick hotfix resolves the incident.

- **Rollback (relevant here, as a last-resort mitigation):**
  Rollback is included because this feature is **not cleanly reversible**
  (Impact Checklist #7) and touches a hot, broadly-used endpoint
  (`GET /tasks`, Impact Checklist #5/#11), so a rollback path must be defined
  even though it should rarely be needed once the feature flag exists.

  1. SSH into the VPS.
  2. Stop the running container (`docker compose down` or `docker stop
     <container>`, depending on how it was started).
  3. Assess the data situation: if the migration already ran and dependency
     data exists that must be preserved, there is no tooling to preserve it
     across a rollback — proceed only if losing that data is acceptable.
  4. Restore the pre-migration SQLite backup automatically created by
     `backend/cmd/start.sh` before migrations run:
     `cp backend/db/db-backup-<timestamp>.sqlite3 backend/db/production.sqlite3`.
     Alternative (code-only rollback that keeps other data): run
     `npm run migration:undo` to drop `task_dependencies`, then redeploy the
     prior commit — an un-dropped leftover table is also harmless to the old
     code.
  5. Redeploy the previous version: since there is no CD, this means
     checking out the last-known-good commit on `main` (or a tag, if one was
     cut before this release) on the VPS and re-running the same manual
     deploy steps used to ship this change (rebuild/pull the image and
     restart the container).
  6. Run post-incident verification (below).
  7. Notify stakeholders if the feature had already been user-visible before
     the rollback, and note in the team's incident channel that a manual
     rollback was performed (there is no automated rollback audit trail).

- **Post-incident verification** (applies whether mitigation was a flag
  toggle, hotfix, or rollback):
  - `GET /api/health` returns `200 { status: "ok" }` when curled from the
    VPS.
  - `npm run db:status` on the VPS shows the expected migration state (no
    pending migrations; the dependency migration listed as applied or, if
    rolled back, reverted).
  - `GET /api/tasks` returns tasks successfully (with or without
    `blockers`/`blocking` fields depending on whether the feature is
    currently enabled).
  - `GET /api/task/:uid` returns a single task successfully.
  - Backend test suite (`npm run backend:test`) passes locally against
    whatever commit is now deployed, before it is pushed/redeployed again.
  - Grafana Loki (or `docker logs` on the VPS) shows no new 5xx errors or
    `[TaskDependencies]`/dependency-related stack traces on task routes in
    the minutes following the fix.

- **Post-incident review:** since there is no automated incident tracking,
  record what happened (detection signal, mitigation chosen, time to
  mitigate) in the team's usual incident/notes channel — there is no
  in-repo tooling for this today.

---

## 4. Risk Management

- **Feature flag: Yes.**
  Justification: the codebase already has a feature flag system
  (`backend/modules/feature-flags/service.js`, env-based `FF_ENABLE_*`
  pattern, consumed on the frontend via `frontend/utils/featureFlags.ts`) used
  for backups, CalDAV, and MCP. Adding `FF_ENABLE_TASK_DEPENDENCIES` would let
  the migration and code ship without exposing the UI or API routes, and
  would allow an instant soft-disable if issues arise by flipping an env var
  and restarting the container — a much faster and lower-risk action than a
  full manual rollback. This is especially valuable given the actual SDLC
  (dev locally → merge to `main` → manual deploy to the VPS): there is no CD
  pipeline to trigger an automated rollback, so "redeploy the previous
  commit" always means someone manually SSHing into the VPS and re-running
  the deploy steps. A flag turns most failure scenarios into a one-line env
  var change instead of a manual redeploy. It is also the only way to "pause"
  the feature without data loss, since the feature is **not cleanly
  reversible** (Impact Checklist #7) — dropping the table via
  `migration:undo` permanently destroys any dependency data users created.

- **Rollout recommendation: Standard deploy (no canary/blue-green), gated by a
  feature flag.**
  Reasoning:
  - This is a single-tenant, self-hosted Docker application deployed by hand
    to one VPS — there is no multi-tenant blast radius and no existing
    gradual-rollout infrastructure (confirmed: no canary/blue-green tooling,
    and no deploy automation in `.github/workflows/ci.yml`).
  - The migration is purely additive (new table, no changes to existing
    schema) and the API/serializer changes are backward compatible.
  - The N+1 performance risk in `expandRecurringTasks` is bounded by the
    number of recurring templates per account, typically small, so it does
    not warrant a phased rollout by itself.
  - The automatic pre-migration backup (`backend/cmd/start.sh`) provides a
    safety net for the irreversible-migration risk.
  - A feature flag fills the gap that the manual rollback process currently
    has (no partial/soft disable, and no automated redeploy), which is more
    valuable here than staged rollout infrastructure for a single-VPS,
    single-deployment-unit app.
  - Given deploys are manual, verification after deploying should include an
    explicit check of Grafana Loki (or `docker logs` on the VPS) for errors
    in the minutes after restart, since there is no automated smoke test or
    monitoring gate between "container restarted" and "traffic is being
    served correctly."
  - Off-peak/overnight deployment windows are not meaningful for a
    self-hosted single-user/small-team app and are not recommended as a
    substitute for the feature flag.
