# Phase 9Q Evaluation Sample Context Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve sample-level evaluation context when operators jump from Evaluation Workbench into a manuscript workbench and back again, using `reviewedCaseSnapshotId` as the primary focus key and `sampleSetItemId` as a secondary reference.

**Architecture:** Extend the existing hash-based workbench routing contract instead of introducing a new router or transient handoff state. Keep workspace loading keyed only by `manuscriptId`, add a shared evaluation-to-manuscript handoff helper in the evaluation page, and render the extra sample context as explicit operator-facing UI in the manuscript workbench while preserving it on the return link.

**Tech Stack:** TypeScript, React/Vite, existing hash-based workbench host, `node:test` via `tsx`, Playwright, existing manuscript/evaluation workbench components, existing CSS module file for manuscript workbench presentation.

---

## Scope Notes

- Do not introduce snapshot-to-asset mapping or asset auto-selection in this slice.
- Do not add new back-end APIs, persistence fields, or service lookups.
- Preserve the current manuscript-only handoff flow as a strict backward-compatible fallback.
- Prefer updating existing tests over creating brand-new test harnesses unless an existing file cannot reasonably cover the behavior.

## File Map

- Routing contract:
  - Modify: `apps/web/src/app/workbench-routing.ts`
  - Modify: `apps/web/src/app/workbench-host.tsx`
  - Test: `apps/web/test/manuscript-workbench-routing.spec.ts`
- Evaluation handoff emitters:
  - Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`
  - Test: `apps/web/test/evaluation-workbench-page.spec.tsx`
- Manuscript workbench context consumer:
  - Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
  - Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
  - Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench.css`
  - Test: `apps/web/test/manuscript-workbench-page.spec.tsx`
  - Test: `apps/web/test/manuscript-workbench-summary.spec.tsx`
- Browser verification:
  - Modify: `apps/web/playwright/evaluation-workbench.spec.ts`

## Planned Tasks

### Task 1: Extend The Hash Handoff Contract

**Files:**
- Modify: `apps/web/src/app/workbench-routing.ts`
- Modify: `apps/web/src/app/workbench-host.tsx`
- Test: `apps/web/test/manuscript-workbench-routing.spec.ts`

- [ ] **Step 1: Add failing routing assertions for the new handoff keys**

Update `apps/web/test/manuscript-workbench-routing.spec.ts` so it covers:

```ts
const hash = formatWorkbenchHash("editing", {
  manuscriptId: "manuscript-42",
  reviewedCaseSnapshotId: "snapshot-42",
  sampleSetItemId: "sample-item-42",
});

assert.equal(
  hash,
  "#editing?manuscriptId=manuscript-42&reviewedCaseSnapshotId=snapshot-42&sampleSetItemId=sample-item-42",
);
assert.deepEqual(resolveWorkbenchLocation(hash), {
  workbenchId: "editing",
  manuscriptId: "manuscript-42",
  reviewedCaseSnapshotId: "snapshot-42",
  sampleSetItemId: "sample-item-42",
});
```

- [ ] **Step 2: Run the routing test and confirm it fails for missing route fields**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/manuscript-workbench-routing.spec.ts
```

Expected: FAIL because `WorkbenchLocation`, `formatWorkbenchHash()`, and `resolveWorkbenchLocation()` do not yet know `reviewedCaseSnapshotId` or `sampleSetItemId`.

- [ ] **Step 3: Implement the route contract and host pass-through**

Update `apps/web/src/app/workbench-routing.ts` to:

- extend `WorkbenchLocation`
- extend the object overload of `formatWorkbenchHash()`
- parse `reviewedCaseSnapshotId`
- parse `sampleSetItemId`
- continue supporting the existing string shorthand for manuscript-only handoffs

Update `apps/web/src/app/workbench-host.tsx` to:

- add both new fields to `routeState`
- preserve them in `resolveInitialWorkbenchRoute()`
- pass them into `ManuscriptWorkbenchPage`

- [ ] **Step 4: Re-run the routing test and confirm it passes**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/manuscript-workbench-routing.spec.ts
```

Expected: PASS with existing manuscript-only and knowledge-item routes still green.

- [ ] **Step 5: Commit the routing-contract slice**

