# Task size: Implementation Plan

A task can store an optional size of `null`, `S`, `M`, `L`, or `XL`. Editors change it from a dropdown on every full task row and on task details. The choice saves immediately, and read-only viewers see the label only.

### Confirmed Facts

- Tasks have priority, status, recurrence, and `habit_mode`. They have no size column. New and existing rows, habits, and stored recurring instances therefore have no size.
- `PATCH /task/:uid` requires write access through `requireTaskWriteAccess`. The owner, write or admin on the task or its project, and a system administrator can update. Read-only access can read. A missing task fails that check with HTTP 403. An invalid body returns HTTP 400.
- `buildUpdateAttributes` writes a field only when the body contains it, and otherwise keeps the stored value. `buildTaskAttributes` builds the create payload. Neither knows about size.
- When a recurring parent update submits a different name, project, priority, or note, `handleRecurrenceUpdate` deletes future stored instances. It does not create new ones. A size change must not join that list.
- The upcoming day view copies a parent into virtual rows. Those rows keep the parent identity and only override the due date. They are not stored tasks.
- Task details saves priority with a partial update, writes the result into the shared task store, and shows a priority-specific error toast. It does not restore the previous priority.
- The full row is `TaskItem` plus `TaskHeader`. The main list, Today, the Today plan, project, area, tag, saved view, Kanban, and Eisenhower all mount it. Layouts differ for desktop, narrow screens, upcoming, and Kanban. Compact subtask rows are a separate block and have no field dropdown. Habit rows, habit cards, and habit details are separate surfaces.
- Most of those screens keep their own task arrays. Their task-update handlers send the whole task back. Today also keeps the same task in more than one section, and the upcoming day list keeps one parent in more than one day group. Area updates local state and the shared store without another save. Lists and details load the task again when their screen mounts.
- Habit create and habit update pass submitted fields through onto the task. A habit is also a task, so the normal task update can target it.
- Search, metrics, AI insights, the activity log, CalDAV, and MCP inputs use priority and have no size behavior. Task, search, and MCP reads return the stored task, so a new column is present unless a serializer removes it.
- Visible copy uses the translation catalogs, with an English fallback. Only the Unset label is supposed to be translated.

### Assumptions

- Edit access is the existing write rule. The task payload gains a response-only `can_edit` flag, computed with that rule. `rw` and `admin` can open the menu. `ro` sees text. The flag is not stored and is ignored on write.
- The size control sits in the row content itself on every full-row layout: the desktop row, the narrow row, the upcoming row, and the Kanban card. It stays visible at the narrow width. Task details places it beside the priority dropdown. Habit rows, habit cards, habit details, compact subtask rows, and the create form do not render it.
- A virtual upcoming row shows the parent's size. Saving from that row saves the parent, because the row uses the parent identity. Every virtual copy of that parent on the open upcoming list updates. The save does not create or delete stored instances.
- There is no product path that creates a stored instance when a parent is updated. A size change must not create one. Any stored instance that already exists keeps its own size, and a newly stored instance from an existing creation path starts unset.
- The size menu saves `{ size }` only. Choosing the current value sends nothing. Existing whole-task updates, including Kanban moves, Eisenhower moves, and completion undo, omit `size`, so they leave the stored size unchanged.
- Habit create, habit update, and a task update of a habit ignore `size`, whether the value is valid or not. The rest of that request still succeeds, and the stored size stays `null`.
- Task create ignores every supplied size and still succeeds. Ordinary task updates reject any size other than `null`, `S`, `M`, `L`, or `XL` before any write or recurring-instance delete.
- Size is included on task, search, and MCP read payloads. It is not an MCP input, a search or sort parameter, a metric or AI input, a CalDAV field, or an activity entry.
- One screen is mounted at a time. A successful save updates every copy of that task on the mounted screen, including Today sections and upcoming day groups, and the shared task store. The next time another screen mounts, its load shows the saved value. Another browser tab updates only when that tab opens the screen again or the browser is refreshed.
- A failed size save restores the previous label and uses the error that screen already shows for a failed task update. Details uses its error toast. List screens use their existing update error. Kanban and Eisenhower log the failure, which is the failure behavior they already have. There is no new error style and no success toast.
- The English catalog gets the Unset string. Other languages use the existing fallback until they have a translation. `S`, `M`, `L`, and `XL` stay those letters. Comparison is exact: `s`, `S `, and `unset` are invalid.

### Files / Modules Involved

