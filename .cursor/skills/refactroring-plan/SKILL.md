---
name: refactoring-plan
description: Turns a Jira/KAN refactoring task or task description into a structured refactoring plan. Use when the user asks to create a refactoring plan or passes a KAN task ID for a refactor.
disable-model-invocation: true
---

# Generate Refactoring Plan

Use Plan Mode. This is a refactor of <target>. Do not edit any files — produce a plan only. Observable behavior must remain unchanged.

Read the actual code first. Base every statement on what you found, cite file paths, and label anything unconfirmed as an assumption.

## Hard rules

- **Do not implement** — no application code, tests, config, or migrations.
- **Do not propose code changes** — no diffs, snippets, or “change line X to Y”.
- **Do not call Atlassian write tools** (create, edit, transition, comment, worklog, links).

## Inputs

The user may provide a **task ID** and/or a free-text refactoring description. Treat these as the same issue:

| User input | Issue key |
|------------|-----------|
| `KAN-42` | `KAN-42` |
| `42` | `KAN-42` |
| A KAN issue URL | Extract the key (`KAN-n`) |

Reject keys whose project is not `KAN`. Do not search or read issues outside project `KAN`.

Optional: the user may also pass extra notes or a target (module, file, concern). Merge them with Jira; if they conflict, ask (or record as assumptions).

If no task ID is given, use the free-text refactoring task description as the sole input.

## Outputs

| Artefact | Default path |
|----------|----------------|
| Refactoring plan | `docs/<feature-slug>.refactoring-plan.md` |

Use a slug from the Jira summary when available (lowercase, hyphens); otherwise derive one from the refactoring target. If a plan already exists for that issue, update it in place unless the user names another path.

---

## Workflow

### 1. Fetch the task (when a KAN key is present)

Use the Atlassian MCP. Site / `cloudId`: `https://epam-team-ai-adoption.atlassian.net`.

1. `getJiraIssue` with:
   - `issueIdOrKey`: the KAN key
   - `fields`: `["*all"]` (include comments via the default comment field on `*all`)
   - `responseContentFormat`: `"markdown"`
   - `expand`: `"renderedFields,names"`
2. `getJiraIssueRemoteIssueLinks` for the same key.
3. If `issuelinks` (or equivalent) lists other **KAN** issues, fetch each linked KAN issue with `getJiraIssue` (same field/format settings). Skip non-KAN links. Cap extra fetches at 10.

Collect at least: key, summary, description, issue type, status, priority, labels, components, assignee, reporter, parent/epic, acceptance-criteria custom fields if present, comments, remote links, and KAN issue links.

If MCP auth fails, authenticate the Atlassian server once and retry. If the issue is missing or not in KAN, stop and tell the user.

Do **not** draft the plan until this fetch is done (when a key was provided).

### 2. Inspect relevant files

Inspect the codebase for the refactoring target. Identify callers, side effects, tests, and config branches from the real code — not only from the Jira text.

### 3. Ask blocking technical questions if needed

Ask only when something cannot be determined from Jira and the codebase. Otherwise make reasonable assumptions and state them explicitly.

### 4. Create the implementation plan

Use the following structure:

1. Change type & goal — what kind of refactor this is, what it improves, and what's explicitly out of scope.

2. Current behavior map — what the code observably does today:
    - inputs/outputs at the boundary
    - entry points (all real callers, not just exports)
    - side effects (writes, events, external calls)
    - flags/config that branch behavior
    - contracts and invariants callers rely on
    - existing tests that pin this behavior
    - behaviors with no coverage

3. Context pack — files the implementer will need: what will change, what guards it, what to consult only if surprised, what to ignore.

4. Staged plan — small stages, each leaving the repo green. Before moving code with no coverage, add characterization tests first. Name the check that gates each stage.

5. Behavior verification map — every behavior from #2 mapped to how it gets verified after the refactor, including edge cases (empty inputs, error paths, flag combinations). Flag anything unverifiable.

6. Risks & assumptions — ranked risks with mitigations, assumptions a human should confirm, and how to roll back mid-refactor.