Run:

```bash
git add apps/web/src/app/workbench-routing.ts apps/web/src/app/workbench-host.tsx apps/web/test/manuscript-workbench-routing.spec.ts
git commit -m "feat: extend workbench sample context routing"
```

### Task 2: Unify Evaluation Workbench Sample Handoff Links

**Files:**
- Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`
- Test: `apps/web/test/evaluation-workbench-page.spec.tsx`

- [ ] **Step 1: Add failing unit tests for sample-context handoff URLs**

Update `apps/web/test/evaluation-workbench-page.spec.tsx` to assert that both:

- `EvaluationWorkbenchSelectedRunItemDetailCard`
- `EvaluationWorkbenchLinkedSampleContextList`

emit handoff URLs like:

```text
#editing?manuscriptId=manuscript-1&reviewedCaseSnapshotId=reviewed-case-snapshot-1&sampleSetItemId=sample-item-1
```

Also add a fallback case where only `manuscriptId` is available and the URL remains manuscript-only.

- [ ] **Step 2: Run the evaluation page unit test and confirm it fails**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/evaluation-workbench-page.spec.tsx
```

Expected: FAIL because the current page only emits `#<mode>?manuscriptId=...`.

- [ ] **Step 3: Implement one shared handoff helper in the evaluation page**

Inside `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`:

- add a helper that accepts:
  - `mode`
  - `manuscriptId`
  - `reviewedCaseSnapshotId`
  - `sampleSetItemId`
- have the helper call `formatWorkbenchHash()`
- use that helper from both:
  - `EvaluationWorkbenchLinkedSampleContextList`
  - `EvaluationWorkbenchSelectedRunItemDetailCard`

Do not duplicate per-component URL assembly.

- [ ] **Step 4: Re-run the evaluation page unit test and confirm it passes**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/evaluation-workbench-page.spec.tsx
```

Expected: PASS with both sample-context render paths using the same route shape.

- [ ] **Step 5: Commit the evaluation-link slice**

Run:

```bash
git add apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx apps/web/test/evaluation-workbench-page.spec.tsx
git commit -m "feat: preserve sample context in evaluation handoffs"
```

### Task 3: Render Manuscript Workbench Evaluation Context And Preserve The Return Link

**Files:**
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench.css`
- Test: `apps/web/test/manuscript-workbench-page.spec.tsx`
- Test: `apps/web/test/manuscript-workbench-summary.spec.tsx`

- [ ] **Step 1: Add failing page and summary tests for the new context UI**

Update `apps/web/test/manuscript-workbench-page.spec.tsx` to cover:

- rendering the prefill note plus a new `Evaluation Handoff Context` block when:
  - `prefilledManuscriptId`
  - `prefilledReviewedCaseSnapshotId`
  - `prefilledSampleSetItemId`
  are present
- keeping the old behavior unchanged when only `prefilledManuscriptId` is present
- proving `loadPrefilledWorkbenchWorkspace()` still only calls `loadWorkspace(manuscriptId)`

Update `apps/web/test/manuscript-workbench-summary.spec.tsx` to cover:

- `Open Evaluation Workbench` including:
  - `manuscriptId`
  - `reviewedCaseSnapshotId`
  - `sampleSetItemId`
- fallback to manuscript-only links when no evaluation handoff context exists

- [ ] **Step 2: Run the manuscript page and summary tests and confirm they fail**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/manuscript-workbench-page.spec.tsx test/manuscript-workbench-summary.spec.tsx
```

Expected: FAIL because the page does not yet accept the new props or render the new context, and the summary link only preserves `manuscriptId`.

- [ ] **Step 3: Implement the manuscript-side context consumer**

Update `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx` to:

- accept:
  - `prefilledReviewedCaseSnapshotId?: string`
  - `prefilledSampleSetItemId?: string`
- render an `Evaluation Handoff Context` card above the controls/summary area when either value is present
- keep `loadPrefilledWorkbenchWorkspace()` unchanged so it still loads by manuscript only

Update `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx` to:

- accept optional evaluation handoff context props
- preserve both new keys when building the `Open Evaluation Workbench` link

Update `apps/web/src/features/manuscript-workbench/manuscript-workbench.css` to style the new context card with the same visual family as the existing prefill/loading affordances.

- [ ] **Step 4: Re-run the manuscript page and summary tests and confirm they pass**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/manuscript-workbench-page.spec.tsx test/manuscript-workbench-summary.spec.tsx
```

