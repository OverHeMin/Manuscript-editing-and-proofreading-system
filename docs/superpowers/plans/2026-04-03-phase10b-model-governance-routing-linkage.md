# Phase 10B Model Governance Routing Linkage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a versioned, evidence-linked model routing governance layer so `Admin Governance Console` can activate approved `module + template_family` policy, runtime can resolve that active policy safely, and governed execution can audit which policy/version/model was used.

**Architecture:** Add a dedicated `model-routing-governance` module instead of overloading `model-registry` or `runtime-binding`. Keep `model-registry` as the governed asset source, keep the existing singleton `model_routing_policies` table as a legacy fallback path, and let runtime resolve `active template_family policy -> active module policy -> legacy singleton defaults`. `Evaluation Workbench` remains evidence-only; `Admin Governance Console` is the only control plane that can draft, review, approve, activate, and roll back routing policy.

**Tech Stack:** TypeScript, PostgreSQL raw SQL migrations, node:test via `tsx`, React/Vite, Playwright, existing admin-governance/evaluation-workbench/model-registry clients, in-memory + persistent governance runtimes.

---

## Scope Notes

- Do not add automatic model promotion, automatic rollback, automatic gray-release expansion, or score-driven runtime switching in this slice.
- Do not add manuscript-type-level routing or knowledge-item-level routing in this slice.
- Preserve the existing singleton `model_routing_policies` table and repository as a legacy/default fallback source; do not delete or repurpose that table.
- The new governed policy scope is only `template_family` or `module`.
- Runtime fallback order may be stored and surfaced in this slice, but runtime may only consume approved fallback entries for concrete technical/runtime failures. Do not invent heuristic quality-based switching.
- Keep `runtime binding` and `routing policy` separate:
  - `runtime binding` governs runtime/tool/sandbox/verification bundle
  - `routing policy` governs approved model path and ordered fallback path

## File Map

- API persistence and governance module:
  - Modify: `apps/api/src/database/migrations/0015_model_routing_governance_persistence.sql`
  - Create: `apps/api/src/modules/model-routing-governance/model-routing-governance-record.ts`
  - Create: `apps/api/src/modules/model-routing-governance/model-routing-governance-repository.ts`
  - Create: `apps/api/src/modules/model-routing-governance/in-memory-model-routing-governance-repository.ts`
  - Create: `apps/api/src/modules/model-routing-governance/postgres-model-routing-governance-repository.ts`
  - Create: `apps/api/src/modules/model-routing-governance/model-routing-governance-service.ts`
  - Create: `apps/api/src/modules/model-routing-governance/model-routing-governance-api.ts`
  - Create: `apps/api/src/modules/model-routing-governance/index.ts`
  - Test: `apps/api/test/model-routing-governance/model-routing-governance.spec.ts`
  - Test: `apps/api/test/model-routing-governance/postgres-model-routing-governance-persistence.spec.ts`
  - Test: `apps/api/test/database/schema.spec.ts`
- Runtime resolution and execution audit:
  - Modify: `apps/api/src/modules/ai-gateway/ai-gateway-service.ts`
  - Modify: `apps/api/src/modules/ai-gateway/ai-gateway-api.ts`
  - Modify: `apps/api/src/modules/execution-resolution/execution-resolution-record.ts`
  - Modify: `apps/api/src/modules/execution-resolution/execution-resolution-service.ts`
  - Modify: `apps/api/src/modules/shared/governed-module-context-resolver.ts`
  - Modify: `apps/api/src/modules/shared/module-run-support.ts`
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-record.ts`
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-service.ts`
  - Modify: `apps/api/src/modules/agent-execution/agent-execution-api.ts`
  - Modify: `apps/api/src/modules/agent-execution/in-memory-agent-execution-repository.ts`
  - Modify: `apps/api/src/modules/agent-execution/postgres-agent-execution-repository.ts`
  - Modify: `apps/api/src/modules/editing/editing-service.ts`
  - Modify: `apps/api/src/modules/screening/screening-service.ts`
  - Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
  - Test: `apps/api/test/ai-gateway/ai-gateway.spec.ts`
  - Test: `apps/api/test/execution-resolution/execution-resolution.spec.ts`
  - Test: `apps/api/test/agent-execution/agent-execution-log.spec.ts`
  - Test: `apps/api/test/agent-execution/postgres-agent-execution-persistence.spec.ts`
  - Test: `apps/api/test/modules/governed-module-context-resolver.spec.ts`
  - Test: `apps/api/test/modules/module-orchestration.spec.ts`
