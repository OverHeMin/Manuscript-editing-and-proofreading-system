# Phase 9T Governed Run Check Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the verification checks for Phase 9S seeded governed evaluation runs inline after successful screening, editing, and proofreading-final output, persist machine evidence on the run, and let `Evaluation Workbench` finalize recommendations from that machine-completed state.

**Architecture:** Add a small internal governed-run execution layer inside `verification-ops` that can move a seeded run from `queued` to `running` to `passed` or `failed`, using an injectable per-check executor and the existing `verification_evidence` model. Wire that executor into the Phase 9S module-completion helper, append resulting evidence IDs back onto the originating `AgentExecutionLog`, and update the workbench so already-completed governed runs are finalized differently from legacy manual runs.

**Tech Stack:** TypeScript, existing in-memory + PostgreSQL repositories, node:test via `tsx`, React/Vite, Playwright, manuscript workbench persistent HTTP runtime.

---

## Scope Notes

- Do not add a background worker, retry queue, scheduler, or stuck-run repair flow.
- Do not add new database columns or migrations for Phase 9T.
- Do not auto-create `EvaluationRunItemRecord` entries for governed runs.
- Do not auto-generate evidence packs, recommendations, or learning candidates.
- Reuse the existing `verification_evidence` model and encode machine pass/fail semantics in the evidence label plus final run status.
- Reuse the governed output asset as the minimal `artifactAssetId` for machine evidence until a richer dedicated verification-artifact model exists.
- Keep the legacy manual `Complete And Finalize Run` path available for non-governed or still-queued runs.
- Once a module output asset and execution snapshot are already persisted, a governed check failure should create a failed governed run state, not rewrite the underlying module job into a business-level failure.

## File Map

- Agent execution evidence append support:
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-service.ts`
  - Test: `apps/api/test/agent-execution/agent-execution-log.spec.ts`
- Governed run execution core:
  - Create: `apps/api/src/modules/verification-ops/governed-run-check-execution.ts`
  - Modify: `apps/api/src/modules/verification-ops/verification-ops-service.ts`
  - Modify: `apps/api/src/modules/verification-ops/index.ts`
  - Test: `apps/api/test/verification-ops/governed-run-check-execution.spec.ts`
- Module integration:
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
- Workbench lifecycle and UI:
  - Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench-controller.ts`
  - Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`
  - Test: `apps/web/test/evaluation-workbench-controller.spec.ts`
  - Test: `apps/web/test/evaluation-workbench-page.spec.tsx`
- Browser and docs:
  - Modify: `apps/web/playwright/evaluation-workbench.spec.ts`
  - Modify: `README.md`

## Planned Tasks

### Task 1: Add Agent Execution Evidence Append Support

**Files:**
- Modify: `apps/api/src/modules/agent-execution/agent-execution-service.ts`
- Test: `apps/api/test/agent-execution/agent-execution-log.spec.ts`

- [ ] **Step 1: Write the failing agent-execution test**

Extend `apps/api/test/agent-execution/agent-execution-log.spec.ts` with a case like:

```ts
const log = await service.createLog({
  manuscriptId: "manuscript-1",
  module: "screening",
  triggeredBy: "tester",
  runtimeId: "runtime-1",
  sandboxProfileId: "sandbox-1",
  agentProfileId: "agent-1",
  runtimeBindingId: "binding-1",
  toolPermissionPolicyId: "policy-1",
  knowledgeItemIds: [],
});

await service.completeLog({
  logId: log.id,
  executionSnapshotId: "snapshot-1",
  verificationEvidenceIds: ["evidence-seed-1"],
});

const updated = await service.appendVerificationEvidence({
  logId: log.id,
  evidenceIds: ["evidence-seed-1", "evidence-machine-1", "evidence-machine-2"],
});

assert.deepEqual(updated.verification_evidence_ids, [
  "evidence-seed-1",
  "evidence-machine-1",
  "evidence-machine-2",
]);
assert.equal(updated.status, "completed");
assert.equal(updated.execution_snapshot_id, "snapshot-1");
```

- [ ] **Step 2: Run the targeted agent-execution test and confirm it fails**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/agent-execution/agent-execution-log.spec.ts
```

Expected: FAIL because `appendVerificationEvidence(...)` does not exist yet.

- [ ] **Step 3: Implement the append helper**

Implementation rules:

- add an additive service method shaped like:

