import test from "node:test";
import assert from "node:assert/strict";
import { createEditorialRuleApi } from "../../src/modules/editorial-rules/editorial-rule-api.ts";
import { InMemoryEditorialRuleRepository } from "../../src/modules/editorial-rules/in-memory-editorial-rule-repository.ts";
import { EditorialRulePreviewService } from "../../src/modules/editorial-rules/editorial-rule-preview-service.ts";
import { EditorialRuleResolutionService } from "../../src/modules/editorial-rules/editorial-rule-resolution-service.ts";
import { EditorialRuleService } from "../../src/modules/editorial-rules/editorial-rule-service.ts";
import { EditorialRulePackageService } from "../../src/modules/editorial-rules/editorial-rule-package-service.ts";
import { ReviewedCaseRulePackageSourceService } from "../../src/modules/editorial-rules/reviewed-case-rule-package-source-service.ts";
import { InMemoryTemplateFamilyRepository } from "../../src/modules/templates/in-memory-template-family-repository.ts";
import { InMemoryReviewedCaseSnapshotRepository } from "../../src/modules/learning/in-memory-learning-repository.ts";
import { LearningDeidentificationRequiredError } from "../../src/modules/learning/learning-service.ts";
import {
  buildRealSampleFixture,
} from "./fixtures/example-rule-package-fixtures.ts";

function createRulePackageHarness() {
  const repository = new InMemoryEditorialRuleRepository();
  const templateFamilyRepository = new InMemoryTemplateFamilyRepository();
  const reviewedCaseSnapshotRepository = new InMemoryReviewedCaseSnapshotRepository();
  const resolutionService = new EditorialRuleResolutionService({
    repository,
  });
  const previewService = new EditorialRulePreviewService({
    repository,
    resolutionService,
  });
  const editorialRuleService = new EditorialRuleService({
    repository,
    templateFamilyRepository,
    createId: (() => {
      const ids = ["rule-set-1", "rule-1", "rule-set-2", "rule-2"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a rule-package harness id.");
        return value;
      };
    })(),
  });
  const fixture = buildRealSampleFixture();
  const extractCalls: Array<{ assetId: string; source: "original" | "edited" }> = [];

  const reviewedCaseSourceService = new ReviewedCaseRulePackageSourceService({
    snapshotRepository: reviewedCaseSnapshotRepository,
    exampleSource: {
      async extract(input) {
        extractCalls.push({
          assetId: input.assetId,
          source: input.source,
        });
        return input.source === "original" ? fixture.original : fixture.edited;
      },
    },
  });

  const api = createEditorialRuleApi({
    editorialRuleService,
    editorialRulePreviewService: previewService,
    editorialRulePackageService: new EditorialRulePackageService({
      reviewedCaseSourceService,
    }),
  });

  return {
    api,
    extractCalls,
    reviewedCaseSnapshotRepository,
  };
}

test("reviewed-case snapshot source resolves an example pair and returns six package candidates", async () => {
  const {
    api,
    extractCalls,
    reviewedCaseSnapshotRepository,
  } = createRulePackageHarness();

  await reviewedCaseSnapshotRepository.save({
    id: "reviewed-case-snapshot-demo-1",
    manuscript_id: "manuscript-demo-1",
    module: "editing",
    manuscript_type: "clinical_study",
    human_final_asset_id: "human-final-demo-1",
    deidentification_passed: true,
    snapshot_asset_id: "snapshot-demo-1",
    created_by: "editor-1",
    created_at: "2026-04-10T10:00:00.000Z",
  });

  const response = await api.generateRulePackageCandidatesFromReviewedCase({
    input: {
      reviewedCaseSnapshotId: "reviewed-case-snapshot-demo-1",
      journalKey: "journal-alpha",
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.map((candidate) => candidate.package_kind),
    [
      "front_matter",
      "abstract_keywords",
      "heading_hierarchy",
      "numeric_statistics",
      "three_line_table",
      "reference",
    ],
  );
  assert.deepEqual(extractCalls, [
    {
      assetId: "snapshot-demo-1",
      source: "original",
    },
    {
      assetId: "human-final-demo-1",
      source: "edited",
    },
  ]);
});

test("reviewed-case source rejects snapshots that did not pass de-identification", async () => {
  const { reviewedCaseSnapshotRepository } = createRulePackageHarness();
  const sourceService = new ReviewedCaseRulePackageSourceService({
    snapshotRepository: reviewedCaseSnapshotRepository,
    exampleSource: {
      async extract() {
        return buildRealSampleFixture().original;
      },
    },
  });

  await reviewedCaseSnapshotRepository.save({
    id: "reviewed-case-snapshot-demo-2",
    manuscript_id: "manuscript-demo-1",
    module: "editing",
    manuscript_type: "clinical_study",
    human_final_asset_id: "human-final-demo-1",
    deidentification_passed: false,
    snapshot_asset_id: "snapshot-demo-2",
    created_by: "editor-1",
    created_at: "2026-04-10T10:00:00.000Z",
  });

  await assert.rejects(
    () =>
      sourceService.buildExamplePair({
        reviewedCaseSnapshotId: "reviewed-case-snapshot-demo-2",
      }),
    LearningDeidentificationRequiredError,
  );
});
