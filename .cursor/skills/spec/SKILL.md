---
name: generate-spec
description: Turns a Jira task into a structured implementation spec (no code). Use when asked to generate a spec, write a story spec, prepare work for an implementation-plan agent, or when given a Jira/KAN task ID. Supports God mode (autonomous review loop with no user questions).
disable-model-invocation: false
---

# Generate Spec

Produce a **.md file only** — a structured spec. Another agent uses it to write a safe implementation plan.

## Hard rules

- **Do not propose code changes** — no diffs, snippets, pseudocode patches, or “change line X to Y”.
- **Do not write an implementation plan** — no step-by-step coding tasks, file edit sequences, or PR breakdowns.
- **Clarify, don’t build** — inventory behavior, scope, risks, and verification so a later agent can plan safely.
- **Do not call Atlassian write tools** (create, edit, transition, comment, worklog, links).

## Inputs

The user only needs to provide a **task ID**. Treat these as the same issue:

| User input | Issue key |
|------------|-----------|
| `KAN-42` | `KAN-42` |
| `42` | `KAN-42` |
| A KAN issue URL | Extract the key (`KAN-n`) |

Reject keys whose project is not `KAN`. Do not search or read issues outside project `KAN`.

Optional: the user may also pass extra notes. Merge them with Jira; if they conflict, record the conflict (God mode: resolve in Assumptions and spec text; interactive mode: ask).

**God mode** is on when the user says `god`, `god mode`, `God mode`, or asks for an autonomous spec with no follow-up questions.

## Outputs

| Artefact | Default path |
|----------|----------------|
| Spec | `docs/<feature-slug>.spec.md` |

Use a slug from the Jira summary (lowercase, hyphens). If a spec already exists for that issue, update it in place unless the user names another path.

---

## 1. Fetch the task (always, before drafting)

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

Do **not** draft the spec until this fetch is done.

## 2. Gather product/code context

Inspect the repo as needed so **Current Behavior** and **Technical Scope** are factual (affected layers, existing UX, APIs, data). Stay descriptive — no solution design.

### Interactive (default)

Run a grill-me session for anything Jira + codebase still leave open: business goal, current vs expected behavior, constraints, edge cases, ambiguities. Challenge vague requirements. Ask focused questions; do not generate the spec until those answers exist.

### God mode

**Never ask the user follow-up questions.** Infer from Jira, links, comments, and the codebase. Put unresolved choices in **Assumptions**. Prefer the interpretation that matches existing product behavior and the issue description. If two interpretations remain equally plausible, pick one, state it as an assumption, and write the spec consistently with that choice.

## 3. Generate the spec

Write using exactly the [spec template](./spec.template.md). Implementation-agnostic, precise, complete, and suitable for product, engineering, and QA alignment.

## 4. Review with the spec-reviewer subagent (mandatory)

After each draft or revision, launch **exactly one** `spec-reviewer` subagent (definition: `.cursor/agents/spec-reviewer.md`).

Do not substitute another model. If `spec-reviewer` is unavailable, use `generalPurpose` with `model: gpt-5.6-sol-medium` and the system prompt from `.cursor/agents/spec-reviewer.md` unchanged.

The parent agent must not “self-review” instead of this subagent.

## 5. God mode loop

When God mode is on, repeat until **blocking count is 0**:

1. Inspect the task and gather all available context (Jira + repo).
2. Generate or update the specification.
3. Review with `spec-reviewer`. Categorize findings as **Blocking issues** (must be resolved) and **Non-blocking issues** (optional).
4. Resolve **all** blocking issues in the spec (and Assumptions if a decision was inferred).
5. Update the specification file.
6. Repeat the review cycle until no blocking issues remain.

Non-blocking issues may be applied when cheap; they must not keep the loop open.

Safety: max **3** review cycles. If blockers remain after 5, resolve them with explicit Assumptions and run **one** final review. If that review still FAILs, ship the spec anyway only after folding remaining blockers into Assumptions and tightening ACs so they are testable; tell the user the loop hit the cap and list leftover non-blocking items.

When God mode is off: present blocking findings to the user, get answers, then update and re-review until blocking count is 0.

## Done

The final artefact is a high-quality spec at the output path that has passed `spec-reviewer` with **zero blocking issues**. Briefly report: issue key, spec path, review verdict, blocking count (0), and any remaining non-blocking suggestions.
