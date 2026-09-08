# Specification: Task Size (S / M / L / XL)

## Business Goal

**Problem / pain**

When planning, users can express _how important_ a task is (priority) but not _how much work_ it is. Those are different questions, and today the second has no home. Users pad task titles with "(quick)" or "(big one)", split a task purely to signal that it's large, or keep the estimate in their head. A list of ten tasks gives no sense of whether it represents an afternoon or a fortnight, and a user with twenty free minutes can't tell which of three equally-urgent items fits.

**Proposed solution**

Give every task an optional effort size — S, M, L, or XL — settable in one interaction from wherever the user already is. Sizing must be cheap enough that users do it while planning rather than treating it as a form field for later. The scale is deliberately coarse and unit-free: it conveys rough scale, not an estimate anyone is held to.

## Current Behavior

**Frontend — task list**

Task rows come from one shared row component reused across the Tasks page, Today, project detail, and tag/area views. A row shows the task name plus a metadata line carrying project, tags, due date, recurrence indicator, and defer date. Desktop and mobile are separate render trees at the `md` breakpoint. The desktop metadata line already scrolls horizontally when crowded, and the row reserves roughly 224px on its right edge for the status control.

The only inline editor in a row is the status control. Priority is display-only, rendered as a coloured left border. The row itself is a `role="button"` element whose key handler navigates to the task on both Enter and Space; the existing status control guards against click propagation but has no keyboard guards at all.

**Frontend — task details and creation**

Task details has a bespoke priority dropdown (None/Low/Medium/High) hand-written into the header component. The creation form uses a _separate_, unrelated shared dropdown component. The two are independent implementations with duplicated label/icon/style helpers. Selecting a priority in details sends an update immediately with no explicit save, waits for the response, refetches the whole task, updates the store, toasts, and refreshes the activity timeline. It is not optimistic.

No effort, size, estimate, or story-point concept exists anywhere in the product.

**Frontend — state**

There is a global Zustand store, but **list views do not use it for tasks**: the Tasks page, project detail, tag detail, area detail, Kanban, and Eisenhower each hold tasks in local component state. Only task details and the Today view read tasks from the store. Cross-view consistency today is achieved by refetching on navigation, not by shared state. There is no websocket, server-sent-event, polling, or event bus.

The list and details pages also differ in request shape: list rows send the **entire task object** on update, while task details sends only the changed field.

**Backend — data and API**

`priority` and `status` are bounded integers with range validation; named constants and string→integer converters live on the model. The API **accepts** either a string or an integer and normalises inbound; responses return the **stored integer** unchanged, because the serializer spreads the model's JSON.

Conversion silently coerces: an unrecognised priority string becomes `0` (LOW), on both the write path and the query-filter path. Update failures return a single flat message rather than a field-named validation error.

Create and update bodies are not filtered by a generic allowlist. Fields are mapped one by one in explicit builder functions; anything unnamed is silently discarded. Subtask creation has its own separate, narrower field list.

**Backend — authorization**

Tasks are not single-owner. Write access covers the owner, holders of a read-write share on the task's project, and holders of a direct read-write share on the task. A single guarded update route exists. Task responses carry **no access-level, ownership, or permission field**, so the client cannot currently tell whether the viewer may edit. Read-only users today discover this by attempting an edit and receiving a rejection.

Access resolution returns inherited project access before consulting a direct task-level permission, so a narrower explicit `ro` share on a task inside a project the user holds `rw` on resolves to `rw`.

**Backend — activity timeline**

A task event service records field-level change events, deriving the event type from the field name. Old and new values are stored only when truthy — falsy values, including integer `0`, are recorded as null, and the timeline UI falls back to a generic label when either side is missing. A dedicated priority-change helper exists but has no call sites. Timeline writes are currently isolated from the update itself by a swallowing wrapper, though the underlying log function re-throws.

**Backend — recurrence**

Changing `name`, `project_id`, `priority`, or `note` on a recurring parent marks a template change, which causes the code to **delete** that task's future instances. No value is copied to them. Instances whose deletion is blocked by a foreign key are skipped with a warning and left stale.

**Backend — sorting, filtering, docs**

