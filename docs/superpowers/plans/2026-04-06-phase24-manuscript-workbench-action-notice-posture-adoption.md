# Phase 24 Manuscript Workbench Action Notice Posture Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the existing top manuscript workbench notice honest about execution/orchestration posture for job-bearing actions by reusing the current Latest Action Result posture details.

**Architecture:** Add one small page-local notice resolver that consumes existing `error`, `status`, and `latestActionResult` inputs. Reuse current action-result settlement/recovery detail rows to classify whether the notice should remain `Action Complete` or downgrade to a more honest unsettled message, while preserving the current fail-open fallback behavior.

**Tech Stack:** React, TypeScript, existing manuscript workbench page helpers, frontend unit tests.

---

## Scope Notes

- Do not add backend routes or persistence.
- Do not change controller request choreography.
- Do not add new page surfaces or panels.
- Keep existing error behavior and generic fail-open success behavior intact.

## Planned File Structure

- Docs:
  - Create: `docs/superpowers/specs/2026-04-06-phase24-manuscript-workbench-action-notice-posture-adoption-design.md`
  - Create: `docs/superpowers/plans/2026-04-06-phase24-manuscript-workbench-action-notice-posture-adoption.md`
- Frontend implementation:
  - Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Tests:
  - Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Phase tracking:
  - Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
  - Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

## Planned Tasks

### Task 1: Lock Notice Honesty With Failing Tests

**Files:**
- Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`

- [ ] **Step 1: Write failing tests**

Add coverage that proves:

- job-bearing settled action results keep the current success notice
- job-bearing unsettled action results downgrade to a more honest notice title
  and message
- non-job success results continue to use the current generic notice
- error notice behavior remains unchanged

- [ ] **Step 2: Run targeted page spec and confirm it fails**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-page.spec.tsx
```

Expected: FAIL because the page still renders `Action Complete` from raw status
for all success cases.

### Task 2: Implement Minimal Posture-Aware Notice Resolution

**Files:**
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`

- [ ] **Step 1: Add one page-local notice resolver**

Reuse current `latestActionResult` detail rows rather than adding new backend
data or new requests.

- [ ] **Step 2: Wire the resolver into the existing top notice render**

Preserve current fail-open and current error behavior.

- [ ] **Step 3: Re-run the targeted page spec and confirm it passes**

Run:

```bash
cd apps/web
node --import tsx --test ./test/manuscript-workbench-page.spec.tsx
```

Expected: PASS.

### Task 3: Record Phase 24 Ownership And Run Final Serial Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`

- [ ] **Step 1: Record Phase 24 in boundary docs**

Document this as the next bounded continuation of the execution/orchestration
lane after `Phase 23`, focused on posture-aware honesty in the existing top
notice surface.

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

Expected: only the intended `Phase 24` docs, page notice resolver/tests, and
boundary-tracking files are changed.
