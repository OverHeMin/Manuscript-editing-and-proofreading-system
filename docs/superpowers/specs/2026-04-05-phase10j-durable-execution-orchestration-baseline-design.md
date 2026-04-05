# Phase 10J Durable Execution Orchestration Baseline Design

**Date:** 2026-04-05  
**Status:** Implemented and locally verified under the current Phase 10 roadmap  
**Scope:** Add a narrow durable orchestration baseline for governed post-execution follow-up so manuscript business completion can stay synchronous while governed verification follow-up becomes restart-safe, retry-bounded, recoverable, and read-only observable.

## 1. Goal

The repository already has:

- governed business execution through `screening`, `editing`, and `proofreading`
- frozen execution snapshots and agent execution logs
- governed verification/evaluation assets plus inline governed check execution
- admin evidence drilldown for execution logs and verification evidence

The current gap is that the post-business follow-up is still effectively inline:

- business completion and orchestration completion are coupled
- a late governed verification failure can still distort the operator story for an otherwise successful business run
- there is no durable retry or recovery baseline for interrupted follow-up work
- restart handling is weak because the system does not treat post-execution follow-up as its own tracked lifecycle

This slice closes that gap without introducing a new worker platform, control plane, or cloud dependency.

In one sentence:

`Phase 10J` should turn governed post-execution follow-up into a bounded durable orchestration baseline anchored on existing agent-execution evidence rather than on a new external queue or control plane.

## 2. Why This Slice Exists

After `9R`, `9S`, and `9T`, the repository can already:

- resolve governed runtime bindings
- seed governed evaluation runs from business execution
- execute governed run checks inline
- attach machine evidence back to agent execution logs

That proved the contract, but it also exposed the next mainline problem:

- follow-up verification is real orchestration work, not just a synchronous tail step

The next safe step is not a larger runtime center, workbench, or harness layer.
It is a durable baseline that makes the existing follow-up safer:

- persist enough orchestration state to survive process interruption
- separate business completion from follow-up completion
- retry only within bounded policy
- support deterministic recovery and replay
- expose read-only operator status

## 3. Recommended Option

### Option A: Keep governed follow-up inline

Pros:

- smallest code diff

Cons:

- business completion and orchestration completion remain coupled
- restart safety stays weak
- retry behavior remains ad hoc

Not recommended.

### Option B: Add a narrow durable orchestration layer anchored on `AgentExecutionLog`

Pros:

- reuses existing persisted execution evidence instead of inventing a new queue-first platform
- keeps business success independent from later verification follow-up completion
- supports bounded retries and explicit recovery
- stays local-first and repo-owned

Cons:

- requires additive persistence and service changes across module execution and verification-ops

Recommended.

### Option C: Introduce a broader worker or Temporal-style orchestration system now

Pros:

- could eventually support deeper async flow control

Cons:

- too broad for the current slice
- would reopen architecture and operations boundaries that the user explicitly wants to keep stable

Out of scope.

## 4. Hard Boundaries

### 4.1 Keep the business mainline authoritative

`screening`, `editing`, and `proofreading` still own:

- manuscript business output creation
- job completion
- execution snapshot freezing

The new orchestration baseline may observe and follow those results, but it must not become a prerequisite for business success.

### 4.2 Fail-open for new orchestration behavior

If follow-up dispatch fails:

- do not roll back the business asset
- do not roll back the execution snapshot
- do not roll back the completed business job
- record orchestration state as recoverable instead

### 4.3 No new control plane

This slice may add:

- read-only execution/orchestration status in existing admin evidence
- a repo-owned local recovery command

It must not add:

- a new workbench
- a routing control plane
- an operations dashboard with write authority
- automatic model switching
- automatic release actions

### 4.4 Verification-ops remains the verification asset authority

`verification-ops` keeps ownership of:

- suites
- release check profiles
- runs
- evidence

This phase may add idempotent governed-run reuse and recovery hooks, but it must not redefine the verification asset contract.

### 4.5 Local-first and bounded

This phase must not require:

- hosted orchestration infrastructure
- cloud queues
- remote schedulers
- background workers outside the repository

Any recovery path should remain repo-owned and runnable locally against the existing persistent runtime database.

## 5. Core Objects

### 5.1 Agent Execution Business Status

The existing `AgentExecutionLog.status` remains the business execution lifecycle:

- `queued`
- `running`
- `completed`
- `failed`

This field continues to answer whether the governed business execution itself finished.

### 5.2 Agent Execution Orchestration Status

Add a separate additive lifecycle for governed follow-up orchestration, for example:

- `not_required`
- `pending`
- `running`
- `retryable`
- `completed`
- `failed`

This field answers whether the post-business follow-up is still pending, actively running, recoverable, or exhausted.