Tasks can be filtered and sorted by priority via query parameters, surfaced as a sort option and search filter chips. The OpenAPI schema is materially inaccurate: its status enum lists values the model doesn't have, priority is typed as a string though an integer is returned, and it documents a field that doesn't exist.

**Adjacent behavior**

Task duplication builds its payload from an explicit allowlist and never spreads the source. Note that this module is currently **uncommitted work in progress**.

Twenty-five locale files exist. Every translation call supplies an inline English fallback, so a missing key renders English rather than a visible placeholder.

## Expected Behavior

A task carries an optional size of exactly one of S, M, L, XL, or no size. Unset is the initial and permanently valid state; never an error, never auto-filled, never inferred.

Size is visible and editable in standard task list rows and on task details, as a compact chip showing the current letter or a muted placeholder when unset, opening a dropdown offering None, S, M, L, XL. Choosing a value applies it immediately with no separate save. The chip shows the new value at once; if the request fails it returns to its previous value and the user is told why.

A size change issues a request carrying **only** the size field, leaving every other task attribute untouched.

Where a size change is made, the value is reflected in the other view when the user navigates to it, without a full page reload.

Size is fully independent of priority. Setting one never reads, writes, or constrains the other.

Size changes appear in the activity timeline as a field-change entry recording previous and new values — including transitions into and out of unset, and transitions involving the smallest value.

Users lacking write access are refused by the server, exactly as they are for every other task field today, and are shown the same rejection message they already get.

Duplicating a task copies its size.

## User Flow

**Setting a size from a list** — A user scanning their list clicks a row's size chip. A dropdown opens showing None, S, M, L, XL with the current value indicated. They pick L; the dropdown closes and the chip reads L immediately. They move to the next row. The list does not scroll, reorder, reload, or navigate, and the task is never opened.

**Setting a size from task details** — The size control sits alongside the other task attributes. The user opens it, picks XL, and it updates in place with a confirmation. The activity timeline gains an entry.

**Cross-view consistency** — Returning to the list they came from, the row shows XL without a full page reload.

**Setting a size at creation** — A user sets size alongside priority in the full task form. The created task carries it everywhere.

**Clearing a size** — The user opens the dropdown, chooses None, and the chip reverts to its unset placeholder. The task behaves as one that was never sized.

**Keyboard-only** — A user tabs to the size chip inside a row, opens it with Enter, moves through options with arrow keys, and selects with Enter. At no point does keyboard interaction with the chip navigate away from the list.

**Read-only viewer** — A user with read-only access to a shared project sees sizes on tasks. Attempting to change one is refused by the server and surfaces the standard permission message, matching how every other field behaves for them today.

## Edge Cases

**No size set** — Default and permanent valid state, including every task that existed before release. Shown as an unobtrusive placeholder that is still a full-size click target.

**Re-selecting the current size** — A no-op: no request, no timeline entry, no toast, no error. Note that the existing change-detection compares the inbound value against the stored value without normalising type, so this must be handled deliberately rather than assumed.

**Rapid consecutive changes on the same task** — The displayed and persisted value must be the one the user selected last, regardless of the order in which responses arrive. No request sequencing exists today, so this needs explicit handling.

**Same task edited in two tabs or on two devices** — Last write wins. The stale view keeps its own value until it refetches. Accepted behavior.

**Subtasks** — The data model permits a size on any task, subtasks included. **No UI for setting a subtask's size is in scope**: subtask rows navigate to the parent task, and there is no route to a subtask's own details page. A parent never aggregates, sums, or derives anything from its subtasks' sizes.

**Recurring tasks** — Size behaves as an ordinary per-task attribute. Setting it on a recurring parent affects only that task and must **not** be treated as a template change, because the existing template-change path deletes future instances.

**Completed, archived, or cancelled tasks** — Size remains visible and editable, matching how the status control behaves for these tasks today.

**Task no longer exists when the change is submitted** — The server's not-found response is surfaced with the standard treatment and the chip reverts.

**Unrecognised or out-of-range size in an API response** — Rendered as unset. Must not break the row or the page.

**Right-to-left locales** — The chip must be positioned by logical rather than physical direction, and a Latin letter inside an RTL row must not produce ambiguous placement.

## Error Handling

**Network or server failure** — Chip reverts to its previous value; a non-blocking error message appears. No navigation, no interruption of other work, no change to other fields.

