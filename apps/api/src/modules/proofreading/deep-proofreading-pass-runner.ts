import type { EditorialTextBlock } from "../editorial-execution/types.ts";
import type {
  DeepProofreadingIssueCard,
  DeepProofreadingKnowledgeSelection,
  DeepProofreadingRuleSelection,
  DeepProofreadingSlice,
} from "./deep-proofreading-contracts.ts";
import type { CreateProofreadingAiPlanInput, ProofreadingAiPlanService } from "./proofreading-ai-plan-service.ts";
import type { ProofreadingDeepPassKind } from "./proofreading-pass-run-record.ts";

export async function runDeepProofreadingAiPasses(input: {
  manuscriptId: string;
  sourceFileName?: string;
  sourceBlocks: readonly EditorialTextBlock[];
  slices: readonly DeepProofreadingSlice[];
  governedFailedChecks?: CreateProofreadingAiPlanInput["governedFailedChecks"];
  governedManualReviewItems?: CreateProofreadingAiPlanInput["governedManualReviewItems"];
  qualityIssues?: CreateProofreadingAiPlanInput["qualityIssues"];
  knowledgeHits?: CreateProofreadingAiPlanInput["knowledgeHits"];
  promptGuardrails?: CreateProofreadingAiPlanInput["promptGuardrails"];
  governanceContext?: CreateProofreadingAiPlanInput["governanceContext"];
  factLedgerSummary?: Record<string, unknown>;
  activatedRules?: readonly DeepProofreadingRuleSelection[];
  budgetedKnowledge?: readonly DeepProofreadingKnowledgeSelection[];
  proofreadingAiPlanService: Pick<ProofreadingAiPlanService, "createPlan">;
}): Promise<{
  issues: DeepProofreadingIssueCard[];
  passRuns: Array<{
    passKind: ProofreadingDeepPassKind;
    sliceId: string;
    status: "completed" | "failed";
    issueCount: number;
  }>;
}> {
  const issues: DeepProofreadingIssueCard[] = [];
  const passRuns: Array<{
    passKind: ProofreadingDeepPassKind;
    sliceId: string;
    status: "completed" | "failed";
    issueCount: number;
  }> = [];

  for (const slice of input.slices) {
    for (const passKind of slice.passKinds) {
      try {
        const plan = await input.proofreadingAiPlanService.createPlan({
          manuscriptId: input.manuscriptId,
          sourceFileName: input.sourceFileName,
          sourceBlocks: input.sourceBlocks.map((block) => ({ ...block })),
          governedFailedChecks: input.governedFailedChecks,
          governedManualReviewItems: input.governedManualReviewItems,
          qualityIssues: input.qualityIssues,
          knowledgeHits: input.knowledgeHits,
          promptGuardrails: input.promptGuardrails,
          governanceContext: input.governanceContext,
          passFocus: {
            passNo: passRuns.length + 1,
            passKind,
            instruction: buildPassInstruction(passKind),
          },
          sliceContext: {
            id: slice.id,
            sliceKind: slice.sliceKind,
            text: slice.text,
            tableIds: slice.tableIds,
            sourceBlockIndexes: slice.sourceBlockIndexes,
          },
          factLedgerSummary: input.factLedgerSummary,
          activatedRules: input.activatedRules
            ?.filter((rule) => rule.passKind === passKind && rule.sliceId === slice.id)
            .map((rule) => ({ ...rule })),
          budgetedKnowledge: input.budgetedKnowledge
            ?.filter(
              (knowledge) =>
                knowledge.passKind === passKind && knowledge.sliceId === slice.id,
            )
            .map((knowledge) => ({ ...knowledge })),
        } satisfies CreateProofreadingAiPlanInput);
        const converted = plan.issues.map((issue): DeepProofreadingIssueCard => ({
          ...issue,
          source: passKind === "residual_synthesis" ? "residual_ai" : "ai_pass",
          passKind,
          sliceId: slice.id,
          relatedFactIds: [],
          supportingEvidence: [],
          conflictFlags: [],
        }));
        issues.push(...converted);
        passRuns.push({
          passKind,
          sliceId: slice.id,
          status: "completed",
          issueCount: converted.length,
        });
      } catch {
        passRuns.push({
          passKind,
          sliceId: slice.id,
          status: "failed",
          issueCount: 0,
        });
      }
    }
  }

  return { issues, passRuns };
}

function buildPassInstruction(passKind: ProofreadingDeepPassKind): string {
  switch (passKind) {
    case "medical_facts_and_terminology":
      return "核对医学事实、术语、缩略语与前后一致性。";
    case "structure_logic_and_consistency":
      return "核对结构、逻辑、上下文和跨章节一致性。";
    case "data_statistics_units_and_tables":
      return "核对数据、统计、单位、表格与正文一致性。";
    case "language_style_punctuation_and_format":
      return "核对语言、标点、格式和期刊表达规范。";
    case "residual_synthesis":
      return "只发现前序层未覆盖的残差问题，避免重复。";
  }
}
