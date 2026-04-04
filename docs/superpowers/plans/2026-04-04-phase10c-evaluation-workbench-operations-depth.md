# Phase 10C Evaluation Workbench Operations Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deepen `Evaluation Workbench` into a suite-first, read-only operations surface that defaults to latest-versus-previous finalized comparison, uses a bounded visible history window, and summarizes historical evidence/recommendation signals without adding any new control-plane write actions.

**Architecture:** Keep Phase 10C web-first and read-model-first. Reuse the existing `verification-ops` endpoints and finalized-result records, add a focused derived-logic module for delta classification and history-window shaping, extend the workbench controller to return a suite operations summary, and update the page to foreground the delta-first operator view. Do not introduce new persisted governance objects, new write APIs, or cross-domain analytics.

**Tech Stack:** TypeScript, React/Vite, node:test via `tsx`, Playwright, existing `evaluation-workbench` controller/page structure, existing `verification-ops` typed client, existing `pnpm verify:manuscript-workbench` browser gate.

---

## Scope Notes

- Phase 10C remains `verification-ops` only. Do not aggregate `AgentExecutionLog`, knowledge review, learning review, or routing governance analytics into this slice.
- Keep `Evaluation Workbench` read-only. Do not add baseline pinning, labels, notes, saved presets, or any other new write action.
- Read-only in Phase 10C also means the page must not expose the legacy write flows currently present in the workbench (`Activate`, `Run Launch`, `Complete And Finalize Run`, `Finalize Recommendation`). Update page and browser tests so they no longer expect those controls in this phase surface.
- Default comparison must follow the approved spec rule:
  - compare recommendation severity first
  - if recommendation severity is equal, compare finalized run status
  - if both recommendation severity and finalized run status are equal, classify as `flat`
- Default visible history window preset is `latest_10`, meaning the latest 10 finalized results for the selected suite, ordered by `recommendation.created_at` descending.
- If there are fewer than two finalized runs, render honest degradation instead of inventing a comparison.
- Prefer no API or backend changes in this phase. Only touch the API client or read-side contract if the current workbench cannot implement the spec safely without excessive fan-out or ambiguous derivation.

## Planned File Structure

- Create: `apps/web/src/features/evaluation-workbench/evaluation-workbench-operations.ts`
- Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench-controller.ts`
- Modify: `apps/web/src/features/verification-ops/types.ts`
- Modify: `apps/web/src/features/verification-ops/verification-ops-api.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-api.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-service.ts`
- Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`
- Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench.css`
- Test: `apps/web/test/evaluation-workbench-operations.spec.ts`
- Modify: `apps/web/test/evaluation-workbench-controller.spec.ts`
- Modify: `apps/web/test/evaluation-workbench-page.spec.tsx`
- Modify: `apps/web/playwright/evaluation-workbench.spec.ts`
- Modify: `README.md`

### Task 1: Add Deterministic Suite-Operations Read Helpers

**Files:**
- Create: `apps/web/src/features/evaluation-workbench/evaluation-workbench-operations.ts`
- Test: `apps/web/test/evaluation-workbench-operations.spec.ts`

- [ ] **Step 1: Write the failing read-model tests**

Create `apps/web/test/evaluation-workbench-operations.spec.ts` with expectations for:

- deterministic `better / worse / flat` classification using:
  - recommendation severity first
  - finalized run status second
- latest 10 finalized results visible-window clamping by `recommendation.created_at`
- optional time-window filtering (`latest_10`, `last_7_days`, `last_30_days`, `all_suite`)
- honest degradation when fewer than two finalized runs exist
- suite signal summaries computed only from the actively visible filtered history window, including:
  - recommendation distribution
  - failure/regression recurrence
  - evidence-pack outcome mix

Example shape:

```ts
assert.equal(summary.delta.classification, "better");
assert.equal(summary.visibleHistory.length, 10);
assert.equal(summary.defaultComparison?.selected.run.id, "run-latest");
assert.equal(summary.defaultComparison?.baseline.run.id, "run-previous");
assert.equal(summary.delta.reason, "recommendation_improved");
assert.equal(summary.emptyState?.kind, "comparison_unavailable");
```

- [ ] **Step 2: Run the new test file and confirm it fails**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/evaluation-workbench-operations.spec.ts
```

Expected: FAIL because no dedicated suite-operations helper module exists yet.

- [ ] **Step 3: Implement the minimal derived-logic module**

