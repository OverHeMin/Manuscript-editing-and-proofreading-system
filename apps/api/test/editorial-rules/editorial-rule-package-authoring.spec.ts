import test from "node:test";
import assert from "node:assert/strict";
import { createEditorialRuleApi } from "../../src/modules/editorial-rules/editorial-rule-api.ts";
import { InMemoryEditorialRuleRepository } from "../../src/modules/editorial-rules/in-memory-editorial-rule-repository.ts";
import { EditorialRulePreviewService } from "../../src/modules/editorial-rules/editorial-rule-preview-service.ts";
import { EditorialRuleResolutionService } from "../../src/modules/editorial-rules/editorial-rule-resolution-service.ts";
import { EditorialRuleService } from "../../src/modules/editorial-rules/editorial-rule-service.ts";
import { EditorialRulePackageService } from "../../src/modules/editorial-rules/editorial-rule-package-service.ts";
import { InMemoryTemplateFamilyRepository } from "../../src/modules/templates/in-memory-template-family-repository.ts";
import {
  buildAbstractKeywordCandidate,
  buildRealSampleFixture,
} from "./fixtures/example-rule-package-fixtures.ts";

function createRulePackageHarness() {
  const repository = new InMemoryEditorialRuleRepository();
  const templateFamilyRepository = new InMemoryTemplateFamilyRepository();
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
  const api = createEditorialRuleApi({
    editorialRuleService,
    editorialRulePreviewService: previewService,
    editorialRulePackageService: new EditorialRulePackageService(),
  });

  return {
    api,
  };
}

test("example pair generation returns six rule package candidates with future-ui card fields", async () => {
  const { api } = createRulePackageHarness();

  const response = await api.generateRulePackageCandidates({
    input: buildRealSampleFixture(),
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
  assert.ok(
    response.body.every(
      (candidate) => candidate.cards.ai_understanding.summary.length > 0,
    ),
  );
  assert.ok(
    response.body.every((candidate) => candidate.preview.decision.reason.length > 0),
  );
});

test("preview explains both a hit and a non-hit for a candidate package", async () => {
  const { api } = createRulePackageHarness();

  const response = await api.previewRulePackage({
    packageDraft: buildAbstractKeywordCandidate(),
    sampleText: "摘要 目的 观察治疗效果。关键词 高血压 疗效",
  });

  assert.equal(response.status, 200);
  assert.ok(response.body.hits.length > 0);
  assert.ok(response.body.misses.length > 0);
});

test("preview includes hit reasons, miss reasons, and automation posture", async () => {
  const { api } = createRulePackageHarness();

  const preview = await api.previewRulePackage({
    packageDraft: buildAbstractKeywordCandidate(),
    sampleText: "摘要 目的 观察治疗效果。关键词 高血压 疗效",
  });

  assert.equal(preview.status, 200);
  assert.equal(preview.body.decision.automation_posture, "guarded_auto");
  assert.ok(preview.body.hits.some((entry) => entry.reason.length > 0));
  assert.ok(preview.body.misses.some((entry) => entry.reason.length > 0));
});
