# Medical Specialized V2 Governed Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `medical_specialized` from hardcoded V1 and V1.5 analyzers into a governed `medical_analyzer_package` system that keeps current conservative medical checks intact while moving configurable dictionaries, ranges, templates, and issue mappings into backend-maintained package assets.

**Architecture:** Keep parsing, calculation, table-reading, and issue-normalization engines in code, but bind indicator dictionaries, unit maps, comparison templates, count and range rules, issue policies, and analyzer toggles from published medical package manifests. Preserve the current V1 plus V1.5 medical behavior as the baseline, extend it with governed assets, and route activation through runtime bindings so Harness can compare and roll back package versions cleanly.

**Tech Stack:** Python 3.12, `pytest`, TypeScript, Node `node:test`, `tsx`, Postgres, existing manuscript-quality service, existing Harness control plane, existing admin-governance workbench.

---

## Scope Notes

- This plan depends on:
  - `docs/superpowers/plans/2026-04-12-manuscript-quality-v2-shared-governance-substrate.md`
- Recommended execution order:
  - finish `general_proofreading` V2 first
  - then execute this plan on `codex/medical-specialized-v2-governed-assets`
- Preserve the currently landed baseline:
  - V1 baseline: terminology drift, numeric consistency, statistical-expression issues, evidence-alignment suspicion, ethics and privacy risk
  - V1.5 bounded extensions: table-aware consistency, pure-text count consistency, group comparison direction, and table-text consistency slices
- This V2 plan must continue to cover the four core medical error families:
  - calculation and parsing errors
  - medical logic errors
  - commonsense and magnitude errors
  - table-text inconsistency errors
- This V2 plan must make the following configurable from governed assets:
  - indicator dictionaries and aliases
  - unit mappings
  - comparison-direction templates
  - count and range constraints
  - statistical-expression thresholds
  - issue severity and action mapping
  - analyzer toggles and version metadata
- Do not implement:
  - automatic knowledge write-back
  - automatic rule write-back
  - freeform backend-authored executable analyzer code
  - autonomous high-risk medical conclusion rewriting

## File Structure

### New files

- `apps/api/src/modules/manuscript-quality-packages/medical-analyzer-package-schema.ts`
- `apps/api/test/manuscript-quality-packages/medical-analyzer-package-schema.spec.ts`
- `apps/api/test/shared/medical-analyzer-package-fixture.ts`
- `apps/web/src/features/admin-governance/medical-analyzer-package-editor.tsx`
- `apps/worker-py/src/manuscript_quality/medical_asset_runtime.py`
- `apps/worker-py/tests/manuscript_quality/test_medical_asset_runtime.py`
- `apps/api/test/proofreading/proofreading-medical-governed-assets.spec.ts`
- `apps/api/test/editing/editing-medical-governed-assets.spec.ts`
- `apps/api/test/screening/screening-medical-governed-assets.spec.ts`

### Modified files

- `apps/api/src/modules/manuscript-quality-packages/manuscript-quality-package-service.ts`
- `apps/api/src/modules/manuscript-quality/manuscript-quality-types.ts`
- `apps/api/src/modules/manuscript-quality/manuscript-quality-service.ts`
- `apps/api/src/modules/manuscript-quality/manuscript-quality-worker-adapter.ts`
- `apps/api/test/manuscript-quality/manuscript-quality-service.spec.ts`
- `apps/worker-py/src/manuscript_quality/medical_specialized.py`
- `apps/worker-py/src/manuscript_quality/run_quality_checks.py`
- `apps/worker-py/tests/manuscript_quality/test_medical_specialized.py`
- `apps/api/src/modules/proofreading/proofreading-service.ts`
- `apps/api/src/modules/editing/editing-service.ts`
- `apps/api/src/modules/screening/screening-service.ts`
- `apps/api/test/proofreading/proofreading-medical-quality.spec.ts`
- `apps/api/test/editing/editing-medical-quality.spec.ts`
- `apps/api/test/screening/screening-medical-quality.spec.ts`
- `apps/api/test/harness-control-plane/harness-control-plane-service.spec.ts`
- `apps/api/test/verification-ops/experiment-binding-guard.spec.ts`
- `apps/web/src/features/admin-governance/manuscript-quality-packages-section.tsx`
- `apps/web/src/features/admin-governance/runtime-binding-quality-package-editor.tsx`
- `apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx`

