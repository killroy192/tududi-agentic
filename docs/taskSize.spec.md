# Specification: Task Size Field

## Business Goal

**Problem:** Users lack a lightweight way to estimate effort for their tasks during planning. Without a sizing mechanism, users cannot quickly scan a task list and understand relative effort, making prioritization and workload planning harder.

**Proposed solution:** Add an optional "size" field to tasks with T-shirt sizing values (S / M / L / XL). Size is editable via a dropdown on the task list and task details views, saves immediately, and stays in sync across both views. Size is independent of priority and purely informational — it carries no ordinal semantics for sorting or filtering in this iteration.

## Current Behavior

### Backend / Data

- The `tasks` table (SQLite, via Sequelize ORM) has no `size`, `estimate`, or similar column.
- Task fields include `priority` (integer 0–2), `status` (integer 0–6), `name`, `due_date`, `note`, tags, project/area associations, subtask/recurring relationships, and others.
- The `PATCH /api/task/:uid` route accepts partial updates via `buildUpdateAttributes()` and is guarded by `requireTaskWriteAccess` middleware.
- The `GET /api/tasks` and `GET /api/task/:uid` routes serialize tasks via `serializeTask()`, which passes through model fields.

### Frontend

- `TaskItem` renders a task row with a colored priority border, `TaskHeader` (name, status, due date, tags, priority icon), and subtask expansion.
- `TaskDetailsHeader` renders an inline priority dropdown next to the task name in the detail view.
- `tasksService.ts` exposes `updateTask(uid, data)` which calls `PATCH /api/task/:uid`.
- The `Task` TypeScript entity (`frontend/entities/Task.ts`) defines task shape with typed fields including `priority: PriorityType`.
- Translation keys exist under namespaces `priority.*`, `task.*`, `forms.task.labels.*`.

### Permissions

- `requireTaskWriteAccess` middleware enforces `rw` or `admin` access level for mutations.
- `requireTaskReadAccess` middleware enforces `ro` or above for reads.
- Access is resolved by ownership, shared project membership, or direct task-level permission grants.
- The `authorize.js` middleware returns `403 Forbidden` by default when a user has no access to a resource (including when the resource does not exist), unless `forbiddenStatus: 404` is explicitly configured — which it is not for task routes.

## Expected Behavior

### User Flow

1. **User opens a task list view** (any view where `TaskItem` / `TaskHeader` renders). Each non-recurring task row displays a small text badge/chip showing the task's size ("S", "M", "L", or "XL"). If size is unset, a dash or empty placeholder is shown. Recurring tasks do not display the size badge.
2. **User edits size from the task list.** The user clicks the size badge/chip on the task row, which opens an inline dropdown containing: S, M, L, XL, and an option to clear (unset). The user selects a value; the change saves immediately via `PATCH /api/task/:uid` without requiring navigation to task details or a separate save action.
3. **User edits size from task details.** The user opens a non-recurring task's details. A size dropdown appears next to the priority dropdown in the task details header. The user selects a value; the change saves immediately via `PATCH /api/task/:uid` without requiring a separate save action.
4. **Sync across views.** After a size change, both the task list and task details views reflect the updated value without requiring a page refresh.
5. **Read-only users.** Users with `ro` access can see the size badge but cannot interact with it (disabled/non-editable state).
6. **Recurring tasks.** The size badge and size dropdown are not shown for recurring tasks (tasks with a `recurrence_type` other than `none`, or tasks with a `recurring_parent_id`). The API rejects size updates on recurring tasks.

### Edge Cases

| Case | Expected Behavior |
|---|---|
| Task has no size set | Displayed as a dash or empty placeholder in the badge; dropdown shows no selection |
| User clears a previously set size | Size reverts to unset (`null`); badge shows dash/placeholder |
| Task is a recurring parent or recurring instance | Size badge and dropdown are not rendered; API rejects `size` on PATCH with 400 |
| Subtask is created under a sized parent | Subtask has its own independent size field, defaults to `null` |
| API receives an invalid size value (e.g., "XXL", numeric, empty string) | API returns a validation error; task is not modified |
| Multiple rapid size changes | Each change triggers an immediate save; last write wins |

### Error Handling

| Scenario | Expected Behavior |
|---|---|
| `PATCH` with invalid size value | API returns `400 Bad Request` with a descriptive error message. UI shows an error notification and reverts the dropdown to the previous value. |
| `PATCH` with size on a recurring task | API returns `400 Bad Request`. UI does not offer the dropdown on recurring tasks, so this should only occur via direct API calls. |
| `PATCH` by user without write access | API returns `403 Forbidden`. UI does not offer the dropdown to `ro` users, so this should only occur via direct API calls. |
| `PATCH` on nonexistent task or task without access | API returns `403 Forbidden`, consistent with existing middleware behavior. |
| Network failure during save | UI shows an error notification and reverts the dropdown to the previous value. |
| Unauthenticated request | API returns `401 Unauthorized`, consistent with existing behavior. |

## Out Of Scope

- Filtering tasks by size
- Sorting tasks by size
- Grouping tasks by size
- Bulk editing size across multiple tasks
- Size display in Kanban view
- Reporting or analytics on size
- AI insights or suggestions based on size
- CalDAV synchronization of size
- Timeline / audit log entries for size changes
- Setting size via the task creation form UI
- Task duplication behavior (feature does not exist yet)
- Ordinal or numeric semantics for size values
- Size on recurring tasks (recurring parents and recurring instances)
- Size chip / size editing on the Upcoming view (desktop layout remains gated by existing `isUpcomingView` behavior)

## Technical Scope

