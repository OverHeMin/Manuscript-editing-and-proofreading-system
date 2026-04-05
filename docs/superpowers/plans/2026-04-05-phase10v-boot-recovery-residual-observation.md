# Phase 10V Boot Recovery Residual Observation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After enabled boot recovery completes, emit one read-only residual orchestration summary so startup evidence shows the remaining actionable and readiness posture without changing recovery authority.

**Architecture:** Keep boot recovery best-effort and fail-open, then add one startup-adapter follow-up inspection call using the existing orchestration dry-run/readiness model. Log a compact boot-specific residual summary line, and degrade inspection failures to a separate fail-open message.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, persistent server bootstrap, existing governed recovery/inspection ops helpers, repository docs.

---

## Scope Notes

- Do not add new env vars.
- Do not add new HTTP or UI surfaces.
- Do not change replay, retry, or reclaim semantics.
- Keep the new read-only observation fail-open.
- Keep the change at the startup adapter layer where possible.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-05-phase10v-boot-recovery-residual-observation-design.md`
  - Create: `docs/superpowers/plans/2026-04-05-phase10v-boot-recovery-residual-observation.md`
- Startup wiring:
  - Modify: `apps/api/src/http/persistent-server-bootstrap.ts`
- Ops formatting helpers:
  - Modify: `apps/api/src/ops/recover-governed-execution-orchestration.ts`
- Tests:
  - Modify: `apps/api/test/http/persistent-server-bootstrap.spec.ts`
- Docs:
  - Modify: `README.md`
  - Modify: `docs/OPERATIONS.md`
  - Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
  - Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

## Planned Tasks

### Task 1: Add Boot Residual Observation Coverage First

**Files:**
- Modify: `apps/api/test/http/persistent-server-bootstrap.spec.ts`

- [x] **Step 1: Write the failing startup tests**

Add coverage that proves:

- successful boot recovery emits the existing recovery summary plus one read-only residual summary aligned with actionable/readiness posture
- residual inspection failures are logged fail-open and do not break startup

- [x] **Step 2: Run the targeted bootstrap tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- persistent-server-bootstrap
```

Expected: FAIL because startup does not yet run or log the residual inspection step.

### Task 2: Implement The Minimal Startup-Adapter Slice

**Files:**
- Modify: `apps/api/src/http/persistent-server-bootstrap.ts`
- Modify: `apps/api/src/ops/recover-governed-execution-orchestration.ts`

- [x] **Step 1: Add one boot-specific residual summary formatter**

Implementation rules:

- keep the existing recovery summary unchanged
- reuse the existing inspection/readiness data model
- emit one compact summary line only

- [x] **Step 2: Wire the read-only inspection after successful boot recovery**

Implementation rules:

- run asynchronously after startup listen completes
- keep recovery optional and fail-open
- keep inspection failures fail-open
- do not add new boot-only flags or filters

- [x] **Step 3: Re-run the targeted bootstrap tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- persistent-server-bootstrap
```

Expected: PASS.

### Task 3: Update Docs And Run Final Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/OPERATIONS.md`
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

- [x] **Step 1: Update docs**

Document:

- `Phase 10V` as the next execution/orchestration mainline slice
- that enabled boot recovery now logs one read-only residual summary after the replay pass
- that the new observation remains local-first, additive, and fail-open

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
