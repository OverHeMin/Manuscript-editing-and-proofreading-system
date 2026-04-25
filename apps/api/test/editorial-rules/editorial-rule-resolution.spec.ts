import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryEditorialRuleRepository } from "../../src/modules/editorial-rules/in-memory-editorial-rule-repository.ts";
import { EditorialRuleResolutionService } from "../../src/modules/editorial-rules/editorial-rule-resolution-service.ts";

const BEFORE_HEADING = "\u6458\u8981 \u76ee\u7684";
const BASE_AFTER_HEADING = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09";
const JOURNAL_AFTER_HEADING = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09\uff1a";

test("resolution returns only base published rules when no journal template is selected", async () => {
  const repository = new InMemoryEditorialRuleRepository();
  const service = new EditorialRuleResolutionService({
    repository,
  });

  await seedPublishedRuleScopes(repository);

  const resolved = await service.resolve({
    templateFamilyId: "family-1",
    module: "editing",
  });

  assert.equal(resolved.baseRuleSet?.id, "base-rule-set");
  assert.equal(resolved.journalRuleSet, undefined);
  assert.deepEqual(
    resolved.rules.map((rule) => rule.id),
    ["base-rule-abstract", "base-rule-discussion"],
  );
});

test("resolution overlays journal rules on top of base rules and keeps non-conflicting rules from both scopes", async () => {
  const repository = new InMemoryEditorialRuleRepository();
  const service = new EditorialRuleResolutionService({
    repository,
  });

  await seedPublishedRuleScopes(repository);

  const resolved = await service.resolve({
    templateFamilyId: "family-1",
    module: "editing",
    journalTemplateId: "journal-template-1",
  });

  assert.equal(resolved.baseRuleSet?.id, "base-rule-set");
  assert.equal(resolved.journalRuleSet?.id, "journal-rule-set");
  assert.deepEqual(
    resolved.rules.map((rule) => rule.id),
    ["journal-rule-abstract", "base-rule-discussion", "journal-rule-table"],
  );
});

test("resolution prefers the journal rule when object selector and trigger key conflict with the base rule", async () => {
  const repository = new InMemoryEditorialRuleRepository();
  const service = new EditorialRuleResolutionService({
    repository,
  });

  await seedPublishedRuleScopes(repository);

  const resolved = await service.resolve({
    templateFamilyId: "family-1",
    module: "editing",
    journalTemplateId: "journal-template-1",
  });
  const abstractRule = resolved.rules.find(
    (rule) => rule.rule_object === "abstract",
  );

  assert.equal(abstractRule?.id, "journal-rule-abstract");
  assert.equal(abstractRule?.action.to, JOURNAL_AFTER_HEADING);
});

test("resolution reports override metadata, coverage keys, and execution posture for resolved rules", async () => {
  const repository = new InMemoryEditorialRuleRepository();
  const service = new EditorialRuleResolutionService({
    repository,
  });

  await seedPublishedRuleScopes(repository);

  const resolved = await service.resolve({
    templateFamilyId: "family-1",
    module: "editing",
    journalTemplateId: "journal-template-1",
  });
  const abstractRule = resolved.resolved_rules.find(
    (entry) => entry.rule.id === "journal-rule-abstract",
  );
  const tableRule = resolved.resolved_rules.find(
    (entry) => entry.rule.id === "journal-rule-table",
  );

  assert.deepEqual(resolved.overrides, [
    {
      active_rule_id: "journal-rule-abstract",
      overridden_rule_id: "base-rule-abstract",
      reason: 'Journal template override matched coverage key "abstract::{"label_selector":{"text":"摘要 目的"},"section_selector":"abstract"}::{"kind":"exact_text","text":"摘要 目的"}".',
    },
  ]);
  assert.equal(abstractRule?.source_layer, "journal");
  assert.deepEqual(abstractRule?.overridden_rule_ids, ["base-rule-abstract"]);
  assert.equal(
    abstractRule?.coverage_key,
    'abstract::{"label_selector":{"text":"摘要 目的"},"section_selector":"abstract"}::{"kind":"exact_text","text":"摘要 目的"}',
  );
  assert.match(abstractRule?.resolution_reason ?? "", /journal template override/i);
  assert.equal(abstractRule?.execution_posture, "guarded");
  assert.equal(tableRule?.execution_posture, "inspect_only");
});

