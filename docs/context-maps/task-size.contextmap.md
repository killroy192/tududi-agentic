# Context Map

**Feature:** Task Size (S / M / L / XL)  
**Jira:** [KAN-15](https://epam-team-ai-adoption.atlassian.net/browse/KAN-15) — MK2/MK6: Task size estimate (To Do)  
**Story (Jira AC):** optional size S/M/L/XL/unset; dropdown on list + details; immediate save; sync across views; independent of priority; edit permission required

## Hot context

Directly required for the feature right now:

* Current spec and plan
  * [docs/task-size-spec.md](../task-size-spec.md) — full product/tech spec, edge cases, ACs AC-1…AC-29, NFRs (encoding `S=1…XL=4`, NULL unset, reject-not-coerce, field-scoped PATCH)
  * [docs/task-size.plan.md](../task-size.plan.md) — confirmed facts, steps 0–13 (layout spike → e2e), risks, out of scope, AC verification table
  * [KAN-15](https://epam-team-ai-adoption.atlassian.net/browse/KAN-15) — thin story AC; treat the markdown spec as the binding detail set
* Active files
  * **Backend — model / persistence:** `backend/models/task.js`; `backend/utils/migration-utils.js` (`safeAddColumns`); new migration under `backend/migrations/`
  * **Backend — API mapping:** `backend/modules/tasks/core/builders.js` (`buildTaskAttributes` / `buildUpdateAttributes`); `backend/modules/tasks/core/parsers.js`; `backend/modules/tasks/operations/subtasks.js` (wire-through only); `backend/modules/tasks/routes.js` + `backend/modules/tasks/middleware/access.js` (`requireTaskWriteAccess`)
  * **Backend — timeline / recurrence:** `backend/modules/tasks/utils/logging.js`; `backend/modules/tasks/taskEventService.js` (generic field-change path; do not use dead `logPriorityChange`); `backend/modules/tasks/operations/recurring.js` (size must stay off template-change set: `name`, `project_id`, `priority`, `note`)
  * **Backend — docs/tests:** `backend/config/swagger.js`, `backend/docs/swagger/tasks.js`; tests under `backend/tests/unit/models/`, `backend/tests/unit/modules/tasks/`, `backend/tests/integration/`
  * **Frontend — types / service:** `frontend/entities/Task.ts`, `frontend/entities/TaskEvent.ts`; `frontend/utils/tasksService.ts` (partial PATCH); `frontend/utils/duplicateTask.ts`
  * **Frontend — UI surfaces:** new shared size control (not reusing priority dropdowns); `frontend/components/Task/TaskItem.tsx`, `TaskHeader.tsx`, `TaskStatusControl.tsx` (nav/propagation precedent); `TaskDetails.tsx`, `TaskDetails/TaskDetailsHeader.tsx` (details + `isNew` create); `TaskTimeline.tsx`
  * **Frontend — list/state parents:** Tasks page and project/tag/area/view detail pages (local task state); `TasksToday.tsx` + Zustand store paths used by details/Today
  * **i18n:** `public/locales/*/translation.json` (25 locales)
* Logs/screenshots
  * None attached yet — capture after Step 0 layout spike (crowded row at 320 / 375 / 768 / 1440) and for AC-24/AC-25/AC-26 manual passes
  * Timeline / permission failure toasts during AC-7 / AC-17 verification

## Warm context

Reusable guidance relevant to the feature:

* AGENTS.md / rules / skills
  * No root `AGENTS.md` in this repo
  * [.cursor/rules/playwright.mdc](../../.cursor/rules/playwright.mdc) and [.cursor/rules/playwright-mock-data.mdc](../../.cursor/rules/playwright-mock-data.mdc) — e2e for list→details size sync (plan Step 13)
  * [.cursor/rules/atlassian-jira-kan.md](../../.cursor/rules/atlassian-jira-kan.md) — KAN project / read-only Atlassian MCP scope
  * [.cursor/skills/create-context-map/SKILL.md](../../.cursor/skills/create-context-map/SKILL.md) — this artefact
  * [.cursor/skills/plan/SKILL.md](../../.cursor/skills/plan/SKILL.md) — plan already produced
  * [.cursor/skills/verification/SKILL.md](../../.cursor/skills/verification/SKILL.md) — next artefact after implementation (verification plan)
* Team conventions
  * Priority/status pattern: bounded integers, string|int inbound, integer outbound via serializer spread — size follows wire shape but **rejects** invalid values (unlike priority coercion to `0`)
  * Explicit per-field builders (unnamed fields silently discarded) — size must be mapped deliberately
  * List views: local component state + refetch-on-navigation; details/Today: Zustand — do not migrate lists onto the store for this feature
  * Inline English translation fallbacks — missing locale keys are invisible; AC-27 key-presence check is mandatory
  * One shared control with presentation variants; dual priority UIs (`TaskDetailsHeader` bespoke vs `PriorityDropdown` / `TaskPrioritySection`) are a drift warning, not a reuse pattern
  * Create path for attributes: Task Details `isNew` (orphaned TaskForm create sections are not the live path unless revived)
* ADRs
  * None found under `docs/` for this feature; binding decisions live in the spec/plan (encoding, field-scoped PATCH, no recurrence template membership, server-only auth)
* Known constraints
  * Encoding: `S=1, M=2, L=3, XL=4`; SQL `NULL` = unset; **never `0`** (event logger drops falsy; `|| default` paths)
  * Size-only PATCH required — full-object list updates risk spurious recurring template-change deletes
  * Timeline isolation must remain deliberate (underlying log can re-throw)
  * No client-side permission UI; server rejects RO writes with existing message
  * Duplication allowlist already committed in `frontend/utils/duplicateTask.ts` (AC-20 can depend on it)
  * Separate defects (not this ticket): destructive recurrence template propagation; project-`rw` overriding task-`ro`; broad OpenAPI status/priority cleanup

## Cold context

Investigate only if needed:

* Relevant repo areas
  * Kanban / Eisenhower card components — confirm no accidental size chip (out of scope)
  * Sort/filter/query builders and search chips — must stay size-unaware
  * MCP tools, CalDAV, import/export mappings — out of scope exposure
  * `frontend/components/Task/TaskForm/` and `Shared/PriorityDropdown.tsx` — only if create UI resurrects mid-flight (AC-13 drift risk)
  * Subtask create/update builders — model may accept size; no subtask size UI
  * Access middleware edge cases around share precedence — inherited defect; verify RO rejection only
* Documentation
  * Existing OpenAPI Task schema inaccuracies (status/priority) — touch only as needed for size accuracy (AC-28)
* Past PRs
  * None linked from KAN-15; search history if duplication or task-event logging patterns are unclear
* Monitoring/logs
  * No product analytics for size adoption (explicitly out of scope); rely on timeline events and test evidence
* Story tickets
  * [KAN-15](https://epam-team-ai-adoption.atlassian.net/browse/KAN-15) parent story; file separate KAN defects for recurrence destruction and access-precedence if not already filed
  * Related board: [KAN board](https://epam-team-ai-adoption.atlassian.net/jira/software/projects/KAN/boards/1)

## Resources to ignore

* Deprecated documentation
  * Any superseded drafts of task-size context/plan under other names (git shows prior `docs/task-size-context-map.md` / `docs/task-size-plan.md` deleted — prefer current `task-size-spec.md` + `task-size.plan.md` + this map)
* Generated files
  * Build artefacts, coverage reports, compiled bundles, generated OpenAPI dumps not checked into the intentional swagger sources
* Unrelated modules
  * Life-balance / burndown / runway / radar charts under `frontend/components/Task/`
  * Attachments, deferred/due schedulers, task summary services unless they accidentally strip unknown fields
  * Non-task domains (notes, inbox, admin) and features listed under Out Of Scope in the plan (bulk edit, realtime sync, configurable scales, quick-add syntax, priority appearance changes)
