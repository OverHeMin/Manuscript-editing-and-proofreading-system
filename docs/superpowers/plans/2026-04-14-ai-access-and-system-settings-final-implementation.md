# AI Access And System Settings Final Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finalize `AI接入 / 账号与权限` inside system settings so internal operators can manage provider connections, register usable models, bind modules to models with temperature defaults, and stop relying on duplicated downstream model controls.

**Architecture:** Keep `system-settings` as one workbench id with two routed sections: `ai-access` and `accounts`. Reuse the existing account-management surface and current provider-connection foundation, then extend the `AI接入` section into three bounded operator layers: provider connections, model registry, and module defaults. Use additive HTTP routes and view models so downstream pages can later consume resolved module settings instead of exposing their own provider and temperature controls.

**Tech Stack:** React 18, TypeScript, Vite feature CSS, existing `apps/web/src/features/system-settings` module, existing backend modules in `apps/api/src/modules/ai-provider-connections`, `model-registry`, and `model-routing-governance`, Node test runner with `tsx`.

---

## Scope And Status

This plan implements the final AI-access posture implied by:

- [2026-04-10-ai-provider-control-plane-design.md](/C:/医学稿件处理系统V1/docs/superpowers/specs/2026-04-10-ai-provider-control-plane-design.md)
- [2026-04-14-system-redesign-master-implementation.md](/C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-14-system-redesign-master-implementation.md)

This plan builds on existing account-management work instead of replacing it:

- [2026-04-07-system-settings-account-management.md](/C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-07-system-settings-account-management.md)

The final operator split is:

- `AI接入`
- `账号与权限`

The `AI接入` section must own:

- provider connections
- API key rotation
- connection testing
- model registration
- module-to-model defaults
- module temperature defaults

The `账号与权限` section must own:

- user creation
- role changes
- password resets
- enable/disable state

This plan does **not** redesign rule-center overrides or Harness policy surfaces. It only provides the stable system-settings baseline those modules should consume.

## File Structure

### Web system-settings surface

- `apps/web/src/features/system-settings/index.ts`
- `apps/web/src/features/system-settings/types.ts`
- `apps/web/src/features/system-settings/system-settings-api.ts`
- `apps/web/src/features/system-settings/system-settings-controller.ts`
- `apps/web/src/features/system-settings/system-settings-workbench-page.tsx`
- `apps/web/src/features/system-settings/system-settings-workbench.css`
- `apps/web/src/features/auth/workbench.ts`

### Web tests

- `apps/web/test/system-settings-controller.spec.ts`
- `apps/web/test/system-settings-workbench-page.spec.tsx`
- `apps/web/test/workbench-host.spec.tsx`

### Backend provider connection layer

- `apps/api/src/modules/ai-provider-connections/ai-provider-connection-record.ts`
- `apps/api/src/modules/ai-provider-connections/ai-provider-connection-service.ts`
- `apps/api/src/modules/ai-provider-connections/ai-provider-connection-api.ts`
- `apps/api/src/modules/ai-provider-connections/ai-provider-connection-repository.ts`
- `apps/api/src/modules/ai-provider-connections/postgres-ai-provider-connection-repository.ts`

### Backend model registry and module default layer

- `apps/api/src/modules/model-registry/model-record.ts`
- `apps/api/src/modules/model-registry/model-registry-service.ts`
- `apps/api/src/modules/model-registry/model-registry-api.ts`
- `apps/api/src/modules/model-registry/model-registry-repository.ts`
- `apps/api/src/modules/model-registry/postgres-model-registry-repository.ts`
- `apps/api/src/modules/model-routing-governance/model-routing-governance-record.ts`
- `apps/api/src/modules/model-routing-governance/model-routing-governance-service.ts`
- `apps/api/src/modules/model-routing-governance/model-routing-governance-api.ts`
- `apps/api/src/modules/model-routing-governance/model-routing-governance-repository.ts`
- `apps/api/src/modules/model-routing-governance/postgres-model-routing-governance-repository.ts`

### HTTP runtime and API tests

- `apps/api/src/http/api-http-server.ts`
- `apps/api/src/http/persistent-governance-runtime.ts`
- `apps/api/test/http/system-settings-http.spec.ts`
- `apps/api/test/ai-provider-connections/ai-provider-connection-service.spec.ts`
- `apps/api/test/ai-provider-connections/postgres-ai-provider-connection-persistence.spec.ts`
- `apps/api/test/model-registry/postgres-model-registry-persistence.spec.ts`
- `apps/api/test/model-routing-governance/model-routing-governance.spec.ts`
- `apps/api/test/model-routing-governance/postgres-model-routing-governance-persistence.spec.ts`