## Test Commands

- `cd apps/worker-py && python -m pytest ./tests/manuscript_quality/test_medical_specialized.py ./tests/manuscript_quality/test_medical_asset_runtime.py -q`
- `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality-packages/medical-analyzer-package-schema.spec.ts ./test/manuscript-quality/manuscript-quality-service.spec.ts`
- `pnpm --filter @medical/api exec node --import tsx --test ./test/proofreading/proofreading-medical-quality.spec.ts ./test/proofreading/proofreading-medical-governed-assets.spec.ts ./test/editing/editing-medical-quality.spec.ts ./test/editing/editing-medical-governed-assets.spec.ts ./test/screening/screening-medical-quality.spec.ts ./test/screening/screening-medical-governed-assets.spec.ts`
- `pnpm --filter @medical/api exec node --import tsx --test ./test/harness-control-plane/harness-control-plane-service.spec.ts ./test/verification-ops/experiment-binding-guard.spec.ts`
- `pnpm --filter @medical/api typecheck`
- `pnpm typecheck`

---

## Implementation Status

Source of truth as of `2026-04-12`: this section supersedes the original draft checkbox state below.

- Completed in repo:
  - governed `medical_analyzer_package` schema, fixture, and package validation
  - worker runtime asset loading for `indicator_dictionary`, `unit_ranges`, `comparison_templates`, `count_constraints`, `issue_policy`, and `analyzer_toggles`
  - governed medical checks for the four core error families:
    - calculation and parsing
    - medical logic
    - commonsense and magnitude
    - table-text inconsistency
  - governed `comparison_templates` now drive:
    - pre/post row parsing
    - sentence phase detection
    - cross-section group comparison checks
    - group-event comparison checks
    - narrative-vs-table direction and group-comparison checks
  - API orchestration and module flows now resolve and forward bound medical package manifests through `screening`, `editing`, and `proofreading`
  - admin-governance structured editing is landed for `medical_analyzer_package`
  - Harness-facing quality package refs are exercised through runtime binding, harness control plane, and experiment-binding guard coverage
- Landed coverage note:
  - the planned dedicated files `proofreading-medical-governed-assets.spec.ts`, `editing-medical-governed-assets.spec.ts`, and `screening-medical-governed-assets.spec.ts` were folded into the existing `*-medical-quality.spec.ts` coverage instead of being added as separate files
- Verified on `2026-04-12`:
  - `python -m pytest ./apps/worker-py/tests/manuscript_quality -q`
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality/manuscript-quality-service.spec.ts ./test/proofreading/proofreading-medical-quality.spec.ts ./test/editing/editing-medical-quality.spec.ts ./test/screening/screening-medical-quality.spec.ts ./test/harness-control-plane/harness-control-plane-service.spec.ts ./test/verification-ops/experiment-binding-guard.spec.ts`
  - `cd apps/web && pnpm exec node --import tsx --test ./test/general-style-package-editor.spec.tsx ./test/medical-analyzer-package-editor.spec.tsx`
  - `cd apps/web && pnpm exec tsc -p tsconfig.json --noEmit`

---

### Task 1: Define the governed medical analyzer package schema

**Files:**
- Create: `apps/api/src/modules/manuscript-quality-packages/medical-analyzer-package-schema.ts`
- Create: `apps/api/test/manuscript-quality-packages/medical-analyzer-package-schema.spec.ts`
- Create: `apps/api/test/shared/medical-analyzer-package-fixture.ts`
- Modify: `apps/api/src/modules/manuscript-quality-packages/manuscript-quality-package-service.ts`

- [ ] **Step 1: Write the failing schema tests**

```ts
assert.equal(manifest.indicator_dictionary.ALT.default_unit, "U/L");
assert.equal(manifest.comparison_templates.pre_post.length > 0, true);
assert.equal(manifest.issue_policy.table_text_direction_conflict.action, "manual_review");
```

- [ ] **Step 2: Run the schema tests and verify they fail**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality-packages/medical-analyzer-package-schema.spec.ts`
Expected: FAIL because the medical analyzer manifest validator does not exist yet.

- [ ] **Step 3: Implement the governed medical manifest shape**