test("resolution exposes rule-center automation governance metadata for table rebuild rules", async () => {
  const repository = new InMemoryEditorialRuleRepository();
  const service = new EditorialRuleResolutionService({
    repository,
  });

  await seedPublishedRuleScopes(repository);

  const resolved = await service.resolve({
    templateFamilyId: "family-1",
    module: "editing",
    journalTemplateId: "journal-template-1",
  });
  const tableRule = resolved.resolved_rules.find(
    (entry) => entry.rule.id === "journal-rule-table",
  );

  assert.equal(tableRule?.rule.rule_domain, "table");
  assert.deepEqual(tableRule?.rule.structured_action, {
    kind: "full_table_rebuild",
    target: "journal_target_table_model",
    requires_validation: true,
  });
  assert.equal(tableRule?.rule.automation_grade, "A");
  assert.equal(tableRule?.rule.scope_layer, "journal");
  assert.deepEqual(tableRule?.rule.linkage_payload, {
    evidence_package_ids: ["evidence-package-table-1"],
    target_model_block_ids: ["journal_target_table_model"],
  });
  assert.deepEqual(tableRule?.rule.gold_sample_gate, {
    status: "passed",
    specimen_ids: ["gold-table-specimen-1"],
    validation_snapshot_ids: ["validation-table-snapshot-1"],
  });
  assert.equal(
    tableRule?.governance_explanation,
    "Rule domain table, scope layer journal, automation grade A, action full_table_rebuild, gold sample gate passed.",
  );
});

test("resolution defaults legacy rules to guarded inspect-only governance explanation", async () => {
  const repository = new InMemoryEditorialRuleRepository();
  const service = new EditorialRuleResolutionService({
    repository,
  });

  await seedPublishedRuleScopes(repository);

  const resolved = await service.resolve({
    templateFamilyId: "family-1",
    module: "editing",
  });
  const discussionRule = resolved.resolved_rules.find(
    (entry) => entry.rule.id === "base-rule-discussion",
  );

  assert.equal(
    discussionRule?.governance_explanation,
    "Rule domain front_matter, scope layer general, automation grade C, action inspect_only, gold sample gate not_required.",
  );
});

test("repository cloning preserves structured governance payloads without sharing references", async () => {
  const repository = new InMemoryEditorialRuleRepository();

  await seedPublishedRuleScopes(repository);
  const loaded = await repository.findRuleById("journal-rule-table");
  assert.ok(loaded);

  loaded.structured_action = {
    kind: "inspect_only",
    requires_validation: false,
  };
  loaded.gold_sample_gate = {
    status: "failed",
    failure_reasons: ["mutated local copy"],
  };

  const loadedAgain = await repository.findRuleById("journal-rule-table");

  assert.deepEqual(loadedAgain?.structured_action, {
    kind: "full_table_rebuild",
    target: "journal_target_table_model",
    requires_validation: true,
  });
  assert.deepEqual(loadedAgain?.gold_sample_gate, {
    status: "passed",
    specimen_ids: ["gold-table-specimen-1"],
    validation_snapshot_ids: ["validation-table-snapshot-1"],
  });
});