## Task 1: Lock the final system-settings IA and keep accounts separate from AI access

**Files:**
- Modify: `apps/web/src/features/system-settings/system-settings-workbench-page.tsx`
- Modify: `apps/web/src/features/system-settings/types.ts`
- Modify: `apps/web/test/system-settings-workbench-page.spec.tsx`
- Modify: `apps/web/test/workbench-host.spec.tsx`

- [ ] **Step 1: Write failing page tests for the final section split**

Cover:

- `AI接入` and `账号与权限` remain separate routed first views
- `AI接入` does not repeat user-management controls as the main content
- `账号与权限` does not repeat provider/model/temperature controls as the main content
- the AI-access first view clearly presents three operator layers:
  - provider connections
  - model registry
  - module defaults

- [ ] **Step 2: Run the system-settings page tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/system-settings-workbench-page.spec.tsx ./test/workbench-host.spec.tsx
```

Expected: FAIL because the current page still mixes connection management and account management more heavily than the final IA allows, and it does not yet expose model registry or module-default layers.

- [ ] **Step 3: Implement the final section-specific landing posture in the page model**

Apply these rules:

- `AI接入` is the operational control plane for AI
- `账号与权限` is the operational control plane for people and roles
- section-specific empty states and demo-mode notices remain aligned to the active section
- the first visible content on `AI接入` should be AI-focused, not a mixed admin overview

- [ ] **Step 4: Re-run the system-settings page tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/system-settings-workbench-page.spec.tsx ./test/workbench-host.spec.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/system-settings/system-settings-workbench-page.tsx apps/web/src/features/system-settings/types.ts apps/web/test/system-settings-workbench-page.spec.tsx apps/web/test/workbench-host.spec.tsx
git commit -m "feat: finalize system settings section split"
```

## Task 2: Extend the backend and HTTP layer from provider connections to usable AI access overview data

**Files:**
- Modify: `apps/api/src/modules/ai-provider-connections/ai-provider-connection-record.ts`
- Modify: `apps/api/src/modules/ai-provider-connections/ai-provider-connection-service.ts`
- Modify: `apps/api/src/modules/ai-provider-connections/ai-provider-connection-api.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Modify: `apps/api/test/http/system-settings-http.spec.ts`
- Modify: `apps/api/test/ai-provider-connections/ai-provider-connection-service.spec.ts`
- Modify: `apps/api/test/ai-provider-connections/postgres-ai-provider-connection-persistence.spec.ts`

- [ ] **Step 1: Write failing tests for the final AI-access overview contract**

Cover:

- system-settings can list provider connections together with:
  - readiness status
  - masked credential summary
  - compatibility mode
  - connection metadata including test model
- the system-settings HTTP surface exposes the AI-access records under the existing `system-settings` namespace
- provider creation, update, credential rotation, and test still work after the expanded overview contract

- [ ] **Step 2: Run the backend AI-access tests to verify RED**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/http/system-settings-http.spec.ts ./test/ai-provider-connections/ai-provider-connection-service.spec.ts ./test/ai-provider-connections/postgres-ai-provider-connection-persistence.spec.ts
```

Expected: FAIL because the current contract does not yet provide the full overview data needed by the final AI-access page.

- [ ] **Step 3: Expand the provider-connection view contract without breaking existing connection operations**

Apply these rules:

- keep provider connections as the credential-owning layer
- keep list/create/update/rotate/test route compatibility where practical
- add only the extra read data needed for the final operator surface
- do not move account-management logic into the AI layer

- [ ] **Step 4: Re-run the backend AI-access tests to verify GREEN**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/http/system-settings-http.spec.ts ./test/ai-provider-connections/ai-provider-connection-service.spec.ts ./test/ai-provider-connections/postgres-ai-provider-connection-persistence.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/ai-provider-connections/ai-provider-connection-record.ts apps/api/src/modules/ai-provider-connections/ai-provider-connection-service.ts apps/api/src/modules/ai-provider-connections/ai-provider-connection-api.ts apps/api/src/http/api-http-server.ts apps/api/src/http/persistent-governance-runtime.ts apps/api/test/http/system-settings-http.spec.ts apps/api/test/ai-provider-connections/ai-provider-connection-service.spec.ts apps/api/test/ai-provider-connections/postgres-ai-provider-connection-persistence.spec.ts
git commit -m "feat: expand ai access provider overview data"
```

## Task 3: Add model registry management under AI access using the existing model-registry foundation

**Files:**
- Modify: `apps/api/src/modules/model-registry/model-record.ts`
- Modify: `apps/api/src/modules/model-registry/model-registry-service.ts`
- Modify: `apps/api/src/modules/model-registry/model-registry-api.ts`
- Modify: `apps/api/src/modules/model-registry/model-registry-repository.ts`
- Modify: `apps/api/src/modules/model-registry/postgres-model-registry-repository.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Modify: `apps/api/test/model-registry/postgres-model-registry-persistence.spec.ts`
- Modify: `apps/api/test/http/system-settings-http.spec.ts`

