# Phase 10S Governed Orchestration Readiness Windows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit readiness metadata to governed orchestration dry-run inspection so operators can see when blocked replay work becomes recoverable next.

**Architecture:** Extend the existing inspection item contract with additive readiness fields derived from current retry and stale-running rules, surface them through the existing CLI item formatter, and keep replay behavior unchanged. This remains a read-only observability slice.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, governed orchestration service, repo-owned ops CLI, repository docs.

---

## Scope Notes

- Do not add new replay controls.
- Do not persist new orchestration columns.
- Do not change retry or stale-running timing rules.
- Keep all new output additive and read-only.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-05-phase10s-governed-orchestration-readiness-windows-design.md`
  - Create: `docs/superpowers/plans/2026-04-05-phase10s-governed-orchestration-readiness-windows.md`
- Orchestration service:
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-orchestration-service.ts`
- Ops CLI:
  - Modify: `apps/api/src/ops/recover-governed-execution-orchestration.ts`
- Tests:
  - Modify: `apps/api/test/agent-execution/agent-execution-orchestration.spec.ts`
  - Modify: `apps/api/test/ops/recover-governed-execution-orchestration.spec.ts`
- Docs:
  - Modify: `README.md`
  - Modify: `docs/OPERATIONS.md`
  - Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
  - Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

## Planned Tasks

### Task 1: Add Inspection Readiness Metadata

**Files:**
- Modify: `apps/api/src/modules/agent-execution/agent-execution-orchestration-service.ts`
- Modify: `apps/api/test/agent-execution/agent-execution-orchestration.spec.ts`

- [x] **Step 1: Write the failing inspection tests**

Add coverage that proves:

- deferred retry items expose `recovery_readiness=waiting_retry_eligibility` and the same next eligible timestamp
- fresh running items expose `recovery_readiness=waiting_running_timeout` and the computed stale timeout timestamp
- recoverable items expose `recovery_readiness=ready_now`

- [x] **Step 2: Run the targeted orchestration tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-orchestration
```

Expected: FAIL because inspection items do not yet expose normalized readiness metadata.

- [x] **Step 3: Implement minimal readiness metadata support**

Implementation rules:

- derive from current retry and stale-running rules only
- keep categories and replay behavior unchanged
- add only read-only fields

- [x] **Step 4: Re-run the targeted orchestration tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- agent-execution-orchestration
```

Expected: PASS.

### Task 2: Surface Readiness Through The CLI And Docs

**Files:**
- Modify: `apps/api/src/ops/recover-governed-execution-orchestration.ts`
- Modify: `apps/api/test/ops/recover-governed-execution-orchestration.spec.ts`
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

- [x] **Step 1: Write the failing CLI tests**

Add coverage that proves:

- dry-run item lines append readiness metadata
- JSON dry-run output includes the additive readiness fields

- [x] **Step 2: Run the targeted ops tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- recover-governed-execution-orchestration
```

Expected: FAIL because the CLI does not yet format or expose the new readiness metadata.

- [x] **Step 3: Implement the minimal CLI and docs updates**

Document:

- the new readiness fields and meanings
- that they are derived from current retry and stale-running rules only
- that no new replay control authority is added

- [x] **Step 4: Re-run the targeted ops tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- recover-governed-execution-orchestration
```

Expected: PASS.

### Task 3: Run Final Serial Verification

**Files:**
- Modify: `apps/api/src/modules/agent-execution/agent-execution-orchestration-service.ts`
- Modify: `apps/api/src/ops/recover-governed-execution-orchestration.ts`
- Modify: `apps/api/test/agent-execution/agent-execution-orchestration.spec.ts`
- Modify: `apps/api/test/ops/recover-governed-execution-orchestration.spec.ts`
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

- [x] **Step 1: Run the final serial verification set**

Run:

```bash
pnpm --filter @medical/api test -- recover-governed-execution-orchestration
pnpm --filter @medical/api test -- agent-execution-orchestration
pnpm --filter @medical/api test -- agent-execution
pnpm --filter @medical/api test -- verification-ops
pnpm --filter @medical/api test -- module-orchestration
pnpm --filter @medical/api typecheck
```

Expected: PASS.
