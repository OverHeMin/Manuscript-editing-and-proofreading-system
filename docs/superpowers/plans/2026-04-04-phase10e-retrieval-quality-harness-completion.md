# Phase 10E Retrieval Quality Harness Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a local-first retrieval substrate with `pgvector`, reproducible retrieval snapshots, and Ragas-backed retrieval-quality evaluation so knowledge grounding can be measured and improved safely.

**Architecture:** Add a dedicated `knowledge-retrieval` module instead of burying vector search and snapshot logic inside the current `knowledge-service`. Pair the new retrieval substrate with a local Python runner for Ragas, export published gold-set data into retrieval-eval datasets, and write retrieval-quality outputs back into governed evidence records without making retrieval evaluation a live runtime dependency.

**Tech Stack:** TypeScript, PostgreSQL raw SQL migrations with `pgvector`, Python 3.12, Ragas, React/Vite typed clients, node:test via `tsx`, pytest, local-only evaluation scripts.

---

## Scope Notes

- Do not require cloud embeddings, cloud rerankers, or cloud eval platforms in this slice.
- Do not auto-publish knowledge or template changes based on retrieval metrics.
- Do not couple live manuscript execution to Ragas availability.
- Keep retrieval snapshots additive and reproducible; do not hide retrieval inputs inside opaque logs only.
- Reuse `Phase 10D` published gold sets as the only supported v1 harness dataset source.

## Planned File Structure

- Retrieval persistence and services:
  - Modify: `apps/api/src/database/migrations/0017_retrieval_quality_harness.sql`
  - Create: `apps/api/src/modules/knowledge-retrieval/knowledge-retrieval-record.ts`
  - Create: `apps/api/src/modules/knowledge-retrieval/knowledge-retrieval-repository.ts`
  - Create: `apps/api/src/modules/knowledge-retrieval/in-memory-knowledge-retrieval-repository.ts`
  - Create: `apps/api/src/modules/knowledge-retrieval/postgres-knowledge-retrieval-repository.ts`
  - Create: `apps/api/src/modules/knowledge-retrieval/knowledge-retrieval-service.ts`
  - Create: `apps/api/src/modules/knowledge-retrieval/knowledge-retrieval-api.ts`
  - Create: `apps/api/src/modules/knowledge-retrieval/index.ts`
  - Test: `apps/api/test/knowledge-retrieval/knowledge-retrieval-service.spec.ts`
  - Test: `apps/api/test/knowledge-retrieval/postgres-knowledge-retrieval-persistence.spec.ts`
- Knowledge and runtime integration:
  - Modify: `apps/api/src/modules/knowledge/knowledge-service.ts`
  - Modify: `apps/api/src/modules/templates/template-governance-service.ts`
  - Modify: `apps/api/src/modules/shared/governed-agent-context-resolver.ts`
  - Modify: `apps/api/src/modules/verification-ops/verification-ops-record.ts`
  - Modify: `apps/api/src/modules/verification-ops/verification-ops-service.ts`
  - Modify: `apps/api/src/http/api-http-server.ts`
  - Modify: `apps/api/src/http/persistent-governance-runtime.ts`
  - Test: `apps/api/test/http/persistent-governance-http.spec.ts`
- Local evaluation runners:
  - Create: `apps/worker-py/src/harness_runners/__init__.py`
  - Create: `apps/worker-py/src/harness_runners/ragas_runner.py`
  - Create: `apps/worker-py/tests/harness_runners/test_ragas_runner.py`
  - Create: `scripts/harness/export-ragas-dataset.mjs`
  - Create: `scripts/harness/run-ragas-eval.mjs`
- Read-side operator surfaces:
  - Create: `apps/web/src/features/knowledge-retrieval/types.ts`
  - Create: `apps/web/src/features/knowledge-retrieval/knowledge-retrieval-api.ts`
  - Create: `apps/web/src/features/knowledge-retrieval/index.ts`
  - Modify: `apps/web/src/features/template-governance/template-governance-controller.ts`
  - Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
  - Test: `apps/web/test/template-governance-controller.spec.ts`
