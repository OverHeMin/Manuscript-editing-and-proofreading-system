# Phase 9R Runtime Binding Verification Linkage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link runtime bindings to existing verification-ops assets so governed execution resolves expected verification/evaluation hooks and Admin Governance can compare expected coverage against recorded evidence.

**Architecture:** Extend `RuntimeBinding` and `AgentExecutionLog` additively instead of inventing a new governance object. Keep `verification-ops` as the source of reusable check/suite assets, let `GovernedAgentContextResolver` return the configured expectations, and surface those expectations through the existing admin evidence drilldown.

**Tech Stack:** TypeScript, PostgreSQL/raw SQL migrations, node:test via `tsx`, React/Vite, Playwright, existing admin-governance controller/page, existing runtime-binding and verification-ops typed clients.

---

## Scope Notes

- Do not add automatic verification runners or background orchestration in this slice.
- Do not redesign model-routing or execution-profile contracts.
- Preserve backward compatibility for existing runtime bindings and execution logs by making all new fields additive and optional.
- Follow strict TDD for each behavior-bearing change.

## File Map

- Persistence and domain:
  - Modify: `apps/api/src/database/migrations/0009_agent_tooling_persistence.sql`
  - Modify: `apps/api/src/modules/runtime-bindings/runtime-binding-record.ts`
  - Modify: `apps/api/src/modules/runtime-bindings/runtime-binding-service.ts`
  - Modify: `apps/api/src/modules/runtime-bindings/runtime-binding-api.ts`
  - Modify: `apps/api/src/modules/runtime-bindings/postgres-runtime-binding-repository.ts`
  - Modify: `apps/api/src/modules/runtime-bindings/in-memory-runtime-binding-repository.ts`
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-record.ts`
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-service.ts`
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-api.ts`
  - Modify: `apps/api/src/modules/agent-execution/postgres-agent-execution-repository.ts`
  - Modify: `apps/api/src/modules/agent-execution/in-memory-agent-execution-repository.ts`
  - Modify: `apps/api/src/modules/shared/governed-agent-context-resolver.ts`
  - Modify: `apps/api/src/modules/editing/editing-service.ts`
  - Modify: `apps/api/src/modules/screening/screening-service.ts`
  - Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
  - Test: `apps/api/test/runtime-bindings/runtime-binding-registry.spec.ts`
  - Test: `apps/api/test/modules/governed-agent-context-resolver.spec.ts`
  - Test: `apps/api/test/agent-execution/agent-execution-log.spec.ts`
- Admin API aggregation:
  - Modify: `apps/web/src/features/admin-governance/admin-governance-controller.ts`
  - Modify: `apps/web/src/features/admin-governance/agent-execution-evidence-view.tsx`
  - Modify: `apps/web/src/features/admin-governance/agent-tooling-governance-section.tsx`
  - Modify: `apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx`
  - Modify: `apps/web/src/features/runtime-bindings/types.ts`
  - Modify: `apps/web/src/features/runtime-bindings/runtime-binding-api.ts`
  - Modify: `apps/web/src/features/agent-execution/types.ts`
  - Modify: `apps/web/src/features/verification-ops/index.ts`
  - Test: `apps/web/test/admin-governance-workbench-page.spec.tsx`
  - Test: `apps/web/test/agent-tooling-governance-section.spec.tsx`
- Browser verification:
  - Modify: `apps/web/playwright/admin-governance.spec.ts`
- Documentation:
  - Modify: `README.md`

## Planned Tasks

### Task 1: Extend Runtime Binding And Execution Log Contracts

**Files:**
- Modify: `apps/api/src/modules/runtime-bindings/runtime-binding-record.ts`
- Modify: `apps/api/src/modules/runtime-bindings/runtime-binding-service.ts`
- Modify: `apps/api/src/modules/runtime-bindings/runtime-binding-api.ts`
- Modify: `apps/api/src/modules/runtime-bindings/postgres-runtime-binding-repository.ts`
- Modify: `apps/api/src/modules/runtime-bindings/in-memory-runtime-binding-repository.ts`
- Modify: `apps/api/src/modules/agent-execution/agent-execution-record.ts`
- Modify: `apps/api/src/modules/agent-execution/agent-execution-service.ts`
- Modify: `apps/api/src/modules/agent-execution/agent-execution-api.ts`
- Modify: `apps/api/src/modules/agent-execution/postgres-agent-execution-repository.ts`
- Modify: `apps/api/src/modules/agent-execution/in-memory-agent-execution-repository.ts`
- Modify: `apps/api/src/database/migrations/0009_agent_tooling_persistence.sql`
- Test: `apps/api/test/runtime-bindings/runtime-binding-registry.spec.ts`
- Test: `apps/api/test/agent-execution/agent-execution-log.spec.ts`

- [ ] **Step 1: Add failing runtime-binding registry assertions for verification expectation fields**

Update `apps/api/test/runtime-bindings/runtime-binding-registry.spec.ts` to cover:

```ts
assert.deepEqual(created.body.verification_check_profile_ids, ["check-profile-1"]);
assert.deepEqual(created.body.evaluation_suite_ids, ["suite-1"]);
assert.equal(created.body.release_check_profile_id, "release-profile-1");
```

Add failure cases where:

- a referenced check profile is missing or draft
- a referenced evaluation suite is missing or not active
- a referenced release check profile is missing or draft

- [ ] **Step 2: Add failing agent-execution log assertions for immutable expectation traces**

Update `apps/api/test/agent-execution/agent-execution-log.spec.ts` so a created log can store:

```ts
verificationCheckProfileIds: ["check-profile-1"],
evaluationSuiteIds: ["suite-1"],
releaseCheckProfileId: "release-profile-1",
```

and the saved log exposes the matching record fields.

- [ ] **Step 3: Run the targeted API tests and confirm they fail for the missing fields/validation**

Run:

```bash
pnpm --filter @medical/api test -- runtime-binding
pnpm --filter @medical/api test -- agent-execution
```

Expected: FAIL because runtime bindings and execution logs do not yet persist or validate verification expectation metadata.

- [ ] **Step 4: Implement the additive contract and persistence changes**

Implementation rules:

- extend create-input types with:
  - `verificationCheckProfileIds?: string[]`
  - `evaluationSuiteIds?: string[]`
  - `releaseCheckProfileId?: string`
- dedupe arrays while preserving order
- validate verification assets against `verification-ops` repositories/services
- persist the new fields in both in-memory and PostgreSQL adapters
- keep all new database columns nullable or default-empty for backward compatibility

- [ ] **Step 5: Re-run the targeted API tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- runtime-binding
pnpm --filter @medical/api test -- agent-execution
```

