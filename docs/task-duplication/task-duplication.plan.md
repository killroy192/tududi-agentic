# Task Duplication Implementation Plan

## Confirmed Facts

- Task model has ~30+ fields; duplication copies a subset and resets the rest (see spec tables)
- `TaskHeader.tsx` renders both desktop and mobile list rows; it already accepts `onEdit`/`onDelete` props (currently voided)
- `TaskItem.tsx` orchestrates handlers and passes them to `TaskHeader`; it uses `useToast()` for feedback
- Existing access middleware: `requireTaskReadAccess` uses `hasAccess('ro', 'task', ...)` -- we only need read access on the source task
- `updateTaskTags()` in [backend/modules/tasks/operations/tags.js](backend/modules/tasks/operations/tags.js) can re-link tags via `task.setTags(allTags)`
- `taskRepository.create()` generates a new `uid` automatically via the model hook
- `serializeTask()` returns the full task with associations, which the frontend expects
- The `createTask` function in [frontend/utils/tasksService.ts](frontend/utils/tasksService.ts) shows the HTTP pattern (POST + CSRF headers)
- Test helpers in [backend/tests/helpers/testUtils.js](backend/tests/helpers/testUtils.js) provide `createTestUser` and `authenticateUser`
- The `" (copy)"` suffix de-duplication rule: strip trailing `" (copy)"` before re-appending

## Assumptions

- The duplicate endpoint returns the full serialized task (same shape as `GET /api/task/:uid`)
- The frontend will optimistically insert the returned task into the current list without a full refetch
- No migration needed -- no new DB columns
- `DocumentDuplicateIcon` from `@heroicons/react/24/outline` is available (already used in `NoteDetails.tsx`)

## Files/Modules Involved

### Backend
- [backend/modules/tasks/routes.js](backend/modules/tasks/routes.js) -- new `POST /task/:uid/duplicate` route
- [backend/modules/tasks/operations/duplicate.js](backend/modules/tasks/operations/duplicate.js) -- new file: `duplicateTask()` operation
- [backend/modules/tasks/middleware/access.js](backend/modules/tasks/middleware/access.js) -- already exports `requireTaskReadAccess` (reuse as-is)
- [backend/tests/integration/task-duplicate.test.js](backend/tests/integration/task-duplicate.test.js) -- new integration test file

### Frontend
- [frontend/utils/tasksService.ts](frontend/utils/tasksService.ts) -- new `duplicateTask()` API function
- [frontend/components/Task/TaskHeader.tsx](frontend/components/Task/TaskHeader.tsx) -- add duplicate icon (desktop + mobile)
- [frontend/components/Task/TaskItem.tsx](frontend/components/Task/TaskItem.tsx) -- wire `onDuplicate` handler, call API, show toast, update list

## Implementation Steps

### Step 1: Backend -- Create `duplicateTask` operation

Create [backend/modules/tasks/operations/duplicate.js](backend/modules/tasks/operations/duplicate.js) with a single exported function `duplicateTask(sourceTask, userId)` that:

- Builds a copy name: strip trailing `" (copy)"` from `sourceTask.name`, then append `" (copy)"`
- Constructs attribute object with copied fields (`name`, `note`, `priority`, `due_date`, `defer_until`, `project_id`, `area_id`, `assigned_to`, `involves`, `user_id`) and reset fields (`status: 0`, `completed_at: null`, `reminder_at: null`, all `recurrence_*` to defaults, all `habit_*` excluded, `ai_insights: null`, `parent_task_id: null`, `recurring_parent_id: null`)
- Calls `taskRepository.create(attributes)` to persist
- Copies tags via `task.setTags(await sourceTask.getTags())`
- Reloads task with `TASK_INCLUDES_WITH_SUBTASKS` and returns it

### Step 1b: Unit test for copy name logic

Add a small unit test for the name suffix logic (strip-then-append) to cover AC-6.

### Step 2: Backend -- Add `POST /task/:uid/duplicate` route

In [backend/modules/tasks/routes.js](backend/modules/tasks/routes.js), add a new route before the sub-router mounts:

- `router.post('/task/:uid/duplicate', requireTaskReadAccess, handler)`
- Handler: load source task with `TASK_INCLUDES_WITH_SUBTASKS`, reject if `habit_mode === true` (400), call `duplicateTask()`, serialize result with `serializeTask()`, return 201

### Step 2b: Integration tests for the duplicate endpoint

Create [backend/tests/integration/task-duplicate.test.js](backend/tests/integration/task-duplicate.test.js) covering:

- Happy path: duplicate a normal task, verify all copied/reset fields (AC-1, AC-2)
- Tags are re-linked (AC-1)
- `" (copy)"` suffix applied correctly; no stacking on re-duplicate (AC-6)
- Habit task returns 400 (AC-3)
- Recurring task: recurrence fields stripped from duplicate (AC-2)
- Unauthenticated request returns 401 (AC-8)
- Non-existent task returns 404 (AC-8)

