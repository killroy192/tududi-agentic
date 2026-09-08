# Implementation Plan: Task Size (S / M / L / XL)

Derived from [`docs/task-size-spec.md`](./task-size-spec.md). The specification is approved; this plan translates it into dependency-ordered work grounded in the current codebase.

One open question from the specification was resolved before planning: the spec's third placement (a "full task form" at creation) **does not exist in this codebase**. Task creation is either the name-only quick-add input (`NewTask.tsx`, which has no priority field) or the sidebar "+" which creates a stub task and navigates straight to task details. The decision taken is to **treat task details as the creation surface**, giving the size control two placements rather than three.

---

## Confirmed Facts

### Backend data model

- `priority` is `INTEGER, allowNull: true, defaultValue: 0, validate: {min:0, max:2}` at `backend/models/task.js:35–43`; `status` similarly at `:44–52`. Named constants at `:312–326`, string↔int converters `getPriorityValue`/`getPriorityName` at `:353–394`. There is no `toJSON` override.
- `getPriorityValue` coerces unknown strings to `0` (`task.js:371–376`), and `parsePriority` in `backend/modules/tasks/core/parsers.js:3–8` passes non-strings through untouched. This is the silent-coercion behaviour the spec forbids for size.
- The serializer spreads `task.toJSON()` (`backend/modules/tasks/core/serializers.js:29`), so any new column is returned as its stored integer with no extra work.

### Backend write path

- Create maps fields in `buildTaskAttributes` (`core/builders.js:127–182`, priority at `:142`); update maps in `buildUpdateAttributes` (`:184–276`, priority at `:198–201`). Unnamed fields are silently discarded — size must be added to both or it disappears.
- Subtask creation has its own narrower allowlist at `operations/subtasks.js:62–79`.
- `PATCH /api/task/:uid` is guarded by `requireTaskWriteAccess` (`modules/tasks/routes.js:559`, defined `middleware/access.js:12–19`), returning 403 `{error: 'Forbidden'}`. No new authorization surface is needed.
- Error responses are flat: `{error, details: []}` (`routes.js:527–532`, `:905–910`). Nothing today names the offending field.

### Backend timeline — two gaps the spec understates

- `TaskEvent.event_type` has an `isIn` allowlist (`backend/models/task_event.js:31–61`) that does **not** contain `size_changed`, and `field_name` has an allowlist (`:94–117`) that does **not** contain `size`. The spec says "no new event-type code is expected," but the generic derivation `${fieldName}_changed` will produce a value the model rejects. Both allowlists must be extended.
- Worse, this failure is invisible: `logTaskChanges` wraps all timeline writes in a swallowing catch (`modules/tasks/utils/logging.js:108–110`). A missing enum entry means size changes persist correctly but never appear in the timeline, with only a log line.
- `captureOldValues` (`utils/logging.js:4–24`) and the change-detection field list (`:29–42`) are both explicit and omit size.
- The change check is `reqBody[field] !== oldValues[field]` (`:44–54`) — raw inbound compared against stored, no type normalisation — and it records the **raw** inbound value as `newValue` (`:50–52`). Confirms the spec's warning.
- `createValueObject` discards falsy values (`taskEventService.js:4–5`), and the model's `old_value`/`new_value` setters gate on truthiness a second time (`task_event.js:70–74`, `:84–88`). With `S=1`, no legitimate size is lost — but **unset is still recorded as `null`**, which AC-17 has to account for.
- `logPriorityChange` (`taskEventService.js:94–110`) is exported at `:477` with zero call sites, as the spec says.

### Backend recurrence

- The template-change set is `['name','project_id','priority','note']` at `operations/recurring.js:20–28`; matching it destroys future instances at `:53–64`. Size must not be added.

### Backend migrations and tests