- HTTP routes and runtime wiring:
  - Modify: `apps/api/src/http/api-http-server.ts`
  - Modify: `apps/api/src/http/persistent-governance-runtime.ts`
  - Test: `apps/api/test/http/http-server.spec.ts`
  - Test: `apps/api/test/http/persistent-governance-http.spec.ts`
- Web typed clients and Admin Governance UI:
  - Create: `apps/web/src/features/model-routing-governance/types.ts`
  - Create: `apps/web/src/features/model-routing-governance/model-routing-governance-api.ts`
  - Create: `apps/web/src/features/model-routing-governance/index.ts`
  - Modify: `apps/web/src/features/admin-governance/admin-governance-controller.ts`
  - Modify: `apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx`
  - Modify: `apps/web/src/features/admin-governance/agent-tooling-governance-section.tsx`
  - Modify: `apps/web/src/features/admin-governance/agent-execution-evidence-view.tsx`
  - Modify: `apps/web/src/features/execution-governance/types.ts`
  - Modify: `apps/web/src/features/agent-execution/types.ts`
  - Test: `apps/web/test/admin-governance-controller.spec.ts`
  - Test: `apps/web/test/agent-tooling-governance-section.spec.tsx`
  - Test: `apps/web/test/agent-execution-evidence-view.spec.tsx`
- Browser verification and docs:
  - Modify: `apps/web/playwright/admin-governance.spec.ts`
  - Modify: `README.md`

## Planned Tasks

### Task 1: Create The Versioned Model Routing Governance Module

**Files:**
- Modify: `apps/api/src/database/migrations/0015_model_routing_governance_persistence.sql`
- Create: `apps/api/src/modules/model-routing-governance/model-routing-governance-record.ts`
- Create: `apps/api/src/modules/model-routing-governance/model-routing-governance-repository.ts`
- Create: `apps/api/src/modules/model-routing-governance/in-memory-model-routing-governance-repository.ts`
- Create: `apps/api/src/modules/model-routing-governance/postgres-model-routing-governance-repository.ts`
- Create: `apps/api/src/modules/model-routing-governance/model-routing-governance-service.ts`
- Create: `apps/api/src/modules/model-routing-governance/model-routing-governance-api.ts`
- Create: `apps/api/src/modules/model-routing-governance/index.ts`
- Test: `apps/api/test/model-routing-governance/model-routing-governance.spec.ts`
- Test: `apps/api/test/model-routing-governance/postgres-model-routing-governance-persistence.spec.ts`
- Test: `apps/api/test/database/schema.spec.ts`

- [ ] **Step 1: Add failing governance service and persistence tests**

Add coverage that proves:

```ts
assert.equal(createdDraft.scope.scope_kind, "template_family");
assert.equal(createdDraft.version.status, "draft");
assert.deepEqual(createdDraft.version.fallback_model_ids, ["model-fallback-1"]);
assert.deepEqual(
  createdDraft.version.evidence_links,
  [{ kind: "evaluation_run", id: "run-1" }],
);
```

Add lifecycle assertions for:

- `draft -> pending_review`
- draft-only payload updates
- creating a new draft version under an existing policy scope
- `pending_review -> approved`
- `approved -> active`
- `pending_review -> rejected`
- `active -> rolled_back`
- superseding an older active version without overwriting prior history

Add schema assertions that:

- `model_routing_policy_scopes` exists
- `model_routing_policy_versions` exists
- `model_routing_policy_decisions` exists
- scope uniqueness is enforced for `(scope_kind, scope_value)`
- only one active version can be pointed to by a scope at a time

