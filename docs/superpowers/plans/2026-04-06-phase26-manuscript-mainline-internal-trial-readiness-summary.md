# Phase 26 Manuscript Mainline Internal Trial Readiness Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one additive manuscript `mainline_readiness_summary` read model and adopt it in the current manuscript workbench so the mainline execution/orchestration posture is readable as one bounded readiness signal without creating a new control surface.

**Architecture:** Extend the existing manuscript mainline settlement derivation with one compact readiness summary built from current module-overview evidence, then adopt that summary inside the current workbench summary cards and load-result details. Keep all behavior read-only, fail-open, and backward-compatible by preserving current frontend heuristics as the fallback path.

**Tech Stack:** TypeScript, Node test runner, React server rendering tests, existing manuscript API/view-model pipeline

---

### Task 1: Add the failing manuscript readiness-summary API tests

**Files:**
- Modify: `apps/api/test/manuscripts/manuscript-lifecycle.spec.ts`
- Modify: `apps/api/test/http/workbench-http.spec.ts`
- Modify: `apps/api/test/http/persistent-workbench-http.spec.ts`

- [ ] **Step 1: Write the failing manuscript API unit test**

Add a test that creates:

- a manuscript with a settled `screening` module
- an unsettled `editing` module with linked recovery posture

Assert that `getManuscript(...)` returns:

- `mainline_readiness_summary.observation_status === "reported"`
- `mainline_readiness_summary.derived_status === "attention_required"` or
  `waiting_for_follow_up` depending on fixture posture
- the correct `active_module` / `next_module`
- the correct `recovery_ready_at` when applicable

- [ ] **Step 2: Run the focused API test to verify RED**

Run: `node --import tsx --test ./test/manuscripts/manuscript-lifecycle.spec.ts`
Expected: FAIL because `mainline_readiness_summary` is missing.

- [ ] **Step 3: Add one HTTP contract assertion**

Extend the existing workbench HTTP tests so the manuscript payload includes
`mainline_readiness_summary` in both demo and persistent workbench flows.

- [ ] **Step 4: Run the focused HTTP tests to verify RED**

Run: `node --import tsx --test ./test/http/workbench-http.spec.ts ./test/http/persistent-workbench-http.spec.ts`
Expected: FAIL because the manuscript HTTP payload does not yet include the new field.

### Task 2: Implement the additive manuscript readiness summary

**Files:**
- Modify: `apps/api/src/modules/manuscripts/manuscript-mainline-settlement.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-record.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-api.ts`

- [ ] **Step 1: Add the readiness-summary record types**

Introduce compact record types for:

- readiness observation status
- derived readiness status
- optional active/next module
- optional `recovery_ready_at`
- compact runtime readiness status and issue count

- [ ] **Step 2: Implement the readiness-summary derivation helper**

Derive the summary from `module_execution_overview` in mainline order:

- `not_started` => `ready_for_next_step`
- `job_in_progress` => `in_progress`
- follow-up pending/running => `waiting_for_follow_up`
- retryable/failed/unlinked/job_failed => `attention_required`
- all settled => `completed`

Use existing recovery timing and runtime-readiness evidence from the blocking
module when it is already available.

- [ ] **Step 3: Wire the summary into the manuscript view**

Add `mainline_readiness_summary` to `ManuscriptViewRecord` and populate it in
`enrichManuscriptView(...)`.

- [ ] **Step 4: Run the focused API and HTTP tests to verify GREEN**

Run: `node --import tsx --test ./test/manuscripts/manuscript-lifecycle.spec.ts`
Expected: PASS

Run: `node --import tsx --test ./test/http/workbench-http.spec.ts ./test/http/persistent-workbench-http.spec.ts`
Expected: PASS

### Task 3: Add the failing workbench readiness-summary adoption tests

**Files:**
- Modify: `apps/web/test/manuscript-workbench-page.spec.tsx`

- [ ] **Step 1: Write the failing workbench render tests**

Add tests that prove:

- `Manuscript Overview` renders `Mainline Readiness`
- the readiness reason and module details render from the new summary
- `Recommended Next Step` prefers the summary when it cleanly maps to the mainline path
- `loadPrefilledWorkbenchWorkspace(...)` appends readiness details when the manuscript summary is present

- [ ] **Step 2: Run the focused web test to verify RED**

Run: `node --import tsx --test ./test/manuscript-workbench-page.spec.tsx`
Expected: FAIL because the new summary is not yet rendered or adopted.

### Task 4: Implement the workbench adoption with fallback safety

**Files:**
- Modify: `apps/web/src/features/manuscripts/types.ts`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`
- Modify: `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`

- [ ] **Step 1: Extend the web manuscript types**

Add the new readiness-summary view model to the manuscript types file.

- [ ] **Step 2: Add summary-local readiness helpers**

Implement helpers that:

- format the compact readiness label
- build readiness details for action/load results
- resolve pill tone for `Mainline Readiness`
- map summary-driven recommendation wording when safe

- [ ] **Step 3: Adopt the summary in the existing workbench**

Update:

- `Manuscript Overview` metrics
- `Recommended Next Step`
- load/refresh action-result detail builders

Keep the current heuristic logic as the fail-open fallback whenever the summary
is missing or `failed_open`.

- [ ] **Step 4: Run the focused web test to verify GREEN**

Run: `node --import tsx --test ./test/manuscript-workbench-page.spec.tsx`
Expected: PASS

### Task 5: Reconcile docs and verify the full bounded phase

**Files:**
- Modify: `docs/superpowers/plans/2026-04-03-phase-boundary-index.md`
- Modify: `docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md`
- Modify: `docs/superpowers/specs/2026-04-06-phase26-manuscript-mainline-internal-trial-readiness-summary-design.md`
- Modify: `docs/superpowers/plans/2026-04-06-phase26-manuscript-mainline-internal-trial-readiness-summary.md`

- [ ] **Step 1: Update the boundary and capability docs**

Add `Phase 26` as the next execution/orchestration continuation and record its
scope as readiness-summary adoption on the existing manuscript/workbench path.

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
git add docs/superpowers/specs/2026-04-06-phase26-manuscript-mainline-internal-trial-readiness-summary-design.md docs/superpowers/plans/2026-04-06-phase26-manuscript-mainline-internal-trial-readiness-summary.md docs/superpowers/plans/2026-04-03-phase-boundary-index.md docs/superpowers/specs/2026-04-03-retained-capability-phase-mapping.md apps/api/src/modules/manuscripts/manuscript-mainline-settlement.ts apps/api/src/modules/manuscripts/manuscript-record.ts apps/api/src/modules/manuscripts/manuscript-api.ts apps/api/test/manuscripts/manuscript-lifecycle.spec.ts apps/api/test/http/workbench-http.spec.ts apps/api/test/http/persistent-workbench-http.spec.ts apps/web/src/features/manuscripts/types.ts apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx apps/web/test/manuscript-workbench-page.spec.tsx
git commit -m "feat: add manuscript mainline readiness summary"
```
