import type { EditorialRuleRecord } from "../editorial-rules/editorial-rule-record.ts";
import type { EditorialTextBlock } from "../editorial-execution/types.ts";
import type { KnowledgeRecord } from "../knowledge/knowledge-record.ts";
import type { KnowledgeRetrievalService } from "../knowledge-retrieval/knowledge-retrieval-service.ts";
import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { DocumentStructureSnapshot } from "../document-pipeline/document-structure-service.ts";
import type {
  DeepProofreadingConfidence,
  DeepProofreadingDiagnostics,
  DeepProofreadingIssueCard,
  DeepProofreadingKnowledgeSelection,
  DeepProofreadingPassDiagnostic,
  DeepProofreadingRuleSelection,
  DeepProofreadingSliceKind,
} from "./deep-proofreading-contracts.ts";
import { analyzeProofreadingDocumentSemantics } from "./document-semantic-pre-analyzer.ts";
import { buildGlobalFactLedger } from "./global-fact-ledger.ts";
import { selectKnowledgeBudget } from "./knowledge-budget-service.ts";
import { runDeepProofreadingAiPasses } from "./deep-proofreading-pass-runner.ts";
import { assembleDeepProofreadingIssueCards } from "./proofreading-issue-card-assembler.ts";
import { buildProofreadingSlices } from "./proofreading-slice-builder.ts";
import { activateProofreadingRules } from "./rule-activation-service.ts";
import { retrieveRuleKnowledgeCandidates } from "./rule-knowledge-retrieval-service.ts";
import { runTableDataDeterministicChecks } from "./table-data-deterministic-checker.ts";
import type { ProofreadingAiPlan, ProofreadingIssue } from "./proofreading-issue-contract.ts";
import type {
  CreateProofreadingAiPlanInput,
  ProofreadingAiPlanService,
} from "./proofreading-ai-plan-service.ts";
import type { ProofreadingDeepPassKind } from "./proofreading-pass-run-record.ts";

export interface DeepProofreadingRunDiagnosticsPayload {
  schema: "deep_proofreading_run.v1";
  factLedgerSummary: {
    factCount: number;
    conflictCount: number;
  };
  tableFidelityDiagnostics: {
    tableCount: number;
    confidenceCounts: Record<DeepProofreadingConfidence, number>;
    unsupportedStructureCount: number;
    lowConfidenceReviewOnly: boolean;
  };
  selectedRuleDiagnostics: {
    totalSelected: number;
    byPassKind: Partial<Record<ProofreadingDeepPassKind, number>>;
  };
  selectedKnowledgeBudgetDiagnostics: {
    totalSelected: number;
    totalExcluded: number;
    estimatedTokens: number;
    byPassKind: Partial<Record<ProofreadingDeepPassKind, number>>;
  };
  passRuns: Array<{
    passKind: ProofreadingDeepPassKind;
    sliceId: string;
    status: "completed" | "failed";
    issueCount: number;
  }>;
  stageDiagnostics: DeepProofreadingPassDiagnostic[];
  diagnostics: DeepProofreadingDiagnostics;
  fallbackReasons: string[];
}

export interface DeepProofreadingOrchestratorRunInput {
  manuscriptId: string;
  sourceFileName?: string;
  manuscriptType?: ManuscriptType;
  templateFamilyId?: string;
  journalTemplateId?: string;
  journalKey?: string;
  medicalPackageIds?: string[];
  generalPackageIds?: string[];
  sourceBlocks: readonly EditorialTextBlock[];
  documentStructure?: DocumentStructureSnapshot;
  rules?: readonly EditorialRuleRecord[];
  knowledge?: readonly KnowledgeRecord[];
  governedFailedChecks?: CreateProofreadingAiPlanInput["governedFailedChecks"];
  governedManualReviewItems?: CreateProofreadingAiPlanInput["governedManualReviewItems"];
  qualityIssues?: CreateProofreadingAiPlanInput["qualityIssues"];
  knowledgeHits?: CreateProofreadingAiPlanInput["knowledgeHits"];
  promptGuardrails?: CreateProofreadingAiPlanInput["promptGuardrails"];
  governanceContext?: CreateProofreadingAiPlanInput["governanceContext"];
}

