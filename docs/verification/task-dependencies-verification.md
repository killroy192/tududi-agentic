# Verification: Task Blocker/Blocked Dependencies

- **Commit under review:** `fe6f1a6` ("done draft")
- **Date:** 2026-07-10
- **Feature:** Blocker/blocked relationships between tasks. Recurring tasks must
  not have this functionality fully available: a recurring task may be a
  *blocker*, but may not be *blocked*.

> This is a verification report only. No application code, tests, config, or
> migrations were changed as part of this review.

---

## 1. Acceptance Criteria → Verification Method

| # | Acceptance criterion | Verification method | Result |
|---|----------------------|---------------------|--------|
| AC1 | Tasks can be marked as blocking / blocked by other tasks | `TaskDependency` model + `addDependency`/`removeDependency` ops + REST routes `POST/DELETE /task/:uid/dependencies`; unit + integration tests | PASS |
| AC2 | Blocker & blocking data is retrievable | `getDependencies`, `GET /task/:uid/dependencies`, serialized into single-task responses (`blockers`, `blocking`) | PASS |
| AC3 | A recurring task **can be a blocker** | `isRecurringTemplate` only blocks the *blocked* side; unit test "allows a recurring template task to be a blocker" + integration test | PASS |
| AC4 | A recurring task **cannot be blocked** | `addDependency` throws "A recurring task cannot be blocked."; unit + integration + API 400 tests | PASS |
| AC5 | UI does not offer "blocked by" for recurring templates | `TaskDependenciesCard` hides "Blocked by" section when `isRecurringTemplate`; component test | PASS |
| AC6 | Data integrity (no self-dep, no duplicates, no cycles, ownership) | Guards in `addDependency` + unique composite index + `hasCycle`; unit/integration tests | PASS |
| AC7 | Cleanup on task deletion | FK `onDelete: CASCADE` + explicit delete in `DELETE /task/:uid`; integration test | PASS |

All 7 acceptance criteria are directly verifiable and currently covered.

---

## 2. Existing Tests / Checks Reused

- Backend Jest suites (unit + integration) via `npm run backend:test`.
- Frontend Jest + Testing Library via `frontend:test`.
- Type check: `tsc --noEmit`.
- Lint: `frontend:lint` / `backend eslint`.

New tests added by the change:
- `backend/tests/unit/models/task_dependency.test.js` (5)
- `backend/tests/unit/modules/tasks/dependencies.test.js` (unit ops, incl. recurring rules, cycles, ownership, idempotency)
- `backend/tests/integration/task-dependencies.test.js` (API behavior, auth 403, recurring 400, cascade)
- `backend/tests/integration/task-dependencies-recurring.test.js` (virtual occurrence blocking inheritance)
- `frontend/components/Task/TaskDetails/__tests__/TaskDependenciesCard.test.tsx` (7)

---

## 3. Coverage Gaps / Suggested Additional Coverage

- No test asserts that a recurring **child instance** (`recurring_parent_id` set)
  *can* be blocked. The rule only protects templates; behavior for real child
  instances is untested and undocumented (see Risk R3).
- No test for the `MAX_CYCLE_CHECK_DEPTH` boundary (cycles deeper than 50 edges
  are not detected). Low practical risk, but the limit is silent.
- No test asserting `blockers`/`blocking` are excluded for virtual occurrences
  on the *blocked* side (only the `blocking` inheritance path is tested).

---

## 4. Repository Commands (typecheck / lint / build / test)

| Check | Command | Result |
|-------|---------|--------|
| Backend tests (feature) | `cd backend && npx jest tests/**/task*dependenc*` | 37 passed / 37 |
| Frontend test (feature) | `npx jest .../TaskDependenciesCard.test.tsx` | 7 passed / 7 |
| Frontend typecheck | `tsc --noEmit` | PASS (clean) |
| Frontend lint | `npm run frontend:lint` | **FAIL — 2 errors** |
| Backend lint | `eslint` on changed files | **FAIL — 6 errors** |

