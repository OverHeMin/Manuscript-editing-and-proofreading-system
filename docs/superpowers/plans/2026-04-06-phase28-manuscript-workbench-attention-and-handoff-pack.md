# Phase 28 Manuscript Workbench Attention And Handoff Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one additive manuscript `mainline_attention_handoff_pack` read model and adopt it inside the current manuscript workbench so operators can see what currently needs attention and whether the next mainline handoff is ready, blocked, or fully settled without opening a new control surface.

**Architecture:** Extend the existing manuscript read-model enrichment path with one bounded attention/handoff pack derived from current per-module overview, mainline readiness summary, and bounded attempt-ledger evidence. Then adopt that pack inside the existing manuscript workbench overview and load/refresh result details. Keep all behavior read-only, bounded, fail-open, and backward-compatible by preserving the current workbench behavior when the pack is missing or unavailable.

**Tech Stack:** TypeScript, Node test runner, React server rendering tests, existing manuscript API/view-model pipeline

---

### Task 1: Add the failing attention/handoff API tests

**Files:**
- Modify: `apps/api/test/manuscripts/manuscript-lifecycle.spec.ts`
- Modify: `apps/api/test/http/workbench-http.spec.ts`
- Modify: `apps/api/test/http/persistent-workbench-http.spec.ts`

- [ ] **Step 1: Write the failing manuscript API unit test**

Add a test that creates a manuscript with:

- one settled earlier `screening` attempt
- one latest `editing` attempt with linked snapshot and retryable follow-up

Assert that `getManuscript(...)` returns:

- `mainline_attention_handoff_pack.observation_status === "reported"`
- `attention_status === "action_required"`
- `handoff_status === "blocked_by_attention"`
- `focus_module === "editing"`
- `to_module === "proofreading"`
- one attention item for retryable follow-up
- one attention item for degraded or missing runtime posture when applicable

- [ ] **Step 2: Run the focused API test to verify RED**

Run: `node --import tsx --test ./test/manuscripts/manuscript-lifecycle.spec.ts`  
Expected: FAIL because `mainline_attention_handoff_pack` is missing.

- [ ] **Step 3: Add HTTP contract assertions**

Extend the existing workbench HTTP tests so the manuscript payload includes
`mainline_attention_handoff_pack` in both demo and persistent workbench flows.

- [ ] **Step 4: Run the focused HTTP tests to verify RED**

Run: `node --import tsx --test ./test/http/workbench-http.spec.ts ./test/http/persistent-workbench-http.spec.ts`  
Expected: FAIL because the manuscript HTTP payload does not yet include the new field.

### Task 2: Implement the additive attention/handoff pack

**Files:**
- Modify: `apps/api/src/modules/manuscripts/manuscript-mainline-settlement.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-record.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-api.ts`

- [ ] **Step 1: Add the attention/handoff record types**

Introduce compact record types for:

- pack observation status
- attention status
- handoff status
- bounded attention items

- [ ] **Step 2: Implement the pack derivation helper**

Derive the pack from the existing manuscript read-model evidence:

- `module_execution_overview`
- `mainline_readiness_summary`
- `mainline_attempt_ledger`

Rules:

- derive top-level attention and handoff posture from current readiness
- reuse focus-module overview and latest attempt evidence
- emit bounded attention items
- fail open at the pack level if derivation fails unexpectedly

- [ ] **Step 3: Wire the pack into the manuscript view**

Add `mainline_attention_handoff_pack` to `ManuscriptViewRecord` and populate it
inside `enrichManuscriptView(...)` without changing any route surface.

- [ ] **Step 4: Run the focused API and HTTP tests to verify GREEN**

Run: `node --import tsx --test ./test/manuscripts/manuscript-lifecycle.spec.ts`  
Expected: PASS

Run: `node --import tsx --test ./test/http/workbench-http.spec.ts ./test/http/persistent-workbench-http.spec.ts`  
Expected: PASS

### Task 3: Add the failing workbench attention/handoff adoption tests

**Files:**
- Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`

- [ ] **Step 1: Write the failing workbench render tests**

Add tests that prove:

- `Manuscript Overview` renders `Attention Status`
- `Next Mainline Handoff` renders inside the existing overview card
- bounded `Attention Items` render inside the same overview card
- load-time workspace hydration appends pack details when the manuscript pack is present
- refresh-time action results append pack details when the manuscript pack is present

- [ ] **Step 2: Run the focused web test to verify RED**

Run: `node --import tsx --test ./test/manuscript-workbench-page.spec.tsx`  
Expected: FAIL because the attention/handoff pack is not yet rendered or adopted.

### Task 4: Implement the workbench adoption with fallback safety

**Files:**
- Modify: `apps/web/src/features/manuscripts/types.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench.css`

- [ ] **Step 1: Extend the web manuscript types**

Add the new attention/handoff view model to the manuscript types file.

- [ ] **Step 2: Add summary-local attention/handoff helpers**

Implement helpers that:

- format bounded pack details for load/refresh results
- format compact handoff phrasing
- format bounded attention item rows
- keep failed-open pack states from breaking the current workbench summary

- [ ] **Step 3: Adopt the pack in the existing workbench**

Update:

- `Manuscript Overview` metrics
- the current overview card body with a compact `Attention Items` list
- load/refresh action-result detail builders

Keep the current behavior unchanged whenever the pack is missing or
`failed_open`.

- [ ] **Step 4: Run the focused web test to verify GREEN**

Run: `node --import tsx --test ./test/manuscript-workbench-page.spec.tsx`  
Expected: PASS

### Task 5: Reconcile docs and verify the full bounded phase

**Files:**
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`
- Modify: `docs/superpowers/specs/2026-04-06-phase28-manuscript-workbench-attention-and-handoff-pack-design.md`
- Modify: `docs/superpowers/plans/2026-04-06-phase28-manuscript-workbench-attention-and-handoff-pack.md`

- [ ] **Step 1: Update the boundary and capability docs**

Add `Phase 28` as the next execution/orchestration continuation and record its
scope as bounded mainline attention and handoff visibility on the existing
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
git add docs/superpowers/specs/2026-04-06-phase28-manuscript-workbench-attention-and-handoff-pack-design.md docs/superpowers/plans/2026-04-06-phase28-manuscript-workbench-attention-and-handoff-pack.md docs/superpowers/plans/2026-04-03-phase-boundary-index.md docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md apps/api/src/modules/manuscripts/manuscript-mainline-settlement.ts apps/api/src/modules/manuscripts/manuscript-record.ts apps/api/src/modules/manuscripts/manuscript-api.ts apps/api/test/manuscripts/manuscript-lifecycle.spec.ts apps/api/test/http/workbench-http.spec.ts apps/api/test/http/persistent-workbench-http.spec.ts apps/web/src/features/manuscripts/types.ts apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench.css apps/web/test/manuscript-workbench-page.spec.tsx
git commit -m "feat: add manuscript attention and handoff pack"
```