- **Data layer:** New nullable string column on the `tasks` table. Forward-only migration. No backfill of existing data.
- **Backend API:** Accept and return size as a string value on task read and update endpoints. The `POST /api/task` endpoint accepts size in the body for API completeness, but the create form UI does not expose it. Input validation to restrict values to the allowed set. Reject size updates on recurring tasks. Integration into existing task serialization and attribute-building pipelines.
- **Frontend — Task entity:** Extend the TypeScript task type with the size field.
- **Frontend — Task list:** New clickable badge/chip with inline dropdown rendered in `TaskHeader` for non-recurring tasks in standard list layouts (Today, Inbox, Project, Completed, etc. — not Upcoming). Clicking the badge opens a dropdown for immediate size selection and save. Disabled state for read-only users. Hidden for recurring tasks.
- **Frontend — Task details:** New dropdown in `TaskDetailsHeader`, positioned next to the priority dropdown. Immediate save on change. Disabled state for read-only users. Hidden for recurring tasks.
- **Frontend — Service layer:** No new service functions needed; existing `updateTask()` covers the `PATCH` call.
- **Localization:** New translation keys for size labels and any related UI strings.

## Non-functional Requirements and Constraints

- **Technology stack:** SQLite (Sequelize ORM), Node.js/Express backend, React/TypeScript frontend, i18next for localization.
- **Architectural patterns:** Must follow the existing patterns established by the `priority` field: parsers in `parsers.js`, attribute builders in `builders.js`, serialization in `serializers.js`, access middleware in `access.js`, translations under a dedicated namespace.
- **Compatibility:** API must remain backward-compatible. Existing clients that do not send `size` must continue to work without errors. The `size` field is simply absent or `null` for tasks that have not been sized.
- **Data limitations:** SQLite — no enum column type; size stored as a string column with application-level validation.
- **Testing expectations:** Backend integration tests must cover CRUD operations for size, validation of invalid values, rejection on recurring tasks, and permission enforcement. E2E tests should cover the user flow of setting, changing, and clearing size from task details, and verifying size display in the task list.
- **Existing tests:** All existing integration tests (`tasks.test.js`, `permissions-tasks.test.js`, `task-edit-shared-project.test.js`, `subtasks.test.js`, `tasks-pagination.test.js`, `recurring-tasks.test.js`) and E2E tests (`today-view.spec.ts`, `inbox.spec.ts`, etc.) must continue to pass without modification.

## Acceptance Criteria

| ID | Acceptance Criterion | Verifiable By |
|---|---|---|
| AC-1 | A task's size can be set to one of: S, M, L, XL, or unset (`null`). No other values are accepted. | Automated Test (API) |
| AC-2 | The `PATCH /api/task/:uid` endpoint accepts a `size` field as a string (`"S"`, `"M"`, `"L"`, `"XL"`) or `null` to clear. | Automated Test (API) |
| AC-3 | The `POST /api/task` endpoint accepts an optional `size` field in the request body. | Automated Test (API) |
| AC-4 | The `GET /api/task/:uid` and `GET /api/tasks` endpoints return the `size` field in the response payload. | Automated Test (API) |
| AC-5 | The API returns `400 Bad Request` when an invalid size value is submitted. | Automated Test (API) |
| AC-6 | The API returns `400 Bad Request` when size is submitted on a recurring task (parent or instance). | Automated Test (API) |
| AC-7 | Only users with `rw` or `admin` access can change a task's size. `ro` users receive `403`; unauthenticated users receive `401`. | Automated Test (API) |
| AC-8 | A size badge/chip is displayed on each non-recurring task row in non-Upcoming list views (e.g. Today, Inbox, Project, Completed). It shows the size letter (S/M/L/XL) or a dash/placeholder when unset. Verified on Today via E2E. | UI Check, E2E Test |
| AC-9 | The size badge and size dropdown are not displayed for recurring tasks (parents or instances). | UI Check, E2E Test |
| AC-10 | A size dropdown is displayed next to the priority dropdown in the task details header for non-recurring tasks. | UI Check, E2E Test |
| AC-11 | Changing size saves immediately without a separate save action. Size is editable inline from both the task list (via badge click → dropdown) and the task details view. | E2E Test |
| AC-12 | After a size change, both the task list and task details views reflect the updated value without a page refresh. | E2E Test |
| AC-13 | Users with `ro` access can see the size badge but cannot interact with or change it. | Manual Test, E2E Test |
| AC-14 | Size is independent of priority — changing one does not affect the other. | Automated Test (API) |
| AC-15 | Subtasks have their own independent size field, defaulting to `null`. | Automated Test (API) |
| AC-16 | Existing tasks have `null` size after migration. No existing data is altered. | Migration Check |
| AC-17 | All existing integration and E2E tests continue to pass without modification. | Automated Test (CI) |

## Assumptions

1. "Task list" refers to views where `TaskItem` / `TaskHeader` currently renders in standard list layouts (Today, Inbox, Project, Completed, etc.), not a single specific page. Upcoming size UI is deferred.
2. The visual design of the size badge (colors, border styles, exact placement within the row) is not specified and is left to engineering discretion, with the constraint that it must be a small text badge/chip.
3. The interaction pattern for editing size from the task list is an inline dropdown on click — same behavior as the task details dropdown (click badge → select value → saves immediately).
4. "Saves immediately" means the PATCH request fires on dropdown selection, with optimistic or eager UI update, and error rollback on failure.
5. No numeric or ordinal mapping is stored — size is a plain string column. If sorting/filtering by size is needed in the future, a follow-up migration or mapping layer may be required.
6. A recurring task is identified as any task where `recurrence_type` is not `none`/`null`, or where `recurring_parent_id` is set. Both recurring parents and recurring instances are excluded from size functionality.
7. The `POST /api/task` endpoint accepts `size` in the request body for API completeness, even though the task creation form UI does not expose it. This allows programmatic clients to set size at creation time.