- Docs:
  - Modify: `README.md`

## Planned Tasks

### Task 1: Add The Retrieval Substrate And Snapshot Persistence

**Files:**
- Modify: `apps/api/src/database/migrations/0017_retrieval_quality_harness.sql`
- Create: `apps/api/src/modules/knowledge-retrieval/knowledge-retrieval-record.ts`
- Create: `apps/api/src/modules/knowledge-retrieval/knowledge-retrieval-repository.ts`
- Create: `apps/api/src/modules/knowledge-retrieval/in-memory-knowledge-retrieval-repository.ts`
- Create: `apps/api/src/modules/knowledge-retrieval/postgres-knowledge-retrieval-repository.ts`
- Create: `apps/api/src/modules/knowledge-retrieval/knowledge-retrieval-service.ts`
- Create: `apps/api/src/modules/knowledge-retrieval/knowledge-retrieval-api.ts`
- Create: `apps/api/src/modules/knowledge-retrieval/index.ts`
- Test: `apps/api/test/knowledge-retrieval/knowledge-retrieval-service.spec.ts`
- Test: `apps/api/test/knowledge-retrieval/postgres-knowledge-retrieval-persistence.spec.ts`

- [ ] **Step 1: Write the failing service and persistence tests**

Add coverage that proves:

```ts
assert.equal(snapshot.module, "editing");
assert.equal(snapshot.retrieved_items.length, 5);
assert.equal(snapshot.reranked_items[0]?.knowledge_item_id, "knowledge-3");
assert.equal(run.metric_summary.answer_relevancy, 0.88);
```

- [ ] **Step 2: Run the targeted API tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/knowledge-retrieval/knowledge-retrieval-service.spec.ts test/knowledge-retrieval/postgres-knowledge-retrieval-persistence.spec.ts
```

Expected: FAIL because the retrieval module, vector schema, and snapshot persistence do not exist yet.

- [ ] **Step 3: Implement the retrieval module and schema**

Implementation rules:

- add vector-backed storage using `pgvector`
- keep retrieval config and retrieved item metadata explicit
- store full retrieval snapshots for later replay
- keep retrieval runs and snapshots additive; do not overwrite historical runs

- [ ] **Step 4: Re-run the targeted API tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/knowledge-retrieval/knowledge-retrieval-service.spec.ts test/knowledge-retrieval/postgres-knowledge-retrieval-persistence.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the retrieval substrate slice**

Run:

```bash
git add apps/api/src/database/migrations/0017_retrieval_quality_harness.sql apps/api/src/modules/knowledge-retrieval apps/api/test/knowledge-retrieval
git commit -m "feat: add knowledge retrieval substrate"
```

### Task 2: Wire Retrieval Into Knowledge Context Resolution And Verification Assets

**Files:**
- Modify: `apps/api/src/modules/knowledge/knowledge-service.ts`
- Modify: `apps/api/src/modules/templates/template-governance-service.ts`
- Modify: `apps/api/src/modules/shared/governed-agent-context-resolver.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-record.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-service.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Test: `apps/api/test/http/persistent-governance-http.spec.ts`

- [ ] **Step 1: Write the failing integration tests**

Add coverage that proves:

- governed context resolution can produce a retrieval snapshot id
- published gold-set data can launch a retrieval-quality run
- `verification-ops` can store retrieval-quality evidence without overloading existing sample-set execution paths

