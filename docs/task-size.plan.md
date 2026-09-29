---
name: Task Size Feature
overview: "Add an optional S/M/L/XL size attribute to tasks: a new nullable column with strict enum validation, exposed on task read/create/update, editable via a new dropdown on list rows and task details, and display-only on Kanban, Eisenhower, and search."
todos:
  - id: migration-model
    content: Add migration and Task model field for nullable size column with isIn validation and a Task.SIZES constant
    status: completed
  - id: parse-validate
    content: Add size normalization in parsers.js, map it in create/update builders, and reject invalid values with 400 in POST and PATCH routes
    status: completed
  - id: recurring-unset
    content: Clear size on virtual occurrences in expandRecurringTasks; keep size out of logging.js fields and recurring.js templateFieldsChanged
    status: completed
  - id: subtasks
    content: Support size on subtask create and update in operations/subtasks.js
    status: completed
  - id: can-edit
    content: Add a batched editability resolver to permissionsService and emit can_edit from serializers, wired at task list, single task, create/update, subtask, and metrics endpoints
    status: completed
  - id: backend-tests
    content: Update Swagger task schema and add backend unit/integration tests for size create, update, clear, omit, invalid, RO rejection, and timeline absence
    status: completed
  - id: frontend-types
    content: Add TaskSize type plus size and can_edit fields to frontend/entities/Task.ts
    status: completed
  - id: size-components
    content: Create Shared/SizeBadge.tsx and Shared/SizeDropdown.tsx with keyboard support, accessible name, and a disabled state
    status: completed
  - id: list-rows
    content: Render size in TaskItem/TaskHeader gated on an isSizeEditable prop defaulting to false plus can_edit, opt in from TaskList and GroupedTaskList, and save a minimal size-only PATCH with optimistic update and revert
    status: completed
  - id: details
    content: Add the size control to TaskDetailsHeader and a handleSizeUpdate in TaskDetails that skips the timeline refresh
    status: completed
  - id: search-badge
    content: Render the display-only SizeBadge in UniversalSearch/SearchResults.tsx
    status: completed
  - id: form-section
    content: Add the unmounted TaskForm/TaskSizeSection.tsx mirroring TaskPrioritySection
    status: completed
  - id: i18n
    content: Add size.* labels and task.sizeUpdated/sizeUpdateError to the English locale file with t() fallbacks everywhere
    status: completed
  - id: frontend-test
    content: Add a frontend test covering badge-vs-dropdown rendering and revert on failed save
    status: completed
isProject: false
---

# Task Size (S / M / L / XL) — Implementation Plan

## Confirmed Facts

Verified in [docs/spec.md](docs/spec.md) and the codebase.

