import test from "node:test";
import assert from "node:assert/strict";
import { retrieveRuleKnowledgeCandidates } from "../../src/modules/proofreading/rule-knowledge-retrieval-service.ts";
import type { EditorialRuleRecord } from "../../src/modules/editorial-rules/editorial-rule-record.ts";
import type { KnowledgeRecord } from "../../src/modules/knowledge/knowledge-record.ts";

test("retrieval service filters by scope and records truthful context-rank evidence", async () => {
  const rules: EditorialRuleRecord[] = [
    buildRule("rule-table-alt", "table", "medical", true),
    buildRule("rule-title", "title", "general", true),
    buildRule("rule-disabled", "table", "medical", false),
  ];
  const knowledge: KnowledgeRecord[] = [
    buildKnowledge("knowledge-alt", "ALT table proofreading", "ALT 表格单位规则", "prompt_snippet"),
    buildKnowledge("knowledge-draft", "draft", "ALT draft", "reference", "draft"),
  ];

  const result = await retrieveRuleKnowledgeCandidates({
    context: {
      module: "proofreading",
      manuscriptType: "clinical_study",
      templateFamilyId: "template-family-1",
      medicalPackageIds: ["medical-pack-1"],
      generalPackageIds: ["general-pack-1"],
    },
    slice: {
      id: "slice-table-1",
      sliceKind: "table",
      passKinds: ["data_statistics_units_and_tables"],
      sourceBlockIndexes: [1],
      tableIds: ["table-1"],
      text: "ALT 表格 单位",
      evidence: [],
    },
    passKind: "data_statistics_units_and_tables",
    rules,
    knowledge,
    knowledgeRetrievalService: {
      async rankIndexEntriesForContext() {
        return [
          {
            id: "index-1",
            knowledge_item_id: "knowledge-alt",
            module: "proofreading",
            manuscript_types: ["clinical_study"],
            template_family_id: "template-family-1",
            title: "ALT context index",
            source_text: "ALT 表格单位规则",
            source_hash: "hash",
            embedding_provider: "test",
            embedding_model: "none",
            embedding_dimensions: 1,
            embedding_storage_backend: "double_precision_array",
            embedding_vector: [1],
            created_at: "2026-04-28T00:00:00.000Z",
            updated_at: "2026-04-28T00:00:00.000Z",
          },
        ];
      },
    },
  });

  assert.deepEqual(result.candidateRules.map((rule) => rule.ruleId), [
    "rule-table-alt",
  ]);
  assert.deepEqual(result.candidateKnowledge.map((item) => item.knowledgeItemId), [
    "knowledge-alt",
  ]);
  assert.ok(result.candidateKnowledge[0]?.reasons.includes("context_rank"));
  assert.ok(!result.candidateKnowledge[0]?.reasons.includes("vector_similarity"));
});

function buildRule(
  id: string,
  ruleObject: string,
  scopeLayer: "general" | "medical" | "journal",
  enabled: boolean,
): EditorialRuleRecord {
  return {
    id,
    rule_set_id: "rule-set-1",
    order_no: 1,
    priority: 10,
    rule_object: ruleObject,
    rule_type: "content",
    execution_mode: "inspect",
    scope_layer: scopeLayer,
    scope: { manuscript_types: ["clinical_study"], object_granularity: [ruleObject] },
    selector: {},
    trigger: { kind: "keyword", text: "ALT" },
    action: { kind: "manual_review_required" },
    authoring_payload: {},
    confidence_policy: "manual_only",
    severity: "warning",
    enabled,
  };
}

function buildKnowledge(
  id: string,
  title: string,
  canonicalText: string,
  kind: KnowledgeRecord["knowledge_kind"],
  status: KnowledgeRecord["status"] = "approved",
): KnowledgeRecord {
  return {
    id,
    title,
    canonical_text: canonicalText,
    summary: canonicalText,
    knowledge_kind: kind,
    status,
    routing: {
      module_scope: "proofreading",
      manuscript_types: ["clinical_study"],
      risk_tags: ["table"],
    },
    binding_targets: {
      template_family_ids: ["template-family-1"],
      medical_package_ids: ["medical-pack-1"],
    },
  };
}