Expected: PASS.

### Task 2: Resolve Verification Expectations In Governed Agent Context

**Files:**
- Modify: `apps/api/src/modules/shared/governed-agent-context-resolver.ts`
- Test: `apps/api/test/modules/governed-agent-context-resolver.spec.ts`

- [ ] **Step 1: Add a failing governed-context assertion for resolved verification expectations**

Update `apps/api/test/modules/governed-agent-context-resolver.spec.ts` to assert:

```ts
assert.deepEqual(context.verificationExpectations.verification_check_profile_ids, ["check-profile-1"]);
assert.deepEqual(context.verificationExpectations.evaluation_suite_ids, ["suite-1"]);
assert.equal(context.verificationExpectations.release_check_profile_id, "release-profile-1");
```

- [ ] **Step 2: Run the governed-context test and confirm it fails because the resolver still returns empty expectations**

Run:

```bash
pnpm --filter @medical/api test -- governed-agent-context-resolver
```

Expected: FAIL with empty expectation arrays.

- [ ] **Step 3: Implement the resolver change**

Implementation rules:

- source expectations directly from the active runtime binding
- do not introduce fallback inference
- keep the returned object stable even when all fields are empty

- [ ] **Step 4: Re-run the governed-context test and confirm it passes**

Run:

```bash
pnpm --filter @medical/api test -- governed-agent-context-resolver
```

Expected: PASS.

### Task 3: Thread Verification Expectations Through Real Module Runs

**Files:**
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/screening/screening-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/src/modules/agent-execution/agent-execution-service.ts`
- Test: `apps/api/test/modules/module-orchestration.spec.ts`

- [ ] **Step 1: Add failing module orchestration assertions for log payload propagation**

Update `apps/api/test/modules/module-orchestration.spec.ts` to assert that a real governed run creates an execution log containing:

- `verification_check_profile_ids`
- `evaluation_suite_ids`
- `release_check_profile_id`

and that proofreading confirmation still preserves the draft log linkage behavior.

- [ ] **Step 2: Run the module orchestration test and confirm it fails**

Run:

```bash
pnpm --filter @medical/api test -- modules
```

Expected: FAIL because module services do not yet pass verification expectation fields into execution-log creation.

- [ ] **Step 3: Implement the module-service propagation**

Implementation rules:

- pass expectation fields when creating each new execution log
- keep proofreading final confirmation behavior unchanged when it reuses draft-stage linkage
- do not change current snapshot creation semantics

- [ ] **Step 4: Re-run the module orchestration test and confirm it passes**

Run:

```bash
pnpm --filter @medical/api test -- modules
```

Expected: PASS.

### Task 4: Expose Verification Expectations In Admin Governance Web State

**Files:**
- Modify: `apps/web/src/features/runtime-bindings/types.ts`
- Modify: `apps/web/src/features/runtime-bindings/runtime-binding-api.ts`
- Modify: `apps/web/src/features/agent-execution/types.ts`
- Modify: `apps/web/src/features/admin-governance/admin-governance-controller.ts`
- Modify: `apps/web/src/features/verification-ops/index.ts`
- Test: `apps/web/test/admin-governance-workbench-page.spec.tsx`
- Test: `apps/web/test/agent-tooling-governance-section.spec.tsx`

- [ ] **Step 1: Add failing web tests for loading verification assets and saving binding expectations**

Update admin-governance web tests to cover:

- overview includes verification check profiles, release check profiles, and evaluation suites
- the runtime-binding form submits selected verification expectation IDs
- controller reload preserves those values in the returned overview

- [ ] **Step 2: Run the targeted web unit tests and confirm they fail**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/admin-governance-workbench-page.spec.tsx test/agent-tooling-governance-section.spec.tsx
```

