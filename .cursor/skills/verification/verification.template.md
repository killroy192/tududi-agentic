Use only with [verification skill](./SKILL.md). Section titles must match exactly.

When Mode is **Before implementation**, omit every **Score**, **Reasoning**, and **Actions to reach 2** line.
When Mode is **After implementation**, include those lines under each gate. Omit **Actions to reach 2** when the score is 2.

# Verification

Mode: Before implementation | After implementation

## Inputs used

- Spec:
- Implementation plan:
- Code diff:

## Commands

| Check | Command |
|-------|---------|
| Type check | |
| Lint | |
| Build | |
| Smoke test | |
| Complexity | |

## Specification compliance

Does the implementation satisfy every acceptance criterion defined in the specification?

Tools:

Full score requires:

Score:

Reasoning:

Actions to reach 2:

## Scope control

Does the change include only what was requested, without unnecessary additions or unrelated modifications?

Tools:

Full score requires:

Score:

Reasoning:

Actions to reach 2:

## Test quality

Do the tests validate the expected behavior including edge cases (not just increase code coverage), and would they fail if the implementation were incorrect?

Tools:

Full score requires:

Score:

Reasoning:

Actions to reach 2:

## Risk

Does the change introduce any security, performance, reliability, data integrity, or rollout risks?

Tools:

Full score requires:

Score:

Reasoning:

Actions to reach 2:

## Maintainability

Is the implementation easy to understand, maintain, and extend for a developer unfamiliar with the codebase?

Tools:

Full score requires:

Score:

Reasoning:

Actions to reach 2:

## Evidence

Is there sufficient evidence (tests, logs, screenshots, or other artifacts) for a reviewer to verify the change without re-reading the entire implementation?

Tools:

Full score requires:

Score:

Reasoning:

Actions to reach 2:
