# Proofreading Governed Self-Learning V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-safe self-learning loop to governed proofreading by storing residual issues, validating reusable findings through Harness, and bridging approved findings into the existing learning-governance path without any model self-training or auto-publish behavior.

**Architecture:** Build one new backend module, `residual-learning`, that sits after the current governed proofreading pass. It records first-class residual issues keyed to existing execution snapshots, scores and routes them, validates candidate-eligible issues with a new Harness residual-validation check type, and only then creates governed learning candidates with truthful residual provenance. Keep V1 backend-heavy: no new standalone web workbench, only the minimum type and label alignment needed so existing review surfaces do not lie about the new candidate source.

**Tech Stack:** TypeScript, Prisma/PostgreSQL migrations, existing API service/repository pattern, existing governed proofreading pipeline, existing verification-ops and learning-governance stack, React/TypeScript type alignment in web

---

## File Structure

### Create

- `apps/api/src/database/migrations/0044_proofreading_residual_learning_v1.sql`
- `apps/api/src/modules/residual-learning/index.ts`
- `apps/api/src/modules/residual-learning/residual-learning-record.ts`
- `apps/api/src/modules/residual-learning/residual-learning-repository.ts`
- `apps/api/src/modules/residual-learning/in-memory-residual-learning-repository.ts`
- `apps/api/src/modules/residual-learning/postgres-residual-learning-repository.ts`
- `apps/api/src/modules/residual-learning/residual-confidence.ts`
- `apps/api/src/modules/residual-learning/residual-routing.ts`
- `apps/api/src/modules/residual-learning/proofreading-residual-adapter.ts`
- `apps/api/src/modules/residual-learning/residual-learning-service.ts`
- `apps/api/src/modules/residual-learning/residual-learning-api.ts`
- `apps/api/test/residual-learning/residual-learning-service.spec.ts`
- `apps/api/test/residual-learning/postgres-residual-learning-persistence.spec.ts`
- `apps/api/test/residual-learning/residual-learning-api.spec.ts`
- `apps/api/test/proofreading/proofreading-residual-learning.spec.ts`
- `apps/api/test/learning/residual-learning-handoff.spec.ts`
- `apps/api/test/verification-ops/residual-validation-check.spec.ts`
- `packages/contracts/src/residual-learning.ts`

### Modify

- `apps/api/prisma/schema.prisma`
- `apps/api/src/database/migration-ledger.ts`
- `apps/api/test/database/schema.spec.ts`
- `apps/api/src/modules/proofreading/proofreading-service.ts`
- `apps/api/src/modules/learning/learning-record.ts`
- `apps/api/src/modules/learning/learning-service.ts`
- `apps/api/src/modules/feedback-governance/feedback-governance-record.ts`
- `apps/api/src/modules/feedback-governance/feedback-governance-service.ts`
- `apps/api/src/modules/verification-ops/verification-ops-record.ts`
- `apps/api/src/modules/verification-ops/governed-run-check-execution.ts`
- `apps/api/src/modules/verification-ops/verification-ops-service.ts`
- `apps/api/src/http/api-http-server.ts`
- `apps/api/src/http/persistent-governance-runtime.ts`
- `packages/contracts/src/index.ts`
- `packages/contracts/src/learning.ts`
- `packages/contracts/type-tests/core.test.ts`
- `packages/contracts/type-tests/evaluation-ops.test.ts`
- `apps/web/src/features/learning-review/types.ts`
- `apps/web/src/features/template-governance/rule-learning-diff-card.tsx`
- `apps/web/test/rule-center-learning-review.spec.ts`

### Keep Untouched Unless Blocked

- `apps/api/src/modules/learning-governance/learning-governance-service.ts`
- `apps/api/src/modules/harness-control-plane/harness-control-plane-service.ts`
- `apps/web/src/features/manuscript-workbench/*`

V1 should not grow a second review desk or a brand-new residual-learning workbench. The backend loop and truthful review handoff are the priority.

## Scope Guard

