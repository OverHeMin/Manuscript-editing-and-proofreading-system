import type { CreateManuscriptQualityPackageDraftInput } from "../../src/modules/manuscript-quality-packages/manuscript-quality-package-service.ts";

export const defaultMedicalAnalyzerManifest = {
  indicator_dictionary: {
    ALT: {
      aliases: ["alanine aminotransferase", "谷丙转氨酶"],
      default_unit: "U/L",
    },
    AST: {
      aliases: ["aspartate aminotransferase", "谷草转氨酶"],
      default_unit: "U/L",
    },
  },
  unit_ranges: {
    ALT: [
      {
        unit: "U/L",
        min: 0,
        max: 1000,
      },
    ],
    percent: [
      {
        unit: "%",
        min: 0,
        max: 100,
      },
    ],
  },
  comparison_templates: {
    pre_post: ["before treatment|after treatment", "baseline|follow-up"],
    group_comparison: ["treatment group|control group"],
  },
  count_constraints: {
    percent: {
      max_percent: 100,
    },
  },
  diagnostic_metrics: {
    metric_aliases: {
      AUC: ["AUC", "area under the curve"],
      sensitivity: ["sensitivity", "sens"],
      specificity: ["specificity", "spec"],
    },
    metric_ranges: {
      AUC: {
        min: 0.5,
        max: 1,
      },
      sensitivity: {
        min: 0,
        max: 1,
      },
      specificity: {
        min: 0,
        max: 1,
      },
    },
    confusion_matrix_aliases: {
      tp: ["TP", "true positive"],
      fp: ["FP", "false positive"],
      fn: ["FN", "false negative"],
      tn: ["TN", "true negative"],
    },
    ci_confidence_levels: [95],
  },
  regression_metrics: {
    field_aliases: {
      beta: ["beta", "β"],
      SE: ["SE", "standard error"],
      p_value: ["P", "P value"],
      confidence_interval: ["95% CI", "confidence interval"],
      odds_ratio: ["OR", "odds ratio"],
      risk_ratio: ["RR", "risk ratio"],
      hazard_ratio: ["HR", "hazard ratio"],
    },
    ci_confidence_levels: [95],
  },
  issue_policy: {
    table_text_direction_conflict: {
      severity: "high",
      action: "manual_review",
    },
    significance_claim_conflict: {
      severity: "high",
      action: "manual_review",
    },
    diagnostic_metric_out_of_range: {
      severity: "medium",
      action: "manual_review",
    },
    diagnostic_metric_mismatch: {
      severity: "high",
      action: "manual_review",
    },
    auc_confidence_interval_conflict: {
      severity: "high",
      action: "manual_review",
    },
    regression_coefficient_conflict: {
      severity: "high",
      action: "manual_review",
    },
    test_statistic_conflict: {
      severity: "high",
      action: "manual_review",
    },
    statistical_information_incomplete: {
      severity: "medium",
      action: "manual_review",
    },
  },
  analyzer_toggles: {
    table_text_consistency: true,
    numeric_consistency: true,
    medical_logic: true,
    diagnostic_metric_consistency: true,
    regression_consistency: true,
    statistical_recheck: true,
    inferential_statistic_consistency: true,
  },
} as const;

export const defaultMedicalAnalyzerFixture = {
  package_kind: "medical_analyzer_package",
  package_name: "Medical Analyzer Default",
  version: 1,
  manifest: defaultMedicalAnalyzerManifest,
} as const;

export function buildDefaultMedicalAnalyzerDraftInput(): CreateManuscriptQualityPackageDraftInput {
  return {
    packageName: defaultMedicalAnalyzerFixture.package_name,
    packageKind: defaultMedicalAnalyzerFixture.package_kind,
    targetScopes: ["medical_specialized"],
    manifest: structuredClone(defaultMedicalAnalyzerFixture.manifest),
  };
}
