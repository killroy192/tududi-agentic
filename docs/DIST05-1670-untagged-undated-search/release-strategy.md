# Release Strategy

Case: `DIST05-1670`. Spec and plan: `docs/DIST05-1670-untagged-undated-search/`. `verification.md` in that folder was not found. The change is uncommitted on `main` (`git status`); `git log -1` is `b914bfd fix linting`, which does not contain this diff.

### Change analysis

Blast radius: universal search for tasks and projects, plus the global-search criteria UI. `git diff --stat HEAD` shows 562 insertions across six tracked files:

- `backend/modules/search/service.js` — `no_tags` and `no_due_date` on task conditions (`buildTaskConditions`) and project conditions (`searchProjects`). The same condition objects are passed to `countTasks` / `findTasks` and `countProjects` / `findProjects`.
- `frontend/components/UniversalSearch/SearchMenu.tsx` — two Extras badges and mutual exclusion with tags, `has_tags`, the due window, and `overdue`.
- `frontend/components/UniversalSearch/SearchResults.tsx` — `no_tags` or `no_due_date` alone leaves the start-typing prompt.
- `public/locales/en/translation.json` — `search.extrasFilter.hasNoTags` and `search.extrasFilter.hasNoDueDate`.
- `backend/tests/integration/search.test.js` and `backend/tests/integration/views.test.js` — coverage for the new extras.

New untracked tests: `frontend/components/UniversalSearch/SearchMenu.test.tsx`, `frontend/components/UniversalSearch/SearchResults.test.tsx`.

Who depends on this: `GET /api/search` is mounted from `backend/modules/search` in `backend/app.js` after `requireAuth`. `frontend/components/ViewDetail.tsx` reopens a Smart View by sending the stored `extras` array with `excludeSubtasks: true` (around lines 443–449) and renders each extra with underscores turned into spaces (around lines 750–752). Notes, areas, and tags queries in `service.js` are outside this diff. `backend/modules/search/validation.js`, `backend/modules/search/repository.js`, `backend/models/view.js`, and `frontend/components/ViewDetail.tsx` are unchanged. Telegram, CalDAV, and inbox are absent from the diff.

Tests that cover the change: `backend/tests/integration/search.test.js` describe `Missing tags and due dates` (15 cases, including `returns untagged tasks and projects for no_tags` and `returns tasks and projects with an empty due date for no_due_date`); `backend/tests/integration/views.test.js` `should return saved no_tags and no_due_date extras unchanged`; `SearchMenu.test.tsx` and `SearchResults.test.tsx`. Command output from this review: `npm run backend:test -- tests/integration/search.test.js tests/integration/views.test.js` reported `Test Suites: 2 passed` and `Tests: 94 passed`. `npx jest` on the two frontend files reported `Test Suites: 2 passed` and `Tests: 17 passed`. `e2e/` has no match for these extras. `npm run test:ui` was not run. `npm run pre-push` is `lint-staged` in `package.json` and was not run.

Impact checklist:

| # | Question | True/False | Evidence |
|---|----------|------------|----------|
| 1 | Affects critical paths (auth, task or project writes, search)? | true | `GET /api/search` task and project filters change in `backend/modules/search/service.js` (`extras.has('no_tags')`, `extras.has('no_due_date')`). |
| 2 | Touches more than one user-facing surface (UI, API, Telegram, CalDAV)? | true | API (`service.js`) and global search UI (`SearchMenu.tsx`, `SearchResults.tsx`, `public/locales/en/translation.json`). Telegram and CalDAV files are absent from `git diff --stat`. |
| 3 | Affects data integrity or backward compatibility (migrations, irreversible writes)? | false | `git diff --stat` includes no file under `backend/migrations/`. Saved views keep using the existing `views.extras` JSON list; `views.test.js` reads `no_tags` and `no_due_date` back unchanged. |
| 4 | Affects security (authn/authz, secrets, input validation)? | false | `backend/app.js` still applies `requireAuth` before search routes. Task and project conditions still set `user_id: userId` (`service.js` lines 61 and 269). The `NOT EXISTS` SQL is a constant `sequelize.literal`. `validation.js` is unchanged. Test: `does not return another user's untagged tasks`. |
| 5 | Affects performance (hot paths, extra queries, added latency)? | true | When `no_tags` is selected, task and project search add a correlated `NOT EXISTS` against `tasks_tags` or `projects_tags`, and the paginated count uses those same conditions (`service.js` lines 155–160 and 305–310; `countTasks` / `countProjects`). `no_due_date` adds an `IS NULL` predicate on that same query. Searches that omit those extras do not add the subquery. |
| 6 | Affects an external contract (CalDAV, Telegram, webhooks)? | false | Spec and plan list Telegram and CalDAV as out of scope. Those modules are absent from the diff. |
| 7 | Reversible without data loss? | true | No migration. Reverting the code leaves `views.extras` strings in place. Unknown extras are ignored: `service.js` only applies extras it checks with `extras.has`, and `ignores an unknown extra` covers that pattern. |
| 8 | Covered by automated tests? | true | Backend: 94 passed in `search.test.js` and `views.test.js` via `npm run backend:test`. Frontend: 17 passed in `SearchMenu.test.tsx` and `SearchResults.test.tsx`. `npm run test:ui` was not run; `e2e/` has no match for this feature. |

### Release notes

A person using the app can select “has no Tags” and “has no Due Date” in global search Extras. Those badges keep tasks and projects that have no tags, or whose due date is empty, and they can be saved as a Smart View. Selecting “has no Tags” clears selected tags and “has Tags.” Selecting “has no Due Date” clears the due window and “is Overdue.” Notes, areas, and tags stay on their current search rules. Other locales keep their current catalogs and fall back to the new English strings.

