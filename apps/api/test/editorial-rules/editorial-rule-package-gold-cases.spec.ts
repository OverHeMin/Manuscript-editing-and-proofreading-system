import test from "node:test";
import assert from "node:assert/strict";
import { createEditorialRuleApi } from "../../src/modules/editorial-rules/editorial-rule-api.ts";
import { InMemoryEditorialRuleRepository } from "../../src/modules/editorial-rules/in-memory-editorial-rule-repository.ts";
import { EditorialRulePreviewService } from "../../src/modules/editorial-rules/editorial-rule-preview-service.ts";
import { EditorialRuleResolutionService } from "../../src/modules/editorial-rules/editorial-rule-resolution-service.ts";
import { EditorialRuleService } from "../../src/modules/editorial-rules/editorial-rule-service.ts";
import { ExamplePairDiffService } from "../../src/modules/editorial-rules/example-pair-diff-service.ts";
import { EditorialRulePackageService } from "../../src/modules/editorial-rules/editorial-rule-package-service.ts";
import { InMemoryTemplateFamilyRepository } from "../../src/modules/templates/in-memory-template-family-repository.ts";
import { buildRealDocxGoldCase } from "./fixtures/real-docx-rule-package-gold-case.ts";
import {
  buildMiniFrontMatterFixture,
  buildMiniManuscriptStructureFixture,
  buildMiniStatementFixture,
  buildMiniTableReferenceFixture,
  buildMiniTerminologyFixture,
  findCandidate,
  buildRealGoldSnapshots,
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

  return createEditorialRuleApi({
    editorialRuleService,
    editorialRulePreviewService: previewService,
    editorialRulePackageService: new EditorialRulePackageService(),
  });
}

test("diff normalization emits stable edit intent signals for the real gold case", () => {
  const { original, edited } = buildRealGoldSnapshots();
  const service = new ExamplePairDiffService();

  const signals = service.extractSignals({ original, edited });

  assert.ok(signals.some((signal) => signal.package_hint === "front_matter"));
  assert.ok(signals.some((signal) => signal.package_hint === "three_line_table"));
  assert.ok(
    signals.some((signal) => signal.signal_type === "reference_style_change"),
  );
});

test("recognizers group normalized signals into six package candidates", () => {
  const service = new EditorialRulePackageService();

  const candidates = service.generateCandidates(buildRealSampleFixture());

  assert.deepEqual(
    candidates.map((candidate) => candidate.package_kind),
    [
      "front_matter",
      "abstract_keywords",
      "heading_hierarchy",
      "numeric_statistics",
      "three_line_table",
      "reference",
    ],
  );
});

test("real gold case produces six candidates with expected postures and layers", async () => {
  const api = createRulePackageHarness();

  const response = await api.generateRulePackageCandidates({
    input: buildRealSampleFixture(),
  });

  assert.equal(response.body.length, 6);
  assert.equal(
    findCandidate(response.body, "three_line_table")?.automation_posture,
    "inspect_only",
  );
  assert.equal(
    findCandidate(response.body, "front_matter")?.suggested_layer,
    "journal_template",
  );
  assert.equal(
    findCandidate(response.body, "reference")?.suggested_layer,
    "template_family",
  );
});

test("real gold case fixture includes front matter, abstract, references, and five tables from the sample pair", () => {
  const fixture = buildRealDocxGoldCase();

  assert.equal(fixture.original.tables.length, 5);
  assert.equal(fixture.edited.tables.length, 5);
  assert.ok(
    fixture.original.blocks.some((block) => block.text.includes("第一作者")),
  );
  assert.ok(
    fixture.edited.blocks.some((block) => block.text.includes("［作者简介］")),
  );
});

test("primary real sample fixture delegates to the committed real docx gold case", () => {
  assert.deepEqual(buildRealSampleFixture(), buildRealDocxGoldCase());
});

test("mini front matter fixture keeps only front matter blocks and no body sections", () => {
  const fixture = buildMiniFrontMatterFixture();

  assert.deepEqual(fixture.original.sections, []);
  assert.deepEqual(fixture.edited.sections, []);
  assert.ok(
    fixture.original.blocks.every((block) => block.section_key === "front_matter"),
  );
  assert.ok(
    fixture.edited.blocks.every((block) => block.section_key === "front_matter"),
  );
  assert.equal(fixture.original.tables.length, 0);
  assert.equal(fixture.edited.tables.length, 0);
});

test("mini table and reference fixture keeps result and reference sections from the real fixture", () => {
  const fixture = buildMiniTableReferenceFixture();

  assert.ok(
    fixture.original.sections.some((section) =>
      section.heading.replaceAll(/[\\s　]/g, "").startsWith("2"),
    ),
  );
  assert.ok(
    fixture.edited.sections.some((section) =>
      section.heading.replaceAll(/[\\s　]/g, "").startsWith("2"),
    ),
  );
  assert.ok(
    fixture.original.sections.some((section) => section.heading.includes("参考文献")),
  );
  assert.ok(
    fixture.edited.sections.some((section) => section.heading.includes("参考文献")),
  );
});

test("mini front matter fixture does not force unrelated packages", async () => {
  const api = createRulePackageHarness();

  const response = await api.generateRulePackageCandidates({
    input: buildMiniFrontMatterFixture(),
  });

  assert.deepEqual(
    response.body.map((candidate) => candidate.package_kind),
    ["front_matter"],
  );
});

test("mini table and reference fixture keeps the table package inspect_only", async () => {
  const api = createRulePackageHarness();

  const response = await api.generateRulePackageCandidates({
    input: buildMiniTableReferenceFixture(),
  });

  assert.equal(
    findCandidate(response.body, "three_line_table")?.automation_posture,
    "inspect_only",
  );
  assert.equal(
    findCandidate(response.body, "reference")?.suggested_layer,
    "template_family",
  );
});

test("mini terminology fixture isolates the terminology package", async () => {
  const api = createRulePackageHarness();

  const response = await api.generateRulePackageCandidates({
    input: buildMiniTerminologyFixture(),
  });

  assert.deepEqual(
    response.body.map((candidate) => candidate.package_kind),
    ["terminology"],
  );
  assert.equal(
    findCandidate(response.body, "terminology")?.suggested_layer,
    "template_family",
  );
});

test("mini statement fixture isolates the statement package", async () => {
  const api = createRulePackageHarness();

  const response = await api.generateRulePackageCandidates({
    input: buildMiniStatementFixture(),
  });

  assert.deepEqual(
    response.body.map((candidate) => candidate.package_kind),
    ["statement"],
  );
  assert.equal(
    findCandidate(response.body, "statement")?.automation_posture,
    "inspect_only",
  );
});

test("mini manuscript structure fixture isolates the manuscript structure package", async () => {
  const api = createRulePackageHarness();

  const response = await api.generateRulePackageCandidates({
    input: buildMiniManuscriptStructureFixture(),
  });

  assert.deepEqual(
    response.body.map((candidate) => candidate.package_kind),
    ["manuscript_structure"],
  );
  assert.equal(
    findCandidate(response.body, "manuscript_structure")?.suggested_layer,
    "template_family",
  );
});
