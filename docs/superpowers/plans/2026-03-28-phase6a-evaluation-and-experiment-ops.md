# Phase 6A Evaluation And Experiment Ops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 6A governance-first offline experiment loop so the system can register approved historical sample sets, define experiment suites, freeze baseline/candidate bindings, record run-item results, generate evidence packs and promotion recommendations, and explicitly hand experiment findings into Phase 5 learning candidates.

**Architecture:** Extend the existing `verification-ops` slice instead of creating a parallel experiment platform. Reuse `ReviewedCaseSnapshot` as the approved, deidentified historical sample envelope; extend `verification-ops` with `SampleSet`, frozen experiment bindings, run items, evidence packs, and recommendations; then add a thin experiment-to-learning handoff that keeps all production publish gates unchanged.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, current in-memory repository pattern, existing `verification-ops`, `learning`, `feedback-governance`, `model-registry`, `runtime-bindings`, `execution-governance`, and current web typed-client pattern.

---

## Scope Notes

- Phase 6A remains governance-first and admin-first.
- First version is app-role `admin` only. Do not introduce a new in-app `maintainer` role.
- Experiment sources must come from `ReviewedCaseSnapshot` records backed by human-final assets and a passed deidentification check.
- Runs may compare a production baseline with a candidate lane, but only one primary variable may differ.
- Phase 6A records and recommendations must never auto-switch production routing or auto-publish governed assets.
- Experiment evidence may create Phase 5 learning candidates, but those candidates still flow through the existing approval and writeback path.
- Keep the web layer page-less for now: typed feature clients first, no premature UI shell.

## Planned File Structure

- Modify: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/evaluation-ops.ts`
- Create: `packages/contracts/type-tests/evaluation-ops.test.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-record.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-repository.ts`
- Modify: `apps/api/src/modules/verification-ops/in-memory-verification-ops-repository.ts`
- Create: `apps/api/src/modules/verification-ops/sample-set-source-guard.ts`
- Create: `apps/api/src/modules/verification-ops/experiment-binding-guard.ts`
- Create: `apps/api/src/modules/verification-ops/evidence-pack-builder.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-service.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-api.ts`
- Modify: `apps/api/src/modules/verification-ops/index.ts`
- Modify: `apps/api/src/modules/learning/learning-record.ts`
- Modify: `apps/api/src/modules/learning/learning-service.ts`
- Modify: `apps/api/src/modules/learning/learning-api.ts`
- Modify: `apps/api/src/modules/feedback-governance/feedback-governance-record.ts`
- Modify: `apps/api/src/modules/feedback-governance/feedback-governance-service.ts`
- Modify: `apps/api/src/modules/feedback-governance/feedback-governance-repository.ts`
- Modify: `apps/api/src/modules/feedback-governance/in-memory-feedback-governance-repository.ts`
- Create: `apps/api/test/verification-ops/evaluation-sample-sets.spec.ts`
- Create: `apps/api/test/verification-ops/evaluation-experiments.spec.ts`
- Create: `apps/api/test/verification-ops/evaluation-recommendations.spec.ts`
- Create: `apps/api/test/verification-ops/evaluation-learning-handoff.spec.ts`
- Modify: `apps/api/test/feedback-governance/feedback-governance.spec.ts`
- Modify: `apps/api/test/verification-ops/verification-ops.spec.ts`
- Modify: `apps/web/src/features/verification-ops/types.ts`
- Modify: `apps/web/src/features/verification-ops/verification-ops-api.ts`
- Create: `apps/web/src/features/evaluation-ops.type-test.ts`

### Task 1: Extend Shared Contracts For Sample Sets, Experiment Bindings, And Evidence Packs

**Files:**
- Create: `packages/contracts/src/evaluation-ops.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/type-tests/evaluation-ops.test.ts`

- [ ] **Step 1: Write the failing type test**

```ts
import type {
  EvaluationEvidencePack,
  EvaluationPromotionRecommendation,
  EvaluationRunItem,
  EvaluationSampleSet,
  FrozenExperimentBinding,
} from "../src/index.js";

