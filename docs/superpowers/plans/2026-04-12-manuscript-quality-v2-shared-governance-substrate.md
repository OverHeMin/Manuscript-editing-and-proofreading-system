# Manuscript Quality V2 Shared Governance Substrate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the governed quality-asset substrate that lets `general_proofreading` V2 and `medical_specialized` V2 use backend-maintained package versions through runtime bindings and Harness, without changing current manuscript authority or breaking the existing governed flow.

**Architecture:** Keep analyzer engines repo-owned in Python and TypeScript, but move configurable quality assets into governed package records with draft and published lifecycle. Bind published package versions through runtime bindings, record the active package refs in execution snapshots and frozen Harness comparisons, and make the admin workbench the place where operators maintain package metadata and manifests.

**Tech Stack:** TypeScript, Node `node:test`, `tsx`, React, Postgres, existing admin-governance workbench, runtime bindings, Harness control plane, Python worker JSON bridge.

---

## Scope Notes

- This plan implements the shared foundation required by:
  - `docs/superpowers/specs/2026-04-12-manuscript-quality-v2-governance-and-branching-design.md`
  - `docs/superpowers/plans/2026-04-12-general-proofreading-v2-style-package.md`
  - `docs/superpowers/plans/2026-04-12-medical-specialized-v2-governed-assets.md`
- Implement this plan on a dedicated branch, not on the mixed branch:
  - Recommended branch: `codex/manuscript-quality-v2-harness-binding`
- Do not continue V2 implementation on `codex/harness-control-plane-p0`.
- This plan must not move knowledge authoring, editorial rule authoring, or analyzer source code editing into the browser.
- This plan should only introduce governed package storage, selection, preview, activation traceability, and runtime forwarding. Concrete general and medical package schemas land in the two follow-on plans.

## File Structure

### New files

- `packages/contracts/src/manuscript-quality-packages.ts`
- `apps/api/src/database/migrations/0037_manuscript_quality_package_governance.sql`
- `apps/api/src/modules/manuscript-quality-packages/manuscript-quality-package-record.ts`
- `apps/api/src/modules/manuscript-quality-packages/manuscript-quality-package-repository.ts`
- `apps/api/src/modules/manuscript-quality-packages/in-memory-manuscript-quality-package-repository.ts`
- `apps/api/src/modules/manuscript-quality-packages/postgres-manuscript-quality-package-repository.ts`
- `apps/api/src/modules/manuscript-quality-packages/manuscript-quality-package-service.ts`
- `apps/api/src/modules/manuscript-quality-packages/manuscript-quality-package-api.ts`
- `apps/api/src/modules/manuscript-quality-packages/index.ts`
- `apps/api/test/manuscript-quality-packages/manuscript-quality-package-service.spec.ts`
- `apps/api/test/manuscript-quality-packages/postgres-manuscript-quality-package-persistence.spec.ts`
- `apps/api/test/verification-ops/experiment-binding-guard.spec.ts`
- `apps/web/src/features/admin-governance/manuscript-quality-packages-section.tsx`
- `apps/web/src/features/admin-governance/runtime-binding-quality-package-editor.tsx`

### Modified files

