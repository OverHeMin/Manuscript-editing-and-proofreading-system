import assert from "node:assert/strict";
import test from "node:test";
import { RuleAiIntakeService } from "../../src/modules/editorial-rules/rule-ai-intake-service.ts";

test("rule AI intake normalizes manual description drafts", async () => {
  const service = new RuleAiIntakeService({
    generator: {
      async createDraft() {
        return {
          draft: {
            source_kind: "manual_description" as const,
            ai_understanding_summary: "摘要缩写首次出现需要中文全称。",
            recommended_governance_layer: "journal_template" as const,
            target_object: "abstract_abbreviation",
            trigger: "first_abbreviation_occurrence",
            action: "manual_review_or_replace",
            scope: {
              module_scope: "proofreading" as const,
              manuscript_types: ["clinical_study" as const],
              sections: ["abstract"],
            },
            evidence: [
              {
                kind: "user_description" as const,
                text: "摘要首次出现英文缩写时使用中文全称（英文缩写）。",
              },
            ],
            confidence: { overall: 1.4 },
            uncertainties: [],
          },
          template_match: { status: "matched" as const, template_id: "abstract_abbreviation" },
          similar_rule_matches: [],
        };
      },
    },
  });

  const result = await service.createDraft({
    source_kind: "manual_description",
    description: "摘要首次出现英文缩写时使用中文全称（英文缩写）。",
    context: {
      module_scope: "proofreading",
      manuscript_types: ["clinical_study"],
      sections: ["abstract"],
    },
  });

  assert.equal(result.draft.source_kind, "manual_description");
  assert.equal(result.draft.scope.module_scope, "proofreading");
  assert.equal(result.draft.confidence.overall, 1);
  assert.equal(result.template_match.status, "matched");
});

test("rule AI intake rejects empty manual descriptions", async () => {
  const service = new RuleAiIntakeService({
    generator: {
      async createDraft() {
        throw new Error("should not call generator");
      },
    },
  });

  await assert.rejects(
    service.createDraft({ source_kind: "manual_description", description: "   " }),
    /description is required/u,
  );
});

test("rule AI intake emits deterministic similarity hints", async () => {
  const service = new RuleAiIntakeService({
    existingRules: async () => [
      {
        id: "rule-abstract-abbreviation",
        title: "摘要缩写规范",
        targetObject: "abstract_abbreviation",
        trigger: "first_abbreviation_occurrence",
        action: "manual_review_or_replace",
      },
    ],
    generator: {
      async createDraft() {
        return {
          draft: {
            source_kind: "manual_description" as const,
            ai_understanding_summary: "摘要缩写首次出现需要中文全称。",
            recommended_governance_layer: "journal_template" as const,
            target_object: "abstract_abbreviation",
            trigger: "first_abbreviation_occurrence",
            action: "manual_review_or_replace",
            scope: {},
            evidence: [],
            confidence: { overall: 0.8 },
            uncertainties: [],
          },
          template_match: { status: "no_match" as const },
          similar_rule_matches: [],
        };
      },
    },
  });

  const result = await service.createDraft({
    source_kind: "manual_description",
    description: "摘要首次出现英文缩写时使用中文全称（英文缩写）。",
  });

  assert.equal(result.similar_rule_matches[0]?.kind, "duplicate");
  assert.equal(result.similar_rule_matches[0]?.rule_id, "rule-abstract-abbreviation");
});
