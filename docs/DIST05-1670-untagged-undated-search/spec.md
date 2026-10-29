# Specification

## Business Goal

DIST05-1670: a tududi user can find tasks and projects that have no tags, or no due date, from the global search bar, and can save those searches as Smart Views.

Problem / pain description

Global search can keep items that have a chosen tag, a due window, or the extra “has Tags.” It cannot keep only the items that are missing tags or missing a due date. Untagged and unscheduled work is mixed into the full list, so the user cannot jump to it or save it as a view such as “Tasks unassigned” or “Tasks unscheduled.”

Proposed solution

Add two global-search extras, `no_tags` and `no_due_date`. In the Extras group they are labeled “has no Tags” and “has no Due Date.” They limit tasks and projects to those with no tags and those with no due date. The user can turn either or both on, combine them with non-conflicting search criteria, and save the search as a Smart View.

## Current Behavior

Global search is opened from the search bar. With no entity types selected, search covers tasks, projects, areas, notes, and tags, and only items owned by the signed-in user. Choosing entity types limits the search to those types. A text query matches task name and note, and project name and description. Results are grouped by type. The panel shows “Start typing to search or select filters above” when there is no text, entity type, priority, due window, or tag. That prompt does not treat a selected extra, or a defer-until value, as enough to show results. A search that returns no rows shows “No results found.” A failed search request clears the list and does not show a separate error.

Search criteria are badges inside Search Criteria:

- Entity types: task, project, area, note.
- Metadata: one priority, one due window (today, tomorrow, next week, next month), one defer-until window, and any number of the user’s real tags. The Tags group is hidden when the user has no tags.
- Extras: “is Recurring,” “is Overdue,” “has Content,” “is Deferred,” “has Tags,” and “is Assigned to Project.”

The italic summary names active extras in the existing “that are” clause. Tag and due-date badges are the metadata pills for real tags and real due windows.

Saved Smart Views store the text, entity types, priority, due window, defer-until, tag names, and extras list. Reopening a view runs that search again with subtasks excluded and with the view’s own page size. The view lists tasks, notes, and projects only. Areas and tags returned by search are not shown. The task list defaults to active tasks: done and archived tasks are hidden until the user switches the existing status control to all or completed. The view header shows extras as chips formatted from the stored extra name (underscores become spaces). A view with no visible tasks, notes, or projects shows “No items found matching the view criteria.” Saving requires a name and uses the existing success and failure messages. There is no uniqueness check on the name.

Task and project matching today:

- A tag name list keeps tasks, projects, and notes that have at least one of those tags. Areas and tags are not tag-filtered. “has Tags” keeps tasks and projects that have at least one tag. It does not filter notes, areas, or tags.
- A due window keeps tasks whose due date falls in that window, and projects whose project due date falls in that window. Notes, areas, and tags have no due-date filter. “is Overdue” keeps incomplete tasks whose due date is before now. It does not filter projects.
- Priority, defer-until, text, and the other extras combine with the filters above. Defer-until applies to tasks only. Most extras (recurring, overdue, content, deferred, assigned to a project) apply to tasks only. “has Tags,” priority, due window, and tag names also apply to projects.
- In global search, completed tasks stay in results unless “is Overdue” is on, and subtasks stay in results. Each task is matched on its own tags and its own due date. A Smart View does not request subtasks, and its task list starts on active tasks only.
- An unknown extra is ignored. Search does not recognize `no_tags` or `no_due_date`.

## Expected Behavior

The user can select “has no Tags” and “has no Due Date” from the Extras group in global search. They use the same badge control as the existing extras. They are not added to the Tags group or the Due group, and those groups do not gain an ellipsis or placeholder for them. Real tag names and real due windows remain the only badges in those groups.

“has no Tags” sends the extra `no_tags`. For tasks and projects it keeps only items with no associated tags. “has no Due Date” sends the extra `no_due_date`. For tasks it keeps only items whose due date is empty. For projects it keeps only items whose project due date is empty. A date in the past, today, or the future counts as a due date. Defer-until does not count as a due date.

Notes, areas, and tags are unchanged by these two extras. They follow the same rules as a search that does not use `no_tags` or `no_due_date`.

Selecting either new badge, with no text and no other criteria, is enough to run the search and show matches, or the existing “No results found” state. The summary sentence includes the selected label in the same extras clause used for other extras.

The two new filters may be on together. A task or project must then have no tags and no due date. They may also combine with text, entity types, priority, defer-until, and extras that do not conflict: “is Recurring,” “has Content,” “is Deferred,” and “is Assigned to Project.”

Conflicts:

- Selecting “has no Tags” clears every selected tag and clears “has Tags.” Selecting any tag, or selecting “has Tags,” clears “has no Tags.”
- Selecting “has no Due Date” clears the selected due window and clears “is Overdue.” Selecting a due window, or selecting “is Overdue,” clears “has no Due Date.”
- Selecting a due window does not clear “is Overdue,” and selecting “is Overdue” does not clear a due window. Those two still combine as they do today.
- Turning a new badge off removes only that filter. It does not restore tags, “has Tags,” a due window, or “is Overdue” that were cleared when it was turned on.

Existing tag filters and due windows behave as they do today when neither new option is selected.

The user can save the search as a Smart View, including a search that uses only one or both of the new extras. The view name is whatever the user types. Reopening the view applies the stored extras, including `no_tags` and `no_due_date`, and then presents results with today’s Smart View rules. Those rules are not the same as the global-search panel: subtasks are excluded, the task list initially shows active tasks only, and only tasks, notes, and projects are listed. Completed tasks that match are shown when the user changes the view’s existing status control from active to all or completed. Projects and notes that match are shown as they are today. The header shows `no_tags` and `no_due_date` as extras chips, in the same format as other extras. Global search keeps its current result limit. A Smart View keeps its current page size and paging.

### User Flow

1. The user opens global search and opens Search Criteria.
2. The user optionally limits entity types, for example to task, and optionally adds text, priority, defer-until, or a non-conflicting extra.
3. The user selects “has no Tags,” “has no Due Date,” or both, in Extras.
4. Conflicting tag or due-date criteria clear immediately, and the result list updates.
5. The user reviews matching tasks and projects. Notes, areas, and tags still appear when those types are part of the search and they match the other criteria.
6. The user chooses Save as Smart View, enters a name, and saves.
7. Opening that Smart View shows the saved criteria, including the extras chips, and the matching tasks, notes, and projects under today’s view rules: no subtasks, and active tasks first.

### Edge Cases

- The user has no tags. The Tags group stays hidden. “has no Tags” remains available in Extras and matches tasks and projects that have no tags.
- A task or project with one or more tags is excluded by “has no Tags.” A subtask is judged on its own tags, not its parent’s tags.
- A task with an empty due date and a defer-until value is included by “has no Due Date.” A task or project with any stored due date is excluded, including a due date in the past.
- In global search, completed tasks and subtasks that otherwise match are included. “has no Due Date” does not apply the incomplete-only rule used by “is Overdue.” On a Smart View, that same completed task is hidden while the status control stays on its default, active, and a matching subtask is not requested. Switching the view to all or completed reveals the completed task and still does not reveal the subtask.
- Both new filters are on, and the entity types include notes, areas, or tags. Tasks and projects must satisfy both absences. Notes, areas, and tags are not removed by the extras. If “has no Tags” cleared a tag selection, notes are matched without that tag selection.
- Only notes, areas, or tags are selected as entity types. The new extras still appear as selected, but they do not remove those types. The list shows whatever those types would show without `no_tags` and `no_due_date`.
- No task or project matches, and no other type matches. Global search shows “No results found.” A saved view shows “No items found matching the view criteria” when it has no visible tasks, notes, or projects. A view whose only matching tasks are completed or subtasks also shows that empty state while the status control remains on active, because those tasks are not visible.
- The user turns the badge off. The next results omit that constraint.
- A request includes both `no_tags` and tag names, or both `no_tags` and `has_tags`. Tasks and projects must satisfy every supplied condition, so that contradiction returns no tasks or projects. A request that includes both `no_due_date` and a due window likewise returns no tasks or projects, because both types use the due window. A request that includes both `no_due_date` and `overdue` returns no tasks, because those task conditions contradict. Projects stay eligible under `no_due_date` alone, because `overdue` does not apply to projects. The search UI does not leave any of these combinations selected.
- An extra value other than the known extras is still ignored. `no_tags` and `no_due_date` are known.

### Error Handling

- Zero matches are an empty result, not an error, in global search and in a Smart View.
- A failed search request keeps today’s behavior: the list is cleared and no new error message is added.
- Saving a Smart View with a blank name shows the existing “View name is required” message and does not create a view.
- A failed save shows the existing save-failure message and does not claim the view was saved.
- A signed-out search or view request keeps today’s unauthorized response. The new filters do not widen which items are returned.

## Out Of Scope

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
- Changing the result limit, paging, or the “start typing” rule for extras other than `no_tags` and `no_due_date`.

## Technical Scope