Expected: FAIL because the controller and typed clients do not yet load or submit verification expectation metadata.

- [ ] **Step 3: Implement the web contract updates**

Implementation rules:

- extend runtime-binding types and API payloads with the new fields
- load verification assets alongside existing governance overview data
- keep selectors optional and empty by default

- [ ] **Step 4: Re-run the targeted web unit tests and confirm they pass**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/admin-governance-workbench-page.spec.tsx test/agent-tooling-governance-section.spec.tsx
```

Expected: PASS.

### Task 5: Render Verification Expectations In Admin Governance UI

**Files:**
- Modify: `apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx`
- Modify: `apps/web/src/features/admin-governance/agent-tooling-governance-section.tsx`
- Modify: `apps/web/src/features/admin-governance/agent-execution-evidence-view.tsx`
- Test: `apps/web/test/admin-governance-workbench-page.spec.tsx`
- Test: `apps/web/test/agent-tooling-governance-section.spec.tsx`

- [ ] **Step 1: Add failing UI assertions for the new selectors and evidence panel**

Add assertions for:

- runtime-binding form labels:
  - `Verification Check Profiles`
  - `Evaluation Suites`
  - `Release Check Profile`
- runtime-binding list showing configured expectations
- execution evidence showing a `Verification Expectations` block with expected vs recorded coverage

- [ ] **Step 2: Run the targeted web unit tests and confirm they fail for the missing UI**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/admin-governance-workbench-page.spec.tsx test/agent-tooling-governance-section.spec.tsx
```

Expected: FAIL because the UI does not yet render or compare expectation metadata.

- [ ] **Step 3: Implement the Admin Governance UI changes**

Implementation rules:

- keep the new controls in the existing runtime-binding form; do not create a separate page
- render human-readable names when registry assets are available
- degrade to raw IDs if an expected verification asset no longer resolves
- distinguish:
  - configured expectations
  - recorded evidence
  - missing expected coverage

- [ ] **Step 4: Re-run the targeted web unit tests and confirm they pass**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/admin-governance-workbench-page.spec.tsx test/agent-tooling-governance-section.spec.tsx
```

Expected: PASS.

### Task 6: Prove The Operator Flow In Playwright And Update Docs

**Files:**
- Modify: `apps/web/playwright/admin-governance.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Add a failing Playwright assertion for runtime-binding verification expectations**

Extend `apps/web/playwright/admin-governance.spec.ts` so it proves:

- a runtime binding can be created with linked check profile / suite / release profile
- the runtime binding summary shows those expectations
- execution evidence drilldown renders the configured expectations and recorded verification evidence together

- [ ] **Step 2: Run the targeted Playwright spec and confirm it fails**

Run:

```bash
pnpm --filter @medsys/web playwright test playwright/admin-governance.spec.ts --grep "verification expectations|governance console"
```

Expected: FAIL because the browser flow does not yet expose verification expectation linkage.

- [ ] **Step 3: Implement any final browser-facing adjustments and update README**

Update `README.md` to reflect that Admin Governance now links runtime bindings to verification/evaluation expectations and surfaces expectation coverage in execution evidence.

- [ ] **Step 4: Re-run the targeted Playwright spec and then the release gate slice**

Run:

```bash
pnpm --filter @medsys/web playwright test playwright/admin-governance.spec.ts
pnpm verify:manuscript-workbench
```

Expected: PASS, or surface any unrelated pre-existing failures explicitly.

- [ ] **Step 5: Stage the finished slice**

Run:

```bash
git add apps/api/src/database/migrations/0009_agent_tooling_persistence.sql apps/api/src/modules/runtime-bindings apps/api/src/modules/agent-execution apps/api/src/modules/shared/governed-agent-context-resolver.ts apps/api/src/modules/editing/editing-service.ts apps/api/src/modules/screening/screening-service.ts apps/api/src/modules/proofreading/proofreading-service.ts apps/api/test/runtime-bindings/runtime-binding-registry.spec.ts apps/api/test/modules/governed-agent-context-resolver.spec.ts apps/api/test/agent-execution/agent-execution-log.spec.ts apps/api/test/modules/module-orchestration.spec.ts apps/web/src/features/runtime-bindings apps/web/src/features/agent-execution apps/web/src/features/admin-governance apps/web/src/features/verification-ops/index.ts apps/web/test/admin-governance-workbench-page.spec.tsx apps/web/test/agent-tooling-governance-section.spec.tsx apps/web/playwright/admin-governance.spec.ts README.md docs/superpowers/specs/2026-04-03-phase9r-runtime-binding-verification-linkage-design.md docs/superpowers/plans/2026-04-03-phase9r-runtime-binding-verification-linkage.md
```

Expected: staged diff ready for final review and commit.
