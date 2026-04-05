# Phase 10L Governed Orchestration Dry-Run Inspection Design

**Date:** 2026-04-05  
**Status:** Implemented and locally verified under the current Phase 10 roadmap  
**Scope:** Add a local-first, read-only dry-run inspection path for governed orchestration recovery so operators can inspect backlog state before replaying it.

## 1. Goal

`Phase 10J` and `10K` already established:

- durable orchestration lifecycle and bounded retry
- restart-safe recovery and fail-open boot replay
- business completion separated from orchestration completion
- single-owner claim guardrails for overlapping attempts

The next mainline gap is operational visibility before action:

- operators can replay recovery, but cannot yet ask the repository to classify the current orchestration backlog without mutating it
- there is no single repo-owned read model that answers which logs are immediately recoverable, deferred by retry cooldown, stale-running, or already terminal

This slice closes that gap without adding a new workbench, dashboard, or control plane.

## 2. Why This Slice Exists

The current recovery command is intentionally narrow:

- it replays pending, retryable, and stale-running work
- it stays local-first and fail-open
- it does not become a routing or release control plane

But once durable orchestration exists, operators need one more safe baseline capability:

- inspect first, recover second

That inspection should remain:

- repo-owned
- read-only
- deterministic from current persisted state
- small enough to keep the execution/orchestration lane focused

## 3. Hard Boundaries

### 3.1 No new panel or control plane

This phase must not add:

- a new admin panel
- a workbench surface
- a scheduler
- a mutation API for orchestration control

The inspection surface stays inside the existing CLI and orchestration service.

### 3.2 No mutation during dry-run

The dry-run path must not:

- claim an orchestration attempt
- update retry metadata
- append evidence
- write audit rows

It is a pure read model over current durable state.

### 3.3 Keep local-first and fail-open

Dry-run inspection:

- runs against the same local repo-owned persistent runtime
- degrades with the same preflight rules as recovery
- must not create cloud dependencies or hosted observability requirements

### 3.4 Keep business and verification contracts unchanged

This phase must not redefine:

- business `status`
- verification-ops governed source or run contracts
- routing governance

It only adds read-only orchestration inspection.

## 4. Recommended Option

### Option A: Reuse recovery summary only

Pros:

- no new structures

Cons:

- still mutates state
- cannot answer backlog composition before replay
- cannot distinguish safe-to-replay vs inspect-only categories

Not recommended.

### Option B: Add a dedicated orchestration backlog inspection read model plus CLI `--dry-run`

Pros:

- stays local-first and narrow
- gives operators pre-replay visibility
- reuses the same durable log and orchestration rules as recovery

Cons:

- requires one more read-model shape and CLI output path

Recommended.

## 5. Core Design

### 5.1 Add a read-only inspection result shape

Add a service-level read model that inspects persisted execution logs and returns:

- aggregate counts by category
- itemized records for current orchestration state

Each item should include enough context for an operator to decide whether to run recovery, such as:

- log id
- manuscript id
- module
- business status
- orchestration status
- attempt count / max attempts
- last attempt started / finished timestamps
- next retry eligibility
- inspection category
- human-readable reason

### 5.2 Use mutually exclusive inspection categories

For the minimal slice, categories should stay explicit and mutually exclusive:

- `recoverable_now`
  - `pending`
  - `retryable` and now eligible
- `stale_running`
  - `running` and stale enough to reclaim
- `deferred_retry`
  - `retryable` but next retry time has not arrived
- `attention_required`
  - terminal orchestration failure such as `failed`
- `not_recoverable`
  - business not completed
  - orchestration already completed or not required
  - fresh `running` attempt that should not be reclaimed yet

This keeps the inspection model understandable without overfitting deeper workflow states.

### 5.3 Keep inspection logic aligned with recovery rules

The classification rules must reuse the same durable semantics already used by recovery:

- retry eligibility
- stale-running detection
- business completion requirement

Dry-run should therefore answer:

- what recovery would replay now
- what recovery would defer
- what recovery would skip

without actually claiming or replaying anything.

### 5.4 Extend the CLI with `--dry-run`

The recovery CLI should support:

- default mode: execute recovery as today
- `--json`: machine-readable output for the selected mode
- `--dry-run`: read-only inspection instead of replay
- `--dry-run --json`: machine-readable inspection payload

Human-readable dry-run output should remain compact and operator-oriented, for example:

- one headline summary line
- a few item lines with category, log id, module, and reason

### 5.5 Keep boot behavior unchanged

This phase does not change boot replay behavior:

- boot recovery remains opt-in
- boot recovery still executes the existing replay path
- dry-run is an explicit operator CLI choice only

## 6. Expected Outcomes

After this slice:

- operators can inspect orchestration backlog safely before replay
- the repo has one canonical read model for orchestration backlog state
- inspection remains local-first, fail-open, and read-only
- no new panel, scheduler, or control plane is introduced

## 7. Out Of Scope

This phase does not add:

- automatic replay decisions
- operator retry buttons
- queue or incident dashboards
- release-control or routing-control actions
- hosted metrics or cloud observability requirements

## 8. Related Documents

- `docs/superpowers/specs/2026-04-05-phase10j-durable-execution-orchestration-baseline-design.md`
- `docs/superpowers/specs/2026-04-05-phase10k-execution-orchestration-attempt-claim-guardrails-design.md`
- `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`
