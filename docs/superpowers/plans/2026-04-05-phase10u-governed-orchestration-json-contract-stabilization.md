# Phase 10U Governed Orchestration JSON Contract Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit additive metadata to governed orchestration replay and dry-run JSON output so machine consumers can identify report kind, contract version, and requested options without changing current payload fields.

**Architecture:** Keep the current replay summary and inspection report shapes intact, then add one small CLI-layer JSON metadata wrapper by merging additive top-level fields into the existing JSON output. Human-readable output remains unchanged.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, repo-owned ops CLI, repository docs.

---

## Scope Notes

- Do not change replay or dry-run semantics.
- Do not add new HTTP APIs.
- Do not remove or rename existing JSON fields.
- Keep the contract additive and fail-open.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-05-phase10u-governed-orchestration-json-contract-stabilization-design.md`
  - Create: `docs/superpowers/plans/2026-04-05-phase10u-governed-orchestration-json-contract-stabilization.md`
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

### Task 1: Stabilize Dry-Run And Replay JSON Metadata

**Files:**
- Modify: `apps/api/src/ops/recover-governed-execution-orchestration.ts`
- Modify: `apps/api/test/ops/recover-governed-execution-orchestration.spec.ts`

- [x] **Step 1: Write the failing JSON contract tests**

Add coverage that proves:

- replay `--json` adds `report_kind`, `contract_version`, and replay `requested_options`
- dry-run `--json` adds `report_kind`, `contract_version`, and inspection `requested_options`
- existing replay / inspection payload fields still remain present at top level

- [x] **Step 2: Run the targeted ops tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- recover-governed-execution-orchestration
```

Expected: FAIL because JSON output does not yet include explicit metadata.

- [x] **Step 3: Implement the minimal additive JSON metadata layer**

Implementation rules:

- keep human-readable output unchanged
- keep current result fields intact
- add only additive top-level metadata

- [x] **Step 4: Re-run the targeted ops tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- recover-governed-execution-orchestration
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

- that `--json` now includes explicit report metadata
- that existing count/report fields remain unchanged
- that this is a local-first machine-consumption contract improvement only

- [x] **Step 2: Run the final serial verification set**

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