- `packages/contracts/src/index.ts`
- `packages/contracts/src/manuscript-quality.ts`
- `packages/contracts/src/governed-execution.ts`
- `apps/api/src/modules/manuscript-quality/manuscript-quality-types.ts`
- `apps/api/src/modules/manuscript-quality/manuscript-quality-service.ts`
- `apps/api/src/modules/manuscript-quality/manuscript-quality-worker-adapter.ts`
- `apps/api/src/modules/runtime-bindings/runtime-binding-record.ts`
- `apps/api/src/modules/runtime-bindings/runtime-binding-service.ts`
- `apps/api/src/modules/runtime-bindings/runtime-binding-api.ts`
- `apps/api/src/modules/runtime-bindings/runtime-binding-readiness.ts`
- `apps/api/src/modules/runtime-bindings/runtime-binding-readiness-service.ts`
- `apps/api/src/modules/verification-ops/verification-ops-record.ts`
- `apps/api/src/modules/verification-ops/experiment-binding-guard.ts`
- `apps/api/src/modules/harness-control-plane/harness-control-plane-record.ts`
- `apps/api/src/http/api-http-server.ts`
- `apps/api/src/http/persistent-governance-runtime.ts`
- `apps/api/src/database/migration-ledger.ts`
- `apps/api/src/modules/execution-tracking/execution-tracking-record.ts`
- `apps/api/src/modules/execution-tracking/execution-tracking-service.ts`
- `apps/api/src/modules/execution-tracking/execution-tracking-api.ts`
- `apps/api/src/modules/execution-tracking/postgres-execution-tracking-repository.ts`
- `apps/api/src/modules/execution-tracking/in-memory-execution-tracking-repository.ts`
- `apps/api/test/runtime-bindings/runtime-binding-registry.spec.ts`
- `apps/api/test/runtime-bindings/postgres-runtime-binding-persistence.spec.ts`
- `apps/api/test/harness-control-plane/harness-control-plane-service.spec.ts`
- `apps/api/test/http/persistent-governance-http.spec.ts`
- `apps/web/src/features/admin-governance/admin-governance-controller.ts`
- `apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx`
- `apps/web/src/features/admin-governance/harness-environment-editor.tsx`
- `apps/web/src/features/admin-governance/harness-activation-gate.tsx`
- `apps/web/src/features/admin-governance/harness-quality-lab.tsx`

## Test Commands

- `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality-packages/manuscript-quality-package-service.spec.ts ./test/runtime-bindings/runtime-binding-registry.spec.ts ./test/verification-ops/experiment-binding-guard.spec.ts`
- `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality-packages/postgres-manuscript-quality-package-persistence.spec.ts ./test/runtime-bindings/postgres-runtime-binding-persistence.spec.ts`
- `pnpm --filter @medical/api exec node --import tsx --test ./test/harness-control-plane/harness-control-plane-service.spec.ts ./test/http/persistent-governance-http.spec.ts`
- `pnpm --filter @medical/api typecheck`
- `pnpm typecheck`

---

### Task 1: Define the governed package contract and persistence model

**Files:**
- Create: `packages/contracts/src/manuscript-quality-packages.ts`
- Modify: `packages/contracts/src/manuscript-quality.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/api/src/database/migrations/0037_manuscript_quality_package_governance.sql`
- Create: `apps/api/src/modules/manuscript-quality-packages/manuscript-quality-package-record.ts`
- Create: `apps/api/src/modules/manuscript-quality-packages/manuscript-quality-package-repository.ts`
- Create: `apps/api/src/modules/manuscript-quality-packages/in-memory-manuscript-quality-package-repository.ts`
- Create: `apps/api/src/modules/manuscript-quality-packages/postgres-manuscript-quality-package-repository.ts`
- Create: `apps/api/test/manuscript-quality-packages/postgres-manuscript-quality-package-persistence.spec.ts`

- [ ] **Step 1: Write the failing persistence and contract tests**

```ts
assert.equal(packageRecord.package_kind, "general_style_package");
assert.equal(packageRecord.status, "draft");
assert.deepEqual(packageRecord.target_scopes, ["general_proofreading"]);
```

- [ ] **Step 2: Run the focused persistence tests and verify they fail**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality-packages/postgres-manuscript-quality-package-persistence.spec.ts`
Expected: FAIL because the repository, migration, and package contract do not exist yet.

- [ ] **Step 3: Add the shared package contract**

```ts
export type ManuscriptQualityPackageKind =
  | "general_style_package"
  | "medical_analyzer_package";

export interface ManuscriptQualityPackageVersionRef {
  package_id: string;
  package_name: string;
  package_kind: ManuscriptQualityPackageKind;
  version: number;
}
```

- [ ] **Step 4: Create the migration and repository model**

```sql
create table manuscript_quality_package_versions (
  id text primary key,
  package_name text not null,
  package_kind text not null,
  version integer not null,
  status text not null,
  manifest jsonb not null
);
```

- [ ] **Step 5: Re-run the persistence tests and confirm PASS**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality-packages/postgres-manuscript-quality-package-persistence.spec.ts`
Expected: PASS with draft and published package versions reserving scoped version numbers correctly.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src/manuscript-quality-packages.ts packages/contracts/src/manuscript-quality.ts packages/contracts/src/index.ts apps/api/src/database/migrations/0037_manuscript_quality_package_governance.sql apps/api/src/modules/manuscript-quality-packages apps/api/test/manuscript-quality-packages/postgres-manuscript-quality-package-persistence.spec.ts
git commit -m "feat: add governed manuscript quality package persistence"
```

### Task 2: Add the package service, lifecycle, and HTTP surface

**Files:**
- Create: `apps/api/src/modules/manuscript-quality-packages/manuscript-quality-package-service.ts`
- Create: `apps/api/src/modules/manuscript-quality-packages/manuscript-quality-package-api.ts`
- Create: `apps/api/src/modules/manuscript-quality-packages/index.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Create: `apps/api/test/manuscript-quality-packages/manuscript-quality-package-service.spec.ts`
- Modify: `apps/api/test/http/persistent-governance-http.spec.ts`

- [ ] **Step 1: Write failing service and HTTP tests for create, publish, and list flows**

```ts
assert.equal(created.body.status, "draft");
assert.equal(published.body.status, "published");
assert.equal(listed.body[0].package_name, "Medical Research Style");
```

- [ ] **Step 2: Run the focused service tests and verify they fail**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality-packages/manuscript-quality-package-service.spec.ts ./test/http/persistent-governance-http.spec.ts`
Expected: FAIL because the service is not wired into the API runtime yet.

- [ ] **Step 3: Implement the governed lifecycle service**

```ts
createDraftVersion(input)
publishVersion(versionId, actorRole)
listPackageVersions({ packageKind, targetScope, status })
```

- [ ] **Step 4: Expose the lifecycle over `/api/v1/manuscript-quality-packages`**

```ts
if (method === "POST" && path === "/api/v1/manuscript-quality-packages") {
  return { route: "manuscript-quality-package-create" };
}
```

- [ ] **Step 5: Re-run the service and HTTP tests and confirm PASS**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality-packages/manuscript-quality-package-service.spec.ts ./test/http/persistent-governance-http.spec.ts`
Expected: PASS with draft creation, publish transition, and scope filtering covered.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/manuscript-quality-packages apps/api/src/http/api-http-server.ts apps/api/src/http/persistent-governance-runtime.ts apps/api/test/manuscript-quality-packages/manuscript-quality-package-service.spec.ts apps/api/test/http/persistent-governance-http.spec.ts
git commit -m "feat: add manuscript quality package governance api"
```

### Task 3: Bind package versions through runtime bindings and execution audit

**Files:**
- Modify: `apps/api/src/modules/runtime-bindings/runtime-binding-record.ts`
- Modify: `apps/api/src/modules/runtime-bindings/runtime-binding-service.ts`
- Modify: `apps/api/src/modules/runtime-bindings/runtime-binding-api.ts`
- Modify: `apps/api/src/modules/runtime-bindings/runtime-binding-readiness.ts`
- Modify: `apps/api/src/modules/runtime-bindings/runtime-binding-readiness-service.ts`
- Modify: `apps/api/src/modules/manuscript-quality/manuscript-quality-types.ts`
- Modify: `apps/api/src/modules/manuscript-quality/manuscript-quality-service.ts`
- Modify: `apps/api/src/modules/manuscript-quality/manuscript-quality-worker-adapter.ts`
- Modify: `packages/contracts/src/governed-execution.ts`
- Modify: `apps/api/src/modules/execution-tracking/execution-tracking-record.ts`
- Modify: `apps/api/src/modules/execution-tracking/execution-tracking-service.ts`
- Modify: `apps/api/src/modules/execution-tracking/execution-tracking-api.ts`
- Modify: `apps/api/src/modules/execution-tracking/postgres-execution-tracking-repository.ts`
- Modify: `apps/api/src/modules/execution-tracking/in-memory-execution-tracking-repository.ts`
- Modify: `apps/api/test/runtime-bindings/runtime-binding-registry.spec.ts`

- [ ] **Step 1: Write failing runtime-binding tests for package version refs**

```ts
assert.deepEqual(created.body.quality_package_version_ids, ["quality-package-version-1"]);
assert.equal(readiness.status, "ready");
```

- [ ] **Step 2: Run the focused binding tests and verify they fail**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/runtime-bindings/runtime-binding-registry.spec.ts`
Expected: FAIL because runtime bindings do not yet accept or validate package refs.

- [ ] **Step 3: Extend runtime bindings to carry published package versions**

```ts
quality_package_version_ids: dedupePreserveOrder(
  input.qualityPackageVersionIds ?? [],
),
```

- [ ] **Step 4: Forward active package manifests into the worker input and execution snapshot**

```ts
quality_packages: resolvedPackageVersions.map((record) => ({
  package_kind: record.package_kind,
  package_name: record.package_name,
  version: record.version,
  manifest: record.manifest,
}))
```

- [ ] **Step 5: Re-run the binding tests and confirm PASS**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/runtime-bindings/runtime-binding-registry.spec.ts`
Expected: PASS with published package validation, readiness reporting, and execution snapshot audit fields covered.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/runtime-bindings apps/api/src/modules/manuscript-quality apps/api/src/modules/execution-tracking packages/contracts/src/governed-execution.ts apps/api/test/runtime-bindings/runtime-binding-registry.spec.ts
git commit -m "feat: bind governed quality packages into runtime execution"
```

### Task 4: Extend frozen Harness comparisons with quality package refs

**Files:**
- Modify: `apps/api/src/modules/verification-ops/verification-ops-record.ts`
- Modify: `apps/api/src/modules/verification-ops/experiment-binding-guard.ts`
- Create: `apps/api/test/verification-ops/experiment-binding-guard.spec.ts`
- Modify: `apps/api/src/modules/harness-control-plane/harness-control-plane-record.ts`
- Modify: `apps/api/test/harness-control-plane/harness-control-plane-service.spec.ts`

- [ ] **Step 1: Write failing Harness comparison tests**

```ts
assert.deepEqual(run.body.candidate_binding?.quality_package_version_ids, [
  "quality-package-version-2",
]);
```

- [ ] **Step 2: Run the focused Harness and verification tests and verify they fail**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/verification-ops/experiment-binding-guard.spec.ts ./test/harness-control-plane/harness-control-plane-service.spec.ts`
Expected: FAIL because frozen bindings do not currently capture package refs.

- [ ] **Step 3: Extend frozen bindings and preview records**

```ts
export interface FrozenExperimentBindingRecord {
  lane: FrozenExperimentLane;
  runtime_binding_id?: string;
  quality_package_version_ids: string[];
}
```

- [ ] **Step 4: Ensure candidate and baseline environments preserve package refs during preview and rollback**

```ts
quality_package_version_ids: [...record.quality_package_version_ids]
```

- [ ] **Step 5: Re-run the Harness and verification tests and confirm PASS**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/verification-ops/experiment-binding-guard.spec.ts ./test/harness-control-plane/harness-control-plane-service.spec.ts`
Expected: PASS with baseline and candidate package refs stored in frozen comparisons.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/verification-ops apps/api/src/modules/harness-control-plane apps/api/test/verification-ops/experiment-binding-guard.spec.ts apps/api/test/harness-control-plane/harness-control-plane-service.spec.ts
git commit -m "feat: add quality package refs to harness comparisons"
```

### Task 5: Add admin-governance package management and runtime-binding UI

**Files:**
- Create: `apps/web/src/features/admin-governance/manuscript-quality-packages-section.tsx`
- Create: `apps/web/src/features/admin-governance/runtime-binding-quality-package-editor.tsx`
- Modify: `apps/web/src/features/admin-governance/admin-governance-controller.ts`
- Modify: `apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx`
- Modify: `apps/web/src/features/admin-governance/harness-environment-editor.tsx`
- Modify: `apps/web/src/features/admin-governance/harness-activation-gate.tsx`
- Modify: `apps/web/src/features/admin-governance/harness-quality-lab.tsx`

- [ ] **Step 1: Add the controller view model contract for quality packages**

```ts
qualityPackages: ManuscriptQualityPackageViewModel[];
createQualityPackageDraftAndReload(input)
publishQualityPackageVersionAndReload(input)
```

- [ ] **Step 2: Render a governed package section and runtime-binding selector**

```tsx
<ManuscriptQualityPackagesSection
  packages={overview.qualityPackages}
  onCreateDraft={handleCreateQualityPackageDraft}