- **No size/effort field exists.** Grep over `backend/models`, `backend/migrations`, and `frontend/entities` finds no size, effort, or t-shirt attribute.
- **`priority` is the reference implementation, but it is an INTEGER 0-2**, not a string enum: `backend/models/task.js` lines 35-43, with `Task.PRIORITY` / `getPriorityValue` helpers at lines 312-376. Size will not reuse this numeric encoding.
- **Create/update funnel through builders.** [backend/modules/tasks/core/builders.js](backend/modules/tasks/core/builders.js) `buildTaskAttributes` (create, line ~140) and `buildUpdateAttributes` (update, lines 196-201) are the single place where a field is turned into Sequelize attributes. Update already implements omit-vs-present: `body.priority !== undefined ? parsePriority(body.priority) : task.priority`. Normalization helpers live in [backend/modules/tasks/core/parsers.js](backend/modules/tasks/core/parsers.js).
- **`POST /task` has no field allowlist** — the whole `req.body` goes to `buildTaskAttributes`, so a new field is picked up only by adding it to the builder.
- **Write permission is already enforced on update.** `PATCH /task/:uid` is guarded by `requireTaskWriteAccess` ([backend/modules/tasks/middleware/access.js](backend/modules/tasks/middleware/access.js)), which resolves `rw` via [backend/services/permissionsService.js](backend/services/permissionsService.js) `getAccess` (owner, inherited project access, or explicit `permissions` row). No size-specific permission work is needed server-side.
- **Timeline events come from a hardcoded allowlist.** [backend/modules/tasks/utils/logging.js](backend/modules/tasks/utils/logging.js) lines 29-42 list the fields that produce `TaskEvent` rows. Omitting size from that list satisfies AC-16 by construction.
- **Migrations use `safeAddColumns`** from `backend/utils/migration-utils.js`; see [backend/migrations/20251124000001-add-defer-until-to-tasks.js](backend/migrations/20251124000001-add-defer-until-to-tasks.js). There is no `backend/db/` schema file; models plus migrations are the source of truth, and tests use `sequelize.sync({ force: true })` (`backend/tests/helpers/setup.js`).
- **Virtual recurring occurrences clone the whole template.** `expandRecurringTasks` in [backend/modules/tasks/routes.js](backend/modules/tasks/routes.js) lines 190-199 spreads `task.toJSON()` into each occurrence, so a new field would be inherited from the template. This must be explicitly cleared to satisfy AC-13.
- **Template field changes can destroy future occurrences.** `handleRecurrenceUpdate` in [backend/modules/tasks/operations/recurring.js](backend/modules/tasks/operations/recurring.js) lines 20-28 deletes future instances when `name`, `project_id`, `priority`, or `note` change. Size must stay out of that list (AC-14).
- **`TaskItem` is shared by list, Kanban, and Eisenhower.** [frontend/components/Task/TaskItem.tsx](frontend/components/Task/TaskItem.tsx) is rendered by `TaskList.tsx` / `GroupedTaskList.tsx` (lists), `KanbanBoard.tsx` line 396 (`isKanbanView={true}`), and `EisenhowerMatrix.tsx` line 310 (no flag). Search does **not** use it — `UniversalSearch/SearchResults.tsx` renders its own rows.
- **`onTaskUpdate` is a whole-task PATCH.** Every host page (`Tasks.tsx` line 380, `KanbanBoard.tsx` line 201, `ViewDetail.tsx` line 499, `TagDetails.tsx` line 292, `ProjectDetails.tsx` line 312) does `body: JSON.stringify(updatedTask)`, and `AreaDetails.tsx` line 151 does not PATCH at all. Row-level size saves must not go through this callback.
- **Details priority editing pattern.** `TaskDetailsHeader` renders a custom button-plus-menu dropdown; `handlePriorityUpdate` in [frontend/components/Task/TaskDetails.tsx](frontend/components/Task/TaskDetails.tsx) lines 1188-1208 does PATCH, then `fetchTaskByUid`, then `tasksStore.updateTaskInStore`, then a success/error toast via `Shared/ToastContext`.
- **There is no assembled full New Task form.** `frontend/components/Task/TaskForm/*` section components exist, but `TaskPrioritySection.tsx` and `TaskSectionToggle.tsx` have no importers. All create paths post name-only.
- **The frontend has no per-task access level.** `serializeTask` ([backend/modules/tasks/core/serializers.js](backend/modules/tasks/core/serializers.js)) returns no permission data, and `Task.ts` has no permission field. The existing `canEdit` prop on `TaskRecurrenceCard` is about recurrence, not permissions.
- **i18n** lives in `public/locales/<lng>/translation.json` (25 locales, listed in `frontend/i18n.ts`), loaded over HTTP, with an English default string passed as the second argument to `t()`. Priority labels are under the `priority.*` key block.

## Assumptions

- **Storage encoding is the literal string.** A nullable `tasks.size` column holding `'S' | 'M' | 'L' | 'XL'`, `NULL` meaning unset. Modeled as `DataTypes.STRING` with an `isIn` validator rather than `DataTypes.ENUM`, because SQLite ENUM columns are painful to alter later; the authoritative rejection happens at the route layer so the error is a clean 400 rather than a Sequelize validation error.
- **Only `null` clears.** Omitting the key is no-change on update; explicit `null` clears; `''` and any other value are invalid and rejected. Values are accepted case-insensitively and normalized to uppercase.
- **Per the decisions taken during planning:**
  - Create-with-size ships at the API level plus an unmounted `TaskSizeSection` under `TaskForm/`, mirroring the existing unmounted `TaskPrioritySection`. AC-8's UI half is not verifiable in v1 because no full New Task form is mounted.
  - Read-only gating uses a new `can_edit` boolean on task API responses, computed from ownership / project access / task permission and batched to avoid N+1.
