import assert from "node:assert/strict";
import test from "node:test";
import { RuleAiParsingService } from "../../src/modules/editorial-rules/rule-ai-parsing-service.ts";

test("rule AI parsing reports consistent manual rules", async () => {
  const service = new RuleAiParsingService({
    generator: {
      async parseRule() {
        return {
          ai_understanding_summary: "摘要英文缩写首次出现需要中文全称。",
          consistency: "consistent" as const,
          findings: [],
          requires_human_confirmation: false,
        };
      },
    },
  });

  const result = await service.parseRule({
    rule_fields: {
      title: "摘要缩写规范",
      rule_body: "摘要首次出现英文缩写时使用中文全称（英文缩写）。",
      module_scope: "proofreading",
      manuscript_types: ["clinical_study"],
      sections: ["abstract"],
    },
  });

  assert.equal(result.consistency, "consistent");
  assert.equal(result.requires_human_confirmation, false);
});

test("rule AI parsing rejects empty rule bodies", async () => {
  const service = new RuleAiParsingService({
    generator: {
      async parseRule() {
        throw new Error("should not call generator");
      },
    },
  });

  await assert.rejects(
    service.parseRule({ rule_fields: { rule_body: " " } }),
    /rule body is required/u,
  );
});
