import test from "node:test";
import assert from "node:assert/strict";
import { ProofreadingAiPlanService } from "../../src/modules/proofreading/proofreading-ai-plan-service.ts";
import type {
  ExecuteMainlineAiInput,
  MainlineAiRuntimeExecutor,
} from "../../src/modules/shared/mainline-ai-runtime-executor.ts";

test("proofreading AI planning sends governed coverage and whole-document guardrails to the runtime", async () => {
  let recordedInput: ExecuteMainlineAiInput | undefined;
  const service = new ProofreadingAiPlanService({
    mainlineAiRuntimeExecutor: {
      async executeJson<T>(input: ExecuteMainlineAiInput): Promise<T> {
        recordedInput = structuredClone(input);
        return {
          role: "医学稿件终校审校员",
          summary: "No additional residual issues.",
          issues: [],
          manualReviewItems: [],
        } as T;
      },
      async executeMarkdown(): Promise<string> {
        throw new Error("Proofreading AI planning should request JSON.");
      },
    } satisfies MainlineAiRuntimeExecutor,
  });

  await service.createPlan({
    manuscriptId: "manuscript-1",
    sourceFileName: "clinical-study.docx",
    sourceBlocks: [
      {
        section: "results",
        block_kind: "paragraph",
        text: "Dose was 5 mg per dL and ALT remained stable.",
      },
      {
        section: "conclusion",
        block_kind: "paragraph",
        text: "The observational study proves the treatment cures every patient.",
      },
    ],
    governedFailedChecks: [
      {
        ruleId: "rule-unit-1",
        severity: "error",
        actual: "5 mg per dL",
        expected: "5 mg/dL",
        blockIndex: 0,
      },
    ],
    governedManualReviewItems: [
      {
        ruleId: "rule-manual-1",
        reason: "Confirm unit consistency before release.",
        evidence_pack: {
          excerpt: "5 mg per dL",
        },
      },
    ],
    qualityIssues: [
      {
        severity: "high",
        issue_type: "evidence_alignment.overstated_conclusion",
        explanation:
          "The conclusion language appears stronger than the study design supports.",
        action: "manual_review",
        text_excerpt:
          "The observational study proves the treatment cures every patient.",
        suggested_replacement:
          "The observational study suggests the treatment may benefit patients.",
      },
    ],
    knowledgeHits: [
      {
        knowledgeItemId: "knowledge-proof-1",
        title: "ALT first mention",
        summary: "首次出现 ALT 应写全称。",
        canonicalText:
          "Alanine aminotransferase (ALT) should be written in full at first mention.",
        matchReasons: ["terminology expansion"],
      },
    ],
    promptGuardrails: {
      roleLabel: "医学稿件终校审校员",
      systemInstructions: "Inspect the manuscript against governed editorial controls.",
      taskFrame: "Report residual issues only.",
      manualReviewPolicy: "Escalate medical meaning risk.",
      forbiddenOperations: ["rewrite_manuscript", "meaning_shift"],
      outputContract: "Return issue JSON only.",
    },
  } as never);

  assert.equal(recordedInput?.module, "proofreading");
  assert.match(recordedInput?.systemPrompt ?? "", /整篇稿件/u);
  assert.match(recordedInput?.systemPrompt ?? "", /医学事实/u);
  assert.match(recordedInput?.systemPrompt ?? "", /不要重复/u);

  const payload = recordedInput?.userPayload as
    | {
        governedCoverage?: {
          failedChecks?: unknown[];
          manualReviewItems?: unknown[];
          qualityIssues?: unknown[];
          knowledgeHits?: unknown[];
          promptGuardrails?: Record<string, unknown>;
        };
      }
    | undefined;

  assert.deepEqual(payload?.governedCoverage?.failedChecks, [
    {
      ruleId: "rule-unit-1",
      severity: "error",
      blockIndex: 0,
      actual: "5 mg per dL",
      expected: "5 mg/dL",
    },
  ]);
  assert.deepEqual(payload?.governedCoverage?.manualReviewItems, [
    {
      ruleId: "rule-manual-1",
      reason: "Confirm unit consistency before release.",
      excerpt: "5 mg per dL",
    },
  ]);
  assert.deepEqual(payload?.governedCoverage?.qualityIssues, [
    {
      severity: "high",
      issueType: "evidence_alignment.overstated_conclusion",
      action: "manual_review",
      explanation:
        "The conclusion language appears stronger than the study design supports.",
      excerpt:
        "The observational study proves the treatment cures every patient.",
      suggestedReplacement:
        "The observational study suggests the treatment may benefit patients.",
    },
  ]);
  assert.deepEqual(payload?.governedCoverage?.knowledgeHits, [
    {
      knowledgeItemId: "knowledge-proof-1",
      title: "ALT first mention",
      summary: "首次出现 ALT 应写全称。",
      canonicalText:
        "Alanine aminotransferase (ALT) should be written in full at first mention.",
      matchReasons: ["terminology expansion"],
    },
  ]);
  assert.deepEqual(payload?.governedCoverage?.promptGuardrails, {
    roleLabel: "医学稿件终校审校员",
    systemInstructions: "Inspect the manuscript against governed editorial controls.",
    taskFrame: "Report residual issues only.",
    manualReviewPolicy: "Escalate medical meaning risk.",
    forbiddenOperations: ["rewrite_manuscript", "meaning_shift"],
    outputContract: "Return issue JSON only.",
  });
});

test("proofreading AI planning forwards governance context without losing whole-document planning controls", async () => {
  let recordedInput: ExecuteMainlineAiInput | undefined;
  const service = new ProofreadingAiPlanService({
    mainlineAiRuntimeExecutor: {
      async executeJson<T>(input: ExecuteMainlineAiInput): Promise<T> {
        recordedInput = structuredClone(input);
        return {
          role: "医学稿件终校审校员",
          summary: "Governed proofreading plan.",
          issues: [],
          manualReviewItems: [],
        } as T;
      },
      async executeMarkdown(): Promise<string> {
        throw new Error("Proofreading AI planning should request JSON.");
      },
    } satisfies MainlineAiRuntimeExecutor,
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
      hardRuleSummary:
        "Rule set v2:\n- results: inspect_statistical_expression requires manual review",
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

  const payload = recordedInput?.userPayload as
    | {
        contextMode?: string;
        fullDocumentText?: string;
        governedCoverage?: {
          qualityIssues?: unknown[];
        };
        governance?: Record<string, unknown>;
        qualityControlChecklist?: {
          reviewMode?: string;
        };
      }
    | undefined;

  assert.equal(payload?.contextMode, "full_text");
  assert.equal(payload?.fullDocumentText, "P < 0.05");
  assert.deepEqual(payload?.governedCoverage?.qualityIssues, [
    {
      severity: "error",
      issueType: "",
      explanation: "Statistical expression requires governed review.",
    },
  ]);
  assert.deepEqual(payload?.governance, {
    hardRuleSummary:
      "Rule set v2:\n- results: inspect_statistical_expression requires manual review",
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
  });
  assert.equal(
    payload?.qualityControlChecklist?.reviewMode,
    "whole_document_single_pass",
  );
});

test("proofreading AI planning removes governed duplicates before keeping residual issues", async () => {
  const service = new ProofreadingAiPlanService({
    mainlineAiRuntimeExecutor: {
      async executeJson<T>(): Promise<T> {
        return {
          role: "医学稿件终校审校员",
          summary: "Detected residual proofreading issues.",
          issues: [
            {
              itemId: "issue-covered-by-rule",
              title: "单位表达不规范",
              description: "This is already covered by a governed failed check.",
              severity: "medium",
              source: "residual_ai",
              issueType: "style",
              blocksFinal: false,
              anchor: {
                blockIndex: 0,
                quote: "5 mg per dL",
                sectionLabel: "results",
              },
              suggestion: {
                action: "replace_text",
                replacementText: "5 mg/dL",
              },
            },
            {
              itemId: "issue-covered-by-quality",
              title: "结论表述过强",
              description: "This duplicates a governed quality finding.",
              severity: "high",
              source: "residual_ai",
              issueType: "medical_logic",
              blocksFinal: false,
              anchor: {
                blockIndex: 1,
                quote:
                  "The observational study proves the treatment cures every patient.",
                sectionLabel: "conclusion",
              },
              suggestion: {
                action: "verify_fact",
                note: "Confirm the claim against the actual study design.",
              },
            },
            {
              itemId: "issue-residual-1",
              title: "术语首次出现需写全称",
              description: "ALT should be expanded on first mention.",
              severity: "medium",
              source: "residual_ai",
              issueType: "terminology",
              blocksFinal: false,
              anchor: {
                blockIndex: 0,
                quote: "ALT",
                sectionLabel: "results",
              },
              suggestion: {
                action: "replace_text",
                replacementText: "Alanine aminotransferase (ALT)",
              },
            },
          ],
          manualReviewItems: [
            "Confirm the ALT expansion against journal style.",
            "Confirm the ALT expansion against journal style.",
          ],
        } as T;
      },
      async executeMarkdown(): Promise<string> {
        throw new Error("Proofreading AI planning should request JSON.");
      },
    } satisfies MainlineAiRuntimeExecutor,
  });

  const result = await service.createPlan({
    manuscriptId: "manuscript-1",
    sourceBlocks: [
      {
        section: "results",
        block_kind: "paragraph",
        text: "Dose was 5 mg per dL and ALT remained stable.",
      },
      {
        section: "conclusion",
        block_kind: "paragraph",
        text: "The observational study proves the treatment cures every patient.",
      },
    ],
    governedFailedChecks: [
      {
        ruleId: "rule-unit-1",
        severity: "error",
        actual: "5 mg per dL",
        expected: "5 mg/dL",
        blockIndex: 0,
      },
    ],
    qualityIssues: [
      {
        severity: "high",
        issue_type: "evidence_alignment.overstated_conclusion",
        explanation:
          "The conclusion language appears stronger than the study design supports.",
        action: "manual_review",
        text_excerpt:
          "The observational study proves the treatment cures every patient.",
      },
    ],
  } as never);

  assert.deepEqual(
    result.issues.map((issue) => issue.itemId),
    ["issue-residual-1"],
  );
  assert.deepEqual(result.corrections, [
    {
      targetText: "ALT",
      replacementText: "Alanine aminotransferase (ALT)",
      category: "terminology",
    },
  ]);
  assert.deepEqual(result.manualReviewItems, [
    "Confirm the ALT expansion against journal style.",
  ]);
});

test("proofreading AI planning upgrades anchors with stage-2a document locator metadata", async () => {
  const service = new ProofreadingAiPlanService({
    mainlineAiRuntimeExecutor: {
      async executeJson<T>(): Promise<T> {
        return {
          role: "医学稿件终校审校员",
          summary: "Anchor metadata normalized.",
          issues: [
            {
              itemId: "issue-paragraph-1",
              title: "句子需要复核",
              description: "Paragraph locator should be derived from the source block.",
              severity: "medium",
              source: "residual_ai",
              issueType: "logic_consistency",
              blocksFinal: false,
              anchor: {
                blockIndex: 1,
                quote: "Dose was 5 mg/dL after normalization.",
                sectionLabel: "results",
              },
              suggestion: {
                action: "verify_fact",
                note: "Review the sentence against the source table.",
              },
            },
            {
              itemId: "issue-table-1",
              title: "表格单元格需要复核",
              description: "Provided table locator should survive normalization.",
              severity: "high",
              source: "residual_ai",
              issueType: "table_consistency",
              blocksFinal: false,
              anchor: {
                blockIndex: 2,
                quote: "ALT",
                sectionLabel: "results",
                blockKind: "table",
                documentLocator: {
                  anchorKind: "table_cell",
                  anchorKey: "table:table-1:alanine_aminotransferase:value",
                  confidence: "provided",
                  tableId: "table-1",
                  tableTarget: "data_cell",
                  rowKey: "alanine_aminotransferase",
                  columnKey: "value",
                },
              },
              suggestion: {
                action: "verify_fact",
                note: "Confirm the ALT cell against the narrative text.",
              },
            },
          ],
          manualReviewItems: [],
        } as T;
      },
      async executeMarkdown(): Promise<string> {
        throw new Error("Proofreading AI planning should request JSON.");
      },
    } satisfies MainlineAiRuntimeExecutor,
  });

  const result = await service.createPlan({
    manuscriptId: "manuscript-1",
    sourceBlocks: [
      {
        section: "results",
        block_kind: "heading",
        text: "Results",
      },
      {
        section: "results",
        block_kind: "paragraph",
        text: "Dose was 5 mg/dL after normalization.",
      },
      {
        section: "results",
        block_kind: "table",
        text: "Table 1. ALT summary",
      },
    ],
  } as never);

  assert.deepEqual(result.issues, [
    {
      itemId: "issue-paragraph-1",
      title: "句子需要复核",
      description: "Paragraph locator should be derived from the source block.",
      severity: "medium",
      source: "residual_ai",
      issueType: "logic_consistency",
      blocksFinal: false,
      anchor: {
        blockIndex: 1,
        quote: "Dose was 5 mg/dL after normalization.",
        sectionLabel: "results",
        blockKind: "paragraph",
        documentLocator: {
          anchorKind: "paragraph",
          anchorKey: "paragraph:results:0",
          confidence: "derived",
          blockIndex: 1,
          sectionLabel: "results",
          ordinalWithinSection: 0,
        },
      },
      suggestion: {
        action: "verify_fact",
        note: "Review the sentence against the source table.",
      },
    },
    {
      itemId: "issue-table-1",
      title: "表格单元格需要复核",
      description: "Provided table locator should survive normalization.",
      severity: "high",
      source: "residual_ai",
      issueType: "table_consistency",
      blocksFinal: false,
      anchor: {
        blockIndex: 2,
        quote: "ALT",
        sectionLabel: "results",
        blockKind: "table",
        documentLocator: {
          anchorKind: "table_cell",
          anchorKey: "table:table-1:alanine_aminotransferase:value",
          confidence: "provided",
          tableId: "table-1",
          tableTarget: "data_cell",
          rowKey: "alanine_aminotransferase",
          columnKey: "value",
        },
      },
      suggestion: {
        action: "verify_fact",
        note: "Confirm the ALT cell against the narrative text.",
      },
    },
  ]);
});

test("proofreading AI planning upgrades generic block locators when source blocks provide richer anchor kinds", async () => {
  const service = new ProofreadingAiPlanService({
    mainlineAiRuntimeExecutor: {
      async executeJson<T>(): Promise<T> {
        return {
          role: "医学稿件终校审校员",
          summary: "Generic block locator should be upgraded.",
          issues: [
            {
              itemId: "issue-paragraph-block-locator",
              title: "段落定位需要升级",
              description:
                "A generic block locator should not survive when the source block is a paragraph.",
              severity: "high",
              source: "residual_ai",
              issueType: "medical_fact_error",
              blocksFinal: false,
              anchor: {
                blockIndex: 2,
                quote: "the unit expression 5 mg per dL should be normalized.",
                sectionLabel: "front_matter",
                blockKind: "paragraph",
                documentLocator: {
                  anchorKind: "block",
                  anchorKey: "block-2",
                  confidence: "provided",
                  blockIndex: 2,
                  sectionLabel: "front_matter",
                  ordinalWithinSection: 2,
                },
              },
              suggestion: {
                action: "verify_fact",
                note: "Confirm the correct clinical unit before release.",
              },
            },
          ],
          manualReviewItems: [],
        } as T;
      },
      async executeMarkdown(): Promise<string> {
        throw new Error("Proofreading AI planning should request JSON.");
      },
    } satisfies MainlineAiRuntimeExecutor,
  });

  const result = await service.createPlan({
    manuscriptId: "manuscript-1",
    sourceBlocks: [
      {
        section: "front_matter",
        block_kind: "paragraph",
        text: "Proofreading Browser Smoke",
      },
      {
        section: "front_matter",
        block_kind: "paragraph",
        text: "This is a proofreading smoke test manuscript for validating the detail workbench surface.",
      },
      {
        section: "front_matter",
        block_kind: "paragraph",
        text: "ALT remained stable during follow-up, but the unit expression 5 mg per dL should be normalized.",
      },
    ],
  } as never);

  assert.deepEqual(result.issues, [
    {
      itemId: "issue-paragraph-block-locator",
      title: "段落定位需要升级",
      description:
        "A generic block locator should not survive when the source block is a paragraph.",
      severity: "high",
      source: "residual_ai",
      issueType: "medical_fact_error",
      blocksFinal: false,
      anchor: {
        blockIndex: 2,
        quote: "the unit expression 5 mg per dL should be normalized.",
        sectionLabel: "front_matter",
        blockKind: "paragraph",
        documentLocator: {
          anchorKind: "paragraph",
          anchorKey: "paragraph:front_matter:2",
          confidence: "derived",
          blockIndex: 2,
          sectionLabel: "front_matter",
          ordinalWithinSection: 2,
        },
      },
      suggestion: {
        action: "verify_fact",
        note: "Confirm the correct clinical unit before release.",
      },
    },
  ]);
});

test("proofreading AI planning keeps whole-document mode for long manuscripts by switching to a document map payload", async () => {
  let recordedInput: ExecuteMainlineAiInput | undefined;
  const service = new ProofreadingAiPlanService({
    mainlineAiRuntimeExecutor: {
      async executeJson<T>(input: ExecuteMainlineAiInput): Promise<T> {
        recordedInput = structuredClone(input);
        return {
          role: "医学稿件终校审校员",
          summary: "Long manuscript residual review completed.",
          issues: [
            {
              itemId: "issue-long-1",
              title: "结论与结果措辞需要复核",
              description: "Cross-section logic should be reviewed.",
              severity: "high",
              source: "residual_ai",
              issueType: "logic_consistency",
              blocksFinal: false,
              anchor: {
                blockIndex: 179,
                quote: "The conclusion overstates the observed outcome.",
                sectionLabel: "conclusion",
              },
              suggestion: {
                action: "verify_fact",
                note: "Check consistency between Results and Conclusion.",
              },
            },
          ],
          manualReviewItems: ["Review the conclusion against the results summary."],
        } as T;
      },
      async executeMarkdown(): Promise<string> {
        throw new Error("Proofreading AI planning should request JSON.");
      },
    } satisfies MainlineAiRuntimeExecutor,
  });

  const sourceBlocks = Array.from({ length: 180 }, (_, index) => ({
    section: index < 60 ? "methods" : index < 140 ? "results" : "conclusion",
    block_kind: "paragraph",
    text:
      index === 179
        ? "The conclusion overstates the observed outcome. ".repeat(18)
        : `Block ${index + 1} contains detailed manuscript content about protocol adherence, measured outcomes, dosage units, adverse events, and follow-up windows. `.repeat(
            10,
          ),
  }));

  const result = await service.createPlan({
    manuscriptId: "manuscript-long-1",
    sourceFileName: "long-clinical-study.docx",
    sourceBlocks,
  } as never);

  assert.equal(result.issues[0]?.itemId, "issue-long-1");
  const payload = recordedInput?.userPayload as
    | {
        contextMode?: string;
        fullDocumentText?: string;
        fullDocumentBlocks?: Array<Record<string, unknown>>;
        documentMap?: {
          sectionOutline?: unknown[];
          crossSectionSignals?: string[];
          keyTerms?: string[];
          blockCatalog?: Array<Record<string, unknown>>;
        };
      }
    | undefined;

  assert.equal(payload?.contextMode, "document_map");
  assert.equal(payload?.fullDocumentText, undefined);
  assert.ok(Array.isArray(payload?.documentMap?.sectionOutline));
  assert.ok(Array.isArray(payload?.documentMap?.blockCatalog));
  assert.equal(payload?.documentMap?.blockCatalog?.length, 180);
  assert.ok(
    (payload?.documentMap?.crossSectionSignals?.length ?? 0) > 0,
    "Expected long-document mode to keep cross-section continuity signals.",
  );
  assert.ok(
    (payload?.documentMap?.keyTerms?.length ?? 0) > 0,
    "Expected long-document mode to retain global term context.",
  );
  assert.ok(
    Array.isArray(payload?.fullDocumentBlocks) &&
      payload.fullDocumentBlocks.every((block) => typeof block.blockIndex === "number"),
  );
});

test("proofreading AI planning publishes a structured quality-control checklist for regression-critical proofreading risks", async () => {
  let recordedInput: ExecuteMainlineAiInput | undefined;
  const service = new ProofreadingAiPlanService({
    mainlineAiRuntimeExecutor: {
      async executeJson<T>(input: ExecuteMainlineAiInput): Promise<T> {
        recordedInput = structuredClone(input);
        return {
          role: "医学稿件终校审校员",
          summary: "No additional residual issues.",
          issues: [],
          manualReviewItems: [],
        } as T;
      },
      async executeMarkdown(): Promise<string> {
        throw new Error("Proofreading AI planning should request JSON.");
      },
    } satisfies MainlineAiRuntimeExecutor,
  });

  await service.createPlan({
    manuscriptId: "manuscript-quality-control-1",
    sourceBlocks: [
      {
        section: "abstract",
        block_kind: "paragraph",
        text: "ALT remained stable after 24 weeks of follow-up.",
      },
      {
        section: "conclusion",
        block_kind: "paragraph",
        text: "The study proves the intervention reduces MACE.",
      },
    ],
  } as never);

  const payload = recordedInput?.userPayload as
    | {
        qualityControlChecklist?: {
          reviewMode?: string;
          governedCoveragePolicy?: string;
          forbiddenBehaviors?: string[];
          regressionFocuses?: Array<{
            id?: string;
            requiredChecks?: string[];
          }>;
        };
      }
    | undefined;

  assert.deepEqual(payload?.qualityControlChecklist, {
    reviewMode: "whole_document_single_pass",
    governedCoveragePolicy: "governed_coverage_is_already_handled",
    forbiddenBehaviors: [
      "rewrite_full_manuscript",
      "segment_then_merge",
      "duplicate_governed_findings",
      "invent_missing_evidence",
    ],
    regressionFocuses: [
      {
        id: "cross_section_contradiction",
        requiredChecks: [
          "study_design_consistency",
          "population_definition_consistency",
          "sample_size_consistency",
          "follow_up_window_consistency",
        ],
      },
      {
        id: "conclusion_overclaim",
        requiredChecks: [
          "results_vs_conclusion_alignment",
          "study_design_vs_claim_strength",
        ],
      },
      {
        id: "terminology_consistency",
        requiredChecks: [
          "first_use_expansion",
          "abbreviation_casing",
          "unit_style_consistency",
        ],
      },
    ],
  });
});

test("proofreading AI planning adds targeted cross-section contradiction signals for long manuscripts", async () => {
  let recordedInput: ExecuteMainlineAiInput | undefined;
  const service = new ProofreadingAiPlanService({
    mainlineAiRuntimeExecutor: {
      async executeJson<T>(input: ExecuteMainlineAiInput): Promise<T> {
        recordedInput = structuredClone(input);
        return {
          role: "医学稿件终校审校员",
          summary: "Long manuscript residual review completed.",
          issues: [],
          manualReviewItems: [],
        } as T;
      },
      async executeMarkdown(): Promise<string> {
        throw new Error("Proofreading AI planning should request JSON.");
      },
    } satisfies MainlineAiRuntimeExecutor,
  });

  const sourceBlocks = [
    {
      section: "abstract",
      block_kind: "paragraph",
      text: "A randomized double-blind trial enrolled 162 elderly patients and followed them for 12 months.",
    },
    {
      section: "methods",
      block_kind: "paragraph",
      text: "Methods describe 148 participants, single-center enrollment, and a 24-week follow-up window.",
    },
    {
      section: "results",
      block_kind: "paragraph",
      text: "Results report 156 analyzed participants with LDL-C and hs-CRP outcomes through week 24.",
    },
    {
      section: "conclusion",
      block_kind: "paragraph",
      text: "The conclusion states the pathway clearly lowers MACE and should be widely promoted.",
    },
  ].flatMap((block) =>
    Array.from({ length: 90 }, () => ({
      ...block,
    })),
  );

  await service.createPlan({
    manuscriptId: "manuscript-quality-control-long-1",
    sourceBlocks,
  } as never);

  const payload = recordedInput?.userPayload as
    | {
        documentMap?: {
          crossSectionSignals?: string[];
        };
      }
    | undefined;

  assert.ok(
    payload?.documentMap?.crossSectionSignals?.some((signal) => /样本量/u.test(signal)),
    "Expected long-manuscript planning to call out sample-size consistency checks.",
  );
  assert.ok(
    payload?.documentMap?.crossSectionSignals?.some((signal) => /入组人群/u.test(signal)),
    "Expected long-manuscript planning to call out population-definition checks.",
  );
  assert.ok(
    payload?.documentMap?.crossSectionSignals?.some((signal) => /随访/u.test(signal)),
    "Expected long-manuscript planning to call out follow-up-window checks.",
  );
  assert.ok(
    payload?.documentMap?.crossSectionSignals?.some((signal) => /结论/u.test(signal)),
    "Expected long-manuscript planning to call out conclusion-strength checks.",
  );
});
