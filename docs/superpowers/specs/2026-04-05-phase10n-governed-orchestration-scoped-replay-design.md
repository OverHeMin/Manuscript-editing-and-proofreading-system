# Phase 10N Governed Orchestration Scoped Replay Design

**Date:** 2026-04-05  
**Status:** Implemented and locally verified under the current Phase 10 roadmap  
**Scope:** Add bounded scope filters to the existing governed orchestration recovery and dry-run inspection paths so operators can replay or inspect a narrow subset of logs without changing recoverability rules or creating a new control plane.

## 1. Goal

`Phase 10J` through `10M` already established:

- durable orchestration lifecycle on `AgentExecutionLog`
- bounded retry eligibility and stale-running reclaim
- single-owner attempt claim guardrails
- read-only dry-run inspection with actionable focus ordering

The next narrow mainline gap is operator scoping:

- recovery currently replays every eligible log in the durable backlog
- dry-run currently inspects every persisted log
- operators do not yet have a repo-owned way to narrow replay or inspection to one module lane or one explicitly named log

This slice closes that gap while staying inside the same local-first CLI and orchestration service.

## 2. Why This Slice Exists

The durable recovery baseline is now safe enough to use, but still coarse:

- a large backlog may mix unrelated modules
- an operator may want to inspect or replay one known execution log after a bounded failure
- the current tooling forces full-backlog scans even when the human intent is narrower

The right next step is not a panel, dashboard, or retry button.
It is one more bounded operator affordance on the existing repo-owned recovery lane:

- scope first
- then apply the same recoverability rules as before

## 3. Hard Boundaries

### 3.1 Scope can only narrow, never override

New filters may only reduce the candidate set.
They must not:

- replay `failed` terminal orchestration
- skip retry cooldown checks
- reclaim fresh `running` attempts
- bypass business-completion requirements

### 3.2 No new mutation surface beyond the existing CLI

This phase must not add:

- a new workbench panel
- retry buttons in Admin Governance
- targeted release-control actions
- routing or evaluation policy mutation

It stays inside the existing repo-owned recovery and dry-run CLI path.

### 3.3 Keep dry-run read-only

Scoped dry-run inspection must still:

- perform no claims
- perform no writes
- perform no evidence append
- perform no lifecycle mutation

### 3.4 Keep fail-open and local-first

This slice must not introduce:

- cloud schedulers
- hosted queues
- remote orchestration dependencies
- mandatory background services

## 4. Recommended Option

### Option A: Keep backlog-wide recovery only

Pros:

- no new code

Cons:

- operators cannot narrow the work to one module or one explicit log
- dry-run output remains backlog-wide even when the intent is local triage

Not recommended.

### Option B: Add bounded scope filters to the existing service and CLI

Pros:

- keeps the change additive and repo-owned
- improves operator precision without adding a control plane
- reuses the existing durable recovery semantics

Cons:

- requires one more options object in the orchestration service and CLI parsing path

Recommended.

## 5. Core Design

### 5.1 Add one reusable scope object

Introduce a shared scope shape for orchestration replay and inspection, for example:

- `modules?: AgentExecutionLogRecord["module"][]`
- `logIds?: string[]`

These filters are additive and optional.

### 5.2 Apply scope before recoverability classification

The service should:

1. load persisted logs as today
2. narrow them by module and/or log id
3. apply the existing recoverability and inspection rules to the narrowed set only

This preserves the current durable semantics while allowing bounded operator focus.

### 5.3 Keep scope semantics explicit and conservative

Recommended behavior:

- repeated `--module` values mean "any of these modules"
- repeated `--log-id` values mean "any of these log ids"
- when both are supplied, the final candidate set is the intersection

No fuzzy matching, partial matching, or status override is allowed.

### 5.4 Extend both replay and dry-run CLI paths

The repo-owned CLI should support:

- `--module <module>`
- `--log-id <execution-log-id>`

These flags may be repeated.
They should work for:

- normal recovery replay
- `--dry-run`
- `--json`
- `--dry-run --json`

### 5.5 Keep summary semantics honest

Because scope changes the actual candidate set rather than only the item display order:

- recovery summaries should describe the scoped replay attempt
- dry-run summary counts should describe the scoped inspected set
- `actionableOnly` and `limit` should still operate after scope is applied

## 6. Expected Outcomes

After this slice:

- operators can replay one module lane without touching unrelated backlog
- operators can inspect one explicit execution log through the same dry-run lane
- all bounded retry, stale-running, and terminal-failure protections stay intact
- no new panel or control plane is created

## 7. Out Of Scope

This phase does not add:

- category-targeted replay flags
- status override flags
- force-retry or force-reclaim controls
- admin UI replay buttons
- hosted workflow depth beyond the current repo-owned CLI lane

## 8. Related Documents

- `docs/superpowers/specs/2026-04-05-phase10j-durable-execution-orchestration-baseline-design.md`
- `docs/superpowers/specs/2026-04-05-phase10k-execution-orchestration-attempt-claim-guardrails-design.md`
- `docs/superpowers/specs/2026-04-05-phase10l-governed-orchestration-dry-run-inspection-design.md`
- `docs/superpowers/specs/2026-04-05-phase10m-governed-orchestration-focus-ordering-design.md`
