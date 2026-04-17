import assert from "node:assert/strict";
import test from "node:test";
import { createEditorialRuleApi } from "../../src/modules/editorial-rules/editorial-rule-api.ts";
import { EditorialRuleResolutionService } from "../../src/modules/editorial-rules/editorial-rule-resolution-service.ts";
import { InMemoryEditorialRuleRepository } from "../../src/modules/editorial-rules/in-memory-editorial-rule-repository.ts";
import { EditorialRuleService } from "../../src/modules/editorial-rules/editorial-rule-service.ts";
import { RulePackageCompileService } from "../../src/modules/editorial-rules/rule-package-compile-service.ts";
import { InMemoryTemplateFamilyRepository } from "../../src/modules/templates/in-memory-template-family-repository.ts";
import type { RulePackageDraft } from "@medical/contracts";

function createRulePackageCompileHarness() {
  const repository = new InMemoryEditorialRuleRepository();
  const templateFamilyRepository = new InMemoryTemplateFamilyRepository();
  const editorialRuleService = new EditorialRuleService({
    repository,
    templateFamilyRepository,
    createId: (() => {
      const ids = [
        "rule-set-1",
        "rule-1",
        "rule-set-2",
        "rule-2",
        "rule-set-3",
        "rule-3",
      ];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a compile-service id.");
        return value;
      };
    })(),
  });
  const resolutionService = new EditorialRuleResolutionService({
    repository,
  });
  const service = new RulePackageCompileService({
    repository,
    editorialRuleService,
    resolutionService,
  });

  return {
    repository,
    templateFamilyRepository,
    editorialRuleService,
    service,
  };
}

function buildFrontMatterPackageDraft(): RulePackageDraft {
  return {
    package_id: "package-front-matter",
    package_kind: "front_matter",
    title: "前置信息包",
    rule_object: "front_matter",
    suggested_layer: "journal_template",
    automation_posture: "guarded_auto",
    status: "draft",
    cards: {
      rule_what: {
        title: "前置信息包",
        object: "front_matter",
        publish_layer: "journal_template",
      },
      ai_understanding: {
        summary: "统一作者、单位与通信作者块。",
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
            before: "第一作者：张三",
            after: "（作者简介）张三",
          },
        ],
      },
      exclusions: {
        not_applicable_when: ["原稿元数据缺失"],
        human_review_required_when: ["新增通信作者"],
        risk_posture: "guarded_auto",
      },
    },
    semantic_draft: {
      semantic_summary: "统一作者、单位与通信作者块。",
      hit_scope: ["author_line:text_style_normalization"],
      applicability: ["front_matter"],
      evidence_examples: [
        {
          before: "第一作者：张三",
          after: "（作者简介）张三",
        },
      ],
      failure_boundaries: ["原稿元数据缺失"],
      normalization_recipe: ["统一作者与通信作者标签"],
      review_policy: ["新增通信作者时人工复核"],
      confirmed_fields: ["summary", "applicability", "evidence", "boundaries"],
    },
    supporting_signals: [],
  };
}