Expected: PASS with manuscript-only fallback behavior still intact.

- [ ] **Step 5: Commit the manuscript-context slice**

Run:

```bash
git add apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench.css apps/web/test/manuscript-workbench-page.spec.tsx apps/web/test/manuscript-workbench-summary.spec.tsx
git commit -m "feat: show evaluation handoff context in manuscript workbench"
```

### Task 4: Prove Browser Round-Trip And Run The Final Verification Gate

**Files:**
- Modify: `apps/web/playwright/evaluation-workbench.spec.ts`

- [ ] **Step 1: Add failing Playwright assertions for full sample-context round-trip**

Update the existing browser scenarios in `apps/web/playwright/evaluation-workbench.spec.ts` so they prove:

- the handoff link from Evaluation Workbench contains:
  - `manuscriptId=manuscript-demo-1`
  - `reviewedCaseSnapshotId=<prepared snapshot id>`
  - `sampleSetItemId=<prepared sample item id>`
- the opened manuscript workbench visibly renders:
  - `Evaluation Handoff Context`
  - the reviewed snapshot id
  - the sample set item id
- the `Open Evaluation Workbench` link preserves the same keys on the way back

If the existing Playwright setup helper does not already expose the first sample-set item id, extend the helper return shape inside the same spec file before adding the assertions.

- [ ] **Step 2: Run the focused Playwright spec and confirm it fails**

Run:

```bash
pnpm --filter @medsys/web exec playwright test -c playwright.config.ts playwright/evaluation-workbench.spec.ts
```

Expected: FAIL on URL or visible-context assertions until the full handoff chain is wired.

- [ ] **Step 3: Fix any remaining round-trip gaps and re-run Playwright**

Most likely fixes, if needed:

- forwarding the new props from `WorkbenchHost`
- passing context into `ManuscriptWorkbenchSummary`
- preserving the handoff keys when the page is re-entered by URL rather than button click
- exposing `sampleSetItemId` from the existing test preparation helper so the browser assertions can stay deterministic

Re-run:

```bash
pnpm --filter @medsys/web exec playwright test -c playwright.config.ts playwright/evaluation-workbench.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Run the final verification gate**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/manuscript-workbench-routing.spec.ts test/evaluation-workbench-page.spec.tsx test/manuscript-workbench-page.spec.tsx test/manuscript-workbench-summary.spec.tsx
pnpm --filter @medsys/web exec playwright test -c playwright.config.ts playwright/evaluation-workbench.spec.ts
pnpm --filter @medsys/web run typecheck
```

Expected:

- all targeted unit tests PASS
- Playwright PASS
- `typecheck` PASS

- [ ] **Step 5: Commit the verification slice**

Run:

```bash
git add apps/web/playwright/evaluation-workbench.spec.ts
git commit -m "test: verify evaluation sample context round trip"
```

## Final Verification Gate

- [ ] Run: `pnpm --filter @medsys/web exec node --import tsx --test test/manuscript-workbench-routing.spec.ts test/evaluation-workbench-page.spec.tsx test/manuscript-workbench-page.spec.tsx test/manuscript-workbench-summary.spec.tsx`
- [ ] Run: `pnpm --filter @medsys/web exec playwright test -c playwright.config.ts playwright/evaluation-workbench.spec.ts`
- [ ] Run: `pnpm --filter @medsys/web run typecheck`

## Acceptance Criteria

- Evaluation Workbench sample-context links include `manuscriptId`, `reviewedCaseSnapshotId`, and `sampleSetItemId` when available.
- The shared evaluation handoff helper prevents card/list URL drift inside `evaluation-workbench-page.tsx`.
- Manuscript Workbench displays an explicit `Evaluation Handoff Context` card without changing manuscript-based workspace loading.
- The manuscript-to-evaluation return link preserves sample context when it exists and falls back cleanly when it does not.
- Targeted unit tests, Playwright, and web typecheck all pass.