- [ ] **Step 2: Run the targeted API tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/model-routing-governance/model-routing-governance.spec.ts test/model-routing-governance/postgres-model-routing-governance-persistence.spec.ts test/database/schema.spec.ts
```

Expected: FAIL because the new governance module, migration, lifecycle validation, and persistence tables do not exist yet.

- [ ] **Step 3: Implement the new governance records, repositories, service, API, and migration**

Implementation rules:

- create a dedicated API module named `model-routing-governance`; do not bury the versioned lifecycle inside `model-registry-service.ts`
- model scope identity lives in `model_routing_policy_scopes`
- immutable payloads live in `model_routing_policy_versions`
- audit/lifecycle actions live in `model_routing_policy_decisions`
- keep evidence references additive and lightweight by storing them as typed JSON payloads on versions/decisions instead of duplicating evaluation storage
- validate `primary_model_id` and every `fallback_model_id` against `ModelRegistryRepository`
- allow edits only while a version is still `draft`
- allow existing policy scopes to create a fresh draft version without mutating historical payloads
- require:
  - production-approved models
  - module compatibility for `module` scope
  - full routeable-module compatibility only when a future system scope is added; do not invent system scope now
- require non-empty evidence links before approval and activation
- do not modify the legacy singleton `model_routing_policies` table beyond continuing to read it elsewhere as fallback configuration

- [ ] **Step 4: Re-run the targeted API tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/model-routing-governance/model-routing-governance.spec.ts test/model-routing-governance/postgres-model-routing-governance-persistence.spec.ts test/database/schema.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the governance-module slice**

Run:

```bash
git add apps/api/src/database/migrations/0015_model_routing_governance_persistence.sql apps/api/src/modules/model-routing-governance apps/api/test/model-routing-governance apps/api/test/database/schema.spec.ts
git commit -m "feat: add versioned model routing governance"
```

### Task 2: Resolve Active Routing Policy In Runtime And Audit Execution Usage

**Files:**
- Modify: `apps/api/src/modules/ai-gateway/ai-gateway-service.ts`
- Modify: `apps/api/src/modules/ai-gateway/ai-gateway-api.ts`
- Modify: `apps/api/src/modules/execution-resolution/execution-resolution-record.ts`
- Modify: `apps/api/src/modules/execution-resolution/execution-resolution-service.ts`
- Modify: `apps/api/src/modules/shared/governed-module-context-resolver.ts`
- Modify: `apps/api/src/modules/shared/module-run-support.ts`
- Modify: `apps/api/src/modules/agent-execution/agent-execution-record.ts`
- Modify: `apps/api/src/modules/agent-execution/agent-execution-service.ts`
- Modify: `apps/api/src/modules/agent-execution/agent-execution-api.ts`
- Modify: `apps/api/src/modules/agent-execution/in-memory-agent-execution-repository.ts`
- Modify: `apps/api/src/modules/agent-execution/postgres-agent-execution-repository.ts`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/screening/screening-service.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Test: `apps/api/test/ai-gateway/ai-gateway.spec.ts`
- Test: `apps/api/test/execution-resolution/execution-resolution.spec.ts`
- Test: `apps/api/test/agent-execution/agent-execution-log.spec.ts`
- Test: `apps/api/test/agent-execution/postgres-agent-execution-persistence.spec.ts`
- Test: `apps/api/test/modules/governed-module-context-resolver.spec.ts`
- Test: `apps/api/test/modules/module-orchestration.spec.ts`

- [ ] **Step 1: Add failing runtime-resolution and audit assertions**

Update the API tests to prove:

```ts
assert.equal(resolved.body.layer, "template_family_policy");
assert.equal(resolved.body.policy_version_id, "policy-version-2");
assert.equal(resolved.body.policy_scope_kind, "template_family");
assert.equal(resolved.body.policy_scope_value, "family-1");
assert.deepEqual(
  resolved.body.fallback_chain.map((model) => model.id),
  ["model-fallback-1", "model-fallback-2"],
);
```

Update execution-resolution expectations to prove:

```ts
assert.equal(bundle.model_source, "template_family_policy");
```

Add fallback-to-legacy assertions showing that when no active versioned policy exists, runtime still resolves in this order:

1. legacy `template_overrides[module_template_id]`
2. legacy `module_defaults[module]`
3. legacy `system_default_model_id`

Update execution-log tests to prove each log can persist:

```ts
assert.equal(log.routing_policy_version_id, "policy-version-2");
assert.equal(log.routing_policy_scope_kind, "template_family");
assert.equal(log.routing_policy_scope_value, "family-1");
assert.equal(log.resolved_model_id, "model-primary-1");
assert.equal(log.fallback_model_id, undefined);
assert.equal(log.fallback_trigger, undefined);
```

- [ ] **Step 2: Run the targeted runtime tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api test -- ai-gateway execution-resolution agent-execution modules
```

