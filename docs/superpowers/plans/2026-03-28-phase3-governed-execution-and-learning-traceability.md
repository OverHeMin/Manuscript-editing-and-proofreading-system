# Phase 3 Governed Execution And Learning Traceability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 3 governance closure so screening, editing, and proofreading run through a published execution profile, emit execution snapshots and knowledge hit logs, and connect human feedback to reviewable learning sources.

**Architecture:** Extend the existing in-memory repository + service + API pattern instead of introducing a second execution architecture. Keep the current module services, add focused governance/tracking modules, and route all module context assembly through a single `GovernedModuleContextResolver`.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, existing in-memory repositories, shared contracts package, current AI gateway and manuscript module slices.

---

## Scope Notes

- This plan intentionally keeps Phase 3 backend-heavy and governance-first.
- No large UI work is included beyond typed web feature clients.
- `screening`, `editing`, and `proofreading` stay as module-specific services, but stop assembling template/knowledge/prompt/skill context themselves.
- Learning remains review-gated. No automatic production write-back is included.

## Planned File Structure

- Modify: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/governed-execution.ts`
- Create: `packages/contracts/type-tests/governed-execution.test.ts`
- Create: `apps/api/src/modules/execution-governance/execution-governance-record.ts`
- Create: `apps/api/src/modules/execution-governance/execution-governance-repository.ts`
- Create: `apps/api/src/modules/execution-governance/in-memory-execution-governance-repository.ts`
- Create: `apps/api/src/modules/execution-governance/execution-governance-service.ts`
- Create: `apps/api/src/modules/execution-governance/execution-governance-api.ts`
- Create: `apps/api/src/modules/execution-governance/index.ts`
- Create: `apps/api/test/execution-governance/execution-governance.spec.ts`
- Create: `apps/api/src/modules/execution-tracking/execution-tracking-record.ts`
- Create: `apps/api/src/modules/execution-tracking/execution-tracking-repository.ts`
- Create: `apps/api/src/modules/execution-tracking/in-memory-execution-tracking-repository.ts`
- Create: `apps/api/src/modules/execution-tracking/execution-tracking-service.ts`
- Create: `apps/api/src/modules/execution-tracking/execution-tracking-api.ts`
- Create: `apps/api/src/modules/execution-tracking/index.ts`
- Create: `apps/api/test/execution-tracking/execution-tracking.spec.ts`
- Create: `apps/api/src/modules/feedback-governance/feedback-governance-record.ts`
- Create: `apps/api/src/modules/feedback-governance/feedback-governance-repository.ts`
- Create: `apps/api/src/modules/feedback-governance/in-memory-feedback-governance-repository.ts`
- Create: `apps/api/src/modules/feedback-governance/feedback-governance-service.ts`
- Create: `apps/api/src/modules/feedback-governance/feedback-governance-api.ts`
- Create: `apps/api/src/modules/feedback-governance/index.ts`
- Create: `apps/api/test/feedback-governance/feedback-governance.spec.ts`
- Create: `apps/api/src/modules/shared/governed-module-context-resolver.ts`
- Create: `apps/api/test/modules/governed-module-context-resolver.spec.ts`
- Modify: `apps/api/src/modules/prompt-skill-registry/prompt-skill-record.ts`
- Modify: `apps/api/src/modules/prompt-skill-registry/prompt-skill-repository.ts`
- Modify: `apps/api/src/modules/prompt-skill-registry/in-memory-prompt-skill-repository.ts`
- Modify: `apps/api/src/modules/prompt-skill-registry/prompt-skill-service.ts`
- Modify: `apps/api/src/modules/prompt-skill-registry/prompt-skill-api.ts`
- Modify: `apps/api/src/modules/prompt-skill-registry/index.ts`
- Modify: `apps/api/test/prompt-skill-registry/prompt-skill-registry.spec.ts`
- Modify: `apps/api/src/modules/shared/module-run-support.ts`
- Modify: `apps/api/src/modules/screening/screening-service.ts`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/test/modules/module-orchestration.spec.ts`
- Modify: `apps/api/src/modules/learning/learning-service.ts`
- Modify: `apps/api/test/learning/learning-governance.spec.ts`
- Create: `apps/web/src/features/execution-governance/types.ts`
- Create: `apps/web/src/features/execution-governance/execution-governance-api.ts`
- Create: `apps/web/src/features/execution-governance/index.ts`
- Create: `apps/web/src/features/execution-tracking/types.ts`
- Create: `apps/web/src/features/execution-tracking/execution-tracking-api.ts`
- Create: `apps/web/src/features/execution-tracking/index.ts`
- Create: `apps/web/src/features/feedback-governance/types.ts`
- Create: `apps/web/src/features/feedback-governance/feedback-governance-api.ts`
- Create: `apps/web/src/features/feedback-governance/index.ts`

