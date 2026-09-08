# Context map: Task size (S / M / L / XL)

Inspection only. Current branch at time of mapping: `if/mk2` (clean, tracks `origin/if/mk2`). No size field exists yet in runtime code on this branch.

---

## Hot context

### Specifications and plan

| Resource | Role |
| --- | --- |
| [`docs/task-size-spec.md`](./task-size-spec.md) | Approved product/technical spec: problem, current behavior, expected behavior, flows, edge cases, error handling, out-of-scope, NFRs, AC-1–AC-29, assumptions |
| [`docs/task-size-plan.md`](./task-size-plan.md) | Implementation plan derived from the spec; grounded in concrete file/line references; phases 0–7; risks; verification mapping |

Only docs under `docs/` at mapping time (besides this file) are the spec and plan.

### Explicitly stated requirements (sources)

**User story acceptance criteria:**

- Size: S / M / L / XL / unset
- Editable via dropdown on task list and task details
- Change saves immediately and stays in sync across both views
- Optional and independent of priority
- Only users with edit permission can change size

**Full acceptance criteria (spec AC-1–AC-29):** much broader — API validation/rejection semantics, migration NULL + idempotency, optimistic UI + revert, field-scoped PATCH, timeline (including unset transitions), recurrence non-destruction, duplication, keyboard/a11y/RTL, locale parity across 25 files, OpenAPI contract, sequencing, etc.

**Notable plan resolution vs spec wording:** the spec’s “creation form” placement does not exist in this codebase; the plan treats **task details as the creation surface** (two placements: list + details). Spec assumption 11 (duplication module uncommitted) is marked resolved in the plan (`duplicateTask` committed at `236d4cd`).

### Active files directly involved (as named by plan/spec; present on this branch)

**Frontend**

- `frontend/components/Task/TaskHeader.tsx` — shared list row (desktop/mobile trees, `role="button"` navigation, `pr-56` / status cluster)
- `frontend/components/Task/TaskItem.tsx`, `TaskList.tsx`, `GroupedTaskList.tsx` — row prop plumbing / gating
- `frontend/components/Task/TaskStatusControl.tsx` — only existing inline row editor (click stopPropagation; no keyboard guards)
- `frontend/components/Task/TaskDetails/TaskDetailsHeader.tsx` — hand-written priority dropdown pattern
- `frontend/components/Task/TaskDetails.tsx` — update → refetch → store → timeline refresh → toast chain
- `frontend/components/Task/TaskTimeline.tsx` — field-change rendering
- `frontend/entities/Task.ts` — no `size` attribute today
- `frontend/utils/tasksService.ts` — `updateTask(uid, Partial<Task>)` already supports partial bodies
- `frontend/utils/duplicateTask.ts` (+ `.test.ts`) — explicit allowlist; copies priority; **does not copy size yet**
- List parents holding local task state (plan): `Tasks.tsx`, project/tag/area/Kanban/Eisenhower views; Today/details use store

**Backend**

- `backend/models/task.js` — priority/status integer enums + converters (size absent)
- `backend/models/task_event.js` — `event_type` / `field_name` allowlists (no `size` / `size_changed`)
- `backend/modules/tasks/core/parsers.js`, `builders.js` — explicit field mapping (unnamed fields discarded)
- `backend/modules/tasks/routes.js` — create/update; flat error shape today
- `backend/modules/tasks/utils/logging.js` — change capture; swallowing wrapper around timeline writes
- `backend/modules/tasks/middleware/access.js` — `requireTaskWriteAccess`
- `backend/modules/tasks/operations/recurring.js` — template fields `name`, `project_id`, `priority`, `note` (size must stay off this list per spec/plan)
- `backend/modules/tasks/operations/subtasks.js` — narrower create allowlist (plan: leave size out)
- `backend/utils/migration-utils.js`, `backend/migrations/*`, `backend/scripts/db-migrate.js` — Umzug + `safeAddColumns` pattern
- `backend/tests/helpers/setup.js` — `sequelize.sync({force: true})` (no migration-based harness today)
- `backend/config/swagger.js`, `backend/docs/swagger/tasks.js` — OpenAPI

**i18n / e2e**

- `public/locales/*/translation.json` × **25** locales (`ar`…`zh`); priority keys exist; no size keys on this branch
- `linguaisync.config.js`, CONTRIBUTING translation sync/check commands
- `e2e/tests/` (e.g. `today-view.spec.ts` seeding pattern cited by plan)

### Logs / errors / reproduction evidence

- Dev server running (`npm run start`); recent terminal traffic is login/settings/OIDC — **no task-size errors, failures, screenshots, or repro notes** tied to this feature.
- No agent transcripts found for this project folder at mapping time.
- Feature appears **specified but not implemented on `if/mk2`** (`size` absent from `Task.ts` / `task.js` / locales / no `SizeControl`).

