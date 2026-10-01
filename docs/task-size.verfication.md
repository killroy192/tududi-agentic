# Context Map

Verification plan for task size (S / M / L / XL). Jira [KAN-15](https://epam-team-ai-adoption.atlassian.net/browse/KAN-15) — “MK2/MK6: Task size estimate”, type Task, status To Do. Score the finished implementation against [docs/task-size.spec.md](task-size.spec.md) v1.1 (AC-1–AC-19) and [docs/task-size.plan.md](task-size.plan.md). The Jira description is a subset of that spec; a pass on the Jira bullets alone is not a pass.

Scores below are from the last commit only: `f93d443` (“Add size attribute to tasks”), parent of this plan. They come from reading that diff. The commands in this plan were not re-run for the score. This document does not prescribe patches.

## Score sheet

Reviewed commit: `f93d443f828cb0d131be98ebb8eb39064580f5f6`. Scale: **0** fails, **1** partially meets, **2** fully meets.

| Gate | Score (0–2) | Reasoning |
|------|-------------|----------------|
| Specification compliance | 1 | Create, update, clear, permissions, recurrence, and the list/details controls match the spec. The API also accepts lowercase sizes (`xl` → `XL`), which the spec treats as unsupported. |
| Scope control | 1 | The product diff stays on the plan’s surfaces. The commit also adds case-folding and `temp/agents/plan-reviewer.md`, which the spec does not ask for. |
| Test quality | 1 | API and component tests assert stored values, rejection, permissions, recurrence, and list-row revert. The create suite also locks in lowercase acceptance, so that test would fail a spec-correct rejection. Details revert and search/Kanban wiring are untested. |
| Risk | 1 | Invalid writes, read-only PATCH, virtual rows, boards, and activity logging are guarded in the diff. The migration is reversible in source and was not applied and undone on a real SQLite file. The model rejects `'s'` while the parser accepts it. |
| Maintainability | 1 | One dropdown, one badge, one English label helper, and a batched edit resolver. The allowlist is enforced twice, with different case rules, and list saves go through `onTaskCompletionToggle`. |
| Evidence | 1 | `task-size.test.js`, the model `size` block, and the two frontend test files are enough to review the API contract without reading every caller. The commit has no test log, migration status, or UI screenshots. |
| **Total** | **6 / 12** | |

A gate is **2** only when every condition under “Full score” holds. A gate is **1** when the main path holds and at least one named condition does not. A gate is **0** when the main path fails, or when a failed condition would ship incorrect size data, an unauthorized write, or a display-only surface that can save.

## Hot context

Directly required for the feature right now:

* Current spec and plan
  * [docs/task-size.spec.md](task-size.spec.md) — behavioral contract and AC-1–AC-19. This is the scoring contract.
  * [docs/task-size.plan.md](task-size.plan.md) — file list, ordered steps, risks, and the same AC table.
  * [docs/context-maps/task-size.contextmap.md](context-maps/task-size.contextmap.md) — where the behavior lives. Use it to find files. Do not treat it as extra requirements.
  * Locked contract to check, not to redesign:
    * Column `size` on `tasks`. Values `S` | `M` | `L` | `XL` | SQL `NULL` (JSON `null`). No backfill. Pre-feature rows stay unset.
    * Create: omit or `null` stores unset. Any other value rejects the create and leaves no row.
    * Update: omit leaves the stored value and leaves other fields unchanged. `null` clears to unset. Any other value rejects the update and leaves the stored value.
    * Priority and size change only when their own key is present.
    * Editable surfaces: standard list rows (Today, upcoming, sidebar lists, saved views, project, tag, area) and task details, including the details screen after sidebar stub create. That screen is the full New Task surface.
    * Display-only: Kanban, Eisenhower, search. Set → non-interactive label. Unset → omit size UI. No control that can save.
    * Virtual upcoming rows serialize with size unset and must not save size. Persisted templates, legacy recurring children, and subtasks keep their own size. New occurrences start unset. Template size edits do not rewrite or delete existing occurrences.
    * Edit permission is the existing task write access (`rw` / `admin`). `ro` can see size and cannot change it. No size-specific permission.
    * Completed and archived tasks stay size-editable for editors.
    * No size activity or timeline events.
    * Labels, including None, are English i18n keys. The control has an accessible name and is keyboard operable.
    * Failed update: error toast and the control returns to the last saved size.
  * Values outside `S`, `M`, `L`, `XL`, and unset/`null` are unsupported. The spec does not allow case folding or aliases. If create or update accepts anything else, Specification compliance and Scope control cannot be 2.

* Active files

  Reviewer commands. Run them from the repo root unless noted. Do not run `npm run db:reset`, `npm run migration:undo:all`, or any command that wipes the dev database.

  | Check | Command | Pass condition |
  |-------|---------|----------------|
  | Typecheck | `npx tsc --noEmit` | Exit 0. There is no separate typecheck script; `frontend:build` runs this same check before webpack. |
  | Lint | `npm run lint` | Exit 0. Narrow rerun if the full lint log is noisy: `npx eslint` on the frontend size files below, and `cd backend && npx eslint` on the backend size files below. |
  | Format | `npm run format` | Exit 0 on the size diff. Format-only failures outside the size diff do not lower Maintainability below 2 if the size files are clean. |
  | Build | `npm run frontend:build` | Exit 0. This repeats `tsc --noEmit` and produces `dist/`. |
  | Model tests | `cd backend && cross-env NODE_ENV=test npx jest tests/unit/models/task.test.js --forceExit` | The `size` cases pass: `S`/`M`/`L`/`XL` and `null` accepted; other values rejected. |
  | API tests | `cd backend && cross-env NODE_ENV=test npx jest tests/integration/task-size.test.js --forceExit --runInBand` | Exit 0. Integration Jest is one worker. A green run does not prove the migration; `sync({ force: true })` builds from the model. |
  | Frontend tests | `npx jest --config jest.config.js frontend/components/Shared/__tests__/SizeDropdown.test.tsx frontend/components/Task/__tests__/TaskItem.size.test.tsx --watchman=false` | Exit 0. |
  | Migration apply and undo | See the migration procedure below. | `up` adds nullable `size`; `down` removes it; `up` again restores it. Existing rows stay unset. |
  | Complexity | See the complexity procedure below. | No new or edited function is hard to follow in one pass. The repo has no complexity script and no `complexity` ESLint rule. |
  | Smoke | App on port 8080 (API on 3002). `npm start` if it is not already running. | Manual AC script below, exercised by click, type, and navigation. |

  Migration procedure. `npm run migration:undo` rolls back only the latest migration. Read `npm run migration:status` first and continue only when the latest pending or applied name is the size migration (expected name pattern `add-size-to-tasks`).

  ```bash
  npm run migration:status
  npm run migration:run
  npm run migration:status
  npm run migration:undo
  npm run migration:status
  npm run migration:run
  npm run migration:status
  ```

  After the final `up`, create no new task and read one task that existed before the column. Its `size` is JSON `null` or absent (AC-18).

  Complexity procedure. Do not add a package and do not edit ESLint config. Point ESLint at the size diff only:

  ```bash
  npx eslint --config eslint.config.mjs \
    --rule 'complexity: [warn, 10]' \
    frontend/components/Shared/SizeBadge.tsx \
    frontend/components/Shared/SizeDropdown.tsx \
    frontend/components/Task/TaskHeader.tsx \
    frontend/components/Task/TaskItem.tsx \
    frontend/components/Task/TaskDetails.tsx \
    frontend/components/Task/TaskDetails/TaskDetailsHeader.tsx \
    frontend/utils/taskSizeLabels.ts \
    frontend/entities/Task.ts

  cd backend && npx eslint --config eslint.config.js \
    --rule 'complexity: [warn, 10]' \
    models/task.js \
    modules/tasks/core/builders.js \
    modules/tasks/core/parsers.js \
    modules/tasks/core/serializers.js \
    modules/tasks/operations/subtasks.js \
    modules/tasks/routes.js
  ```

  If `--rule` is rejected by the flat config, stop. Do not change config to make the command work. Read each new or edited function and note any that branch on view, permission, virtual occurrence, and save in the same function.

  Diff surface to compare with the plan’s file list. Refresh it; do not trust a stale snapshot:

  ```bash
  git status --short
  git diff --stat
  git diff --name-only
  ```

  Plan file list to expect: task model and a new migration; task parsers, builders, routes, serializers; logging and `task_event` left without a size event; recurring and subtask operations; Swagger task docs; task unit and integration tests; client `Task` type, task service, shared store; `TaskHeader`, `TaskItem`, list parents, task details, Kanban, Eisenhower, search results; `public/locales/en/translation.json`.

  Also open any path the diff actually touches that is not on that list, including project task reads, search serialization, permissions, metrics, list grouping, and `temp/`. Those paths decide Scope control.

* Logs/screenshots

  Attach evidence next to the score sheet. A reviewer must be able to check the change without re-reading the implementation.

  * Command logs: typecheck, lint, format, frontend build, the three Jest commands, migration status before apply, after apply, after undo, and after re-apply.
  * API samples: create omit, create `null`, create `S`, create unsupported, update omit, update `null`, update unsupported, update size with priority unchanged, update priority with size unchanged, read-only `PATCH` rejected, activity list after a size change with no size event.
  * Screenshots or short clips, each after a real interaction: list-row dropdown set and cleared; details set and cleared; in-app navigation list → details and details → list; Kanban, Eisenhower, and search with size set and with size unset; read-only user; completed task; archived task; error toast with the control back on the last saved size; keyboard open, choose, and Escape on the dropdown.
  * One SQLite read, or the API read, showing a pre-feature task with unset size after migration.

  None of that evidence exists in this plan. Missing evidence caps the Evidence gate below 2. It does not by itself fail Specification compliance if the checks were actually run and the logs exist elsewhere.

### Gate: Specification compliance

Does the implementation satisfy every acceptance criterion in the spec?

* **Score:** 1.
* **Commands and checks:** API Jest file, model Jest file, frontend Jest files, migration procedure, and the manual script below. Swagger UI at `/api-docs` (authenticated) for the documented omit / `null` / reject contract. This score used `git show f93d443` on those files, not a test run.
* **Reasoning:** AC-4, AC-6, AC-7 (API), AC-9, AC-13, AC-14, AC-16, and AC-17 are implemented and asserted, except that `parseSize` uppercases input, so `xl` is stored as `XL` instead of rejected. List rows (`TaskList`, `GroupedTaskList`) and task details save size; Kanban, Eisenhower, and search render `SizeBadge` and omit it when unset. AC-1, AC-2, AC-5, AC-8, AC-10, AC-11, AC-15, and AC-19 are present in the UI diff and were not exercised in the browser. AC-18 follows from a nullable column with no backfill and was not checked on a migrated database.
* **Full score (2):** AC-1 through AC-19 all hold, including the manual ones. Jira’s five bullets hold because they sit inside that set. Unsupported values other than the spec enum are rejected on create and on update.
* **Partial (1):** persisted create/update/clear and the list and details editors work, and at least one of AC-7, AC-10, AC-11, AC-13, AC-14, AC-15, AC-16, AC-18, or AC-19 is unmet or unrun.
* **Fail (0):** a supported size does not persist, omit changes stored size, clear does not unset, an invalid update changes the stored size, or a read-only user can save size.
* **To reach 2:** Reject any create or update value other than `S`, `M`, `L`, `XL`, and `null`/omission, including lowercase, and keep the previous size on a rejected update. Run the manual script so AC-1, AC-2, AC-5, AC-8, AC-10, AC-11, AC-15, and AC-19 are observed in the app. Read one pre-feature task after the migration and confirm it is unset.

| ID | What must be true | How to check |
|----|-------------------|--------------|
| AC-1 | Editor sets S/M/L/XL on a list row; after a full reload the value remains. | Manual. Confirm with `GET` that the body `size` matches. |
| AC-2 | Same from task details, then full reload. | Manual plus `GET`. |
| AC-3 | None on list or details; after reload API and UI are unset (`null` or absent). | Manual plus `GET`. |
| AC-4 | Create and update with `size` omitted succeed; create stays unset; update leaves size and other fields unchanged. | `task-size.test.js` create-omit and update-omit cases. Re-read the assertions; a test that only checks status is not enough. |
| AC-5 | List change is visible on details without a browser reload, and the reverse path matches. | Manual navigation. Confirm the shared store and the view’s own task array both update. |
| AC-6 | Size change leaves priority; priority change leaves size. | API tests plus one manual pass on details. |
| AC-7 | `ro` user sees size when set, has no enabled control, and `PATCH` is rejected with the stored size unchanged. | API permission case plus manual list and details as the read-only user. |
| AC-8 | New-task details: leave unset and the task stays unset; choose S/M/L/XL and that value persists. API create accepts the same values. | Manual sidebar create, then details. API create cases for `S`/`M`/`L`/`XL`. |
| AC-9 | Subtask size can differ from the parent; changing one leaves the other. | API subtask cases plus one manual parent/subtask pair. |
| AC-10 | Kanban, Eisenhower, and search show a non-interactive label when set, omit size UI when unset, and cannot save. | Manual on all three surfaces, set and unset. Confirm the shared row is not an enabled dropdown there. |
| AC-11 | Failed size update on list and on details: error toast; control returns to the last saved size. | Manual fault (stop the API or force a 400/500) on both surfaces. Frontend test covers the list row only if the details path is also exercised by hand. |
| AC-12 | Create with an unsupported size fails with validation feedback and creates no task. | API: status 400 and task count unchanged. UI: the create surface shows a validation error. The API client path is in scope even when the dropdown cannot send a bad value. |
| AC-13 | A new recurring occurrence starts unset when the template has a size. Editing persisted occurrence A does not change B or the template. | API virtual-occurrence case plus a manual upcoming row that does not save onto the template. |
| AC-14 | Editing template size from list or details does not change existing occurrences and does not delete them. | API case that a child still exists with its previous size. |
| AC-15 | Completed and archived tasks stay size-editable for an editor. | Manual on both statuses, list or details. |
| AC-16 | After size changes, activity/timeline has no size event type. | API: no new `task_events` row whose type mentions size. Manual: timeline UI. |
| AC-17 | Unsupported create and update are rejected; update leaves the previous size. | API cases. Pair with the model test. Both layers should reject. |
| AC-18 | Tasks from before the feature are unset after migrate. | Migration procedure, then read an old row. |
| AC-19 | Dropdown is keyboard operable, has an accessible name, and None / S / M / L / XL come from i18n. | Frontend `SizeDropdown` tests plus a manual keyboard pass. English keys live under `size` in `public/locales/en/translation.json`. |

Manual script (smoke). Log in through the UI. Use a user who can edit, then a shared read-only user.

1. Open a standard list (Today or a project). Set S, M, L, and XL on different rows. Reload. Values remain (AC-1).
2. Open one of those tasks in-app. Details shows the same size. Change it. Return to the list without a full reload. The list matches (AC-5).
3. Choose None on details. Return to the list. The editable control shows the unset placeholder, not a letter (AC-3).
4. Create from the sidebar, land on details, leave size unset, and confirm `GET` is unset. Create another and set M before leaving (AC-8).
5. Change size and confirm priority is unchanged. Change priority and confirm size is unchanged (AC-6).
6. Set a subtask size different from its parent. Change the parent. The subtask stays (AC-9).
7. As a read-only share, open list and details. The letter shows when set. There is no enabled dropdown. A direct `PATCH` does not change the row (AC-7).
8. Open Kanban, Eisenhower, and search for a sized task and an unset task. Sized cards and hits show text only. Unset ones show no size control. Nothing on those surfaces writes `size` (AC-10).
9. On an upcoming virtual occurrence of a sized template, size is omitted or unset and saving is impossible. Change the template size and confirm an existing child is unchanged and still present (AC-13, AC-14).
10. Complete a task and archive a task. Size still edits (AC-15).
11. Break the update request. List and details each show an error toast and the previous size (AC-11).
12. `POST /api/task` with `size: "small"` (and one other unsupported value) returns 400 and leaves no row (AC-12, AC-17). Repeat as `PATCH` against a task whose size is `M` and confirm it is still `M`.
13. Open activity for a task whose size changed. No size event (AC-16).
14. Operate the dropdown with the keyboard only: open, move, select, Escape. The accessible name is present (AC-19).

### Gate: Scope control

Does the change include only what was requested?

* **Score:** 1.
* **Commands:** `git show --name-only --format='' f93d443` against the plan’s file list and the spec’s Out Of Scope list.
* **Reasoning:** Schema, parsers, builders, serializers, list reads, project and search `can_edit`, subtasks, Swagger, English strings, `SizeDropdown` / `SizeBadge`, and the list/details/search wiring are in the plan. `temp/agents/plan-reviewer.md` is not. Accepting `xl` is behavior the spec does not include. Filter, sort, metrics, MCP, inbox capture, non-English locales, and size activity events are absent.
* **Full score (2):** every changed behavior is in the spec or the plan’s assumptions. Display-only surfaces stay display-only. Quick capture, inbox, MCP task tools, non-English locale files, filters, sorts, metrics, and activity events are untouched. Docs and tests for this feature are in scope. `temp/` notes and unrelated refactors are not.
* **Partial (1):** the feature works and the diff also contains a drive-by edit, an extra accepted value, or a file outside the plan that is not required to satisfy an AC.
* **Fail (0):** the diff adds an out-of-scope feature (filter by size, roll-up, template copy, editable Kanban/search, size timeline events, hour mapping) or changes unrelated modules in a way that alters their behavior.
* **To reach 2:** Remove `temp/agents/plan-reviewer.md` from the change. Stop accepting values outside `S`, `M`, `L`, `XL`, `null`, and omission, or add that normalization to the spec before it counts as in scope.

Out of scope checklist. Each item must still be absent:

* Filter, sort, group, search, or saved views by size
* Capacity, velocity, or totals by size
* Size on inbox quick capture and inline name-only create
* Live multi-tab or multi-user sync
* Timeline or activity events for size
* Hour ranges for S–XL
* Editable size on Kanban, Eisenhower, or search
* Parent/subtask inheritance or roll-up
* Copying template size onto new occurrences
* Dense surfaces beyond Kanban, Eisenhower, and search
* MCP task tools
* Non-English files under `public/locales/`
* A size-specific permission

### Gate: Test quality

Do the tests check behavior, including edges, and would they fail if the implementation were wrong?

* **Score:** 1.
* **Commands:** the three Jest commands above. Open `backend/tests/unit/models/task.test.js` (`size` block), `backend/tests/integration/task-size.test.js`, `frontend/components/Shared/__tests__/SizeDropdown.test.tsx`, and `frontend/components/Task/__tests__/TaskItem.size.test.tsx`.
* **Reasoning:** The integration file asserts omit, `null`, each enum value, unsupported create (no row), unsupported update (stored size unchanged), priority independence, completed and archived PATCH, no timeline event, `can_edit` for owner / `ro` / `rw`, subtask isolation, virtual upcoming size `null`, and template edits that do not delete children. The model block rejects `'s'`. The frontend tests cover the accessible name, keyboard use, None → `null`, read-only label, unset badge omitted, list save into the store and host callback, and list revert plus error toast. `normalizes lowercase size values` expects `xl` to persist, so it would fail the spec’s rejection rule. No test renders Kanban, Eisenhower, or search, and no test fails a details save and checks the toast plus the unchanged details value.
* **Full score (2):** the automated set below exists, asserts outcomes rather than implementation shape, and the manual-only ACs are called out as manual rather than pretended to be covered. A test that would still pass if size were ignored, copied from the parent, written onto a virtual row, or logged as an activity event does not count.
* **Partial (1):** happy-path create/update tests exist, and at least one edge in the required set has no failing assertion (invalid update leaves the old value, read-only rejection, no activity row, subtask isolation, virtual occurrence unset, template edit does not delete children, dropdown revert, display-only badge).
* **Fail (0):** tests only cover the model allowlist, or they assert status codes without the stored value, or they cannot fail when size is dropped from the response.
* **To reach 2:** Make the lowercase create case expect rejection, matching the model test and AC-17. Add a check that a details save error leaves the last saved size and surfaces the error toast. Add a check that Kanban, Eisenhower, and search render a badge when size is set, render nothing when unset, and expose no dropdown. Manual-only ACs still need the smoke script; a missing Playwright spec does not block a 2.

| Behavior | Assertion that must be able to fail |
|----------|--------------------------------------|
| Model accepts only `S`, `M`, `L`, `XL`, and `null` | A rejected value throws; a valid value round-trips. |
| Create omit and create `null` | Response and stored row are unset. |
| Create `S`/`M`/`L`/`XL` | Stored value equals the body. |
| Create unsupported | 400 and no new row. |
| Update omit | Stored size and a sibling field (name or priority) stay as they were. |
| Update `null` | Stored size becomes unset. |
| Update unsupported | 400 and the previous size remains. |
| Size vs priority | Each write leaves the other field. |
| Read-only `PATCH` | Rejected; stored size unchanged; read payload still shows the size. |
| Editor flag on reads the UI uses | Editor can see that they may edit; `ro` can see that they may not. Same access rules as task update. |
| No activity event | A successful size change inserts no size event type. |
| Subtask | Parent and child can differ; creating a child does not copy parent size. |
| Recurrence | Virtual upcoming size is unset when the template is set. Changing template size does not change or delete an existing child. |
| Dropdown | Keyboard use, accessible name, None clears to `null`, disabled/read-only renders a label, unset badge renders nothing. |
| List row | Immediate save updates the host list and the shared store. Failed save restores the last value and surfaces an error. Virtual and non-editable rows do not get a dropdown. |

### Gate: Risk

Does the change introduce security, performance, reliability, data integrity, or rollout risk?

* **Score:** 1.
* **Commands:** migration procedure; API permission test; read `backend/modules/tasks/utils/logging.js` and `backend/models/task_event.js` to confirm size is absent from event lists; read the upcoming expansion path to confirm a virtual row cannot `PATCH` the template’s size.
* **Reasoning:** `isSizeEditable` defaults off, so Kanban and Eisenhower stay on `SizeBadge`. Virtual rows set `size: null` and the list control refuses `is_virtual_occurrence`. `size` is absent from the activity field list and from `templateFieldsChanged`. `createTaskEditResolver` loads permissions in a fixed batch. The new migration is nullable, has no backfill, and has a `down`. It was not applied and undone on SQLite in this review. `parseSize` accepts `'xl'`; `Task` `isIn` rejects `'s'`, so a write that skips the parser does not match the API.
* **Full score (2):** all of the following hold.
  * Invalid size never writes. A rejected update keeps the previous value.
  * `ro` cannot mutate size. The UI hides the control and the API rejects the write.
  * Kanban and Eisenhower cannot save size through the shared row. Search cannot save size.
  * Virtual upcoming rows cannot write the template.
  * Size is not on the activity field list, so a size change cannot insert an event type the model does not allow.
  * Template size changes do not take the branch that deletes future children.
  * The migration is reversible, nullable, and has no backfill. Pre-feature rows stay unset.
  * List reads do not add a per-row permission query storm. They reuse access data the list already loads, or the added query is bounded and described.
  * Omitting `size` still succeeds for older clients.
* **Partial (1):** data integrity and permissions hold, and one rollout or performance risk is unmeasured (extra queries on list reads, migration checked only via Jest `sync`).
* **Fail (0):** unauthorized write succeeds, invalid input persists, virtual rows rewrite the template, or the migration is not reversible.
* **To reach 2:** Run the migration procedure and keep the four `migration:status` outputs. Use one case rule in both the parser and the model so a value the API stores is a value the model accepts, and a value the model rejects is a value the API rejects.

### Gate: Maintainability

Is the implementation understandable, maintainable, and extendable for someone who does not know this codebase?

* **Score:** 1.
* **Commands:** complexity procedure; `npm run lint`; `npx tsc --noEmit`. Read the size path in this order: migration, model, parser, create builder, update builder, serializer, list/details controls, display-only branch, English strings. This score is from that reading of `f93d443`, not from ESLint output.
* **Reasoning:** A reader can find create versus update in the builders, the display-only default on `TaskItem`, and English strings under `size` and `task.sizeUpdated`. The same allowlist lives on the model, in `parseSize`, and in `TASK_SIZES`, and only the parser folds case. List persistence is wired through `onTaskCompletionToggle`, which does not say “size”. `SizeDropdown` is one keyboard-operable control shared by list and details.
* **Full score (2):** the allowed values and the English labels each live in one place. Create and update share the reject rule. List and details share one control. Boards and search share the display-only treatment. Backend stays CommonJS JavaScript; new frontend stays TypeScript. User-facing strings go through i18next. Names match the spec (`size`, None, S/M/L/XL). Lint and typecheck are clean for these files. No new function needs a comment to explain control flow that the names already carry.
* **Partial (1):** the behavior is correct and the enum, the save path, or the display-only flag is duplicated in a way a later change would miss one copy.
* **Fail (0):** view, permission, virtual occurrence, and persistence are tangled so a reader cannot tell which surfaces save; or typecheck/lint fail on the size files; or labels are hardcoded in components.
* **To reach 2:** One case rule, shared by the model and the parser. A size save on the list should be obvious from the callback name or a size-specific handler. Re-run lint, `tsc --noEmit`, and the complexity command and attach a clean result for the size files.

### Gate: Evidence

Can a reviewer verify the change without re-reading the entire implementation?

* **Score:** 1.
* **Commands:** the command table in Active files. Store logs and the screenshots listed under Logs/screenshots with the review.
* **Reasoning:** AC-4, AC-6, AC-7, AC-9, AC-13, AC-14, AC-16, and AC-17 are backed by assertions in `backend/tests/integration/task-size.test.js`. AC-19 is partly backed by `SizeDropdown.test.tsx`. AC-11 is partly backed by `TaskItem.size.test.tsx` for the list row only. AC-1, AC-2, AC-3, AC-5, AC-8, AC-10, AC-12 (UI feedback), AC-15 (UI), and AC-18 have no log or screenshot in the commit.
* **Full score (2):** automated commands are pasted with exit status; migration status is pasted at all four points; the manual script has a note or screenshot for every manual AC; API samples cover omit, clear, invalid create, invalid update, permission rejection, and the empty activity result.
* **Partial (1):** Jest output is attached and the manual script is incomplete (missing boards, read-only, failure toast, or recurrence).
* **Fail (0):** no command output and no UI exercise. A green claim without logs is a 0.
* **To reach 2:** Attach the Jest and migration-status logs, plus a screenshot or note for each manual AC in the smoke script (list, details, in-app navigation, boards, search, read-only, completed, archived, error toast, keyboard).

## Warm context

Reusable guidance relevant to the feature:

* AGENTS.md / rules / skills
  * [AGENTS.md](../AGENTS.md) — schema changes are a new reversible migration plus the model. Do not edit a migration that already shipped. Integration tests use one worker and `sync({ force: true })`. User-facing copy is English in `public/locales/en/translation.json`.
  * This plan’s hard rules: do not score the work while writing the plan; do not propose code edits inside the plan. The reviewer assigns scores later.
  * [.cursor/rules/jira.mdc](../.cursor/rules/jira.mdc) — read-only Jira, project KAN only. Do not transition or comment on KAN-15 as part of verification.
  * Playwright rules apply only if someone adds an e2e spec. They are not required to score this change.

* Team conventions
  * Priority is the analog, with the spec’s intentional deltas: no activity events, editable on list rows, omitted when unset on dense surfaces.
  * Access levels are `none` / `ro` / `rw` / `admin`. Edit means `rw` or `admin`.
  * Unset is null. Omitting the field is not a clear.
  * Immediate save matches other task field updates: error toast and revert. A success toast is optional.

* ADRs
  * None under `docs/`. Do not block a score on a missing ADR.

* Known constraints
  * Optional field. Old clients that omit `size` must keep working.
  * Strict enum. No hour mapping.
  * Virtual upcoming rows reuse the template id. A save from those rows would change the template.
  * Multi-tab staleness until refresh is accepted, not a defect.
  * Concurrent editors: last successful write wins.
  * Deleted or inaccessible task during edit is an error, not a silent success.
  * Non-English locales are out of scope. Missing translations outside `en` do not lower Specification compliance.

## Cold context

Investigate only if a gate is blocked:

* Relevant repo areas
  * `backend/modules/tasks/taskEventService.js` — only if AC-16 is unclear. Size must not grow a sibling of `priority_changed`.
  * `backend/modules/tasks/operations/recurring.js` — only if AC-14 might delete children. `size` must stay off the template-field list.
  * `backend/modules/tasks/queries/metrics-computation.js` and task comparators — only if the diff touches them. Size must not gain totals or sort.
  * `backend/modules/mcp/tools/taskTools.js` — only if the diff touches MCP. Size stays out.
  * Inbox capture — only if the diff touches inbox. Size stays out.
  * `backend/middleware/authorize.js` — only if the editor flag on reads disagrees with `requireTaskWriteAccess`.

* Documentation
  * Swagger task schema in `backend/docs/swagger/tasks.js` and `backend/config/swagger.js`. Check that docs describe omit, `null`, and rejected values. Wrong docs cap Maintainability at 1. They do not replace API tests.

* Past PRs
  * Defer-until migration `backend/migrations/20251124000001-add-defer-until-to-tasks.js` is the pattern for a nullable column. Use it only if the new migration’s `up`/`down` shape is unclear.

* Monitoring/logs
  * No size metric is required. Do not treat a missing dashboard as a risk failure. Upcoming expansion already logs recurring-task debug lines; that noise is not size evidence.

* Story tickets
  * [KAN-15](https://epam-team-ai-adoption.atlassian.net/browse/KAN-15) only. Jira acceptance criteria: values S/M/L/XL/unset; dropdown on list and details; immediate save kept in sync; optional and independent of priority; edit permission required. Spec AC-7 through AC-19 are not on the ticket and still count.

## Resources to ignore

* Deprecated documentation
  * `frontend/components/Task/TaskForm/TaskPrioritySection.tsx` — unused. Do not score a failure to wire it up.
  * The Jira description as the full contract.

* Generated files
  * `dist/`, coverage output, SQLite database files, `backend/.env`. Do not read secrets into the review notes.

* Unrelated modules
  * Areas, notes, tags, goals, people, CalDAV, Telegram, and admin, except where project, tag, or area details render the task row that now shows size.
  * Habit tools, MCP, and non-English locale files.
  * `temp/` agent notes. Their presence in the diff is a Scope control finding, not a product requirement.