**Rejected for lack of permission** — Chip reverts and the user sees the standard permission-denied message. This path must be correct on its own merits, because the server is the only authority.

**Invalid size value submitted** — Rejected with a validation error naming the field. This **deliberately diverges** from the existing priority behavior, which silently coerces unrecognised values to the lowest enum value; size must never coerce, never silently ignore, and never persist an out-of-set value.

**Size omitted from an update request** — Leaves the existing size unchanged. Omission and explicit clearing are distinct.

**Concurrent modification** — No conflict dialog, no merge prompt, no blocking.

**Timeline write failure** — Must not fail or roll back the size change. Note that the underlying event-logging function re-throws, so isolation must be preserved deliberately.

## Out Of Scope

- Sorting or filtering by size, including search chips and saved views
- Bulk editing size across multiple tasks
- Cross-device or cross-tab realtime sync, and any push, polling, or event infrastructure
- Editable chips on Kanban cards, Eisenhower cards, universal search results, and nested subtask rows
- Any UI for setting a subtask's size, and any rollup of subtask sizes
- Propagating size to recurring instances, and any fix to the existing destructive template-change behavior — **file separately as a defect**
- Exposing an access-level or permission field on the task response, and any read-only-aware UI treatment
- Fixing the access-resolution precedence bug whereby project-level `rw` overrides an explicit task-level `ro` share — **file separately**
- Fixing the inaccurate OpenAPI status/priority declarations beyond what size requires
- Any mapping from size to hours, days, story points, or velocity
- Reporting, dashboards, charts, capacity planning, or derived metrics
- MCP tool exposure, CalDAV sync, import/export/backup formats
- Configurable, per-project, or per-user scales; adding XS, XXL, or a fifth value
- Product analytics on adoption
- Backfilling, inferring, or defaulting a size on existing tasks
- Quick-add text syntax
- Any change to priority's appearance or behavior

## Technical Scope

**Data model and persistence** — One new optional attribute on the task entity, plus an idempotent migration adding it to existing installations without disturbing existing rows. No other entities, tables, or relationships.

**API** — Create and update accept the attribute; read and list return it. Because bodies are mapped through explicit per-field builders rather than a generic allowlist, the field must be added there deliberately or it is silently discarded. Validation rejects rather than coerces.

**Authorization** — No new authorization surface and no new response fields. The existing write guard covers the single update route; this requires verification rather than new code.

**Activity timeline** — Size changes flow through the existing generic field-change event derivation. No new event-type code is expected; the dead priority-specific helper must not be used as a template. The value encoding must be chosen so that no legitimate size is discarded as falsy.

**Recurrence** — Explicitly _not_ added to the template-field set.

**Frontend types and shared control** — The task type gains the optional attribute. One reusable control, with a variant for compact-chip versus form-field presentation, serves the list row, details page, and creation form. This is a genuine new component: the two existing priority dropdowns are independent implementations and are a precedent for drift, not for reuse.

**Frontend — list row** — A new inline editing affordance, the first besides the status control. Must account for the row's reserved right-edge region, its click-and-keyboard navigation behavior (neither mouse nor keyboard interaction with the chip may navigate), and the two separate desktop and mobile render trees. The row's update path currently sends the whole task; size must use a field-scoped request instead.

**Frontend — request handling** — Optimistic display with revert on failure, plus sequencing so that a stale response cannot overwrite a newer selection.

**Frontend — state** — Because list views hold tasks in local component state rather than the store, cross-view visibility relies on the existing refetch-on-navigation behavior. Migrating lists onto the global store is not in scope.

**Frontend — duplication** — Size added to the duplication allowlist. Note this module is currently uncommitted; confirm it lands before depending on it.

**Internationalisation** — New label strings across all twenty-five locale files, plus an automated key-presence check, since inline English fallbacks make missing keys invisible at runtime.

**API documentation** — OpenAPI task schema and create/update bodies updated with the attribute, its permitted values, and its actual wire type.

**Testing** — Backend: validation, persistence, authorization rejection, timeline logging across all transitions, migration idempotency. Frontend: the shared control, optimistic update and revert, request sequencing, keyboard operation. End-to-end: set from a list, verify on details.

