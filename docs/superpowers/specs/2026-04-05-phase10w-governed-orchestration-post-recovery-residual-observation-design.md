# Phase 10W Governed Orchestration Post-Recovery Residual Observation Design

**Date:** 2026-04-05  
**Status:** Implemented and locally verified under the current Phase 10 durable execution-orchestration mainline  
**Scope:** After a successful manual governed orchestration recovery replay, emit one additive read-only residual backlog summary for the same replay scope, without changing replay semantics or the existing JSON contract.

## 1. Goal

`Phase 10J` through `10V` established:

- durable governed follow-up orchestration
- limited retry and stale-running reclaim semantics
- bounded replay and bounded preview
- read-only backlog inspection and readiness timing
- stable JSON contracts for replay and dry-run
- boot-time residual observation after enabled startup replay

The next narrow gap is manual operator parity.

Today `recover:governed-orchestration` replay tells operators:

- what this replay pass processed

but not:

- what backlog remains immediately after that pass
- whether the residual state is still actionable now
- whether the residual work is merely blocked on retry eligibility or running-timeout expiry

This phase closes that gap for the human-operated replay lane.

## 2. Why This Slice Exists

`Phase 10V` improved startup evidence by adding one read-only residual summary after boot replay.
Manual replay still stops at the recovery summary itself.

That means an operator who runs manual recovery may still need a second command to answer:

- did this replay pass fully drain the scoped actionable backlog?
- what remains in this scope right now?

The right next step is not a new dashboard or control plane.
It is one more additive read-only summary in the existing local CLI lane.

## 3. Hard Boundaries

### 3.1 Keep replay semantics unchanged

This phase must not change:

- replay eligibility rules
- retry cooldown rules
- stale-running reclaim rules
- claim/ownership semantics
- business completion or orchestration completion contracts

It is observation-only.

### 3.2 Keep the new observation read-only and fail-open

The residual summary must come from the same inspection model already used by dry-run.
If that residual observation fails after replay succeeds:

- the replay command must still complete
- the replay result must stay valid
- the residual observation must degrade to a bounded fail-open human log

### 3.3 Do not widen JSON in this slice

`Phase 10U` just stabilized the replay/dry-run JSON contract.
To keep this slice minimal and low-risk, this phase should leave `--json` output unchanged.

Residual observation in this phase is:

- human-readable only
- additive
- non-blocking

### 3.4 Use the same scope, but not the same replay budget

If replay was scoped by:

- `--module`
- `--log-id`

the residual summary should describe the remaining backlog in that same scope.

If replay used:

- `--budget <n>`

the residual summary should still show the full remaining posture for that same scope after the replay pass, rather than applying the budget again to the read-only observation.

### 3.5 Avoid item-level output expansion

This phase should add one compact summary line only.
Operators who need per-item detail can still run the existing dry-run inspection command.

## 4. Recommended Option

### Option A: Keep manual replay summary unchanged

Pros:

- no new code

Cons:

- manual replay still requires a second command to see residual posture
- startup and manual recovery evidence remain asymmetrical

Not recommended.

### Option B: Add one post-recovery residual summary line for human replay output

Pros:

- minimal additive change
- keeps the existing JSON contract stable
- reuses the current dry-run readiness model
- aligns manual replay more closely with the boot-replay evidence lane

Cons:

- adds one more human-readable line after replay

Recommended.

## 5. Core Design

### 5.1 Run one read-only residual inspection after successful replay

After replay completes successfully in non-dry-run human mode:

1. run the existing inspection path once
2. reuse the same scope filters as replay
3. ignore replay budget for the inspection step
4. print one compact residual summary line

This summary answers: "what backlog remains right now in the same scoped lane after the replay pass?"

### 5.2 Emit one compact recovery residual summary line

The summary should include:

- `total`
- `recoverable_now`
- `stale_running`
- `deferred_retry`
- `attention_required`
- `not_recoverable`
- `actionable`
- readiness rollup such as `ready_now`, `waiting_retry_eligibility`, `waiting_running_timeout`, and optional `next_ready_at`

This keeps the phase aligned with the existing read-only readiness vocabulary.

### 5.3 Keep residual observation out of JSON for now

When `--json` is present:

- preserve current replay JSON output exactly
- do not append plain-text residual logs
- do not widen the replay JSON contract in this slice

That keeps `10W` narrowly human-facing and lets any later machine-readable residual extension become its own focused phase if still needed.

## 6. Expected Outcomes

After this slice:

- a manual replay pass shows both what it processed and what residual scoped backlog remains
- operators can see whether the remaining state is still actionable now or merely time-blocked
- replay semantics and JSON contracts remain unchanged
- the execution/orchestration mainline gains more operator evidence without becoming a new control plane

## 7. Out Of Scope

This phase does not add:

- replay policy changes
- item-level residual output
- new env vars
- startup behavior changes
- residual JSON contract changes
- new APIs, dashboards, or control surfaces

## 8. Related Documents

- `docs/superpowers/specs/2026-04-05-phase10u-governed-orchestration-json-contract-stabilization-design.md`
- `docs/superpowers/specs/2026-04-05-phase10v-boot-recovery-residual-observation-design.md`
