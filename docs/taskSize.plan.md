---
name: task-size-field
overview: "A TDD implementation plan for the optional task `size` field (S/M/L/XL), following the existing `priority` pipeline: model + migration, parser/builder/validation/serializer, a shared size dropdown reused in the task list row and task details header, and translations. The deliverable of this planning step is the document `docs/taskSize.plan.md`."
todos:
  - id: write-plan-doc
    content: Create docs/taskSize.plan.md containing the seven required sections (Confirmed Facts, Assumptions, Files / Modules Involved, Implementation Plan, Risks, Out Of Scope, Verification) exactly as drafted, per the plan skill template. No application code, tests, config, or migrations.
    status: pending
isProject: false
---

## Deliverable

This plan is produced under the `plan` skill: the only artefact to create is the markdown file [docs/taskSize.plan.md](docs/taskSize.plan.md) containing exactly the sections below. No application code, tests, config, or migrations are written during this step.

---

### Confirmed Facts

- No `size` column exists. The `tasks` table is defined in [backend/models/task.js](backend/models/task.js); `priority` is an INTEGER with `validate: { min: 0, max: 2 }` (lines 35-43), `recurrence_type` is a plain `STRING` defaulting to `'none'` (lines 56-60), and `recurring_parent_id` is a nullable FK (lines 137-144). There are no Sequelize `ENUM` columns anywhere in the model.
- The closest existing analogue for a nullable string with an allowed value set is `recurrence_type`, not `priority`. Constants live as static maps on the model (`Task.PRIORITY`, `Task.STATUS`, `Task.RECURRENCE_TYPE`, lines 312-335).
- There is **no `createTable('tasks')` migration**. The base schema comes from `sequelize.sync()` ([backend/scripts/db-init.js](backend/scripts/db-init.js), [backend/scripts/db-sync.js](backend/scripts/db-sync.js), and [backend/tests/helpers/setup.js](backend/tests/helpers/setup.js) line 14). Migrations only add/alter columns via `safeAddColumns` from [backend/utils/migration-utils.js](backend/utils/migration-utils.js). Consequence: backend integration tests pick the new column up from the model automatically, but E2E (which runs migrations via `e2e/bin/run-e2e.sh`) and real deployments need the migration.
- Migration naming is `YYYYMMDDHHMMSS-descriptive-name.js`; a minimal reference is [backend/migrations/20251124000001-add-defer-until-to-tasks.js](backend/migrations/20251124000001-add-defer-until-to-tasks.js).
- Request-body normalization lives in [backend/modules/tasks/core/parsers.js](backend/modules/tasks/core/parsers.js) — `parsePriority` returns `null` for `undefined` and silently coerces unknown strings to `0`, so **there is no existing API-level enum rejection to copy**; strict 400 validation for `size` is new code.
- Attribute assembly lives in [backend/modules/tasks/core/builders.js](backend/modules/tasks/core/builders.js): `buildTaskAttributes` (line 127) always includes `priority`; `buildUpdateAttributes` (line 184) uses the `body.x !== undefined ? parse(body.x) : task.x` partial-update idiom (lines 198-201).
- `serializeTask()` in [backend/modules/tasks/core/serializers.js](backend/modules/tasks/core/serializers.js) spreads raw model JSON (lines 39-82), so a new model field is returned by `GET /api/tasks` and `GET /api/task/:uid` with no serializer change.
- Field validation in [backend/modules/tasks/utils/validation.js](backend/modules/tasks/utils/validation.js) uses throwing helpers; routes wrap each call in `try/catch` and return `res.status(400).json({ error: error.message })` — see [backend/modules/tasks/routes.js](backend/modules/tasks/routes.js) lines 439-478 (POST) and the equivalent PATCH block.
- `PATCH /api/task/:uid` is guarded by `requireTaskWriteAccess` and `GET /api/task/:uid` by `requireTaskReadAccess` ([backend/modules/tasks/middleware/access.js](backend/modules/tasks/middleware/access.js)), both built on `hasAccess` in [backend/middleware/authorize.js](backend/middleware/authorize.js), which returns `403 Forbidden` (not 404) for no-access and nonexistent resources. `POST /api/task` and `GET /api/tasks` use `requireAuth` only.
- Recurring detection in the backend is `task.recurrence_type && task.recurrence_type !== 'none' && !task.recurring_parent_id` for parents (routes.js lines 123-126) and `recurring_parent_id !== null` for instances. **No route currently rejects a PATCH purely because a task is recurring** — that rejection is new behavior.
- Frontend service is [frontend/utils/tasksService.ts](frontend/utils/tasksService.ts) (not `frontend/services/`); `updateTask(uid, data)` PATCHes and `handleAuthResponse` in [frontend/utils/authUtils.ts](frontend/utils/authUtils.ts) throws an `Error` carrying `body.error` plus `body.details`.
- The [Task entity](frontend/entities/Task.ts) has no `size` field and no permission/access field.
- **Priority has no inline control in list rows today** — [TaskItem.tsx](frontend/components/Task/TaskItem.tsx) only renders a colored left border (lines 28-51, 419-431) and `TaskHeader` renders `TaskPriorityIcon` inside a `hidden` wrapper ([TaskHeader.tsx](frontend/components/Task/TaskHeader.tsx) lines 200-207). A clickable list-row control is therefore net-new.
- `TaskHeader` already has a metadata chip row (lines 300-413 desktop, 463-570 mobile) with tag chips styled `rounded-full text-[10px]`, and already detects recurring tasks with `(task.recurrence_type && task.recurrence_type !== 'none') || task.recurring_parent_id` (lines 167-175, 378-406).
- The details-view priority control is a bespoke inline dropdown in [TaskDetailsHeader.tsx](frontend/components/Task/TaskDetails/TaskDetailsHeader.tsx) (state lines 72-76, click-outside 137-160, handler 231-234, markup 324-487) — it does **not** use the shared portal-based [PriorityDropdown](frontend/components/Shared/PriorityDropdown.tsx).
- The save pattern to mirror is `handlePriorityUpdate` in [TaskDetails.tsx](frontend/components/Task/TaskDetails.tsx) lines 1188-1208: `updateTask` → `fetchTaskByUid` → `tasksStore.updateTaskInStore` → success toast, error toast + rethrow on failure.
- Cross-view sync is Zustand ([frontend/store/useStore.ts](frontend/store/useStore.ts), `updateTaskInStore` lines 611-628). No React Query, no event bus. Some list views (`Tasks.tsx`, `ViewDetail`, Kanban) keep local task arrays and do not always write to the store; `TasksToday` does both.
- Toasts come from `useToast()` in [frontend/components/Shared/ToastContext.tsx](frontend/components/Shared/ToastContext.tsx).
- i18n loads `public/locales/{{lng}}/translation.json` with **25 locales** ([frontend/i18n.ts](frontend/i18n.ts) lines 46-72). English `priority.*` is at [public/locales/en/translation.json](public/locales/en/translation.json) lines 731-736; `task.priorityUpdated` / `task.priorityUpdateError` at lines 985-986.
- Backend tests: Jest + Supertest under [backend/tests/integration/](backend/tests/integration/), isolated SQLite per worker, `sequelize.sync({ force: true })`, helpers `createTestUser` / `authenticateUser` in [backend/tests/helpers/testUtils.js](backend/tests/helpers/testUtils.js). `permissions-tasks.test.js` covers cross-user 403 only; genuine `ro`/`rw` share setup lives in [backend/tests/integration/project-sharing.test.js](backend/tests/integration/project-sharing.test.js) (lines 51-57 share creation, 255-276 an `ro` → 403 case).
- E2E is Playwright under [e2e/tests/](e2e/tests/) with per-test UI login and API seeding via `context.request.post('/api/task')`; row selector convention is `task-item-${task.id}` (see [e2e/tests/today-view.spec.ts](e2e/tests/today-view.spec.ts)).
- Commands: `npm run backend:test:integration`, `npm run frontend:test`, `npm run test:ui`, `npm run lint`, `npm run db:migrate`, `npm run migration:create -- --name <name>`. There is no standalone typecheck script; `tsc --noEmit` runs inside `frontend:build`.

