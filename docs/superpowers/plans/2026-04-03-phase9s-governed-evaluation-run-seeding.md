# Phase 9S Governed Evaluation Run Seeding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-seed governed `verification-ops` evaluation runs from completed screening, editing, and proofreading-final module executions, then let `Evaluation Workbench` find and inspect those runs by manuscript even when no sample-set context exists.

**Architecture:** Add an optional `governed_source` payload to `EvaluationRun`, keep seeded runs additive and sample-set-free, and wire run creation directly into existing module-service completion paths after asset and snapshot persistence. `Evaluation Workbench` should match manuscript context through either reviewed sample sets or `governed_source.manuscript_id`, and it should render a governed-source detail mode when sample context is absent.

**Tech Stack:** TypeScript, PostgreSQL/raw SQL migrations, node:test via `tsx`, existing in-memory + PostgreSQL repositories, React/Vite, Playwright, manuscript workbench release gate.

---

## Scope Notes

- Do not auto-run checks, auto-score runs, auto-finalize runs, or auto-create learning candidates in this slice.
- Do not synthesize evaluation sample sets or sample items from live module outputs.
- Do not seed proofreading draft runs; only seed screening, editing, and proofreading final-confirmation outputs.
- Prefer additive record fields and nullable database columns so older runs stay valid.
- Keep the public `verification-ops` HTTP surface stable unless a new field or existing response shape must expand.

## File Map

- Persistence and domain:
  - Create: `apps/api/src/database/migrations/0013_governed_evaluation_run_seeding.sql`
  - Modify: `apps/api/src/modules/verification-ops/verification-ops-record.ts`
  - Modify: `apps/api/src/modules/verification-ops/verification-ops-repository.ts`
  - Modify: `apps/api/src/modules/verification-ops/in-memory-verification-ops-repository.ts`
  - Modify: `apps/api/src/modules/verification-ops/postgres-verification-ops-repository.ts`
  - Modify: `apps/api/src/modules/verification-ops/verification-ops-service.ts`
  - Test: `apps/api/test/verification-ops/postgres-verification-ops-persistence.spec.ts`
- Module-service seeding:
  - Modify: `apps/api/src/modules/shared/module-run-support.ts`
  - Modify: `apps/api/src/modules/screening/screening-service.ts`
  - Modify: `apps/api/src/modules/editing/editing-service.ts`
  - Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
  - Modify: `apps/api/src/http/api-http-server.ts`
  - Modify: `apps/api/src/http/persistent-governance-runtime.ts`
  - Modify: `apps/api/test/modules/module-orchestration.spec.ts`
  - Modify: `apps/api/test/http/support/workbench-runtime.ts`
  - Modify: `apps/api/test/http/workbench-http.spec.ts`
  - Modify: `apps/api/test/http/persistent-workbench-http.spec.ts`
- Workbench contract and UI:
  - Modify: `apps/web/src/features/verification-ops/types.ts`
  - Modify: `apps/web/src/features/verification-ops/verification-ops-api.ts`
  - Modify: `apps/web/src/features/verification-ops/index.ts`
  - Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench-controller.ts`
  - Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`
  - Test: `apps/web/test/evaluation-workbench-controller.spec.ts`
  - Test: `apps/web/test/evaluation-workbench-page.spec.tsx`
- Browser and docs:
  - Modify: `apps/web/playwright/evaluation-workbench.spec.ts`
  - Modify: `README.md`

## Planned Tasks

### Task 1: Add `governed_source` To Evaluation Run Persistence

**Files:**
- Create: `apps/api/src/database/migrations/0013_governed_evaluation_run_seeding.sql`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-record.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-repository.ts`
- Modify: `apps/api/src/modules/verification-ops/in-memory-verification-ops-repository.ts`
- Modify: `apps/api/src/modules/verification-ops/postgres-verification-ops-repository.ts`
- Test: `apps/api/test/verification-ops/postgres-verification-ops-persistence.spec.ts`

- [ ] **Step 1: Write the failing persistence test**

Create `apps/api/test/verification-ops/postgres-verification-ops-persistence.spec.ts` with assertions like:

```ts
assert.deepEqual(loaded?.governed_source, {
  source_kind: "governed_module_execution",
  manuscript_id: "manuscript-1",
  source_module: "editing",
  agent_execution_log_id: "execution-log-1",
  execution_snapshot_id: "snapshot-1",
  output_asset_id: "asset-1",
});
```

Also round-trip a run with no `governed_source` and confirm it still loads cleanly.

- [ ] **Step 2: Run the new persistence test and confirm it fails**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/verification-ops/postgres-verification-ops-persistence.spec.ts
```

Expected: FAIL because `EvaluationRunRecord` and `evaluation_runs` persistence do not yet carry `governed_source`.

- [ ] **Step 3: Implement the additive run-contract changes**

Implementation rules:

