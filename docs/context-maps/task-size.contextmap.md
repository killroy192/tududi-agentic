# Context Map

Feature: task size (S / M / L / XL). Jira [KAN-15](https://epam-team-ai-adoption.atlassian.net/browse/KAN-15) — “MK2/MK6: Task size estimate”, type Task, status To Do. The ticket’s acceptance criteria are a subset of the spec. Implement against spec v1.1 and the plan, not the Jira bullets alone.

## Hot context

Directly required for the feature right now:

* Current spec and plan
  * [docs/task-size.spec.md](../task-size.spec.md) — v1.1 behavioral contract and AC-1–AC-19.
  * [docs/task-size.plan.md](../task-size.plan.md) — confirmed facts, assumptions, file list, ordered steps, risks, verification.
  * Contract the plan locks in: nullable string column `size` on `tasks`, values `S` | `M` | `L` | `XL` | SQL `NULL` (JSON `null`). No backfill. API name `size`. Create: omit or `null` stores unset; any other value rejects the create and leaves no row. Update: omit leaves the stored value; `null` clears it; any other value rejects the update and leaves the stored value. Priority and size are written only when their own key is present. Invalid values fail in the task attribute builder before `create` or `update`, with model validation as a second guard, using the existing 400 task error response.
  * Editable surfaces: standard list rows (Today, upcoming, sidebar lists, saved views, project, tag, area) and task details, including the details screen opened after sidebar stub create. That details screen is the “full New Task” surface. Inline name capture and inbox quick capture stay without a size field. `POST /api/task` still accepts `size`.
  * Display-only inventory: Kanban cards, Eisenhower cards, search results. Set → non-interactive label. Unset → omit size UI. No control that can save.
  * Virtual upcoming rows are serialized with size unset, and the list control does not save from a virtual row. Persisted templates, legacy recurring children, and subtasks each keep their own size. Template size changes do not update or delete children. New occurrences start unset.
  * Edit vs read-only uses existing task access (`rw` / `admin` may edit; `ro` may view). Attach that result on task reads the size UI consumes. No size-specific permission. `PATCH` stays behind current write middleware.
  * Completed and archived tasks stay size-editable for editors. Size stays off the activity field list and off the task-event allowlist. Labels, including None, are English i18n keys. The control has an accessible name and is keyboard operable. Failed update: error toast and restore last saved size. Success toast may match priority.

* Active files
  * Schema and model
    * [backend/models/task.js](../../backend/models/task.js) — `priority` is a nullable integer (default `0`, validated 0–2). No size / effort / t-shirt field.
    * New migration under [backend/migrations/](../../backend/migrations/). Pattern: [backend/migrations/20251124000001-add-defer-until-to-tasks.js](../../backend/migrations/20251124000001-add-defer-until-to-tasks.js) uses `safeAddColumns` from [backend/utils/migration-utils.js](../../backend/utils/migration-utils.js). Do not edit a migration already in history.
  * HTTP and persistence
    * [backend/modules/tasks/routes.js](../../backend/modules/tasks/routes.js) — create/update call the builders. `expandRecurringTasks` copies `task.toJSON()` onto virtual rows (`is_virtual_occurrence`, `virtual_id` = `{id}_occurrence_{index}`) and keeps the template identity. A new column is copied unless upcoming serialization forces size unset.
    * [backend/modules/tasks/core/builders.js](../../backend/modules/tasks/core/builders.js) — `buildTaskAttributes` (create) and `buildUpdateAttributes` (update). Update copies the stored value when the body omits a field. Nullable fields such as `assigned_to` are applied only when the key is present; `null` clears them.
    * [backend/modules/tasks/core/parsers.js](../../backend/modules/tasks/core/parsers.js) — `parsePriority` is the existing field parser.
    * [backend/modules/tasks/core/serializers.js](../../backend/modules/tasks/core/serializers.js) — `serializeTask` starts from `task.toJSON()`, so a model column is returned once it exists.
    * [backend/modules/tasks/middleware/access.js](../../backend/modules/tasks/middleware/access.js) — `requireTaskWriteAccess` is `hasAccess('rw', 'task', …)`. Read-only is rejected. The client task payload does not currently include that access level.
  * History and recurrence (leave size out)
    * [backend/modules/tasks/utils/logging.js](../../backend/modules/tasks/utils/logging.js) — `logTaskChanges` field list includes `priority`. Events are written only for listed fields.
    * [backend/models/task_event.js](../../backend/models/task_event.js) — `event_type` `isIn` allowlist includes `priority_changed`. No size event.
    * [backend/modules/tasks/operations/recurring.js](../../backend/modules/tasks/operations/recurring.js) — `templateFieldsChanged` is `name`, `project_id`, `priority`, `note`. A change deletes future children. Size is not on that list.
    * [backend/modules/tasks/operations/subtasks.js](../../backend/modules/tasks/operations/subtasks.js) — subtasks set their own priority and do not copy other parent attributes.
  * Search and API docs
    * [backend/modules/search/service.js](../../backend/modules/search/service.js) — task hits go through `serializeTasks`, so a new column is in the payload once serialized. Search UI must stay display-only.
    * [backend/docs/swagger/tasks.js](../../backend/docs/swagger/tasks.js) and [backend/config/swagger.js](../../backend/config/swagger.js) — task schema and create/update docs currently describe `priority`.
  * Tests already covering the neighboring behavior
    * [backend/tests/unit/models/task.test.js](../../backend/tests/unit/models/task.test.js)
    * [backend/tests/integration/tasks.test.js](../../backend/tests/integration/tasks.test.js)
    * [backend/tests/integration/permissions-tasks.test.js](../../backend/tests/integration/permissions-tasks.test.js), [backend/tests/integration/task-edit-shared-project.test.js](../../backend/tests/integration/task-edit-shared-project.test.js)
    * [backend/tests/integration/recurring-tasks.test.js](../../backend/tests/integration/recurring-tasks.test.js), [backend/tests/integration/subtasks.test.js](../../backend/tests/integration/subtasks.test.js), [backend/tests/unit/models/subtasks.test.js](../../backend/tests/unit/models/subtasks.test.js)
    * Integration tests rebuild schema with `sequelize.sync({ force: true })`. A model-only change can pass while the migration is wrong. Confirm the new migration with a real SQLite apply and undo.
  * Client
    * [frontend/entities/Task.ts](../../frontend/entities/Task.ts) — `Task` has `priority?: PriorityType | number` and no size.
    * [frontend/utils/tasksService.ts](../../frontend/utils/tasksService.ts) — task HTTP client.
    * [frontend/store/useStore.ts](../../frontend/store/useStore.ts) — shared task store. List screens also keep their own task arrays. After a successful save, both the view list and this store must hold the new size.
    * [frontend/components/Task/TaskDetails.tsx](../../frontend/components/Task/TaskDetails.tsx) — `handlePriorityUpdate` saves immediately, toasts success (`task.priorityUpdated`) and error (`task.priorityUpdateError`), then refreshes the store. Details priority is not disabled for completed or archived status.
    * [frontend/components/Task/TaskDetails/TaskDetailsHeader.tsx](../../frontend/components/Task/TaskDetails/TaskDetailsHeader.tsx)
    * [frontend/components/Task/TaskItem.tsx](../../frontend/components/Task/TaskItem.tsx) and [frontend/components/Task/TaskHeader.tsx](../../frontend/components/Task/TaskHeader.tsx) — shared by list rows, Kanban, and Eisenhower. List rows do not edit priority. Kanban passes `hideStatusControl` and `isKanbanView`. Eisenhower does not pass those flags. A size control with no view flag would make the boards editable.
    * List parents that pass task updates: [frontend/components/Tasks.tsx](../../frontend/components/Tasks.tsx), [frontend/components/Task/TasksToday.tsx](../../frontend/components/Task/TasksToday.tsx), [frontend/components/ViewDetail.tsx](../../frontend/components/ViewDetail.tsx), [frontend/components/Project/ProjectDetails.tsx](../../frontend/components/Project/ProjectDetails.tsx), [frontend/components/Tag/TagDetails.tsx](../../frontend/components/Tag/TagDetails.tsx), [frontend/components/Area/AreaDetails.tsx](../../frontend/components/Area/AreaDetails.tsx).
    * [frontend/components/Kanban/KanbanBoard.tsx](../../frontend/components/Kanban/KanbanBoard.tsx), [frontend/components/Eisenhower/EisenhowerMatrix.tsx](../../frontend/components/Eisenhower/EisenhowerMatrix.tsx), [frontend/components/UniversalSearch/SearchResults.tsx](../../frontend/components/UniversalSearch/SearchResults.tsx) — search does not use `TaskItem`.
    * Create paths that stay without a size field: sidebar stub in [frontend/Layout.tsx](../../frontend/Layout.tsx) (inserts a stub, then opens details), [frontend/components/Task/NewTask.tsx](../../frontend/components/Task/NewTask.tsx), inbox quick capture. [frontend/components/Task/TaskForm/TaskPrioritySection.tsx](../../frontend/components/Task/TaskForm/TaskPrioritySection.tsx) is unused.
    * [public/locales/en/translation.json](../../public/locales/en/translation.json) — English is the source of truth. Priority labels live under `priority.*`. Success/error toasts are `task.priorityUpdated` and `task.priorityUpdateError`.

* Logs/screenshots
  * None attached. `expandRecurringTasks` already logs `[DEBUG] Processing recurring task` on upcoming expansion; that is existing noise, not a size signal.

## Warm context

Reusable guidance relevant to the feature:

* AGENTS.md / rules / skills
  * [AGENTS.md](../../AGENTS.md) — backend modules stay CommonJS JavaScript; new frontend code is TypeScript. Schema changes are a new reversible migration plus the model. User-facing strings go through i18next; add the English key only. Bug fixes and new behavior get a test at the owning layer: model/unit in `backend/tests/unit/`, API behavior in `backend/tests/integration/`. Run the narrowest suite that covers the change. Playwright is not required for this API-and-component feature unless a spec is added.
  * [.cursor/rules/jira.mdc](../../.cursor/rules/jira.mdc) — site `https://epam-team-ai-adoption.atlassian.net`, JQL scoped to `project = KAN`. Read-only; do not transition or comment on KAN-15 from implementation work.
  * Commands: `npm run migration:create -- --name describe-the-change`, `npm run migration:run` then `npm run migration:undo` for the real SQLite check, `npm run backend:test:unit`, `npm run backend:test:integration` (one worker).

* Team conventions
  * Closest analog is priority, with intentional deltas: size has no activity events, size is editable on list rows, and size is omitted when unset on dense surfaces. Priority changes can appear in activity history; list rows do not edit priority.
  * Access levels are `none` / `ro` / `rw` / `admin`. Edit permission means the same access that can edit priority or title (`rw` or `admin`).
  * Unset encoding is null/absent. Omitting the field is not a clear.

* ADRs
  * None in `docs/`.

* Known constraints
  * Optional. Omitting `size` must not break create or update, and must not change other fields on update.
  * Strict values only: `S`, `M`, `L`, `XL`, unset. No hour mapping.
  * Virtual upcoming rows reuse the template id. Saving size from those rows would change the template and every expanded copy.
  * Attaching edit permission on list reads can add queries. Reuse permission data the list already loads.
  * Adding `size` to the activity field list would try to write an event type `task_event` does not allow.
  * Concurrent editors: last successful write wins. Multi-tab staleness until refresh is accepted. Task deleted or inaccessible mid-edit is an error, not a silent success.
  * Pre-feature rows appear unset. Do not migrate free-text effort notes into size.
  * Non-English locale files are out of scope.

## Cold context

Investigate only if needed:

* Relevant repo areas
  * [backend/modules/tasks/taskEventService.js](../../backend/modules/tasks/taskEventService.js) — `priority_changed` logging. Confirm size is not given a sibling helper.
  * [backend/modules/tasks/core/comparators.js](../../backend/modules/tasks/core/comparators.js) and [backend/modules/tasks/queries/metrics-computation.js](../../backend/modules/tasks/queries/metrics-computation.js) — priority sort and metrics. Size must not gain filter, sort, group, or totals.
  * [backend/modules/tasks/taskSummaryService.js](../../backend/modules/tasks/taskSummaryService.js) — priority emoji in text summaries. Not a v1 surface.
  * [backend/modules/mcp/tools/taskTools.js](../../backend/modules/mcp/tools/taskTools.js) — `create_task` / update tools expose priority. MCP task tools are out of scope; do not add `size` there.
  * Inbox quick capture under `backend/modules/inbox/` and the inbox UI — confirm capture stays name-only (and sometimes priority) with no size field.
  * [backend/middleware/authorize.js](../../backend/middleware/authorize.js) — `hasAccess` implementation behind `requireTaskWriteAccess`, if list reads need the same `rw` / `admin` result.
  * Frontend task-list state owners beyond the files in Hot context, if a save updates one array and details stay stale.

* Documentation
  * Swagger UI at `/api-docs` (authenticated). Source of the task schema is `backend/docs/swagger/tasks.js`.
  * No other feature specs in `docs/` besides the task-size spec and plan.

* Past PRs
  * None reviewed for this map. Defer-until (`20251124000001`) is the in-repo pattern for a nullable column add.

* Monitoring/logs
  * No size-specific metrics or log lines exist. Do not add timeline events as a substitute.

* Story tickets
  * [KAN-15](https://epam-team-ai-adoption.atlassian.net/browse/KAN-15) only. Reporter Ivan Fediaev. Unassigned. Priority Medium. Updated 2026-08-19. Jira AC: values S/M/L/XL/unset; dropdown on list and details; immediate save kept in sync; optional and independent of priority; edit permission required. Spec AC-7 through AC-19 (read-only display, create validation, subtasks, boards, search, recurrence, activity, accessibility, pre-feature unset) are not repeated on the ticket.

## Resources to ignore

* Deprecated documentation
  * [frontend/components/Task/TaskForm/TaskPrioritySection.tsx](../../frontend/components/Task/TaskForm/TaskPrioritySection.tsx) — unused. Do not revive it as the size control.
  * Jira description as the full contract. It predates spec v1.1.

* Generated files
  * Webpack build output, coverage output, SQLite database files, `backend/.env`.

* Unrelated modules
  * Filter, sort, group, search, or saved views by size.
  * Capacity, velocity, or totals by size.
  * Live multi-tab or multi-user sync.
  * Hour ranges for S–XL.
  * Parent/subtask inheritance or roll-up.
  * Copying template size onto new occurrences, or a new recurrence storage model.
  * Editable size on Kanban, Eisenhower, or search.
  * Dense surfaces beyond Kanban, Eisenhower, and search.
  * MCP task tools and habit tools.
  * Non-English files under `public/locales/`.
  * Areas, notes, tags, goals, people, CalDAV, Telegram, and admin, except where a task list on project, tag, or area details renders `TaskItem`.