```ts
export interface MedicalAnalyzerPackageManifest {
  indicator_dictionary: Record<string, { aliases: string[]; default_unit?: string }>;
  unit_ranges: Record<string, { unit: string; min?: number; max?: number }[]>;
  comparison_templates: { pre_post: string[]; group_comparison: string[] };
  count_constraints: Record<string, { max_percent?: number }>;
  issue_policy: Record<string, { severity: string; action: string }>;
  analyzer_toggles: Record<string, boolean>;
}
```

- [ ] **Step 4: Add a fixture that mirrors current V1 and V1.5 defaults**

```ts
export const defaultMedicalAnalyzerFixture = {
  package_kind: "medical_analyzer_package",
  package_name: "Medical Analyzer Default",
  version: 1,
};
```

- [ ] **Step 5: Re-run the schema tests and confirm PASS**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality-packages/medical-analyzer-package-schema.spec.ts`
Expected: PASS with indicator dictionaries, range rules, toggles, and issue mappings validated.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/manuscript-quality-packages/medical-analyzer-package-schema.ts apps/api/test/manuscript-quality-packages/medical-analyzer-package-schema.spec.ts apps/api/test/shared/medical-analyzer-package-fixture.ts apps/api/src/modules/manuscript-quality-packages/manuscript-quality-package-service.ts
git commit -m "feat: add medical analyzer package schema"
```

### Task 2: Move current hardcoded medical assets behind a governed runtime helper

**Files:**
- Create: `apps/worker-py/src/manuscript_quality/medical_asset_runtime.py`
- Create: `apps/worker-py/tests/manuscript_quality/test_medical_asset_runtime.py`
- Modify: `apps/worker-py/src/manuscript_quality/medical_specialized.py`
- Modify: `apps/worker-py/tests/manuscript_quality/test_medical_specialized.py`

- [ ] **Step 1: Write the failing worker tests for asset-backed lookup**

```py
assert resolve_indicator_definition("ALT", assets)["default_unit"] == "U/L"
assert assets["analyzer_toggles"]["table_text_consistency"] is True
```

- [ ] **Step 2: Run the focused worker tests and verify they fail**

Run: `cd apps/worker-py && python -m pytest ./tests/manuscript_quality/test_medical_specialized.py ./tests/manuscript_quality/test_medical_asset_runtime.py -q`
Expected: FAIL because the worker still relies on hardcoded dictionaries and templates.

- [ ] **Step 3: Load and normalize the bound medical package manifest**

```py
medical_assets = load_medical_assets(input_payload)
```

- [ ] **Step 4: Replace hardcoded asset tables with runtime lookups while keeping engines in code**

```py
definition = resolve_indicator_definition(metric_key, medical_assets)
policy = resolve_issue_policy(issue_key, medical_assets)
```

- [ ] **Step 5: Re-run the worker tests and confirm PASS**

Run: `cd apps/worker-py && python -m pytest ./tests/manuscript_quality/test_medical_specialized.py ./tests/manuscript_quality/test_medical_asset_runtime.py -q`
Expected: PASS with current V1 and V1.5 behavior preserved through the default package fixture.

- [ ] **Step 6: Commit**

```bash
git add apps/worker-py/src/manuscript_quality/medical_asset_runtime.py apps/worker-py/src/manuscript_quality/medical_specialized.py apps/worker-py/tests/manuscript_quality/test_medical_asset_runtime.py apps/worker-py/tests/manuscript_quality/test_medical_specialized.py
git commit -m "feat: load medical analyzer assets from governed packages"
```

### Task 3: Upgrade the four core medical error families with governed assets

**Files:**
- Modify: `apps/worker-py/src/manuscript_quality/medical_specialized.py`
- Modify: `apps/worker-py/tests/manuscript_quality/test_medical_specialized.py`

- [ ] **Step 1: Add failing tests for calculation and parsing checks**

```py
assert issue["issue_type"] == "medical_calculation_and_parsing.mean_sd_parse_conflict"
assert issue["issue_type"] == "medical_calculation_and_parsing.significance_claim_conflict"
```

- [ ] **Step 2: Add failing tests for medical logic and table-text checks**

```py
assert issue["issue_type"] == "medical_logic.pre_post_direction_conflict"
assert issue["issue_type"] == "table_text_consistency.narrative_table_group_comparison_conflict"
```

- [ ] **Step 3: Add failing tests for commonsense and magnitude checks**

```py
assert issue["issue_type"] == "medical_norms_and_magnitude.unit_range_conflict"
assert issue["issue_type"] == "medical_norms_and_magnitude.percent_out_of_range"
```

