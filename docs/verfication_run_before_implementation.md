# Task size verification plan

Source: `docs/task-size/spec.md` and `docs/task-size/plan.md`.

This document is the evaluation plan. It does not score an implementation. There is no code diff yet. After the change exists, fill each gate’s **Score** (0, 1, or 2) and **Reasoning** from the evidence that gate names. A score of 2 is the only full score.

| Score | Meaning |
| --- | --- |
| 0 | Fails the gate |
| 1 | Partially meets the gate |
| 2 | Fully meets the gate |

## Repository commands

Run these from the repository root unless a command says otherwise. Node 22 matches CI.

| Check | Command | Notes |
| --- | --- | --- |
| Typecheck | `npm run frontend:build` | `tsc --noEmit` runs inside this script. There is no separate typecheck script. The backend is JavaScript and has no typecheck. |
| Lint | `npm run lint` | Frontend ESLint (`frontend/**/*.{js,jsx,ts,tsx}`) and backend ESLint (`backend/`). CI runs this. |
| Format | `npm run format` | Prettier check. CI does not run it. Use it as maintainability evidence. |
| Build | `npm run frontend:build` | Same command as typecheck. CI runs `npm run build`, which is this script. |
| Backend tests | `npm test` | Jest for `backend/tests/unit` and `backend/tests/integration`. CI sets `FF_ENABLE_BACKUPS`, `FF_ENABLE_CALDAV`, and `FF_ENABLE_CALENDAR`. Set those when the CalDAV lock is part of the run. |
| Backend unit | `npm run backend:test:unit` | Model and module unit tests, including `backend/tests/unit/models/task.test.js` and `backend/tests/unit/modules/caldav/icalendar/vtodo-serializer.test.js`. |
| Backend integration | `npm run backend:test:integration` | Includes `tasks.test.js`, `subtasks.test.js`, `permissions-tasks.test.js`, `recurring-tasks.test.js`, `backend/tests/integration/mcp/mcp-tools.test.js`, and the new size suite once it exists. |
| Frontend tests | `npm run frontend:test` | Jest + Testing Library. CI does not run this. Co-locate tests under `frontend/components/Task/` and `frontend/components/Shared/`. |
| Coverage | `npm run test:coverage` | Use only to see which size paths ran. Coverage percentage is not a gate. |
| Playwright | `npm run test:ui` | Optional. The spec marks most UI rows as UI Check or Manual Test. Playwright is not required for a full score when the manual checklist below is filled. |
| Smoke | `npm start` | Webpack on port 8080 and the API on port 3002. Walk the manual checklist. There is no separate smoke script. |
| Migration up | `npm run db:migrate` | Umzug over `backend/migrations/`. Apply on a disposable copy of the SQLite file (`DB_FILE`, default `db/development.sqlite3`). |
| Migration status | `npm run db:status` | Confirms the app can open the database after the new migration. |
| Complexity | ESLint overlay below | The repository ESLint configs do not enable `complexity`. The overlay is an evaluation command. It does not change the lint config. |

Targeted Jest once the size suite exists (adjust the pattern to the file name that landed):

```bash
cd backend && cross-env NODE_ENV=test FF_ENABLE_CALDAV=true FF_ENABLE_CALENDAR=true jest tests/unit/models/task.test.js tests/integration --testPathPattern='size|tasks|subtasks|permissions-tasks|recurring-tasks|mcp-tools|caldav'
```

```bash
npx jest frontend/components/Task frontend/components/Shared --testPathPattern='[Ss]ize|TaskHeader|TaskItem|TaskDetails|TaskSubtasks|Priority'
```

Complexity overlay on the files the plan names. `warn` prints a report. It is evidence for the maintainability gate, not a repository failure.