function buildKnowledgeProjectionPackageDraft(): RulePackageDraft {
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

function buildTerminologyPackageDraft(): RulePackageDraft {
  return {
    package_id: "package-terminology",
    package_kind: "terminology",
    title: "Terminology package",
    rule_object: "terminology",
    suggested_layer: "template_family",
    automation_posture: "guarded_auto",
    status: "draft",
    cards: {
      rule_what: {
        title: "Terminology package",
        object: "terminology",
        publish_layer: "template_family",
      },
      ai_understanding: {
        summary: "Normalize preferred medical terminology in the abstract.",
        hit_objects: ["terminology"],
        hit_locations: ["abstract"],
      },
      applicability: {
        manuscript_types: ["clinical_study"],
        modules: ["editing"],
        sections: ["abstract"],
        table_targets: [],
      },
      evidence: {
        examples: [
          {
            before: "中性粒细胞明胶酶相关脂质运载蛋白",
            after: "NGAL",
          },
        ],
      },
      exclusions: {
        not_applicable_when: ["Term replacement changes the manuscript meaning."],
        human_review_required_when: ["Review abbreviations before publish."],
        risk_posture: "guarded_auto",
      },
    },
    semantic_draft: {
      semantic_summary: "Normalize preferred medical terminology in the abstract.",
      hit_scope: ["terminology:text_style_normalization"],
      applicability: ["abstract"],
      evidence_examples: [
        {
          before: "中性粒细胞明胶酶相关脂质运载蛋白",
          after: "NGAL",
        },
      ],
      failure_boundaries: ["Term replacement changes the manuscript meaning."],
      normalization_recipe: ["Replace non-preferred variants with approved terms."],
      review_policy: ["Review abbreviations before publish."],
      confirmed_fields: ["summary", "applicability", "evidence", "boundaries"],
    },
    supporting_signals: [],
  };
}

function buildStatementPackageDraft(): RulePackageDraft {
  return {
    package_id: "package-statement",
    package_kind: "statement",
    title: "Statement package",
    rule_object: "statement",
    suggested_layer: "template_family",
    automation_posture: "inspect_only",
    status: "draft",
    cards: {
      rule_what: {
        title: "Statement package",
        object: "statement",
        publish_layer: "template_family",
      },
      ai_understanding: {
        summary: "Inspect required back-matter statements for completeness.",
        hit_objects: ["statement"],
        hit_locations: ["back_matter"],
      },
      applicability: {
        manuscript_types: ["clinical_study"],
        modules: ["editing"],
        sections: ["back_matter"],
        table_targets: [],
      },
      evidence: {
        examples: [
          {
            before: "",
            after: "伦理声明：本研究已通过医院伦理委员会审批。",
          },
        ],
      },
      exclusions: {
        not_applicable_when: ["The manuscript type does not require the statement."],
        human_review_required_when: ["Review statement wording before release."],
        risk_posture: "inspect_only",
      },
    },
    semantic_draft: {
      semantic_summary: "Inspect required back-matter statements for completeness.",
      hit_scope: ["statement:inserted_block"],
      applicability: ["back_matter"],
      evidence_examples: [
        {
          before: "",
          after: "伦理声明：本研究已通过医院伦理委员会审批。",
        },
      ],
      failure_boundaries: ["The manuscript type does not require the statement."],
      normalization_recipe: ["Check required statement presence and placement."],
      review_policy: ["Review statement wording before release."],
      confirmed_fields: ["summary", "applicability", "evidence", "boundaries"],
    },
    supporting_signals: [],
  };
}

function buildManuscriptStructurePackageDraft(): RulePackageDraft {
  return {
    package_id: "package-manuscript-structure",
    package_kind: "manuscript_structure",
    title: "Manuscript structure package",
    rule_object: "manuscript_structure",
    suggested_layer: "template_family",
    automation_posture: "inspect_only",
    status: "draft",
    cards: {
      rule_what: {
        title: "Manuscript structure package",
        object: "manuscript_structure",
        publish_layer: "template_family",
      },
      ai_understanding: {
        summary: "Inspect required section completeness and order.",
        hit_objects: ["manuscript_structure"],
        hit_locations: ["section_outline"],
      },
      applicability: {
        manuscript_types: ["clinical_study"],
        modules: ["editing"],
        sections: ["body"],
        table_targets: [],
      },
      evidence: {
        examples: [
          {
            before: "摘要 > 结果 > 讨论",
            after: "摘要 > 材料与方法 > 结果 > 讨论",
          },
        ],
      },
      exclusions: {
        not_applicable_when: ["The article type does not follow a fixed IMRAD structure."],
        human_review_required_when: ["Review section order before publish."],
        risk_posture: "inspect_only",
      },
    },
    semantic_draft: {
      semantic_summary: "Inspect required section completeness and order.",
      hit_scope: ["manuscript_structure:text_style_normalization"],
      applicability: ["body"],
      evidence_examples: [
        {
          before: "摘要 > 结果 > 讨论",
          after: "摘要 > 材料与方法 > 结果 > 讨论",
        },
      ],
      failure_boundaries: ["The article type does not follow a fixed IMRAD structure."],
      normalization_recipe: ["Check section completeness and expected order."],
      review_policy: ["Review section order before publish."],
      confirmed_fields: ["summary", "applicability", "evidence", "boundaries"],
    },
    supporting_signals: [],
  };
}

async function seedCompileContext(
  harness: ReturnType<typeof createRulePackageCompileHarness>,
) {
  await harness.templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical Study Family",
    status: "active",
  });
  await harness.templateFamilyRepository.saveJournalTemplateProfile({
    id: "journal-alpha",
    template_family_id: "family-1",
    journal_key: "journal-alpha",
    journal_name: "Journal Alpha",
    status: "active",
  });
}

