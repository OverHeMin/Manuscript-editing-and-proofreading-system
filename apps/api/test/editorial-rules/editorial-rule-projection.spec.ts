import test from "node:test";
import assert from "node:assert/strict";
import { EditorialRuleProjectionService } from "../../src/modules/editorial-rules/editorial-rule-projection-service.ts";
import { InMemoryEditorialRuleRepository } from "../../src/modules/editorial-rules/in-memory-editorial-rule-repository.ts";
import { EditorialRuleService } from "../../src/modules/editorial-rules/editorial-rule-service.ts";
import { InMemoryKnowledgeRepository } from "../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import { InMemoryTemplateFamilyRepository } from "../../src/modules/templates/in-memory-template-family-repository.ts";

const BEFORE_HEADING = "\u6458\u8981 \u76ee\u7684";
const AFTER_HEADING = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09";
const AFTER_HEADING_WITH_COLON = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09\uff1a";

function createProjectionHarness() {
  const editorialRuleRepository = new InMemoryEditorialRuleRepository();
  const knowledgeRepository = new InMemoryKnowledgeRepository();
  const templateFamilyRepository = new InMemoryTemplateFamilyRepository();
  const projectionService = new EditorialRuleProjectionService({
    editorialRuleRepository,
    knowledgeRepository,
    templateFamilyRepository,
    createId: (() => {
      const ids = [
        "knowledge-rule-1",
        "knowledge-checklist-1",
        "knowledge-snippet-1",
        "knowledge-rule-2",
        "knowledge-checklist-2",
        "knowledge-snippet-2",
      ];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a projected knowledge id to be available.");
        return value;
      };
    })(),
  });
  const editorialRuleService = new EditorialRuleService({
    repository: editorialRuleRepository,
    templateFamilyRepository,
    projectionService,
    createId: (() => {
      const ids = ["rule-set-1", "rule-1"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected an editorial rule id to be available.");
        return value;
      };
    })(),
  });

  return {
    editorialRuleRepository,
    editorialRuleService,
    knowledgeRepository,
    projectionService,
    templateFamilyRepository,
  };
}

async function seedPublishedRuleSet() {
  const harness = createProjectionHarness();

  await harness.templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical study family",
    status: "active",
  });

  const ruleSet = await harness.editorialRuleService.createRuleSet("admin", {
    templateFamilyId: "family-1",
    module: "editing",
  });

  await harness.editorialRuleService.createRule("admin", {
    ruleSetId: ruleSet.id,
    orderNo: 10,
    ruleType: "format",
    executionMode: "apply_and_inspect",
    scope: {
      sections: ["abstract"],
      block_kind: "heading",
    },
    selector: {},
    trigger: {
      kind: "exact_text",
      text: BEFORE_HEADING,
    },
    action: {
      kind: "replace_heading",
      to: AFTER_HEADING,
    },
    confidencePolicy: "always_auto",
    severity: "error",
    enabled: true,
    exampleBefore: BEFORE_HEADING,
    exampleAfter: AFTER_HEADING,
    manualReviewReasonTemplate: "medical_meaning_risk",
  });

  await harness.editorialRuleService.publishRuleSet("admin", ruleSet.id);

  return harness;
}

test("publishing a rule set projects rule, checklist, and prompt snippet knowledge with provenance", async () => {
  const { knowledgeRepository } = await seedPublishedRuleSet();

  const projectedKnowledge = await knowledgeRepository.list();
  const projectedRuleKnowledge = projectedKnowledge.find(
    (record) => record.projection_source?.projection_kind === "rule",
  );
  const projectedChecklistKnowledge = projectedKnowledge.find(
    (record) => record.projection_source?.projection_kind === "checklist",
  );
  const projectedSnippetKnowledge = projectedKnowledge.find(
    (record) => record.projection_source?.projection_kind === "prompt_snippet",
  );

  assert.equal(projectedKnowledge.length, 3);
  assert.equal(projectedRuleKnowledge?.knowledge_kind, "rule");
  assert.equal(projectedChecklistKnowledge?.knowledge_kind, "checklist");
  assert.equal(projectedSnippetKnowledge?.knowledge_kind, "prompt_snippet");
  assert.equal(projectedRuleKnowledge?.status, "approved");
  assert.equal(
    projectedRuleKnowledge?.projection_source?.source_kind,
    "editorial_rule_projection",
  );
  assert.equal(projectedRuleKnowledge?.projection_source?.rule_set_id, "rule-set-1");
  assert.equal(projectedRuleKnowledge?.projection_source?.rule_id, "rule-1");
  assert.ok(projectedRuleKnowledge?.canonical_text.includes(BEFORE_HEADING));
  assert.ok(projectedRuleKnowledge?.canonical_text.includes(AFTER_HEADING));
});