- `backend/migrations/` - nullable `size` column on `tasks`, default `null`.
- `backend/models/task.js` - stored field.
- `backend/modules/tasks/core/builders.js` - create ignores size; update applies it only when the body includes it.
- `backend/modules/tasks/routes.js` - reject an invalid size before the parent-recurrence write, instance deletion, and the task write.
- `backend/modules/tasks/operations/recurring.js` - size stays off the instance-deletion field list.
- `backend/modules/tasks/utils/logging.js` - size stays off the activity field list.
- `backend/modules/tasks/core/serializers.js` - read payload includes `size` and `can_edit`.
- `backend/modules/habits/repository.js` and `backend/modules/habits/service.js` - habit create and update drop `size`.
- `backend/docs/swagger/tasks.js` - document the read and update field.
- `frontend/entities/Task.ts` - `size` and `can_edit`.
- `frontend/utils/tasksService.ts` - partial size save.
- A shared size control used by the row and by task details.
- `frontend/components/Task/TaskHeader.tsx` and `frontend/components/Task/TaskItem.tsx` - show and save size on full rows.
- `frontend/components/Task/TaskDetails.tsx` and `frontend/components/Task/TaskDetails/TaskDetailsHeader.tsx` - details control and store update.
- Mounted-list state in `Tasks.tsx`, `TasksToday.tsx`, `TodayPlan.tsx`, `ProjectDetails.tsx`, `AreaDetails.tsx`, `TagDetails.tsx`, `ViewDetail.tsx`, `KanbanBoard.tsx`, and `EisenhowerMatrix.tsx` - replace the local size without sending the whole task, and omit `size` from existing whole-task updates.
- `public/locales/en/translation.json` - Unset label.
- Existing task, permission, recurring, habit, and MCP integration tests.

### Implementation Plan

1. **Add the stored field.** Add a nullable `size` column with default `null`, using the same migration style as the other task-column migrations. Existing rows stay unset. The model accepts only `null`, `S`, `M`, `L`, and `XL`.

2. **Ignore size on create.** Task create drops `size` before validation and insert, including `null`, `S`, and `XXL`. The create still succeeds and the stored value is `null`. Habit create does the same.

3. **Validate size before any update side effect.** On an ordinary task update, if the body contains `size` and the value is not `null`, `S`, `M`, `L`, or `XL`, return HTTP 400 immediately. Do this before the parent-recurrence update, before future-instance deletion, and before the task write. Name, priority, and the stored size stay as they were, including when the same request also changes the name of a recurring parent. A missing task still returns HTTP 403 from the write check. A user without write access still receives HTTP 403 and the stored size stays unchanged.

4. **Apply a valid size without affecting the rest of the task.** When the body contains `size`, store that value; `null` clears it. When the body omits `size`, leave the stored value unchanged. Keep size out of the recurring-template comparison and out of the activity-log field list. A size-only change does not delete or create instances, does not change priority or status, and does not add an activity entry. Saving the value that is already stored does not need a new write.

5. **Keep habit size unset.** Habit update, and a task update whose target is a habit, drop `size` before validation and before the write. A valid or invalid size does not fail the request and does not change the stored `null`. Other habit fields still save.

6. **Return size and edit ability on read.** Every task read includes `size`, with unset as `null`. Add response-only `can_edit` for the current viewer on the task and on nested subtasks, using the existing access rule. Treat owned rows and a system administrator without a per-row access query; batch the remaining shared-task and shared-project lookups. Leave search filters, sort, metrics, AI, CalDAV output, and MCP input schemas unchanged. Size may appear in search and MCP reads because those reads return the task.

7. **Add the shared size control.** The menu order is Unset, `S`, `M`, `L`, `XL`. Unset comes from translations. The letters do not. Editors with `can_edit` get the menu. Read-only viewers get the current label as text. Choosing the current value does not call the API. A change saves `{ size }` only. On failure, put the previous value back and show that screen's existing task-update error.

8. **Show the control on every full row.** Put it in the desktop, narrow, upcoming, and Kanban layouts of `TaskHeader`, visible without opening another menu. Hide it when `habit_mode` is set. Leave the compact subtask row, habit card, habit details, and create form unchanged. After a successful save, merge the saved size into every list on that mounted page that contains the task, including every Today section and every upcoming day group. Update the shared task store. Do not send that save through a handler that PATCHes the whole task.

9. **Show the control on task details.** Place it beside the priority dropdown and use the same partial save. Update the open task and the shared store. Do not refresh the activity timeline for a size change. Navigating between details and a list shows the saved value because details updates the store and each list loads the task when it opens.

10. **Keep older updates from writing size.** Whole-task PATCH bodies on the main list, Today, project, tag, saved view, Kanban, Eisenhower, and completion undo omit `size`. A column move, quadrant move, or undo can still change status or priority and cannot clear or replace size.

11. **Cover the API contract with the existing integration tests.** Add cases for create-ignores-size, valid and clearing updates, omitted size, invalid size combined with a name change on a recurring parent, read-only and missing-task failures, system-administrator success, separate parent and stored-instance sizes, habit create and both habit update paths, no activity row, and last-write-wins. Document `size` on the task swagger schema.

### Risks

