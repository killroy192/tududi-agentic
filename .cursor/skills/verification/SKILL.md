---
name: generate-verification-plan
description: Writes a verification plan before implementation, and scores the same gates after implementation. Code diff is optional. Use when the user asks for a verification plan, to verify before coding, or to score a completed change.
disable-model-invocation: true
---

# Generate Verification Plan

Two modes. Choose one from the user request before writing anything.

| Mode | When | Scores |
|------|------|--------|
| Before implementation | User asks for a verification plan before coding, or no implementation exists yet | Leave every score blank |
| After implementation | User asks to verify or score a completed change | Assign **0–2** on every gate |

If the mode is unclear, ask which one to run.

After implementation updates `docs/<feature-slug>.verification.md` in place when a before-implementation plan is already there. Otherwise create that file.

## Hard rules

- **Do not implement** — no application code, tests, config, or migrations.
- **Do not propose code changes** — no suggested diffs, snippets, pseudocode patches, or “change line X to Y”. A code diff supplied as input is evidence, not a patch to write.
- **Score only after implementation.** Before implementation, describe how each gate will be checked and what a full score requires.

## Inputs

| Input | Required | Notes |
|-------|----------|--------|
| Feature spec | Yes | Under `docs/` or pasted in chat |
| Feature implementation plan | Yes | Under `docs/` or pasted in chat |
| Code diff | No | Pasted diff, a file path, or a git range (branch, commit, or working tree). In After implementation, use it as evidence. In Before implementation, use it only to see what already exists. |

In After implementation, when no diff is given, collect one with git against the implementation base when that base is obvious. If it is not, ask. Do not invent a diff. Before implementation does not need a diff.

## Output

| Artefact | Default path |
|----------|----------------|
| Verification plan | `docs/<feature-slug>/verification.md` |

Produce the file with [verification.template.md](./verification.template.md). Section titles must match exactly.

## Workflow

1. Choose the mode.
2. Read the spec and the implementation plan. Read a code diff only when one was provided or, in After implementation, when git can supply it.
3. Identify the repository commands for type checking, linting, building, smoke testing, and complexity analysis from `package.json` and `AGENTS.md`. Record the exact command. If the repo has no command for a check, write that. Do not invent commands.
4. Write the plan for the chosen mode.

### Before implementation

For each gate:

- List the tools, commands, or scripts that will be used.
- Describe what a full score requires.
- Omit **Score**, **Reasoning**, and **Actions to reach 2**.

Do not run the checks.

### After implementation

Run the local checks that apply to the change (type check, lint, relevant tests, build). Record each command and its result. Skip long-running end-to-end suites and anything that mutates data unless the plan requires them; record what was skipped.

For each gate:

- Assign a score from **0–2** (0 = fails, 1 = partially meets, 2 = fully meets).
- List the tools, commands, or scripts used during the evaluation.
- Briefly explain the reasoning behind the score.
- Describe the actions required to achieve a full score, if the score is below 2.

Base scores on the spec, the plan, the code diff, and command results. When a diff is missing, say which gates lack that evidence and score them from what you could inspect.

## Verification gates

- **Specification compliance** – Does the implementation satisfy every acceptance criterion defined in the specification?
- **Scope control** – Does the change include only what was requested, without unnecessary additions or unrelated modifications?
- **Test quality** – Do the tests validate the expected behavior including edge cases (not just increase code coverage), and would they fail if the implementation were incorrect?
- **Risk** – Does the change introduce any security, performance, reliability, data integrity, or rollout risks?
- **Maintainability** – Is the implementation easy to understand, maintain, and extend for a developer unfamiliar with the codebase?
- **Evidence** – Is there sufficient evidence (tests, logs, screenshots, or other artifacts) for a reviewer to verify the change without re-reading the entire implementation?
