import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryManuscriptQualityPackageRepository } from "../../src/modules/manuscript-quality-packages/in-memory-manuscript-quality-package-repository.ts";
import {
  ManuscriptQualityPackageService,
  ManuscriptQualityPackageValidationError,
} from "../../src/modules/manuscript-quality-packages/manuscript-quality-package-service.ts";
import { parseMedicalAnalyzerPackageManifest } from "../../src/modules/manuscript-quality-packages/medical-analyzer-package-schema.ts";
import {
  buildDefaultMedicalAnalyzerDraftInput,
  defaultMedicalAnalyzerManifest,
} from "../shared/medical-analyzer-package-fixture.ts";

test("medical analyzer package schema parses indicator, comparison, and issue policy assets", () => {
  const manifest = parseMedicalAnalyzerPackageManifest(
    defaultMedicalAnalyzerManifest,
  );

  assert.equal(manifest.indicator_dictionary.ALT.default_unit, "U/L");
  assert.equal(manifest.comparison_templates.pre_post.length > 0, true);
  assert.equal(
    manifest.issue_policy.table_text_direction_conflict.action,
    "manual_review",
  );
  assert.equal(
    manifest.issue_policy.test_statistic_conflict.action,
    "manual_review",
  );
  assert.equal(manifest.analyzer_toggles.inferential_statistic_consistency, true);
});

test("medical analyzer package schema parses governed diagnostic and regression statistics", () => {
  const manifest = parseMedicalAnalyzerPackageManifest({
    ...defaultMedicalAnalyzerManifest,
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
      },
      confusion_matrix_aliases: {
        tp: ["TP", "true positive"],
        fp: ["FP", "false positive"],
        fn: ["FN", "false negative"],
        tn: ["TN", "true negative"],
      },
      ci_confidence_levels: [90, 95],
    },
    regression_metrics: {
      field_aliases: {
        beta: ["beta", "β"],
        SE: ["SE", "standard error"],
        p_value: ["P", "P value"],
        confidence_interval: ["95% CI", "confidence interval"],
      },
      ci_confidence_levels: [95],
    },
    issue_policy: {
      ...defaultMedicalAnalyzerManifest.issue_policy,
      diagnostic_metric_out_of_range: {
        severity: "medium",
        action: "suggest_fix",
      },
      regression_coefficient_conflict: {
        severity: "high",
        action: "manual_review",
      },
    },
    analyzer_toggles: {
      ...defaultMedicalAnalyzerManifest.analyzer_toggles,
      diagnostic_metric_consistency: true,
      regression_consistency: true,
      statistical_recheck: true,
    },
  });

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
  assert.equal(
    manifest.issue_policy.diagnostic_metric_out_of_range.action,
    "suggest_fix",
  );
  assert.equal(manifest.analyzer_toggles.statistical_recheck, true);
});

test("manuscript quality package service rejects malformed structured medical analyzer manifests", async () => {
  const repository = new InMemoryManuscriptQualityPackageRepository();
  const service = new ManuscriptQualityPackageService({
    repository,
    createId: () => "quality-package-medical-1",
  });

  await assert.rejects(
    () =>
      service.createDraftVersion("admin", {
        ...buildDefaultMedicalAnalyzerDraftInput(),
        manifest: {
          indicator_dictionary: {
            ALT: {
              aliases: "alanine aminotransferase",
            },
          },
          unit_ranges: {},
          comparison_templates: {
            pre_post: [],
            group_comparison: ["treatment group|control group"],
          },
          count_constraints: {},
          issue_policy: {
            table_text_direction_conflict: {
              severity: "high",
            },
          },
          analyzer_toggles: {
            table_text_consistency: true,
          },
        },
      }),
    ManuscriptQualityPackageValidationError,
  );
});

test("manuscript quality package service rejects malformed governed medical statistics fields", async () => {
  const repository = new InMemoryManuscriptQualityPackageRepository();
  const service = new ManuscriptQualityPackageService({
    repository,
    createId: () => "quality-package-medical-1",
  });

  await assert.rejects(
    () =>
      service.createDraftVersion("admin", {
        ...buildDefaultMedicalAnalyzerDraftInput(),
        manifest: {
          ...defaultMedicalAnalyzerManifest,
          diagnostic_metrics: {
            metric_aliases: {
              AUC: ["AUC"],
            },
            metric_ranges: {
              AUC: {
                min: "0.5",
              },
            },
            confusion_matrix_aliases: {
              tp: ["TP"],
            },
            ci_confidence_levels: [95],
          },
          regression_metrics: {
            field_aliases: {
              beta: ["beta"],
            },
            ci_confidence_levels: [95],
          },
          analyzer_toggles: {
            ...defaultMedicalAnalyzerManifest.analyzer_toggles,
            statistical_recheck: true,
          },
        },
      }),
    ManuscriptQualityPackageValidationError,
  );
});

test("manuscript quality package service still accepts legacy shorthand medical analyzer manifests", async () => {
  const repository = new InMemoryManuscriptQualityPackageRepository();
  const service = new ManuscriptQualityPackageService({
    repository,
    createId: () => "quality-package-medical-1",
  });

  const created = await service.createDraftVersion("admin", {
    packageName: "Medical Analyzer Default",
    packageKind: "medical_analyzer_package",
    targetScopes: ["medical_specialized"],
    manifest: {
      analyzer_family: "medical_default",
    },
  });

  assert.equal(created.id, "quality-package-medical-1");
  assert.deepEqual(created.manifest, {
    analyzer_family: "medical_default",
  });
});
