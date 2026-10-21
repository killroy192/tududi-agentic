# Context Map

## Hot context

Directly required for the feature right now:

* Current spec and plan
    * `docs/task-size/spec.md` — agreed behavior. Stored size is `null`, `S`, `M`, `L`, or `XL`. The web label for `null` is Unset. The API field is always present and is never the word Unset. A size change is owner-only, independent of priority, saved immediately, and does not delete stored recurring children or write activity history.
    * `docs/task-size/plan.md` — implementation sequence, file list, and risks. Follow this over the original story where they differ.
    * Story text says anyone with edit permission can change size. Spec assumption replaces that: only the user id stored on that task record can change its size. A read-write collaborator and a user who inherits project write access can see the label and cannot change it. Hiding the menu is not the access check.
* Active files
    * Persistence
        * `backend/models/task.js` — Task model. `priority` is an integer 0–2, default 0. There is no `size` column. Owner is numeric `user_id`.
        * `backend/migrations/` — existing task migrations, newest relevant example `backend/migrations/20260623000001-add-area-id-to-tasks.js`. A size column needs a new migration. Existing migration files stay as they are.
        * `backend/utils/migration-utils.js` — `safeAddColumns` used by recent task migrations.
    * Update and serialization
        * `backend/modules/tasks/routes.js` — `POST /task` creates a task. `PATCH /task/:uid` is behind `requireTaskWriteAccess` and calls `buildUpdateAttributes`, `handleRecurrenceUpdate`, and `logTaskChanges`. Upcoming lists build virtual rows around lines 190–198: copy of the series task, replaced `due_date`, `is_virtual_occurrence: true`, reused series `id` and `uid`. Routes are mounted at `/api` and `/api/v1` from `backend/app.js`.
        * `backend/modules/tasks/core/builders.js` — `buildTaskAttributes` sets the owner on create and does not know size. `buildUpdateAttributes` copies only fields it already understands. Omitting a field leaves the stored task value for the fields it handles.
        * `backend/modules/tasks/core/serializers.js` — `serializeTask` spreads the task record, then adds display fields. Subtasks are mapped in the same response. Virtual rows go through this serializer. Adding a column on the model therefore appears in web and MCP payloads unless MCP strips it.
        * `backend/modules/tasks/utils/constants.js` — `TASK_INCLUDES` and `TASK_INCLUDES_WITH_SUBTASKS`. Subtask includes do not currently attach the owner user.
        * `backend/modules/tasks/operations/recurring.js` — `handleRecurrenceUpdate` deletes future stored children when the body changes `name`, `project_id`, `priority`, `note`, or recurrence fields. A body that contains only `size` must not match that list.
        * `backend/modules/tasks/utils/logging.js` — `captureOldValues` and `logTaskChanges`. The activity field list includes `priority` and does not include size.
        * `backend/modules/tasks/operations/subtasks.js` — subtasks are separate task rows. `createSubtasks` sets `user_id` from the caller and `parent_task_id`. A parent size is not derived from children.
        * `backend/modules/tasks/middleware/access.js` — `requireTaskReadAccess` (`ro`) and `requireTaskWriteAccess` (`rw`) via `hasAccess` in `backend/middleware/authorize.js`. Write access still runs before any owner-only size check. No-access and read-only callers fail here.
        * `backend/services/permissionsService.js` — `getAccess` for `task`: owner gets `rw`; otherwise access is inherited from the parent project, then from a direct share. `isAdmin` is called with the numeric user id.
        * `backend/services/rolesService.js` — `isAdmin` looks up the user by `uid`. A numeric id does not match, so the administrator role does not grant task access on this path. Size does not add an admin viewing path.
        * `backend/middleware/auth.js` — session cookie and Bearer token both set `req.currentUser`. That user has numeric `id` and string `uid`.
        * `backend/modules/mcp/tools/taskTools.js` — MCP task tools call `serializeTask` / `serializeTasks`. Their payloads must not gain `size` or `user_uid`.
        * `backend/modules/caldav/icalendar/vtodo-serializer.js` — builds a VTODO from named fields, including priority. It does not use the web serializer. Size stays out of that mapping.
        * `backend/docs/swagger/tasks.js` — task request and response schema. Priority is documented. Size is not.
    * Frontend model, save, and shared state
        * `frontend/entities/Task.ts` — task type has `priority` and no `size` or `user_uid`. `PriorityType` is separate from size.
        * `frontend/entities/User.ts` — signed-in user has `uid` and no numeric `id`. The client cannot compare `user_id` with the signed-in user.
        * `frontend/utils/tasksService.ts` — `updateTask` sends `PATCH task/:uid`. If the payload includes both `name` and `original_name`, it sends `original_name` as the name. A size save that sends the whole task object can therefore change other fields.
        * `frontend/store/useStore.ts` — `tasksStore` holds the open task list. `updateTaskInStore` replaces the task with the same `uid`. Task details reads that store.
        * `frontend/components/Task/TaskDetails.tsx` — selects the open task with `tasksStore.tasks.find((t) => t.uid === uid)`. `handlePriorityUpdate` is the immediate-save pattern: update, toast `task.priorityUpdated` / `task.priorityUpdateError`, then replace the store entry. Task details and the task list are different routes.
    * Where the control is shown
        * `frontend/components/Task/TaskHeader.tsx` — shared row rendered by `TaskItem`. Priority is passed into the row. `TaskWithSubtasks` in this file has no callers.
        * `frontend/components/Task/TaskItem.tsx` — wraps `TaskHeader`. Expanded subtasks are the local `SubtasksDisplay` (not the one inside `TaskHeader`). That row shows the subtask name and priority and can be completed. Priority border is `getPriorityBorderClassName`; size does not replace that border.
        * `frontend/components/Task/TaskList.tsx` and `frontend/components/Task/GroupedTaskList.tsx` — render `TaskItem`.
        * `frontend/components/Task/TaskDetails/TaskDetailsHeader.tsx` — priority dropdown in the details header.
        * `frontend/components/Task/TaskDetails/TaskSubtasksCard.tsx` — renders `TaskSubtasksSection` for existing subtasks on task details.
        * `frontend/components/Task/TaskForm/TaskSubtasksSection.tsx` — existing subtask rows plus the new-subtask name field. The name field stays without a size control.
        * `frontend/components/Shared/PriorityDropdown.tsx` — existing dropdown: closed label, menu, `react-i18next`. Size is a separate control beside it, not a priority value.
    * List holders that keep their own task arrays and merge an update by `id`
        * `frontend/components/Tasks.tsx` — `handleTaskUpdate` PATCHes the whole task and replaces the matching `id`.
        * `frontend/components/Task/TasksToday.tsx` — `handleTaskUpdate` merges into metric lists by `id`. Today is where virtual upcoming rows are shown.
        * `frontend/components/Kanban/KanbanBoard.tsx`
        * `frontend/components/Eisenhower/EisenhowerMatrix.tsx`
        * `frontend/components/ViewDetail.tsx` — saved and filtered views.
        * `frontend/components/Tag/TagDetails.tsx`
        * `frontend/components/Area/AreaDetails.tsx` — merges the shared store by `uid`.
        * `frontend/components/Project/ProjectDetails.tsx` — local list, merge by `id`.
        * Merging a full update response onto a virtual row replaces that row’s occurrence `due_date` with the series due date. A size response has to copy `size` onto every loaded row with that `uid` and leave occurrence identity in place. One toast per save.
    * Copy
        * `public/locales/en/translation.json` — English source of truth. Task toasts live under `task`, including `task.priorityUpdated` and `task.priorityUpdateError`. `backup.size` is the backup-file size label and is a different string.
