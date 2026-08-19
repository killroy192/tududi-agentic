# Specification

**Jira issue:** [KAN-15](https://epam-team-ai-adoption.atlassian.net/browse/KAN-15) — MK2/MK6: Task size estimate
**Type:** Task · **Status:** To Do · **Priority:** Medium

## Business Goal

**Problem / pain description**

When planning, a user can express how *urgent* a task is (via priority) but has no way to express how *big* it is. Effort information today can only be typed into the free-text note, where it is invisible in list views, inconsistent between users, and impossible to scan. As a result a user cannot look at a list of tasks and tell the difference between a two-minute errand and a multi-day piece of work, which makes it hard to decide what actually fits into a day.

**Proposed solution**

Give every task an optional t-shirt size estimate — **S**, **M**, **L**, **XL**, or **unset** — that the user can set directly from a dropdown, both while scanning the task list and while looking at a single task's details. The change saves immediately with no separate save step, and the value is visible in both places. Size is deliberately a lightweight, coarse-grained signal: it is optional, has no numeric meaning, and is completely independent of priority, so a user can adopt it without changing how they already work.

## Current Behavior

**Data layer**

- A task has no field representing size, effort, or estimate. The only enum-like planning attributes are `priority` and `status`.
- `priority` is an optional attribute constrained to three values (low / medium / high) with an "unset" state; `status` is a required attribute with seven values.
- No column, translation key, or UI element anywhere in the product refers to task size or effort. (The string "size" exists only for backup file sizes and attachment file sizes, which are unrelated.)

**API layer**

- Tasks are read via a list endpoint and a single-task endpoint, and written via a create endpoint and a partial-update endpoint.
- The create and update paths do **not** use a schema validation library. Each accepts a fixed, manually maintained allow-list of attributes; any key in the request body that is not on that list is silently ignored.
- The single-task response is the persisted task plus derived fields (tags, project, area, subtasks, timezone-adjusted dates).
- The list endpoint supports filtering by `priority` and ordering by a fixed allow-list of columns that includes `priority` and `status`. Unrecognised order columns are rejected; unrecognised `priority` filter values are silently coerced rather than rejected.

**Authorization**

- All task endpoints require an authenticated session.
- Multi-user sharing exists. A user may act on a task if they own it, if the task was shared with them directly, or if it belongs to a project shared with them. Access is graded: read-only, read-write, and admin. Reads require read-only; writes require read-write.
- The serialized task payload does **not** include the caller's access level, and the frontend has no per-task notion of "can I edit this". Consequently the UI does not pre-emptively disable editing controls on read-only shared tasks; the user may attempt an edit, the backend rejects it, and the frontend surfaces a "Permission denied" message.

**Frontend — task list**

- All list surfaces (main task list, Upcoming, Today, project details, area details, tag details, saved views, Kanban, Eisenhower) render rows through one shared task-row component, so they share a single presentation. Kanban suppresses the row's status control, because its columns already encode status.
- List endpoints return only top-level tasks; subtasks are excluded and appear only as compact nested rows when a parent is expanded. Clicking a nested subtask row opens the parent task.
- The grouped (recurring) list can synthesize a placeholder "template" entry from an instance when the real parent is absent from the results. That placeholder is rendered as a plain group header, not as an interactive task row.
- A row shows: a coloured left border encoding priority, the title, an optional habit icon, a subtask expand toggle, a metadata line (project, tags, due date, completed-at, recurrence, defer-until), and a status control on the right. A priority icon component exists in the row but is explicitly hidden, so **the coloured left border is the only priority cue in a list**.
- The only things editable inline in a list today are **status** and **completion**. Priority, title, due date, tags, and project are not editable from a row; clicking a row navigates to the task details page.
- Rows have two layouts, desktop and mobile, switching at the `md` breakpoint. The mobile layout stacks metadata vertically and moves the status control beneath the title.
- Persistence after an inline status change is inconsistent between surfaces: one list refetches and merges the server response and shows errors as inline red text; another applies an optimistic local update plus a shared-store update and logs failures to the console only.

**Frontend — task details**

- Task details is a **full page** at its own route, not a modal or drawer. It has a header card plus tabbed sections (overview, attachments, activity).
- Editing is per-field and immediate for most fields (title on blur/Enter, status, priority, tags, project, area, assignee); a few fields use an explicit Save/Cancel (note content, due date, defer-until, recurrence). There is no page-level Save button.
- **Priority on details is a one-off custom dropdown built into the header**, offering None / Low / Medium / High with icons. Selecting a value immediately issues a partial update, refetches the task, writes it into the shared store, and shows a success or error toast. Its label is hidden on narrow screens, leaving icon plus chevron.
- A separate reusable priority dropdown component exists but is currently used only for **project** priority, not for tasks. Its options carry stable test IDs; it renders its menu into a portal and flips upward when space below is insufficient. It is click-only, with no keyboard navigation and no ARIA attributes on its trigger; the details-header dropdown does expose `aria-haspopup` and `aria-expanded`.

**State synchronisation**

- There is no data-fetching cache library in use. Synchronisation is a mix of a shared store, per-page local state, prop callbacks, and refetching.
- Because the main task list holds its own copy of tasks rather than reading from the shared store, an edit made on the details page does **not** live-update an already-mounted task list; the list reloads from the API when it remounts.

**Activity log**

- Task field changes are recorded as timeline events, but only for an explicitly enumerated set of fields. The event model additionally validates event type and field name against fixed allow-lists. A new field is therefore not logged automatically, and adding one without extending those allow-lists produces no events rather than an error.

**Other read/write paths for task fields**

- Backup **export** serialises the whole task record, so it picks up new columns automatically. Backup **import** copies a fixed list of fields, so a field absent from that list is silently dropped on restore.
- Additional surfaces that read or write task scalar fields: the MCP tool set, CalDAV two-way sync, the AI assistant prompt builder, recurring-task template handling, subtask creation, quick capture, and Telegram summaries. None of them has a concept of size today.
- Changing `priority` on a recurring parent task is treated as a template change and **destroys not-yet-started future instances**.

**Localisation**

- 25 locales are shipped, each with a translation file. Priority-related keys exist in all of them.

## Expected Behavior

A task has an optional size estimate with exactly five states: **unset** (the default), **S**, **M**, **L**, and **XL**. The values are ordered S < M < L < XL, but carry no numeric or time value.

Size is settable from a dropdown in two places — a row in any task list, and the task details page — and both places show the current value. Choosing a value persists it immediately, with no separate save action. After a successful change, navigating to the other view shows the new value; the user never has to refresh the browser to see their own change. Live-updating an already-mounted list is not required (see Out Of Scope).

Size is optional and orthogonal to priority: setting or clearing one never changes the other, and size does not affect the row's priority border colour, existing sort options, Eisenhower placement, or suggestion ranking. Existing tasks are unset until a user sets a size, and nothing in the product requires a size to be set.

At the API boundary there are five valid inputs — the four sizes and an explicit unset. Anything else is rejected. Omitting the field entirely from an update is different from sending an explicit unset: the former leaves the stored value alone, the latter clears it.

Only a user with edit access to a task can change its size. Enforcement is server-side and identical to every other task field: owners and read-write sharees succeed; read-only sharees are rejected and the attempted change does not persist.

### User Flow

**Setting size from a task list**

1. The user opens any task list.
2. Each row shows a compact size indicator: the letter for a sized task, or a neutral placeholder for an unset task.
3. The user activates the size control on a row. The row itself does not open, and the dropdown opens in place showing None / S / M / L / XL with the current value indicated.
4. The user picks a value. The dropdown closes, the row shows the new value, and the change is saved.
5. On success the row settles on the value returned by the server. On failure the row returns to the previous value and an error is surfaced.

**Setting size from task details**

1. The user opens a task's details page.
2. The header shows the size control alongside the existing priority and status controls, displaying the current value or an unset state.
3. The user activates it and picks a value; the dropdown closes and the change is saved immediately.
4. A success confirmation appears, consistent with how a priority change is confirmed today.
5. Navigating back to the list shows the updated size.

**Clearing a size**

1. From either surface, the user opens the size dropdown on a sized task and selects the "None" option.
2. Size returns to unset, the row shows the neutral placeholder, and the cleared state persists.

### Edge Cases

| Case | Expected behaviour |
|---|---|
| Task has never had a size | Treated as unset; the control shows a neutral placeholder, not a default of S or M. |
| User selects the value already set | Accepted as a no-op; no error, and no spurious state churn. |
| User changes size several times quickly | The value that persists and is displayed is the last one the user chose, regardless of the order in which responses arrive. |
| Completed, cancelled, or archived task | Size remains viewable and editable, matching how priority behaves today. |
| Subtask | The size attribute exists on a subtask like any other task, but this story intentionally adds **no** user-facing way to set it: lists exclude subtasks, the compact nested rows keep their current minimal presentation, and clicking one opens the parent. A subtask's size is therefore reachable only via the API, and must not be displayed as an editable control on nested rows. |
| Kanban board | The control appears on Kanban cards as on any other row. It must not be suppressed along with the status control that Kanban hides. |
| Habit-mode task appearing in a list | The control behaves as it does for any other row. The dedicated habit detail page is out of scope. |
| Recurring parent task | Size is editable, but it is **not** a template field: changing it must not destroy or regenerate future instances, and must not retroactively alter already-created instances. |
| Recurring instance | Size is editable per instance and independent of the parent. |
| Synthesized recurring "template" group header | Not an editable size surface, since it is a placeholder derived from an instance rather than a real task row. It must not offer a control that would write to the wrong task. |
| Newly created task | Created unset, from every existing creation path, without those paths having to be changed. |
| Task list opened on a narrow screen | The control remains reachable and does not break the mobile row layout or push existing metadata off-screen. |
| Read-only shared task | The control is visible and reflects the current value; attempting a change fails server-side and the displayed value returns to the stored one. |
| Dropdown near the bottom of the viewport | The menu remains fully visible, consistent with existing dropdown behaviour. |
| A row's size dropdown is open and the user clicks elsewhere | The menu closes without saving a value the user did not pick. |
| Client sends an unrecognised size value | Rejected as a validation error. It must **not** be silently coerced to a valid value the way an unrecognised priority filter value is today. An explicit unset is a valid value, not an unrecognised one. |
| Backup taken before this change is restored | Restores successfully; tasks come back unset rather than failing the import. |
| Backup taken after this change is restored | Size values round-trip; a restore does not silently discard them. |

### Error Handling

| Scenario | Expected behaviour |
|---|---|
| Save fails on validation (unrecognised value) | Request rejected with a client-error response identifying the invalid field; no partial write. The UI shows the previous value. Applies only to values outside the five valid states — an explicit unset must succeed and clear the size. |
| Save fails on permission (read-only sharee) | Request rejected as forbidden; nothing persists. The UI surfaces a permission-denied message consistent with the existing message shown for other forbidden task actions. |
| Task no longer exists or is not accessible | Request rejected as not found; the UI surfaces an error rather than appearing to succeed. |
| Session expired | Handled by the existing unauthenticated-request behaviour; no size-specific handling. |
| Network failure or timeout | The optimistically shown value reverts to the last known stored value and an error is surfaced to the user. A failed save must never leave the UI displaying a value the server does not hold. |
| Save fails from a task list row | An error toast appears, using the same shared toast mechanism as the details page. Silent failure — console-only logging, as one list surface does today for status — is not acceptable for this control, and inline red text is not used, so that failure feedback is identical on both surfaces. |
| Save fails on task details | An error toast appears, consistent with the existing priority-update failure toast. |

## Out Of Scope

- Filtering, sorting, or grouping tasks by size; adding size to saved-view filters, universal search, or the sort dropdown.
- Any aggregation or reporting: totals per project or area, velocity, burn-down, capacity planning, or "how much work is in today".
- Mapping sizes to hours, days, story points, or any numeric value; user-configurable or per-project size scales; renaming the S/M/L/XL labels.
- Setting size at creation time (task creation form, quick capture, inbox conversion, Telegram, subtask creation). New tasks are simply created unset.
- Bulk-editing size across multiple tasks; drag-and-drop or keyboard-shortcut size assignment.
- Recording size changes in the task activity timeline.
- Exposing size through the MCP tool set, CalDAV sync, or the AI assistant / AI insights prompts.
- Size for entities other than tasks (projects, notes, areas).
- The dedicated habit detail page.
- Exposing the caller's per-task access level to the frontend so that editing controls can be pre-emptively disabled for read-only sharees. This is a pre-existing gap that affects every task field, not just size.
- Retrofitting keyboard navigation or ARIA onto the existing reusable priority dropdown beyond what the new control itself requires.
- Reconciling the pre-existing inconsistencies described in Current Behavior: divergent save/error handling for the **existing** status control between list surfaces, the main list not reading from the shared store, and stale API documentation. The size control's own error behaviour is specified in Error Handling and must be consistent across surfaces; existing controls are not required to be brought into line with it.

## Technical Scope

- **Data model and schema:** one new optional attribute on the task entity, constrained to the four size values plus an unset state, added both to the ORM model definition and as a schema migration, since the two are maintained independently.
- **API:** the new attribute must be accepted by the task partial-update path, returned by the task read and list responses, and validated so that unrecognised values are rejected. Because write paths use manually maintained attribute allow-lists, the field must be explicitly added to the relevant allow-list to be writable at all.
- **Backup import:** the fixed field list used when restoring a backup must include the new attribute so that size survives an export/restore cycle.
- **Frontend types:** the task type gains the new optional attribute with an explicit unset state.
- **Frontend — task details:** a size control in the header, alongside the existing priority and status controls, saving immediately and confirming/failing the way the existing priority control does.
- **Frontend — task list:** a size control on the shared task row, in both the desktop and mobile layouts, that does not trigger row navigation when used. Because the row is shared, this covers every list surface at once; the nested subtask rows and the synthesized recurring group header are deliberately excluded.
- **Frontend — dropdown component:** a size dropdown covering both surfaces. The existing reusable priority dropdown is the closest analogue in the codebase.
- **State synchronisation:** a successful change must be reflected in the shared task store so the other view shows the new value without a manual page reload.
- **Localisation:** new user-facing strings (field label, the five option labels, success and failure messages) added across all shipped locale files.
- **Tests:** backend model-level validation and endpoint-level update/permission coverage, and frontend coverage of the new control, following the existing per-layer test conventions.

## Non-functional Requirements and Constraints

1. **Stack.** Backend: Node/Express with Sequelize over SQLite. Frontend: React 18 with TypeScript, Tailwind (class-based dark mode), Zustand, and i18next. No new runtime dependency should be introduced for this feature.
2. **Schema changes must be applied twice.** The ORM model and the migration set are not derived from each other — the test suite builds its schema from the models while runtime databases are migrated — so both must be updated or environments will diverge. Migrations must follow the existing additive, idempotent, guarded add-column pattern used by other optional task columns.
3. **Follow the existing optional-enum convention in shape, but not in default.** The new field must be represented and named consistently with the existing task `priority` field — optional, nullable, with the same style of value expression at the API boundary — so serialization, clients, and future filtering behave predictably. It must **not** copy priority's default: priority defaults to its lowest value at the model level, whereas size must default to unset. A new or untouched task has no size.
4. **The stored representation must preserve the S < M < L < XL ordering,** so that sorting or grouping by size can be added later without a data migration, even though neither is in scope now.
5. **Backward compatibility.** Existing tasks, existing API clients that omit the field, and backups taken before the change must all keep working. Omitting the field from an update request must leave the stored value untouched rather than clearing it.
6. **Validation must reject, not coerce.** Unrecognised values must produce a validation error. Silently mapping an unknown value onto a valid one — the behaviour of the current priority filter — must not be repeated here.
7. **Authorization is server-side and reuses the existing graded access model.** Do not introduce a separate permission concept for size, and do not rely on the client to enforce edit rights.
8. **No regression to priority.** Priority semantics, the row's priority border colour, existing sort options, Eisenhower behaviour, and suggestion scoring must be unchanged. Size must not be inferred from priority or vice versa.
9. **List performance.** The control must be rendered from data already present in the list response. No per-row request, no additional round trip when a list loads, and no change to list response shape beyond the added field.
10. **Accessibility.** The control must be operable by keyboard and expose at least the ARIA attributes the details-header priority dropdown does today (`aria-haspopup`, `aria-expanded`), with a visible focus indicator. Activating it inside a list row must not also activate the row.
11. **Responsive and theming.** The control must work in both the desktop and mobile row layouts, and in light and dark themes, consistent with existing task controls.
12. **Localisation completeness.** Every shipped locale file must contain the new keys so no locale renders a raw key; English text is acceptable as the placeholder value for not-yet-translated locales.
13. **Test conventions.** Backend tests use Jest with the existing unit/integration split and session-authenticated request helpers; frontend tests use Jest with Testing Library. New interactive elements should carry stable test identifiers following the existing dropdown/option naming convention so end-to-end tests can target them.
14. **Type safety.** The frontend build runs a strict type check; the unset state must be representable in the task type rather than approximated with a magic value.

## Acceptance Criteria

**AC-1 — Size can be set from the task details page**
Given a task the user can edit, when the user opens task details, activates the size control, and selects **M**, then the header shows **M**, a success confirmation appears, and the value is still **M** after reloading the page.

**AC-2 — Size can be set from a task list row**
Given a task list, when the user activates the size control on a row and selects **L**, then the row shows **L** without navigating away from the list, and the value is still **L** after reloading the list.

**AC-3 — All five states are offered**
Given the size control on either surface, when the user opens it, then exactly five choices are available — None, S, M, L, XL — with the task's current value indicated.

**AC-4 — Size defaults to unset**
Given a newly created task, when it is viewed in a list and on its details page, then the size control shows an unset/neutral state and no size value, and it was not required to create the task.

**AC-5 — Size can be cleared**
Given a task with size **XL**, when the user selects **None**, then the task returns to unset, and the unset state persists after a reload.

**AC-6 — Changes save immediately**
Given the user selects a size on either surface, when they select it, then it is persisted without any further action such as pressing a Save button or navigating away.

**AC-7 — Both views agree after a change**
Given a task list and its details page, when the user changes the size on one surface and then navigates to the other, then the other surface shows the new value without the user manually refreshing the browser.

**AC-8 — Size is independent of priority**
Given a task with priority High, when the user sets its size to **S**, then the priority remains High and the row's priority border colour is unchanged; and given a task with size **S**, when the user changes its priority, then the size remains **S**.

**AC-9 — Size does not affect ordering, existing views, or suggestions**
Given tasks with different sizes, when the user applies the existing sort options, opens the Eisenhower view, and views suggested/next-action tasks, then the ordering, placement, and suggestion ranking are identical to what they were before any size was set.

**AC-10 — A read-write sharee can change size**
Given a task shared with the user with read-write access, when they change its size, then the change succeeds and persists.

**AC-11 — A read-only sharee cannot change size**
Given a task shared with the user with read-only access, when they attempt to change its size, then the change is rejected, a permission-denied message is surfaced, the displayed value returns to the stored value, and the stored value is unchanged.

**AC-12 — An unrecognised size value is rejected, and an explicit unset is not**
Given an API client submits a size value that is neither one of the four sizes nor the explicit unset value, when the update is processed, then it is rejected with a validation error and the task's stored size is unchanged and has not been coerced to another value. Given the same client submits the explicit unset value, then the update succeeds and the size is cleared.

**AC-13 — A failed save never leaves a misleading value on screen**
Given the save request fails because of a network error, when the user has selected a new size, then the displayed value returns to the last known stored value and the user is told the save failed — on both the list and the details surfaces.

**AC-14 — Omitting size in an update preserves it**
Given a task with size **M**, when a client updates another field without including size in the request, then the size is still **M** afterwards.

**AC-15 — Existing tasks are unaffected**
Given tasks that existed before this change, when the application is upgraded, then those tasks load normally in every list and detail view with size unset, and no existing field has changed.

**AC-16 — Changing size on a recurring parent is not destructive**
Given a recurring task with future instances not yet started, when the user changes the size of the recurring parent, then those future instances still exist and their schedule is unchanged.

**AC-17 — Size survives backup and restore**
Given tasks with sizes set, when a backup is created and then restored, then the restored tasks have the same sizes; and given a backup created before this feature existed, when it is restored, then the restore succeeds and the tasks come back unset.

**AC-18 — Using the control in a list does not open the task**
Given a task list, when the user activates the size control on a row and selects a value, then the task details page is not opened.

**AC-19 — The control is keyboard operable**
Given keyboard-only navigation, when the user focuses the size control, then it shows a visible focus indicator, can be opened and a value selected using the keyboard alone, and can be dismissed without changing the value.

**AC-20 — The control works on narrow screens and in dark mode**
Given a narrow-viewport task list and details page, and given dark mode is active, when the user views and operates the size control, then it is legible and usable and the existing row layout and metadata remain intact.

**AC-21 — No untranslated strings**
Given each shipped locale, when the user views the size control and triggers its success and failure messages, then no raw translation key is displayed.

## Assumptions

Assumptions are inferences made where the issue was silent; they are decisions that can be revisited. Constraints, by contrast, are recorded in *Non-functional Requirements and Constraints* and are not negotiable.

1. **"MK2/MK6" in the issue title refers to design mockups that are not attached to the issue.** No attachments, comments, linked issues, or remote links exist on KAN-15, and no matching design document exists in the repository. Presentation therefore follows the product's existing priority and status control patterns rather than an unseen mockup. If those mockups exist, they may override the presentation details (indicator style, control placement within the row) — but not the behavioural acceptance criteria.
2. **"Task list" means every list surface, because they all share one row component.** Rather than picking a single page, the control is specified on the shared task row, which makes it appear consistently on the main list, Upcoming, Today, project details, area details, tag details, saved views, Kanban, and Eisenhower. This is treated as a benefit rather than scope creep, since restricting it to one page would require extra conditional logic.
3. **"Only users with edit permission can change size" restates the product's existing access model rather than introducing a new one.** It is interpreted as the existing read-write requirement on task writes, satisfied by ownership, a direct read-write share, or inheritance from a shared project.
4. **The size control is not pre-emptively disabled for read-only sharees.** The serialized task does not carry the caller's access level and the frontend has no per-task edit-permission concept, so size behaves like every other field today: the attempt is made, the server rejects it, and an error is surfaced. Proactively disabling controls would require a broader change and is listed as out of scope.
5. **Sizes are a fixed four-value scale with no numeric meaning.** The issue lists S/M/L/XL literally, so no configurable scale, no XS/XXL, and no hour or point mapping is provided.
6. **Size is not a recurring-task template field.** Priority is treated as one today, and changing it destroys future instances. Since the issue frames size as a lightweight planning aid, applying that destructive behaviour to size would be surprising, so size changes are specified as non-propagating and non-destructive.
7. **Size changes are not written to the task activity timeline in this story.** The activity log uses explicit field and event-type allow-lists, so omitting size produces no events and no errors. Adding timeline coverage is a small, separable follow-up.
8. **Backup round-tripping is treated as in scope even though the issue does not mention it.** Backup import copies a fixed field list, so leaving size out would silently discard user data on restore. This is classed as data integrity for the field being added, not as scope creep.
9. **Setting size at creation time is not required.** The issue names only the task list and task details as editing surfaces, so all creation paths leave size unset and are otherwise untouched.
10. **"Stays in sync across both views" means no manual browser refresh is needed,** not that an already-mounted list must update in real time. The main task list keeps its own copy of tasks, so this is satisfied by updating the shared store on success plus the list's existing reload-on-mount behaviour when the user navigates back to it. Real-time propagation — either from a background change by another user, or into a list already on screen — is not implied.
11. **Rejecting invalid values is the correct behaviour**, even though the analogous priority filter silently coerces unknown values. The existing coercion is treated as a wart not to be copied; this is stated as a constraint because silent coercion would make AC-12 untestable.
12. **No analytics or telemetry requirement** beyond what already happens for task updates, since the issue mentions none.
13. **Subtask size has no UI in this story.** The attribute exists on subtasks because they are tasks, but lists exclude them and nested rows are intentionally minimal, so no control is added there. If setting a subtask's size turns out to be a real need, it is a separate story.
14. **List save failures use a toast rather than inline text.** The two list surfaces handle status-save failures differently today (inline red text on one, console-only on the other). A toast is chosen so that failure feedback is identical on the list and the details page, which also makes AC-13 testable with a single expectation.
