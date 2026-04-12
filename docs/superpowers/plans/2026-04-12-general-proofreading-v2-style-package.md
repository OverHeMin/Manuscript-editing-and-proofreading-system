# General Proofreading V2 Style Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a governed `general_style_package` layer for medical research manuscripts so `general_proofreading` can evaluate article-style signals, section expectations, tone consistency, and wording suspicions in addition to the landed V1 punctuation, formatting, typo, consistency, compliance, and logic checks.

**Architecture:** Reuse the shared package substrate, define one deterministic `general_style_package` manifest for medical research article writing, and bind published style package versions through runtime bindings. Keep the current V1 six problem families intact, add style-only checks as advisory findings, and leave medical fact checking, statistical adjudication, and high-risk data judgment to `medical_specialized` and human review.

**Tech Stack:** Python 3.12, `pytest`, TypeScript, Node `node:test`, `tsx`, existing manuscript-quality service, existing admin-governance workbench.

---

## Scope Notes

- This plan depends on:
  - `docs/superpowers/plans/2026-04-12-manuscript-quality-v2-shared-governance-substrate.md`
- Implement this plan on a dedicated branch:
  - Recommended branch: `codex/general-proofreading-v2-style-package`
- Limit V2 scope to medical research article style only. Do not try to cover every manuscript genre in this pass.
- Preserve the landed V1 six general-quality families:
  - punctuation and paired symbols
  - full-width and half-width normalization plus spacing
  - typo, repeated word, and omission candidates
  - cross-section consistency
  - sensitive and compliance lexicon checks
  - sentence and logic suspicion prompts
- Do not use this plan to take over medical calculation, table validation, unit judgment, or conclusion adjudication.

## File Structure

### New files

- `apps/api/src/modules/manuscript-quality-packages/general-style-package-schema.ts`
- `apps/api/test/manuscript-quality-packages/general-style-package-schema.spec.ts`
- `apps/api/test/shared/general-style-package-fixture.ts`
- `apps/web/src/features/admin-governance/general-style-package-editor.tsx`
- `apps/worker-py/src/manuscript_quality/general_style_package.py`
- `apps/worker-py/tests/manuscript_quality/test_general_style_package.py`
- `apps/api/test/proofreading/proofreading-general-style.spec.ts`
- `apps/api/test/editing/editing-general-style.spec.ts`
- `apps/api/test/screening/screening-general-style.spec.ts`

### Modified files

- `apps/api/src/modules/manuscript-quality-packages/manuscript-quality-package-service.ts`
- `apps/api/src/modules/manuscript-quality/manuscript-quality-types.ts`
- `apps/api/src/modules/manuscript-quality/manuscript-quality-service.ts`
- `apps/api/src/modules/manuscript-quality/manuscript-quality-worker-adapter.ts`
- `apps/api/test/manuscript-quality/manuscript-quality-service.spec.ts`
- `apps/worker-py/src/manuscript_quality/contracts.py`
- `apps/worker-py/src/manuscript_quality/general_proofreading.py`
- `apps/worker-py/src/manuscript_quality/run_quality_checks.py`
- `apps/worker-py/tests/manuscript_quality/test_general_proofreading.py`
- `apps/web/src/features/admin-governance/manuscript-quality-packages-section.tsx`
- `apps/web/src/features/admin-governance/runtime-binding-quality-package-editor.tsx`
- `apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx`

## Test Commands

- `cd apps/worker-py && python -m pytest ./tests/manuscript_quality/test_general_proofreading.py ./tests/manuscript_quality/test_general_style_package.py -q`
- `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality-packages/general-style-package-schema.spec.ts ./test/manuscript-quality/manuscript-quality-service.spec.ts`
- `pnpm --filter @medical/api exec node --import tsx --test ./test/proofreading/proofreading-general-style.spec.ts ./test/editing/editing-general-style.spec.ts ./test/screening/screening-general-style.spec.ts`
- `pnpm --filter @medical/api typecheck`
- `pnpm typecheck`

---

## Implementation Status

