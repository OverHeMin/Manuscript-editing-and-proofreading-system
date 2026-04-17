# Rule Center Medical Statistics Deepening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gap between the designed and shipped medical-statistics experience by extending governed medical packages, the Python medical analyzer, and rule-center statistical authoring so `AUC / sensitivity / specificity / beta / SE` become real governed capabilities.

**Architecture:** Reuse the existing `medical_analyzer_package` flow instead of inventing a parallel asset type. First extend the governed schema and editor so diagnostic and regression statistics can be configured safely, then teach the worker to consume those fields behind explicit toggles and issue policies, and finally expose the richer statistical model in the rule-center authoring and package-detail surfaces.

**Tech Stack:** TypeScript, React 18, `node:test`, Vite, Python 3, `pytest`, existing `template-governance` and `admin-governance` features, existing `manuscript_quality` worker runtime.

## Closure Notes

- Implemented the governed medical analyzer schema, editor, runtime asset loading, and worker checks for `AUC / sensitivity / specificity / beta / SE / chi-square / t / F / P`.
- Implemented richer rule-center statistical authoring with `metricFamily`, `supportedMetrics`, `requiredCompanionEvidence`, and `recalculationPolicy`.
- Adjusted the medical-package detail page so it no longer presents static platform capability as if it were current-package configuration.
- The shipped page now splits package detail into:
  - `当前包已声明的统计治理要点`, derived from the selected package's own `summary / guidance`
  - `平台当前支持的医学统计校验能力`, shown separately for medical-statistics packages

## Verification Snapshot

The final verification set for this plan is:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/manuscript-quality-packages/medical-analyzer-package-schema.spec.ts
pnpm --filter @medsys/web exec node --import tsx --test ./test/medical-analyzer-package-editor.spec.tsx ./test/template-governance-rule-authoring.spec.ts ./test/template-governance-content-module-package-guidance.spec.tsx
python -m pytest apps/worker-py/tests/manuscript_quality/test_medical_specialized.py
```

At the current branch state, these commands pass and there is no known residual flake recorded for this scope.

---

## File Structure

### Modify

- `apps/api/src/modules/manuscript-quality-packages/medical-analyzer-package-schema.ts`
- `apps/api/test/manuscript-quality-packages/medical-analyzer-package-schema.spec.ts`
- `apps/api/test/shared/medical-analyzer-package-fixture.ts`
- `apps/web/src/features/admin-governance/medical-analyzer-package-editor.tsx`
- `apps/web/test/medical-analyzer-package-editor.spec.tsx`
- `apps/worker-py/src/manuscript_quality/medical_asset_runtime.py`
- `apps/worker-py/src/manuscript_quality/medical_specialized.py`
- `apps/worker-py/tests/manuscript_quality/test_medical_specialized.py`
- `apps/web/src/features/template-governance/rule-authoring-types.ts`
- `apps/web/src/features/template-governance/rule-authoring-presets.ts`
- `apps/web/src/features/template-governance/rule-authoring-form.tsx`
- `apps/web/src/features/template-governance/rule-authoring-serialization.ts`
- `apps/web/src/features/template-governance/template-governance-content-module-ledger-page.tsx`
- `apps/web/test/template-governance-rule-authoring.spec.ts`
- `apps/web/test/template-governance-content-module-package-guidance.spec.tsx`

### Create

- none required unless the existing files become too dense during implementation

### Keep Untouched Unless Blocked

- `apps/api/src/modules/manuscript-quality/manuscript-quality-worker-adapter.ts`
- `apps/web/src/features/template-governance/template-governance-rule-wizard-step-entry.tsx`
- `apps/web/src/features/template-governance/template-governance-rule-wizard-step-semantic.tsx`

The current request is about governed statistics depth, not a broader wizard redesign.

## Scope Guard

Do not add a new browser-authored parser language. The governed browser surface may expose aliases, thresholds, toggles, and policy, but deterministic parsing logic remains repo-owned and test-backed in code.

## Task 1: Extend the governed medical package schema

**Files:**
- Modify: `apps/api/src/modules/manuscript-quality-packages/medical-analyzer-package-schema.ts`
- Modify: `apps/api/test/manuscript-quality-packages/medical-analyzer-package-schema.spec.ts`
- Modify: `apps/api/test/shared/medical-analyzer-package-fixture.ts`

- [ ] **Step 1: Write the failing API tests for diagnostic and regression blocks**

```ts
test("medical analyzer schema parses governed diagnostic and regression stats", () => {
  const manifest = parseMedicalAnalyzerPackageManifest(defaultMedicalAnalyzerManifest);

  assert.deepEqual(manifest.diagnostic_metrics.metric_ranges.AUC, { min: 0.5, max: 1 });
  assert.deepEqual(manifest.regression_metrics.field_aliases.beta, ["beta", "β"]);
  assert.equal(manifest.analyzer_toggles.statistical_recheck, true);
});
```

- [ ] **Step 2: Run the API test file and verify it fails**

Run:

```bash
pnpm --filter @medsys/api exec node --import tsx --test ./test/manuscript-quality-packages/medical-analyzer-package-schema.spec.ts
```

Expected: FAIL because the schema and fixture do not yet recognize the new governed statistical fields.

- [ ] **Step 3: Implement the schema and fixture expansion**

```ts
export interface MedicalAnalyzerPackageManifest {
  indicator_dictionary: Record<string, MedicalAnalyzerIndicatorDefinition>;
  unit_ranges: Record<string, MedicalAnalyzerUnitRange[]>;
  comparison_templates: { pre_post: string[]; group_comparison: string[] };
  count_constraints: Record<string, { max_percent?: number }>;
  diagnostic_metrics: {
    metric_aliases: Record<string, string[]>;
    metric_ranges: Record<string, { min?: number; max?: number }>;
    confusion_matrix_aliases: Record<string, string[]>;
    ci_confidence_levels: number[];
  };
  regression_metrics: {
    field_aliases: Record<string, string[]>;
    ci_confidence_levels: number[];
  };
  issue_policy: Record<string, MedicalAnalyzerIssuePolicy>;
  analyzer_toggles: Record<string, boolean>;
}
```

- [ ] **Step 4: Re-run the API schema tests**

Run:

```bash
pnpm --filter @medsys/api exec node --import tsx --test ./test/manuscript-quality-packages/medical-analyzer-package-schema.spec.ts
```

Expected: PASS with the new governed medical-statistics manifest shape.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/manuscript-quality-packages/medical-analyzer-package-schema.ts apps/api/test/manuscript-quality-packages/medical-analyzer-package-schema.spec.ts apps/api/test/shared/medical-analyzer-package-fixture.ts
git commit -m "feat: extend governed medical analyzer schema"
```

