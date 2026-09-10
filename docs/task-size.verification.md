# Verification Plan: Task Size (S / M / L / XL)

**Jira:** [KAN-15](https://epam-team-ai-adoption.atlassian.net/browse/KAN-15) — MK2/MK6: Task size estimate  
**Spec:** [docs/task-size-spec.md](./task-size-spec.md)  
**Plan:** [docs/task-size.plan.md](./task-size.plan.md)  
**Commit:** `fffe6ab` (diff base: `34ea189`)  
**Changeset:** 78 files, +2 359 / −505 lines

---

## Repository Commands

| Purpose | Command |
|---------|---------|
| TypeScript type check | `npx tsc --noEmit` |
| Frontend lint | `npm run frontend:lint` |
| Backend lint | `npm run backend:lint` |
| Frontend build | `npm run frontend:build` |
| Backend unit tests | `npm run backend:test:unit` |
| Backend integration tests | `npm run backend:test:integration` |
| Frontend unit tests (size) | `npx jest -- frontend/components/Shared/__tests__/TaskSizeControl.test.tsx frontend/utils/duplicateTask.test.ts frontend/utils/taskSizeLocales.test.ts` |
| All backend tests | `npm run backend:test` |
| E2E tests | `npm run test:ui` |

---

## Gate 1 — Specification Compliance

**Score: 1 / 2** — Partially meets

**Tools:** `npm run backend:test`, `npx jest` (frontend size tests), `npm run test:ui`, manual code review of `TaskSizeControl.tsx`, `TaskHeader.tsx`, `builders.js`, `parsers.js`, `logging.js`, `recurring.js`, `taskEventService.js`

### AC-by-AC Assessment

| AC | Status | Evidence |
|----|--------|----------|
| AC-1 | ✅ | Model validates `min:1, max:4`; `parsers.js` throws on invalid; integration tests cover string, integer, out-of-set, and zero |
| AC-2 | ✅ | `add-size-to-tasks.test.js` — migration unit test verifies NULL default and idempotency |
| AC-3 | ✅ | Integration test `should create without size as null` |
| AC-4 | ✅ | Size chip in both desktop/mobile trees in `TaskHeader.tsx`; e2e test sets size from list row |
| AC-5 | ✅ | `TaskDetailsHeader.tsx` mounts field-variant control; e2e verifies value visible on details |
| AC-6 | ✅ | `TaskSizeControl.test.tsx` — `optimistically shows the new value and sends only size` with deferred promise resolution |
| AC-7 | ⚠️ | Implemented in `TaskSizeControl.tsx` lines 115–139 (revert + toast on catch), but **no automated test** exercises the failure-revert path |
| AC-8 | ✅ | Frontend sends `{ size: sizeToApiValue(next) }`; integration test `should not change priority on size-only update` |
| AC-9 | ✅ | E2e test: set from list → navigate to details → value present |
| AC-10 | ✅ | `None` option in dropdown returns `null`; integration test `should clear size with explicit null` |
| AC-11 | ✅ | Frontend test `does not send a request when re-selecting the current size`; backend test `should not log size change when string matches stored integer` |
| AC-12 | ✅ | Integration test `should not change priority on size-only update` |
| AC-13 | ⚠️ | `TaskDetailsHeader` renders size control with `localOnly` when `isNew`, wired through `TaskDetails.tsx` — implementation present but **no dedicated test** for create-with-size appearing in every view |
| AC-14 | ✅ | Integration test `shared user with RO access cannot update task size` verifies 403 and unchanged stored value |
| AC-15 | ✅ | Integration test `should leave size unchanged when omitted from update` |
| AC-16 | ✅ | Integration tests: `should reject invalid size on create with size in error`, `should reject size 0 on create`, `should reject invalid size on update naming the field` |
| AC-17 | ✅ | Integration test `should record size transitions in the activity timeline` covers unset→S, S→XL, XL→unset with old/new value assertions |
| AC-18 | ⚠️ | Isolation by `try/catch` in `logTaskChanges` (logging.js line 131), but **no automated test** proves timeline failure does not roll back the size update |
| AC-19 | ✅ | Integration test `should not delete future instances on size-only update` |
| AC-20 | ✅ | `duplicateTask.ts` includes `size`; `duplicateTask.test.ts` asserts it |
| AC-21 | ✅ | Frontend test `keeps the last selection when responses arrive out of order` |
| AC-22 | ✅ | `normalizeSize(0) → null`, `normalizeSize(99) → null`, `normalizeSize('foo') → null` in unit test; component renders `null` as unset placeholder |
| AC-23 | ❌ | **Keyboard navigation broken.** When the dropdown opens via Enter/Space, focus remains on the trigger button. `handleTriggerKeyDown` does not delegate arrow keys to the menu when `isOpen === true`; the menu's `handleMenuKeyDown` (which handles ArrowUp/Down) never fires because `menuRef` is not focused and no `useEffect` calls `.focus()` on it after open. Arrow-key option navigation and Enter-to-select within the open dropdown do not work for keyboard-only users. |
| AC-24 | ⚠️ | `aria-label`, `aria-haspopup`, `aria-expanded`, `role="listbox"`, `role="option"`, `aria-selected`, and `sr-only` spans are present; however, the keyboard gap (AC-23) undermines screen-reader operability. **Manual verification not yet performed.** |
| AC-25 | ⚠️ | Chip uses `min-w-[1.75rem] h-5` with `flex-shrink-0`; desktop placement is `absolute end-0` alongside status control; mobile is inline with task name. **Manual responsive check at 320/375/768/1440 not yet performed.** |
| AC-26 | ⚠️ | Dropdown uses `end-0` / `start-0` (logical CSS); chip text is a Latin letter. **Manual RTL check not yet performed.** |
| AC-27 | ✅ | `taskSizeLocales.test.ts` asserts all 25 locale files contain the complete key set |
| AC-28 | ⚠️ | `swagger.js` and `tasks.js` document size with integer type and enum 1–4; **no contract test** confirming documented type matches actual response wire type |
| AC-29 | ✅ | Implicit: `buildUpdateAttributes` only touches size when `body.size !== undefined`; integration test `should leave size unchanged when omitted` |

### Reasoning

25 of 29 ACs are fully satisfied. AC-23 (keyboard navigation) has a confirmed functional defect. AC-7, AC-13, AC-18, and AC-28 are implemented but lack dedicated automated tests. AC-24/25/26 require manual verification.

### Actions to Achieve Full Score

1. **Fix AC-23:** Add `useEffect` to focus `menuRef` when `isOpen` transitions to `true`. Delegate ArrowUp/Down from `handleTriggerKeyDown` to `setHighlightedIndex` when `isOpen === true`. Add Enter-to-select logic to the trigger handler when dropdown is open (or simply move focus to the menu).
2. **Add failure-revert test (AC-7):** Mock `updateTask` to reject; assert chip reverts and error toast fires.
3. **Add timeline-isolation test (AC-18):** Mock `logTaskChanges` to throw; assert size is persisted.
4. **Add create-with-size test (AC-13):** E2e or integration test that creates a task with size and verifies it on list and details.
5. **Add contract test (AC-28):** Automated check that GET response `size` field type matches Swagger schema.
6. **Perform manual AC-24/25/26 checks** and capture evidence (screenshots, screen reader transcript).

---

## Gate 2 — Scope Control

**Score: 1 / 2** — Partially meets

**Tools:** `git diff 34ea189..fffe6ab --stat`, manual file review

### Reasoning

The changeset includes files beyond the task-size feature scope:

| File(s) | Concern |
|---------|---------|
| `.cursor/mcp.json`, `.cursor/rules/atlassian-jira-kan.md`, `.cursor/skills/plan/`, `.cursor/skills/verification/` | IDE/tooling configuration — not part of the feature |
| `mcp.example.json` | Example config — not part of the feature |
| `createValueObject` change in `taskEventService.js` | Changes from truthiness check (`value ? ...`) to strict `=== undefined` — affects **all** event types, not only size. Fixes a pre-existing bug where `priority = 0` (LOW) was silently dropped from timeline, but broadens the diff surface. |
| `TaskEvent` model setter changes in `task_event.js` | Same truthiness→strict-equality fix on `old_value` / `new_value` setters — also affects all stored events |
| `docs/task-size-context-map.md`, `docs/task-size-plan.md` (deleted) | Replaced by current docs — reasonable cleanup but adds to diff |

Core feature changes (model, migration, builders, parsers, logging, control, locale files, tests, swagger) are all in scope and well-targeted.

### Actions to Achieve Full Score

1. Move `.cursor/` tooling files and `mcp.example.json` to a separate commit.
2. Extract the `createValueObject` and `TaskEvent` model setter fixes into a prior commit with their own test and a comment noting the pre-existing bug fix, so the size commit is purely additive.

---

## Gate 3 — Test Quality

**Score: 1 / 2** — Partially meets

**Tools:** `npm run backend:test:unit` (52 suites, 739 tests ✅), `npm run backend:test:integration` (57 suites, 881 tests ✅), `npx jest` frontend size tests (3 suites, 38 tests ✅), code review of test files

### What is Tested

| Area | Tests | ACs Covered |
|------|-------|-------------|
| Model validation (unit) | Rejects out-of-set, 0, negative; accepts 1–4 and string forms | AC-1 |
| Migration (unit) | Idempotent nullable column, no default | AC-2 |
| Parsers (unit) | Reject invalid, accept string/int, normalize | AC-1, AC-16 |
| Event value-object (unit) | Preserves null and zero values in timeline entries | AC-17 |
| API CRUD (integration) | Create with/without size, update with string/int, omit-leaves-unchanged, clear, reject invalid | AC-1, AC-3, AC-15, AC-16 |
| Timeline (integration) | unset→S, S→XL, XL→unset transitions; no-op when string matches stored int | AC-17, AC-11, AC-12 |
| Recurrence (integration) | Size-only update does not delete future instances | AC-19 |
| Authorization (integration) | RO user cannot update size; stored value unchanged | AC-14 |
| TaskSizeControl (unit) | Renders unset/set states; optimistic display; no-op re-select; out-of-order response sequencing | AC-6, AC-11, AC-21, AC-22 |
| Duplication (unit) | Size included in allowlist and copied | AC-20 |
| Locale keys (unit) | All 25 files contain complete size key set | AC-27 |
| E2E (Playwright) | Set from list → verify on details | AC-4, AC-5, AC-9 |

### What is Missing

| Gap | ACs | Impact |
|-----|-----|--------|
| Failure-revert test | AC-7 | Would not detect if catch block is accidentally removed |
| Keyboard navigation test | AC-23 | Would not catch the current focus-management bug |
| Timeline failure isolation test | AC-18 | Would not detect if `try/catch` is removed from `logTaskChanges` |
| Create-with-size-everywhere test | AC-13 | Would not detect if creation path drops size silently |
| Contract test (Swagger vs response) | AC-28 | Would not detect schema/response type drift |
| Responsive layout tests | AC-25 | Row height assertions at specified widths |

### Reasoning

Existing tests are well-crafted, meaningful, and cover the critical backend and frontend happy paths, edge cases (zero rejection, type normalization, sequencing), and security (authorization). Tests would fail if the implementation were incorrect for the paths they cover. However, several spec-mandated behaviors lack automated verification — most critically the keyboard flow where a real test would have caught the focus-management defect.

### Actions to Achieve Full Score

1. Add `TaskSizeControl` test: mock `updateTask` to reject → assert chip reverts and error toast.
2. Add `TaskSizeControl` keyboard test: `fireEvent.keyDown(trigger, { key: 'Enter' })` → `fireEvent.keyDown(menu, { key: 'ArrowDown' })` → assert highlighted index changes → Enter selects.
3. Add integration test: inject `logTaskChanges` that throws → assert size persists.
4. Add e2e or integration test: create task with size → verify on list and details.
5. Add contract test: parse Swagger spec → assert GET response size field type matches.

---

## Gate 4 — Risk

**Score: 1 / 2** — Partially meets

**Tools:** `npm run backend:lint`, `npm run frontend:lint`, `npx tsc --noEmit`, code review

### Identified Risks

| Risk | Severity | Status |
|------|----------|--------|
| **Keyboard accessibility gap (AC-23)** | Medium | The dropdown menu is inoperable via keyboard alone. This is a WCAG 2.1 AA violation (Success Criterion 2.1.1) that could block releases to accessibility-sensitive customers. |
| **`createValueObject` broad change** | Low | Changes behavior for all event types. Priority `0` (LOW) was previously silently dropped from timeline; it will now be recorded. No regression test for existing priority timeline behavior exists, though the fix is correct. |
| **Serializer relies on implicit spread** | Low | `serializeTask` uses `...taskWithoutSubtasks` (model `toJSON()` minus Subtasks). Size is included because it's a Sequelize column, but if serialization ever switches to explicit field picking, size could be silently dropped. |
| **`as any` type cast on PATCH payload** | Low | `TaskSizeControl` line 107 casts `{ size: sizeToApiValue(next) } as any` to satisfy `updateTask(uid, Partial<Task>)`. Bypasses TypeScript type checking on the payload. |
| **Backend lint error in new file** | Low | `taskEventService-value-object.test.js` has a prettier formatting error. Pre-existing lint errors in other files (project-sharing, recurring-display-fixes) are not introduced by this changeset. |
| **No performance risk** | None | Single nullable column, no new indexes, no new queries in hot paths. |
| **No security risk** | None | Existing `requireTaskWriteAccess` guard covers the update route; no new auth surface. Server-side validation rejects invalid values. |
| **No data integrity risk** | None | Encoding avoids `0`; `parseSize` rejects, never coerces; migration is idempotent with no default. |

### Reasoning

The keyboard accessibility defect is the primary risk — it's a functional gap that affects real users. The `createValueObject` change is a corrective fix but broadens the blast radius beyond size. Other risks are negligible.

### Actions to Achieve Full Score

1. Fix the keyboard focus management in `TaskSizeControl.tsx`.
2. Fix the prettier error in `taskEventService-value-object.test.js` (`npm run backend:lint:fix` or manual).
3. Add a regression test for priority timeline events (priority `0` → `1` produces a timeline entry) to cover the `createValueObject` behavior change.

---

## Gate 5 — Maintainability

**Score: 2 / 2** — Fully meets

**Tools:** Code review of `frontend/constants/taskSize.ts`, `TaskSizeControl.tsx`, `builders.js`, `parsers.js`, `logging.js`

### Reasoning

- **Single shared control:** `TaskSizeControl` serves list row (chip variant), task details (field variant), and creation form (localOnly + field) — avoids the dual-implementation drift the codebase already has with priority dropdowns.
- **Clean constants module:** `frontend/constants/taskSize.ts` centralizes encoding, normalization, comparison, and API mapping in one 50-line file with clear exported types.
- **Follows existing patterns:** Size field in the model uses the same bounded-integer pattern as priority/status. Builders map size through `parseSize` just as priority uses `parsePriority`. Logging captures old values and normalizes for comparison using the same structure as other fields.
- **Minimal coupling:** The control encapsulates its own API call, optimistic state, and revert logic. Parent components only receive optional callbacks for local state patching.
- **Readable code:** Clear naming (`displaySize`, `requestSeqRef`, `normalizeSize`, `sizesEqual`), small functions, early returns in parsers.
- **No unnecessary abstractions:** The implementation is direct and proportional to the feature's complexity.

### Actions to Achieve Full Score

None — this gate is fully met.

---

## Gate 6 — Evidence

**Score: 1 / 2** — Partially meets

**Tools:** All commands from the Repository Commands table above

### Available Evidence

| Check | Result |
|-------|--------|
| TypeScript type check (`npx tsc --noEmit`) | ✅ Clean — no errors |
| Frontend lint (`npm run frontend:lint`) | ✅ Clean — no errors |
| Backend lint (`npm run backend:lint`) | ⚠️ 1 new prettier error in `taskEventService-value-object.test.js` (line 9:8). Pre-existing errors in `project-sharing.test.js`, `recurring-display-fixes.test.js`, `add-goal-columns migration` are not from this changeset. |
| Frontend build (`npm run frontend:build`) | ✅ Compiled successfully |
| Backend unit tests | ✅ 52 suites, 739 tests passed |
| Backend integration tests | ✅ 57 suites, 881 tests passed |
| Frontend size tests | ✅ 3 suites, 38 tests passed |
| E2E tests | ⚠️ Not run in this verification (requires running application). Test file exists and is syntactically valid. |

### Missing Evidence

| Item | AC |
|------|-----|
| Manual responsive screenshots at 320/375/768/1440 | AC-25 |
| Manual screen reader transcript | AC-24 |
| Manual RTL locale screenshot | AC-26 |
| E2E test run results | AC-4, AC-5, AC-9 |
| Backend lint clean pass | — (1 new error) |

### Reasoning

Automated test results comprehensively cover the backend and the frontend logic layer. The TypeScript compiler and frontend lint confirm type safety and code style. The build confirms no runtime bundling issues. However, the backend lint failure in a new file and the absence of manual verification evidence (responsive, screen reader, RTL) leave gaps.

### Actions to Achieve Full Score

1. Fix the prettier error in `taskEventService-value-object.test.js`.
2. Run the e2e test suite against a live instance and capture results.
3. Capture screenshots at 320/375/768/1440 with crowded metadata (project + 3 tags + due date + recurrence).
4. Record a screen reader session navigating the size control.
5. Capture a screenshot of the size chip in an RTL locale (e.g., Arabic).

---

## Summary

| Gate | Score | Max |
|------|-------|-----|
| Specification compliance | 1 | 2 |
| Scope control | 1 | 2 |
| Test quality | 1 | 2 |
| Risk | 1 | 2 |
| Maintainability | 2 | 2 |
| Evidence | 1 | 2 |
| **Total** | **7** | **12** |

### Top Priority Actions

1. **Fix keyboard focus management in `TaskSizeControl.tsx`** — AC-23 functional defect.
2. **Add missing test coverage** — failure-revert (AC-7), keyboard (AC-23), timeline isolation (AC-18).
3. **Fix backend lint error** in `taskEventService-value-object.test.js`.
4. **Separate scope-external changes** into their own commits (`.cursor/`, `createValueObject` fix).
5. **Perform and capture manual verification** for responsive (AC-25), screen reader (AC-24), and RTL (AC-26).