```ts
appendVerificationEvidence(input: {
  logId: string;
  evidenceIds: string[];
}): Promise<AgentExecutionLogRecord>
```

- reload the existing log, preserve:
  - `status`
  - `execution_snapshot_id`
  - `finished_at`
  - existing expectation fields
- dedupe evidence IDs while preserving order
- do not reopen the log or convert a completed log back to running

- [ ] **Step 4: Re-run the targeted agent-execution test and confirm it passes**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/agent-execution/agent-execution-log.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/api/src/modules/agent-execution/agent-execution-service.ts apps/api/test/agent-execution/agent-execution-log.spec.ts
git commit -m "feat: allow appending governed evidence to execution logs"
```

### Task 2: Build The Governed Run Check Execution Core

**Files:**
- Create: `apps/api/src/modules/verification-ops/governed-run-check-execution.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-service.ts`
- Modify: `apps/api/src/modules/verification-ops/index.ts`
- Test: `apps/api/test/verification-ops/governed-run-check-execution.spec.ts`

- [ ] **Step 1: Write the failing governed-run execution tests**

Create `apps/api/test/verification-ops/governed-run-check-execution.spec.ts` with focused cases for:

- a queued governed run becomes `passed` after all planned checks succeed
- suite check profile IDs and release-check profile IDs are merged and deduped
- the recorded evidence uses the governed output asset ID as `artifactAssetId`
- a failing check still leaves earlier evidence attached and completes the run as `failed`
- a non-queued run is rejected from execution

Use an injectable fake executor like:

```ts
const executor: GovernedVerificationCheckExecutor = async ({ checkProfile, governedSource }) => ({
  outcome: checkProfile.id === "check-fail" ? "failed" : "passed",
  evidence: {
    kind: "artifact",
    label: `Automatic ${checkProfile.check_type} ${checkProfile.id}`,
    artifactAssetId: governedSource.output_asset_id,
  },
  failureReason:
    checkProfile.id === "check-fail" ? "Synthetic failure for test coverage." : undefined,
});
```

- [ ] **Step 2: Run the targeted verification-ops execution test and confirm it fails**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/verification-ops/governed-run-check-execution.spec.ts
```

Expected: FAIL because there is no governed-run execution module yet.

- [ ] **Step 3: Implement the execution module and service support**

Implementation rules:

- create `governed-run-check-execution.ts` with:
  - an injectable `GovernedVerificationCheckExecutor` interface
  - a default executor that produces minimal machine evidence against `run.governed_source.output_asset_id`
  - a public orchestration function or class method named like `executeSeededGovernedRunChecks(...)`
- add a small run-state helper to `verification-ops-service.ts` so a queued run can be marked `running` before final completion
- resolve the check plan from:
  - `suite.verification_check_profile_ids`
  - plus `releaseProfile.verification_check_profile_ids`
- validate every planned verification check profile is still `published`
- record one `VerificationEvidenceRecord` per executed check using:
  - `kind: "artifact"`
  - `artifactAssetId: governedSource.output_asset_id`
  - `checkProfileId: checkProfile.id`
  - a label that encodes machine execution and outcome, for example:

```ts
`Automatic governed ${checkProfile.check_type} ${outcome} for ${checkProfile.name}`
```

- if every check succeeds:
  - complete the run as `passed`
- if any check fails or throws:
  - preserve already-recorded evidence IDs
  - complete the run as `failed`

- [ ] **Step 4: Re-run the targeted verification-ops execution test and confirm it passes**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/verification-ops/governed-run-check-execution.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/api/src/modules/verification-ops/governed-run-check-execution.ts apps/api/src/modules/verification-ops/verification-ops-service.ts apps/api/src/modules/verification-ops/index.ts apps/api/test/verification-ops/governed-run-check-execution.spec.ts
git commit -m "feat: execute seeded governed verification runs"
```

### Task 3: Wire Seeded-Run Execution Into Module Completion Paths

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

- [ ] **Step 1: Write the failing module and HTTP tests**

Extend `apps/api/test/modules/module-orchestration.spec.ts` to assert:

- screening success seeds a governed run and executes it to `passed`
- editing success seeds a governed run and executes it to `passed`
- proofreading draft still seeds and executes nothing
- proofreading final confirmation seeds a governed run and executes it
- execution-log `verification_evidence_ids` now include the governed machine evidence IDs
- a failing fake governed executor still returns a completed module job with a persisted output asset, while the governed run ends as `failed`

Extend:

- `apps/api/test/http/workbench-http.spec.ts`
- `apps/api/test/http/persistent-workbench-http.spec.ts`

to prove the HTTP runtime exposes:

- governed runs with `passed` or `failed` status after module completion
- recorded evidence IDs and evidence detail for those runs after reload

- [ ] **Step 2: Run the targeted API tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/modules/module-orchestration.spec.ts test/http/workbench-http.spec.ts test/http/persistent-workbench-http.spec.ts
```