```bash
npx eslint \
  frontend/entities/Task.ts \
  frontend/utils/tasksService.ts \
  frontend/store/useStore.ts \
  frontend/components/Shared \
  frontend/components/Task/TaskHeader.tsx \
  frontend/components/Task/TaskItem.tsx \
  frontend/components/Task/TaskDetails/TaskDetailsHeader.tsx \
  frontend/components/Task/TaskDetails.tsx \
  frontend/components/Task/TaskForm/TaskSubtasksSection.tsx \
  frontend/components/Task/TaskDetails/TaskSubtasksCard.tsx \
  frontend/components/Tasks.tsx \
  frontend/components/Task/TasksToday.tsx \
  frontend/components/Kanban/KanbanBoard.tsx \
  frontend/components/Eisenhower/EisenhowerMatrix.tsx \
  frontend/components/ViewDetail.tsx \
  frontend/components/Tag/TagDetails.tsx \
  frontend/components/Area/AreaDetails.tsx \
  frontend/components/Project/ProjectDetails.tsx \
  --rule 'complexity: [warn, 20]'
```

```bash
cd backend && npx eslint \
  models/task.js \
  modules/tasks \
  modules/mcp/tools/taskTools.js \
  modules/caldav/icalendar/vtodo-serializer.js \
  modules/caldav/icalendar/vtodo-parser.js \
  --rule 'complexity: [warn, 20]'
```

Migration down is not a root script for Umzug. `npm run migration:undo` uses sequelize-cli. Do not mix that runner with `npm run db:migrate` on the same database file. On a disposable copy, apply with `npm run db:migrate`, confirm the `tasks.size` column, then roll the new migration back with the same runner that recorded it and confirm the column is gone.

---

## 1. Specification compliance

Does the implementation satisfy every acceptance criterion in the spec?

**Score:** Pending

**Tools:** Backend Jest commands above, frontend Jest commands above, `npm start` plus the manual checklist, and direct reads of `PATCH /task/:uid` and task list responses (session cookie or Bearer token, same auth as today).

**Reasoning:** Fill after implementation. Record each AC as pass or fail. A single failed AC in the table keeps this gate below 2. Quote the observed label, status code, or JSON field for every failure.

**Actions for a full score:** Every row in the traceability table passes. The three notes under the table are recorded with a result, and each result still satisfies the spec sentence it cites.

### Traceability

