# Phase 14 Manuscript Workbench Settlement Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing manuscript workbench consume and present the additive `Phase 13` settlement read model so operator guidance reflects durable business-versus-orchestration posture.

**Architecture:** Extend the web-side manuscript/job view models to match the additive API contract, update the manuscript workbench summary and recommendation logic to read `module_execution_overview` and `execution_tracking`, and keep safe heuristic fallback behavior when settlement observation is missing or failed open. No backend changes are required for this phase.

**Tech Stack:** React, TypeScript, Vite frontend, existing manuscript workbench controller/summary components, frontend unit tests.

---

## Scope Notes

- Do not add backend routes or persistence.
- Do not add a new workbench page or panel.
- Do not change module-run or publish actions.
- Keep all new UI behavior read-only and fail-open.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-06-phase14-manuscript-workbench-settlement-adoption-design.md`
  - Create: `docs/superpowers/plans/2026-04-06-phase14-manuscript-workbench-settlement-adoption.md`
- Frontend types:
  - Modify: `apps/web/src/features/manuscripts/types.ts`
- Workbench summary UI:
  - Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Tests:
  - Modify: `apps/web/test/manuscript-workbench-summary.spec.tsx`
- Phase tracking:
  - Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
  - Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

## Planned Tasks

### Task 1: Lock Frontend Settlement Types

**Files:**
- Modify: `apps/web/src/features/manuscripts/types.ts`
- Modify: `apps/web/test/manuscript-workbench-summary.spec.tsx`

- [ ] **Step 1: Write the failing frontend type and summary-adoption tests**

Add coverage that proves:

- frontend manuscript types accept `module_execution_overview`
- frontend job types accept `execution_tracking`
- workbench-side fixtures accept the new settlement fields without collapsing them

- [ ] **Step 2: Run the targeted frontend tests to confirm they fail**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-summary.spec.tsx
```

Expected: FAIL because current frontend types and consumers do not use settlement fields.

- [ ] **Step 3: Implement additive type adoption**

Implementation rules:

- mirror the API shape closely
- do not collapse settlement fields into one string
- keep existing summary and workspace behavior fail-open

- [ ] **Step 4: Re-run the targeted frontend tests and confirm they pass**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-summary.spec.tsx
```

Expected: PASS.

### Task 2: Adopt Settlement In Summary And Guidance Logic

**Files:**
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/test/manuscript-workbench-summary.spec.tsx`

- [ ] **Step 1: Write the failing summary/recommendation tests**

Add coverage that proves:

- screening/editing guidance prefers settlement over raw latest job
- follow-up-pending or retryable stages are not presented as fully done
- failed-open settlement falls back safely without breaking the summary
- tracked jobs show execution settlement context in the latest-job card

- [ ] **Step 2: Run the targeted frontend tests to confirm they fail**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-summary.spec.tsx
```

Expected: FAIL because current summary logic still uses heuristics.

- [ ] **Step 3: Implement the minimum UI adoption**

Implementation rules:

- preserve the current overall workbench layout
- add compact settlement presentation, not a new sub-page
- prefer settlement for operator guidance where settlement is reported, but keep heuristic fallback on missing or failed-open data

- [ ] **Step 4: Re-run the targeted frontend tests and confirm they pass**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-summary.spec.tsx
```

Expected: PASS.

### Task 3: Record Phase 14 Ownership And Run Final Serial Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

- [ ] **Step 1: Record Phase 14 in the boundary docs**

Document this as the frontend adoption continuation of the same execution/orchestration lane after `Phase 13`, focused on mainline workbench visibility rather than new backend authority.

- [ ] **Step 2: Run final serial verification**

Run:

```bash
pnpm --filter @medsys/web test
cd apps/web
node --import tsx --test ./test/manuscript-workbench-summary.spec.tsx
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

Expected: only the intended `Phase 14` frontend and boundary files are changed.