test("resolution keeps the earliest same-layer rule when duplicate coverage keys appear in one published scope", async () => {
  const repository = new InMemoryEditorialRuleRepository();
  const service = new EditorialRuleResolutionService({
    repository,
  });

  await seedPublishedRuleScopes(repository);
  await repository.saveRule({
    id: "base-rule-abstract-duplicate",
    rule_set_id: "base-rule-set",
    order_no: 40,
    rule_object: "abstract",
    rule_type: "format",
    execution_mode: "apply",
    scope: {
      sections: ["abstract"],
      block_kind: "heading",
    },
    selector: {
      section_selector: "abstract",
      label_selector: { text: BEFORE_HEADING },
    },
    trigger: {
      kind: "exact_text",
      text: BEFORE_HEADING,
    },
    action: {
      kind: "replace_heading",
      to: BASE_AFTER_HEADING,
    },
    authoring_payload: {},
    confidence_policy: "always_auto",
    severity: "error",
    enabled: true,
  });

  const resolved = await service.resolve({
    templateFamilyId: "family-1",
    module: "editing",
  });

  assert.deepEqual(
    resolved.rules.map((rule) => rule.id),
    ["base-rule-abstract", "base-rule-discussion"],
  );
  assert.deepEqual(
    resolved.overrides.find(
      (entry) => entry.overridden_rule_id === "base-rule-abstract-duplicate",
    ),
    {
      active_rule_id: "base-rule-abstract",
      overridden_rule_id: "base-rule-abstract-duplicate",
      reason: 'Same-layer conflict retained the earliest rule for coverage key "abstract::{"label_selector":{"text":"摘要 目的"},"section_selector":"abstract"}::{"kind":"exact_text","text":"摘要 目的"}".',
    },
  );
});

test("resolution uses table semantic selectors as coverage keys for journal overrides", async () => {
  const repository = new InMemoryEditorialRuleRepository();
  const service = new EditorialRuleResolutionService({
    repository,
  });

  await seedPublishedRuleScopes(repository);
  await repository.saveRule({
    id: "base-rule-table-header",
    rule_set_id: "base-rule-set",
    order_no: 25,
    rule_object: "table",
    rule_type: "format",
    execution_mode: "inspect",
    scope: {
      sections: ["results"],
    },
    selector: {
      semantic_target: "header_cell",
      header_path_includes: ["Treatment group", "n (%)"],
    },
    trigger: {
      kind: "table_shape",
      layout: "three_line_table",
    },
    action: {
      kind: "emit_finding",
      message: "Base table header semantics should stay normalized.",
    },
    authoring_payload: {},
    confidence_policy: "manual_only",
    severity: "warning",
    enabled: true,
  });
  await repository.saveRule({
    id: "journal-rule-table-header",
    rule_set_id: "journal-rule-set",
    order_no: 35,
    rule_object: "table",
    rule_type: "format",
    execution_mode: "inspect",
    scope: {
      sections: ["results"],
    },
    selector: {
      semantic_target: "header_cell",
      header_path_includes: ["Treatment group", "n (%)"],
    },
    trigger: {
      kind: "table_shape",
      layout: "three_line_table",
    },
    action: {
      kind: "emit_finding",
      message: "Journal table header semantics override the generic rule.",
    },
    authoring_payload: {},
    confidence_policy: "manual_only",
    severity: "warning",
    enabled: true,
  });

  const resolved = await service.resolve({
    templateFamilyId: "family-1",
    module: "editing",
    journalTemplateId: "journal-template-1",
  });
  const semanticTableRule = resolved.resolved_rules.find(
    (entry) => entry.rule.id === "journal-rule-table-header",
  );

  assert.equal(
    semanticTableRule?.coverage_key,
    'table::{"header_path_includes":["Treatment group","n (%)"],"semantic_target":"header_cell"}::{"kind":"table_shape","layout":"three_line_table"}',
  );
  assert.deepEqual(semanticTableRule?.overridden_rule_ids, [
    "base-rule-table-header",
  ]);
  assert.match(
    semanticTableRule?.resolution_reason ?? "",
    /journal template override/i,
  );
});