- **`can_edit` is opt-in per endpoint.** The frontend treats `can_edit === false` as read-only; an absent `can_edit` means "assume editable, let the API reject", which preserves today's behavior for endpoints we do not wire (search, MCP, CalDAV).
- **Row-level size saves are self-contained.** The size control in `TaskItem` PATCHes only `{ size }` through `tasksService.updateTask` and updates the Zustand store directly, bypassing `onTaskUpdate`. This is required for AC-4 and AC-6 and follows the direct-fetch precedent already inside `TaskItem` (lines 379-385).
- **Host pages keeping local `tasks` arrays may hold a stale size for a row until their next fetch.** The row's own optimistic state keeps the visible value correct, and the store update covers in-app navigation to details. This is the same class of staleness the spec already accepts.
- No new translations are commissioned; non-English locales fall back to the English default strings until the existing `linguaisync` flow runs.

## Files / Modules Involved

**Backend — new**
- A migration `backend/migrations/<timestamp>-add-size-to-tasks.js`

**Backend — modified**
- [backend/models/task.js](backend/models/task.js) — column definition and a `Task.SIZES` constant
- [backend/modules/tasks/core/parsers.js](backend/modules/tasks/core/parsers.js) — `parseSize` / validity check
- [backend/modules/tasks/core/builders.js](backend/modules/tasks/core/builders.js) — create and update attribute mapping
- [backend/modules/tasks/routes.js](backend/modules/tasks/routes.js) — 400 on invalid size in `POST /task` and `PATCH /task/:uid`; clear size on virtual occurrences in `expandRecurringTasks`
- [backend/modules/tasks/core/serializers.js](backend/modules/tasks/core/serializers.js) — `can_edit`
- [backend/services/permissionsService.js](backend/services/permissionsService.js) — batched editability resolver
- [backend/modules/tasks/operations/subtasks.js](backend/modules/tasks/operations/subtasks.js) — size on subtask create/update
- [backend/modules/tasks/operations/list.js](backend/modules/tasks/operations/list.js), [backend/modules/tasks/queries/metrics-computation.js](backend/modules/tasks/queries/metrics-computation.js) — pass the resolver into serialization
- [backend/docs/swagger/tasks.js](backend/docs/swagger/tasks.js) — schema documentation

**Frontend — new**
- `frontend/components/Shared/SizeDropdown.tsx` — editable control, modeled on [frontend/components/Shared/PriorityDropdown.tsx](frontend/components/Shared/PriorityDropdown.tsx)
- `frontend/components/Shared/SizeBadge.tsx` — non-interactive label, renders nothing when unset
- `frontend/components/Task/TaskForm/TaskSizeSection.tsx` — form section for a future full create form

**Frontend — modified**
- [frontend/entities/Task.ts](frontend/entities/Task.ts) — `TaskSize` type, `size`, `can_edit`
- [frontend/components/Task/TaskItem.tsx](frontend/components/Task/TaskItem.tsx) and [frontend/components/Task/TaskHeader.tsx](frontend/components/Task/TaskHeader.tsx) — render dropdown or badge, own the save
- [frontend/components/Task/TaskList.tsx](frontend/components/Task/TaskList.tsx), [frontend/components/Task/GroupedTaskList.tsx](frontend/components/Task/GroupedTaskList.tsx) — opt in to editable size
- [frontend/components/Task/TaskDetails.tsx](frontend/components/Task/TaskDetails.tsx) and [frontend/components/Task/TaskDetails/TaskDetailsHeader.tsx](frontend/components/Task/TaskDetails/TaskDetailsHeader.tsx) — details control and save handler
- [frontend/components/UniversalSearch/SearchResults.tsx](frontend/components/UniversalSearch/SearchResults.tsx) — display-only badge
- [public/locales/en/translation.json](public/locales/en/translation.json) — `size.*` labels and `task.sizeUpdated` / `task.sizeUpdateError`

**Tests**
- `backend/tests/unit/models/task.test.js`, `backend/tests/integration/tasks.test.js`, `backend/tests/integration/subtasks.test.js`, `backend/tests/integration/permissions-tasks.test.js`
- A new frontend test under `frontend/components/Shared/__tests__/` or alongside `TaskItem`

## Implementation Plan

Steps are ordered so each one leaves the app working. Backend lands first and is independently verifiable by API check.

