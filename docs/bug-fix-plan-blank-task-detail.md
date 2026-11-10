# Bug Fix Plan: Blank Task Detail Page (`/task/{uid}`)

Status: approved acceptance criteria, implementation not started.
Context: `docs/context-map/context-map.md`.

## Bug report

**Description:** When navigating to a task detail page (e.g. `/task/{uid}`), the page stays blank. The task page never renders.

**Steps to reproduce:**
1. Log in with a user.
2. Navigate to Today (or any page with tasks).
3. Create a new task.
4. Open this task (e.g. click a task, which goes to `/task/{uid}`).

## Root cause

Confirmed in the debug session [Debug blank task detail page](9c9b3472-e870-451c-95c7-0da52937576f).

In `frontend/components/Task/TaskDetails.tsx` (lines 199-203), the areas effect is:

```
useEffect(() => {
    if (!areasStore.isLoading && areasStore.areas.length === 0) {
        areasStore.loadAreas();
    }
}, [areasStore]);
```

- With no areas saved, an empty list after loading looks the same as "not loaded yet."
- Each `loadAreas` call replaces the `areasStore` object twice: once when loading starts and once when it ends.
- The effect depends on the whole store object, so it runs again and calls `loadAreas` again.
- The page re-renders about every 50 ms and never paints the task.

Debug evidence: the effect ran at least 40 times with `areasLength: 0` and `hasLoaded: true`.

Ruled out: tags reload loop, task fetch, render crash, new-task cleanup.

Same pattern elsewhere:
- `frontend/components/Area/AreaDetails.tsx` (lines 80-84) has the same loop. Its "not found" logic (lines 100-103) also depends on `areas.length > 0`.
- `frontend/components/Project/ProjectDetails.tsx` (lines 110-114) already uses the safe `hasLoaded` check.

## Acceptance criteria

### Expected behavior

- **AC-1:** A logged-in user creates a task from Today and opens it. `/task/{uid}` shows the full detail layout: header (title, status, priority) and the content, subtasks, recurrence, project, area, assignee, tags, due date, and defer-until cards. It never stays blank.
- **AC-2:** AC-1 holds when the user has zero areas.
- **AC-3:** AC-1 holds when the user has one or more areas, and the Area card lists them.
- **AC-4:** One visit to `/task/{uid}` requests the areas list at most once. It does not request it again while the user stays on the page.
- **AC-5:** After the task appears, the page stops re-rendering when nothing changes. No constant re-render loop and no steady CPU use.
- **AC-6:** A newly created task opened through the shell's create button (`isNew`) shows its title in edit mode. It is not deleted while it loads.

### Edge cases

- **AC-7:** If the areas request fails, the task page still appears. The error is logged once, with no retry loop. The Area card shows an empty list or no selection without crashing.
- **AC-8:** Opening a task by direct URL or hard refresh, when the store holds no tasks, shows a loading view and then the task.
- **AC-9:** A uid that does not exist, or that the user cannot access, shows the "Task Not Found" view with a working "Go to Today" button. It is never blank and never loops.
- **AC-10:** Moving between tasks on the same mounted page (parent to subtask, or browser back and forward) shows the second task with no blank state and no repeat areas request.
- **AC-11:** If the user creates their first area elsewhere in the app, the Area card shows it the next time they open a task. That change must not bring back the loop.
- **AC-12:** The same zero-areas loop no longer happens on `/area/{uid}`, including for an area uid that does not exist.
- **AC-13:** Tags, projects, subtasks, attachment count, and recurring-iteration loads on the task page work as before, and none of them loops.
- **AC-14:** Automated tests cover the zero-areas case on the task page, and they fail on the current code.

## Implementation plan

Steps are in dependency order. Each can be committed on its own.

**Step 1: Write failing tests for the task page.**
Add `frontend/components/Task/__tests__/TaskDetails.test.tsx`. Render `TaskDetails` at `/task/:uid` inside a memory router, with the task already in the Zustand store, and replace the API services with fakes.
- Zero areas: the areas request returns an empty list. Expect the task title to appear and the areas request to run exactly once, still exactly once after timers have run.
- Areas present: the areas request returns one area. Expect the task to appear, one request, and the area listed in the Area card.
- Areas request fails: the request is rejected. Expect the task to appear and exactly one request, with no retries.

*Why:* reproduces the bug in a repeatable way and fails on current code (AC-14).

**Step 2: Fix the areas effect in `TaskDetails.tsx`.**
- Trigger the load only when areas have not been loaded and are not loading. Use the store's `hasLoaded` and `isLoading` flags, not `areas.length`.
- Depend on those flags and the load function, not the whole `areasStore` object.
- Keep the effect shape used in `ProjectDetails.tsx`.

*Why:* an empty list is a finished state, not a sign that loading has not happened. Depending on the flags stops each store update from re-running the effect. This is the root-cause fix, and the step 1 tests pass afterwards.