Expected: FAIL because runtime still reads only the legacy singleton routing policy, `model_source` does not expose governance scope, and execution logs do not persist routing-policy audit fields.

- [ ] **Step 3: Implement active-policy resolution, legacy fallback order, and additive execution-log audit fields**

Implementation rules:

- inject the new `model-routing-governance` repository/service into runtime resolution paths
- thread both `templateFamilyId` and `moduleTemplateId` through `AiGatewayService.resolveModelSelection(...)`
- resolve model source in this order:
  - active `template_family` policy
  - active `module` policy
  - legacy singleton template override
  - legacy singleton module default
  - legacy singleton system default
- expand source/layer unions to:
  - `template_family_policy`
  - `module_policy`
  - `legacy_template_override`
  - `legacy_module_default`
  - `legacy_system_default`
  - keep `task_override` as-is
- return the ordered approved fallback chain from the active policy when one matches
- do not auto-switch models on quality heuristics
- add execution-log fields for:
  - matched policy version
  - matched scope kind/value
  - resolved model id
  - fallback model id
  - fallback trigger
- keep all new execution-log columns nullable/additive so older records remain readable

- [ ] **Step 4: Re-run the targeted runtime tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api test -- ai-gateway execution-resolution agent-execution modules
```

Expected: PASS.

- [ ] **Step 5: Commit the runtime-linkage slice**

Run:

```bash
git add apps/api/src/modules/ai-gateway apps/api/src/modules/execution-resolution apps/api/src/modules/shared/governed-module-context-resolver.ts apps/api/src/modules/shared/module-run-support.ts apps/api/src/modules/agent-execution apps/api/src/modules/editing/editing-service.ts apps/api/src/modules/screening/screening-service.ts apps/api/src/modules/proofreading/proofreading-service.ts apps/api/test/ai-gateway/ai-gateway.spec.ts apps/api/test/execution-resolution/execution-resolution.spec.ts apps/api/test/agent-execution/agent-execution-log.spec.ts apps/api/test/agent-execution/postgres-agent-execution-persistence.spec.ts apps/api/test/modules/governed-module-context-resolver.spec.ts apps/api/test/modules/module-orchestration.spec.ts
git commit -m "feat: resolve governed model routing in runtime"
```

### Task 3: Expose Routing Governance Through HTTP And Persistent Runtime Wiring

**Files:**
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Test: `apps/api/test/http/http-server.spec.ts`
- Test: `apps/api/test/http/persistent-governance-http.spec.ts`

- [ ] **Step 1: Add failing HTTP tests for the governance lifecycle**

Add request/response coverage for:

- `GET /api/v1/model-routing-governance/policies`
- `POST /api/v1/model-routing-governance/policies`
- `POST /api/v1/model-routing-governance/policies/:policyId/versions`
- `POST /api/v1/model-routing-governance/versions/:versionId/draft`
- `POST /api/v1/model-routing-governance/versions/:versionId/submit`
- `POST /api/v1/model-routing-governance/versions/:versionId/approve`
- `POST /api/v1/model-routing-governance/versions/:versionId/activate`
- `POST /api/v1/model-routing-governance/policies/:policyId/rollback`

Assert that a listed policy includes:

```ts
assert.equal(policy.active_version?.primary_model_id, "model-primary-1");
assert.equal(policy.active_version?.scope_kind, "template_family");
assert.deepEqual(policy.active_version?.fallback_model_ids, ["model-fallback-1"]);
```

Add negative coverage proving activation is rejected when the version is not yet approved or has no evidence links.

- [ ] **Step 2: Run the targeted HTTP tests and confirm they fail**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/http/http-server.spec.ts test/http/persistent-governance-http.spec.ts
```

Expected: FAIL because the new routes are not registered and the persistent runtime has no `modelRoutingGovernanceApi` wiring.

- [ ] **Step 3: Wire the new API into both the demo/in-memory and persistent runtimes**

Implementation rules:

- add a dedicated `modelRoutingGovernanceApi` runtime slot instead of piggybacking on `modelRegistryApi`
- register new route matchers and handlers in `api-http-server.ts`
- instantiate in-memory repository/service/API in the default HTTP runtime path
- instantiate PostgreSQL repository/service/API in `persistent-governance-runtime.ts`
- expose separate entry points for:
  - creating a new policy with an initial draft
  - creating a new draft version under an existing policy
  - editing a `draft` version only
- map governance validation/status errors to the existing `409` or `400` response families consistently

- [ ] **Step 4: Re-run the targeted HTTP tests and confirm they pass**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test test/http/http-server.spec.ts test/http/persistent-governance-http.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the HTTP/runtime-wiring slice**

Run:

```bash
git add apps/api/src/http/api-http-server.ts apps/api/src/http/persistent-governance-runtime.ts apps/api/test/http/http-server.spec.ts apps/api/test/http/persistent-governance-http.spec.ts
git commit -m "feat: expose model routing governance API"
```

### Task 4: Upgrade Admin Governance To Author, Review, Activate, And Inspect Routing Policy

**Files:**
- Create: `apps/web/src/features/model-routing-governance/types.ts`
- Create: `apps/web/src/features/model-routing-governance/model-routing-governance-api.ts`
- Create: `apps/web/src/features/model-routing-governance/index.ts`
- Modify: `apps/web/src/features/admin-governance/admin-governance-controller.ts`
- Modify: `apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx`
- Modify: `apps/web/src/features/admin-governance/agent-tooling-governance-section.tsx`
- Modify: `apps/web/src/features/admin-governance/agent-execution-evidence-view.tsx`
- Modify: `apps/web/src/features/execution-governance/types.ts`
- Modify: `apps/web/src/features/agent-execution/types.ts`
- Test: `apps/web/test/admin-governance-controller.spec.ts`
- Test: `apps/web/test/agent-tooling-governance-section.spec.tsx`
- Test: `apps/web/test/agent-execution-evidence-view.spec.tsx`

- [ ] **Step 1: Add failing web tests for governance overview, lifecycle actions, and execution evidence**

Add controller coverage that proves `loadOverview()` now returns:

```ts
assert.equal(overview.routingPolicies[0]?.scope_kind, "template_family");
assert.equal(overview.routingPolicies[0]?.active_version?.status, "active");
assert.equal(overview.routingPolicies[0]?.active_version?.primary_model_id, "model-primary-1");
assert.deepEqual(
  overview.routingPolicies[0]?.active_version?.fallback_model_ids,
  ["model-fallback-1"],
);
```

Add UI assertions for:

- a routing-policy draft panel inside `Admin Governance Console`
- policy tables grouped by `template_family` and `module`
- a `New Draft Version` path on an existing policy row
- version actions:
  - `Save Draft`
  - `Submit For Review`
  - `Approve`
  - `Activate`
  - `Rollback`
- evidence references rendered as suite/run/evidence chips or links
- execution evidence view showing:
  - `Routing Policy Hit`
  - `Resolved Model`
  - `Fallback Outcome`

Add preview assertions proving the new `model_source` labels render human-readable policy/legacy text.

- [ ] **Step 2: Run the targeted web unit tests and confirm they fail**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/admin-governance-controller.spec.ts test/agent-tooling-governance-section.spec.tsx test/agent-execution-evidence-view.spec.tsx
```

Expected: FAIL because the web layer has no typed client for versioned routing governance, the admin console cannot perform lifecycle actions, and the evidence drawer does not render routing-policy audit metadata.

- [ ] **Step 3: Implement the new typed client and Admin Governance UI/state changes**

Implementation rules:

- keep `Evaluation Workbench` as an evidence source only; do not place activation controls there
- create a dedicated web feature client `model-routing-governance`
- load routing policies in `AdminGovernanceOverview` alongside registry assets and execution logs
- keep model registry entry selection in the admin UI driven by `model-registry` entries; do not duplicate model asset state into routing-policy payloads
- render evidence links by reference, not copied summaries
- display fallback chains even when fallback has not been used yet
- render execution evidence in three layers:
  - matched routing policy/version
  - resolved model and source
  - fallback outcome if one occurred

- [ ] **Step 4: Re-run the targeted web unit tests and confirm they pass**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test test/admin-governance-controller.spec.ts test/agent-tooling-governance-section.spec.tsx test/agent-execution-evidence-view.spec.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit the admin-governance web slice**

Run:

```bash
git add apps/web/src/features/model-routing-governance apps/web/src/features/admin-governance apps/web/src/features/execution-governance/types.ts apps/web/src/features/agent-execution/types.ts apps/web/test/admin-governance-controller.spec.ts apps/web/test/agent-tooling-governance-section.spec.tsx apps/web/test/agent-execution-evidence-view.spec.tsx
git commit -m "feat: add admin model routing governance console"
```

### Task 5: Prove The Operator Flow In Browser And Update Docs

**Files:**
- Modify: `apps/web/playwright/admin-governance.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Add a failing browser scenario for the governed routing flow**