### 5.3 Orchestration Attempt State

Add bounded recovery metadata such as:

- attempt count
- max attempts
- last error
- last attempt started/finished timestamps
- optional next retry eligibility time

This creates a replayable operator story without changing the existing business result contract.

### 5.4 Governed Follow-up Replay Anchor

Use existing persisted evidence as the durable source of truth:

- `AgentExecutionLog`
- `ModuleExecutionSnapshot`
- `created_asset_ids`
- governed verification expectation IDs already frozen on the log

This avoids making a new queue a synchronous dependency of the business mainline.

## 6. Recommended Architecture

### 6.1 Use `AgentExecutionLog` as the orchestration anchor

When business execution finishes:

1. complete the business job and execution snapshot as today
2. mark orchestration state on the same log:
   - `not_required` when no governed suites are configured
   - `pending` when follow-up should run
3. return business success immediately

The log then becomes the durable recovery anchor for any later follow-up.

### 6.2 Add a dedicated orchestration service, not a new business flow

Introduce a narrow service responsible for:

- claiming eligible logs for follow-up
- marking attempt lifecycle
- running governed follow-up idempotently
- appending evidence to the existing log
- marking completion or bounded retry state

This service should be additive and should not absorb the responsibilities of manuscript business services.

### 6.3 Make governed follow-up idempotent

Retries and recovery must not create duplicate governed evaluation runs for the same:

- agent execution log
- execution snapshot
- output asset
- suite

The recommended baseline is:

- add governed-source lookup in `verification-ops`
- reuse an existing run when the same governed source and suite have already been seeded
- only create a new run when no governed run exists for that source/suite pair

This is the key safeguard that makes restart recovery safe enough for a minimal baseline.

### 6.4 Best-effort immediate dispatch after commit

Business services may still attempt an immediate best-effort follow-up dispatch after the business transaction commits.

Important rule:

- failure in that best-effort dispatch only updates orchestration status; it does not unwind business completion

This preserves the current "fast path" without keeping the business success path dependent on it.

### 6.5 Add a repo-owned recovery command

Provide one local-first recovery command for pending or retryable follow-up work.

The command should:

- load eligible logs from persistence
- re-run bounded follow-up attempts
- print a structured summary

It remains a repo-owned operator tool, not a hosted scheduler or a workbench control surface.

The same recovery path may also be invoked by persistent runtime startup through an explicit local env toggle.
That startup replay must remain:

- optional
- best-effort
- fail-open relative to server startup
- limited to the same bounded replay contract as the manual command

For retryable failures, the baseline may also persist a bounded retry-eligibility marker so recovery can distinguish:

- retryable now
- retryable later
- exhausted / terminal

without introducing a separate scheduler or control plane.

### 6.6 Read-only admin evidence only

Extend existing execution evidence read models to show:

- business status
- orchestration status
- attempt count / max attempts
- last orchestration error
- orchestration timestamps
- next retry eligibility time when the log is currently retryable

This is strictly read-only and stays inside existing Admin Governance evidence drilldown.

## 7. Error Handling And Recovery Rules

### 7.1 Business success first

If business output, snapshot, and job completion all succeed:

- the response remains successful even if follow-up dispatch later fails

### 7.2 Bounded retry only

The baseline should not retry forever.

Recommended behavior:

- default max attempts is small and explicit, such as `3`
- retryable failures keep the log recoverable until the bound is reached
- retryable failures may also set a small explicit cooldown window before the next replay is eligible
- once exhausted, the log moves to terminal orchestration failure and remains visible for manual attention

### 7.3 Recovery should tolerate interrupted running state

If the process exits during follow-up:

- the log remains readable
- the orchestration state remains replayable
- recovery should be able to reclaim pending, retryable, or stale running follow-up safely because governed-run seeding is idempotent

## 8. Out Of Scope

Phase 10J does not include:

- a general-purpose async job platform
- distributed queue leasing
- multi-node orchestration coordination
- a new runtime control plane
- new workbench panels
- automatic release orchestration
- automatic routing or policy activation from evaluation outcomes
- cloud-hosted worker infrastructure

## 9. Related Capability Lane

This slice advances:

- `Execution And Orchestration Platform`

It builds directly on:

- `2026-03-28-phase3-governed-execution-and-learning-traceability-design.md`
- `2026-03-30-phase8f-execution-resolution-design.md`
- `2026-04-03-phase9r-runtime-binding-verification-linkage-design.md`
- `2026-04-03-phase9t-governed-run-check-execution-design.md`
- the current retained-capability mapping in `2026-04-03-retained-capability-phase-mapping.md`

It explicitly does not absorb:

- routing control-plane expansion
- evaluation workbench control behavior
- harness or adapter platform expansion
- release automation or deploy control-plane work