### 1. Persist the column
Add the migration and the model field. The migration adds a nullable `size` column to `tasks` via `safeAddColumns` with a matching `down`; no index, since filtering and sorting by size are out of scope. Add the field to `backend/models/task.js` with `allowNull: true`, `defaultValue: null`, and an `isIn` validator, plus a `Task.SIZES` constant so the allowed set has one definition. Existing rows get `NULL`, which is AC-18.

### 2. Normalize and validate size at the API boundary
Add a size helper to `parsers.js` that distinguishes three outcomes: valid value (normalized to uppercase), explicit clear (`null`), and invalid. Wire it into `builders.js` so create maps omitted size to `null` and update uses the `!== undefined ? parsed : task.size` pattern already used for priority. Then, in `routes.js`, reject invalid size with a 400 and a localizable error message **before** any write, in both `POST /task` and `PATCH /task/:uid`, so a rejected update leaves the persisted value untouched. This covers AC-3, AC-4, AC-12, and AC-17.

Deliberately **do not** add `size` to the `fields` array in `utils/logging.js` (AC-16) or to the `templateFieldsChanged` array in `operations/recurring.js` (AC-14).

### 3. Keep recurring occurrences unset
In `expandRecurringTasks`, set `size: null` on each generated virtual occurrence object so it does not inherit the template's size. Because occurrences are per-entity rows (or virtual objects), editing one has no effect on siblings or the template. This is AC-13.

### 4. Support size on subtasks
Mirror the priority handling in `operations/subtasks.js` so subtask create and update accept and persist size independently of the parent. No roll-up or inheritance. This is AC-9.

### 5. Expose edit permission on task reads
Add a batched editability resolver to `permissionsService.js`: given a user, it performs a fixed small number of queries (admin check, the user's task-level permission rows, the user's project-level permission rows, and the ids of projects those map to) and returns a predicate that decides editability for any task in memory. Then have `serializeTask` / `serializeTasks` accept the resolver through their existing `options` argument and emit `can_edit`.

Wire the resolver at the endpoints backing size-editable surfaces: the tasks list (`routes.js` line ~331 through `operations/list.js`), the single-task read, the create and update responses, subtask serialization, and `metrics-computation.js` (which feeds the Today view). Leave search, MCP, and CalDAV serialization untouched, so they simply omit `can_edit`.

The point of the batching is to avoid calling `getAccess` per task, which issues several queries each.

### 6. Document and test the API
Update the Swagger task schema with the size enum and nullability, then add backend tests following the existing style: model-level validation and default in `tests/unit/models/task.test.js`, and create/update/clear/omit/invalid plus the read-only rejection path in `tests/integration/tasks.test.js` and `tests/integration/permissions-tasks.test.js`. Assert that an update carrying only size leaves priority and other fields unchanged (AC-4, AC-6) and that a rejected update leaves the stored size unchanged (AC-17).

### 7. Type the field on the client
Add `export type TaskSize = 'S' | 'M' | 'L' | 'XL' | null;`, plus `size?: TaskSize` and `can_edit?: boolean`, to `frontend/entities/Task.ts`. Unlike `priority`, there is no legacy numeric representation to tolerate.

### 8. Build the two presentation primitives
`SizeBadge` renders the localized label as non-interactive text and renders nothing when size is unset, which is the spec's "omit when unset on dense surfaces" rule.

`SizeDropdown` follows `PriorityDropdown.tsx`: a trigger button plus a menu with `None`, `S`, `M`, `L`, `XL`. It must be keyboard operable with an accessible name and a muted placeholder when unset (AC-19). Give it a `disabled` state that falls back to badge-like rendering, and a `data-testid` for tests.

### 9. Add size to list rows
In `TaskItem` / `TaskHeader`, render `SizeDropdown` when size editing is enabled and `SizeBadge` otherwise.

Gate on two things: a new `isSizeEditable` prop that **defaults to `false`**, opted into only from `TaskList.tsx` and `GroupedTaskList.tsx`; and `task.can_edit !== false`. Defaulting to `false` means Kanban and Eisenhower — which render `TaskItem` directly — get the badge automatically and can never expose an editable control by accident, which is most of AC-10 and AC-7.