- [ ] **Step 1: Write failing tests for model registration inside system settings**

Cover:

- operators can list registered models from the system-settings AI-access surface
- a model can be created against a managed provider connection
- a model stores:
  - display name or model name
  - connection binding
  - allowed modules
  - production allowed flag
  - optional fallback model id
- a model cannot bind to a missing or disabled connection

- [ ] **Step 2: Run the model-registry and HTTP tests to verify RED**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/model-registry/postgres-model-registry-persistence.spec.ts ./test/http/system-settings-http.spec.ts
```

Expected: FAIL because model registration is not yet exposed as an operator-facing system-settings capability.

- [ ] **Step 3: Extend model-registry persistence and API with system-settings friendly operations**

Apply these rules:

- reuse the existing `connection_id` concept in the model record
- validate that managed models only point to known provider connections
- keep model registration additive and bounded to internal trial needs
- do not broaden provider support beyond the currently approved internal-trial set just to satisfy the UI

- [ ] **Step 4: Re-run the model-registry and HTTP tests to verify GREEN**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/model-registry/postgres-model-registry-persistence.spec.ts ./test/http/system-settings-http.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/model-registry/model-record.ts apps/api/src/modules/model-registry/model-registry-service.ts apps/api/src/modules/model-registry/model-registry-api.ts apps/api/src/modules/model-registry/model-registry-repository.ts apps/api/src/modules/model-registry/postgres-model-registry-repository.ts apps/api/src/http/api-http-server.ts apps/api/src/http/persistent-governance-runtime.ts apps/api/test/model-registry/postgres-model-registry-persistence.spec.ts apps/api/test/http/system-settings-http.spec.ts
git commit -m "feat: add model registry management to ai access"
```

## Task 4: Add module defaults and temperature management without duplicating rule-center overrides

**Files:**
- Modify: `apps/api/src/modules/model-routing-governance/model-routing-governance-record.ts`
- Modify: `apps/api/src/modules/model-routing-governance/model-routing-governance-service.ts`
- Modify: `apps/api/src/modules/model-routing-governance/model-routing-governance-api.ts`
- Modify: `apps/api/src/modules/model-routing-governance/model-routing-governance-repository.ts`
- Modify: `apps/api/src/modules/model-routing-governance/postgres-model-routing-governance-repository.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Modify: `apps/api/test/model-routing-governance/model-routing-governance.spec.ts`
- Modify: `apps/api/test/model-routing-governance/postgres-model-routing-governance-persistence.spec.ts`
- Modify: `apps/api/test/http/system-settings-http.spec.ts`

- [ ] **Step 1: Write failing tests for module-default routing under AI access**

Cover:

- operators can list module defaults for at least:
  - screening
  - editing
  - proofreading
- each module default can store:
  - primary model
  - optional fallback model
  - temperature
- module defaults stay distinct from later template-family or rule-center overrides
- temperature is validated into a safe bounded numeric range

- [ ] **Step 2: Run the model-routing and HTTP tests to verify RED**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/model-routing-governance/model-routing-governance.spec.ts ./test/model-routing-governance/postgres-model-routing-governance-persistence.spec.ts ./test/http/system-settings-http.spec.ts
```

Expected: FAIL because the current routing records do not yet expose a simple system-settings module-default layer with temperature.

- [ ] **Step 3: Extend routing-governance records with bounded module-default temperature support**

Apply these rules:

- module-level defaults live in system settings
- finer-grained template-family routing remains available to governance flows later
- the AI-access page should manage the simple default layer, not the full governance lifecycle
- keep the data model additive so existing routing-governance concepts remain reusable

- [ ] **Step 4: Expose additive system-settings HTTP endpoints for module defaults**

Use the `system-settings` route namespace so the web workbench can load and update module defaults from one place.