## Non-functional Requirements and Constraints

**Storage and wire format** — Persist as a bounded integer. On input, accept either the string form or the integer form and normalise, matching how priority and status are handled. On output, return the stored integer, which is what the serializer actually does for every other task enum. Do not introduce a field-specific string serialization; that would make size the only attribute on the resource with an asymmetric read/write shape.

**Value encoding** — `S=1, M=2, L=3, XL=4`, with SQL `NULL` meaning unset. Zero must not be assigned to any size. This is mandatory, not stylistic: the event logger discards falsy values, and several code paths apply `|| default` to enum fields, so a zero-valued size would be silently dropped from the audit trail.

**Value set** — Exactly four values plus unset. Unitless, and never presented as or converted into a duration.

**Request scope** — A size change must send only the size field. Sending the full task object is unacceptable: it violates "other fields untouched," and because the recurrence check compares an inbound string against a stored integer, a full-object update of a recurring parent would spuriously trigger the destructive template-change path.

**Backward compatibility** — Clients that neither send nor read size continue to work unchanged. Omitting size never clears it.

**Migration safety** — Idempotent, safe against installations with existing task data, and carrying **no column default**, so existing rows remain NULL. The priority column's `defaultValue: 0` must not be copied; doing so would backfill every existing task.

**Authorization is server-enforced** — The server is the sole authority. No client-side permission logic is introduced.

**No new infrastructure** — No websockets, server-sent events, polling, background jobs, or external services. Enforced at code review rather than by test.

**Single shared control** — One implementation with presentation variants, serving all three placements.

**Localisation** — All twenty-five locale files carry the new keys before release. Size letters render untranslated; only surrounding labels are localised. Layout uses direction-logical positioning so right-to-left locales render correctly.

**Interaction cost** — One click to open, one to choose. No navigation, modal, reload, or list reordering. This is the feature's entire premise; a costlier flow fails the business goal regardless of correctness.

**Accessibility** — Keyboard-operable with the current value announced, and never conveyed by colour alone. The control must suppress the parent row's Enter and Space navigation while focused — a guard the existing status control does not implement.

**Visual density** — The chip must not increase row height at supported widths, and must remain within the viewport without horizontal scrolling. Note the desktop metadata line already overflow-scrolls when crowded; the chip must not rely on that region.

## Acceptance Criteria