/>
```

- [ ] **Step 3: Show bound package versions inside the Harness preview surfaces**

```tsx
<RuntimeBindingQualityPackageEditor
  availablePackages={overview.qualityPackages}
  selectedVersionIds={harnessSelection.qualityPackageVersionIds}
/>
```

- [ ] **Step 4: Manually smoke-test the workbench flow**

Run:
- `pnpm --filter @medical/web dev`
- Open the admin governance workbench
- Create a draft quality package, publish it, attach it to a draft runtime binding, and confirm the Harness preview shows the selected version refs
Expected: UI stays usable without affecting knowledge or editorial rule workbenches.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/admin-governance
git commit -m "feat: add admin workbench support for manuscript quality packages"
```

### Task 6: Run cross-module checkpoints and lock the no-regression boundary

**Files:**
- Modify: `apps/api/test/http/persistent-governance-http.spec.ts`
- Modify: `apps/api/test/runtime-bindings/postgres-runtime-binding-persistence.spec.ts`
- Modify: `apps/api/test/harness-control-plane/harness-control-plane-service.spec.ts`

- [ ] **Step 1: Run the focused package, binding, Harness, and HTTP suites**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality-packages/manuscript-quality-package-service.spec.ts ./test/manuscript-quality-packages/postgres-manuscript-quality-package-persistence.spec.ts ./test/runtime-bindings/runtime-binding-registry.spec.ts ./test/runtime-bindings/postgres-runtime-binding-persistence.spec.ts ./test/verification-ops/experiment-binding-guard.spec.ts ./test/harness-control-plane/harness-control-plane-service.spec.ts ./test/http/persistent-governance-http.spec.ts`
Expected: PASS.

- [ ] **Step 2: Run the repository-wide type checks**

Run:
- `pnpm --filter @medical/api typecheck`
- `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Verify the boundary remains intact**

Checklist:
- Quality packages are maintained from backend records, not executable browser-authored code
- Knowledge and editorial rule governance continue to use their own modules
- Runtime bindings remain the activation seam
- Harness compares and rolls back package refs without code edits

- [ ] **Step 4: Commit**

```bash
git add apps/api/test/http/persistent-governance-http.spec.ts apps/api/test/runtime-bindings/postgres-runtime-binding-persistence.spec.ts apps/api/test/harness-control-plane/harness-control-plane-service.spec.ts
git commit -m "test: lock manuscript quality package governance rollout"
```

## Review Notes

- This shared substrate is complete only when both admin-governance and Harness can see the exact quality package versions that a runtime binding will execute.
- Keep package manifests governed and schema-validated. Do not allow arbitrary executable analyzer code to be stored in backend records.
- General and medical package schemas should remain separate even though they share the same package service and runtime-binding seam.