- Migrations are Umzug, run via `backend/scripts/db-migrate.js:22–28`; naming is `YYYYMMDDHHMMSS-slug.js`. Idempotency helpers exist in `backend/utils/migration-utils.js` (`safeAddColumns` at `:3–30`); the canonical add-column example is `migrations/20260602000001-add-reminder-at-to-tasks.js:4–12`.
- **The backend test harness builds its schema with `sequelize.sync({force: true})`, not migrations** (`backend/tests/helpers/setup.js:5–18`). There is no existing way to test a migration, so AC-2 needs new test infrastructure.

### Frontend list row

- The shared row is `TaskItem.tsx` (card shell, priority left-border at `:28–50`) wrapping `TaskHeader.tsx` (row content).
- The `role="button"` wrapper at `TaskHeader.tsx:177–194` navigates on **both** Enter and Space, with `preventDefault` + `stopPropagation`.
- Desktop reserves exactly 224px via `pr-56` (`TaskHeader.tsx:197–198`); the status control is absolutely positioned into it at `:417–428`. The desktop metadata line uses `whitespace-nowrap overflow-x-auto` (`:301`). Mobile is a separate tree at `:432–586`, with the status control stacked below metadata at `:572–583`.
- `TaskStatusControl.tsx` stops click propagation on every button (`:145–147`, `:164–186`) but has **no `onKeyDown` handlers at all**.
- On status change it sends nearly the whole task — spread minus `subtasks`, with `name` overridden (`TaskStatusControl.tsx:171–185`) — up to the parent's `onTaskUpdate`.
- Every list parent (`Tasks.tsx:380–419`, `ProjectTasksSection`, `TagDetails`, `ViewDetail`, `KanbanBoard`, `EisenhowerMatrix`) PATCHes the whole task object. `AreaDetails.tsx:151–154` makes **no API call at all** — it only mutates local state and the store.
- `tasksService.updateTask(uid, taskData: Partial<Task>)` (`frontend/utils/tasksService.ts:91–114`) already accepts a partial body, so a field-scoped request needs no new client function.
- `Tasks.tsx:297–310` refetches on every `location` change, which is what makes AC-9's details→list direction work without a reload.

### Frontend details and creation

- The details priority dropdown is hand-written in `TaskDetails/TaskDetailsHeader.tsx:326–489`, with helpers at `:197–270` and **no keyboard handling whatsoever**.
- Selection runs the chain in `TaskDetails.tsx:1248–1268`: `updateTask` → `fetchTaskByUid` → `updateTaskInStore` → bump `timelineRefreshKey` → toast. Not optimistic.
- **There is no task creation form.** `NewTask.tsx` is a name-only input; `Layout.tsx:100–124` creates a stub task and navigates to details. `Shared/PriorityDropdown.tsx` and `TaskForm/TaskPrioritySection.tsx` are dead code for tasks (`PriorityDropdown` is used only by `ProjectModal.tsx:660–682`).
- `TaskTimeline.tsx:80–173` renders field changes; the priority case at `:95–102` falls back to a generic "Priority changed" label when either side is `undefined`.
- `frontend/utils/duplicateTask.ts` is an explicit allowlist (priority at `:35–37`) with tests at `duplicateTask.test.ts`. **It is committed** as of `236d4cd`, resolving the spec's assumption 11.
- `frontend/entities/Task.ts:6–69` types `priority?: PriorityType | number`.

### i18n and tests

- 25 locale directories under `public/locales/`, each with `translation.json`. Priority keys at `en/translation.json:731–735`. **No locale key-parity test exists.**
- Frontend Jest is `ts-jest` + jsdom (`jest.config.js`), with only 4 test files today; tests mock `react-i18next` to return the inline fallback. E2E is Playwright in `/e2e`, seeding tasks via `context.request.post('/api/task')`.

---

## Assumptions