Extend `apps/web/playwright/admin-governance.spec.ts` to prove this operator path:

1. load seeded evaluation evidence
2. open `Admin Governance Console`
3. create a `template_family` routing-policy draft
4. attach evidence references
5. submit, approve, and activate the version
6. trigger a governed execution or preview resolution
7. inspect the execution evidence drawer for the routing-policy hit

Assert browser-visible text similar to:

- `Active Policy`
- `template_family`
- `model-primary-1`
- `model-fallback-1`
- `Routing Policy Hit`
- `template_family_policy`

- [ ] **Step 2: Run the targeted browser spec and confirm it fails**

Run:

```bash
pnpm --filter @medsys/web exec playwright test playwright/admin-governance.spec.ts --grep "routing governance|governed routing flow"
```

Expected: FAIL because the operator flow is not yet wired end-to-end in the browser.

- [ ] **Step 3: Finish any browser-facing polish and update the README**

Update `README.md` to explain that:

- `Model Registry` stores approved model assets
- `Model Routing Governance` stores versioned routing policy by `module + template_family`
- `Admin Governance Console` is the routing control plane
- live runtime reads only active policy, then falls back to the legacy singleton defaults when no active governed policy exists

- [ ] **Step 4: Re-run the browser flow and the release gate slice**

Run:

```bash
pnpm --filter @medsys/web exec playwright test playwright/admin-governance.spec.ts
pnpm verify:manuscript-workbench
```

Expected: PASS, or explicitly record any unrelated pre-existing failures before proceeding.

- [ ] **Step 5: Stage the full Phase 10B slice and commit**

Run:

```bash
git add apps/api/src/database/migrations/0015_model_routing_governance_persistence.sql apps/api/src/modules/model-routing-governance apps/api/src/modules/ai-gateway apps/api/src/modules/execution-resolution apps/api/src/modules/shared/governed-module-context-resolver.ts apps/api/src/modules/shared/module-run-support.ts apps/api/src/modules/agent-execution apps/api/src/modules/editing/editing-service.ts apps/api/src/modules/screening/screening-service.ts apps/api/src/modules/proofreading/proofreading-service.ts apps/api/src/http/api-http-server.ts apps/api/src/http/persistent-governance-runtime.ts apps/api/test/model-routing-governance apps/api/test/ai-gateway/ai-gateway.spec.ts apps/api/test/execution-resolution/execution-resolution.spec.ts apps/api/test/agent-execution/agent-execution-log.spec.ts apps/api/test/agent-execution/postgres-agent-execution-persistence.spec.ts apps/api/test/modules/governed-module-context-resolver.spec.ts apps/api/test/modules/module-orchestration.spec.ts apps/api/test/http/http-server.spec.ts apps/api/test/http/persistent-governance-http.spec.ts apps/api/test/database/schema.spec.ts apps/web/src/features/model-routing-governance apps/web/src/features/admin-governance apps/web/src/features/execution-governance/types.ts apps/web/src/features/agent-execution/types.ts apps/web/test/admin-governance-controller.spec.ts apps/web/test/agent-tooling-governance-section.spec.tsx apps/web/test/agent-execution-evidence-view.spec.tsx apps/web/playwright/admin-governance.spec.ts README.md docs/superpowers/specs/2026-04-03-phase10b-model-governance-routing-linkage-design.md docs/superpowers/plans/2026-04-03-phase10b-model-governance-routing-linkage.md
git commit -m "feat: link model governance routing to runtime"
```
