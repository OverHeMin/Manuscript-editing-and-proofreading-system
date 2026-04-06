# Phase 27 Manuscript Mainline Timeline And Attempt Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one additive manuscript `mainline_attempt_ledger` read model and adopt it inside the current manuscript workbench so operators can explain how recent mainline attempts led to the current readiness posture without creating a new control surface.

**Architecture:** Extend the existing manuscript read-model enrichment path with one bounded ledger derived from current manuscript jobs, execution snapshots, and linked agent-execution evidence. Then adopt that ledger inside the existing workbench overview and load/refresh result details. Keep all behavior read-only, bounded, fail-open, and backward-compatible by preserving current workbench behavior when the ledger is missing or unavailable.

**Tech Stack:** TypeScript, Node test runner, React server rendering tests, existing manuscript API/view-model pipeline

---

### Task 1: Add the failing manuscript attempt-ledger API tests

**Files:**
- Modify: `apps/api/test/manuscripts/manuscript-lifecycle.spec.ts`
- Modify: `apps/api/test/http/workbench-http.spec.ts`
- Modify: `apps/api/test/http/persistent-workbench-http.spec.ts`

- [ ] **Step 1: Write the failing manuscript API unit test**

Add a test that creates a manuscript with multiple mainline jobs, including:

- one older `screening` attempt
- one latest `editing` attempt with linked snapshot and retryable follow-up
- one `proofreading` not-started module

Assert that `getManuscript(...)` returns:

- `mainline_attempt_ledger.observation_status === "reported"`
- `mainline_attempt_ledger.total_attempts` equals the number of created mainline jobs
- newest-first ledger ordering
- one visible item with linked `orchestration_status` and
  `orchestration_attempt_count`
- `is_latest_for_module === true` on the newest job for its module

- [ ] **Step 2: Run the focused API test to verify RED**

Run: `node --import tsx --test ./test/manuscripts/manuscript-lifecycle.spec.ts`
Expected: FAIL because `mainline_attempt_ledger` is missing.

- [ ] **Step 3: Add HTTP contract assertions**

Extend the existing workbench HTTP tests so the manuscript payload includes
`mainline_attempt_ledger` in both demo and persistent workbench flows.

- [ ] **Step 4: Run the focused HTTP tests to verify RED**

Run: `node --import tsx --test ./test/http/workbench-http.spec.ts ./test/http/persistent-workbench-http.spec.ts`
Expected: FAIL because the manuscript HTTP payload does not yet include the new field.

### Task 2: Implement the additive manuscript attempt ledger

**Files:**
- Modify: `apps/api/src/modules/manuscripts/manuscript-mainline-settlement.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-record.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-api.ts`

- [ ] **Step 1: Add the attempt-ledger record types**

Introduce compact record types for:

- ledger observation status
- bounded ledger summary metadata
- ledger item evidence status
- per-item settlement / orchestration / recovery / runtime posture fields

- [ ] **Step 2: Implement the ledger derivation helper**

Derive the ledger from the already loaded manuscript jobs and snapshots:

- filter to `screening/editing/proofreading`
- sort newest-first by `updated_at`, then `id`
- cap the visible ledger to a bounded count
- enrich each item from snapshot-linked evidence when available
- degrade individual items to job-only wording when snapshot evidence is absent
- fail open at the ledger level if assembly itself fails unexpectedly

- [ ] **Step 3: Wire the ledger into the manuscript view**

Add `mainline_attempt_ledger` to `ManuscriptViewRecord` and populate it inside
`enrichManuscriptView(...)` without changing any route surface.

- [ ] **Step 4: Run the focused API and HTTP tests to verify GREEN**

Run: `node --import tsx --test ./test/manuscripts/manuscript-lifecycle.spec.ts`
Expected: PASS

Run: `node --import tsx --test ./test/http/workbench-http.spec.ts ./test/http/persistent-workbench-http.spec.ts`
Expected: PASS

### Task 3: Add the failing workbench attempt-ledger adoption tests

**Files:**
- Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`

- [ ] **Step 1: Write the failing workbench render tests**

Add tests that prove:

- `Manuscript Overview` renders `Mainline Attempts`
- `Recent Mainline Activity` renders bounded ledger items inside the existing
  overview card
- load-time workspace hydration appends ledger details when the manuscript
  ledger is present
- refresh-time action results append ledger details when the manuscript ledger
  is present

- [ ] **Step 2: Run the focused web test to verify RED**

Run: `node --import tsx --test ./test/manuscript-workbench-page.spec.tsx`
Expected: FAIL because the attempt ledger is not yet rendered or adopted.

### Task 4: Implement the workbench adoption with fallback safety

**Files:**
- Modify: `apps/web/src/features/manuscripts/types.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench.css`

- [ ] **Step 1: Extend the web manuscript types**

Add the new attempt-ledger view model to the manuscript types file.

- [ ] **Step 2: Add summary-local ledger helpers**

Implement helpers that:

- format bounded ledger summary details for load/refresh results
- format compact attempt-row headings and explanations
- keep failed-open ledger states from breaking the existing workbench summary

- [ ] **Step 3: Adopt the ledger in the existing workbench**

Update:

- `Manuscript Overview` metrics
- the current overview card body with a compact `Recent Mainline Activity` list
- load/refresh action-result detail builders

Keep the current behavior unchanged whenever the ledger is missing or
`failed_open`.

- [ ] **Step 4: Run the focused web test to verify GREEN**

Run: `node --import tsx --test ./test/manuscript-workbench-page.spec.tsx`
Expected: PASS

### Task 5: Reconcile docs and verify the full bounded phase

**Files:**
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`
- Modify: `docs/superpowers/specs/2026-04-06-phase27-manuscript-mainline-timeline-and-attempt-ledger-design.md`
- Modify: `docs/superpowers/plans/2026-04-06-phase27-manuscript-mainline-timeline-and-attempt-ledger.md`

- [ ] **Step 1: Update the boundary and capability docs**

Add `Phase 27` as the next execution/orchestration continuation and record its
scope as bounded mainline attempt-ledger visibility on the existing
manuscript/workbench path.

- [ ] **Step 2: Run serial verification**

Run:

```bash
pnpm --filter @medical/api test
pnpm --filter @medsys/web test
pnpm --filter @medsys/web typecheck
pnpm --filter @medical/api typecheck
```

Expected: all commands exit `0`.

- [ ] **Step 3: Review the diff against the phase boundary**

Confirm the diff does not add:

- new routes
- new panels
- new control-plane actions
- new cloud dependency

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-06-phase27-manuscript-mainline-timeline-and-attempt-ledger-design.md docs/superpowers/plans/2026-04-06-phase27-manuscript-mainline-timeline-and-attempt-ledger.md docs/superpowers/plans/2026-04-03-phase-boundary-index.md docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md apps/api/src/modules/manuscripts/manuscript-mainline-settlement.ts apps/api/src/modules/manuscripts/manuscript-record.ts apps/api/src/modules/manuscripts/manuscript-api.ts apps/api/test/manuscripts/manuscript-lifecycle.spec.ts apps/api/test/http/workbench-http.spec.ts apps/api/test/http/persistent-workbench-http.spec.ts apps/web/src/features/manuscripts/types.ts apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench.css apps/web/test/manuscript-workbench-page.spec.tsx
git commit -m "feat: add manuscript mainline attempt ledger"
```