| ID    | Acceptance Criterion                                                                                                                                                                                                             | Verifiable By    |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| AC-1  | A task's size can be set to S, M, L, or XL, or left unset; the API rejects every other value                                                                                                                                       | Automated Test   |
| AC-2  | Running the migration against a database containing existing task rows leaves every existing row's size as SQL NULL, and re-running the migration is a no-op                                                                       | Automated Test   |
| AC-3  | A task created without a size specified is unset                                                                                                                                                                                   | Automated Test   |
| AC-4  | A user with edit permission can change a task's size from a list row without opening the task, navigating, reloading, or causing the list to reorder                                                                               | UI Check         |
| AC-5  | A user with edit permission can change a task's size from the task details page                                                                                                                                                    | UI Check         |
| AC-6  | With the update request delayed by two seconds, the chip displays the newly chosen value within one render frame of selection, before the request settles                                                                          | Automated Test   |
| AC-7  | When the update fails with a server error the chip reverts and a network error message is shown; when it fails with a permission error the chip reverts and the permission message is shown                                        | Automated Test   |
| AC-8  | A size change from any surface sends a request containing only the size field, and no other stored task attribute changes as a result                                                                                              | API Check        |
| AC-9  | A size changed on the details page is shown in the list on return without a full page reload, and a size changed in a list is shown on the details page when opened                                                                | Integration Test |
| AC-10 | A size can be cleared to unset via an explicit "None" option, after which the task behaves identically to one never sized                                                                                                          | UI Check         |
| AC-11 | Re-selecting a task's current size sends no request and creates no timeline entry                                                                                                                                                  | Automated Test   |
| AC-12 | An update containing only size leaves the stored priority value identical and emits exactly one size event and no priority event                                                                                                   | Automated Test   |
| AC-13 | A size can be set when creating a task, and the created task carries it in every view                                                                                                                                              | UI Check         |
| AC-14 | A user holding only read access to a task receives an authorization rejection when submitting a size change, and the stored value is unchanged                                                                                     | API Check        |
| AC-15 | An update request that omits size leaves the existing size unchanged                                                                                                                                                               | API Check        |
| AC-16 | An out-of-set size value is rejected with a validation error naming the field, with no coercion, no silent ignore, and no persistence                                                                                              | API Check        |
| AC-17 | Every size transition is recorded in the activity timeline with both previous and new values displayed, including unset→S, S→unset, S→XL, and XL→S                                                                                 | Integration Test |
| AC-18 | A failure to write the timeline entry does not fail or roll back the size change itself                                                                                                                                            | Automated Test   |
| AC-19 | Setting a size on a recurring parent task changes only that task, and leaves its existing future instances present with unchanged ids, due dates, and subtasks                                                                     | Integration Test |
| AC-20 | Duplicating a task produces a copy carrying the original's size                                                                                                                                                                    | Automated Test   |
| AC-21 | When two size selections are made in rapid succession and their responses arrive out of order, the displayed and stored value is the one selected last                                                                             | Automated Test   |
| AC-22 | A size value outside the permitted set received in an API response renders as unset without breaking the row or the page                                                                                                           | Automated Test   |
| AC-23 | Using only the keyboard, a user can focus the chip inside a row, open it with Enter, move between options with arrow keys, and select with Enter, with the URL unchanged throughout; pressing Space while the chip is focused does not navigate | Automated Test   |
| AC-24 | A screen reader announces the control's label and current value, and size is distinguishable without relying on colour                                                                                                             | Manual Test      |
| AC-25 | At 320px, 375px, 768px, and 1440px, with a task carrying a project, three tags, a due date, and a recurrence indicator, row height is identical with and without the size chip, and the chip is reachable without horizontal scrolling | UI Check         |
| AC-26 | In a right-to-left locale, the size chip is positioned consistently with the row's other trailing elements and the letter renders unambiguously                                                                                    | Manual Test      |
| AC-27 | An automated check asserts that all twenty-five locale files contain the complete size key set                                                                                                                                     | Automated Test   |
| AC-28 | The published API documentation describes size, its permitted values, and its wire type, and a contract test confirms the documented type matches what the read endpoint actually returns                                          | API Check        |
| AC-29 | Existing API clients that neither send nor read size continue to create, read, and update tasks unchanged                                                                                                                          | Integration Test |

## Assumptions

Beliefs held while writing this, each distinct from the binding constraints above.

1. **Sizing is a planning activity, not a tracking one.** Users set size while deciding what to work on and rarely revisit it. This justifies prioritising one-click list editing over everything else.
2. **Four values are enough,** and the coarseness is a feature. If usage clusters at one end, the value set is a live question again.
3. **Untranslated letters are acceptable in all twenty-five locales.** Weakest for non-Latin-script and right-to-left locales, which is why AC-26 exists as a check rather than a presumption.
4. **Refetch-on-navigation satisfies "stays in sync."** Users are assumed not to need the two views open simultaneously, and not to edit the same task from two devices often enough for last-write-wins to lose meaningful work.
5. **A row has space for one more chip without layout rework.** The cheapest thing to falsify before any backend work: drop a static letter into both render trees and load the page at the four widths named in AC-25.
6. **Existing effort workarounds migrate voluntarily.** No detection or cleanup of "(quick)" title padding is offered.
7. **The existing write guard fully covers the update route,** so only verification is required. This holds for the route itself; the known precedence bug between project-level and task-level shares is inherited rather than introduced, and is filed separately.
8. **Users will not expect size to propagate across recurring instances.** The existing propagation mechanism is destructive, and per-occurrence sizing is defensible in its own right. Worth confirming with users who rely on recurring tasks.
9. **Absence of adoption measurement is acceptable;** success will be judged qualitatively.
10. **Excluding sort and filter will not immediately undermine the feature** — users get value from seeing sizes while scanning before they can organise by them. This is the weakest assumption in the document: the stated pain is that a list gives no sense of scale, and a label you cannot sort or group by only partly addresses that. A clickable prototype shown to a handful of users would settle it before build.
11. **The task duplication module lands before this work depends on it.** It is currently uncommitted, and AC-20 targets it.