## Task 2: Make the medical package editor round-trip the richer governed stats

**Files:**
- Modify: `apps/web/src/features/admin-governance/medical-analyzer-package-editor.tsx`
- Modify: `apps/web/test/medical-analyzer-package-editor.spec.tsx`

- [ ] **Step 1: Write the failing editor tests for the new structured fields**

```tsx
test("medical analyzer package editor round-trips diagnostic and regression settings", () => {
  const manifest = buildMedicalAnalyzerPackageManifest({
    diagnosticMetricAliases: "AUC | AUC, area under the curve",
    diagnosticMetricRanges: "AUC | 0.5 | 1\nsensitivity | 0 | 1",
    confusionMatrixAliases: "tp | true positive\nfp | false positive",
    regressionFieldAliases: "beta | beta, β\nSE | SE, standard error",
    statisticalRecheckEnabled: true,
    // ...
  });

  const draft = parseMedicalAnalyzerPackageManifestDraft(manifest);
  assert.match(draft.diagnosticMetricRanges, /AUC \| 0.5 \| 1/);
});
```

- [ ] **Step 2: Run the editor tests and verify they fail**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/medical-analyzer-package-editor.spec.tsx
```

Expected: FAIL because the editor draft, serializer, and rendered UI do not yet cover those fields.

- [ ] **Step 3: Implement the editor draft, form sections, and manifest builders**

```tsx
<fieldset className="admin-governance-module-selector">
  <legend>Diagnostic Metrics</legend>
  <textarea value={draft.diagnosticMetricAliases} />
  <textarea value={draft.diagnosticMetricRanges} />
  <textarea value={draft.confusionMatrixAliases} />
</fieldset>
```

- [ ] **Step 4: Re-run the editor tests**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/medical-analyzer-package-editor.spec.tsx
```

