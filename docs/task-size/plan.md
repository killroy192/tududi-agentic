# Task size — Implementation Plan

Source: [KAN-15](https://epam-team-ai-adoption.atlassian.net/browse/KAN-15) · Spec: `docs/task-size/spec.md`

### Confirmed Facts

**Backend**

- `backend/models/task.js` defines `priority` as a nullable integer 0–2 with default 0 and has no `size` column. Migrations use `YYYYMMDDHHMMSS-kebab-name.js` and add task columns through `safeAddColumns` (`backend/utils/migration-utils.js`). The latest migration is `20260630000003-add-color-to-people.js`.
- `PATCH /task/:uid` (`backend/modules/tasks/routes.js` ~559) is guarded by `requireTaskWriteAccess` → `hasAccess('rw', 'task')` (`backend/middleware/authorize.js`). When a task is missing, `permissionsService.getAccess` returns `none`, so the guard answers 403 before the route's own 404 branch is reached.
- `permissionsService.getAccess` (`backend/services/permissionsService.js`) returns `admin` for system administrators. Owners get `rw`. Tasks inherit project access, and otherwise use a direct `Permission` row (`ro`/`rw`/`admin`).
- Order of side effects inside the PATCH handler:
  1. The `update_parent_recurrence` parent write (~595–637).
  2. `buildUpdateAttributes`.
  3. Defer/due validation, which returns 400.
  4. Project and area validation.
  5. `handleRecurrenceUpdate`, which can destroy future instances.
  6. `task.update`.
  7. Tags, subtasks, and `logTaskChanges`.

  Today there is no request-wide validation before step 1.
- `handleRecurrenceUpdate` (`backend/modules/tasks/operations/recurring.js` 11–71) treats `name`, `project_id`, `priority`, and `note` as template fields. It compares the raw `reqBody[field]` against the stored value, which means a string priority such as `'medium'` never equals the stored `1`. Fields outside that list cannot trigger deletion.
- `buildTaskAttributes` / `buildUpdateAttributes` (`backend/modules/tasks/core/builders.js`) build an explicit attribute object, so an unknown body field is not persisted on create or update. `parsePriority` lives in `core/parsers.js`.
- `logTaskChanges` / `captureOldValues` (`backend/modules/tasks/utils/logging.js`) use fixed field lists. A field missing from those lists produces no activity entry.
- `serializeTask` (`backend/modules/tasks/core/serializers.js`) spreads `toJSON()` with no whitelist. A new column therefore appears in task GET/PATCH, list, metrics/today, search (`search/service.js`), subtasks, and MCP read responses (`mcp/tools/taskTools.js`). Virtual upcoming occurrences (`routes.js` ~191) are spread copies of the parent with `is_virtual_occurrence: true`.
- Project details tasks are serialized separately in `backend/modules/projects/service.js` `getByUid` (~200) from a full-attribute Task include (`projects/repository.js` ~124).
- Habit create/update spread the raw body into the stored task: `habits/repository.js` `createHabit` spreads `...data`, and `habits/service.js` `update` passes `data` to `repository.update`. MCP habit tools build explicit update objects.
- MCP task tools build explicit `updates` objects, so they will not accept `size` unless code is added. CalDAV (`caldav/icalendar/*`) maps fields explicitly.
- No application code creates stored recurring child instances today. Stored children exist only as existing data, or as rows created directly in tests.
- No endpoint or payload tells the frontend the viewer's access level for a task.

**Frontend**

- `frontend/entities/Task.ts` has no `size`. `PriorityType` is a string union.
- `TaskDetails.tsx` `handlePriorityUpdate` (~1188) sends a partial `updateTask(uid, { priority })` (`frontend/utils/tasksService.ts` 91–114). It then refetches the task, calls `tasksStore.updateTaskInStore` (`frontend/store/useStore.ts` ~611), bumps the timeline refresh key, and shows toasts `task.priorityUpdated` / `task.priorityUpdateError`.
- The priority dropdown UI lives in `TaskDetails/TaskDetailsHeader.tsx` (~324–464).
- `TaskItem.tsx` renders `TaskHeader.tsx`. `TaskHeader` has a desktop layout (`hidden md:flex`, ~196), a mobile layout (~430+), an upcoming branch (`isUpcomingView`), and a Kanban compact meta row (`isKanbanView`, ~301). It already branches on `task.habit_mode`. Compact subtask rows render through `SubtasksDisplay` inside `TaskItem`.
- These screens keep local task copies, and most of their `handleTaskUpdate` sends the whole task in a raw PATCH:
  - `Tasks.tsx` ~380
  - `Kanban/KanbanBoard.tsx` ~201
  - `Eisenhower/EisenhowerMatrix.tsx` ~89
  - `Project/ProjectDetails.tsx` ~312
  - `Tag/TagDetails.tsx` ~292
  - `ViewDetail.tsx` ~499

  `Area/AreaDetails.tsx` ~151 only merges locally. `Task/TasksToday.tsx` ~729 owns the Today and Today plan state, and `TodayPlan.tsx` receives it through props.
- The toast system comes from `Shared/ToastContext` (`useToast`). The generic `updateError` "Failed to update task" lives in the task block of `public/locales/en/translation.json` (~901). The app ships 25 locale folders under `public/locales/`, and components call `t('key', 'English fallback')`.
- Habit UI lives in `frontend/components/Habits/*`.

**Tests**

- Backend integration tests live in `backend/tests/integration/`: `tasks.test.js`, `permissions-tasks.test.js`, `task-edit-shared-project.test.js`, `project-sharing.test.js`, `recurring-tasks.test.js`, and `subtasks.test.js`.
- The shared helpers are `createTestUser` and `authenticateUser` in `backend/tests/helpers/testUtils.js`.
- Unit tests include `backend/tests/unit/modules/tasks/builders.test.js` and `backend/tests/unit/services/permissionsService.test.js`.
- The frontend has an RTL example at `frontend/components/Task/TaskDetails/__tests__/TaskContentCard.test.tsx`. Playwright tests live in `e2e/tests/`, for example `today-view.spec.ts`.

### Assumptions

The spec still marks review findings 4.1–4.4 as blocking. The plan resolves each one with the assumption below. Each one needs product sign-off before implementation starts, or at the latest before the steps that depend on it.

1. **Viewer access source (4.1-2).** Every task read payload gains an additive, viewer-scoped `access_level` field (`ro` | `rw` | `admin`). The server computes it with the same rules as `permissionsService.getAccess`. Lists use a request-scoped bulk variant so there is no per-task N+1 query. The UI treats `rw` or `admin` as editable. If the field is missing, the UI falls back to editable, and the server's 403 stays authoritative. This touches authorization code, so it falls under **approval gate 2** in `AGENTS.md`.
2. **Placement (4.1-1).** The size control sits in the existing metadata area of `TaskHeader`:
   - Desktop: in the right-hand group next to existing meta.
   - Mobile: in the mobile metadata row.
   - Kanban compact: in the stacked meta column.
   - Upcoming layout: next to the name/meta line.

   On narrow screens it shows the letter or the Unset label without an icon text. In task details it sits next to the priority dropdown.
3. **Virtual upcoming occurrences (4.1-3, 4.2-1).** A virtual occurrence row shows the size it carries, which is the parent's value, as plain read-only text and never opens the menu. Stored instances and the parent's real row stay editable. For AC-8's "created afterward" clause, the test is a stored child created directly through the model, because no app path creates children.
4. **Read payload visibility (4.2-2).** `size` appears in every task read payload, including search results and MCP reads. AC-16 only forbids size as an *input*, filter, sort, metric, AI input, activity entry, or CalDAV field.
5. **Full-task PATCH (4.3-1).** Only the dedicated size control changes size, and it sends a partial `{ size }` PATCH. Existing full-task PATCH callers (Kanban, Eisenhower, Tasks, Project, Tag, View, completion undo) drop `size` from their payload so a stale copy cannot overwrite it. The server still accepts `size` from any update caller under the normal write rule. Priority-string recurrence deletion is a pre-existing issue and is not fixed here.
6. **Habits (4.3-2).** Habit create and habit update silently strip `size`. A `PATCH /task/:uid` whose target has `habit_mode = true` validates `size` (an invalid value still returns 400), then ignores it, so the stored size stays `null` and the request succeeds.
7. **Same-session sync (4.3-3).** After a successful size save, the result is published once to a shared in-session channel in the Zustand store, keyed by task uid. It is not routed through each screen's `onTaskUpdate`, because those handlers re-PATCH the whole task. Every local-copy screen merges the published `{ uid, size }` into all of its sections. Task details also updates through `updateTaskInStore`.
8. **Error per surface (4.4-2).** On failure (any non-2xx, including 403, or a network error), the control reverts. Task details shows the priority-style error toast with a size-specific key. List and board surfaces show the generic `updateError` toast through `useToast`, the same toast system task details uses. This adds one English key with a fallback (`task.sizeUpdateError`). Other locales fall back to English, and the bulk locale sync stays behind **approval gate 6**.
9. **Unset label.** The label uses a new key (`task.size.unset`, fallback "Unset") and is added to `en` only. S, M, L, and XL are literal and not translated.
10. **Same value.** Choosing the currently saved value closes the menu and sends no request.
11. **AC-18 "loads again".** This means a route revisit or a browser refresh in that tab.
12. **Validation shape.** Size validation runs at the very top of the PATCH handler, before the `update_parent_recurrence` parent write. It returns `400 { error }` in the same shape as the existing defer/due 400.
13. **Storage.** `size` is a nullable `STRING` column with model-level `isIn` validation, default `null`, and no index. Sorting and filtering are out of scope.

### Files / Modules Involved

**Backend**

- `backend/migrations/<timestamp>-add-size-to-tasks.js` (new)
- `backend/models/task.js` (column, allowed-values constant)
- `backend/modules/tasks/core/parsers.js` (size validation helper)
- `backend/modules/tasks/core/builders.js` (update attributes carry size; create never does)
- `backend/modules/tasks/routes.js` (early size validation in PATCH; habit-target ignore; create ignores size)
- `backend/modules/tasks/core/serializers.js` (viewer `access_level`; options for viewer id / access map)
- `backend/services/permissionsService.js` (bulk access resolution for a task list)
- `backend/modules/tasks/operations/list.js`, `backend/modules/tasks/queries/metrics-computation.js`, `backend/modules/tasks/operations/subtasks.js` (pass the viewer into serialization)
- `backend/modules/projects/service.js` (project task normalization includes `access_level`)
- `backend/modules/search/service.js` (pass the viewer so search results stay consistent; no size filter)
- `backend/modules/habits/service.js` and/or `backend/modules/habits/controller.js` (strip size)
- Unchanged but verified: `operations/recurring.js`, `utils/logging.js`, `mcp/tools/taskTools.js`, `mcp/tools/habitTools.js`, `caldav/icalendar/*`, and `search/validation.js`

**Frontend**

- `frontend/entities/Task.ts` (`TaskSize` type; `size`, `access_level` fields)
- `frontend/components/Task/TaskSizeControl.tsx` (new shared control: menu for editors, text for read-only and virtual rows)
- `frontend/components/Task/TaskDetails/TaskDetailsHeader.tsx` and `frontend/components/Task/TaskDetails.tsx` (mount and save path)
- `frontend/components/Task/TaskHeader.tsx` (mount in desktop, mobile, Kanban, and upcoming layouts; skip on `habit_mode`)
- `frontend/components/Task/TaskItem.tsx` (pass props; `SubtasksDisplay` unchanged)
- `frontend/store/useStore.ts` (same-session size-patch channel)
- `frontend/utils/tasksService.ts` (reuse `updateTask` partial PATCH)
- Local-copy screens (merge published size; strip `size` from full-task PATCH):
  - `frontend/components/Tasks.tsx`
  - `frontend/components/Kanban/KanbanBoard.tsx`
  - `frontend/components/Eisenhower/EisenhowerMatrix.tsx`
  - `frontend/components/Task/TasksToday.tsx` (covers `TodayPlan.tsx`)
  - `frontend/components/Project/ProjectDetails.tsx`
  - `frontend/components/Area/AreaDetails.tsx`
  - `frontend/components/Tag/TagDetails.tsx`
  - `frontend/components/ViewDetail.tsx`
- `public/locales/en/translation.json` (Unset label, size error key)

**Tests**

- `backend/tests/unit/modules/tasks/builders.test.js`
- `backend/tests/unit/modules/tasks/parsers.test.js` (new)
- `backend/tests/unit/services/permissionsService.test.js`
- `backend/tests/integration/task-size.test.js` (new: CRUD, validation, recurrence, subtasks, habits, permissions, admin, no activity)
- `frontend/components/Task/__tests__/TaskSizeControl.test.tsx` (new)
- `frontend/components/Task/__tests__/TaskHeader.size.test.tsx` (new)
- `frontend/store/__tests__/` (size channel)
- `e2e/tests/task-size.spec.ts` (new)

### Implementation Plan

**Phase A — Storage and read (AC-1, AC-11, AC-13)**

1. **Test:** Add an integration spec. It checks that an existing task and a newly created task return `size: null`. It checks that `POST /task` succeeds and stores `null` when `size` is omitted, `null`, `S`, or `XXL`. It checks that a PATCH without `size` leaves a seeded size unchanged. Run it and confirm it fails because the field is missing.
2. **Implement:** Add the migration (nullable, default `null`, reversible via `safeAddColumns` / remove column) and the model column with an allowed-values constant. Confirm that create builds attributes explicitly and drops any submitted size. Run the tests until they pass.

**Phase B — Update and validation (AC-3, AC-4, AC-5, AC-6, AC-12, AC-15)**

3. **Test (unit):** Add a parser/validator test for the accepted set (`null`, `S`, `M`, `L`, `XL`) and the rejected set (`''`, `unset`, `s`, `XXL`, numbers, booleans, objects). Add a builder test showing that `buildUpdateAttributes` includes size only when the body has the key, and keeps the stored value otherwise.
4. **Implement:** Add the validator and the update-attribute handling.
5. **Test (integration):**
   - PATCH sets S/M/L/XL and then `null`.
   - The response and a later GET reflect the value.
   - Priority and status are unchanged by a size PATCH, and size is unchanged by priority/status PATCHes.
   - Size can be changed on completed, archived, and cancelled tasks, and a status change keeps it.
   - Two sequential PATCHes leave the second value stored.
6. **Test (integration, combined AC-12 case):** On a recurring parent with future stored children, send an invalid size together with a changed name and `update_parent_recurrence` where applicable. Assert:
   - The response is 400.
   - Name, priority, and size are unchanged.
   - The future-children ids are identical.
   - The parent recurrence fields are untouched.

   Repeat for each rejected value.
7. **Implement:** Run the size validation as the first step of the PATCH handler, before any write or delete. Do not add `size` to the recurrence template field list.

**Phase C — Recurrence, subtasks, activity (AC-8, AC-9 API, AC-16 API)**

8. **Test (integration):**
   - A size PATCH on a recurring parent leaves the children's sizes and ids unchanged.
   - A size PATCH on a stored child leaves the parent and siblings unchanged.
   - A child created directly after the parent has a size reads `null`.
   - A size PATCH on a subtask leaves the parent unchanged.
   - A size-only PATCH adds no `TaskEvent` row.
   - MCP task tool schemas expose no `size` input.
   - Search rejects or ignores a size filter or sort parameter.
   - The CalDAV VTODO output has no size property.
9. **Implement:** Expect no code change. Fix only if a test shows leakage.

**Phase D — Habits (AC-10 API)**

10. **Test (integration):** Send `size: 'S'` in each of these, and assert success with stored size `null`:
    - `POST /habits`
    - `PUT /habits/:uid`
    - `PATCH /task/:uid` on a habit

    Also send `size: 'XXL'` to `PATCH /task/:uid` on a habit and assert 400.
11. **Implement:** Strip size in the habit create/update service layer. In the task PATCH, ignore size after validation when the target is a habit.

**Phase E — Viewer access level (AC-7 API, prerequisite for read-only UI) — approval gate 2**

12. **Test (unit):** Bulk access resolution returns the same level as `getAccess` for each case:
    - owner
    - direct `ro` / `rw` share
    - `ro` / `rw` project share
    - no access
    - system administrator (`admin`)
13. **Test (integration):** Check `access_level` on these endpoints for owner, `ro` share, `rw` share, and admin users:
    - `GET /task/:uid`
    - `GET /tasks` (each list type used by the screens: default, today, upcoming grouped, tag, area, project filter)
    - project details tasks
    - search results
    - subtasks

    A `ro` user's size PATCH returns 403 and leaves the size unchanged. An admin's size PATCH succeeds. A missing-task PATCH returns 403. A no-access user's GET returns 403 or 404 per the current behavior.
14. **Implement:** Add a request-scoped bulk resolver to the permissions service. Pass the viewer through the serializers and the project service. Do not change enforcement.

**Phase F — Shared control in task details (AC-2 details, AC-4, AC-7 UI, AC-14 details, AC-17)**

15. **Test (RTL):** The `TaskSizeControl`:
    - renders the translated Unset label for `null` and the literal letters for S–XL;
    - opens a menu with Unset, S, M, L, XL in that order for `rw`/`admin`;
    - renders plain text with no menu trigger for `ro` and for virtual occurrences;
    - sends no request when the current value is chosen;
    - calls the save handler with the chosen value;
    - reverts to the previous value and triggers the error toast when the save rejects;
    - is keyboard-operable and has an `aria-label`.
16. **Implement:** Build the control. Mount it in `TaskDetailsHeader` next to priority. Wire `TaskDetails` to a partial `updateTask(uid, { size })`, then `updateTaskInStore` and a publish to the size channel. On failure, revert and show the size error toast. Add the English keys.

**Phase G — Task rows and same-session sync (AC-2, AC-3, AC-9 UI, AC-10 UI, AC-14 lists)**

17. **Test (RTL):** `TaskHeader` / `TaskItem`:
    - show the control in the desktop, mobile, Kanban compact, and upcoming layouts;
    - render no control when `habit_mode` is true;
    - render no control inside compact subtask rows;
    - a size change does not call the row's `onTaskUpdate`, so there is no full-task PATCH.
18. **Implement:** Mount the control in each `TaskHeader` layout. Wire the save to the shared partial update and publish to the size channel.
19. **Test (store/unit):** A published size patch is observable by subscribers. Merging it into a list that contains the same uid in two sections updates both.
20. **Implement:** Add the store channel. In each local-copy screen (Tasks, Kanban, Eisenhower, TasksToday/TodayPlan, Project, Area, Tag, View), subscribe and merge the size into every section that holds that uid. Remove `size` from each full-task PATCH body in those screens' `handleTaskUpdate`, and from Kanban/Eisenhower moves and completion undo.
21. **Test (RTL regression):** A Kanban or Eisenhower move after a size change does not send `size` in its PATCH body.

**Phase H — End-to-end (AC-3, AC-14, AC-18 critical flows)**

22. **Test (Playwright):**
    - Set size on Today. Open details and see the same value. Return and still see it.
    - Set size in details. The Kanban card shows it without a reload.
    - Simulate a 403 or offline response and confirm the revert plus the toast.
    - A second tab keeps the old value until it is reloaded.
23. **Finalize:** Run `npm run lint`, `npm run format`, `npm test`, `npm run frontend:test`, and `npm run test:ui`. Fix anything red.

### Risks

- **Authorization surface (gate 2):** Exposing `access_level` adds server-side access computation to every task list. An incorrect bulk resolver could show the menu to read-only users (the server still returns 403) or hide it from editors. It needs unit parity tests against `getAccess`, and reviewer approval.
- **List performance:** Per-task access lookups on large lists such as Kanban/Eisenhower (`limit=10000`) would be N+1. The bulk resolver must use a constant number of queries per request.
- **Stale full-task PATCH:** Any missed full-task caller can write an old size back. A grep audit for raw `PATCH task/` calls is part of step 20.
- **Pre-existing recurrence deletion:** Full-task PATCHes that resend string priority already trigger future-instance deletion. This plan does not fix it, but the AC-8 tests must use partial PATCHes so they are not polluted by it.
- **Parent write before validation:** `update_parent_recurrence` writes the parent before the current validation runs. The new size check must sit above it, or AC-12 fails.
- **Migration:** The change is additive and nullable, and SQLite-safe through `safeAddColumns`. The down step drops the column, which loses the data. That is acceptable because the feature is new, but call it out in the PR.
- **i18n:** Only English keys are added. Other locales show the English fallback until the bulk locale sync (gate 6).
- **Layout density:** The extra control on the Kanban compact and mobile rows can crowd or truncate metadata. Verify on a narrow viewport.

### Out Of Scope

- A size field on the task create form. The habit card, habit details, and habit rows. The compact subtask row.
- Filtering, sorting, or searching by size. Metrics, AI insights, and recommendations based on size.
- An activity or timeline entry for a size change.
- CalDAV / iCalendar mapping. MCP tool inputs for size, on both task and habit tools.
- Copying size across a recurring series, and deleting or regenerating instances on a size change.
- A size-specific permission, and any change to how access is enforced.
- Live cross-tab or cross-user updates. Optimistic locking or merge.
- Fixing the pre-existing priority-string recurrence deletion. Translating new keys into non-English locales.

### Verification

| ID | Acceptance Criterion | Verifiable By |
| --- | --- | --- |
| AC-1 | Existing and new ordinary tasks show Unset on rows and details; payload `size: null` | Integration Test (step 1), UI Check (step 15), Manual Test |
| AC-2 | Editor sees Unset, S, M, L, XL in order on main list, Today, Today plan, project, area, tag, view, Kanban, Eisenhower, details (desktop, mobile, Kanban compact, upcoming layouts) | Automated Test (RTL steps 15, 17), UI Check per screen |
| AC-3 | Choosing S–XL saves immediately; details and other open full-row views in session update without reload; later visit shows it; payload has letter | Integration Test (step 5), Automated Test (steps 19–20), E2E (step 22), API Check |
| AC-4 | Choosing Unset clears to `null`; control reads Unset | Integration Test (step 5), Automated Test (step 15), Manual Test |
| AC-5 | Size independent of priority and status in both directions | Integration Test (step 5), API Check |
| AC-6 | Completed, archived, and cancelled tasks still editable; status change keeps size | Integration Test (step 5), Manual Test |
| AC-7 | `ro` user sees text only, PATCH returns 403 and size unchanged; no-access user cannot see task; admin can change | Integration Test (step 13), Unit Test (step 12), Automated Test (step 15), Manual Test |
| AC-8 | Parent and stored-instance sizes independent; no delete or recreate; later stored child is `null`; virtual occurrence read-only | Integration Test (step 8), Automated Test (step 15, virtual row), API Check |
| AC-9 | Subtask edits own size on details and full row; parent unchanged; compact subtask row has no control | Integration Test (step 8), Automated Test (step 17), UI Check |
| AC-10 | No size on habit card, details, or row; habit create, habit update, and task PATCH on habit with `S` leave `null` | Integration Test (step 10), Automated Test (step 17), UI Check |
| AC-11 | Create with omitted, `null`, `S`, or `XXL` size succeeds and stores `null` | Integration Test (step 1), API Check |
| AC-12 | Invalid size (`''`, `unset`, `s`, `XXL`, number) returns 400; name, priority, and size unchanged; future instances kept (combined recurring-parent case) | Unit Test (step 3), Integration Test (step 6), API Check |
| AC-13 | PATCH without size leaves stored size unchanged | Integration Test (step 1), Unit Test (step 3) |
| AC-14 | Failed save (403 or offline) reverts the value and shows that surface's error toast | Automated Test (step 15), E2E (step 22), Manual Test |
| AC-15 | Two successful saves: later value stored, no conflict prompt | Integration Test (step 5), Manual Test |
| AC-16 | No activity entry; no MCP size input; no search size filter or sort; no CalDAV size; size present in read payloads | Integration Test (step 8), API Check |
| AC-17 | Non-English language shows translated Unset (English fallback until locale sync); letters unchanged; stored values `null` or uppercase | Automated Test (step 15, mocked i18n), UI Check, API Check |
| AC-18 | Second tab unchanged until route revisit or refresh | E2E (step 22), Manual Test |
