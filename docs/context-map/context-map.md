# Context Map: Blank Task Detail Page (`/task/{uid}`)

This document maps the resources relevant to the bug report. It describes existing context only. It does not diagnose the root cause, propose fixes, or define an implementation plan.

## Bug report (as provided)

**Description:** When navigating to a task detail page (e.g. `/task/{uid}`), the page stays blank. The task page never renders.

**Steps to reproduce:**

1. Log in with a user.
2. Navigate to Today (or any page with tasks).
3. Create a new task.
4. Open this task (e.g. click a task, which goes to `/task/{uid}`).

**Not provided in the report:** expected behavior, browser and OS, console output, network responses or HTTP status, screenshots, or a related ticket.

---

## Hot context

Resources directly involved in the feature right now.

### Routing and shell

| Resource | Role |
|---|---|
| `frontend/App.tsx` | Mounts `TaskDetails` at `/task/:uid`, inside the authenticated `Layout` route (sidebar and navigation). |
| `frontend/Layout.tsx` | `createAndOpenTaskDetails` creates a task named "New Task" and navigates to `/task/{uid}` with `state: { isNew: true }`. |

### Page component

| Resource | Role |
|---|---|
| `frontend/components/Task/TaskDetails.tsx` | Page component. Reads `uid` from the route and finds the task in the Zustand `tasksStore` (`task.uid === uid`). If absent, a `useEffect` calls `fetchTaskByUid` and appends the result with `tasksStore.setTasks`. |
| `frontend/components/Task/TaskDetails/index.ts` | Re-exports the child cards (header, content, project, area, tags, subtasks, recurrence, due date, defer-until, attachments, assignee, recurring instance info). |
| `frontend/components/Task/TaskDetails/*.tsx` | Child cards rendered by the page. |
| `frontend/components/Task/TaskDetails/__tests__/TaskContentCard.test.tsx` | Only colocated test in the `TaskDetails` folder. Covers `TaskContentCard`. |

Render branches in `TaskDetails.tsx`, as written:

1. `loading` true: renders `LoadingScreen`.
2. `error` set, or `task` missing: renders a "Task Not Found" view with a "Go to Today" button.
3. Otherwise: renders `TaskDetailsHeader`, then the overview cards (content, subtasks, recurrence, project, area, assignee, tags, due date, defer-until). Optional AI insights (gated by `aiAssistantEnabled`), attachments, and activity pills are also rendered from this branch.

Initial `loading` is `!task` at mount. Its value is set only inside the fetch effect.

No React error boundary was found in the frontend (`ErrorBoundary` and `componentDidCatch` have no matches).

### Entry points to `/task/{uid}`

| Entry | File | Navigation |
|---|---|---|
| Click a task row | `frontend/components/Task/TaskItem.tsx` | `navigate('/task/${task.uid}', fromState)`, or `/habit/${uid}` when `habit_mode` is set. |
| Create from shell button | `frontend/Layout.tsx` | `navigate('/task/${newTask.uid}', { state: { isNew: true, ... } })`. |
| Create from task list | `frontend/components/Tasks.tsx` | Toast link `href="/task/${newTask.uid}"`. |
| Today page | `frontend/components/Task/TasksToday.tsx` | Imports `TaskList` and `TodayPlan`. `TaskList.tsx` imports `TaskItem`. `TodayPlan.tsx` does not import `TaskItem` directly. Its exact click path was not traced. |
| Other pages | Inbox, project details, search, notifications, calendar, productivity assistant, person details, recurring-instance parent link | Each navigates to `/task/{uid}` (see grep results). |

### Client data fetch

| Resource | Role |
|---|---|
| `frontend/utils/tasksService.ts` `fetchTaskByUid` | `GET` to `getApiPath('task/${encodeURIComponent(uid)}')`, with credentials. Throws via `handleAuthResponse` on failure. |
| `frontend/config/paths.ts` `getApiPath` | Prefixes `api/` and the runtime base path. Resolves to `/api/task/{uid}`. |
| `frontend/store/useStore.ts` | Zustand `tasksStore` with `setTasks`, `updateTaskInStore`, and related actions. Also has a dynamic-import call to `fetchTaskByUid` near line 547. |
| `frontend/entities/Task.ts` | Client `Task` shape: `uid`, `name`, `status`, `note`, `subtasks`, recurrence fields, `recurring_parent_uid`, `attachments`, habit fields, `assigned_to`, `involves`. |

### Server handler

| Resource | Role |
|---|---|
| `backend/modules/tasks/routes.js` `GET /task/:uid` (around line 536) | Guarded by `requireTaskReadAccess`. Loads by uid with `TASK_INCLUDES_WITH_SUBTASKS`. Returns the serialized task, `404` `{ error: 'Task not found.' }` if missing, or `500` `{ error: 'Internal server error' }` on exception. |
| `backend/modules/tasks/middleware/access.js` | `requireTaskReadAccess` = `hasAccess('ro', 'task', req => req.params.uid, { notFoundMessage: 'Task not found.' })`. Also defines `requireTaskWriteAccess`. |
| `backend/middleware/authorize.js` | Underlying `hasAccess` implementation. Not inspected in detail. |

