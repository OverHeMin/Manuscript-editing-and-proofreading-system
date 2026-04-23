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
          role: "医学稿件终校审校员",
          summary: "Governed proofreading plan.",
          issues: [],
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
    task: "proofreading_issue_plan",
    manuscriptId: "manuscript-1",
    sourceFileName: "proofreading.docx",
    fullDocumentBlocks: [
      {
        blockIndex: 0,
        blockKind: "paragraph",
        sectionLabel: "results",
        text: "P < 0.05",
      },
    ],
    fullDocumentText: "P < 0.05",
    governedCoverage: {
      qualityIssues: [
        {
          severity: "error",
          issueType: "",
          explanation: "Statistical expression requires governed review.",
        },
      ],
    },
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
      role: "医学稿件终校审校员",
      summary: "string",
      issues: [
        {
          itemId: "string",
          title: "string",
          description: "string",
          severity: "critical|high|medium|low",
          source: "residual_ai",
          issueType: "string",
          blocksFinal: false,
          anchor: {
            blockIndex: 0,
            quote: "string",
            sectionLabel: "string",
            blockKind: "string",
          },
          suggestion: {
            action: "replace_text|rewrite_manually|verify_fact|explain_only",
            replacementText: "string",
            note: "string",
          },
        },
      ],
      manualReviewItems: ["string"],
    },
  });
});