### Assumptions

1. **Read-only gating (decided with the user):** no client-side permission gating. The size control renders for everyone; a `403` from the PATCH surfaces an error toast and the value reverts. This matches every other control in the app today (`TaskItem` already toasts `errors.permissionDenied` on a rejected delete) and avoids adding per-task access resolution to list serialization. AC-13 is verified as "the change never persists and the UI reverts", not as a `disabled` attribute.
2. **Unset badge (decided with the user):** every non-recurring row always renders the size chip, showing a subtle dash when unset, so the control is always reachable.
3. Allowed values are the exact uppercase strings `'S' | 'M' | 'L' | 'XL'`, plus `null` to clear. Anything else — including lowercase, `''`, numbers, booleans, and arrays — is rejected with `400`. `undefined` (field absent) means "leave unchanged" and stays valid, preserving backward compatibility.
4. Recurring rejection applies to both parents (`recurrence_type !== 'none'` without a `recurring_parent_id`) and instances (`recurring_parent_id` set), and is evaluated on the task's effective post-update recurrence state so that a request adding recurrence and a size in one call is also rejected.
5. `size` is stored as a plain nullable `STRING` with application-level validation, plus a defensive `isIn` validator on the model so direct Sequelize writes cannot introduce garbage.
6. A single new shared component (working name `SizeDropdown`) is introduced under `frontend/components/Shared/` and reused by both the list chip and the details header, following the portal pattern of `PriorityDropdown` so the menu escapes row overflow. The details header wires it in next to the priority block rather than hand-rolling a second bespoke dropdown.
7. The list-row save reuses the existing `onTaskUpdate` callback chain (`onTaskUpdate({ ...task, size })`), which is exactly how `TaskStatusControl` already saves from a row. No new prop plumbing through `TaskItem` beyond passing the callback that is already there.
8. New English keys go under a `size.*` namespace (`size.none`, `size.s`, `size.m`, `size.l`, `size.xl`, `size.label`) plus `task.sizeUpdated` / `task.sizeUpdateError`. English is authored now; the other 24 locales fall back to English via i18next until a translation sync — per `agent.md`, bulk locale changes are an approval gate.
9. `POST /api/task` accepts `size` but the create form UI is untouched.
10. New `data-testid` hooks are added for E2E: `task-size-badge-${task.id}` on the row chip, `task-size-dropdown` in the details header, and `task-size-option-${value}` on menu items.

