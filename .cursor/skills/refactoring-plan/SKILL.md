---
name: refactoring-plan
description: Turns a refactoring task (chat description or Jira issue) into a behavior-preserving staged plan. Use when the user asks to /refactoring-plan, plans a refactor that must not change observable behavior, or names a Jira ticket for a refactor. Fetch issue details via the Atlassian Jira MCP. Do not use for new features, bugfixes, or spec-driven behavior changes — that is the generate-plan skill.
disable-model-invocation: true
---

# Generate Refactoring Plan

Use Plan Mode. This is a refactor of <target>. Do not edit application code — produce a plan only. Observable behavior must remain unchanged.

Read the actual code first. Base every statement on what you found, cite file paths, and label anything unconfirmed as an assumption. Jira is the source of **intent and scope**, not of current behavior.

## Hard rules

- **Do not implement** — no application code, tests, config, or migrations.
- **Do not propose code changes** — no diffs, snippets, or “change line X to Y”.
- **Do not write to Jira** — read only. No create, edit, transition, comment, worklog, or link tools.

## Inputs

| Input | Required | Notes |
|-------|----------|--------|
| Refactoring task | Yes | Chat description, and/or a Jira key / URL (e.g. `KAN-15`) |
| Jira issue (via MCP) | When a key, URL, or ticket title is given | Fetch before inspecting code |

## Outputs

Implementation Plan. When a Jira issue was used, cite it at the top:

`**Jira:** [KAN-n](https://epam-team-ai-adoption.atlassian.net/browse/KAN-n) — <summary>`

---

## Workflow

1. **Resolve the Jira task** (when a ticket is involved). See [Jira via MCP](#jira-via-mcp).
2. **Inspect relevant files.** Code wins over Jira for what the system does today.
3. **Ask blocking technical questions** if needed — including when Jira and the code disagree, or the ticket describes new/changed behavior (that is **generate-plan**, not this skill).
4. **Create the implementation plan** with the following structure:

  1. Change type & goal — what kind of refactor this is, what it improves, and what's explicitly out of scope. Derive goal and out-of-scope from the Jira summary/description when present.

  2. Current behavior map — what the code observably does today:
      - inputs/outputs at the boundary
      - entry points (all real callers, not just exports)
      - side effects (writes, events, external calls)
      - flags/config that branch behavior
      - contracts and invariants callers rely on
      - existing tests that pin this behavior
      — behaviors with no coverage

  3. Context pack — files the implementer will need: what will change, what guards it, what to consult only if surprised, what to ignore.

  4. Staged plan — small stages, each leaving the repo green. Before moving code with no coverage, add characterization tests first. Name the check that gates each stage.

  5. Behavior verification map — every behavior from #2 mapped to how it gets verified after the refactor, including edge cases (empty inputs, error paths, flag combinations). Flag anything unverifiable.

  6. Risks & assumptions — ranked risks with mitigations, assumptions a human should confirm, and how to roll back mid-refactor.

## Jira via MCP

Use the **Atlassian** MCP. Follow the project Jira scope rule: site `https://epam-team-ai-adoption.atlassian.net`, project `KAN` only, read-only, searches `maxResults: 10`.

**cloudId** for every call: `https://epam-team-ai-adoption.atlassian.net`

### When to fetch

- User gave a key (`KAN-12`) or browse URL → fetch that issue.
- User named a ticket by title or asked to find it → search, then fetch the match. If several matches, ask which one.
- User described the refactor in chat with no ticket → skip Jira; do not search the board unless they asked.

If MCP is unauthenticated or the call fails, ask the user to authenticate or paste the issue. Do not invent ticket content.

### How to fetch

1. **Known key** — `getJiraIssue` with `issueIdOrKey`, `responseContentFormat: "markdown"`. Include `comment` in `fields` only if the description is too thin to set goal/scope.
2. **Search** — `searchJiraIssuesUsingJql` with JQL always scoped `project = KAN`, `maxResults: 10`, `responseContentFormat: "markdown"`. Example: `project = KAN AND text ~ "split task service" AND status != Done ORDER BY updated DESC`.
3. **Related work** — if the description is thin or names other tickets, `getJiraIssueRemoteIssueLinks` on the same key. Stay inside project KAN; ignore issues outside KAN.

### What to take from the issue

Use summary, description, issue type, labels, components, and (when fetched) comments/remote links to fill **goal, constraints, and out of scope**. Treat acceptance criteria on a refactor ticket as invariants the refactor must not break — then confirm them in code.

Do not treat Jira as a behavior map. If the ticket asks for new product behavior, stop and use **generate-plan** instead.