---

## Warm context

### Repo guidance / conventions

- **No `AGENTS.md`**, no `.cursor/rules`, no ADR directory found.
- [`.github/CONTRIBUTING.md`](../.github/CONTRIBUTING.md): feature PRs need prior discussion/issue; branch naming; TypeScript for new code; ESLint/Prettier; React hooks; Sequelize; migrations via `npm run migration:*`; tests expected for features; translations: author English then `translations:sync` / `translations:check`.
- README: product overview (tasks/projects/areas/tags, recurrence, priority sorting) — background only; no size feature listed.

### Architectural / behavioral constraints already documented (spec + plan)

- Priority and size are independent; size must not coerce like priority.
- Wire/storage: bounded integers `S=1…XL=4`, SQL `NULL` = unset; **never use `0`** (falsy discarded in timeline encoding).
- Size change must PATCH **only** `{ size }` (full-object updates risk recurrence template path).
- Auth: server-only; no new permission field on task responses; out of scope to fix project-`rw` overriding task-`ro`.
- Cross-view sync via existing refetch-on-navigation; no websockets/SSE/polling.
- One shared size control (chip + form variants); do not reuse the two divergent priority dropdowns.
- Lists mostly use local state, not Zustand (except details/Today).
- Timeline allowlists must include size or events fail silently under a swallowing catch.
- Duplication is frontend-only allowlist (`duplicateTask.ts`); no backend duplicate endpoint.
- Out of scope includes sort/filter by size, Kanban/Eisenhower/search chips, subtask size UI, MCP/CalDAV/import, analytics, backfill.

### Dependencies / invariants called out

- Existing write guard covers updates (verification, not new auth).
- `tasksService.updateTask` already accepts partials.
- Migration must use `safeAddColumns`, nullable, **no column default**.
- 25 locale files + inline English fallbacks make missing keys invisible without a parity check.
- Layout constraint: desktop row reserves ~224px (`pr-56`) for status; chip placement assumption to be validated (plan Phase 0).

---

## Cold context (background; useful if needed later)

| Area | Why it might matter |
| --- | --- |
| Sibling branch `if/mk2-done` / `origin/if/mk2-done` | Commit `0f76d54` (“Add size attribute…”) touches ~57 files matching the plan’s file list (`SizeControl.tsx`, migration, tests, locales, e2e). Diverged from `if/mk2` (this branch has duplication refactor `04c6c5b`; done branch has the size commit). Historical reference only relative to current checkout. |
| Priority UI precedents | `TaskDetailsHeader` priority dropdown; dead `Shared/PriorityDropdown.tsx` / `TaskForm/TaskPrioritySection.tsx` (plan: used by projects, not task create) |
| Create path | `NewTask.tsx` (name-only); `Layout.tsx` stub-create → navigate to details |
| Views sharing `TaskItem` | Kanban, Eisenhower, nested subtasks — plan gates chip via prop |
| `AreaDetails` update path | Plan notes it mutates local state without API (pre-existing; size chip designed to bypass) |
| Unrelated size commits | UI “checkbox size” / “Decrease size” PRs — not effort-size |
| CalDAV / MCP / backup / search / metrics modules | Explicitly out of scope for this feature |
| GitHub issues/Discussions | Not inspected; CONTRIBUTING says features need prior discussion — ticket link not in the provided materials |
| Monitoring / incidents | None found related to task size |

---

## Resources treated as irrelevant (not inspected deeply)

- Vendored/`node_modules`, generated build output
- Unrelated feature areas (habits, notes-only flows, AI assistant, CalDAV conflict UI) except where plan names them as out of scope
- Deprecated docs: none found beyond the two current size docs
- Generic README screenshots and philosophy articles

---

## Gaps / contradictions (flagged, not resolved)

1. **User-story AC vs full spec AC** — story lists 5 criteria; spec/plan bind 29. Story does not mention timeline, creation, keyboard, migration, OpenAPI, optimistic sequencing, etc.
2. **Spec “three placements” vs plan “two placements”** — creation form does not exist; details substitutes.
3. **Spec assumption 11 (duplication WIP)** vs plan/current tree — `duplicateTask` is committed; size still missing from its allowlist.
4. **Spec “no new event-type code expected”** vs plan — `TaskEvent` allowlists must be extended or timeline logging fails silently.
5. **“Edit permission” on the client** — AC says only editors can change size; current product has **no access-level field on task responses**; read-only UX is server rejection (spec/plan keep that).
6. **Implementation on another branch** — full size work exists on `if/mk2-done` but **not** on the inspected `if/mk2` working tree.
7. **No AGENTS.md / ADRs** — warm guidance is CONTRIBUTING + the size docs themselves.
8. **No feature-specific runtime evidence** — no bugs, screenshots, or failing tests attached to the inspection session.
