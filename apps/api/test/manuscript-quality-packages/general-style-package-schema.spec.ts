import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryManuscriptQualityPackageRepository } from "../../src/modules/manuscript-quality-packages/in-memory-manuscript-quality-package-repository.ts";
import {
  ManuscriptQualityPackageService,
  ManuscriptQualityPackageValidationError,
} from "../../src/modules/manuscript-quality-packages/manuscript-quality-package-service.ts";
import { parseGeneralStylePackageManifest } from "../../src/modules/manuscript-quality-packages/general-style-package-schema.ts";
import {
  buildMedicalResearchGeneralStyleDraftInput,
  medicalResearchGeneralStyleManifest,
} from "../shared/general-style-package-fixture.ts";

test("general style package schema parses the structured medical research manifest", () => {
  const manifest = parseGeneralStylePackageManifest(
    medicalResearchGeneralStyleManifest,
  );

  assert.deepEqual(manifest.section_expectations.abstract.required_labels, [
    "objective",
    "methods",
    "results",
    "conclusion",
  ]);
  assert.equal(
    manifest.issue_policy.result_conclusion_jump.action,
    "manual_review",
  );
});

test("manuscript quality package service rejects malformed structured general style manifests", async () => {
  const repository = new InMemoryManuscriptQualityPackageRepository();
  const service = new ManuscriptQualityPackageService({
    repository,
    createId: () => "quality-package-1",
  });

  await assert.rejects(
    () =>
      service.createDraftVersion("admin", {
        ...buildMedicalResearchGeneralStyleDraftInput(),
        manifest: {
          section_expectations: {
            abstract: {
              required_labels: ["objective"],
            },
          },
          tone_markers: {
            strong_claims: ["prove"],
            cautious_claims: ["suggest"],
          },
          posture_checks: {
            abstract: ["objective"],
            results: ["measured"],
            conclusion: ["suggest"],
          },
          issue_policy: {
            result_conclusion_jump: {
              severity: "high",
            },
          },
        },
      }),
    ManuscriptQualityPackageValidationError,
  );
});

test("manuscript quality package service still accepts legacy shorthand general style manifests", async () => {
  const repository = new InMemoryManuscriptQualityPackageRepository();
  const service = new ManuscriptQualityPackageService({
    repository,
    createId: () => "quality-package-1",
  });

  const created = await service.createDraftVersion("admin", {
    packageName: "Medical Research Style",
    packageKind: "general_style_package",
    targetScopes: ["general_proofreading"],
    manifest: {
      style_family: "medical_research_article",
    },
  });

  assert.equal(created.id, "quality-package-1");
  assert.deepEqual(created.manifest, {
    style_family: "medical_research_article",
  });
});