1. **Task details is the creation surface.** Creating a task navigates immediately to details, so AC-13 is satisfied there. The control has two placements — list row and details — not three. The orphaned `TaskForm`/`PriorityDropdown` components stay untouched.
2. **The size chip issues its own field-scoped request** via `tasksService.updateTask(uid, {size})` rather than routing through each parent's `onTaskUpdate`. This is the only way to satisfy AC-8 without rewriting six whole-task PATCH handlers, and it incidentally sidesteps the `AreaDetails` no-API bug and the recurrence trap.
3. **The client always sends the integer form**, never the string. The server accepts both per the spec, but sending integers keeps the untyped change-detection comparison at `logging.js:44–54` honest without reworking it.
4. **Unset is rendered as "None" in the timeline** by handling a missing side in the `size_changed` case, rather than changing the shared `createValueObject` encoder. Changing the encoder would alter every existing event type's behaviour; for size specifically, a null side unambiguously means unset because we only ever log size alongside a size change.
5. **Sequelize skips `min`/`max` validators when a nullable column's value is `null`.** Standard behaviour, but step 2 verifies it rather than assuming.
6. **Chip placement is the right-edge cluster next to the status control**, not the metadata line — the spec forbids relying on the metadata line's overflow-scroll region. Whether 224px absorbs it or `pr-56` must grow is what step 1 settles.
7. **Kanban, Eisenhower, subtask rows, and search results are excluded by an explicit prop**, since `TaskItem` is shared with them and would otherwise inherit the chip.
8. **"Twenty-five locale files" means English is authored and the other 24 receive the same key set**, seeded however the existing `linguaisync.config.js` workflow does it. Parity is what AC-27 asserts, not translation quality.

---

## Files / Modules Involved

### Backend — modified

| Area | Path |
| --- | --- |
| Model column, constants, converters | `backend/models/task.js` |
| Timeline event/field allowlists | `backend/models/task_event.js` |
| Size parsing and validation | `backend/modules/tasks/core/parsers.js` |
| Create/update field mapping | `backend/modules/tasks/core/builders.js` |
| Validation error shape | `backend/modules/tasks/routes.js` |
| Old-value capture, change detection | `backend/modules/tasks/utils/logging.js` |
| API schema | `backend/config/swagger.js`, `backend/docs/swagger/tasks.js` |

**Backend — added**: one Umzug migration in `backend/migrations/`; a migration test plus its harness; route/model/timeline tests under `backend/tests/`.

**Backend — deliberately untouched**: `operations/recurring.js`, `operations/subtasks.js`, `queries/query-builders.js`, `middleware/access.js`, `services/permissionsService.js`.

### Frontend — modified

| Area | Path |
| --- | --- |
| Task type | `frontend/entities/Task.ts` |
| List row markup, both trees | `frontend/components/Task/TaskHeader.tsx` |
| Row prop plumbing | `frontend/components/Task/TaskItem.tsx`, `TaskList.tsx`, `GroupedTaskList.tsx` |
| Details placement | `frontend/components/Task/TaskDetails/TaskDetailsHeader.tsx`, `TaskDetails.tsx` |
| Timeline rendering | `frontend/components/Task/TaskTimeline.tsx` |
| Duplication allowlist | `frontend/utils/duplicateTask.ts` |

**Frontend — added**: a shared size control component with chip and field variants, a size value/label helper module, component tests, and a locale-parity test.

**i18n**: `public/locales/*/translation.json` × 25.

**E2E**: one new spec in `e2e/tests/`.

---

## Implementation Plan

### Phase 0 — Falsify the layout assumption first

**1. Layout spike.** Hard-code a static `L` chip into both the desktop and mobile render trees of `TaskHeader.tsx` and load a task carrying a project, three tags, a due date, and a recurrence indicator at 320px, 375px, 768px, and 1440px. The spec names this as the cheapest thing to falsify before any backend work, and it is the only step that can invalidate the chosen placement. Record whether the 224px reserved region absorbs the chip or `pr-56` must grow, then revert. If row height changes at any width, resolve placement before continuing — everything downstream assumes a home for the chip exists.

### Phase 1 — Persistence

**2. Add the `size` column to the Task model.** Nullable integer, validated to 1–4, with **no `defaultValue`**. Add a `Task.SIZE` constant map and `getSizeName`/`getSizeValue` converters alongside the priority ones. The converters must differ from `getPriorityValue` in one critical way: an unrecognised input returns a sentinel meaning "invalid," never a default value. Copying priority's `defaultValue: 0` would backfill every existing task, and copying its coercion would violate AC-16. Confirm here that Sequelize skips the range validators when the value is null.