test("resolution prefers the higher-priority same-layer rule when duplicate coverage keys collide", async () => {
  const repository = new InMemoryEditorialRuleRepository();
  const service = new EditorialRuleResolutionService({
    repository,
  });

  await seedPublishedRuleScopes(repository);
  await repository.saveRule({
    id: "base-rule-table-priority-low",
    rule_set_id: "base-rule-set",
    order_no: 40,
    priority: 50,
    rule_object: "table",
    rule_type: "format",
    execution_mode: "inspect",
    scope: {
      manuscript_types: ["clinical_study"],
      sections: ["results"],
      object_granularity: ["table_cell"],
    },
    selector: {
      semantic_target: "data_cell",
      row_key: "Age",
      column_key: "Treatment",
    },
    trigger: {
      kind: "table_semantic_match",
      slot: "age-treatment",
    },
    action: {
      kind: "emit_finding",
      message: "Lower-priority table rule should lose.",
    },
    authoring_payload: {},
    confidence_policy: "manual_only",
    severity: "warning",
    enabled: true,
  } as never);
  await repository.saveRule({
    id: "base-rule-table-priority-high",
    rule_set_id: "base-rule-set",
    order_no: 41,
    priority: 200,
    rule_object: "table",
    rule_type: "format",
    execution_mode: "inspect",
    scope: {
      manuscript_types: ["clinical_study"],
      sections: ["results"],
      object_granularity: ["table_cell"],
    },
    selector: {
      semantic_target: "data_cell",
      row_key: "Age",
      column_key: "Treatment",
    },
    trigger: {
      kind: "table_semantic_match",
      slot: "age-treatment",
    },
    action: {
      kind: "emit_finding",
      message: "Higher-priority table rule should win.",
    },
    authoring_payload: {},
    confidence_policy: "manual_only",
    severity: "warning",
    enabled: true,
  } as never);

  const resolved = await service.resolve({
    templateFamilyId: "family-1",
    module: "editing",
  });

  assert.ok(
    resolved.rules.some((rule) => rule.id === "base-rule-table-priority-high"),
  );
  assert.deepEqual(
    resolved.overrides.find(
      (entry) => entry.overridden_rule_id === "base-rule-table-priority-low",
    ),
    {
      active_rule_id: "base-rule-table-priority-high",
      overridden_rule_id: "base-rule-table-priority-low",
      reason:
        'Same-layer conflict retained the higher-priority rule for coverage key "table::{"column_key":"Treatment","row_key":"Age","semantic_target":"data_cell"}::{"kind":"table_semantic_match","slot":"age-treatment"}".',
    },
  );
});

test("resolution prefers the narrower same-layer scope when priorities tie", async () => {
  const repository = new InMemoryEditorialRuleRepository();
  const service = new EditorialRuleResolutionService({
    repository,
  });

  await seedPublishedRuleScopes(repository);
  await repository.saveRule({
    id: "base-rule-table-scope-broad",
    rule_set_id: "base-rule-set",
    order_no: 50,
    priority: 100,
    rule_object: "table",
    rule_type: "format",
    execution_mode: "inspect",
    scope: {
      sections: ["results"],
      object_granularity: ["table"],
    },
    selector: {
      semantic_target: "header_cell",
      header_path_includes: ["Visit 1", "n (%)"],
    },
    trigger: {
      kind: "table_semantic_match",
      slot: "visit-1-header",
    },
    action: {
      kind: "emit_finding",
      message: "Broad table header rule.",
    },
    authoring_payload: {},
    confidence_policy: "manual_only",
    severity: "warning",
    enabled: true,
  } as never);
  await repository.saveRule({
    id: "base-rule-table-scope-narrow",
    rule_set_id: "base-rule-set",
    order_no: 51,
    priority: 100,
    rule_object: "table",
    rule_type: "format",
    execution_mode: "inspect",
    scope: {
      sections: ["results"],
      object_granularity: ["table_header"],
    },
    selector: {
      semantic_target: "header_cell",
      header_path_includes: ["Visit 1", "n (%)"],
    },
    trigger: {
      kind: "table_semantic_match",
      slot: "visit-1-header",
    },
    action: {
      kind: "emit_finding",
      message: "Narrow table header rule.",
    },
    authoring_payload: {},
    confidence_policy: "manual_only",
    severity: "warning",
    enabled: true,
  } as never);

  const resolved = await service.resolve({
    templateFamilyId: "family-1",
    module: "editing",
  });

  assert.ok(
    resolved.rules.some((rule) => rule.id === "base-rule-table-scope-narrow"),
  );
  assert.deepEqual(
    resolved.overrides.find(
      (entry) => entry.overridden_rule_id === "base-rule-table-scope-broad",
    ),
    {
      active_rule_id: "base-rule-table-scope-narrow",
      overridden_rule_id: "base-rule-table-scope-broad",
      reason:
        'Same-layer conflict retained the narrower-scope rule for coverage key "table::{"header_path_includes":["Visit 1","n (%)"],"semantic_target":"header_cell"}::{"kind":"table_semantic_match","slot":"visit-1-header"}".',
    },
  );
});