### Task 1: Add Shared Governed Execution Contracts

**Files:**
- Create: `packages/contracts/src/governed-execution.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/type-tests/governed-execution.test.ts`

- [ ] **Step 1: Write the failing type test**

```ts
import type {
  ModuleExecutionProfile,
  KnowledgeBindingRule,
  ModuleExecutionSnapshot,
  KnowledgeHitLog,
  HumanFeedbackRecord,
  LearningCandidateSourceLink,
} from "../src/index.js";

export const executionProfileStatusCheck: ModuleExecutionProfile["status"] = "active";
export const bindingPurposeCheck: KnowledgeBindingRule["binding_purpose"] = "required";
export const hitSourceCheck: KnowledgeHitLog["match_source"] = "template_binding";
export const feedbackTypeCheck: HumanFeedbackRecord["feedback_type"] = "manual_confirmation";
export const sourceLinkCheck: LearningCandidateSourceLink["learning_candidate_id"] =
  "candidate-1";
```

- [ ] **Step 2: Run typecheck to verify missing exports fail**

Run: `pnpm --filter @medical/contracts typecheck`  
Expected: FAIL because governed execution contracts do not exist yet

- [ ] **Step 3: Implement the minimal shared contracts**

```ts
export interface ModuleExecutionProfile {
  id: string;
  module: "screening" | "editing" | "proofreading";
  manuscript_type: string;
  template_family_id: string;
  module_template_id: string;
  prompt_template_id: string;
  skill_package_ids: string[];
  knowledge_binding_mode: "profile_only" | "profile_plus_dynamic";
  status: "draft" | "active" | "archived";
  version: number;
}
```

Also add:

- `KnowledgeBindingRule`
- `ModuleExecutionSnapshot`
- `KnowledgeHitLog`
- `HumanFeedbackRecord`
- `LearningCandidateSourceLink`

- [ ] **Step 4: Re-run typecheck**