**3. Add the migration.** Use `safeAddColumns` from `migration-utils.js` following the `add-reminder-at-to-tasks` pattern: nullable, no default, guarded by a column-existence check so re-running is a no-op. Existing rows must be left as SQL NULL.

**4. Build a migration test harness.** The existing setup syncs from models, so a new integration test must create a temporary SQLite database, seed task rows, run Umzug up, assert every seeded row's size is NULL, then run up again and assert no error and no change. This is new infrastructure and is why it gets its own step — AC-2 cannot be verified otherwise.

### Phase 2 — API write path

**5. Add a `parseSize` parser that rejects rather than coerces.** It must distinguish three inputs: `undefined` means "field omitted, leave unchanged"; `null` (or an explicit none marker) means "clear to unset"; anything else is normalised from either the string or the integer form. Out-of-set values raise a distinguishable validation error instead of falling back. This distinction between omitted and cleared is what AC-15 and AC-10 turn on.

**6. Wire size into both field builders.** Add it to `buildTaskAttributes` for create and `buildUpdateAttributes` for update, using the omitted-versus-cleared semantics from step 5. Without this the field is silently discarded. Do **not** add it to the subtask allowlist — subtask size has no UI and is out of scope.

**7. Surface a field-named validation error.** Catch the invalid-size error in the create and update routes and return a 400 that names `size` as the offending field. This deliberately diverges from the flat message shape used elsewhere; scope the change to size rather than reworking the global error handler.

### Phase 3 — Activity timeline

**8. Extend the `TaskEvent` allowlists.** Add `size_changed` to `event_type` and `size` to `field_name` in `backend/models/task_event.js`. This is the highest-risk omission in the whole feature: without it the generic derivation produces a rejected value, the swallowing wrapper hides the rejection, and size changes persist while the timeline stays silent. Everything else in this phase depends on it.

**9. Track size in change detection.** Add size to `captureOldValues` and to the field list in `logTaskChanges`, **normalising the inbound value before comparing it** to the stored integer. The existing raw comparison would otherwise log a phantom event whenever a client sends the string form, and would record the un-normalised string as the new value. This is the backend half of AC-11.

**10. Render size transitions in the timeline UI.** Add a `size_changed` case to `TaskTimeline.tsx` that renders both sides, treating a missing side as "None" instead of falling through to a generic label. Note the shared `getPriorityLabel` helper in `taskEventService.ts` is hardcoded English; the size equivalent should use the i18n keys from phase 7.

### Phase 4 — Verification-only backend work

**11. Verify authorization and recurrence by test, not by code.** Two assertions with no production change: a read-only user's size update is rejected by the existing `requireTaskWriteAccess` guard with the stored value unchanged (AC-14), and setting size on a recurring parent leaves its future instances present with unchanged ids, due dates, and subtasks (AC-19). The second is a regression guard against anyone later adding size to the template field set.

**12. Update the OpenAPI schema.** Document size on the Task schema and on the create and update bodies, with its permitted values and its **actual** wire type (integer). Add a contract check that the documented type matches what the read endpoint returns. Scope this to size only — the pre-existing inaccuracies in the status and priority declarations stay as they are.

### Phase 5 — Shared frontend control

**13. Add the size type and value helpers.** Extend `frontend/entities/Task.ts` with the optional attribute, mirroring how priority accepts both forms. Add a helper module that maps between the wire integer and the display letter, and — critically for AC-22 — maps any unrecognised value to unset rather than throwing or rendering garbage.

**14. Build the shared size control.** One component with a compact-chip variant and a form-field variant, per the single-shared-control constraint. It owns:

