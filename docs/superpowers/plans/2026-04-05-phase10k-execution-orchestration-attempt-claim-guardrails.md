# Phase 10K Execution Orchestration Attempt Claim Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent concurrent best-effort dispatch and recovery paths from both winning the same governed orchestration attempt.

**Architecture:** Keep `AgentExecutionLog` as the durable orchestration anchor and add one nullable attempt-claim token plus compare-and-swap claim/finalize rules in the existing repository and service layer. Recovery and best-effort dispatch stay repo-owned and fail-open; they only become ownership-aware.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, PostgreSQL migrations and repositories, existing `agent-execution` and `verification-ops` services.

---

## Scope Notes

- Do not add a queue, worker farm, or new control plane.
- Do not change business `status` semantics.
- Do not change `verification-ops` governed-source contracts.
- Keep all new behavior additive, local-first, and fail-open.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-05-phase10k-execution-orchestration-attempt-claim-guardrails-design.md`
  - Create: `docs/superpowers/plans/2026-04-05-phase10k-execution-orchestration-attempt-claim-guardrails.md`
- Durable attempt claim:
  - Create: `apps/api/src/database/migrations/0023_agent_execution_orchestration_attempt_claim_token.sql`
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-record.ts`
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-repository.ts`
  - Modify: `apps/api/src/modules/agent-execution/in-memory-agent-execution-repository.ts`
  - Modify: `apps/api/src/modules/agent-execution/postgres-agent-execution-repository.ts`
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-service.ts`
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-orchestration-service.ts`
- Tests:
  - Modify: `apps/api/test/agent-execution/agent-execution-log.spec.ts`
  - Modify: `apps/api/test/agent-execution/postgres-agent-execution-persistence.spec.ts`
  - Modify: `apps/api/test/agent-execution/agent-execution-orchestration.spec.ts`
- Docs:
  - Modify: `README.md`
  - Modify: `docs/OPERATIONS.md`

## Planned Tasks

### Task 1: Add Durable Attempt Claim State

**Files:**
- Create: `apps/api/src/database/migrations/0023_agent_execution_orchestration_attempt_claim_token.sql`
- Modify: `apps/api/src/modules/agent-execution/agent-execution-record.ts`
- Modify: `apps/api/src/modules/agent-execution/agent-execution-repository.ts`
- Modify: `apps/api/src/modules/agent-execution/in-memory-agent-execution-repository.ts`
- Modify: `apps/api/src/modules/agent-execution/postgres-agent-execution-repository.ts`
- Modify: `apps/api/test/agent-execution/agent-execution-log.spec.ts`
- Modify: `apps/api/test/agent-execution/postgres-agent-execution-persistence.spec.ts`

- [x] **Step 1: Write the failing persistence tests**

Add coverage that proves:

```ts
assert.equal(created.body.orchestration_attempt_claim_token, undefined);
assert.equal(loaded?.orchestration_attempt_claim_token, "claim-1");
```

Also cover:

- new logs default to no active claim token
- PostgreSQL round-trips the active claim token
- completed and retryable orchestration records can persist a cleared or active token without changing business `status`

- [x] **Step 2: Run the targeted tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-log
pnpm --filter @medical/api test -- postgres-agent-execution-persistence
```

Expected: FAIL because the new durable field does not exist yet.

- [x] **Step 3: Implement the additive persistence field**

Implementation rules:

- keep the field nullable
- do not expose any new write control path
- preserve backward compatibility for existing rows

- [x] **Step 4: Re-run the targeted tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-log
pnpm --filter @medical/api test -- postgres-agent-execution-persistence
```

Expected: PASS.

### Task 2: Add Compare-And-Swap Claim And Owner-Aware Finalization

**Files:**
- Modify: `apps/api/src/modules/agent-execution/agent-execution-repository.ts`
- Modify: `apps/api/src/modules/agent-execution/in-memory-agent-execution-repository.ts`
- Modify: `apps/api/src/modules/agent-execution/postgres-agent-execution-repository.ts`
- Modify: `apps/api/src/modules/agent-execution/agent-execution-service.ts`
- Modify: `apps/api/src/modules/agent-execution/agent-execution-orchestration-service.ts`
- Modify: `apps/api/test/agent-execution/agent-execution-orchestration.spec.ts`

- [x] **Step 1: Write the failing orchestration ownership tests**

Add coverage that proves:

```ts
assert.equal(firstClaim.orchestration_attempt_claim_token, "claim-1");
assert.equal(secondClaim.orchestration_attempt_count, 1);
assert.equal(finalized.orchestration_status, "completed");
```

Also cover:

- only one claimant wins when the same persisted log snapshot is claimed twice
- a stale owner cannot finalize after a newer reclaim has rotated the token
- recovery summary only counts work the current runner actually claimed

- [x] **Step 2: Run the targeted orchestration tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-orchestration
```

Expected: FAIL because claim and finalize are still optimistic and not owner-aware.

- [x] **Step 3: Implement the claim guardrails**

Implementation rules:

- claim must use compare-and-swap semantics against the persisted log snapshot
- finalization must no-op when the caller no longer owns the current token
- stale-running reclaim must rotate ownership safely
- summary counts must remain honest under claim contention

- [x] **Step 4: Re-run the targeted orchestration tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-orchestration
pnpm --filter @medical/api test -- agent-execution
```

Expected: PASS.

### Task 3: Document The Claim Guard And Run Final Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`

- [x] **Step 1: Update docs**

Document:

- that orchestration attempts now have single-owner durable claim semantics
- that overlapping recovery paths degrade to no-op instead of double-winning
- that this remains local-first, fail-open, and not a new control plane

- [x] **Step 2: Run the final serial verification set**

Run:

```bash
pnpm --filter @medical/contracts typecheck
pnpm --filter @medical/api test -- agent-execution-log
pnpm --filter @medical/api test -- postgres-agent-execution-persistence
pnpm --filter @medical/api test -- agent-execution-orchestration
pnpm --filter @medical/api test -- agent-execution
pnpm --filter @medical/api test -- verification-ops
pnpm --filter @medical/api test -- module-orchestration
pnpm --filter @medical/api typecheck
pnpm --filter @medsys/web test -- admin-governance-controller
pnpm --filter @medsys/web test -- agent-execution-evidence-view
pnpm --filter @medsys/web typecheck
```

Expected: PASS.
