---
name: generate-plan
description: Turns a feature spec into a structured feature implementation plan. Use when asked to create a plan for a new feature or when Plan Mode is enabled for feature work — not for refactors (use refactoring-plan).
disable-model-invocation: true
---

# Generate Feature Implementation Plan

Use Plan Mode to produce **.md file only** — a structured feature implementation plan from an existing spec. Another agent uses this plan and the spec to create a context map and verification plan. For behavior-preserving refactors, use the refactoring-plan skill instead.

## Hard rules

- **Do not implement** — no application code, tests, config, or migrations.
- **Do not propose code changes** — no diffs, snippets, or “change line X to Y”.

## Inputs

| Input | Required | Notes |
|-------|----------|--------|
| Feature spec | Yes | Under `docs/` or pasted in chat |

## Outputs

| Artefact | Default path |
|----------|----------------|
| Implementation Plan | `docs/<feature-slug>.plan.md` |

---

## Workflow

1. Inspect spec for task
2. Inspect the relevant parts of the codebase.
3. Identify the files, modules, and components involved.
4. Ask only blocking technical questions if something cannot be determined from the codebase or specification. Otherwise, make reasonable assumptions and state them explicitly.
5. Produce the plan using [plan template](./plan.template.md)