- Do not overload `case_pattern_candidate` to mean `knowledge_candidate`.
- Do not fake residual learning provenance as `human_feedback` or `reviewed_case_snapshot`.
- Do not skip Harness validation for candidate-eligible residual issues.
- Do not auto-publish any governed asset.
- Do not add a dedicated browser workbench in this phase.

## Task 1: Add residual-learning contracts and persistence

**Files:**
- Create: `packages/contracts/src/residual-learning.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/learning.ts`
- Modify: `packages/contracts/type-tests/core.test.ts`
- Modify: `packages/contracts/type-tests/evaluation-ops.test.ts`
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/database/migrations/0044_proofreading_residual_learning_v1.sql`
- Modify: `apps/api/src/database/migration-ledger.ts`
- Modify: `apps/api/test/database/schema.spec.ts`
- Create: `apps/api/src/modules/residual-learning/residual-learning-record.ts`
- Create: `apps/api/src/modules/residual-learning/residual-learning-repository.ts`
- Create: `apps/api/src/modules/residual-learning/in-memory-residual-learning-repository.ts`
- Create: `apps/api/src/modules/residual-learning/postgres-residual-learning-repository.ts`
- Create: `apps/api/test/residual-learning/postgres-residual-learning-persistence.spec.ts`

- [ ] **Step 1: Write the failing contract and schema tests**

Add assertions for:

- `knowledge_candidate` on the learning candidate type union
- `residual_issue_validation` on verification check types
- first-class `ResidualIssue` contracts
- a persistent residual-issue table and indexes in the database schema test

```ts
type ExpectedLearningCandidateType =
  | "rule_candidate"
  | "knowledge_candidate"
  | "prompt_optimization_candidate";

const residualIssue: ResidualIssue = {
  id: "residual-1",
  module: "proofreading",
  system_confidence_band: "L2_candidate_ready",
  recommended_route: "knowledge_candidate",
  harness_validation_status: "queued",
};
```

- [ ] **Step 2: Run the focused contract and persistence checks to verify they fail**

Run:

```bash
pnpm --filter @medical/contracts typecheck
pnpm --filter @medical/api exec node --import tsx --test ./test/database/schema.spec.ts ./test/residual-learning/postgres-residual-learning-persistence.spec.ts
```

Expected: FAIL because the new contract, enum values, migration entry, and residual-learning repository do not exist yet.

- [ ] **Step 3: Implement the contract file, schema, migration, and repositories**

Define the new record and repository surfaces instead of hiding them inside unrelated learning modules.

```ts
export interface ResidualIssueRecord {
  id: string;
  module: "proofreading" | "editing" | "screening";
  manuscript_id: string;
  execution_snapshot_id: string;
  issue_type: string;
  novelty_key: string;
  system_confidence_band: ResidualConfidenceBand;
  recommended_route: ResidualIssueRoute;
  harness_validation_status: ResidualHarnessValidationStatus;
}
```

- [ ] **Step 4: Re-run the contract and persistence checks**

Run:

```bash
pnpm --filter @medical/contracts typecheck
pnpm --filter @medical/api exec node --import tsx --test ./test/database/schema.spec.ts ./test/residual-learning/postgres-residual-learning-persistence.spec.ts
```

Expected: PASS with the new residual-learning schema and repository layer.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/residual-learning.ts packages/contracts/src/index.ts packages/contracts/src/learning.ts packages/contracts/type-tests/core.test.ts packages/contracts/type-tests/evaluation-ops.test.ts apps/api/prisma/schema.prisma apps/api/src/database/migration-ledger.ts apps/api/src/database/migrations/0044_proofreading_residual_learning_v1.sql apps/api/src/modules/residual-learning/residual-learning-record.ts apps/api/src/modules/residual-learning/residual-learning-repository.ts apps/api/src/modules/residual-learning/in-memory-residual-learning-repository.ts apps/api/src/modules/residual-learning/postgres-residual-learning-repository.ts apps/api/test/database/schema.spec.ts apps/api/test/residual-learning/postgres-residual-learning-persistence.spec.ts
git commit -m "feat: add residual learning persistence contracts"
```

