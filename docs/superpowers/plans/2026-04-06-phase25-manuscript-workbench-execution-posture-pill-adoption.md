# Phase 25 Manuscript Workbench Execution Posture Pill Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the existing manuscript workbench summary cards honest about durable execution posture by replacing residual generic `success/completed` pill emphasis with posture-aware badges derived from the current read model.

**Architecture:** Add one summary-local posture pill resolver in the existing workbench summary and reuse already available settlement evidence from `latestActionResult.details`, hydrated `latestJob.execution_tracking`, and the current overview-backed latest-job fallback. Keep raw attempt status readable, preserve fail-open fallbacks, and avoid any backend or controller changes.

**Tech Stack:** React, TypeScript, existing manuscript workbench summary helpers, frontend unit tests.

---

## Scope Notes

- Do not add backend routes or persistence.
- Do not change controller request choreography.
- Do not add new page surfaces or panels.
- Keep all new behavior fail-open when posture evidence is unavailable.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-06-phase25-manuscript-workbench-execution-posture-pill-adoption-design.md`
  - Create: `docs/superpowers/plans/2026-04-06-phase25-manuscript-workbench-execution-posture-pill-adoption.md`
- Frontend implementation:
  - Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Tests:
  - Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Phase tracking:
  - Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
  - Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

## Planned Tasks

### Task 1: Lock Compact Posture Honesty With Failing Tests

**Files:**
- Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`

- [ ] **Step 1: Write failing tests**

Add coverage that proves:

- non-job action results keep the current generic outcome pill
- settled job-bearing action results render a settled/success posture pill
- retryable or failed job-bearing action results render an attention-oriented
  posture pill
- latest-job posture uses hydrated execution tracking first
- latest-job posture falls back to overview-backed posture when hydration is
  unavailable
- latest-job raw status remains visible as attempt evidence

- [ ] **Step 2: Run targeted page spec and confirm it fails**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-page.spec.tsx
```

Expected: FAIL because the summary still renders generic `success` / raw
`completed` pills.

### Task 2: Implement Minimal Posture-Aware Pill Resolution

**Files:**
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`

- [ ] **Step 1: Add one summary-local posture pill resolver**

Reuse existing settlement, recovery, and fallback helpers rather than adding new
backend data or new requests.

- [ ] **Step 2: Wire the resolver into the existing `Latest Action Result` and `Latest Job` cards**

Keep raw attempt status readable while making the compact posture emphasis
honest.

- [ ] **Step 3: Re-run the targeted page spec and confirm it passes**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-page.spec.tsx
```

Expected: PASS.

### Task 3: Record Phase 25 Ownership And Run Final Serial Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

- [ ] **Step 1: Record Phase 25 in boundary docs**

Document this as the next bounded continuation of the execution/orchestration
lane after `Phase 24`, focused on compact posture-pill honesty in the existing
workbench summary cards.

- [ ] **Step 2: Run final serial verification**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-page.spec.tsx
pnpm --filter @medsys/web test
pnpm --filter @medsys/web typecheck
pnpm --filter @medical/api typecheck
```

Expected: PASS.

- [ ] **Step 3: Review working tree and summarize**

Run:

```bash
git status --short
git diff --stat
```

Expected: only the intended `Phase 25` docs, summary posture-pill logic/tests,
and boundary-tracking files are changed.