Create `apps/web/src/features/evaluation-workbench/evaluation-workbench-operations.ts` and keep it focused on read-only derivation:

- add small view-model types such as:
  - `EvaluationWorkbenchHistoryWindowPreset`
  - `EvaluationWorkbenchDeltaClassification`
  - `EvaluationWorkbenchSuiteOperationsSummary`
- add helper functions for:
  - recommendation severity ordering
  - default history-window selection
  - visible-history filtering by window preset
  - default latest-versus-previous comparison selection
  - deterministic delta classification and reason
  - suite-level visible-window signal summaries for recommendation distribution, failure/regression recurrence, and evidence-pack outcome mix

Implementation rules:

- use `recommendation.created_at` as the v1 authoritative finalization ordering timestamp
- keep all helpers pure and reusable
- do not parse free-text summaries to determine the top-level classification
- treat unknown or unavailable comparison pairs as honest degradation, not synthetic `flat`
- compute signal summaries only from the actively visible filtered history entries, never from hidden older entries outside the current window/filter selection

- [ ] **Step 4: Re-run the read-model tests and confirm they pass**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/evaluation-workbench-operations.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the read-helper slice**

Run:

```bash
git add apps/web/src/features/evaluation-workbench/evaluation-workbench-operations.ts apps/web/test/evaluation-workbench-operations.spec.ts
git commit -m "feat: add evaluation workbench operations summary helpers"
```

### Task 2: Extend The Controller With A Bounded Suite Operations Overview

**Files:**
- Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench-controller.ts`
- Modify: `apps/web/src/features/verification-ops/types.ts`
- Modify: `apps/web/src/features/verification-ops/verification-ops-api.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-api.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-service.ts`
- Modify: `apps/web/test/evaluation-workbench-controller.spec.ts`

- [ ] **Step 1: Write the failing controller tests**

Extend `apps/web/test/evaluation-workbench-controller.spec.ts` so `loadOverview()` proves:

- the default history window is the latest 10 finalized results
- the default comparison pair is latest finalized run versus previous finalized run
- the controller returns a suite-operations summary derived from finalized history
- the controller returns stable detail data for the default comparison pair even when `selectedRunId` is changed for manual inspection
- manuscript context continues to work without overriding the suite-first default
- honest degradation is surfaced when fewer than two finalized runs exist

Add expectations similar to:

```ts
assert.equal(overview.suiteOperations.visible_history.length, 10);
assert.equal(overview.suiteOperations.default_window, "latest_10");
assert.equal(overview.suiteOperations.delta.classification, "worse");
assert.equal(overview.suiteOperations.default_comparison?.selected.run.id, "run-10");
assert.equal(overview.suiteOperations.default_comparison?.baseline.run.id, "run-9");
assert.equal(overview.suiteOperations.default_comparison_detail?.selectedEvidence[0]?.id, "evidence-run-10");
assert.equal(overview.suiteOperations.default_comparison_detail?.baselineEvidence[0]?.id, "evidence-run-9");
```

- [ ] **Step 2: Run the controller test and confirm it fails**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/evaluation-workbench-controller.spec.ts
```

Expected: FAIL because the controller does not yet expose a suite-operations summary or a bounded visible history window.

- [ ] **Step 3: Implement controller-level suite operations shaping**

Update `apps/web/src/features/evaluation-workbench/evaluation-workbench-controller.ts` to:

- import the new helper module
- extend `EvaluationWorkbenchOverview` with a read-only `suiteOperations` block
- allow `loadOverview()` to accept an optional history-window preset
- if the current finalized-results payload cannot provide stable default-comparison detail without extra per-run evidence fetches, make the smallest possible read-side contract expansion so suite finalized results can carry evidence detail for the default comparison path in one bounded response
- derive:
  - visible finalized history
  - default comparison pair
  - stable default-comparison detail data for the latest-versus-previous pair
  - deterministic delta summary
  - visible-window signal summary for recommendation distribution, failure/regression recurrence, and evidence-pack outcome mix
  - honest-degradation metadata

Implementation rules:

- keep the existing `verification-ops` client calls intact
- preserve current manuscript-context matching behavior
- avoid new endpoint fan-out; prefer one bounded finalized-results read with embedded evidence detail over extra per-run evidence calls
- keep selected-run history and previous-run evidence behavior backward compatible where possible
- ensure `suiteOperations` summaries are derived from the actively visible filtered history set rather than hidden finalized results outside the current window/filter
- if the operator selects a different historical run for inspection, continue to load `selectedRunEvidence` for that inspection path while separately exposing the stable latest-versus-previous comparison detail payload through `suiteOperations`
- keep any contract expansion strictly read-side and suite-scoped; do not introduce new write APIs, orchestration, or control-plane semantics