Expected: FAIL because module services only seed queued runs today.

- [ ] **Step 3: Implement shared seed-and-execute wiring**

Implementation rules:

- extend `module-run-support.ts` with a helper shaped like:

```ts
seedAndExecuteGovernedRunsForModuleExecution({
  verificationOpsService,
  governedRunCheckExecutionService,
  agentExecutionService,
  actorRole,
  suiteIds,
  releaseCheckProfileId,
  manuscriptId,
  sourceModule,
  agentExecutionLogId,
  executionSnapshotId,
  outputAssetId,
})
```

- helper flow:
  1. call `seedGovernedExecutionRuns(...)`
  2. execute each returned run inline and serially
  3. collect all recorded evidence IDs
  4. append them onto the originating `AgentExecutionLog`

- keep the existing seed-only helper logic out of the call sites once the new helper is in place

- [ ] **Step 4: Inject the new execution dependency into module runtimes**

Implementation rules:

- add `governedRunCheckExecutionService` to service options for:
  - `ScreeningService`
  - `EditingService`
  - `ProofreadingService`
- construct and pass it from:
  - `apps/api/src/http/api-http-server.ts`
  - `apps/api/src/http/persistent-governance-runtime.ts`
  - `apps/api/test/http/support/workbench-runtime.ts`
  - `apps/api/test/modules/module-orchestration.spec.ts` harness

- [ ] **Step 5: Replace seed-only calls with seed-and-execute calls**

Implementation rules:

- screening and editing:
  - call the new helper after `completeLog(...)` and job persistence
- proofreading:
  - keep draft creation unchanged
  - call the new helper only in final confirmation
- when the governed executor reports failure:
  - persist the failed governed run state
  - append any emitted evidence IDs to the execution log
  - still return the completed module job and output asset to the caller

- [ ] **Step 6: Re-run the targeted API tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/modules/module-orchestration.spec.ts test/http/workbench-http.spec.ts test/http/persistent-workbench-http.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/api/src/modules/shared/module-run-support.ts apps/api/src/modules/screening/screening-service.ts apps/api/src/modules/editing/editing-service.ts apps/api/src/modules/proofreading/proofreading-service.ts apps/api/src/http/api-http-server.ts apps/api/src/http/persistent-governance-runtime.ts apps/api/test/modules/module-orchestration.spec.ts apps/api/test/http/support/workbench-runtime.ts apps/api/test/http/workbench-http.spec.ts apps/api/test/http/persistent-workbench-http.spec.ts
git commit -m "feat: run governed verification checks after module completion"
```

### Task 4: Update Evaluation Workbench For Machine-Completed Governed Runs

**Files:**
- Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench-controller.ts`
- Modify: `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`
- Test: `apps/web/test/evaluation-workbench-controller.spec.ts`
- Test: `apps/web/test/evaluation-workbench-page.spec.tsx`

- [ ] **Step 1: Write the failing workbench tests**

Extend `apps/web/test/evaluation-workbench-controller.spec.ts` with a case that proves the controller can finalize an already-completed governed run by calling `finalizeEvaluationRun(...)` directly without first calling `completeEvaluationRun(...)`.

Extend `apps/web/test/evaluation-workbench-page.spec.tsx` with assertions for:

- selected governed run status `passed` or `failed` with no finalization shows:
  - `Automatic governed checks completed. Review machine evidence before finalizing.`
  - a `Finalize Recommendation` CTA
  - the existing machine evidence list
- a queued or sample-backed run still shows the legacy `Complete And Finalize Run` path
- compare/history helper text no longer says `Complete and finalize it` for a run that is already `passed` or `failed`

