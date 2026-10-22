# Task size

## Business Goal

### Problem / pain description

While planning work, a user cannot record how much effort a task is expected to take. Priority says how important a task is, but it does not say whether the task is small or large. The user has to keep that estimate outside the task, so the plan is harder to scan and the estimate is lost when the user moves between the task list and task details.

### Proposed solution

A task can have an optional size of S, M, L, or XL. Until a size is chosen, the task shows Unset. The task owner sets the size from a dropdown on the task list or on task details. The choice is saved immediately and both of those views show the same size. People who can see the task can see its size. Only the owner can change it. Size does not change priority.

## Current Behavior

### Frontend

Tasks have no size. The task model exposed to the interface has priority, status, dates, recurrence, project, area, tags, and subtasks, and it has no size field.

The shared task row is used in task lists, grouped lists, Today, saved views, project tasks, area tasks, tag tasks, the Kanban board, and the Eisenhower matrix. Priority on that row is shown as a colored border. The row has no size control.

Subtasks under a list row are separate markup from the shared task row. They show the subtask name and priority and can be completed from that row. They have no size control. Task details has a separate subtask section for adding, renaming, and removing subtasks. That section has no size control.

Task details shows priority in a dropdown in the header. Choosing a priority saves immediately. Success shows the toast "Priority updated successfully". Failure shows the toast "Failed to update priority". The task update response is the updated task, and the open task details view replaces its task from that response.

The create-task form includes priority. It has no size control. A new subtask is added by name from the subtask section and is saved with the subtask list. That add field has no size control.

Charts, balance and radar summaries, and the next-task suggestion do not render the shared task row. Search results do not render the shared task row.

The interface already has success and error toasts.

### Backend and API

A task is stored with a priority integer. The allowed stored priorities are 0, 1, and 2, and the default is 0. There is no size column and no size value in the task REST API.

Updating a task uses the existing task update operation. Write access is required. The task owner, a user with read-write access to the task, and a user who inherits read-write access from the task's project can pass that check. Read-only users can view the task. Users with no access cannot view it. The task owner is the user id stored on that task record.

The administrator check looks up a user by uid. The task access check passes a numeric user id into that lookup, so the administrator role does not grant access on this path. Task lists return tasks the user owns or can access through sharing. They do not return every task because the caller is an administrator.

A recurring series is one task whose recurrence type is not "none" and whose recurring parent is empty. Upcoming lists expand that task into virtual rows. Each virtual row copies the series task, replaces the due date, and marks the row as a virtual occurrence. Those rows reuse the series id and uid. They are not separate task records. Completing a series occurrence writes a recurring completion and advances the same task. A recurring completion stores the task, the completion time, the original due date, and whether it was skipped. It is not a task and it has no size.

Stored child tasks with a recurring parent can exist. Changing the parent's name, project, priority, note, or recurrence fields deletes future stored children, using a due date after the current instant as the future test. The update route does not recreate those children. The flag returned by that deletion is not used. The normal interface does not create those stored children when it shows upcoming days.

Subtasks are separate task records with their own owner and priority. A parent priority is not calculated from subtasks. Creating a task sets the owner from the caller.

The task update response is the serialized updated task. Priority changes can be written to the task activity history. Task list queries can filter and order by priority. Metrics use priority. CalDAV serializes priority into a calendar to-do. MCP task tools accept and return priority. Neither receives a size, because size does not exist.

### Data

Existing tasks have no size. New tasks are created without a size. Due dates are stored as date values, not as a separate size history.

## Expected Behavior

A task has one size. The stored value is `null`, `S`, `M`, `L`, or `XL`. `null` means no size is stored. The web interface shows `null` as Unset. The closed control always shows the current label: Unset, S, M, L, or XL. The open dropdown always lists Unset, S, M, L, and XL, in that order.

The task REST responses used by the web application include `size`. When the size is unset, the field is present and its value is `null`. The field is not omitted, and the stored value is never the label Unset.

Sending `S`, `M`, `L`, or `XL` stores that size. Sending `null` clears it. Omitting `size` from an update leaves the stored size unchanged. A value other than `null`, `S`, `M`, `L`, or `XL` is rejected.

Size is optional. It is independent of priority, status, dates, project, area, tags, completion, and recurrence. Changing size does not change those fields. Changing those fields does not change size.

### User Flow

1. The owner opens a task list or task details.
2. The size control is visible on the shared task row and in the task details header. It shows the task's current label.
3. The owner opens the dropdown and chooses Unset, S, M, L, or XL.
4. The choice is saved immediately as `null`, `S`, `M`, `L`, or `XL`. There is no separate save action.
5. On success, the update response is that one updated task and includes its `size`. The owner sees one toast, "Size updated successfully". Open views that show that task replace it from the response and show the saved label without a manual refresh.
6. A later load of the task list or task details shows the same saved label.
7. A person who can view the task and does not own it sees the label. The dropdown does not open and does not accept a change.
8. Another session sees the saved size on its next load of that task. An open session that did not make the change is not updated live.

The shared task row shows the control in every place that row is used, including filtered views, projects, areas, tags, grouped lists, Today, Kanban, and the Eisenhower matrix. Task details shows the control in the header.

