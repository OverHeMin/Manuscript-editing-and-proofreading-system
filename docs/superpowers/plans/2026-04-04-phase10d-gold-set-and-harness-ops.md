# Phase 10D Gold Set And Harness Ops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a governed local-first gold-set and rubric operations layer so later harness tools can consume published human-curated datasets without changing the existing production manuscript path.

**Architecture:** Add a dedicated `harness-datasets` governance module instead of overloading `verification-ops`, `learning-governance`, or `knowledge-review`. Keep dataset curation and rubric publication as explicit governed assets, add additive handoff entry points from reviewed snapshots and evaluation evidence, and expose a bounded operator workbench for promotion, review, sampling, and export.

**Tech Stack:** TypeScript, PostgreSQL raw SQL migrations, React/Vite, node:test via `tsx`, Playwright, existing learning-review/knowledge-review/evaluation-workbench patterns, local file export scripts.

---

## Scope Notes

- Do not make gold-set publication a requirement for live manuscript execution.
- Do not push raw manuscript payloads to any cloud or external dataset platform in this slice.
- Do not collapse `verification-ops` sample sets into gold sets; keep execution assets and governed reference assets separate.
- Do not auto-promote learning candidates or reviewed snapshots into gold sets.
- Rubric publication may define scoring dimensions and examples, but later automated judge usage remains a follow-up concern.

## Planned File Structure

- API persistence and governance module:
  - Modify: `apps/api/src/database/migrations/0016_harness_dataset_governance.sql`
  - Create: `apps/api/src/modules/harness-datasets/harness-dataset-record.ts`
  - Create: `apps/api/src/modules/harness-datasets/harness-dataset-repository.ts`
  - Create: `apps/api/src/modules/harness-datasets/in-memory-harness-dataset-repository.ts`
  - Create: `apps/api/src/modules/harness-datasets/postgres-harness-dataset-repository.ts`
  - Create: `apps/api/src/modules/harness-datasets/harness-dataset-service.ts`
  - Create: `apps/api/src/modules/harness-datasets/harness-dataset-api.ts`
  - Create: `apps/api/src/modules/harness-datasets/index.ts`
  - Test: `apps/api/test/harness-datasets/harness-dataset-service.spec.ts`
  - Test: `apps/api/test/harness-datasets/postgres-harness-dataset-persistence.spec.ts`
- Handoff integration:
  - Modify: `apps/api/src/modules/learning-governance/learning-governance-api.ts`
  - Modify: `apps/api/src/modules/knowledge/knowledge-api.ts`
  - Modify: `apps/api/src/modules/verification-ops/verification-ops-api.ts`
  - Modify: `apps/api/src/http/api-http-server.ts`
  - Modify: `apps/api/src/http/persistent-governance-runtime.ts`
  - Test: `apps/api/test/http/persistent-governance-http.spec.ts`
- Web workbench:
  - Create: `apps/web/src/features/harness-datasets/types.ts`
  - Create: `apps/web/src/features/harness-datasets/harness-datasets-api.ts`
  - Create: `apps/web/src/features/harness-datasets/harness-datasets-controller.ts`
  - Create: `apps/web/src/features/harness-datasets/harness-datasets-workbench-page.tsx`
  - Create: `apps/web/src/features/harness-datasets/harness-datasets-workbench.css`
  - Create: `apps/web/src/features/harness-datasets/index.ts`
  - Modify: `apps/web/src/app/workbench-routing.ts`
  - Test: `apps/web/test/harness-datasets-controller.spec.ts`
  - Test: `apps/web/test/harness-datasets-workbench-page.spec.tsx`
- Local export scripts and docs:
  - Create: `scripts/harness/export-gold-set-json.mjs`
  - Create: `scripts/harness/export-gold-set-jsonl.mjs`
  - Modify: `README.md`

## Planned Tasks

### Task 1: Create The Governed Gold Set And Rubric Module

**Files:**
- Modify: `apps/api/src/database/migrations/0016_harness_dataset_governance.sql`
- Create: `apps/api/src/modules/harness-datasets/harness-dataset-record.ts`
- Create: `apps/api/src/modules/harness-datasets/harness-dataset-repository.ts`
- Create: `apps/api/src/modules/harness-datasets/in-memory-harness-dataset-repository.ts`
- Create: `apps/api/src/modules/harness-datasets/postgres-harness-dataset-repository.ts`
- Create: `apps/api/src/modules/harness-datasets/harness-dataset-service.ts`
- Create: `apps/api/src/modules/harness-datasets/harness-dataset-api.ts`
- Create: `apps/api/src/modules/harness-datasets/index.ts`
- Test: `apps/api/test/harness-datasets/harness-dataset-service.spec.ts`
- Test: `apps/api/test/harness-datasets/postgres-harness-dataset-persistence.spec.ts`

- [ ] **Step 1: Write the failing service and persistence tests**

Add coverage that proves:

```ts
assert.equal(createdFamily.scope.module, "screening");
assert.equal(createdVersion.status, "draft");
assert.equal(createdVersion.item_count, 3);
assert.equal(createdRubric.status, "published");
```

Add lifecycle assertions for:

- family creation
- draft version updates
- publish-only when all items are de-identified and human-reviewed
- archived historical versions remain immutable

