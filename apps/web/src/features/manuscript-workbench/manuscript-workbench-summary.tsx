import type { ReactNode } from "react";
import type {
  GovernedExecutionContextSummary,
  GovernedExecutionModuleSummary,
  GovernedKnowledgeBindingMatchSummary,
  GovernedKnowledgeSelectionSummary,
  GovernedResolvedRuleSummary,
} from "@medical/contracts";
import { formatWorkbenchHash } from "../../app/workbench-routing.ts";
import { resolveBrowserApiUrl } from "../../lib/browser-http-client.ts";
import type { ManualFeedbackCategory } from "../feedback-governance/index.ts";
import type {
  DocumentCurrentExportSelectionViewModel,
  DocumentAssetExportViewModel,
  DocumentAssetViewModel,
  DocumentResultAssetMatrixViewModel,
  JobExecutionTrackingObservationViewModel,
  JobViewModel,
  LinkedAgentExecutionRecoverySummaryViewModel,
  MainlineAttentionItemViewModel,
  MainlineAttemptLedgerItemViewModel,
  MainlineSettlementModule,
  ManuscriptMainlineAttentionHandoffPackViewModel,
  ManuscriptMainlineAttemptLedgerViewModel,
  ManuscriptMainlineReadinessSummaryViewModel,
  ManuscriptModuleExecutionOverviewViewModel,
  ModuleExecutionOverviewViewModel,
  ModuleMainlineSettlementDerivedStatus,
  RuntimeBindingReadinessReportViewModel,
} from "../manuscripts/index.ts";
import {
  formatResidualReviewSourceStatusLabel,
} from "../review-items/index.ts";
import type { ModuleJobViewModel } from "../screening/index.ts";
import {
  buildHighRiskReviewItemsFromJob,
  collectHighRiskEvidenceFromJob,
  formatHighRiskRecommendedRouteLabel,
  formatHighRiskReviewPostureLabel,
} from "./manuscript-workbench-high-risk-review.ts";
import {
  buildWorkbenchAssetDisplayName,
  formatWorkbenchAssetTypeLabel,
  resolveWorkbenchAssetDownloadLabel,
} from "./manuscript-workbench-asset-labels.ts";
import {
  buildEditingCompletionGateSummary,
  buildWorkbenchAssetDetailHref,
} from "./manuscript-workbench-detail.tsx";
import type { ManuscriptWorkbenchHighRiskReviewItemViewModel } from "./manuscript-workbench-high-risk-review.ts";
import type {
  ManuscriptWorkbenchKnowledgeReferenceViewModel,
  ManuscriptWorkbenchMode,
  ManuscriptWorkbenchReadOnlyExecutionContextViewModel,
  ManuscriptWorkbenchWorkspace,
} from "./manuscript-workbench-controller.ts";
import {
  formatWorkbenchProviderReadinessLabel,
  formatWorkbenchRuntimeBindingReadinessLabel,
} from "./manuscript-workbench-execution-labels.ts";
import type { ManuscriptWorkbenchProofreadingGovernanceHandoffViewModel } from "./manuscript-workbench-governance-handoff.ts";

type AnyWorkbenchJob = JobViewModel | ModuleJobViewModel;

const MAINLINE_SETTLEMENT_MODULE_ORDER: readonly MainlineSettlementModule[] = [
  "screening",
  "editing",
  "proofreading",
];

export interface WorkbenchActionResultDetail {
  label: string;
  value: string;
}

export interface WorkbenchActionResultViewModel {
  tone: "success" | "error";
  actionLabel: string;
  message: string;
  details: WorkbenchActionResultDetail[];
}

export interface WorkbenchStatusPillViewModel {
  tone: "neutral" | "success" | "error";
  label: string;
}

export interface ManuscriptWorkbenchManualFeedbackViewModel {
  selectedCategory: ManualFeedbackCategory | "";
  note: string;
  isSubmitting: boolean;
  lastSubmitted?: {
    feedbackCategory: ManualFeedbackCategory;
    feedbackRecordId: string;
    reviewItemId: string;
    recommendedRoute?:
      | "rule_candidate"
      | "knowledge_candidate"
      | "prompt_template_candidate";
  };
  highRiskReviewItems?: ManuscriptWorkbenchHighRiskReviewItemViewModel[];
  onCategoryChange(category: ManualFeedbackCategory): void;
  onNoteChange(note: string): void;
  onSubmit(): void;
  onSubmitHighRiskItem?(item: ManuscriptWorkbenchHighRiskReviewItemViewModel): void;
  onRecordManualOnly?(item: ManuscriptWorkbenchHighRiskReviewItemViewModel): void;
}

export interface ManuscriptWorkbenchProofreadingGovernanceActionsViewModel {
  isSubmitting: boolean;
  activeItemId?: string;
  onRouteToKnowledgeCandidate(itemId: string): void;
}

export function buildLatestJobPostureDetails(
  latestJob: JobViewModel | ModuleJobViewModel | null,
  overview?: ManuscriptModuleExecutionOverviewViewModel,
): WorkbenchActionResultDetail[] {
  return buildJobPostureDetails(latestJob, "最近任务", overview);
}

export function buildJobReviewEvidenceDetails(
  latestJob: JobViewModel | ModuleJobViewModel | null,
  knowledgeReferences?: Record<string, ManuscriptWorkbenchKnowledgeReferenceViewModel>,
): WorkbenchActionResultDetail[] {
  if (!latestJob) {
    return [];
  }

  const payload = latestJob.payload;
  const manualReviewItems = getJobManualReviewItems(payload);
  const executionTracking = getJobExecutionTracking(latestJob);
  const snapshot =
    executionTracking?.observation_status === "reported"
      ? executionTracking.snapshot
      : undefined;
  const knowledgeItemIds =
    snapshot?.knowledge_item_ids ?? getPayloadStringArray(payload, "knowledgeItemIds");
  const highRiskReviewItems = buildHighRiskReviewItemsFromJob(latestJob);
  const highRiskEvidence = collectHighRiskEvidenceFromJob(latestJob);
  const highRiskEvidenceSummary = uniqueValues(
    highRiskEvidence.reasons.map((item) => formatOperatorFacingReason(item)),
  );
  const settlementReasonSummary = uniqueValues(
    executionTracking?.settlement?.reason
      ? [formatOperatorFacingReason(executionTracking.settlement.reason)]
      : [],
  );
  const reviewRoutingHints = uniqueValues(
    highRiskReviewItems
      .map((item) =>
        item.recommendedRoute
          ? formatHighRiskRecommendedRouteLabel(item.recommendedRoute)
          : "",
      )
      .filter((value) => value.length > 0),
  );

  const details: WorkbenchActionResultDetail[] = [];

  if (manualReviewItems.length > 0) {
    details.push({
      label: "人工复核",
      value: `需要人工复核（${manualReviewItems.length} 项）`,
    });
  }

  if (highRiskEvidence.ruleIds.length > 0) {
    details.push({
      label: "规则命中",
      value: highRiskEvidence.ruleIds.join(", "),
    });
  }

  if (knowledgeItemIds.length > 0) {
    details.push({
      label: "知识引用",
      value: formatKnowledgeReferenceValue(knowledgeItemIds, knowledgeReferences),
    });
  }

  if (highRiskEvidenceSummary.length > 0) {
    details.push({
      label: "\u9ad8\u98ce\u9669\u8bc1\u636e",
      value: highRiskEvidenceSummary.join(" | "),
    });
  } else if (settlementReasonSummary.length > 0) {
    details.push({
      label: "\u7ed3\u679c\u8bf4\u660e",
      value: settlementReasonSummary.join(" | "),
    });
  }

  if (reviewRoutingHints.length > 0) {
    details.push({
      label: "\u5efa\u8bae\u6d41\u5411",
      value: reviewRoutingHints.join("\uff1b"),
    });
  }

  return details;
}

interface WorkbenchLatestJobExecutionTruthViewModel {
  executionMode?: "governed" | "bare";
  snapshotId?: string;
  executionProfileId?: string;
  retrievalPresetId?: string;
  runtimeBindingId?: string;
  modelRoutingPolicyVersionId?: string;
  resolvedModelId?: string;
  modelSource?: string;
  runtimeBindingReadinessStatus?: "ready" | "degraded" | "missing";
}

export function buildGovernedExecutionTrustDetails(input: {
  executionContext?: ManuscriptWorkbenchReadOnlyExecutionContextViewModel | null;
  latestJob?: JobViewModel | ModuleJobViewModel | null;
}): WorkbenchActionResultDetail[] {
  const latestJobTruth = resolveLatestJobExecutionTruth(input.latestJob ?? null);
  const executionContext = input.executionContext ?? null;
  const executionMode =
    latestJobTruth.executionMode ??
    resolveGovernedExecutionTrustMode(executionContext, input.latestJob ?? null);
  const hasLatestJobTruth = Object.values(latestJobTruth).some((value) => value != null);
  if (!executionMode && !executionContext && !hasLatestJobTruth) {
    return [];
  }

  const providerReadinessStatus = executionContext?.providerReadinessStatus;
  const runtimeBindingReadinessStatus =
    latestJobTruth.runtimeBindingReadinessStatus ??
    executionContext?.runtimeBindingReadinessStatus;
  const hasResolvedPreparation = Boolean(
    latestJobTruth.resolvedModelId ??
      latestJobTruth.modelRoutingPolicyVersionId ??
      latestJobTruth.executionProfileId ??
      latestJobTruth.retrievalPresetId ??
      latestJobTruth.runtimeBindingId ??
      executionContext?.resolvedModelId ??
      executionContext?.modelRoutingPolicyVersionId ??
      executionContext?.executionProfileId ??
      executionContext?.retrievalPresetId ??
      executionContext?.runtimeBindingId,
  );

  return [
    {
      label: "当前方式",
      value: formatOperatorFacingExecutionMode(executionMode),
    },
    {
      label: "当前模板",
      value: hasResolvedPreparation ? "已按当前模板装载" : "待补充模板设置",
    },
    {
      label: "AI 状态",
      value: formatOperatorFacingExecutionReadiness(
        providerReadinessStatus,
        runtimeBindingReadinessStatus,
      ),
    },
  ];
}

interface GovernanceTraceCardViewModel {
  moduleSummary: GovernedExecutionModuleSummary;
  targetModelVersionLabel: string;
  qualityPackageLabel: string;
  ruleLayerSummary: string;
  knowledgeActivationSummary: string;
  resolvedRules: GovernedResolvedRuleSummary[];
  knowledgeSelections: GovernedKnowledgeSelectionSummary[];
}

function buildGovernanceTraceCardViewModel(input: {
  mode: ManuscriptWorkbenchMode;
  workspace: ManuscriptWorkbenchWorkspace;
}): GovernanceTraceCardViewModel | null {
  if (input.mode === "submission") {
    return null;
  }

  const executionContext = input.workspace.manuscript
    .governed_execution_context_summary as GovernedExecutionContextSummary | undefined;
  if (!executionContext || executionContext.observation_status !== "reported") {
    return null;
  }

  const moduleSummary = executionContext.modules.find(
    (candidate) => candidate.module === input.mode && candidate.status === "resolved",
  );
  if (!moduleSummary || moduleSummary.status !== "resolved") {
    return null;
  }

  const resolvedRules = moduleSummary.resolved_rules ?? [];
  const knowledgeSelections = moduleSummary.knowledge_selections ?? [];
  const ruleLayerCounts = {
    general: 0,
    medical: 0,
    journal: 0,
  };
  resolvedRules.forEach((rule) => {
    ruleLayerCounts[rule.source_layer] += 1;
  });
  const primaryBindingCounts = {
    bindingRule: 0,
    generalPackage: 0,
    medicalPackage: 0,
    journalTemplate: 0,
    linkedKnowledge: 0,
  };
  knowledgeSelections.forEach((selection) => {
    const reason = selection.primary_binding?.reason;
    if (reason === "binding_rule") {
      primaryBindingCounts.bindingRule += 1;
      return;
    }
    if (reason === "general_package") {
      primaryBindingCounts.generalPackage += 1;
      return;
    }
    if (reason === "medical_package") {
      primaryBindingCounts.medicalPackage += 1;
      return;
    }
    if (reason === "journal_template") {
      primaryBindingCounts.journalTemplate += 1;
      return;
    }
    if (reason === "knowledge_item_binding") {
      primaryBindingCounts.linkedKnowledge += 1;
    }
  });

  return {
    moduleSummary,
    targetModelVersionLabel:
      executionContext.journal_template_target_model_version_no != null
        ? `v${executionContext.journal_template_target_model_version_no}`
        : executionContext.journal_template_id
          ? "已选期刊模板，未登记版本"
          : "仅基础模板",
    qualityPackageLabel:
      moduleSummary.quality_package_ids && moduleSummary.quality_package_ids.length > 0
        ? moduleSummary.quality_package_ids.join("、")
        : "未启用",
    ruleLayerSummary: `通用 ${ruleLayerCounts.general} · 医学 ${ruleLayerCounts.medical} · 期刊 ${ruleLayerCounts.journal}`,
    knowledgeActivationSummary: `共 ${knowledgeSelections.length} 条 · 绑定规则 ${primaryBindingCounts.bindingRule} · 通用包 ${primaryBindingCounts.generalPackage} · 医学包 ${primaryBindingCounts.medicalPackage} · 期刊模板 ${primaryBindingCounts.journalTemplate} · 关联知识 ${primaryBindingCounts.linkedKnowledge}`,
    resolvedRules,
    knowledgeSelections,
  };
}

function formatOperatorFacingExecutionMode(
  executionMode: "governed" | "bare" | undefined,
): string {
  if (executionMode === "bare") {
    return "单次 AI 识别";
  }

  if (executionMode === "governed") {
    return "受控处理";
  }

  return "待确认";
}

function formatOperatorFacingExecutionReadiness(
  providerReadinessStatus: string | undefined,
  runtimeBindingReadinessStatus: string | undefined,
): string {
  const providerStatus = formatWorkbenchProviderReadinessLabel(providerReadinessStatus);
  const runtimeStatus = formatWorkbenchRuntimeBindingReadinessLabel(
    runtimeBindingReadinessStatus,
  );

  if (providerStatus === "就绪" && runtimeStatus === "就绪") {
    return "已就绪";
  }

  if (providerReadinessStatus || runtimeBindingReadinessStatus) {
    return "需检查";
  }

  return "待确认";
}

function resolveLatestJobExecutionTruth(
  latestJob: JobViewModel | ModuleJobViewModel | null,
): WorkbenchLatestJobExecutionTruthViewModel {
  const payload =
    latestJob?.payload &&
    typeof latestJob.payload === "object" &&
    !Array.isArray(latestJob.payload)
      ? (latestJob.payload as Record<string, unknown>)
      : undefined;
  const executionTracking = getJobExecutionTracking(latestJob);
  const snapshot =
    executionTracking?.observation_status === "reported"
      ? executionTracking.snapshot
      : undefined;

  return {
    executionMode: getPayloadExecutionMode(payload),
    snapshotId:
      snapshot?.id ??
      getPayloadStringValue(payload, "sourceSnapshotId") ??
      getPayloadStringValue(payload, "snapshotId"),
    executionProfileId:
      snapshot?.execution_profile_id ??
      getPayloadStringValue(payload, "executionProfileId"),
    retrievalPresetId: getPayloadStringValue(payload, "retrievalPresetId"),
    runtimeBindingId: getPayloadStringValue(payload, "runtimeBindingId"),
    modelRoutingPolicyVersionId: getPayloadStringValue(
      payload,
      "routingPolicyVersionId",
    ),
    resolvedModelId: snapshot?.model_id ?? getPayloadStringValue(payload, "modelId"),
    modelSource: getPayloadStringValue(payload, "modelSource"),
    runtimeBindingReadinessStatus:
      resolveSnapshotRuntimeBindingReadinessStatus(snapshot) ??
      getPayloadRuntimeBindingReadinessStatus(payload),
  };
}

export function buildJobBatchProgressDetails(
  latestJob: JobViewModel | ModuleJobViewModel | null,
): WorkbenchActionResultDetail[] {
  const batchProgress = getJobBatchProgress(latestJob);
  if (!batchProgress) {
    return [];
  }

  return [
    {
      label: "批次进度",
      value: formatBatchLifecycleStatusLabel(batchProgress.lifecycle_status),
    },
    {
      label: "批次结算",
      value: formatBatchSettlementStatusLabel(batchProgress.settlement_status),
    },
    {
      label: "已完成",
      value: String(batchProgress.succeeded_count),
    },
    {
      label: "失败",
      value: String(batchProgress.failed_count),
    },
    {
      label: "处理中",
      value: String(batchProgress.running_count),
    },
    {
      label: "待处理",
      value: String(batchProgress.remaining_count),
    },
    {
      label: "重启状态",
      value: formatOperatorFacingReason(batchProgress.restart_posture.reason),
    },
  ];
}

function resolveGovernedExecutionTrustMode(
  executionContext: ManuscriptWorkbenchReadOnlyExecutionContextViewModel | null | undefined,
  latestJob: JobViewModel | ModuleJobViewModel | null,
): "governed" | "bare" | undefined {
  if (executionContext) {
    return "governed";
  }

  const payload =
    latestJob?.payload &&
    typeof latestJob.payload === "object" &&
    !Array.isArray(latestJob.payload)
      ? (latestJob.payload as Record<string, unknown>)
      : undefined;
  return payload?.executionMode === "bare" ? "bare" : undefined;
}

