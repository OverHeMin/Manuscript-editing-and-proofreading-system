import test from "node:test";
import assert from "node:assert/strict";
import { selectKnowledgeBudget } from "../../src/modules/proofreading/knowledge-budget-service.ts";

test("knowledge budget deduplicates items and prioritizes prompt snippets", () => {
  const result = selectKnowledgeBudget({
    maxItems: 2,
    candidates: [
      {
        knowledgeItemId: "knowledge-1",
        score: 8,
        reasons: ["binding_match"],
        title: "Evidence style",
        summary: "Long reference should be cited by summary.",
        knowledgeKind: "reference",
        estimatedTokens: 180,
      },
      {
        knowledgeItemId: "knowledge-1",
        score: 5,
        reasons: ["context_rank"],
        title: "Duplicate",
        summary: "Duplicate",
        knowledgeKind: "reference",
        estimatedTokens: 180,
      },
      {
        knowledgeItemId: "knowledge-2",
        score: 7,
        reasons: ["keyword_hit"],
        title: "Prompt snippet",
        promptSnippet: "核对表格单位和±表达。",
        knowledgeKind: "prompt_snippet",
        estimatedTokens: 30,
      },
    ],
  });

  assert.deepEqual(result.selected.map((entry) => entry.knowledgeItemId), [
    "knowledge-2",
    "knowledge-1",
  ]);
  assert.equal(result.selected[0]?.promptSnippet, "核对表格单位和±表达。");
  assert.ok(result.excluded.some((entry) => entry.reasons.includes("duplicate")));
});
