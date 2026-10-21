# Task size

Source: [KAN-15](https://epam-team-ai-adoption.atlassian.net/browse/KAN-15) and `docs/task-size/spec.md`.

The story text says anyone with edit permission can change size. The spec replaces that rule: only the user id stored on the task record can change its size. This plan follows the spec.

## Confirmed Facts

- A task is a Sequelize model in `backend/models/task.js`. `priority` is an integer 0–2. There is no `size` column. The owner is numeric `user_id`. `Task.belongsTo(User)` already exists.
- Task REST routes live in `backend/modules/tasks/routes.js` and are mounted at `/api` and `/api/v1`. `POST /task` creates a task. `PATCH /task/:uid` is behind `requireTaskWriteAccess`, then `buildUpdateAttributes`, `handleRecurrenceUpdate`, and `logTaskChanges`. The success body is `serializeTask` of the updated task.
- `buildTaskAttributes` and `buildUpdateAttributes` in `backend/modules/tasks/core/builders.js` copy only fields they already know. Omitting one of those fields on update keeps the stored value.
- `serializeTask` in `backend/modules/tasks/core/serializers.js` spreads the task record, so a new column appears in every caller of that serializer, including MCP task tools. Nested subtasks are mapped in the same response. Virtual upcoming rows are built in `routes.js` by copying the series task, replacing `due_date`, and setting `is_virtual_occurrence`. They reuse the series `id` and `uid`.
- `handleRecurrenceUpdate` deletes future stored children when the body changes `name`, `project_id`, `priority`, `note`, or recurrence fields. `logTaskChanges` records those same kinds of fields, including priority, and has no size field.
- Write access is `requireTaskWriteAccess` (`rw`) via `hasAccess`. The owner gets `rw`. A read-write share and inherited project write also pass. Read-only and no-access callers stop in that middleware with HTTP 403 `{ error: "Forbidden" }`. `isAdmin` looks up a user by uid, while this path passes a numeric id, so the administrator role does not grant access here.
- Subtasks are separate task rows created in `backend/modules/tasks/operations/subtasks.js` with the caller as `user_id`. A parent priority is not derived from them.
- The signed-in client user in `frontend/entities/User.ts` has `uid` and no numeric id. The task type in `frontend/entities/Task.ts` has `priority` and no `size` or `user_uid`. Project ownership in the interface is already decided by comparing `user_uid` with `currentUser.uid`.
- `updateTask` in `frontend/utils/tasksService.ts` sends `PATCH task/:uid`. When the payload contains both `name` and `original_name`, it sends `original_name` as the name. List handlers such as `TasksToday.handleTaskUpdate` send the whole task through that function, then merge the response by `id` and spread it onto the existing row. `tasksStore.updateTaskInStore` does the same spread by `id`.
- Task details is the route `/task/:uid`. It reads the open task from `tasksStore` with `tasks.find((t) => t.uid === uid)`. Priority in the details header saves immediately with `{ priority }` and toasts `task.priorityUpdated` or `task.priorityUpdateError`.
- The shared row is `TaskHeader`, rendered by `TaskItem`. `TaskItem` is used by `TaskList` and `GroupedTaskList`, which cover the main list, grouped lists, Today, saved views, projects, areas, tags, Kanban, and the Eisenhower matrix. Expanded subtasks under a list row are local markup in `TaskItem`, separate from `TaskHeader`. Existing subtasks on task details are `TaskSubtasksSection`, reached through `TaskSubtasksCard`. The new-subtask field is a name input in that section. The create-task form has a priority control and no size control.
- Priority on the shared row is a colored border. The details priority menu is local state in `TaskDetailsHeader`. `PriorityDropdown` is a separate closed-label menu. English toasts live under `task` in `public/locales/en/translation.json`. `backup.size` is a different string.
- CalDAV builds a VTODO from named fields in `vtodo-serializer.js`, including priority, and writes a task from `parseVTODOToTask`. MCP task tools return `serializeTask` output and accept priority on create and update.
- Integration tests sync the schema from models. They do not run migration files. Recent task migrations add columns with `safeAddColumns` in a new file. The newest task migration is `backend/migrations/20260630000002-add-people-to-tasks.js`.

## Assumptions

- The web field name is `size`. Stored values are exactly `null`, `S`, `M`, `L`, and `XL`. Comparison is case-sensitive and values are not trimmed. The display word Unset is never stored. A successful web task response always includes `size`, and `null` means unset.
- An invalid size returns HTTP 400 `{ error: "The size is invalid" }` before the task is written. Omitting `size` is not an error and leaves the stored value unchanged.
- A body that includes `size` from anyone other than that task’s `user_id` returns HTTP 403 `{ error: "Forbidden" }` and applies none of that request. Read-only and no-access callers still fail in `requireTaskWriteAccess` before this check, which is the existing task access failure.
- Create ignores a client-supplied size. `POST /task`, subtask creation, and any other current create path store `null`.
- Web task responses, including nested subtasks, include `user_uid` for that record’s owner. The interface compares it with the signed-in user’s `uid`. The numeric `user_id` remains the server-side owner check.
- A size save sends only `{ size }`. Open lists copy that saved `size` onto every loaded row with the same uid and leave occurrence `due_date`, `is_virtual_occurrence`, and the other occurrence fields as they are. One toast is shown for that save.
- Task list pages and task details are different routes, so they are not mounted together. A save updates the shared task store and the lists mounted on the current page. Task details, which reads that store, shows the saved size when it is open on that task. Another session sees it on the next load. No live-sync channel is added.
- MCP task-tool responses omit `size`. MCP inputs stay as they are. CalDAV parse and serialize stay without a size field, so a calendar write has no `size` key and leaves the stored size in place.
- A size-only body is left off the recurrence template-field list and off the activity-history field list. A request that also changes name, project, priority, note, or recurrence keeps today’s child-deletion and history behavior.

## Files / Modules Involved

- Persistence: `backend/models/task.js`, a new file under `backend/migrations/` using `backend/utils/migration-utils.js`.
- Update, validation, and serialization: `backend/modules/tasks/core/builders.js`, `backend/modules/tasks/routes.js`, `backend/modules/tasks/core/serializers.js`, `backend/modules/tasks/utils/constants.js`, `backend/modules/tasks/operations/subtasks.js`.
- Left unchanged on purpose, with tests that lock the current behavior: `backend/modules/tasks/operations/recurring.js`, `backend/modules/tasks/utils/logging.js`, `backend/modules/caldav/icalendar/vtodo-serializer.js`, `backend/modules/caldav/icalendar/vtodo-parser.js`.
- MCP responses: `backend/modules/mcp/tools/taskTools.js`.
- API doc: `backend/docs/swagger/tasks.js`.
- Client model and save: `frontend/entities/Task.ts`, `frontend/utils/tasksService.ts`, `frontend/store/useStore.ts`.
- Size control and the places it appears: a new dropdown beside `frontend/components/Shared/PriorityDropdown.tsx`; `frontend/components/Task/TaskHeader.tsx`; `frontend/components/Task/TaskItem.tsx`; `frontend/components/Task/TaskDetails/TaskDetailsHeader.tsx`; `frontend/components/Task/TaskDetails.tsx`; `frontend/components/Task/TaskForm/TaskSubtasksSection.tsx`; `frontend/components/Task/TaskDetails/TaskSubtasksCard.tsx`.
- List holders that keep their own task arrays: `frontend/components/Tasks.tsx`, `frontend/components/Task/TasksToday.tsx`, `frontend/components/Kanban/KanbanBoard.tsx`, `frontend/components/Eisenhower/EisenhowerMatrix.tsx`, `frontend/components/ViewDetail.tsx`, `frontend/components/Tag/TagDetails.tsx`, `frontend/components/Area/AreaDetails.tsx`, `frontend/components/Project/ProjectDetails.tsx`.
- Copy: `public/locales/en/translation.json`, next to `task.priorityUpdated` and `task.priorityUpdateError`.
- Tests: a new backend integration suite for size, plus the existing MCP, CalDAV, permissions, subtask, and recurring suites where those behaviors need a lock. Frontend tests co-located under `frontend/components/Task/` and `frontend/components/Shared/`.

## Implementation Plan

1. Write a model test that a task can be stored with `size` of `null`, `S`, `M`, `L`, or `XL`, and that any other value is rejected. Then add a nullable `size` column in a new migration, newer than `20260630000002-add-people-to-tasks.js`, and the matching field on the Task model. Existing rows stay `null`. The migration down removes the column. Do not edit an older migration.

2. Write API tests that creating a task, creating a subtask, and loading an existing task all return `size: null`, including when the create body contains a size. Also assert that a task and its nested subtasks include `user_uid`. Then keep size out of create and subtask-create attributes so the column stays `null`, and include `user_uid` on the web task and nested-subtask payloads. The owner uid has to be loaded for the parent and for each subtask; subtask includes today do not attach the owner user.

3. Write update tests for the owner: `S`, `M`, `L`, `XL`, and `null` persist and come back on the response; omitting `size` leaves a saved value; `XX`, a different case, a surrounding space, and the string `"null"` return HTTP 400 `{ error: "The size is invalid" }` and leave the stored size unchanged. Then accept `size` on update only when the body contains it, and reject anything outside the allowed set before the task is written.

4. Write access tests. A read-write collaborator and a read-only user who send `size` for someone else’s task get HTTP 403, and the stored size is unchanged. A user who cannot view the task gets the existing write-access failure, and the stored size is unchanged. When a non-owner sends `size` together with another field such as priority, neither field changes. Then enforce the owner check on `PATCH /task/:uid` after write access has passed and before any attribute is saved.

5. Write tests that a size-only update leaves priority, status, due date, project, area, tags, completion, and recurrence unchanged, does not delete a future stored recurring child, and does not add an activity-history entry. A priority change still deletes future stored children and still writes priority history. Leave `size` off the template-field list in `handleRecurrenceUpdate` and off the activity field list in `logTaskChanges`.

6. Write tests that a parent size change leaves the subtask size, a subtask size change leaves the parent size, a series size change leaves a stored child’s size and the child row, and a child size change leaves the series size. Virtual upcoming rows in the list payload show the series size. These paths already use the same task record and the same update; the tests lock that, and the upcoming copy already carries columns present on the series task.

7. Write tests that an MCP task-tool payload has no `size` field and that MCP create and update inputs still have no size parameter. Write a CalDAV test that a VTODO has no size property and that a calendar update of an existing task leaves its stored size in place. Then omit `size` from MCP tool results after serialization. Leave the CalDAV parser and serializer field lists without size, so `existingTask.update(taskData)` has no `size` key.

8. Document `size` on the web task request and response in `backend/docs/swagger/tasks.js` as `null` or one of the four letters.

9. Add the English strings for the closed labels Unset, S, M, L, and XL, and for the toasts “Size updated successfully” and “Failed to update size”. Add `size` and `user_uid` to the client task type. `backup.size` stays the backup-file label.

10. Write component tests for a size dropdown: the closed control shows the current label, the open menu lists Unset, S, M, L, and XL in that order, an owner choice reports that value (`null` for Unset), and a non-owner click does not open the menu. Then add that dropdown as its own control, using the translation keys. It sits beside priority. The priority border and the priority menu stay as they are.

11. Write render tests that the control appears on the shared task row, in the task details header, on an expanded subtask row, and on an existing subtask in the task details subtask section, and that it is absent from the create-task form, the new-subtask name field, search results, the next-task suggestion, and the chart and balance summaries. Then mount it in the four places that show it. The owner check uses `user_uid`. Choosing a value does not follow the row click through to task details. A completed task stays editable for its owner. Subtask rows save that subtask’s uid.

12. Write tests for the save. A successful owner choice sends only `{ size }`, shows one success toast, and the open row and the task store show the returned label. Saving from one virtual upcoming row updates every open virtual row of that series and leaves each row’s due date and virtual flags in place, with one success toast. A network failure or HTTP 500 leaves the last saved label and shows only “Failed to update size”. An HTTP 400 from the owner’s own attempt does the same. Then implement that save from the shared row, the details header, and both subtask surfaces. Apply the returned `size` through one shared merge used by the task store and by each list holder that keeps its own array. Do not send the whole task object, and do not spread the series response onto a virtual row.

13. Run the backend size suite, the MCP and CalDAV locks, and the frontend dropdown and row tests. Then walk the manual checks in the verification table: Today, task details, a filtered view, a project, an area, a tag, a grouped list, Kanban, and the Eisenhower matrix.

## Risks

- `serializeTask` spreads the record. Until MCP results drop `size`, tool payloads pick up the column as soon as the model has it. The MCP test in step 7 has to land in the same increment as that omission.
- List updates today patch the whole task and spread the response by `id`. Virtual rows share the series id and uid. Spreading the series response replaces occurrence due dates. The size save has to send only `size` and copy only `size` back.
- `updateTask` rewrites `name` from `original_name` when both are present. A size save that sends the whole task can rename a recurring series to its display name, such as “Daily”.
- The client cannot compare `user_id` with the signed-in user. Without `user_uid` on the task and on nested subtasks, the dropdown cannot tell the owner from a read-write collaborator. Hiding the menu is still not the access check; the server owner check has to stand on its own.
- A non-owner request that contains `size` is rejected in full. Collaborator edits that accidentally include `size` will fail until the client stops sending it. The size control sends only `{ size }`.
- Integration tests rebuild the schema from the model, so a green test suite does not prove the migration. The new migration still has to apply and roll back on a real SQLite database.
- CalDAV writes `taskData` from the parser onto the existing row. A `size` key in that object would overwrite the stored size. Keeping size out of the parser and serializer avoids that.
- Task details and the task list are different routes. The shared store updates a details view that is open on that task. It does not show the list and the details page at the same time, and it does not push the change to another session.
- `isAdmin` does not grant task access on this path. This work leaves that lookup as it is.

## Out Of Scope

- A size control on the create-task form or on the new-subtask name field.
- Filtering, sorting, or searching by size.
- Charts, metrics, summaries, the next-task suggestion, and search results.
- An activity-history entry for a size change.
- Telegram, CalDAV, and MCP payload or input changes, other than omitting `size` from MCP results so the shared serializer does not leak it.
- Bulk editing of size.
- A separate size for each virtual upcoming day, and a size on a recurring completion.
- Creating or recreating stored recurring children, or rewriting a stored child’s size when the series size changes.
- Live updates pushed to other people or to the owner’s other sessions.
- Calculating a parent size from subtasks.
- Granting administrators access to tasks they cannot already view.
- Locale files other than English.
- `TaskWithSubtasks` inside `TaskHeader`. It has no callers.

## Verification

| ID | Acceptance Criterion | Verifiable By |
| --- | --- | --- |
| AC-1 | Given a task whose stored size is null, when the owner views its shared row in Today, then the closed control shows Unset. | UI Check |
| AC-2 | Given a task whose stored size is null, when the owner views its task details, then the closed control shows Unset. | UI Check |
| AC-3 | Given the owner opens the size dropdown on a shared task row, when the menu is shown, then the choices are Unset, S, M, L, and XL, in that order. | UI Check |
| AC-4 | Given the owner opens the size dropdown in task details, when the menu is shown, then the choices are Unset, S, M, L, and XL, in that order. | UI Check |
| AC-5 | Given the owner selects M on a shared task row and the save succeeds, when the row updates, then the row shows M. | Manual Test |
| AC-6 | Given the owner has saved M for a task, when task details is opened, then its closed control shows M. | UI Check |
| AC-7 | Given the owner selects L in task details and the save succeeds, when the details header updates, then the header shows L. | Manual Test |
| AC-8 | Given the owner has saved L from task details, when the task list is loaded, then the shared row shows L. | UI Check |
| AC-9 | Given task details for a task is already open, when the owner saves a new size from the task list, then the open details control shows that size without a manual refresh. | Manual Test |
| AC-10 | Given the owner selects Unset for a task whose size is M and the save succeeds, when the task is read from the task REST API, then `size` is null. | API Check |
| AC-11 | Given the owner selects Unset and the save succeeds, when the shared row is shown, then its closed control shows Unset. | UI Check |
| AC-12 | Given the owner selects Unset and the save succeeds, when task details is shown, then its closed control shows Unset. | UI Check |
| AC-13 | Given the owner saves a size, when the task is read from the task REST API, then priority is unchanged. | API Check |
| AC-14 | Given the owner saves a size, when the task is read from the task REST API, then status, due date, project, area, tags, completion, and recurrence are unchanged. | API Check |
| AC-15 | Given the owner creates a task, when that task is read from the task REST API, then `size` is null. | API Check |
| AC-16 | Given the owner opens the create-task form, when the form is shown, then it has no size control. | UI Check |
| AC-17 | Given a parent and a subtask, when the owner saves a new parent size, then the subtask's stored size is unchanged. | API Check |
| AC-18 | Given a parent and a subtask, when the owner saves a new subtask size, then the parent's stored size is unchanged. | API Check |
| AC-19 | Given a list row whose subtasks are expanded, when the owner views an existing subtask row, then that row has its own size control. | UI Check |
| AC-20 | Given task details with an existing subtask, when the owner views the subtask section, then that subtask has its own size control. | UI Check |
| AC-21 | Given the owner opens the new-subtask name field, when the field is shown, then it has no size control. | UI Check |
| AC-22 | Given the owner creates a subtask by name, when that subtask is read from the task REST API, then `size` is null. | API Check |
| AC-23 | Given a read-write collaborator views a task, when the size label is shown, then the dropdown does not open. | UI Check |
| AC-24 | Given a read-only user views a task, when the size label is shown, then the dropdown does not open. | UI Check |
| AC-25 | Given a read-write collaborator submits a size for a task owned by someone else, when the response returns, then the status is 403 and the stored size is unchanged. | API Check |
| AC-26 | Given a read-only user submits a size, when the response returns, then the status is 403 and the stored size is unchanged. | API Check |
| AC-27 | Given a user who cannot view the task submits a size, when the response returns, then the response is the existing task access failure and the stored size is unchanged. | API Check |
| AC-28 | Given the owner submits the size `XX`, when the response returns, then the status is 400, the error says the size is invalid, and the stored size is unchanged. | API Check |
| AC-29 | Given the owner's size request fails with a network error or HTTP 500, when the failure is shown, then the control keeps the last saved label and the only toast is "Failed to update size". | Manual Test |
| AC-30 | Given a recurring series shown as virtual upcoming rows, when the owner views those rows, then each row shows the series size. | UI Check |
| AC-31 | Given the owner changes the size on one virtual upcoming row and the save succeeds, when the open list updates, then every virtual row of that series shows the saved size. | Manual Test |
| AC-32 | Given the owner changes the size on a virtual upcoming row and the save succeeds, when the toast is shown, then the only toast is "Size updated successfully". | Manual Test |
| AC-33 | Given a stored child with a recurring parent, when the owner changes the series size, then the child's stored size is unchanged. | API Check |
| AC-34 | Given a stored child with a recurring parent, when the owner changes the series size, then the child still exists. | API Check |
| AC-35 | Given a stored child with a recurring parent, when the owner of the child changes the child's size, then the series stored size is unchanged. | API Check |
| AC-36 | Given a size was saved in one session, when another session loads that task from the task REST API, then the loaded `size` is the saved value. | API Check |
| AC-37 | Given the owner views a shared task row in a filtered view, when that row is shown, then it has a size control. | UI Check |
| AC-38 | Given the owner views a shared task row in a project, when that row is shown, then it has a size control. | UI Check |
| AC-39 | Given the owner views a shared task row in an area, when that row is shown, then it has a size control. | UI Check |
| AC-40 | Given the owner views a shared task row in a tag, when that row is shown, then it has a size control. | UI Check |
| AC-41 | Given the owner views a shared task row in a grouped list, when that row is shown, then it has a size control. | UI Check |
| AC-42 | Given the owner views a shared task row in Kanban, when that row is shown, then it has a size control. | UI Check |
| AC-43 | Given the owner views a shared task row in the Eisenhower matrix, when that row is shown, then it has a size control. | UI Check |
| AC-44 | Given the owner views the next-task suggestion, when the suggestion is shown, then it has no size control. | UI Check |
| AC-45 | Given the owner views search results that match a task, when the results are shown, then they have no size control. | UI Check |
| AC-46 | Given the owner views a chart or balance summary, when the summary is shown, then it has no size control. | UI Check |
| AC-47 | Given a task is returned by CalDAV, when the payload is read, then it has no size field. | Integration Test |
| AC-48 | Given a task is returned by an MCP task tool, when the payload is read, then it has no size field. | Integration Test |
| AC-49 | Given the owner saves a size from a shared task row and the save succeeds, when the toast is shown, then the only toast is "Size updated successfully". | Manual Test |
| AC-50 | Given the owner saves a size from task details and the save succeeds, when the toast is shown, then the only toast is "Size updated successfully". | Manual Test |
