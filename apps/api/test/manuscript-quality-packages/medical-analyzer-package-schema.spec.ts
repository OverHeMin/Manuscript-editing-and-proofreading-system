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