test("resolution filters rules by manuscript type, section, and object granularity when runtime scope is provided", async () => {
  const repository = new InMemoryEditorialRuleRepository();
  const service = new EditorialRuleResolutionService({
    repository,
  });

  await seedPublishedRuleScopes(repository);
  await repository.saveRule({
    id: "base-rule-table-runtime-scope-match",
    rule_set_id: "base-rule-set",
    order_no: 60,
    priority: 120,
    rule_object: "table",
    rule_type: "format",
    execution_mode: "inspect",
    scope: {
      manuscript_types: ["clinical_study"],
      sections: ["results"],
      object_granularity: ["table_cell"],
    },
    selector: {
      semantic_target: "data_cell",
      row_key: "Responder rate",
      column_key: "Week 12",
    },
    trigger: {
      kind: "table_semantic_match",
      slot: "responder-rate-week-12",
    },
    action: {
      kind: "emit_finding",
      message: "Matched runtime-scoped rule.",
    },
    authoring_payload: {},
    confidence_policy: "manual_only",
    severity: "warning",
    enabled: true,
  } as never);
  await repository.saveRule({
    id: "base-rule-table-runtime-scope-miss",
    rule_set_id: "base-rule-set",
    order_no: 61,
    priority: 120,
    rule_object: "table",
    rule_type: "format",
    execution_mode: "inspect",
    scope: {
      manuscript_types: ["review"],
      sections: ["discussion"],
      object_granularity: ["paragraph"],
    },
    selector: {
      semantic_target: "data_cell",
      row_key: "Responder rate",
      column_key: "Week 12",
    },
    trigger: {
      kind: "table_semantic_match",
      slot: "responder-rate-week-12-review",
    },
    action: {
      kind: "emit_finding",
      message: "Mismatched runtime-scoped rule.",
    },
    authoring_payload: {},
    confidence_policy: "manual_only",
    severity: "warning",
    enabled: true,
  } as never);

  const resolved = await service.resolve({
    templateFamilyId: "family-1",
    module: "editing",
    manuscriptType: "clinical_study",
    section: "results",
    objectGranularity: "table_cell",
  } as never);

  assert.deepEqual(
    resolved.rules.map((rule) => rule.id),
    ["base-rule-table-runtime-scope-match"],
  );
});