The save lives in the row, not in `onTaskUpdate`: call `updateTask(task.uid, { size })` from `frontend/utils/tasksService.ts`, hold an optimistic local value so the row updates immediately, call `tasksStore.updateTaskInStore` with the response so details sees the new value on in-app navigation, and on failure show an error toast and restore the previous value. This is AC-1, AC-5, and AC-11. Because the PATCH body carries only `size`, priority and every other field are untouched (AC-4, AC-6).

### 10. Add size to task details
Add a size control to `TaskDetailsHeader` beside the existing priority dropdown, and a `handleSizeUpdate` in `TaskDetails.tsx` mirroring `handlePriorityUpdate` — PATCH, `fetchTaskByUid`, `updateTaskInStore`, toast — but **without** bumping `setTimelineRefreshKey`, since size produces no events. Hide or disable the control when `task.can_edit === false`.

Because the displayed value derives from the store and the store only changes on success, a failed save leaves the last saved size showing, satisfying AC-11 without extra revert logic. Completed and archived tasks are not special-cased, so they stay editable (AC-15). This is AC-2 and AC-3.

### 11. Add the display-only badge to search
Render `SizeBadge` in `UniversalSearch/SearchResults.tsx` for task results. Combined with step 9's default, this completes AC-10 across all three display-only surfaces.

### 12. Add the form section for future create UI
Add `TaskForm/TaskSizeSection.tsx` wrapping `SizeDropdown`, matching the shape and props of the existing `TaskPrioritySection.tsx`. It stays unmounted, like its priority counterpart, so create-with-size is exercised through the API until a full New Task form exists.

### 13. Localize
Add a `size` key block (`none`, `s`, `m`, `l`, `xl`, and an `ariaLabel`) and `task.sizeUpdated` / `task.sizeUpdateError` to `public/locales/en/translation.json`. Every `t()` call passes the English default as a fallback, so the other 24 locales degrade to English rather than showing raw keys.

### 14. Frontend test
Add one focused test covering the size control: it renders a badge and no dropdown when not editable, renders a dropdown when editable, and reverts the displayed value when the save rejects. Follow the `react-i18next` mocking style in `frontend/components/Task/TaskDetails/__tests__/TaskContentCard.test.tsx`.

## Risks

- **`can_edit` is the largest new surface.** It touches `permissionsService`, the serializers, and several list endpoints, and a mistake makes tasks look read-only that are not (or vice versa). Mitigation: the predicate mirrors `getAccess`'s existing precedence exactly (admin, owner, inherited project access, explicit task permission), it is additive to the response, and the frontend only ever treats an explicit `false` as read-only. The backend remains the authority.
- **Per-request query cost on list endpoints.** A naive implementation would call `getAccess` per task and multiply queries on large lists. The batched resolver in step 5 is not optional.
- **`expandRecurringTasks` clones the full template JSON.** Any future task field added without clearing it there will silently leak from templates to occurrences. Step 3 fixes it for size but the underlying pattern remains a trap.
- **Whole-task PATCH from host pages is a pre-existing hazard.** `Tasks.tsx`, `KanbanBoard.tsx`, and friends PATCH the entire task object. Once tasks carry a size, a whole-task PATCH will echo it back; that is harmless for size but means AC-4's "other fields unchanged" only holds for the minimal PATCH our controls issue. Related pre-existing bug, not fixed here: `logging.js` compares raw `req.body` against DB values, so a whole-task PATCH sending `priority: 'high'` against a stored `2` logs a spurious `priority_changed` event.
- **Row density.** List rows are already crowded and use a `pr-56` reservation for right-side controls on desktop, plus a separate mobile layout. Fitting a size control needs care in both, and some priority affordances in `TaskHeader` are currently inside `className="hidden"` wrappers.
- **Migration drift.** `tasks.priority` has no migration in this repo — it predates the migration history. Tests build the schema with `sync()`, so a model/migration mismatch would not be caught by tests. The migration must be verified against a real SQLite database.
- **`DataTypes.STRING` plus `isIn` is looser than a DB constraint.** Writes bypassing the route layer (MCP, CalDAV, seeders) could in principle store an out-of-range value. Accepted, given route-level validation is the contract the spec defines.

## Out Of Scope

Per the spec, plus two items settled during planning.