| ID | Pass condition | Evidence to collect |
| --- | --- | --- |
| AC-1 | Today shared row, stored `size` null, closed control reads Unset. | Manual checklist, Today. |
| AC-2 | Task details header, stored `size` null, closed control reads Unset. | Manual checklist, `/task/:uid`. |
| AC-3 | Shared-row menu order is Unset, S, M, L, XL. | Frontend test of the dropdown on the row, plus one manual open. |
| AC-4 | Task-details menu order is Unset, S, M, L, XL. | Frontend test of the details header, plus one manual open. |
| AC-5 | Owner selects M on a shared row; after success the row reads M. | Manual checklist. |
| AC-6 | After M is saved, opening task details shows M. | Manual checklist, fresh load. |
| AC-7 | Owner selects L in task details; header reads L after success. | Manual checklist. |
| AC-8 | After L is saved from details, a loaded task list row reads L. | Manual checklist, fresh load. |
| AC-9 | Details for that task is already open; a list save updates the open details control with no manual refresh. | Manual checklist. See note A before scoring. |
| AC-10 | Owner selects Unset for a task stored as M; a following REST read has `size: null`. The field is present. | API test. |
| AC-11 | After a successful Unset save, the shared row reads Unset. | Manual checklist. |
| AC-12 | After a successful Unset save, task details reads Unset. | Manual checklist. |
| AC-13 | A size save leaves `priority` unchanged on the REST task. | API test. |
| AC-14 | A size save leaves status, due date, project, area, tags, completion, and recurrence unchanged. | API test. |
| AC-15 | Creating a task returns `size: null`, including when the create body contains a size. | API test. |
| AC-16 | The create-task form has no size control. | Frontend render test and one manual look. |
| AC-17 | A parent size save leaves the subtask’s stored size unchanged. | API test. |
| AC-18 | A subtask size save leaves the parent’s stored size unchanged. | API test. |
| AC-19 | An expanded subtask row under a list row has its own size control. | Frontend render test and one manual expand. |
| AC-20 | An existing subtask in the task details subtask section has its own size control. | Frontend render test and one manual look. |
| AC-21 | The new-subtask name field has no size control. | Frontend render test and one manual look. |
| AC-22 | A subtask created by name returns `size: null`. | API test. |
| AC-23 | A read-write collaborator sees the label and the menu does not open. | Frontend test with a non-owner `user_uid`, plus one manual session. |
| AC-24 | A read-only user sees the label and the menu does not open. | Same style of evidence as AC-23. |
| AC-25 | A read-write collaborator `PATCH` with `size` returns 403 and the stored size is unchanged. A body that also changes another field, such as priority, changes neither field. | API test. |
| AC-26 | A read-only user’s size submit returns 403 and the stored size is unchanged. | API test. |
| AC-27 | A user who cannot view the task gets the existing task access failure. The stored size is unchanged. | API test against `requireTaskWriteAccess` (HTTP 403 `{ error: "Forbidden" }`). |
| AC-28 | Owner submits `XX`. Response is HTTP 400, the error says the size is invalid (`The size is invalid`), stored size is unchanged. Also reject a different case, a surrounding space, and the string `"null"`. | API test. |
| AC-29 | Network error or HTTP 500: control keeps the last saved label, the only toast is "Failed to update size". The same toast and restored label apply to HTTP 400 from the owner’s own attempt. | Frontend test with a mocked failure, plus one manual failure (devtools offline or a forced 500). |
| AC-30 | Each virtual upcoming row shows the series size. | API assertion on the upcoming payload, plus manual upcoming rows. |
| AC-31 | A successful save from one virtual row updates every open virtual row of that series. Each row keeps its own due date and virtual flags. | Frontend test of the shared merge, plus manual upcoming list. |
| AC-32 | That virtual-row save shows one toast, "Size updated successfully". | Frontend test and manual checklist. |
| AC-33 | Changing the series size leaves a stored child’s size unchanged. | API test. |
| AC-34 | Changing the series size leaves that stored child row in place. | API test. |
| AC-35 | The child’s owner changing the child’s size leaves the series size unchanged. | API test. |
| AC-36 | A second session’s REST load returns the size saved by the first session. | API test with two authenticated clients. No live push is required. |
| AC-37 | A shared row in a filtered view has a size control. | Manual checklist. |
| AC-38 | A shared row in a project has a size control. | Manual checklist. |
| AC-39 | A shared row in an area has a size control. | Manual checklist. |
| AC-40 | A shared row in a tag has a size control. | Manual checklist. |
| AC-41 | A shared row in a grouped list has a size control. | Manual checklist. |
| AC-42 | A shared row in Kanban has a size control. | Manual checklist. |
| AC-43 | A shared row in the Eisenhower matrix has a size control. | Manual checklist. |
| AC-44 | The next-task suggestion has no size control. | Frontend render test and one manual look. |
| AC-45 | Search results that match a task have no size control. | Frontend render test and one manual look. |
| AC-46 | A chart or balance summary has no size control. | Frontend render test and one manual look. |
| AC-47 | A CalDAV task payload has no size field. A calendar update of an existing task leaves the stored size in place. | `vtodo-serializer` / CalDAV integration test with CalDAV flags on. |
| AC-48 | An MCP task-tool payload has no `size` field. MCP create and update inputs still have no size parameter. | `backend/tests/integration/mcp/mcp-tools.test.js` or the size suite’s MCP cases. |
| AC-49 | A successful shared-row save shows one toast, "Size updated successfully". | Frontend test and manual checklist. |
| AC-50 | A successful task-details save shows one toast, "Size updated successfully". | Frontend test and manual checklist. |

### Notes the reviewer records

**A. AC-9 and routes.** The spec requires an already-open task details view to show a size saved from the task list without a manual refresh. The plan states that list pages and `/task/:uid` are different routes and are not mounted together, and that a save updates the shared task store. Score AC-9 only from the behavior the spec states. Record whether both surfaces were actually open, or whether the details view was opened after the save. A pass that depends on a later navigation is a failed AC-9.

**B. Labels and toasts.** Visible labels are Unset, S, M, L, and XL. Toast text is "Size updated successfully" and "Failed to update size". English keys live next to `task.priorityUpdated` in `public/locales/en/translation.json`. `backup.size` stays the backup-file label. The stored value is never the word Unset.