test("ready front-matter packages compile into title and author-line seeds with override explanations", async () => {
  const harness = createRulePackageCompileHarness();

  await harness.templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical Study Family",
    status: "active",
  });
  await harness.templateFamilyRepository.saveJournalTemplateProfile({
    id: "journal-alpha",
    template_family_id: "family-1",
    journal_key: "journal-alpha",
    journal_name: "Journal Alpha",
    status: "active",
  });

  const baseRuleSet = await harness.editorialRuleService.createRuleSet("admin", {
    templateFamilyId: "family-1",
    module: "editing",
  });
  await harness.editorialRuleService.createRule("admin", {
    ruleSetId: baseRuleSet.id,
    orderNo: 10,
    ruleObject: "author_line",
    ruleType: "format",
    executionMode: "apply_and_inspect",
    scope: {
      sections: ["front_matter"],
      block_kind: "author_line",
    },
    selector: {
      section_selector: "front_matter",
      block_selector: "author_line",
    },
    trigger: {
      kind: "author_line_pattern",
      separator: "、",
    },
    action: {
      kind: "inspect_author_line",
      affiliation_format: "superscript_marker",
      corresponding_author_rule: "required",
    },
    authoringPayload: {
      source: "base-rule",
    },
    confidencePolicy: "manual_only",
    severity: "warning",
    enabled: true,
  });
  await harness.editorialRuleService.publishRuleSet("admin", baseRuleSet.id);

  const preview = await harness.service.previewCompile({
    source: {
      sourceKind: "uploaded_example_pair",
      exampleSourceSessionId: "session-demo-1",
    },
    packageDrafts: [buildFrontMatterPackageDraft()],
    templateFamilyId: "family-1",
    journalTemplateId: "journal-alpha",
    module: "editing",
  });

  assert.equal(preview.packages.length, 1);
  assert.equal(preview.packages[0]?.readiness.status, "ready");
  assert.deepEqual(
    preview.packages[0]?.draft_rule_seeds.map((seed) => seed.rule_object),
    ["title", "author_line"],
  );
  assert.equal(preview.packages[0]?.overrides_published_coverage_keys.length, 1);
  assert.match(preview.packages[0]?.warnings.join(" ") ?? "", /guarded|review/i);
});

test("compile-to-draft writes compiled rules into a draft rule set without mutating published rule sets", async () => {
  const harness = createRulePackageCompileHarness();

  await harness.templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical Study Family",
    status: "active",
  });
  await harness.templateFamilyRepository.saveJournalTemplateProfile({
    id: "journal-alpha",
    template_family_id: "family-1",
    journal_key: "journal-alpha",
    journal_name: "Journal Alpha",
    status: "active",
  });

  const result = await harness.service.compileToDraft({
    actorRole: "admin",
    source: {
      sourceKind: "reviewed_case",
      reviewedCaseSnapshotId: "reviewed-case-snapshot-demo-1",
    },
    packageDrafts: [buildFrontMatterPackageDraft()],
    templateFamilyId: "family-1",
    journalTemplateId: "journal-alpha",
    module: "editing",
  });

  assert.equal(result.created_rule_ids.length, 2);
  assert.equal(result.replaced_rule_ids.length, 0);
  assert.equal(result.skipped_packages.length, 0);

  const ruleSets = await harness.repository.listRuleSets();
  const createdRuleSet = ruleSets.find((ruleSet) => ruleSet.id === result.rule_set_id);
  assert.equal(createdRuleSet?.status, "draft");

  const rules = await harness.repository.listRulesByRuleSetId(result.rule_set_id);
  assert.equal(rules.length, 2);
  assert.deepEqual(
    rules.map((rule) => rule.rule_object),
    ["title", "author_line"],
  );
  assert.ok(
    rules.every((rule) => rule.authoring_payload["source"] === "rule_package_compile"),
  );
  assert.equal(
    ruleSets.filter((ruleSet) => ruleSet.status === "published").length,
    0,
  );
});

