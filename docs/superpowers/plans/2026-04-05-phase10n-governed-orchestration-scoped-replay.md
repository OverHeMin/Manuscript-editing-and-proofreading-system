# Phase 10N Governed Orchestration Scoped Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the existing governed orchestration recovery and dry-run inspection flows to run against a bounded subset of execution logs without changing recoverability rules.

**Architecture:** Add one shared scope object for module/log-id filters, thread it through the orchestration service and repo-owned CLI, and keep all existing retry, stale-running, and terminal-failure protections unchanged. The slice is additive, local-first, and does not create a new control plane.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, existing `agent-execution` orchestration service, existing recovery CLI.

---

## Scope Notes

- Do not add force-replay or force-reclaim behavior.
- Do not add UI controls.
- Do not change boot recovery defaults.
- Keep `actionableOnly` and `limit` semantics as a post-scope display filter only.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-05-phase10n-governed-orchestration-scoped-replay-design.md`
  - Create: `docs/superpowers/plans/2026-04-05-phase10n-governed-orchestration-scoped-replay.md`
- Service and CLI:
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-orchestration-service.ts`
  - Modify: `apps/api/src/ops/recover-governed-execution-orchestration.ts`
- Tests:
  - Modify: `apps/api/test/agent-execution/agent-execution-orchestration.spec.ts`
  - Modify: `apps/api/test/ops/recover-governed-execution-orchestration.spec.ts`
- Docs:
  - Modify: `README.md`
  - Modify: `docs/OPERATIONS.md`

## Planned Tasks

### Task 1: Add Scoped Replay And Inspection At The Service Layer

**Files:**
- Modify: `apps/api/src/modules/agent-execution/agent-execution-orchestration-service.ts`
- Modify: `apps/api/test/agent-execution/agent-execution-orchestration.spec.ts`

- [x] **Step 1: Write the failing service tests**

Add coverage that proves:

- `recoverPending({ modules: ["editing"] })` only processes eligible `editing` logs
- `recoverPending({ logIds: ["execution-log-2"] })` stays bounded to the named log
- scoped recovery still skips fresh `running`, deferred `retryable`, and terminal `failed` logs
- `inspectBacklog({ modules: ["editing"], actionableOnly: true, limit: 1 })` scopes first, then applies focus ordering and limit

- [x] **Step 2: Run the targeted orchestration tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-orchestration
```

Expected: FAIL because scoped replay/inspection does not exist yet.

- [x] **Step 3: Implement the minimal shared scope object**

Implementation rules:

- scope only narrows the candidate set
- scope logic is shared by recovery and inspection
- no recoverability rules are relaxed

- [x] **Step 4: Re-run the targeted orchestration tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-orchestration
```

Expected: PASS.

### Task 2: Add CLI Scope Flags

**Files:**
- Modify: `apps/api/src/ops/recover-governed-execution-orchestration.ts`
- Modify: `apps/api/test/ops/recover-governed-execution-orchestration.spec.ts`

- [x] **Step 1: Write the failing CLI scope tests**

Add coverage that proves:

- `--module editing --log-id execution-log-2` is forwarded into replay mode
- the same flags are forwarded into `--dry-run`
- repeated flags are preserved as arrays
- default recovery mode remains unchanged when no scope flags are supplied

- [x] **Step 2: Run the targeted CLI tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- recover-governed-execution-orchestration
```

Expected: FAIL because the CLI does not yet parse or forward scope flags.

- [x] **Step 3: Implement the minimal CLI scope parsing**

Implementation rules:

- support repeated `--module <module>`
- support repeated `--log-id <id>`
- apply the same parsing path to replay and dry-run
- do not add new override flags

- [x] **Step 4: Re-run the targeted CLI tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- recover-governed-execution-orchestration
```

Expected: PASS.

### Task 3: Update Docs And Run Final Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`

- [x] **Step 1: Update docs**

Document:

- `--module <module>`
- `--log-id <execution-log-id>`
- that scope narrows the inspected/replayed set but does not override retryability or terminal failure rules

- [x] **Step 2: Run the final serial verification set**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-orchestration
pnpm --filter @medical/api test -- recover-governed-execution-orchestration
pnpm --filter @medical/api test -- agent-execution
pnpm --filter @medical/api test -- verification-ops
pnpm --filter @medical/api test -- module-orchestration
pnpm --filter @medical/api typecheck
```

Expected: PASS.