- [ ] **Step 4: Run the focused worker tests and verify they fail**

Run: `cd apps/worker-py && python -m pytest ./tests/manuscript_quality/test_medical_specialized.py -q`
Expected: FAIL because the current worker does not yet use governed range, template, and issue-policy assets for all four families.

- [ ] **Step 5: Implement the governed upgrades while keeping the engine code-owned**

```py
issues.extend(check_medical_numeric_consistency(normalized, medical_assets))
issues.extend(check_cross_section_direction_conflicts(normalized, medical_assets))
issues.extend(check_medical_norms_and_magnitude(normalized, medical_assets))
issues.extend(check_table_text_consistency(normalized, table_snapshots, medical_assets))
```

- [ ] **Step 6: Re-run the focused worker tests and confirm PASS**

Run: `cd apps/worker-py && python -m pytest ./tests/manuscript_quality/test_medical_specialized.py -q`
Expected: PASS with governed assets driving thresholds, templates, and issue mapping for the four core families.

- [ ] **Step 7: Commit**

```bash
git add apps/worker-py/src/manuscript_quality/medical_specialized.py apps/worker-py/tests/manuscript_quality/test_medical_specialized.py
git commit -m "feat: upgrade medical specialized checks with governed assets"
```

### Task 4: Forward governed medical packages through API orchestration and module flows

**Files:**
- Modify: `apps/api/src/modules/manuscript-quality/manuscript-quality-types.ts`
- Modify: `apps/api/src/modules/manuscript-quality/manuscript-quality-service.ts`
- Modify: `apps/api/src/modules/manuscript-quality/manuscript-quality-worker-adapter.ts`
- Modify: `apps/api/test/manuscript-quality/manuscript-quality-service.spec.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/screening/screening-service.ts`
- Create: `apps/api/test/proofreading/proofreading-medical-governed-assets.spec.ts`
- Create: `apps/api/test/editing/editing-medical-governed-assets.spec.ts`
- Create: `apps/api/test/screening/screening-medical-governed-assets.spec.ts`

- [ ] **Step 1: Write the failing API and module tests**

```ts
assert.equal(result.issues.some((issue) => issue.category === "medical_calculation_and_parsing"), true);
assert.equal(screeningEscalation.reason.includes("table_text_consistency"), true);
```

- [ ] **Step 2: Run the focused API and module suites and verify they fail**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality/manuscript-quality-service.spec.ts ./test/proofreading/proofreading-medical-governed-assets.spec.ts ./test/editing/editing-medical-governed-assets.spec.ts ./test/screening/screening-medical-governed-assets.spec.ts`
Expected: FAIL because governed medical packages are not yet resolved into module execution.

- [ ] **Step 3: Resolve bound `medical_analyzer_package` versions before worker execution**

```ts
const medicalPackages = resolvedQualityPackages.filter(
  (record) => record.package_kind === "medical_analyzer_package",
);
```

- [ ] **Step 4: Keep module authority conservative**

```ts
const escalations = medicalIssues.filter(
  (issue) => issue.action === "manual_review" || issue.action === "block",
);
```

- [ ] **Step 5: Re-run the focused API and module suites and confirm PASS**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality/manuscript-quality-service.spec.ts ./test/proofreading/proofreading-medical-governed-assets.spec.ts ./test/editing/editing-medical-governed-assets.spec.ts ./test/screening/screening-medical-governed-assets.spec.ts`
Expected: PASS with governed medical packages active but still advisory-first.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/manuscript-quality apps/api/src/modules/proofreading/proofreading-service.ts apps/api/src/modules/editing/editing-service.ts apps/api/src/modules/screening/screening-service.ts apps/api/test/manuscript-quality/manuscript-quality-service.spec.ts apps/api/test/proofreading/proofreading-medical-governed-assets.spec.ts apps/api/test/editing/editing-medical-governed-assets.spec.ts apps/api/test/screening/screening-medical-governed-assets.spec.ts
git commit -m "feat: route governed medical analyzer packages through module execution"
```

### Task 5: Add the medical package editor and Harness comparison coverage

**Files:**
- Create: `apps/web/src/features/admin-governance/medical-analyzer-package-editor.tsx`
- Modify: `apps/web/src/features/admin-governance/manuscript-quality-packages-section.tsx`
- Modify: `apps/web/src/features/admin-governance/runtime-binding-quality-package-editor.tsx`
- Modify: `apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx`
- Modify: `apps/api/test/harness-control-plane/harness-control-plane-service.spec.ts`
- Modify: `apps/api/test/verification-ops/experiment-binding-guard.spec.ts`

- [ ] **Step 1: Render a structured editor for indicator, unit, and template assets**

```tsx
<MedicalAnalyzerPackageEditor
  manifest={selectedPackageManifest}
  onChange={setDraftManifest}