- add a reusable `GovernedExecutionEvaluationSourceRecord` type in `verification-ops-record.ts`
- extend `EvaluationRunRecord` with `governed_source?: ...`
- add a nullable `governed_source jsonb` column in migration `0013`
- persist and decode `governed_source` in both in-memory and PostgreSQL repositories
- keep all existing run fields and listing behavior unchanged

- [ ] **Step 4: Re-run the persistence test and confirm it passes**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/verification-ops/postgres-verification-ops-persistence.spec.ts
```

Expected: PASS.

### Task 2: Add A Verification-Ops Service Helper For Governed Run Seeding

**Files:**
- Modify: `apps/api/src/modules/verification-ops/verification-ops-service.ts`
- Test: `apps/api/test/verification-ops/verification-ops.spec.ts`

- [ ] **Step 1: Add failing service tests for seeded governed runs**

Extend `apps/api/test/verification-ops/verification-ops.spec.ts` to prove a helper can:

- create one queued run per suite ID
- copy `release_check_profile_id`
- persist `governed_source`
- create no run items
- leave `sample_set_id` undefined
- keep `run_item_count` at `0`

Also add a zero-suite case that returns an empty list.

- [ ] **Step 2: Run the targeted verification-ops tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/verification-ops/verification-ops.spec.ts
```

Expected: FAIL because there is no governed-run seeding helper yet.

- [ ] **Step 3: Implement `seedGovernedExecutionRuns(...)`**

Implementation rules:

- add a service method roughly shaped like:

```ts
seedGovernedExecutionRuns(actorRole, {
  suiteIds,
  releaseCheckProfileId,
  governedSource,
})
```

- validate suites are still `active`
- validate the release profile is still `published` when present
- create one queued run per suite
- set `governed_source`
- return the created run records in deterministic order

- [ ] **Step 4: Re-run the targeted verification-ops tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/verification-ops/verification-ops.spec.ts
```

Expected: PASS.

### Task 3: Seed Runs From Real Module Completion Paths

**Files:**
- Modify: `apps/api/src/modules/shared/module-run-support.ts`
- Modify: `apps/api/src/modules/screening/screening-service.ts`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Modify: `apps/api/test/modules/module-orchestration.spec.ts`
- Modify: `apps/api/test/http/support/workbench-runtime.ts`
- Modify: `apps/api/test/http/workbench-http.spec.ts`
- Modify: `apps/api/test/http/persistent-workbench-http.spec.ts`

- [ ] **Step 1: Write the failing orchestration tests**

Extend `apps/api/test/modules/module-orchestration.spec.ts` to assert:

- screening creates one seeded run for `suite-screening-1`
- editing creates one seeded run for `suite-editing-1`
- proofreading draft creates no seeded run
- proofreading final confirmation creates one seeded run for `suite-proofreading-1`
- each seeded run contains:

```ts
governed_source: {
  source_kind: "governed_module_execution",
  manuscript_id: "manuscript-1",
  source_module: "screening" | "editing" | "proofreading",
  agent_execution_log_id: "...",
  execution_snapshot_id: "...",
  output_asset_id: "...",
}
```

- [ ] **Step 2: Write the failing HTTP tests**

Update:

- `apps/api/test/http/workbench-http.spec.ts`
- `apps/api/test/http/persistent-workbench-http.spec.ts`

to prove module HTTP routes create seeded evaluation runs that remain readable after restart.

- [ ] **Step 3: Run the targeted API tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/modules/module-orchestration.spec.ts test/http/workbench-http.spec.ts test/http/persistent-workbench-http.spec.ts
```

Expected: FAIL because module services are not yet seeding runs or wiring `verificationOpsService`.

- [ ] **Step 4: Inject `verificationOpsService` into module services and runtime builders**

Implementation rules:

- add `verificationOpsService` to `ScreeningServiceOptions`, `EditingServiceOptions`, and `ProofreadingServiceOptions`
- wire it in:
  - `apps/api/src/http/api-http-server.ts`
  - `apps/api/src/http/persistent-governance-runtime.ts`
  - `apps/api/test/http/support/workbench-runtime.ts`
  - `apps/api/test/modules/module-orchestration.spec.ts` harness

- [ ] **Step 5: Implement the seeding calls in module services**

Implementation rules:

- screening and editing: seed after output asset + execution snapshot + log completion
- proofreading:
  - do not seed in `createDraft()`
  - do seed in `confirmFinal()`
- use the module output asset ID and snapshot ID, not the parent asset ID
- point proofreading final-confirmation seeds at the reused draft execution log ID
- do not invent sample-set IDs or run items