test("compile-to-draft reuses the selected editable draft rule set and reports target_mode", async () => {
  const harness = createRulePackageCompileHarness();

  await harness.templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical Study Family",
    status: "active",
  });
  await harness.templateFamilyRepository.saveJournalTemplateProfile({
    id: "journal-alpha",
    template_family_id: "family-1",
    journal_key: "journal-alpha",
    journal_name: "Journal Alpha",
    status: "active",
  });

  const selectedDraft = await harness.editorialRuleService.createRuleSet("admin", {
    templateFamilyId: "family-1",
    journalTemplateId: "journal-alpha",
    module: "editing",
  });

  const result = await harness.service.compileToDraft({
    actorRole: "admin",
    targetRuleSetId: selectedDraft.id,
    source: {
      sourceKind: "uploaded_example_pair",
      exampleSourceSessionId: "session-demo-1",
    },
    packageDrafts: [buildFrontMatterPackageDraft()],
    templateFamilyId: "family-1",
    journalTemplateId: "journal-alpha",
    module: "editing",
  });

  assert.equal(result.rule_set_id, selectedDraft.id);
  assert.equal(result.target_mode, "reused_selected_draft");
});

test("compile-to-draft reports blocked publish readiness when packages are skipped", async () => {
  const harness = createRulePackageCompileHarness();

  await harness.templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical Study Family",
    status: "active",
  });

  const unconfirmedPackageDraft = buildFrontMatterPackageDraft();
  unconfirmedPackageDraft.semantic_draft = {
    ...unconfirmedPackageDraft.semantic_draft!,
    confirmed_fields: ["summary"],
  };

  const result = await harness.service.compileToDraft({
    actorRole: "admin",
    source: {
      sourceKind: "uploaded_example_pair",
      exampleSourceSessionId: "session-demo-1",
    },
    packageDrafts: [unconfirmedPackageDraft],
    templateFamilyId: "family-1",
    module: "editing",
  });

  assert.equal(result.publish_readiness.status, "blocked");
  assert.equal(result.publish_readiness.blocked_package_count, 1);
  assert.equal(result.publish_readiness.override_count, 0);
  assert.equal(result.publish_readiness.guarded_rule_count, 0);
  assert.equal(result.publish_readiness.inspect_rule_count, 0);
});

test("compile-to-draft writes confirmed semantic fields into explanation, projection, linkage, and evidence metadata", async () => {
  const harness = createRulePackageCompileHarness();
  await seedCompileContext(harness);

  const packageDraft = buildKnowledgeProjectionPackageDraft();
  const result = await harness.service.compileToDraft({
    actorRole: "admin",
    source: {
      sourceKind: "uploaded_example_pair",
      exampleSourceSessionId: "session-demo-1",
    },
    packageDrafts: [packageDraft],
    templateFamilyId: "family-1",
    journalTemplateId: "journal-alpha",
    module: "editing",
  });

  const rules = await harness.repository.listRulesByRuleSetId(result.rule_set_id);
  assert.equal(rules.length, 2);
  assert.deepEqual(result.projection_readiness.projected_kinds, [
    "rule",
    "checklist",
    "prompt_snippet",
  ]);
  assert.deepEqual(result.projection_readiness.confirmed_semantic_fields, [
    "summary",
    "applicability",
    "evidence",
    "boundaries",
  ]);
  assert.deepEqual(result.projection_readiness.withheld_semantic_fields, []);
  assert.ok(
    rules.every(
      (rule) =>
        rule.projection_payload?.summary ===
        "Normalize author and corresponding-author blocks.",
    ),
  );
  assert.ok(
    rules.every((rule) => rule.projection_payload?.standard_example === "Author: Zhang San"),
  );
  assert.ok(
    rules.every((rule) => rule.projection_payload?.incorrect_example === "First author: Zhang San"),
  );
  assert.ok(
    rules.every((rule) => rule.explanation_payload?.incorrect_example === "First author: Zhang San"),
  );
  assert.ok(
    rules.every((rule) => rule.explanation_payload?.correct_example === "Author: Zhang San"),
  );
  for (const rule of rules) {
    assert.deepEqual(rule.explanation_payload?.not_applies_when, [
      "Source metadata is missing.",
    ]);
  }
  assert.ok(
    rules.every(
      (rule) =>
        rule.linkage_payload?.source_learning_candidate_id ===
        "package-front-matter-knowledge",
    ),
  );
  assert.ok(
    rules.every((rule) => rule.linkage_payload?.source_snapshot_asset_id === "session-demo-1"),
  );
  assert.ok(rules.every((rule) => rule.evidence_level === "low"));
});

