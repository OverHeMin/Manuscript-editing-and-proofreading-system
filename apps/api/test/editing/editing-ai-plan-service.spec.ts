import test from "node:test";
import assert from "node:assert/strict";
import { EditingAiPlanService } from "../../src/modules/editing/editing-ai-plan-service.ts";
import type { ExecuteMainlineAiInput } from "../../src/modules/shared/mainline-ai-runtime-executor.ts";

test("editing AI planner forwards governed rule and knowledge context to the mainline runtime", async () => {
  let capturedInput: ExecuteMainlineAiInput | undefined;

  const service = new EditingAiPlanService({
    mainlineAiRuntimeExecutor: {
      async executeJson<T>(input: ExecuteMainlineAiInput): Promise<T> {
        capturedInput = input;
        return {
          summary: "Governed editing plan.",
          replacements: [],
          manualReviewItems: [],
        } as T;
      },
    } as never,
  });

  await service.createPlan({
    manuscriptId: "manuscript-1",
    sourceFileName: "manuscript.docx",
    sourceBlocks: [
      {
        section: "abstract",
        block_kind: "heading",
        text: "摘要 目的",
      },
    ],
    qualityIssues: [
      {
        severity: "warning",
        explanation: "Abstract heading should follow the governed style.",
      },
    ],
    governanceContext: {
      hardRuleSummary: "Rule set v1:\n- abstract: 摘要 目的 -> 摘要：目的",
      allowedContentOperations: ["sentence_rewrite"],
      forbiddenOperations: ["fabrication", "meaning_shift"],
      manualReviewPolicy: "Escalate any medical meaning risk.",
      promptSnippets: ["Keep the abstract heading style consistent."],
      manualReviewItems: ["rule-discussion-1: medical_meaning_risk"],
      contentRuleCandidates: ["rule-discussion-1: rewrite_content"],
      resolvedRules: [
        {
          ruleId: "rule-abstract-1",
          actionKind: "replace_heading",
          ruleType: "format",
          severity: "warning",
          confidencePolicy: "always_auto",
          executionMode: "apply_and_inspect",
          sections: ["abstract"],
          sourceLayer: "base",
        },
      ],
      knowledgeHits: [
        {
          knowledgeItemId: "knowledge-1",
          matchSource: "binding_rule",
          matchReasons: ["Matched the abstract heading package."],
        },
      ],
    },
  } as never);

  assert.ok(capturedInput);
  assert.deepEqual(capturedInput.userPayload, {
    task: "editing_plan",
    manuscriptId: "manuscript-1",
    sourceFileName: "manuscript.docx",
    sourceBlocks: [
      {
        section: "abstract",
        blockKind: "heading",
        text: "摘要 目的",
      },
    ],
    qualityIssues: [
      {
        severity: "warning",
        explanation: "Abstract heading should follow the governed style.",
      },
    ],
    governance: {
      hardRuleSummary: "Rule set v1:\n- abstract: 摘要 目的 -> 摘要：目的",
      allowedContentOperations: ["sentence_rewrite"],
      forbiddenOperations: ["fabrication", "meaning_shift"],
      manualReviewPolicy: "Escalate any medical meaning risk.",
      promptSnippets: ["Keep the abstract heading style consistent."],
      manualReviewItems: ["rule-discussion-1: medical_meaning_risk"],
      contentRuleCandidates: ["rule-discussion-1: rewrite_content"],
      resolvedRules: [
        {
          ruleId: "rule-abstract-1",
          actionKind: "replace_heading",
          ruleType: "format",
          severity: "warning",
          confidencePolicy: "always_auto",
          executionMode: "apply_and_inspect",
          sections: ["abstract"],
          sourceLayer: "base",
        },
      ],
      knowledgeHits: [
        {
          knowledgeItemId: "knowledge-1",
          matchSource: "binding_rule",
          matchReasons: ["Matched the abstract heading package."],
        },
      ],
    },
    contract: {
      summary: "string",
      replacements: [
        {
          targetText: "string",
          replacementText: "string",
          reason: "string",
        },
      ],
      manualReviewItems: ["string"],
    },
  });
});

test("editing AI planner blocks risky replacements and records guardrail reasons", async () => {
  const service = new EditingAiPlanService({
    mainlineAiRuntimeExecutor: {
      async executeJson<T>(): Promise<T> {
        return {
          summary: "Risky editing plan.",
          replacements: [
            {
              targetText: "ALT remained stable.",
              replacementText: "Alanine aminotransferase remained stable.",
              reason: "Expand abbreviation.",
            },
            {
              targetText: "Introduction ,",
              replacementText: "Introduction,",
              reason: "Normalize punctuation.",
            },
          ],
          manualReviewItems: [],
        } as T;
      },
    } as never,
  });

  const result = await service.createPlan({
    manuscriptId: "manuscript-2",
    sourceBlocks: [
      {
        section: "introduction",
        block_kind: "paragraph",
        text: "Introduction ,",
      },
      {
        section: "results",
        block_kind: "paragraph",
        text: "ALT remained stable.",
      },
    ],
  } as never);

  assert.deepEqual(result.replacements, [
    {
      targetText: "Introduction ,",
      replacementText: "Introduction,",
      reason: "Normalize punctuation.",
    },
  ]);
  assert.deepEqual(result.manualReviewItems, [
    "editing_guardrail:medical_entity_present:ALT remained stable.",
  ]);
});

test("editing AI planner records malformed replacements as explicit guardrail reason codes", async () => {
  const service = new EditingAiPlanService({
    mainlineAiRuntimeExecutor: {
      async executeJson<T>(): Promise<T> {
        return {
          summary: "Malformed editing plan.",
          replacements: [
            {
              replacementText: "（摘要 目的）",
              reason: "Normalize heading punctuation.",
            },
            {
              targetText: "摘要 目的",
              reason: "Normalize heading punctuation.",
            },
            {
              targetText: "Introduction",
              replacementText: "Introduction:",
            },
          ],
          manualReviewItems: [],
        } as T;
      },
    } as never,
  });

  const result = await service.createPlan({
    manuscriptId: "manuscript-guardrail-1",
  } as never);

  assert.deepEqual(result.replacements, []);
  assert.deepEqual(result.manualReviewItems, [
    "editing_guardrail:anchor_not_precise:（摘要 目的）",
    "editing_guardrail:insufficient_style_evidence:摘要 目的",
    "editing_guardrail:insufficient_style_evidence:Introduction",
  ]);
});

test("editing AI planner fallback stays inspect-first when runtime is unavailable", async () => {
  const service = new EditingAiPlanService({});

  const result = await service.createPlan({
    manuscriptId: "manuscript-3",
    sourceBlocks: [
      {
        section: "abstract",
        block_kind: "paragraph",
        text: "摘要目的",
      },
    ],
  } as never);

  assert.equal(result.summary, "No AI editing replacements were proposed for manuscript-3.");
  assert.deepEqual(result.replacements, []);
  assert.deepEqual(result.manualReviewItems, []);
});
