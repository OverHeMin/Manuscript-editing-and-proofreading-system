# Phase 10Q Boot Recovery Budget Guardrail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow enabled boot-time governed orchestration recovery to replay only a bounded slice of eligible backlog per startup when an explicit local budget is configured.

**Architecture:** Add one optional startup environment variable for boot replay budgeting, parse it in persistent server bootstrap, forward it into the existing recovery entrypoint, and keep missing or invalid values fail-open so startup behavior remains unchanged by default.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, persistent server bootstrap, existing governed recovery entrypoint, repository docs.

---

## Scope Notes

- Do not add new CLI flags.
- Do not add new APIs or UI controls.
- Do not make invalid startup budget values fatal.
- Keep no-budget boot recovery behavior unchanged.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-05-phase10q-boot-recovery-budget-guardrail-design.md`
  - Create: `docs/superpowers/plans/2026-04-05-phase10q-boot-recovery-budget-guardrail.md`
- Startup wiring:
  - Modify: `apps/api/src/http/persistent-server-bootstrap.ts`
- Tests:
  - Modify: `apps/api/test/http/persistent-server-bootstrap.spec.ts`
- Docs:
  - Modify: `README.md`
  - Modify: `docs/OPERATIONS.md`
  - Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
  - Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

## Planned Tasks

### Task 1: Add Boot Recovery Budget Forwarding

**Files:**
- Modify: `apps/api/src/http/persistent-server-bootstrap.ts`
- Modify: `apps/api/test/http/persistent-server-bootstrap.spec.ts`

- [x] **Step 1: Write the failing startup tests**

Add coverage that proves:

- boot recovery forwards `budget: 2` when `AGENT_EXECUTION_ORCHESTRATION_RECOVERY_ON_BOOT_BUDGET=2`
- missing budget keeps the current no-budget recovery call
- invalid boot budget values degrade to no-budget fail-open behavior

- [x] **Step 2: Run the targeted bootstrap tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- persistent-server-bootstrap
```

Expected: FAIL because startup does not yet parse or forward a boot replay budget.

- [x] **Step 3: Implement minimal startup-side budget parsing**

Implementation rules:

- parse locally in bootstrap
- forward only normalized positive integers
- ignore zero, negative, or non-integer values
- keep startup fail-open

- [x] **Step 4: Re-run the targeted bootstrap tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- persistent-server-bootstrap
```

Expected: PASS.

### Task 2: Update Docs And Run Final Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

- [x] **Step 1: Update docs**

Document:

- `Phase 10Q` as the next orchestration mainline slice
- `AGENT_EXECUTION_ORCHESTRATION_RECOVERY_ON_BOOT_BUDGET`
- that invalid values are ignored fail-open and do not block startup

- [x] **Step 2: Run the final serial verification set**

Run:

```bash
pnpm --filter @medical/api test -- persistent-server-bootstrap
pnpm --filter @medical/api test -- recover-governed-execution-orchestration
pnpm --filter @medical/api test -- agent-execution-orchestration
pnpm --filter @medical/api test -- agent-execution
pnpm --filter @medical/api test -- verification-ops
pnpm --filter @medical/api test -- module-orchestration
pnpm --filter @medical/api typecheck
```

Expected: PASS.