Run: `pnpm --filter @medical/contracts typecheck`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/contracts
git commit -m "feat: add phase 3 governed execution contracts"
```

### Task 2: Add Execution Governance Registry

**Files:**
- Create: `apps/api/src/modules/execution-governance/execution-governance-record.ts`
- Create: `apps/api/src/modules/execution-governance/execution-governance-repository.ts`
- Create: `apps/api/src/modules/execution-governance/in-memory-execution-governance-repository.ts`
- Create: `apps/api/src/modules/execution-governance/execution-governance-service.ts`
- Create: `apps/api/src/modules/execution-governance/execution-governance-api.ts`
- Create: `apps/api/src/modules/execution-governance/index.ts`
- Test: `apps/api/test/execution-governance/execution-governance.spec.ts`

- [ ] **Step 1: Write the failing governance registry tests**

```ts
test("only admin can publish an execution profile and the previous active version is archived", async () => {
  await assert.rejects(
    () => executionGovernanceApi.publishProfile({ actorRole: "editor", profileId: "profile-1" }),
    AuthorizationError,
  );
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter @medical/api test -- execution-governance`  
Expected: FAIL because the module does not exist yet

- [ ] **Step 3: Implement the minimal execution governance registry**

Implementation rules:

- store `ModuleExecutionProfile`
- store `KnowledgeBindingRule`
- allow `admin` to publish and archive profiles only
- validate that referenced prompt templates are `published`
- validate that referenced skill packages are `published`
- validate that bound knowledge is `approved`
- ensure only one `active` profile exists per `module + manuscript_type + template_family_id`

- [ ] **Step 4: Re-run tests**

Run: `pnpm --filter @medical/api test -- execution-governance`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/execution-governance apps/api/test/execution-governance
git commit -m "feat: add execution governance registry"
```

### Task 3: Add Execution Tracking

**Files:**
- Create: `apps/api/src/modules/execution-tracking/execution-tracking-record.ts`
- Create: `apps/api/src/modules/execution-tracking/execution-tracking-repository.ts`
- Create: `apps/api/src/modules/execution-tracking/in-memory-execution-tracking-repository.ts`
- Create: `apps/api/src/modules/execution-tracking/execution-tracking-service.ts`
- Create: `apps/api/src/modules/execution-tracking/execution-tracking-api.ts`
- Create: `apps/api/src/modules/execution-tracking/index.ts`
- Test: `apps/api/test/execution-tracking/execution-tracking.spec.ts`

- [ ] **Step 1: Write the failing tracking tests**

```ts
test("execution tracking stores a frozen snapshot and per-knowledge hit reasons", async () => {
  const snapshot = await executionTrackingService.recordSnapshot({
    manuscriptId: "manuscript-1",
    module: "screening",
    jobId: "job-1",
    executionProfileId: "profile-1",
    moduleTemplateId: "template-1",
    promptTemplateId: "prompt-1",
    skillPackageIds: ["skill-1"],
    modelId: "model-1",
    knowledgeHits: [
      {
        knowledgeItemId: "knowledge-1",
        matchSource: "template_binding",
        matchReasons: ["template_family"],
      },
    ],
  });

  assert.equal(snapshot.knowledge_item_ids[0], "knowledge-1");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter @medical/api test -- execution-tracking`  
Expected: FAIL because execution tracking does not exist

- [ ] **Step 3: Implement the minimal tracking service**

Implementation rules:

- record one `ModuleExecutionSnapshot` per module run
- record one `KnowledgeHitLog` per knowledge item hit
- keep hit reasons explicit instead of recomputing later

- [ ] **Step 4: Re-run tests**

Run: `pnpm --filter @medical/api test -- execution-tracking`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/execution-tracking apps/api/test/execution-tracking
git commit -m "feat: add execution tracking"
```

### Task 4: Add Feedback Governance And Learning Source Links

**Files:**
- Create: `apps/api/src/modules/feedback-governance/feedback-governance-record.ts`
- Create: `apps/api/src/modules/feedback-governance/feedback-governance-repository.ts`
- Create: `apps/api/src/modules/feedback-governance/in-memory-feedback-governance-repository.ts`
- Create: `apps/api/src/modules/feedback-governance/feedback-governance-service.ts`
- Create: `apps/api/src/modules/feedback-governance/feedback-governance-api.ts`
- Create: `apps/api/src/modules/feedback-governance/index.ts`
- Test: `apps/api/test/feedback-governance/feedback-governance.spec.ts`

- [ ] **Step 1: Write the failing feedback tests**

```ts
test("learning source links require a snapshot, human feedback, and a source asset", async () => {
  await assert.rejects(
    () =>
      feedbackGovernanceService.linkLearningCandidateSource({
        learningCandidateId: "candidate-1",
        snapshotId: "missing",
        feedbackRecordId: "feedback-1",
        sourceAssetId: "asset-1",
      }),
    ReviewedCaseSnapshotNotFoundError,
  );
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter @medical/api test -- feedback-governance`  
Expected: FAIL because feedback governance does not exist yet

- [ ] **Step 3: Implement the minimal feedback governance layer**

Implementation rules:

- persist `HumanFeedbackRecord`
- persist `LearningCandidateSourceLink`
- require complete provenance before linking to a learning candidate
- keep feedback module-scoped and manuscript-scoped

- [ ] **Step 4: Re-run tests**

Run: `pnpm --filter @medical/api test -- feedback-governance`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/feedback-governance apps/api/test/feedback-governance
git commit -m "feat: add feedback governance and learning source links"
```

### Task 5: Extend Prompt And Skill Registry For Published Execution Assets

**Files:**
- Modify: `apps/api/src/modules/prompt-skill-registry/prompt-skill-record.ts`
- Modify: `apps/api/src/modules/prompt-skill-registry/prompt-skill-repository.ts`
- Modify: `apps/api/src/modules/prompt-skill-registry/in-memory-prompt-skill-repository.ts`
- Modify: `apps/api/src/modules/prompt-skill-registry/prompt-skill-service.ts`
- Modify: `apps/api/src/modules/prompt-skill-registry/prompt-skill-api.ts`
- Modify: `apps/api/src/modules/prompt-skill-registry/index.ts`
- Test: `apps/api/test/prompt-skill-registry/prompt-skill-registry.spec.ts`

- [ ] **Step 1: Write the failing publish lifecycle tests**

```ts
test("prompt templates and skill packages can be published and archived without in-place overwrite", async () => {
  const created = await promptSkillApi.createPromptTemplate({
    actorRole: "admin",
    input: {
      name: "screening_mainline",
      version: "1.0.0",
      module: "screening",
      manuscriptTypes: ["clinical_study"],
    },
  });

  const published = await promptSkillApi.publishPromptTemplate({
    actorRole: "admin",
    promptTemplateId: created.body.id,
  });

  assert.equal(published.body.status, "published");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter @medical/api test -- prompt-skill-registry`  
Expected: FAIL because publish lifecycle is missing

- [ ] **Step 3: Implement publish lifecycle support**

Implementation rules:

- support `draft`, `published`, `archived`
- publishing a new prompt or skill package version must not mutate the old record in place
- provide list/filter helpers needed by execution governance

- [ ] **Step 4: Re-run tests**

Run: `pnpm --filter @medical/api test -- prompt-skill-registry`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/prompt-skill-registry apps/api/test/prompt-skill-registry
git commit -m "feat: add publish lifecycle for prompt and skill assets"
```

### Task 6: Add Governed Module Context Resolver

**Files:**
- Create: `apps/api/src/modules/shared/governed-module-context-resolver.ts`
- Test: `apps/api/test/modules/governed-module-context-resolver.spec.ts`
- Modify: `apps/api/src/modules/shared/module-run-support.ts`

- [ ] **Step 1: Write the failing resolver tests**

```ts
test("resolver returns the active execution profile with frozen template, prompt, skill, knowledge, and model context", async () => {
  const context = await resolveGovernedModuleContext({
    manuscriptId: "manuscript-1",
    module: "editing",
    jobId: "job-1",
    actorId: "editor-1",
    actorRole: "editor",
    manuscriptRepository,
    executionGovernanceService,
    promptSkillRegistryService,
    knowledgeRepository,
    aiGatewayService,
  });

  assert.equal(context.executionProfile.id, "profile-1");
  assert.equal(context.promptTemplate.id, "prompt-editing-1");
  assert.equal(context.skillPackages[0]?.id, "skill-editing-1");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter @medical/api test -- governed-module-context-resolver`  
Expected: FAIL because the resolver does not exist

- [ ] **Step 3: Implement the resolver and refactor shared module preparation**

Implementation rules:

- resolve the active profile by `module + manuscript_type + current_template_family_id`
- fail explicitly when no `active` execution profile exists for the current module context
- freeze published prompt and skill assets into the returned context
- combine bound knowledge and approved dynamic knowledge without duplicating items
- return explicit hit reasons for each selected knowledge item
- reuse the current AI gateway for model selection

- [ ] **Step 4: Re-run tests**

Run: `pnpm --filter @medical/api test -- governed-module-context-resolver`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/shared apps/api/test/modules/governed-module-context-resolver.spec.ts
git commit -m "feat: add governed module context resolver"
```

### Task 7: Integrate Screening, Editing, And Proofreading With Governed Execution

**Files:**
- Modify: `apps/api/src/modules/screening/screening-service.ts`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/test/modules/module-orchestration.spec.ts`

- [ ] **Step 1: Write the failing integration expectations**

Add assertions to existing module orchestration tests:

```ts
assert.equal(response.body.execution_profile_id, "profile-screening-1");
assert.equal(response.body.prompt_template_id, "prompt-screening-1");
assert.deepEqual(response.body.skill_package_ids, ["skill-screening-1"]);
assert.equal(response.body.snapshot_id, "snapshot-screening-1");
```

- [ ] **Step 2: Run module tests to verify failure**

Run: `pnpm --filter @medical/api test -- modules`  
Expected: FAIL because modules do not expose governed execution outputs yet

- [ ] **Step 3: Integrate modules with the resolver and tracking**

Implementation rules:

- all three modules must consume the governed context resolver
- all three modules must write execution snapshots after successful runs
- all three modules must emit knowledge hit logs through execution tracking
- proofreading final confirmation must reuse the draft-stage frozen governed context
- proofreading final confirmation should expose or internally preserve the draft snapshot linkage for future provenance queries

- [ ] **Step 4: Re-run module tests**

Run: `pnpm --filter @medical/api test -- modules`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/screening apps/api/src/modules/editing apps/api/src/modules/proofreading apps/api/test/modules
git commit -m "feat: route manuscript modules through governed execution"
```

### Task 8: Connect Learning Governance To Feedback Provenance

**Files:**
- Modify: `apps/api/src/modules/learning/learning-service.ts`
- Modify: `apps/api/test/learning/learning-governance.spec.ts`

- [ ] **Step 1: Write the failing provenance tests**

```ts
test("learning candidates require a linked execution snapshot and human feedback record before governance approval", async () => {
  await assert.rejects(
    () =>
      learningService.attachGovernedSource({
        candidateId: "candidate-1",
        snapshotId: "snapshot-1",
        feedbackRecordId: "feedback-1",
        sourceAssetId: "asset-1",
      }),
    LearningCandidateSourceLinkNotFoundError,
  );
});
```

- [ ] **Step 2: Run learning tests to verify failure**

Run: `pnpm --filter @medical/api test -- learning`  
Expected: FAIL because learning provenance link support is missing

- [ ] **Step 3: Extend learning governance**

Implementation rules:

- allow learning candidates to be linked to governed provenance
- require complete provenance before advancing reviewable candidates
- preserve current de-identification and human-final asset gates

- [ ] **Step 4: Re-run learning tests**

Run: `pnpm --filter @medical/api test -- learning`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/learning apps/api/test/learning
git commit -m "feat: add governed provenance to learning candidates"
```

### Task 9: Add Typed Web Clients For Governance And Tracking

**Files:**
- Create: `apps/web/src/features/execution-governance/types.ts`
- Create: `apps/web/src/features/execution-governance/execution-governance-api.ts`
- Create: `apps/web/src/features/execution-governance/index.ts`
- Create: `apps/web/src/features/execution-tracking/types.ts`
- Create: `apps/web/src/features/execution-tracking/execution-tracking-api.ts`
- Create: `apps/web/src/features/execution-tracking/index.ts`
- Create: `apps/web/src/features/feedback-governance/types.ts`
- Create: `apps/web/src/features/feedback-governance/feedback-governance-api.ts`
- Create: `apps/web/src/features/feedback-governance/index.ts`
- Create: `apps/web/src/features/governance-clients.type-test.ts`

- [ ] **Step 1: Write the failing type surface expectations**

Expected view models:

```ts
type ExecutionProfileStatus = "draft" | "active" | "archived";
type FeedbackType = "manual_confirmation" | "manual_correction" | "manual_rejection";
```

Write them in a dedicated type-test module so the failure is real before the clients exist.

- [ ] **Step 2: Run web typecheck to verify failure**

Run: `pnpm --filter @medsys/web typecheck`  
Expected: FAIL if governance feature types are referenced before being defined

- [ ] **Step 3: Implement minimal typed clients**

Implementation rules:

- match the API record shapes closely
- no page components yet
- keep admin-only governance types distinct from business execution types

- [ ] **Step 4: Re-run web typecheck**

Run: `pnpm --filter @medsys/web typecheck`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/execution-governance apps/web/src/features/execution-tracking apps/web/src/features/feedback-governance
git commit -m "feat: add phase 3 governance web clients"
```

## Final Verification Gate

- [ ] Run: `pnpm --filter @medical/contracts typecheck`
- [ ] Run: `pnpm --filter @medical/api test -- execution-governance`
- [ ] Run: `pnpm --filter @medical/api test -- execution-tracking`
- [ ] Run: `pnpm --filter @medical/api test -- feedback-governance`
- [ ] Run: `pnpm --filter @medical/api test -- prompt-skill-registry`
- [ ] Run: `pnpm --filter @medical/api test -- modules`
- [ ] Run: `pnpm --filter @medical/api test -- learning`
- [ ] Run: `pnpm --filter @medical/api typecheck`
- [ ] Run: `pnpm --filter @medsys/web typecheck`
- [ ] Run: `pnpm test`

## Acceptance Criteria

- Screening, editing, and proofreading resolve context through a published execution profile.
- A module execution snapshot records the frozen template, prompt, skill package, model, and knowledge set used for a run.
- Knowledge hit logs preserve why each knowledge item was selected.
- Prompt templates and skill packages can be published and then referenced by execution profiles.
- Human feedback can be linked to execution snapshots and then attached to learning candidates as provenance.
- Proofreading final output continues to use the draft-stage governed context after human confirmation.
- Phase 3 remains backend-first and does not force a UI-heavy refactor.