- *Optimistic display* — a local value that overrides the incoming prop on selection and is reconciled when the prop catches up, reverting on failure with an error toast (AC-6, AC-7).
- *Request sequencing* — a monotonically increasing token per selection, with responses from stale tokens discarded so the last selection always wins regardless of arrival order (AC-21).
- *No-op guard* — re-selecting the current value issues no request at all (AC-11).
- *Keyboard operation* — Enter opens, arrow keys move between options, Enter selects, Escape closes; and it must `stopPropagation` on **Enter and Space keydown**, because the parent row navigates on both. The existing status control implements no keyboard guard, so there is no precedent to copy here (AC-23).
- *Accessibility* — an accessible label announcing the current value, with size conveyed by the letter rather than colour alone (AC-24).
- *Direction-logical layout* — logical inline-start/end spacing utilities, never `ml-`/`mr-`, so RTL rows position the chip consistently (AC-26).

Build this with its tests before wiring it anywhere, so the interaction contract is settled independently of either placement.

### Phase 6 — Placements

**15. Place the control on task details.** Add it to `TaskDetailsHeader.tsx` alongside the other attributes, and add a `handleSizeUpdate` to `TaskDetails.tsx`. Follow the existing priority chain (update → refetch → `updateTaskInStore` → bump the timeline refresh key → toast), but drive the visible value optimistically from the control rather than waiting for the refetch. The store update is what keeps the Today view consistent. This also covers creation, since new tasks land here.

**16. Place the chip in the list row.** Add it to both the desktop and mobile trees of `TaskHeader.tsx` in the right-edge cluster next to the status control, per the step 1 outcome. It calls `tasksService.updateTask(uid, {size})` directly — a field-scoped request, not the parent's whole-task `onTaskUpdate`. Provide an optional callback so parents holding tasks in local state can sync their arrays; parents that ignore it still display correctly because the control owns its optimistic value.

**17. Gate the chip to standard list rows only.** Thread an explicit prop through `TaskItem`, `TaskList`, and `GroupedTaskList` so Kanban cards, Eisenhower cards, and nested subtask rows do not render it. Verify search results are unaffected — `SearchResults.tsx` does not use the row component, so it should need no change.

### Phase 7 — Supporting work

**18. Add size to the duplication allowlist.** A conditional copy in `duplicateTask.ts` matching the priority block, plus a case in the existing test file. The module is committed as of `236d4cd`, so the spec's blocking assumption is resolved.

**19. Add the locale keys.** The size label, the None option, and the timeline event label across all 25 `translation.json` files, placed near the existing priority keys. Letters stay untranslated; only surrounding labels are localised.

**20. Add the locale parity test.** A Jest test that enumerates every locale directory and asserts each contains the complete size key set. This is not optional polish — every `t()` call in this codebase supplies an inline English fallback, so a missing key renders English and is invisible at runtime. This is also the first parity test in the repo, so it establishes the pattern.

**21. Add the end-to-end test.** Set a size from a list row and verify it on the details page, seeding via the API the way `today-view.spec.ts` does.

---

## Risks

**The timeline enum omission fails silently.** If step 8 is missed or incomplete, `TaskEvent` validation rejects `size_changed`, the swallowing catch at `logging.js:108–110` absorbs it, and the feature appears to work while AC-17 quietly fails. Mitigated by ordering step 8 before step 9 and asserting event creation directly rather than inferring it from a successful update.

**Copying priority's shape by reflex.** Three specific inheritances are actively harmful: `defaultValue: 0` would backfill every existing task; `getPriorityValue`'s coerce-to-default would violate AC-16; and adding size to the recurrence template list would delete future instances. All three look like consistency and are the opposite.

**The 224px right edge may not absorb the chip.** Step 1 exists to find out before anything is built on the assumption. If it fails, the fallback is widening the reserved region, which affects title truncation across every list view — a materially larger change than the rest of the frontend work.

**No migration test harness exists.** Step 4 is new infrastructure against a test setup that has only ever synced from models. If it proves disproportionate, the fallback is a documented manual procedure against a copied production-shaped database, which weakens AC-2 from automated to manual.

**Six parent components still PATCH the whole task.** The size chip bypasses them, but the status control does not. Once tasks carry a size, every status change round-trips the size value in a full-object body. This is harmless as long as the client sends integers (assumption 3) — if a string ever leaks in, the untyped comparison at `logging.js:44–54` fabricates a phantom size event on every status change.