## Task 2: Extend learning and provenance models truthfully

**Files:**
- Modify: `apps/api/src/modules/learning/learning-record.ts`
- Modify: `apps/api/src/modules/learning/learning-service.ts`
- Modify: `apps/api/src/modules/feedback-governance/feedback-governance-record.ts`
- Modify: `apps/api/src/modules/feedback-governance/feedback-governance-service.ts`
- Create: `apps/api/test/learning/residual-learning-handoff.spec.ts`
- Modify: `apps/api/test/feedback-governance/feedback-governance.spec.ts`
- Modify: `apps/web/src/features/learning-review/types.ts`

- [ ] **Step 1: Write the failing learning and provenance tests**

Cover these truths:

- residual-learning candidates use `knowledge_candidate` instead of `case_pattern_candidate`
- residual-learning provenance is stored as `residual_issue`
- learning approval still requires governed provenance

```ts
assert.equal(candidate.type, "knowledge_candidate");
assert.equal(candidate.governed_provenance_kind, "residual_issue");
assert.equal(sourceLink.source_kind, "residual_issue");
```

- [ ] **Step 2: Run the focused learning/provenance tests to verify they fail**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/learning/learning-governance.spec.ts ./test/learning/residual-learning-handoff.spec.ts ./test/feedback-governance/feedback-governance.spec.ts
pnpm --filter @medsys/web typecheck
```

Expected: FAIL because the candidate type and provenance kind are not supported yet, and the web duplicate type unions still lag the backend.

- [ ] **Step 3: Implement the enum, record, and service changes**

Keep the existing review gate, but make the provenance truthful.

```ts
export type LearningCandidateType =
  | "rule_candidate"
  | "knowledge_candidate"
  | "prompt_optimization_candidate";

export type LearningCandidateProvenanceKind =
  | "human_feedback"
  | "evaluation_experiment"
  | "reviewed_case_snapshot"
  | "residual_issue";
```

- [ ] **Step 4: Re-run the learning/provenance checks**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/learning/learning-governance.spec.ts ./test/learning/residual-learning-handoff.spec.ts ./test/feedback-governance/feedback-governance.spec.ts
pnpm --filter @medsys/web typecheck
```

Expected: PASS with truthful residual provenance and web type alignment.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/learning/learning-record.ts apps/api/src/modules/learning/learning-service.ts apps/api/src/modules/feedback-governance/feedback-governance-record.ts apps/api/src/modules/feedback-governance/feedback-governance-service.ts apps/api/test/learning/learning-governance.spec.ts apps/api/test/learning/residual-learning-handoff.spec.ts apps/api/test/feedback-governance/feedback-governance.spec.ts apps/web/src/features/learning-review/types.ts
git commit -m "feat: add truthful residual learning provenance"
```

## Task 3: Implement residual discovery, confidence scoring, and routing

**Files:**
- Create: `apps/api/src/modules/residual-learning/residual-confidence.ts`
- Create: `apps/api/src/modules/residual-learning/residual-routing.ts`
- Create: `apps/api/src/modules/residual-learning/proofreading-residual-adapter.ts`
- Create: `apps/api/src/modules/residual-learning/residual-learning-service.ts`
- Create: `apps/api/src/modules/residual-learning/index.ts`
- Create: `apps/api/test/residual-learning/residual-learning-service.spec.ts`

- [ ] **Step 1: Write the failing residual-learning service tests**

Cover:

- known baseline hits are filtered out
- recurrence boosts confidence
- medical-risk issues force `manual_only`
- stable terminology or unit gaps can route to `rule_candidate` or `knowledge_candidate`

```ts
assert.equal(issues[0]?.recommended_route, "rule_candidate");
assert.equal(issues[0]?.system_confidence_band, "L2_candidate_ready");
assert.equal(issues[1]?.recommended_route, "manual_only");
```

- [ ] **Step 2: Run the residual-learning service test to verify it fails**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/residual-learning/residual-learning-service.spec.ts
```

