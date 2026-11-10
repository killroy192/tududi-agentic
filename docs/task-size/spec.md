# Task size

## Business Goal

**Problem / pain description**

People planning work can set a task priority, but they cannot record how much effort they expect the task to take. Priority and effort answer different questions, so a high-priority task and a large task cannot be told apart.

**Proposed solution**

Let a person with edit access set an optional effort size of S, M, L, or XL, or leave it unset, from a full task row and from task details. The choice saves immediately and is visible on the other open views of that task in the same session.

## Current Behavior

### Frontend

- Tasks have no size field and no size control.
- Task details shows an inline priority dropdown in the header. Changing priority saves through the task update, and the updated task is written back into the in-memory task list for that session. Task details then reloads the activity timeline.
- The same task row is used by the main tasks page, Today, the Today plan, project tasks, area tasks, tag tasks, saved views, the Kanban board, and the Eisenhower matrix. The row shows priority as a colored border. It does not offer a priority dropdown. The row has more than one layout, including a compact Kanban layout and an upcoming layout.
- A parent row can show compact subtask rows. Those compact rows do not offer the priority dropdown.
- Habits are tasks marked as habits. They use habit cards and habit details. Some task rows change their controls when the task is a habit. The Today list excludes habits.
- The task create form can set priority. It cannot set size.
- The task read payload does not tell the screen what access level the viewer has. Task screens do not currently switch a field to read-only text for a read-only viewer.
- Several screens keep their own copy of the task list. A save that updates the shared in-memory list does not, by itself, update Kanban, Eisenhower, project, tag, area, view, or Today state.
- Several existing updates send the whole task back, not only the field that changed. Examples include moving a card on Kanban or Eisenhower and undoing a completion.
- Visible labels go through the app translations, with an English fallback when a translation is missing. There is no single task-update error. Task details shows a priority-specific message and does not restore the previous priority. Kanban and Eisenhower log a failed move. The task row logs a failed completion.

### Backend / API

- A task has priority as an integer from 0 to 2, defaulting to 0. It has status, recurrence, and a habit flag. It has no size.
- Reading a task requires read access. Updating a task requires write access. The owner, a user with write or admin access, and a system administrator can update. Read-only access can read. No access is forbidden.
- Access can come from owning the task or from access on the task or its project. A system administrator receives admin access to every task.
- An update for an unknown task is refused with 403 Forbidden. The write check treats a missing task as no access.
- An invalid request is refused with 400 and an error body. A write without permission is refused with 403 and an error body.
- When a recurring parent is updated and the submitted name, project, priority, or note differs from the stored value, future child instances can be deleted. Nothing in the current update path recreates those instances.
- The upcoming list, when grouped by day, expands a recurring parent into virtual occurrence rows. Each virtual row is a copy of the parent, keeps the parent identity, and overrides the due date. It is not a separate stored task. Stored child tasks with a parent do exist and are preferred over the parent in cases such as Today.
- Creating a task does not accept or store a size.
- A task update that changes priority, name, status, note, project, or recurrence writes an activity entry. Completing a recurring occurrence writes its own entry.
- Task responses return the stored task fields. Search returns those task rows. MCP task reads return the task. A new stored field would appear in those responses unless it is removed on the way out.
- Search can filter by priority. Metrics and task AI insights read priority. None of these know about size.
- CalDAV maps priority to iCalendar priority. It does not map a size.
- MCP task tools can set priority when creating or updating a task. They cannot set a size.
- Habit create and habit update pass the submitted task fields through to the stored task.

### Data

- There is no stored size. Existing tasks therefore have no size value.
- Sharing is stored as an access level: none, read-only, write, or admin.

## Expected Behavior

A task has an optional size. The allowed values are unset, S, M, L, and XL. Unset is the default for every task that has never had a size saved, including tasks that already exist, tasks that are created, habits, and stored recurring instances created later.

Size is independent of priority, status, recurrence, and of the parent task or subtasks.

On read, the task payload always includes size. Unset is `null`. The only other values are `S`, `M`, `L`, and `XL`.

### User Flow