Other task routes in the same file that the page calls: `GET /task/:uid/subtasks`, `GET /task/:uid/next-iterations`, and `PATCH /task/:uid` (writes). The timeline and attachments endpoints live in `backend/modules/tasks/events.js` and `backend/modules/tasks/attachments.js`.

---

## Warm context

Guidance that constrains or explains the feature.

| Resource | Relevance |
|---|---|
| `AGENTS.md` | Not present in the repository. |
| `docs/00-tasks-behavior.md` | A task requires only a name, gets a stable uid used in URLs (example `tsk_abc123def456`), defaults to "Not Started", and is visible to its owner or shared users. Detail-page fields (note, status, priority, due date, defer-until, subtasks, attachments, project, tags) are described here. |
| `docs/04-inbox-page.md` | Converting an inbox item opens the task detail page in edit mode. This is a different entry point from the reported Today flow. |
| `docs/02-today-page-sections.md` | Defines which tasks appear in Today sections. It does not describe the detail page. |
| `docs/13-ai-assistant.md` | `TaskAIInsights` is an on-demand panel on the task detail view. |
| `docs/MEMORY.md` | Frontend conventions: TypeScript components, Zustand for global state, SWR for server state. `TaskDetails` uses Zustand and `useState` with direct fetches, not SWR. |
| `docs/code-conventions.md` | Documents `GET /api/v1/task/:id`, `PUT /api/v1/task/:id`, and `GET /api/v1/task/uid/:uid`. |
| `docs/directory-structure.md` | Lists `TaskDetails.tsx` and `TaskItem.tsx` under `frontend/components/Task/`. |

### Documented contract vs. implemented code (unresolved contradictions)

- `docs/code-conventions.md` describes a `/api/v1` prefix, numeric `:id` routes, a separate `/task/uid/:uid` route, and `PUT` for updates. The client (`getApiPath`) and `backend/modules/tasks/routes.js` use `/api/task/:uid` and `PATCH /task/:uid`. The source of truth for the prefix was not checked beyond `getApiPath`.

---

## Cold context

Potentially useful background. Read only if the hot context is insufficient.

- `docs/01-recurring-tasks-behavior.md`: recurrence rules shown in `TaskRecurrenceCard`.
- `backend/modules/tasks/operations/parent-child.js`: subtask behavior.
- `backend/modules/tasks/attachments.js`: attachment list endpoint used by the attachments pill and count.
- `backend/modules/tasks/events.js`: timeline and completion-time endpoints used by the activity pill.
- `backend/modules/tasks/recurringTaskService.js`: recurring instance logic referenced by `TaskRecurringInstanceInfo`.
- `docs/00-tasks-behavior.md`, "Task Sharing & Permissions": access rules behind `requireTaskReadAccess`.
- `backend/tests/integration/task-user-isolation.test.js`: calls `GET /api/task/${uid}`. API-level, not page-level.
- Other `backend/tests/integration/*task*` files: API-level coverage.
- `e2e/tests/today-view.spec.ts`: creates and deletes tasks through the API. A grep of `e2e/` for `/task/` or `TaskDetails` found no browser navigation to `/task/{uid}`.
- `.github/ISSUE_TEMPLATE/bug_report.yml`: the template this report would normally follow. No matching ticket exists in the repo.

---

## Resources to ignore

- Deprecated documentation and generated files.
- Vendored or third-party code.
- Unrelated modules: CalDAV, OIDC SSO, backups, goals, notes, areas, and tags beyond the detail cards.
- `docs/common-tasks.md` and `docs/development-workflow.md` contain `/task/:id` examples, but they describe code snippets rather than the running page.

---

## Gaps and unresolved items

1. The expected UI is not stated. The component's own branches are a loading view, a "Task Not Found" view, or the full detail layout. The report does not say which one, or whether it is "blank" in a different sense.
2. No console error, failed request, HTTP status, or screenshot is attached. It is not recorded whether `Layout` (sidebar and navigation) is visible while the page is blank.
3. The repro creates a task first. The page's new-task branch (`location.state.isNew`) and the abandoned-task cleanup effect are both involved in that flow. Whether that flow differs from opening an existing task is not documented.
4. No frontend or e2e test asserts that `/task/:uid` renders.
5. The `/api/v1` vs `/api` contract mismatch noted above is unresolved.
6. `TodayPlan.tsx` click path to `/task/{uid}` was not traced.
7. The reproduction environment (browser, login state, whether the task was created via the shell button or the Today/list flow) is not specified.