Source of truth as of `2026-04-12`: this section supersedes the original draft checkbox state below.

- Completed in repo:
  - governed `general_style_package` schema, fixture, and package validation
  - worker-side style runtime and structured style checks on top of the V1 six general-quality families
  - API orchestration that resolves bound style package manifests and forwards them through manuscript-quality execution
  - module integration for `proofreading`, `editing`, and `screening` with advisory-first style findings
  - admin-governance structured editing for `general_style_package`
  - runtime binding quality package selection wiring so Harness-bound environments can carry governed style package refs
- Verified baseline:
  - worker tests for `general_proofreading` and `general_style_package`
  - API tests for manuscript-quality orchestration plus module integration
  - web tests for the general style package editor and package section rendering
- Constraint still preserved:
  - `general_proofreading` remains responsible for language/style suspicion only and does not take over medical calculation, table validation, unit judgment, or conclusion adjudication

---

### Task 1: Define the medical-research style package schema

**Files:**
- Create: `apps/api/src/modules/manuscript-quality-packages/general-style-package-schema.ts`
- Create: `apps/api/test/manuscript-quality-packages/general-style-package-schema.spec.ts`
- Create: `apps/api/test/shared/general-style-package-fixture.ts`
- Modify: `apps/api/src/modules/manuscript-quality-packages/manuscript-quality-package-service.ts`

- [ ] **Step 1: Write the failing schema tests**

```ts
assert.deepEqual(manifest.section_expectations.abstract.required_labels, [
  "objective",
  "methods",
  "results",
  "conclusion",
]);
assert.equal(manifest.issue_policy.result_conclusion_jump.action, "manual_review");
```

- [ ] **Step 2: Run the schema tests and verify they fail**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality-packages/general-style-package-schema.spec.ts`
Expected: FAIL because the `general_style_package` validator and fixture do not exist yet.

- [ ] **Step 3: Implement the schema and validator**

```ts
export interface GeneralStylePackageManifest {
  section_expectations: Record<string, { required_labels?: string[] }>;
  tone_markers: { strong_claims: string[]; cautious_claims: string[] };
  posture_checks: { abstract: string[]; results: string[]; conclusion: string[] };
  issue_policy: Record<string, { severity: string; action: string }>;
}
```

- [ ] **Step 4: Add a default medical-research fixture**

```ts
export const medicalResearchGeneralStyleFixture = {
  package_kind: "general_style_package",
  package_name: "Medical Research Style",
};
```

- [ ] **Step 5: Re-run the schema tests and confirm PASS**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality-packages/general-style-package-schema.spec.ts`
Expected: PASS with required sections, tone markers, and issue mappings validated.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/manuscript-quality-packages/general-style-package-schema.ts apps/api/test/manuscript-quality-packages/general-style-package-schema.spec.ts apps/api/test/shared/general-style-package-fixture.ts apps/api/src/modules/manuscript-quality-packages/manuscript-quality-package-service.ts
git commit -m "feat: add general proofreading style package schema"
```

### Task 2: Add worker-side style runtime and deterministic checks

**Files:**
- Create: `apps/worker-py/src/manuscript_quality/general_style_package.py`
- Create: `apps/worker-py/tests/manuscript_quality/test_general_style_package.py`
- Modify: `apps/worker-py/src/manuscript_quality/contracts.py`
- Modify: `apps/worker-py/src/manuscript_quality/general_proofreading.py`
- Modify: `apps/worker-py/tests/manuscript_quality/test_general_proofreading.py`

- [ ] **Step 1: Write the failing worker tests for style findings**

```py
assert issue["issue_type"] == "style.section_expectation_missing"
assert issue["category"] == "sentence_and_logic"
assert issue["action"] == "suggest_fix"
```

- [ ] **Step 2: Run the focused worker tests and verify they fail**

Run: `cd apps/worker-py && python -m pytest ./tests/manuscript_quality/test_general_proofreading.py ./tests/manuscript_quality/test_general_style_package.py -q`
Expected: FAIL because style packages are not yet interpreted by the worker.

- [ ] **Step 3: Load the bound style package into the worker runtime**

```py
style_package = select_quality_package(input_payload, "general_style_package")
```

- [ ] **Step 4: Add deterministic style checks**

```py
issues.extend(check_section_expectations(normalized, style_package))
issues.extend(check_tone_consistency(normalized, style_package))
issues.extend(check_posture_suspicions(normalized, style_package))
issues.extend(check_genre_wording_suspicions(normalized, style_package))
```

- [ ] **Step 5: Re-run the worker tests and confirm PASS**

Run: `cd apps/worker-py && python -m pytest ./tests/manuscript_quality/test_general_proofreading.py ./tests/manuscript_quality/test_general_style_package.py -q`
Expected: PASS with V1 checks still passing and style findings appearing only when a style package is bound.

- [ ] **Step 6: Commit**

```bash
git add apps/worker-py/src/manuscript_quality/general_style_package.py apps/worker-py/src/manuscript_quality/contracts.py apps/worker-py/src/manuscript_quality/general_proofreading.py apps/worker-py/tests/manuscript_quality/test_general_style_package.py apps/worker-py/tests/manuscript_quality/test_general_proofreading.py
git commit -m "feat: add deterministic general style package checks"
```

### Task 3: Forward style packages through the API orchestration seam

**Files:**
- Modify: `apps/api/src/modules/manuscript-quality/manuscript-quality-types.ts`
- Modify: `apps/api/src/modules/manuscript-quality/manuscript-quality-service.ts`
- Modify: `apps/api/src/modules/manuscript-quality/manuscript-quality-worker-adapter.ts`
- Modify: `apps/api/test/manuscript-quality/manuscript-quality-service.spec.ts`

- [ ] **Step 1: Write the failing API orchestration test**

```ts
assert.equal(result.completed_scopes.includes("general_proofreading"), true);
assert.equal(result.issues.some((issue) => issue.issue_type === "style.section_expectation_missing"), true);
```

- [ ] **Step 2: Run the focused API test and verify it fails**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality/manuscript-quality-service.spec.ts`
Expected: FAIL because the service does not yet resolve style package manifests for the worker payload.