Expected: PASS with the richer governed editor remaining round-trippable through the manifest.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/admin-governance/medical-analyzer-package-editor.tsx apps/web/test/medical-analyzer-package-editor.spec.tsx
git commit -m "feat: deepen medical analyzer package editor"
```

## Task 3: Teach the runtime to load the new governed statistical assets

**Files:**
- Modify: `apps/worker-py/src/manuscript_quality/medical_asset_runtime.py`
- Modify: `apps/worker-py/tests/manuscript_quality/test_medical_specialized.py`

- [ ] **Step 1: Add failing worker tests that expect governed toggles and issue policies to affect new stats**

```python
def test_medical_specialized_uses_governed_diagnostic_and_regression_assets():
    report = run_medical_specialized([...], quality_packages=[build_medical_package_record(...)])
    issue = next(issue for issue in report["issues"] if issue["issue_type"] == "statistical_expression.auc_confidence_interval_conflict")
    assert issue["action"] == "suggest_fix"
```

- [ ] **Step 2: Run the targeted worker tests and verify they fail**

Run:

```bash
python -m pytest apps/worker-py/tests/manuscript_quality/test_medical_specialized.py -k "auc or sensitivity or specificity or beta or se"
```

Expected: FAIL because the runtime does not yet merge or resolve the new governed statistical blocks.

- [ ] **Step 3: Extend the runtime defaults and resolver helpers**

```python
DEFAULT_MEDICAL_ASSETS["diagnostic_metrics"] = {
    "metric_aliases": {"AUC": ["auc", "area under the curve"]},
    "metric_ranges": {"AUC": {"min": 0.5, "max": 1.0}},
    "confusion_matrix_aliases": {"tp": ["tp", "true positive"]},
    "ci_confidence_levels": [95],
}
```

- [ ] **Step 4: Re-run the targeted worker tests**

Run:

```bash
python -m pytest apps/worker-py/tests/manuscript_quality/test_medical_specialized.py -k "auc or sensitivity or specificity or beta or se"
```

Expected: PASS for the runtime-asset expectations, even before the deeper analyzer logic is fully complete.

- [ ] **Step 5: Commit**

```bash
git add apps/worker-py/src/manuscript_quality/medical_asset_runtime.py apps/worker-py/tests/manuscript_quality/test_medical_specialized.py
git commit -m "feat: load governed medical statistics assets"
```

## Task 4: Add diagnostic and regression consistency checks to the worker

**Files:**
- Modify: `apps/worker-py/src/manuscript_quality/medical_specialized.py`
- Modify: `apps/worker-py/tests/manuscript_quality/test_medical_specialized.py`

- [ ] **Step 1: Write failing tests for deterministic recheck behavior**

```python
def test_medical_specialized_detects_auc_confidence_interval_conflict():
    report = run_medical_specialized([
        {"text": "Results: AUC = 1.12 (95% CI 0.91, 1.05).", "style": "Normal"},
    ])
    issue = next(issue for issue in report["issues"] if issue["issue_type"] == "statistical_expression.auc_confidence_interval_conflict")
    assert issue["category"] == "medical_calculation_and_parsing"

def test_medical_specialized_recalculates_sensitivity_and_specificity_from_confusion_matrix():
    report = run_medical_specialized([
        {"text": "Results: TP=80, FN=20, TN=90, FP=10; sensitivity 0.70, specificity 0.90.", "style": "Normal"},
    ])
    issue = next(issue for issue in report["issues"] if issue["issue_type"] == "statistical_expression.diagnostic_metric_mismatch")
    assert "0.80" in issue["explanation"]

def test_medical_specialized_detects_beta_se_conflict():
    report = run_medical_specialized([
        {"text": "Results: beta = 0.50, SE = 0.10, 95% CI 0.10, 0.30.", "style": "Normal"},
    ])
    issue = next(issue for issue in report["issues"] if issue["issue_type"] == "statistical_expression.regression_coefficient_conflict")
    assert "beta" in issue["explanation"]
```

- [ ] **Step 2: Run the targeted worker tests and verify they fail**

Run:

```bash
python -m pytest apps/worker-py/tests/manuscript_quality/test_medical_specialized.py -k "auc or diagnostic_metric or regression_coefficient"
```

Expected: FAIL because the current analyzer does not parse or compare those governed metric families.

- [ ] **Step 3: Implement the minimal analyzer extensions**

```python
if is_analyzer_enabled("diagnostic_metric_consistency", medical_assets):
    issues.extend(check_diagnostic_metric_consistency(normalized, medical_assets, table_snapshots))
if is_analyzer_enabled("regression_consistency", medical_assets):
    issues.extend(check_regression_metric_consistency(normalized, medical_assets, table_snapshots))