export function buildJobPostureDetails(
  latestJob: JobViewModel | ModuleJobViewModel | null,
  labelPrefix: string,
  overview?: ManuscriptModuleExecutionOverviewViewModel,
): WorkbenchActionResultDetail[] {
  const executionTracking = getJobExecutionTracking(latestJob);
  if (executionTracking) {
    const details: WorkbenchActionResultDetail[] = [
      {
        label: `${labelPrefix}结算`,
        value: describeJobExecutionTracking(executionTracking),
      },
    ];

    const recoveryPosture = describeExecutionTrackingRecoveryPosture(executionTracking);
    if (recoveryPosture) {
      details.push({
        label: `${labelPrefix}恢复`,
        value: recoveryPosture,
      });
    }

    const recoveryReadyAt = getExecutionTrackingRecoveryReadyAt(executionTracking);
    if (recoveryReadyAt) {
      details.push({
        label: `${labelPrefix}恢复可用时间`,
        value: formatTimestamp(recoveryReadyAt),
      });
    }

    const runtimeBindingReadiness = describeExecutionTrackingRuntimeBindingReadiness(
      executionTracking,
    );
    if (runtimeBindingReadiness) {
      details.push({
        label: `${labelPrefix}运行时就绪度`,
        value: runtimeBindingReadiness,
      });
    }

    return details;
  }

  const fallbackOverview = resolveLatestJobOverviewFallback(overview, latestJob);
  if (!fallbackOverview) {
    return [];
  }

  const details: WorkbenchActionResultDetail[] = [
    {
      label: `${labelPrefix}结算`,
      value: formatSettlementStatusLabel(fallbackOverview.settlement?.derived_status),
    },
  ];

  const recoveryPosture = describeModuleExecutionRecoveryPosture(fallbackOverview);
  if (recoveryPosture) {
    details.push({
      label: `${labelPrefix}恢复`,
      value: recoveryPosture,
    });
  }

  const recoveryReadyAt = getModuleExecutionRecoveryReadyAt(fallbackOverview);
  if (recoveryReadyAt) {
    details.push({
      label: `${labelPrefix}恢复可用时间`,
      value: formatTimestamp(recoveryReadyAt),
    });
  }

  const runtimeBindingReadiness = describeModuleExecutionRuntimeBindingReadiness(
    fallbackOverview,
  );
  if (runtimeBindingReadiness) {
    details.push({
      label: `${labelPrefix}运行时就绪度`,
      value: runtimeBindingReadiness,
    });
  }

  return details;
}

function buildResultAssetMatrixDetails(
  manuscriptTitle: string,
  matrix: DocumentResultAssetMatrixViewModel | undefined,
  selection: DocumentCurrentExportSelectionViewModel | undefined,
): WorkbenchActionResultDetail[] {
  const details: WorkbenchActionResultDetail[] = [];
  const slots: Array<{
    label: string;
    asset?: DocumentAssetViewModel;
  }> = [
    {
      label: "初筛报告",
      asset: matrix?.screening_report,
    },
    {
      label: "编辑稿",
      asset: matrix?.edited_docx,
    },
    {
      label: "校对草稿报告",
      asset: matrix?.proofreading_draft_report,
    },
    {
      label: "终校输出",
      asset: matrix?.final_proof_output,
    },
  ];

  for (const slot of slots) {
    details.push({
      label: slot.label,
      value: slot.asset ? renderAssetMatrixValue(manuscriptTitle, slot.asset) : "未生成",
    });
  }

  if (selection) {
    details.push({
      label: "当前导出选择",
      value: selection.asset
        ? `${selection.label} / ${renderAssetMatrixValue(manuscriptTitle, selection.asset)}`
        : selection.label,
    });
    details.push({
      label: "导出依据",
      value: formatOperatorFacingReason(selection.reason),
    });
  }

  return details;
}

export function buildManuscriptMainlineReadinessDetails(
  summary?: ManuscriptMainlineReadinessSummaryViewModel,
): WorkbenchActionResultDetail[] {
  if (!summary) {
    return [];
  }

  if (summary.observation_status === "failed_open") {
    const details: WorkbenchActionResultDetail[] = [
      {
        label: "主线就绪度",
        value: "就绪度不可用",
      },
    ];
    if (summary.error) {
      details.push({
        label: "就绪度错误",
        value: summary.error,
      });
    }
    return details;
  }

  const details: WorkbenchActionResultDetail[] = [
    {
      label: "主线就绪度",
      value: formatMainlineReadinessLabel(summary),
    },
  ];

  if (summary.active_module) {
    details.push({
      label: "当前模块",
      value: formatWorkbenchModeLabel(summary.active_module),
    });
  }

  if (summary.next_module) {
    details.push({
      label: "下一模块",
      value: formatWorkbenchModeLabel(summary.next_module),
    });
  }

  if (summary.editing_completion_gate_verdict) {
    details.push({
      label: "编辑完成门禁",
      value: formatEditingCompletionGateVerdictLabel(
        summary.editing_completion_gate_verdict,
      ),
    });
  }

  if (summary.recovery_ready_at) {
    details.push({
      label: "恢复可用时间",
      value: formatTimestamp(summary.recovery_ready_at),
    });
  }

  const runtimeReadiness = formatSummaryRuntimeBindingReadiness(summary);
  if (runtimeReadiness) {
    details.push({
      label: "运行时就绪度",
      value: runtimeReadiness,
    });
  }

  if (summary.reason) {
    details.push({
      label: "就绪原因",
      value: formatOperatorFacingReason(summary.reason),
    });
  }

  return details;
}

export function buildManuscriptMainlineAttemptLedgerDetails(
  ledger?: ManuscriptMainlineAttemptLedgerViewModel,
): WorkbenchActionResultDetail[] {
  if (!ledger || ledger.observation_status !== "reported") {
    return [];
  }

  const details: WorkbenchActionResultDetail[] = [
    {
      label: "主线尝试",
      value: formatMainlineAttemptLedgerSummary(ledger),
    },
  ];

  const latestActivity = ledger.items[0];
  if (latestActivity) {
    details.push({
      label: "最近主线活动",
      value: formatMainlineAttemptActivityDetail(latestActivity),
    });
  }

  return details;
}

export function buildManuscriptMainlineAttentionHandoffPackDetails(
  pack?: ManuscriptMainlineAttentionHandoffPackViewModel,
): WorkbenchActionResultDetail[] {
  if (!pack) {
    return [];
  }

  if (pack.observation_status === "failed_open") {
    const details: WorkbenchActionResultDetail[] = [
      {
        label: "关注状态",
        value: "关注状态不可用",
      },
    ];

    if (pack.error) {
      details.push({
        label: "关注错误",
        value: pack.error,
      });
    }

    return details;
  }

  const details: WorkbenchActionResultDetail[] = [];
  if (pack.attention_status) {
    details.push({
      label: "关注状态",
      value: formatAttentionStatusLabel(pack.attention_status),
    });
  }

  if (pack.handoff_status) {
    details.push({
      label: "下一主线交接",
      value: formatMainlineAttentionHandoffLabel(pack),
    });
  }

  if (pack.reason) {
    details.push({
      label: "主要关注原因",
      value: formatOperatorFacingReason(pack.reason),
    });
  }

  if (pack.editing_completion_gate_verdict) {
    details.push({
      label: "编辑完成门禁",
      value: formatEditingCompletionGateVerdictLabel(
        pack.editing_completion_gate_verdict,
      ),
    });
  }

  if (pack.attention_items.length > 0) {
    details.push({
      label: "关注事项",
      value: pack.attention_items.map(formatAttentionItemDetail).join(" | "),
    });
  }

  return details;
}

export function resolveWorkbenchActionOutcomePill(
  latestActionResult: WorkbenchActionResultViewModel,
): WorkbenchStatusPillViewModel {
  const fallback: WorkbenchStatusPillViewModel =
    latestActionResult.tone === "success"
      ? {
          tone: "success",
          label: "成功",
        }
      : {
          tone: "error",
          label: "需要处理",
        };

  return resolveWorkbenchPosturePillFromDetails(latestActionResult.details, fallback) ?? fallback;
}

export function resolveWorkbenchLatestJobExecutionPosturePill(
  latestJob: JobViewModel | ModuleJobViewModel,
  overview?: ManuscriptModuleExecutionOverviewViewModel,
): WorkbenchStatusPillViewModel | null {
  return resolveWorkbenchPosturePillFromDetails(
    buildLatestJobPostureDetails(latestJob, overview),
    null,
  );
}

export function resolveWorkbenchLatestJobStatusPill(
  latestJob: JobViewModel | ModuleJobViewModel,
  overview?: ManuscriptModuleExecutionOverviewViewModel,
): WorkbenchStatusPillViewModel {
  if (resolveWorkbenchLatestJobExecutionPosturePill(latestJob, overview)) {
    return {
      tone: "neutral",
      label: formatJobStatusLabel(latestJob.status),
    };
  }

  return {
    tone: latestJob.status === "completed" ? "success" : "neutral",
    label: formatJobStatusLabel(latestJob.status),
  };
}

export interface ManuscriptWorkbenchSummaryProps {
  mode: ManuscriptWorkbenchMode;
  accessibleHandoffModes?: readonly ManuscriptWorkbenchMode[];
  canOpenLearningReview?: boolean;
  canOpenEvaluationWorkbench?: boolean;
  executionContext?: ManuscriptWorkbenchReadOnlyExecutionContextViewModel | null;
  manualFeedback?: ManuscriptWorkbenchManualFeedbackViewModel;
  proofreadingGovernanceHandoff?: ManuscriptWorkbenchProofreadingGovernanceHandoffViewModel;
  proofreadingGovernanceActions?: ManuscriptWorkbenchProofreadingGovernanceActionsViewModel;
  prefilledManuscriptId?: string;
  prefilledReviewedCaseSnapshotId?: string;
  prefilledSampleSetItemId?: string;
  workspace: ManuscriptWorkbenchWorkspace;
  latestJob: AnyWorkbenchJob | null;
  latestExport: DocumentAssetExportViewModel | null;
  latestActionResult?: WorkbenchActionResultViewModel | null;
}