export interface DeepProofreadingOrchestratorRunResult {
  plan: ProofreadingAiPlan;
  issueCards: DeepProofreadingIssueCard[];
  deepProofreading: DeepProofreadingRunDiagnosticsPayload;
}

export interface DeepProofreadingOrchestratorOptions {
  proofreadingAiPlanService: Pick<ProofreadingAiPlanService, "createPlan">;
  knowledgeRetrievalService?: Pick<
    KnowledgeRetrievalService,
    "rankIndexEntriesForContext"
  >;
  now?: () => Date;
}

export class DeepProofreadingOrchestrator {
  private readonly proofreadingAiPlanService: Pick<
    ProofreadingAiPlanService,
    "createPlan"
  >;
  private readonly knowledgeRetrievalService?: Pick<
    KnowledgeRetrievalService,
    "rankIndexEntriesForContext"
  >;
  private readonly now: () => Date;

  constructor(options: DeepProofreadingOrchestratorOptions) {
    this.proofreadingAiPlanService = options.proofreadingAiPlanService;
    this.knowledgeRetrievalService = options.knowledgeRetrievalService;
    this.now = options.now ?? (() => new Date());
  }

  async run(
    input: DeepProofreadingOrchestratorRunInput,
  ): Promise<DeepProofreadingOrchestratorRunResult> {
    const startedAt = this.now();
    const tables = input.documentStructure?.tables ?? [];
    const semanticAnalysis = analyzeProofreadingDocumentSemantics({
      blocks: input.sourceBlocks,
      tables,
    });
    const factLedger = buildGlobalFactLedger({
      blocks: input.sourceBlocks,
      tables,
      semanticAnalysis,
    });
    const slices = buildProofreadingSlices({
      blocks: input.sourceBlocks,
      tables,
      semanticAnalysis,
      factLedger,
    });
    const fallbackReasons: string[] = [];
    const selectedRules: DeepProofreadingRuleSelection[] = [];
    const selectedKnowledge: DeepProofreadingKnowledgeSelection[] = [];
    let excludedKnowledgeCount = 0;

    for (const slice of slices) {
      for (const passKind of slice.passKinds) {
        const retrieved = await retrieveRuleKnowledgeCandidates({
          context: {
            module: "proofreading",
            manuscriptType: input.manuscriptType,
            templateFamilyId: input.templateFamilyId,
            journalTemplateId: input.journalTemplateId,
            journalKey: input.journalKey,
            medicalPackageIds: input.medicalPackageIds,
            generalPackageIds: input.generalPackageIds,
          },
          slice,
          passKind,
          rules: input.rules,
          knowledge: input.knowledge,
          knowledgeRetrievalService: this.knowledgeRetrievalService,
        });
        fallbackReasons.push(...retrieved.diagnostics.fallbackReasons);

        const activatedRules = activateProofreadingRules({
          passKind,
          slice,
          candidates: retrieved.candidateRules.map((candidate) => ({
            ruleId: candidate.ruleId,
            score: candidate.score,
            reasons: candidate.reasons,
          })),
        });
        selectedRules.push(...activatedRules);

        const budget = selectKnowledgeBudget({
          candidates: retrieved.candidateKnowledge.map((candidate) => ({
            knowledgeItemId: candidate.knowledgeItemId,
            score: candidate.score,
            reasons: candidate.reasons,
            title: candidate.knowledge.title,
            summary: candidate.knowledge.summary,
            promptSnippet:
              candidate.knowledge.knowledge_kind === "prompt_snippet"
                ? candidate.knowledge.canonical_text
                : candidate.knowledge.summary,
            knowledgeKind: candidate.knowledge.knowledge_kind,
            estimatedTokens: estimatePromptTokens(
              candidate.knowledge.summary ?? candidate.knowledge.canonical_text,
            ),
          })),
        });
        excludedKnowledgeCount += budget.excluded.length;
        selectedKnowledge.push(
          ...budget.selected.map((entry) => ({
            knowledgeItemId: entry.knowledgeItemId,
            passKind,
            sliceId: slice.id,
            title: entry.title,
            summary: entry.summary,
            promptSnippet: entry.promptSnippet,
            score: entry.score,
            reasons: entry.reasons,
            estimatedTokens: entry.estimatedTokens,
          })),
        );
      }
    }

    const deterministicIssues = runTableDataDeterministicChecks({
      factLedger,
      tables,
    });
    const aiPasses = await runDeepProofreadingAiPasses({
      manuscriptId: input.manuscriptId,
      sourceFileName: input.sourceFileName,
      sourceBlocks: input.sourceBlocks,
      slices,
      governedFailedChecks: input.governedFailedChecks,
      governedManualReviewItems: input.governedManualReviewItems,
      qualityIssues: input.qualityIssues,
      knowledgeHits: input.knowledgeHits,
      promptGuardrails: input.promptGuardrails,
      governanceContext: input.governanceContext,
      factLedgerSummary: factLedger.diagnostics,
      activatedRules: selectedRules,
      budgetedKnowledge: selectedKnowledge,
      proofreadingAiPlanService: this.proofreadingAiPlanService,
    });
    const issueCards = assembleDeepProofreadingIssueCards({
      deterministicIssues,
      aiIssues: aiPasses.issues.filter((issue) => issue.source === "ai_pass"),
      residualIssues: aiPasses.issues.filter((issue) => issue.source === "residual_ai"),
    });
    const stageDiagnostics = buildStageDiagnostics({
      startedAt,
      finishedAt: this.now(),
      semanticEntityCount: semanticAnalysis.diagnostics.entityCount,
      factCount: factLedger.diagnostics.factCount,
      conflictCount: factLedger.diagnostics.conflictCount,
      finalIssueCount: issueCards.length,
    });
    const tableFidelityDiagnostics = buildTableFidelityDiagnostics(
      input.documentStructure,
    );
    const deepProofreading: DeepProofreadingRunDiagnosticsPayload = {
      schema: "deep_proofreading_run.v1",
      factLedgerSummary: {
        factCount: factLedger.diagnostics.factCount,
        conflictCount: factLedger.diagnostics.conflictCount,
      },
      tableFidelityDiagnostics,
      selectedRuleDiagnostics: {
        totalSelected: selectedRules.length,
        byPassKind: countByPassKind(selectedRules),
      },
      selectedKnowledgeBudgetDiagnostics: {
        totalSelected: selectedKnowledge.length,
        totalExcluded: excludedKnowledgeCount,
        estimatedTokens: selectedKnowledge.reduce(
          (sum, item) => sum + (item.estimatedTokens ?? 0),
          0,
        ),
        byPassKind: countByPassKind(selectedKnowledge),
      },
      passRuns: aiPasses.passRuns,
      stageDiagnostics,
      diagnostics: {
        passCounts: countPassStatuses(aiPasses.passRuns, stageDiagnostics),
        sliceCounts: countSliceKinds(slices),
        selectedRuleCounts: {
          total: selectedRules.length,
          byPassKind: countByPassKind(selectedRules),
        },
        selectedKnowledgeCounts: {
          total: selectedKnowledge.length,
          byPassKind: countByPassKind(selectedKnowledge),
        },
        tableConfidenceCounts: tableFidelityDiagnostics.confidenceCounts,
        tokenEstimates: {
          prompt: selectedKnowledge.reduce(
            (sum, item) => sum + (item.estimatedTokens ?? 0),
            0,
          ),
          completion: aiPasses.passRuns.length * 500,
        },
        modelCallEstimates: {
          total: aiPasses.passRuns.length,
        },
        fallbackReasons: [...new Set(fallbackReasons)],
      },
      fallbackReasons: [...new Set(fallbackReasons)],
    };

    return {
      plan: {
        role: "医学稿件终校审校员",
        summary: `Deep proofreading produced ${issueCards.length} candidate issue(s).`,
        issues: issueCards.map((issue) => issue as ProofreadingIssue),
        manualReviewItems: [],
      },
      issueCards,
      deepProofreading,
    };
  }
}

function estimatePromptTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 2));
}

function countByPassKind(
  items: readonly { passKind: ProofreadingDeepPassKind }[],
): Partial<Record<ProofreadingDeepPassKind, number>> {
  return items.reduce<Partial<Record<ProofreadingDeepPassKind, number>>>(
    (counts, item) => {
      counts[item.passKind] = (counts[item.passKind] ?? 0) + 1;
      return counts;
    },
    {},
  );
}

function countSliceKinds(
  slices: readonly { sliceKind: DeepProofreadingSliceKind }[],
): Partial<Record<DeepProofreadingSliceKind, number>> {
  return slices.reduce<Partial<Record<DeepProofreadingSliceKind, number>>>(
    (counts, slice) => {
      counts[slice.sliceKind] = (counts[slice.sliceKind] ?? 0) + 1;
      return counts;
    },
    {},
  );
}

function countPassStatuses(
  passRuns: readonly { status: "completed" | "failed" }[],
  stageDiagnostics: readonly DeepProofreadingPassDiagnostic[],
): DeepProofreadingDiagnostics["passCounts"] {
  return {
    completed:
      passRuns.filter((pass) => pass.status === "completed").length +
      stageDiagnostics.filter((stage) => stage.status === "completed").length,
    failed:
      passRuns.filter((pass) => pass.status === "failed").length +
      stageDiagnostics.filter((stage) => stage.status === "failed").length,
    skipped: stageDiagnostics.filter((stage) => stage.status === "skipped").length,
  };
}

