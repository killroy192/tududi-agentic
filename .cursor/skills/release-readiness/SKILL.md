---
name: release-readiness
description: Produces a release readiness document (go/no-go verdict, impact analysis, metrics, rollback plan, risk management) for a set of changes before release. Use when the user asks to plan a release, assess release readiness or risk, or design a rollback/feature-flag strategy.
disable-model-invocation: true
---

# Release Readiness

Analyze a change (diff, PR, branch, or feature) and produce a Release Readiness document covering the verdict, impact, metrics, rollback, and risk management.

## Hard rules

- **Do not implement** — no application code, tests, config, or migrations.
- **Read-only research** — delegated subagents must not modify files.
- Every checklist answer must cite evidence (file/line or command output), not guesses.
- If evidence is missing for a checklist item, answer `false` or mark it `unknown` and say why. Never guess.

## Inputs

| Input | Required | Notes |
|-------|----------|-------|
| Diff / PR / branch / feature description | Yes | What is being released |
| Target environment or rollout constraints | No | e.g. multi-tenant, self-hosted, single deploy |

## Outputs

| Artefact | Default path |
|----------|--------------|
| Release readiness document | `docs/<change-slug>.release-readiness.md` |

`<change-slug>` is a lowercase, dash-separated slug of the change name (e.g. `task-size-field`).

---

## Workflow

Copy this checklist and track progress:

```
Release Readiness Progress:
- [ ] Step 1: Change analysis (explore subagent)
- [ ] Step 2: Metrics (explore subagent + synthesis)
- [ ] Step 3: Rollback strategy (explore subagent + synthesis)
- [ ] Step 4: Risk management and verdict (synthesis)
- [ ] Step 5: Save document and confirm path
```

### Step 1: Change analysis — delegate to an `explore` subagent

Give the subagent the diff/branch/feature scope and ask it to return, with file/line citations:

- **Blast radius**: changed files/modules/services, their dependents, existing test coverage.
- **Impact checklist**, each answered `true`/`false`/`unknown` + one-line comment with evidence:
  1. Affects critical/core functionality (auth, billing, primary data write paths)?
  2. Touches multiple user-facing surfaces at once (web, API, mobile, bot, etc.)?
  3. Affects data integrity and backward compatibility (migrations, irreversible writes, backfills)?
  4. Affects security posture (authn/authz, secrets, input validation, CORS)?
  5. Affects performance/scalability (hot paths, added latency, N+1 queries)?
  6. Affects third-party/external contracts (webhooks, integrations, sync protocols)?
  7. Cleanly reversible without data loss?
  8. Covered by existing automated tests (unit/integration/e2e)?

### Step 2: Metrics — delegate research, then synthesize

- Delegate to an `explore` subagent (can run in parallel with Steps 1 and 3): find existing observability relevant to the changed area — logs, counters/metrics, dashboards, alerts, SLOs.
- Main agent: propose new metrics/logs to add. Each proposed metric must map to a risk flagged `true` in Step 1 — no speculative metrics for risks that don't apply.

### Step 3: Rollback strategy — delegate research, then synthesize

- Delegate to an `explore` subagent (can run in parallel with Steps 1–2): identify what rollback mechanisms actually exist in this repo — deploy/revert process, migration undo commands, feature-flag system, cache/queue infra.
- Main agent, using Step 2's metrics and Step 3's research:
  - **Trigger conditions**: which metric thresholds/signals should trigger a rollback.
  - **Rollback action list**: ordered, concrete steps (e.g. revert deploy, run migration undo, disable flag, purge cache, notify stakeholders).
  - **Post-rollback verification**: metrics/tests that must pass to confirm the rollback succeeded.

### Step 4: Risk management and verdict — main agent only, no subagent

Judgment call based on Step 1's blast radius/impact — do not delegate:

- Feature flag: yes/no + justification.
- Alternative rollout recommendation (canary, blue-green, phased rollout, overnight/off-peak build) with reasoning tied to blast radius and rollback complexity.
- Readiness verdict:
  - **Go** — no `true` impact item lacks a mitigation, and the rollback path is verified.
  - **Go with conditions** — list each condition that must be met before or during rollout.
  - **No-go** — list the blocking gaps (e.g. irreversible migration without a plan, critical path without tests).

### Step 5: Save the document

1. Create `docs/` if it does not exist.
2. Write the result to `docs/<change-slug>.release-readiness.md` using the template below.
3. Confirm the full path to the user and state the verdict.

---

## Document template

```markdown
# Release Readiness: <change name>

## 0. Verdict
- Verdict: Go / Go with conditions / No-go
- Conditions or blockers: ...

## 1. Change Analysis
- Blast radius: ...
- Impact checklist:
  | # | Question | True/False/Unknown | Comment |
  |---|----------|--------------------|---------|

## 2. Metrics
- Existing metrics tracked: ...
- New metrics to add: ... (mapped to risk #)

## 3. Rollback Strategy
- Trigger conditions: ...
- Rollback actions:
  1. ...
- Post-rollback verification: ...

## 4. Risk Management
- Feature flag: yes/no — justification
- Rollout recommendation: ... — reasoning
```