- [ ] **Step 2: Run the targeted HTTP tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/http/persistent-governance-http.spec.ts
```

Expected: FAIL because retrieval snapshots and retrieval-quality run surfaces are not wired into HTTP runtime yet.

- [ ] **Step 3: Implement additive integration**

Implementation rules:

- keep retrieval snapshots as evidence, not as a routing control object
- add a new `retrieval_quality` verification check type
- preserve existing manuscript execution when retrieval evaluation is disabled
- expose retrieval snapshot lookup through bounded read APIs only

- [ ] **Step 4: Re-run the targeted HTTP tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/http/persistent-governance-http.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the integration slice**

Run:

```bash
git add apps/api/src/modules/knowledge/knowledge-service.ts apps/api/src/modules/templates/template-governance-service.ts apps/api/src/modules/shared/governed-agent-context-resolver.ts apps/api/src/modules/verification-ops apps/api/src/http/api-http-server.ts apps/api/src/http/persistent-governance-runtime.ts apps/api/test/http/persistent-governance-http.spec.ts
git commit -m "feat: wire retrieval quality into governed context"
```

### Task 3: Add The Local Ragas Runner And Dataset Export Pipeline

**Files:**
- Create: `apps/worker-py/src/harness_runners/__init__.py`
- Create: `apps/worker-py/src/harness_runners/ragas_runner.py`
- Create: `apps/worker-py/tests/harness_runners/test_ragas_runner.py`
- Create: `scripts/harness/export-ragas-dataset.mjs`
- Create: `scripts/harness/run-ragas-eval.mjs`

- [ ] **Step 1: Write the failing Python and script tests**

Add coverage that proves the runner can:

- read a published gold-set export
- execute a bounded local Ragas run
- emit a normalized JSON result payload back to the repository

- [ ] **Step 2: Run the targeted Python tests and confirm they fail**

Run:

```bash
cd apps/worker-py
python -m pytest tests/harness_runners/test_ragas_runner.py -q
```

Expected: FAIL because no harness runner exists yet.

- [ ] **Step 3: Implement the local runner and export scripts**

Implementation rules:

- keep the runner local-only and file-based
- allow configurable local embedding and LLM providers
- output normalized metrics and run metadata in a stable JSON envelope
- do not require network access by default

- [ ] **Step 4: Re-run the targeted Python tests and confirm they pass**

Run:

```bash
cd apps/worker-py
python -m pytest tests/harness_runners/test_ragas_runner.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit the local Ragas slice**

Run:

```bash
git add apps/worker-py/src/harness_runners apps/worker-py/tests/harness_runners scripts/harness/export-ragas-dataset.mjs scripts/harness/run-ragas-eval.mjs
git commit -m "feat: add local ragas retrieval runner"
```

### Task 4: Surface Retrieval Quality Read Models To Operators

**Files:**
- Create: `apps/web/src/features/knowledge-retrieval/types.ts`
- Create: `apps/web/src/features/knowledge-retrieval/knowledge-retrieval-api.ts`
- Create: `apps/web/src/features/knowledge-retrieval/index.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-controller.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Test: `apps/web/test/template-governance-controller.spec.ts`

- [ ] **Step 1: Write the failing web tests**

Add coverage that proves operators can inspect:

- latest retrieval-quality run per template family
- retrieval drift and missing-knowledge signals
- the most recent retrieval snapshot summary

- [ ] **Step 2: Run the targeted web tests and confirm they fail**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/template-governance-controller.spec.ts
```

Expected: FAIL because no retrieval-quality client or read model exists yet.

- [ ] **Step 3: Implement the bounded read-side surface**

Implementation rules:

- keep the UI read-only in this phase
- show recommendations and evidence links, not publish actions
- avoid mixing retrieval analytics into unrelated workbench surfaces

- [ ] **Step 4: Re-run the targeted web tests and confirm they pass**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/template-governance-controller.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the operator-surface slice**

Run:

```bash
git add apps/web/src/features/knowledge-retrieval apps/web/src/features/template-governance/template-governance-controller.ts apps/web/src/features/template-governance/template-governance-workbench-page.tsx apps/web/test/template-governance-controller.spec.ts
git commit -m "feat: surface retrieval quality read models"
```
