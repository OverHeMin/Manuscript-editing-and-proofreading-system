import test from "node:test";
import assert from "node:assert/strict";
import { EditorialRuleProjectionService } from "../../src/modules/editorial-rules/editorial-rule-projection-service.ts";
import { InMemoryEditorialRuleRepository } from "../../src/modules/editorial-rules/in-memory-editorial-rule-repository.ts";
import { EditorialRuleService } from "../../src/modules/editorial-rules/editorial-rule-service.ts";
import { EditorialRuleResolutionService } from "../../src/modules/editorial-rules/editorial-rule-resolution-service.ts";
import { RulePackageCompileService } from "../../src/modules/editorial-rules/rule-package-compile-service.ts";
import { InMemoryKnowledgeRepository } from "../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import { InMemoryTemplateFamilyRepository } from "../../src/modules/templates/in-memory-template-family-repository.ts";
import type { RulePackageDraft } from "@medical/contracts";

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
  const resolutionService = new EditorialRuleResolutionService({
    repository: editorialRuleRepository,
  });
  const compileService = new RulePackageCompileService({
    repository: editorialRuleRepository,
    editorialRuleService,
    resolutionService,
  });

  return {
    compileService,
    editorialRuleRepository,
    editorialRuleService,
    knowledgeRepository,
    projectionService,
    templateFamilyRepository,
  };
}

function buildCompiledFrontMatterPackageDraft(): RulePackageDraft {
  return {
    package_id: "package-front-matter-knowledge",
    package_kind: "front_matter",
    title: "Front matter package",
    rule_object: "front_matter",
    suggested_layer: "journal_template",
    automation_posture: "guarded_auto",
    status: "draft",
    cards: {
      rule_what: {
        title: "Front matter package",
        object: "front_matter",
        publish_layer: "journal_template",
      },
      ai_understanding: {
        summary: "Normalize author and corresponding-author blocks.",
        hit_objects: ["author_line", "corresponding_author"],
        hit_locations: ["front_matter"],
      },
      applicability: {
        manuscript_types: ["clinical_study"],
        modules: ["editing"],
        sections: ["front_matter"],
        table_targets: [],
      },
      evidence: {
        examples: [
          {
            before: "First author: Zhang San",
            after: "Author: Zhang San",
          },
        ],
      },
      exclusions: {
        not_applicable_when: ["Source metadata is missing."],
        human_review_required_when: ["Review when adding a corresponding author."],
        risk_posture: "guarded_auto",
      },
    },
    semantic_draft: {
      semantic_summary: "Normalize author and corresponding-author blocks.",
      hit_scope: ["author_line:text_style_normalization"],
      applicability: ["front_matter"],
      evidence_examples: [
        {
          before: "First author: Zhang San",
          after: "Author: Zhang San",
        },
      ],
      failure_boundaries: ["Source metadata is missing."],
      normalization_recipe: ["Normalize author labels and markers."],
      review_policy: ["Review when adding a corresponding author."],
      confirmed_fields: ["summary", "applicability", "evidence", "boundaries"],
    },
    supporting_signals: [],
  };
}

async function seedPublishedPackageCompiledRuleSet() {
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

  const compileResult = await harness.compileService.compileToDraft({
    actorRole: "admin",
    source: {
      sourceKind: "uploaded_example_pair",
      exampleSourceSessionId: "session-demo-1",
    },
    packageDrafts: [buildCompiledFrontMatterPackageDraft()],
    templateFamilyId: "family-1",
    journalTemplateId: "journal-template-1",
    module: "editing",
  });
  await harness.editorialRuleService.publishRuleSet("admin", compileResult.rule_set_id);

  return harness;
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
    ruleObject: "abstract",
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
    explanationPayload: {
      rationale:
        "Abstract headings should use full-width punctuation and spacing in the normalized journal style.",
      correct_example: AFTER_HEADING,
      incorrect_example: BEFORE_HEADING,
    },
    projectionPayload: {
      projection_kind: "rule",
      summary: "Normalize abstract headings to the configured journal style.",
      standard_example: AFTER_HEADING,
      incorrect_example: BEFORE_HEADING,
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
  assert.match(
    projectedRuleKnowledge?.canonical_text ?? "",
    /full-width punctuation and spacing/i,
  );
  assert.match(projectedRuleKnowledge?.summary ?? "", /abstract/i);
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
  assert.equal(projectedRuleKnowledge?.routing.module_scope, "editing");
  assert.deepEqual(
    projectedRuleKnowledge?.projection_source?.projection_context,
    {
      module: "editing",
      manuscript_type: "clinical_study",
      template_family_id: "family-1",
      journal_template_id: "journal-template-1",
      journal_key: "journal-alpha",
      rule_object: "abstract",
      standard_example: AFTER_HEADING,
      incorrect_example: BEFORE_HEADING,
      not_applicable_boundary: "",
    },
  );
});

test("projection uses explainability and projection payload text when available", async () => {
  const { knowledgeRepository } = await seedPublishedRuleSet();
  const projectedRuleKnowledge = (await knowledgeRepository.list()).find(
    (record) => record.projection_source?.projection_kind === "rule",
  );

  assert.match(
    projectedRuleKnowledge?.summary ?? "",
    /Normalize abstract headings to the configured journal style./i,
  );
  assert.match(
    projectedRuleKnowledge?.canonical_text ?? "",
    /Standard example detail/i,
  );
  assert.match(
    projectedRuleKnowledge?.canonical_text ?? "",
    /Incorrect example/i,
  );
  assert.deepEqual(
    projectedRuleKnowledge?.projection_source?.projection_context,
    {
      module: "editing",
      manuscript_type: "clinical_study",
      template_family_id: "family-1",
      rule_object: "abstract",
      standard_example: AFTER_HEADING,
      incorrect_example: BEFORE_HEADING,
      not_applicable_boundary: "",
      evidence_summary:
        "Abstract headings should use full-width punctuation and spacing in the normalized journal style.",
    },
  );
});

test("publishing a package-compiled rule set projects confirmed semantic rationale, examples, and boundaries", async () => {
  const { knowledgeRepository } = await seedPublishedPackageCompiledRuleSet();
  const projectedRuleKnowledge = (await knowledgeRepository.list()).find(
    (record) => record.projection_source?.projection_kind === "rule",
  );

  assert.match(
    projectedRuleKnowledge?.summary ?? "",
    /Normalize author and corresponding-author blocks\./,
  );
  assert.match(projectedRuleKnowledge?.canonical_text ?? "", /Rationale:/);
  assert.match(
    projectedRuleKnowledge?.canonical_text ?? "",
    /Incorrect example detail: "First author: Zhang San"\./,
  );
  assert.deepEqual(
    projectedRuleKnowledge?.projection_source?.projection_context,
    {
      module: "editing",
      manuscript_type: "clinical_study",
      template_family_id: "family-1",
      journal_template_id: "journal-template-1",
      journal_key: "journal-alpha",
      rule_object: "author_line",
      standard_example: "Author: Zhang San",
      incorrect_example: "First author: Zhang San",
      not_applicable_boundary: "Source metadata is missing.",
      evidence_summary:
        "Normalize author and corresponding-author blocks. Normalize author labels and markers.",
    },
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
