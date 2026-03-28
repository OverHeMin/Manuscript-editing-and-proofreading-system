# Phase 5 Learning Governance Writeback Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Phase 5 learning loop so approved learning candidates can be converted into governed draft updates for knowledge items, module templates, prompt templates, and skill packages with full provenance and auditability.

**Architecture:** Keep the current Phase 3 and Phase 4 governance layers intact, and add one new `learning-governance` slice that sits between approved learning candidates and admin-governed asset registries. The new slice should never auto-publish production assets. Instead, it creates explicit writeback records and draft registry assets that still flow through the existing publish controls in `knowledge`, `templates`, `prompt-skill-registry`, and `execution-governance`.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, current in-memory repository pattern, existing learning/feedback/execution governance modules, current web typed-client pattern.

---

## Scope Notes

- This phase is still governance-first and admin-first.
- Business users do not receive raw writeback controls.
- `knowledge_reviewer` remains the approval role for learning candidates.
- `admin` remains the role that can apply approved candidates into governed draft assets.
- Applying a candidate creates draft assets or draft governance records only. Normal publish flows stay unchanged.
- This phase deliberately avoids building the full admin UI shell. It stays consistent with the current repo pattern: API slices plus typed web feature clients.

## Planned File Structure

- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/learning.ts`
- Create: `packages/contracts/src/learning-governance.ts`
- Create: `packages/contracts/type-tests/learning-governance.test.ts`
- Modify: `apps/api/src/modules/learning/learning-record.ts`
- Modify: `apps/api/src/modules/learning/learning-repository.ts`
- Modify: `apps/api/src/modules/learning/in-memory-learning-repository.ts`
- Modify: `apps/api/src/modules/learning/learning-service.ts`
- Modify: `apps/api/src/modules/learning/learning-api.ts`
- Modify: `apps/api/test/learning/learning-governance.spec.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-record.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-repository.ts`
- Modify: `apps/api/src/modules/knowledge/in-memory-knowledge-repository.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-service.ts`
- Modify: `apps/api/test/knowledge/knowledge-governance.spec.ts`
- Modify: `apps/api/src/modules/templates/template-record.ts`
- Modify: `apps/api/src/modules/templates/template-repository.ts`
- Modify: `apps/api/src/modules/templates/in-memory-template-family-repository.ts`
- Modify: `apps/api/src/modules/templates/template-governance-service.ts`
- Modify: `apps/api/test/templates/template-governance.spec.ts`
- Modify: `apps/api/src/modules/prompt-skill-registry/prompt-skill-record.ts`
- Modify: `apps/api/src/modules/prompt-skill-registry/prompt-skill-repository.ts`
- Modify: `apps/api/src/modules/prompt-skill-registry/in-memory-prompt-skill-repository.ts`
- Modify: `apps/api/src/modules/prompt-skill-registry/prompt-skill-service.ts`
- Modify: `apps/api/test/prompt-skill-registry/prompt-skill-registry.spec.ts`
- Create: `apps/api/src/modules/learning-governance/learning-governance-record.ts`
- Create: `apps/api/src/modules/learning-governance/learning-governance-repository.ts`
- Create: `apps/api/src/modules/learning-governance/in-memory-learning-governance-repository.ts`
- Create: `apps/api/src/modules/learning-governance/learning-governance-service.ts`
- Create: `apps/api/src/modules/learning-governance/learning-governance-api.ts`
- Create: `apps/api/src/modules/learning-governance/index.ts`
- Create: `apps/api/test/learning-governance/learning-governance.spec.ts`
- Modify: `apps/web/src/features/learning-review/types.ts`
- Modify: `apps/web/src/features/learning-review/learning-review-api.ts`
- Create: `apps/web/src/features/learning-governance/types.ts`
- Create: `apps/web/src/features/learning-governance/learning-governance-api.ts`
- Create: `apps/web/src/features/learning-governance/index.ts`
- Create: `apps/web/src/features/learning-governance.type-test.ts`

### Task 1: Extend Shared Learning Contracts For Writeback Governance

**Files:**
- Modify: `packages/contracts/src/learning.ts`
- Create: `packages/contracts/src/learning-governance.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/type-tests/learning-governance.test.ts`

- [ ] **Step 1: Write the failing type test**

```ts
import type {
  LearningCandidate,
  LearningWriteback,
  LearningWritebackTarget,
} from "../src/index.js";

export const learningCandidateTypeCheck: LearningCandidate["type"] =
  "skill_update_candidate";
