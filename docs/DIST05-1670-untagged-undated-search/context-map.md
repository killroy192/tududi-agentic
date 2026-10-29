# Context Map

Case: `DIST05-1670`

## Hot context

Directly required to implement or verify this case right now. Spec, plan, and the files those documents name.

| Resource | Why |
|----------|-----|
| `docs/DIST05-1670-untagged-undated-search/spec.md` | States the `no_tags` and `no_due_date` extras, mutual exclusion, Smart View rules, and acceptance criteria. |
| `docs/DIST05-1670-untagged-undated-search/plan.md` | Names the files to change, the tests to extend, and the modules that already pass extras through. |
| `public/locales/en/translation.json` | Holds the English labels `search.extrasFilter.hasNoTags` (“has no Tags”) and `search.extrasFilter.hasNoDueDate` (“has no Due Date”). |
| `frontend/components/UniversalSearch/SearchMenu.tsx` | Owns the Extras badges and the rules that clear conflicting tags, “has Tags,” a due window, and “is Overdue.” |
| `frontend/components/UniversalSearch/SearchResults.tsx` | Treats `no_tags` or `no_due_date` alone as enough to show results, and keeps the start-typing prompt for every other extra and for defer-until alone. |
| `frontend/components/UniversalSearch/SearchMenu.test.tsx` | Covers badge placement, mutual exclusion, the extras summary clause, and a save body that sends the new extras. |
| `frontend/components/UniversalSearch/SearchResults.test.tsx` | Covers leaving the start-typing prompt for an extras-only search that uses the new extras, and keeping that prompt for other extras and defer-until. |
| `backend/modules/search/service.js` | Applies `no_tags` and `no_due_date` to task and project conditions, including the paginated count. |
| `backend/tests/integration/search.test.js` | API coverage for absence matching, combinations, contradictions, other entity types, subtasks, and ownership. |
| `backend/tests/integration/views.test.js` | Covers storing and reading back `no_tags` and `no_due_date`, plus the existing blank-name failure. |
| `backend/modules/search/validation.js` | Parses the comma-separated `extras` query into a set, and unknown values stay ignored because there is no allow-list. |
| `backend/modules/search/repository.js` | Runs the task and project conditions and counts that the service builds. |
| `frontend/utils/searchService.ts` | Sends `extras` as a comma-separated query parameter on the existing universal-search request. |
| `backend/models/view.js` | Stores the extras list as JSON text on the existing `views.extras` column. |
| `backend/modules/views/` | Create and update already persist that extras list. |
| `frontend/components/ViewDetail.tsx` | Reopens a view with the stored extras, `excludeSubtasks`, the active-task default, and extras chips formatted from the stored names. |

## Warm context

Reusable guidance that constrains the work: AGENTS.md, rules, skills, conventions, known constraints from the spec or plan.

| Resource | Why |
|----------|-----|
| `AGENTS.md` | Sets module layout, English i18n as the source catalog, Jest commands, and the `docs/<TASK-ID>-<feature-slug>/` spec location. |
| `.cursor/rules/Atlassian-Jira-DIST05.mdc` | Keeps Jira read-only and limited to project DIST05, which is the project this case comes from. |
| `.cursor/skills/spec/SKILL.md` | Defines the spec format this case’s `spec.md` follows. |
| `.cursor/skills/plan/SKILL.md` | Defines the plan format this case’s `plan.md` follows. |

## Cold context

Background to open only if hot or warm is not enough: nearby modules, older tests, past PRs, the Jira story.

| Resource | Why |
|----------|-----|
| DIST05-1670 (Jira) | Original ticket, if the spec’s confirmed label and Extras-badge choices are not enough. |
| `frontend/components/UniversalSearch/FilterBadge.tsx` | Shared badge control the Extras group already uses. |
| `frontend/components/UniversalSearch/SaveViewModal.tsx` | Existing save dialog, including the blank-name message. |
| `frontend/components/UniversalSearch/UniversalSearch.tsx` | Parent shell around the search menu and results. |
| `backend/modules/search/controller.js` | HTTP handler for `GET /api/search`, after validation has parsed the query. |
| `backend/modules/search/routes.js` | Route registration for universal search. |
| `backend/models/task.js` | `Task.due_date` column, if the service condition needs the model definition. |
| `backend/models/project.js` | `Project.due_date_at` column, if the service condition needs the model definition. |
| `backend/models/index.js` | `tasks_tags` and `projects_tags` associations, if the absence check needs the join names. |
| `frontend/__tests__/setup.ts` | Jest setup for frontend unit tests, if a search-criteria test fails before it asserts criteria. |

## Resources to ignore

Deprecated docs, generated files, unrelated modules, and anything with no plausible connection.

| Resource | Why |
|----------|-----|
| `public/locales/` catalogs other than English | The spec leaves other locales on the English fallback. |
| `backend/modules/inbox/`, `backend/modules/telegram/`, `backend/modules/caldav/` | The spec places inbox, Telegram, and CalDAV out of scope. |
| `backend/migrations/` | This case adds no column and no migration. |
| `backend/modules/tasks/` | Task status and subtask display for a saved view stay on the view page and the search request. |
| `CONTRIBUTING.md` | Stale on route layout and the API port; `AGENTS.md` is the guide for this repo. |
| `node_modules/` and generated frontend bundles | Generated output, with no search-criteria source. |

## Gaps

Contradictions or missing context found while mapping. Do not resolve them here.

| Gap | Detail |
|-----|--------|
| View-page behavior has no named test file | AC-7, AC-8, and AC-12 require extras chips, the active-task default, and “No items found matching the view criteria.” The plan names no test for `ViewDetail.tsx` and assigns those checks to the manual walk. |
