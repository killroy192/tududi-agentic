---
name: release-strategy
description: Produces a release strategy document (impact analysis, metrics, rollback plan, risk management) for a set of changes before release. Use when the user asks to plan a release, assess release risk, or design a rollback/feature-flag strategy.
disable-model-invocation: true
---

# Release Strategy

Analyze a change (diff, PR, or feature) and produce a Release Strategy document covering impact, metrics, rollback, and risk management.

## Hard rules

- **Do not implement** — no application code, tests, config, or migrations.
- **Read-only research** — delegated subagents must not modify files.
- Every checklist answer must cite evidence (file/line or command output), not guesses.
- **Parallel research first** — launch the three research subagents in one turn, in parallel, before any synthesis. Do not wait for one research agent before starting another. Do not run synthesis until all three research results are back.

## Inputs

| Input | Required | Notes |
|-------|----------|-------|
| Diff / PR / branch / feature description | Yes | What is being released |
| Target environment or rollout constraints | No | e.g. multi-tenant, self-hosted, single deploy |

## Outputs

| Artefact | Default path |
|----------|----------------|
| Release note | `docs/<feature-slug>.release-note.md` |

---

## Workflow

Copy this checklist and track progress:

```
Release Strategy Progress:
- Phase A: Parallel research (3 independent subagents in one turn)
  - A1: Change analysis research
  - A2: Metrics research (existing observability only)
  - A3: Rollback research (existing mechanisms only)
- Phase B: Main-agent synthesis (after all of A completes)
  - B1: Metrics synthesis
  - B2: Rollback strategy synthesis
  - B3: Risk management
  - B4: Save document
```

### Execution model

| Work | Who | When |
|------|-----|------|
| Change analysis (blast radius + impact checklist) | Subagent A1 | Phase A — parallel |
| Existing observability discovery | Subagent A2 | Phase A — parallel |
| Existing rollback mechanism discovery | Subagent A3 | Phase A — parallel |
| Propose new metrics; map to flagged risks | Main agent | Phase B — after A |
| Triggers, rollback actions, post-rollback verification | Main agent | Phase B — after A |
| Feature flag + rollout recommendation | Main agent | Phase B — after A |
| Write `docs/<change-slug>.release-note.md` | Main agent | Phase B — last |

**Phase A rule:** In a single message, launch three independent Task/subagent calls with `explore` (or equivalent read-only explorer). Give each subagent the same change scope (diff / PR / branch / feature description) and any known file paths. Each subagent returns only its research findings — no document writing, no synthesis across other agents.

**Phase B rule:** Main agent only. Use A1–A3 outputs as evidence. Do not spawn further research subagents unless a critical citation gap blocks the document.

---

### Phase A — Parallel research (three independent subagents)

#### A1: Change analysis research

Ask the subagent to return, with file/line citations:

- **Blast radius**: changed files/modules/services, their dependents, existing test coverage.
- **Impact checklist**, each answered `true`/`false` + one-line comment with evidence:
  1. Affects critical/core functionality (auth, billing, primary data write paths)?
  2. Touches multiple user-facing surfaces at once (web, API, mobile, bot, etc.)?
  3. Affects data integrity and backward compatibility (migrations, irreversible writes, backfills)?
  4. Affects security posture (authn/authz, secrets, input validation, CORS)?
  5. Affects performance/scalability (hot paths, added latency, N+1 queries)?
  6. Affects third-party/external contracts (webhooks, integrations, sync protocols)?
  7. Cleanly reversible without data loss?
  8. Covered by existing automated tests (unit/integration/e2e)?

#### A2: Metrics research (existing only)

Ask the subagent to find existing observability relevant to the changed area — logs, counters/metrics, dashboards, alerts, SLOs — with file/line or config citations. Do **not** propose new metrics; that is main-agent work in B1.

#### A3: Rollback research (existing only)

Ask the subagent to identify what rollback mechanisms actually exist in this repo — deploy/revert process, migration undo commands, feature-flag system, cache/queue infra — with file/line or docs citations. Do **not** invent trigger thresholds or an action plan; that is main-agent work in B2.

---

### Phase B — Main-agent synthesis (after A1, A2, and A3 all return)

#### B1: Metrics synthesis

Using A1's impact checklist and A2's existing observability:

- Summarize existing metrics/logs that apply.
- Propose new metrics/logs to add. Each proposed metric must map to a risk flagged `true` in A1 — no speculative metrics for risks that don't apply.

#### B2: Rollback strategy synthesis

Using A1's blast radius/impact, B1's metrics, and A3's mechanism inventory:

- **Trigger conditions**: which metric thresholds/signals should trigger a rollback.
- **Rollback action list**: ordered, concrete steps (e.g. revert deploy, run migration undo, disable flag, purge cache, notify stakeholders).
- **Post-rollback verification**: metrics/tests that must pass to confirm the rollback succeeded.

#### B3: Risk management

Judgment call based on A1's blast radius/impact and B2's rollback complexity — do not delegate:

- Feature flag: yes/no + justification.
- Alternative rollout recommendation (canary, blue-green, phased rollout, overnight/off-peak build) with reasoning tied to blast radius and rollback complexity.

#### B4: Save the document

Write the result to `docs/<change-slug>.release-note.md` using the template below, then confirm the path to the user.

---

## Document template

```markdown
# Release Strategy: <change name>

## 1. Change Analysis
- Blast radius: ...
- Impact checklist:
  | # | Question | True/False | Comment |
  |---|----------|-------------|---------|

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