Expected: FAIL because the residual-learning module does not exist yet.

- [ ] **Step 3: Implement the residual-learning service and proofreading adapter**

Keep the AI-facing part narrow. The service should accept already-resolved governed evidence instead of re-reading the world.

```ts
const observed = await residualLearningService.observeProofreadingResiduals({
  manuscriptId,
  executionSnapshotId,
  knownRuleIds,
  knownKnowledgeItemIds,
  qualityIssues,
  sourceBlocks,
});
```

- [ ] **Step 4: Re-run the residual-learning service test**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/residual-learning/residual-learning-service.spec.ts
```

Expected: PASS with deterministic confidence/routing behavior around the normalized residual records.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/residual-learning/index.ts apps/api/src/modules/residual-learning/residual-confidence.ts apps/api/src/modules/residual-learning/residual-routing.ts apps/api/src/modules/residual-learning/proofreading-residual-adapter.ts apps/api/src/modules/residual-learning/residual-learning-service.ts apps/api/test/residual-learning/residual-learning-service.spec.ts
git commit -m "feat: add residual issue scoring and routing"
```

## Task 4: Wire governed proofreading runs into residual-learning

**Files:**
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Create: `apps/api/test/proofreading/proofreading-residual-learning.spec.ts`
- Modify: `apps/api/test/proofreading/proofreading-bare-run.spec.ts`

- [ ] **Step 1: Write the failing proofreading integration tests**

Lock these behaviors:

- governed proofreading draft runs store residual issues after the baseline snapshot exists
- bare runs do not trigger the residual-learning hook
- residual issues keep snapshot and output-asset lineage

```ts
assert.equal(result.snapshot_id, "snapshot-1");
assert.equal(storedIssues[0]?.execution_snapshot_id, "snapshot-1");
assert.equal(storedIssues[0]?.output_asset_id, result.asset.id);
```

- [ ] **Step 2: Run the proofreading integration tests to verify they fail**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/proofreading/proofreading-bare-run.spec.ts ./test/proofreading/proofreading-residual-learning.spec.ts
```

Expected: FAIL because proofreading is not wired to the residual-learning service yet.

- [ ] **Step 3: Implement the proofreading hook and server wiring**

Keep the sequencing explicit:

1. governed proofreading baseline runs
2. output asset is created
3. execution snapshot is recorded
4. residual-learning observes against that snapshot and asset

- [ ] **Step 4: Re-run the proofreading integration tests**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/proofreading/proofreading-bare-run.spec.ts ./test/proofreading/proofreading-residual-learning.spec.ts
```

Expected: PASS with governed-only residual observation wired in.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/proofreading/proofreading-service.ts apps/api/src/http/api-http-server.ts apps/api/src/http/persistent-governance-runtime.ts apps/api/test/proofreading/proofreading-bare-run.spec.ts apps/api/test/proofreading/proofreading-residual-learning.spec.ts
git commit -m "feat: observe proofreading residual issues after governed runs"
```

## Task 5: Add Harness residual-validation capability

**Files:**
- Modify: `apps/api/src/modules/verification-ops/verification-ops-record.ts`
- Modify: `apps/api/src/modules/verification-ops/governed-run-check-execution.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-service.ts`
- Modify: `packages/contracts/type-tests/evaluation-ops.test.ts`
- Create: `apps/api/test/verification-ops/residual-validation-check.spec.ts`
- Modify: `apps/api/test/verification-ops/governed-run-check-execution.spec.ts`
- Modify: `apps/api/src/modules/residual-learning/residual-learning-service.ts`

- [ ] **Step 1: Write the failing Harness residual-validation tests**

Cover:

- `residual_issue_validation` profiles can be created and published
- governed execution runs can carry `residual_issue_id`
- failed residual validation prevents the residual issue from reaching candidate-ready state

```ts
assert.equal(checkProfile.check_type, "residual_issue_validation");
assert.equal(run.governed_source?.residual_issue_id, "residual-1");
assert.equal(validatedIssue.harness_validation_status, "failed");
```

- [ ] **Step 2: Run the focused verification-ops tests to verify they fail**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/verification-ops/governed-run-check-execution.spec.ts ./test/verification-ops/residual-validation-check.spec.ts
```