export const sampleSetStatusCheck: EvaluationSampleSet["status"] = "published";
export const bindingLaneCheck: FrozenExperimentBinding["lane"] = "candidate";
export const runItemFailureCheck: EvaluationRunItem["failure_kind"] =
  "regression_failed";
export const evidencePackStatusCheck: EvaluationEvidencePack["summary_status"] =
  "needs_review";
export const recommendationStatusCheck:
  EvaluationPromotionRecommendation["status"] = "recommended";
```

- [ ] **Step 2: Run typecheck to verify failure**

Run: `pnpm --filter @medical/contracts typecheck`  
Expected: FAIL because Phase 6A experiment contracts do not exist yet

- [ ] **Step 3: Implement the minimal shared contracts**

Implementation rules:

- keep contract additions additive
- represent sample sets, sample set items, frozen baseline/candidate bindings, run items, evidence packs, and promotion recommendations
- include explicit `failure_kind` values
- include provenance fields required for later Phase 5 handoff, such as `experiment_run_id` and `evidence_pack_id`

- [ ] **Step 4: Re-run typecheck**

Run: `pnpm --filter @medical/contracts typecheck`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/contracts
git commit -m "feat: add phase 6a evaluation ops contracts"
```

### Task 2: Add Admin-Only Sample Set Registry Backed By Reviewed Case Snapshots

**Files:**
- Modify: `apps/api/src/modules/verification-ops/verification-ops-record.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-repository.ts`
- Modify: `apps/api/src/modules/verification-ops/in-memory-verification-ops-repository.ts`
- Create: `apps/api/src/modules/verification-ops/sample-set-source-guard.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-service.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-api.ts`
- Modify: `apps/api/src/modules/verification-ops/index.ts`
- Test: `apps/api/test/verification-ops/evaluation-sample-sets.spec.ts`

- [ ] **Step 1: Write the failing sample-set tests**

Add expectations for:

- only `admin` can create sample sets
- sample sets can only reference `ReviewedCaseSnapshot` records
- referenced snapshots must represent deidentified, human-approved history
- sample set items persist module, manuscript type, and risk-tag context

```ts
test("sample sets only accept approved historical reviewed snapshots", async () => {
  const created = await verificationOpsApi.createEvaluationSampleSet({
    actorRole: "admin",
    input: {
      name: "Proofreading Review Samples",
      module: "proofreading",
      sampleItemInputs: [
        {
          reviewedCaseSnapshotId: "reviewed-snapshot-1",
          riskTags: ["terminology", "format"],
        },
      ],
    },
  });

  assert.equal(created.body.status, "draft");
  assert.equal(created.body.sample_count, 1);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter @medical/api test -- verification-ops`  
Expected: FAIL because sample sets are not supported yet

- [ ] **Step 3: Implement the minimal sample-set registry**

Implementation rules:

- use `ReviewedCaseSnapshot` as the approved historical sample envelope
- reject snapshots that do not carry a passed deidentification check
- keep sample set publishing admin-only
- preserve a versionable sample-set asset model rather than editing published sets in place

- [ ] **Step 4: Re-run tests**

