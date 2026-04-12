import type { CreateManuscriptQualityPackageDraftInput } from "../../src/modules/manuscript-quality-packages/manuscript-quality-package-service.ts";

export const medicalResearchGeneralStyleManifest = {
  section_expectations: {
    abstract: {
      required_labels: ["objective", "methods", "results", "conclusion"],
    },
  },
  tone_markers: {
    strong_claims: ["prove", "guarantee", "definitive", "cure"],
    cautious_claims: ["suggest", "may", "appears", "is associated with"],
  },
  posture_checks: {
    abstract: ["objective", "methods", "results", "conclusion"],
    results: ["measured", "observed", "compared", "improved"],
    conclusion: ["suggest", "may", "support", "indicate"],
  },
  genre_wording_suspicions: ["news report", "experience sharing"],
  issue_policy: {
    section_expectation_missing: {
      severity: "medium",
      action: "suggest_fix",
    },
    result_conclusion_jump: {
      severity: "high",
      action: "manual_review",
    },
    tone_overclaim: {
      severity: "medium",
      action: "suggest_fix",
    },
    genre_wording_suspicion: {
      severity: "medium",
      action: "suggest_fix",
    },
  },
} as const;

export const medicalResearchGeneralStyleFixture = {
  package_kind: "general_style_package",
  package_name: "Medical Research Style",
  manifest: medicalResearchGeneralStyleManifest,
} as const;

export function buildMedicalResearchGeneralStyleDraftInput(): CreateManuscriptQualityPackageDraftInput {
  return {
    packageName: medicalResearchGeneralStyleFixture.package_name,
    packageKind: medicalResearchGeneralStyleFixture.package_kind,
    targetScopes: ["general_proofreading"],
    manifest: structuredClone(medicalResearchGeneralStyleFixture.manifest),
  };
}
