# Implementation Plan: Task Size (S / M / L / XL)

**Jira:** [KAN-15](https://epam-team-ai-adoption.atlassian.net/browse/KAN-15) — MK2/MK6: Task size estimate  
**Spec:** [docs/task-size-spec.md](./task-size-spec.md)

### Confirmed Facts

Facts verified from the specification and codebase.

- No effort, size, estimate, or story-point concept exists in the product today.
- Task `priority` and `status` are bounded integers with model constants and string→integer converters; API accepts string or integer and normalises inbound; responses return the stored integer via serializer spread.
- Create and update bodies are mapped through explicit builders (`buildTaskAttributes` / `buildUpdateAttributes`); unnamed fields are silently discarded. Subtask create/update uses a separate, narrower field list.
- Priority conversion silently coerces unrecognised strings to `0`; size must reject instead (spec divergence).
- Activity timeline derives event type from field name; old/new values are dropped when falsy (`value ? … : null`), so encoding must not use `0` for any size. A dedicated `logPriorityChange` helper exists with no call sites and must not be used as a template.
- Timeline writes are isolated from the update by a swallowing wrapper in logging utilities; the underlying log function can re-throw, so isolation must stay deliberate.
- Recurring template-change fields are `name`, `project_id`, `priority`, `note`; changing those deletes future instances. Size must not join that set.
- Task update is guarded by `requireTaskWriteAccess`; responses carry no access-level field. Read-only clients discover denial only after a rejected write.
- Shared list row is `TaskItem` / `TaskHeader` with separate desktop and mobile trees at `md`; only inline editor today is `TaskStatusControl`. List update paths (e.g. Tasks page) PATCH the entire task object; details priority update sends only `{ priority }`.
- List views (Tasks, project/tag/area detail, views, Kanban, Eisenhower) hold tasks in local component state; details and Today use the Zustand `tasksStore`. Cross-view consistency relies on refetch-on-navigation.
- Task details priority UI is a bespoke dropdown in `TaskDetailsHeader`; creation/priority form pieces (`PriorityDropdown` via `TaskPrioritySection`) are largely orphaned — practical “set attributes at create” path is Task Details in `isNew` mode.
- Task duplication uses an explicit allowlist in `frontend/utils/duplicateTask.ts` and is present in the tree (committed); AC-20 can depend on it.
- Twenty-five locale files live under `public/locales/<lang>/translation.json`; translation calls supply English fallbacks.
- OpenAPI Task schema already misdocuments status/priority; size docs must be accurate for size itself without a broad OpenAPI cleanup.
- Migration helpers (`safeAddColumns`) support idempotent nullable column adds; priority’s `defaultValue: 0` must not be copied for size.

### Assumptions

Technical assumptions made while planning.

1. Spec encoding is binding: persist `S=1, M=2, L=3, XL=4`, SQL `NULL` = unset; never assign `0`.
2. “Creation form” for size means the Task Details `isNew` surface (and any full create payload path that already accepts priority), not resurrecting orphaned TaskForm sections unless they become the live create UI before this work ships.
3. One shared size control with compact-chip and form-field variants covers list row, details, and create — priority’s dual implementations are a warning against reuse, not a pattern to copy.
4. List parents that currently send full-task PATCHes for status will gain a field-scoped size update path (either inside the shared control or via a dedicated callback) so size never rides a full-object update.
5. Cross-view sync for AC-9 is satisfied by existing refetch-on-navigation plus store updates on details/Today; migrating list pages onto the global store remains out of scope.
6. Subtask API builders may accept size for model consistency, but no subtask size UI is delivered.
7. Locale keys for labels/timeline/errors are added to all 25 files; letter glyphs S/M/L/XL stay untranslated.
8. Layout risk in AC-25 is validated early with a static chip in both row trees before deep frontend work proceeds.
9. Separate defect tickets remain the home for: destructive recurrence template-change behavior, project-`rw` overriding task-`ro` access precedence, and broad OpenAPI status/priority fixes.

### Files / Modules Involved

List the areas of the codebase that will likely be modified or added.

**Backend**

- `backend/models/task.js` — size field, constants, converters, validation
- `backend/migrations/` + `backend/utils/migration-utils.js` — idempotent nullable `size` column (no default)
- `backend/modules/tasks/core/builders.js` — create/update mapping
- `backend/modules/tasks/core/parsers.js` — inbound normalisation (reject, don’t coerce)
- `backend/modules/tasks/operations/subtasks.js` — optional field wire-through only
- `backend/modules/tasks/utils/logging.js` — include size in capture/log field list
- `backend/modules/tasks/taskEventService.js` — ensure size values survive value encoding; do not use dead priority helper
- `backend/modules/tasks/operations/recurring.js` — verify size is absent from template-change set
- `backend/modules/tasks/middleware/access.js` / routes — verify existing write guard covers size updates
- `backend/config/swagger.js`, `backend/docs/swagger/tasks.js` — document size accurately
- Backend tests under `backend/tests/unit/models/`, `backend/tests/unit/modules/tasks/`, `backend/tests/integration/` (tasks, permissions, recurring, timeline)

**Frontend**

- `frontend/entities/Task.ts`, `frontend/entities/TaskEvent.ts` — types and timeline event union
- New shared size control (alongside Shared components; not reusing either priority dropdown)
- `frontend/components/Task/TaskItem.tsx`, `TaskHeader.tsx` — chip placement in desktop and mobile trees; keyboard/nav guards
- `frontend/components/Task/TaskDetails.tsx`, `TaskDetails/TaskDetailsHeader.tsx` — details + create (`isNew`) placement and field-scoped update
- List/parent update handlers (`Tasks.tsx`, `TasksToday.tsx`, project/tag/area/view detail pages as needed) — field-scoped size PATCH and local/store state patch
- `frontend/utils/tasksService.ts` — Partial update already supports field-scoped PATCH
- `frontend/utils/duplicateTask.ts` (+ test) — copy size on duplicate
- `frontend/components/Task/TaskTimeline.tsx` — display size change events including unset transitions
- `public/locales/*/translation.json` — all 25 locales + automated key-presence check
- Frontend unit/component tests for control, optimistic/revert/sequencing, keyboard; e2e for list→details sync

**Explicitly not modified for feature behavior (out of scope consumers)**

- Kanban / Eisenhower card UIs (no size chip)
- Sort/filter/query builders, search chips, saved views
- MCP tools, CalDAV mappings, import/export

### Implementation Plan

Break the work into small, atomic, dependency-ordered steps. Each step should clearly describe what needs to change and why, without prescribing low-level implementation details or code.

When defining implementation steps, follow these principles:

1. Build incrementally. Start with the simplest implementation that satisfies the current objective, then iterate by adding functionality, handling edge cases, and improving robustness. Each step should leave the system in a working, testable state. This enables validating the solution in realistic conditions before adding complexity.
2. Follow a Test-Driven Development (TDD) approach whenever practical. Before each implementation step, include a testing step that defines how the expected behavior will be verified. Depending on the change, this may be a unit, integration, or end-to-end test. Implementation should follow the tests so that each increment is validated before moving to the next step. Avoid large batches of changes that cannot be verified until the end.

#### Step 0 — Layout spike (fail-fast)

- Place a non-functional letter chip into both desktop and mobile metadata trees and inspect at 320 / 375 / 768 / 1440 with crowded metadata (project, three tags, due date, recurrence).
- Confirm row height and reachability without horizontal scroll (AC-25 premise). If false, stop and revise placement before backend work.

#### Step 1 — Persistence and model contract

- **Test first:** migration leaves existing rows NULL and is re-runnable; model accepts only 1–4 / mapped strings / NULL; rejects out-of-set values without coercion; create-without-size stays unset.
- Add nullable size column with no default via idempotent migration helpers.
- Add model constants, converters, and range validation using encoding `S=1…XL=4` (no zero).

#### Step 2 — API create / update / read

- **Test first:** create/update/read round-trip for string and integer forms; omit-on-update leaves size unchanged; explicit clear to unset; invalid values return field-named validation errors; clients omitting size entirely still create/update other fields (AC-29).
- Wire size through create and update builders (and subtask builders only as needed for silent discard avoidance if bodies ever include it).
- Ensure list/detail serializers return the stored integer (or null).

#### Step 3 — Authorization verification

- **Test first:** read-only / foreign-user PATCH of size alone yields authorization rejection and unchanged stored value (AC-14).
- Confirm existing write middleware covers the update route; no new auth surface or response permission fields.

#### Step 4 — Activity timeline

- **Test first:** every transition (unset↔S, S↔XL, etc.) records previous and new values; falsy-drop does not erase legitimate sizes; timeline write failure does not roll back the size update (AC-17, AC-18).
- Include size in change-capture/log field lists; keep event derivation on the generic field-change path.
- Ensure frontend timeline can label size events (including unset).

#### Step 5 — Recurrence non-interference

- **Test first:** size-only update on a recurring parent does not delete future instances and does not alter their ids/dates/subtasks (AC-19).
- Verify size is not added to the template-change field set; document that full-object updates remain dangerous for other reasons but size UI must not send them.

#### Step 6 — OpenAPI for size

- **Test first / contract check:** documented wire type matches read responses (AC-28).
- Document size, permitted values, and integer wire type on Task schema and create/update bodies only as needed for size.

#### Step 7 — Frontend types and shared size control

- **Test first:** control renders unset placeholder and S/M/L/XL; None clears; re-selecting current value emits no change; out-of-set response values render as unset; keyboard open/move/select; colour is not the sole cue; current value announced.
- Add Task (and TaskEvent) typing for optional size.
- Implement one reusable control with compact-chip and form-field variants (labels localised; letters not).

#### Step 8 — Optimistic update, revert, and sequencing

- **Test first:** delayed response still shows new value immediately (AC-6); server/network/permission failures revert and toast appropriately (AC-7); out-of-order responses keep last selection (AC-21); request body contains only size (AC-8).
- Encapsulate field-scoped PATCH, optimistic local state, failure revert, and request sequencing in or beside the shared control so all placements share the same behavior.

#### Step 9 — List row integration

- **Test first:** mouse and keyboard interaction with the chip does not navigate or change URL; Space while focused does not navigate (AC-4, AC-23); row height/layout checks from Step 0 still hold with the live control (AC-25).
- Mount compact chip in both desktop and mobile trees outside the overflow-scroll-only reliance and outside the reserved status region as needed.
- Stop propagation / key guards so parent row `role="button"` navigation does not fire.
- Wire parents to accept field-scoped size updates into local (or store) task state without full-object PATCH.

#### Step 10 — Task details and create (`isNew`)

- **Test first / UI:** change and clear size from details (AC-5, AC-10); set size during create and see it everywhere afterward (AC-13); size change independent of priority (AC-12).
- Place form-field variant beside other attributes; apply immediately with confirmation toast consistent with sibling attributes.
- On success, refresh timeline; update store so return navigation shows the new value without full reload (AC-9 one direction).

#### Step 11 — Cross-view consistency and duplication

- **Test first:** details→list and list→details show updated size without full page reload (AC-9); duplicate copies size (AC-20).
- Rely on store update + refetch-on-navigation; add size to duplication allowlist and unit tests.

#### Step 12 — Internationalisation

- **Test first:** automated check that all 25 locale files contain the complete size key set (AC-27).
- Add keys for control labels, None, toasts/errors, and timeline event copy; keep letters untranslated.
- Spot-check RTL placement (AC-26) with logical CSS properties.

#### Step 13 — End-to-end verification

- Add Playwright coverage: set size from a standard list, open details, assert value; optionally reverse path.
- Manual pass for screen reader announcement and RTL (AC-24, AC-26) and crowded-row UI check (AC-25).

### Risks

Potential technical risks, dependencies, migrations, or compatibility concerns.

- **Row density:** adding a chip may force horizontal scroll or taller rows at narrow widths; Step 0 exists to catch this before sunk cost.
- **Full-object PATCH habit:** status and list updates still send entire tasks; if size accidentally uses that path on a recurring parent, template-change comparison quirks could cause destructive deletes. Field-scoped size requests are mandatory.
- **Falsy event logging:** any accidental `0` encoding or `|| default` on size will silently break timeline AC-17.
- **Dual state worlds:** lists vs store can show stale size until navigation; accepted by spec, but easy to “fix” by over-scoping store migration.
- **Priority coercion precedent:** implementers may copy priority converters and accidentally coerce invalid size — tests must lock reject-not-coerce.
- **Type mismatch on no-op detection:** existing change detection may compare without normalising types; re-select/no-op (AC-11) needs deliberate handling for string vs int.
- **Orphaned create UI:** if product resurrects a separate TaskForm create path mid-flight, size must be added there too or AC-13 drifts.
- **Separate known defects** (access precedence, recurrence destruction, OpenAPI drift) can confuse QA if size failures are misattributed; keep them filed and out of this change set.

### Out Of Scope

Explicitly list work that is intentionally excluded from this implementation.

- Sorting or filtering by size (including search chips and saved views)
- Bulk editing size
- Realtime sync / push / polling / websockets
- Size chips on Kanban cards, Eisenhower cards, universal search results, and nested subtask rows
- Subtask size UI and any rollup of subtask sizes
- Propagating size to recurring instances; fixing destructive template-change behavior (file separately)
- Exposing access-level on task responses or read-only-aware UI
- Fixing project-`rw` vs task-`ro` access precedence (file separately)
- Broad OpenAPI status/priority cleanup beyond size
- Mapping size to hours/days/points; reporting/dashboards/capacity
- MCP, CalDAV, import/export/backup exposure
- Configurable scales or additional size values
- Product analytics; backfilling existing tasks; quick-add text syntax
- Any change to priority appearance or behavior
- Migrating list views onto the global Zustand store

### Verification

Map each Acceptance Criterion from the specification to one or more verification activities (manual test, automated test, API check, integration test, etc.), ensuring every criterion is covered.

Present them as a table with the following columns:

ID | Acceptance Criterion | Verifiable By

| ID | Acceptance Criterion | Verifiable By |
| --- | --- | --- |
| AC-1 | A task's size can be set to S, M, L, or XL, or left unset; the API rejects every other value | Automated Test |
| AC-2 | Running the migration against a database containing existing task rows leaves every existing row's size as SQL NULL, and re-running the migration is a no-op | Automated Test |
| AC-3 | A task created without a size specified is unset | Automated Test |
| AC-4 | A user with edit permission can change a task's size from a list row without opening the task, navigating, reloading, or causing the list to reorder | UI Check |
| AC-5 | A user with edit permission can change a task's size from the task details page | UI Check |
| AC-6 | With the update request delayed by two seconds, the chip displays the newly chosen value within one render frame of selection, before the request settles | Automated Test |
| AC-7 | When the update fails with a server error the chip reverts and a network error message is shown; when it fails with a permission error the chip reverts and the permission message is shown | Automated Test |
| AC-8 | A size change from any surface sends a request containing only the size field, and no other stored task attribute changes as a result | API Check |
| AC-9 | A size changed on the details page is shown in the list on return without a full page reload, and a size changed in a list is shown on the details page when opened | Integration Test |
| AC-10 | A size can be cleared to unset via an explicit "None" option, after which the task behaves identically to one never sized | UI Check |
| AC-11 | Re-selecting a task's current size sends no request and creates no timeline entry | Automated Test |
| AC-12 | An update containing only size leaves the stored priority value identical and emits exactly one size event and no priority event | Automated Test |
| AC-13 | A size can be set when creating a task, and the created task carries it in every view | UI Check |
| AC-14 | A user holding only read access to a task receives an authorization rejection when submitting a size change, and the stored value is unchanged | API Check |
| AC-15 | An update request that omits size leaves the existing size unchanged | API Check |
| AC-16 | An out-of-set size value is rejected with a validation error naming the field, with no coercion, no silent ignore, and no persistence | API Check |
| AC-17 | Every size transition is recorded in the activity timeline with both previous and new values displayed, including unset→S, S→unset, S→XL, and XL→S | Integration Test |
| AC-18 | A failure to write the timeline entry does not fail or roll back the size change itself | Automated Test |
| AC-19 | Setting a size on a recurring parent task changes only that task, and leaves its existing future instances present with unchanged ids, due dates, and subtasks | Integration Test |
| AC-20 | Duplicating a task produces a copy carrying the original's size | Automated Test |
| AC-21 | When two size selections are made in rapid succession and their responses arrive out of order, the displayed and stored value is the one selected last | Automated Test |
| AC-22 | A size value outside the permitted set received in an API response renders as unset without breaking the row or the page | Automated Test |
| AC-23 | Using only the keyboard, a user can focus the chip inside a row, open it with Enter, move between options with arrow keys, and select with Enter, with the URL unchanged throughout; pressing Space while the chip is focused does not navigate | Automated Test |
| AC-24 | A screen reader announces the control's label and current value, and size is distinguishable without relying on colour | Manual Test |
| AC-25 | At 320px, 375px, 768px, and 1440px, with a task carrying a project, three tags, a due date, and a recurrence indicator, row height is identical with and without the size chip, and the chip is reachable without horizontal scrolling | UI Check |
| AC-26 | In a right-to-left locale, the size chip is positioned consistently with the row's other trailing elements and the letter renders unambiguously | Manual Test |
| AC-27 | An automated check asserts that all twenty-five locale files contain the complete size key set | Automated Test |
| AC-28 | The published API documentation describes size, its permitted values, and its wire type, and a contract test confirms the documented type matches what the read endpoint actually returns | API Check |
| AC-29 | Existing API clients that neither send nor read size continue to create, read, and update tasks unchanged | Integration Test |