test("resolution lets a structured target-block rule override the legacy front-matter bridge even when coverage keys differ", async () => {
  const repository = new InMemoryEditorialRuleRepository();
  const service = new EditorialRuleResolutionService({
    repository,
  });

  await seedPublishedRuleScopes(repository);
  await repository.saveRule({
    id: "base-rule-front-matter-legacy",
    rule_set_id: "base-rule-set",
    order_no: 70,
    rule_object: "author_line",
    rule_type: "format",
    execution_mode: "apply_and_inspect",
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
    authoring_payload: {
      source: "rule_package_compile",
      compile_trace: {
        package_kind: "front_matter",
      },
      compatibility_bridge_kind: "legacy_front_matter",
      target_block_key: "author_line",
      slot_key: "author_line",
      bridge_shadow_target_block_keys: [
        "affiliation_line",
        "corresponding_author_bio",
      ],
      legacy_only_semantic_roles: [
        "author_bio",
        "funding_statement",
        "classification_line",
        "front_matter",
      ],
    },
    confidence_policy: "manual_only",
    severity: "warning",
    enabled: true,
  } as never);
  await repository.saveRule({
    id: "journal-rule-front-matter-structured",
    rule_set_id: "journal-rule-set",
    order_no: 71,
    rule_object: "author_line",
    rule_type: "format",
    execution_mode: "apply_and_inspect",
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
    authoring_payload: {
      target_block_key: "author_line",
      slot_key: "author_line",
    },
    confidence_policy: "manual_only",
    severity: "warning",
    enabled: true,
  } as never);

  const baseResolved = await service.resolve({
    templateFamilyId: "family-1",
    module: "editing",
  });
  const baseLegacyRule = baseResolved.resolved_rules.find(
    (entry) => entry.rule.id === "base-rule-front-matter-legacy",
  );
  assert.match(baseLegacyRule?.resolution_reason ?? "", /legacy front-matter bridge/i);
  assert.match(baseLegacyRule?.resolution_reason ?? "", /remaining legacy-only roles/i);

  const resolved = await service.resolve({
    templateFamilyId: "family-1",
    module: "editing",
    journalTemplateId: "journal-template-1",
  });
  const structuredFrontMatterRule = resolved.resolved_rules.find(
    (entry) => entry.rule.id === "journal-rule-front-matter-structured",
  );

  assert.ok(structuredFrontMatterRule);
  assert.deepEqual(structuredFrontMatterRule?.overridden_rule_ids, [
    "base-rule-front-matter-legacy",
  ]);
  assert.match(
    structuredFrontMatterRule?.resolution_reason ?? "",
    /comparison key "target_block::author_line"/i,
  );
  assert.equal(
    resolved.rules.some((rule) => rule.id === "base-rule-front-matter-legacy"),
    false,
  );
});

test("resolution prefers active rule sets over legacy published rule sets in the same scope", async () => {
  const repository = new InMemoryEditorialRuleRepository();
  const service = new EditorialRuleResolutionService({
    repository,
  });

  await seedPublishedRuleScopes(repository);
  await repository.saveRuleSet({
    id: "base-rule-set-active",
    template_family_id: "family-1",
    module: "editing",
    version_no: 2,
    status: "active",
  });
  await repository.saveRule({
    id: "base-rule-abstract-active",
    rule_set_id: "base-rule-set-active",
    order_no: 10,
    rule_object: "abstract",
    rule_type: "format",
    execution_mode: "apply_and_inspect",
    scope: {
      sections: ["abstract"],
      block_kind: "heading",
    },
    selector: {
      section_selector: "abstract",
      label_selector: { text: BEFORE_HEADING },
    },
    trigger: {
      kind: "exact_text",
      text: BEFORE_HEADING,
    },
    action: {
      kind: "replace_heading",
      to: `${BASE_AFTER_HEADING} ACTIVE`,
    },
    authoring_payload: {},
    confidence_policy: "always_auto",
    severity: "error",
    enabled: true,
  });

  const resolved = await service.resolve({
    templateFamilyId: "family-1",
    module: "editing",
  });

  assert.equal(resolved.baseRuleSet?.id, "base-rule-set-active");
  assert.equal(resolved.rules[0]?.id, "base-rule-abstract-active");
});

