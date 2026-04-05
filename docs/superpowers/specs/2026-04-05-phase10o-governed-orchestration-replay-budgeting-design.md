# Phase 10O Governed Orchestration Replay Budgeting Design

**Date:** 2026-04-05  
**Status:** Implemented and locally verified under the current Phase 10 roadmap  
**Scope:** Add a bounded replay budget to the existing governed orchestration recovery lane so operators can make restart-safe, scoped, incremental progress through eligible backlog without creating a new control plane.

## 1. Goal

`Phase 10J` through `10N` already established:

- durable post-business orchestration lifecycle on `AgentExecutionLog`
- bounded retry eligibility and stale-running reclaim
- single-owner attempt claim guardrails
- read-only dry-run inspection with actionable focus ordering
- scoped replay and inspection filters by module and log id

The next narrow gap is replay sizing:

- recovery currently drains every eligible log inside the chosen scope
- operators cannot ask recovery to process only the next bounded slice
- large backlogs still require an all-or-nothing replay pass even when the intent is incremental

This slice adds one bounded budgeting control to the same repo-owned recovery lane.

## 2. Why This Slice Exists

Scoped replay from `10N` made recovery more precise, but not yet more incremental.

Two practical needs remain:

- after restart or operator intervention, a human may want to replay only the next `n` eligible follow-up attempts
- the recovery summary should say how much eligible work was handled and how much eligible work remains outside the current budget window

The right next step is still not a dashboard, replay button, or scheduler.
It is one more conservative control on the existing CLI and orchestration service.

## 3. Hard Boundaries

### 3.1 Budget only bounds replay volume

The new control may only cap how many eligible logs the current recovery invocation attempts.
It must not:

- override terminal orchestration failure
- override retry cooldowns
- reclaim fresh running attempts
- bypass business-completion requirements
- auto-promote into boot defaults or release orchestration

### 3.2 Keep the control surface unchanged

This phase must stay inside the existing repo-owned recovery command and service.
It must not add:

- new Admin Governance replay controls
- new Evaluation Workbench actions
- new routing or release control-plane authority
- new worker or cloud dependencies

### 3.3 Keep dry-run read-only

Dry-run inspection remains a read-only observation lane.
This phase may document how replay budgeting relates to dry-run, but it must not make dry-run mutate orchestration state.

### 3.4 Keep fail-open and local-first

Replay budgeting must remain:

- optional
- additive
- repository-local
- safe to ignore when not supplied

## 4. Recommended Option

### Option A: Keep full-sweep replay only

Pros:

- no new code

Cons:

- scoped recovery still cannot be advanced incrementally
- restart handling remains coarse for large eligible backlogs
- operators cannot separate "replay a little now" from "replay everything in scope"

Not recommended.

### Option B: Add bounded replay budgeting on the existing lane

Pros:

- stays inside the current orchestration service and CLI
- preserves all recoverability rules
- gives operators a restart-safe, incremental replay tool
- keeps business completion and orchestration completion separated

Cons:

- adds one more recovery options field and summary shape

Recommended.

## 5. Core Design

### 5.1 Add a recovery-only budget option

Introduce a recovery-only option, for example:

- `budget?: number`

This budget is distinct from dry-run `limit`:

- `budget` bounds how many eligible logs recovery may attempt
- `limit` bounds how many read-only dry-run rows are displayed

### 5.2 Apply budget after scope and recoverability screening

Recovery should continue using the same scope and recoverability rules as `10J-10N`:

1. load logs
2. narrow by module/log-id scope
3. classify deferred retry and recoverable candidates using existing rules
4. apply the replay budget only to the recoverable candidate set
5. dispatch that bounded subset

This keeps budgeting purely volumetric rather than semantic.

### 5.3 Keep summary semantics honest

When a budget is supplied, the recovery summary should report:

- how many eligible logs were seen inside the current scope
- how many were actually processed in this invocation
- how many eligible logs remained outside the current budget window

This summary must stay scoped to the current invocation and must not pretend to be a global queue-control plane.

### 5.4 Keep default behavior unchanged

If no budget is provided:

- recovery keeps its current full-sweep behavior
- existing boot recovery behavior stays unchanged
- existing dry-run behavior stays unchanged

### 5.5 CLI shape

The existing recovery CLI should gain:

- `--budget <n>`

This flag should apply to replay mode only.
It should be optional and additive, and JSON output should surface the same budget-aware summary fields.

## 6. Expected Outcomes

After this slice:

- operators can replay only the next bounded chunk of scoped eligible orchestration work
- recovery summaries expose processed versus still-remaining eligible backlog inside the current scope
- restart handling becomes more incremental without changing business outputs or orchestration safety rules
- the system still has no new replay dashboard or override surface

## 7. Out Of Scope

This phase does not add:

- force replay
- budgeted boot recovery defaults
- new dry-run mutation behavior
- replay-category override flags
- hosted workflow engines or external schedulers
- release orchestration, automatic publishing, or automatic learning writeback

## 8. Related Documents

- `docs/superpowers/specs/2026-04-05-phase10j-durable-execution-orchestration-baseline-design.md`
- `docs/superpowers/specs/2026-04-05-phase10k-execution-orchestration-attempt-claim-guardrails-design.md`
- `docs/superpowers/specs/2026-04-05-phase10l-governed-orchestration-dry-run-inspection-design.md`
- `docs/superpowers/specs/2026-04-05-phase10m-governed-orchestration-focus-ordering-design.md`
- `docs/superpowers/specs/2026-04-05-phase10n-governed-orchestration-scoped-replay-design.md`