test("compile-to-draft keeps unconfirmed boundaries out of high-confidence projection metadata", async () => {
  const harness = createRulePackageCompileHarness();
  await seedCompileContext(harness);

  const packageDraft = buildKnowledgeProjectionPackageDraft();
  packageDraft.semantic_draft = {
    ...packageDraft.semantic_draft!,
    confirmed_fields: ["summary", "applicability", "evidence"],
  };

  const result = await harness.service.compileToDraft({
    actorRole: "admin",
    source: {
      sourceKind: "uploaded_example_pair",
      exampleSourceSessionId: "session-demo-1",
    },
    packageDrafts: [packageDraft],
    templateFamilyId: "family-1",
    journalTemplateId: "journal-alpha",
    module: "editing",
  });

  const rules = await harness.repository.listRulesByRuleSetId(result.rule_set_id);
  assert.equal(rules.length, 2);
  assert.deepEqual(result.projection_readiness.projected_kinds, [
    "rule",
    "checklist",
    "prompt_snippet",
  ]);
  assert.deepEqual(result.projection_readiness.confirmed_semantic_fields, [
    "summary",
    "applicability",
    "evidence",
  ]);
  assert.deepEqual(result.projection_readiness.withheld_semantic_fields, [
    "boundaries",
  ]);
  assert.ok(
    rules.every((rule) => rule.projection_payload?.incorrect_example === "First author: Zhang San"),
  );
  assert.ok(
    rules.every((rule) => rule.explanation_payload?.not_applies_when === undefined),
  );
  assert.ok(rules.every((rule) => rule.evidence_level === "unknown"));
});

test("editorial rule api exposes compile preview and compile-to-draft through the existing governance surface", async () => {
  const harness = createRulePackageCompileHarness();
  const api = createEditorialRuleApi({
    editorialRuleService: harness.editorialRuleService,
    rulePackageCompileService: harness.service,
  });

  await harness.templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical Study Family",
    status: "active",
  });

  const preview = await api.previewRulePackageCompile({
    input: {
      source: {
        sourceKind: "uploaded_example_pair",
        exampleSourceSessionId: "session-demo-1",
      },
      packageDrafts: [buildFrontMatterPackageDraft()],
      templateFamilyId: "family-1",
      module: "editing",
    },
  });

  assert.equal(preview.status, 200);
  assert.equal(preview.body.packages[0]?.readiness.status, "ready");

  const compile = await api.compileRulePackagesToDraft({
    input: {
      actorRole: "admin",
      source: {
        sourceKind: "uploaded_example_pair",
        exampleSourceSessionId: "session-demo-1",
      },
      packageDrafts: [buildFrontMatterPackageDraft()],
      templateFamilyId: "family-1",
      module: "editing",
    },
  });

  assert.equal(compile.status, 200);
  assert.equal(compile.body.created_rule_ids.length, 2);
});

test("terminology, statement, and manuscript-structure packages compile into dedicated rule objects", async () => {
  const harness = createRulePackageCompileHarness();
  await seedCompileContext(harness);

  const preview = await harness.service.previewCompile({
    source: {
      sourceKind: "uploaded_example_pair",
      exampleSourceSessionId: "session-demo-1",
    },
    packageDrafts: [
      buildTerminologyPackageDraft(),
      buildStatementPackageDraft(),
      buildManuscriptStructurePackageDraft(),
    ],
    templateFamilyId: "family-1",
    journalTemplateId: "journal-alpha",
    module: "editing",
  });

  assert.deepEqual(
    preview.packages.map((entry) => entry.readiness.status),
    ["ready", "ready_with_downgrade", "ready_with_downgrade"],
  );

  const result = await harness.service.compileToDraft({
    actorRole: "admin",
    source: {
      sourceKind: "uploaded_example_pair",
      exampleSourceSessionId: "session-demo-1",
    },
    packageDrafts: [
      buildTerminologyPackageDraft(),
      buildStatementPackageDraft(),
      buildManuscriptStructurePackageDraft(),
    ],
    templateFamilyId: "family-1",
    journalTemplateId: "journal-alpha",
    module: "editing",
  });

  const rules = await harness.repository.listRulesByRuleSetId(result.rule_set_id);
  assert.equal(result.created_rule_ids.length, 3);
  assert.deepEqual(
    rules.map((rule) => rule.rule_object),
    ["terminology", "statement", "manuscript_structure"],
  );
  assert.equal(rules[0]?.execution_mode, "apply_and_inspect");
  assert.equal(rules[1]?.execution_mode, "inspect");
  assert.equal(rules[2]?.execution_mode, "inspect");
});