- Filter, sort, group, search, or saved views by size, and any capacity/velocity/totals
- Size in quick capture (`Inbox/QuickCaptureInput.tsx`) and in the name-only inline create paths
- Building a full New Task form; only the unmounted `TaskSizeSection` ships, so AC-8's UI assertion is deferred
- Editable size on Kanban, Eisenhower, or search
- Live multi-tab or multi-user sync; other tabs stay stale until refresh
- Timeline/activity events for size, and any hour-range definition of S-XL
- Parent/subtask inheritance or roll-up, and copying template size onto new occurrences
- Size in the MCP tools, CalDAV import/export, and the Metrics surfaces
- Commissioning non-English translations
- Fixing the pre-existing spurious `priority_changed` event on whole-task PATCH

## Verification

Presented as a list rather than a table because tables do not render in plan files; each entry carries the same three fields.

- **AC-1** — Edit-permission user sets size to S/M/L/XL from a list-row dropdown; after full reload, size is still that value. **Verifiable By:** Manual Test, UI Check
- **AC-2** — Edit-permission user sets size from task details; after full reload, size is still that value. **Verifiable By:** Manual Test, UI Check
- **AC-3** — Selecting None on list or details results in unset (null/absent) after reload. **Verifiable By:** Manual Test, UI Check, API Check (integration test asserting `size: null` on a subsequent GET)
- **AC-4** — Create or update with size omitted succeeds; size stays unset; other fields unchanged on update. **Verifiable By:** Automated Test (backend integration, asserting priority/name/due_date unchanged), API Check
- **AC-5** — Change size on a list row, navigate in-app to details, see the new size; and the reverse path. **Verifiable By:** Manual Test, Integration Test (store update from the row save feeding the details selector)
- **AC-6** — Changing size leaves priority unchanged and vice versa. **Verifiable By:** Automated Test, API Check, Manual Test
- **AC-7** — RO user sees size when set, has no enabled edit control, and an RO API update is rejected with the stored size unchanged. **Verifiable By:** Automated Test (`permissions-tasks.test.js`), API Check, UI Check, Manual Test with a shared read-only project
- **AC-8** — Full New Task form: omit size to create unset, choose a size to create with it. **Verifiable By:** API Check and Automated Test for the create semantics. The UI half is **deferred**: no full New Task form is mounted in this codebase, so it cannot be verified in v1.
- **AC-9** — Subtask size can differ from its parent and changing one does not change the other. **Verifiable By:** Automated Test (`subtasks.test.js`), API Check, Manual Test
- **AC-10** — Kanban, Eisenhower, and search show a non-interactive label when set, omit size UI when unset, and offer no dropdown or successful mutation. **Verifiable By:** UI Check, Manual Test, plus Automated Test that `TaskItem` renders a badge and no dropdown when `isSizeEditable` is unset
- **AC-11** — Failed size update on list or details shows an error toast and reverts the control. **Verifiable By:** Automated Test (frontend, mocked rejecting PATCH), Manual Test with the network offline, UI Check
- **AC-12** — Create with an unsupported size fails with validation feedback and no task is created. **Verifiable By:** Automated Test, API Check
- **AC-13** — A new recurring occurrence starts unset even when the template has a size, and editing one occurrence does not affect another or the template. **Verifiable By:** Integration Test (asserting `size: null` on expanded occurrences), Manual Test
- **AC-14** — Editing template size does not change existing occurrences. **Verifiable By:** Integration Test (asserting size is absent from `templateFieldsChanged` and that future instances survive a size-only PATCH), Manual Test
- **AC-15** — Completed and archived tasks remain size-editable for edit-permission users. **Verifiable By:** Manual Test, UI Check
- **AC-16** — After size changes, the task timeline shows no size-related event types. **Verifiable By:** Automated Test (`GET /api/task/:uid/timeline` after a size-only PATCH), API Check, Manual Test
- **AC-17** — Create/update with an unsupported value is rejected and the previously saved size is unchanged on update. **Verifiable By:** Automated Test, API Check
- **AC-18** — Pre-feature tasks appear with unset size. **Verifiable By:** Manual Test against a pre-migration database, API Check
- **AC-19** — The size dropdown is keyboard operable with an accessible name, and None plus S/M/L/XL use localized strings. **Verifiable By:** Manual Test (Tab/Enter/Escape/arrow keys, screen reader name), UI Check, Automated Test asserting the accessible name