**C. Owner and completed tasks.** The owner is the user id on the task record being changed. A completed task remains editable for that owner from the shared row and from task details. A size change does not delete or create stored recurring children and does not write an activity-history entry. A priority change still deletes future stored children and still writes priority history.

### Scoring

| Score | Condition |
| --- | --- |
| 0 | Any AC that changes stored data, access, or the success path fails, or the REST field is missing, renamed, or stores the label Unset. |
| 1 | The owner save path and the 400/403 paths pass, and at least one AC fails. |
| 2 | All fifty ACs pass, and notes A–C are recorded with results that match the spec. |

---

## 2. Scope control

Does the change include only what the spec and plan request?

**Score:** Pending

**Tools:**

```bash
git diff --stat
git diff --name-only
git diff
```

Compare the name list with the plan’s “Files / Modules Involved” and with “Out Of Scope” in both documents.

**Reasoning:** Fill after implementation. List every path outside the plan’s file list and say why it is required or why it counts against the score.

**Actions for a full score:** The diff stays inside the plan’s file list, except for the new migration file and the new size tests the plan asks for. Each extra path has a one-line reason tied to an acceptance criterion. Nothing in the out-of-scope list below is implemented.

### In scope

- New migration, newer than `backend/migrations/20260630000002-add-people-to-tasks.js`, plus `backend/models/task.js`. No older migration is edited.
- `backend/modules/tasks/core/builders.js`, `routes.js`, `core/serializers.js`, `utils/constants.js`, `operations/subtasks.js`.
- Lock tests only, unless a test forces a one-line omission of `size`, in `operations/recurring.js`, `utils/logging.js`, `modules/caldav/icalendar/vtodo-serializer.js`, `vtodo-parser.js`.
- `backend/modules/mcp/tools/taskTools.js` only to omit `size` from tool results.
- `backend/docs/swagger/tasks.js` documents `size` as `null` or `S`, `M`, `L`, `XL`.
- Client: `frontend/entities/Task.ts` (`size`, `user_uid`), `frontend/utils/tasksService.ts`, `frontend/store/useStore.ts`.
- New size dropdown beside `frontend/components/Shared/PriorityDropdown.tsx`, mounted from `TaskHeader.tsx`, `TaskItem.tsx`, `TaskDetailsHeader.tsx`, `TaskDetails.tsx`, `TaskSubtasksSection.tsx`, `TaskSubtasksCard.tsx`.
- List holders that keep their own arrays: `Tasks.tsx`, `TasksToday.tsx`, `KanbanBoard.tsx`, `EisenhowerMatrix.tsx`, `ViewDetail.tsx`, `TagDetails.tsx`, `AreaDetails.tsx`, `ProjectDetails.tsx`. The allowed change there is the shared size merge.
- English strings in `public/locales/en/translation.json`.
- New backend size tests and co-located frontend tests.

`user_uid` on web task responses, including nested subtasks, is in scope. The plan requires it so the client can tell the owner from a read-write collaborator. The numeric `user_id` remains the server-side owner check.

### Out of scope (a hit here prevents a score of 2)

- Size control on the create-task form or the new-subtask name field.
- Filtering, sorting, or searching by size.
- Charts, metrics, summaries, next-task suggestion, or search results that use or show size.
- An activity-history entry for a size change.
- Telegram, CalDAV, or MCP payload or input changes, other than omitting `size` from MCP results.
- Bulk size edit, a per-occurrence size, a size on a recurring completion.
- Creating or recreating stored recurring children, or rewriting a child’s size from the series.
- A live-sync channel.
- A parent size calculated from subtasks.
- Administrator access for tasks that administrator cannot already view.
- Locale files other than English.
- Edits to `TaskWithSubtasks` inside `TaskHeader`.
- Drive-by refactors in files the plan does not name.

### Scoring

| Score | Condition |
| --- | --- |
| 0 | An out-of-scope behavior is implemented, or an existing migration file is edited. |
| 1 | Behavior matches the spec, and the diff includes unrelated edits that do not change behavior. |
| 2 | The diff matches the in-scope list, and the out-of-scope list is untouched. |