Expected: FAIL because verification-ops does not yet understand residual-validation checks or issue-scoped governed sources.

- [ ] **Step 3: Implement the new verification check type and residual validation bridge**

Extend the governed source instead of inventing a parallel validation transport.

```ts
type VerificationCheckType =
  | "browser_qa"
  | "benchmark"
  | "deploy_verification"
  | "retrieval_quality"
  | "residual_issue_validation";
```

- [ ] **Step 4: Re-run the verification-ops tests**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/verification-ops/governed-run-check-execution.spec.ts ./test/verification-ops/residual-validation-check.spec.ts
```

Expected: PASS with residual issue validation wired through Harness evidence generation.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/verification-ops/verification-ops-record.ts apps/api/src/modules/verification-ops/governed-run-check-execution.ts apps/api/src/modules/verification-ops/verification-ops-service.ts packages/contracts/type-tests/evaluation-ops.test.ts apps/api/test/verification-ops/governed-run-check-execution.spec.ts apps/api/test/verification-ops/residual-validation-check.spec.ts apps/api/src/modules/residual-learning/residual-learning-service.ts
git commit -m "feat: add harness residual validation checks"
```

## Task 6: Bridge validated residual issues into governed learning candidates and APIs

**Files:**
- Create: `apps/api/src/modules/residual-learning/residual-learning-api.ts`
- Modify: `apps/api/src/modules/residual-learning/residual-learning-service.ts`
- Modify: `apps/api/src/modules/learning/learning-service.ts`
- Modify: `apps/api/src/modules/feedback-governance/feedback-governance-service.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Create: `apps/api/test/residual-learning/residual-learning-api.spec.ts`
- Modify: `apps/api/test/learning/residual-learning-handoff.spec.ts`

- [ ] **Step 1: Write the failing residual API and bridge tests**

Lock these outcomes:

- validated rule residuals create `rule_candidate`
- validated knowledge residuals create `knowledge_candidate`
- validated prompt-template residuals create `prompt_optimization_candidate`
- `manual_only` and `evidence_only` residual issues do not create candidates

```ts
assert.equal(created.type, "knowledge_candidate");
assert.equal(created.governed_provenance_kind, "residual_issue");
assert.equal(issue.learning_candidate_id, created.id);
```

- [ ] **Step 2: Run the focused residual API and bridge tests to verify they fail**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/residual-learning/residual-learning-api.spec.ts ./test/learning/residual-learning-handoff.spec.ts
```

Expected: FAIL because there is no residual-learning API surface or candidate bridge yet.

- [ ] **Step 3: Implement list/get/validate/create-candidate APIs and the bridge logic**

Expose the backend loop without building a new frontend desk.

```ts
POST /api/v1/residual-learning/issues/:issueId/validate
POST /api/v1/residual-learning/issues/:issueId/create-learning-candidate
GET  /api/v1/residual-learning/issues
GET  /api/v1/residual-learning/issues/:issueId
```

- [ ] **Step 4: Re-run the residual API and bridge tests**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/residual-learning/residual-learning-api.spec.ts ./test/learning/residual-learning-handoff.spec.ts
```

Expected: PASS with route-aware candidate creation and truthful provenance preserved.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/residual-learning/residual-learning-api.ts apps/api/src/modules/residual-learning/residual-learning-service.ts apps/api/src/modules/learning/learning-service.ts apps/api/src/modules/feedback-governance/feedback-governance-service.ts apps/api/src/http/api-http-server.ts apps/api/src/http/persistent-governance-runtime.ts apps/api/test/residual-learning/residual-learning-api.spec.ts apps/api/test/learning/residual-learning-handoff.spec.ts
git commit -m "feat: bridge validated residual issues into governed candidates"
```