- [ ] **Step 3: Resolve bound general style package versions before spawning the worker**

```ts
const stylePackages = resolvedQualityPackages.filter(
  (record) => record.package_kind === "general_style_package",
);
```

- [ ] **Step 4: Record the active style package refs in the execution result path**

```ts
quality_packages: stylePackages.map(toWorkerQualityPackageRecord)
```

- [ ] **Step 5: Re-run the focused API test and confirm PASS**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality/manuscript-quality-service.spec.ts`
Expected: PASS with the worker receiving only the bound general style packages.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/manuscript-quality apps/api/test/manuscript-quality/manuscript-quality-service.spec.ts
git commit -m "feat: resolve general style packages in manuscript quality orchestration"
```

### Task 4: Integrate style findings into proofreading, editing, and screening without changing authority

**Files:**
- Create: `apps/api/test/proofreading/proofreading-general-style.spec.ts`
- Create: `apps/api/test/editing/editing-general-style.spec.ts`
- Create: `apps/api/test/screening/screening-general-style.spec.ts`
- Modify: `apps/api/src/modules/proofreading/proofreading-service.ts`
- Modify: `apps/api/src/modules/editing/editing-service.ts`
- Modify: `apps/api/src/modules/screening/screening-service.ts`

- [ ] **Step 1: Write the failing module integration tests**

```ts
assert.match(report, /Quality Findings/);
assert.equal(editingResult.issues[0]?.action, "suggest_fix");
assert.equal(screeningResult.escalations[0]?.reason, "style section expectation");
```