---

## 3. Test quality

Do the tests assert the spec’s behavior, including the edge cases, and would they fail if that behavior were wrong?

**Score:** Pending

**Tools:** `npm test`, `npm run frontend:test`, and the targeted Jest commands. Read the new tests. Do not use coverage percentage as the score.

**Reasoning:** Fill after implementation. For each plan step 1–7 and 10–12, name the test and the assertion that would fail if the implementation were inverted. Name any AC whose only evidence is a manual check.

**Actions for a full score:** The tests below exist, assert the observable result (status, body, stored row, label, toast count), and fail when the implementation is wrong. Manual rows stay manual. A test that only snapshots a component, or only checks that a function was called, does not cover the AC it claims.

### Assertions that must be able to fail

| Plan step | The test fails if… |
| --- | --- |
| 1 | The model accepts a value other than `null`, `S`, `M`, `L`, or `XL`, or rejects one of those five. Existing rows are not forced to a letter. |
| 2 | Create, subtask create, or load omits `size`, returns a letter when the client sent one on create, or omits `user_uid` on the task or a nested subtask. |
| 3 | `S`, `M`, `L`, `XL`, or `null` fail to round-trip; omitting `size` clears it; or `XX`, wrong case, surrounding space, or `"null"` is stored or returns a status other than 400 with `{ error: "The size is invalid" }`. |
| 4 | A non-owner size write returns anything other than 403, changes `size`, or still applies a sibling field sent in the same body. A caller who fails `requireTaskWriteAccess` gets that existing failure and an unchanged size. |
| 5 | A size-only update changes priority, status, due date, project, area, tags, completion, or recurrence; deletes a future stored child; or writes an activity-history entry. A priority update no longer deletes future stored children or no longer writes priority history. |
| 6 | Parent and subtask sizes follow each other; a series size change changes or deletes a stored child; a child size change changes the series; an upcoming virtual row shows a size other than the series size. |
| 7 | An MCP tool result contains `size`, an MCP input gains a size parameter, a VTODO contains a size property, or a calendar update clears the stored size. |
| 10 | The closed control shows the wrong label, the menu order differs, Unset reports a value other than `null`, or a non-owner click opens the menu. |
| 11 | The control is missing from the shared row, details header, expanded subtask row, or details subtask section; or it appears on the create form, the new-subtask field, search, the next-task suggestion, or a chart or balance summary. Choosing a size follows the row click into task details. A completed task’s owner cannot change size. A subtask row saves the parent uid. |
| 12 | The save sends more than `{ size }`; success shows a toast other than one "Size updated successfully"; the open row or store keeps the old label; a virtual-row save changes that row’s due date or virtual flags, updates only one row of the series, or shows more than one toast; a network error, HTTP 500, or HTTP 400 from the owner replaces the label or shows a success toast. |

Integration tests rebuild the schema from the model. A green Jest run is not evidence that the migration file applies. That evidence belongs to the risk gate.

### Scoring

| Score | Condition |
| --- | --- |
| 0 | There is no size suite, or the tests pass against an implementation that stores the wrong value or skips the owner check. |
| 1 | The happy path and the 400 path are asserted, and at least one of access, recurrence, MCP/CalDAV, virtual-row merge, or failure toasts is unasserted. |
| 2 | Every row in the assertion table is covered by a test that fails when that behavior is wrong. UI-check and manual-test ACs that the plan leaves to the checklist are listed as manual, not claimed as automated. |

---

## 4. Risk

Does the change add security, performance, reliability, data integrity, or rollout risk?

**Score:** Pending

**Tools:** The API tests from gate 3, the migration procedure in “Repository commands”, and a read of the size-save client path (`tasksService` update, store merge, each list holder).

**Reasoning:** Fill after implementation. Mark each row in the risk register closed or open. An open row with no recorded mitigation keeps the gate below 2.

**Actions for a full score:** Every register row is closed by the evidence column, or the residual risk is written down and is one the spec already accepts (no live sync, no administrator bypass, English only).

### Risk register