## Task 7: Align existing review UI labels and run full verification

**Files:**
- Modify: `apps/web/src/features/learning-review/types.ts`
- Modify: `apps/web/src/features/template-governance/rule-learning-diff-card.tsx`
- Modify: `apps/web/test/rule-center-learning-review.spec.ts`
- Modify: `docs/superpowers/specs/2026-04-17-proofreading-governed-self-learning-v1-design.md`
- Modify: `docs/superpowers/plans/2026-04-17-proofreading-governed-self-learning-v1-implementation.md`

- [ ] **Step 1: Write the failing web regression for residual provenance copy**

Lock the minimal operator-visible truth:

- rule-center recovery cards can render `residual_issue` provenance without falling back to `unlabeled`
- existing rule-candidate screens still behave normally

```tsx
assert.match(renderedText, /residual/i);
```

- [ ] **Step 2: Run the full impacted verification set and confirm current failures**

Run:

```bash
pnpm --filter @medical/contracts typecheck
pnpm --filter @medical/api exec node --import tsx --test ./test/database/schema.spec.ts ./test/residual-learning/postgres-residual-learning-persistence.spec.ts ./test/residual-learning/residual-learning-service.spec.ts ./test/residual-learning/residual-learning-api.spec.ts ./test/proofreading/proofreading-bare-run.spec.ts ./test/proofreading/proofreading-residual-learning.spec.ts ./test/learning/learning-governance.spec.ts ./test/learning/residual-learning-handoff.spec.ts ./test/feedback-governance/feedback-governance.spec.ts ./test/verification-ops/governed-run-check-execution.spec.ts ./test/verification-ops/residual-validation-check.spec.ts
pnpm --filter @medical/api typecheck
pnpm --filter @medsys/web exec node --import tsx --test ./test/rule-center-learning-review.spec.ts
pnpm --filter @medsys/web typecheck
```

Expected: FAIL before the final web label alignment and any last integration cleanup.

- [ ] **Step 3: Implement the minimal web label alignment and update the docs if reality shifted**

Do not add a new desk. Only make sure existing UI and docs remain truthful about the new provenance and candidate types.

- [ ] **Step 4: Re-run the full impacted verification set**

Run:

```bash
pnpm --filter @medical/contracts typecheck
pnpm --filter @medical/api exec node --import tsx --test ./test/database/schema.spec.ts ./test/residual-learning/postgres-residual-learning-persistence.spec.ts ./test/residual-learning/residual-learning-service.spec.ts ./test/residual-learning/residual-learning-api.spec.ts ./test/proofreading/proofreading-bare-run.spec.ts ./test/proofreading/proofreading-residual-learning.spec.ts ./test/learning/learning-governance.spec.ts ./test/learning/residual-learning-handoff.spec.ts ./test/feedback-governance/feedback-governance.spec.ts ./test/verification-ops/governed-run-check-execution.spec.ts ./test/verification-ops/residual-validation-check.spec.ts
pnpm --filter @medical/api typecheck
pnpm --filter @medsys/web exec node --import tsx --test ./test/rule-center-learning-review.spec.ts
pnpm --filter @medsys/web typecheck
```

Expected: PASS with zero known failures across the impacted contracts, API, and minimal web alignment.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/learning-review/types.ts apps/web/src/features/template-governance/rule-learning-diff-card.tsx apps/web/test/rule-center-learning-review.spec.ts docs/superpowers/specs/2026-04-17-proofreading-governed-self-learning-v1-design.md docs/superpowers/plans/2026-04-17-proofreading-governed-self-learning-v1-implementation.md
git commit -m "feat: finish proofreading residual learning v1"
```

## Execution Note

This branch is for the regenerated design and implementation planning baseline.

Do not start coding past this plan until the user explicitly chooses to execute it.