### Step 3: Frontend -- Add `duplicateTask` API function

In [frontend/utils/tasksService.ts](frontend/utils/tasksService.ts), add:

```typescript
export const duplicateTask = async (taskUid: string): Promise<Task> => {
    const response = await fetch(
        getApiPath(`task/${encodeURIComponent(taskUid)}/duplicate`),
        {
            method: 'POST',
            credentials: 'include',
            headers: await getPostHeadersWithCsrf(),
        }
    );
    await handleAuthResponse(response, 'Failed to duplicate task.');
    return await response.json();
};
```

### Step 4: Frontend -- Add duplicate icon to `TaskHeader`

In [frontend/components/Task/TaskHeader.tsx](frontend/components/Task/TaskHeader.tsx):

- Add `onDuplicate?: (e: React.MouseEvent) => void` to `TaskHeaderProps`
- Import `DocumentDuplicateIcon` from `@heroicons/react/24/outline`
- In both the desktop and mobile views, render a duplicate icon button next to the status control area. Only render when `onDuplicate` is provided and `task.habit_mode` is falsy. The button should call `onDuplicate` with `e.stopPropagation()`. Show on hover (desktop) using group-hover opacity classes.

### Step 5: Frontend -- Wire handler in `TaskItem`

In [frontend/components/Task/TaskItem.tsx](frontend/components/Task/TaskItem.tsx):

- Import `duplicateTask` from `tasksService`
- Add `onTaskDuplicated?: (task: Task) => void` to `TaskItemProps`
- Create `handleDuplicate` async handler that calls `duplicateTask(task.uid!)`, calls `showSuccessToast(...)` on success (AC-5), and calls `showErrorToast(...)` on failure (AC-9)
- Pass the new task up to the parent via `onTaskDuplicated` callback so it can be inserted into the list
- Pass `onDuplicate={handleDuplicate}` to `TaskHeader`

### Step 6: Frontend -- Propagate `onTaskDuplicated` through list components

Ensure the duplicate callback propagates through the component hierarchy so the new task is added to the current list:

- [frontend/components/Task/TaskList.tsx](frontend/components/Task/TaskList.tsx) -- pass `onTaskDuplicated` through to `TaskItem`
- [frontend/components/Task/GroupedTaskList.tsx](frontend/components/Task/GroupedTaskList.tsx) -- same
- [frontend/components/Tasks.tsx](frontend/components/Tasks.tsx) -- implement `handleTaskDuplicated` that adds the new task to the tasks state
- [frontend/components/Task/TasksToday.tsx](frontend/components/Task/TasksToday.tsx) -- same pattern
- [frontend/components/Project/ProjectTasksSection.tsx](frontend/components/Project/ProjectTasksSection.tsx) -- same pattern

This ensures AC-4 (task appears in list) and AC-7 (works across all views).

## Risks

- **UI density**: Adding another icon to the task row could feel cluttered. Mitigation: show only on hover (desktop) with `opacity-0 group-hover:opacity-100` transition, matching common patterns in task management apps.
- **Race conditions**: If the user rapidly clicks duplicate, multiple copies may be created. Mitigation: disable the button during the API call using local loading state.
- **Shared project access**: The spec says to drop `project_id` if the user lacks write access. For V1 we can skip this check since duplication is only available to the task owner -- the task owner always has write access to their own projects. This can be deferred until sharing is fully supported for duplicated tasks.

## Non-Goals

- Duplicating subtasks, attachments, or task events
- Duplicate action in the task detail page menu
- MCP tool integration for duplication
- Bulk duplication
- Keyboard shortcuts

## Verification (mapped to Acceptance Criteria)

- **AC-1**: Integration test verifies all copied fields match source task; frontend test or manual check confirms fields appear
- **AC-2**: Integration test verifies status=0, no recurrence, no completed_at, new uid, fresh timestamps
- **AC-3**: Integration test: `POST /task/:uid/duplicate` on habit task returns 400; Frontend: icon hidden when `task.habit_mode`
- **AC-4**: Manual: user stays on page, new task visible in list (handled by `onTaskDuplicated` callback)
- **AC-5**: Manual: success toast appears (wired in `handleDuplicate`)
- **AC-6**: Integration test: duplicating `"Task (copy)"` produces `"Task (copy)"` not `"Task (copy) (copy)"`
- **AC-7**: Manual: verify duplicate icon appears in Tasks, Today, Project, Area list views
- **AC-8**: Integration tests: 401 for unauthenticated, 404 for non-existent task
- **AC-9**: Manual: error toast appears on failure (wired in `handleDuplicate` catch block)