export const writebackTargetCheck: LearningWritebackTarget = "prompt_template";
export const writebackStatusCheck: LearningWriteback["status"] = "applied";
```

- [ ] **Step 2: Run typecheck to verify missing exports fail**

Run: `pnpm --filter @medical/contracts typecheck`
Expected: FAIL because the writeback governance contracts do not exist yet

- [ ] **Step 3: Implement the minimal shared contracts**

Implementation rules:

- extend learning candidate types with `skill_update_candidate`
- add `LearningWritebackTarget`
- add `LearningWriteback`
- add optional provenance fields for governed assets such as `source_learning_candidate_id`
- keep contract additions additive so current Phase 3 and Phase 4 code stays compatible

- [ ] **Step 4: Re-run typecheck**

Run: `pnpm --filter @medical/contracts typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/contracts
git commit -m "feat: add phase 5 learning governance contracts"
```

### Task 2: Add Provenance-Aware Draft Helpers To Governed Asset Registries

**Files:**
- Modify: `apps/api/src/modules/knowledge/knowledge-record.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-repository.ts`
- Modify: `apps/api/src/modules/knowledge/in-memory-knowledge-repository.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-service.ts`
- Modify: `apps/api/src/modules/templates/template-record.ts`
- Modify: `apps/api/src/modules/templates/template-repository.ts`
- Modify: `apps/api/src/modules/templates/in-memory-template-family-repository.ts`
- Modify: `apps/api/src/modules/templates/template-governance-service.ts`
- Modify: `apps/api/src/modules/prompt-skill-registry/prompt-skill-record.ts`
- Modify: `apps/api/src/modules/prompt-skill-registry/prompt-skill-repository.ts`
- Modify: `apps/api/src/modules/prompt-skill-registry/in-memory-prompt-skill-repository.ts`
- Modify: `apps/api/src/modules/prompt-skill-registry/prompt-skill-service.ts`
- Test: `apps/api/test/knowledge/knowledge-governance.spec.ts`
- Test: `apps/api/test/templates/template-governance.spec.ts`
- Test: `apps/api/test/prompt-skill-registry/prompt-skill-registry.spec.ts`

- [ ] **Step 1: Write the failing registry helper tests**

Add expectations for:

- creating a knowledge draft from an approved learning candidate
- creating a module template draft revision from an approved learning candidate
- creating a prompt template draft revision from an approved learning candidate
- creating a skill package draft revision from an approved learning candidate
- all new draft assets persist `source_learning_candidate_id`

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter @medical/api test -- knowledge`
Expected: FAIL because governed draft provenance helpers do not exist

Run: `pnpm --filter @medical/api test -- templates`
Expected: FAIL because template draft revision helpers do not exist

Run: `pnpm --filter @medical/api test -- prompt-skill-registry`
Expected: FAIL because provenance-aware prompt and skill draft helpers do not exist

- [ ] **Step 3: Implement the minimal provenance-aware draft helpers**

Implementation rules:

- only `admin` can create governed writeback drafts in prompt, skill, and template registries
- draft helpers must require an approved learning candidate id
- draft helpers must not auto-publish
- draft helpers should reuse current registry versioning rules instead of inventing a second version sequence
- knowledge drafts created from learning candidates should still pass through the existing knowledge review lifecycle

- [ ] **Step 4: Re-run tests**

Run: `pnpm --filter @medical/api test -- knowledge`
Expected: PASS

Run: `pnpm --filter @medical/api test -- templates`
Expected: PASS

Run: `pnpm --filter @medical/api test -- prompt-skill-registry`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/knowledge apps/api/src/modules/templates apps/api/src/modules/prompt-skill-registry apps/api/test/knowledge apps/api/test/templates apps/api/test/prompt-skill-registry
git commit -m "feat: add provenance-aware governed draft helpers"
```

### Task 3: Add Learning Governance Writeback Registry

**Files:**
- Modify: `apps/api/src/modules/learning/learning-record.ts`
- Modify: `apps/api/src/modules/learning/learning-repository.ts`
- Modify: `apps/api/src/modules/learning/in-memory-learning-repository.ts`
- Modify: `apps/api/src/modules/learning/learning-service.ts`
- Modify: `apps/api/src/modules/learning/learning-api.ts`
- Create: `apps/api/src/modules/learning-governance/learning-governance-record.ts`
- Create: `apps/api/src/modules/learning-governance/learning-governance-repository.ts`
- Create: `apps/api/src/modules/learning-governance/in-memory-learning-governance-repository.ts`
- Create: `apps/api/src/modules/learning-governance/learning-governance-service.ts`
- Create: `apps/api/src/modules/learning-governance/learning-governance-api.ts`
- Create: `apps/api/src/modules/learning-governance/index.ts`
- Test: `apps/api/test/learning/learning-governance.spec.ts`
- Test: `apps/api/test/learning-governance/learning-governance.spec.ts`

- [ ] **Step 1: Write the failing writeback-governance tests**

Test for:

- only approved learning candidates can create writeback records
- only `admin` can apply a writeback into governed assets
- one candidate can generate multiple explicit writebacks for different targets
- each applied writeback stores target kind, created draft asset id, actor, and timestamps
- a candidate cannot be applied twice to the same target kind when an active writeback already exists

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter @medical/api test -- learning-governance`
Expected: FAIL because the writeback registry does not exist

