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
  issue_policy: {
    table_text_direction_conflict: {
      severity: "high",
      action: "manual_review",
    },
    significance_claim_conflict: {
      severity: "high",
      action: "manual_review",
    },
  },
  analyzer_toggles: {
    table_text_consistency: true,
    numeric_consistency: true,
    medical_logic: true,
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
