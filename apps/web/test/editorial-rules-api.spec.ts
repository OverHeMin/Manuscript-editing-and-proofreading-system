import assert from "node:assert/strict";
import test from "node:test";
import {
  createRuleAiIntakeDraft,
  parseManualRuleWithAi,
} from "../src/features/editorial-rules/editorial-rules-api.ts";

test("editorial rules API posts rule AI intake draft requests", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const client = {
    async request<TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) {
      requests.push(input);
      return {
        status: 200,
        body: {
          draft: {
            source_kind: "manual_description",
            ai_understanding_summary: "摘要缩写首次出现需要中文全称。",
            recommended_governance_layer: "journal_template",
            target_object: "abstract_abbreviation",
            trigger: "first_abbreviation_occurrence",
            action: "manual_review_or_replace",
            scope: { module_scope: "proofreading", sections: ["abstract"] },
            evidence: [{ kind: "user_description", text: "摘要缩写规范。" }],
            confidence: { overall: 0.82 },
            uncertainties: [],
          },
          template_match: {
            status: "matched",
            template_id: "abstract_rule_template",
          },
          similar_rule_matches: [],
          warnings: [],
        } as TResponse,
      };
    },
  };

  const input = {
    source_kind: "manual_description" as const,
    description: "摘要首次出现英文缩写时使用中文全称（英文缩写）。",
    context: {
      module_scope: "proofreading" as const,
      manuscript_types: ["clinical_study" as const],
      sections: ["abstract"],
    },
  };

  const response = await createRuleAiIntakeDraft(client, input);

  assert.deepEqual(requests, [
    {
      method: "POST",
      url: "/api/v1/editorial-rules/ai-intake/drafts",
      body: input,
    },
  ]);
  assert.equal(response.body.draft.target_object, "abstract_abbreviation");
  assert.equal(response.body.template_match.status, "matched");
});

test("editorial rules API posts manual rule AI parsing requests", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const client = {
    async request<TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) {
      requests.push(input);
      return {
        status: 200,
        body: {
          ai_understanding_summary: "摘要英文缩写首次出现需要补全中文全称。",
          consistency: "consistent",
          findings: [],
          requires_human_confirmation: false,
          warnings: [],
        } as TResponse,
      };
    },
  };
  const input = {
    rule_fields: {
      title: "摘要缩写规范",
      rule_body: "摘要首次出现英文缩写时使用中文全称（英文缩写）。",
      module_scope: "proofreading" as const,
    },
  };

  const response = await parseManualRuleWithAi(client, input);

  assert.deepEqual(requests, [
    {
      method: "POST",
      url: "/api/v1/editorial-rules/ai-intake/parse-manual-rule",
      body: input,
    },
  ]);
  assert.equal(response.body.consistency, "consistent");
  assert.equal(response.body.requires_human_confirmation, false);
});