### Lint failures (blocking for `pre-release`, which runs `lint:fix`)

Frontend `TaskDependenciesCard.tsx`:
- Unused `error` binding in a `catch` (`@typescript-eslint/no-unused-vars`).
- An `eslint-disable` comment references `react-hooks/exhaustive-deps`, a rule
  not registered in this project's ESLint config → hard error.

Backend (all `prettier/prettier` formatting, auto-fixable):
- `migrations/20260710000001-create-task-dependencies.js` (1)
- `modules/tasks/operations/dependencies.js` (2)
- `modules/tasks/routes.js` (3)

These do not affect runtime behavior but will fail the project's lint gate.

---

## 5. Risks & Observations

- **R1 (Perf, medium):** `expandRecurringTasks` now `await`s `getDependencies`
  once per recurring template inside the list-building loop on `GET /tasks`.
  This is an N+1 query pattern per recurring task on a hot list endpoint and
  scales with the number of recurring templates.
- **R2 (Consistency, low):** `removeAllDependenciesForTask` is exported and unit
  tested, but the `DELETE /task/:uid` route deletes rows via raw SQL instead of
  calling it. With FK `onDelete: CASCADE` also present, cleanup is triply
  redundant (helper unused in prod path + raw SQL + cascade). Harmless but
  confusing to a new reader.
- **R3 (Spec ambiguity, low):** The rule blocks only recurring *templates* from
  being blocked. Recurring *child instances* can still be blocked. This matches
  a reasonable reading of the spec but is neither documented nor tested.
- **R4 (Robustness, low):** Cycle detection is bounded at depth 50; extremely
  deep chains could bypass detection silently.
- **R5 (Debug noise, pre-existing):** `expandRecurringTasks` retains multiple
  `console.log('[DEBUG]...')` statements (pre-existing, not introduced here).
- **Security (positive):** Ownership is enforced by `requireTaskRead/WriteAccess`
  middleware on `:uid` and re-checked via `findByIdAndUser` for the target task;
  cross-user linking returns generic "not found" (403 verified). No IDOR found.

---

## 6. Action List to Pass Each Gate

1. **Spec compliance:** Confirm intended behavior for recurring *child instances*
   being blocked; add a doc note + test to lock it in.
2. **Scope control:** Decide whether `removeAllDependenciesForTask` should be the
   single cleanup path or removed to avoid dead/duplicate logic.
3. **Test quality:** Add cycle-depth-boundary and recurring-child coverage.
4. **Risk:** Batch/eager-load dependency lookups in `expandRecurringTasks` to
   remove the N+1 on `GET /tasks`.
5. **Maintainability:** Resolve the 8 lint errors (2 frontend, 6 backend) so the
   lint gate passes; the `react-hooks/exhaustive-deps` disable comment is
   currently invalid for this repo's config.
6. **Evidence:** All feature tests, typecheck green; attach this report + the
   lint output as the review artifact.

---

## 7. Evaluation Scores (0–2)

| Dimension | Score | Rationale |
|-----------|:-----:|-----------|
| Spec compliance | 2 | All stated acceptance criteria met and tested (recurring can block, cannot be blocked). |
| Scope control | 1 | Mostly in-scope; unused `removeAllDependenciesForTask` + redundant deletion paths add minor surface. |
| Test quality | 2 | Behavior-focused unit + integration + component tests; small gaps noted but core behavior proven. |
| Risk | 1 | N+1 on a hot endpoint; bounded cycle check; otherwise safe (ownership enforced). |
| Maintainability | 1 | Clear structure and comments, but lint gate fails (8 errors) and an invalid eslint-disable rule. |
| Evidence | 2 | Tests, typecheck, and lint all runnable and reproduced; results captured here. |

**Total: 9 / 12.**

**Verdict:** Functionally correct and well-tested against the spec, but **not
merge-ready as-is** — the lint gate fails (8 errors) and the `GET /tasks` N+1
should be addressed. Fixing lint is mandatory before merge; the perf and
scope/consistency items are recommended follow-ups.