* Logs/screenshots
    * None for this feature.

## Warm context

Reusable guidance relevant to the feature:

* AGENTS.md / rules / skills
    * `.cursor/rules/playwright.mdc` — locator and structure rules if a UI check is written as Playwright. Acceptance criteria marked UI Check or Manual Test are not all required to become new e2e files by the plan.
* Team conventions
    * User-facing strings go through `useTranslation` / `t(key, englishFallback)`. Visible labels are Unset, S, M, L, and XL. Toasts are “Size updated successfully” and “Failed to update size”.
    * Frontend is React and TypeScript. Backend is Node.js, Express, Sequelize, and SQLite.
    * Task REST stays under the existing task routes. Authentication stays session cookie and Bearer token.
    * Priority already saves immediately from task details and shows one success or one error toast. Size follows that toast shape and stays independent of priority.
    * `frontend/components/Project/ProjectItem.tsx` already compares `project.user_uid` with `currentUser.uid` to decide ownership in the interface. Task responses do not yet include `user_uid`.
* ADRs
    * None in the repo.
* Known constraints
    * Allowed stored values are exactly `null`, `S`, `M`, `L`, `XL`. Comparison is case-sensitive and values are not trimmed. Anything else is HTTP 400 `{ error: "The size is invalid" }`. Omitting `size` is not an error and does not clear a stored size.
    * A non-owner who sends `size` gets HTTP 403 `{ error: "Forbidden" }`, and the rest of that request is not applied. Read-only and no-access callers still fail in `requireTaskWriteAccess` before that owner check. A user who cannot view the task gets the existing access failure. The stored size stays unchanged.
    * Create does not accept size. `POST /task` and subtask creation leave `size` null even if the client sends one. The create path is `frontend/Layout.tsx` `createAndOpenTaskDetails` and `frontend/components/Task/NewTask.tsx`. Once the task exists, details and the shared row show Unset.
    * Size is per task record. Parent, subtask, series, and stored recurring child each have their own. A virtual upcoming row is a projection of the series task, not its own record. A recurring completion is not a task and has no size.
    * A size-only body is not a recurrence-template change and is not an activity-history change. A request that also changes name, project, priority, note, or recurrence keeps today’s child-deletion and history behavior.
    * Open views that the owner just saved update from that response. Another session sees the size on its next load. There is no live-sync channel.
    * Integration tests rebuild the schema from models. The migration still has to apply and roll back on a real SQLite database.
    * CalDAV writes only fields present in the parsed VTODO. Leaving size out of that parser keeps the stored size.