### Files / Modules Involved

**Backend**

- [backend/models/task.js](backend/models/task.js) — add nullable `size` STRING with an `isIn` validator; add a `Task.SIZE` constant map and an `ALLOWED_SIZES` export.
- `backend/migrations/<timestamp>-add-size-to-tasks.js` — new, forward-only, via `safeAddColumns`.
- [backend/modules/tasks/core/parsers.js](backend/modules/tasks/core/parsers.js) — `parseSize` (pass-through/normalize only; rejection lives in validation).
- [backend/modules/tasks/core/builders.js](backend/modules/tasks/core/builders.js) — include `size` in `buildTaskAttributes` and in `buildUpdateAttributes` using the `!== undefined` idiom.
- [backend/modules/tasks/utils/validation.js](backend/modules/tasks/utils/validation.js) — `validateSize(body)` and `validateSizeNotOnRecurringTask(body, task)`, both throwing.
- [backend/modules/tasks/routes.js](backend/modules/tasks/routes.js) — call the validators in `POST /api/task` and `PATCH /api/task/:uid` inside the existing 400 `try/catch` style.
- No change needed in [serializers.js](backend/modules/tasks/core/serializers.js) (spread) or [access.js](backend/modules/tasks/middleware/access.js).

**Frontend**

- [frontend/entities/Task.ts](frontend/entities/Task.ts) — `size?: SizeType`, `export type SizeType = 'S' | 'M' | 'L' | 'XL' | null`.
- `frontend/components/Shared/SizeDropdown.tsx` — new shared control (badge trigger + portal menu + clear option), modeled on [PriorityDropdown.tsx](frontend/components/Shared/PriorityDropdown.tsx).
- [frontend/components/Task/TaskHeader.tsx](frontend/components/Task/TaskHeader.tsx) — render the chip in the metadata row for non-recurring tasks (desktop and mobile), gated by the existing recurring check; stop click propagation so it does not open task details.
- [frontend/components/Task/TaskDetails/TaskDetailsHeader.tsx](frontend/components/Task/TaskDetails/TaskDetailsHeader.tsx) — `onSizeUpdate` prop and the control next to priority, hidden for recurring tasks.
- [frontend/components/Task/TaskDetails.tsx](frontend/components/Task/TaskDetails.tsx) — `handleSizeUpdate` mirroring `handlePriorityUpdate` (lines 1188-1208).
- [public/locales/en/translation.json](public/locales/en/translation.json) — `size.*` and `task.size*` keys.
- No change to [frontend/utils/tasksService.ts](frontend/utils/tasksService.ts).

