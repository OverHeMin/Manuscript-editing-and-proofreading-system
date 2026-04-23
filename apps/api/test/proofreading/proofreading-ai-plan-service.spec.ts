import test from "node:test";
import assert from "node:assert/strict";
import { ProofreadingAiPlanService } from "../../src/modules/proofreading/proofreading-ai-plan-service.ts";
import type { ExecuteMainlineAiInput } from "../../src/modules/shared/mainline-ai-runtime-executor.ts";

test("proofreading AI planner forwards governed proofreading context to the mainline runtime", async () => {
  let capturedInput: ExecuteMainlineAiInput | undefined;

  const service = new ProofreadingAiPlanService({
    mainlineAiRuntimeExecutor: {
      async executeJson<T>(input: ExecuteMainlineAiInput): Promise<T> {
        capturedInput = input;
        return {
          summary: "Governed proofreading plan.",
          corrections: [],
          manualReviewItems: [],
        } as T;
      },
    } as never,
  });

  await service.createPlan({
    manuscriptId: "manuscript-1",
    sourceFileName: "proofreading.docx",
    sourceBlocks: [
      {
        section: "results",
        block_kind: "paragraph",
        text: "P < 0.05",
      },
    ],
    qualityIssues: [
      {
        severity: "error",
        explanation: "Statistical expression requires governed review.",
      },
    ],
    governanceContext: {
      hardRuleSummary: "Rule set v2:\n- results: inspect_statistical_expression requires manual review",
      forbiddenOperations: ["meaning_shift"],
      manualReviewPolicy: "Escalate any unresolved statistical-expression finding.",
      promptSnippets: ["Use the governed statistical notation rules."],
      manualReviewItems: ["rule-statistics-1: manual_only_rule"],
      resolvedRules: [
        {
          ruleId: "rule-statistics-1",
          actionKind: "inspect_statistical_expression",
          ruleType: "format",
          severity: "error",
          confidencePolicy: "manual_only",
          executionMode: "inspect",
          sections: ["results"],
          sourceLayer: "base",
        },
      ],
      knowledgeHits: [
        {
          knowledgeItemId: "knowledge-statistics-1",
          matchSource: "binding_rule",
          matchReasons: ["Matched the statistical proofreading package."],
        },
      ],
    },
  } as never);

  assert.ok(capturedInput);
  assert.deepEqual(capturedInput.userPayload, {
    task: "proofreading_plan",
    manuscriptId: "manuscript-1",
    sourceFileName: "proofreading.docx",
    sourceBlocks: [
      {
        section: "results",
        blockKind: "paragraph",
        text: "P < 0.05",
      },
    ],
    qualityIssues: [
      {
        severity: "error",
        explanation: "Statistical expression requires governed review.",
      },
    ],
    governance: {
      hardRuleSummary: "Rule set v2:\n- results: inspect_statistical_expression requires manual review",
      forbiddenOperations: ["meaning_shift"],
      manualReviewPolicy: "Escalate any unresolved statistical-expression finding.",
      promptSnippets: ["Use the governed statistical notation rules."],
      manualReviewItems: ["rule-statistics-1: manual_only_rule"],
      resolvedRules: [
        {
          ruleId: "rule-statistics-1",
          actionKind: "inspect_statistical_expression",
          ruleType: "format",
          severity: "error",
          confidencePolicy: "manual_only",
          executionMode: "inspect",
          sections: ["results"],
          sourceLayer: "base",
        },
      ],
      knowledgeHits: [
        {
          knowledgeItemId: "knowledge-statistics-1",
          matchSource: "binding_rule",
          matchReasons: ["Matched the statistical proofreading package."],
        },
      ],
    },
    contract: {
      summary: "string",
      corrections: [
        {
          targetText: "string",
          replacementText: "string",
          category: "terminology|punctuation|grammar|style",
        },
      ],
      manualReviewItems: ["string"],
    },
  });
});
