# Phase 10W Governed Orchestration Post-Recovery Residual Observation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a successful manual governed orchestration replay, print one additive residual backlog summary for the same scope so operators can see what remains without running a second command.

**Architecture:** Keep replay execution and JSON output unchanged, then add one non-dry-run follow-up inspection using the existing read-only inspection model with the same scope filters but without replay budget narrowing. Format the result as one compact human-readable residual summary line, and degrade inspection failures to a fail-open warning.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, repo-owned ops CLI, repository docs.

---

## Scope Notes

- Do not change replay semantics.
- Do not change `--json` output in this phase.
- Do not add new APIs or startup behavior.
- Keep the residual observation fail-open.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-05-phase10w-governed-orchestration-post-recovery-residual-observation-design.md`
  - Create: `docs/superpowers/plans/2026-04-05-phase10w-governed-orchestration-post-recovery-residual-observation.md`
- Ops CLI:
  - Modify: `apps/api/src/ops/recover-governed-execution-orchestration.ts`
- Tests:
  - Modify: `apps/api/test/ops/recover-governed-execution-orchestration.spec.ts`
- Docs:
  - Modify: `README.md`
  - Modify: `docs/OPERATIONS.md`
  - Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
  - Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

## Planned Tasks

### Task 1: Add Failing Recovery-CLI Residual Observation Tests

**Files:**
- Modify: `apps/api/test/ops/recover-governed-execution-orchestration.spec.ts`

- [x] **Step 1: Write the failing tests**

Add coverage that proves:

- non-dry-run human replay prints the existing recovery summary plus one residual summary line
- residual inspection uses the same scope filters as replay but does not forward replay `budget`
- residual observation failures degrade to a fail-open human log
- `--json` output remains unchanged and does not emit extra plain-text residual lines

- [x] **Step 2: Run the targeted ops tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- recover-governed-execution-orchestration
```

Expected: FAIL because replay output does not yet include residual observation behavior.

### Task 2: Implement The Minimal Recovery-CLI Slice

**Files:**
- Modify: `apps/api/src/ops/recover-governed-execution-orchestration.ts`

- [x] **Step 1: Add a compact post-recovery residual formatter**

Implementation rules:

- reuse the existing inspection/readiness summary model
- print one summary line only
- keep dry-run formatting unchanged

- [x] **Step 2: Wire post-recovery residual inspection in human replay mode**

Implementation rules:

- run only after successful replay
- use the same scope filters
- do not carry replay `budget` into residual observation
- skip this step entirely for `--json`
- degrade inspection failures to a fail-open human log

- [x] **Step 3: Re-run the targeted ops tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- recover-governed-execution-orchestration
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

- `10W` as the next bounded execution/orchestration mainline slice
- that human replay now emits one post-pass residual summary
- that `--json` remains unchanged in this phase

- [x] **Step 2: Run the final serial verification set**

Run:

```bash
pnpm --filter @medical/api test -- recover-governed-execution-orchestration
pnpm --filter @medical/api test -- persistent-server-bootstrap
pnpm --filter @medical/api test -- agent-execution-orchestration
pnpm --filter @medical/api test -- agent-execution
pnpm --filter @medical/api test -- verification-ops
pnpm --filter @medical/api test -- module-orchestration
pnpm --filter @medical/api typecheck
```

Expected: PASS.
