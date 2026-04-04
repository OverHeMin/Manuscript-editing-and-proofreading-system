# Phase 10F Local-First Harness Adapter Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a governed local-first harness adapter layer for Promptfoo, self-hosted Langfuse OSS, local simple-evals style runners, and judge-reliability calibration without making those tools part of the main manuscript execution dependency chain.

**Architecture:** Add a dedicated `harness-integrations` module plus local worker-side runners. Keep adapter definitions, execution records, redaction profiles, and result envelopes separate from business-domain modules. Route all harness execution through explicit feature-flagged adapters, persist only normalized result envelopes, and make every adapter fail open for the production path.

**Tech Stack:** TypeScript, PostgreSQL raw SQL migrations, React/Vite, Python 3.12, local CLI runners, self-hosted Langfuse OSS, Promptfoo, node:test via `tsx`, pytest.

---

## Scope Notes

- Do not make self-hosted Langfuse a required dependency for booting the main API runtime.
- Do not push raw manuscript content to tracing adapters by default.
- Do not let harness adapter outcomes auto-activate routing or publication changes.
- Do not bury adapter-specific logic inside `screening`, `editing`, or `proofreading` services.
- Keep every harness tool behind a stable repository-owned adapter contract.

## Planned File Structure

- Harness integration persistence and services:
  - Modify: `apps/api/src/database/migrations/0018_local_first_harness_adapter_platform.sql`
  - Create: `apps/api/src/modules/harness-integrations/harness-integration-record.ts`
  - Create: `apps/api/src/modules/harness-integrations/harness-integration-repository.ts`
  - Create: `apps/api/src/modules/harness-integrations/in-memory-harness-integration-repository.ts`
  - Create: `apps/api/src/modules/harness-integrations/postgres-harness-integration-repository.ts`
  - Create: `apps/api/src/modules/harness-integrations/harness-integration-service.ts`
  - Create: `apps/api/src/modules/harness-integrations/harness-integration-api.ts`
  - Create: `apps/api/src/modules/harness-integrations/index.ts`
  - Test: `apps/api/test/harness-integrations/harness-integration-service.spec.ts`
  - Test: `apps/api/test/harness-integrations/postgres-harness-integration-persistence.spec.ts`
- Runtime and governance wiring:
  - Modify: `apps/api/src/modules/tool-gateway/tool-gateway-service.ts`
  - Modify: `apps/api/src/modules/runtime-bindings/runtime-binding-service.ts`
  - Modify: `apps/api/src/http/api-http-server.ts`
  - Modify: `apps/api/src/http/persistent-governance-runtime.ts`
  - Modify: `apps/api/src/modules/verification-ops/verification-ops-service.ts`
  - Test: `apps/api/test/http/persistent-governance-http.spec.ts`
- Local runners and scripts:
  - Create: `apps/worker-py/src/harness_runners/promptfoo_runner.py`
  - Create: `apps/worker-py/src/harness_runners/judge_reliability_runner.py`
  - Create: `apps/worker-py/tests/harness_runners/test_promptfoo_runner.py`
  - Create: `apps/worker-py/tests/harness_runners/test_judge_reliability_runner.py`
  - Create: `scripts/harness/run-promptfoo-suite.mjs`
  - Create: `scripts/harness/run-simple-evals.mjs`
  - Create: `scripts/harness/push-langfuse-trace.mjs`
- Admin read-side UI:
  - Create: `apps/web/src/features/harness-integrations/types.ts`
  - Create: `apps/web/src/features/harness-integrations/harness-integrations-api.ts`
  - Create: `apps/web/src/features/harness-integrations/index.ts`
  - Modify: `apps/web/src/features/admin-governance/admin-governance-controller.ts`
  - Modify: `apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx`
  - Test: `apps/web/test/admin-governance-controller.spec.ts`
- Docs:
  - Modify: `README.md`

## Planned Tasks