- [ ] **Step 2: Run the targeted web tests and confirm they fail**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/evaluation-workbench-controller.spec.ts test/evaluation-workbench-page.spec.tsx
```

Expected: FAIL because the page still assumes every unfinalized run needs the combined completion flow.

- [ ] **Step 3: Split the controller lifecycle paths**

Implementation rules:

- keep the existing combined path for legacy/manual runs, but rename it if needed so its purpose is obvious
- add a new controller method like:

```ts
finalizeCompletedRun(input: {
  actorRole: string;
  suiteId: string;
  runId: string;
  manuscriptId?: string | null;
})
```

- this method should:
  - call `finalizeEvaluationRun(...)`
  - reload the overview
  - avoid calling `recordVerificationEvidence(...)` or `completeEvaluationRun(...)`

- [ ] **Step 4: Update the page branching and copy**

Implementation rules:

- branch the finalize panel by run lifecycle:
  - governed run already `passed` or `failed` and not finalized yet -> finalize-only mode
  - all other runs -> existing completion + finalize mode
- keep machine evidence visible before finalization in finalize-only mode
- change CTA copy to `Finalize Recommendation` in finalize-only mode
- update helper text so a selected run that is already `passed` or `failed` is described as machine-completed rather than incomplete

- [ ] **Step 5: Re-run the targeted web tests and confirm they pass**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/evaluation-workbench-controller.spec.ts test/evaluation-workbench-page.spec.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/web/src/features/evaluation-workbench/evaluation-workbench-controller.ts apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx apps/web/test/evaluation-workbench-controller.spec.ts apps/web/test/evaluation-workbench-page.spec.tsx
git commit -m "feat: support governed run recommendation finalization"
```

### Task 5: Refresh Browser Smoke, README, And Final Verification

**Files:**
- Modify: `apps/web/playwright/evaluation-workbench.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Extend the browser smoke test**

Update `apps/web/playwright/evaluation-workbench.spec.ts` so the smoke path covers a governed run that already has:

- status `passed` or `failed`
- recorded machine evidence
- a visible finalize-only CTA

The browser assertions should verify the machine evidence copy and the `Finalize Recommendation` button are both rendered.

- [ ] **Step 2: Update README for the new Phase 9T behavior**

Document that:

- runtime-binding governed runs are now automatically check-executed after successful screening/editing/proofreading-final output
- the resulting machine evidence is attached to the governed run and the execution log
- recommendation finalization remains manual
- auto-scoring and async worker orchestration are still out of scope

- [ ] **Step 3: Run targeted browser and verification commands**

Run:

```bash
pnpm --filter @medsys/web exec playwright test -c playwright.config.ts playwright/evaluation-workbench.spec.ts
pnpm --filter @medical/api exec node --import tsx --test test/agent-execution/agent-execution-log.spec.ts test/verification-ops/governed-run-check-execution.spec.ts test/modules/module-orchestration.spec.ts test/http/workbench-http.spec.ts test/http/persistent-workbench-http.spec.ts
pnpm --filter @medsys/web exec node --import tsx --test test/evaluation-workbench-controller.spec.ts test/evaluation-workbench-page.spec.tsx
pnpm --filter @medical/api typecheck
pnpm --filter @medsys/web typecheck
```

Expected:

- targeted Playwright smoke PASS
- targeted API tests PASS
- targeted web tests PASS
- both typechecks PASS

- [ ] **Step 4: Commit**

Run:

```bash
git add apps/web/playwright/evaluation-workbench.spec.ts README.md
git commit -m "docs: document governed run check execution"
```

## Implementation Notes

- Prefer one new verification-ops file for orchestration instead of spreading execution state across `verification-ops-service.ts`.
- Keep the default governed check executor deliberately simple and injectable. The implementation should be honest about current capabilities rather than pretending there is already a full browser or benchmark job system behind `VerificationCheckProfile`.
- Preserve deterministic ordering:
  - suite verification profiles first
  - release-check verification profiles second
  - first occurrence wins during dedupe
- Machine evidence should always include `check_profile_id` so the workbench and admin evidence drilldowns retain the policy linkage from Phase 9R.
- Do not let a failed governed run block the original module output from being returned once the asset and snapshot have already been persisted.
- If the workbench copy update requires small helper extraction from `evaluation-workbench-page.tsx`, keep it local and focused rather than doing unrelated refactoring.

## Suggested Verification Order

1. Finish Task 1 and Task 2 before wiring module services so the core lifecycle is testable in isolation.
2. Land Task 3 once the execution core is stable.
3. Do Task 4 after API behavior is green so the page copy matches the actual lifecycle.
4. Finish with Task 5 and the cross-stack verification sweep.