- A whole-task PATCH that still includes `size` will overwrite a newer size, and if it also resubmits name, priority, note, or project it can delete future instances. Step 10 is required for the current Kanban, Eisenhower, and undo callers.
- `can_edit` must be batched. Calling the current per-resource access lookup once per row would make task lists slow.
- Virtual upcoming rows share the parent id. Updating local state by id changes every day group for that parent, which is the intended parent-size behavior.
- Habit updates that ignore invalid `size` are a deliberate exception to the HTTP 400 rule. An ordinary task update still rejects those values.
- A model validator that runs only inside the final write is too late. The HTTP 400 has to happen before instance deletion.
- SQLite is the current database. The column should stay nullable, with the allowed values enforced in the update path.

### Out Of Scope

- Size on the create form.
- Size on habit cards, habit details, and habit rows.
- Size on the compact subtask row.
- Filtering, sorting, or searching by size.
- Metrics, AI insights, or recommendations that use size.
- An activity entry for a size change.
- CalDAV or iCalendar mapping.
- MCP tools accepting size as an input.
- Copying size from a parent to instances, or deleting instances because size changed.
- A new size-specific permission.
- Live updates to other browser tabs or other users.
- Translations of `S`, `M`, `L`, and `XL`.
- A new error component or a success message for size.

### Verification

| ID | Acceptance Criterion | Verifiable By |
| --- | --- | --- |
| AC-1 | An existing ordinary task, and a newly created ordinary task, shows Unset on a full task row and on task details until a size is saved. The read payload contains size `null`. | API Check, UI Check |
| AC-2 | An editor on the main list, Today, the Today plan, a project, an area, a tag, a saved view, Kanban, Eisenhower, and task details sees a size menu with Unset, S, M, L, and XL, in that order. The same menu is visible on the desktop, narrow, upcoming, and Kanban layouts. | UI Check |
| AC-3 | Choosing S, M, L, or XL on any of those surfaces saves it immediately. Task details and the other full-row copies on the mounted screen, including a second Today section or upcoming day group, show the same value without a reload. Opening the other screen later shows the saved value. The read payload contains that letter. | Manual Test, API Check |
| AC-4 | Choosing Unset after a size was saved clears it. The control reads Unset and the read payload contains `null`. | Manual Test, API Check |
| AC-5 | Changing size does not change priority or status. Changing priority or status does not change size. | API Check, Manual Test |
| AC-6 | A completed, archived, or cancelled task still allows an editor to change size. Changing status does not clear size. | Manual Test, API Check |
| AC-7 | A read-only user sees the current label as text and cannot open the menu. A size update from that user returns HTTP 403 and the stored size is unchanged. A user with no access cannot see the task. A system administrator can change size. | Manual Test, API Check |
| AC-8 | Changing size on a recurring parent does not change existing stored instances and does not delete or create instances. Changing size on a stored instance does not change the parent or other instances. A virtual upcoming row shows the parent size, and saving it changes the parent only. A stored instance created by an existing creation path is Unset even when the parent has a size. | Integration Test, API Check |
| AC-9 | A subtask shows and edits its own size on its task details and on a full task row. That change does not change the parent. The compact subtask row inside the parent does not show a size control. | UI Check, API Check |
| AC-10 | A habit card, habit details, and a habit task row do not show size. Habit create, habit update, and a task update of a habit, each sent with size `S`, leave the stored size `null`. | UI Check, API Check |
| AC-11 | Creating a task succeeds when the request omits size, sends `null`, sends `S`, or sends `XXL`. In every case the stored size is `null`. | API Check |
| AC-12 | Updating an ordinary task with a size other than `null`, `S`, `M`, `L`, or `XL`, including an empty string, `unset`, `s`, `XXL`, and a number, returns HTTP 400. The same request may also change the name of a recurring parent. Priority, name, stored size, and future instances are unchanged. | API Check |
| AC-13 | Updating a task without sending size leaves the stored size unchanged. A Kanban move, an Eisenhower move, and a completion undo also leave it unchanged. | API Check |
| AC-14 | When a size save fails from a lost connection or HTTP 403, the visible value returns to the previous size. Details shows its error toast. A list shows its existing update error. Kanban and Eisenhower log the failure. | Manual Test |
| AC-15 | Two successful size saves for the same task leave the later saved value stored. No conflict message is shown. | API Check, Manual Test |
| AC-16 | A size change does not add an activity entry. MCP task tools do not accept size as an input. Search has no size filter or sort. CalDAV output has no size field. Metrics and AI do not read size. Task, search, and MCP read payloads may include the stored size. | API Check, Manual Test |
| AC-17 | In a non-English language, the empty value is the translated Unset label, or the English fallback when that language has no translation. S, M, L, and XL stay those letters. The stored value is still `null` or the uppercase letter. | UI Check, API Check |
| AC-18 | A second browser tab keeps its shown size until that tab opens the screen again or the browser is refreshed. | Manual Test |
