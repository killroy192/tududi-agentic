# Implementation Plan

### Confirmed Facts

- Global search is `GET /api/search`. `backend/modules/search/validation.js` already parses a comma-separated `extras` query parameter into a set. Unknown values are ignored because the service only acts on names it recognizes. There is no separate allow-list to extend.
- Task search conditions live in `SearchService.buildTaskConditions`. Project search conditions live in `searchProjects`. Notes are filtered by tag names only. Areas and tags ignore extras and tag names. `search` scopes every type to `user_id`.
- Task tags are the `tasks_tags` join. Project tags are the `projects_tags` join. A tag-name list and the extra `has_tags` keep tasks and projects that have a matching tag by requiring that association. “has Tags” does not filter notes.
- A due window is `due` (`today`, `tomorrow`, `next_week`, `next_month`). It constrains `Task.due_date` and `Project.due_date_at`. Both columns are nullable dates. Defer-until constrains `Task.defer_until` only. `overdue` constrains tasks to `due_date` before now and `completed_at` null, and does not constrain projects.
- Global search includes completed tasks and subtasks. A subtask is a task with `parent_task_id` set. `excludeSubtasks=true` limits tasks to rows whose `parent_task_id` and `recurring_parent_id` are null. The default result limit is 20 when the client omits paging.
- The search criteria UI is `frontend/components/UniversalSearch/SearchMenu.tsx`. Entity types, priority, due windows, defer-until, and real tag names are separate badge groups. The Tags group is hidden when the user has no tags. Extras are the `extrasOptions` badges. The italic summary names selected extras in the existing “that are” clause, using each option’s translation key. Save as Smart View posts the current criteria, including the `extras` array, to `POST /api/views`. Any selected extra already counts as an active filter, so the save control is available for an extras-only search.
- `frontend/components/UniversalSearch/SearchResults.tsx` runs a search when text, an entity type, priority, a due window, defer-until, a tag, or any extra is set. The “Start typing to search or select filters above” prompt still shows for a selected extra and for defer-until alone. Zero rows show “No results found.” A failed request clears the list and adds no error message.
- `frontend/utils/searchService.ts` already sends `extras` as a comma-separated query parameter, plus `limit`, `offset`, and `excludeSubtasks`.
- Smart Views store `extras` as a JSON text list on the existing `views.extras` column (`backend/models/view.js`). Create and update already persist that list. No uniqueness check exists on the view name. A blank name already returns “View name is required.”
- `frontend/components/ViewDetail.tsx` reloads a view by calling universal search with the stored extras, the view page size, and `excludeSubtasks: true`. It lists tasks, notes, and projects only. The task status control defaults to active and hides done and archived tasks until the user selects all or completed. Extras chips render the stored extra name with underscores turned into spaces, using the same chip treatment as the other extras.

### Assumptions

- An empty due date is a null `Task.due_date` or a null `Project.due_date_at`. Defer-until, reminder, and recurrence end stay out of that check.
- A task or project has no tags when its join table has no row for that item. A subtask is judged by its own `tasks_tags` rows.
- A request that sends contradictory criteria is answered by applying every supplied condition. The API does not reject the combination. The search UI is what keeps those combinations from being selected.
- The view header keeps the current chip text for stored extra names. `no_tags` and `no_due_date` therefore appear as “no tags” and “no due date,” in the same format as other extras, rather than as the search labels “has no Tags” and “has no Due Date.”
- English keys are `search.extrasFilter.hasNoTags` (“has no Tags”) and `search.extrasFilter.hasNoDueDate` (“has no Due Date”). Other locale catalogs are left unchanged and fall back to English.
- Badge placement, mutual exclusion, the summary clause, and the results prompt are covered by a new frontend unit test beside the search components. There is no existing search-criteria test.

### Files / Modules Involved