```

- [ ] **Step 4: Re-run the targeted worker tests**

Run:

```bash
python -m pytest apps/worker-py/tests/manuscript_quality/test_medical_specialized.py -k "auc or diagnostic_metric or regression_coefficient"
```

Expected: PASS with deterministic issues for `AUC`, `sensitivity / specificity`, and `beta / SE / CI` mismatches.

- [ ] **Step 5: Commit**

```bash
git add apps/worker-py/src/manuscript_quality/medical_specialized.py apps/worker-py/tests/manuscript_quality/test_medical_specialized.py
git commit -m "feat: add governed medical statistics checks"
```

## Task 5: Deepen rule-center statistical authoring and package visibility

**Files:**
- Modify: `apps/web/src/features/template-governance/rule-authoring-types.ts`
- Modify: `apps/web/src/features/template-governance/rule-authoring-presets.ts`
- Modify: `apps/web/src/features/template-governance/rule-authoring-form.tsx`
- Modify: `apps/web/src/features/template-governance/rule-authoring-serialization.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-content-module-ledger-page.tsx`
- Modify: `apps/web/test/template-governance-rule-authoring.spec.ts`
- Modify: `apps/web/test/template-governance-content-module-package-guidance.spec.tsx`

- [ ] **Step 1: Write failing rule-center tests for the richer statistical payload**

```ts
test("statistical authoring serializes supported metrics and recalculation policy", () => {
  const draft = createRuleAuthoringDraft("statistical_expression");
  draft.payload.metricFamily = "diagnostic";
  draft.payload.supportedMetrics = "AUC, sensitivity, specificity";
  draft.payload.recalculationPolicy = "recheck_from_counts_when_possible";

  const serialized = serializeRuleAuthoringDraft(draft);
  assert.equal(serialized.authoringPayload.metric_family, "diagnostic");
});
```

- [ ] **Step 2: Run the impacted web tests and verify they fail**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-authoring.spec.ts ./test/template-governance-content-module-package-guidance.spec.tsx
```

Expected: FAIL because the authoring types, form, serialization, and package detail surfaces do not yet expose those governed concepts.

- [ ] **Step 3: Implement the richer authoring payload and package summary**

```ts
export interface StatisticalExpressionRuleAuthoringPayload {
  targetSection: "results" | "body";
  expressionPattern: string;
  reportingRequirement: string;
  metricFamily: "basic" | "diagnostic" | "regression";
  supportedMetrics: string;
  requiredCompanionEvidence: string;
  recalculationPolicy: string;
}
```

- [ ] **Step 4: Re-run the impacted web tests**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-authoring.spec.ts ./test/template-governance-content-module-package-guidance.spec.tsx
```

Expected: PASS with the richer operator-facing statistical rule model and package detail summary.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/template-governance/rule-authoring-types.ts apps/web/src/features/template-governance/rule-authoring-presets.ts apps/web/src/features/template-governance/rule-authoring-form.tsx apps/web/src/features/template-governance/rule-authoring-serialization.ts apps/web/src/features/template-governance/template-governance-content-module-ledger-page.tsx apps/web/test/template-governance-rule-authoring.spec.ts apps/web/test/template-governance-content-module-package-guidance.spec.tsx
git commit -m "feat: deepen rule center medical statistics authoring"
```

## Task 6: Run focused verification and document any residual gaps

**Files:**
- Modify: `docs/superpowers/specs/2026-04-17-rule-center-medical-statistics-deepening-design.md`
- Modify: `docs/superpowers/plans/2026-04-17-rule-center-medical-statistics-deepening.md`

- [ ] **Step 1: Run the full impacted test set**

Run:

```bash
pnpm --filter @medsys/api exec node --import tsx --test ./test/manuscript-quality-packages/medical-analyzer-package-schema.spec.ts
pnpm --filter @medsys/web exec node --import tsx --test ./test/medical-analyzer-package-editor.spec.tsx ./test/template-governance-rule-authoring.spec.ts ./test/template-governance-content-module-package-guidance.spec.tsx
python -m pytest apps/worker-py/tests/manuscript_quality/test_medical_specialized.py
```

Expected: PASS for all impacted API, web, and worker tests.

- [ ] **Step 2: If any suite remains too slow or flaky, record the exact residual risk in the docs instead of hand-waving it**

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-04-17-rule-center-medical-statistics-deepening-design.md docs/superpowers/plans/2026-04-17-rule-center-medical-statistics-deepening.md
git commit -m "docs: record medical statistics deepening plan"
```

## Execution Mode

The user already chose to continue inline on a fresh branch, so this plan should be executed in the current session instead of pausing for another execution-mode decision.