| Risk | What closes it |
| --- | --- |
| A non-owner changes size because the menu is only hidden in the client. | AC-25, AC-26, AC-27 pass on the server. The owner check runs after write access and before any attribute is saved. |
| `serializeTask` spreads the row, so MCP gains `size` as soon as the column exists. | AC-48 is in the same increment as the model field. The MCP payload has no `size`. |
| A size save sends the whole task. Virtual rows share the series id and uid, so spreading the response replaces occurrence due dates. `updateTask` can also rename a series from `original_name`. | The request body is only `{ size }`. The merge copies `size` onto rows with the same uid and leaves `due_date` and `is_virtual_occurrence` in place. AC-31 and the step-12 test pass. |
| A collaborator edit that includes `size` is rejected in full, so a client that still sends the whole task fails. | The size control sends only `{ size }`. The step-4 test shows a mixed body changes nothing. |
| Jest never runs the migration. Existing databases stay without the column, or down leaves the column behind. | On a disposable SQLite file, `npm run db:migrate` adds a nullable `tasks.size`. Existing rows are null. Down removes the column. The migration file is new. |
| CalDAV `existingTask.update(taskData)` overwrites size if the parser emits `size`. | AC-47: VTODO has no size property, and a calendar update leaves the stored size. |
| Invalid size is written, or omit clears a saved size. | AC-28 and the omit case in step 3. Rejection happens before the task is written. |
| A size-only update deletes future stored children or writes history. | Step 5 tests. |
| Create honors a client-supplied size. | AC-15 and AC-22. |
| Another session is expected to update live. | AC-36 passes on the next load. The spec accepts that an open session that did not make the change stays stale. |
| Task load failure invents a size. | When tasks fail to load, the existing failure behavior remains and size is not given a substitute value. Record the observed failure. |
| Query cost of loading `user_uid` for the parent and each subtask. | Record the includes added for the owner user. A full score needs the extra include limited to the owner uid already required by the plan, with no new list endpoint. |

### Scoring

| Score | Condition |
| --- | --- |
| 0 | The server accepts a non-owner size change, a size-only update deletes stored children, or the migration was not applied on a real SQLite file. |
| 1 | Access, validation, and the migration up path are closed, and one register row is still open. |
| 2 | Every register row is closed, or the residual risk is one the spec already accepts and is named in the reasoning. |

---

## 5. Maintainability

Is the implementation understandable and extendable for a developer who does not already know this feature?

**Score:** Pending

**Tools:** `npm run lint`, `npm run format`, `npm run frontend:build`, the complexity overlay, and a read of the new dropdown and the owner check.

**Reasoning:** Fill after implementation. Say where validation, the owner check, and the size merge live. Quote any new function the complexity overlay reports at or above 20, and whether a new reader can follow it.

**Actions for a full score:**

- Lint and `tsc --noEmit` (via `npm run frontend:build`) pass.
- Size validation lives in one place used by the update path. The allowed set is `null`, `S`, `M`, `L`, `XL`, compared case-sensitively and without trimming.
- The owner check is the numeric `user_id` on the server. The client compares `user_uid` with the signed-in user’s `uid`.
- One dropdown component is used by the shared row, the details header, and both subtask surfaces. Priority keeps its border and its own menu.
- One merge applies a returned `size` in the task store and in each list holder that keeps its own array.
- English copy goes through the existing translation keys. The visible strings match the spec.
- New files follow current module layout: routes and operations stay under `backend/modules/tasks/`, client types stay in `frontend/entities/Task.ts`, the API call stays in `frontend/utils/tasksService.ts`.
- The complexity overlay is attached to the reasoning. A new function at or above 20 is either split until the report is quiet or the reasoning explains why the branch structure matches an existing function in that file.

### Scoring

| Score | Condition |
| --- | --- |
| 0 | Lint or the frontend build fails, or size rules are copied into each of the four UI call sites and the server route with no single check. |
| 1 | Lint and the build pass, and a new reader has to follow two competing save paths or two competing owner checks. |
| 2 | The actions list above holds, and the reasoning names the single validation function, the single owner check, and the single merge. |

---

## 6. Evidence