- `public/locales/en/translation.json` — add the two English extra labels.
- `frontend/components/UniversalSearch/SearchMenu.tsx` — add the two Extras badges and the mutual-exclusion rules.
- `frontend/components/UniversalSearch/SearchResults.tsx` — treat only `no_tags` and `no_due_date` as enough to leave the start-typing prompt.
- `frontend/components/UniversalSearch/SearchMenu.test.tsx` and `frontend/components/UniversalSearch/SearchResults.test.tsx` — new unit coverage for the criteria UI.
- `backend/modules/search/service.js` — honor `no_tags` and `no_due_date` on tasks and projects, including counts used when a view sends paging.
- `backend/tests/integration/search.test.js` — API coverage for the new extras.
- `backend/tests/integration/views.test.js` — coverage that the existing extras list stores the new values.

These stay as they are: `backend/modules/search/validation.js`, `backend/modules/search/repository.js`, `frontend/utils/searchService.ts`, `backend/models/view.js`, `backend/modules/views/`, and `frontend/components/ViewDetail.tsx`. They already carry an extras list, pass it through on open, exclude subtasks, default the task list to active, and format extras chips.

### Implementation Plan

1. Extend `backend/tests/integration/search.test.js` so the absence behavior is specified before the service change. Cover tasks and projects that have tags and tasks and projects that do not; due dates that are null, in the past, today, and in the future; a task whose due date is null and whose defer-until is set; both extras together; notes, areas, and tags that still match a text query; a completed task and a subtask judged on its own tags; `excludeSubtasks=true`; text, priority, defer-until, and `assigned_to_project` combined with a new extra; a contradictory tag name or `has_tags` with `no_tags`; a due window with `no_due_date`; `overdue` with `no_due_date` (no tasks, projects with a null project due date still returned); an unknown extra; another user’s rows; a due window with the new extra absent; and a query that matches nothing, which stays HTTP 200 with an empty result list and no error field.
2. In `backend/modules/search/service.js`, add `no_tags` and `no_due_date` to the existing task and project condition lists so they combine with text, priority, defer-until, due windows, and the other extras. For tasks, `no_tags` keeps rows with no `tasks_tags` row, and `no_due_date` keeps rows whose `due_date` is null. For projects, `no_tags` keeps rows with no `projects_tags` row, and `no_due_date` keeps rows whose `due_date_at` is null. Apply the same conditions to the paginated count and the result query. Leave notes, areas, and tags on their current queries. Leave `overdue`’s incomplete-task rule, status filtering, and subtask exclusion on their current paths. When a contradictory pair is supplied, keep both constraints so tasks and projects that cannot satisfy both drop out, while projects stay eligible under `no_due_date` when the other extra is `overdue`.
3. Extend `backend/tests/integration/views.test.js` so creating a view with extras `no_tags` and `no_due_date`, then reading it back, returns that list unchanged. Confirm a blank name still fails with the existing validation message and that a view saved without those extras still returns its previous extras. Leave the views model, validation, and service unchanged, because the extras column and create/update path already store a JSON list.
4. Add frontend unit tests, then update the criteria UI. The tests should show “has no Tags” and “has no Due Date” only as Extras badges; the Due and Tags groups stay limited to real due windows and real tag names, including when the user has no tags. Selecting “has no Tags” clears selected tags and “has Tags.” Selecting a tag or “has Tags” clears “has no Tags.” Selecting “has no Due Date” clears the due window and “is Overdue.” Selecting a due window or “is Overdue” clears “has no Due Date.” A due window and “is Overdue” can remain selected together. Turning a new badge off removes only that extra. The summary includes the selected label in the existing extras clause. A search with only one of the new extras leaves the start-typing prompt and can be saved, and the save body sends `no_tags` and `no_due_date` on the existing extras field. Another extra alone, and defer-until alone, still show the start-typing prompt.
5. Add the two English keys and the two entries on the existing extras badge list in `SearchMenu.tsx`, and implement the exclusion rules in the existing priority, due, tag, and extras toggle handlers. Turning a badge off removes only that value and does not write back the criteria it cleared. In `SearchResults.tsx`, treat a selected `no_tags` or `no_due_date` as enough to show the result list or the existing “No results found” state. Leave the prompt rule for every other extra and for defer-until alone.
6. After the automated tests pass, walk the saved-view path in the running app: save a search that uses one new extra and a search that uses both, open each view, and confirm the extras chips, the omission of subtasks, the active-task default, and the appearance of a matching completed task after the existing status control moves to all or completed. Confirm the empty copy on a search and on a view that has nothing visible.