An operator of this self-hosted instance ships the commit and restarts the Node process. There is no migration and no new environment variable. Keep the previous SQLite backup until the checks in Rollback pass. English copy is the two keys in `public/locales/en/translation.json`.

### Metrics

- Existing signals: not found in `backend/modules/search/` (no logger or counter). `searchController.search` returns `res.json(result)` and forwards failures with `next(error)` (`backend/modules/search/controller.js`). The UI logs `console.error('Search failed:', error)` in `frontend/components/UniversalSearch/SearchResults.tsx` (line 80). SQL logging via `enableQueryLogging` in `backend/middleware/queryLogger.js` is turned on only from `backend/modules/tasks/routes.js` when `NODE_ENV === 'development'`. It is not wired to `GET /api/search`. There is no metrics pipeline for search.
- Signals to add:
  - Row 1: none. A wrong absence filter fails `returns untagged tasks and projects for no_tags` and `returns tasks and projects with an empty due date for no_due_date` in `backend/tests/integration/search.test.js`.
  - Row 2: none. Criteria and prompt failures fail `SearchMenu.test.tsx` and `SearchResults.test.tsx`. A failed search request already prints `Search failed:` in `SearchResults.tsx`.
  - Row 5: none. The repo has no latency metric for search. The extra predicate runs only when the extra is selected, inside the existing find and count. A wrong result still fails the row 1 tests; a slow query would not show up on the task-route query logger.

### Rollback

- Trigger conditions: `GET /api/search?extras=no_tags` returns a task or project that has tags; `extras=no_due_date` returns a task or project that has a due date; notes, areas, or tags that match the other criteria disappear; another user’s rows appear; or the `Missing tags and due dates` tests in `backend/tests/integration/search.test.js` fail.
- Rollback actions:
  1. Revert the commit that contains this diff and restart the Node process. Until that commit exists, discard the working-tree diff listed in Change analysis.
  2. Do not run a Sequelize `down`. This change adds no migration (`git diff --stat` has no `backend/migrations/` file).
  3. Do not restore SQLite from `backend/services/backupService.js`. A saved view may store `no_tags` or `no_due_date` in the existing `views.extras` column. After revert, the search service ignores extras it does not recognize, and the view row remains.
  4. Do not flip a feature flag. Search is not behind `FF_ENABLE_BACKUPS`, `FF_ENABLE_CALDAV` / `CALDAV_ENABLED`, or `FF_ENABLE_MCP` (`backend/modules/feature-flags/service.js`).
- Post-rollback verification: call `GET /api/search` with `extras=no_tags` and confirm the result matches a search that omits that extra (same behavior as `ignores an unknown extra` in `search.test.js`). Confirm a due-window search still passes `should filter tasks due today` in that file. Confirm the Extras group no longer shows “has no Tags” or “has no Due Date.”

### Risk management

- Feature flag: no. `backend/modules/feature-flags/service.js` exposes only `FF_ENABLE_BACKUPS`, `FF_ENABLE_CALDAV` / `CALDAV_ENABLED`, and `FF_ENABLE_MCP`. None of them gate search. A new env flag is not justified: the new predicates run only inside `extras.has('no_tags')` and `extras.has('no_due_date')`, so searches and saved views that omit those values keep the current queries, and rollback is a code revert with no migration.
- Rollout: ship the commit to this self-hosted Node process and keep the previous SQLite backup until the post-rollback checks above pass on the new build. The repo has no canary or blue-green path, and this change is not behind an existing flag.
- Known risks and limitations: the absence checks must stay on the condition object shared by the result query and the paginated count (`service.js`). No new test asserts `pagination.total` for `no_tags` or `no_due_date`. A contradictory request that sends both a tag constraint and `no_tags`, or both a due window and `no_due_date`, returns no tasks or projects; `no_due_date` with `overdue` returns no tasks and still returns undated projects (`search.test.js`). Smart View chips, the active-task default, and “No items found matching the view criteria” are rendered by unchanged `ViewDetail.tsx`. The plan assigns those checks to a manual walk, and `verification.md` was not found. The plan’s assumption is that chips read “no tags” and “no due date.”

  Out of scope, copied from the plan:

  - Filtering notes, areas, or tags by a missing tag or a missing due date.
  - A filter for “not assigned to a project,” or renaming “is Assigned to Project.”
  - Changing tag matching, due windows, defer-until, priority, or the existing extras when the new options are off.
  - Making “is Overdue” and a due window mutually exclusive.
  - Hiding completed tasks or subtasks in global search.
  - Changing Smart View subtask exclusion, the default active-task status control, paging, or the fact that a view lists tasks, notes, and projects only.
  - Automatic Smart View names, unique view names, and editing a saved view’s criteria from the view page.
  - New search pages, inbox changes, Telegram, and CalDAV.
  - Translating the new labels into locales other than English.
  - A new stored field or a migration for Smart Views.
  - Changing the result limit, paging, or the start-typing rule for extras other than `no_tags` and `no_due_date`.

### Recommendation

Merge. The search API and the criteria UI are covered by tests that passed in this review (94 backend tests in `search.test.js` and `views.test.js`; 17 frontend tests in `SearchMenu.test.tsx` and `SearchResults.test.tsx`). Checklist rows that are true have those tests and a code revert, and search is not missing a flag that this repo already provides. This is not Deployable yet: the plan’s manual Smart View walk (extras chips, active tasks first, completed tasks after the status control changes, empty-view copy) has no `verification.md` and no `ViewDetail` test, and `npm run test:ui` was not run. The human records the final decision.