Can a reviewer confirm the change without re-reading the implementation?

**Score:** Pending

**Tools:** Saved command output from the commands in this document, the filled manual checklist, and the migration log from the disposable database.

**Reasoning:** Fill after implementation. Point to the artifact for each group of ACs. A claim with no artifact does not count.

**Actions for a full score:** The review packet contains all of the following.

1. Command logs: `npm run lint`, `npm run frontend:build`, `npm test` (with the CalDAV and calendar flags), `npm run frontend:test` for the size, row, and details suites.
2. The complexity overlay output.
3. Migration evidence: up on a disposable database, `tasks.size` present and null on existing rows, down removes the column. Include the new migration filename.
4. API evidence for AC-10, AC-13 through AC-15, AC-17, AC-18, AC-22, AC-25 through AC-28, AC-33 through AC-36, either as Jest output or as captured status codes and JSON.
5. MCP and CalDAV evidence for AC-47 and AC-48.
6. The manual checklist below, each row filled with pass or fail and the route used.
7. For AC-29, a note of how the failure was forced (offline, mocked 500) and the label that remained on screen.
8. For AC-9, a note that states whether details was open at the moment of the list save.

Screenshots are optional. A passing Jest assertion is enough for an automated row. A manual row needs the checklist, not a screenshot of the closed menu alone.

### Scoring

| Score | Condition |
| --- | --- |
| 0 | The packet is missing, or it contains only a coverage number. |
| 1 | Automated logs are attached, and the manual checklist or the migration log is missing. |
| 2 | All eight packet items are present and a reviewer can match each AC to one of them. |

---

## Manual checklist

Run against `npm start`. Use an owner session unless the row names another role. Fill **Result** with pass or fail after implementation.

| Result | Where | Check | ACs |
| --- | --- | --- | --- |
| | Today | Closed control reads Unset when `size` is null. Menu order is Unset, S, M, L, XL. | AC-1, AC-3 |
| | Today | Select M. One toast "Size updated successfully". Row reads M. Reload details: closed control reads M. | AC-5, AC-6, AC-49 |
| | Task details | Closed control reads Unset when `size` is null. Menu order matches. | AC-2, AC-4 |
| | Task details | Select L. Header reads L. One toast "Size updated successfully". Reload the list: row reads L. | AC-7, AC-8, AC-50 |
| | List and details together | With details already open, save from the list. Record whether the open details control changes without refresh. | AC-9 |
| | Shared row and details | Select Unset after a saved size. Both closed controls read Unset. REST `size` is null. | AC-10, AC-11, AC-12 |
| | Create form | No size control. After create, the new task reads Unset and REST `size` is null. | AC-15, AC-16 |
| | Expanded subtask row | Own size control. Saving it does not change the parent. | AC-17, AC-18, AC-19 |
| | Details subtask section | Existing subtask has its own control. The new-subtask name field has none. A subtask created by name has REST `size` null. | AC-20, AC-21, AC-22 |
| | Read-write collaborator | Label is visible. Menu does not open. | AC-23 |
| | Read-only user | Label is visible. Menu does not open. | AC-24 |
| | Owner, forced failure | Offline or HTTP 500. Label stays on the last saved value. Only toast is "Failed to update size". | AC-29 |
| | Upcoming virtual rows | Each row shows the series size. Changing one updates every open row of that series, keeps each due date, and shows one success toast. | AC-30, AC-31, AC-32 |
| | Filtered view, project, area, tag, grouped list, Kanban, Eisenhower | Each shared row has a size control. | AC-37–AC-43 |
| | Next-task suggestion, search, chart or balance summary | No size control. | AC-44, AC-45, AC-46 |
| | Completed task | Owner can change size from the shared row and from details. | Spec edge case |
| | Second session | Next load shows the saved size. The session that did not save does not change live. | AC-36 |

---

## Score sheet

Fill this after implementation. Leave it blank until then.

| Gate | Score (0–2) | Reasoning |
| --- | --- | --- |
| Specification compliance | | |
| Scope control | | |
| Test quality | | |
| Risk | | |
| Maintainability | | |
| Evidence | | |