- [ ] **Step 5: Re-run the model-routing and HTTP tests to verify GREEN**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/model-routing-governance/model-routing-governance.spec.ts ./test/model-routing-governance/postgres-model-routing-governance-persistence.spec.ts ./test/http/system-settings-http.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/model-routing-governance/model-routing-governance-record.ts apps/api/src/modules/model-routing-governance/model-routing-governance-service.ts apps/api/src/modules/model-routing-governance/model-routing-governance-api.ts apps/api/src/modules/model-routing-governance/model-routing-governance-repository.ts apps/api/src/modules/model-routing-governance/postgres-model-routing-governance-repository.ts apps/api/src/http/api-http-server.ts apps/api/src/http/persistent-governance-runtime.ts apps/api/test/model-routing-governance/model-routing-governance.spec.ts apps/api/test/model-routing-governance/postgres-model-routing-governance-persistence.spec.ts apps/api/test/http/system-settings-http.spec.ts
git commit -m "feat: add ai module defaults and temperature settings"
```

## Task 5: Build the final AI-access page with three bounded operator layers

**Files:**
- Modify: `apps/web/src/features/system-settings/types.ts`
- Modify: `apps/web/src/features/system-settings/system-settings-api.ts`
- Modify: `apps/web/src/features/system-settings/system-settings-controller.ts`
- Modify: `apps/web/src/features/system-settings/system-settings-workbench-page.tsx`
- Modify: `apps/web/src/features/system-settings/system-settings-workbench.css`
- Modify: `apps/web/test/system-settings-controller.spec.ts`
- Modify: `apps/web/test/system-settings-workbench-page.spec.tsx`

- [ ] **Step 1: Write failing web tests for the final AI-access content structure**

Cover:

- `AI接入` shows three bounded operator layers:
  - provider connections
  - registered models
  - module defaults
- the operator can see which module uses which model
- the operator can see and edit temperature in the AI-access page
- account-management forms are not the dominant first-view content in the AI section
- safe English labels such as `temperature` are localized in the operator UI

- [ ] **Step 2: Run the focused system-settings web tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/system-settings-controller.spec.ts ./test/system-settings-workbench-page.spec.tsx
```

Expected: FAIL because the current page does not yet expose the full model and module-binding layers.

- [ ] **Step 3: Extend the web API and controller with model and module-default operations**

Add thin client/controller methods for:

- list and mutate provider connections
- list and mutate registered models
- list and mutate module defaults with temperature

Keep the controller reload model coherent so selection remains stable after each mutation where practical.

- [ ] **Step 4: Implement the final AI-access page layout**

Apply these rules:

- keep the page simple and Chinese-first
- present connections, models, and module defaults as bounded operator sections or tabs
- keep advanced details such as compatibility metadata and credential rotation tucked into the relevant bounded area
- do not reintroduce large hero panels or oversized explanation cards

- [ ] **Step 5: Re-run the focused system-settings web tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/system-settings-controller.spec.ts ./test/system-settings-workbench-page.spec.tsx
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/system-settings/types.ts apps/web/src/features/system-settings/system-settings-api.ts apps/web/src/features/system-settings/system-settings-controller.ts apps/web/src/features/system-settings/system-settings-workbench-page.tsx apps/web/src/features/system-settings/system-settings-workbench.css apps/web/test/system-settings-controller.spec.ts apps/web/test/system-settings-workbench-page.spec.tsx
git commit -m "feat: complete the final ai access system settings surface"
```

## Task 6: Add downstream-read contracts so later page plans can remove duplicate model controls

**Files:**
- Modify: `apps/web/src/features/system-settings/types.ts`
- Modify: `apps/web/src/features/system-settings/system-settings-api.ts`
- Modify: `apps/web/src/features/system-settings/system-settings-controller.ts`
- Modify: `apps/web/test/system-settings-controller.spec.ts`

- [ ] **Step 1: Write failing controller tests for downstream-read access**

Cover:

- the controller can expose a resolved module-default view suitable for downstream workbench pages
- the contract includes the selected model label and temperature
- the contract is read-oriented and does not require downstream pages to understand provider credentials or connection internals

- [ ] **Step 2: Run the controller tests to verify RED**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/system-settings-controller.spec.ts
```

Expected: FAIL because the current controller only serves the settings page itself.

- [ ] **Step 3: Add the bounded read contract for later page plans**

Apply these rules:

- this task does not remove downstream controls yet
- it prepares one stable read contract so manuscript workbenches, knowledge pages, and rule-center pages can later consume resolved defaults
- avoid leaking credential or provider-maintenance details into downstream consumers