- [ ] **Step 4: Re-run the controller test and confirm it passes**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/evaluation-workbench-controller.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the controller slice**

Run:

```bash
git add apps/web/src/features/evaluation-workbench/evaluation-workbench-controller.ts apps/web/test/evaluation-workbench-controller.spec.ts
git commit -m "feat: derive bounded suite operations overview"
```

### Task 3: Rework The Page Into A Delta-First Operations View

**Files:**
- Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`
- Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench.css`
- Modify: `apps/web/test/evaluation-workbench-page.spec.tsx`

- [ ] **Step 1: Write the failing page tests**

Extend `apps/web/test/evaluation-workbench-page.spec.tsx` to prove the page now:

- renders a first-screen `Delta Summary` block that says `better`, `worse`, or `flat`
- explains why the classification was chosen
- defaults to latest-versus-previous finalized comparison
- renders only the visible history window by default
- exposes read-only history controls with exact v1 options:
  - history window: `Latest 10`, `Last 7 Days`, `Last 30 Days`, `All Suite History`
  - recommendation filter: `All`, `Recommended`, `Needs Review`, `Rejected`
  - sort mode: `Newest First`, `Failures First`
- shows suite-level signal summaries derived from the visible history window
- renders honest degradation copy when there are fewer than two finalized runs
- does not render any new mutation controls and hides the legacy workbench write controls:
  - `Activate`
  - `Run Launch`
  - `Complete And Finalize Run`
  - `Finalize Recommendation`

Add assertions similar to:

```ts
assert.match(markup, /Delta Summary/);
assert.match(markup, /Worse than previous finalized run/);
assert.match(markup, /Recommendation severity dropped from recommended to needs_review/);
assert.match(markup, /Visible History Window: Latest 10 finalized runs/);
assert.match(markup, /Latest 10/);
assert.match(markup, /Last 7 Days/);
assert.match(markup, /Last 30 Days/);
assert.match(markup, /All Suite History/);
assert.match(markup, /Recommended/);
assert.match(markup, /Needs Review/);
assert.match(markup, /Rejected/);
assert.match(markup, /Newest First/);
assert.match(markup, /Failures First/);
assert.match(markup, /Comparison unavailable until this suite has at least two finalized runs/);
assert.doesNotMatch(markup, /Pin Baseline|Save Preset|Add Note|Activate|Run Launch|Complete And Finalize Run|Finalize Recommendation/);
```

- [ ] **Step 2: Run the page test and confirm it fails**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/evaluation-workbench-page.spec.tsx
```

Expected: FAIL because the page still foregrounds the older comparison/history layout and does not yet expose the bounded delta-first operations summary.

- [ ] **Step 3: Implement the delta-first page structure**

Update `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx` to:

- consume `overview.suiteOperations`
- add a new top-level summary card/section for:
  - top-level classification
  - reason
  - next operator cue
- keep the existing finalized comparison card, but reposition it as the second layer beneath the delta summary and bind it to the stable `overview.suiteOperations` latest-versus-previous comparison payload
- keep current history controls, then add the new history-window control
- render suite signal summaries from the visible history window
- render honest degradation when the comparison pair is unavailable

Implementation rules:

- keep the page read-only
- do not add new control-plane buttons or mutation forms
- remove or hide the existing legacy write controls from the Phase 10C workbench surface (`Activate`, `Run Launch`, `Complete And Finalize Run`, `Finalize Recommendation`)
- prefer extracting only the new delta-summary presentation as a focused local component if that keeps the file understandable
- do not perform broad unrelated refactors of the existing page
- when the operator selects a different finalized run for inspection, keep the default latest-versus-previous comparison pair stable unless a future explicit compare-mode is introduced
- keep selected-run inspection details available as a separate read-only lane driven by `selectedRunId`; do not let that inspection state replace the stable default comparison card
- keep the historical list cue that marks which entries belong to the default comparison pair so the delta-first rewrite does not regress operator orientation

- [ ] **Step 4: Update the workbench CSS**

Modify `apps/web/src/features/evaluation-workbench/evaluation-workbench.css` to support:

- a stronger delta-summary treatment
- clear hierarchy between:
  - delta summary
  - run comparison
  - visible history
  - signal summary
- responsive layout that still works on desktop and mobile

Do not redesign the whole workbench visual language; extend the current visual family.

- [ ] **Step 5: Re-run the page test and confirm it passes**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/evaluation-workbench-page.spec.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the page slice**

Run:

```bash
git add apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx apps/web/src/features/evaluation-workbench/evaluation-workbench.css apps/web/test/evaluation-workbench-page.spec.tsx
git commit -m "feat: add delta-first evaluation operations view"
```

### Task 4: Prove The Real Browser Flow And Refresh Docs

**Files:**
- Modify: `apps/web/playwright/evaluation-workbench.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Add the failing Playwright assertions**