**`AreaDetails` never calls the API.** Its `handleTaskUpdate` at `:151–154` only mutates local state, so status changes there already fail to persist. The size chip is immune because it issues its own request, but this makes the two controls behave inconsistently on that one page. Pre-existing; flagged, not fixed.

**Locale churn across 25 files.** A `linguaisync.config.js` exists but its workflow is unverified. If it cannot seed the new keys, 24 files need manual entries before AC-27 passes.

**Thin frontend test coverage.** Four test files exist today, and none render an interactive component with an API call. Steps 14 and 20 will need mocking patterns that don't yet exist in this repo.

---

## Out Of Scope

Everything the specification lists, unchanged: sorting and filtering by size including search chips and saved views; bulk editing; cross-tab or cross-device realtime sync and any push, polling, or event infrastructure; editable chips on Kanban cards, Eisenhower cards, search results, and nested subtask rows; any UI for subtask size and any rollup; propagating size to recurring instances; exposing an access-level field on the task response and any read-only-aware UI; fixing the OpenAPI status and priority inaccuracies beyond what size needs; mapping size to hours, days, points, or velocity; reporting and dashboards; MCP, CalDAV, and import/export; configurable or per-project scales; adoption analytics; backfilling existing tasks; quick-add syntax; and any change to priority.

Added from the codebase inspection:

- **Building a task creation form.** Details is the creation surface. `TaskForm/TaskPrioritySection.tsx` and `Shared/PriorityDropdown.tsx` stay dead code.
- **Fixing `AreaDetails.handleTaskUpdate`**, which persists nothing. Pre-existing, affects status not size — file separately.
- **Unifying the two priority dropdown implementations.** The spec calls them a precedent for drift, not reuse; the new control does not absorb them.
- **Adding keyboard guards to `TaskStatusControl`.** It has none, and the size control must have them, but retrofitting the status control is a separate change.
- **A backend duplication endpoint.** None exists; duplication is frontend-only.
- **Correcting the untyped change-detection comparison for other fields.** Normalisation is added for size only.
- **Filed separately per the spec:** the destructive recurrence template-change behaviour, and the access-resolution precedence bug where project-level `rw` overrides an explicit task-level `ro` share.

---

## Verification

