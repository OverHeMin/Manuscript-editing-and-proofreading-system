# Phase 8AA Learning Review Browser Smoke

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repo-owned browser smoke that proves the Learning Review workbench can complete the governed handoff path from manuscript prefill through approval and writeback apply.

**Architecture:** Reuse the existing persistent API and workbench handoff path to seed a manuscript into Learning Review, then drive the real browser UI through snapshot creation, governed candidate approval, and writeback apply. Fold the new smoke into the existing manuscript workbench release gate so Phase 8 coverage protects both downstream workbench surfaces.

**Tech Stack:** Playwright, React workbench pages, persistent HTTP runtime, existing manuscript workbench verification gate.

---

## Planned Tasks

### Task 1: Browser Learning Review Flow

**Files:**
- Create: `apps/web/playwright/learning-review-flow.spec.ts`
- Modify: `apps/web/playwright/manuscript-handoff.spec.ts` (only if shared helpers become worthwhile)

- [ ] Add a failing browser smoke that opens Learning Review from a real manuscript handoff.
- [ ] Verify the smoke fails for the expected missing UI or wiring gap.
- [ ] Implement the smallest browser-flow or UI adjustments needed to pass.
- [ ] Re-run the targeted Playwright smoke.

### Task 2: Release Gate Coverage

**Files:**
- Modify: `scripts/run-manuscript-workbench-gate.mjs`

- [ ] Add the Learning Review browser smoke to the manuscript workbench release gate.
- [ ] Re-run the release gate to prove both browser smokes pass together.

## Final Verification Gate

- [ ] Run: `pnpm --filter @medsys/web run test:browser -- --browser=chromium playwright/learning-review-flow.spec.ts`
- [ ] Run: `pnpm verify:manuscript-workbench`