Run: `pnpm --filter @medical/api test -- verification-ops`  
Expected: PASS for sample-set coverage

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/verification-ops apps/api/test/verification-ops
git commit -m "feat: add experiment sample set registry"
```

### Task 3: Extend Evaluation Suites With Hard Gates, Score Weights, And Baseline Policy

**Files:**
- Modify: `apps/api/src/modules/verification-ops/verification-ops-record.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-repository.ts`
- Modify: `apps/api/src/modules/verification-ops/in-memory-verification-ops-repository.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-service.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-api.ts`
- Test: `apps/api/test/verification-ops/evaluation-experiments.spec.ts`

- [ ] **Step 1: Write the failing suite-policy tests**

Add expectations for:

- suites can define hard-gate policy and weighted scoring policy
- suites can require a production baseline
- A/B comparison support is explicit
- only `admin` can create or activate the extended suites

```ts
test("evaluation suites freeze scoring policy and baseline requirements", async () => {
  const created = await verificationOpsApi.createEvaluationSuite({
    actorRole: "admin",
    input: {
      name: "Editing Prompt Regression",
      suiteType: "regression",
      verificationCheckProfileIds: ["check-profile-1"],
      moduleScope: ["editing"],
      requiresProductionBaseline: true,
      supportsAbComparison: true,
      hardGatePolicy: {
        mustUseDeidentifiedSamples: true,
        requiresParsableOutput: true,
      },
      scoreWeights: {
        structure: 25,
        terminology: 20,
        knowledgeCoverage: 20,
        riskDetection: 20,
        humanEditBurden: 10,
        costAndLatency: 5,
      },
    },
  });

  assert.equal(created.body.requires_production_baseline, true);
  assert.equal(created.body.supports_ab_comparison, true);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter @medical/api test -- verification-ops`  
Expected: FAIL because suite scoring and baseline policy are not modeled yet

- [ ] **Step 3: Implement the minimal suite-policy extension**

Implementation rules:

- extend existing `EvaluationSuiteRecord` instead of creating a second suite type
- store hard-gate policy and score weights as frozen suite-owned data
- keep activation dependent on published verification checks
- do not introduce UI-only fields into the core record

- [ ] **Step 4: Re-run tests**

Run: `pnpm --filter @medical/api test -- verification-ops`  
Expected: PASS for suite-policy coverage

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/verification-ops apps/api/test/verification-ops
git commit -m "feat: extend evaluation suites with scoring policy"
```

### Task 4: Add Frozen Experiment Runs And Run-Item Result Recording

**Files:**
- Create: `apps/api/src/modules/verification-ops/experiment-binding-guard.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-record.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-repository.ts`
- Modify: `apps/api/src/modules/verification-ops/in-memory-verification-ops-repository.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-service.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-api.ts`
- Test: `apps/api/test/verification-ops/evaluation-experiments.spec.ts`

- [ ] **Step 1: Write the failing run-binding tests**

Add expectations for:

- creating an experiment run freezes both baseline and candidate bindings
- baseline binding must represent a production-valid combination
- candidate binding may differ in only one primary variable
- creating a run materializes run items for every sample in the selected set
- run items can record hard-gate results, weighted score, and failure kind

```ts
test("experiment runs freeze baseline and candidate bindings with a single primary diff", async () => {
  const created = await verificationOpsApi.createEvaluationRun({
    actorRole: "admin",
    input: {
      suiteId: "suite-1",
      sampleSetId: "sample-set-1",
      baselineBinding: {
        lane: "baseline",
        modelId: "model-prod-1",
        runtimeId: "runtime-prod-1",
        promptTemplateId: "prompt-prod-1",
        skillPackageIds: ["skill-prod-1"],
        moduleTemplateId: "template-prod-1",
      },
      candidateBinding: {
        lane: "candidate",
        modelId: "model-candidate-1",
        runtimeId: "runtime-prod-1",
        promptTemplateId: "prompt-prod-1",
        skillPackageIds: ["skill-prod-1"],
        moduleTemplateId: "template-prod-1",
      },
    },
  });

  assert.equal(created.body.status, "queued");
  assert.equal(created.body.run_item_count, 1);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter @medical/api test -- verification-ops`  
Expected: FAIL because run bindings and run items do not exist yet

- [ ] **Step 3: Implement the minimal run-binding and run-item flow**

Implementation rules:

- freeze baseline and candidate bindings at run creation time
- enforce single-variable A/B comparison
- pre-materialize run items so later scoring updates have stable ids
- support admin recording per-item result summaries without requiring a full auto-execution engine yet

- [ ] **Step 4: Re-run tests**

Run: `pnpm --filter @medical/api test -- verification-ops`  
Expected: PASS for frozen binding and run-item coverage

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/verification-ops apps/api/test/verification-ops
git commit -m "feat: add frozen experiment runs and run items"
```

### Task 5: Generate Evidence Packs And Promotion Recommendations

**Files:**
- Create: `apps/api/src/modules/verification-ops/evidence-pack-builder.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-record.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-repository.ts`
- Modify: `apps/api/src/modules/verification-ops/in-memory-verification-ops-repository.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-service.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-api.ts`
- Test: `apps/api/test/verification-ops/evaluation-recommendations.spec.ts`

- [ ] **Step 1: Write the failing evidence-pack tests**

Add expectations for:

- finalizing an experiment run produces an evidence pack summary
- regression failures prevent `recommended`
- incomplete scoring moves the summary to `needs_review`
- recommendation records stay advisory only

```ts
test("evidence packs summarize regression failures and block recommended outcomes", async () => {
  const finalized = await verificationOpsApi.finalizeEvaluationRun({
    actorRole: "admin",
    runId: "run-1",
  });

  assert.equal(finalized.body.evidence_pack.summary_status, "rejected");
  assert.equal(finalized.body.recommendation.status, "rejected");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter @medical/api test -- verification-ops`  
Expected: FAIL because evidence packs and promotion recommendations do not exist yet

- [ ] **Step 3: Implement the minimal evidence-pack and recommendation flow**

Implementation rules:

- derive recommendation state from frozen run items and suite policy
- evidence packs must summarize score, failures, diffs, cost, and latency
- recommendation records must not mutate production routing
- keep evidence generation deterministic from stored run-item state

- [ ] **Step 4: Re-run tests**

Run: `pnpm --filter @medical/api test -- verification-ops`  
Expected: PASS for evidence-pack and recommendation coverage

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/verification-ops apps/api/test/verification-ops
git commit -m "feat: add experiment evidence packs and recommendations"
```

### Task 6: Hand Off Experiment Findings Into Phase 5 Learning Candidates With Experiment Provenance

**Files:**
- Modify: `apps/api/src/modules/learning/learning-record.ts`
- Modify: `apps/api/src/modules/learning/learning-service.ts`
- Modify: `apps/api/src/modules/learning/learning-api.ts`
- Modify: `apps/api/src/modules/feedback-governance/feedback-governance-record.ts`
- Modify: `apps/api/src/modules/feedback-governance/feedback-governance-service.ts`
- Modify: `apps/api/src/modules/feedback-governance/feedback-governance-repository.ts`
- Modify: `apps/api/src/modules/feedback-governance/in-memory-feedback-governance-repository.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-service.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-api.ts`
- Test: `apps/api/test/verification-ops/evaluation-learning-handoff.spec.ts`
- Test: `apps/api/test/feedback-governance/feedback-governance.spec.ts`

- [ ] **Step 1: Write the failing experiment-handoff tests**

Add expectations for:

- only `admin` can create experiment-sourced learning candidates
- experiment handoff supports `prompt_optimization_candidate`, `skill_update_candidate`, and `template_update_candidate`
- source links record experiment provenance without pretending to be human feedback
- existing feedback-governance behavior remains backward compatible

```ts
test("experiment evidence can create governed learning candidates with experiment provenance", async () => {
  const created = await verificationOpsApi.createLearningCandidateFromEvaluation({
    actorRole: "admin",
    input: {
      runId: "run-1",
      evidencePackId: "evidence-pack-1",
      reviewedCaseSnapshotId: "reviewed-snapshot-1",
      candidateType: "prompt_optimization_candidate",
      title: "Proofreading baseline prompt optimization",
      proposalText: "Adopt the candidate prompt because regression gates passed.",
      createdBy: "admin-1",
      sourceAssetId: "candidate-result-asset-1",
    },
  });

  assert.equal(created.body.type, "prompt_optimization_candidate");
  assert.equal(created.body.status, "pending_review");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter @medical/api test -- verification-ops`  
Expected: FAIL because experiment handoff is not supported yet

Run: `pnpm --filter @medical/api test -- feedback-governance`  
Expected: FAIL because experiment provenance links do not exist yet

- [ ] **Step 3: Implement the minimal experiment-to-learning handoff**

Implementation rules:

- extend source-link provenance additively so human-feedback links keep working
- require evidence-pack and run ids for experiment-sourced provenance
- create learning candidates through existing `learning` service paths where possible
- move experiment-created candidates to `pending_review` only after governed provenance is attached

- [ ] **Step 4: Re-run tests**

Run: `pnpm --filter @medical/api test -- verification-ops`  
Expected: PASS for learning handoff coverage

Run: `pnpm --filter @medical/api test -- feedback-governance`  
Expected: PASS with backward-compatible provenance behavior

Run: `pnpm --filter @medical/api test -- learning`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/learning apps/api/src/modules/feedback-governance apps/api/src/modules/verification-ops apps/api/test/verification-ops apps/api/test/feedback-governance
git commit -m "feat: add experiment learning handoff"
```

### Task 7: Extend Typed Web Clients For Phase 6A Experiment Governance

**Files:**
- Modify: `apps/web/src/features/verification-ops/types.ts`
- Modify: `apps/web/src/features/verification-ops/verification-ops-api.ts`
- Test: `apps/web/src/features/evaluation-ops.type-test.ts`

- [ ] **Step 1: Write the failing web type test**

Expected imports:

```ts
import {
  createEvaluationSampleSet,
  createEvaluationRun,
  finalizeEvaluationRun,
  createLearningCandidateFromEvaluation,
  type EvaluationEvidencePackViewModel,
  type EvaluationPromotionRecommendationViewModel,
  type EvaluationSampleSetViewModel,
} from "./verification-ops/index.ts";
```

Also add expectations that the web types expose frozen bindings, run-item summaries, evidence packs, and recommendation summaries.

- [ ] **Step 2: Run typecheck to verify failure**

Run: `pnpm --filter @medsys/web typecheck`  
Expected: FAIL because Phase 6A typed clients and types do not exist yet

- [ ] **Step 3: Implement the minimal typed clients**

Implementation rules:

- extend the existing `verification-ops` feature instead of creating a parallel web slice
- keep request bodies aligned with the current API client pattern
- expose enough read models for a future admin workbench without building pages now

- [ ] **Step 4: Re-run typecheck**

Run: `pnpm --filter @medsys/web typecheck`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/verification-ops apps/web/src/features/evaluation-ops.type-test.ts
git commit -m "feat: add phase 6a experiment governance clients"
```

## Final Verification Gate

- [ ] Run: `pnpm --filter @medical/contracts typecheck`
- [ ] Run: `pnpm --filter @medical/api test -- verification-ops`
- [ ] Run: `pnpm --filter @medical/api test -- feedback-governance`
- [ ] Run: `pnpm --filter @medical/api test -- learning`
- [ ] Run: `pnpm --filter @medical/api typecheck`
- [ ] Run: `pnpm --filter @medsys/web typecheck`
- [ ] Run: `pnpm test`

## Acceptance Criteria

- Admin can create governance-approved experiment sample sets from reviewed historical snapshots only.
- Evaluation suites can define hard-gate policy, weighted scoring, and production-baseline requirements.
- Experiment runs freeze baseline and candidate bindings, enforce single-variable A/B comparison, and materialize run items.
- Finalized runs generate evidence packs and advisory promotion recommendations without mutating production routing.
- Regression failures and incomplete scoring prevent `recommended`.
- Experiment evidence can explicitly create Phase 5 learning candidates with experiment provenance.
- Existing human-feedback provenance and learning approval behavior remain backward compatible.
- Web code remains consistent with the existing repo pattern: typed feature clients first, no premature page implementation.