| ID | Acceptance Criterion | Verifiable By |
| --- | --- | --- |
| AC-1 | Size can be S, M, L, XL, or unset; the API rejects every other value | **Automated Test** — model unit test for the 1–4 range and null; route integration test posting out-of-set values and asserting 400 with no persistence |
| AC-2 | Migration leaves existing rows NULL; re-running is a no-op | **Automated Test** — the step 4 harness: seed rows, run Umzug up, assert NULL, run up again, assert no error and no change |
| AC-3 | A task created without a size is unset | **Automated Test** — create-route integration test asserting the response and stored value are null; plus a model test that no column default exists |
| AC-4 | Edit-permitted user changes size from a list row without opening, navigating, reloading, or reordering | **UI Check** — manual pass across Tasks, Today, project, tag, and area views, confirming URL and list order are unchanged; backed by a component test asserting no navigation on selection |
| AC-5 | Edit-permitted user changes size from task details | **UI Check** — manual pass, plus the E2E test from step 21 |
| AC-6 | With the request delayed two seconds, the chip shows the new value within one frame, before the request settles | **Automated Test** — component test with a deferred promise, asserting the rendered value before resolution |
| AC-7 | Server error reverts the chip with a network message; permission error reverts with the permission message | **Automated Test** — component tests for a 500 and a 403, asserting reverted value and the correct toast in each case |
| AC-8 | A size change from any surface sends only the size field, and no other stored attribute changes | **API Check** — assert the intercepted request body has exactly one key from both the row and the details control; integration test comparing the full task record before and after |
| AC-9 | Details→list on return without reload, and list→details on open | **Integration Test** — the E2E test from step 21 covering both directions, asserting no full page load; relies on the confirmed refetch at `Tasks.tsx:297–310` |
| AC-10 | Size clears to unset via "None," after which the task behaves as one never sized | **UI Check** — manual clear, plus an integration test asserting the stored value is NULL and a subsequent omitting update leaves it NULL |
| AC-11 | Re-selecting the current size sends no request and creates no timeline entry | **Automated Test** — component test asserting no fetch on re-selection (client half); integration test PATCHing the identical value and asserting zero new events (server half, after step 9's normalisation) |
| AC-12 | A size-only update leaves priority identical and emits exactly one size event and no priority event | **Automated Test** — integration test asserting the stored priority and an exact event count by type |
| AC-13 | Size can be set at creation and carries into every view | **UI Check** — manual: create via the sidebar, set size on the resulting details page, confirm it in the list and on Today. Scoped to details as the creation surface |
| AC-14 | A read-only user's size change is rejected and the stored value is unchanged | **API Check** — integration test with a read-only share asserting 403 from `requireTaskWriteAccess` and an unchanged stored value |
| AC-15 | An update omitting size leaves the existing size unchanged | **API Check** — integration test PATCHing an unrelated field on a sized task |
| AC-16 | Out-of-set values are rejected with a field-named validation error, no coercion, no silent ignore, no persistence | **API Check** — integration test asserting the error names `size` and that the stored value is untouched, explicitly contrasted with priority's coercion |
| AC-17 | Every transition is recorded with both values, including unset→S, S→unset, S→XL, XL→S | **Integration Test** — four backend cases asserting the persisted event, plus a `TaskTimeline` render test confirming both sides display and unset renders as "None" rather than the generic fallback |
| AC-18 | A timeline write failure does not fail or roll back the size change | **Automated Test** — integration test forcing the event write to throw, asserting a 200 and the persisted size; guards the swallowing wrapper at `logging.js:108–110` |
| AC-19 | Setting size on a recurring parent changes only that task; future instances keep ids, due dates, and subtasks | **Integration Test** — snapshot instances before and after a size-only update and compare; regression guard on the template field set |
| AC-20 | Duplicating a task copies its size | **Automated Test** — a case in the existing `duplicateTask.test.ts` |
| AC-21 | Out-of-order responses still leave the last-selected value displayed and stored | **Automated Test** — component test resolving two deferred requests in reverse order, asserting the second selection wins |
| AC-22 | An out-of-set value in an API response renders as unset without breaking the row or page | **Automated Test** — render the row and the control with an invalid size, asserting the unset placeholder and no thrown error |
| AC-23 | Keyboard-only focus, Enter to open, arrows to move, Enter to select, URL unchanged; Space does not navigate | **Automated Test** — component test rendering the chip inside the row's `role="button"` wrapper, asserting the row's navigation handler never fires for Enter or Space while the chip is focused |
| AC-24 | Screen reader announces label and current value; size is distinguishable without colour | **Manual Test** — VoiceOver pass on both placements, plus a greyscale check; supported by an automated accessible-name assertion |
| AC-25 | At 320/375/768/1440px with a fully populated row, height is identical with and without the chip, reachable without horizontal scroll | **UI Check** — the step 1 spike measurements re-run against the finished chip at all four widths |
| AC-26 | In an RTL locale the chip is positioned consistently with other trailing elements and the letter renders unambiguously | **Manual Test** — load an RTL locale (`ar`) and inspect both trees; supported by an automated assertion that no physical-direction spacing utilities are used on the chip |
| AC-27 | An automated check asserts all 25 locale files contain the complete size key set | **Automated Test** — the step 20 parity test |
| AC-28 | Published docs describe size, its values, and its wire type; a contract test confirms the documented type matches the read endpoint | **API Check** — the step 12 contract test comparing the OpenAPI declaration against an actual response |
| AC-29 | Existing clients that neither send nor read size continue to create, read, and update unchanged | **Integration Test** — the existing task suite must pass untouched, plus an explicit test creating, reading, and updating with no size in any request or assertion |
