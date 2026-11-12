# KAN-18 refactor plan: split `TaskDetails.tsx` into section components

Ticket: [KAN-18](https://epam-team-ai-adoption.atlassian.net/browse/KAN-18) - "MK7: Split TaskDetails.tsx into sub-components"

The plan has eight stages, and every stage leaves the repo green. The parent becomes a layout that calls hooks and contains no `useEffect` of its own. Each of the ticket's sections becomes a hook-plus-component pair that renders the existing card unchanged.

Two findings from the code changed the plan:
- **Section state can't live inside the section component.** The Overview tab unmounts whenever the user switches tabs. Today the recurrence edit form, unsaved subtasks, next iterations and attachment count survive a tab switch because the parent holds them. Keeping that behavior means the parent must call each section's hook.
- **`TaskDetailsHeader.tsx` already exists**, at 793 lines. "Header" therefore becomes a hook that holds the header's handlers, not a new file with the same name.

---

## 1. Change type and goal

**Type:** Split one large component and pull its logic into hooks. No behavior change.

**Goal:**
- Turn `frontend/components/Task/TaskDetails.tsx` (1,423 lines, 14 `useEffect`, about 25 handlers) into a layout that only wires things together. It should have no direct `useEffect`.
- Each ticket section is a `useTaskDetailsX` hook (state, effects, handlers) plus a `TaskDetailsX` component that renders the existing card.
- Page-level effects move into custom hooks.
- The repeated "update the task, refetch it, write it to the store" sequence goes behind one shared helper.
- Remove `any` from the new and touched code, and from every `useStore` selector.

**Out of scope:**
- Visual changes, DOM structure changes, i18n changes.
- Rewriting the existing cards. Exception: their prop types get narrowed where a signature has to line up (`TaskRecurrenceCard.onChange`, the link getters on `TaskDetailsHeader` and `TaskTagsCard`).
- Splitting the 793-line `TaskDetailsHeader.tsx`.
- Extracting Content, Project, Area, Due date or Defer until into sections. Their handlers stay in the parent but use the shared helper.
- The `any` in `TaskAreaCard`, `TaskAttachmentsCard` and `TaskSubtasksSection`.
- Fixing the latent bugs listed in section 6. They are kept as they are.
- Turning on the `no-explicit-any` lint rule.

## 2. Current behavior map

**Boundary**
- The page is mounted by the route `/task/:uid` in `frontend/App.tsx:25`. `App.tsx` imports `./components/Task/TaskDetails`, which resolves to the file `TaskDetails.tsx` before the folder's `index.ts`. That's an assumption about how the bundler resolves it (file before directory); it holds today.
- Inputs:
  - `uid` from the route.
  - `location.state.isNew` and `location.state.from`.
  - Zustand: `tasksStore`, `projectsStore`, `tagsStore`, `areasStore`, `userSettingsStore.aiAssistantEnabled`.
- Outputs: the rendered page, toasts, writes to the store, and calls to `tasksService`, `projectsService` and `attachmentsService`.

**Page-level behaviors** (all have a line reference in `TaskDetails.tsx`)
- **P1, lines 55–59.** If `isNew`, replace the navigation state with `{}` so a refresh doesn't re-trigger edit mode.
- **P2, lines 62–75.** When `uid` changes or the page unmounts: if the task was new and nothing has set `taskModifiedRef`, delete it on the server and filter it out of the store using `useStore.getState()`.
- **P3, lines 502–525.** If the task isn't in the store, fetch it and append it. A fetch error shows "Task not found". A missing `uid` shows "No task uid provided". The loading flag starts as `!task`.
- **P4, lines 193–203.** Lazily load tags and areas if they haven't loaded yet.
- **P5, lines 110–143 and 222–226.**
  - A `mousedown` outside an element with `data-overdue-toggle` closes the overdue bubble.
  - The bubble closes when `isOverdue` becomes false.
  - The `actionsMenuOpen` and `actionsMenuRef` branch is dead code: the ref is never attached and nothing sets it to true.
- **P6.** `timelineRefreshKey` goes up by one after most successful mutations. That re-fetches `TaskTimeline` on the Activity tab.
- **P7.** Tabs: `activePill` switches between overview, attachments and activity. Overview content unmounts when you leave the tab.
- **P8.** Delete: a confirm dialog, then `deleteTask`, then navigate to `location.state.from` or `/today`. It sets the modified flag first, so P2 doesn't fire.
- **P9.** Error or not-found screen with a "Go to Today" button.

**Section behaviors**
- **Header.**
  - Title updates are trimmed. Nothing happens if the title is empty or unchanged. The handler rethrows on error.
  - Status update.
  - Priority update calls `fetchTaskByUid(uid!)` with no guard, then `updateTaskInStore`. The timeline refresh comes before the toast. It rethrows on error.
  - Size save sets the modified flag before its guard. It reads `useStore.getState()`, then calls `updateTaskInStore({...current, size})`. There's no refetch and no timeline bump.
  - Completion toggle merges the response into the task, keeping `subtasks` as a fallback. It writes using replace-at-index, then calls `refreshRecurringSetup(mergedTask)`, then bumps the timeline.
  - Also covered: the overdue icon and bubble, `isPastDue`, and `autoEditTitle={isNewTask}`.
- **Subtasks.**
  - Resets `hasLoadedSubtasks` and `lastKnownSubtaskCount` when `uid` changes.
  - Fetches subtasks on the first load or when the count drops from more than 0 to 0. Writes using replace-at-index with `{...task, subtasks}`.
  - `pendingSubtasks` mirrors `task.subtasks`.
  - Save checks for changes first: length, name and status, plus the `_isNew`, `_isEdited` and `_statusChanged` flags. It then updates, refetches, sets `lastKnownSubtaskCount`, and writes with replace-at-index. On error it rolls `pendingSubtasks` back. There's no success toast.
- **Recurrence.**
  - The form is seeded from the task and re-synced when the task's eight recurrence fields change.
  - Choosing `monthly` when no month day is set defaults it to today's day of the month.
  - The save payload nulls out fields based on `recurrence_type`, and the editor closes even when the save fails.
  - Fetches the parent task when `recurring_parent_uid` is set.
  - Next iterations come from the task itself if it's a template, or from the parent if the task is an instance.
  - `refreshRecurringSetup` is called from the header's completion toggle, so the two sections are coupled.
  - `canEdit` is `!recurring_parent_id`.
- **Tags.**
  - Nothing happens if the new tag list matches the current one in order.
  - Tags are sent as `{name}` objects. The store write uses replace-at-index with a subtasks fallback.
  - On error the toast shows `error.details.join('. ')`, then `error.message`, then the i18n fallback. The handler rethrows.
  - `getTagLink` (uid plus slug, otherwise the encoded name) is also passed to the header.
- **People.** Calls `updateTask({assigned_to})`, then `updateTaskInStore`. There's no success toast and no timeline bump. The error toast is the hardcoded, untranslated `'Failed to update assignment'`. `TaskAssignedToCard` fetches people itself.
- **Attachments.** On `task.uid` it fetches the attachment count, which the header badge displays on every tab. `TaskAttachmentsCard` reports count changes through `onAttachmentsCountChange`.
- **AI.**
  - Only rendered when `aiAssistantEnabled` is true.
  - The header's sparkle button calls `ref.activate()` through `TaskAIInsightsHandle`.
  - `aiInsightsActive` is passed back to the header.
  - The project is looked up by `task.project_id`.
- **Unlisted cards that stay in the parent.**
  - **Content:** trimmed, nothing happens if unchanged, rethrows.
  - **Project:** select, clear, and create inline (create also appends to `projectsStore`). Writes with replace-at-index.
  - **Area:** select and clear, written with `updateTaskInStore`.
  - **Due date:**
    - Validates against defer-until, comparing with the end of the UTC day.
    - Shows a past-date warning toast but still saves.
    - The draft re-syncs when `task.due_date` changes.
  - **Defer until:**
    - The same validation is skipped for recurring instances.
    - The toast prefers `error.message`.
    - The draft does not re-sync when the task changes, unlike due date.
  - Link helpers `getProjectLink` and `getAreaLink`.

**Invariants callers rely on**
- **I1.** Every mutation sets `taskModifiedRef.current = true` before its first `await`. P2 depends on this.
- **I2.** There are two store-write strategies:
  - replace-at-index on the `tasksStore.tasks` array captured at render time, which does nothing if the task isn't in the store;
  - `updateTaskInStore`, which merges by `id` with a subtasks fallback.

  The same handlers have to keep using the same strategy.
- **I3.** Effects run in the order they're declared. In particular the subtask reset runs before the subtask load.
- **I4.** State survives a tab switch: recurrence form, `pendingSubtasks`, next iterations, `parentTask`, attachment count.
- **I5.** Handlers that rethrow (title, content, project create, tags, priority) are relied on by their cards to keep edit mode open.

**Existing tests that pin this behavior**
- `frontend/components/Task/TaskDetails/__tests__/TaskContentCard.test.tsx` covers the card only.
- `e2e/tests/task-size.spec.ts` opens `/task/:uid` and covers saving size, reverting on failure, and showing size on other views.
- `frontend/components/Task/__tests__/TaskHeader.size.test.tsx` covers `TaskHeader`, which is a different component.

**Not covered by any test:** P1–P9, and every section behavior except size. Nothing tests `TaskDetails.tsx` itself.

## 3. Context pack

**Files that will change**
- `frontend/components/Task/TaskDetails.tsx`
- `frontend/components/Task/TaskDetails/index.ts`
- New files in `frontend/components/Task/TaskDetails/`:
  - `TaskDetailsSubtasks.tsx`
  - `TaskDetailsTags.tsx`
  - `TaskDetailsPeople.tsx`
  - `TaskDetailsRecurrence.tsx`
  - `TaskDetailsAttachments.tsx`
  - `TaskDetailsAI.tsx`
  - a hook module for the header actions
  - page-level hooks (task data, abandoned-task cleanup, clearing navigation state, lazy store loads, overdue bubble, due-date and defer-until drafts)
  - the shared task-update helper
  - a pure link-helpers module
- Small prop-type changes in `TaskRecurrenceCard.tsx`, `TaskDetailsHeader.tsx` (the `getProjectLink`/`getTagLink` types) and `TaskTagsCard.tsx` (`getTagLink`).

**Guards**
- The existing tests listed in section 2.
- New characterization tests under `frontend/components/Task/TaskDetails/__tests__/`.
- `npm run lint`, `npx tsc --noEmit`, `npm run frontend:test`, and `npm run test:ui` for task-size.

**Consult only if something surprises you**
- `frontend/store/useStore.ts`: `TasksStore`, and `updateTaskInStore` around line 621. `StoreState` is not exported, but selector types are inferred from `create<StoreState>`.
- `frontend/utils/tasksService.ts`
- `frontend/components/AI/TaskAIInsights.tsx`, for the `forwardRef` handle pattern.
- `frontend/components/Task/TaskForm/TaskSubtasksSection.tsx`, where the `_isNew` and `_isEdited` flags come from.
- `frontend/entities/Task.ts`, `Tag.ts` and `Project.ts`.

**Ignore:** the backend, `TaskHeader.tsx`, and other views.

## 4. Staged plan

Each stage is one commit. Its gate has to pass before the next stage starts.

**Stage 0: baseline.**
- Record the current results of lint, `tsc`, frontend Jest, and the task-size e2e.
- Gate: all green. Lint is already clean on these files.

**Stage 1: characterization tests, written before any code moves.**
- Add a React Testing Library suite for the `TaskDetails` page. It mocks `tasksService`, `attachmentsService` and `projectsService`, uses a real Zustand store, and renders inside `MemoryRouter` at `/task/:uid`.
- It pins:
  - P1, P2 (both the modified and unmodified unmount), P3 (all three paths), P4, P5, P7, P8 and P9;
  - one happy path and one error path per section handler;
  - I1 (a mutation followed by unmount must not delete the task);
  - I2 (which store method each handler calls);
  - I4 (recurrence edit state and `pendingSubtasks` survive a tab switch);
  - I5 (the rethrow contract).
- Gate: the new suite passes against the untouched code.

**Stage 2: pure helpers.**
- Extract the three link builders into a typed module with their own unit tests.
- Introduce the shared update helper, which runs update, refetch and store write. It offers both I2 strategies explicitly, plus a subtasks-fallback option, and sets the modified flag first.
- Nothing uses the helper yet.
- Gate: unit tests, lint, `tsc`.

**Stage 3: page-level hooks.**
- Move P1, P2, P3, P4, P5 and the due-date and defer-until drafts into custom hooks.
- Call them from the parent in the same order the effects are declared today.
- Delete the dead `actionsMenu` branch.
- Gate: the Stage 1 suite, plus `tsc`.

**Stage 4: Subtasks and Recurrence.**
- Create `useTaskDetailsSubtasks` with `TaskDetailsSubtasks`, and `useTaskDetailsRecurrence` with `TaskDetailsRecurrence`.
- The recurrence hook exposes `refreshRecurringSetup`. The header's completion toggle consumes it through the parent, which removes the cross-section coupling without a ref.
- Type the recurrence form: field names become a keyed union, and `onChange` changes in `TaskRecurrenceCard`.
- Type the subtask draft flags with a draft type that has the optional `_isNew`, `_isEdited` and `_statusChanged` fields.
- Gate: the Stage 1 suite, especially I3 and I4, plus `tsc`.

**Stage 5: Tags, People, Attachments, AI.**
- Create a hook-plus-component pair for each.
- The attachment count and the AI `active` flag and `onClick` are returned from their hooks so the header can still receive them.
- Type `getTagLink` with `Tag`.
- Type the project lookup with `Project`.
- Catch errors as `unknown` and narrow them so `details` and `message` are read exactly as they are today.
- Gate: the Stage 1 suite.

**Stage 6: header actions and unlisted handlers.**
- Move title, status, priority, size, completion, delete and the overdue handlers into the header-actions hook.
- Replace the duplicated update-and-store blocks in Content, Project and Area with the shared helper, keeping each handler's write strategy, toasts, rethrow behavior and timeline bump unchanged.
- Type `priority` as `PriorityType | number`.
- Gate: the Stage 1 suite, plus the task-size e2e.

**Stage 7: cleanup.**
- Remove every `(state: any)` `useStore` annotation and confirm nothing else uses `useStore` directly.
- Export the new sections from `index.ts`.
- Confirm the parent has no `useEffect` import.
- Run `npm run lint` and fix anything it reports.
- Gate: everything from Stage 0 passes again. A manual smoke test of the page on all three tabs, with AI turned on and off.

## 5. Behavior verification map

| Behavior | Verified by |
|---|---|
| P1 to P3, P8, P9 | Stage 1 page suite: missing uid, fetch fails, task already in store, delete navigates to `from` or `/today` |
| P2 and I1 | Unmount after no edits deletes the task; unmount after any one mutation, including size, does not |
| P4 | Tags and areas load only when they haven't loaded and aren't loading |
| P5 | Outside click closes the bubble; clicking the toggle doesn't; the bubble closes when the task is no longer overdue |
| P6 | `TaskTimeline` gets a new key after each handler that bumps it, and not after People or Size |
| P7 and I4 | Switch tabs mid-edit and come back: the form and pending subtasks are still there |
| Subtasks | First load, count dropping to 0 triggers a refetch, save that changes nothing makes no call, save error rolls back |
| Recurrence | Default month day for `monthly`, nulling per type, editor closes on error, template vs instance iterations, toggle triggers a refresh |
| Tags | Same order makes no call; error toast picks `details`, then `message`, then the fallback |
| People | Untranslated error text, no success toast |
| Attachments | Badge count shows on Overview; it updates from the card callback |
| AI | Hidden when turned off; header button calls `activate` |
| Due and defer | Validation across the day boundary, past-date warning still saves, recurring instance skips the check, defer draft doesn't re-sync |
| I2 | Each handler is spied on to confirm `setTasks` vs `updateTaskInStore` |
| I3 | Changing uid resets subtask state before the next load |
| I5 | Rejecting handlers keep the card in edit mode |
| Size | Existing e2e: `task-size.spec.ts` |

**Can't be fully verified:**
- Race conditions from the stale `tasksStore.tasks` closure after an `await`. The plan keeps those semantics but can only check them by reading the code.
- Leftover `any` won't fail lint because the rule is off. It needs a grep plus review.

## 6. Risks and assumptions

**Risks, highest first**
1. **Losing state on tab switch (I4).** If section state ends up inside the component, edits disappear when the user changes tabs. Mitigation: hooks are called by the parent, and the Stage 1 test for I4 pins it.
2. **Breaking I1.** A handler that sets the modified flag after its first `await`, or a helper that skips it, would delete a new task the user just edited. Mitigation: the helper sets the flag first, and there are dedicated unmount tests.
3. **Unifying the two store-write strategies (I2).** Merging them, or switching to `getState()`, would change behavior quietly. Mitigation: the helper takes the strategy as an explicit option, and spy tests check it.
4. **Effect order between hooks (I3).** Mitigation: keep hooks called in the original declaration order.
5. **Import resolution.** `./components/Task/TaskDetails` must keep pointing at the page, not the barrel. Mitigation: don't rename or move `TaskDetails.tsx`.
6. **Changing card prop types.** Narrowing types may ripple into other places that use `TaskRecurrenceCard`, `TaskTagsCard` or `TaskDetailsHeader`. Mitigation: `tsc` gate. As far as I found, the only consumer is the page.

**Assumptions for a human to confirm**
- Latent bugs stay as they are in this refactor:
  - the untranslated People error;
  - priority's unguarded `uid!`;
  - the stale-closure store writes;
  - defer-until not re-syncing when the task changes;
  - recurrence closing the editor on error.
- "No useEffect in the parent" is satisfied by effects living in custom hooks.
- Removing the dead `actionsMenu` code counts as a behavior-neutral change.

**Rollback:** every stage is its own commit with a green gate, so a stage can be reverted on its own. Stage 1 (tests) and Stage 2 (unused helpers) are safe to keep even if everything after them is abandoned.