- [ ] **Step 2: Run the targeted API tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/harness-datasets/harness-dataset-service.spec.ts test/harness-datasets/postgres-harness-dataset-persistence.spec.ts
```

Expected: FAIL because the new governance module, migration, and records do not exist yet.

- [ ] **Step 3: Implement the new records, repositories, service, API, and migration**

Implementation rules:

- keep gold sets and rubrics in a dedicated module named `harness-datasets`
- separate:
  - family identity
  - immutable dataset version payload
  - rubric version payload
  - publication/export audit history
- require explicit de-identification and human-review flags before publication
- keep item membership additive and versioned; do not mutate published versions in place
- store source provenance links back to reviewed snapshots, human final assets, or evaluation evidence

- [ ] **Step 4: Re-run the targeted API tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/harness-datasets/harness-dataset-service.spec.ts test/harness-datasets/postgres-harness-dataset-persistence.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the gold-set governance slice**

Run:

```bash
git add apps/api/src/database/migrations/0016_harness_dataset_governance.sql apps/api/src/modules/harness-datasets apps/api/test/harness-datasets
git commit -m "feat: add harness dataset governance"
```

### Task 2: Add Governed Handoff Paths Into Harness Dataset Candidates

**Files:**
- Modify: `apps/api/src/modules/learning-governance/learning-governance-api.ts`
- Modify: `apps/api/src/modules/knowledge/knowledge-api.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-api.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Test: `apps/api/test/http/persistent-governance-http.spec.ts`

- [ ] **Step 1: Write the failing HTTP tests**

Add coverage that proves operators can create draft harness-dataset candidates from:

- a reviewed snapshot
- a human final asset
- a finalized evaluation evidence pack

Example assertions:

```ts
assert.equal(response.body.source_kind, "reviewed_case_snapshot");
assert.equal(response.body.draft_family_id, "family-1");
assert.equal(response.body.requires_manual_rubric_assignment, true);
```

- [ ] **Step 2: Run the targeted HTTP tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/http/persistent-governance-http.spec.ts
```

Expected: FAIL because no harness-dataset handoff routes exist yet.

- [ ] **Step 3: Implement additive handoff endpoints**

Implementation rules:

- keep handoff additive; do not auto-publish
- allow operators to create draft candidates from existing governed assets
- require explicit rubric assignment before publication
- preserve existing learning-review and evaluation-review flows

- [ ] **Step 4: Re-run the targeted HTTP tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/http/persistent-governance-http.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the handoff slice**

Run:

```bash
git add apps/api/src/modules/learning-governance/learning-governance-api.ts apps/api/src/modules/knowledge/knowledge-api.ts apps/api/src/modules/verification-ops/verification-ops-api.ts apps/api/src/http/api-http-server.ts apps/api/src/http/persistent-governance-runtime.ts apps/api/test/http/persistent-governance-http.spec.ts
git commit -m "feat: add harness dataset handoff routes"
```

### Task 3: Build The Harness Dataset Workbench And Local Export Scripts

**Files:**
- Create: `apps/web/src/features/harness-datasets/types.ts`
- Create: `apps/web/src/features/harness-datasets/harness-datasets-api.ts`
- Create: `apps/web/src/features/harness-datasets/harness-datasets-controller.ts`
- Create: `apps/web/src/features/harness-datasets/harness-datasets-workbench-page.tsx`
- Create: `apps/web/src/features/harness-datasets/harness-datasets-workbench.css`
- Create: `apps/web/src/features/harness-datasets/index.ts`
- Modify: `apps/web/src/app/workbench-routing.ts`
- Test: `apps/web/test/harness-datasets-controller.spec.ts`
- Test: `apps/web/test/harness-datasets-workbench-page.spec.tsx`
- Create: `scripts/harness/export-gold-set-json.mjs`
- Create: `scripts/harness/export-gold-set-jsonl.mjs`

- [ ] **Step 1: Write the failing web and export tests**

Add coverage that proves the workbench can:

- list draft and published gold-set versions
- show rubric assignment status
- preview source provenance
- trigger local JSON/JSONL export

- [ ] **Step 2: Run the targeted web tests and confirm they fail**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/harness-datasets-controller.spec.ts test/harness-datasets-workbench-page.spec.tsx
```

Expected: FAIL because the workbench and export scripts do not exist yet.

- [ ] **Step 3: Implement the bounded operator workbench and local exports**

Implementation rules:

- keep the page focused on:
  - curation queue
  - published versions
  - rubric linkage
  - local export actions
- do not add cloud push buttons in this phase
- export only published versions
- preserve local-first file output under a bounded harness export directory

- [ ] **Step 4: Re-run the targeted web tests and confirm they pass**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/harness-datasets-controller.spec.ts test/harness-datasets-workbench-page.spec.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit the workbench slice**

Run:

```bash
git add apps/web/src/features/harness-datasets apps/web/src/app/workbench-routing.ts apps/web/test/harness-datasets-controller.spec.ts apps/web/test/harness-datasets-workbench-page.spec.tsx scripts/harness/export-gold-set-json.mjs scripts/harness/export-gold-set-jsonl.mjs
git commit -m "feat: add harness dataset workbench"
```

### Task 4: Sync Docs And Verify The New Boundary

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update docs**

Document:

- the difference between gold sets and `verification-ops` sample sets
- local-first export-only boundary
- the fact that rubric calibration remains human-owned

- [ ] **Step 2: Run the targeted verification commands**

Run:

```bash
pnpm --filter @medical/api run typecheck
pnpm --filter @medsys/web run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit docs**

Run:

```bash
git add README.md
git commit -m "docs: describe gold set and harness ops boundary"
```