export function ManuscriptWorkbenchSummary({
  mode,
  accessibleHandoffModes = [],
  canOpenLearningReview = false,
  canOpenEvaluationWorkbench = false,
  executionContext = null,
  manualFeedback,
  proofreadingGovernanceHandoff,
  proofreadingGovernanceActions,
  prefilledManuscriptId,
  prefilledReviewedCaseSnapshotId,
  prefilledSampleSetItemId,
  workspace,
  latestJob,
  latestExport,
  latestActionResult = null,
}: ManuscriptWorkbenchSummaryProps) {
  const normalizedPrefilledManuscriptId = prefilledManuscriptId?.trim() ?? "";
  const normalizedPrefilledReviewedCaseSnapshotId =
    prefilledReviewedCaseSnapshotId?.trim() ?? "";
  const normalizedPrefilledSampleSetItemId = prefilledSampleSetItemId?.trim() ?? "";
  const shouldPreserveEvaluationSampleContextIds =
    normalizedPrefilledManuscriptId.length > 0 &&
    normalizedPrefilledManuscriptId === workspace.manuscript.id;
  const manuscriptWorkbenchHandoff = {
    manuscriptId: workspace.manuscript.id,
    reviewedCaseSnapshotId: shouldPreserveEvaluationSampleContextIds
      ? normalizedPrefilledReviewedCaseSnapshotId
      : undefined,
    sampleSetItemId: shouldPreserveEvaluationSampleContextIds
      ? normalizedPrefilledSampleSetItemId
      : undefined,
  };
  const mainlineReadinessSummary = workspace.manuscript.mainline_readiness_summary;
  const mainlineAttentionHandoffPack =
    workspace.manuscript.mainline_attention_handoff_pack;
  const mainlineAttemptLedger = workspace.manuscript.mainline_attempt_ledger;
  const mainlineReadinessDetails =
    buildManuscriptMainlineReadinessDetails(mainlineReadinessSummary);
  const mainlineAttentionHandoffDetails =
    buildManuscriptMainlineAttentionHandoffPackDetails(mainlineAttentionHandoffPack);
  const mainlineReadinessPill =
    resolveWorkbenchMainlineReadinessPill(mainlineReadinessSummary);
  const mainlineAttentionHandoffPill =
    resolveWorkbenchAttentionStatusPill(mainlineAttentionHandoffPack);
  const editingCompletionGateSummary =
    mode === "editing"
      ? buildEditingCompletionGateSummary(latestJob) ??
        workspace.manuscript.editing_completion_gate_summary
      : undefined;
  const recommendedNextStep = buildRecommendedNextStep(
    mode,
    workspace,
    latestJob,
    latestExport,
    canOpenLearningReview,
  );
  const actionOutcomePill = latestActionResult
    ? resolveWorkbenchActionOutcomePill(latestActionResult)
    : null;
  const latestJobExecutionPosturePill = latestJob
    ? resolveWorkbenchLatestJobExecutionPosturePill(
        latestJob,
        workspace.manuscript.module_execution_overview,
      )
    : null;
  const latestJobStatusPill = latestJob
    ? resolveWorkbenchLatestJobStatusPill(
        latestJob,
        workspace.manuscript.module_execution_overview,
      )
    : null;
  const latestJobBatchProgressDetails = buildJobBatchProgressDetails(latestJob);
  const latestJobReviewEvidenceDetails = buildJobReviewEvidenceDetails(
    latestJob,
    workspace.knowledgeReferences,
  );
  const governedExecutionTrustDetails = buildGovernedExecutionTrustDetails({
    executionContext,
    latestJob,
  });
  const governanceTrace = buildGovernanceTraceCardViewModel({
    mode,
    workspace,
  });
  const resultAssetMatrix =
    latestExport?.matrix ?? workspace.manuscript.result_asset_matrix;
  const currentExportSelection = latestExport?.selection
    ? {
        ...latestExport.selection,
        asset: latestExport.asset,
      }
    : workspace.manuscript.current_export_selection;
  const manuscriptTitle = workspace.manuscript.title;
  const resultAssetMatrixDetails = buildResultAssetMatrixDetails(
    manuscriptTitle,
    resultAssetMatrix,
    currentExportSelection,
  );
  const proofreadingGovernanceLoop = buildProofreadingGovernanceLoopSummary({
    mode,
    manuscriptId: workspace.manuscript.id,
    handoff: proofreadingGovernanceHandoff,
    canOpenLearningReview,
  });
  const currentManuscriptAsset =
    workspace.currentManuscriptAsset ?? workspace.currentAsset;
  const currentResultAsset =
    workspace.currentAsset &&
    workspace.currentAsset.id !== currentManuscriptAsset?.id
      ? workspace.currentAsset
      : null;
  const displayedCurrentAsset = currentManuscriptAsset ?? workspace.currentAsset;
  const latestActionResultDetails = latestActionResult
    ? latestActionResult.details.filter((detail) =>
        shouldDisplayActionResultDetail(detail.label),
      )
    : [];

  return (
    <section
      className="manuscript-workbench-summary"
      data-summary-layout="compact-manuscript-summary"
    >
      <div className="manuscript-workbench-summary-grid">
        <SummaryCard title="最近操作结果">
          {latestActionResult ? (
            <>
              <SummaryMetric
                label="操作"
                value={formatActionResultActionLabel(latestActionResult.actionLabel)}
              />
              <SummaryMetric
                label="结果状态"
                value={
                  <StatusPill tone={actionOutcomePill?.tone ?? latestActionResult.tone}>
                    {actionOutcomePill?.label ??
                      (latestActionResult.tone === "success"
                        ? "成功"
                        : "需要处理")}
                  </StatusPill>
                }
              />
              <SummaryMetric
                label="结果说明"
                value={formatWorkbenchActionResultMessage(latestActionResult.message)}
              />
              {latestActionResultDetails.map((detail) => (
                <SummaryMetric
                  key={`${detail.label}:${detail.value}`}
                  label={formatActionResultDetailLabel(detail.label)}
                  value={formatSummaryActionResultDetailValue({
                    label: detail.label,
                    value: detail.value,
                    manuscriptTitle,
                    assets: workspace.assets,
                    latestJob,
                  })}
                />
              ))}
            </>
          ) : (
            <p className="manuscript-workbench-empty">
              完成上传、模块运行、导出或刷新后，这里会固定显示最近一次操作。
            </p>
          )}
        </SummaryCard>

        <SummaryCard title="建议下一步">
          <SummaryMetric label="当前重点" value={recommendedNextStep.focus} />
          <SummaryMetric label="执行建议" value={recommendedNextStep.guidance} />
          {recommendedNextStep.details.map((detail) => (
            <SummaryMetric
              key={`${detail.label}:${detail.value}`}
              label={detail.label}
              value={detail.value}
            />
          ))}
          {recommendedNextStep.targetHref && recommendedNextStep.targetLabel ? (
            <a
              className="manuscript-workbench-shortcut"
              href={recommendedNextStep.targetHref}
            >
              {recommendedNextStep.targetLabel}
            </a>
          ) : recommendedNextStep.targetMode &&
            accessibleHandoffModes.includes(recommendedNextStep.targetMode) ? (
            <a
              className="manuscript-workbench-shortcut"
              href={formatWorkbenchHash(
                recommendedNextStep.targetMode,
                manuscriptWorkbenchHandoff,
              )}
            >
              {recommendedNextStep.targetLabel ??
                `前往${formatWorkbenchModeLabel(recommendedNextStep.targetMode)}工作台`}
            </a>
          ) : null}
        </SummaryCard>

        {governedExecutionTrustDetails.length > 0 ? (
          <SummaryCard title="AI 处理准备">
            {governedExecutionTrustDetails.map((detail) => (
              <SummaryMetric
                key={`${detail.label}:${detail.value}`}
                label={detail.label}
                value={detail.value}
              />
            ))}
          </SummaryCard>
        ) : null}

        {governanceTrace ? (
          <SummaryCard title="治理链路">
            <SummaryMetric label="目标模型版本" value={governanceTrace.targetModelVersionLabel} />
            <SummaryMetric label="质量包" value={governanceTrace.qualityPackageLabel} />
            <SummaryMetric label="规则层栈" value={governanceTrace.ruleLayerSummary} />
            <SummaryMetric
              label="知识激活"
              value={governanceTrace.knowledgeActivationSummary}
            />
            {governanceTrace.resolvedRules.length > 0 ? (
              <div className="manuscript-workbench-metric manuscript-workbench-activity-section">
                <span>规则明细</span>
                <ul className="manuscript-workbench-activity-list">
                  {governanceTrace.resolvedRules.slice(0, 5).map((rule) => (
                    <li key={rule.rule_id}>
                      <strong>
                        {formatGovernedRuleLayerLabel(rule.source_layer)} · {rule.rule_object} ·{" "}
                        {rule.rule_id}
                      </strong>
                      <small>
                        {formatGovernedRuleExecutionPostureLabel(
                          rule.execution_posture,
                        )}
                        {rule.effective_scope.sections?.length
                          ? ` · ${rule.effective_scope.sections.join("、")}`
                          : ""}
                        {rule.overridden_rule_ids.length > 0
                          ? ` · 覆盖 ${rule.overridden_rule_ids.length} 条`
                          : ""}
                      </small>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="manuscript-workbench-empty">
                当前模块还没有记录规则栈摘要。
              </p>
            )}
            {governanceTrace.knowledgeSelections.length > 0 ? (
              <div className="manuscript-workbench-metric manuscript-workbench-activity-section">
                <span>知识明细</span>
                <ul className="manuscript-workbench-activity-list">
                  {governanceTrace.knowledgeSelections.slice(0, 5).map((selection) => (
                    <li key={selection.knowledge_item_id}>
                      <strong>{selection.title}</strong>
                      <small>
                        {formatGovernedKnowledgeBindingReasonLabel(
                          selection.primary_binding?.reason,
                        )}
                        {selection.match_source_id
                          ? ` · ${selection.match_source_id}`
                          : ` · ${formatGovernedKnowledgeMatchSourceLabel(
                              selection.match_source,
                            )}`}
                      </small>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="manuscript-workbench-empty">
                当前模块还没有记录知识激活摘要。
              </p>
            )}
          </SummaryCard>
        ) : null}

        {editingCompletionGateSummary ? (
          <SummaryCard title="编辑完成门禁">
            <SummaryMetric
              label="门禁判定"
              value={
                editingCompletionGateSummary.observation_status === "failed_open"
                  ? "观测失败打开"
                  : formatEditingCompletionGateVerdictLabel(
                      editingCompletionGateSummary.verdict,
                    )
              }
            />
            <SummaryMetric
              label="阻断总数"
              value={String(editingCompletionGateSummary.blocker_count)}
            />
            <SummaryMetric
              label="通过状态"
              value={editingCompletionGateSummary.passed ? "已通过" : "未通过"}
            />
            {editingCompletionGateSummary.target_model_version_no != null ? (
              <SummaryMetric
                label="目标模型版本"
                value={`v${editingCompletionGateSummary.target_model_version_no}`}
              />
            ) : null}
            {editingCompletionGateSummary.observation_status === "failed_open" ? (
              <p className="manuscript-workbench-empty">
                {editingCompletionGateSummary.error ??
                  "编辑完成门禁 failed open，当前结果不能视为可信完成。"}
              </p>
            ) : editingCompletionGateSummary.passed ? (
              <p className="manuscript-workbench-empty">
                当前编辑结果已通过完成门禁，可继续交接到下一环节。
              </p>
            ) : (
              buildEditingCompletionGateSections(editingCompletionGateSummary).map(
                (section) => (
                  <div
                    key={section.key}
                    className="manuscript-workbench-metric manuscript-workbench-activity-section"
                  >
                    <span>{section.title}</span>
                    <ul className="manuscript-workbench-activity-list">
                      {section.items.map((item) => (
                        <li key={item.item_key}>
                          <strong>{item.summary}</strong>
                          <small>
                            {formatEditingCompletionGatePendingItemSummary(item)}
                          </small>
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              )
            )}
          </SummaryCard>
        ) : null}

        {manualFeedback ? (
          <>
            {manualFeedback.highRiskReviewItems?.length ? (
              <SummaryCard title="高风险复核">
                <div className="manuscript-workbench-manual-feedback">
                  {manualFeedback.highRiskReviewItems.map((item) => (
                    <article
                      key={item.id}
                      className="manuscript-workbench-manual-feedback-result"
                    >
                      <p>{item.title}</p>
                      {item.summary ? <p>{item.summary}</p> : null}
                      {item.excerpt ? <p>{item.excerpt}</p> : null}
                      {item.suggestion ? <p>{item.suggestion}</p> : null}
                      {item.locationText ? <p>{item.locationText}</p> : null}
                      <p>
                        处理方式：
                        {formatHighRiskReviewPostureLabel(item.candidate_posture)}
                      </p>
                      {item.rationale ? <p>{item.rationale}</p> : null}
                      <div className="manuscript-workbench-manual-feedback-options">
                        <button
                          type="button"
                          className="manuscript-workbench-shortcut"
                          disabled={manualFeedback.isSubmitting}
                          onClick={() => manualFeedback.onSubmitHighRiskItem?.(item)}
                        >
                          提交复核
                        </button>
                        <button
                          type="button"
                          className="manuscript-workbench-shortcut"
                          disabled={manualFeedback.isSubmitting}
                          onClick={() => manualFeedback.onRecordManualOnly?.(item)}
                        >
                          仅记录人工处理
                        </button>
                        <button
                          type="button"
                          className="manuscript-workbench-shortcut"
                          disabled
                        >
                          查看定位
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </SummaryCard>
            ) : null}

            <SummaryCard title="人工反馈">
              <div className="manuscript-workbench-manual-feedback">
                <p className="manuscript-workbench-manual-feedback-copy">
                  这一步会把当前模块结果记录到待审核队列，方便后续人工确认，不会直接改动线上规则或知识。
                </p>
                <div className="manuscript-workbench-manual-feedback-options">
                  {(
                    [
                      "missed_hit",
                      "incorrect_hit",
                      "missing_knowledge",
                    ] as const
                  ).map((category) => (
                    <label
                      key={category}
                      className="manuscript-workbench-manual-feedback-option"
                    >
                      <input
                        type="radio"
                        name={`manual-feedback-${workspace.manuscript.id}`}
                        checked={manualFeedback.selectedCategory === category}
                        onChange={() => manualFeedback.onCategoryChange(category)}
                      />
                      <span>
                        {formatManualFeedbackCategoryLabel(category)}
                        <small>{formatManualFeedbackCategoryHint(category)}</small>
                      </span>
                    </label>
                  ))}
                </div>
                <label className="manuscript-workbench-manual-feedback-note">
                  <span>补充说明</span>
                  <textarea
                    value={manualFeedback.note}
                    onChange={(event) => manualFeedback.onNoteChange(event.target.value)}
                    placeholder="可补充这次没命中的位置、错误命中的原因，或缺少的知识依据。"
                    rows={4}
                  />
                </label>
                <button
                  type="button"
                  className="manuscript-workbench-shortcut"
                  disabled={
                    manualFeedback.isSubmitting ||
                    manualFeedback.selectedCategory.length === 0
                  }
                  onClick={() => manualFeedback.onSubmit()}
                >
                  {manualFeedback.isSubmitting ? "提交中..." : "提交复核项"}
                </button>
                {manualFeedback.lastSubmitted ? (
                  <div className="manuscript-workbench-manual-feedback-result">
                    <p>已记录到待审核队列</p>
                    {manualFeedback.lastSubmitted.recommendedRoute ? (
                      <p>
                        建议去向：
                        {formatHighRiskRecommendedRouteLabel(
                          manualFeedback.lastSubmitted.recommendedRoute,
                        )}
                      </p>
                    ) : null}
                    {canOpenLearningReview &&
                    manualFeedback.lastSubmitted.recommendedRoute === "rule_candidate" ? (
                      <a
                        className="manuscript-workbench-shortcut"
                        href={formatWorkbenchHash("template-governance", {
                          manuscriptId: workspace.manuscript.id,
                          templateGovernanceView: "rule-ledger",
                          ruleCenterMode: "learning",
                          reviewItemId: manualFeedback.lastSubmitted.reviewItemId,
                        })}
                      >
                        前往学习审核
                      </a>
                    ) : canOpenLearningReview &&
                      manualFeedback.lastSubmitted.recommendedRoute ===
                        "knowledge_candidate" ? (
                      <>
                        <p className="manuscript-workbench-manual-feedback-copy">
                          {formatManualFeedbackSubmissionFollowup(
                            manualFeedback.lastSubmitted.feedbackCategory,
                            canOpenLearningReview,
                          )}
                        </p>
                        <a
                          className="manuscript-workbench-shortcut"
                          href={formatWorkbenchHash("knowledge-library", {
                            knowledgeView: "ledger",
                            reviewItemId: manualFeedback.lastSubmitted.reviewItemId,
                          })}
                        >
                          前往知识库处理
                        </a>
                      </>
                    ) : (
                      <p className="manuscript-workbench-manual-feedback-copy">
                        {formatManualFeedbackSubmissionFollowup(
                          manualFeedback.lastSubmitted.feedbackCategory,
                          canOpenLearningReview,
                        )}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </SummaryCard>
          </>
        ) : null}

        {proofreadingGovernanceLoop ? (
          <SummaryCard title="校对回流进度">
            <SummaryMetric
              label="当前阶段"
              value={proofreadingGovernanceLoop.currentStageLabel}
            />
            <SummaryMetric
              label="已发现残差"
              value={String(proofreadingGovernanceLoop.observedCount)}
            />
            <SummaryMetric
              label="待人工复核"
              value={String(proofreadingGovernanceLoop.manualReviewPendingCount)}
            />
            <SummaryMetric
              label="Harness 待复验"
              value={String(proofreadingGovernanceLoop.harnessPendingCount)}
            />
            <SummaryMetric
              label="候选已就绪"
              value={String(proofreadingGovernanceLoop.candidateReadyCount)}
            />
            <SummaryMetric
              label="已生成候选"
              value={String(proofreadingGovernanceLoop.candidateCreatedCount)}
            />
            {proofreadingGovernanceLoop.actionableKnowledgeRouteItems.length > 0 &&
            proofreadingGovernanceActions ? (
              <div className="manuscript-workbench-manual-feedback">
                <p className="manuscript-workbench-manual-feedback-copy">
                  可直接处理的术语类残差会先转入知识候选，继续走受治理审核链路。
                </p>
                {proofreadingGovernanceLoop.actionableKnowledgeRouteItems.map((item) => (
                  <article
                    key={item.id}
                    className="manuscript-workbench-manual-feedback-result"
                  >
                    <p>{item.title}</p>
                    <p>当前状态：{item.statusLabel}</p>
                    <div className="manuscript-workbench-manual-feedback-options">
                      <button
                        type="button"
                        className="manuscript-workbench-shortcut"
                        disabled={proofreadingGovernanceActions.isSubmitting}
                        onClick={() =>
                          proofreadingGovernanceActions.onRouteToKnowledgeCandidate(
                            item.id,
                          )}
                      >
                        {proofreadingGovernanceActions.isSubmitting &&
                        proofreadingGovernanceActions.activeItemId === item.id
                          ? "处理中..."
                          : "转为知识候选"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
            <p className="manuscript-workbench-manual-feedback-copy">
              只显示校对主线需要关注的关键进度，详细复验和候选处理请到后续审核继续完成。
            </p>
            {proofreadingGovernanceLoop.targetHref ? (
              <a
                className="manuscript-workbench-shortcut"
                href={proofreadingGovernanceLoop.targetHref}
              >
                前往后续审核
              </a>
            ) : null}
          </SummaryCard>
        ) : null}

        <SummaryCard title="稿件概览">
          <SummaryMetric label="标题" value={workspace.manuscript.title} />
          <SummaryMetric
            label="稿件类型"
            value={formatManuscriptTypeLabel(workspace.manuscript.manuscript_type)}
          />
          <SummaryMetric
            label="基础模板族"
            value={formatTemplateFamilyDisplayLabel(
              workspace.templateFamily?.name ??
                workspace.manuscript.current_template_family_id ??
                "未绑定",
            )}
          />
          <SummaryMetric
            label="期刊模板"
            value={
              workspace.selectedJournalTemplateProfile?.journal_name ??
              workspace.manuscript.current_journal_template_id ??
              "仅基础模板"
            }
          />
          <SummaryMetric
            label="期刊覆写"
            value={
              <StatusPill
                tone={
                  workspace.selectedJournalTemplateProfile ||
                  workspace.manuscript.current_journal_template_id
                    ? "success"
                    : "neutral"
                }
              >
                {workspace.selectedJournalTemplateProfile ||
                workspace.manuscript.current_journal_template_id
                  ? "已启用"
                  : "仅基础模板"}
              </StatusPill>
            }
          />
          <SummaryMetric
            label="状态"
            value={
              <StatusPill tone="neutral">
                {formatManuscriptStatusLabel(workspace.manuscript.status)}
              </StatusPill>
            }
          />
          <SummaryMetric
            label="创建人"
            value={workspace.manuscript.created_by}
          />
          <SummaryMetric
            label="最近更新"
            value={formatTimestamp(workspace.manuscript.updated_at)}
          />
          {mainlineReadinessPill ? (
            <SummaryMetric
              label="主线就绪度"
              value={
                <StatusPill tone={mainlineReadinessPill.tone}>
                  {mainlineReadinessPill.label}
                </StatusPill>
              }
            />
          ) : null}
          {mainlineReadinessDetails
            .filter((detail) => detail.label !== "主线就绪度")
            .map((detail) => (
              <SummaryMetric
                key={`${detail.label}:${detail.value}`}
                label={detail.label}
                value={detail.value}
              />
            ))}
          {mainlineAttentionHandoffPill ? (
            <SummaryMetric
              label="关注状态"
              value={
                <StatusPill tone={mainlineAttentionHandoffPill.tone}>
                  {mainlineAttentionHandoffPill.label}
                </StatusPill>
              }
            />
          ) : null}
          {mainlineAttentionHandoffDetails
            .filter((detail) => detail.label !== "关注状态")
            .filter((detail) => detail.label !== "关注事项")
            .map((detail) => (
              <SummaryMetric
                key={`${detail.label}:${detail.value}`}
                label={detail.label}
                value={detail.value}
              />
            ))}
          {renderMainlineAttentionItemsSection(mainlineAttentionHandoffPack)}
          {renderModuleExecutionOverviewMetrics(
            workspace.manuscript.module_execution_overview,
            latestJob,
          )}
          {mainlineAttemptLedger?.observation_status === "reported" ? (
            <SummaryMetric
              label="主线尝试"
              value={formatMainlineAttemptLedgerSummary(mainlineAttemptLedger)}
            />
          ) : null}
          {renderMainlineAttemptLedgerSection(mainlineAttemptLedger)}
          {canOpenEvaluationWorkbench ? (
            <SummaryMetric
              label="评估上下文"
              value={
                <a
                  className="manuscript-workbench-shortcut"
                  href={formatWorkbenchHash("evaluation-workbench", manuscriptWorkbenchHandoff)}
                >
                  前往评估工作台
                </a>
              }
            />
          ) : null}
        </SummaryCard>

        <SummaryCard title="当前文件">
          {displayedCurrentAsset ? (
            <>
              <SummaryMetric
                label="当前文件"
                value={renderAssetIdentity(manuscriptTitle, displayedCurrentAsset)}
              />
              <SummaryMetric
                label="快速操作"
                value={renderCurrentAssetShortcuts({
                  mode,
                  manuscriptId: workspace.manuscript.id,
                  asset: displayedCurrentAsset,
                  reviewedCaseSnapshotId: shouldPreserveEvaluationSampleContextIds
                    ? normalizedPrefilledReviewedCaseSnapshotId
                    : undefined,
                  sampleSetItemId: shouldPreserveEvaluationSampleContextIds
                    ? normalizedPrefilledSampleSetItemId
                    : undefined,
                })}
              />
              {currentResultAsset ? (
                <SummaryMetric
                  label="当前结果"
                  value={renderAssetIdentity(manuscriptTitle, currentResultAsset)}
                />
              ) : null}
              {currentResultAsset ? (
                <SummaryMetric
                  label="结果快速操作"
                  value={renderCurrentResultShortcuts({
                    mode,
                    manuscriptId: workspace.manuscript.id,
                    asset: currentResultAsset,
                    reviewedCaseSnapshotId: shouldPreserveEvaluationSampleContextIds
                      ? normalizedPrefilledReviewedCaseSnapshotId
                      : undefined,
                    sampleSetItemId: shouldPreserveEvaluationSampleContextIds
                      ? normalizedPrefilledSampleSetItemId
                      : undefined,
                  })}
                />
              ) : null}
              <SummaryMetric
                label="推荐父资产"
                value={
                  workspace.suggestedParentAsset
                    ? renderAssetIdentity(manuscriptTitle, workspace.suggestedParentAsset)
                    : "暂无推荐父资产"
                }
              />
              <SummaryMetric
                label="最近校对草稿"
                value={
                  workspace.latestProofreadingDraftAsset
                    ? renderAssetIdentity(
                        manuscriptTitle,
                        workspace.latestProofreadingDraftAsset,
                      )
                    : "暂无校对草稿"
                }
              />
            </>
          ) : (
            <p className="manuscript-workbench-empty">
              请先加载或上传稿件以建立资产链路。
            </p>
          )}
        </SummaryCard>

        <SummaryCard title="最近任务">
          {latestJob ? (
            <>
              <SummaryMetric label="模块" value={formatSourceModuleLabel(latestJob.module)} />
              <SummaryMetric label="任务类型" value={formatJobTypeLabel(latestJob.job_type)} />
              <SummaryMetric
                label="状态"
                value={
                  <StatusPill tone={latestJobStatusPill?.tone ?? "neutral"}>
                    {latestJobStatusPill?.label ?? latestJob.status}
                  </StatusPill>
                }
              />
              {latestJobExecutionPosturePill ? (
                <SummaryMetric
                  label="执行态势"
                  value={
                    <StatusPill tone={latestJobExecutionPosturePill.tone}>
                      {latestJobExecutionPosturePill.label}
                    </StatusPill>
                  }
                />
              ) : null}
              <SummaryMetric label="发起人" value={latestJob.requested_by} />
              <SummaryMetric
                label="最近更新"
                value={formatTimestamp(latestJob.updated_at)}
              />
              {renderLatestJobExecutionTrackingMetrics(
                latestJob,
                workspace.manuscript.module_execution_overview,
              )}
            </>
          ) : (
            <p className="manuscript-workbench-empty">
              执行模块任务或上传稿件后，这里会显示最近一次运行记录。
            </p>
          )}
        </SummaryCard>

        {latestJobBatchProgressDetails.length > 0 ? (
          <SummaryCard title="批次进度">
            {latestJobBatchProgressDetails.map((detail) => (
              <SummaryMetric
                key={`${detail.label}:${detail.value}`}
                label={detail.label}
                value={detail.value}
              />
            ))}
            {renderBatchProgressItems(getJobBatchProgress(latestJob))}
          </SummaryCard>
        ) : null}

        {latestJobReviewEvidenceDetails.length > 0 ? (
          <SummaryCard title="审核证据">
            {latestJobReviewEvidenceDetails.map((detail) => (
              <SummaryMetric
                key={`${detail.label}:${detail.value}`}
                label={detail.label}
                value={detail.value}
              />
            ))}
          </SummaryCard>
        ) : null}

        <SummaryCard title="最近导出">
          {latestExport ? (
            <>
              <SummaryMetric
                label="导出稿件"
                value={buildWorkbenchAssetDisplayName(manuscriptTitle, latestExport.asset)}
              />
              <SummaryMetric
                label="导出文件名"
                value={buildWorkbenchAssetDisplayName(manuscriptTitle, latestExport.asset)}
              />
              <SummaryMetric
                label="下载 MIME 类型"
                value={formatMimeTypeLabel(latestExport.download.mime_type)}
              />
              <SummaryMetric
                label="来源资产"
                value={renderAssetIdentity(manuscriptTitle, latestExport.asset)}
              />
              <SummaryMetric
                label="下载"
                value={
                  <a
                    className="manuscript-workbench-shortcut"
                    href={resolveBrowserApiUrl(latestExport.download.url)}
                  >
                    下载最近导出
                  </a>
                }
              />
              <SummaryMetric label="交付状态" value="已准备好下游交付" />
            </>
          ) : (
            <p className="manuscript-workbench-empty">
              请使用导出操作准备当前稿件资产。
            </p>
          )}
        </SummaryCard>

        <SummaryCard title="结果矩阵">
          {resultAssetMatrixDetails.length > 0 ? (
            <>
              {resultAssetMatrixDetails.map((detail) => (
                <SummaryMetric
                  key={`${detail.label}:${detail.value}`}
                  label={detail.label}
                  value={detail.value}
                />
              ))}
            </>
          ) : (
            <p className="manuscript-workbench-empty">
              当前还没有稳定的阶段结果资产。
            </p>
          )}
        </SummaryCard>
      </div>

      <article className="manuscript-workbench-assets-card">
        <div className="manuscript-workbench-section-heading">
          <div>
            <h3>资产链路</h3>
            <p>最新资产置顶，便于快速确认当前正在生效的稿件链路。</p>
          </div>
          <span className="manuscript-workbench-section-meta">
            {workspace.assets.length} 项资产
          </span>
        </div>
        <div className="manuscript-workbench-table-wrap">
          <table className="manuscript-workbench-table">
            <thead>
              <tr>
                <th>资产</th>
                <th>类型</th>
                <th>版本</th>
                <th>状态</th>
                <th>最近更新</th>
              </tr>
            </thead>
            <tbody>
              {workspace.assets.map((asset) => (
                <tr key={asset.id}>
                  <td>
                    <div className="manuscript-workbench-asset-cell">
                      <strong>
                        {buildWorkbenchAssetDisplayName(manuscriptTitle, asset)}
                      </strong>
                    </div>
                  </td>
                  <td>{formatAssetTypeLabel(asset.asset_type)}</td>
                  <td>v{asset.version_no}</td>
                  <td>
                    <StatusPill tone={asset.is_current ? "success" : "neutral"}>
                      {asset.is_current ? "当前版本" : formatAssetStatusLabel(asset.status)}
                    </StatusPill>
                  </td>
                  <td>{formatTimestamp(asset.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

interface SummaryCardProps {
  title: string;
  children: ReactNode;
}

interface ProofreadingGovernanceLoopSummaryViewModel {
  currentStageLabel: string;
  observedCount: number;
  manualReviewPendingCount: number;
  harnessPendingCount: number;
  candidateReadyCount: number;
  candidateCreatedCount: number;
  actionableKnowledgeRouteItems: Array<{
    id: string;
    title: string;
    statusLabel: string;
  }>;
  targetHref?: string;
}

function SummaryCard({ title, children }: SummaryCardProps) {
  return (
    <article className="manuscript-workbench-summary-card">
      <h3>{title}</h3>
      <div className="manuscript-workbench-metric-list">{children}</div>
    </article>
  );
}

interface SummaryMetricProps {
  label: string;
  value: ReactNode;
}

function SummaryMetric({ label, value }: SummaryMetricProps) {
  return (
    <div className="manuscript-workbench-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatGovernedRuleLayerLabel(
  value: GovernedResolvedRuleSummary["source_layer"],
): string {
  switch (value) {
    case "journal":
      return "期刊";
    case "medical":
      return "医学";
    default:
      return "通用";
  }
}

function formatGovernedRuleExecutionPostureLabel(
  value: GovernedResolvedRuleSummary["execution_posture"],
): string {
  switch (value) {
    case "auto":
      return "自动执行";
    case "inspect_only":
      return "仅核查";
    default:
      return "受控执行";
  }
}

function formatGovernedKnowledgeBindingReasonLabel(
  value: GovernedKnowledgeBindingMatchSummary["reason"] | undefined,
): string {
  switch (value) {
    case "binding_rule":
      return "绑定规则";
    case "general_package":
      return "通用包";
    case "medical_package":
      return "医学包";
    case "journal_template":
      return "期刊模板";
    case "template_family":
      return "模板族";
    case "module_template":
      return "模块模板";
    case "knowledge_item_binding":
      return "关联知识";
    default:
      return "动态激活";
  }
}

function formatGovernedKnowledgeMatchSourceLabel(
  value: GovernedKnowledgeSelectionSummary["match_source"],
): string {
  switch (value) {
    case "binding_rule":
      return "绑定规则";
    case "template_binding":
      return "结构绑定";
    case "knowledge_item_binding":
      return "关联知识";
    default:
      return "动态路由";
  }
}

function renderMainlineAttemptLedgerSection(
  ledger?: ManuscriptMainlineAttemptLedgerViewModel,
): ReactNode | null {
  if (!ledger || ledger.observation_status !== "reported" || ledger.items.length === 0) {
    return null;
  }

  return (
    <div className="manuscript-workbench-metric manuscript-workbench-activity-section">
      <span>最近主线活动</span>
      <ul className="manuscript-workbench-activity-list">
        {ledger.items.map((item) => (
          <li
            key={`${item.job_id}:${item.updated_at}`}
            className="manuscript-workbench-activity-item"
          >
            <strong>{formatMainlineAttemptHeading(item)}</strong>
            <p>{formatMainlineAttemptActivityStatus(item)}</p>
            <p>{item.reason}</p>
            <small>{`最近更新 ${formatTimestamp(item.updated_at)}`}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

function renderMainlineAttentionItemsSection(
  pack?: ManuscriptMainlineAttentionHandoffPackViewModel,
): ReactNode | null {
  if (!pack || pack.observation_status !== "reported" || pack.attention_items.length === 0) {
    return null;
  }

  return (
    <div className="manuscript-workbench-metric manuscript-workbench-attention-section">
      <span>关注事项</span>
      <ul className="manuscript-workbench-attention-list">
        {pack.attention_items.map((item) => (
          <li
            key={`${item.module}:${item.kind}:${item.job_id ?? item.snapshot_id ?? item.summary}`}
            className="manuscript-workbench-attention-item"
          >
            <div className="manuscript-workbench-attention-meta">
              <strong>{formatAttentionItemHeading(item)}</strong>
              <StatusPill
                tone={item.severity === "action_required" ? "error" : "neutral"}
              >
                {formatAttentionSeverityLabel(item.severity)}
              </StatusPill>
            </div>
            <p>{formatOperatorFacingReason(item.summary)}</p>
            {item.recovery_ready_at ? (
              <small>{`恢复可用时间 ${formatTimestamp(item.recovery_ready_at)}`}</small>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function renderAssetIdentity(
  manuscriptTitle: string,
  asset: DocumentAssetViewModel,
): ReactNode {
  return (
    <span className="manuscript-workbench-asset-identity">
      <span>{buildWorkbenchAssetDisplayName(manuscriptTitle, asset)}</span>
    </span>
  );
}

function renderCurrentAssetShortcuts(input: {
  mode: ManuscriptWorkbenchMode;
  manuscriptId: string;
  asset: DocumentAssetViewModel;
  reviewedCaseSnapshotId?: string;
  sampleSetItemId?: string;
}): ReactNode {
  const previewHref = buildWorkbenchAssetDetailHref({
    mode: input.mode,
    manuscriptId: input.manuscriptId,
    assetId: input.asset.id,
    reviewedCaseSnapshotId: input.reviewedCaseSnapshotId,
    sampleSetItemId: input.sampleSetItemId,
  });
  const assetUrl = resolveCurrentAssetDownloadUrl(input.asset);

  return (
    <span
      className="manuscript-workbench-shortcut-row"
      data-current-asset-actions="direct"
    >
      <a className="manuscript-workbench-shortcut" href={previewHref}>
        查看当前稿件
      </a>
      <a className="manuscript-workbench-shortcut" href={assetUrl} download>
        下载当前稿件
      </a>
    </span>
  );
}

function renderCurrentResultShortcuts(input: {
  mode: ManuscriptWorkbenchMode;
  manuscriptId: string;
  asset: DocumentAssetViewModel;
  reviewedCaseSnapshotId?: string;
  sampleSetItemId?: string;
}): ReactNode {
  const previewHref = buildWorkbenchAssetDetailHref({
    mode: input.mode,
    manuscriptId: input.manuscriptId,
    assetId: input.asset.id,
    reviewedCaseSnapshotId: input.reviewedCaseSnapshotId,
    sampleSetItemId: input.sampleSetItemId,
  });
  const assetUrl = resolveCurrentAssetDownloadUrl(input.asset);

  return (
    <span
      className="manuscript-workbench-shortcut-row"
      data-current-asset-actions="result"
    >
      <a className="manuscript-workbench-shortcut" href={previewHref}>
        {"\u67e5\u770b\u5f53\u524d\u7ed3\u679c"}
      </a>
      <a className="manuscript-workbench-shortcut" href={assetUrl} download>
        {resolveCurrentResultDownloadLabel(input.asset)}
      </a>
    </span>
  );
}

function resolveCurrentAssetDownloadUrl(asset: DocumentAssetViewModel): string {
  return resolveBrowserApiUrl(`/api/v1/document-assets/${asset.id}/download`);
}

function resolveCurrentResultDownloadLabel(asset: DocumentAssetViewModel): string {
  return (
    resolveWorkbenchAssetDownloadLabel(asset.asset_type) ??
    "\u4e0b\u8f7d\u5f53\u524d\u7ed3\u679c"
  );
}

function renderAssetMatrixValue(
  manuscriptTitle: string,
  asset: DocumentAssetViewModel,
): string {
  return buildWorkbenchAssetDisplayName(manuscriptTitle, asset);
}

function renderBatchProgressItems(
  batchProgress: NonNullable<JobViewModel["batch_progress"]> | undefined,
): ReactNode | null {
  if (!batchProgress || batchProgress.items.length === 0) {
    return null;
  }

  return (
    <div className="manuscript-workbench-metric manuscript-workbench-activity-section">
      <span>Batch Items</span>
      <ul className="manuscript-workbench-activity-list">
        {batchProgress.items.map((item) => (
          <li
            key={`${item.item_id}:${item.updated_at}`}
            className="manuscript-workbench-activity-item"
          >
            <strong>{item.file_name}</strong>
            <p>{formatBatchItemStatusLabel(item.status)}</p>
            <p>{item.title}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface StatusPillProps {
  tone: "neutral" | "success" | "error";
  children: ReactNode;
}

function StatusPill({ tone, children }: StatusPillProps) {
  return (
    <span className={`manuscript-workbench-status-pill is-${tone}`}>{children}</span>
  );
}

function resolveWorkbenchMainlineReadinessPill(
  summary?: ManuscriptMainlineReadinessSummaryViewModel,
): WorkbenchStatusPillViewModel | null {
  if (!summary) {
    return null;
  }

  if (summary.observation_status === "failed_open") {
    return {
      tone: "error",
      label: "就绪度不可用",
    };
  }

  const label = formatMainlineReadinessLabel(summary);
  if (summary.derived_status === "ready_for_next_step" || summary.derived_status === "completed") {
    return {
      tone: "success",
      label,
    };
  }

  if (
    summary.derived_status === "attention_required"
  ) {
    return {
      tone: "error",
      label,
    };
  }

  return {
    tone: "neutral",
    label,
  };
}

function resolveWorkbenchAttentionStatusPill(
  pack?: ManuscriptMainlineAttentionHandoffPackViewModel,
): WorkbenchStatusPillViewModel | null {
  if (!pack) {
    return null;
  }

  if (pack.observation_status === "failed_open") {
    return {
      tone: "error",
      label: "关注状态不可用",
    };
  }

  if (!pack.attention_status) {
    return null;
  }

  const label = formatAttentionStatusLabel(pack.attention_status);
  if (pack.attention_status === "clear") {
    return {
      tone: "success",
      label,
    };
  }

  if (pack.attention_status === "action_required") {
    return {
      tone: "error",
      label,
    };
  }

  return {
    tone: "neutral",
    label,
  };
}

function resolveWorkbenchPosturePillFromDetails(
  details: WorkbenchActionResultDetail[],
  fallback: WorkbenchStatusPillViewModel | null,
): WorkbenchStatusPillViewModel | null {
  const settlement = details.find(
    (detail) => detail.label.includes("结算") || detail.label.endsWith("Settlement"),
  )?.value;
  if (!settlement) {
    return fallback;
  }

  return resolveWorkbenchSettlementPill(settlement) ?? fallback;
}

function resolveWorkbenchSettlementPill(
  settlement: string,
): WorkbenchStatusPillViewModel | null {
  switch (settlement) {
    case "业务已完成，仍需人工处理":
    case "Business complete, manual resolution required":
      return {
        tone: "error",
        label: "仍需人工处理",
      };
    case "业务已完成，被必填槽位阻断":
    case "Business complete, blocked by required slots":
      return {
        tone: "error",
        label: "必填槽位阻断",
      };
    case "业务已完成，被高风险对象/表格/格式阻断":
    case "Business complete, blocked by high-risk objects":
      return {
        tone: "error",
        label: "高风险阻断",
      };
    case "已结算":
    case "Settled":
      return {
        tone: "success",
        label: "已结算",
      };
    case "业务已完成，后续待处理":
    case "Business complete, follow-up pending":
      return {
        tone: "neutral",
        label: "后续待处理",
      };
    case "业务已完成，后续处理中":
    case "Business complete, follow-up running":
      return {
        tone: "neutral",
        label: "后续处理中",
      };
    case "业务已完成，后续可重试":
    case "Business complete, follow-up retryable":
      return {
        tone: "error",
        label: "后续可重试",
      };
    case "业务已完成，后续失败":
    case "Business complete, follow-up failed":
      return {
        tone: "error",
        label: "后续失败",
      };
    case "业务已完成，结算未关联":
    case "Business complete, settlement unlinked":
      return {
        tone: "error",
        label: "结算未关联",
      };
    case "任务失败":
    case "Job failed":
      return {
        tone: "error",
        label: "任务失败",
      };
    case "任务进行中":
    case "Job in progress":
      return {
        tone: "neutral",
        label: "任务进行中",
      };
    case "未开始":
    case "Not started":
      return {
        tone: "neutral",
        label: "未开始",
      };
    case "已记录":
      return {
        tone: "neutral",
        label: "已记录",
      };
    default:
      return null;
  }
}

function formatTimestamp(value: string | undefined): string {
  if (!value) {
    return "暂无";
  }

  return value.replace("T", " ").replace(".000Z", "Z");
}

function formatMainlineAttemptLedgerSummary(
  ledger: ManuscriptMainlineAttemptLedgerViewModel,
): string {
  if (ledger.truncated) {
    return `共 ${ledger.total_attempts} 次（显示最近 ${ledger.visible_attempts} 次）`;
  }

  return `共 ${ledger.total_attempts} 次（显示 ${ledger.visible_attempts} 次）`;
}

function formatMainlineAttemptActivityDetail(
  item: MainlineAttemptLedgerItemViewModel,
): string {
  return `${formatMainlineAttemptHeading(item)} · ${formatMainlineAttemptActivityStatus(item)}`;
}

function formatMainlineAttemptHeading(
  item: MainlineAttemptLedgerItemViewModel,
): string {
  return `${formatMainlineModuleLabel(item.module)}第 ${item.job_attempt_count} 次尝试`;
}

function formatMainlineAttemptActivityStatus(
  item: MainlineAttemptLedgerItemViewModel,
): string {
  if (item.settlement_status) {
    return formatSettlementStatusLabel(item.settlement_status);
  }

  if (item.evidence_status === "failed_open") {
    return "观测不可用";
  }

  if (item.evidence_status === "job_only") {
    return `${formatJobStatusLabel(item.job_status)}（仅任务证据）`;
  }

  return "已记录";
}

function renderModuleExecutionOverviewMetrics(
  overview: ManuscriptModuleExecutionOverviewViewModel | undefined,
  latestJob: AnyWorkbenchJob | null,
): ReactNode[] | null {
  return MAINLINE_SETTLEMENT_MODULE_ORDER.map((module) => (
    <SummaryMetric
      key={`module-overview:${module}`}
      label={`${formatMainlineModuleLabel(module)}结算`}
      value={describeModuleExecutionOverviewMetric(module, overview?.[module], latestJob)}
    />
  ));
}

function renderLatestJobExecutionTrackingMetrics(
  latestJob: AnyWorkbenchJob,
  overview: ManuscriptModuleExecutionOverviewViewModel | undefined,
): ReactNode[] | null {
  const executionTracking = getJobExecutionTracking(latestJob);
  if (executionTracking) {
    const metrics: ReactNode[] = [
      <SummaryMetric
        key="job-execution-settlement"
        label="执行结算"
        value={describeJobExecutionTracking(executionTracking)}
      />,
    ];

    const recoveryPosture = describeExecutionTrackingRecoveryPosture(executionTracking);
    if (recoveryPosture) {
      metrics.push(
        <SummaryMetric
          key="job-execution-recovery"
          label="恢复态势"
          value={recoveryPosture}
        />,
      );
    }

    const recoveryReadyAt = getExecutionTrackingRecoveryReadyAt(executionTracking);
    if (recoveryReadyAt) {
      metrics.push(
        <SummaryMetric
          key="job-execution-recovery-ready-at"
          label="恢复可用时间"
          value={formatTimestamp(recoveryReadyAt)}
        />,
      );
    }

    const runtimeBindingReadiness = describeExecutionTrackingRuntimeBindingReadiness(
      executionTracking,
    );
    if (runtimeBindingReadiness) {
      metrics.push(
        <SummaryMetric
          key="job-runtime-binding-readiness"
          label="运行时绑定就绪度"
          value={runtimeBindingReadiness}
        />,
      );
    }

    if (executionTracking.snapshot) {
      metrics.push(
        <SummaryMetric
          key="job-execution-snapshot"
          label="执行快照"
          value={<code>{executionTracking.snapshot.id}</code>}
        />,
      );
    }

    if (executionTracking.observation_status === "failed_open" && executionTracking.error) {
      metrics.push(
        <SummaryMetric
          key="job-execution-error"
          label="执行追踪错误"
          value={executionTracking.error}
        />,
      );
    }

    if (
      executionTracking.snapshot?.runtime_binding_readiness.observation_status === "failed_open" &&
      executionTracking.snapshot.runtime_binding_readiness.error
    ) {
      metrics.push(
        <SummaryMetric
          key="job-runtime-binding-error"
          label="运行时绑定就绪度错误"
          value={executionTracking.snapshot.runtime_binding_readiness.error}
        />,
      );
    }

    return metrics;
  }

  const fallbackOverview = resolveLatestJobOverviewFallback(overview, latestJob);
  if (!fallbackOverview) {
    return null;
  }

  const metrics: ReactNode[] = [
    <SummaryMetric
      key="job-overview-fallback-settlement"
      label="执行结算"
      value={formatSettlementStatusLabel(fallbackOverview.settlement?.derived_status)}
    />,
  ];

  const recoveryPosture = describeModuleExecutionRecoveryPosture(fallbackOverview);
  if (recoveryPosture) {
    metrics.push(
        <SummaryMetric
          key="job-overview-fallback-recovery"
          label="恢复态势"
          value={recoveryPosture}
        />,
    );
  }

  const recoveryReadyAt = getModuleExecutionRecoveryReadyAt(fallbackOverview);
  if (recoveryReadyAt) {
    metrics.push(
        <SummaryMetric
          key="job-overview-fallback-recovery-ready-at"
          label="恢复可用时间"
          value={formatTimestamp(recoveryReadyAt)}
        />,
    );
  }

  const runtimeBindingReadiness = describeModuleExecutionRuntimeBindingReadiness(
    fallbackOverview,
  );
  if (runtimeBindingReadiness) {
    metrics.push(
        <SummaryMetric
          key="job-overview-fallback-runtime-binding-readiness"
          label="运行时绑定就绪度"
          value={runtimeBindingReadiness}
        />,
    );
  }

  if (fallbackOverview.latest_snapshot) {
    metrics.push(
        <SummaryMetric
          key="job-overview-fallback-execution-snapshot"
          label="执行快照"
          value={<code>{fallbackOverview.latest_snapshot.id}</code>}
        />,
    );
  }

  return metrics;
}

function resolveLatestJobOverviewFallback(
  overview: ManuscriptModuleExecutionOverviewViewModel | undefined,
  latestJob: AnyWorkbenchJob | null,
): ModuleExecutionOverviewViewModel | undefined {
  if (!latestJob) {
    return undefined;
  }

  const moduleOverview = overview?.[latestJob.module as MainlineSettlementModule];
  if (
    !moduleOverview ||
    moduleOverview.observation_status !== "reported" ||
    !moduleOverview.latest_job ||
    moduleOverview.latest_job.id !== latestJob.id
  ) {
    return undefined;
  }

  return moduleOverview;
}

interface RecommendedNextStepViewModel {
  focus: string;
  guidance: string;
  details: WorkbenchActionResultDetail[];
  targetMode?: ManuscriptWorkbenchMode;
  targetLabel?: string;
  targetHref?: string;
}

function buildMainlineReadinessRecommendedNextStep(
  mode: ManuscriptWorkbenchMode,
  workspace: ManuscriptWorkbenchWorkspace,
): RecommendedNextStepViewModel | undefined {
  if (mode === "submission") {
    return undefined;
  }

  const summary = workspace.manuscript.mainline_readiness_summary;
  if (
    !summary ||
    summary.observation_status !== "reported" ||
    !summary.derived_status
  ) {
    return undefined;
  }

  const details = [
    {
      label: "稿件",
      value: resolveManuscriptDisplayTitle(workspace.manuscript.title),
    },
    ...buildManuscriptMainlineReadinessDetails(summary),
    {
      label: "当前文件",
      value: describeAsset(workspace.currentAsset, workspace.manuscript.title),
    },
  ];
  const localizedReason = summary.reason
    ? formatOperatorFacingReason(summary.reason)
    : undefined;

  if (summary.derived_status === "ready_for_next_step" && summary.next_module) {
    if (summary.next_module === mode) {
      if (mode === "screening") {
        return {
          focus: "在推荐父资产上发起初筛",
          guidance: localizedReason ?? "稿件已满足初筛执行条件。",
          details: [
            ...details,
            {
              label: "推荐父资产",
              value: describeAsset(
                workspace.suggestedParentAsset,
                workspace.manuscript.title,
              ),
            },
          ],
        };
      }

      if (mode === "editing") {
        return {
          focus: "在已初筛稿件资产上发起编辑",
          guidance: localizedReason ?? "稿件已满足编辑执行条件。",
          details: [
            ...details,
            {
              label: "推荐父资产",
              value: describeAsset(
                workspace.suggestedParentAsset,
                workspace.manuscript.title,
              ),
            },
          ],
        };
      }

      return {
        focus: "生成校对草稿",
        guidance: localizedReason ?? "稿件已满足校对执行条件。",
        details: [
          ...details,
          {
            label: "推荐父资产",
            value: describeAsset(
              workspace.suggestedParentAsset,
              workspace.manuscript.title,
            ),
          },
        ],
      };
    }

    return {
      focus: `推进稿件进入${formatWorkbenchModeLabel(summary.next_module)}`,
      guidance:
        localizedReason ?? `稿件已满足${formatWorkbenchModeLabel(summary.next_module)}执行条件。`,
      details,
      targetMode: summary.next_module,
      targetLabel: `前往${formatWorkbenchModeLabel(summary.next_module)}工作台`,
    };
  }

  if (summary.derived_status === "in_progress") {
    return {
      focus: `等待${formatWorkbenchModeLabel(summary.active_module ?? mode)}执行完成`,
      guidance: localizedReason ?? "当前治理执行仍在进行中。",
      details,
    };
  }

  if (summary.derived_status === "waiting_for_follow_up") {
    return {
      focus: `等待${formatWorkbenchModeLabel(summary.active_module ?? mode)}后续流程完成结算`,
      guidance:
        localizedReason ??
        "业务结果已产出，但治理后续流程尚未结算。",
      details,
    };
  }

  if (summary.derived_status === "attention_required") {
    const gateRecommendation = buildEditingCompletionGateRecommendedNextStep({
      verdict: summary.editing_completion_gate_verdict,
      localizedReason,
      details,
    });
    if (gateRecommendation) {
      return gateRecommendation;
    }

    return {
      focus: `继续前请检查${formatWorkbenchModeLabel(summary.active_module ?? mode)}态势`,
      guidance:
        localizedReason ??
        "当前主线态势需要人工关注后，才能继续交接。",
      details,
    };
  }

  if (summary.derived_status === "completed" && mode !== "proofreading") {
    return {
      focus: "主线执行已全部结算",
      guidance:
        localizedReason ??
        "初筛、编辑和校对均已完成结算。",
      details,
    };
  }

  return undefined;
}

function buildProofreadingGovernanceLoopSummary(input: {
  mode: ManuscriptWorkbenchMode;
  manuscriptId: string;
  handoff?: ManuscriptWorkbenchProofreadingGovernanceHandoffViewModel;
  canOpenLearningReview: boolean;
}): ProofreadingGovernanceLoopSummaryViewModel | undefined {
  if (input.mode !== "proofreading" || !input.handoff) {
    return undefined;
  }

  const residualReviewItems = input.handoff.residualReviewItems.filter(
    (item) => item.manuscript_id === input.manuscriptId,
  );
  const ruleCandidates = input.handoff.ruleCandidates.filter(
    (candidate) =>
      candidate.type === "rule_candidate" &&
      (candidate.governed_provenance_kind === "residual_issue" ||
        candidate.governed_provenance_kind === "human_feedback") &&
      candidate.module === "proofreading" &&
      candidate.manuscript_id === input.manuscriptId,
  );
  const knowledgeCandidates = (input.handoff.knowledgeCandidates ?? []).filter(
    (candidate) =>
      candidate.type === "knowledge_candidate" &&
      (candidate.governed_provenance_kind === "residual_issue" ||
        candidate.governed_provenance_kind === "human_feedback") &&
      candidate.module === "proofreading" &&
      candidate.manuscript_id === input.manuscriptId,
  );

  const observedCount = residualReviewItems.filter(
    (item) => item.source_status === "observed",
  ).length;
  const manualReviewPendingCount = residualReviewItems.filter(
    (item) => item.source_status === "manual_review_pending",
  ).length;
  const harnessPendingCount = residualReviewItems.filter(
    (item) => item.source_status === "validation_pending",
  ).length;
  const candidateReadyCount = residualReviewItems.filter(
    (item) => item.source_status === "candidate_ready",
  ).length;
  const candidateCreatedCount = ruleCandidates.length + knowledgeCandidates.length;
  const actionableKnowledgeRouteItems = [...residualReviewItems]
    .filter((item) => item.available_actions.includes("route_to_knowledge_candidate"))
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
    .slice(0, 2)
    .map((item) => ({
      id: item.id,
      title: item.title,
      statusLabel: formatResidualReviewSourceStatusLabel(item.source_status),
    }));

  if (
    observedCount === 0 &&
    manualReviewPendingCount === 0 &&
    harnessPendingCount === 0 &&
    candidateReadyCount === 0 &&
    candidateCreatedCount === 0
  ) {
    return undefined;
  }

  const latestResidualItem = [...residualReviewItems].sort((left, right) =>
    right.updated_at.localeCompare(left.updated_at),
  )[0];
  const latestKnowledgeCandidate = [...knowledgeCandidates].sort((left, right) =>
    right.updated_at.localeCompare(left.updated_at),
  )[0];

  const currentStageLabel =
    candidateCreatedCount > 0
      ? formatResidualReviewSourceStatusLabel("candidate_created")
      : candidateReadyCount > 0
        ? formatResidualReviewSourceStatusLabel("candidate_ready")
        : harnessPendingCount > 0
          ? formatResidualReviewSourceStatusLabel("validation_pending")
          : manualReviewPendingCount > 0
            ? formatResidualReviewSourceStatusLabel("manual_review_pending")
            : formatResidualReviewSourceStatusLabel("observed");

  return {
    currentStageLabel,
    observedCount,
    manualReviewPendingCount,
    harnessPendingCount,
    candidateReadyCount,
    candidateCreatedCount,
    actionableKnowledgeRouteItems,
    targetHref: input.canOpenLearningReview
      ? latestKnowledgeCandidate
        ? formatWorkbenchHash("knowledge-library", {
            knowledgeView: "ledger",
            learningCandidateId: latestKnowledgeCandidate.id,
          })
        : formatWorkbenchHash("template-governance", {
            manuscriptId: input.manuscriptId,
            templateGovernanceView: "rule-ledger",
            ruleCenterMode: "learning",
            reviewItemId: latestResidualItem?.id,
          })
      : undefined,
  };
}

function buildRecommendedNextStep(
  mode: ManuscriptWorkbenchMode,
  workspace: ManuscriptWorkbenchWorkspace,
  latestJob: AnyWorkbenchJob | null,
  latestExport: DocumentAssetExportViewModel | null,
  canOpenLearningReview: boolean,
): RecommendedNextStepViewModel {
  const summaryRecommendation = buildMainlineReadinessRecommendedNextStep(
    mode,
    workspace,
  );
  if (summaryRecommendation) {
    return summaryRecommendation;
  }

  if (mode === "submission") {
    if (latestExport) {
      return {
        focus: "移交已准备好的投稿包",
        guidance: "投稿资产与导出已就绪，可继续下游初筛或交付。",
        details: [
          {
            label: "稿件",
            value: resolveManuscriptDisplayTitle(workspace.manuscript.title),
          },
          {
            label: "导出",
            value: buildWorkbenchAssetDisplayName(
              workspace.manuscript.title,
              latestExport.asset,
            ),
          },
        ],
      };
    }

    return {
      focus: "推进稿件进入初筛",
      guidance: "可继续进入初筛工作台处理当前稿件，或先准备导出后再交接。",
      details: [
        {
          label: "稿件",
          value: resolveManuscriptDisplayTitle(workspace.manuscript.title),
        },
        {
          label: "当前文件",
          value: describeAsset(workspace.currentAsset, workspace.manuscript.title),
        },
      ],
    };
  }

  if (mode === "screening") {
    const screeningRecommendation = buildModuleSettlementRecommendedNextStep({
      module: "screening",
      nextMode: "editing",
      nextStageLabel: "编辑",
      workspace,
    });
    if (screeningRecommendation) {
      return screeningRecommendation;
    }

    const screeningTrackingRecommendation =
      buildLatestJobExecutionTrackingRecommendedNextStep({
        module: "screening",
        nextMode: "editing",
        nextStageLabel: "编辑",
        workspace,
        latestJob,
      });
    if (screeningTrackingRecommendation) {
      return screeningTrackingRecommendation;
    }

    if (latestJob?.module === "screening" && latestJob.status === "completed") {
      return {
        focus: "推进稿件进入编辑",
        guidance: "初筛结果已就绪，可继续进入编辑工作线。",
        details: [
          {
            label: "稿件",
            value: resolveManuscriptDisplayTitle(workspace.manuscript.title),
          },
          {
            label: "当前文件",
            value: describeAsset(workspace.currentAsset, workspace.manuscript.title),
          },
        ],
        targetMode: "editing",
        targetLabel: "前往编辑工作台",
      };
    }

    return {
      focus: "在推荐父资产上发起初筛",
      guidance: "在进入编辑前，请先完成初筛工作台执行。",
      details: [
        {
          label: "推荐父资产",
          value: describeAsset(
            workspace.suggestedParentAsset,
            workspace.manuscript.title,
          ),
        },
        {
          label: "当前文件",
          value: describeAsset(workspace.currentAsset, workspace.manuscript.title),
        },
      ],
    };
  }

  if (mode === "editing") {
    const editingRecommendation = buildModuleSettlementRecommendedNextStep({
      module: "editing",
      nextMode: "proofreading",
      nextStageLabel: "校对",
      workspace,
    });
    if (editingRecommendation) {
      return editingRecommendation;
    }

    const editingTrackingRecommendation =
      buildLatestJobExecutionTrackingRecommendedNextStep({
        module: "editing",
        nextMode: "proofreading",
        nextStageLabel: "校对",
        workspace,
        latestJob,
      });
    if (editingTrackingRecommendation) {
      return editingTrackingRecommendation;
    }

    if (latestJob?.module === "editing" && latestJob.status === "completed") {
      return {
        focus: "推进稿件进入校对",
        guidance: "编辑产物已就绪，可继续生成校对草稿。",
        details: [
          {
            label: "稿件",
            value: resolveManuscriptDisplayTitle(workspace.manuscript.title),
          },
          {
            label: "当前文件",
            value: describeAsset(workspace.currentAsset, workspace.manuscript.title),
          },
        ],
        targetMode: "proofreading",
        targetLabel: "前往校对工作台",
      };
    }

    return {
      focus: "在已初筛稿件资产上发起编辑",
      guidance: "请先生成治理后的编辑结果，再进入校对。",
      details: [
        {
          label: "推荐父资产",
          value: describeAsset(
            workspace.suggestedParentAsset,
            workspace.manuscript.title,
          ),
        },
        {
          label: "当前文件",
          value: describeAsset(workspace.currentAsset, workspace.manuscript.title),
        },
      ],
    };
  }

  if (workspace.currentAsset?.asset_type === "human_final_docx") {
    return {
      focus: "前往后续审核",
      guidance: "当前阶段：审核。下一步：前往后续审核完成确认，并继续处理候选项。",
      details: [
        {
          label: "稿件",
          value: resolveManuscriptDisplayTitle(workspace.manuscript.title),
        },
        {
          label: "当前文件",
          value: describeAsset(workspace.currentAsset, workspace.manuscript.title),
        },
      ],
      targetLabel: canOpenLearningReview ? "前往后续审核" : undefined,
      targetHref: canOpenLearningReview
        ? formatWorkbenchHash("template-governance", {
            manuscriptId: workspace.manuscript.id,
            templateGovernanceView: "rule-ledger",
            ruleCenterMode: "learning",
          })
        : undefined,
    };
  }

  const currentFinalProofAsset = workspace.currentAsset;
  if (currentFinalProofAsset && isFinalProofAsset(currentFinalProofAsset)) {
    return {
      focus: "导出或移交已完成的校对结果",
      guidance: `当前${formatAssetTypeLabel(currentFinalProofAsset.asset_type)}已激活，可继续人工确认、导出或下游交付。`,
      details: [
        {
          label: "当前文件",
          value: describeAsset(currentFinalProofAsset, workspace.manuscript.title),
        },
          {
            label: "导出",
            value:
              latestExport?.asset
                ? buildWorkbenchAssetDisplayName(
                    workspace.manuscript.title,
                    latestExport.asset,
                  )
                : "请先在工作台工具区准备导出",
          },
        ],
      };
  }

  if (workspace.latestProofreadingDraftAsset) {
    return {
      focus: "完成已审校对草稿定稿",
      guidance: "生成校对终稿前仍需人工确认。",
      details: [
        {
          label: "草稿资产",
          value: describeAsset(
            workspace.latestProofreadingDraftAsset,
            workspace.manuscript.title,
          ),
        },
        {
          label: "当前文件",
          value: describeAsset(workspace.currentAsset, workspace.manuscript.title),
        },
      ],
    };
  }

  return {
    focus: "生成校对草稿",
    guidance: "请先生成校对草稿，再由人工确认后定稿。",
    details: [
      {
        label: "推荐父资产",
        value: describeAsset(
          workspace.suggestedParentAsset,
          workspace.manuscript.title,
        ),
      },
      {
        label: "当前文件",
        value: describeAsset(workspace.currentAsset, workspace.manuscript.title),
      },
    ],
  };
}

function buildModuleSettlementRecommendedNextStep(input: {
  module: MainlineSettlementModule;
  nextMode: Exclude<ManuscriptWorkbenchMode, "submission">;
  nextStageLabel: string;
  workspace: ManuscriptWorkbenchWorkspace;
}): RecommendedNextStepViewModel | undefined {
  const overview = input.workspace.manuscript.module_execution_overview?.[input.module];
  if (!overview || overview.observation_status !== "reported" || !overview.settlement) {
    return undefined;
  }

  const details = buildSettlementDetails(
    overview,
    input.workspace.currentAsset,
    input.workspace.manuscript.title,
  );

  switch (overview.settlement.derived_status) {
    case "business_completed_settled":
      return {
        focus: `推进稿件进入${input.nextStageLabel}`,
        guidance: `${formatMainlineModuleLabel(input.module)}结果已结算，可继续进入${input.nextStageLabel}工作线。`,
        details: [
          {
            label: "稿件",
            value: resolveManuscriptDisplayTitle(input.workspace.manuscript.title),
          },
          ...details,
        ],
        targetMode: input.nextMode,
        targetLabel: `前往${formatWorkbenchModeLabel(input.nextMode)}工作台`,
      };
    case "business_completed_needs_manual_resolution":
    case "business_completed_blocked_by_missing_required_slots":
    case "business_completed_blocked_by_high_risk_objects":
      return buildEditingCompletionGateRecommendedNextStep({
        verdict: overview.settlement.editing_completion_gate_verdict,
        localizedReason: formatOperatorFacingReason(overview.settlement.reason),
        details,
      });
    case "business_completed_follow_up_pending":
    case "business_completed_follow_up_running":
      return {
        focus: `${input.nextStageLabel}交接前请等待${formatMainlineModuleLabel(input.module)}后续流程完成`,
        guidance: "业务结果已产出，但编排后续流程尚未结算。",
        details,
      };
    case "business_completed_follow_up_retryable":
      return {
        focus: `${input.nextStageLabel}交接前请检查${formatMainlineModuleLabel(input.module)}后续处理`,
        guidance: "业务结果已产出，但治理后续流程仍处于可重试未结算状态。",
        details,
      };
    case "business_completed_follow_up_failed":
      return {
        focus: `${input.nextStageLabel}交接前请处理${formatMainlineModuleLabel(input.module)}后续失败`,
        guidance: "业务结果已产出，但治理后续流程失败，需人工介入。",
        details,
      };
    case "business_completed_unlinked":
      return {
        focus: `${input.nextStageLabel}交接前请检查${formatMainlineModuleLabel(input.module)}结算关联`,
        guidance: "业务结果已产出，但结算关联未完成，当前不宜继续交接。",
        details,
      };
    case "job_failed":
      return {
        focus: `请检查失败的${formatMainlineModuleLabel(input.module)}执行`,
        guidance: "最近一次治理执行失败，继续交接前需先排查。",
        details,
      };
    case "job_in_progress":
      return {
        focus: `等待${formatMainlineModuleLabel(input.module)}执行完成`,
        guidance: "当前治理执行仍在进行中。",
        details,
      };
    case "not_started":
      return undefined;
  }
}

function buildLatestJobExecutionTrackingRecommendedNextStep(input: {
  module: MainlineSettlementModule;
  nextMode: Exclude<ManuscriptWorkbenchMode, "submission">;
  nextStageLabel: string;
  workspace: ManuscriptWorkbenchWorkspace;
  latestJob: AnyWorkbenchJob | null;
}): RecommendedNextStepViewModel | undefined {
  if (!input.latestJob || input.latestJob.module !== input.module) {
    return undefined;
  }

  const executionTracking = getJobExecutionTracking(input.latestJob);
  if (
    !executionTracking ||
    executionTracking.observation_status !== "reported" ||
    !executionTracking.settlement
  ) {
    return undefined;
  }

  const details = buildLatestJobExecutionTrackingSettlementDetails(
    executionTracking,
    input.workspace.currentAsset,
    input.workspace.manuscript.title,
  );

  switch (executionTracking.settlement.derived_status) {
    case "business_completed_settled":
      return {
        focus: `推进稿件进入${input.nextStageLabel}`,
        guidance: `${formatMainlineModuleLabel(input.module)}结果已结算，可继续进入${input.nextStageLabel}工作线。`,
        details: [
          {
            label: "稿件",
            value: resolveManuscriptDisplayTitle(input.workspace.manuscript.title),
          },
          ...details,
        ],
        targetMode: input.nextMode,
        targetLabel: `前往${formatWorkbenchModeLabel(input.nextMode)}工作台`,
      };
    case "business_completed_needs_manual_resolution":
    case "business_completed_blocked_by_missing_required_slots":
    case "business_completed_blocked_by_high_risk_objects":
      return buildEditingCompletionGateRecommendedNextStep({
        verdict: executionTracking.settlement.editing_completion_gate_verdict,
        localizedReason: formatOperatorFacingReason(
          executionTracking.settlement.reason,
        ),
        details,
      });
    case "business_completed_follow_up_pending":
    case "business_completed_follow_up_running":
      return {
        focus: `${input.nextStageLabel}交接前请等待${formatMainlineModuleLabel(input.module)}后续流程完成`,
        guidance: "业务结果已产出，但编排后续流程尚未结算。",
        details,
      };
    case "business_completed_follow_up_retryable":
      return {
        focus: `${input.nextStageLabel}交接前请检查${formatMainlineModuleLabel(input.module)}后续处理`,
        guidance: "业务结果已产出，但治理后续流程仍处于可重试未结算状态。",
        details,
      };
    case "business_completed_follow_up_failed":
      return {
        focus: `${input.nextStageLabel}交接前请处理${formatMainlineModuleLabel(input.module)}后续失败`,
        guidance: "业务结果已产出，但治理后续流程失败，需人工介入。",
        details,
      };
    case "business_completed_unlinked":
      return {
        focus: `${input.nextStageLabel}交接前请检查${formatMainlineModuleLabel(input.module)}结算关联`,
        guidance: "业务结果已产出，但结算关联未完成，当前不宜继续交接。",
        details,
      };
    case "job_failed":
      return {
        focus: `请检查失败的${formatMainlineModuleLabel(input.module)}执行`,
        guidance: "最近一次治理执行失败，继续交接前需先排查。",
        details,
      };
    case "job_in_progress":
      return {
        focus: `等待${formatMainlineModuleLabel(input.module)}执行完成`,
        guidance: "当前治理执行仍在进行中。",
        details,
      };
    case "not_started":
      return undefined;
  }
}

function buildSettlementDetails(
  overview: ModuleExecutionOverviewViewModel,
  currentAsset: DocumentAssetViewModel | null,
  manuscriptTitle: string,
): WorkbenchActionResultDetail[] {
  const details: WorkbenchActionResultDetail[] = [
    {
      label: "结算状态",
      value: formatSettlementStatusLabel(overview.settlement?.derived_status),
    },
  ];

  if (overview.settlement?.editing_completion_gate_verdict) {
    details.push({
      label: "编辑完成门禁",
      value: formatEditingCompletionGateVerdictLabel(
        overview.settlement.editing_completion_gate_verdict,
      ),
    });
  }

  const recoveryPosture = describeModuleExecutionRecoveryPosture(overview);
  if (recoveryPosture) {
    details.push({
      label: "恢复态势",
      value: recoveryPosture,
    });
  }

  const recoveryReadyAt = getModuleExecutionRecoveryReadyAt(overview);
  if (recoveryReadyAt) {
    details.push({
      label: "恢复可用时间",
      value: formatTimestamp(recoveryReadyAt),
    });
  }

  const runtimeReadiness = describeModuleExecutionRuntimeBindingReadiness(overview);
  if (runtimeReadiness) {
    details.push({
      label: "运行时就绪度",
      value: runtimeReadiness,
    });
  }

  if (overview.latest_snapshot) {
    details.push({
      label: "快照",
      value: overview.latest_snapshot.id,
    });
  }

  if (currentAsset) {
    details.push({
      label: "当前文件",
      value: describeAsset(currentAsset, manuscriptTitle),
    });
  }

  return details;
}

function buildLatestJobExecutionTrackingSettlementDetails(
  executionTracking: JobExecutionTrackingObservationViewModel,
  currentAsset: DocumentAssetViewModel | null,
  manuscriptTitle: string,
): WorkbenchActionResultDetail[] {
  const details: WorkbenchActionResultDetail[] = [
    {
      label: "结算状态",
      value: formatSettlementStatusLabel(executionTracking.settlement?.derived_status),
    },
  ];

  if (executionTracking.settlement?.editing_completion_gate_verdict) {
    details.push({
      label: "编辑完成门禁",
      value: formatEditingCompletionGateVerdictLabel(
        executionTracking.settlement.editing_completion_gate_verdict,
      ),
    });
  }

  const recoveryPosture = describeExecutionTrackingRecoveryPosture(executionTracking);
  if (recoveryPosture) {
    details.push({
      label: "恢复态势",
      value: recoveryPosture,
    });
  }

  const recoveryReadyAt = getExecutionTrackingRecoveryReadyAt(executionTracking);
  if (recoveryReadyAt) {
    details.push({
      label: "恢复可用时间",
      value: formatTimestamp(recoveryReadyAt),
    });
  }

  const runtimeReadiness = describeExecutionTrackingRuntimeBindingReadiness(
    executionTracking,
  );
  if (runtimeReadiness) {
    details.push({
      label: "运行时就绪度",
      value: runtimeReadiness,
    });
  }

  if (executionTracking.snapshot) {
    details.push({
      label: "快照",
      value: executionTracking.snapshot.id,
    });
  }

  if (currentAsset) {
    details.push({
      label: "当前文件",
      value: describeAsset(currentAsset, manuscriptTitle),
    });
  }

  return details;
}

function buildEditingCompletionGateRecommendedNextStep(input: {
  verdict:
    | ManuscriptMainlineReadinessSummaryViewModel["editing_completion_gate_verdict"]
    | ManuscriptMainlineAttentionHandoffPackViewModel["editing_completion_gate_verdict"]
    | NonNullable<
        ModuleExecutionOverviewViewModel["settlement"]
      >["editing_completion_gate_verdict"];
  localizedReason?: string;
  details: WorkbenchActionResultDetail[];
}): RecommendedNextStepViewModel | undefined {
  switch (input.verdict) {
    case "blocked_by_missing_required_slots":
      return {
        focus: "先补齐编辑必填槽位",
        guidance:
          input.localizedReason ??
          "编辑结果已生成，但必填槽位仍未解决，当前不能继续交接。",
        details: input.details,
      };
    case "blocked_by_high_risk_objects":
      return {
        focus: "先处理高风险表格、对象和格式阻断项",
        guidance:
          input.localizedReason ??
          "编辑结果已生成，但仍有高风险对象、表格或格式阻断项。",
        details: input.details,
      };
    case "needs_manual_resolution":
      return {
        focus: "先处理编辑人工核对项",
        guidance:
          input.localizedReason ??
          "编辑结果已生成，但仍有人工处理项未完成。",
        details: input.details,
      };
    default:
      return undefined;
  }
}

function buildEditingCompletionGateSections(
  summary: NonNullable<
    ManuscriptWorkbenchWorkspace["manuscript"]["editing_completion_gate_summary"]
  >,
): Array<{
  key: string;
  title: string;
  items: NonNullable<
    ManuscriptWorkbenchWorkspace["manuscript"]["editing_completion_gate_summary"]
  >["unresolved_required_slots"];
}> {
  return [
    {
      key: "required-slots",
      title: "必填槽位阻断",
      items: summary.unresolved_required_slots,
    },
    {
      key: "manual-resolution",
      title: "人工处理项",
      items: summary.pending_manual_resolution_items,
    },
    {
      key: "high-risk-objects",
      title: "高风险对象",
      items: summary.high_risk_object_items,
    },
    {
      key: "table-high-risk",
      title: "表格高风险项",
      items: summary.table_high_risk_items,
    },
    {
      key: "blocking-format-failures",
      title: "格式阻断项",
      items: summary.blocking_format_failures,
    },
  ].filter((section) => section.items.length > 0);
}

function formatEditingCompletionGateVerdictLabel(
  value:
    | ManuscriptMainlineReadinessSummaryViewModel["editing_completion_gate_verdict"]
    | ManuscriptMainlineAttentionHandoffPackViewModel["editing_completion_gate_verdict"]
    | NonNullable<
        ManuscriptWorkbenchWorkspace["manuscript"]["editing_completion_gate_summary"]
      >["verdict"],
): string {
  switch (value) {
    case "passed":
      return "已通过";
    case "needs_manual_resolution":
      return "仍需人工处理";
    case "blocked_by_missing_required_slots":
      return "被必填槽位阻断";
    case "blocked_by_high_risk_objects":
      return "被高风险对象/表格/格式阻断";
    default:
      return "未判定";
  }
}

function formatEditingCompletionGatePendingItemSummary(
  item: NonNullable<
    ManuscriptWorkbenchWorkspace["manuscript"]["editing_completion_gate_summary"]
  >["unresolved_required_slots"][number],
): string {
  const parts = [
    formatEditingCompletionGateSourceLabel(item.source),
    item.location_text,
    item.related_slot_key ? `槽位 ${item.related_slot_key}` : undefined,
    item.related_rule_id ? `规则 ${item.related_rule_id}` : undefined,
    item.review_item_id ? `复核项 ${item.review_item_id}` : undefined,
  ].filter((value): value is string => Boolean(value));

  return item.detail ? [item.detail, ...parts].join(" · ") : parts.join(" · ");
}

function formatEditingCompletionGateSourceLabel(
  value: NonNullable<
    ManuscriptWorkbenchWorkspace["manuscript"]["editing_completion_gate_summary"]
  >["unresolved_required_slots"][number]["source"],
): string {
  switch (value) {
    case "slot_governance":
      return "槽位治理";
    case "manual_review_item":
      return "人工复核";
    case "content_rule_candidate":
      return "内容规则候选";
    case "quality_finding":
      return "质量问题";
    case "table_inspection_finding":
      return "表格核查";
    case "table_patch_result":
      return "表格落稿";
    case "editing_guardrail":
      return "编辑守门";
    case "skipped_ai_replacement":
      return "跳过改写";
    default:
      return value;
  }
}

function formatMainlineModuleLabel(module: MainlineSettlementModule): string {
  if (module === "screening") {
    return "初筛";
  }
  if (module === "editing") {
    return "编辑";
  }

  return "校对";
}

function describeModuleExecutionOverview(
  overview: ModuleExecutionOverviewViewModel | undefined,
): string {
  if (!overview) {
    return "未上报";
  }

  if (overview.observation_status === "failed_open") {
    return "观测不可用（failed open）";
  }

  if (overview.observation_status === "not_started") {
    return "未开始";
  }

  const parts: string[] = [];
  if (overview.settlement) {
    parts.push(formatSettlementStatusLabel(overview.settlement.derived_status));
  } else {
    parts.push("已记录");
  }

  const recoveryPosture = describeModuleExecutionRecoveryPosture(overview);
  if (recoveryPosture) {
    parts.push(recoveryPosture);
  }

  const recoveryReadyAt = getModuleExecutionRecoveryReadyAt(overview);
  if (recoveryReadyAt) {
    parts.push(`恢复时间 ${formatTimestamp(recoveryReadyAt)}`);
  }

  const compactRuntimeBindingReadiness = describeCompactModuleRuntimeBindingReadiness(
    overview,
  );
  if (compactRuntimeBindingReadiness) {
    parts.push(compactRuntimeBindingReadiness);
  }

  if (overview.latest_job) {
    parts.push(`最近任务${formatJobStatusLabel(overview.latest_job.status)}`);
  }

  if (overview.latest_snapshot) {
    parts.push(`快照 ${overview.latest_snapshot.id}`);
  }

  return parts.join(" · ");
}

function describeModuleExecutionOverviewMetric(
  module: MainlineSettlementModule,
  overview: ModuleExecutionOverviewViewModel | undefined,
  latestJob: AnyWorkbenchJob | null,
): string {
  if (overview?.observation_status === "reported") {
    return describeModuleExecutionOverview(overview);
  }

  const latestJobFallback = describeLatestJobExecutionTrackingOverview(module, latestJob);
  if (latestJobFallback) {
    return latestJobFallback;
  }

  return describeModuleExecutionOverview(overview);
}

function describeLatestJobExecutionTrackingOverview(
  module: MainlineSettlementModule,
  latestJob: AnyWorkbenchJob | null,
): string | undefined {
  if (!latestJob || latestJob.module !== module) {
    return undefined;
  }

  const executionTracking = getJobExecutionTracking(latestJob);
  if (
    !executionTracking ||
    executionTracking.observation_status !== "reported" ||
    !executionTracking.settlement
  ) {
    return undefined;
  }

  const parts: string[] = [
    formatSettlementStatusLabel(executionTracking.settlement.derived_status),
  ];

  const recoveryPosture = describeExecutionTrackingRecoveryPosture(executionTracking);
  if (recoveryPosture) {
    parts.push(recoveryPosture);
  }

  const compactRuntimeBindingReadiness =
    describeCompactExecutionTrackingRuntimeBindingReadiness(executionTracking);
  if (compactRuntimeBindingReadiness) {
    parts.push(compactRuntimeBindingReadiness);
  }

  if (executionTracking.snapshot) {
    parts.push(`快照 ${executionTracking.snapshot.id}`);
  }

  parts.push("最近追踪任务");

  return parts.join(" · ");
}

function describeJobExecutionTracking(
  executionTracking: JobExecutionTrackingObservationViewModel,
): string {
  if (executionTracking.observation_status === "failed_open") {
    return "观测不可用（failed open）";
  }

  if (executionTracking.observation_status === "not_tracked") {
    return "未追踪";
  }

  return formatSettlementStatusLabel(executionTracking.settlement?.derived_status);
}

function describeExecutionTrackingRecoveryPosture(
  executionTracking: JobExecutionTrackingObservationViewModel,
): string | undefined {
  if (executionTracking.observation_status !== "reported") {
    return undefined;
  }

  return formatRecoveryPostureLabel({
    settlementStatus: executionTracking.settlement?.derived_status,
    recoverySummary:
      executionTracking.snapshot?.agent_execution.observation_status === "reported"
        ? executionTracking.snapshot.agent_execution.log?.recovery_summary
        : undefined,
  });
}

function getExecutionTrackingRecoveryReadyAt(
  executionTracking: JobExecutionTrackingObservationViewModel,
): string | undefined {
  if (executionTracking.observation_status !== "reported") {
    return undefined;
  }

  return executionTracking.snapshot?.agent_execution.observation_status === "reported"
    ? executionTracking.snapshot.agent_execution.log?.recovery_summary.recovery_ready_at
    : undefined;
}

function describeExecutionTrackingRuntimeBindingReadiness(
  executionTracking: JobExecutionTrackingObservationViewModel,
): string | undefined {
  if (executionTracking.observation_status !== "reported") {
    return undefined;
  }

  return formatRuntimeBindingReadinessLabel(
    executionTracking.snapshot?.runtime_binding_readiness,
  );
}

function describeModuleExecutionRecoveryPosture(
  overview: ModuleExecutionOverviewViewModel,
): string | undefined {
  return formatRecoveryPostureLabel({
    settlementStatus: overview.settlement?.derived_status,
    recoverySummary:
      overview.latest_snapshot?.agent_execution.observation_status === "reported"
        ? overview.latest_snapshot.agent_execution.log?.recovery_summary
        : undefined,
  });
}

function getModuleExecutionRecoveryReadyAt(
  overview: ModuleExecutionOverviewViewModel,
): string | undefined {
  return overview.latest_snapshot?.agent_execution.observation_status === "reported"
    ? overview.latest_snapshot.agent_execution.log?.recovery_summary.recovery_ready_at
    : undefined;
}

function describeModuleExecutionRuntimeBindingReadiness(
  overview: ModuleExecutionOverviewViewModel,
): string | undefined {
  return formatRuntimeBindingReadinessLabel(overview.latest_snapshot?.runtime_binding_readiness);
}

function describeCompactModuleRuntimeBindingReadiness(
  overview: ModuleExecutionOverviewViewModel,
): string | undefined {
  return describeCompactRuntimeBindingReadinessObservation(
    overview.latest_snapshot?.runtime_binding_readiness,
  );
}

function describeCompactExecutionTrackingRuntimeBindingReadiness(
  executionTracking: JobExecutionTrackingObservationViewModel,
): string | undefined {
  return describeCompactRuntimeBindingReadinessObservation(
    executionTracking.snapshot?.runtime_binding_readiness,
  );
}

function describeCompactRuntimeBindingReadinessObservation(
  observation:
    | {
        observation_status: "reported" | "failed_open";
        report?: RuntimeBindingReadinessReportViewModel;
      }
    | undefined,
): string | undefined {
  if (!observation) {
    return undefined;
  }

  if (observation.observation_status === "failed_open") {
    return "绑定观测不可用";
  }

  const status = observation.report?.status;
  if (status === "degraded") {
    return "绑定已降级";
  }

  if (status === "missing") {
    return "绑定缺失";
  }

  return undefined;
}

function formatMainlineReadinessLabel(
  summary: ManuscriptMainlineReadinessSummaryViewModel,
): string {
  if (summary.observation_status === "failed_open") {
    return "就绪度不可用";
  }

  switch (summary.derived_status) {
    case "ready_for_next_step":
      return "可进入下一步";
    case "in_progress":
      return "进行中";
    case "waiting_for_follow_up":
      return "等待后续流程";
    case "attention_required":
      return "需要关注";
    case "completed":
      return "主线已结算";
    default:
      return "已记录就绪度";
  }
}

function formatSummaryRuntimeBindingReadiness(
  summary: ManuscriptMainlineReadinessSummaryViewModel,
): string | undefined {
  if (!summary.runtime_binding_status) {
    return undefined;
  }

  const issueCount = summary.runtime_binding_issue_count ?? 0;
  const issueLabel = `${issueCount} 项问题`;

  if (summary.runtime_binding_status === "degraded") {
    return `已降级（${issueLabel}）`;
  }

  if (summary.runtime_binding_status === "missing") {
    return `缺失（${issueLabel}）`;
  }

  return "就绪";
}

function formatOperatorFacingReason(reason: string): string {
  const normalized = reason.trim();
  if (normalized.length === 0) {
    return reason;
  }

  switch (normalized) {
    case "Recovered after restart":
      return "服务重启后已恢复";
    case "Base only":
      return "仅基础模板";
    case "Active":
      return "已启用";
  }

  const governedReadyMatch =
    /^The manuscript is ready for governed (screening|editing|proofreading)\.$/u.exec(
      normalized,
    );
  if (governedReadyMatch) {
    return `稿件已满足受治理${formatWorkbenchModeLabel(
      governedReadyMatch[1] as ManuscriptWorkbenchMode,
    )}条件。`;
  }

  return reason;
}

function formatTemplateFamilyDisplayLabel(value: string): string {
  return value
    .replace(/^Review\b/u, "综述")
    .replace(/^Clinical Study\b/u, "临床研究")
    .replace(/^Case Report\b/u, "病例报告")
    .replace(/\bgovernance family\b/iu, "治理模板族")
    .replace(/\bbase template family\b/iu, "基础模板族")
    .replace(/\s+基础模板族/u, "基础模板族")
    .replace(/\s+治理模板族/u, "治理模板族");
}

function formatJournalOverrideStateLabel(value: string): string {
  if (value === "Base only") {
    return "仅基础模板";
  }

  if (value === "Active") {
    return "已启用";
  }

  return value;
}

function formatSettlementStatusValue(value: string): string {
  switch (value) {
    case "Business complete, manual resolution required":
    case "business_completed_needs_manual_resolution":
      return "业务已完成，仍需人工处理";
    case "Business complete, blocked by required slots":
    case "business_completed_blocked_by_missing_required_slots":
      return "业务已完成，被必填槽位阻断";
    case "Business complete, blocked by high-risk objects":
    case "business_completed_blocked_by_high_risk_objects":
      return "业务已完成，被高风险对象/表格/格式阻断";
    case "Settled":
    case "business_completed_settled":
      return "已结算";
    case "Business complete, follow-up pending":
    case "business_completed_follow_up_pending":
      return "业务已完成，后续待处理";
    case "Business complete, follow-up running":
    case "business_completed_follow_up_running":
      return "业务已完成，后续处理中";
    case "Business complete, follow-up retryable":
    case "business_completed_follow_up_retryable":
      return "业务已完成，后续可重试";
    case "Business complete, follow-up failed":
    case "business_completed_follow_up_failed":
      return "业务已完成，后续失败";
    case "Business complete, settlement unlinked":
    case "business_completed_unlinked":
      return "业务已完成，结算未关联";
    case "Job failed":
    case "job_failed":
      return "任务失败";
    case "Job in progress":
    case "job_in_progress":
      return "任务进行中";
    case "Not started":
    case "not_started":
      return "未开始";
    default:
      return value;
  }
}

function formatAttentionStatusLabel(
  status: NonNullable<ManuscriptMainlineAttentionHandoffPackViewModel["attention_status"]>,
): string {
  switch (status) {
    case "clear":
      return "清晰";
    case "monitoring":
      return "持续关注";
    case "action_required":
      return "需要处理";
  }
}

function formatMainlineAttentionHandoffLabel(
  pack: ManuscriptMainlineAttentionHandoffPackViewModel,
): string {
  if (pack.observation_status === "failed_open") {
    return "关注状态不可用";
  }

  switch (pack.handoff_status) {
    case "ready_now":
      if (pack.from_module && pack.to_module) {
        return `${formatMainlineModuleLabel(pack.from_module)} -> ${formatMainlineModuleLabel(pack.to_module)} 可立即交接`;
      }
      if (pack.to_module) {
        return `${formatMainlineModuleLabel(pack.to_module)} 可立即交接`;
      }
      return "可立即交接";
    case "blocked_by_in_progress":
      if (pack.focus_module && pack.to_module) {
        return `${formatMainlineModuleLabel(pack.focus_module)}仍在运行，暂不能交接到${formatMainlineModuleLabel(pack.to_module)}`;
      }
      if (pack.focus_module) {
        return `${formatMainlineModuleLabel(pack.focus_module)}仍在运行`;
      }
      return "当前有进行中的工作，暂不能交接";
    case "blocked_by_follow_up":
      if (pack.focus_module && pack.to_module) {
        return `${formatMainlineModuleLabel(pack.focus_module)}后续流程未结算，暂不能交接到${formatMainlineModuleLabel(pack.to_module)}`;
      }
      if (pack.focus_module) {
        return `${formatMainlineModuleLabel(pack.focus_module)}后续流程未结算`;
      }
      return "后续流程未结算，暂不能交接";
    case "blocked_by_attention":
      if (pack.from_module && pack.to_module) {
        return `${formatMainlineModuleLabel(pack.from_module)} -> ${formatMainlineModuleLabel(pack.to_module)} 因关注事项暂停交接`;
      }
      if (pack.focus_module) {
        return `${formatMainlineModuleLabel(pack.focus_module)}存在关注事项`;
      }
      return "因关注事项暂停交接";
    case "completed":
      return "主线已完成";
    default:
      return "已记录交接状态";
  }
}

function formatAttentionItemDetail(item: MainlineAttentionItemViewModel): string {
  return `${formatMainlineModuleLabel(item.module)}${formatAttentionSeverityLabel(item.severity)}：${formatOperatorFacingReason(item.summary)}`;
}

function formatAttentionItemHeading(item: MainlineAttentionItemViewModel): string {
  return `${formatMainlineModuleLabel(item.module)}${formatAttentionItemKindLabel(item.kind)}`;
}

function formatAttentionItemKindLabel(
  kind: MainlineAttentionItemViewModel["kind"],
): string {
  switch (kind) {
    case "editing_needs_manual_resolution":
      return "编辑仍需人工处理";
    case "editing_blocked_by_missing_required_slots":
      return "编辑被必填槽位阻断";
    case "editing_blocked_by_high_risk_objects":
      return "编辑被高风险对象/表格/格式阻断";
    case "job_in_progress":
      return "任务进行中";
    case "follow_up_pending":
      return "后续待处理";
    case "follow_up_running":
      return "后续处理中";
    case "follow_up_retryable":
      return "后续可重试";
    case "follow_up_failed":
      return "后续失败";
    case "settlement_unlinked":
      return "结算未关联";
    case "job_failed":
      return "任务失败";
    case "runtime_binding_degraded":
      return "运行时降级";
    case "runtime_binding_missing":
      return "运行时缺失";
  }
}

function formatAttentionSeverityLabel(
  severity: MainlineAttentionItemViewModel["severity"],
): string {
  return severity === "action_required" ? "需处理" : "需关注";
}

function formatSettlementStatusLabel(
  status: ModuleMainlineSettlementDerivedStatus | undefined,
): string {
  switch (status) {
    case "business_completed_needs_manual_resolution":
      return "业务已完成，仍需人工处理";
    case "business_completed_blocked_by_missing_required_slots":
      return "业务已完成，被必填槽位阻断";
    case "business_completed_blocked_by_high_risk_objects":
      return "业务已完成，被高风险对象/表格/格式阻断";
    case "business_completed_settled":
      return "已结算";
    case "business_completed_follow_up_pending":
      return "业务已完成，后续待处理";
    case "business_completed_follow_up_running":
      return "业务已完成，后续处理中";
    case "business_completed_follow_up_retryable":
      return "业务已完成，后续可重试";
    case "business_completed_follow_up_failed":
      return "业务已完成，后续失败";
    case "business_completed_unlinked":
      return "业务已完成，结算未关联";
    case "job_failed":
      return "任务失败";
    case "job_in_progress":
      return "任务进行中";
    case "not_started":
      return "未开始";
    default:
      return "已记录";
  }
}

function formatJobStatusLabel(status: string): string {
  switch (status) {
    case "completed":
      return "已完成";
    case "failed":
      return "失败";
    case "cancelled":
      return "已取消";
    case "running":
      return "运行中";
    case "queued":
      return "排队中";
    default:
      return status;
  }
}

function formatRecoveryPostureLabel(input: {
  settlementStatus?: ModuleMainlineSettlementDerivedStatus;
  recoverySummary?: LinkedAgentExecutionRecoverySummaryViewModel;
}): string | undefined {
  const recoverySummary = input.recoverySummary;
  if (!recoverySummary) {
    return undefined;
  }

  if (
    input.settlementStatus === "business_completed_settled" &&
    recoverySummary.category === "not_recoverable"
  ) {
    return "无需恢复";
  }

  switch (recoverySummary.category) {
    case "recoverable_now":
      return "当前可恢复";
    case "stale_running":
      return "可立即接管异常运行任务";
    case "deferred_retry":
      return "等待重试窗口";
    case "attention_required":
      return "需要处理";
    case "not_recoverable":
      if (recoverySummary.recovery_readiness === "waiting_running_timeout") {
        return "等待运行超时窗口";
      }
      return "不可恢复";
  }
}

function formatRuntimeBindingReadinessLabel(
  observation:
    | {
        observation_status: "reported" | "failed_open";
        report?: RuntimeBindingReadinessReportViewModel;
        error?: string;
      }
    | undefined,
): string | undefined {
  if (!observation) {
    return undefined;
  }

  if (observation.observation_status === "failed_open") {
    return "观测不可用（failed open）";
  }

  const report = observation.report;
  if (!report) {
    return "已记录";
  }

  const issueCount = report.issues.length;
  const issueLabel = `${issueCount} 项问题`;

  if (report.status === "degraded") {
    return `已降级（${issueLabel}）`;
  }

  if (report.status === "missing") {
    return `缺失（${issueLabel}）`;
  }

  return "就绪";
}

function getJobExecutionTracking(
  latestJob: AnyWorkbenchJob | null,
): JobExecutionTrackingObservationViewModel | undefined {
  if (!latestJob || !("execution_tracking" in latestJob)) {
    return undefined;
  }

  return latestJob.execution_tracking;
}

function getJobBatchProgress(
  latestJob: AnyWorkbenchJob | null,
): JobViewModel["batch_progress"] | undefined {
  if (!latestJob || !("batch_progress" in latestJob)) {
    return undefined;
  }

  return latestJob.batch_progress;
}

function formatBatchLifecycleStatusLabel(
  status: NonNullable<JobViewModel["batch_progress"]>["lifecycle_status"],
): string {
  switch (status) {
    case "queued":
      return "排队中";
    case "running":
      return "运行中";
    case "completed":
      return "已完成";
    case "cancelled":
      return "已取消";
  }
}

function formatBatchSettlementStatusLabel(
  status: NonNullable<JobViewModel["batch_progress"]>["settlement_status"],
): string {
  switch (status) {
    case "in_progress":
      return "处理中";
    case "succeeded":
      return "成功";
    case "partial_success":
      return "部分成功";
    case "failed":
      return "失败";
    case "cancelled":
      return "已取消";
  }
}

function formatBatchItemStatusLabel(
  status: NonNullable<JobViewModel["batch_progress"]>["items"][number]["status"],
): string {
  switch (status) {
    case "queued":
      return "排队中";
    case "running":
      return "运行中";
    case "succeeded":
      return "成功";
    case "failed":
      return "失败";
    case "cancelled":
      return "已取消";
  }
}

function getJobManualReviewItems(
  payload: Record<string, unknown> | undefined,
): Array<{ ruleId: string; reason: string }> {
  const directItems = getManualReviewItemsValue(payload?.manualReviewItems);
  if (directItems.length > 0) {
    return directItems;
  }

  const proofreadingFindings = asRecord(payload?.proofreadingFindings);
  return getManualReviewItemsValue(proofreadingFindings?.manualReviewItems);
}

function getManualReviewItemsValue(
  value: unknown,
): Array<{ ruleId: string; reason: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return undefined;
      }

      const ruleId = typeof record.ruleId === "string" ? record.ruleId : "";
      const reason = typeof record.reason === "string" ? record.reason : "";
      if (ruleId.length === 0 || reason.length === 0) {
        return undefined;
      }

      return { ruleId, reason };
    })
    .filter((item): item is { ruleId: string; reason: string } => Boolean(item));
}

function getPayloadStringArray(
  payload: Record<string, unknown> | undefined,
  key: string,
): string[] {
  const value = payload?.[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueValues(
    value.filter((item): item is string => typeof item === "string" && item.length > 0),
  );
}

function getPayloadStringValue(
  payload: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = payload?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getPayloadExecutionMode(
  payload: Record<string, unknown> | undefined,
): "governed" | "bare" | undefined {
  const executionMode = payload?.executionMode;
  return executionMode === "governed" || executionMode === "bare"
    ? executionMode
    : undefined;
}

function getPayloadRuntimeBindingReadinessStatus(
  payload: Record<string, unknown> | undefined,
): "ready" | "degraded" | "missing" | undefined {
  const status = payload?.runtimeBindingReadinessStatus;
  return status === "ready" || status === "degraded" || status === "missing"
    ? status
    : undefined;
}

function resolveSnapshotRuntimeBindingReadinessStatus(
  snapshot: JobExecutionTrackingObservationViewModel["snapshot"] | undefined,
): "ready" | "degraded" | "missing" | undefined {
  const status = snapshot?.runtime_binding_readiness.report?.status;
  return status === "ready" || status === "degraded" || status === "missing"
    ? status
    : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function formatKnowledgeReferenceValue(
  knowledgeItemIds: readonly string[],
  knowledgeReferences?: Record<string, ManuscriptWorkbenchKnowledgeReferenceViewModel>,
): string {
  return uniqueValues(knowledgeItemIds)
    .map((knowledgeItemId) => {
      const reference = knowledgeReferences?.[knowledgeItemId];
      if (!reference || reference.title.trim().length === 0) {
        return knowledgeItemId;
      }

      return `${reference.title}（${knowledgeItemId}）`;
    })
    .join("; ");
}

function describeAsset(
  asset: DocumentAssetViewModel | null,
  manuscriptTitle?: string,
): string {
  if (!asset) {
    return "暂无";
  }

  if (manuscriptTitle) {
    return buildWorkbenchAssetDisplayName(manuscriptTitle, asset);
  }

  return asset.file_name ?? formatAssetTypeLabel(asset.asset_type);
}

function resolveManuscriptDisplayTitle(title: string): string {
  const normalizedTitle = title.trim();
  return normalizedTitle.length > 0 ? normalizedTitle : "当前稿件";
}

function isFinalProofAsset(asset: DocumentAssetViewModel | null): boolean {
  if (!asset) {
    return false;
  }

  return (
    asset.asset_type === "final_proof_issue_report" ||
    asset.asset_type === "final_proof_annotated_docx"
  );
}

function formatWorkbenchModeLabel(targetMode: ManuscriptWorkbenchMode): string {
  if (targetMode === "submission") {
    return "投稿";
  }
  if (targetMode === "screening") {
    return "初筛";
  }
  if (targetMode === "editing") {
    return "编辑";
  }

  return "校对";
}

function resolveSummaryFocusLabel(mode: ManuscriptWorkbenchMode): string {
  if (mode === "screening") {
    return "初筛判断、风险确认与移交建议";
  }

  if (mode === "editing") {
    return "编辑修订、结构确认与校对前收口";
  }

  if (mode === "proofreading") {
    return "校对问题收束、终稿确认与交付准备";
  }

  return "稿件接入与批量上传";
}

function formatManuscriptTypeLabel(manuscriptType: string): string {
  switch (manuscriptType) {
    case "review":
      return "综述";
    case "clinical_study":
      return "临床研究";
    case "case_report":
      return "病例报告";
    default:
      return manuscriptType;
  }
}

function formatManuscriptStatusLabel(status: string): string {
  switch (status) {
    case "uploaded":
      return "已上传";
    case "processing":
      return "处理中";
    case "completed":
      return "已完成";
    default:
      return status;
  }
}

function formatSourceModuleLabel(module: string): string {
  switch (module) {
    case "upload":
      return "上传";
    case "manual":
      return "人工";
    case "screening":
      return "初筛";
    case "editing":
      return "编辑";
    case "proofreading":
      return "校对";
    default:
      return module;
  }
}

function formatAssetStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "生效中";
    case "superseded":
      return "已替代";
    default:
      return status;
  }
}

function formatManualFeedbackCategoryLabel(category: ManualFeedbackCategory): string {
  switch (category) {
    case "missed_hit":
      return "这次没命中";
    case "incorrect_hit":
      return "命中错误";
    case "missing_knowledge":
      return "缺少知识";
  }
}

function formatManualFeedbackCategoryHint(category: ManualFeedbackCategory): string {
  switch (category) {
    case "missed_hit":
      return "将补充为规则候选";
    case "incorrect_hit":
      return "将修正为规则候选";
    case "missing_knowledge":
      return "将补充为知识候选";
  }
}

function formatManualFeedbackSubmissionFollowup(
  category: ManualFeedbackCategory,
  canOpenLearningReview: boolean,
): string {
  if (category === "missing_knowledge") {
    return canOpenLearningReview
      ? "复核项已进入知识候选链路，请在知识库台账中继续编辑并提交知识审核。"
      : "当前角色无知识库处理权限，复核项已进入后续审核队列。";
  }

  if (canOpenLearningReview) {
    return "复核项已进入学习审核队列，请继续完成人工判定与后续沉淀。";
  }

  return "当前角色无学习审核权限，复核项已进入后续审核队列。";
}

function formatActionResultActionLabel(actionLabel: string): string {
  switch (actionLabel) {
    case "Run Screening":
      return "发起初筛执行";
    case "Run Editing":
      return "发起编辑执行";
    case "Create Draft":
      return "生成校对草稿";
    case "Run Bare AI Once":
      return "AI 自动处理（本次）";
    case "Finalize Proofreading":
      return "完成校对定稿";
    case "Upload Manuscript":
      return "上传稿件";
    case "Load Workspace":
      return "加载工作区";
    case "Refresh Latest Job":
      return "刷新最近任务";
    case "Attach Manuscript File":
      return "关联稿件文件";
    case "Save Template Context":
      return "保存模板上下文";
    case "Export Current Asset":
      return "导出当前文件";
    case "Publish Human Final":
      return "发布人工终稿";
    case "Submit Manual Feedback":
      return "提交人工反馈";
    case "Submit Review Item":
      return "提交复核项";
    case "Record Manual Only":
      return "仅记录人工处理";
    case "Route Residual To Knowledge Candidate":
      return "残差转知识候选";
    default:
      return actionLabel;
  }
}

export function formatWorkbenchActionResultMessage(message: string): string {
  const submittedManualFeedbackMatch =
    /^Submitted manual feedback candidate (.+)$/u.exec(message);
  if (submittedManualFeedbackMatch) {
    return `已提交人工反馈并生成候选 ${submittedManualFeedbackMatch[1]}`;
  }

  const submittedReviewItemMatch = /^Submitted review item (.+)$/u.exec(message);
  if (submittedReviewItemMatch) {
    return `已提交复核项 ${submittedReviewItemMatch[1]}`;
  }

  const recordedManualOnlyMatch = /^Recorded manual-only review item (.+)$/u.exec(message);
  if (recordedManualOnlyMatch) {
    return `已记录人工处理 ${recordedManualOnlyMatch[1]}`;
  }

  const routedResidualKnowledgeMatch =
    /^Routed residual issue (.+) to knowledge candidate$/u.exec(message);
  if (routedResidualKnowledgeMatch) {
    return "已转入知识候选";
  }

  const createdAssetMatch = /^Created asset (.+)$/u.exec(message);
  if (createdAssetMatch) {
    return "已生成处理结果";
  }

  const finalizedAssetMatch = /^Finalized asset (.+)$/u.exec(message);
  if (finalizedAssetMatch) {
    return "已完成终稿生成";
  }

  const preparedExportMatch = /^Prepared export (.+)$/u.exec(message);
  if (preparedExportMatch) {
    return "已准备导出文件";
  }

  const openedProofreadingConfirmationMatch =
    /^Opened proofreading confirmation (.+)$/u.exec(message);
  if (openedProofreadingConfirmationMatch) {
    return "已打开校对确认页";
  }

  const publishedHumanFinalMatch = /^Published human-final asset (.+)$/u.exec(message);
  if (publishedHumanFinalMatch) {
    return "已发布人工终稿";
  }

  const uploadedManuscriptMatch = /^Uploaded manuscript (.+)$/u.exec(message);
  if (uploadedManuscriptMatch) {
    return "已上传稿件";
  }

  const loadedManuscriptMatch = /^Loaded manuscript (.+)$/u.exec(message);
  if (loadedManuscriptMatch) {
    return "已打开稿件";
  }

  const autoLoadedManuscriptMatch = /^Auto-loaded manuscript (.+)$/u.exec(message);
  if (autoLoadedManuscriptMatch) {
    return "已自动带入稿件";
  }

  const refreshedJobMatch = /^Refreshed job (.+)$/u.exec(message);
  if (refreshedJobMatch) {
    return "已刷新任务状态";
  }

  const attachedFileMatch = /^Attached file (.+)$/u.exec(message);
  if (attachedFileMatch) {
    return `已关联文件 ${attachedFileMatch[1]}`;
  }

  const updatedTemplateContextMatch = /^Updated template context for (.+)$/u.exec(message);
  if (updatedTemplateContextMatch) {
    return `已更新模板上下文 ${updatedTemplateContextMatch[1]}`;
  }

  return formatOperatorFacingReason(message);
}

function formatActionResultDetailLabel(label: string): string {
  switch (label) {
    case "Asset":
      return "资产";
    case "Job":
      return "任务";
    case "Job结算":
      return "任务结算";
    case "File":
      return "文件";
    case "Manuscript":
      return "稿件";
    case "Status":
      return "状态";
    case "Batch Job":
      return "批次任务";
    case "Batch Items":
      return "批次稿件数";
    case "Batch Lifecycle":
    case "批次进度":
      return "批次进度";
    case "Batch Settlement":
    case "批次结算":
      return "批次结算";
    case "Succeeded":
    case "已完成":
      return "已完成";
    case "Failed":
    case "失败":
      return "失败";
    case "Running":
    case "处理中":
      return "处理中";
    case "Remaining":
    case "待处理":
      return "待处理";
    case "Restart Posture":
    case "重启状态":
      return "重启状态";
    case "Recovery":
      return "恢复状态";
    case "Recovery Ready At":
      return "恢复可用时间";
    case "Current Asset":
      return "当前文件";
    case "Latest Job":
      return "最近任务";
    case "Base Template Family":
      return "基础模板族";
    case "Journal Template":
      return "期刊模板";
    case "Journal Overrides":
      return "期刊覆写";
    case "Export File Name":
      return "导出文件名";
    case "Download MIME Type":
      return "下载 MIME 类型";
    case "MIME Type":
      return "MIME 类型";
    case "Storage Key":
      return "存储键";
    case "Feedback Type":
      return "反馈类型";
    case "Feedback Record":
      return "反馈记录";
    case "Review Item":
      return "复核项";
    case "Recommended Route":
      return "建议去向";
    case "Learning Candidate":
      return "学习候选";
    default:
      return label;
  }
}

function formatActionResultDetailValue(label: string, value: string): string {
  if (label === "Feedback Type") {
    return formatManualFeedbackCategoryLabel(value as ManualFeedbackCategory);
  }

  if (label === "Recommended Route") {
    return formatHighRiskRecommendedRouteLabel(
      value as "rule_candidate" | "knowledge_candidate" | "prompt_template_candidate",
    );
  }

  if (label === "MIME Type" || label === "Download MIME Type") {
    return formatMimeTypeLabel(value);
  }

  if (label === "Status") {
    return formatJobStatusLabel(value);
  }

  if (label === "Batch Lifecycle" || label === "批次进度") {
    return formatBatchLifecycleStatusLabel(
      value as NonNullable<JobViewModel["batch_progress"]>["lifecycle_status"],
    );
  }

  if (label === "Batch Settlement" || label === "批次结算") {
    return formatBatchSettlementStatusLabel(
      value as NonNullable<JobViewModel["batch_progress"]>["settlement_status"],
    );
  }

  if (label === "Journal Overrides") {
    return formatJournalOverrideStateLabel(value);
  }

  if (label === "Base Template Family") {
    return formatTemplateFamilyDisplayLabel(value);
  }

  if (label.endsWith("结算") || label === "Settlement") {
    return formatSettlementStatusValue(value);
  }

  if (
    label === "Restart Posture" ||
    label === "重启状态" ||
    label === "原因摘要" ||
    label === "导出依据" ||
    label === "就绪原因"
  ) {
    return formatOperatorFacingReason(value);
  }

  return formatWorkbenchActionResultMessage(value);
}

function shouldDisplayActionResultDetail(label: string): boolean {
  return label !== "Job" && label !== "Storage Key";
}

function formatSummaryActionResultDetailValue(input: {
  label: string;
  value: string;
  manuscriptTitle: string;
  assets: readonly DocumentAssetViewModel[];
  latestJob: AnyWorkbenchJob | null;
}): string {
  if (input.label === "Asset") {
    const matchedAsset = input.assets.find((asset) => asset.id === input.value);
    return matchedAsset
      ? buildWorkbenchAssetDisplayName(input.manuscriptTitle, matchedAsset)
      : "已生成处理资产";
  }

  if (input.label === "Manuscript") {
    return resolveManuscriptDisplayTitle(input.manuscriptTitle);
  }

  if (input.label === "Job") {
    return input.latestJob
      ? formatJobTypeLabel(input.latestJob.job_type)
      : "已更新任务记录";
  }

  return formatActionResultDetailValue(input.label, input.value);
}

function formatAssetTypeLabel(assetType: string): string {
  return formatWorkbenchAssetTypeLabel(assetType);
}

function formatMimeTypeLabel(mimeType: string): string {
  switch (mimeType) {
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "Word 文档（DOCX）";
    case "text/markdown":
      return "Markdown 文档";
    case "application/octet-stream":
      return "二进制文件";
    default:
      return mimeType;
  }
}

function formatJobTypeLabel(jobType: string): string {
  switch (jobType) {
    case "screening_run":
      return "初筛执行";
    case "editing_run":
      return "编辑执行";
    case "proofreading_run":
      return "校对执行";
    case "publish_human_final":
      return "人工终稿发布";
    default:
      return jobType;
  }
}
