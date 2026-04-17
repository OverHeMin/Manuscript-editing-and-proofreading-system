import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildMedicalAnalyzerPackageManifest,
  MedicalAnalyzerPackageEditor,
  parseMedicalAnalyzerPackageManifestDraft,
} from "../src/features/admin-governance/medical-analyzer-package-editor.tsx";

test("medical analyzer package editor round-trips governed analyzer fields", () => {
  const manifest = buildMedicalAnalyzerPackageManifest({
    indicators: "ALT | alanine aminotransferase | U/L",
    unitRanges: "ALT | U/L | 0 | 40",
    prePostTemplates: "before treatment|after treatment, baseline|follow-up",
    groupComparisonTemplates: "treatment group|control group",
    percentMax: "100",
    diagnosticMetricAliases: [
      "AUC | AUC, area under the curve",
      "sensitivity | sensitivity, sens",
      "specificity | specificity, spec",
    ].join("\n"),
    diagnosticMetricRanges: [
      "AUC | 0.5 | 1",
      "sensitivity | 0 | 1",
      "specificity | 0 | 1",
    ].join("\n"),
    confusionMatrixAliases: [
      "tp | TP, true positive",
      "fp | FP, false positive",
      "fn | FN, false negative",
      "tn | TN, true negative",
    ].join("\n"),
    diagnosticConfidenceLevels: "90, 95",
    regressionFieldAliases: [
      "beta | beta, β",
      "SE | SE, standard error",
      "p_value | P, P value",
      "confidence_interval | 95% CI, confidence interval",
    ].join("\n"),
    regressionConfidenceLevels: "95",
    unitRangeConflictSeverity: "medium",
    unitRangeConflictAction: "suggest_fix",
    significanceMismatchSeverity: "high",
    significanceMismatchAction: "manual_review",
    tableTextDirectionSeverity: "medium",
    tableTextDirectionAction: "suggest_fix",
    diagnosticMetricOutOfRangeSeverity: "medium",
    diagnosticMetricOutOfRangeAction: "manual_review",
    diagnosticMetricMismatchSeverity: "high",
    diagnosticMetricMismatchAction: "suggest_fix",
    aucConfidenceIntervalSeverity: "high",
    aucConfidenceIntervalAction: "manual_review",
    regressionCoefficientSeverity: "medium",
    regressionCoefficientAction: "suggest_fix",
    testStatisticConflictSeverity: "high",
    testStatisticConflictAction: "manual_review",
    statisticalInformationIncompleteSeverity: "low",
    statisticalInformationIncompleteAction: "manual_review",
    numericConsistencyEnabled: true,
    medicalLogicEnabled: true,
    tableTextConsistencyEnabled: true,
    diagnosticMetricConsistencyEnabled: true,
    regressionConsistencyEnabled: true,
    statisticalRecheckEnabled: true,
    inferentialStatisticConsistencyEnabled: true,
  });
  const draft = parseMedicalAnalyzerPackageManifestDraft(manifest);

  assert.deepEqual(manifest.indicator_dictionary.ALT.aliases, [
    "alanine aminotransferase",
  ]);
  assert.equal(manifest.indicator_dictionary.ALT.default_unit, "U/L");
  assert.equal(manifest.unit_ranges.ALT[0].max, 40);
  assert.deepEqual(manifest.diagnostic_metrics.metric_aliases.AUC, [
    "AUC",
    "area under the curve",
  ]);
  assert.deepEqual(manifest.diagnostic_metrics.metric_ranges.AUC, {
    min: 0.5,
    max: 1,
  });
  assert.deepEqual(manifest.diagnostic_metrics.confusion_matrix_aliases.tp, [
    "TP",
    "true positive",
  ]);
  assert.deepEqual(manifest.regression_metrics.field_aliases.beta, [
    "beta",
    "β",
  ]);
  assert.deepEqual(manifest.regression_metrics.ci_confidence_levels, [95]);
  assert.equal(manifest.issue_policy.unit_range_conflict.action, "suggest_fix");
  assert.equal(
    manifest.issue_policy.table_text_direction_conflict.severity,
    "medium",
  );
  assert.equal(
    manifest.issue_policy.diagnostic_metric_mismatch.action,
    "suggest_fix",
  );
  assert.equal(
    manifest.issue_policy.test_statistic_conflict.action,
    "manual_review",
  );
  assert.equal(manifest.analyzer_toggles.statistical_recheck, true);
  assert.equal(manifest.analyzer_toggles.inferential_statistic_consistency, true);
  assert.equal(draft.unitRanges, "ALT | U/L | 0 | 40");
  assert.match(draft.diagnosticMetricRanges, /AUC \| 0\.5 \| 1/);
  assert.match(draft.regressionFieldAliases, /beta \| beta, β/);
  assert.equal(draft.percentMax, "100");
});

test("medical analyzer package editor renders structured governed fields for operators", () => {
  const html = renderToStaticMarkup(
    <MedicalAnalyzerPackageEditor
      manifest={buildMedicalAnalyzerPackageManifest({
        indicators: "ALT | alanine aminotransferase | U/L",
        unitRanges: "ALT | U/L | 0 | 40",
        prePostTemplates: "before treatment|after treatment",
        groupComparisonTemplates: "treatment group|control group",
        percentMax: "100",
        diagnosticMetricAliases: "AUC | AUC, area under the curve",
        diagnosticMetricRanges: "AUC | 0.5 | 1",
        confusionMatrixAliases: "tp | TP, true positive",
        diagnosticConfidenceLevels: "95",
        regressionFieldAliases: "beta | beta, β",
        regressionConfidenceLevels: "95",
        unitRangeConflictSeverity: "medium",
        unitRangeConflictAction: "suggest_fix",
        significanceMismatchSeverity: "high",
        significanceMismatchAction: "manual_review",
        tableTextDirectionSeverity: "medium",
        tableTextDirectionAction: "suggest_fix",
        diagnosticMetricOutOfRangeSeverity: "medium",
        diagnosticMetricOutOfRangeAction: "manual_review",
        diagnosticMetricMismatchSeverity: "high",
        diagnosticMetricMismatchAction: "suggest_fix",
        aucConfidenceIntervalSeverity: "high",
        aucConfidenceIntervalAction: "manual_review",
        regressionCoefficientSeverity: "medium",
        regressionCoefficientAction: "suggest_fix",
        testStatisticConflictSeverity: "high",
        testStatisticConflictAction: "manual_review",
        statisticalInformationIncompleteSeverity: "low",
        statisticalInformationIncompleteAction: "manual_review",
        numericConsistencyEnabled: true,
        medicalLogicEnabled: true,
        tableTextConsistencyEnabled: true,
        diagnosticMetricConsistencyEnabled: true,
        regressionConsistencyEnabled: true,
        statisticalRecheckEnabled: true,
        inferentialStatisticConsistencyEnabled: true,
      })}
      onChange={() => undefined}
    />,
  );

  assert.match(html, /Indicator Dictionary/);
  assert.match(html, /Unit Ranges/);
  assert.match(html, /Diagnostic Metrics/);
  assert.match(html, /Confusion Matrix Aliases/);
  assert.match(html, /Regression Statistics/);
  assert.match(html, /Diagnostic Metric Mismatch/);
  assert.match(html, /Test Statistic Conflict/);
  assert.match(html, /Statistical Recheck/);
  assert.match(html, /Inferential Statistic Consistency/);
  assert.match(html, /Unit Range Conflict/);
  assert.match(html, /Analyzer Toggles/);
});