**Tests**

- [backend/tests/integration/tasks.test.js](backend/tests/integration/tasks.test.js) — CRUD, validation, recurring rejection, independence from priority, subtask default.
- [backend/tests/integration/project-sharing.test.js](backend/tests/integration/project-sharing.test.js) — `ro` → 403, `rw` → 200 on a size PATCH.
- `backend/tests/unit/models/task.test.js` — model-level `isIn` rejection (optional, cheap).
- `e2e/tests/task-size.spec.ts` — new spec for the user flow.

### Implementation Plan

Dependency-ordered; each step ends with the system working and testable. Tests precede the implementation they cover.

**Step 1 — Persistence (model + migration).**
Add the nullable `size` column to the Sequelize model with a defensive allowed-value validator, plus the `Task.SIZE` constant map. Create the forward-only migration with `safeAddColumns` (no backfill, no index — nothing sorts or filters on size). Verify by running `npm run db:migrate` against a scratch DB and re-running it to confirm idempotency, and by confirming `sequelize.sync` picks the field up so the test suites see the column without migrating.

**Step 2 — Failing API tests for the happy path (AC-2, AC-3, AC-4, AC-14, AC-15).**
Extend `tasks.test.js` with cases asserting: `POST /api/task` persists and echoes a supplied `size`; `POST` without `size` yields `size: null`; `PATCH` sets each of S/M/L/XL; `PATCH` with `size: null` clears it; `PATCH` with no `size` key leaves an existing size untouched (backward compatibility); `GET /api/task/:uid` and `GET /api/tasks` include the field; changing `size` leaves `priority` untouched and vice versa; a subtask created under a sized parent has `size: null`. These fail before Step 3.

**Step 3 — Wire `size` through the read/write pipeline.**
Add `parseSize` to `parsers.js`, then thread `size` into `buildTaskAttributes` (create) and `buildUpdateAttributes` (partial update, `!== undefined` guard so omission preserves the stored value and an explicit `null` clears it). `serializeTask` needs no change. Step 2 goes green with no validation yet.

**Step 4 — Failing API tests for validation and recurring rejection (AC-1, AC-5, AC-6).**
Add cases asserting `400` with a descriptive `error` message for `"XXL"`, `"s"` (lowercase), `""`, a number, and a non-string; assert the task is unmodified afterwards by re-reading it. Add cases asserting `400` when `size` is sent on a recurring parent, on a recurring instance, and in the same request that first adds recurrence. Add positive control cases proving requests that omit `size` on recurring tasks still succeed, so existing recurring behavior is provably untouched (AC-17).

**Step 5 — Implement validation.**
Add the two throwing helpers to `validation.js` and call them from `POST` and `PATCH` in `routes.js`, inside the established `try { … } catch (error) { return res.status(400).json({ error: error.message }); }` blocks. Place the calls before persistence so a rejected request never mutates the task. Order matters: run size validation ahead of the existing defer/due and project/area checks only if it does not change existing error precedence for requests that violate several rules at once — otherwise append it after, and assert the chosen precedence in a test.

**Step 6 — Failing permission tests (AC-7).**
In `project-sharing.test.js`, add: an `rw` collaborator successfully PATCHes `size` on a task in the shared project; the same user demoted to `ro` receives `403 Forbidden`; an unauthenticated request receives `401`; a PATCH against a nonexistent task uid receives `403`. These should pass immediately, since `requireTaskWriteAccess` already guards the route — they are regression locks confirming the new field inherits existing authorization rather than bypassing it.

**Step 7 — Type and localization groundwork.**
Add `SizeType` and `size` to the `Task` entity, and the English `size.*` / `task.sizeUpdated` / `task.sizeUpdateError` keys. Confirm `npm run frontend:build` typechecks. Flag the 24 remaining locales to the user as a separate approval-gated sync rather than machine-translating them here.