/>
```

- [ ] **Step 2: Add package-kind aware binding labels inside the runtime-binding editor**

```tsx
{packageRecord.package_kind === "medical_analyzer_package" ? (
  <MedicalAnalyzerPackageEditor ... />
) : null}
```

- [ ] **Step 3: Extend Harness comparison tests to assert medical package version changes are visible**

```ts
assert.deepEqual(preview.candidate_environment.runtime_binding.quality_package_version_ids, [
  "medical-package-version-2",
]);
```

- [ ] **Step 4: Manually smoke-test the admin and Harness flow**

Run:
- `pnpm --filter @medical/web dev`
- Create a draft medical analyzer package, publish it, bind it to a runtime binding, and preview the candidate environment in the admin workbench
Expected: the operator can edit governed medical assets without editing Python or TypeScript source.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/admin-governance/medical-analyzer-package-editor.tsx apps/web/src/features/admin-governance/manuscript-quality-packages-section.tsx apps/web/src/features/admin-governance/runtime-binding-quality-package-editor.tsx apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx apps/api/test/harness-control-plane/harness-control-plane-service.spec.ts apps/api/test/verification-ops/experiment-binding-guard.spec.ts
git commit -m "feat: add medical analyzer package editor and harness coverage"
```

### Task 6: Run medical V2 checkpoints and confirm the boundary stays intact

**Files:**
- Modify: `apps/api/test/proofreading/proofreading-medical-quality.spec.ts`
- Modify: `apps/api/test/editing/editing-medical-quality.spec.ts`
- Modify: `apps/api/test/screening/screening-medical-quality.spec.ts`

- [ ] **Step 1: Run the worker checkpoint suite**

Run: `cd apps/worker-py && python -m pytest ./tests/manuscript_quality/test_medical_specialized.py ./tests/manuscript_quality/test_medical_asset_runtime.py -q`
Expected: PASS.

- [ ] **Step 2: Run the medical API and module checkpoint suite**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality-packages/medical-analyzer-package-schema.spec.ts ./test/manuscript-quality/manuscript-quality-service.spec.ts ./test/proofreading/proofreading-medical-quality.spec.ts ./test/proofreading/proofreading-medical-governed-assets.spec.ts ./test/editing/editing-medical-quality.spec.ts ./test/editing/editing-medical-governed-assets.spec.ts ./test/screening/screening-medical-quality.spec.ts ./test/screening/screening-medical-governed-assets.spec.ts ./test/harness-control-plane/harness-control-plane-service.spec.ts ./test/verification-ops/experiment-binding-guard.spec.ts`
Expected: PASS.

- [ ] **Step 3: Run type checks**

Run:
- `pnpm --filter @medical/api typecheck`
- `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Reconfirm the medical V2 boundary**

Checklist:
- current V1 and V1.5 findings still reproduce under the default medical package
- configurable assets are backend-maintained, but parsing and adjudication engines remain code-owned
- high-risk medical conclusions still do not auto-rewrite themselves
- Harness can compare and roll back bound medical package versions through runtime bindings

- [ ] **Step 5: Commit**

```bash
git add apps/api/test/proofreading/proofreading-medical-quality.spec.ts apps/api/test/editing/editing-medical-quality.spec.ts apps/api/test/screening/screening-medical-quality.spec.ts
git commit -m "test: lock medical specialized v2 governed asset rollout"
```

## Review Notes

- The four core medical error families are mandatory in this V2 plan: calculation and parsing, medical logic, commonsense and magnitude, and table-text inconsistency.
- Mean and SD spacing tolerance, `n(%)` consistency, p-value claim reconciliation, range and unit plausibility, and narrative-table direction checks should remain deterministic engine code, even though their thresholds and templates become governed assets.
- If a proposed medical package change starts to resemble freeform medical reasoning instead of governed thresholds and templates, stop and move that idea back into code review or human review rather than package authoring.