- [ ] **Step 4: Re-run the controller tests to verify GREEN**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/system-settings-controller.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/system-settings/types.ts apps/web/src/features/system-settings/system-settings-api.ts apps/web/src/features/system-settings/system-settings-controller.ts apps/web/test/system-settings-controller.spec.ts
git commit -m "feat: expose shared ai-access defaults for downstream pages"
```

## Task 7: Verify the final system-settings baseline and stop before downstream deduplication

**Files:**
- Verify touched files only

- [ ] **Step 1: Run the full system-settings regression suite**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/system-settings-controller.spec.ts ./test/system-settings-workbench-page.spec.tsx ./test/workbench-host.spec.tsx
pnpm --filter @medical/api exec node --import tsx --test ./test/http/system-settings-http.spec.ts ./test/ai-provider-connections/ai-provider-connection-service.spec.ts ./test/ai-provider-connections/postgres-ai-provider-connection-persistence.spec.ts ./test/model-registry/postgres-model-registry-persistence.spec.ts ./test/model-routing-governance/model-routing-governance.spec.ts ./test/model-routing-governance/postgres-model-routing-governance-persistence.spec.ts
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 2: Perform browser acceptance for the final system-settings flow**

Manual checklist:

- `AI接入` first sees provider connections, registered models, and module defaults
- entering only an API key plus minimal metadata is enough to create a provider connection
- module defaults visibly assign models to modules
- temperature is editable in the same section
- `账号与权限` remains focused on users and roles
- no other workbench page needs to own provider credentials after this baseline lands

- [ ] **Step 3: Commit only if the verification pass required extra source adjustments**

```bash
git add apps/web/src/features/system-settings/index.ts apps/web/src/features/system-settings/types.ts apps/web/src/features/system-settings/system-settings-api.ts apps/web/src/features/system-settings/system-settings-controller.ts apps/web/src/features/system-settings/system-settings-workbench-page.tsx apps/web/src/features/system-settings/system-settings-workbench.css apps/api/src/modules/ai-provider-connections/ai-provider-connection-record.ts apps/api/src/modules/ai-provider-connections/ai-provider-connection-service.ts apps/api/src/modules/ai-provider-connections/ai-provider-connection-api.ts apps/api/src/modules/model-registry/model-record.ts apps/api/src/modules/model-registry/model-registry-service.ts apps/api/src/modules/model-registry/model-registry-api.ts apps/api/src/modules/model-registry/model-registry-repository.ts apps/api/src/modules/model-registry/postgres-model-registry-repository.ts apps/api/src/modules/model-routing-governance/model-routing-governance-record.ts apps/api/src/modules/model-routing-governance/model-routing-governance-service.ts apps/api/src/modules/model-routing-governance/model-routing-governance-api.ts apps/api/src/modules/model-routing-governance/model-routing-governance-repository.ts apps/api/src/modules/model-routing-governance/postgres-model-routing-governance-repository.ts apps/api/src/http/api-http-server.ts apps/api/src/http/persistent-governance-runtime.ts apps/web/test/system-settings-controller.spec.ts apps/web/test/system-settings-workbench-page.spec.tsx apps/web/test/workbench-host.spec.tsx apps/api/test/http/system-settings-http.spec.ts apps/api/test/ai-provider-connections/ai-provider-connection-service.spec.ts apps/api/test/ai-provider-connections/postgres-ai-provider-connection-persistence.spec.ts apps/api/test/model-registry/postgres-model-registry-persistence.spec.ts apps/api/test/model-routing-governance/model-routing-governance.spec.ts apps/api/test/model-routing-governance/postgres-model-routing-governance-persistence.spec.ts
git commit -m "test: verify final ai access and system settings baseline"
```

Skip the commit if verification is green and no extra edits were needed.

## Master-Plan Alignment

This child plan fills the second execution dependency in:

- [2026-04-14-system-redesign-master-implementation.md](/C:/医学稿件处理系统V1/docs/superpowers/plans/2026-04-14-system-redesign-master-implementation.md)

It should execute after:

- shared shell stabilization

It should complete before:

- rule-center rollout
- knowledge-library rollout
- knowledge-review simplification
- manuscript workbench redesign

Because those later modules should consume centralized AI defaults instead of carrying their own provider and temperature controls.

## Execution Gate

Do not start implementation from this document yet.

Current user instruction is:

- continue finishing the total planning set
- do not begin implementation until the remaining plans are finished

When execution is eventually approved, follow the tasks in order:

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
7. Task 7
