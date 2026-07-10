# Task Duplication — Spec

## Business Goal

Allow users to quickly create a new task based on an existing one, reducing manual re-entry when tasks share common attributes (name pattern, notes, tags, project, area, priority, people).

## User / System Problem

Users frequently create tasks that are similar to existing ones — recurring work items, templated checklists, or tasks that share project/tag/priority context. Currently the only way to create a task is from scratch, requiring the user to re-enter all shared attributes manually. This adds friction, especially for tasks with multiple tags, long notes, or specific project/area assignments.

## Current Behavior

- There is no way to duplicate or copy a task.
- The task list row shows status controls and metadata icons but has no action menu or duplicate button.
- The task detail page has a "..." menu containing only Delete.
- Task creation always starts from a blank slate (quick-add input or new task form).

## Expected Behavior

### User flow

1. User views a task list (any list: Tasks page, Today page, Project tasks, Area tasks).
2. User clicks a **duplicate icon** on a task row.
3. A new task is created immediately with copied attributes.
4. The new task appears in the current list view (user stays on the same page).
5. A brief success feedback is shown (toast/notification).

### What gets copied to the new task

| Attribute | Behavior |
|-----------|----------|
| `name` | Copied with `" (copy)"` suffix appended |
| `note` | Copied as-is |
| `priority` | Copied as-is |
| `due_date` | Copied as-is |
| `defer_until` | Copied as-is |
| `project_id` | Copied as-is |
| `area_id` | Copied as-is |
| `tags` | Re-linked to the same tag records |
| `assigned_to` | Copied as-is |
| `involves` | Copied as-is |

### What gets reset / excluded

| Attribute | Behavior |
|-----------|----------|
| `id` | New auto-increment |
| `uid` | New generated UID |
| `status` | Reset to `NOT_STARTED` (0) |
| `completed_at` | Set to `null` |
| `reminder_at` | Set to `null` — original reminder context does not apply |
| `order` | Default (appended to list) |
| `recurrence_*` fields | All stripped — duplicate is always a one-off task |
| `recurring_parent_id` | Set to `null` |
| `completion_based` | Set to `false` |
| `habit_*` fields | N/A — habit tasks are not duplicable |
| `ai_insights` | Set to `null` |
| `subtasks` | Not copied |
| `attachments` | Not copied |
| `task_events` | Not created (fresh timeline) |
| `recurring_completions` | Not copied |
| `created_at` / `updated_at` | New timestamps |

### Constraints on duplicability

- **Habit tasks** (`habit_mode = true`) cannot be duplicated. The duplicate icon should not appear for habit tasks.
- **Recurring task instances** (tasks with `recurring_parent_id`) can be duplicated. The duplicate is a standalone one-off task (no link to the recurring parent).
- **Recurring templates** (tasks that define recurrence but have no `recurring_parent_id`) can be duplicated. Recurrence config is stripped from the copy.

## Technical Scope

### Backend

- New API endpoint to duplicate a task by its UID.
- The endpoint reads the source task, builds a new task with the copied/reset attributes described above, re-links tags, and returns the newly created task.
- Standard auth: the requesting user must own the source task or have read access to it.

### Frontend

- Add a duplicate icon/button to the task list row (in `TaskHeader` component).
- The icon should be hidden for habit tasks.
- On click, call the duplicate API endpoint.
- On success, insert the new task into the current list and show a success toast.
- On error, show an error toast.

## Out of Scope

- Duplicating subtasks (children of the source task are not copied).
- Duplicating attachments (files are not copied).
- Duplicating task events / activity timeline.
- Duplicating habit configuration or habit stats.
- Bulk duplication (selecting multiple tasks to duplicate at once).
- Duplicate action in the task detail page "..." menu (list view only for now).
- Keyboard shortcut for duplication.
- "Duplicate and edit" flow (opening the new task in edit mode).
- Undo support for duplication beyond standard task deletion.

## Constraints

- The feature must work across all task list views: Tasks page, Today page, Project tasks section, Area tasks section.
- The duplicate icon must not clutter the task row — it should be visually consistent with existing row elements and only appear on hover or in a compact action area.
- The feature must respect existing access control — a user cannot duplicate a task they don't have read access to.
- The duplicate inherits `project_id` and `area_id` only if the user has write access to that project/area. If the user lacks write access, the duplicate is created without a project/area assignment.
- Duplicate name suffix `" (copy)"` must not be double-applied if the source already ends with `" (copy)"`.

## Acceptance Criteria

1. **AC-1**: Given a task in the list view, when the user clicks the duplicate icon, then a new task is created with the same name + `" (copy)"` suffix, same note, priority, due date, defer date, project, area, tags, assigned person, and involved people.
2. **AC-2**: The duplicated task has status `NOT_STARTED`, no recurrence, no habit config, no completed date, a new UID, and fresh timestamps.
3. **AC-3**: The duplicate icon is not visible for habit tasks (`habit_mode = true`).
4. **AC-4**: After duplication, the user remains on the same page and the new task appears in the list.
5. **AC-5**: A success toast is displayed after successful duplication.
6. **AC-6**: If the source task name already ends with `" (copy)"`, the duplicate is named `"<name> (copy)"` without stacking (i.e., no `" (copy) (copy)"`).
7. **AC-7**: The duplicate action is available in all list contexts: Tasks, Today, Project tasks, Area tasks.
8. **AC-8**: An unauthenticated user receives a 401 error. A user without access to the source task receives a 403/404 error.
9. **AC-9**: An error toast is displayed if duplication fails for any reason.

## Assumptions

1. The `" (copy)"` suffix is adequate to distinguish duplicates — no numbering scheme (e.g., `(copy 2)`, `(copy 3)`) is needed.
2. Tags are shared records (not duplicated per task), so re-linking is a lightweight operation.
3. The task list UI has sufficient space for an additional icon without layout changes (icon appears on hover, consistent with other web apps).
4. No analytics or tracking event is needed for duplication at launch.
5. The feature does not need to integrate with CalDAV sync or MCP tools in the first iteration.
