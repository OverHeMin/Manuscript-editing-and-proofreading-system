# Phase 10O Governed Orchestration Replay Budgeting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the existing governed orchestration recovery path to process only a bounded number of eligible scoped logs per invocation while exposing how much eligible work remains.

**Architecture:** Add a recovery-only budget option to the orchestration service and repo-owned CLI, keep dry-run read-only, and extend recovery summaries so operators can see eligible-versus-processed-versus-remaining counts without creating a new control plane.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, existing `agent-execution` orchestration service, existing governed recovery CLI, repository docs.

---

## Scope Notes

- Do not add UI controls.
- Do not change boot recovery defaults.
- Do not change retry, stale-running, or terminal-failure semantics.
- Keep dry-run `limit` separate from replay `budget`.
- Keep all new behavior fail-open and additive.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-05-phase10o-governed-orchestration-replay-budgeting-design.md`
  - Create: `docs/superpowers/plans/2026-04-05-phase10o-governed-orchestration-replay-budgeting.md`
- Service and CLI:
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-orchestration-service.ts`
  - Modify: `apps/api/src/ops/recover-governed-execution-orchestration.ts`
- Tests:
  - Modify: `apps/api/test/agent-execution/agent-execution-orchestration.spec.ts`
  - Modify: `apps/api/test/ops/recover-governed-execution-orchestration.spec.ts`
  - Modify: `apps/api/test/http/persistent-server-bootstrap.spec.ts`
- Docs:
  - Modify: `README.md`
  - Modify: `docs/OPERATIONS.md`
  - Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
  - Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

## Planned Tasks

### Task 1: Add Recovery Budget Semantics At The Service Layer

**Files:**
- Modify: `apps/api/src/modules/agent-execution/agent-execution-orchestration-service.ts`
- Modify: `apps/api/test/agent-execution/agent-execution-orchestration.spec.ts`

- [x] **Step 1: Write the failing service tests**

Add coverage that proves:

- `recoverPending({ budget: 1 })` only attempts one eligible log
- deferred retries do not consume replay budget
- scoped budgeted recovery reports eligible-versus-processed-versus-remaining counts honestly
- omitting `budget` preserves the existing full-sweep recovery behavior

- [x] **Step 2: Run the targeted orchestration tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-orchestration
```

Expected: FAIL because replay budgeting does not exist yet.

- [x] **Step 3: Implement the minimal recovery-only budget option**

Implementation rules:

- budget applies after scope and recoverability filtering
- budget only limits replay volume
- dry-run inspection remains unchanged
- summary fields stay backward-compatible for unbudgeted replay

- [x] **Step 4: Re-run the targeted orchestration tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-orchestration
```

Expected: PASS.

### Task 2: Add CLI Budget Parsing And Summary Output

**Files:**
- Modify: `apps/api/src/ops/recover-governed-execution-orchestration.ts`
- Modify: `apps/api/test/ops/recover-governed-execution-orchestration.spec.ts`
- Modify: `apps/api/test/http/persistent-server-bootstrap.spec.ts`

- [x] **Step 1: Write the failing CLI tests**

Add coverage that proves:

- `--budget <n>` is forwarded into replay mode
- JSON replay output includes budget-aware summary fields when present
- human-readable recovery output appends eligible/remaining/budget details only when budget is supplied
- boot recovery logging stays unchanged when no budget is configured

- [x] **Step 2: Run the targeted CLI and bootstrap tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- recover-governed-execution-orchestration
pnpm --filter @medical/api test -- persistent-server-bootstrap
```

Expected: FAIL because the CLI does not yet parse or format replay budget details.

- [x] **Step 3: Implement minimal CLI budget support**

Implementation rules:

- support `--budget <n>` for replay mode
- keep dry-run parsing unchanged
- keep no-budget logs compatible with the current boot recovery story

- [x] **Step 4: Re-run the targeted CLI and bootstrap tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- recover-governed-execution-orchestration
pnpm --filter @medical/api test -- persistent-server-bootstrap
```

Expected: PASS.

### Task 3: Update Mainline Docs And Run Final Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

- [x] **Step 1: Update docs**

Document:

- `Phase 10O` as the next execution/orchestration mainline slice
- `--budget <n>` replay semantics
- that budgeting is bounded and optional, and does not override recoverability rules or turn dry-run into a control plane

- [x] **Step 2: Run the final serial verification set**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-orchestration
pnpm --filter @medical/api test -- recover-governed-execution-orchestration
pnpm --filter @medical/api test -- persistent-server-bootstrap
pnpm --filter @medical/api test -- agent-execution
pnpm --filter @medical/api test -- verification-ops
pnpm --filter @medical/api test -- module-orchestration
pnpm --filter @medical/api typecheck
```

Expected: PASS.
