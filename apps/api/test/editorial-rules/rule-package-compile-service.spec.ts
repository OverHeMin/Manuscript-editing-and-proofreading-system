import assert from "node:assert/strict";
import test from "node:test";
import { createEditorialRuleApi } from "../../src/modules/editorial-rules/editorial-rule-api.ts";
import { EditorialRuleResolutionService } from "../../src/modules/editorial-rules/editorial-rule-resolution-service.ts";
import { InMemoryEditorialRuleRepository } from "../../src/modules/editorial-rules/in-memory-editorial-rule-repository.ts";
import { EditorialRuleService } from "../../src/modules/editorial-rules/editorial-rule-service.ts";
import { RulePackageCompileService } from "../../src/modules/editorial-rules/rule-package-compile-service.ts";
import type { TableEvidenceService } from "../../src/modules/table-evidence/table-evidence-service.ts";
import { InMemoryTemplateFamilyRepository } from "../../src/modules/templates/in-memory-template-family-repository.ts";
import type { ConfirmedAiTablePackage, RulePackageDraft } from "@medical/contracts";

function createRulePackageCompileHarness(input: {
  tableEvidenceService?: Pick<TableEvidenceService, "assertConfirmedRevision"> | null;
} = {}) {
  const repository = new InMemoryEditorialRuleRepository();
  const templateFamilyRepository = new InMemoryTemplateFamilyRepository();
  const tableEvidenceService =
    input.tableEvidenceService === null
      ? undefined
      : input.tableEvidenceService ?? {
          assertConfirmedRevision: async (revisionId: string) =>
            ({ id: revisionId }) as never,
        };
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
    ...(tableEvidenceService ? { tableEvidenceService } : {}),
  } as ConstructorParameters<typeof RulePackageCompileService>[0] & {
    tableEvidenceService?: Pick<TableEvidenceService, "assertConfirmedRevision">;
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

function buildThreeLineTablePackageDraft(
  automationPosture: RulePackageDraft["automation_posture"] = "safe_auto",
): RulePackageDraft {
  return {
    package_id: "package-three-line-table",
    package_kind: "three_line_table",
    title: "Three-line table package",
    rule_object: "table",
    suggested_layer: "template_family",
    automation_posture: automationPosture,
    status: "draft",
    cards: {
      rule_what: {
        title: "Three-line table package",
        object: "table",
        publish_layer: "template_family",
      },
      ai_understanding: {
        summary: "Inspect semantic table headers and notes before any promotion.",
        hit_objects: ["table"],
        hit_locations: ["results"],
      },
      applicability: {
        manuscript_types: ["clinical_study"],
        modules: ["editing"],
        sections: ["results"],
        table_targets: ["header_cell"],
      },
      evidence: {
        examples: [
          {
            before: "Treatment group | n (%)",
            after: "Treatment Group | n (%)",
          },
        ],
      },
      exclusions: {
        not_applicable_when: ["Table semantics are not anchored yet."],
        human_review_required_when: ["Review header wording before release."],
        risk_posture: "guarded_auto",
      },
    },
    semantic_draft: {
      semantic_summary: "Inspect semantic table headers and notes before any promotion.",
      hit_scope: ["table:header_cell"],
      applicability: ["results"],
      evidence_examples: [
        {
          before: "Treatment group | n (%)",
          after: "Treatment Group | n (%)",
        },
      ],
      failure_boundaries: ["Table semantics are not anchored yet."],
      normalization_recipe: ["Lock semantic target before auto-apply promotion."],
      review_policy: ["Review header wording before release."],
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
  const titleSeed = preview.packages[0]?.draft_rule_seeds[0];
  const authorLineSeed = preview.packages[0]?.draft_rule_seeds[1];
  assert.equal(titleSeed?.authoring_payload.compatibility_bridge_kind, "legacy_front_matter");
  assert.equal(titleSeed?.authoring_payload.target_block_key, "title");
  assert.equal(authorLineSeed?.authoring_payload.compatibility_bridge_kind, "legacy_front_matter");
  assert.equal(authorLineSeed?.authoring_payload.target_block_key, "author_line");
  assert.equal(authorLineSeed?.authoring_payload.slot_key, "author_line");
  assert.deepEqual(authorLineSeed?.authoring_payload.bridge_shadow_target_block_keys, [
    "affiliation_line",
    "corresponding_author_bio",
  ]);
  assert.deepEqual(authorLineSeed?.authoring_payload.legacy_only_semantic_roles, [
    "author_bio",
    "funding_statement",
    "classification_line",
    "front_matter",
  ]);
  assert.equal(preview.packages[0]?.overrides_published_coverage_keys.length, 1);
  assert.match(preview.packages[0]?.warnings.join(" ") ?? "", /guarded|review/i);
  assert.match(preview.packages[0]?.warnings.join(" ") ?? "", /legacy front-matter bridge/i);
});

test("table package compile preview keeps inspect-only auto-apply metadata by default", async () => {
  const harness = createRulePackageCompileHarness();

  await seedCompileContext(harness);

  const preview = await harness.service.previewCompile({
    source: {
      sourceKind: "reviewed_case",
      reviewedCaseSnapshotId: "reviewed-case-1",
    },
    packageDrafts: [buildThreeLineTablePackageDraft("safe_auto")],
    templateFamilyId: "family-1",
    journalTemplateId: "journal-alpha",
    module: "editing",
  });

  const seed = preview.packages[0]?.draft_rule_seeds[0];
  assert.ok(seed);
  assert.equal(seed.execution_mode, "inspect");
  assert.equal(seed.confidence_policy, "manual_only");
  assert.equal(seed.authoring_payload.grade, "C");
  assert.equal(seed.authoring_payload.patch_type, "inspect_only");
  assert.equal(seed.authoring_payload.apply_scope, "inspect_only");
  assert.deepEqual(seed.authoring_payload.required_snapshot_capabilities, []);
});

test("front-matter compile preview detects overlap through the target-block comparison key even when coverage keys differ", async () => {
  const harness = createRulePackageCompileHarness();

  await seedCompileContext(harness);

  const journalRuleSet = await harness.editorialRuleService.createRuleSet("admin", {
    templateFamilyId: "family-1",
    journalTemplateId: "journal-alpha",
    module: "editing",
  });
  await harness.editorialRuleService.createRule("admin", {
    ruleSetId: journalRuleSet.id,
    orderNo: 10,
    ruleObject: "author_line",
    ruleType: "format",
    executionMode: "apply_and_inspect",
    scope: {
      sections: ["front_matter"],
      block_kind: "author_line",
    },
    selector: {
      target_block_key: "author_line",
    },
    trigger: {
      kind: "slot_resolution",
      slot_key: "author_line",
    },
    action: {
      kind: "inspect_author_line",
      affiliation_format: "superscript_marker",
      corresponding_author_rule: "required",
    },
    authoringPayload: {
      target_block_key: "author_line",
      slot_key: "author_line",
    },
    confidencePolicy: "manual_only",
    severity: "warning",
    enabled: true,
  });
  await harness.editorialRuleService.publishRuleSet("admin", journalRuleSet.id);

  const preview = await harness.service.previewCompile({
    source: {
      sourceKind: "uploaded_example_pair",
      exampleSourceSessionId: "session-demo-structured-front-matter",
    },
    packageDrafts: [buildFrontMatterPackageDraft()],
    templateFamilyId: "family-1",
    journalTemplateId: "journal-alpha",
    module: "editing",
  });

  assert.equal(preview.packages[0]?.overrides_published_coverage_keys.length, 1);
  assert.equal(
    preview.packages[0]?.overrides_published_coverage_keys[0],
    'author_line::{"block_selector":"author_line","section_selector":"front_matter"}::{"kind":"author_line_pattern","separator":"、"}',
  );
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

test("compile-to-draft locks exact table evidence revision ids into rule linkage metadata", async () => {
  const checkedRevisionIds: string[] = [];
  const harness = createRulePackageCompileHarness({
    tableEvidenceService: {
      assertConfirmedRevision: async (revisionId) => {
        checkedRevisionIds.push(revisionId);
        return { id: revisionId } as never;
      },
    },
  });
  await seedCompileContext(harness);

  const packageDraft = buildThreeLineTablePackageDraft();
  attachConfirmedTableEvidenceIntake(packageDraft, [
    {
      revisionId: " rev-locked-1 ",
      assetId: "asset-should-not-be-locked",
    },
    {
      revisionId: "rev-locked-1",
      assetId: "asset-duplicate-should-not-be-locked",
    },
    {
      revisionId: "rev-locked-2",
      assetId: "asset-should-not-be-locked-2",
    },
  ]);

  const result = await harness.service.compileToDraft({
    actorRole: "admin",
    source: {
      sourceKind: "reviewed_case",
      reviewedCaseSnapshotId: "reviewed-case-1",
    },
    packageDrafts: [packageDraft],
    templateFamilyId: "family-1",
    journalTemplateId: "journal-alpha",
    module: "editing",
  });

  const rules = await harness.repository.listRulesByRuleSetId(result.rule_set_id);

  assert.equal(rules.length, 1);
  assert.deepEqual(rules[0]?.linkage_payload?.table_evidence_revision_ids, [
    "rev-locked-1",
    "rev-locked-2",
  ]);
  assert.deepEqual(checkedRevisionIds, ["rev-locked-1", "rev-locked-2"]);
  assert.notDeepEqual(rules[0]?.linkage_payload?.table_evidence_revision_ids, [
    "asset-should-not-be-locked",
    "asset-should-not-be-locked-2",
  ]);
});

test("compile-to-draft rejects blank table evidence revision ids before lookup", async () => {
  const checkedRevisionIds: string[] = [];
  const harness = createRulePackageCompileHarness({
    tableEvidenceService: {
      assertConfirmedRevision: async (revisionId) => {
        checkedRevisionIds.push(revisionId);
        return { id: revisionId } as never;
      },
    },
  });
  await seedCompileContext(harness);

  const packageDraft = buildThreeLineTablePackageDraft();
  attachConfirmedTableEvidenceIntake(packageDraft, [
    {
      revisionId: "   ",
      assetId: "asset-blank",
    },
  ]);

  await assert.rejects(
    () =>
      harness.service.compileToDraft({
        actorRole: "admin",
        source: {
          sourceKind: "reviewed_case",
          reviewedCaseSnapshotId: "reviewed-case-1",
        },
        packageDrafts: [packageDraft],
        templateFamilyId: "family-1",
        journalTemplateId: "journal-alpha",
        module: "editing",
      }),
    /table_evidence_revision_id_invalid/u,
  );
  assert.deepEqual(checkedRevisionIds, []);
});

test("compile-to-draft rejects linked table evidence revisions without a confirmation dependency", async () => {
  const harness = createRulePackageCompileHarness({
    tableEvidenceService: null,
  });
  await seedCompileContext(harness);

  const packageDraft = buildThreeLineTablePackageDraft();
  attachConfirmedTableEvidenceIntake(packageDraft, [
    {
      revisionId: "rev-linked-without-dependency",
      assetId: "asset-1",
    },
  ]);

  await assert.rejects(
    () =>
      harness.service.compileToDraft({
        actorRole: "admin",
        source: {
          sourceKind: "reviewed_case",
          reviewedCaseSnapshotId: "reviewed-case-1",
        },
        packageDrafts: [packageDraft],
        templateFamilyId: "family-1",
        journalTemplateId: "journal-alpha",
        module: "editing",
      }),
    /table_evidence_revision_not_confirmed/u,
  );
});

test("compile-to-draft rejects linked table evidence revisions that are not confirmed", async () => {
  const checkedRevisionIds: string[] = [];
  const harness = createRulePackageCompileHarness({
    tableEvidenceService: {
      assertConfirmedRevision: async (revisionId) => {
        checkedRevisionIds.push(revisionId);
        throw new Error("revision is pending");
      },
    },
  });
  await seedCompileContext(harness);

  const packageDraft = buildThreeLineTablePackageDraft();
  attachConfirmedTableEvidenceIntake(packageDraft, [
    {
      revisionId: "rev-pending-compile",
      assetId: "asset-1",
    },
  ]);

  await assert.rejects(
    () =>
      harness.service.compileToDraft({
        actorRole: "admin",
        source: {
          sourceKind: "reviewed_case",
          reviewedCaseSnapshotId: "reviewed-case-1",
        },
        packageDrafts: [packageDraft],
        templateFamilyId: "family-1",
        journalTemplateId: "journal-alpha",
        module: "editing",
      }),
    /table_evidence_revision_not_confirmed/u,
  );
  assert.deepEqual(checkedRevisionIds, ["rev-pending-compile"]);
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

function attachConfirmedTableEvidenceIntake(
  packageDraft: RulePackageDraft,
  revisions: Array<{ revisionId: string; assetId: string }>,
): void {
  packageDraft.ai_intake_metadata = {
    source_kind: "manual_description",
    ai_understanding_summary: "Table header units preserve confirmed table package evidence.",
    recommended_governance_layer: "template_family",
    target_object: "table",
    trigger: "confirmed table header",
    action: "inspect exact table header unit style",
    scope: {
      module_scope: "editing",
      manuscript_types: ["clinical_study"],
      sections: ["results"],
    },
    evidence: revisions.map(({ revisionId, assetId }) => ({
      kind: "confirmed_table_package",
      source_id: assetId,
      authority: "authoritative",
      confirmed_table_package: buildConfirmedTablePackage({
        revisionId,
        assetId,
      }),
    })),
    confidence: {
      overall: 0.98,
    },
    uncertainties: [],
  };
}

function buildConfirmedTablePackage(input: {
  revisionId: string;
  assetId: string;
}): ConfirmedAiTablePackage {
  return {
    package_id: `pkg-${input.revisionId}`,
    asset_id: input.assetId,
    revision_id: input.revisionId,
    revision_no: 1,
    source_file_asset_id: "file-1",
    authority: "authoritative",
    confirmation_status: "confirmed",
    fidelity_status: "confirmed",
    confirmed_by_human: true,
    parser: "python_docx_ooxml",
    parser_version: "table-evidence-v1",
    source_snapshot_hash: "sha256-source",
    confirmed_snapshot_hash: "sha256-confirmed",
    ai_table_package_hash: "sha256-package",
    notes: [],
    structure: {
      row_count: 1,
      column_count: 1,
      header_depth: 1,
      merged_cells: [],
    },
    cells: [
      {
        cell_id: "cell-1",
        row: 0,
        column: 0,
        rowspan: 1,
        colspan: 1,
        role: "header",
        text: "Hcy (umol L-1)",
        codepoints: [],
        paragraphs: [],
        runs: [],
        header_path: ["Hcy (umol L-1)"],
        row_header_path: [],
        column_header_path: ["Hcy (umol L-1)"],
        invisible_chars: [],
        style_summary: {
          script_positions: ["baseline", "superscript"],
        },
      },
    ],
    fidelity_report: {
      status: "confirmed",
      failure_codes: [],
      unsupported_fact_groups: [],
      required_confirmations: [],
      invisible_chars_confirmed: true,
      special_symbols_confirmed: true,
    },
  };
}