**Step 3: Add edge-case tests for the task page.**
- Not in store: the task is fetched by uid. Expect the loading view, then the task, and one areas request.
- Unknown uid: the uid fetch is rejected. Expect the "Task Not Found" view and no loop.
- New task: the route opens with `isNew`. Expect the title in edit mode and no delete call while the page loads.
- Different task: switch to another uid on the same mounted page. Expect the second task to appear and no extra areas request.

*Why:* locks in AC-6, AC-8, AC-9, and AC-10.

**Step 4: Write failing tests for `AreaDetails`.**
Add `frontend/components/Area/__tests__/AreaDetails.test.tsx`.
- Zero areas and a uid that does not exist: expect "Area not found" and exactly one areas request.
- Areas present and a valid uid: expect the area to appear.

*Why:* reproduces the same loop on `/area/{uid}` (AC-12).

**Step 5: Fix `AreaDetails.tsx`.**
- Apply the same load-effect change as step 2.
- Change the "not found" logic to wait for `hasLoaded` instead of a non-empty list. Show the loading state until areas have loaded.

*Why:* removes the loop and lets an empty list correctly mean "not found."

**Step 6: Confirm newly created areas reach the store (AC-11).**
Confirm that creating an area updates the store's area list (for example through `setAreas`). If any creation path skips the store, update the store on that path. Do not drop the `hasLoaded` check to work around it.

*Why:* with the `hasLoaded` check, the page no longer re-fetches areas just because the list is empty, so new areas must arrive through the store.

**Step 7: Run the full checks.**
Run `npm run frontend:test`, the linter and formatter, and the TypeScript build. Then run the manual checks below.

## Verification

| Criterion | Automated (Jest + RTL) | Manual check |
|---|---|---|
| AC-1: full layout appears | Step 1: zero areas and areas present | Create a task from Today, open it, confirm all cards appear |
| AC-2: zero areas | Step 1: zero areas | New user with no areas: repeat AC-1 |
| AC-3: areas present | Step 1: areas present | Create an area, open a task, confirm the Area card lists it |
| AC-4: one areas request | Step 1: request count equals one | DevTools Network: one `GET /api/areas` per page visit |
| AC-5: no render loop | Step 1: count stays at one after timers run | React Profiler: no commits while idle, CPU stays flat |
| AC-6: new task | Step 3: new task | Shell "create task" button: title is editable and the task survives the load |
| AC-7: areas request fails | Step 1: areas request fails | Block `/api/areas` in DevTools: task appears, one error logged |
| AC-8: direct URL or refresh | Step 3: not in store | Paste a `/task/{uid}` URL in a new tab, hard refresh |
| AC-9: unknown uid | Step 3: unknown uid | Visit `/task/does-not-exist` and another user's task uid |
| AC-10: switching tasks | Step 3: different task | Parent to subtask link, then browser back and forward |
| AC-11: first area created | None | Zero areas: open a task, create an area, reopen the task |
| AC-12: area page | Step 4 | Zero areas: visit `/area/unknown`, see "Area not found" with one request |
| AC-13: other loads unchanged | Steps 1 and 3 | Task with tags, subtasks, attachment, recurrence: everything loads once |
| AC-14: tests fail on old code | Steps 1 and 4 | Run new tests against `HEAD` before the fix, confirm they fail |

Regression checks: run the existing `TaskContentCard` and `MarkdownRenderer` tests, and `npm run backend:test`. Also check `/project/{uid}` by hand, since it uses the same areas store.

## Risks, dependencies, and compatibility

- **Stale area list.** Areas load only on the first visit. Any area-creation path that skips the store leaves the Area card out of date until reload. Step 6 handles this.
- **Costly `TaskDetails` tests.** The component is about 1,400 lines, calls many services, and renders many child cards. Tests need careful fakes for services, `react-i18next`, `ToastContext`, and the router. They may be brittle until the component is split, which is out of scope.
- **Loop detection in tests.** A loop shows up as repeated timers and store updates, not a thrown error. Tests must flush timers and pending promises, then assert call counts. `loadAreas` lazy-loads `areasService` through a dynamic import, which can interact badly with fake timers. Mock the service module directly.
- **Same pattern elsewhere.** Other effects in `TaskDetails` and `AreaDetails` depend on whole store objects. The `hasLoaded` guards keep the tags and projects effects safe for now. Changing them is out of scope.
- **Store behavior unchanged.** `loadAreas` keeps its current behavior, including setting `hasLoaded: true` on failure. This is what keeps AC-7 free of retry loops.
- **No migrations or API changes.** Frontend-only. Rollback is a revert of the commit. The `/api/v1` vs `/api` mismatch noted in the context map is not involved.
- **No error boundary.** If a child card throws, the page still goes blank because the app has no React error boundary. Adding one is a separate hardening task and is not part of this plan.

## Open items

- Context map gaps still unresolved: expected UI wording, console and network evidence from the original report, and the `TodayPlan.tsx` click path.
