import type { ReactNode } from "react";
import { formatWorkbenchHash } from "../../app/workbench-routing.ts";
import { resolveBrowserApiUrl } from "../../lib/browser-http-client.ts";
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
import type { ModuleJobViewModel } from "../screening/index.ts";
import type {
  ManuscriptWorkbenchMode,
  ManuscriptWorkbenchWorkspace,
} from "./manuscript-workbench-controller.ts";

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

export function buildLatestJobPostureDetails(
  latestJob: JobViewModel | ModuleJobViewModel | null,
  overview?: ManuscriptModuleExecutionOverviewViewModel,
): WorkbenchActionResultDetail[] {
  return buildJobPostureDetails(latestJob, "最近任务", overview);
}

export function buildJobReviewEvidenceDetails(
  latestJob: JobViewModel | ModuleJobViewModel | null,
): WorkbenchActionResultDetail[] {
  if (!latestJob) {
    return [];
  }

  const payload = latestJob.payload;
  const manualReviewItems = getJobManualReviewItems(payload);
  const failedCheckRuleIds = getJobFailedCheckRuleIds(payload);
  const executionTracking = getJobExecutionTracking(latestJob);
  const snapshot =
    executionTracking?.observation_status === "reported"
      ? executionTracking.snapshot
      : undefined;
  const knowledgeItemIds =
    snapshot?.knowledge_item_ids ?? getPayloadStringArray(payload, "knowledgeItemIds");
  const modelId = snapshot?.model_id ?? getPayloadStringValue(payload, "modelId");
  const modelVersion = snapshot?.model_version;
  const reasonSummary =
    manualReviewItems.length > 0
      ? uniqueValues(manualReviewItems.map((item) => item.reason))
      : uniqueValues(executionTracking?.settlement?.reason ? [executionTracking.settlement.reason] : []);

  const details: WorkbenchActionResultDetail[] = [];

  if (manualReviewItems.length > 0) {
    details.push({
      label: "人工复核",
      value: `需要人工复核（${manualReviewItems.length} 项）`,
    });
  }

  if (failedCheckRuleIds.length > 0) {
    details.push({
      label: "规则命中",
      value: failedCheckRuleIds.join(", "),
    });
  }

  if (knowledgeItemIds.length > 0) {
    details.push({
      label: "知识引用",
      value: knowledgeItemIds.join(", "),
    });
  }

  if (modelId) {
    details.push({
      label: "模型版本",
      value: modelVersion ? `${modelId} / ${modelVersion}` : modelId,
    });
  }

  if (reasonSummary.length > 0) {
    details.push({
      label: "原因摘要",
      value: reasonSummary.join(" | "),
    });
  }

  return details;
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
      label: "Batch Lifecycle",
      value: formatBatchLifecycleStatusLabel(batchProgress.lifecycle_status),
    },
    {
      label: "Batch Settlement",
      value: formatBatchSettlementStatusLabel(batchProgress.settlement_status),
    },
    {
      label: "Succeeded",
      value: String(batchProgress.succeeded_count),
    },
    {
      label: "Failed",
      value: String(batchProgress.failed_count),
    },
    {
      label: "Running",
      value: String(batchProgress.running_count),
    },
    {
      label: "Remaining",
      value: String(batchProgress.remaining_count),
    },
    {
      label: "Restart Posture",
      value: batchProgress.restart_posture.reason,
    },
  ];
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
      value: slot.asset ? renderAssetMatrixValue(slot.asset) : "未生成",
    });
  }

  if (selection) {
    details.push({
      label: "当前导出选择",
      value: selection.asset
        ? `${selection.label} / ${renderAssetMatrixValue(selection.asset)}`
        : selection.label,
    });
    details.push({
      label: "导出依据",
      value: selection.reason,
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
      value: summary.reason,
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
      value: pack.reason,
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
  const latestJobReviewEvidenceDetails = buildJobReviewEvidenceDetails(latestJob);
  const resultAssetMatrix =
    latestExport?.matrix ?? workspace.manuscript.result_asset_matrix;
  const currentExportSelection = latestExport?.selection
    ? {
        ...latestExport.selection,
        asset: latestExport.asset,
      }
    : workspace.manuscript.current_export_selection;
  const resultAssetMatrixDetails = buildResultAssetMatrixDetails(
    resultAssetMatrix,
    currentExportSelection,
  );

  return (
    <section className="manuscript-workbench-summary">
      <header className="manuscript-workbench-summary-hero">
        <div className="manuscript-workbench-summary-hero-copy">
          <span className="manuscript-workbench-section-eyebrow">实时稿件台账</span>
          <h3>稿件总控台</h3>
          <p>
            无需离开当前工作线，即可查看最近操作、下一步交接与稿件当前记录。
          </p>
        </div>
        <div className="manuscript-workbench-summary-hero-stats">
          <div className="manuscript-workbench-desk-stat">
            <span>当前工作线</span>
            <strong>{formatWorkbenchModeLabel(mode)}</strong>
          </div>
          <div className="manuscript-workbench-desk-stat">
            <span>在册资产</span>
            <strong>{workspace.assets.length}</strong>
          </div>
        </div>
      </header>
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
                value={formatActionResultMessage(latestActionResult.message)}
              />
              {latestActionResult.details.map((detail) => (
                <SummaryMetric
                  key={`${detail.label}:${detail.value}`}
                  label={formatActionResultDetailLabel(detail.label)}
                  value={formatActionResultDetailValue(detail.label, detail.value)}
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

        <SummaryCard title="稿件概览">
          <SummaryMetric label="标题" value={workspace.manuscript.title} />
          <SummaryMetric label="稿件编号" value={workspace.manuscript.id} />
          <SummaryMetric
            label="稿件类型"
            value={formatManuscriptTypeLabel(workspace.manuscript.manuscript_type)}
          />
          <SummaryMetric
            label="基础模板族"
            value={
              workspace.templateFamily?.name ??
              workspace.manuscript.current_template_family_id ??
              "未绑定"
            }
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
                  : "仅基础"}
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

        <SummaryCard title="当前资产">
          {workspace.currentAsset ? (
            <>
              <SummaryMetric
                label="当前资产"
                value={renderAssetIdentity(workspace.currentAsset)}
              />
              <SummaryMetric
                label="存储键"
                value={<code>{workspace.currentAsset.storage_key}</code>}
              />
              <SummaryMetric
                label="推荐父资产"
                value={
                  workspace.suggestedParentAsset
                    ? renderAssetIdentity(workspace.suggestedParentAsset)
                    : "暂无推荐父资产"
                }
              />
              <SummaryMetric
                label="最近校对草稿"
                value={
                  workspace.latestProofreadingDraftAsset
                    ? renderAssetIdentity(workspace.latestProofreadingDraftAsset)
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
              <SummaryMetric label="任务 ID" value={<code>{latestJob.id}</code>} />
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
                label="导出存储键"
                value={<code>{latestExport.download.storage_key}</code>}
              />
              <SummaryMetric
                label="导出文件名"
                value={
                  latestExport.download.file_name ??
                  latestExport.asset.file_name ??
                  "未提供"
                }
              />
              <SummaryMetric
                label="下载 MIME 类型"
                value={formatMimeTypeLabel(latestExport.download.mime_type)}
              />
              <SummaryMetric
                label="来源资产"
                value={renderAssetIdentity(latestExport.asset)}
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
                <th>来源</th>
                <th>存储</th>
              </tr>
            </thead>
            <tbody>
              {workspace.assets.map((asset) => (
                <tr key={asset.id}>
                  <td>
                    <div className="manuscript-workbench-asset-cell">
                      <strong>{asset.file_name ?? asset.id}</strong>
                      <code>{asset.id}</code>
                    </div>
                  </td>
                  <td>{formatAssetTypeLabel(asset.asset_type)}</td>
                  <td>v{asset.version_no}</td>
                  <td>
                    <StatusPill tone={asset.is_current ? "success" : "neutral"}>
                      {asset.is_current ? "当前版本" : formatAssetStatusLabel(asset.status)}
                    </StatusPill>
                  </td>
                  <td>{formatSourceModuleLabel(asset.source_module)}</td>
                  <td>
                    <code>{asset.storage_key}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <details className="manuscript-workbench-debug-panel">
        <summary>调试快照</summary>
        <pre>
          {JSON.stringify(
            {
              workspace,
              mode,
              latestJob,
              latestExport,
            },
            null,
            2,
          )}
        </pre>
      </details>
    </section>
  );
}

interface SummaryCardProps {
  title: string;
  children: ReactNode;
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
            <p>{item.summary}</p>
            {item.recovery_ready_at ? (
              <small>{`恢复可用时间 ${formatTimestamp(item.recovery_ready_at)}`}</small>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function renderAssetIdentity(asset: DocumentAssetViewModel): ReactNode {
  return (
    <span className="manuscript-workbench-asset-identity">
      <span>{asset.file_name ?? formatAssetTypeLabel(asset.asset_type)}</span>
      <code>{asset.id}</code>
    </span>
  );
}

function renderAssetMatrixValue(asset: DocumentAssetViewModel): string {
  return `${asset.file_name ?? formatAssetTypeLabel(asset.asset_type)} / ${formatAssetTypeLabel(asset.asset_type)} / ${asset.id}`;
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
      value: workspace.manuscript.id,
    },
    ...buildManuscriptMainlineReadinessDetails(summary),
    {
      label: "当前资产",
      value: describeAsset(workspace.currentAsset),
    },
  ];

  if (summary.derived_status === "ready_for_next_step" && summary.next_module) {
    if (summary.next_module === mode) {
      if (mode === "screening") {
        return {
          focus: "在推荐父资产上发起初筛",
          guidance: summary.reason ?? "稿件已满足初筛执行条件。",
          details: [
            ...details,
            {
              label: "推荐父资产",
              value: describeAsset(workspace.suggestedParentAsset),
            },
          ],
        };
      }

      if (mode === "editing") {
        return {
          focus: "在已初筛稿件资产上发起编辑",
          guidance: summary.reason ?? "稿件已满足编辑执行条件。",
          details: [
            ...details,
            {
              label: "推荐父资产",
              value: describeAsset(workspace.suggestedParentAsset),
            },
          ],
        };
      }

      return {
        focus: "生成校对草稿",
        guidance: summary.reason ?? "稿件已满足校对执行条件。",
        details: [
          ...details,
          {
            label: "推荐父资产",
            value: describeAsset(workspace.suggestedParentAsset),
          },
        ],
      };
    }

    return {
      focus: `推进稿件进入${formatWorkbenchModeLabel(summary.next_module)}`,
      guidance:
        summary.reason ?? `稿件已满足${formatWorkbenchModeLabel(summary.next_module)}执行条件。`,
      details,
      targetMode: summary.next_module,
      targetLabel: `前往${formatWorkbenchModeLabel(summary.next_module)}工作台`,
    };
  }

  if (summary.derived_status === "in_progress") {
    return {
      focus: `等待${formatWorkbenchModeLabel(summary.active_module ?? mode)}执行完成`,
      guidance: summary.reason ?? "当前治理执行仍在进行中。",
      details,
    };
  }

  if (summary.derived_status === "waiting_for_follow_up") {
    return {
      focus: `等待${formatWorkbenchModeLabel(summary.active_module ?? mode)}后续流程完成结算`,
      guidance:
        summary.reason ??
        "业务结果已产出，但治理后续流程尚未结算。",
      details,
    };
  }

  if (summary.derived_status === "attention_required") {
    return {
      focus: `继续前请检查${formatWorkbenchModeLabel(summary.active_module ?? mode)}态势`,
      guidance:
        summary.reason ??
        "当前主线态势需要人工关注后，才能继续交接。",
      details,
    };
  }

  if (summary.derived_status === "completed" && mode !== "proofreading") {
    return {
      focus: "主线执行已全部结算",
      guidance:
        summary.reason ??
        "初筛、编辑和校对均已完成结算。",
      details,
    };
  }

  return undefined;
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
            value: workspace.manuscript.id,
          },
          {
            label: "导出",
            value: latestExport.download.storage_key,
          },
        ],
      };
    }

    return {
      focus: "推进稿件进入初筛",
      guidance: "可在初筛工作台使用稿件编号继续处理，或先准备导出后再交接。",
      details: [
        {
          label: "稿件",
          value: workspace.manuscript.id,
        },
        {
          label: "当前资产",
          value: describeAsset(workspace.currentAsset),
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
            value: workspace.manuscript.id,
          },
          {
            label: "当前资产",
            value: describeAsset(workspace.currentAsset),
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
          value: describeAsset(workspace.suggestedParentAsset),
        },
        {
          label: "当前资产",
          value: describeAsset(workspace.currentAsset),
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
            value: workspace.manuscript.id,
          },
          {
            label: "当前资产",
            value: describeAsset(workspace.currentAsset),
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
          value: describeAsset(workspace.suggestedParentAsset),
        },
        {
          label: "当前资产",
          value: describeAsset(workspace.currentAsset),
        },
      ],
    };
  }

  if (workspace.currentAsset?.asset_type === "human_final_docx") {
    return {
      focus: "将该稿件移交学习审核",
      guidance: "人工终稿已就绪，可进入学习快照治理流程。",
      details: [
        {
          label: "稿件",
          value: workspace.manuscript.id,
        },
        {
          label: "当前资产",
          value: describeAsset(workspace.currentAsset),
        },
      ],
      targetLabel: canOpenLearningReview ? "前往学习审核" : undefined,
      targetHref: canOpenLearningReview
        ? formatWorkbenchHash("learning-review", workspace.manuscript.id)
        : undefined,
    };
  }

  if (isFinalProofAsset(workspace.currentAsset)) {
    return {
      focus: "导出或移交已完成的校对结果",
      guidance: "当前校对终稿已激活，可继续下游交付。",
        details: [
          {
            label: "当前资产",
            value: describeAsset(workspace.currentAsset),
          },
          {
            label: "导出",
            value: latestExport?.download.storage_key ?? "请先在工作台工具区准备导出",
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
          value: describeAsset(workspace.latestProofreadingDraftAsset),
        },
        {
          label: "当前资产",
          value: describeAsset(workspace.currentAsset),
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
        value: describeAsset(workspace.suggestedParentAsset),
      },
      {
        label: "当前资产",
        value: describeAsset(workspace.currentAsset),
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

  const details = buildSettlementDetails(overview, input.workspace.currentAsset);

  switch (overview.settlement.derived_status) {
    case "business_completed_settled":
      return {
        focus: `推进稿件进入${input.nextStageLabel}`,
        guidance: `${formatMainlineModuleLabel(input.module)}结果已结算，可继续进入${input.nextStageLabel}工作线。`,
        details: [
          {
            label: "稿件",
            value: input.workspace.manuscript.id,
          },
          ...details,
        ],
        targetMode: input.nextMode,
        targetLabel: `前往${formatWorkbenchModeLabel(input.nextMode)}工作台`,
      };
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
  );

  switch (executionTracking.settlement.derived_status) {
    case "business_completed_settled":
      return {
        focus: `推进稿件进入${input.nextStageLabel}`,
        guidance: `${formatMainlineModuleLabel(input.module)}结果已结算，可继续进入${input.nextStageLabel}工作线。`,
        details: [
          {
            label: "稿件",
            value: input.workspace.manuscript.id,
          },
          ...details,
        ],
        targetMode: input.nextMode,
        targetLabel: `前往${formatWorkbenchModeLabel(input.nextMode)}工作台`,
      };
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
): WorkbenchActionResultDetail[] {
  const details: WorkbenchActionResultDetail[] = [
    {
      label: "结算状态",
      value: formatSettlementStatusLabel(overview.settlement?.derived_status),
    },
  ];

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
      label: "当前资产",
      value: describeAsset(currentAsset),
    });
  }

  return details;
}

function buildLatestJobExecutionTrackingSettlementDetails(
  executionTracking: JobExecutionTrackingObservationViewModel,
  currentAsset: DocumentAssetViewModel | null,
): WorkbenchActionResultDetail[] {
  const details: WorkbenchActionResultDetail[] = [
    {
      label: "结算状态",
      value: formatSettlementStatusLabel(executionTracking.settlement?.derived_status),
    },
  ];

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
      label: "当前资产",
      value: describeAsset(currentAsset),
    });
  }

  return details;
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
  return `${formatMainlineModuleLabel(item.module)}${formatAttentionSeverityLabel(item.severity)}：${item.summary}`;
}

function formatAttentionItemHeading(item: MainlineAttentionItemViewModel): string {
  return `${formatMainlineModuleLabel(item.module)}${formatAttentionItemKindLabel(item.kind)}`;
}

function formatAttentionItemKindLabel(
  kind: MainlineAttentionItemViewModel["kind"],
): string {
  switch (kind) {
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
      return "Queued";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
  }
}

function formatBatchSettlementStatusLabel(
  status: NonNullable<JobViewModel["batch_progress"]>["settlement_status"],
): string {
  switch (status) {
    case "in_progress":
      return "In progress";
    case "succeeded":
      return "Succeeded";
    case "partial_success":
      return "Partial success";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
  }
}

function formatBatchItemStatusLabel(
  status: NonNullable<JobViewModel["batch_progress"]>["items"][number]["status"],
): string {
  switch (status) {
    case "queued":
      return "queued";
    case "running":
      return "running";
    case "succeeded":
      return "succeeded";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
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

function getJobFailedCheckRuleIds(
  payload: Record<string, unknown> | undefined,
): string[] {
  const proofreadingFindings = asRecord(payload?.proofreadingFindings);
  const failedChecks = Array.isArray(proofreadingFindings?.failedChecks)
    ? proofreadingFindings.failedChecks
    : [];

  return uniqueValues(
    failedChecks
      .map((item) => {
        const record = asRecord(item);
        return typeof record?.ruleId === "string" ? record.ruleId : undefined;
      })
      .filter((value): value is string => Boolean(value)),
  );
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

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function describeAsset(asset: DocumentAssetViewModel | null): string {
  if (!asset) {
    return "暂无";
  }

  return `${asset.file_name ?? formatAssetTypeLabel(asset.asset_type)} / ${formatAssetTypeLabel(asset.asset_type)} / ${asset.id}`;
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

function formatActionResultActionLabel(actionLabel: string): string {
  switch (actionLabel) {
    case "Run Screening":
      return "发起初筛执行";
    case "Run Editing":
      return "发起编辑执行";
    case "Create Draft":
      return "生成校对草稿";
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
      return "导出当前资产";
    case "Publish Human Final":
      return "发布人工终稿";
    default:
      return actionLabel;
  }
}

function formatActionResultMessage(message: string): string {
  const createdAssetMatch = /^Created asset (.+)$/u.exec(message);
  if (createdAssetMatch) {
    return `已生成资产 ${createdAssetMatch[1]}`;
  }

  const finalizedAssetMatch = /^Finalized asset (.+)$/u.exec(message);
  if (finalizedAssetMatch) {
    return `已完成终稿资产 ${finalizedAssetMatch[1]}`;
  }

  const preparedExportMatch = /^Prepared export (.+)$/u.exec(message);
  if (preparedExportMatch) {
    return `已准备导出 ${preparedExportMatch[1]}`;
  }

  const publishedHumanFinalMatch = /^Published human-final asset (.+)$/u.exec(message);
  if (publishedHumanFinalMatch) {
    return `已发布人工终稿资产 ${publishedHumanFinalMatch[1]}`;
  }

  const uploadedManuscriptMatch = /^Uploaded manuscript (.+)$/u.exec(message);
  if (uploadedManuscriptMatch) {
    return `已上传稿件 ${uploadedManuscriptMatch[1]}`;
  }

  const loadedManuscriptMatch = /^Loaded manuscript (.+)$/u.exec(message);
  if (loadedManuscriptMatch) {
    return `已加载稿件 ${loadedManuscriptMatch[1]}`;
  }

  const autoLoadedManuscriptMatch = /^Auto-loaded manuscript (.+)$/u.exec(message);
  if (autoLoadedManuscriptMatch) {
    return `已自动带入稿件 ${autoLoadedManuscriptMatch[1]}`;
  }

  const refreshedJobMatch = /^Refreshed job (.+)$/u.exec(message);
  if (refreshedJobMatch) {
    return `已刷新任务 ${refreshedJobMatch[1]}`;
  }

  const attachedFileMatch = /^Attached file (.+)$/u.exec(message);
  if (attachedFileMatch) {
    return `已关联文件 ${attachedFileMatch[1]}`;
  }

  const updatedTemplateContextMatch = /^Updated template context for (.+)$/u.exec(message);
  if (updatedTemplateContextMatch) {
    return `已更新模板上下文 ${updatedTemplateContextMatch[1]}`;
  }

  return message;
}

function formatActionResultDetailLabel(label: string): string {
  switch (label) {
    case "Asset":
      return "资产";
    case "Job":
      return "任务";
    case "File":
      return "文件";
    case "Manuscript":
      return "稿件";
    case "Status":
      return "状态";
    case "Current Asset":
      return "当前资产";
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
    default:
      return label;
  }
}

function formatActionResultDetailValue(label: string, value: string): string {
  if (label === "MIME Type" || label === "Download MIME Type") {
    return formatMimeTypeLabel(value);
  }

  if (label === "Status") {
    return formatJobStatusLabel(value);
  }

  return formatActionResultMessage(value);
}

function formatAssetTypeLabel(assetType: string): string {
  switch (assetType) {
    case "original":
      return "原稿";
    case "edited_docx":
      return "编辑稿";
    case "screening_report":
      return "初筛报告";
    case "proofreading_draft_report":
      return "校对草稿";
    case "final_proof_annotated_docx":
      return "校对终稿";
    case "final_proof_issue_report":
      return "校对问题报告";
    case "human_final_docx":
      return "人工终稿";
    default:
      return assetType;
  }
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
