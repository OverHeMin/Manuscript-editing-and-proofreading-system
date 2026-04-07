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
    execution_mode: "inspect",
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
    confidence_policy: "manual_only",
    severity: "warning",
    enabled: true,
  });
}
