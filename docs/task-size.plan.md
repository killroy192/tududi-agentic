# Task size (KAN-15)

Implementation plan for [docs/task-size.spec.md](docs/task-size.spec.md). Jira: [KAN-15](https://epam-team-ai-adoption.atlassian.net/browse/KAN-15).

### Confirmed Facts

- Tasks have no size, effort, or t-shirt field. Priority is a separate nullable integer on [backend/models/task.js](backend/models/task.js).
- Task HTTP handling lives in [backend/modules/tasks/routes.js](backend/modules/tasks/routes.js). Create and update attributes are built in [backend/modules/tasks/core/builders.js](backend/modules/tasks/core/builders.js). Responses are shaped by [backend/modules/tasks/core/serializers.js](backend/modules/tasks/core/serializers.js), which spreads the model JSON, so a new column is returned once it is on the model.
- PATCH already keeps omitted fields: [buildUpdateAttributes](backend/modules/tasks/core/builders.js) copies the stored value when the body omits a field, and only applies nullable fields such as `assigned_to` when the key is present. `null` can clear those fields.
- Updates require write access through `requireTaskWriteAccess` in [backend/modules/tasks/middleware/access.js](backend/modules/tasks/middleware/access.js). Read-only access is rejected. The client task payload does not currently include that access level.
- Activity events are written only for fields listed in [backend/modules/tasks/utils/logging.js](backend/modules/tasks/utils/logging.js). Priority is on that list. [backend/models/task_event.js](backend/models/task_event.js) allowlists event types; there is no size event.
- Upcoming lists expand recurring templates into virtual rows in `expandRecurringTasks` ([backend/modules/tasks/routes.js](backend/modules/tasks/routes.js)). Those rows copy the template JSON, including any new column, and keep the template identity. Separately stored children use `recurring_parent_id`. Changing template `name`, `project_id`, `priority`, or `note` can delete future children in [backend/modules/tasks/operations/recurring.js](backend/modules/tasks/operations/recurring.js). Size is not part of that list today.
- Subtasks created with a parent in [backend/modules/tasks/operations/subtasks.js](backend/modules/tasks/operations/subtasks.js) set their own priority and do not copy other parent attributes.
- List rows, Kanban cards, and Eisenhower cards all render [frontend/components/Task/TaskItem.tsx](frontend/components/Task/TaskItem.tsx) and [frontend/components/Task/TaskHeader.tsx](frontend/components/Task/TaskHeader.tsx). Kanban already hides the status control with `hideStatusControl` and `isKanbanView`. Eisenhower does not pass those flags. Search results are a separate list in [frontend/components/UniversalSearch/SearchResults.tsx](frontend/components/UniversalSearch/SearchResults.tsx) and do not use `TaskItem`.
- Priority is editable on task details ([frontend/components/Task/TaskDetails.tsx](frontend/components/Task/TaskDetails.tsx), [frontend/components/Task/TaskDetails/TaskDetailsHeader.tsx](frontend/components/Task/TaskDetails/TaskDetailsHeader.tsx)) with immediate save, success and error toasts, and a store refresh. List rows do not edit priority.
- Creating a task from the sidebar ([frontend/Layout.tsx](frontend/Layout.tsx)) inserts a stub, then opens task details. Inline [frontend/components/Task/NewTask.tsx](frontend/components/Task/NewTask.tsx) and inbox quick capture collect a name (and sometimes priority) without a full attribute form. [frontend/components/Task/TaskForm/TaskPrioritySection.tsx](frontend/components/Task/TaskForm/TaskPrioritySection.tsx) is unused.
- Completed and archived tasks are statuses on the same row. The details priority control is not disabled for those statuses.
- Search task hits are serialized tasks ([backend/modules/search/service.js](backend/modules/search/service.js)), so a new column is present in the payload once serialized.
- English strings live in [public/locales/en/translation.json](public/locales/en/translation.json). Priority labels are under `priority.*`.
- Schema changes require a new migration. Recent column adds use `safeAddColumns` (for example [backend/migrations/20251124000001-add-defer-until-to-tasks.js](backend/migrations/20251124000001-add-defer-until-to-tasks.js)).

### Assumptions

- Store size as a nullable string column `size` on `tasks`, limited to `S`, `M`, `L`, and `XL`. Unset is SQL `NULL` and JSON `null`. Existing rows stay unset because the column is added without a backfill.
- API field name is `size`. Create: omitted or `null` stores unset; any other value rejects the create and leaves no row. Update: omitted leaves the stored value; `null` clears it; any other value rejects the update and leaves the stored value. Priority and size are written only when their own key is present.
- Reject invalid size in the task attribute builder before `create` or `update`, using the existing 400 task error response. Model validation is a second guard.
- The editable “full New Task” surface is task details after stub creation, which is where priority is set today. The same size control covers that flow. Inline name capture and inbox quick capture stay without a size field. `POST /api/task` still accepts `size` for API clients.
- Virtual upcoming occurrences are serialized with size unset, and the list size control does not save from a virtual row. Persisted templates, legacy recurring children, and subtasks each keep their own size. Template size changes do not update or delete children.
- Edit vs read-only UI uses the existing task access check (`rw` / `admin` may edit; `ro` may view). Attach that result on task reads the size UI consumes. Do not add a size-specific permission. `PATCH` stays behind the current write middleware.
- Completed and archived tasks use the same size control as other statuses when the user can edit.
- Size changes are left out of the activity field list and out of task-event allowlists, so they produce no timeline events.
- Labels, including None, are English i18n keys. The control has an accessible name and can be operated from the keyboard.
- A failed update shows an error toast and restores the last saved size. A successful update may show a toast, matching priority.
- After a successful save, both the view’s task list and the shared task store ([frontend/store/useStore.ts](frontend/store/useStore.ts)) hold the new size, so opening details in the same session shows it.

### Files / Modules Involved

- [backend/models/task.js](backend/models/task.js) and a new migration under [backend/migrations/](backend/migrations/)
- [backend/modules/tasks/core/parsers.js](backend/modules/tasks/core/parsers.js), [backend/modules/tasks/core/builders.js](backend/modules/tasks/core/builders.js), [backend/modules/tasks/routes.js](backend/modules/tasks/routes.js), [backend/modules/tasks/core/serializers.js](backend/modules/tasks/core/serializers.js)
- [backend/modules/tasks/utils/logging.js](backend/modules/tasks/utils/logging.js) and [backend/models/task_event.js](backend/models/task_event.js) — leave size out of event logging
- [backend/modules/tasks/operations/recurring.js](backend/modules/tasks/operations/recurring.js) and [backend/modules/tasks/operations/subtasks.js](backend/modules/tasks/operations/subtasks.js)
- [backend/config/swagger.js](backend/config/swagger.js) and [backend/docs/swagger/tasks.js](backend/docs/swagger/tasks.js)
- [backend/tests/integration/tasks.test.js](backend/tests/integration/tasks.test.js), [backend/tests/unit/models/task.test.js](backend/tests/unit/models/task.test.js), plus permission and recurrence tests that already cover task writes
- [frontend/entities/Task.ts](frontend/entities/Task.ts), [frontend/utils/tasksService.ts](frontend/utils/tasksService.ts), [frontend/store/useStore.ts](frontend/store/useStore.ts)
- [frontend/components/Task/TaskHeader.tsx](frontend/components/Task/TaskHeader.tsx), [frontend/components/Task/TaskItem.tsx](frontend/components/Task/TaskItem.tsx), list parents that pass task updates ([frontend/components/Tasks.tsx](frontend/components/Tasks.tsx), [frontend/components/Task/TasksToday.tsx](frontend/components/Task/TasksToday.tsx), [frontend/components/ViewDetail.tsx](frontend/components/ViewDetail.tsx), [frontend/components/Project/ProjectDetails.tsx](frontend/components/Project/ProjectDetails.tsx), [frontend/components/Tag/TagDetails.tsx](frontend/components/Tag/TagDetails.tsx), [frontend/components/Area/AreaDetails.tsx](frontend/components/Area/AreaDetails.tsx))
- [frontend/components/Task/TaskDetails.tsx](frontend/components/Task/TaskDetails.tsx) and [frontend/components/Task/TaskDetails/TaskDetailsHeader.tsx](frontend/components/Task/TaskDetails/TaskDetailsHeader.tsx)
- [frontend/components/Kanban/KanbanBoard.tsx](frontend/components/Kanban/KanbanBoard.tsx), [frontend/components/Eisenhower/EisenhowerMatrix.tsx](frontend/components/Eisenhower/EisenhowerMatrix.tsx), [frontend/components/UniversalSearch/SearchResults.tsx](frontend/components/UniversalSearch/SearchResults.tsx)
- [public/locales/en/translation.json](public/locales/en/translation.json)

### Implementation Plan

1. **Model and migration tests, then schema.** Add a unit test that `S`, `M`, `L`, `XL`, and null are valid and any other size is rejected. Add the nullable `size` column on the Task model and a new reversible migration using `safeAddColumns`. Confirm the migration applies and rolls back on a real SQLite database. Existing tasks remain unset.
2. **Create-contract tests, then create path.** Add integration tests: omit size and send `null` both create an unset task; `S`/`M`/`L`/`XL` persist; an unsupported value returns 400 and creates no row. Teach task creation to accept only those values, defaulting omitted size to unset.
3. **Update-contract tests, then update path.** Add integration tests: omitting `size` leaves it unchanged and leaves other fields unchanged; `null` clears it; an unsupported value returns 400 and leaves the previous size; changing size leaves priority unchanged and the reverse is true. Teach the update builder the omit-versus-clear rule and reject invalid values before the row is written.
4. **Permission and timeline tests.** Add an integration test that a read-only user cannot change size and the stored value stays put, and that a successful size change adds no task-event row. Keep size off the activity field list and off the task-event allowlist. On task reads used by the UI, include whether the current user may edit, using the same access rules as task update.
5. **Recurrence and subtask tests, then isolation.** Add tests that a subtask can have a different size from its parent, that creating subtasks with a parent does not copy the parent size, that a serialized virtual upcoming occurrence has unset size even when the template has a size, and that changing the template size does not change an existing recurring child. Implement those exclusions. Do not add `size` to the template-field list that deletes future children.
6. **Client type, copy, and details control.** Add `size` to the client task type and English labels for None, S, M, L, and XL, plus update-error copy. On task details, including the screen opened for a newly created task, add a keyboard-operable size control with an accessible name. Editors save immediately and refresh the shared store. Read-only users see the label when size is set and a non-interactive unset treatment when it is unset, with no enabled control. On failure, show an error toast and keep the last saved value. Completed and archived tasks stay editable for editors.
7. **List-row control, with boards and search staying display-only.** On standard list rows (Today, upcoming, sidebar task lists, saved views, project, tag, area), editors get the same dropdown and immediate save. A successful change updates that view’s tasks and the shared store so details opened without a full reload match. A failed save shows an error toast and restores the last saved size. When the shared row is used by Kanban or Eisenhower, render size as non-interactive text when set and omit it when unset, including for virtual upcoming rows. Search results get the same display-only treatment and no control that can save size.
8. **API documentation.** Document `size` on the task schema and on create and update in the existing Swagger task docs, including omit, null, and rejected values.

### Risks

- `TaskItem` is shared with Kanban and Eisenhower. A size control added with no view flag would make those boards editable.
- Virtual upcoming rows reuse the template identity. Saving size from those rows would change the template and every expanded copy.
- Several list screens keep their own task arrays besides the shared store. Updating only one of them leaves details and the list out of sync until reload.
- Integration tests rebuild schema with `sync`, so a model-only change can pass while the migration is wrong. The migration still needs a real apply-and-undo check.
- Attaching edit permission on list reads can add queries. Reuse the permission data the list already uses where possible.
- Leaving size on the activity field list would try to write an event type the task-event model does not allow.

### Out Of Scope

- Filter, sort, group, search, or saved views by size
- Capacity, velocity, or totals by size
- Size on inbox quick capture and inline name-only create
- Live multi-tab or multi-user sync
- Timeline or activity events for size
- Hour ranges for S–XL
- Editable size on Kanban, Eisenhower, or search
- Parent/subtask inheritance or roll-up
- Copying template size onto new occurrences, or a new recurrence storage model
- Dense surfaces beyond Kanban, Eisenhower, and search
- MCP task tools
- Non-English locale files

### Verification

| ID | Acceptance Criterion | Verifiable By |
|----|----------------------|---------------|
| AC-1 | Edit-permission user sets S/M/L/XL from a list-row dropdown; after full reload the size remains. | Manual Test, UI Check |
| AC-2 | Edit-permission user sets S/M/L/XL from task details; after full reload the size remains. | Manual Test, UI Check |
| AC-3 | Edit-permission user selects None on list or details; after reload API and UI show unset. | Manual Test, API Check, UI Check |
| AC-4 | Create or update with size omitted succeeds; task stays unset; other fields stay unchanged on update. | Automated Test, API Check |
| AC-5 | Change size on the list, open details in-app, and see the new size; the reverse path matches. | Manual Test, Integration Test |
| AC-6 | Changing size leaves priority unchanged, and changing priority leaves size unchanged. | Manual Test, API Check |
| AC-7 | Read-only user sees size when set, has no enabled size control, and an API update is rejected with the stored size unchanged. | Manual Test, UI Check, API Check |
| AC-8 | New-task details: leaving size unset keeps the task unset; choosing S/M/L/XL persists that size. API create accepts the same values. | Manual Test, UI Check, API Check |
| AC-9 | Subtask size can differ from the parent; changing one leaves the other unchanged. | Manual Test, API Check |
| AC-10 | Kanban, Eisenhower, and search show a non-interactive label when size is set, omit size UI when unset, and cannot save a size change. | Manual Test, UI Check |
| AC-11 | Failed size update on list or details shows an error toast and restores the last saved size. | Manual Test, UI Check |
| AC-12 | Create with an unsupported size fails with validation feedback and creates no task. | Manual Test, API Check |
| AC-13 | A new recurring occurrence starts unset when the template has a size; editing one persisted occurrence does not change another or the template. | Manual Test, Integration Test |
| AC-14 | Editing template size from list or details does not change size on existing occurrences. | Manual Test, Integration Test |
| AC-15 | Completed and archived tasks remain size-editable for edit-permission users. | Manual Test, UI Check |
| AC-16 | After size changes, task activity shows no size-related events. | Manual Test, API Check |
| AC-17 | Create or update with an unsupported size is rejected; on update the previous size is unchanged. | Automated Test, API Check |
| AC-18 | Tasks that existed before the feature appear unset. | Manual Test, API Check |
| AC-19 | The size control is keyboard operable, has an accessible name, and None / S / M / L / XL use localized strings. | Manual Test, UI Check |
