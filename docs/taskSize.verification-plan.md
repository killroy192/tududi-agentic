# Verification Plan: Task Size Field

## Inputs

- **Feature spec:** `docs/taskSize.spec.md`
- **Implementation plan:** `.cursor/plans/task-size-field_c31909e9.plan.md`
- **Code diff:** 18 files changed, ~536 insertions, ~8 deletions

---

## Repository Commands

| Purpose | Command |
|---------|---------|
| Type checking | `npm run frontend:build` (runs `tsc --noEmit` then webpack) |
| Linting | `npm run lint` (`frontend:lint` + `backend:lint`) |
| Backend integration tests | `npm run backend:test:integration` |
| All backend tests | `npm run backend:test` |
| Frontend unit tests | `npm run frontend:test` |
| E2E / smoke tests | `npm run test:ui` |
| Build | `npm run frontend:build` |

---

## Verification Gates

### 1. Specification Compliance

**Score: 0–2 (to be evaluated)**

| Tool / Command | Purpose |
|---|---|
| `npm run backend:test:integration` | Confirm AC-1 through AC-7, AC-14, AC-15 via automated API tests |
| `npm run test:ui` | Confirm AC-8 through AC-13 via E2E tests |
| Manual inspection of `GET /api/tasks` response | Confirm AC-4 (size field present in responses) |
| Manual inspection of `SizeDropdown` rendering | Confirm AC-8, AC-9, AC-10 (badge/chip visibility, recurring exclusion, details placement) |

**Checklist of acceptance criteria to verify:**

- [ ] AC-1: Only S, M, L, XL, or null accepted — check `tasks.test.js` covers each valid value and rejects invalid ones
- [ ] AC-2: `PATCH /api/task/:uid` accepts `size` — check test cases in `tasks.test.js`
- [ ] AC-3: `POST /api/task` accepts optional `size` — check test cases in `tasks.test.js`
- [ ] AC-4: `GET` endpoints return `size` — check test assertions read back the field
- [ ] AC-5: 400 on invalid size — check test cases for `"XXL"`, `"s"`, `""`, numeric, non-string
- [ ] AC-6: 400 on recurring task — check test cases for recurring parent and instance
- [ ] AC-7: Permission enforcement — check `project-sharing.test.js` for rw/ro/unauth/nonexistent
- [ ] AC-8: Size chip in list views — check `TaskHeader.tsx` renders `SizeDropdown` for non-recurring tasks
- [ ] AC-9: No chip/dropdown for recurring — check `isRecurring` guard in `TaskHeader` and `TaskDetailsHeader`
- [ ] AC-10: Size dropdown in details header — check `TaskDetailsHeader` renders `SizeDropdown` next to priority
- [ ] AC-11: Immediate save — check `onChange` triggers `onTaskUpdate`/`handleSizeUpdate` with no intermediate step
- [ ] AC-12: Cross-view sync — check `Tasks.tsx` and `ViewDetail.tsx` call `updateTaskInStore`
- [ ] AC-13: Read-only users see badge but cannot persist — check server returns 403 (API tests), no disabled state in UI (by design)
- [ ] AC-14: Size independent of priority — check test case that changes one and verifies the other is untouched
- [ ] AC-15: Subtask independent size — check test case creating subtask under sized parent
- [ ] AC-16: Null after migration — check migration adds column with `defaultValue: null` and no backfill
- [ ] AC-17: Existing tests pass unmodified — verify no pre-existing test files were edited (only additions)

**Actions for full score:**

- Confirm `e2e/tests/task-size.spec.ts` exists and covers AC-8–AC-12 (plan Step 12). If missing, E2E coverage is incomplete.
- Verify AC-6 includes the "add recurrence and size in one call" edge case per spec.
- Verify AC-16 by running `npm run db:migrate` on a populated DB and inspecting that all rows have `size = NULL`.

---

### 2. Scope Control

**Score: 0–2 (to be evaluated)**

