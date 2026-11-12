# Verification

Mode: After implementation

## Inputs used

- Spec: `docs/task-size/spec.md` ([KAN-15](https://epam-team-ai-adoption.atlassian.net/browse/KAN-15). Jira status is still To Do.)
- Implementation plan: `docs/task-size/plan.md`
- Code diff: uncommitted working tree against `HEAD` (`a0bf2e3`), from `git diff` plus untracked files. That covers 31 modified files (+904 / −99) and 16 new files. The edits to `.cursor/skills/verification/SKILL.md` and `verification.template.md` in the same tree are tooling, not part of the feature, so they are not scored as feature code.

The spec still lists review findings 4.1–4.4 as blocking. The plan resolves them with Assumptions 1–13 and says those need product sign-off. Neither document, nor the ticket (no comments), records that sign-off. The criteria below are checked against the plan's resolutions, and the missing sign-off is counted where it matters.

## Commands

| Check | Command |
|-------|---------|
| Type check | `npx tsc --noEmit`. This is the same type-check step that runs inside `npm run frontend:build`. The backend is JavaScript and has no typecheck command. |
| Lint | `npm run lint` |
| Build | `npm run build` (`npm run frontend:build`: clean, `tsc --noEmit`, webpack) |
| Smoke test | No smoke-test script exists. Feature checks use `npm run backend:test`, `npm run frontend:test`, and `npm run test:ui` (Playwright). |
| Complexity | No complexity-analysis command in `package.json` or `AGENTS.md` |

Results (run on 2026-11-11):

| Command | Result |
|---------|--------|
| `npm run lint` | Pass. Frontend and backend ESLint report no errors. |
| `npx tsc --noEmit` | Pass (exit 0) |
| `npm run build` | Pass. Webpack compiled successfully. |
| `npm run backend:test -- <5 task-size files>` (parsers, builders, permissionsService unit tests; `task-size` and `task-access-level` integration tests) | Pass. 5 suites, 96 tests. |
| `npm run backend:test` (full) | Pass. 109 suites, 1656 tests. |
| `npx jest <6 task-size files>` (TaskSizeControl, TaskHeader.size, store taskSize, taskSizeScreens, Kanban move, Eisenhower move) | Pass. 6 suites, 35 tests. |
| `npm run frontend:test` (full) | Pass. 9 suites, 87 tests. |
| `npm run format` | Prettier flags 88 files repo-wide. Every flagged file this change touched was already unformatted at `HEAD`, and all 16 new files pass. The change introduces no format regression. |
| `npm run test:ui` | **Skipped.** The suite is long-running and deletes `backend/db/test.sqlite3` before it starts. `e2e/tests/task-size.spec.ts` was read but not run. |
| Manual UI check per screen and narrow viewport | **Not performed** |

## Specification compliance

Does the implementation satisfy every acceptance criterion defined in the specification?

Tools:

- Spec AC-1–AC-18, plan Assumptions 1–13, and the code diff
- Scoped and full backend and frontend Jest runs (see Commands)
- Code reading of `backend/services/rolesService.js` `isAdmin`, `backend/middleware/authorize.js`, and every `TaskSizeControl` mount point
- `rg` audit of every frontend `method: 'PATCH'` call site

Full score requires:

Every AC is met. Each plan resolution of a blocking review finding is either signed off or implemented exactly as the plan wrote it.

Score: 1

Reasoning:

| ID | Status | Evidence |
| --- | --- | --- |
| AC-1 | Met | `task-size.test.js` AC-1: existing and created tasks return `size: null`. The RTL tests show Unset for `null`. |
| AC-2 | Met in code, not checked in the UI | `TaskSizeControl` is mounted in the desktop, mobile, Kanban, and upcoming `TaskHeader` slots and in `TaskDetailsHeader`. Every AC-2 screen renders `TaskItem` → `TaskHeader`. The RTL tests cover the four slots and the menu order. No per-screen or narrow-viewport check was done. |
| AC-3 | Mostly met | API set/read is covered. `Tasks`, `TasksToday` (Today and Today plan), `ProjectDetails`, `AreaDetails`, `TagDetails`, `ViewDetail`, `KanbanBoard`, and `EisenhowerMatrix` all subscribe through `useTaskSizeSync`. Merging is unit-tested, including two sections holding the same uid. No test shows that a second open view updates without a reload: the Playwright Kanban case reaches Kanban with `page.goto`, which is a full reload. |
| AC-4 | Met | Integration test (`null` after S–XL) and the RTL Unset test |
| AC-5 | Met | `keeps priority and status independent of size` |
| AC-6 | Met | `it.each` over completed, archived, and cancelled |
| AC-7 | **Partially met** | Met: read-only users see text (RTL), a read-only PATCH returns 403 and keeps the size, a no-access GET returns 403, and a missing task returns 403. **Not met:** "A system administrator can change size." `authorize.js` passes the numeric `req.currentUser.id` to `getAccess`, and `getAccess` passes it to `isAdmin(userUid)`, which looks the user up by `uid`. The admin check therefore never matches in a request. A system administrator gets 403 on a task they neither own nor have shared. The bug existed before this change, and `getTaskAccessMap` copies it on purpose for parity. The integration test `lets a system admin set size` uses a task the admin owns and expects `access_level: 'rw'`, so it passes through the owner rule and hides the gap. |
| AC-8 | Met (plan Assumption 3) | Parent and stored child sizes stay independent, child ids are unchanged, a child created directly afterwards is `null`. Virtual rows render as read-only (RTL) and carry the parent's `access_level` (integration). |
| AC-9 | Met | Integration test for a subtask PATCH. RTL tests show compact subtask rows do not add a size slot. |
| AC-10 | Met (plan Assumption 6) | Habit create, habit update, and a task PATCH on a habit with `S` all store `null`. `XXL` returns 400. `TaskSizeControl` renders nothing when `habit_mode` is set, and `Habits/*` never mounts it. |
| AC-11 | Met | `it.each` over omitted, `null`, `S`, and `XXL` in both the builder unit test and the integration test |
| AC-12 | Met | Combined case: each rejected value plus a renamed field and `update_parent_recurrence`, sent to the recurring parent and to a child, returns 400. Name, priority, size, recurrence fields, and child ids are unchanged. The check is the first statement of the PATCH handler. |
| AC-13 | Met | Integration and builder unit tests |
| AC-14 | Met (plan Assumption 8), e2e not run | The RTL test shows the revert and the toast. Task details passes `task.sizeUpdateError`. Rows use the generic `task.updateError`. The Playwright 403 case is written but was not run. |
| AC-15 | Met | Two sequential PATCHes leave the second value. Choosing the current value sends no request (RTL). |
| AC-16 | Met (plan Assumption 4) | No `TaskEvent` row, no MCP task or habit input, search ignores a size filter and sort, and the VTODO output has no size. Metrics and AI code are untouched, so they gain no size behavior; this is by code inspection, not a test. |
| AC-17 | Met with mocked i18n | The RTL test translates Unset and keeps the letters. Only `en` keys were added, so other locales fall back to English until the locale sync (gate 6). |
| AC-18 | Not verified | The Playwright second-tab case is written but was not run. |

The score is 1 because one AC-7 clause is not delivered, and the sign-off on the blocking review findings is not recorded. Every other criterion is met or met in code with evidence gaps.

Actions to reach 2:

- Decide with product and security whether system administrators must be able to change size on tasks that are not theirs (approval gate 2). If yes, fix the `isAdmin` id/uid mismatch and add an integration test where an admin changes size on another user's unshared task. If no, change AC-7 and the spec's Current Behavior to say so.
- Record product sign-off on plan Assumptions 1–13 for review findings 4.1–4.4, or remove the blocking label in the spec.
- Run `npm run test:ui` for AC-3, AC-14, and AC-18. Do a manual check of every AC-2 screen and layout, including a narrow viewport, and show that a second open view updates without a reload.

## Scope control

Does the change include only what was requested, without unnecessary additions or unrelated modifications?

Tools:

- `git diff --stat` and the untracked file list against the plan's Files / Modules Involved
- Spec Out Of Scope, and `AGENTS.md` approval gates 2 and 6

Full score requires:

The diff stays within the plan's file list and its tests. The additive `access_level` field has recorded gate-2 approval. New copy is limited to the planned English keys. Nothing listed as out of scope appears.

Score: 1

Reasoning:

- Backend and frontend files match the plan, with three small additions that serve planned behavior: `projects/controller.js` (passes `userId` to the service), `frontend/utils/taskSize.ts`, and `frontend/hooks/useTaskSizeSync.ts`.
- Nothing out of scope is present. There is no size on the create form, habit surfaces, or compact subtask rows. There is no size filter, sort, metric, AI input, activity entry, CalDAV field, or MCP input. Enforcement is unchanged, and there is no cross-tab push.
- `access_level` is the plan's Assumption 1, and the plan puts it under approval gate 2. No approval is recorded.
- The English keys add `task.size.label` ("Size") on top of the two keys the plan named (Unset label and size error).
- `TaskHeader` now sets `hasMetadata` true for every non-habit task. This changes vertical padding (`py-3` → `py-2`) and keeps the mobile metadata row open on every row, which goes beyond placing the control.
- The same working tree contains unrelated tooling edits to `.cursor/skills/verification/SKILL.md` and its template.

Actions to reach 2:

- Record gate-2 approval for the `access_level` read field.
- Keep the verification-skill edits out of the feature PR.
- Confirm the extra `task.size.label` key and the row-padding change with the reviewer, or limit them to what the plan named.

## Test quality

Do the tests validate the expected behavior including edge cases (not just increase code coverage), and would they fail if the implementation were incorrect?

Tools:

- Read of every new and changed test file
- Scoped Jest runs (96 backend, 35 frontend, all passing)

Full score requires:

Each planned test checks the behavior in a way that would fail if the behavior were wrong, including the combined AC-12 case, permission cases, layouts, failure revert, the two-section merge, and the move bodies that drop size.

Score: 1

Reasoning:

- Strong points:
  - Assertions check stored rows (`Task.findByPk`), not only responses.
  - AC-12 covers every rejected value on both a parent and a child and checks child ids, names, and sizes.
  - The parser test includes edge values: `undefined`, `0`, booleans, arrays, and objects.
  - The builder test checks that an inherited `size` is ignored.
  - `getTaskAccessMap` is checked case by case against `getAccess`, and a query-count test shows the count does not grow from 4 tasks to 40.
  - The RTL tests cover menu order, read-only and virtual rows, habits, the no-op choice, revert, Escape, and the translated label.
  - The Kanban and Eisenhower tests check the real PATCH body after a published size.
- The admin tests hide the AC-7 gap:
  - The integration test makes the admin edit their own task and expects `rw`.
  - The unit test passes `adminUser.uid` where request code passes a numeric id.
  - Both pass whether or not a system administrator can write another user's task.
- Same-session sync on a live screen is tested only for Kanban and Eisenhower moves. Nothing shows that `ProjectDetails`, `TagDetails`, `ViewDetail`, `AreaDetails`, or `TasksToday` re-render with a published size. The Playwright Kanban case uses `page.goto`, so it would still pass if sync were broken.
- The Playwright suite was not run in this verification.

Actions to reach 2:

- Add an integration test where a system administrator PATCHes size on another user's unshared task, and a unit case that calls `getTaskAccessMap` with a numeric id the way request code does. Both should fail today if the spec's admin rule stands.
- Add a test, RTL or Playwright with client-side navigation, where a size saved in one mounted view shows in another mounted local-copy screen (for example task details → Today, or two sections on Today) without a reload.
- Run `npm run test:ui` and record the result.

## Risk

Does the change introduce any security, performance, reliability, data integrity, or rollout risks?

Tools:

- Read of the migration, the PATCH handler order, `getTaskAccessMap`, the serializer changes, and the habit strip
- `rg` audit of frontend task PATCH callers
- Permission and validation integration tests, plus the full backend suite (1656 tests passing)

Full score requires:

- The migration is additive and reversible.
- Validation runs before any write.
- Size is not a recurrence template field.
- The bulk resolver matches `getAccess` and uses a constant number of queries.
- Enforcement is unchanged.
- No caller forwards a stale size.
- Habits never store size.
- Gate 2 is approved.

Score: 1

Reasoning:

- Data integrity:
  - The migration adds a nullable `size` column (default `null`) through `safeAddColumns`. The down step uses `safeRemoveColumn`, which discards stored sizes; the PR should say so.
  - The model `isIn` validator also rejects bad values.
  - Size validation is the first statement of the PATCH handler, before the `update_parent_recurrence` write.
  - Size is not in the recurrence template list.
- Stale writes:
  - All seven raw `PATCH task/` callers (Tasks, Kanban, Eisenhower, Project, Tag, View, and `updateTask`) drop `size` and `access_level`.
  - `updateTask` forwards `size` only for a body that is exactly `{ size }`.
  - Completion undo goes through `updateTask`, so it is covered.
- Performance: list endpoints add up to 4 queries per request (admin check, projects, project permissions, task permissions), and the test shows that count does not grow with list size.
- Security:
  - Enforcement (`requireTaskWriteAccess`) is unchanged. `access_level` is the viewer's own level.
  - `getTaskAccessMap` copies the existing `isAdmin` id/uid mismatch, so the display matches enforcement. The admin rule the spec describes stays broken.
  - The read-field addition is under gate 2 with no recorded approval.
- Reliability:
  - The resolver can return `none` for nested records, such as a parent row shown to a project sharee in the unit test. `TaskAccessLevel` has no `none`, and `isTaskSizeEditable` treats anything except `ro` as editable. Such a viewer sees a menu that then fails with 403, reverts, and shows a toast.
  - The size stays protected, but the UI rule is not "read-only users see text" for that case.
- Pre-existing issue, unchanged: full-task PATCHes that resend a string priority can still delete future recurring instances. The AC-8 tests use partial PATCHes, so they are not affected.
- Rollout: only `en` keys were added (gate 6). E2E was not run.

Actions to reach 2:

- Get gate-2 approval and a decision on the admin rule (see Specification compliance).
- Treat `access_level: 'none'` as not editable in the UI, and add `'none'` to the frontend type.
- Run `npm run test:ui` before rollout. In the PR, state that the migration's down step drops stored sizes.

## Maintainability

Is the implementation easy to understand, maintain, and extend for a developer unfamiliar with the codebase?

Tools:

- Read of the diff against the existing task path (`parsers`, `builders`, `serializers`, `routes`, the priority save in `TaskDetails`, and the `TaskHeader` layouts)
- `npm run lint`, `npx tsc --noEmit`, and the Prettier check on new files

Full score requires:

- One allowed-values constant per tier and one validator. Create never writes size, and update writes it only when the key is present.
- One shared control mounted by each layout.
- Read-only and virtual rows are a display mode of that control.
- One in-session publish that local-copy screens merge.
- Translations follow the existing `t(key, fallback)` pattern.
- The code follows the current module layout.

Score: 2

Reasoning:

- `Task.SIZES` plus `isValidTaskSize` on the backend, and `TASK_SIZES` plus `TaskSize` on the frontend.
- `buildUpdateAttributes` copies `size` only when the request has the key. `buildTaskAttributes` never sets it.
- One `TaskSizeControl` (with JSDoc) is mounted through a single `renderTaskSize(slot, compact)` helper. Read-only mode comes from `isTaskSizeEditable` (`access_level`, `is_virtual_occurrence`).
- `publishTaskSize` updates the store and sets `lastSizeUpdate` (with a `seq` so repeated saves still notify). Each screen merges through `useTaskSizeSync` with the pure helpers `applyTaskSizeUpdate` and `applyTaskSizeUpdateToGroups`.
- `getTaskAccessMap` documents its query budget.
- A reader can trace a save from the control, through `updateTask({ size })` and the early PATCH check, to the column.
- Minor points that do not block a full score:
  - `accessLevelFor` is written twice, once in `serializers.js` and once in `projects/service.js`.
  - The `TasksToday` merge lists the six section keys twice.

## Evidence

Is there sufficient evidence (tests, logs, screenshots, or other artifacts) for a reviewer to verify the change without re-reading the entire implementation?

Tools:

- The command results recorded above
- Test names in the new and changed test files

Full score requires:

A reviewer can match each of AC-1–AC-18 to a recorded result without reading the production diff. That includes API, frontend, and Playwright output (or a written manual record) for the end-to-end flows, a per-screen UI note including a narrow viewport, and the lint and build results.

Score: 1

Reasoning:

- Recorded results cover lint, type check, build, the scoped and full Jest runs, and the format baseline.
- Test names map to AC IDs (for example `describe('AC-12 …')`, `describe('AC-7 size permissions')`), so the API rows of the plan's Verification table are traceable.
- Missing:
  - Playwright output, so AC-3 across views, AC-14 end to end, and AC-18 have no recorded end-to-end result.
  - A manual per-screen and narrow-viewport note for AC-2.
  - Screenshots.
  - A recorded sign-off for the blocking review findings and for gate 2.

Actions to reach 2:

- Attach the `npm run test:ui` output for `e2e/tests/task-size.spec.ts`.
- Add a short UI note, with screenshots, listing each AC-2 screen and layout (desktop, mobile or narrow, Kanban compact, upcoming) and the label or menu observed. Include one read-only viewer and one habit.
- Link the product and gate-2 approvals in the PR.
