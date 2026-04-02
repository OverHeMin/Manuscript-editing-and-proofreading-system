# Phase 8AB Learning To Knowledge Handoff

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Learning Review hand a governed knowledge draft into the real Knowledge Review workbench without changing the existing governed-draft semantics.

**Architecture:** Keep `Apply writeback` as draft creation only, then add an explicit `submit for review` handoff step in the Learning Review web workbench. Extend workbench routing and the Knowledge Review desk so a submitted knowledge item can be preselected by `knowledgeItemId`, then prove the full path in a real browser smoke and release gate.

**Tech Stack:** React workbench pages, typed knowledge clients, Playwright, existing manuscript workbench release gate.

---

## Planned Tasks

### Task 1: Knowledge Review Route Handoff

**Files:**
- Modify: `apps/web/src/app/workbench-routing.ts`
- Modify: `apps/web/src/app/workbench-host.tsx`
- Modify: `apps/web/test/manuscript-workbench-routing.spec.ts`
- Modify: `apps/web/src/features/knowledge-review/knowledge-review-workbench-page.tsx`
- Modify: `apps/web/src/features/knowledge-review/workbench-controller.ts`

- [ ] Add a failing routing test for `knowledgeItemId` handoff support.
- [ ] Run the routing test to verify it fails.
- [ ] Implement route parsing/formatting and Knowledge Review preselection using the existing active-item state model.
- [ ] Re-run the targeted routing and web tests.

### Task 2: Learning Review Submission Handoff

**Files:**
- Modify: `apps/web/src/features/learning-review/learning-review-workbench-page.tsx`
- Modify: `apps/web/src/features/learning-review/learning-review-api.ts` or supporting imports if needed
- Create: `apps/web/playwright/knowledge-review-handoff.spec.ts`
- Modify: `scripts/run-manuscript-workbench-gate.mjs`

- [ ] Add a failing browser smoke for apply-writeback -> submit-for-review -> open Knowledge Review.
- [ ] Run it to verify the missing handoff behavior fails for the expected reason.
- [ ] Implement the smallest Learning Review UI changes to submit the governed draft and expose the Knowledge Review link.
- [ ] Add the new smoke to the release gate.
- [ ] Re-run the targeted smoke and full `verify:manuscript-workbench` gate.

## Final Verification Gate

- [ ] Run: `pnpm --filter @medsys/web exec node --import tsx --test test/manuscript-workbench-routing.spec.ts`
- [ ] Run: `pnpm --filter @medsys/web run test:browser -- --browser=chromium playwright/knowledge-review-handoff.spec.ts`
- [ ] Run: `pnpm verify:manuscript-workbench`