- [ ] **Step 2: Run the focused module suites and verify they fail**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/proofreading/proofreading-general-style.spec.ts ./test/editing/editing-general-style.spec.ts ./test/screening/screening-general-style.spec.ts`
Expected: FAIL because the module services do not yet surface style-package findings.

- [ ] **Step 3: Merge style findings into proofreading and editing as advisory evidence**

```ts
const styleIssues = qualityResult.issues.filter((issue) =>
  issue.issue_type.startsWith("style."),
);
```

- [ ] **Step 4: Keep screening conservative**

```ts
const screeningEscalations = styleIssues.filter(
  (issue) => issue.action !== "auto_fix",
);
```

- [ ] **Step 5: Re-run the focused module suites and confirm PASS**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/proofreading/proofreading-general-style.spec.ts ./test/editing/editing-general-style.spec.ts ./test/screening/screening-general-style.spec.ts`
Expected: PASS with advisory style findings visible and no automatic authority change.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/proofreading/proofreading-service.ts apps/api/src/modules/editing/editing-service.ts apps/api/src/modules/screening/screening-service.ts apps/api/test/proofreading/proofreading-general-style.spec.ts apps/api/test/editing/editing-general-style.spec.ts apps/api/test/screening/screening-general-style.spec.ts
git commit -m "feat: surface general style package findings in module flows"
```

### Task 5: Add the admin-governance editor for general style packages

**Files:**
- Create: `apps/web/src/features/admin-governance/general-style-package-editor.tsx`
- Modify: `apps/web/src/features/admin-governance/manuscript-quality-packages-section.tsx`
- Modify: `apps/web/src/features/admin-governance/runtime-binding-quality-package-editor.tsx`
- Modify: `apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx`

- [ ] **Step 1: Render a structured editor for section, tone, and posture fields**

```tsx
<GeneralStylePackageEditor
  manifest={selectedPackageManifest}
  onChange={setDraftManifest}
/>
```

- [ ] **Step 2: Add package-kind aware labels and validation hints**

```tsx
{selectedPackage.package_kind === "general_style_package" ? (
  <GeneralStylePackageEditor ... />
) : null}
```

- [ ] **Step 3: Manually smoke-test package editing**

Run:
- `pnpm --filter @medical/web dev`
- Create and publish a `general_style_package`
- Attach it to a runtime binding for a medical research template family
Expected: the operator can update style assets without editing source code.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/admin-governance/general-style-package-editor.tsx apps/web/src/features/admin-governance/manuscript-quality-packages-section.tsx apps/web/src/features/admin-governance/runtime-binding-quality-package-editor.tsx apps/web/src/features/admin-governance/admin-governance-workbench-page.tsx
git commit -m "feat: add general style package editor to admin governance"
```

### Task 6: Run end-to-end checkpoints for the general V2 layer

**Files:**
- Modify: `apps/api/test/manuscript-quality/manuscript-quality-service.spec.ts`
- Modify: `apps/worker-py/tests/manuscript_quality/test_general_proofreading.py`

- [ ] **Step 1: Run the worker checkpoint suite**

Run: `cd apps/worker-py && python -m pytest ./tests/manuscript_quality/test_general_proofreading.py ./tests/manuscript_quality/test_general_style_package.py -q`
Expected: PASS.

- [ ] **Step 2: Run the API checkpoint suite**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality-packages/general-style-package-schema.spec.ts ./test/manuscript-quality/manuscript-quality-service.spec.ts ./test/proofreading/proofreading-general-style.spec.ts ./test/editing/editing-general-style.spec.ts ./test/screening/screening-general-style.spec.ts`
Expected: PASS.

- [ ] **Step 3: Run type checks**

Run:
- `pnpm --filter @medical/api typecheck`
- `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/test/manuscript-quality/manuscript-quality-service.spec.ts apps/worker-py/tests/manuscript_quality/test_general_proofreading.py
git commit -m "test: lock general proofreading v2 style package rollout"
```

## Review Notes

- This plan extends `general_proofreading`; it does not replace the landed V1 six-category package.
- Keep all new style findings advisory-first. Most style findings should stay `suggest_fix`, with `manual_review` reserved for stronger result and conclusion contradictions.
- Do not let the general style package absorb medical data, unit, or statistical logic. Those remain in the medical plan.