test("projected rule knowledge records journal metadata and object metadata when the rule set is journal-scoped", async () => {
  const harness = createProjectionHarness();

  await harness.templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical study family",
    status: "active",
  });
  await harness.templateFamilyRepository.saveJournalTemplateProfile({
    id: "journal-template-1",
    template_family_id: "family-1",
    journal_key: "journal-alpha",
    journal_name: "Journal Alpha",
    status: "active",
  });

  const ruleSet = await harness.editorialRuleService.createRuleSet("admin", {
    templateFamilyId: "family-1",
    journalTemplateId: "journal-template-1",
    module: "editing",
  });
  await harness.editorialRuleService.createRule("admin", {
    ruleSetId: ruleSet.id,
    orderNo: 10,
    ruleObject: "abstract",
    ruleType: "format",
    executionMode: "apply_and_inspect",
    scope: {
      sections: ["abstract"],
      block_kind: "heading",
    },
    selector: {
      section_selector: "abstract",
    },
    trigger: {
      kind: "exact_text",
      text: BEFORE_HEADING,
    },
    action: {
      kind: "replace_heading",
      to: AFTER_HEADING,
    },
    authoringPayload: {
      normalized_example: AFTER_HEADING,
      common_error_text: BEFORE_HEADING,
      standard_example: AFTER_HEADING,
    },
    confidencePolicy: "always_auto",
    severity: "error",
    enabled: true,
    exampleBefore: BEFORE_HEADING,
    exampleAfter: AFTER_HEADING,
  });

  await harness.editorialRuleService.publishRuleSet("admin", ruleSet.id);

  const projectedKnowledge = await harness.knowledgeRepository.list();
  const projectedRuleKnowledge = projectedKnowledge.find(
    (record) => record.projection_source?.projection_kind === "rule",
  );

  assert.deepEqual(projectedRuleKnowledge?.template_bindings, [
    "family-1",
    "journal:journal-alpha",
  ]);
  assert.match(projectedRuleKnowledge?.summary ?? "", /Journal Alpha/u);
  assert.match(projectedRuleKnowledge?.summary ?? "", /journal-alpha/u);
  assert.match(projectedRuleKnowledge?.summary ?? "", /abstract/u);
  assert.match(
    projectedRuleKnowledge?.canonical_text ?? "",
    /common error text/i,
  );
  assert.match(
    projectedRuleKnowledge?.canonical_text ?? "",
    /standard example/i,
  );
});

test("refreshing projected rule knowledge updates existing projections instead of duplicating forever", async () => {
  const {
    editorialRuleRepository,
    knowledgeRepository,
    projectionService,
  } = await seedPublishedRuleSet();

  await editorialRuleRepository.saveRule({
    id: "rule-1",
    rule_set_id: "rule-set-1",
    order_no: 10,
    rule_object: "generic",
    rule_type: "format",
    execution_mode: "apply_and_inspect",
    scope: {
      sections: ["abstract"],
      block_kind: "heading",
    },
    selector: {},
    trigger: {
      kind: "exact_text",
      text: BEFORE_HEADING,
    },
    action: {
      kind: "replace_heading",
      to: AFTER_HEADING_WITH_COLON,
    },
    authoring_payload: {},
    confidence_policy: "always_auto",
    severity: "error",
    enabled: true,
    example_before: BEFORE_HEADING,
    example_after: AFTER_HEADING_WITH_COLON,
    manual_review_reason_template: "medical_meaning_risk",
  });

  await projectionService.refreshPublishedRuleSet("rule-set-1");

  const projectedKnowledge = await knowledgeRepository.list();
  const projectedSnippetKnowledge = projectedKnowledge.find(
    (record) => record.projection_source?.projection_kind === "prompt_snippet",
  );

  assert.equal(projectedKnowledge.length, 3);
  assert.ok(
    projectedSnippetKnowledge?.canonical_text.includes(AFTER_HEADING_WITH_COLON),
  );
});