1. A person opens a full task row on any screen that shows one: the main tasks page, Today, the Today plan, a project, an area, a tag, a saved view, Kanban, or Eisenhower. Or they open task details.
2. The size control is always visible on that full row and on task details.
3. When no size has been saved, the control reads Unset in the person's language. S, M, L, and XL are always those letters.
4. A person who can edit opens a menu whose choices are Unset, S, M, L, XL, in that order, and chooses one. Edit access is the existing write rule: task owner, write or admin on the task or its project, or system administrator.
5. The choice saves immediately. There is no separate Save action and no confirmation.
6. After a successful save, every open view in that same session that shows that task as a full row or in task details shows the new value without a manual reload. Moving from a list to details, or from details back to a list, also shows the saved value.
7. A person with read-only access sees the current label as plain text and cannot open the menu.
8. A person with no access does not see the task, so they do not see its size.
9. Another browser tab or another person sees the new size the next time that view loads the task. Two near-simultaneous saves: the later saved value is the one that remains.

### Edge Cases

- Choosing Unset after a size was saved clears the size. The control reads Unset and the stored value is `null`.
- Choosing the value that is already saved does not change the stored size.
- Changing priority or status does not change size. Changing size does not change priority or status.
- Size stays editable for every status, including completed, archived, and cancelled, when the person has edit access. A status change does not clear size.
- A recurring parent and each stored instance have separate sizes. Changing one does not change the others and does not delete or recreate instances. A stored instance created later starts unset even if the parent has a size.
- A subtask has its own size on its own task details and on any full task row. Changing it does not change the parent. The compact subtask row inside a parent card does not show or edit size.
- A habit does not show or edit size on a habit card, habit details, or a task row that is a habit. Its stored size stays unset. Nothing in the habit flow changes it.
- The task create form does not show size. Creating a task stores unset even if the create request includes a size, including an invalid one. The create still succeeds.
- An update that does not mention size leaves the stored size unchanged, even when other fields change.
- An update that includes any size other than `null`, `S`, `M`, `L`, or `XL` is rejected with HTTP 400. No field in that update is saved, and no future recurring instance is deleted because of that request. The previous size remains. Rejected examples include an empty string, `unset`, `s`, `XXL`, and a number.
- Existing tasks with no size show Unset until someone sets one.
- Only the Unset label is translated. The letters and the stored values do not change with language.

### Error Handling

- If saving size fails, the control returns to the previous value. The person sees the same kind of error already shown when a task update fails on that screen.
- A read-only user, or any user without edit access, who submits a size change receives HTTP 403 Forbidden. The stored size does not change.
- An update for a missing task receives HTTP 403 Forbidden, which is the current result of the write check.
- An invalid size receives HTTP 400. The refusal happens before any other effect of that request. Other fields sent in that same request are not saved, and future instances are not deleted.
- Two successful saves of the same task: the last stored value wins. There is no conflict prompt.
- A second tab or another user is not pushed the change. Their next load shows the stored value.

## Out Of Scope

- Setting size on the task create form.
- Size on habit cards, habit details, and habit rows.
- Size on the compact subtask row inside a parent card.
- Filtering, sorting, or searching by size.
- Metrics, AI insights, or recommendations that use size.
- An activity entry for a size change.
- CalDAV / iCalendar mapping of size.
- MCP tools accepting size as an input.
- Copying size across a recurring series, or deleting instances because size changed.
- A new permission just for size.
- Live updates to other browser tabs or other users.

## Technical Scope

- Task data gains a size value that can be unset or one of S, M, L, XL. Existing tasks are unset.
- Task read responses include size. Task update accepts a size change under the existing write-access rule. An invalid size is refused with HTTP 400 before any other effect of that request.
- A user without edit access who sends a size change receives HTTP 403. The stored size stays as it was.
- Task create ignores size and stores unset. The create still succeeds.
- Every full task row and task details show size. Editors get the menu. Read-only users see the label only.
- Habit surfaces and compact subtask rows do not show size.
- Saving size must not delete or recreate recurring instances.
- Search, metrics, AI, the activity log, CalDAV, and MCP inputs do not gain size behavior.

## Non-functional Requirements and Constraints

