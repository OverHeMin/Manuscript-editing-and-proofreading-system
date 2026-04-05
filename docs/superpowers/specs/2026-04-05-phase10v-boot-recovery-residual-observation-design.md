# Phase 10V Boot Recovery Residual Observation Design

**Date:** 2026-04-05  
**Status:** Implemented and locally verified under the current Phase 10 durable execution-orchestration mainline  
**Scope:** After enabled boot recovery runs, emit one read-only residual backlog summary aligned with the existing dry-run readiness semantics, without changing replay authority, startup safety, or current orchestration contracts.

## 1. Goal

`Phase 10J` through `10U` established:

- durable governed follow-up orchestration
- restart-safe replay and bounded retries
- boot-triggered fail-open recovery
- read-only dry-run backlog inspection
- readiness windows and summary rollups
- additive JSON contract stability

The next narrow gap is startup observability alignment.

Today boot recovery can replay eligible orchestration work, but the startup log still only reports the replay pass summary:

- processed
- completed
- retryable
- failed
- deferred

That is useful, but it does not tell operators what orchestration state still remains immediately after startup:

- how much actionable backlog is still left
- whether remaining blocked work is waiting on retry eligibility or fresh-running timeout expiry
- when the next blocked work becomes replayable

This phase closes that gap with one more read-only startup-side summary.

## 2. Why This Slice Exists

The recovery lane and the inspection lane have matured together, but boot wiring still only surfaces the replay half.

That means after a restart, operators can see:

- what the boot pass just processed

but they still cannot see from the same startup evidence:

- what remained after that pass
- whether the remaining state is urgent attention, ready-now work, or merely time-blocked work

The right next step is not a new dashboard, scheduler, or boot control surface.
It is one compact read-only residual summary on top of the same repo-owned inspection path.

## 3. Hard Boundaries

### 3.1 Keep startup fail-open

This phase must not:

- block persistent startup because residual inspection fails
- convert boot recovery into a required startup gate
- change the current fail-open recovery contract

If the new read-only observation step fails, startup must stay healthy and emit only a bounded fail-open log.

### 3.2 Do not add a new control plane

This phase must stay inside persistent startup wiring plus the existing repo-owned inspection path.
It must not add:

- new HTTP endpoints
- new UI controls
- boot-time mutation filters
- any release or routing authority

### 3.3 Reuse current read-only orchestration semantics

The residual summary must be derived from the same inspection model already used by:

- `recover:governed-orchestration -- --dry-run`
- readiness windows
- readiness summary rollups

This phase reports residual state; it does not reinterpret replay rules.

### 3.4 Keep business completion and orchestration completion separated

This phase must not change:

- business transaction success semantics
- orchestration retryability rules
- stale-running reclaim rules
- verification-ops seeding or completion contracts

It is observation-only.

### 3.5 Avoid startup log spam

This phase should add one compact summary line, not a new per-item dump.
Operators who need item detail can still use the existing manual dry-run CLI.

## 4. Recommended Option

### Option A: Keep boot recovery logging recovery summary only

Pros:

- no new code

Cons:

- startup still lacks residual orchestration posture
- operators still need a second manual command to know whether remaining work is actionable or merely waiting

Not recommended.

### Option B: Add one post-recovery read-only residual summary

Pros:

- minimal additive change
- aligns boot behavior with the matured inspection/readiness model
- stays local-first and fail-open
- improves restart-time operator evidence without adding mutation authority

Cons:

- adds one extra startup-side inspection call and one extra log line

Recommended.

## 5. Core Design

### 5.1 Run one read-only inspection after the boot recovery pass

When `AGENT_EXECUTION_ORCHESTRATION_RECOVERY_ON_BOOT=true` is enabled and the asynchronous boot recovery pass finishes successfully, startup wiring should immediately run the existing read-only inspection path once.

This inspection should:

- use the full backlog
- use no extra filters
- use no new boot-only env vars
- remain read-only

The purpose is to answer: "what orchestration backlog state remains right now after this boot pass?"

### 5.2 Emit one compact boot residual summary line

Boot logging should add one startup-specific summary line that mirrors the dry-run summary model closely enough for operators to reuse the same mental model.

The summary should expose:

- total backlog count
- `recoverable_now`
- `stale_running`
- `deferred_retry`
- `attention_required`
- `not_recoverable`
- residual `actionable`
- readiness rollup fields such as `ready_now`, `waiting_retry_eligibility`, `waiting_running_timeout`, and optional `next_ready_at`

This keeps the boot path informative without turning it into itemized inspection output.

### 5.3 Keep the new observation fail-open

If residual inspection itself fails:

- startup remains healthy
- boot recovery behavior stays unchanged
- one bounded fail-open log is emitted for the inspection step

### 5.4 Keep the change at the startup adapter layer

The preferred implementation is:

- startup wiring invokes the existing recovery runner
- startup wiring then invokes the existing inspection runner
- formatting is additive and local to this repo-owned lane

This avoids widening the business/execution service contract unnecessarily.

## 6. Expected Outcomes

After this slice:

- boot recovery still replays backlog best-effort and fail-open
- startup logs show both what the boot pass processed and what residual orchestration posture remains
- operators can distinguish immediate residual work from time-blocked work without another command
- the execution/orchestration mainline deepens without introducing a new control surface

## 7. Out Of Scope

This phase does not add:

- new boot-time env vars
- repeated background inspection loops
- boot-time item-level logs
- new mutation APIs or dashboards
- scheduler or worker-queue infrastructure
- changes to replay, retry, or reclaim policy

## 8. Related Documents

- `docs/superpowers/specs/2026-04-05-phase10q-boot-recovery-budget-guardrail-design.md`
- `docs/superpowers/specs/2026-04-05-phase10r-governed-orchestration-budgeted-dry-run-preview-design.md`
- `docs/superpowers/specs/2026-04-05-phase10s-governed-orchestration-readiness-windows-design.md`
- `docs/superpowers/specs/2026-04-05-phase10t-governed-orchestration-readiness-summary-rollup-design.md`
- `docs/superpowers/specs/2026-04-05-phase10u-governed-orchestration-json-contract-stabilization-design.md`