Extend `apps/web/playwright/evaluation-workbench.spec.ts` to prove an operator can:

- open a suite with at least two finalized runs
- see the default latest-versus-previous delta summary
- confirm the visible history window defaults to `Latest 10`
- switch the visible history window control between:
  - `Latest 10`
  - `Last 7 Days`
  - `Last 30 Days`
  - `All Suite History`
- switch the recommendation filter control between:
  - `All`
  - `Recommended`
  - `Needs Review`
  - `Rejected`
- switch the sort mode control between:
  - `Newest First`
  - `Failures First`
- inspect the existing finalized comparison details
- see suite-level signal summaries for recommendation distribution, failure/regression recurrence, and evidence-pack outcome mix
- confirm no new write controls were introduced and the legacy workbench write controls are absent:
  - `Activate`
  - `Run Launch`
  - `Complete And Finalize Run`
  - `Finalize Recommendation`
- confirm the visible history list still identifies the active default comparison pair

Browser-visible assertions should include text similar to:

- `Delta Summary`
- `Better than previous finalized run` or `Worse than previous finalized run`
- `Visible History Window`
- `Latest 10`
- `Last 7 Days`
- `Last 30 Days`
- `All Suite History`
- `Recommended`
- `Needs Review`
- `Rejected`
- `Newest First`
- `Failures First`
- `Signal Summary`

- [ ] **Step 2: Run the focused Playwright spec and confirm it fails**

Run:

```bash
pnpm --filter @medsys/web exec playwright test -c playwright.config.ts playwright/evaluation-workbench.spec.ts
```

Expected: FAIL until the new delta-first operations view is wired end to end.

- [ ] **Step 3: Update README**

Modify `README.md` so it explains that `Evaluation Workbench` now provides:

- suite-first operations reading
- default latest-versus-previous finalized comparison
- bounded visible history
- read-only signal summaries

Also document what it still does **not** do in Phase 10C:

- no new governance write actions
- no release orchestration
- no cross-system operations dashboard

- [ ] **Step 4: Re-run browser verification and the release gate**

Run:

```bash
pnpm --filter @medsys/web exec playwright test -c playwright.config.ts playwright/evaluation-workbench.spec.ts
pnpm --filter @medsys/web run typecheck
pnpm verify:manuscript-workbench
```

Expected:

- Playwright PASS
- web typecheck PASS
- manuscript workbench verification PASS, or explicitly surface unrelated pre-existing failures

- [ ] **Step 5: Commit the browser/docs slice**

Run:

```bash
git add apps/web/playwright/evaluation-workbench.spec.ts README.md
git commit -m "docs: describe evaluation workbench operations depth"
```

## Final Verification Gate

- [ ] Run: `pnpm --filter @medsys/web exec node --import tsx --test test/evaluation-workbench-operations.spec.ts test/evaluation-workbench-controller.spec.ts test/evaluation-workbench-page.spec.tsx`
- [ ] Run: `pnpm --filter @medsys/web exec playwright test -c playwright.config.ts playwright/evaluation-workbench.spec.ts`
- [ ] Run: `pnpm --filter @medsys/web run typecheck`
- [ ] Run: `pnpm verify:manuscript-workbench`

## Acceptance Criteria

- `Evaluation Workbench` defaults to latest-versus-previous finalized comparison for the selected suite.
- The top-level `better / worse / flat` label follows the approved deterministic rule and never depends on hidden heuristics.
- Visible history defaults to the latest 10 finalized results ordered by `recommendation.created_at`.
- Operators can inspect read-only window/filter/sort variations without introducing any new write controls.
- Suite-level signal summaries are computed from the visible history window only.
- Suites with fewer than two finalized runs render honest degradation instead of synthetic comparison.
- Existing sample-backed and governed-source detail flows remain intact.
- Playwright, typecheck, and `pnpm verify:manuscript-workbench` all pass.
