# Task Duplication — Verification Report

Scope: strictly the task-duplication feature files listed below. Pre-existing unrelated uncommitted changes in the working tree (CalDAV, Notes, Login, Profile, Calendar, etc.) were explicitly excluded from this review.

**Files reviewed** (via `git diff -- <path>`):

- Backend: `backend/modules/tasks/operations/duplicate.js` (new), `backend/modules/tasks/routes.js` (new route hunk), `backend/tests/integration/task-duplicate.test.js` (new), `backend/tests/unit/modules/tasks/duplicate.test.js` (new)
- Frontend: `frontend/utils/tasksService.ts`, `frontend/components/Task/TaskHeader.tsx`, `frontend/components/Task/TaskItem.tsx`, `frontend/components/Task/TaskList.tsx`, `frontend/components/Task/GroupedTaskList.tsx`, `frontend/components/Task/TodayPlan.tsx`, `frontend/components/Tasks.tsx`, `frontend/components/Task/TasksToday.tsx`, `frontend/components/Project/ProjectDetails.tsx`, `frontend/components/Project/ProjectTasksSection.tsx`, `frontend/components/Area/AreaDetails.tsx`, `frontend/components/ViewDetail.tsx`, `frontend/components/Tag/TagDetails.tsx`, `frontend/components/Kanban/KanbanBoard.tsx`, `frontend/components/Eisenhower/EisenhowerMatrix.tsx`

---

## 1. Acceptance Criteria → Verification Method Mapping

