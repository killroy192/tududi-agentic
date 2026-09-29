# Specification: Task Size (S / M / L / XL) — v1.1

## Business Goal

**Problem / pain description**  
Users can set priority (importance) but have no first-class way to capture relative effort on a task. Without that signal, estimates stay informal or get lost, and later planning features have nothing to work with.

**Proposed solution**  
Add an optional task size (S / M / L / XL / unset) so users can capture relative effort from the task list, task details, and full New Task form. Dense boards and search show size when set (display-only). v1 delivers capture and display only; filtering, sorting, and capacity use of size are deferred.

## Current Behavior

**Data / domain**  
- Tasks support name, priority, status, due dates, tags, project, recurrence, etc.  
- No size / effort / t-shirt attribute exists.  
- Priority is editable; changes can appear in activity history.

**Backend / API**  
- Create/update persist known fields (including priority).  
- Access via ownership and shared permissions (`none` / `ro` / `rw` / `admin`).  
- No size field or validation.

**Frontend**  
- Details: editable priority dropdown with immediate save and toast feedback.  
- Full New Task form includes priority.  
- List rows show priority cues; no size control.  
- Search uses a distinct result presentation (not the main editable task row).  
- Kanban / Eisenhower show task cards without size.  
- Subtasks and recurring occurrences are separate task entities.  
- Quick capture does not expose the full New Task attribute set.

## Expected Behavior

- Every task (including subtasks and recurring templates/occurrences) may have size **S | M | L | XL | unset**.  
- Size = relative effort only; no official hour/duration mapping.  
- Optional; defaults to unset.  
- Independent of priority.  
- **Editable** for users with edit permission on: task list rows, task details, full New Task form.  
- **Read-only** users see size where shown; no edit control; mutations rejected by the system.  
- Selecting a size (or **None**) on an existing task saves immediately.  
- **Update semantics:** omitting size on update = no change; setting size to **None / null** = clear to unset; unsupported values = rejected; persisted value unchanged on rejection.  
- **Create semantics:** omitting size = unset; explicit None/null = unset; unsupported values = create rejected.  
- List and details reflect the same persisted value after normal in-app navigation / client store refresh. Multi-tab live sync is not required; other tabs may be stale until refresh.  
- Save failure (update): error toast + revert control to last saved size.  
- Create failure (invalid size): clear validation feedback; no task created.  
- **Search, Kanban, Eisenhower:** display-only. If a shared row component is reused, size must still be non-editable there.  
- **Dense / display-only unset:** when size is unset, **omit** size UI; when set, show the label (S/M/L/XL) as non-interactive text.  
- **Editable surfaces unset:** show a discoverable muted control (e.g. None / Size / —).  
- Completed and archived tasks remain size-editable given edit permission (same as other editable fields, not a special lock).  
- Recurring: size is per entity. Editing an occurrence does not change others or the template. Editing the template (via normal list/details) does not rewrite existing occurrences. **New occurrences start unset.**  
- No timeline/activity history entries for size changes in v1.  
- Intentional deltas vs priority: size has no activity events; size is editable on list rows; size is omitted (not shown) when unset on dense surfaces.

## User Flow

1. Editor opens a list-row view → opens size dropdown (None, S, M, L, XL).  
2. Selects a value → immediate save → row shows new size.  
3. Opens task details via in-app navigation → same size.  
4. Clears via None in details → list shows unset placeholder after return/refresh.  
5. Or creates via full New Task form with optional size → persisted on create.  
6. RO user sees size on list/details when set; cannot change.  
7. On Kanban / Eisenhower / search: sees label only when set; cannot edit.

## Edge Cases

- Unset ↔ any size supported via None / value selection.  
- Parent and subtask sizes independent; no roll-up.  
- Invalid size rejected; UI not left showing an unsaved value.  
- Concurrent editors: last successful write wins.  
- Task deleted/inaccessible mid-edit: error; no silent success.  
- New recurring occurrence: always unset.  
- Template size change: existing occurrences unchanged.  
- Search (even if UI chrome is shared with list): never editable for size.  
- Multi-tab: stale size until refresh is expected, not a defect.

## Error Handling

- Invalid size on update: reject; error toast; revert to last saved.  
- Invalid size on create: reject create; form/validation error; no phantom task.  
- Permission failure: no edit control for RO when known client-side; API rejects unauthorized updates.  
- Network/server failure on update: error toast; revert.  
- Not found/deleted: error toast.

## Out Of Scope