**Step 8 — Shared `SizeDropdown` component.**
Build the control as a badge-styled trigger (size letter, or a dash when unset) plus a portal-rendered menu of S / M / L / XL and a clear option, with a checkmark on the current value, click-outside and Escape to close, and keyboard focus handling. It takes `value`, `onChange`, and an optional `testIdSuffix`, holds only open/close state, and delegates persistence to the caller. Follow `PriorityDropdown`'s portal approach so the menu is not clipped by row overflow, and keep the component pure per `.cursor/rules/react.mdc`.

**Step 9 — Task details integration (AC-10, AC-11, AC-12).**
Add `handleSizeUpdate` to `TaskDetails.tsx` mirroring `handlePriorityUpdate` — `updateTask(uid, { size })` → `fetchTaskByUid` → `tasksStore.updateTaskInStore` → success toast; on failure, error toast and rethrow. Because the header reads `size` straight off the store-backed `task`, a failed save reverts on its own with no local rollback state, exactly as priority behaves today. Add the `onSizeUpdate` prop and render `SizeDropdown` immediately after the priority block in `TaskDetailsHeader`, hidden when the task is recurring. Verify manually that a change persists across a reload and that a forced `400` shows the error toast and leaves the displayed value unchanged.

**Step 10 — Task list integration (AC-8, AC-9).**
Render the chip in `TaskHeader`'s metadata row (both desktop and mobile layouts) for non-recurring tasks only, reusing the existing recurring predicate, and include it in the `hasMetadata` condition so a row with nothing but a size still renders the row. Save via the existing `onTaskUpdate({ ...task, size })` chain — the same path `TaskStatusControl` already uses. Stop click and keydown propagation on the chip so interacting with it does not navigate into task details. Add the `data-testid` hooks.

**Step 11 — Cross-view sync check (AC-12).**
Walk the list views that keep local task arrays (`Tasks.tsx`, `ViewDetail`, `TasksToday`, `AreaDetails`, Kanban) and confirm each one's `handleTaskUpdate` both persists the server response into its local state and calls `tasksStore.updateTaskInStore`, adding the store call where it is missing so a size set in details is reflected in the list and vice versa without a refresh. Keep this strictly additive — do not refactor these views' update flows, which is out of scope per `agent.md`.

**Step 12 — E2E coverage (AC-8, AC-9, AC-10, AC-11, AC-12, AC-13).**
Add `e2e/tests/task-size.spec.ts` following `today-view.spec.ts`: UI login, seed a non-recurring task and a recurring task via `context.request.post('/api/task')`, then assert the chip shows a dash when unset, set a size from the row and confirm it persists after a reload, open details and confirm the same value, change it in details and confirm the list reflects it without a refresh, clear it back to unset, and confirm no chip or dropdown appears for the recurring task. Clean up created tasks via `context.request.delete`.

**Step 13 — Full verification pass.**
Run `npm run backend:test`, `npm run frontend:test`, `npm run test:ui`, and `npm run lint`, plus `npm run frontend:build` for the typecheck. Confirm every pre-existing integration and E2E suite named in the spec passes with no modifications (AC-17), and confirm on a copy of a populated database that migrating leaves all existing rows with `size = NULL` and no other column altered (AC-16).

### Risks

- **Migration vs. `sync()` divergence.** Because integration tests build the schema from the model rather than from migrations, a broken or forgotten migration would still leave Jest green and only fail in E2E and production. Mitigation: explicitly run `npm run db:migrate` twice against a scratch DB in Step 1 and rely on the E2E suite, which does migrate.
- **Full-object PATCH from list rows.** Saving via `onTaskUpdate({ ...task, size })` sends the whole task, which passes through `handleRecurrenceUpdate` and the defer/due validators. For non-recurring tasks (the only ones with a chip) this is a no-op, and it is the pattern status changes already use — but a task with an odd stored `defer_until`/`due_date` combination could now fail validation on a size change. Worth a manual probe; if it bites, send a minimal `{ size }` payload from the row instead.
- **Validation ordering.** Inserting size validation into `POST`/`PATCH` can change which error a multi-violation request returns. Mitigation: assert the chosen precedence in Step 5 and keep existing error messages byte-identical.
- **Rejecting size on recurring tasks is new behavior.** No route rejects a PATCH purely for being recurring today, so the predicate must be precise or it will break unrelated recurring updates. Mitigation: the positive-control tests in Step 4 plus the untouched `recurring-tasks.test.js`.
- **List-view state fragmentation.** Several views hold local task arrays and do not consistently write to Zustand, so AC-12 is the most likely criterion to fail in a specific view. Mitigation: the explicit audit in Step 11, kept additive.
- **AC-13 is met behaviorally, not structurally.** Per the agreed approach, `ro` users can click the control; the save is rejected server-side and the UI reverts. If a truly disabled control is later required, it needs a `can_edit` field on task serialization — a follow-up, and an approval gate since it changes the API contract.
- **Locale debt.** 24 locales will show English strings until a translation sync, which `agent.md` treats as an approval gate.
- **Overflow and stacking.** A dropdown inside a task row risks clipping and z-index issues, especially in Kanban columns and on mobile. Mitigation: the portal pattern from `PriorityDropdown`.