## Cold context

Investigate only if needed:

* Relevant repo areas
    * `backend/modules/tasks/operations/list.js` — list and grouped-list serialization through `serializeTasks`.
    * `backend/modules/tasks/queries/` — priority filters, ordering, and metrics. Size is not a filter or a metric.
    * `backend/modules/telegram/` — notifications. Telegram does not serialize the task model and does not gain a size field.
    * `frontend/components/Inbox/` — quick capture creates a task and opens details. The capture form itself is not a size control.
* Documentation
    * `backend/docs/swagger/tasks.js` is the task API doc to extend with `size` (`null` and the four letters) on the web request and response.
* Past PRs
    * None captured for this feature.
* Monitoring/logs
    * None.
* Story tickets
    * The story in the task description is the original wording. `docs/task-size/spec.md` acceptance criteria AC-1 through AC-50 are the verifiable list. The same table is copied in the plan.
* Nearby tests, for patterns only
    * `backend/tests/integration/tasks.test.js`
    * `backend/tests/integration/permissions-tasks.test.js`
    * `backend/tests/integration/subtasks.test.js`
    * `backend/tests/integration/recurring-tasks.test.js`
    * `backend/tests/integration/mcp/mcp-tools.test.js`
    * `backend/tests/unit/modules/caldav/icalendar/vtodo-serializer.test.js`

## Resources to ignore

* Deprecated documentation
    * None found for task size.
* Generated files
    * Build output, coverage, and SQLite database files.
* Unrelated modules
    * Charts and summaries: `frontend/components/Task/WeeklyCompletionChart.tsx`, `frontend/components/Task/BurndownChart.tsx`, `frontend/components/Task/LifeBalance.tsx`, `frontend/components/Task/LifeRadar.tsx`, `frontend/components/Task/AreaBalanceBar.tsx`, `backend/modules/tasks/queries/metrics-queries.js`, `backend/modules/tasks/queries/metrics-computation.js`. They do not show a size control.
    * Next-task suggestion: `frontend/components/Task/NextTaskSuggestion.tsx`, `frontend/utils/suggestionScoringUtils.ts`.
    * Search: `frontend/components/UniversalSearch/SearchResults.tsx`, `frontend/utils/searchService.ts`.
    * `backup.size` in `public/locales/en/translation.json`.
    * `TaskWithSubtasks` in `frontend/components/Task/TaskHeader.tsx`. It has no callers and stays unchanged.
    * `frontend/components/Task/TaskForm/TaskPrioritySection.tsx` — priority on a form section; it is not the size control and has no current callers.
    * Telegram, CalDAV field mapping, and MCP payload shape, except the MCP strip that keeps `size` and `user_uid` off tool responses.
    * Bulk edit, size filters, size sort, size search, activity history for size, and a per-occurrence size.