### Risks

- The absence checks have to be part of the same task and project conditions used for both the result query and the paginated count. A condition applied only to the list query would make a Smart View page disagree with its total.
- `no_tags` together with a required tag association, and `no_due_date` together with a due-date range, must both remain in force. Folding the new constraint into the existing due or tag clause can drop one of them and return rows the contradiction is supposed to exclude.
- The task and project queries already combine text search with an `OR`. The new constraints belong with the other extra conditions so they still apply when a text query is present.
- SQLite evaluates the join-table absence against the task or project row already being queried. A check that is not tied to that row would drop every item or drop none.
- The results panel fetches when any extra is selected, then separately decides whether to show the start-typing prompt. The prompt exception has to be limited to `no_tags` and `no_due_date` so the other extras keep today’s prompt.
- View reopen depends on the client status filter and on `excludeSubtasks`. Changing either while wiring the new extras would show completed tasks or subtasks that today’s Smart View hides.

### Out Of Scope

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

### Verification

| ID | Acceptance Criterion | Verifiable By |
|----|----------------------|---------------|
| AC-1 | With tasks that have tags and tasks that have none, selecting “has no Tags” in global search Extras returns the untagged tasks and omits the tagged ones. The same selection returns projects with no tags and omits projects that have tags. | Integration Test, Manual Test |
| AC-2 | Selecting “has no Due Date” returns tasks whose due date is empty and projects whose due date is empty, and omits tasks and projects that have a due date, including a due date in the past. | Integration Test, Manual Test |
| AC-3 | Selecting “has no Tags” or “has no Due Date” with no text and no other criteria shows the matching results, or “No results found” when nothing matches. It does not keep the “Start typing to search or select filters above” prompt. | Automated Test, UI Check |
| AC-4 | “has no Tags” and “has no Due Date” can be selected together. Returned tasks and projects have no tags and no due date. | Integration Test, Automated Test |
| AC-5 | Selecting “has no Tags” clears selected tags and “has Tags.” Selecting a tag or “has Tags” clears “has no Tags.” Tag badges and “has Tags” then behave as they do today. | Automated Test, Manual Test |
| AC-6 | Selecting “has no Due Date” clears the selected due window and “is Overdue.” Selecting a due window or “is Overdue” clears “has no Due Date.” With the new option off, due windows and “is Overdue” behave as they do today. | Automated Test, Integration Test |
| AC-7 | The Tags group and the Due group do not list “has no Tags,” “has no Due Date,” or an ellipsis for them. Both options are badges in Extras. A saved Smart View shows `no_tags` and `no_due_date` as extras chips, in the same chip format as other extras. | Automated Test, Manual Test |
| AC-8 | A search that uses either new extra can be saved as a Smart View under a name the user enters. Opening that view applies the saved extras and lists matching projects, matching notes, and matching tasks that are not subtasks. The task list initially shows active tasks only. Completed tasks that match appear when the view’s status control is set to all or completed. Subtasks do not appear. | Integration Test, Manual Test |
| AC-9 | In global search, when notes, areas, or tags are included, “has no Tags” and “has no Due Date” do not remove those types. A note, area, or tag that would have appeared without the new extras still appears. A Smart View still lists only tasks, notes, and projects. | Integration Test, Manual Test |
| AC-10 | In global search, a completed task and a subtask with no tags are returned by “has no Tags.” A completed task with an empty due date is returned by “has no Due Date.” A subtask that has its own tag is omitted by “has no Tags” even when its parent has no tags. A Smart View saved from that search does not list the subtask, and lists the completed task only after the status control is moved off active. | Integration Test, Manual Test |
| AC-11 | Text, priority, defer-until, and a non-conflicting extra such as “is Assigned to Project” still narrow the tasks and projects returned while a new extra is on. | Integration Test |
| AC-12 | When no task, project, note, area, or tag matches, global search shows “No results found.” A saved view shows “No items found matching the view criteria” when it has no visible tasks, notes, or projects. Neither case shows an error. | Integration Test, Manual Test |