### Out Of Scope

Everything the spec excludes: filtering, sorting, or grouping by size; bulk size editing; size in the Kanban card body (the chip appears wherever `TaskHeader` renders, but no Kanban-specific treatment is added); reporting, analytics, or AI suggestions on size; CalDAV sync; timeline/audit entries for size changes; exposing size in the task creation form UI; task duplication; ordinal or numeric semantics.

Additionally out of scope for this implementation: adding `can_edit`/`access_level` to task serialization; refactoring list views' update flow beyond the additive store sync in Step 11; translating the 24 non-English locales; changing how `priority` is parsed or validated; and any index or backfill on the new column.

### Verification

- **AC-1** — A task's size can be set to S, M, L, XL, or unset (`null`); no other values accepted. Verifiable by: Automated Test (API integration, `tasks.test.js`) plus a model-level unit test.
- **AC-2** — `PATCH /api/task/:uid` accepts `size` as `"S"`/`"M"`/`"L"`/`"XL"` or `null` to clear. Verifiable by: Automated Test (API integration).
- **AC-3** — `POST /api/task` accepts an optional `size` in the body. Verifiable by: Automated Test (API integration).
- **AC-4** — `GET /api/task/:uid` and `GET /api/tasks` return `size`. Verifiable by: Automated Test (API integration).
- **AC-5** — `400 Bad Request` on an invalid size value, task unmodified. Verifiable by: Automated Test (API integration, one case per invalid input class, with a follow-up read asserting no mutation).
- **AC-6** — `400 Bad Request` when size is sent on a recurring parent or instance. Verifiable by: Automated Test (API integration, including the add-recurrence-and-size-together case and positive controls).
- **AC-7** — Only `rw`/`admin` can change size; `ro` gets 403, unauthenticated gets 401. Verifiable by: Automated Test (API integration in `project-sharing.test.js`).
- **AC-8** — Size chip on each non-recurring row showing the letter or a dash. Verifiable by: E2E Test (`task-size.spec.ts`) and UI Check.
- **AC-9** — No chip or dropdown for recurring parents or instances. Verifiable by: E2E Test and UI Check.
- **AC-10** — Size dropdown next to priority in the details header for non-recurring tasks. Verifiable by: E2E Test and UI Check.
- **AC-11** — Change saves immediately with no separate save action, editable from both the row and details. Verifiable by: E2E Test.
- **AC-12** — Both views reflect a change without a page refresh. Verifiable by: E2E Test plus the manual store-sync audit from Step 11.
- **AC-13** — `ro` users see the chip but cannot change the value. Verifiable by: Automated Test (API 403 from AC-7) plus Manual Test confirming the error toast fires and the displayed value reverts. Note: implemented as server-rejected-and-reverted rather than a disabled control, per the agreed approach.
- **AC-14** — Size and priority are independent. Verifiable by: Automated Test (API integration, both directions).
- **AC-15** — Subtasks have an independent size defaulting to `null`. Verifiable by: Automated Test (API integration).
- **AC-16** — Existing tasks have `null` size after migration; no data altered. Verifiable by: Migration Check (`npm run db:migrate` on a copy of a populated database, then inspect the `tasks` schema and row counts, and re-run to confirm idempotency).
- **AC-17** — All existing integration and E2E tests pass unmodified. Verifiable by: Automated Test (CI) — `npm run backend:test`, `npm run frontend:test`, `npm run test:ui`, `npm run lint`, `npm run frontend:build`, with a diff check confirming no pre-existing test file was edited.