- Reuse the existing task read and write access rules, including system-administrator admin access. Do not add a size-specific permission.
- A task update that omits size must keep working for current clients and must leave size unchanged.
- A task create that includes size must still succeed and must store unset.
- Stored size is `null`, `S`, `M`, `L`, or `XL` only. The read payload always includes the field. Unset is `null`.
- Size must not be treated as a change that deletes future recurring instances.
- An invalid size must be refused before any write or delete caused by that same request.
- The Unset label uses the existing translation mechanism. S, M, L, and XL are not translated.
- No optimistic locking or merge. The last successful save wins.
- Same-session views that already show the task as a full row or in task details must show the saved size without a manual reload.

## Acceptance Criteria

| ID | Acceptance Criterion | Verifiable By |
| --- | --- | --- |
| AC-1 | An existing ordinary task, and a newly created ordinary task, shows Unset on a full task row and on task details until a size is saved. The read payload contains size `null`. | Manual Test, API Check |
| AC-2 | An editor on the main list, Today, the Today plan, a project, an area, a tag, a saved view, Kanban, Eisenhower, and task details sees a size menu with Unset, S, M, L, and XL, in that order. | UI Check |
| AC-3 | Choosing S, M, L, or XL on any of those surfaces saves it immediately. Task details and the other open full-row views in that session show the same value without a reload. A later visit shows the saved value. The read payload contains that letter. | Manual Test, API Check |
| AC-4 | Choosing Unset after a size was saved clears it. The control reads Unset and the read payload contains `null`. | Manual Test, API Check |
| AC-5 | Changing size does not change priority or status. Changing priority or status does not change size. | API Check, Manual Test |
| AC-6 | A completed, archived, or cancelled task still allows an editor to change size. Changing status does not clear size. | Manual Test, API Check |
| AC-7 | A read-only user sees the current label as text and cannot open the menu. A size update from that user returns HTTP 403 and the stored size is unchanged. A user with no access cannot see the task. A system administrator can change size. | Manual Test, API Check |
| AC-8 | Changing size on a recurring parent does not change existing stored instances and does not delete or recreate instances. Changing size on a stored instance does not change the parent or other instances. A stored instance created afterward is Unset even when the parent has a size. | Integration Test, API Check |
| AC-9 | A subtask shows and edits its own size on its task details and on a full task row. That change does not change the parent. The compact subtask row inside the parent does not show a size control. | UI Check, API Check |
| AC-10 | A habit card, habit details, and a habit task row do not show size. Creating or updating a habit does not set a size. The habit's size stays `null`. | UI Check, API Check |
| AC-11 | Creating a task succeeds when the request omits size, sends `null`, sends `S`, or sends `XXL`. In every case the stored size is `null`. | API Check |
| AC-12 | Updating a task with a size other than `null`, `S`, `M`, `L`, or `XL`, including an empty string, `unset`, `s`, `XXL`, and a number, returns HTTP 400. Priority, name, and the stored size are unchanged. Future recurring instances are not deleted. | API Check |
| AC-13 | Updating a task without sending size leaves the stored size unchanged. | API Check |
| AC-14 | When a size save fails, the visible value returns to the previous size and that screen shows its existing task-update error. | Manual Test |
| AC-15 | Two successful size saves for the same task leave the later saved value stored. No conflict message is shown. | API Check, Manual Test |
| AC-16 | A size change does not add an activity entry. Size is not a search filter, a sort option, a metric input, an AI input, a CalDAV field, or an MCP tool input. | Manual Test, API Check |
| AC-17 | In a non-English language, the empty value is the translated Unset label. S, M, L, and XL stay those letters. The stored value is still `null` or the uppercase letter. | UI Check, API Check |
| AC-18 | A second browser tab does not change its shown size until that tab loads the task again. | Manual Test |

## Assumptions