async function seedPublishedRuleScopes(
  repository: InMemoryEditorialRuleRepository,
): Promise<void> {
  await repository.saveRuleSet({
    id: "base-rule-set",
    template_family_id: "family-1",
    module: "editing",
    version_no: 1,
    status: "published",
  });
  await repository.saveRuleSet({
    id: "journal-rule-set",
    template_family_id: "family-1",
    journal_template_id: "journal-template-1",
    module: "editing",
    version_no: 1,
    status: "published",
  });

  await repository.saveRule({
    id: "base-rule-abstract",
    rule_set_id: "base-rule-set",
    order_no: 10,
    rule_object: "abstract",
    rule_type: "format",
    execution_mode: "apply_and_inspect",
    scope: {
      sections: ["abstract"],
      block_kind: "heading",
    },
    selector: {
      section_selector: "abstract",
      label_selector: { text: BEFORE_HEADING },
    },
    trigger: {
      kind: "exact_text",
      text: BEFORE_HEADING,
    },
    action: {
      kind: "replace_heading",
      to: BASE_AFTER_HEADING,
    },
    authoring_payload: {},
    explanation_payload: {
      rationale:
        "Normalize base abstract objective headings to full-width punctuation.",
    },
    confidence_policy: "always_auto",
    severity: "error",
    enabled: true,
  });
  await repository.saveRule({
    id: "base-rule-discussion",
    rule_set_id: "base-rule-set",
    order_no: 20,
    rule_object: "discussion",
    rule_type: "content",
    execution_mode: "inspect",
    scope: {
      sections: ["discussion"],
    },
    selector: {},
    trigger: {
      kind: "structural_presence",
      field: "discussion",
    },
    action: {
      kind: "emit_finding",
      message: "Discussion section should be present.",
    },
    authoring_payload: {},
    confidence_policy: "manual_only",
    severity: "warning",
    enabled: true,
  });
  await repository.saveRule({
    id: "journal-rule-abstract",
    rule_set_id: "journal-rule-set",
    order_no: 5,
    rule_object: "abstract",
    rule_type: "format",
    execution_mode: "apply_and_inspect",
    scope: {
      sections: ["abstract"],
      block_kind: "heading",
    },
    selector: {
      section_selector: "abstract",
      label_selector: { text: BEFORE_HEADING },
    },
    trigger: {
      kind: "exact_text",
      text: BEFORE_HEADING,
    },
    action: {
      kind: "replace_heading",
      to: JOURNAL_AFTER_HEADING,
    },
    authoring_payload: {},
    explanation_payload: {
      rationale:
        "Journal Alpha requires a trailing full-width colon after the normalized abstract heading.",
    },
    confidence_policy: "always_auto",
    severity: "error",
    enabled: true,
  });
  await repository.saveRule({
    id: "journal-rule-table",
    rule_set_id: "journal-rule-set",
    order_no: 30,
    rule_object: "table",
    rule_type: "format",
    rule_domain: "table",
    execution_mode: "inspect",
    structured_action: {
      kind: "full_table_rebuild",
      target: "journal_target_table_model",
      requires_validation: true,
    },
    automation_grade: "A",
    scope_layer: "journal",
    scope: {
      sections: ["results"],
    },
    selector: {
      object_selector: "table",
    },
    trigger: {
      kind: "table_shape",
      layout: "three_line_table",
    },
    action: {
      kind: "emit_finding",
      message: "Use the journal three-line table layout.",
    },
    authoring_payload: {},
    linkage_payload: {
      evidence_package_ids: ["evidence-package-table-1"],
      target_model_block_ids: ["journal_target_table_model"],
    },
    gold_sample_gate: {
      status: "passed",
      specimen_ids: ["gold-table-specimen-1"],
      validation_snapshot_ids: ["validation-table-snapshot-1"],
    },
    confidence_policy: "manual_only",
    severity: "warning",
    enabled: true,
  });
}