### Task 1: Add The Governed Harness Adapter Module

**Files:**
- Modify: `apps/api/src/database/migrations/0018_local_first_harness_adapter_platform.sql`
- Create: `apps/api/src/modules/harness-integrations/harness-integration-record.ts`
- Create: `apps/api/src/modules/harness-integrations/harness-integration-repository.ts`
- Create: `apps/api/src/modules/harness-integrations/in-memory-harness-integration-repository.ts`
- Create: `apps/api/src/modules/harness-integrations/postgres-harness-integration-repository.ts`
- Create: `apps/api/src/modules/harness-integrations/harness-integration-service.ts`
- Create: `apps/api/src/modules/harness-integrations/harness-integration-api.ts`
- Create: `apps/api/src/modules/harness-integrations/index.ts`
- Test: `apps/api/test/harness-integrations/harness-integration-service.spec.ts`
- Test: `apps/api/test/harness-integrations/postgres-harness-integration-persistence.spec.ts`

- [ ] **Step 1: Write the failing service and persistence tests**

Add coverage that proves:

```ts
assert.equal(adapter.kind, "promptfoo");
assert.equal(adapter.execution_mode, "local_cli");
assert.equal(adapter.fail_open, true);
assert.equal(traceProfile.redaction_mode, "structured_only");
```

Add persistence assertions for:

- adapter registration
- feature flag changes
- execution audit history
- redaction-profile lookup

- [ ] **Step 2: Run the targeted API tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/harness-integrations/harness-integration-service.spec.ts test/harness-integrations/postgres-harness-integration-persistence.spec.ts
```

Expected: FAIL because the harness adapter module and persistence layer do not exist yet.

- [ ] **Step 3: Implement the harness adapter module**

Implementation rules:

- define stable adapter kinds for:
  - `promptfoo`
  - `langfuse_oss`
  - `simple_evals_local`
  - `judge_reliability_local`
- keep adapter config and execution audit separate
- require explicit redaction profiles
- keep all adapters fail-open by default

- [ ] **Step 4: Re-run the targeted API tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/harness-integrations/harness-integration-service.spec.ts test/harness-integrations/postgres-harness-integration-persistence.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the adapter-governance slice**

Run:

```bash
git add apps/api/src/database/migrations/0018_local_first_harness_adapter_platform.sql apps/api/src/modules/harness-integrations apps/api/test/harness-integrations
git commit -m "feat: add local-first harness adapter governance"
```

### Task 2: Wire Adapters Into Runtime Boundaries Without Coupling Them To Main Execution

**Files:**
- Modify: `apps/api/src/modules/tool-gateway/tool-gateway-service.ts`
- Modify: `apps/api/src/modules/runtime-bindings/runtime-binding-service.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Modify: `apps/api/src/modules/verification-ops/verification-ops-service.ts`
- Test: `apps/api/test/http/persistent-governance-http.spec.ts`

- [ ] **Step 1: Write the failing integration tests**

Add coverage that proves:

- a harness run can be launched explicitly from governed assets
- a harness adapter failure records a degraded execution result
- the manuscript execution path still succeeds when harness tracing is unavailable