Run: `pnpm --filter @medical/api test -- learning`
Expected: FAIL because learning candidate metadata does not expose writeback linkage yet

- [ ] **Step 3: Implement the minimal writeback registry**

Implementation rules:

- keep candidate approval in the existing `learning` module
- add a separate `learning-governance` module for writeback records and apply operations
- support target kinds: `knowledge_item`, `module_template`, `prompt_template`, `skill_package`
- apply operations must create draft assets through the existing governed services instead of writing raw records directly
- expose writeback linkage back on learning candidates additively rather than replacing the current API shape

- [ ] **Step 4: Re-run tests**

Run: `pnpm --filter @medical/api test -- learning-governance`
Expected: PASS

Run: `pnpm --filter @medical/api test -- learning`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/learning apps/api/src/modules/learning-governance apps/api/test/learning apps/api/test/learning-governance
git commit -m "feat: add learning governance writeback registry"
```

### Task 4: Add Phase 5 Admin Typed Web Clients

**Files:**
- Modify: `apps/web/src/features/learning-review/types.ts`
- Modify: `apps/web/src/features/learning-review/learning-review-api.ts`
- Create: `apps/web/src/features/learning-governance/types.ts`
- Create: `apps/web/src/features/learning-governance/learning-governance-api.ts`
- Create: `apps/web/src/features/learning-governance/index.ts`
- Test: `apps/web/src/features/learning-governance.type-test.ts`

- [ ] **Step 1: Write the failing web type test**

Expected imports:

```ts
import {
  applyLearningWriteback,
  createLearningWriteback,
  listLearningWritebacksByCandidate,
  type CreateLearningWritebackInput,
  type LearningWritebackTarget,
  type LearningWritebackViewModel,
} from "./learning-governance/index.ts";
```

Add expectations that `learning-review` types now expose writeback summaries.

- [ ] **Step 2: Run typecheck to verify failure**

Run: `pnpm --filter @medsys/web typecheck`
Expected: FAIL because the Phase 5 learning governance clients do not exist yet

- [ ] **Step 3: Implement the minimal typed clients**

Implementation rules:

- keep the web layer page-less for now
- align the request bodies with the current API client pattern used by Phase 3 and Phase 4
- surface writeback provenance and target metadata in `learning-review` so a future admin workbench can render candidate state without extra glue code

- [ ] **Step 4: Re-run typecheck**

Run: `pnpm --filter @medsys/web typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/learning-review apps/web/src/features/learning-governance apps/web/src/features/learning-governance.type-test.ts
git commit -m "feat: add phase 5 learning governance clients"
```

## Final Verification Gate

- [ ] Run: `pnpm --filter @medical/contracts typecheck`
- [ ] Run: `pnpm --filter @medical/api test -- knowledge`
- [ ] Run: `pnpm --filter @medical/api test -- templates`
- [ ] Run: `pnpm --filter @medical/api test -- prompt-skill-registry`
- [ ] Run: `pnpm --filter @medical/api test -- learning`
- [ ] Run: `pnpm --filter @medical/api test -- learning-governance`
- [ ] Run: `pnpm --filter @medical/api test -- modules`
- [ ] Run: `pnpm --filter @medical/api typecheck`
- [ ] Run: `pnpm --filter @medsys/web typecheck`
- [ ] Run: `pnpm test`

## Acceptance Criteria

- Approved learning candidates can be converted into explicit governed writeback records instead of stopping at review approval.
- Applying a learning writeback produces draft governed assets only, preserving the current publish gates for knowledge, templates, prompts, and skills.
- Governed assets created from learning writebacks keep `source_learning_candidate_id` provenance for audit and rollback review.
- `knowledge_reviewer` still controls learning approval, while `admin` controls writeback application into governed asset registries.
- One approved learning candidate can drive multiple writeback targets, but the system prevents duplicate active writebacks for the same target kind.
- Web code remains consistent with the existing repo pattern: typed feature clients first, no premature page implementation.