- Filter / sort / group / search / saved views by size  
- Capacity / velocity / totals by size  
- Size in quick capture  
- Live multi-tab / multi-user sync  
- Timeline / activity events for size  
- Hour-range definitions for S–XL  
- Editable size on Kanban, Eisenhower, search  
- Parent↔subtask inheritance or roll-up  
- Copying template size onto new occurrences  
- Dense surfaces beyond the v1 inventory below (follow-ups only)

## Technical Scope

- **Data:** optional size on all tasks (subtasks, templates, occurrences).  
- **API:** expose on read/create/update; enforce enum; omit vs clear vs invalid per Expected Behavior; same edit permission model as other mutable task fields.  
- **UI editable:** list rows, details, full New Task form.  
- **UI display-only (v1 inventory):** Kanban cards, Eisenhower cards, search results.  
- **Client state:** shared task state consistent on navigation/re-fetch.  
- **Permissions:** reuse existing; no size-specific permission.  
- **History:** no size events in v1.  

No storage type, component library, migration tooling, or wire schema beyond behavioral contracts above.

## Non-functional Requirements and Constraints

- Existing permission model (`rw`+ edit; `ro` view).  
- Optional; omitting size must not break create/update.  
- Strict values: S, M, L, XL, unset only.  
- Update failure: error toast + revert (aligned with other immediate field updates). Success toast may match priority but is optional.  
- Labels (including None) localizable.  
- Size control keyboard-operable with accessible name; display-only labels perceivable where shown.  
- Pre-feature tasks appear as unset.  
- No realtime push infrastructure required.

## Acceptance Criteria

| ID | Acceptance Criterion | Verifiable By |
|----|----------------------|---------------|
| AC-1 | Edit-permission user sets size to S/M/L/XL from a list-row dropdown; after full reload, size is still that value. | Manual Test, UI Check |
| AC-2 | Edit-permission user sets size to S/M/L/XL from task details; after full reload, size is still that value. | Manual Test, UI Check |
| AC-3 | Edit-permission user selects None on list or details; after reload, API/UI show unset (null/absent). | Manual Test, API Check, UI Check |
| AC-4 | Create or update with size omitted succeeds; task remains/has unset size; other fields unchanged on update. | Automated Test, API Check |
| AC-5 | Change size on list → open same task in details via in-app navigation (no browser hard reload) → details show the new size. Reverse path also matches. | Manual Test, Integration Test |
| AC-6 | Changing size leaves priority unchanged; changing priority leaves size unchanged. | Manual Test, API Check |
| AC-7 | RO user sees size on list/details when set, has no enabled size edit control; RO update attempt via API is rejected and persisted size unchanged. | Manual Test, UI Check, API Check |
| AC-8 | Full New Task form: omit size → created unset; choose S/M/L/XL → created with that size. | Manual Test, UI Check, API Check |
| AC-9 | Subtask size can differ from parent; changing one does not change the other. | Manual Test, API Check |
| AC-10 | On Kanban, Eisenhower, and search: when size is set, non-interactive S/M/L/XL is shown; when unset, size UI is omitted; no dropdown / no successful size mutation from that surface. | Manual Test, UI Check |
| AC-11 | Failed size update on list or details: error toast; control reverts to last saved size. | Manual Test, UI Check |
| AC-12 | Create with unsupported size fails with validation feedback; no task is created. | Manual Test, API Check |
| AC-13 | New recurring occurrence starts unset even if template has size; editing occurrence A does not change occurrence B or the template. | Manual Test, Integration Test |
| AC-14 | Editing template size via list/details does not change size on existing occurrences. | Manual Test, Integration Test |
| AC-15 | Completed and archived tasks remain size-editable for edit-permission users. | Manual Test, UI Check |
| AC-16 | After size changes, task activity/timeline shows no size-related event types. | Manual Test, API Check |
| AC-17 | Create/update with unsupported size value is rejected; on update, previously saved size is unchanged. | Automated Test, API Check |
| AC-18 | Tasks that existed before the feature appear with unset size. | Manual Test, API Check |
| AC-19 | Size dropdown on editable surfaces is keyboard operable and has an accessible name; None and S/M/L/XL labels use localized strings. | Manual Test, UI Check |

## Assumptions

- “Task list” = standard list-row presentations (Today/upcoming/project/grouped/tag/area/view), not Kanban/Eisenhower/search.  
- “Edit permission” = same access that allows editing priority/title (`rw` or equivalent).  
- v1 display-only inventory is exactly: Kanban, Eisenhower, search results.  
- Unset storage encoding is null/absent; API clear is explicit None/null; omit ≠ clear.  
- Recurring templates are the parent task entities already editable via list/details.  
- No migration of free-text effort notes into size.  
- Multi-tab staleness until refresh is an accepted limitation.