- [ ] **Step 2: Run the targeted HTTP tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/http/persistent-governance-http.spec.ts
```

Expected: FAIL because harness adapters are not yet wired into bounded runtime surfaces.

- [ ] **Step 3: Implement bounded runtime integration**

Implementation rules:

- route harness execution through explicit API or workbench actions only
- keep adapters out of synchronous manuscript processing
- store normalized result envelopes and degradation reasons
- allow `verification-ops` to attach harness evidence links without depending on adapter availability

- [ ] **Step 4: Re-run the targeted HTTP tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/http/persistent-governance-http.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the runtime-boundary slice**

Run:

```bash
git add apps/api/src/modules/tool-gateway/tool-gateway-service.ts apps/api/src/modules/runtime-bindings/runtime-binding-service.ts apps/api/src/http/api-http-server.ts apps/api/src/http/persistent-governance-runtime.ts apps/api/src/modules/verification-ops/verification-ops-service.ts apps/api/test/http/persistent-governance-http.spec.ts
git commit -m "feat: wire harness adapters into bounded runtime paths"
```

### Task 3: Add Local Promptfoo, Simple-Evals, And Judge-Reliability Runners

**Files:**
- Create: `apps/worker-py/src/harness_runners/promptfoo_runner.py`
- Create: `apps/worker-py/src/harness_runners/judge_reliability_runner.py`
- Create: `apps/worker-py/tests/harness_runners/test_promptfoo_runner.py`
- Create: `apps/worker-py/tests/harness_runners/test_judge_reliability_runner.py`
- Create: `scripts/harness/run-promptfoo-suite.mjs`
- Create: `scripts/harness/run-simple-evals.mjs`
- Create: `scripts/harness/push-langfuse-trace.mjs`

- [ ] **Step 1: Write the failing local-runner tests**

Add coverage that proves:

- Promptfoo results are normalized into one stable JSON envelope
- simple-evals style runs can be launched locally with bounded inputs
- judge-reliability runs can compare human labels and judge outputs across a calibration batch

- [ ] **Step 2: Run the targeted Python tests and confirm they fail**

Run:

```bash
cd apps/worker-py
python -m pytest tests/harness_runners/test_promptfoo_runner.py tests/harness_runners/test_judge_reliability_runner.py -q
```

Expected: FAIL because no local runners exist yet.

- [ ] **Step 3: Implement the local runners and scripts**

Implementation rules:

- keep all runners local or self-hosted only
- normalize tool-specific outputs into repository-owned result envelopes
- push Langfuse traces only to configured self-hosted endpoints
- never require a cloud endpoint for the scripts to work

- [ ] **Step 4: Re-run the targeted Python tests and confirm they pass**

Run:

```bash
cd apps/worker-py
python -m pytest tests/harness_runners/test_promptfoo_runner.py tests/harness_runners/test_judge_reliability_runner.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit the local-runner slice**

Run:

```bash
git add apps/worker-py/src/harness_runners apps/worker-py/tests/harness_runners scripts/harness/run-promptfoo-suite.mjs scripts/harness/run-simple-evals.mjs scripts/harness/push-langfuse-trace.mjs
git commit -m "feat: add local harness runners"
```

### Task 4: Surface Adapter Health And Calibration Read Models In Admin Governance

**Files:**
- Create: `apps/web/src/features/harness-integrations/types.ts`
- Create: `apps/web/src/features/harness-integrations/harness-integrations-api.ts`
- Create: `apps/web/src/features/harness-integrations/index.ts`
- Modify: `apps/web/src/features/admin-governance/admin-governance-controller.ts`
- Modify: `apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx`
- Test: `apps/web/test/admin-governance-controller.spec.ts`

- [ ] **Step 1: Write the failing admin-read-model tests**

Add coverage that proves operators can inspect:

- configured harness adapters
- latest execution health
- trace sink availability
- latest judge calibration batch outcome

- [ ] **Step 2: Run the targeted web tests and confirm they fail**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/admin-governance-controller.spec.ts
```

Expected: FAIL because no harness-integration client or read model exists yet.

- [ ] **Step 3: Implement the bounded admin surface**

Implementation rules:

- keep this surface read-oriented
- show adapter health and calibration evidence
- do not add one-click production routing actions from this page

- [ ] **Step 4: Re-run the targeted web tests and confirm they pass**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/admin-governance-controller.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the admin surface slice**

Run:

```bash
git add apps/web/src/features/harness-integrations apps/web/src/features/admin-governance/admin-governance-controller.ts apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx apps/web/test/admin-governance-controller.spec.ts
git commit -m "feat: surface harness adapter health in admin governance"
```
