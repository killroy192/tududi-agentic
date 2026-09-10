---
name: generate-plan
description: Turns a feature spec into a TDD implementation plan for new or changed product behavior. Use when the user asks to /plan, generate an implementation plan, or plan a feature, bugfix, or enhancement from a spec. Do not use for behavior-preserving refactors — that is the refactoring-plan skill.
disable-model-invocation: true
---

# Generate Feature Plan (TDD)

Produce **one markdown file** — a spec-driven implementation plan for **new or changed observable behavior**. Downstream agents use this plan plus the spec to build a context map and a verification plan.

This is not a refactoring plan. If the goal is to restructure existing code while keeping behavior the same, stop and use the **refactoring-plan** skill instead.

## Hard rules

- **Do not implement** — no application code, tests, config, or migrations.
- **Do not propose code changes** — no diffs, snippets, or “change line X to Y”.
- **Stay spec-bound** — every planned step must trace to an acceptance criterion or an explicit assumption. Do not invent product behavior the spec does not ask for.

## When to use

- The user invoked `/plan` or asked for an implementation plan for a feature, bugfix, or enhancement.
- A feature spec exists (under `docs/` or pasted in chat).
- The work will add or change what users, APIs, or other systems can observe.

## When not to use

- Observable behavior must stay unchanged (extract, rename, split modules, reduce duplication) → **refactoring-plan**.
- The user only wants a context map or a verification plan → those skills.
- There is no spec and the request is not for new or changed behavior.

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

1. **Read the spec.** Extract acceptance criteria, constraints, encoding/API/UI contracts, and stated out-of-scope. Note gaps and contradictions.
2. **Inspect the relevant codebase.** Find modules that already own adjacent concepts. Record how similar fields, endpoints, and UI surfaces work today — including pitfalls the new behavior must not copy.
3. **Name the files and modules** likely to change or be added. Distinguish “will change” from “consult only” and “explicitly untouched”.
4. **Ask only blocking questions** — when the spec and code disagree, or a decision cannot be inferred. Otherwise state a reasonable assumption and label it as such.
5. **Write the plan** using [plan template](./plan.template.md). Fill every section. Section titles must match exactly.

### What good content looks like (by section)

**Confirmed Facts** — only what you verified in the spec or the code. Cite file paths. No speculation.

**Assumptions** — numbered, technical, and confirmable. Each one unblocks planning where the spec is silent.

**Files / Modules Involved** — grouped (backend / frontend / tests / other). Say why each area is involved, not just the path.

**Implementation Plan** — small, dependency-ordered increments. Each increment names (a) the test that pins the new behavior, (b) the change that makes it pass, and (c) why this order. Start with the thinnest slice that proves the core contract, then edge cases, then integrations. Leave the system working after each step. Do not prescribe functions, diffs, or line edits.

**Risks** — migrations, compatibility, silent existing bugs the feature might inherit, rollout.

**Out Of Scope** — work the spec excludes, plus adjacent cleanup that must not sneak in.

**Verification** — one table row per acceptance criterion. Every AC mapped. Prefer the strongest automated check that can actually observe the criterion.

## Pipeline

This plan is an input to **create-context-map** and **verification**. Write it so those agents can work without re-discovering the spec.