function buildStageDiagnostics(input: {
  startedAt: Date;
  finishedAt: Date;
  semanticEntityCount: number;
  factCount: number;
  conflictCount: number;
  finalIssueCount: number;
}): DeepProofreadingPassDiagnostic[] {
  const durationMs = Math.max(
    0,
    input.finishedAt.getTime() - input.startedAt.getTime(),
  );
  return [
    {
      passKind: "document_structure_extraction",
      status: "completed",
      durationMs,
    },
    {
      passKind: "semantic_pre_analysis",
      status: "completed",
      durationMs,
      issueCount: input.semanticEntityCount,
    },
    {
      passKind: "global_fact_ledger_generation",
      status: "completed",
      durationMs,
      issueCount: input.conflictCount,
    },
    {
      passKind: "final_regression_preparation",
      status: "completed",
      durationMs,
      issueCount: input.finalIssueCount,
    },
  ];
}

function buildTableFidelityDiagnostics(
  documentStructure: DocumentStructureSnapshot | undefined,
): DeepProofreadingRunDiagnosticsPayload["tableFidelityDiagnostics"] {
  const confidenceCounts: Record<DeepProofreadingConfidence, number> = {
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const table of documentStructure?.tables ?? []) {
    confidenceCounts[inferTableConfidence(table)] += 1;
  }
  const unsupportedStructureCount =
    documentStructure?.tables.reduce(
      (count, table) => count + (table.unsupported_fact_groups?.length ?? 0),
      0,
    ) ?? 0;
  return {
    tableCount: documentStructure?.tables.length ?? 0,
    confidenceCounts,
    unsupportedStructureCount,
    lowConfidenceReviewOnly: confidenceCounts.low > 0,
  };
}

function inferTableConfidence(
  table: DocumentStructureSnapshot["tables"][number],
): DeepProofreadingConfidence {
  if (
    (table.grid_cells ?? []).some((cell) =>
      (cell.object_evidence ?? []).some(
        (object) =>
          object.object_kind === "ocr_image_table" ||
          object.object_kind === "image" ||
          object.object_kind === "drawing",
      ),
    )
  ) {
    return "low";
  }
  if (
    (table.unsupported_fact_groups?.length ?? 0) > 0 ||
    (table.grid_cells ?? []).some((cell) => (cell.style_runs?.length ?? 0) > 0)
  ) {
    return "medium";
  }
  return "high";
}
