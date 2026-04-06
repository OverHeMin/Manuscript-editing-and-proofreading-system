# Phase 16 Manuscript Workbench Recovery And Readiness Posture Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing manuscript workbench explain restored latest-job recovery and runtime-readiness posture through the current summary cards and load result, so reload-safe execution context is readable and actionable as observation without adding any new control surface.

**Architecture:** Reuse the already-returned manuscript/job read model from `Phase 13-15`. Tighten the frontend types for linked recovery/readiness fields, enrich the current workbench formatters and summary cards, and keep all new behavior fail-open and read-only.

**Tech Stack:** React, TypeScript, existing manuscript workbench summary/page, frontend unit tests.

---

## Scope Notes

- Do not add backend routes or persistence.
- Do not add a new workbench page, panel, or control-plane action.
- Do not make runtime readiness or recovery posture a new hard gate.
- Keep all new behavior read-only and fail-open.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-06-phase16-manuscript-workbench-recovery-and-readiness-posture-adoption-design.md`
  - Create: `docs/superpowers/plans/2026-04-06-phase16-manuscript-workbench-recovery-and-readiness-posture-adoption.md`
- Frontend types and workbench formatting:
  - Modify: `apps/web/src/features/manuscripts/types.ts`
  - Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
  - Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Tests:
  - Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`
  - Modify: `apps/web/test/manuscript-workbench-summary.spec.tsx`
- Phase tracking:
  - Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
  - Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

## Planned Tasks

### Task 1: Lock Recovery/Readiness Adoption With Failing Tests

**Files:**
- Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Modify: `apps/web/test/manuscript-workbench-summary.spec.tsx`

- [ ] **Step 1: Write failing workbench tests**

Add coverage that proves:

- restored latest-job load results include recovery/readiness posture details
- latest-job summary shows recovery posture and ready-at timing
- module-overview settlement text reflects linked recovery/readiness posture
- recommendation details remain read-only while becoming more explanatory

- [ ] **Step 2: Run targeted specs and confirm they fail**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-page.spec.tsx
node --import tsx --test ./test/manuscript-workbench-summary.spec.tsx
```

Expected: FAIL because current workbench output does not yet surface recovery or readiness posture.

### Task 2: Implement Explicit Types And Posture Formatters

**Files:**
- Modify: `apps/web/src/features/manuscripts/types.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`

- [ ] **Step 1: Tighten the additive web view models**

Model the existing API response more explicitly for:

- linked recovery summary
- runtime binding readiness report
- readiness issues and alignment data

- [ ] **Step 2: Implement minimal posture-aware rendering**

Add the smallest formatter/helpers needed to:

- show recovery posture and `ready_at`
- show readiness posture and degraded/missing signals
- enrich load-result details and existing summary cards without changing layout authority

- [ ] **Step 3: Re-run the targeted specs and confirm they pass**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-page.spec.tsx
node --import tsx --test ./test/manuscript-workbench-summary.spec.tsx
```

Expected: PASS.

### Task 3: Record Phase 16 Ownership And Run Final Serial Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

- [ ] **Step 1: Record Phase 16 in boundary docs**

Document this as the next bounded continuation of the execution/orchestration
lane after `Phase 15`, focused on read-only recovery/readiness posture adoption
inside the current manuscript workbench.

- [ ] **Step 2: Run final serial verification**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-page.spec.tsx
node --import tsx --test ./test/manuscript-workbench-summary.spec.tsx
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

Expected: only the intended `Phase 16` docs, workbench files, and boundary-tracking files are changed.
