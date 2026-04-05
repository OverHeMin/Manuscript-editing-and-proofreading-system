# Phase 10Q Boot Recovery Budget Guardrail Design

**Date:** 2026-04-05  
**Status:** Implemented and locally verified under the current Phase 10 roadmap  
**Scope:** Add an optional boot-time replay budget for governed orchestration auto-recovery so persistent startup can replay only a bounded slice of eligible backlog per boot without changing default behavior or fail-open startup semantics.

## 1. Goal

`Phase 10J` through `10P` established:

- durable governed orchestration recovery
- boot-triggered fail-open recovery
- scoped replay
- bounded replay budgeting
- predictable budgeted replay ordering

The next narrow gap is startup control:

- manual recovery can now be budgeted
- boot recovery still replays the full eligible backlog whenever it is enabled
- operators cannot ask startup to make bounded progress through a large backlog over multiple restarts

This slice adds one optional boot-time guardrail to the existing startup path.

## 2. Why This Slice Exists

The current boot recovery path is safe, but still coarse.

For a large eligible backlog, operators may want:

- startup to remain fail-open
- auto-recovery to remain enabled
- each boot to replay only a bounded number of eligible items

The right next step is not a scheduler or control panel.
It is one more repo-owned startup option on top of the same recovery service.

## 3. Hard Boundaries

### 3.1 Keep boot recovery optional and fail-open

This phase must not:

- make boot recovery mandatory
- fail startup because a budget is invalid
- fail startup because the bounded recovery work later fails

### 3.2 Do not add a new control plane

This phase must stay inside persistent startup wiring.
It must not add:

- new UI controls
- runtime mutation APIs
- release orchestration authority

### 3.3 Reuse existing recovery semantics

Boot budgeting must reuse the current recovery lane:

- same retry and stale-running rules
- same `budget` semantics as manual replay
- same summary formatting

### 3.4 Default behavior remains unchanged

If no boot budget is configured:

- enabled boot recovery keeps replaying the full eligible backlog
- disabled boot recovery stays disabled

## 4. Recommended Option

### Option A: Keep boot recovery unbounded

Pros:

- no new code

Cons:

- boot recovery remains coarser than manual replay
- restart-safe bounded progress is manual-only

Not recommended.

### Option B: Add one optional boot budget environment variable

Pros:

- minimal additive change
- reuses existing recovery budget semantics
- keeps startup path local-first and fail-open

Cons:

- adds one more startup environment variable

Recommended.

## 5. Core Design

### 5.1 Add one optional boot budget env var

Add an optional variable such as:

- `AGENT_EXECUTION_ORCHESTRATION_RECOVERY_ON_BOOT_BUDGET`

Expected behavior:

- positive integer: pass through as recovery `budget`
- missing or empty: no boot budget override
- zero or invalid values: ignore fail-open and keep current full replay behavior

### 5.2 Keep parsing local to startup wiring

The persistent server bootstrap should:

1. check whether boot recovery is enabled
2. parse the optional boot budget
3. pass `recoveryOptions` into the existing recovery entrypoint

This keeps the change at the startup adapter layer rather than changing the orchestration service contract again.

### 5.3 Keep summary output unchanged except for existing budget details

If boot recovery uses a budget:

- the existing recovery summary already reports `eligible`, `remaining`, and `budget`
- no new summary shape is required

## 6. Expected Outcomes

After this slice:

- operators can keep boot recovery enabled while limiting each boot replay pass
- startup remains fail-open
- manual and boot recovery stay on the same bounded semantics
- no new control-plane surface is introduced

## 7. Out Of Scope

This phase does not add:

- boot-time scoped module/log-id filters
- boot-time category filters
- startup failure on invalid budget config
- new dashboards or mutation APIs

## 8. Related Documents

- `docs/superpowers/specs/2026-04-05-phase10j-durable-execution-orchestration-baseline-design.md`
- `docs/superpowers/specs/2026-04-05-phase10o-governed-orchestration-replay-budgeting-design.md`
- `docs/superpowers/specs/2026-04-05-phase10p-governed-orchestration-budgeted-replay-alignment-design.md`
