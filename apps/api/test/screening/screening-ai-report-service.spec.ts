import test from "node:test";
import assert from "node:assert/strict";
import { ScreeningAiReportService } from "../../src/modules/screening/screening-ai-report-service.ts";
import type { ExecuteMainlineAiInput } from "../../src/modules/shared/mainline-ai-runtime-executor.ts";

test("screening AI report service forwards governed screening checks and knowledge context", async () => {
  let capturedInput: ExecuteMainlineAiInput | undefined;

  const service = new ScreeningAiReportService({
    mainlineAiRuntimeExecutor: {
      async executeJson<T>(input: ExecuteMainlineAiInput): Promise<T> {
        capturedInput = input;
        return {
          summary: "Governed screening report.",
          majorFindings: [],
          minorFindings: [],
          riskLevel: "medium",
          recommendedDecision: "minor_revision",
        } as T;
      },
    } as never,
  });

  await service.createReport({
    manuscriptId: "manuscript-1",
    sourceFileName: "screening.docx",
    sourceBlocks: [
      {
        blockKind: "paragraph",
        text: "Primary endpoint not defined.",
      },
    ],
    tableCount: 1,
    qualityIssues: [
      {
        severity: "error",
        explanation: "Primary endpoint statement is missing.",
      },
    ],
    governanceContext: {
      hardRuleSummary: "Rule set v3:\n- methods: inspect_required_statement requires study design evidence",
      manualReviewItems: ["rule-screening-design-1: manual_only_rule"],
      requiredChecks: [
        "rule-screening-design-1: methods / inspect_required_statement / error",
      ],
      resolvedRules: [
        {
          ruleId: "rule-screening-design-1",
          actionKind: "inspect_required_statement",
          ruleType: "content",
          severity: "error",
          confidencePolicy: "manual_only",
          executionMode: "inspect",
          sections: ["methods"],
          sourceLayer: "base",
        },
      ],
      knowledgeHits: [
        {
          knowledgeItemId: "knowledge-screening-1",
          matchSource: "binding_rule",
          matchReasons: ["Matched the clinical study design knowledge."],
        },
      ],
    },
  } as never);

  assert.ok(capturedInput);
  assert.deepEqual(capturedInput.userPayload, {
    task: "screening_report",
    manuscriptId: "manuscript-1",
    sourceFileName: "screening.docx",
    sourceBlocks: [
      {
        blockKind: "paragraph",
        text: "Primary endpoint not defined.",
      },
    ],
    tableCount: 1,
    qualitySummary: {},
    qualityIssues: [
      {
        severity: "error",
        explanation: "Primary endpoint statement is missing.",
      },
    ],
    governance: {
      hardRuleSummary: "Rule set v3:\n- methods: inspect_required_statement requires study design evidence",
      manualReviewItems: ["rule-screening-design-1: manual_only_rule"],
      requiredChecks: [
        "rule-screening-design-1: methods / inspect_required_statement / error",
      ],
      resolvedRules: [
        {
          ruleId: "rule-screening-design-1",
          actionKind: "inspect_required_statement",
          ruleType: "content",
          severity: "error",
          confidencePolicy: "manual_only",
          executionMode: "inspect",
          sections: ["methods"],
          sourceLayer: "base",
        },
      ],
      knowledgeHits: [
        {
          knowledgeItemId: "knowledge-screening-1",
          matchSource: "binding_rule",
          matchReasons: ["Matched the clinical study design knowledge."],
        },
      ],
    },
    contract: {
      summary: "string",
      majorFindings: ["string"],
      minorFindings: ["string"],
      riskLevel: "low|medium|high|critical",
      recommendedDecision: "accept|minor_revision|major_revision|reject",
    },
  });
});
