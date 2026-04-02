# Phase 8AD Knowledge Review Terminal Browser Smoke

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the real browser Knowledge Review handoff coverage to prove reviewer terminal actions update queue and history correctly.

**Architecture:** Reuse the existing Learning Review to Knowledge Review smoke setup, then add two terminal browser paths: one that approves the submitted knowledge item and one that rejects it. Keep the action itself in the real browser UI, and verify queue/history effects with a combination of visible UI state and authenticated API reads so we can avoid artificial UI scaffolding.

**Tech Stack:** Playwright, real browser workbench flows, existing knowledge review HTTP endpoints, manuscript workbench release gate.

---

## Planned Tasks

### Task 1: Browser Approve/Reject Coverage

**Files:**
- Modify: `apps/web/playwright/knowledge-review-handoff.spec.ts`

- [ ] Add failing browser tests for approve and reject terminal actions.
- [ ] Run the targeted browser smoke to verify the failure.
- [ ] Implement the smallest test or UI adjustments needed to pass.
- [ ] Re-run the targeted browser smoke.

### Task 2: Release Gate Verification

**Files:**
- Modify: `scripts/run-manuscript-workbench-gate.mjs` (only if file names change)

- [ ] Re-run `verify:manuscript-workbench` with the expanded terminal smoke.

## Final Verification Gate

- [ ] Run: `pnpm --filter @medsys/web run test:browser -- --browser=chromium playwright/knowledge-review-handoff.spec.ts`
- [ ] Run: `pnpm verify:manuscript-workbench`