- "Edit permission" in the original story means the existing write rule: task owner, write or admin on the task or its project, or system administrator. Read-only access is not edit access.
- The same-session task list already used for priority updates is enough for the main list and task details to show a saved size. Every other open full-row screen is required to show the saved size in that session as well, even if it keeps its own copy of the tasks today.
- "The existing task-update error" means whatever message that screen already shows when a task field update fails. This work does not invent a new error style.
- Create ignores every provided size value, valid or invalid, and still creates the task.
- Choosing the already saved value does not need a new server value and does not show an error.
- A missing task on update follows the current write check and returns HTTP 403.
- Subtasks and stored recurring instances are tasks, so they can store a size once they are shown as a full row or in task details.
- Habit updates go through habit flows that must not write size.
- No current client depends on a size field, so adding it to task read responses is safe when those clients ignore unknown fields.

## Review findings

These findings are still blocking. The activity-log fact, the recurring-instance fact, HTTP 400, the 403 for a missing task, and system-administrator edit access are already reflected in the sections above.

### 4.1 Blocking questions

1. **Where the control sits, and which row layouts show it.** The spec names every screen that mounts the full row, but those screens use more than one row layout, including upcoming and compact Kanban. QA cannot judge "always visible" until each layout, including a narrow screen, has a placement rule.
2. **How the screen knows the viewer is read-only.** The task payload has no viewer access level, and task screens have no read-only field state today. The plain-text rule cannot be built until the spec names the source of that access, for a row, for task details, and for a subtask.
3. **What a virtual upcoming occurrence is allowed to do.** The upcoming day view copies the parent into virtual rows that keep the parent identity. The spec gives separate sizes to stored instances only. It does not say whether a virtual row shows the parent's size, shows Unset, or can be edited. Editing it with the parent's identity would change the parent.

### 4.2 Conflicting business context

1. **Upcoming virtual rows contradict "separate sizes."** They are not stored instances, and they are not a later-created instance. AC-8's last clause has no creation path to test, because a parent update can delete future children and does not create new ones. The virtual-row rule has to be chosen before AC-8 can be executed.
2. **"MCP and search stay unaware" conflicts with how tasks are returned.** Task reads, search results, and MCP task reads return the stored task. Once size is stored, it will be present in those responses unless the spec explicitly removes it. AC-16 currently mixes "do not accept size as an input" with "size does not appear," which are different rules.

### 4.3 Risky assumptions

1. **Current clients send the whole task back.** Kanban moves, Eisenhower moves, completion undo, and several list updates PATCH the whole task. After size is in the read payload, a stale copy can write the old size back. The same requests can also resend priority in a form that the recurrence check treats as a change and then delete future instances. The spec must say whether a size change sends size alone, and what a full-task update is allowed to do to size.
2. **Habit writes are not covered by the task create rule.** Habit create and habit update pass submitted fields through, and the normal task update also accepts a habit because a habit is a task. AC-10 does not say whether those requests ignore `size` or reject it. One of those two rules has to be chosen for habit create, habit update, and a task update whose target is a habit.
3. **Same-session sync is required for screens that do not share one list.** Only the shared task list is updated by the current details save. Kanban, Eisenhower, Today, project, tag, area, and saved views keep local copies, and one task can appear in more than one section of a page. The spec requires all of them to update and does not say which combinations must be verified.

### 4.4 Weak acceptance criteria

1. **AC-12 still needs the combined case spelled as the test.** It should send an invalid size together with a changed name on a recurring parent, then assert HTTP 400, unchanged name, unchanged priority, unchanged size, and the same future instances.
2. **AC-14 has no failure trigger and no per-screen error.** There is no shared task-update error. The criterion should name the failure, such as HTTP 403 or a lost connection, and the message each surface already shows.
3. **AC-2 and AC-3 do not name the row layouts.** They list screens, not the upcoming layout, the compact Kanban card, or a narrow viewport. "Other open full-row views" needs the pairs that must be checked, including two sections of one page.
4. **AC-8's "instance created afterward" cannot be run.** Replace it with the virtual-occurrence rule once that question is answered, and keep the stored-instance checks.
5. **AC-10 does not name the requests.** It needs habit create, habit update, and a task update on a habit, each sent with size `S`, plus the expected result for each.
6. **AC-16 and AC-18 are broad negatives.** AC-16 should check separately: no new activity entry, no size input on the MCP tools, no size search or sort parameter, and no size in CalDAV output. It should also say whether size may be present in a task, search, or MCP read payload. AC-18 should say what "loads the task again" means: revisit the screen, or refresh the browser.