- Global search criteria: two new Extras badges, mutual exclusion with tags, “has Tags,” the due window, and “is Overdue,” and showing results when either new extra is the only criterion.
- Universal search for tasks and projects: honor `no_tags` and `no_due_date` on the existing extras parameter, including when both are present and when they combine with non-conflicting criteria.
- Smart Views: persist the new extras in the existing extras list, show them as extras chips, and apply them when the view is opened, without changing the view’s subtask exclusion or default active-task display.
- English copy for the two labels in the existing translation catalog.

No new entity, no new search endpoint, and no new database column.

## Non-functional Requirements and Constraints

- User-visible labels go through i18next. The English catalog is the source. Other locales may fall back to English.
- Search stays limited to the signed-in user’s own tasks and projects. The extras are additional constraints on the current universal search, passed the same way as existing extras.
- Smart Views keep storing extras in the existing extras value. Saved views that do not use the new extras keep their current results.
- The UI must not send a selected tag together with `no_tags`, or a due window or `overdue` together with `no_due_date`.
- Empty results stay on the existing empty-state copy. This work does not add a new error state for zero matches.

## Acceptance Criteria

- AC-1. With tasks that have tags and tasks that have none, selecting “has no Tags” in global search Extras returns the untagged tasks and omits the tagged ones. The same selection returns projects with no tags and omits projects that have tags.
- AC-2. Selecting “has no Due Date” returns tasks whose due date is empty and projects whose due date is empty, and omits tasks and projects that have a due date, including a due date in the past.
- AC-3. Selecting “has no Tags” or “has no Due Date” with no text and no other criteria shows the matching results, or “No results found” when nothing matches. It does not keep the “Start typing to search or select filters above” prompt.
- AC-4. “has no Tags” and “has no Due Date” can be selected together. Returned tasks and projects have no tags and no due date.
- AC-5. Selecting “has no Tags” clears selected tags and “has Tags.” Selecting a tag or “has Tags” clears “has no Tags.” Tag badges and “has Tags” then behave as they do today.
- AC-6. Selecting “has no Due Date” clears the selected due window and “is Overdue.” Selecting a due window or “is Overdue” clears “has no Due Date.” With the new option off, due windows and “is Overdue” behave as they do today.
- AC-7. The Tags group and the Due group do not list “has no Tags,” “has no Due Date,” or an ellipsis for them. Both options are badges in Extras. A saved Smart View shows `no_tags` and `no_due_date` as extras chips, in the same chip format as other extras.
- AC-8. A search that uses either new extra can be saved as a Smart View under a name the user enters. Opening that view applies the saved extras and lists matching projects, matching notes, and matching tasks that are not subtasks. The task list initially shows active tasks only. Completed tasks that match appear when the view’s status control is set to all or completed. Subtasks do not appear.
- AC-9. In global search, when notes, areas, or tags are included, “has no Tags” and “has no Due Date” do not remove those types. A note, area, or tag that would have appeared without the new extras still appears. A Smart View still lists only tasks, notes, and projects.
- AC-10. In global search, a completed task and a subtask with no tags are returned by “has no Tags.” A completed task with an empty due date is returned by “has no Due Date.” A subtask that has its own tag is omitted by “has no Tags” even when its parent has no tags. A Smart View saved from that search does not list the subtask, and lists the completed task only after the status control is moved off active.
- AC-11. Text, priority, defer-until, and a non-conflicting extra such as “is Assigned to Project” still narrow the tasks and projects returned while a new extra is on.
- AC-12. When no task, project, note, area, or tag matches, global search shows “No results found.” A saved view shows “No items found matching the view criteria” when it has no visible tasks, notes, or projects. Neither case shows an error.

## Assumptions

- The ticket examples “Unassigned” and “Unscheduled” are sample wording. The requester chose the labels “has no Tags” and “has no Due Date,” and chose Extras badges rather than new controls. “Not shown as pills” is treated as: do not put these options in the Tags or Due metadata groups. This was confirmed by the requester and is not an open choice.
- “No due date” means the task due date or the project due date is empty. Defer-until, reminder, and recurrence end do not count as a due date. Low risk: it matches the fields the current due window already uses.
- Global search continues to include completed tasks and subtasks unless an existing filter such as “is Overdue” removes them. Smart Views continue to exclude subtasks and to start with active tasks only. The ticket does not ask to make those two surfaces show the same rows.
- Turning “has no Tags” or “has no Due Date” off does not restore the criteria it cleared. Low risk: it matches how other search badges toggle.
- A contradictory request that includes both `no_tags` and a tag constraint returns no tasks or projects. Both `no_due_date` and a due window also return no tasks or projects. Both `no_due_date` and `overdue` return no tasks, while projects remain those with an empty due date, because `overdue` applies to tasks only. The search UI is required not to send these combinations. Low risk.
