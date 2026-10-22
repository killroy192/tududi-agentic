# Context Map

Feature: task size (S / M / L / XL). Story: [KAN-15](https://epam-team-ai-adoption.atlassian.net/browse/KAN-15) (To Do, unassigned). Authority for behavior is `docs/task-size/spec.md`. The plan follows the spec, including where the story text disagrees.

## Hot context

Directly required for the feature right now:

* Current spec and plan
  * `docs/task-size/spec.md` — behavior, acceptance criteria AC-1 through AC-50, and the owner-only write rule.
  * `docs/task-size/plan.md` — confirmed facts, file list, implementation order, and risks. Follow this over the Jira wording.
  * KAN-15 summary: “MK2/MK6: Task size estimate”. The story says anyone with edit permission can change size. The spec replaces that: only the numeric `user_id` on the task record being changed can change its size. Viewers who are not that owner see the label and cannot change it.
  * Stored values are exactly `null`, `S`, `M`, `L`, `XL`. Comparison is case-sensitive and values are not trimmed. The display word Unset is never stored. A successful web task response always includes `size`; `null` means unset. Omitting `size` on update leaves the stored value. Invalid size is HTTP 400 `{ error: "The size is invalid" }` and writes nothing. A body that includes `size` from anyone other than that task’s `user_id` is HTTP 403 `{ error: "Forbidden" }` and applies none of that request. Create paths ignore a client-supplied size and store `null`.
  * A size save from the interface sends only `{ size }`. Open lists copy the returned `size` onto every loaded row with the same uid and leave occurrence `due_date`, `is_virtual_occurrence`, and the other occurrence fields as they are. One toast is shown. English toast text: “Size updated successfully” and “Failed to update size”. Closed labels: Unset, S, M, L, XL, in that order.
  * No screenshots or runtime logs are attached to this feature.

* Active files
  * Persistence. `backend/models/task.js` defines `priority` (integer 0–2, default 0) and numeric `user_id`. There is no `size` column. `Task.associate` wires parent, subtask, and recurring relations. `Task.belongsTo(User)` is registered in `backend/models/index.js`, not inside `task.js`. Newest task migration is `backend/migrations/20260630000002-add-people-to-tasks.js`. It adds columns with `safeAddColumns` from `backend/utils/migration-utils.js`. A new migration must be a newer file. Integration tests sync the schema from models and do not run migration files.
  * Update path. `PATCH /task/:uid` in `backend/modules/tasks/routes.js` is behind `requireTaskWriteAccess` (`backend/modules/tasks/middleware/access.js` → `hasAccess` in `backend/middleware/authorize.js`). Then `buildUpdateAttributes` (`backend/modules/tasks/core/builders.js`), `handleRecurrenceUpdate` (`backend/modules/tasks/operations/recurring.js`), and `logTaskChanges` (`backend/modules/tasks/utils/logging.js`). The success body is `serializeTask` of the updated task. `POST /task` creates a task. `buildTaskAttributes` and `buildUpdateAttributes` copy only fields they already know. Create sets `user_id` from the caller. Subtasks are separate rows created in `backend/modules/tasks/operations/subtasks.js` with the caller as `user_id`.
  * Serialization and upcoming rows. `serializeTask` in `backend/modules/tasks/core/serializers.js` spreads the task record, so a new column appears in every caller, including MCP task tools. Nested subtasks are mapped in the same response and do not attach the owner user. `TASK_INCLUDES` and `TASK_INCLUDES_WITH_SUBTASKS` in `backend/modules/tasks/utils/constants.js` load tags, project, area, and subtasks. They do not load `User`. Virtual upcoming rows are built in `routes.js` by copying the series task, replacing `due_date`, and setting `is_virtual_occurrence`. They reuse the series `id` and `uid`.
  * Fields that must stay off the size path. `handleRecurrenceUpdate` deletes future stored children when the body changes `name`, `project_id`, `priority`, `note`, or recurrence fields. `logTaskChanges` / `captureOldValues` record those same kinds of fields, including priority, and have no size field. A size-only body stays off both lists.
  * Access. Write access is `rw`. The owner gets `rw`. A read-write share and inherited project write also pass. Read-only and no-access callers stop in that middleware with HTTP 403 `{ error: "Forbidden" }`. `isAdmin` in `backend/services/rolesService.js` looks up a user by uid, while this path passes a numeric id, so the administrator role does not grant access here. The owner check for size is separate and comes after write access has passed.
  * Surfaces that must not gain a size field. MCP task tools in `backend/modules/mcp/tools/taskTools.js` return `serializeTask` output and accept priority on create and update. CalDAV builds a VTODO from named fields in `backend/modules/caldav/icalendar/vtodo-serializer.js` and writes a task from `parseVTODOToTask` in `vtodo-parser.js`. Web API docs live in `backend/docs/swagger/tasks.js`.
  * Client model and save. `frontend/entities/Task.ts` has `priority` and no `size` or `user_uid`. `frontend/entities/User.ts` has `uid` and no numeric id. `updateTask` in `frontend/utils/tasksService.ts` sends `PATCH task/:uid`. When the payload contains both `name` and `original_name`, it sends `original_name` as the name. `tasksStore.updateTask` and `updateTaskInStore` in `frontend/store/useStore.ts` spread the response by id. Project ownership in the interface is already decided by comparing `user_uid` with `currentUser.uid` (`frontend/components/Project/ProjectItem.tsx`).
  * Where the control appears. Shared row is `TaskHeader`, rendered by `TaskItem`. `TaskItem` is used by `TaskList` and `GroupedTaskList`, which cover the main list, grouped lists, Today, saved views, projects, areas, tags, Kanban, and the Eisenhower matrix. Expanded subtasks under a list row are local markup in `TaskItem`, separate from `TaskHeader`. Priority on the shared row is a colored border. Details priority is local state in `TaskDetailsHeader`. `PriorityDropdown` (`frontend/components/Shared/PriorityDropdown.tsx`) is a separate closed-label menu, used by the create-task priority section (`frontend/components/Task/TaskForm/TaskPrioritySection.tsx`). Task details is the route `/task/:uid` (`frontend/components/Task/TaskDetails.tsx`). It reads the open task from `tasksStore` with `tasks.find((t) => t.uid === uid)`. Priority in the details header saves immediately with `{ priority }` and toasts `task.priorityUpdated` or `task.priorityUpdateError`. Existing subtasks on task details are `TaskSubtasksSection`, reached through `TaskSubtasksCard`. The new-subtask field is a name input in that section.
  * List holders that keep their own task arrays: `frontend/components/Tasks.tsx`, `frontend/components/Task/TasksToday.tsx`, `frontend/components/Kanban/KanbanBoard.tsx`, `frontend/components/Eisenhower/EisenhowerMatrix.tsx`, `frontend/components/ViewDetail.tsx`, `frontend/components/Tag/TagDetails.tsx`, `frontend/components/Area/AreaDetails.tsx`, `frontend/components/Project/ProjectDetails.tsx`.
  * Copy. English toasts live under `task` in `public/locales/en/translation.json` (`task.priorityUpdated`, `task.priorityUpdateError`). `backup.size` is a different string and stays the backup-file label.
  * Tests that lock current behavior and the new suite named in the plan: `backend/tests/unit/models/task.test.js`, `backend/tests/unit/modules/tasks/builders.test.js`, `backend/tests/integration/tasks.test.js`, `backend/tests/integration/subtasks.test.js`, `backend/tests/integration/permissions-tasks.test.js`, `backend/tests/integration/recurring-tasks.test.js`, `backend/tests/integration/smart-recurring-deletion.test.js`, `backend/tests/integration/mcp/mcp-tools.test.js`, `backend/tests/unit/modules/caldav/icalendar/vtodo-serializer.test.js`, `backend/tests/unit/modules/caldav/icalendar/vtodo-parser.test.js`. Frontend tests are co-located; the existing details example is `frontend/components/Task/TaskDetails/__tests__/TaskContentCard.test.tsx`.

* Logs/screenshots
  * None for this feature.

## Warm context

Reusable guidance relevant to the feature:

* AGENTS.md / rules / skills
  * `AGENTS.md` — module layout (`backend/modules/tasks/` is the exemplar), routes mounted at `/api` and `/api/v1`, public ids are `uid`, frontend I/O through `frontend/utils/*Service.ts` and `getApiPath()`, mutating requests need `x-csrf-token`, i18n source is `public/locales/en/translation.json`. Schema changes go through a new Umzug migration. Do not edit an existing migration.
  * Testing: bug fixes get a test that would have failed before the fix. Backend unit tests under `backend/tests/unit/modules/<module>/`. Integration tests are mostly flat under `backend/tests/integration/`. New tables used in integration tests may need cleanup registration in `backend/tests/helpers/setup.js`. Frontend tests sit next to the code. Commands: `npm test` or targeted backend suites, `npm run frontend:test`, `npm run lint`, `npm run frontend:build`. CI runs lint, backend tests, and frontend build. It does not run frontend Jest or Playwright.
  * `.cursor/rules/jira.mdc` — Jira stays in project KAN; no write tools.
  * Approval gate: a new migration is allowed when it is additive and an existing migration is not edited. The owner check is a new authorization rule on an existing route. It does not add an authentication mechanism. English keys only; other locales are out of scope.

* Team conventions
  * Backend flow is routes → repository / operations → models. Shared errors live in `backend/shared/`.
  * Priority is the nearest existing immediate-save control. Details uses a header dropdown and a `{ priority }` patch. The shared row shows priority as a border, not as that dropdown. Size is its own control beside priority. The priority border, priority menu, activity history, filters, and recurrence child-deletion stay as they are.
  * List pages and task details are different routes. They are not mounted together. A save updates the shared task store and the lists mounted on the current page. Task details, which reads that store, shows the saved size when it is open on that task. Another session sees it on the next load. No live-sync channel is added.
  * `serializeTask` rewrites a recurring series display name (`Daily`, `Weekly`, and so on) and keeps the real name on `original_name`. A size save that sends the whole task can rename the series, because `updateTask` copies `original_name` onto `name` when both are present.

* ADRs
  * None in the repo.

* Known constraints
  * Ownership is enforced on the server. Hiding the dropdown is not the access check. The client cannot compare `user_id` with the signed-in user. Web responses, including nested subtasks, need `user_uid` for that record’s owner so the interface can compare it with `currentUser.uid`. The numeric `user_id` remains the server-side owner check. A subtask or stored recurring child can have a different owner from its parent.
  * Read-only and no-access callers still fail in `requireTaskWriteAccess` before the owner check. That is the existing task access failure. A non-owner who already has write access and sends `size`, including `size` together with another field such as priority, gets HTTP 403 and no field from that request is applied.
  * `serializeTask` spreads the record. MCP results have to drop `size` in the same increment as the column, or tool payloads pick it up. CalDAV parser and serializer field lists stay without size, so a calendar write has no `size` key and leaves the stored size in place.
  * Virtual rows share the series id and uid. Spreading a series update response by id replaces occurrence due dates. The size save sends only `{ size }` and copies only `size` back.
  * A size-only change does not delete future stored recurring children and does not write an activity-history entry. A priority change still does both.
  * A parent size is not calculated from subtasks. A series size does not rewrite a stored child’s size. A virtual upcoming row shows the series task’s size. A recurring completion is not a task and has no size.
  * Create-task form and the new-subtask name field have no size control. New tasks and new subtasks are stored with `size: null`.
  * Integration tests going green does not prove the migration. The new migration still has to apply and roll back on a real SQLite database.
  * `isAdmin` does not grant task access on this path. This work leaves that lookup as it is.

## Cold context

Investigate only if needed:

* Relevant repo areas
  * Permissions and sharing: `backend/middleware/authorize.js`, `backend/tests/integration/permissions-tasks.test.js`, `backend/tests/integration/task-edit-shared-project.test.js`, `backend/tests/integration/task-user-isolation.test.js`, `backend/tests/integration/permissions-admin.test.js`.
  * Recurrence expansion and stored children: `backend/modules/tasks/operations/recurring.js`, `backend/tests/integration/recurring-tasks.test.js`, `backend/tests/integration/recurring-display-fixes.test.js`, `backend/tests/integration/smart-recurring-deletion.test.js`.
  * Task list query, metrics, and filters that use priority and must keep ignoring size: `backend/modules/tasks/routes.js` list handlers, `backend/tests/integration/tasks-metrics.test.js`, `backend/tests/integration/tasks-project-filter.test.js`.
  * How list holders merge an update today: `handleTaskUpdate` in `frontend/components/Tasks.tsx`, `frontend/components/Task/TasksToday.tsx`, and `frontend/components/ViewDetail.tsx`. Today’s handlers send the whole task through `updateTask`, then merge the response by `id`.
  * Surfaces that render tasks without the shared row, and therefore stay without a size control: `frontend/components/Task/NextTaskSuggestion.tsx`, `frontend/components/UniversalSearch/SearchResults.tsx`, `frontend/components/Task/WeeklyCompletionChart.tsx`, `frontend/components/Task/BurndownChart.tsx`, `frontend/components/Task/AreaBalanceBar.tsx`, `frontend/components/Task/LifeBalance.tsx`, `frontend/components/Task/LifeRadar.tsx`.

* Documentation
  * `AGENTS.md` repository map and testing expectations.
  * `backend/docs/swagger/tasks.js` is the web task request and response doc that gains `size` as `null` or one of the four letters.
  * `README.md` and `docs/` have no other task-size material. Product docs at docs.tududi.com are not an input for this change.

* Past PRs
  * None identified for task size. The closest in-repo pattern for a new task column is `backend/migrations/20260630000002-add-people-to-tasks.js`.

* Monitoring/logs
  * No feature-specific monitoring. `backend/services/logService.js` is the general logger used by task change logging. Size does not add an activity-history entry.

* Story tickets
  * [KAN-15](https://epam-team-ai-adoption.atlassian.net/browse/KAN-15) only. No comments, labels, or components. No linked spec inside Jira. Use the repo spec when the story’s “edit permission” line conflicts with owner-only writes.

## Resources to ignore

* Deprecated documentation
  * Parts of `.github/CONTRIBUTING.md` that disagree with `package.json` or current module layout. Prefer `AGENTS.md`.
  * `TaskWithSubtasks` inside `frontend/components/Task/TaskHeader.tsx`. It has no callers.

* Generated files
  * Webpack and Jest output, coverage, and `node_modules`.
  * Sequelize schema built in tests. It is not a substitute for the migration file.

* Unrelated modules
  * Telegram (`backend/modules/telegram/`), inbox capture, goals, habits, notes, quotes, backup, OIDC, and AI assistant. Their payloads do not gain `size`.
  * CalDAV and MCP behavior other than the locks in the plan: MCP results omit `size`, and CalDAV parse and serialize stay without a size field.
  * Filtering, sorting, searching, charts, metrics, and summaries by size.
  * Bulk size edit, a per-day size on virtual occurrences, a size on a recurring completion, recreating stored recurring children, rewriting a child’s size from the series, live updates to other sessions, calculating a parent size from subtasks, and granting administrators access they do not already have.
  * Locale files other than `public/locales/en/translation.json`.
  * `backup.size` in that English file.