- [ ] **Step 6: Re-run the targeted API tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/modules/module-orchestration.spec.ts test/http/workbench-http.spec.ts test/http/persistent-workbench-http.spec.ts
```

Expected: PASS.

### Task 4: Teach Evaluation Workbench To Match And Render Governed-Source Runs

**Files:**
- Modify: `apps/web/src/features/verification-ops/types.ts`
- Modify: `apps/web/src/features/verification-ops/verification-ops-api.ts`
- Modify: `apps/web/src/features/verification-ops/index.ts`
- Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench-controller.ts`
- Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`
- Test: `apps/web/test/evaluation-workbench-controller.spec.ts`
- Test: `apps/web/test/evaluation-workbench-page.spec.tsx`

- [ ] **Step 1: Add failing controller tests for manuscript matching through `governed_source`**

Update `apps/web/test/evaluation-workbench-controller.spec.ts` to prove:

- a run with no `sample_set_id` still matches manuscript-prefilled overview when:

```ts
run.governed_source?.manuscript_id === "manuscript-target-1"
```

- `matchedSuiteId`, `matchedRunId`, and `matchedHistoryRunIds` include governed-source-only runs.

- [ ] **Step 2: Add failing page tests for governed-source detail rendering**

Update `apps/web/test/evaluation-workbench-page.spec.tsx` to prove:

- a selected run with no linked sample item renders:
  - source module
  - manuscript ID
  - execution snapshot ID
  - agent execution log ID
  - output asset download link
- the UI explains learning handoff is unavailable without reviewed snapshot context

- [ ] **Step 3: Run the targeted web tests and confirm they fail**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/evaluation-workbench-controller.spec.ts test/evaluation-workbench-page.spec.tsx
```

Expected: FAIL because the controller only matches through sample sets and the page does not yet render governed-source detail mode.

- [ ] **Step 4: Implement the workbench contract and matching updates**

Implementation rules:

- extend `EvaluationRunViewModel` with `governed_source`
- keep existing response parsing additive
- in `resolveEvaluationManuscriptContext()`, treat `governed_source.manuscript_id` as a valid manuscript match
- do not break existing sample-set-backed history behavior

- [ ] **Step 5: Implement governed-source UI mode**

Implementation rules:

- keep the existing selected-run detail card, but branch the content:
  - sample-backed mode
  - governed-source mode
- governed-source mode should show:
  - source module
  - manuscript ID
  - execution snapshot ID
  - agent execution log ID
  - output asset download link
- where no sample context exists, degrade actions to manuscript-only navigation or explanatory copy rather than fake sample links

- [ ] **Step 6: Re-run the targeted web tests and confirm they pass**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/evaluation-workbench-controller.spec.ts test/evaluation-workbench-page.spec.tsx
```

Expected: PASS.

### Task 5: Prove The Seeded Operator Flow In Playwright And Refresh Docs

**Files:**
- Modify: `apps/web/playwright/evaluation-workbench.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Add a failing Playwright scenario for seeded governed runs**

Extend `apps/web/playwright/evaluation-workbench.spec.ts` to prove:

- a real governed module execution creates a seeded run
- opening `Evaluation Workbench` with manuscript context selects that seeded run
- the run is visible in manuscript-scoped history even without sample-set context
- governed-source details and output-asset download link are visible

- [ ] **Step 2: Run the targeted Playwright spec and confirm it fails**

Run:

```bash
pnpm --filter @medsys/web playwright test playwright/evaluation-workbench.spec.ts --grep "seeded|governed"
```

Expected: FAIL because seeded runs do not yet exist in the browser flow.

- [ ] **Step 3: Update README**

Document that:

- runtime-binding evaluation expectations now auto-seed governed evaluation runs
- Evaluation Workbench can reopen those runs by manuscript without requiring sample-set origin
- this still does not auto-run checks or auto-finalize results

- [ ] **Step 4: Re-run the browser spec and the release gate**

Run:

```bash
pnpm --filter @medsys/web playwright test playwright/evaluation-workbench.spec.ts
pnpm verify:manuscript-workbench
```

Expected: PASS, or explicitly surface unrelated pre-existing failures.

- [ ] **Step 5: Stage the finished slice**

Run:

```bash
git add apps/api/src/database/migrations/0013_governed_evaluation_run_seeding.sql apps/api/src/modules/verification-ops apps/api/src/modules/shared/module-run-support.ts apps/api/src/modules/screening/screening-service.ts apps/api/src/modules/editing/editing-service.ts apps/api/src/modules/proofreading/proofreading-service.ts apps/api/src/http/api-http-server.ts apps/api/src/http/persistent-governance-runtime.ts apps/api/test/verification-ops/postgres-verification-ops-persistence.spec.ts apps/api/test/verification-ops/verification-ops.spec.ts apps/api/test/modules/module-orchestration.spec.ts apps/api/test/http/support/workbench-runtime.ts apps/api/test/http/workbench-http.spec.ts apps/api/test/http/persistent-workbench-http.spec.ts apps/web/src/features/verification-ops apps/web/src/features/evaluation-workbench apps/web/test/evaluation-workbench-controller.spec.ts apps/web/test/evaluation-workbench-page.spec.tsx apps/web/playwright/evaluation-workbench.spec.ts README.md docs/superpowers/specs/2026-04-03-phase9s-governed-evaluation-run-seeding-design.md docs/superpowers/plans/2026-04-03-phase9s-governed-evaluation-run-seeding.md
```

Expected: staged diff ready for final review and implementation execution.