| Tool / Command | Purpose |
|---|---|
| `git diff --stat` | Enumerate all changed files |
| Manual review of `agent.md` diff | Confirm no unrelated additions |
| Comparison against plan's "Files / Modules Involved" | Identify unexpected file changes |

**Evaluation criteria:**

- Every file in the diff should correspond to a file listed in the plan's "Files / Modules Involved" section.
- No unrelated features, refactors, or style changes should be included.
- The `hasMetadata` change in `TaskHeader.tsx` (`!isRecurring && true`) forces the metadata row to always render — verify this was intentional (it makes the size chip always reachable per Assumption #2) and does not cause layout regressions for tasks with no other metadata.

**Actions for full score:**

- Confirm `agent.md` (untracked) and `docs/taskSize.spec.md` (untracked) are spec/documentation artifacts, not scope creep.
- Verify the `ViewDetail.tsx` change (`response.json()` + `updateTaskInStore`) is scoped only to the size sync fix (Step 11) and does not alter unrelated update flows.
- Verify the `Tasks.tsx` single-line addition of `updateTaskInStore` is purely the cross-view sync fix.

---

### 3. Test Quality

**Score: 0–2 (to be evaluated)**

| Tool / Command | Purpose |
|---|---|
| `npm run backend:test:integration` | Run API tests and confirm they pass |
| `npm run test:ui` | Run E2E tests and confirm they pass |
| Review of `tasks.test.js` additions (~290 lines) | Assess coverage depth |
| Review of `project-sharing.test.js` additions (~63 lines) | Assess permission coverage |

**Evaluation criteria:**

- Tests should fail if the implementation is removed (i.e., they are not trivially always-passing).
- Edge cases from the spec must be covered: invalid value classes (lowercase, empty string, number, non-string type), `null` clearing, `undefined` omission preserving value, recurring parent vs. instance.
- Permission tests should cover all four scenarios: `rw` success, `ro` rejection, unauthenticated, nonexistent task.
- Re-read assertions must confirm the task was not modified after a rejected request (AC-5).

**Actions for full score:**

- Confirm the "task unmodified after rejection" assertion exists for invalid value tests (re-`GET` after a failed `PATCH`).
- Confirm E2E test file `e2e/tests/task-size.spec.ts` exists (plan Step 12). If absent, UI interaction flows are only manually verifiable.
- Confirm the "add recurrence and size in one POST" edge case is tested per AC-6.
- Confirm the positive control test: a recurring task PATCH without `size` still succeeds (no regression to existing recurring workflows).

---

### 4. Risk

**Score: 0–2 (to be evaluated)**

| Tool / Command | Purpose |
|---|---|
| `npm run backend:test` | Catch regressions in existing recurring task tests |
| `npm run test:ui` | Catch layout/interaction regressions |
| Manual inspection of validation ordering in `routes.js` | Ensure existing error behavior unchanged |
| Manual test of `onTaskUpdate({ ...task, size })` on tasks with unusual defer/due combinations | Catch full-object PATCH risk |

**Risk areas identified in the plan:**

1. **Migration vs. `sync()` divergence** — migration file exists and uses `safeAddColumns`; integration tests use `sync()` from model. Risk: migration not tested in integration tests. Mitigation: E2E uses migrations.
2. **Full-object PATCH from list rows** — `onTaskUpdate({ ...task, size })` sends all fields. If a task has unusual `defer_until`/`due_date` state, size change might trigger unrelated validation errors. Mitigation: only non-recurring tasks have the chip, and `handleRecurrenceUpdate` is a no-op for them.
3. **Validation ordering** — size validation is inserted *before* existing `buildUpdateAttributes` and *after* other route logic in PATCH. Check for error precedence changes.
4. **`hasMetadata` always true** — the `!isRecurring && true` expression makes metadata row always render, even for tasks with no tags, no due date, no project. This is a deliberate UX choice (Assumption #2) but could be a minor layout regression.
5. **Portal z-index conflicts** — `SizeDropdown` uses `z-50` which may conflict with other portal-based dropdowns if both are open simultaneously.

**Actions for full score:**

- Verify that the existing `recurring-tasks.test.js` passes without modification (AC-17 lock).
- Manually test size change on a task with `defer_until` set to confirm no cascade failure.
- Confirm validation call ordering in `routes.js` does not alter existing 400 responses for requests that violate multiple rules.

---

### 5. Maintainability

**Score: 0–2 (to be evaluated)**

| Tool / Command | Purpose |
|---|---|
| `npm run lint` | Confirm code style compliance |
| `npm run frontend:build` | Confirm TypeScript compiles cleanly |
| Manual code review of `SizeDropdown.tsx` | Assess component structure and reusability |
| Manual review of `validation.js` additions | Assess clarity of validation logic |

**Evaluation criteria:**

- The implementation follows the established patterns (priority pipeline, portal dropdown, store sync, throwing validators).
- The `SizeDropdown` component is self-contained, pure, and reusable with a simple interface (`value`, `onChange`, `testIdSuffix`).
- The backend validation helpers (`validateSize`, `validateSizeNotOnRecurringTask`) are clearly named, handle edge cases (undefined vs. null), and follow the same pattern as existing validators.
- `parseSize` is trivial (pass-through) — confirm this is intentional and consistent with how it might need to evolve (e.g., case-normalization could be added here later).
- Translation keys follow the established `namespace.key` pattern.

**Actions for full score:**

- Confirm no lint warnings or TypeScript errors after the change.
- Verify that `parseSize` returning `undefined` for `undefined` and the raw value otherwise correctly integrates with `buildUpdateAttributes`'s `!== undefined` guard.
- Confirm the `SizeDropdown` does not hold persistence logic (it delegates to caller — verified).

---

### 6. Evidence

**Score: 0–2 (to be evaluated)**

| Tool / Command | Purpose |
|---|---|
| `npm run backend:test:integration -- --verbose` | Produce test output as evidence |
| `npm run test:ui` | Produce E2E test output as evidence |
| `npm run lint` | Produce lint output as evidence |
| `npm run frontend:build` | Produce typecheck output as evidence |

**Evaluation criteria:**

- Automated test results (passing/failing counts) should be captured.
- Lint and typecheck should produce zero errors.
- For AC-16 (migration check), evidence should include the output of running `npm run db:migrate` on a populated database.
- For AC-17 (existing tests unmodified), evidence should include a `git diff` of test files showing only additions (no modifications to pre-existing test cases).

**Actions for full score:**

- Run all four commands above and capture output.
- Produce a `git diff` of `backend/tests/integration/tasks.test.js` and `project-sharing.test.js` confirming only appended test blocks (no modification of existing tests).
- If E2E spec `e2e/tests/task-size.spec.ts` is missing, note that AC-8–AC-12 cannot be evidenced automatically.
- Confirm migration idempotency by running `npm run db:migrate` twice and showing no error on the second run.

---

## Summary Matrix

| Gate | Key Question | Commands to Run |
|------|-------------|-----------------|
| Specification Compliance | Does it satisfy all 17 ACs? | `npm run backend:test:integration`, `npm run test:ui` |
| Scope Control | Only requested changes? | `git diff --stat`, file comparison to plan |
| Test Quality | Would tests catch regressions? | Review test assertions, check edge case coverage |
| Risk | Any security/performance/reliability issues? | `npm run backend:test`, manual validation ordering review |
| Maintainability | Easy to understand and extend? | `npm run lint`, `npm run frontend:build`, code review |
| Evidence | Can a reviewer verify without re-reading code? | All test/lint/build commands, migration run, diff of test files |

---

## Open Questions for Evaluator

1. Does `e2e/tests/task-size.spec.ts` exist? (Plan Step 12 — not observed in the diff of tracked files)
2. Is the "add recurrence and size in one POST" case tested? (AC-6 edge case)
3. Does the `hasMetadata` always-true change cause any visual regression in views where tasks have no other metadata?
4. Are the 24 non-English locale files flagged for follow-up translation sync?