Subtask rows show their own control. This includes the expanded subtask row under a list row and each existing subtask in the task details subtask section. A subtask size is the size of that subtask record. Changing it does not change the parent. Changing the parent does not change the subtask.

The create-task form has no size control. The new-subtask name field has no size control. A task or subtask created after this work is stored with `size: null` and shows Unset once it exists.

A virtual upcoming row shows the series task's size, because it is a projection of that task. Changing the dropdown on a virtual row saves the series task. Every open virtual row of that series shows the saved label after the response is applied. One toast is shown. A recurring completion does not gain a size and does not show a size control.

A stored child task with a recurring parent has its own size. Changing the series size does not change the child. Changing the child size does not change the series. A size change does not delete or create stored children.

### Edge Cases

- Choosing Unset after a size was saved stores `null`. The response contains `size: null`. Open views show Unset.
- Existing tasks have `size: null` until the owner sets one. They show Unset.
- Each parent and subtask stores its own size. A parent size is not calculated from subtasks.
- Virtual upcoming rows of one series always show the same size, including after a save from any of those rows.
- A stored recurring child keeps the size it already has when the series size changes. A new stored child is not created by setting a size. If some other existing path creates a task, that task starts with `size: null`.
- The owner can change the size of a completed task from its shared row or from task details.
- Users who cannot view the task cannot see its size. Their request follows the existing task access failure, and the stored size stays unchanged.
- Charts, balance and radar summaries, the next-task suggestion, and search results do not show a size dropdown.

### Error Handling

- If the owner submits a valid size and the request fails because of a network error or an HTTP 500, the open views keep the last saved label. The owner sees "Failed to update size". No success toast is shown. The stored size stays unchanged.
- If a user who is not the owner submits a size, the response is HTTP 403. The stored size stays unchanged. No success toast is shown. The interface does not present an interactive dropdown to that user.
- If the submitted size is not `null`, `S`, `M`, `L`, or `XL`, the response is HTTP 400 and the error says the size is invalid. The stored size stays unchanged. When the owner made the attempt from the interface, the owner sees "Failed to update size" and the control keeps the last saved label.
- Omitting `size` is not an error and does not clear a saved size.
- If the tasks cannot be loaded, the existing task-loading failure behavior remains. Size is not given a substitute value.

## Out Of Scope

- A size control on the create-task form or on the new-subtask name field.
- Filtering, sorting, or searching by size.
- Charts, metrics, or summaries that use size.
- An activity-history entry for a size change.
- Telegram, CalDAV, and MCP. Their payloads do not gain a size field, and they do not accept a size change.
- Bulk editing of size.
- A separate size for each virtual upcoming day.
- A size on a recurring completion.
- Creating or recreating stored recurring children.
- Rewriting a stored child's size when the series size changes.
- Live updates pushed to other people or to the owner's other sessions.
- Calculating a parent size from subtasks.
- Granting administrators access to tasks they cannot already view.

## Technical Scope

- Persist an optional size on a task. Existing tasks, new tasks, subtasks, recurring series, and stored recurring children use the same field.
- Include `size` in the task REST responses used by the web application. Accept a size change only from the owner of that task record.
- Show the size dropdown on the shared task row, on expanded subtask rows, in the task details header, and on existing subtasks in the task details subtask section.
- Treat a virtual upcoming row as the series task for display and saving.
- Show one success toast or one failure toast for the save.
- Add the user-facing English strings for the size labels and toasts.

## Non-functional Requirements and Constraints

- The frontend remains React and TypeScript. The backend remains Node.js, Express, Sequelize, and SQLite. The task REST API remains under `/api/v1`.
- A schema change is introduced only through a new migration. An existing migration is not edited.
- User-facing strings go through the existing translation system. English in `public/locales/en/translation.json` is the source of truth. The visible labels are Unset, S, M, L, and XL. The toast text is "Size updated successfully" and "Failed to update size".
- Ownership is enforced on the server. Hiding the dropdown in the interface is not sufficient. The owner is the user id on the task record being changed.
- The size change follows the existing session-cookie and Bearer-token authentication. It does not add a new authentication mechanism.
- A successful update response is the updated task and includes `size`. Open views belonging to the owner who made the change update from that response. Other sessions update on the next load. No live-sync channel is added.
- CalDAV and MCP keep their current task payloads.
- Size remains independent from priority. Existing priority behavior, including its activity history, filters, and recurrence deletion of future stored children, stays in place. A size-only change does not trigger that deletion.

## Acceptance Criteria

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

## Assumptions

- The task REST field name is `size`. Unset is only a display label. The API value for Unset is `null`, and successful task responses include the field.
- A virtual upcoming row is the series task. It does not have a size of its own. This replaces the earlier rule that each upcoming day keeps or inherits a separate size. The product does not store those days as tasks.
- A recurring completion is not a task and is not given a size. Past completed occurrences therefore do not keep a separate size.
- Stored tasks with a recurring parent remain separate tasks. Their sizes stay independent. A series-size change does not rewrite them, including when their due date is still in the future.
- "The owner" means the user id on the task record being changed. A stored child or subtask can have a different owner from its parent. Only that record's owner can change its size.
- An administrator who cannot already view a task is outside this work. Size does not add a viewing path. A non-owner who can already view the task can see the size and cannot change it.
- The original story said that anyone with edit permission could change size. The agreed rule replaces that: only the owner can change size.