| AC | Description | Verification method | Status |
|----|---|---|---|
| AC-1 | New task copies name+" (copy)", note, priority, due_date, defer_until, project, area, tags, assigned_to, involves | Integration tests: "Happy path" (name, note, priority, due_date-truthy, project_uid), "Tags" (tag re-link) | **Partially covered** — `defer_until`, `area_id`, `assigned_to`, `involves` are implemented in `duplicate.js:14-24` but never asserted in any test. `due_date` is only asserted `toBeTruthy()`, not for exact-value equality. |
| AC-2 | status=NOT_STARTED, no recurrence, no habit config, no completed_at, new uid, fresh timestamps | Integration tests: "Happy path" (status, completed_at, uid≠, id≠) + "Recurring task" (recurrence_type/interval/weekday, completion_based) | **Covered.** Habit config is moot because habit tasks are blocked entirely (AC-3), so "no habit config" is trivially satisfied. `created_at`/`updated_at` are not explicitly asserted but are guaranteed fresh by `taskRepository.create()`; low risk. |
| AC-3 | Duplicate icon not visible for `habit_mode=true` tasks | Backend: integration test "Habit task" → 400. Frontend: code inspection of `TaskItem.tsx:486` (`onDuplicate={!task.habit_mode ? handleDuplicate : undefined}`) and `TaskHeader.tsx` guards (`!task.habit_mode` in desktop block, `!task.habit_mode` in mobile block) | **Backend covered by test. Frontend only verified by static code review — no rendered-DOM test exists.** |
| AC-4 | User stays on page; new task appears in list | Code review: `handleTaskDuplicated`/`onTaskDuplicated` callbacks in `Tasks.tsx:448`, `TasksToday.tsx:1044`, `ProjectDetails.tsx:368`, `AreaDetails.tsx`, `ViewDetail.tsx:550`, `TagDetails.tsx:337`, `KanbanBoard.tsx:250`, `EisenhowerMatrix.tsx:138` all prepend the new task to local state without navigation | **Not automatable with current test tooling — manual/visual check required** (no routing call is made, confirmed by absence of `navigate(...)`/`history.push` in `handleDuplicate`). |
| AC-5 | Success toast shown | Code review: `TaskItem.tsx` `handleDuplicate` calls `showSuccessToast(...)` on success | **Not automated — manual/visual check required.** No frontend test exercises this. |
| AC-6 | No suffix stacking on re-duplication | Unit tests: `duplicate.test.js` (5 cases) + integration test "Copy suffix" | **Well covered.** |
| AC-7 | Available in Tasks, Today, Project tasks, Area tasks | Code review: prop threading confirmed end-to-end for all 4 named views (`Tasks.tsx`, `TasksToday.tsx`, `ProjectTasksSection.tsx`→`ProjectDetails.tsx`, `AreaDetails.tsx`) | **Statically confirmed, not runtime-tested.** Also wired into `ViewDetail.tsx`, `TagDetails.tsx`, `KanbanBoard.tsx`, `EisenhowerMatrix.tsx` (extra views, beyond AC-7's scope — see Finding F2 for a defect in one of these extra views). |
| AC-8 | 401 unauthenticated; 403/404 no access | Integration tests: "Authentication" (401), "Not found" (403 for a UID that doesn't exist) | **Partially covered.** The "no access" case tested is a *nonexistent* task, which returns 403 only because `permissionsService.getAccess` treats a missing resource as `NONE`. There is **no test for the realistic "no access" case**: a real task owned by a different, unrelated user. |
| AC-9 | Error toast on failure | Code review: `TaskItem.tsx` `handleDuplicate` catch block calls `showErrorToast(...)` | **Not automated — manual/visual check required.** |

---

## 2. Existing Test Inventory

**`backend/tests/unit/modules/tasks/duplicate.test.js`** (5 tests, all passing) — covers `buildCopyName()` in isolation: plain name, already-suffixed name (AC-6), suffix-in-the-middle edge case, empty string, and name exactly equal to the suffix.

**`backend/tests/integration/task-duplicate.test.js`** (7 tests, all passing):
1. Happy path — copied/reset fields (AC-1 partial, AC-2)
2. Tags re-linked (AC-1 partial)
3. Copy suffix, no stacking (AC-6)
4. Habit task → 400 (AC-3 backend)
5. Recurring task → recurrence stripped (AC-2)
6. Unauthenticated → 401 (AC-8 partial)
7. Nonexistent task → 403 (AC-8 partial)

No frontend tests exist for this feature. `Glob` search of `frontend/components/Task/__tests__/**` and `frontend/components/Task/**/__tests__/**` found only one unrelated pre-existing file (`TaskDetails/__tests__/TaskContentCard.test.tsx`, for the content-editing feature, not duplication).

---

## 3. Proposed Additional Test Coverage

**Backend (highest priority first):**
1. Integration test: duplicate a task owned by **another real user** (not shared) → assert 403. This is the only way to exercise the actual "no access" branch of `getAccess()` rather than the "resource doesn't exist" branch, closing the AC-8 gap.
2. Integration test: duplicate a task where `defer_until`, `area_id`, `assigned_to`, and `involves` are all set → assert all four are copied byte-for-byte onto the duplicate. Closes the AC-1 gap.
3. Integration test: duplicate a task shared with the requesting user at **read-only** access via a shared project → assert the duplicate either drops `project_id`/`area_id` (per spec Constraints) or, if the current "V1 skip" behavior is intentionally kept, document it with an explicit regression test asserting the *current* (spec-deviating) behavior so future changes are deliberate. See Finding F1.
4. Unit test for `duplicateTask()` itself (not just `buildCopyName`) mocking `taskRepository` to assert the full attributes object passed to `create()` — currently only reachable indirectly through the integration tests.

**Frontend (currently zero coverage):**
5. Component test for `TaskHeader.tsx`: renders duplicate icon when `onDuplicate` is provided and `task.habit_mode` is falsy; does **not** render it when `task.habit_mode` is true (AC-3).
6. Component test for `TaskItem.tsx`: clicking the duplicate button calls `duplicateTask()`, shows a success toast and invokes `onTaskDuplicated` with the returned task on success (AC-4, AC-5); shows an error toast and does not invoke `onTaskDuplicated` on failure (AC-9).
7. Regression test/manual check specifically for `KanbanBoard.tsx` desktop rendering — see Finding F2 below; as currently wired the icon cannot appear, so a DOM test would immediately catch this.

---

## 4. Commands Run (Evidence)

| Command | Result |
|---|---|
| `cd backend && NODE_ENV=test npx jest tests/unit/modules/tasks/duplicate.test.js tests/integration/task-duplicate.test.js` | **PASS** — 12/12 tests (2 suites) |
| `cd backend && npx eslint modules/tasks/operations/duplicate.js modules/tasks/routes.js tests/integration/task-duplicate.test.js tests/unit/modules/tasks/duplicate.test.js` | **PASS** — no output, zero lint errors |
| `cd backend && NODE_ENV=test npx jest` (full backend suite) | **106/108 suites, 1599/1601 tests passing.** The 2 failing tests (`task-attachments.test.js` EPIPE, `oauth.test.js` socket hang up) are network-flake failures unrelated to this feature — both pass cleanly in isolated re-run (`41/41` on second run). No regression from the duplication route. |
| `cd backend && NODE_ENV=test npx jest tests/integration/recurring-display-fixes.test.js` | **PASS** — 14/14 (this file appears in `git status` as modified, but the diff is a pure Prettier line-wrap with no logic change, confirmed unrelated to duplication) |
| `npx tsc --noEmit` (repo root, full frontend typecheck) | **PASS** — zero type errors |
| `npx eslint <all 15 frontend files in scope>` | **PASS** — no output, zero lint errors |
| `npx jest --testPathPattern='frontend'` (full frontend jest suite) | **PASS** — 3 suites / 52 tests (none exercise the duplication feature; see gap above) |

---

## 5. Acceptance Criteria Not Directly Verifiable by Automated Means

- **AC-4** ("user stays on same page, new task appears in list") — requires visual/manual confirmation across each list view; no e2e/Playwright test targets this flow today. Recommend a manual pass through Tasks, Today, Project, Area pages, or a future Playwright scenario.
- **AC-5** (success toast appearance/copy) — visual; toast content and timing are not covered by any test.
- **AC-9** (error toast appearance) — visual; would require mocking a network failure in a component test (proposed in §3, item 6) or manual verification (e.g., via devtools throttling/offline mode).
- **AC-3 (frontend half)** and **AC-7** — statically verifiable via code reading (done in this report) but not proven by a running test; recommend the component tests proposed in §3.

---

## 6. Action List to Pass Each Verification Gate

1. **Spec compliance** — Add the missing field assertions (defer_until/area_id/assigned_to/involves) to the integration test; add an explicit test (or a code fix) for the read-only shared-project access/project-inheritance constraint (Finding F1); add a real "other user's task" 403 test (AC-8 gap).
2. **Scope control** — Re-run `npm run frontend:format:fix` isolated to a separate commit, or revert the incidental reformatting in the 8 files identified in Finding F3 so the duplication diff is limited to the actual prop/handler additions; keeps future `git blame`/review clean.
3. **Test quality** — Land the 3 frontend component tests proposed in §3 (icon visibility, success path, failure path) so AC-3/4/5/9 have automated proof, not just code-review sign-off.
4. **Risk** — Decide and document the project/area write-access inheritance behavior (Finding F1) rather than leaving it as an undocumented, untested deviation from spec; add a disabled/loading state on the duplicate button to mitigate the double-click race condition called out in the plan's own Risks section (never implemented).
5. **Maintainability** — Move `require('./operations/duplicate')` in `routes.js` to the top of the file with the other requires; register the three new i18n keys (`tasks.duplicate`, `tasks.duplicated`, `tasks.duplicateFailed`) in `public/locales/en/translation.json`; either make the Kanban duplicate icon actually render or remove the dead wiring (Finding F2).
6. **Evidence** — This report now supplies the test-run evidence and AC mapping that the PR description itself should reference so a reviewer doesn't need to re-derive it by reading every diff.

---

## Findings (flagged for engineering follow-up)

**F1 — Spec constraint violation, untested (Risk + Spec compliance).** The spec's Constraints section states: *"The duplicate inherits `project_id` and `area_id` only if the user has write access to that project/area. If the user lacks write access, the duplicate is created without a project/area assignment."* The route only requires `requireTaskReadAccess` (`backend/modules/tasks/routes.js`, new hunk), and `duplicateTask()` (`backend/modules/tasks/operations/duplicate.js:20-21`) unconditionally copies `project_id`/`area_id` with no write-access check. A user who only has **read-only** access to a task (via a project shared at `'ro'` level — see `backend/services/permissionsService.js:17-55`) can duplicate that task; the resulting duplicate is owned by the requesting user but still points at a `project_id` they don't have write access to. The implementation plan explicitly acknowledged and deferred this ("Shared project access... For V1 we can skip this check since duplication is only available to the task owner"), but that assumption is not actually enforced anywhere in the code — read-only sharing already exists in this codebase (`getAccess`'s `perm.access_level` branch), so the deferred risk is live today, not hypothetical. No test exercises this path.

**F2 — Dead wiring in `KanbanBoard.tsx` (Maintainability).** `KanbanBoard.tsx` passes `hideStatusControl={true}` to `TaskItem` for Kanban cards. In `TaskHeader.tsx`, the desktop duplicate-icon block is gated by `!isUpcomingView && !task.habit_mode && !hideStatusControl && onToggleCompletion` (`TaskHeader.tsx:467-470`), so with `hideStatusControl=true` this entire block — including the duplicate button — never renders on desktop. Yet `KanbanBoard.tsx` still defines `handleTaskDuplicated` and threads `onTaskDuplicated` through to `TaskItem`. The wiring is real but currently unreachable in the desktop Kanban view; a future developer could reasonably assume it works because the code "looks" wired correctly.

**F3 — Large unrelated reformatting churn mixed into feature files (Scope control).** Several of the files in scope show diffs far larger than the actual feature change, almost entirely Prettier-style line-wrapping of pre-existing code:

| File | Total added lines | Feature-related added lines |
|---|---|---|
| `frontend/components/Tag/TagDetails.tsx` | 425 | 3 |
| `frontend/components/Area/AreaDetails.tsx` | ~330 (of 439 changed) | 3 |
| `frontend/components/ViewDetail.tsx` | 285 | 3 |
| `frontend/components/Task/TasksToday.tsx` | 364 | 8 |
| `frontend/components/Kanban/KanbanBoard.tsx` | 94 | 3 |
| `frontend/components/Eisenhower/EisenhowerMatrix.tsx` | 137 | 2 |
| `frontend/components/Tasks.tsx` | 95 | 5 |
| `frontend/components/Task/TaskHeader.tsx` / `TaskItem.tsx` | large | small (icon block / handler) |

This doesn't break anything (lint, typecheck, and all tests pass against the reformatted code), but it substantially inflates the reviewable diff, obscures the actual behavioral change, and increases the chance of accidental merge conflicts with other in-flight work.

**F4 — Minor: untranslated i18n keys.** `tasks.duplicate`, `tasks.duplicated`, `tasks.duplicateFailed` are used via `t(key, 'English fallback')` in `TaskHeader.tsx`/`TaskItem.tsx` but were never added to `public/locales/en/translation.json`, unlike the rest of the codebase's translated strings. Functionally harmless (fallback renders correctly) but breaks the localization convention.

---

## 7. Dimension Scores

| Dimension | Score (0-2) | Justification |
|---|---|---|
| **Spec compliance** | **1** | Backend logic satisfies 7 of 9 ACs with reasonable rigor (AC-2, AC-3 backend, AC-6, AC-8 basics). However, the explicit "write access required to inherit project/area" constraint from the spec's Constraints section is unenforced and untested (Finding F1), and AC-1's full field list (`defer_until`, `area_id`, `assigned_to`, `involves`) is implemented but unverified by any test — leaving a real, documented spec requirement unvalidated. |
| **Scope control** | **1** | The actual feature code (backend operation, route, service function, icon, handler, prop threading) is tight and matches the plan closely — no unrequested *functionality* was added. However, ~8 frontend files carry large amounts of unrelated Prettier-reformatting (Finding F3), which is scope creep in the diff even though it's not scope creep in behavior. |
| **Test quality** | **1** | Backend tests (12) are meaningful — they assert both copied and reset fields, cover the tricky suffix-stacking edge cases, and hit the habit/auth/not-found branches. But there is zero frontend test coverage for a UI-driven feature (icon visibility, toast, list update — AC-3/4/5/9), and the backend tests have real gaps (no `defer_until`/`assigned_to`/`involves` assertions, no genuine "other user, no access" 403 case). |
| **Risk** | **1** | No security-critical hole (duplication still requires at least read access, and the new row is always owned by the requester), but F1 is a genuine data/access-boundary risk that was explicitly identified in the plan and left unresolved and untested. The double-click race condition called out in the plan's own Risks section (no debounce/disable-while-pending) was also never implemented. |
| **Maintainability** | **1** | `duplicate.js` itself is small, readable, and well-named. But: the inline `require()` placed mid-file in `routes.js` breaks the file's own convention; the Kanban dead-wiring (F2) will confuse the next engineer; missing i18n registrations (F4) are inconsistent with codebase norms; and the reformatting noise (F3) makes `git blame`/history noisier for 8 files going forward. |
| **Evidence** | **1** | The plan document (`task-duplication.plan.md`) does include an AC→verification mapping, which is good practice, but the actual PR diff offers no test-run output or AC checklist a reviewer could trust without re-reading code — and the reformatting noise (F3) makes a lightweight diff review even harder. This report closes that gap after the fact, but the artifact itself (the diff) doesn't self-document to the standard the dimension calls for. |

**Total: 6/12.** No individual dimension scored 0 (nothing is broken/untested at a basic level), but none scored a clean 2 either — every dimension has at least one concrete, cited gap.
