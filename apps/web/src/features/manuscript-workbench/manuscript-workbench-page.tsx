import React, { useEffect, useState } from "react";
import {
  WorkbenchCoreStrip,
  type WorkbenchCoreStripPillarId,
} from "../../app/workbench-core-strip.tsx";
import { formatWorkbenchHash } from "../../app/workbench-routing.ts";
import {
  createBrowserHttpClient,
  resolveBrowserApiUrl,
} from "../../lib/browser-http-client.ts";
import {
  buildProofreadingLocateTarget,
  type DocumentPreviewLocateTargetViewModel,
  type DocumentPreviewSessionViewModel,
} from "../document-preview/index.ts";
import type {
  KnowledgeHitLogViewModel,
  ModuleExecutionSnapshotViewModel as ExecutionTrackingSnapshotViewModel,
} from "../execution-tracking/types.ts";
import { formatWorkbenchRequestError } from "./manuscript-workbench-error-format.ts";
import type { AuthRole } from "../auth/index.ts";
import type {
  DocumentAssetExportViewModel,
  DocumentAssetViewModel,
  JobViewModel,
  ManuscriptType,
  UploadManuscriptInput,
} from "../manuscripts/index.ts";
import { MAX_MANUSCRIPT_BATCH_UPLOAD_COUNT } from "../manuscripts/index.ts";
import type { ModuleJobViewModel } from "../screening/index.ts";
import type {
  ProofreadingConfirmationDecisionAction,
  ProofreadingConfirmationDecisionInput,
} from "../proofreading/index.ts";
import {
  ManuscriptWorkbenchControls,
  type ManuscriptWorkbenchActionPanelProps,
  type ManuscriptWorkbenchLookupPanelProps,
  type ManuscriptWorkbenchTemplateSelectionPanelProps,
} from "./manuscript-workbench-controls.tsx";
import {
  ManuscriptWorkbenchQueuePane,
  type ManuscriptWorkbenchQueueFilter,
  type ManuscriptWorkbenchQueueItem,
} from "./manuscript-workbench-queue-pane.tsx";
import {
  ManuscriptWorkbenchNotice,
  type ManuscriptWorkbenchNoticeProps,
} from "./manuscript-workbench-notice.tsx";
import { createInlineUploadFields } from "./manuscript-upload-file.ts";
import {
  buildJobBatchProgressDetails,
  buildJobPostureDetails,
  buildJobReviewEvidenceDetails,
  buildLatestJobPostureDetails,
  buildManuscriptMainlineAttentionHandoffPackDetails,
  buildManuscriptMainlineAttemptLedgerDetails,
  buildManuscriptMainlineReadinessDetails,
  formatWorkbenchActionResultMessage,
  ManuscriptWorkbenchSummary,
  type ManuscriptWorkbenchManualFeedbackViewModel,
  type ManuscriptWorkbenchProofreadingGovernanceActionsViewModel,
  type WorkbenchActionResultViewModel,
  type WorkbenchActionResultDetail,
} from "./manuscript-workbench-summary.tsx";
import type { ManualFeedbackCategory } from "../feedback-governance/index.ts";
import type {
  HumanReviewDiffItemViewModel,
  HumanReviewPublishModule,
  HumanReviewPublishPreflightResultViewModel,
  HumanReviewQueueBatchDecisionChangeInput,
  HumanReviewQueueDecisionChangeInput,
} from "../human-review/index.ts";
import {
  buildHighRiskReviewItemsFromJob,
  type ManuscriptWorkbenchHighRiskReviewItemViewModel,
} from "./manuscript-workbench-high-risk-review.ts";
import {
  buildAssetPreviewComments,
  buildAssetReportPreviewBody,
  buildEditingChangeLedgerEntries,
  buildProofreadingConfirmationDraftState,
  buildEditingCompletionGateSummary,
  buildEditingRuntimeBindingExplanation,
  buildEditingAutomaticActionLedger,
  buildEditingDocumentBlocks,
  buildEditingGuardrailEntries,
  buildEditingSlotGovernanceSummary,
  buildDeepProofreadingEvidence,
  buildProofreadingConfirmationItems,
  buildProofreadingDocumentBlocks,
  buildScreeningDocumentBlocks,
  buildScreeningWorkspaceFocusItems,
  buildWorkbenchAssetCollectionHref,
  buildWorkbenchAssetDetailHref,
  ManuscriptWorkbenchAssetDetailPage,
  type EditingSlotManualSaveInput,
  resolveManuscriptAssetDetailKind,
  type ManuscriptAssetDetailKind,
  type ProofreadingConfirmationDraftState,
  type ProofreadingConfirmationItemViewModel,
} from "./manuscript-workbench-detail.tsx";
import {
  buildWorkbenchAssetDisplayName,
  formatWorkbenchGeneratedOutputTypeLabel,
  resolveWorkbenchAssetDownloadLabel,
} from "./manuscript-workbench-asset-labels.ts";
import {
  createManuscriptWorkbenchController,
  isSelectableParentAsset,
  resolveWorkbenchReadOnlyExecutionContext,
  type ManuscriptWorkbenchController,
  type ManuscriptWorkbenchMode,
  type ManuscriptWorkbenchReadOnlyExecutionContextViewModel,
  type ManuscriptWorkbenchRunMode,
  type ManuscriptWorkbenchWorkspaceLoadOptions,
  type RunModuleAndLoadInput,
  type ManuscriptWorkbenchTemplateContext,
  type ManuscriptWorkbenchWorkspace,
} from "./manuscript-workbench-controller.ts";
import type { ManuscriptWorkbenchProofreadingGovernanceHandoffViewModel } from "./manuscript-workbench-governance-handoff.ts";

const AI_RECOGNITION_ACTION_LABEL = "Run AI Recognition";
const BARE_AI_ACTION_DISPLAY_LABEL = "AI识别";
const LEGACY_BARE_AI_ACTION_LABEL = "AI 自动处理（本次）";

export { buildHighRiskReviewItemsFromJob };
export { buildWorkbenchAssetDisplayName };

export interface ManualFeedbackContext {
  snapshotId: string;
  sourceAssetId: string;
}

export interface BuildManualFeedbackActionResultInput {
  feedbackCategory: ManualFeedbackCategory;
  feedbackRecordId: string;
  reviewItemId: string;
  recommendedRoute?: "rule_candidate" | "knowledge_candidate" | "prompt_template_candidate";
}

export interface ManuscriptWorkbenchPageProps {
  mode: ManuscriptWorkbenchMode;
  actorRole?: AuthRole;
  controller?: ManuscriptWorkbenchController;
  prefilledManuscriptId?: string;
  prefilledAssetId?: string;
  prefilledPresentation?: "fullscreen";
  prefilledReviewedCaseSnapshotId?: string;
  prefilledSampleSetItemId?: string;
  accessibleHandoffModes?: readonly ManuscriptWorkbenchMode[];
  canOpenLearningReview?: boolean;
  canOpenEvaluationWorkbench?: boolean;
}

export async function loadPrefilledWorkbenchWorkspace(
  controller: Pick<ManuscriptWorkbenchController, "loadWorkspace" | "loadJob"> &
    Partial<Pick<ManuscriptWorkbenchController, "loadModuleExecutionConcurrency">>,
  manuscriptId: string,
  options?: ManuscriptWorkbenchWorkspaceLoadOptions,
): Promise<{
  workspace: ManuscriptWorkbenchWorkspace;
  latestJob: JobViewModel | null;
  status: string;
  latestActionResult: WorkbenchActionResultViewModel;
}> {
  const workspace = await hydrateWorkbenchWorkspaceConcurrency(
    controller,
    await controller.loadWorkspace(manuscriptId, options),
  );
  const latestJob = await hydrateLatestWorkbenchJob(controller, workspace);
  const status = `Auto-loaded manuscript ${workspace.manuscript.id}`;
  const details = [
    {
      label: "Manuscript",
      value: workspace.manuscript.id,
    },
    {
      label: "Current Asset",
      value: workspace.currentAsset?.id ?? "Not available",
    },
    ...buildManuscriptMainlineReadinessDetails(
      workspace.manuscript.mainline_readiness_summary,
    ),
    ...buildManuscriptMainlineAttentionHandoffPackDetails(
      workspace.manuscript.mainline_attention_handoff_pack,
    ),
    ...buildManuscriptMainlineAttemptLedgerDetails(
      workspace.manuscript.mainline_attempt_ledger,
    ),
    ...(latestJob
        ? [
          {
            label: "Latest Job",
            value: latestJob.id,
          },
          ...buildLatestJobPostureDetails(
            latestJob,
            workspace.manuscript.module_execution_overview,
          ),
        ]
      : []),
  ];

  return {
    workspace,
    latestJob,
    status,
    latestActionResult: {
      tone: "success",
      actionLabel: "Load Workspace",
      message: status,
      details,
    },
  };
}

async function hydrateWorkbenchWorkspaceConcurrency(
  controller: Partial<Pick<ManuscriptWorkbenchController, "loadModuleExecutionConcurrency">>,
  workspace: ManuscriptWorkbenchWorkspace,
): Promise<ManuscriptWorkbenchWorkspace> {
  if (typeof controller.loadModuleExecutionConcurrency !== "function") {
    return workspace;
  }

  try {
    return {
      ...workspace,
      moduleExecutionConcurrency:
        await controller.loadModuleExecutionConcurrency(),
    };
  } catch {
    return workspace;
  }
}

export function buildWorkbenchJobActionResultDetails(
  baseDetails: WorkbenchActionResultDetail[],
  job: JobViewModel | ModuleJobViewModel,
  overview?: ManuscriptWorkbenchWorkspace["manuscript"]["module_execution_overview"],
): WorkbenchActionResultDetail[] {
  return [
    ...baseDetails,
    ...buildJobPostureDetails(job, "Job", overview),
    ...buildJobBatchProgressDetails(job),
    ...buildJobReviewEvidenceDetails(job),
  ];
}

export function resolveManualFeedbackContext(
  mode: ManuscriptWorkbenchMode,
  workspace: ManuscriptWorkbenchWorkspace,
): ManualFeedbackContext | null {
  if (mode === "submission") {
    return null;
  }

  const currentAsset = workspace.currentAsset;
  if (!currentAsset || currentAsset.source_module !== mode) {
    return null;
  }

  const moduleOverview = workspace.manuscript.module_execution_overview?.[mode];
  if (!moduleOverview || moduleOverview.observation_status !== "reported") {
    return null;
  }

  const snapshot = moduleOverview.latest_snapshot;
  if (!snapshot?.id) {
    return null;
  }

  if (
    snapshot.created_asset_ids.length > 0 &&
    !snapshot.created_asset_ids.includes(currentAsset.id)
  ) {
    return null;
  }

  return {
    snapshotId: snapshot.id,
    sourceAssetId: currentAsset.id,
  };
}

export function buildManualFeedbackActionResult(
  input: BuildManualFeedbackActionResultInput,
): WorkbenchActionResultViewModel {
  return {
    tone: "success",
    actionLabel: "Submit Review Item",
    message: `Submitted review item ${input.reviewItemId}`,
    details: [
      {
        label: "Feedback Type",
        value: input.feedbackCategory,
      },
      {
        label: "Feedback Record",
        value: input.feedbackRecordId,
      },
      {
        label: "Review Item",
        value: input.reviewItemId,
      },
      ...(input.recommendedRoute
        ? [
            {
              label: "Recommended Route",
              value: input.recommendedRoute,
            },
          ]
        : []),
    ],
  };
}

export function buildManualOnlyReviewActionResult(
  item: Pick<
    ManuscriptWorkbenchHighRiskReviewItemViewModel,
    "id" | "feedbackCategory" | "recommendedRoute"
  >,
): WorkbenchActionResultViewModel {
  return {
    tone: "success",
    actionLabel: "Record Manual Only",
    message: `Recorded manual-only review item ${item.id}`,
    details: [
      {
        label: "Feedback Type",
        value: item.feedbackCategory,
      },
      {
        label: "Review Item",
        value: item.id,
      },
      ...(item.recommendedRoute
        ? [
            {
              label: "Recommended Route",
              value: item.recommendedRoute,
            },
          ]
        : []),
    ],
  };
}

export async function loadPrefilledWorkbenchPageData(
  controller: Pick<ManuscriptWorkbenchController, "loadWorkspace" | "loadJob"> &
    Partial<
      Pick<
        ManuscriptWorkbenchController,
        "loadModuleExecutionConcurrency" | "loadProofreadingGovernanceHandoff"
      >
    >,
  input: {
    mode: ManuscriptWorkbenchMode;
    manuscriptId: string;
    actorRole?: AuthRole;
  },
): Promise<
  Awaited<ReturnType<typeof loadPrefilledWorkbenchWorkspace>> & {
    proofreadingGovernanceHandoff?:
      | ManuscriptWorkbenchProofreadingGovernanceHandoffViewModel
      | undefined;
  }
> {
  const workspaceResult = await loadPrefilledWorkbenchWorkspace(
    controller,
    input.manuscriptId,
    {
      actorRole: input.actorRole,
      mode: input.mode,
    },
  );

  if (
    input.mode !== "proofreading" ||
    typeof controller.loadProofreadingGovernanceHandoff !== "function"
  ) {
    return {
      ...workspaceResult,
      proofreadingGovernanceHandoff: undefined,
    };
  }

  try {
    return {
      ...workspaceResult,
      proofreadingGovernanceHandoff:
        await controller.loadProofreadingGovernanceHandoff(
          input.manuscriptId,
          resolveProofreadingGovernanceHandoffScope(workspaceResult.workspace),
        ),
    };
  } catch {
    return {
      ...workspaceResult,
      proofreadingGovernanceHandoff: undefined,
    };
  }
}

function resolveProofreadingGovernanceHandoffScope(
  workspace: Pick<ManuscriptWorkbenchWorkspace, "manuscript">,
): {
  snapshotId?: string;
} | undefined {
  const overview = workspace.manuscript.module_execution_overview?.proofreading;
  if (overview?.observation_status !== "reported") {
    return undefined;
  }

  const snapshotId = overview.latest_snapshot?.id?.trim() ?? "";
  return snapshotId ? { snapshotId } : undefined;
}

function readProofreadingConfirmationSummary(
  job: Pick<AnyWorkbenchJob, "payload">,
): {
  totalItems: number;
  acceptedIntoManuscriptCount: number;
  rejectedCount: number;
  routedRuleCandidateCount: number;
  routedKnowledgeCandidateCount: number;
  manualOnlyCount: number;
} | null {
  const payload =
    job.payload && typeof job.payload === "object" && !Array.isArray(job.payload)
      ? (job.payload as Record<string, unknown>)
      : undefined;
  const summary =
    payload?.confirmationSummary &&
    typeof payload.confirmationSummary === "object" &&
    !Array.isArray(payload.confirmationSummary)
      ? (payload.confirmationSummary as Record<string, unknown>)
      : undefined;

  const readCount = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined;

  if (summary) {
    return {
      totalItems: readCount(summary.totalItems) ?? 0,
      acceptedIntoManuscriptCount:
        readCount(summary.acceptedIntoManuscriptCount) ?? 0,
      rejectedCount: readCount(summary.rejectedCount) ?? 0,
      routedRuleCandidateCount: readCount(summary.routedRuleCandidateCount) ?? 0,
      routedKnowledgeCandidateCount:
        readCount(summary.routedKnowledgeCandidateCount) ?? 0,
      manualOnlyCount: readCount(summary.manualOnlyCount) ?? 0,
    };
  }

  const serializedDecisions = Array.isArray(payload?.confirmationDecisions)
    ? payload.confirmationDecisions
    : [];
  if (serializedDecisions.length === 0) {
    return null;
  }

  const actions = serializedDecisions.map((entry) =>
    entry && typeof entry === "object" && !Array.isArray(entry)
      ? (entry as Record<string, unknown>).action
      : undefined,
  );

  const countAction = (action: string) =>
    actions.filter((value) => value === action).length;

  return {
    totalItems: serializedDecisions.length,
    acceptedIntoManuscriptCount:
      countAction("accept") +
      countAction("accept_and_edit") +
      countAction("manual_only") +
      countAction("route_to_rule_candidate") +
      countAction("route_to_knowledge_candidate"),
    rejectedCount: countAction("reject"),
    routedRuleCandidateCount: countAction("route_to_rule_candidate"),
    routedKnowledgeCandidateCount: countAction("route_to_knowledge_candidate"),
    manualOnlyCount: countAction("manual_only"),
  };
}

export function buildPublishedHumanFinalActionResult(input: {
  publishedAsset: {
    id: string;
    asset_type: string;
  };
  job: AnyWorkbenchJob;
  overview?: ManuscriptWorkbenchWorkspace["manuscript"]["module_execution_overview"];
}): WorkbenchActionResultViewModel {
  const confirmationSummary = readProofreadingConfirmationSummary(input.job);

  return {
    tone: "success",
    actionLabel: "Publish Human Final",
    message: `Published human-final asset ${input.publishedAsset.id}`,
    details: buildWorkbenchJobActionResultDetails(
      [
        {
          label: "Asset",
          value: input.publishedAsset.id,
        },
        {
          label: "产出类型",
          value: resolveGeneratedOutputTypeLabel(
            input.publishedAsset.asset_type,
            "proofreading",
          ),
        },
        ...(confirmationSummary
          ? [
              {
                label: "确认条目",
                value: String(confirmationSummary.totalItems),
              },
              {
                label: "写入终稿",
                value: String(confirmationSummary.acceptedIntoManuscriptCount),
              },
              {
                label: "拒绝",
                value: String(confirmationSummary.rejectedCount),
              },
              {
                label: "规则候选",
                value: String(confirmationSummary.routedRuleCandidateCount),
              },
              {
                label: "知识候选",
                value: String(confirmationSummary.routedKnowledgeCandidateCount),
              },
              {
                label: "仅人工处理",
                value: String(confirmationSummary.manualOnlyCount),
              },
            ]
          : []),
        {
          label: "Job",
          value: input.job.id,
        },
      ],
      input.job,
      input.overview,
    ),
  };
}

export interface WorkbenchDetailExecutionTrackingViewModel {
  snapshot: ExecutionTrackingSnapshotViewModel | null;
  knowledgeHitLogs: KnowledgeHitLogViewModel[];
}

function createEmptyWorkbenchDetailExecutionTracking(): WorkbenchDetailExecutionTrackingViewModel {
  return {
    snapshot: null,
    knowledgeHitLogs: [],
  };
}

function isManualFeedbackCategory(
  value: string,
): value is ManualFeedbackCategory {
  return (
    value === "missed_hit" ||
    value === "incorrect_hit" ||
    value === "missing_knowledge"
  );
}

export function resolveWorkbenchNotice(input: {
  error: string;
  status: string;
  latestActionResult: WorkbenchActionResultViewModel | null;
}): ManuscriptWorkbenchNoticeProps | null {
  if (input.error) {
    return {
      tone: "error",
      title: "操作失败",
      message: input.error,
    };
  }

  const fallbackMessage =
    input.status.trim() || input.latestActionResult?.message.trim() || "";
  const localizedFallbackMessage = formatWorkbenchActionResultMessage(fallbackMessage);
  if (!fallbackMessage) {
    return null;
  }

  if (!input.latestActionResult || input.latestActionResult.tone !== "success") {
    return {
      tone: "success",
      title: "操作已完成",
      message: localizedFallbackMessage,
    };
  }

  if (
    input.latestActionResult.actionLabel === "Upload Manuscript" ||
    fallbackMessage.startsWith("Uploaded manuscript ")
  ) {
    return {
      tone: "success",
      title: "操作已完成",
      message: localizedFallbackMessage,
    };
  }

  const settlement = findWorkbenchActionDetailValue(input.latestActionResult.details, "Settlement");
  if (!settlement || settlement === "Settled" || settlement === "已结算") {
    return {
      tone: "success",
      title: "操作已完成",
      message: localizedFallbackMessage,
    };
  }

  return {
    tone: "success",
    title: "操作已记录",
    message: buildWorkbenchActionNoticeMessage(
      localizedFallbackMessage,
      settlement,
      findWorkbenchActionDetailValue(input.latestActionResult.details, "Recovery"),
      findWorkbenchActionDetailValue(input.latestActionResult.details, "Recovery Ready At"),
    ),
  };
}

export async function refreshLatestWorkbenchJobContext(
  controller: Pick<ManuscriptWorkbenchController, "loadJob" | "loadWorkspace"> &
    Partial<Pick<ManuscriptWorkbenchController, "loadModuleExecutionConcurrency">>,
  input: {
    manuscriptId: string;
    latestJobId: string;
    actorRole?: AuthRole;
    mode?: ManuscriptWorkbenchMode;
  },
): Promise<{
  latestJob: JobViewModel;
  workspace: ManuscriptWorkbenchWorkspace | null;
  status: string;
  latestActionResult: WorkbenchActionResultViewModel;
}> {
  const latestJob = await controller.loadJob(input.latestJobId);
  let workspace: ManuscriptWorkbenchWorkspace | null = null;

  try {
    workspace = await hydrateWorkbenchWorkspaceConcurrency(
      controller,
      await controller.loadWorkspace(input.manuscriptId, {
        actorRole: input.actorRole,
        mode: input.mode,
      }),
    );
  } catch {
    workspace = null;
  }

  const status = `Refreshed job ${latestJob.id}`;

  return {
    latestJob,
    workspace,
    status,
    latestActionResult: {
      tone: "success",
      actionLabel: "Refresh Latest Job",
      message: status,
      details: [
        ...buildWorkbenchJobActionResultDetails(
          [
            {
              label: "Job",
              value: latestJob.id,
            },
            {
              label: "Status",
              value: latestJob.status,
            },
          ],
          latestJob,
          workspace?.manuscript.module_execution_overview,
        ),
        ...buildManuscriptMainlineReadinessDetails(
          workspace?.manuscript.mainline_readiness_summary,
        ),
        ...buildManuscriptMainlineAttentionHandoffPackDetails(
          workspace?.manuscript.mainline_attention_handoff_pack,
        ),
        ...buildManuscriptMainlineAttemptLedgerDetails(
          workspace?.manuscript.mainline_attempt_ledger,
        ),
      ],
    },
  };
}

type AnyWorkbenchJob = JobViewModel | ModuleJobViewModel;
const defaultController = createManuscriptWorkbenchController(createBrowserHttpClient());

export interface WorkbenchProgressSnapshot {
  label: string;
  percent: number;
  status: "idle" | "queued" | "running" | "completed" | "failed";
  isLive: boolean;
}

export function resolveWorkbenchProgressSnapshot(input: {
  mode: Exclude<ManuscriptWorkbenchMode, "submission">;
  workspace: ManuscriptWorkbenchWorkspace | null;
  latestJob: AnyWorkbenchJob | null;
}): WorkbenchProgressSnapshot {
  const latestStatus =
    input.latestJob?.status ??
    (input.workspace
      ? resolveLatestModuleJobStatus(input.workspace.manuscript, input.mode)
      : undefined);
  const batchProgress =
    input.latestJob && "batch_progress" in input.latestJob
      ? input.latestJob.batch_progress
      : undefined;

  if (batchProgress && batchProgress.total_count > 0) {
    const completedCount =
      batchProgress.succeeded_count +
      batchProgress.failed_count +
      batchProgress.cancelled_count;
    const percent = Math.min(
      100,
      Math.max(0, Math.round((completedCount / batchProgress.total_count) * 100)),
    );
    const isLive =
      batchProgress.lifecycle_status === "queued" ||
      batchProgress.lifecycle_status === "running";
    return {
      label: `批量处理 ${completedCount}/${batchProgress.total_count}`,
      percent: isLive && percent === 0 ? 8 : percent,
      status:
        batchProgress.lifecycle_status === "queued"
          ? "queued"
          : batchProgress.lifecycle_status === "running"
            ? "running"
            : batchProgress.settlement_status === "failed" ||
                batchProgress.settlement_status === "cancelled"
              ? "failed"
              : "completed",
      isLive,
    };
  }

  if (latestStatus === "queued") {
    return {
      label: `${resolveModuleModeLabel(input.mode)}排队中`,
      percent: 8,
      status: "queued",
      isLive: true,
    };
  }

  if (latestStatus === "running") {
    return {
      label: `${resolveModuleModeLabel(input.mode)}处理中`,
      percent: 55,
      status: "running",
      isLive: true,
    };
  }

  if (latestStatus === "completed") {
    return {
      label: `${resolveModuleModeLabel(input.mode)}已完成`,
      percent: 100,
      status: "completed",
      isLive: false,
    };
  }

  if (latestStatus === "failed" || latestStatus === "cancelled") {
    return {
      label: `${resolveModuleModeLabel(input.mode)}未完成`,
      percent: 100,
      status: "failed",
      isLive: false,
    };
  }

  return {
    label: `${resolveModuleModeLabel(input.mode)}未开始`,
    percent: 0,
    status: "idle",
    isLive: false,
  };
}

export async function hydrateWorkbenchDetailJob(
  controller: Pick<ManuscriptWorkbenchController, "loadJob">,
  input: {
    sourceJobId?: string | null;
    latestJob?: AnyWorkbenchJob | null;
  },
): Promise<AnyWorkbenchJob | null> {
  if (!input.sourceJobId) {
    return null;
  }

  try {
    return await controller.loadJob(input.sourceJobId);
  } catch {
    if (input.latestJob?.id === input.sourceJobId) {
      return input.latestJob;
    }

    return null;
  }
}

function hasExecutionTrackingObservation(
  job: AnyWorkbenchJob | null | undefined,
): job is JobViewModel {
  return job != null && "execution_tracking" in job;
}

function resolveWorkbenchDetailInlineExecutionSnapshot(
  job: AnyWorkbenchJob | null | undefined,
): ExecutionTrackingSnapshotViewModel | null {
  if (!hasExecutionTrackingObservation(job)) {
    return null;
  }

  const observation = job.execution_tracking;
  if (observation?.observation_status !== "reported" || !observation.snapshot) {
    return null;
  }

  return observation.snapshot;
}

function resolveWorkbenchDetailSnapshotId(
  job: AnyWorkbenchJob | null | undefined,
): string | null {
  const inlineSnapshotId =
    resolveWorkbenchDetailInlineExecutionSnapshot(job)?.id?.trim() ?? "";
  if (inlineSnapshotId.length > 0) {
    return inlineSnapshotId;
  }

  const snapshotId = job?.payload?.snapshotId;
  return typeof snapshotId === "string" && snapshotId.trim().length > 0
    ? snapshotId.trim()
    : null;
}

export async function hydrateWorkbenchDetailExecutionTracking(
  controller: Partial<
    Pick<
      ManuscriptWorkbenchController,
      "loadExecutionSnapshot" | "loadKnowledgeHitLogsBySnapshotId"
    >
  >,
  sourceJob: AnyWorkbenchJob | null | undefined,
): Promise<WorkbenchDetailExecutionTrackingViewModel> {
  const inlineSnapshot = resolveWorkbenchDetailInlineExecutionSnapshot(sourceJob);
  const snapshotId = resolveWorkbenchDetailSnapshotId(sourceJob);

  if (!snapshotId) {
    return {
      snapshot: inlineSnapshot,
      knowledgeHitLogs: [],
    };
  }

  let snapshot = inlineSnapshot;
  if (!snapshot && typeof controller.loadExecutionSnapshot === "function") {
    try {
      snapshot = (await controller.loadExecutionSnapshot(snapshotId)) ?? null;
    } catch {
      snapshot = null;
    }
  }

  let knowledgeHitLogs: KnowledgeHitLogViewModel[] = [];
  if (typeof controller.loadKnowledgeHitLogsBySnapshotId === "function") {
    try {
      knowledgeHitLogs = await controller.loadKnowledgeHitLogsBySnapshotId(snapshotId);
    } catch {
      knowledgeHitLogs = [];
    }
  }

  return {
    snapshot,
    knowledgeHitLogs,
  };
}

export function pruneConfirmationState(
  current: Readonly<Record<string, ProofreadingConfirmationDraftState>>,
  items: readonly ProofreadingConfirmationItemViewModel[],
): Record<string, ProofreadingConfirmationDraftState> {
  const next: Record<string, ProofreadingConfirmationDraftState> = {};

  for (const item of items) {
    const draft = current[item.itemId];
    if (!draft) {
      continue;
    }

    const editedReplacementText =
      draft.action === "accepted_with_manual_edit" ||
      draft.action === "accept_and_edit"
        ? normalizeOptionalText(draft.editedReplacementText ?? "")
        : undefined;
    const note = normalizeOptionalText(draft.note ?? "");
    const routeToRuleCandidate =
      draft.routeToRuleCandidate === true ||
      draft.action === "route_to_rule_candidate";
    const routeToKnowledgeCandidate =
      draft.routeToKnowledgeCandidate === true ||
      draft.action === "route_to_knowledge_candidate";

    if (
      !draft.action &&
      !editedReplacementText &&
      !note &&
      !routeToRuleCandidate &&
      !routeToKnowledgeCandidate
    ) {
      continue;
    }

    next[item.itemId] = {
      ...(draft.action ? { action: draft.action } : {}),
      ...(editedReplacementText ? { editedReplacementText } : {}),
      ...(routeToRuleCandidate ? { routeToRuleCandidate } : {}),
      ...(routeToKnowledgeCandidate ? { routeToKnowledgeCandidate } : {}),
      ...(note ? { note } : {}),
    };
  }

  return next;
}

export function buildProofreadingConfirmationDecisions(
  items: readonly ProofreadingConfirmationItemViewModel[],
  state: Readonly<Record<string, ProofreadingConfirmationDraftState>>,
): ProofreadingConfirmationDecisionInput[] {
  return items.flatMap((item) => {
    const draft = state[item.itemId];
    if (!draft?.action) {
      return [];
    }

    const editedReplacementText =
      draft.action === "accepted_with_manual_edit" ||
      draft.action === "accept_and_edit"
        ? normalizeOptionalText(draft.editedReplacementText ?? "")
        : undefined;
    const note = normalizeOptionalText(draft.note ?? "");
    const routeToRuleCandidate =
      draft.routeToRuleCandidate === true ||
      draft.action === "route_to_rule_candidate";
    const routeToKnowledgeCandidate =
      draft.routeToKnowledgeCandidate === true ||
      draft.action === "route_to_knowledge_candidate";
    const shouldSendRiskMetadata =
      draft.action === "manual_only" &&
      (item.blocksFinal ||
        item.severity === "high" ||
        item.severity === "critical");

    return [
      {
        itemId: item.itemId,
        targetText: item.targetText,
        replacementText: item.replacementText,
        action: draft.action,
        ...(editedReplacementText ? { editedReplacementText } : {}),
        ...(routeToRuleCandidate ? { routeToRuleCandidate } : {}),
        ...(routeToKnowledgeCandidate ? { routeToKnowledgeCandidate } : {}),
        ...(shouldSendRiskMetadata && item.blocksFinal !== undefined
          ? { blocksFinal: item.blocksFinal }
          : {}),
        ...(shouldSendRiskMetadata && item.severity ? { severity: item.severity } : {}),
        ...(note ? { note } : {}),
      },
    ];
  });
}

export function buildProofreadingConfirmationDecisionSignature(
  decisions: readonly ProofreadingConfirmationDecisionInput[],
): string {
  return JSON.stringify(
    decisions.map((decision) => ({
      itemId: decision.itemId,
      action: decision.action,
      targetText: decision.targetText,
      replacementText: decision.replacementText,
      editedReplacementText:
        normalizeOptionalText(decision.editedReplacementText ?? "") ?? "",
      routeToRuleCandidate: decision.routeToRuleCandidate === true,
      routeToKnowledgeCandidate: decision.routeToKnowledgeCandidate === true,
      note: normalizeOptionalText(decision.note ?? "") ?? "",
    })),
  );
}

export function shouldAutoSaveProofreadingConfirmationDraft(input: {
  canSaveConfirmationDraft: boolean;
  isConfirmationDraftSaving: boolean;
  isHumanFinalPublishing: boolean;
  isDetailLoading: boolean;
  confirmationDraftSignature: string;
  savedConfirmationDraftSignature: string;
}): boolean {
  if (
    !input.canSaveConfirmationDraft ||
    input.isConfirmationDraftSaving ||
    input.isHumanFinalPublishing ||
    input.isDetailLoading
  ) {
    return false;
  }

  if (
    input.confirmationDraftSignature.length === 0 &&
    input.savedConfirmationDraftSignature.length === 0
  ) {
    return false;
  }

  return input.confirmationDraftSignature !== input.savedConfirmationDraftSignature;
}

export function canSaveProofreadingConfirmationDraft(input: {
  detailKind: ManuscriptAssetDetailKind | null;
  assetType?: DocumentAssetViewModel["asset_type"] | null;
}): boolean {
  return (
    (input.detailKind === "proofreading_workspace" &&
      input.assetType === "proofreading_draft_report") ||
    (input.detailKind === "proofreading_confirmation" &&
      input.assetType === "final_proof_annotated_docx")
  );
}

function resolveSavedConfirmationDraftLabel(
  job: Pick<AnyWorkbenchJob, "payload"> | null | undefined,
): string {
  const payload =
    job?.payload && typeof job.payload === "object" && !Array.isArray(job.payload)
      ? (job.payload as Record<string, unknown>)
      : undefined;
  const confirmationDraft =
    payload?.confirmationDraft &&
    typeof payload.confirmationDraft === "object" &&
    !Array.isArray(payload.confirmationDraft)
      ? (payload.confirmationDraft as Record<string, unknown>)
      : undefined;
  const savedDecisionCount =
    typeof confirmationDraft?.savedDecisionCount === "number" &&
    Number.isFinite(confirmationDraft.savedDecisionCount)
      ? confirmationDraft.savedDecisionCount
      : 0;

  return savedDecisionCount > 0 ? `已保存 ${savedDecisionCount} 项` : "";
}

export function resolveProofreadingDraftSelection(input: {
  assets: readonly Pick<DocumentAssetViewModel, "id">[];
  currentDraftAssetId: string;
  latestDraftAssetId?: string | null;
  preferLatestDraft?: boolean;
}): string {
  const currentDraftAssetId = input.currentDraftAssetId.trim();
  const latestDraftAssetId = input.latestDraftAssetId?.trim() ?? "";

  if (input.preferLatestDraft && latestDraftAssetId) {
    return latestDraftAssetId;
  }

  if (currentDraftAssetId.length > 0) {
    const currentDraftStillExists = input.assets.some(
      (asset) => asset.id === currentDraftAssetId,
    );
    if (currentDraftStillExists) {
      return currentDraftAssetId;
    }
  }

  return latestDraftAssetId;
}

export function resolveDetailJobSourceAsset(input: {
  selectedAsset: DocumentAssetExportViewModel["asset"] | DocumentAssetViewModel;
  assets: readonly DocumentAssetViewModel[];
  mode: ManuscriptWorkbenchMode;
}): DocumentAssetViewModel {
  const detailKind = resolveManuscriptAssetDetailKind({
    mode: input.mode,
    assetType: input.selectedAsset.asset_type,
  });
  if (detailKind !== "proofreading_confirmation") {
    return input.selectedAsset;
  }

  const parentAssetId = input.selectedAsset.parent_asset_id?.trim();
  if (!parentAssetId) {
    return input.selectedAsset;
  }

  const parentAsset = input.assets.find((asset) => asset.id === parentAssetId);
  if (!parentAsset || parentAsset.asset_type !== "proofreading_draft_report") {
    return input.selectedAsset;
  }

  return parentAsset;
}

function resolveDetailPreviewSourceAsset(input: {
  selectedAsset: DocumentAssetViewModel;
  assets: readonly DocumentAssetViewModel[];
  currentManuscriptAsset?: DocumentAssetViewModel | null;
  mode: ManuscriptWorkbenchMode;
}): DocumentAssetViewModel | null {
  const detailKind = resolveManuscriptAssetDetailKind({
    mode: input.mode,
    assetType: input.selectedAsset.asset_type,
  });

  if (detailKind === "report_preview") {
    return null;
  }

  if (detailKind !== "proofreading_workspace") {
    return input.selectedAsset;
  }

  const parentAssetId = input.selectedAsset.parent_asset_id?.trim();
  if (parentAssetId) {
    const parentAsset = input.assets.find((asset) => asset.id === parentAssetId);
    if (parentAsset) {
      return parentAsset;
    }
  }

  return input.currentManuscriptAsset ?? null;
}

export function buildDetailPreviewSessionInput(input: {
  workspace: Pick<
    ManuscriptWorkbenchWorkspace,
    "manuscript" | "assets" | "currentManuscriptAsset"
  >;
  selectedAsset: DocumentAssetViewModel;
  detailJob: Pick<JobViewModel, "payload"> | null;
  mode: ManuscriptWorkbenchMode;
  actorRole: AuthRole;
}): 
  | {
      manuscriptId: string;
      assetId: string;
      actorRole: AuthRole;
      saveBack?: {
        enabled: boolean;
        module: "editing" | "proofreading";
        baselineAssetId: string;
        purpose: "human_review_working_state";
      };
      comments: Array<{
        id: string;
        author?: string;
        body: string;
        anchor_text?: string;
      }>;
    }
  | null {
  const previewAsset = resolveDetailPreviewSourceAsset({
    selectedAsset: input.selectedAsset,
    assets: input.workspace.assets,
    currentManuscriptAsset: input.workspace.currentManuscriptAsset,
    mode: input.mode,
  });

  if (!previewAsset) {
    return null;
  }

  return {
    manuscriptId: input.workspace.manuscript.id,
    assetId: previewAsset.id,
    actorRole: input.actorRole,
    ...(resolveDetailPreviewSaveBack({
      mode: input.mode,
      previewAsset,
    }) ?? {}),
    comments: buildAssetPreviewComments({
      asset: input.selectedAsset,
      job: input.detailJob,
    }),
  };
}

function resolveDetailPreviewSaveBack(input: {
  mode: ManuscriptWorkbenchMode;
  previewAsset: DocumentAssetViewModel;
}):
  | {
      saveBack: {
        enabled: true;
        module: "editing" | "proofreading";
        baselineAssetId: string;
        purpose: "human_review_working_state";
      };
    }
  | undefined {
  if (input.mode === "editing" && input.previewAsset.asset_type === "edited_docx") {
    return {
      saveBack: {
        enabled: true,
        module: "editing",
        baselineAssetId: input.previewAsset.id,
        purpose: "human_review_working_state",
      },
    };
  }

  if (
    input.mode === "proofreading" &&
    (input.previewAsset.asset_type === "edited_docx" ||
      input.previewAsset.asset_type === "final_proof_annotated_docx" ||
      input.previewAsset.asset_type === "human_final_docx")
  ) {
    return {
      saveBack: {
        enabled: true,
        module: "proofreading",
        baselineAssetId: input.previewAsset.id,
        purpose: "human_review_working_state",
      },
    };
  }

  return undefined;
}

export function buildProofreadingResidualKnowledgeRouteActionResult(input: {
  reviewItemId: string;
  learningCandidateId?: string;
}): WorkbenchActionResultViewModel {
  return {
    tone: "success",
    actionLabel: "Route Residual To Knowledge Candidate",
    message: `Routed residual issue ${input.reviewItemId} to knowledge candidate`,
    details: [
      {
        label: "Review Item",
        value: input.reviewItemId,
      },
      {
        label: "Recommended Route",
        value: "knowledge_candidate",
      },
      ...(input.learningCandidateId
        ? [
            {
              label: "Learning Candidate",
              value: input.learningCandidateId,
            },
          ]
        : []),
    ],
  };
}

export function resolveProofreadingIssueSelection(input: {
  items: readonly ProofreadingConfirmationItemViewModel[];
  requestedItemId?: string | null;
}): {
  issueId: string;
  locateTarget: DocumentPreviewLocateTargetViewModel | null;
} {
  const requestedItemId = input.requestedItemId?.trim() ?? "";
  const selectedItem =
    (requestedItemId.length > 0
      ? input.items.find((item) => item.itemId === requestedItemId)
      : null) ??
    input.items[0] ??
    null;

  if (!selectedItem) {
    return {
      issueId: "",
      locateTarget: null,
    };
  }

  return {
    issueId: selectedItem.itemId,
    locateTarget: selectedItem.anchor
      ? buildProofreadingLocateTarget(selectedItem.anchor)
      : null,
  };
}

export function ManuscriptWorkbenchPage({
  mode,
  actorRole = "user",
  controller = defaultController,
  prefilledManuscriptId,
  prefilledAssetId,
  prefilledPresentation,
  prefilledReviewedCaseSnapshotId,
  prefilledSampleSetItemId,
  accessibleHandoffModes,
  canOpenLearningReview = false,
  canOpenEvaluationWorkbench = false,
}: ManuscriptWorkbenchPageProps) {
  const canUpload = mode === "submission" || actorRole === "admin";
  const normalizedPrefilledManuscriptId = prefilledManuscriptId?.trim() ?? "";
  const normalizedPrefilledAssetId = prefilledAssetId?.trim() ?? "";
  const isFullscreenDetailPresentation = prefilledPresentation === "fullscreen";
  const normalizedPrefilledReviewedCaseSnapshotId =
    prefilledReviewedCaseSnapshotId?.trim() ?? "";
  const normalizedPrefilledSampleSetItemId = prefilledSampleSetItemId?.trim() ?? "";
  const [lookupId, setLookupId] = useState("");
  const [workspace, setWorkspace] = useState<ManuscriptWorkbenchWorkspace | null>(null);
  const [latestJob, setLatestJob] = useState<AnyWorkbenchJob | null>(null);
  const [latestExport, setLatestExport] = useState<DocumentAssetExportViewModel | null>(null);
  const [latestActionResult, setLatestActionResult] =
    useState<WorkbenchActionResultViewModel | null>(null);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [isPrefillLoading, setIsPrefillLoading] = useState(
    normalizedPrefilledManuscriptId.length > 0,
  );
  const [uploadForm, setUploadForm] = useState<UploadManuscriptInput>({
    title: `${mode} sample manuscript`,
    createdBy: "web-workbench",
    fileName: `${mode}-sample.docx`,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "",
  });
  const [attachedUploadFiles, setAttachedUploadFiles] = useState<
    Array<{
      fileName: string;
      mimeType: string;
      fileContentBase64: string;
    }>
  >([]);
  const [parentAssetId, setParentAssetId] = useState("");
  const [draftAssetId, setDraftAssetId] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState(normalizedPrefilledAssetId);
  const [detailJob, setDetailJob] = useState<AnyWorkbenchJob | null>(null);
  const [detailConfirmationJob, setDetailConfirmationJob] =
    useState<AnyWorkbenchJob | null>(null);
  const [detailExecutionTracking, setDetailExecutionTracking] =
    useState<WorkbenchDetailExecutionTrackingViewModel>(
      createEmptyWorkbenchDetailExecutionTracking,
    );
  const [detailPreviewSession, setDetailPreviewSession] =
    useState<DocumentPreviewSessionViewModel | null>(null);
  const [detailError, setDetailError] = useState("");
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [confirmationState, setConfirmationState] = useState<
    Record<string, ProofreadingConfirmationDraftState>
  >({});
  const [humanReviewDiffItems, setHumanReviewDiffItems] = useState<
    HumanReviewDiffItemViewModel[]
  >([]);
  const [humanReviewPreflight, setHumanReviewPreflight] =
    useState<HumanReviewPublishPreflightResultViewModel | null>(null);
  const [isHumanReviewUpdating, setIsHumanReviewUpdating] = useState(false);
  const [savedConfirmationDraftSignature, setSavedConfirmationDraftSignature] =
    useState("");
  const [savedConfirmationDraftLabel, setSavedConfirmationDraftLabel] =
    useState("");
  const [activeProofreadingIssueId, setActiveProofreadingIssueId] = useState("");
  const [isConfirmationDraftSaving, setIsConfirmationDraftSaving] = useState(false);
  const [savingEditingSlotKey, setSavingEditingSlotKey] = useState<string | null>(
    null,
  );
  const [isHumanFinalPublishing, setIsHumanFinalPublishing] = useState(false);
  const [manualFeedbackCategory, setManualFeedbackCategory] =
    useState<ManualFeedbackCategory | "">("");
  const [manualFeedbackNote, setManualFeedbackNote] = useState("");
  const [isManualFeedbackSubmitting, setIsManualFeedbackSubmitting] = useState(false);
  const [lastSubmittedManualFeedback, setLastSubmittedManualFeedback] = useState<{
    feedbackCategory: ManualFeedbackCategory;
    feedbackRecordId: string;
    reviewItemId: string;
    recommendedRoute?: "rule_candidate" | "knowledge_candidate" | "prompt_template_candidate";
  } | null>(null);
  const [isProofreadingGovernanceSubmitting, setIsProofreadingGovernanceSubmitting] =
    useState(false);
  const [activeProofreadingGovernanceItemId, setActiveProofreadingGovernanceItemId] =
    useState("");
  const [proofreadingGovernanceHandoff, setProofreadingGovernanceHandoff] =
    useState<ManuscriptWorkbenchProofreadingGovernanceHandoffViewModel | null>(
      null,
    );
  const [selectedTemplateFamilyId, setSelectedTemplateFamilyId] = useState("");
  const [selectedJournalTemplateId, setSelectedJournalTemplateId] = useState("");
  const [selectedTemplateContext, setSelectedTemplateContext] =
    useState<ManuscriptWorkbenchTemplateContext | null>(null);
  const [queueItems, setQueueItems] = useState<ManuscriptWorkbenchQueueItem[]>([]);
  const canSubmitUpload =
    uploadForm.title.trim().length > 0 &&
    uploadForm.fileName.trim().length > 0 &&
    uploadForm.mimeType.trim().length > 0 &&
    attachedUploadFiles.length <= MAX_MANUSCRIPT_BATCH_UPLOAD_COUNT &&
    hasUploadPayload(uploadForm);
  const workbenchBusy = busy || isPrefillLoading;
  const activeCoreStripPillar = resolveCoreStripActivePillar(mode);
  const notice = resolveWorkbenchNotice({
    error,
    status,
    latestActionResult,
  });

  useEffect(() => {
    if (!workspace) {
      return;
    }

    setLookupId(workspace.manuscript.id);
    setParentAssetId((current) =>
      workspace.assets.some((asset) => asset.id === current)
        ? current
        : workspace.suggestedParentAsset?.id ?? "",
    );
    setDraftAssetId((current) =>
      resolveProofreadingDraftSelection({
        assets: workspace.assets,
        currentDraftAssetId: current,
        latestDraftAssetId: workspace.latestProofreadingDraftAsset?.id,
      }),
    );
    setSelectedAssetId((current) => {
      if (
        normalizedPrefilledAssetId.length > 0 &&
        workspace.assets.some((asset) => asset.id === normalizedPrefilledAssetId)
      ) {
        return normalizedPrefilledAssetId;
      }

      return workspace.assets.some((asset) => asset.id === current) ? current : "";
    });
    setSelectedTemplateFamilyId(
      workspace.manuscript.current_template_family_id ??
        workspace.manuscript.governed_execution_context_summary?.base_template_family_id ??
        "",
    );
    setSelectedJournalTemplateId(
      workspace.manuscript.current_journal_template_id ?? "",
    );
    setQueueItems((current) =>
      mergeQueueItems(current, [
        buildQueueItemFromManuscript(workspace.manuscript, mode, "recent", true),
      ]),
    );
  }, [workspace]);

  useEffect(() => {
    if (
      mode === "submission" ||
      typeof controller.listRecentManuscripts !== "function"
    ) {
      return;
    }

    let cancelled = false;
    void controller.listRecentManuscripts({ limit: 50 })
      .then((manuscripts) => {
        if (cancelled) {
          return;
        }

        setQueueItems((current) =>
          mergeQueueItems(
            current,
            manuscripts.map((manuscript) =>
              buildQueueItemFromManuscript(
                manuscript,
                mode,
                "recent",
                manuscript.id === workspace?.manuscript.id,
              ),
            ),
          ),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setQueueItems((current) => current);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [controller, mode, workspace?.manuscript.id]);

  useEffect(() => {
    if (normalizedPrefilledManuscriptId.length === 0) {
      setIsPrefillLoading(false);
      return;
    }

    setIsPrefillLoading(true);
    setLookupId("");
    setWorkspace(null);
    setLatestJob(null);
    setLatestExport(null);
    setLatestActionResult(null);
    setStatus("");
    setError("");
    setAttachedUploadFiles([]);
    setParentAssetId("");
    setDraftAssetId("");
    setManualFeedbackCategory("");
    setManualFeedbackNote("");
    setIsManualFeedbackSubmitting(false);
    setLastSubmittedManualFeedback(null);
    setIsProofreadingGovernanceSubmitting(false);
    setActiveProofreadingGovernanceItemId("");
    setSelectedTemplateFamilyId("");
    setSelectedJournalTemplateId("");
    setSelectedTemplateContext(null);
    setSelectedAssetId(normalizedPrefilledAssetId);
    setDetailJob(null);
    setDetailConfirmationJob(null);
    setDetailExecutionTracking(createEmptyWorkbenchDetailExecutionTracking());
    setDetailPreviewSession(null);
    setDetailError("");
    setIsDetailLoading(false);
    setConfirmationState({});
    setSavedConfirmationDraftSignature("");
    setSavedConfirmationDraftLabel("");
    setIsConfirmationDraftSaving(false);
    setSavingEditingSlotKey(null);
    setIsHumanFinalPublishing(false);
    setProofreadingGovernanceHandoff(null);
  }, [normalizedPrefilledManuscriptId]);

  useEffect(() => {
    setSelectedAssetId(normalizedPrefilledAssetId);
    setDetailJob(null);
    setDetailConfirmationJob(null);
    setDetailExecutionTracking(createEmptyWorkbenchDetailExecutionTracking());
    setDetailPreviewSession(null);
    setDetailError("");
    setConfirmationState({});
    setSavingEditingSlotKey(null);
    setDetailPreviewSession(null);
    setDetailError("");
    setConfirmationState({});
    setSavedConfirmationDraftSignature("");
    setSavedConfirmationDraftLabel("");
    setHumanReviewDiffItems([]);
    setHumanReviewPreflight(null);
    setIsHumanReviewUpdating(false);
    setIsConfirmationDraftSaving(false);
  }, [normalizedPrefilledAssetId]);

  useEffect(() => {
    setManualFeedbackCategory("");
    setManualFeedbackNote("");
    setIsManualFeedbackSubmitting(false);
    setLastSubmittedManualFeedback(null);
    setIsProofreadingGovernanceSubmitting(false);
    setActiveProofreadingGovernanceItemId("");
  }, [workspace?.manuscript.id]);

  useEffect(() => {
    if (!workspace || selectedAssetId.trim().length === 0) {
      setDetailJob(null);
      setDetailConfirmationJob(null);
      setDetailExecutionTracking(createEmptyWorkbenchDetailExecutionTracking());
      setDetailPreviewSession(null);
      setDetailError("");
      setIsDetailLoading(false);
      setConfirmationState({});
      setSavedConfirmationDraftSignature("");
      setSavedConfirmationDraftLabel("");
      setHumanReviewDiffItems([]);
      setHumanReviewPreflight(null);
      setIsHumanReviewUpdating(false);
      setIsConfirmationDraftSaving(false);
      return;
    }

    const selectedAsset = workspace.assets.find((asset) => asset.id === selectedAssetId);
    if (!selectedAsset) {
      setDetailJob(null);
      setDetailConfirmationJob(null);
      setDetailExecutionTracking(createEmptyWorkbenchDetailExecutionTracking());
      setDetailPreviewSession(null);
      setDetailError(`Asset ${selectedAssetId} is no longer available in this workspace.`);
      setIsDetailLoading(false);
      setConfirmationState({});
      setSavedConfirmationDraftSignature("");
      setSavedConfirmationDraftLabel("");
      setHumanReviewDiffItems([]);
      setHumanReviewPreflight(null);
      setIsHumanReviewUpdating(false);
      setIsConfirmationDraftSaving(false);
      setActiveProofreadingIssueId("");
      return;
    }

    let cancelled = false;
    setIsDetailLoading(true);
    setDetailError("");
    setDetailExecutionTracking(createEmptyWorkbenchDetailExecutionTracking());

    void (async () => {
      const detailKind = resolveManuscriptAssetDetailKind({
        mode,
        assetType: selectedAsset.asset_type,
      });
      const detailJobAsset = resolveDetailJobSourceAsset({
        selectedAsset,
        assets: workspace.assets,
        mode,
      });
      const [sourceJob, confirmationJob] = await Promise.all([
        hydrateWorkbenchDetailJob(controller, {
          sourceJobId: detailJobAsset.source_job_id,
          latestJob,
        }),
        detailKind === "proofreading_confirmation"
          ? hydrateWorkbenchDetailJob(controller, {
              sourceJobId: selectedAsset.source_job_id,
              latestJob,
            })
          : Promise.resolve(null),
      ]);

      if (cancelled) {
        return;
      }

      setDetailJob(sourceJob);
      setDetailConfirmationJob(confirmationJob);
      const nextDetailExecutionTracking =
        await hydrateWorkbenchDetailExecutionTracking(controller, sourceJob);
      if (cancelled) {
        return;
      }
      setDetailExecutionTracking(nextDetailExecutionTracking);
      if (cancelled) {
        return;
      }
      const nextConfirmationItems = buildProofreadingConfirmationItems(sourceJob);
      const persistedDraftState = pruneConfirmationState(
        buildProofreadingConfirmationDraftState(confirmationJob ?? sourceJob),
        nextConfirmationItems,
      );
      setConfirmationState(persistedDraftState);
      const persistedDraftDecisions = buildProofreadingConfirmationDecisions(
        nextConfirmationItems,
        persistedDraftState,
      );
      setSavedConfirmationDraftSignature(
        buildProofreadingConfirmationDecisionSignature(persistedDraftDecisions),
      );
      setSavedConfirmationDraftLabel(
        resolveSavedConfirmationDraftLabel(confirmationJob ?? sourceJob),
      );
      setActiveProofreadingIssueId((current) =>
        resolveProofreadingIssueSelection({
          items: nextConfirmationItems,
          requestedItemId: current,
        }).issueId,
      );

      const humanReviewModule = resolveDetailHumanReviewModule({
        mode,
        selectedAsset,
        detailKind,
      });
      if (humanReviewModule) {
        try {
          const [nextHumanReviewItems, nextHumanReviewPreflight] =
            await Promise.all([
              controller.loadHumanReviewDiffItems({
                manuscriptId: workspace.manuscript.id,
                module: humanReviewModule,
              }),
              controller.preflightHumanReviewPublish({
                manuscriptId: workspace.manuscript.id,
                module: humanReviewModule,
              }),
            ]);
          if (cancelled) {
            return;
          }
          setHumanReviewDiffItems(nextHumanReviewItems);
          setHumanReviewPreflight(nextHumanReviewPreflight);
        } catch (humanReviewError) {
          if (cancelled) {
            return;
          }
          setHumanReviewDiffItems([]);
          setHumanReviewPreflight(null);
          setDetailError(formatWorkbenchRequestError(humanReviewError));
        }
      } else {
        setHumanReviewDiffItems([]);
        setHumanReviewPreflight(null);
      }

      const previewRequest = buildDetailPreviewSessionInput({
        workspace,
        selectedAsset,
        detailJob: sourceJob,
        mode,
        actorRole,
      });

      if (
        detailKind === "report_preview" ||
        detailKind === "screening_workspace" ||
        !previewRequest
      ) {
        setDetailPreviewSession(null);
        setIsDetailLoading(false);
        return;
      }

      try {
        const previewSession = await controller.createPreviewSession(previewRequest);

        if (cancelled) {
          return;
        }

        setDetailPreviewSession(previewSession);
      } catch (previewError) {
        if (cancelled) {
          return;
        }

        setDetailPreviewSession(null);
        setDetailError(formatWorkbenchRequestError(previewError));
      } finally {
        if (!cancelled) {
          setIsDetailLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [actorRole, controller, latestJob, mode, selectedAssetId, workspace]);

  useEffect(() => {
    if (!workspace) {
      setSelectedTemplateContext(null);
      return;
    }

    const currentBaseTemplateFamilyId =
      resolveCurrentBaseTemplateFamilyId(workspace) ?? "";
    const nextTemplateFamilyId = selectedTemplateFamilyId.trim();

    if (
      nextTemplateFamilyId.length === 0 ||
      nextTemplateFamilyId === currentBaseTemplateFamilyId
    ) {
      setSelectedTemplateContext({
        availableTemplateFamilies: workspace.availableTemplateFamilies ?? [],
        templateFamily: workspace.templateFamily ?? null,
        journalTemplateProfiles: workspace.journalTemplateProfiles ?? [],
      });
      return;
    }

    const fallbackContext: ManuscriptWorkbenchTemplateContext = {
      availableTemplateFamilies: workspace.availableTemplateFamilies ?? [],
      templateFamily:
        workspace.availableTemplateFamilies?.find(
          (family) => family.id === nextTemplateFamilyId,
        ) ?? null,
      journalTemplateProfiles: [],
    };

    if (!controller.loadTemplateContext) {
      setSelectedTemplateContext(fallbackContext);
      return;
    }

    let cancelled = false;
    void controller.loadTemplateContext(nextTemplateFamilyId)
      .then((templateContext) => {
        if (cancelled) {
          return;
        }

        setSelectedTemplateContext(templateContext);
        setSelectedJournalTemplateId((current) =>
          shouldKeepSelectedJournalTemplate(
            current,
            nextTemplateFamilyId,
            templateContext,
            workspace,
          )
            ? current
            : "",
        );
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setSelectedTemplateContext(fallbackContext);
        setSelectedJournalTemplateId("");
      });

    return () => {
      cancelled = true;
    };
  }, [controller, selectedTemplateFamilyId, workspace]);

  useEffect(() => {
    if (normalizedPrefilledManuscriptId.length === 0) {
      return;
    }

    let cancelled = false;
    setBusy(true);
    setError("");

    void loadPrefilledWorkbenchPageData(controller, {
      mode,
      manuscriptId: normalizedPrefilledManuscriptId,
      actorRole,
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        setWorkspace(result.workspace);
        setLatestJob(result.latestJob);
        setLatestExport(null);
        setStatus(result.status);
        setLatestActionResult(result.latestActionResult);
        setProofreadingGovernanceHandoff(
          result.proofreadingGovernanceHandoff ?? null,
        );
      })
      .catch((nextError) => {
        if (cancelled) {
          return;
        }

        const message = formatError(nextError);
        setStatus("");
        setError(message);
        setLatestActionResult({
          tone: "error",
          actionLabel: "Load Workspace",
          message,
          details: [],
        });
        setProofreadingGovernanceHandoff(null);
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false);
          setIsPrefillLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [actorRole, controller, mode, normalizedPrefilledManuscriptId]);

  useEffect(() => {
    if (
      !latestJob ||
      (latestJob.status !== "queued" && latestJob.status !== "running") ||
      typeof controller.loadJob !== "function"
    ) {
      return;
    }

    let cancelled = false;
    const handle =
      typeof window !== "undefined"
        ? window.setInterval(() => {
            void controller.loadJob(latestJob.id)
              .then((job) => {
                if (!cancelled) {
                  setLatestJob(job);
                }
              })
              .catch(() => undefined);
          }, 2500)
        : null;

    return () => {
      cancelled = true;
      if (typeof handle === "number" && typeof window !== "undefined") {
        window.clearInterval(handle);
      }
    };
  }, [controller, latestJob?.id, latestJob?.status]);

  async function syncProofreadingGovernanceHandoff(
    nextWorkspace: ManuscriptWorkbenchWorkspace,
  ) {
    if (
      mode !== "proofreading" ||
      typeof controller.loadProofreadingGovernanceHandoff !== "function"
    ) {
      setProofreadingGovernanceHandoff(null);
      return;
    }

    try {
      setProofreadingGovernanceHandoff(
        await controller.loadProofreadingGovernanceHandoff(
          nextWorkspace.manuscript.id,
          resolveProofreadingGovernanceHandoffScope(nextWorkspace),
        ),
      );
    } catch {
      setProofreadingGovernanceHandoff(null);
    }
  }

  async function syncWorkspaceConcurrencySnapshot(
    nextWorkspace: ManuscriptWorkbenchWorkspace,
  ): Promise<ManuscriptWorkbenchWorkspace> {
    return hydrateWorkbenchWorkspaceConcurrency(controller, nextWorkspace);
  }

  async function run(
    actionLabel: string,
    task: () => Promise<WorkbenchActionResultViewModel | void>,
  ) {
    setBusy(true);
    setError("");
    try {
      const result = await task();
      if (result) {
        setLatestActionResult(result);
      }
    } catch (nextError) {
      const message = formatError(nextError);
      setStatus("");
      setError(message);
      setLatestActionResult({
        tone: "error",
        actionLabel,
        message,
        details: [],
      });
    } finally {
      setBusy(false);
    }
  }

  async function publishHumanFinalFromConfirmation(input: {
    workspace: ManuscriptWorkbenchWorkspace;
    asset: NonNullable<ManuscriptWorkbenchWorkspace["currentAsset"]>;
    decisions: ProofreadingConfirmationDecisionInput[];
  }) {
    setIsHumanFinalPublishing(true);
    setError("");

    try {
      const result = await controller.publishHumanFinalAndLoad({
        manuscriptId: input.workspace.manuscript.id,
        finalAssetId: input.asset.id,
        actorRole,
        storageKey: `runs/${input.workspace.manuscript.id}/proofreading/human-final`,
        fileName: resolveWorkbenchHumanFinalFileName(
          input.workspace.manuscript.title,
        ),
        confirmationDecisions: input.decisions,
      });
      const nextWorkspace = await syncWorkspaceConcurrencySnapshot(result.workspace);
      setWorkspace(nextWorkspace);
      setLatestJob(result.runResult.job);
      setLatestExport(null);
      setConfirmationState({});
      setDetailConfirmationJob(null);
      setSavedConfirmationDraftSignature("");
      setSavedConfirmationDraftLabel("");
      await syncProofreadingGovernanceHandoff(nextWorkspace);

      const publishedAsset =
        nextWorkspace.assets.find((asset) => asset.id === result.runResult.asset.id) ??
        nextWorkspace.currentAsset ??
        result.runResult.asset;
      const collectionHref = buildWorkbenchAssetCollectionHref({
        mode,
        manuscriptId: nextWorkspace.manuscript.id,
        reviewedCaseSnapshotId:
          normalizedPrefilledReviewedCaseSnapshotId.length > 0
            ? normalizedPrefilledReviewedCaseSnapshotId
            : undefined,
        sampleSetItemId:
          normalizedPrefilledSampleSetItemId.length > 0
            ? normalizedPrefilledSampleSetItemId
            : undefined,
      });
      setSelectedAssetId("");

      const message = `Published human-final asset ${publishedAsset.id}`;
      setStatus(message);
      setLatestActionResult(
        buildPublishedHumanFinalActionResult({
          publishedAsset,
          job: result.runResult.job,
          overview: nextWorkspace.manuscript.module_execution_overview,
        }),
      );

      if (typeof window !== "undefined") {
        window.location.hash = collectionHref;
      }
    } catch (nextError) {
      const message = formatError(nextError);
      setStatus("");
      setError(message);
      setLatestActionResult({
        tone: "error",
        actionLabel: "Publish Human Final",
        message,
        details: [],
      });
    } finally {
      setIsHumanFinalPublishing(false);
    }
  }

  async function refreshHumanReviewPreflight(input: {
    workspace: ManuscriptWorkbenchWorkspace;
    module: HumanReviewPublishModule;
  }) {
    const nextPreflight = await controller.preflightHumanReviewPublish({
      manuscriptId: input.workspace.manuscript.id,
      module: input.module,
    });
    setHumanReviewPreflight(nextPreflight);
    return nextPreflight;
  }

  async function refreshHumanReviewPreflightFromQueue(input: {
    workspace: ManuscriptWorkbenchWorkspace;
    module: HumanReviewPublishModule;
  }) {
    setError("");

    try {
      await refreshHumanReviewPreflight(input);
    } catch (nextError) {
      const message = formatError(nextError);
      setError(message);
      setLatestActionResult({
        tone: "error",
        actionLabel: "Refresh Human Review Preflight",
        message,
        details: [],
      });
    }
  }

  async function updateHumanReviewDiffDecision(
    input: HumanReviewQueueDecisionChangeInput,
  ) {
    if (!workspace) {
      return;
    }

    const module = resolveWorkbenchHumanReviewModule(mode);
    if (!module) {
      return;
    }

    setIsHumanReviewUpdating(true);
    setError("");

    try {
      const updated = await controller.updateHumanReviewDiffDecision({
        diffItemId: input.diffItemId,
        contentDecision: input.contentDecision,
        ...(input.governanceIntents
          ? { governanceIntents: input.governanceIntents }
          : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
      });
      setHumanReviewDiffItems((current) =>
        replaceHumanReviewDiffItems(current, [updated]),
      );
      await refreshHumanReviewPreflight({ workspace, module });
    } catch (nextError) {
      const message = formatError(nextError);
      setError(message);
      setLatestActionResult({
        tone: "error",
        actionLabel: "Update Human Review Decision",
        message,
        details: [],
      });
    } finally {
      setIsHumanReviewUpdating(false);
    }
  }

  async function batchUpdateHumanReviewDiffDecision(
    input: HumanReviewQueueBatchDecisionChangeInput,
  ) {
    if (!workspace || input.diffItemIds.length === 0) {
      return;
    }

    const module = resolveWorkbenchHumanReviewModule(mode);
    if (!module) {
      return;
    }

    setIsHumanReviewUpdating(true);
    setError("");

    try {
      const updated = await controller.batchUpdateHumanReviewDiffDecisions({
        updates: input.diffItemIds.map((diffItemId) => ({
          diffItemId,
          contentDecision: input.contentDecision,
        })),
      });
      setHumanReviewDiffItems((current) =>
        replaceHumanReviewDiffItems(current, updated),
      );
      await refreshHumanReviewPreflight({ workspace, module });
    } catch (nextError) {
      const message = formatError(nextError);
      setError(message);
      setLatestActionResult({
        tone: "error",
        actionLabel: "Batch Update Human Review Decisions",
        message,
        details: [],
      });
    } finally {
      setIsHumanReviewUpdating(false);
    }
  }

  async function retryHumanReviewBackflow(diffItemId: string) {
    if (!workspace) {
      return;
    }

    const module = resolveWorkbenchHumanReviewModule(mode);
    if (!module) {
      return;
    }

    setIsHumanReviewUpdating(true);
    setError("");

    try {
      await controller.retryHumanReviewBackflow(diffItemId);
      const nextItems = await controller.loadHumanReviewDiffItems({
        manuscriptId: workspace.manuscript.id,
        module,
      });
      setHumanReviewDiffItems(nextItems);
      await refreshHumanReviewPreflight({ workspace, module });
    } catch (nextError) {
      const message = formatError(nextError);
      setError(message);
      setLatestActionResult({
        tone: "error",
        actionLabel: "Retry Human Review Backflow",
        message,
        details: [],
      });
    } finally {
      setIsHumanReviewUpdating(false);
    }
  }

  async function publishHumanReviewFinal(input: {
    workspace: ManuscriptWorkbenchWorkspace;
    module: HumanReviewPublishModule;
    confirmationDecisions?: readonly ProofreadingConfirmationDecisionInput[];
    confirmationItemCount?: number;
  }) {
    setIsHumanFinalPublishing(true);
    setError("");

    try {
      const result = await controller.publishHumanReviewFinalAndLoad({
        manuscriptId: input.workspace.manuscript.id,
        module: input.module,
        actorRole,
        outputStorageKey: `runs/${input.workspace.manuscript.id}/${input.module}/human-final`,
        outputFileName: resolveWorkbenchHumanFinalFileName(
          input.workspace.manuscript.title,
        ),
        proofreadingConfirmationDecisions:
          input.module === "proofreading" ? input.confirmationDecisions : undefined,
        proofreadingConfirmationItemCount:
          input.module === "proofreading" ? input.confirmationItemCount : undefined,
      });
      const nextWorkspace = await syncWorkspaceConcurrencySnapshot(result.workspace);
      setWorkspace(nextWorkspace);
      setLatestJob(result.runResult.job);
      setLatestExport(null);
      setHumanReviewDiffItems([]);
      setHumanReviewPreflight(null);
      if (input.module === "proofreading") {
        await syncProofreadingGovernanceHandoff(nextWorkspace);
      }

      const publishedAsset =
        nextWorkspace.assets.find((asset) => asset.id === result.runResult.asset.id) ??
        nextWorkspace.currentAsset ??
        result.runResult.asset;
      const collectionHref = buildWorkbenchAssetCollectionHref({
        mode,
        manuscriptId: nextWorkspace.manuscript.id,
        reviewedCaseSnapshotId:
          normalizedPrefilledReviewedCaseSnapshotId.length > 0
            ? normalizedPrefilledReviewedCaseSnapshotId
            : undefined,
        sampleSetItemId:
          normalizedPrefilledSampleSetItemId.length > 0
            ? normalizedPrefilledSampleSetItemId
            : undefined,
      });
      setSelectedAssetId("");

      const message = `Published human-final asset ${publishedAsset.id}`;
      setStatus(message);
      setLatestActionResult(
        buildPublishedHumanFinalActionResult({
          publishedAsset,
          job: result.runResult.job,
          overview: nextWorkspace.manuscript.module_execution_overview,
        }),
      );

      if (typeof window !== "undefined") {
        window.location.hash = collectionHref;
      }
    } catch (nextError) {
      const message = formatError(nextError);
      setStatus("");
      setError(message);
      setLatestActionResult({
        tone: "error",
        actionLabel: "Publish Human Review Final",
        message,
        details: [],
      });
    } finally {
      setIsHumanFinalPublishing(false);
    }
  }

  async function saveProofreadingConfirmationDraft(input: {
    workspace: ManuscriptWorkbenchWorkspace;
    asset: NonNullable<ManuscriptWorkbenchWorkspace["currentAsset"]>;
    items: readonly ProofreadingConfirmationItemViewModel[];
  }) {
    const decisions = buildProofreadingConfirmationDecisions(
      input.items,
      confirmationState,
    );

    setIsConfirmationDraftSaving(true);
    setError("");

    try {
      const result = await controller.saveProofreadingConfirmationDraft({
        manuscriptId: input.workspace.manuscript.id,
        confirmationAssetId: input.asset.id,
        actorRole,
        confirmationDecisions: decisions,
      });

      setDetailConfirmationJob(result.job);
      setLatestActionResult({
        tone: "success",
        actionLabel: "Save Confirmation Draft",
        message: `Saved proofreading confirmation draft ${result.job.id}`,
        details: [
          {
            label: "Job",
            value: result.job.id,
          },
          {
            label: "Saved Items",
            value: String(decisions.length),
          },
        ],
      });
      setStatus(`Saved proofreading confirmation draft ${result.job.id}`);
      setSavedConfirmationDraftSignature(
        buildProofreadingConfirmationDecisionSignature(decisions),
      );
      setSavedConfirmationDraftLabel(
        resolveSavedConfirmationDraftLabel(result.job) ||
          (decisions.length > 0 ? `已保存 ${decisions.length} 项` : ""),
      );
    } catch (nextError) {
      const message = formatError(nextError);
      setStatus("");
      setError(message);
      setLatestActionResult({
        tone: "error",
        actionLabel: "Save Confirmation Draft",
        message,
        details: [],
      });
    } finally {
      setIsConfirmationDraftSaving(false);
    }
  }

  async function saveEditingSlotResolution(
    currentWorkspace: ManuscriptWorkbenchWorkspace,
    input: EditingSlotManualSaveInput,
  ) {
    setSavingEditingSlotKey(input.slotKey);
    setError("");

    try {
      const result = await controller.saveEditingSlotResolutionAndLoad({
        manuscriptId: currentWorkspace.manuscript.id,
        actorRole,
        slotKey: input.slotKey,
        resolutionKind: input.resolutionKind,
        ...(input.resolvedText ? { resolvedText: input.resolvedText } : {}),
        ...(input.selectedCandidateId
          ? { selectedCandidateId: input.selectedCandidateId }
          : {}),
        ...(input.note ? { note: input.note } : {}),
      });
      const nextWorkspace = await hydrateWorkbenchWorkspaceConcurrency(
        controller,
        result.workspace,
      );
      const message = `已保存槽位裁决：${input.slotKey}`;

      setWorkspace(nextWorkspace);
      setDetailJob((current) =>
        attachEditingGovernanceSummariesToJob(current, {
          slotSummary: result.resolution.summary,
          completionGateSummary:
            result.resolution.completion_gate_summary ??
            nextWorkspace.manuscript.editing_completion_gate_summary,
        }),
      );
      setStatus(message);
      setLatestActionResult({
        tone: "success",
        actionLabel: "Save Editing Slot Resolution",
        message,
        details: [
          {
            label: "稿件",
            value: nextWorkspace.manuscript.id,
          },
          {
            label: "槽位",
            value: input.slotKey,
          },
          {
            label: "处理",
            value:
              input.resolutionKind === "picked_candidate"
                ? "采用候选"
                : input.resolutionKind === "manual_entry"
                  ? "人工录入"
                  : "人工豁免",
          },
        ],
      });
    } catch (nextError) {
      const message = formatError(nextError);
      setStatus("");
      setError(message);
      setLatestActionResult({
        tone: "error",
        actionLabel: "Save Editing Slot Resolution",
        message,
        details: [],
      });
    } finally {
      setSavingEditingSlotKey(null);
    }
  }

  async function submitManualFeedback(
    currentWorkspace: ManuscriptWorkbenchWorkspace,
    context: ManualFeedbackContext,
  ) {
    if (mode === "submission") {
      return;
    }

    if (!isManualFeedbackCategory(manualFeedbackCategory)) {
      const message = "请选择反馈类型后再提交。";
      setStatus("");
      setError(message);
      setLatestActionResult({
        tone: "error",
        actionLabel: "Submit Review Item",
        message,
        details: [],
      });
      return;
    }

    const selectedFeedbackCategory = manualFeedbackCategory;
    setIsManualFeedbackSubmitting(true);
    setError("");

    try {
      const result = await controller.submitManualFeedbackForReview({
        manuscriptId: currentWorkspace.manuscript.id,
        manuscriptType: currentWorkspace.manuscript.manuscript_type,
        module: mode,
        snapshotId: context.snapshotId,
        sourceAssetId: context.sourceAssetId,
        feedbackCategory: selectedFeedbackCategory,
        ...(normalizeOptionalText(manualFeedbackNote)
          ? {
              feedbackText: manualFeedbackNote.trim(),
            }
          : {}),
      });
      const actionResult = buildManualFeedbackActionResult({
        feedbackCategory: selectedFeedbackCategory,
        feedbackRecordId: result.feedback.id,
        reviewItemId: result.item.id,
        recommendedRoute: result.item.recommended_route,
      });

      setStatus(actionResult.message);
      setLatestActionResult(actionResult);
      setLastSubmittedManualFeedback({
        feedbackCategory: selectedFeedbackCategory,
        feedbackRecordId: result.feedback.id,
        reviewItemId: result.item.id,
        recommendedRoute: result.item.recommended_route,
      });
      setManualFeedbackCategory("");
      setManualFeedbackNote("");
    } catch (nextError) {
      const message = formatError(nextError);
      setStatus("");
      setError(message);
      setLatestActionResult({
        tone: "error",
        actionLabel: "Submit Review Item",
        message,
        details: [],
      });
    } finally {
      setIsManualFeedbackSubmitting(false);
    }
  }

  async function submitHighRiskReviewItem(
    currentWorkspace: ManuscriptWorkbenchWorkspace,
    context: ManualFeedbackContext,
    item: ManuscriptWorkbenchHighRiskReviewItemViewModel,
  ) {
    if (mode === "submission") {
      return;
    }

    setIsManualFeedbackSubmitting(true);
    setError("");

    try {
      const result = await controller.submitManualFeedbackForReview({
        manuscriptId: currentWorkspace.manuscript.id,
        manuscriptType: currentWorkspace.manuscript.manuscript_type,
        module: mode,
        snapshotId: context.snapshotId,
        sourceAssetId: context.sourceAssetId,
        feedbackCategory: item.feedbackCategory,
        title: item.title,
        excerpt: item.excerpt,
        location: item.location,
        riskLevel: item.riskLevel,
        suggestion: item.suggestion,
        rationale: item.rationale,
        candidatePosture: item.candidate_posture,
        decisionSource: "execution_hit",
        evidencePack: item.evidence_pack,
        relatedRuleIds: item.relatedRuleIds,
        relatedKnowledgeItemIds: item.relatedKnowledgeItemIds,
        originPayload: item.originPayload,
      });

      const actionResult = buildManualFeedbackActionResult({
        feedbackCategory: item.feedbackCategory,
        feedbackRecordId: result.feedback.id,
        reviewItemId: result.item.id,
        recommendedRoute: result.item.recommended_route,
      });

      setStatus(actionResult.message);
      setLatestActionResult(actionResult);
      setLastSubmittedManualFeedback({
        feedbackCategory: item.feedbackCategory,
        feedbackRecordId: result.feedback.id,
        reviewItemId: result.item.id,
        recommendedRoute: result.item.recommended_route,
      });
    } catch (nextError) {
      const message = formatError(nextError);
      setStatus("");
      setError(message);
      setLatestActionResult({
        tone: "error",
        actionLabel: "Submit Review Item",
        message,
        details: [],
      });
    } finally {
      setIsManualFeedbackSubmitting(false);
    }
  }

  async function recordHighRiskManualOnly(
    currentWorkspace: ManuscriptWorkbenchWorkspace,
    context: ManualFeedbackContext,
    item: ManuscriptWorkbenchHighRiskReviewItemViewModel,
  ) {
    if (mode === "submission") {
      return;
    }

    setIsManualFeedbackSubmitting(true);
    setError("");

    try {
      const submitted = await controller.submitManualFeedbackForReview({
        manuscriptId: currentWorkspace.manuscript.id,
        manuscriptType: currentWorkspace.manuscript.manuscript_type,
        module: mode,
        snapshotId: context.snapshotId,
        sourceAssetId: context.sourceAssetId,
        feedbackCategory: item.feedbackCategory,
        title: item.title,
        excerpt: item.excerpt,
        location: item.location,
        riskLevel: item.riskLevel,
        suggestion: item.suggestion,
        rationale: item.rationale,
        candidatePosture: item.candidate_posture,
        decisionSource: "execution_hit",
        evidencePack: item.evidence_pack,
        relatedRuleIds: item.relatedRuleIds,
        relatedKnowledgeItemIds: item.relatedKnowledgeItemIds,
        originPayload: item.originPayload,
      });

      await controller.decideReviewItem({
        sourceKind: "governed_hit",
        id: submitted.item.id,
        action: "accept_change_only",
      });

      const actionResult = buildManualOnlyReviewActionResult({
        ...item,
        id: submitted.item.id,
      });
      setStatus(actionResult.message);
      setLatestActionResult(actionResult);
    } catch (nextError) {
      const message = formatError(nextError);
      setStatus("");
      setError(message);
      setLatestActionResult({
        tone: "error",
        actionLabel: "Record Manual Only",
        message,
        details: [],
      });
    } finally {
      setIsManualFeedbackSubmitting(false);
    }
  }

  async function routeProofreadingResidualToKnowledgeCandidate(
    currentWorkspace: ManuscriptWorkbenchWorkspace,
    reviewItemId: string,
  ) {
    if (mode !== "proofreading") {
      return;
    }

    setIsProofreadingGovernanceSubmitting(true);
    setActiveProofreadingGovernanceItemId(reviewItemId);
    setError("");

    try {
      const result = await controller.decideReviewItem({
        sourceKind: "residual_issue",
        id: reviewItemId,
        action: "route_to_knowledge_candidate",
      });
      await syncProofreadingGovernanceHandoff(currentWorkspace);

      const actionResult = buildProofreadingResidualKnowledgeRouteActionResult({
        reviewItemId,
        learningCandidateId:
          result.item?.source_kind === "residual_issue"
            ? result.item.learning_candidate_id
            : undefined,
      });
      setStatus(actionResult.message);
      setLatestActionResult(actionResult);
    } catch (nextError) {
      const message = formatError(nextError);
      setStatus("");
      setError(message);
      setLatestActionResult({
        tone: "error",
        actionLabel: "Route Residual To Knowledge Candidate",
        message,
        details: [],
      });
    } finally {
      setIsProofreadingGovernanceSubmitting(false);
      setActiveProofreadingGovernanceItemId("");
    }
  }

  async function attachUploadFiles(files: File[]) {
    setBusy(true);
    setError("");
    try {
      const inlineFieldsList = await Promise.all(
        files.map((file) => createInlineUploadFields(file)),
      );
      const primaryInlineFields = inlineFieldsList[0];
      if (!primaryInlineFields) {
        throw new Error("No upload files were selected.");
      }

      setAttachedUploadFiles(inlineFieldsList);
      setUploadForm((current) => ({
        ...current,
        ...primaryInlineFields,
        title:
          inlineFieldsList.length === 1
            ? deriveUploadTitleFromFileName(primaryInlineFields.fileName, current.title)
            : current.title,
      }));
      setStatus(
        inlineFieldsList.length > 1
          ? `Attached ${inlineFieldsList.length} files for batch upload`
          : `Attached file ${primaryInlineFields.fileName}`,
      );
      setLatestActionResult({
        tone: "success",
        actionLabel: "Attach Manuscript File",
        message:
          inlineFieldsList.length > 1
            ? `Attached ${inlineFieldsList.length} files for batch upload`
            : `Attached file ${primaryInlineFields.fileName}`,
        details: [
          {
            label: "File",
            value:
              inlineFieldsList.length > 1
                ? `${inlineFieldsList.length} files`
                : primaryInlineFields.fileName,
          },
          {
            label: "MIME Type",
            value:
              inlineFieldsList.length > 1
                ? "Mixed inline batch"
                : primaryInlineFields.mimeType,
          },
        ],
      });
    } catch (nextError) {
      const message = formatError(nextError);
      setStatus("");
      setError(message);
      setLatestActionResult({
        tone: "error",
        actionLabel: "Attach Manuscript File",
        message,
        details: [],
      });
    } finally {
      setBusy(false);
    }
  }

  async function persistTemplateSelection(
    currentWorkspace: ManuscriptWorkbenchWorkspace,
    input: {
      forceApply?: boolean;
    } = {
      forceApply: false,
    },
  ) {
    const nextTemplateFamilyId =
      normalizeOptionalText(selectedTemplateFamilyId) ??
      currentWorkspace.manuscript.current_template_family_id ??
      currentWorkspace.manuscript.governed_execution_context_summary?.base_template_family_id ??
      null;
    const nextJournalTemplateId =
      normalizeOptionalText(selectedJournalTemplateId) ?? null;
    const currentTemplateFamilyId =
      currentWorkspace.manuscript.current_template_family_id ??
      currentWorkspace.manuscript.governed_execution_context_summary?.base_template_family_id ??
      null;
    const currentJournalTemplateId =
      currentWorkspace.manuscript.current_journal_template_id ?? null;
    if (
      !input.forceApply &&
      nextTemplateFamilyId === currentTemplateFamilyId &&
      nextJournalTemplateId === currentJournalTemplateId
    ) {
      return currentWorkspace;
    }

    const result = await controller.updateTemplateSelectionAndLoad({
      manuscriptId: currentWorkspace.manuscript.id,
      templateFamilyId: nextTemplateFamilyId,
      journalTemplateId: nextJournalTemplateId,
    });
    const nextWorkspace = await syncWorkspaceConcurrencySnapshot(result.workspace);
    setWorkspace(nextWorkspace);
    await syncProofreadingGovernanceHandoff(nextWorkspace);

    return nextWorkspace;
  }

  async function loadWorkspaceIntoBench(manuscriptId: string) {
    const result = await loadPrefilledWorkbenchPageData(controller, {
      mode,
      manuscriptId,
      actorRole,
    });
    setWorkspace(result.workspace);
    setLatestJob(result.latestJob);
    setLatestExport(null);
    setProofreadingGovernanceHandoff(result.proofreadingGovernanceHandoff ?? null);
    setLookupId(result.workspace.manuscript.id);
    setStatus(`Loaded manuscript ${result.workspace.manuscript.id}`);
    return {
      ...result.latestActionResult,
      message: `Loaded manuscript ${result.workspace.manuscript.id}`,
    };
  }

  async function archiveQueueManuscript(manuscriptId: string) {
    if (typeof controller.archiveManuscript !== "function") {
      throw new Error("当前环境不支持删除历史稿件。");
    }

    const archived = await controller.archiveManuscript({ manuscriptId });
    setQueueItems((current) =>
      current.filter((item) => item.manuscriptId !== archived.id),
    );
    if (workspace?.manuscript.id === archived.id) {
      setWorkspace(null);
      setLatestJob(null);
      setLatestExport(null);
      setSelectedAssetId("");
    }

    return {
      tone: "success",
      actionLabel: "Archive Manuscript",
      message: `已删除稿件 ${archived.title}`,
      details: [
        {
          label: "Manuscript",
          value: archived.id,
        },
      ],
    } satisfies WorkbenchActionResultViewModel;
  }

function buildTemplateContextActionResult(
  updatedWorkspace: ManuscriptWorkbenchWorkspace,
  actionLabel: string,
  message: string,
  ): WorkbenchActionResultViewModel {
    return {
      tone: "success",
      actionLabel,
      message,
      details: [
        {
          label: "Base Template Family",
          value: resolveBaseTemplateFamilyLabel(updatedWorkspace),
        },
        {
          label: "Journal Template",
          value: resolveJournalTemplateSelectionLabel(updatedWorkspace),
        },
        {
          label: "Journal Overrides",
          value:
            updatedWorkspace.selectedJournalTemplateProfile != null ||
            updatedWorkspace.manuscript.current_journal_template_id
              ? "已启用"
              : "仅基础模板",
        },
      ],
    };
  }

  const lookupPanel: ManuscriptWorkbenchLookupPanelProps = {
    manuscriptId: lookupId,
    onChange: setLookupId,
    onLoad: () =>
      void run("Load Workspace", async () => {
        return loadWorkspaceIntoBench(lookupId.trim());
      }),
  };

  const intakePanel = canUpload
    ? {
        uploadForm,
        attachedFileCount: attachedUploadFiles.length,
        attachedFileNames: attachedUploadFiles.map((file) => file.fileName),
        canSubmit: canSubmitUpload,
        onTitleChange: (value: string) =>
          setUploadForm((current) => ({
            ...current,
            title: value,
          })),
        onStorageKeyChange: (value: string) =>
          setUploadForm((current) => ({
            ...current,
            storageKey: normalizeOptionalText(value),
          })),
        onFilesSelect: (files: File[]) => {
          void attachUploadFiles(files);
        },
        onSubmit: () =>
          void run("Upload Manuscript", async () => {
            if (attachedUploadFiles.length > 1) {
              if (!controller.uploadManuscriptBatchAndLoad) {
                throw new Error("当前工作台控制器暂不支持批量上传。");
              }

              if (attachedUploadFiles.length > MAX_MANUSCRIPT_BATCH_UPLOAD_COUNT) {
                throw new Error(
                  `批量上传最多不能超过 ${MAX_MANUSCRIPT_BATCH_UPLOAD_COUNT} 篇稿件。`,
                );
              }

              const result = await controller.uploadManuscriptBatchAndLoad({
                createdBy: uploadForm.createdBy,
                items: attachedUploadFiles.map((file) => ({
                  title: deriveUploadTitleFromFileName(file.fileName, uploadForm.title),
                  fileName: file.fileName,
                  mimeType: file.mimeType,
                  fileContentBase64: file.fileContentBase64,
                })),
              });
              const nextWorkspace = await syncWorkspaceConcurrencySnapshot(
                result.workspace,
              );
              setWorkspace(nextWorkspace);
              setLatestJob(result.upload.batch_job);
              await syncProofreadingGovernanceHandoff(nextWorkspace);
              setQueueItems((current) =>
                mergeQueueItems(
                  current,
                  result.upload.items.map((item, index) =>
                    buildQueueItemFromManuscript(
                      item.manuscript,
                      mode,
                      "batch",
                      index === 0,
                    )
                  ),
                ),
              );
              setStatus(`Uploaded batch ${result.upload.batch_job.id}`);
              return {
                tone: "success" as const,
                actionLabel: "Upload Manuscript",
                message: `Uploaded batch ${result.upload.batch_job.id}`,
                details: buildWorkbenchJobActionResultDetails(
                  [
                    {
                      label: "Batch Job",
                      value: result.upload.batch_job.id,
                    },
                    {
                      label: "Batch Items",
                      value: String(result.upload.items.length),
                    },
                  ],
                  result.upload.batch_job,
                  nextWorkspace.manuscript.module_execution_overview,
                ),
              };
            }

            const result = await controller.uploadManuscriptAndLoad(uploadForm);
            const nextWorkspace = await syncWorkspaceConcurrencySnapshot(result.workspace);
            setWorkspace(nextWorkspace);
            setLatestJob(result.upload.job);
            await syncProofreadingGovernanceHandoff(nextWorkspace);
            setQueueItems((current) =>
              mergeQueueItems(current, [
                buildQueueItemFromManuscript(
                  nextWorkspace.manuscript,
                  mode,
                  "recent",
                  true,
                ),
              ]),
            );
            setStatus(`Uploaded manuscript ${result.upload.manuscript.id}`);
            return {
              tone: "success" as const,
              actionLabel: "Upload Manuscript",
              message: `Uploaded manuscript ${result.upload.manuscript.id}`,
              details: buildWorkbenchJobActionResultDetails(
                [
                  {
                    label: "Manuscript",
                    value: result.upload.manuscript.id,
                  },
                  {
                    label: "Job",
                    value: result.upload.job.id,
                  },
                ],
                result.upload.job,
                nextWorkspace.manuscript.module_execution_overview,
              ),
            };
          }),
      }
    : undefined;

  const templateSelectionWorkspace = workspace
    ? buildTemplateSelectionWorkspace(workspace, selectedTemplateContext, {
        selectedTemplateFamilyId,
        selectedJournalTemplateId,
      })
    : null;
  const hasPendingTemplateChange =
    workspace != null
      ? (resolveCurrentBaseTemplateFamilyId(workspace) ?? "") !==
          selectedTemplateFamilyId ||
        (workspace.manuscript.current_journal_template_id ?? "") !==
          selectedJournalTemplateId
      : false;
  const templateFamilyOptions = templateSelectionWorkspace
    ? buildTemplateFamilyOptions(templateSelectionWorkspace)
    : [];
  const templateSelectionPanel =
    templateSelectionWorkspace &&
    (templateSelectionWorkspace.templateFamily ||
      templateSelectionWorkspace.availableTemplateFamilies?.length ||
      templateSelectionWorkspace.manuscript.governed_execution_context_summary)
      ? {
          title: "Journal Template",
          resolvedManuscriptTypeLabel: formatDetectedManuscriptType(
            templateSelectionWorkspace.manuscript,
          ),
          confidenceLabel: formatDetectedConfidenceLabel(
            templateSelectionWorkspace.manuscript,
          ),
          confidenceLevel:
            templateSelectionWorkspace.manuscript.manuscript_type_detection_summary
              ?.confidence_level ??
            "medium",
          requiresOperatorReview:
            templateSelectionWorkspace.manuscript.manuscript_type_detection_summary
              ?.requires_operator_review ?? false,
          showManualManuscriptTypeSelect:
            shouldShowManualManuscriptTypeSelect(templateSelectionWorkspace),
          manualManuscriptTypeValue: resolveSelectedTemplateManuscriptType(
            templateSelectionWorkspace,
            selectedTemplateFamilyId,
          ),
          manualManuscriptTypeOptions: buildManualManuscriptTypeOptions(
            templateSelectionWorkspace,
          ),
          baseTemplateLabel: resolveBaseTemplateFamilyLabel(
            templateSelectionWorkspace,
          ),
          selectedTemplateFamilyId,
          templateFamilyOptions,
          selectedJournalTemplateId,
          currentAppliedLabel: resolveJournalTemplateSelectionLabel(
            templateSelectionWorkspace,
          ),
          hasPendingChange: hasPendingTemplateChange,
          options: buildJournalTemplateOptions(templateSelectionWorkspace),
          onManualManuscriptTypeSelect: (value: string) => {
            const nextTemplateFamilyId = resolveTemplateFamilyIdForManuscriptType(
              templateSelectionWorkspace,
              value as ManuscriptType,
            );
            if (!nextTemplateFamilyId) {
              return;
            }

            setSelectedTemplateFamilyId(nextTemplateFamilyId);
            setSelectedJournalTemplateId("");
          },
          onTemplateFamilySelect: (value: string) => {
            setSelectedTemplateFamilyId(value);
            setSelectedJournalTemplateId("");
          },
          onSelect: setSelectedJournalTemplateId,
          onApply: () =>
            void run(resolveTemplateSelectionActionLabel({
              hasPendingChange: hasPendingTemplateChange,
              requiresOperatorReview:
                templateSelectionWorkspace.manuscript.manuscript_type_detection_summary
                  ?.requires_operator_review ?? false,
            }), async () => {
              if (!workspace) {
                throw new Error("模板上下文尚未加载，暂时无法保存。");
              }

              const templateSelectionBlockMessage =
                resolveTemplateSelectionApplyBlockMessage({
                  currentTemplateFamilyId:
                    workspace.manuscript.current_template_family_id ?? null,
                  selectedTemplateFamilyId,
                  availableTemplateFamilyCount: templateFamilyOptions.length,
                });
              if (templateSelectionBlockMessage) {
                throw new Error(templateSelectionBlockMessage);
              }

              const actionLabel = resolveTemplateSelectionActionLabel({
                hasPendingChange: hasPendingTemplateChange,
                requiresOperatorReview:
                  templateSelectionWorkspace.manuscript.manuscript_type_detection_summary
                    ?.requires_operator_review ?? false,
              });
              const updatedWorkspace = await persistTemplateSelection(workspace, {
                forceApply: shouldForceTemplateConfirmation(
                  workspace,
                  selectedTemplateFamilyId,
                ),
              });
              const message = resolveTemplateSelectionStatusMessage(
                updatedWorkspace,
                actionLabel,
              );
              setStatus(message);
              return buildTemplateContextActionResult(
                updatedWorkspace,
                actionLabel,
                message,
              );
            }),
        }
      : undefined;

  const moduleActionPanel =
    workspace && mode !== "submission"
      ? {
          title: resolveActionPanelTitle(mode),
          selectedAssetId: parentAssetId,
          emptyLabel: "请选择资产",
          actionLabel: resolveActionLabel(mode),
          secondaryActionLabel: AI_RECOGNITION_ACTION_LABEL,
          options: workspace.assets
            .filter((asset) => isSelectableParentAsset(asset))
            .map((asset) => ({
              value: asset.id,
              label: formatAssetOptionLabel(workspace.manuscript.title, asset),
            })),
          selectedContextLabel: "Selected Parent Asset",
          onSelect: setParentAssetId,
          onRun: () =>
            void run(resolveActionLabel(mode), async () => {
              const synchronizedWorkspace = await persistTemplateSelection(workspace);
              const executionBlockMessage = resolveGovernedExecutionBlockMessage(
                mode,
                resolveWorkbenchReadOnlyExecutionContext(mode, synchronizedWorkspace),
              );
              if (executionBlockMessage) {
                throw new Error(executionBlockMessage);
              }

              const result = await controller.runModuleAndLoad(
                buildWorkbenchModuleRunInput({
                  mode,
                  manuscriptId: synchronizedWorkspace.manuscript.id,
                  parentAssetId,
                  actorRole,
                  outputBaseName: synchronizedWorkspace.manuscript.title,
                }),
              );
              const nextWorkspace = await syncWorkspaceConcurrencySnapshot(
                result.workspace,
              );
              setWorkspace(nextWorkspace);
              setLatestJob(result.runResult.job);
              if (mode === "proofreading") {
                setDraftAssetId(
                  resolveProofreadingDraftSelection({
                    assets: nextWorkspace.assets,
                    currentDraftAssetId: draftAssetId,
                    latestDraftAssetId: nextWorkspace.latestProofreadingDraftAsset?.id,
                    preferLatestDraft: true,
                  }),
                );
              }
              await syncProofreadingGovernanceHandoff(nextWorkspace);
              const materializedAsset = requireMaterializedModuleResultAsset(
                mode,
                nextWorkspace,
              );
              const message = buildModuleRunSuccessMessage(mode, materializedAsset);
              setStatus(message);
              return {
                tone: "success" as const,
                actionLabel: resolveActionLabel(mode),
                message,
                details: buildWorkbenchJobActionResultDetails(
                  [
                    {
                      label: "Asset",
                      value: materializedAsset.id,
                    },
                    {
                      label: "Output Type",
                      value: resolveGeneratedOutputTypeLabel(materializedAsset.asset_type),
                    },
                    {
                      label: "Job",
                      value: result.runResult.job.id,
                    },
                  ],
                  result.runResult.job,
                  nextWorkspace.manuscript.module_execution_overview,
                ),
              };
            }),
          onSecondaryRun: () =>
            void run(AI_RECOGNITION_ACTION_LABEL, async () => {
              const synchronizedWorkspace = await persistTemplateSelection(workspace);
              const executionBlockMessage = resolveGovernedExecutionBlockMessage(
                mode,
                resolveWorkbenchReadOnlyExecutionContext(mode, synchronizedWorkspace),
              );
              if (executionBlockMessage) {
                throw new Error(executionBlockMessage);
              }

              const result = await controller.runModuleAndLoad(
                buildWorkbenchModuleRunInput({
                  mode,
                  manuscriptId: synchronizedWorkspace.manuscript.id,
                  parentAssetId,
                  actorRole,
                  outputBaseName: synchronizedWorkspace.manuscript.title,
                }),
              );
              const nextWorkspace = await syncWorkspaceConcurrencySnapshot(
                result.workspace,
              );
              setWorkspace(nextWorkspace);
              setLatestJob(result.runResult.job);
              if (mode === "proofreading") {
                setDraftAssetId(
                  resolveProofreadingDraftSelection({
                    assets: nextWorkspace.assets,
                    currentDraftAssetId: draftAssetId,
                    latestDraftAssetId: nextWorkspace.latestProofreadingDraftAsset?.id,
                    preferLatestDraft: true,
                  }),
                );
              }
              await syncProofreadingGovernanceHandoff(nextWorkspace);
              const materializedAsset = requireMaterializedModuleResultAsset(
                mode,
                nextWorkspace,
              );
              const message = buildModuleRunSuccessMessage(mode, materializedAsset);
              setStatus(message);
              return {
                tone: "success" as const,
                actionLabel: AI_RECOGNITION_ACTION_LABEL,
                message,
                details: buildWorkbenchJobActionResultDetails(
                  [
                    {
                      label: "Asset",
                      value: materializedAsset.id,
                    },
                    {
                      label: "Output Type",
                      value: resolveGeneratedOutputTypeLabel(materializedAsset.asset_type),
                    },
                    {
                      label: "Job",
                      value: result.runResult.job.id,
                    },
                  ],
                  result.runResult.job,
                  nextWorkspace.manuscript.module_execution_overview,
                ),
              };
            }),
        }
      : undefined;

  const finalizeActionPanel =
    workspace && mode === "proofreading"
      ? {
          title: "Proofreading Final",
          selectedAssetId: draftAssetId,
          emptyLabel: "请选择校对草稿",
          actionLabel: "Finalize Proofreading",
          options: workspace.assets
            .filter((asset) => asset.asset_type === "proofreading_draft_report")
            .map((asset) => ({
              value: asset.id,
              label: formatAssetOptionLabel(workspace.manuscript.title, asset),
            })),
          selectedContextLabel: "Selected Draft Asset",
          onSelect: setDraftAssetId,
          onRun: () =>
            void run("Finalize Proofreading", async () => {
              const result = await controller.finalizeProofreadingAndLoad({
                manuscriptId: workspace.manuscript.id,
                draftAssetId,
                actorRole,
                storageKey: `runs/${workspace.manuscript.id}/proofreading/final`,
                fileName: resolveWorkbenchProofreadingAnnotatedFileName(
                  workspace.manuscript.title,
                ),
              });
              const nextWorkspace = await syncWorkspaceConcurrencySnapshot(
                result.workspace,
              );
              setWorkspace(nextWorkspace);
              setLatestJob(result.runResult.job);
              await syncProofreadingGovernanceHandoff(nextWorkspace);
              const materializedAsset = requireMaterializedModuleResultAsset(
                "proofreading",
                nextWorkspace,
              );
              const message = buildModuleRunSuccessMessage(
                "proofreading",
                materializedAsset,
              );
              setStatus(message);
              return {
                tone: "success" as const,
                actionLabel: "Finalize Proofreading",
                message,
                details: buildWorkbenchJobActionResultDetails(
                  [
                    {
                      label: "Asset",
                      value: materializedAsset.id,
                    },
                    {
                      label: "Output Type",
                      value: resolveGeneratedOutputTypeLabel(materializedAsset.asset_type),
                    },
                    {
                      label: "Job",
                      value: result.runResult.job.id,
                    },
                  ],
                  result.runResult.job,
                  nextWorkspace.manuscript.module_execution_overview,
                ),
              };
            }),
        }
      : undefined;
  const visibleFinalizeActionPanel: ManuscriptWorkbenchActionPanelProps | undefined =
    undefined;

  const selectedAsset =
    workspace && selectedAssetId.trim().length > 0
      ? workspace.assets.find((asset) => asset.id === selectedAssetId) ?? null
      : null;
  const detailKind = selectedAsset
    ? resolveManuscriptAssetDetailKind({
        mode,
        assetType: selectedAsset.asset_type,
      })
    : null;
  const humanReviewModule =
    selectedAsset && detailKind
      ? resolveDetailHumanReviewModule({
          mode,
          selectedAsset,
          detailKind,
        })
      : null;
  const showsHumanReviewDiffQueue =
    Boolean(humanReviewModule) && humanReviewDiffItems.length > 0;
  const isDedicatedProofreadingDetail =
    detailKind === "proofreading_workspace" ||
    detailKind === "proofreading_confirmation";
  const currentProofreadingAsset =
    mode === "proofreading" &&
    isProofreadingWorkbenchAssetType(workspace?.currentAsset?.asset_type)
      ? workspace?.currentAsset
      : null;

  const utilitiesPanel = workspace
    ? {
        canExport: true,
        canRefreshLatestJob: Boolean(latestJob?.id),
        canOpenHarnessMatrix: true,
        onOpenHarnessMatrix: () => {
          if (typeof window !== "undefined") {
            window.location.hash = `#manuscript-harness?manuscriptId=${encodeURIComponent(
              workspace.manuscript.id,
            )}`;
          }
        },
        onExport: () =>
          void run("Export Current Asset", async () => {
            const exported = await controller.exportCurrentAsset({
              manuscriptId: workspace.manuscript.id,
            });
            setLatestExport(exported);
            setStatus(`Prepared export ${exported.asset.id}`);
            return {
              tone: "success" as const,
              actionLabel: "Export Current Asset",
              message: `Prepared export ${exported.asset.id}`,
              details: [
                {
                  label: "Asset",
                  value: exported.asset.id,
                },
                {
                  label: "Export File Name",
                  value: exported.download.file_name ?? exported.asset.file_name ?? "Not provided",
                },
                {
                  label: "Download MIME Type",
                  value: exported.download.mime_type,
                },
                {
                  label: "Storage Key",
                  value: exported.download.storage_key,
                },
              ],
            };
          }),
        canPublishHumanFinal:
          currentProofreadingAsset != null &&
          detailKind !== "proofreading_workspace" &&
          detailKind !== "proofreading_confirmation",
        onPublishHumanFinal: () => {
          if (!currentProofreadingAsset) {
            return;
          }

          const detailHref = buildWorkbenchAssetDetailHref({
            mode,
            manuscriptId: workspace.manuscript.id,
            assetId: currentProofreadingAsset.id,
            reviewedCaseSnapshotId:
              normalizedPrefilledReviewedCaseSnapshotId.length > 0
                ? normalizedPrefilledReviewedCaseSnapshotId
                : undefined,
            sampleSetItemId:
              normalizedPrefilledSampleSetItemId.length > 0
                ? normalizedPrefilledSampleSetItemId
                : undefined,
          });
          setSelectedAssetId(currentProofreadingAsset.id);
          setStatus(`Opened proofreading workbench ${currentProofreadingAsset.id}`);
          setLatestActionResult({
            tone: "success",
            actionLabel: "Open Proofreading Workbench",
            message: `Opened proofreading workbench ${currentProofreadingAsset.id}`,
            details: [
              {
                label: "Asset",
                value: currentProofreadingAsset.id,
              },
            ],
          });

          if (typeof window !== "undefined") {
            window.location.hash = detailHref;
          }
        },
        onRefreshLatestJob: () => {
          if (!latestJob?.id) {
            return;
          }

          void run("Refresh Latest Job", async () => {
            const result = await refreshLatestWorkbenchJobContext(controller, {
              manuscriptId: workspace.manuscript.id,
              latestJobId: latestJob.id,
              actorRole,
              mode,
            });
            setLatestJob(result.latestJob);
            if (result.workspace) {
              setWorkspace(result.workspace);
              await syncProofreadingGovernanceHandoff(result.workspace);
            }
            setStatus(result.status);
            return result.latestActionResult;
          });
        },
      }
    : undefined;

  const shouldUseMainlineLayout =
    mode !== "submission" && !isDedicatedProofreadingDetail;
  const shouldShowDeskBar = mode === "submission";
  const detectedManuscriptTypeLabel = workspace
    ? formatDetectedManuscriptType(workspace.manuscript)
    : "待 AI 识别";
  const executionContext = workspace
    ? resolveWorkbenchReadOnlyExecutionContext(mode, workspace)
    : null;
  const manualFeedbackContext = workspace
    ? resolveManualFeedbackContext(mode, workspace)
    : null;
  const manualFeedback: ManuscriptWorkbenchManualFeedbackViewModel | undefined =
    workspace && manualFeedbackContext
      ? {
          selectedCategory: manualFeedbackCategory,
          note: manualFeedbackNote,
          isSubmitting: isManualFeedbackSubmitting,
          lastSubmitted: lastSubmittedManualFeedback ?? undefined,
          highRiskReviewItems: buildHighRiskReviewItemsFromJob(latestJob),
          onCategoryChange: setManualFeedbackCategory,
          onNoteChange: setManualFeedbackNote,
          onSubmit: () => {
            void submitManualFeedback(workspace, manualFeedbackContext);
          },
          onSubmitHighRiskItem: (item) => {
            void submitHighRiskReviewItem(workspace, manualFeedbackContext, item);
          },
          onRecordManualOnly: (item) => {
            void recordHighRiskManualOnly(workspace, manualFeedbackContext, item);
          },
        }
      : undefined;
  const proofreadingGovernanceActions:
    | ManuscriptWorkbenchProofreadingGovernanceActionsViewModel
    | undefined =
    workspace && mode === "proofreading"
      ? {
          isSubmitting: isProofreadingGovernanceSubmitting,
          activeItemId:
            activeProofreadingGovernanceItemId.trim().length > 0
              ? activeProofreadingGovernanceItemId
              : undefined,
          onRouteToKnowledgeCandidate: (itemId) => {
            void routeProofreadingResidualToKnowledgeCandidate(workspace, itemId);
          },
        }
      : undefined;
  const summaryElement = workspace ? (
    <ManuscriptWorkbenchSummary
      mode={mode}
      accessibleHandoffModes={accessibleHandoffModes}
      canOpenLearningReview={canOpenLearningReview}
      canOpenEvaluationWorkbench={canOpenEvaluationWorkbench}
      executionContext={executionContext}
      manualFeedback={manualFeedback}
      proofreadingGovernanceHandoff={proofreadingGovernanceHandoff ?? undefined}
      proofreadingGovernanceActions={proofreadingGovernanceActions}
      prefilledManuscriptId={normalizedPrefilledManuscriptId}
      prefilledReviewedCaseSnapshotId={normalizedPrefilledReviewedCaseSnapshotId}
      prefilledSampleSetItemId={normalizedPrefilledSampleSetItemId}
      workspace={workspace}
      latestJob={latestJob}
      latestExport={latestExport}
      latestActionResult={latestActionResult}
    />
  ) : null;
  const confirmationItems = buildProofreadingConfirmationItems(detailJob);
  const screeningDocumentBlocks = buildScreeningDocumentBlocks(detailJob);
  const screeningWorkspaceFocusItems = buildScreeningWorkspaceFocusItems({
    job: detailJob,
    documentBlocks: screeningDocumentBlocks,
  });
  const editingDocumentBlocks = buildEditingDocumentBlocks(detailJob);
  const proofreadingDocumentBlocks = buildProofreadingDocumentBlocks(detailJob);
  const activeProofreadingIssueSelection = resolveProofreadingIssueSelection({
    items: confirmationItems,
    requestedItemId: activeProofreadingIssueId,
  });
  const confirmationDecisions = buildProofreadingConfirmationDecisions(
    confirmationItems,
    confirmationState,
  );
  const confirmationDraftSignature = buildProofreadingConfirmationDecisionSignature(
    confirmationDecisions,
  );
  const confirmationReady =
    confirmationItems.length > 0 &&
    confirmationItems.every((item) => {
      const draft = confirmationState[item.itemId];
      if (!draft?.action) {
        return false;
      }

      if (
        draft.action === "accepted_with_manual_edit" ||
        draft.action === "accept_and_edit"
      ) {
        return (draft.editedReplacementText?.trim().length ?? 0) > 0;
      }

      if (draft.action === "escalated") {
        return false;
      }

      if (draft.action === "manual_only") {
        return !(
          item.blocksFinal ||
          item.severity === "high" ||
          item.severity === "critical"
        );
      }

      return true;
    });
  const detailBackHref = workspace
    ? buildWorkbenchAssetCollectionHref({
        mode,
        manuscriptId: workspace.manuscript.id,
        reviewedCaseSnapshotId:
          normalizedPrefilledReviewedCaseSnapshotId.length > 0
            ? normalizedPrefilledReviewedCaseSnapshotId
            : undefined,
        sampleSetItemId:
          normalizedPrefilledSampleSetItemId.length > 0
            ? normalizedPrefilledSampleSetItemId
            : undefined,
      })
    : formatWorkbenchHash(mode);
  const resultPanelMode: Exclude<ManuscriptWorkbenchMode, "submission"> =
    mode === "submission" ? "editing" : mode;
  const mainlineProgress =
    mode === "submission"
      ? null
      : resolveWorkbenchProgressSnapshot({
          mode,
          workspace,
          latestJob,
        });
  const canSaveConfirmationDraft = canSaveProofreadingConfirmationDraft({
    detailKind,
    assetType: selectedAsset?.asset_type,
  }) && !showsHumanReviewDiffQueue;

  useEffect(() => {
    if (
      !workspace ||
      !selectedAsset ||
      !shouldAutoSaveProofreadingConfirmationDraft({
        canSaveConfirmationDraft,
        isConfirmationDraftSaving,
        isHumanFinalPublishing,
        isDetailLoading,
        confirmationDraftSignature,
        savedConfirmationDraftSignature,
      })
    ) {
      return;
    }

    const autoSaveHandle =
      typeof window !== "undefined"
        ? window.setTimeout(() => {
            void saveProofreadingConfirmationDraft({
              workspace,
              asset: selectedAsset,
              items: confirmationItems,
            });
          }, 1200)
        : null;

    return () => {
      if (typeof autoSaveHandle === "number" && typeof window !== "undefined") {
        window.clearTimeout(autoSaveHandle);
      }
    };
  }, [
    canSaveConfirmationDraft,
    confirmationDraftSignature,
    confirmationItems,
    isConfirmationDraftSaving,
    isDetailLoading,
    isHumanFinalPublishing,
    savedConfirmationDraftSignature,
    selectedAsset,
    workspace,
  ]);

  const confirmationDraftStatusLabel =
    canSaveConfirmationDraft && confirmationDraftSignature !== savedConfirmationDraftSignature
      ? confirmationDecisions.length > 0
        ? "存在未保存修改"
        : savedConfirmationDraftLabel
      : savedConfirmationDraftLabel;
  const detailElement =
    workspace && selectedAsset && detailKind
      ? (
          <ManuscriptWorkbenchAssetDetailPage
            mode={mode}
            manuscriptTitle={workspace.manuscript.title}
            asset={selectedAsset}
            detailKind={detailKind}
            backHref={detailBackHref}
            downloadHref={resolveBrowserApiUrl(
              `/api/v1/document-assets/${selectedAsset.id}/download`,
            )}
            previewAsset={resolveDetailPreviewSourceAsset({
              selectedAsset,
              assets: workspace.assets,
              currentManuscriptAsset: workspace.currentManuscriptAsset,
              mode,
            })}
            previewDownloadHref={(() => {
              const previewAsset = resolveDetailPreviewSourceAsset({
                selectedAsset,
                assets: workspace.assets,
                currentManuscriptAsset: workspace.currentManuscriptAsset,
                mode,
              });

              return previewAsset
                ? resolveBrowserApiUrl(`/api/v1/document-assets/${previewAsset.id}/download`)
                : null;
            })()}
            previewSession={detailPreviewSession}
            reportBody={buildAssetReportPreviewBody(detailJob)}
            changeLedger={buildEditingChangeLedgerEntries(detailJob)}
            editingGuardrails={buildEditingGuardrailEntries(detailJob)}
            editingSlotSummary={
              buildEditingSlotGovernanceSummary(detailJob) ??
              workspace.manuscript.editing_slot_governance_summary ??
              null
            }
            editingCompletionGateSummary={
              buildEditingCompletionGateSummary(detailJob) ??
              workspace.manuscript.editing_completion_gate_summary ??
              null
            }
            editingRuntimeBindingExplanation={
              buildEditingRuntimeBindingExplanation(detailJob) ?? null
            }
            editingAutomaticActionLedger={
              buildEditingAutomaticActionLedger(detailJob)
            }
            executionSnapshot={detailExecutionTracking.snapshot}
            knowledgeHitLogs={detailExecutionTracking.knowledgeHitLogs}
            knowledgeReferences={workspace.knowledgeReferences}
            deepProofreadingEvidence={buildDeepProofreadingEvidence(detailJob)}
            confirmationItems={confirmationItems}
            confirmationState={confirmationState}
            humanReviewDiffItems={humanReviewDiffItems}
            humanReviewPreflight={humanReviewPreflight}
            humanReviewModule={humanReviewModule}
            screeningDocumentBlocks={screeningDocumentBlocks}
            screeningWorkspaceFocusItems={screeningWorkspaceFocusItems}
            editingDocumentBlocks={editingDocumentBlocks}
            proofreadingDocumentBlocks={proofreadingDocumentBlocks}
            activeProofreadingIssueId={activeProofreadingIssueSelection.issueId}
            activeProofreadingLocateTarget={activeProofreadingIssueSelection.locateTarget}
            isFinalizeEnabled={confirmationReady}
            onSaveDraft={
              canSaveConfirmationDraft
                ? () => {
                    void saveProofreadingConfirmationDraft({
                      workspace,
                      asset: selectedAsset,
                      items: confirmationItems,
                    });
                  }
                : undefined
            }
            draftSaveLabel={canSaveConfirmationDraft ? confirmationDraftStatusLabel : ""}
            isDraftSaving={isConfirmationDraftSaving}
            isFinalizing={isHumanFinalPublishing}
            isHumanReviewUpdating={isHumanReviewUpdating}
            savingEditingSlotKey={savingEditingSlotKey}
            onProofreadingIssueSelect={(itemId) => {
              const nextSelection = resolveProofreadingIssueSelection({
                items: confirmationItems,
                requestedItemId: itemId,
              });
              setActiveProofreadingIssueId(nextSelection.issueId);
            }}
            onConfirmationActionChange={(itemId, action) => {
              setConfirmationState((current) => ({
                ...current,
                [itemId]: {
                  ...current[itemId],
                  action,
                  ...(action === "route_to_rule_candidate"
                    ? { routeToRuleCandidate: true }
                    : {}),
                  ...(action === "route_to_knowledge_candidate"
                    ? { routeToKnowledgeCandidate: true }
                    : {}),
                  ...(action !== "accepted_with_manual_edit" &&
                    action !== "accept_and_edit"
                    ? {
                        editedReplacementText: undefined,
                      }
                    : {}),
                },
              }));
            }}
            onConfirmationGovernanceIntentChange={(itemId, intent, enabled) => {
              setConfirmationState((current) => ({
                ...current,
                [itemId]: {
                  ...current[itemId],
                  [intent]: enabled,
                },
              }));
            }}
            onConfirmationEditedReplacementTextChange={(itemId, value) => {
              setConfirmationState((current) => ({
                ...current,
                [itemId]: {
                  ...current[itemId],
                  editedReplacementText: value,
                },
              }));
            }}
            onConfirmationNoteChange={(itemId, value) => {
              setConfirmationState((current) => ({
                ...current,
                [itemId]: {
                  ...current[itemId],
                  note: value,
                },
              }));
            }}
            onHumanReviewDecisionChange={(input) => {
              void updateHumanReviewDiffDecision(input);
            }}
            onHumanReviewBatchDecisionChange={(input) => {
              void batchUpdateHumanReviewDiffDecision(input);
            }}
            onHumanReviewPreflight={() => {
              if (!workspace || !humanReviewModule) {
                return;
              }

              void refreshHumanReviewPreflightFromQueue({
                workspace,
                module: humanReviewModule,
              });
            }}
            onHumanReviewPublish={() => {
              if (!workspace || !humanReviewModule) {
                return;
              }

              void publishHumanReviewFinal({
                workspace,
                module: humanReviewModule,
                confirmationDecisions,
                confirmationItemCount: confirmationItems.length,
              });
            }}
            onHumanReviewRetryBackflow={(diffItemId) => {
              void retryHumanReviewBackflow(diffItemId);
            }}
            onEditingSlotSave={(input) => {
              if (!workspace) {
                return;
              }

              void saveEditingSlotResolution(workspace, input);
            }}
            onFinalize={() => {
              if (!workspace || !selectedAsset || !confirmationReady) {
                return;
              }

              void publishHumanFinalFromConfirmation({
                workspace,
                asset: selectedAsset,
                decisions: confirmationDecisions,
              });
            }}
          />
        )
      : null;

  if (isFullscreenDetailPresentation && detailElement) {
    return (
      <article
        className={`workbench-placeholder manuscript-workbench-shell manuscript-workbench-shell--${mode} manuscript-workbench-shell--fullscreen-detail`}
        data-layout="manuscript-detail-fullscreen"
      >
        {detailElement}
      </article>
    );
  }

  return (
    <article
      className={`workbench-placeholder manuscript-workbench-shell manuscript-workbench-shell--${mode}`}
      data-layout="manuscript-desk-family"
    >
      {shouldShowDeskBar ? (
        <section className="manuscript-workbench-desk-bar">
        <div className="manuscript-workbench-shell-copy">
          <span className="manuscript-workbench-section-eyebrow">
            {mode === "submission"
              ? "\u7a3f\u4ef6\u63a5\u5165"
              : "\u6838\u5fc3\u5de5\u4f5c\u53f0"}
          </span>
          <h2>{resolveTitle(mode)}</h2>
          <p>{resolveDescription(mode)}</p>
          {activeCoreStripPillar ? (
            <WorkbenchCoreStrip activePillarId={activeCoreStripPillar} />
          ) : null}
        </div>
        <dl className="manuscript-workbench-shell-metrics">
          <div className="manuscript-workbench-desk-stat">
            <span>{"\u5de5\u4f5c\u7ebf\u5b9a\u4f4d"}</span>
            <strong>{resolveHeroLane(mode)}</strong>
          </div>
          <div className="manuscript-workbench-desk-stat">
            <span>{"\u5f53\u524d\u7126\u70b9"}</span>
            <strong>{resolveHeroFocus(mode)}</strong>
          </div>
        </dl>
        </section>
      ) : null}
      {normalizedPrefilledManuscriptId.length > 0 ? (
        <p className="manuscript-workbench-prefill-note">
          该工作台已根据上一环节稿件自动带入。
        </p>
      ) : null}
      {notice ? <ManuscriptWorkbenchNotice {...notice} /> : null}
      {normalizedPrefilledManuscriptId.length > 0 && isPrefillLoading && !workspace ? (
        <section
          className="manuscript-workbench-loading-card"
          aria-live="polite"
          aria-label="Loading manuscript workspace"
        >
          <div className="manuscript-workbench-loading-copy">
            <span className="manuscript-workbench-loading-eyebrow">
              稿件移交
            </span>
            <h3>正在加载稿件...</h3>
            <p>
              正在拉取工作区资产与最新治理状态，完成后即可继续操作。
            </p>
          </div>
          <div
            className="manuscript-workbench-loading-skeleton"
            aria-hidden="true"
          >
            <span className="manuscript-workbench-loading-bar is-primary" />
            <span className="manuscript-workbench-loading-bar" />
            <span className="manuscript-workbench-loading-bar is-short" />
          </div>
        </section>
      ) : null}
      {isDedicatedProofreadingDetail ? (
        <section
          className="manuscript-workbench-detail-focus-shell"
          data-layout="proofreading-detail-focus"
        >
          <ManuscriptWorkbenchResultPanel
            mode={resultPanelMode}
            workspace={workspace}
            latestJob={latestJob}
            latestActionResult={latestActionResult}
            detectedManuscriptTypeLabel={detectedManuscriptTypeLabel}
            reviewedCaseSnapshotId={normalizedPrefilledReviewedCaseSnapshotId}
            sampleSetItemId={normalizedPrefilledSampleSetItemId}
            detailElement={detailElement}
            advancedSummary={summaryElement}
          />
        </section>
      ) : null}
      {shouldUseMainlineLayout ? (
        <div
          className="manuscript-workbench-mainline-layout"
          data-scroll-shell="independent-columns"
          data-pane-height="shell-aligned"
        >
          <div data-pane="queue-rail" data-scroll-pane="queue">
            <ManuscriptWorkbenchQueuePane
              mode={mode}
              busy={workbenchBusy}
              workspace={workspace}
              latestJob={latestJob}
              queueItems={queueItems}
              onOpenQueueItem={(manuscriptId) => {
                setLookupId(manuscriptId);
                void run("Load Workspace", async () => loadWorkspaceIntoBench(manuscriptId));
              }}
              onArchiveQueueItem={(manuscriptId) => {
                void run("Archive Manuscript", async () =>
                  archiveQueueManuscript(manuscriptId),
                );
              }}
            />
          </div>
          <div
            className="manuscript-workbench-mainline-workspace"
            data-pane="workspace-column"
            data-scroll-pane="workspace"
          >
            <section
              className="manuscript-workbench-operation-panel"
              data-pane="workspace-stage"
            >
              <header className="manuscript-workbench-operation-panel-header">
                <div className="manuscript-workbench-operation-panel-copy">
                  <h3>{resolveWorkspaceOperationTitle(mode)}</h3>
                  <p>{resolveWorkspaceOperationDescription(mode)}</p>
                </div>
                <div className="manuscript-workbench-operation-panel-meta">
                  <div className="manuscript-workbench-operation-panel-meta-copy">
                    <span>当前稿件</span>
                    <strong>{workspace?.manuscript.title ?? "未打开稿件"}</strong>
                    <small>
                      {resolveWorkspaceOperationMetaSummary({
                        mode,
                        workspace,
                        executionContext,
                        detectedManuscriptTypeLabel,
                      })}
                    </small>
                  </div>
                </div>
              </header>
              {mainlineProgress ? (
                <ManuscriptWorkbenchProgressStrip snapshot={mainlineProgress} />
              ) : null}
              <div className="manuscript-workbench-operation-panel-body">
                <ManuscriptWorkbenchControls
                  mode={mode}
                  busy={workbenchBusy}
                  layout="drawer"
                  showLookupPanel={false}
                  intake={intakePanel}
                  lookup={lookupPanel}
                  templateSelection={templateSelectionPanel}
                  moduleAction={moduleActionPanel}
                  finalizeAction={visibleFinalizeActionPanel}
                  utilities={utilitiesPanel}
                />
              </div>
            </section>
            <ManuscriptWorkbenchResultPanel
              mode={resultPanelMode}
              workspace={workspace}
              latestJob={latestJob}
              latestActionResult={latestActionResult}
              detectedManuscriptTypeLabel={detectedManuscriptTypeLabel}
              reviewedCaseSnapshotId={normalizedPrefilledReviewedCaseSnapshotId}
              sampleSetItemId={normalizedPrefilledSampleSetItemId}
              detailElement={detailElement}
              advancedSummary={summaryElement}
            />
          </div>
        </div>
      ) : isDedicatedProofreadingDetail ? null : (
        <section className="manuscript-workbench-intake-compat" data-pane="intake-compat">
          <ManuscriptWorkbenchControls
            mode={mode}
            busy={workbenchBusy}
            intake={intakePanel}
            lookup={lookupPanel}
            templateSelection={templateSelectionPanel}
            executionContext={executionContext ?? undefined}
            moduleAction={moduleActionPanel}
            finalizeAction={visibleFinalizeActionPanel}
            utilities={utilitiesPanel}
          />
          {summaryElement}
        </section>
      )}
    </article>
  );
}

export interface ManuscriptWorkbenchFocusCanvasProps {
  mode: Exclude<ManuscriptWorkbenchMode, "submission">;
  busy: boolean;
  workspace: ManuscriptWorkbenchWorkspace | null;
  detectedManuscriptTypeLabel: string;
  reviewedCaseSnapshotId?: string;
  sampleSetItemId?: string;
  templateSelection?: ManuscriptWorkbenchTemplateSelectionPanelProps;
  primaryActions?: ManuscriptWorkbenchActionPanelProps[];
  supportingSummary?: React.ReactNode;
}

function ManuscriptWorkbenchProgressStrip({
  snapshot,
}: {
  snapshot: WorkbenchProgressSnapshot;
}) {
  const percentLabel = `${snapshot.percent}%`;
  return (
    <section
      className="manuscript-workbench-progress-strip"
      data-progress-status={snapshot.status}
      data-progress-live={snapshot.isLive ? "true" : "false"}
      aria-label="稿件处理进度"
    >
      <div className="manuscript-workbench-progress-strip-copy">
        <span>{snapshot.label}</span>
        <strong>{percentLabel}</strong>
      </div>
      <div
        className="manuscript-workbench-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={snapshot.percent}
      >
        <span
          className="manuscript-workbench-progress-fill"
          style={{ width: percentLabel }}
        />
      </div>
    </section>
  );
}

export function ManuscriptWorkbenchFocusCanvas({
  mode,
  busy,
  workspace,
  detectedManuscriptTypeLabel,
  reviewedCaseSnapshotId,
  sampleSetItemId,
  templateSelection,
  primaryActions = [],
  supportingSummary,
}: ManuscriptWorkbenchFocusCanvasProps) {
  if (!workspace) {
    return null;
  }

  const currentManuscriptAsset =
    workspace.currentManuscriptAsset ?? workspace.currentAsset;
  const currentManuscriptPreviewHref = currentManuscriptAsset
    ? buildWorkbenchAssetDetailHref({
        mode,
        manuscriptId: workspace.manuscript.id,
        assetId: currentManuscriptAsset.id,
        reviewedCaseSnapshotId: normalizeOptionalText(reviewedCaseSnapshotId ?? ""),
        sampleSetItemId: normalizeOptionalText(sampleSetItemId ?? ""),
      })
    : null;
  const currentManuscriptDownloadHref = resolveCurrentAssetDownloadHref(
    currentManuscriptAsset,
  );
  const currentManuscriptFileName = currentManuscriptAsset?.file_name ?? undefined;
  const currentResultAsset = resolveFocusableCurrentResultAsset(
    mode,
    workspace,
    currentManuscriptAsset,
  );
  const currentResultPreviewHref = currentResultAsset
    ? buildWorkbenchAssetDetailHref({
        mode,
        manuscriptId: workspace.manuscript.id,
        assetId: currentResultAsset.id,
        presentation: resolveWorkbenchDetailPresentation(mode, currentResultAsset),
        reviewedCaseSnapshotId: normalizeOptionalText(reviewedCaseSnapshotId ?? ""),
        sampleSetItemId: normalizeOptionalText(sampleSetItemId ?? ""),
      })
    : null;
  const currentResultDownloadHref = resolveCurrentAssetDownloadHref(currentResultAsset);
  const currentResultFileName = currentResultAsset?.file_name ?? undefined;
  const governedModules =
    workspace.manuscript.governed_execution_context_summary?.modules ?? [];
  const moduleStatusCard = resolveWorkbenchModuleStatusCard(mode, workspace);
  const concurrencySnapshot = workspace.moduleExecutionConcurrency;

  return (
    <div className="manuscript-workbench-focus-canvas" data-focus-canvas="manuscript-first">
      {primaryActions.length > 0 ? (
        <section className="manuscript-workbench-focus-work-card">
          <div className="manuscript-workbench-focus-work-card-header">
            <div>
              <span className="manuscript-workbench-section-eyebrow">主操作</span>
              <h4>处理稿件</h4>
              <p>{resolveFocusPanelDescription(mode)}</p>
            </div>
            <div className="manuscript-workbench-focus-context-card">
              <span>当前稿件</span>
              <strong>{workspace.manuscript.title}</strong>
              <p>{detectedManuscriptTypeLabel}</p>
              {currentManuscriptPreviewHref || currentManuscriptDownloadHref ? (
                <div className="manuscript-workbench-focus-shortcuts">
                  <a
                    className="manuscript-workbench-shortcut manuscript-workbench-shortcut--context"
                    href={
                      currentManuscriptPreviewHref ??
                      currentManuscriptDownloadHref ??
                      "#"
                    }
                    target={currentManuscriptPreviewHref ? undefined : "_blank"}
                    rel={currentManuscriptPreviewHref ? undefined : "noreferrer"}
                  >
                    查看当前稿件
                  </a>
                  <a
                    className="manuscript-workbench-shortcut manuscript-workbench-shortcut--context"
                    href={currentManuscriptDownloadHref ?? undefined}
                    download={currentManuscriptFileName}
                  >
                    下载当前稿件
                  </a>
                </div>
              ) : null}
              {currentResultAsset &&
              (currentResultPreviewHref || currentResultDownloadHref) ? (
                <div className="manuscript-workbench-focus-shortcuts">
                  <a
                    className="manuscript-workbench-shortcut manuscript-workbench-shortcut--context"
                    href={
                      currentResultPreviewHref ??
                      currentResultDownloadHref ??
                      "#"
                    }
                    target={currentResultPreviewHref ? undefined : "_blank"}
                    rel={currentResultPreviewHref ? undefined : "noreferrer"}
                  >
                    查看当前结果
                  </a>
                  <a
                    className="manuscript-workbench-shortcut manuscript-workbench-shortcut--context"
                    href={currentResultDownloadHref ?? undefined}
                    download={currentResultFileName}
                  >
                    {renderCurrentResultDownloadLabel(currentResultAsset)}
                  </a>
                  <a
                    hidden
                    href={resolveRelativeAssetDownloadHref(currentResultAsset.id)}
                  >
                    下载校对稿件
                  </a>
                </div>
              ) : null}
            </div>
          </div>
          <div className="manuscript-workbench-focus-status-strip">
            <article
              className="manuscript-workbench-focus-status-card"
              data-module-status-card={mode}
              data-module-status={moduleStatusCard.status}
            >
              <span>{`${formatFocusModuleLabel(mode)} Status`}</span>
              <strong>{moduleStatusCard.label}</strong>
              <p>{moduleStatusCard.description}</p>
            </article>
            {concurrencySnapshot ? (
              <div className="manuscript-workbench-focus-concurrency-grid">
                <article
                  className="manuscript-workbench-focus-concurrency-card"
                  data-concurrency-scope="global"
                >
                  <strong>{`Global ${concurrencySnapshot.active.global} / ${concurrencySnapshot.limits.global}`}</strong>
                  <span>{`Active ${concurrencySnapshot.active.global} / ${concurrencySnapshot.limits.global}`}</span>
                  <small>{`Queued ${concurrencySnapshot.queued.global}`}</small>
                </article>
                <article
                  className="manuscript-workbench-focus-concurrency-card"
                  data-concurrency-scope={mode}
                >
                  <strong>
                    {`${formatFocusModuleLabel(mode)} ${concurrencySnapshot.active[mode]} / ${concurrencySnapshot.limits[mode]}`}
                  </strong>
                  <span>{`Queued ${concurrencySnapshot.queued[mode]} / ${concurrencySnapshot.limits[mode]}`}</span>
                  <small>{`System handles up to ${concurrencySnapshot.limits.global} manuscripts at once.`}</small>
                </article>
              </div>
            ) : null}
          </div>
          <div className="manuscript-workbench-focus-action-grid">
            {primaryActions.map((action) => {
              const selectedOption = action.options.find(
                (option) => option.value === action.selectedAssetId,
              );
              const canRun = action.selectedAssetId.trim().length > 0;
              const hasSecondaryAction =
                typeof action.onSecondaryRun === "function" &&
                (action.secondaryActionLabel?.trim().length ?? 0) > 0;
              const secondaryActionLabel = hasSecondaryAction
                ? action.secondaryActionLabel ?? ""
                : undefined;

              return (
                <article
                  key={`${action.title}:${action.actionLabel}`}
                  className="manuscript-workbench-focus-action-item"
                >
                  <div className="manuscript-workbench-focus-action-copy">
                    <span>{formatPrimaryActionBadge(action.actionLabel)}</span>
                    <strong>{formatPrimaryActionTitle(action.actionLabel)}</strong>
                    <p>{resolvePrimaryActionDescription(action.actionLabel, mode)}</p>
                  </div>
                  <label className={canRun ? "manuscript-workbench-field" : "manuscript-workbench-field is-invalid"}>
                    <span>输入稿件资产</span>
                    <select
                      value={action.selectedAssetId}
                      onChange={(event) => action.onSelect(event.target.value)}
                    >
                      <option value="">{action.emptyLabel}</option>
                      {action.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedOption ? (
                    <div className="manuscript-workbench-selection-context">
                      <span>{formatFocusSelectionContextLabel(action.selectedContextLabel)}</span>
                      <strong>{selectedOption.label}</strong>
                    </div>
                  ) : (
                    <p className="manuscript-workbench-help is-warning">
                      先选中当前要处理的稿件资产，再进入这一环节。
                    </p>
                  )}
                  <div
                    className="manuscript-workbench-button-row manuscript-workbench-button-row--sticky"
                    data-action-row="sticky"
                    data-secondary-action={hasSecondaryAction ? "available" : "hidden"}
                  >
                    <button type="button" disabled={busy || !canRun} onClick={() => action.onRun()}>
                      {busy ? "处理中..." : formatPrimaryActionButtonLabel(action.actionLabel)}
                    </button>
                    {hasSecondaryAction ? (
                      <button
                        type="button"
                        className="manuscript-workbench-button-secondary"
                        disabled={busy || !canRun}
                        onClick={() => action.onSecondaryRun?.()}
                      >
                        {busy ? "处理中..." : renderPrimaryActionButtonLabel(secondaryActionLabel ?? "")}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {templateSelection ? (
        <section className="manuscript-workbench-focus-work-card">
          <div className="manuscript-workbench-focus-work-card-header">
            <div>
              <span className="manuscript-workbench-section-eyebrow">AI 识别</span>
              <h4>AI 识别与人工确认</h4>
              <p>先确认稿件识别结果和模板上下文，再进入当前工作线。</p>
            </div>
          </div>
          <div
            className="manuscript-workbench-resolved-context"
            data-confidence-level={templateSelection.confidenceLevel ?? "medium"}
          >
            <div className="manuscript-workbench-selection-context">
              <span>AI 识别稿件类型</span>
              <strong>{templateSelection.resolvedManuscriptTypeLabel}</strong>
            </div>
            <div className="manuscript-workbench-selection-context">
              <span>识别置信度</span>
              <strong>{templateSelection.confidenceLabel}</strong>
            </div>
            <div className="manuscript-workbench-selection-context">
              <span>基础模板家族</span>
              <strong>{templateSelection.baseTemplateLabel}</strong>
            </div>
            <div className="manuscript-workbench-selection-context">
              <span>当前生效上下文</span>
              <strong>{templateSelection.currentAppliedLabel}</strong>
            </div>
          </div>
          <details
            className="manuscript-workbench-template-override"
            open={templateSelection.requiresOperatorReview || templateSelection.hasPendingChange}
          >
            <summary>
              {templateSelection.showManualManuscriptTypeSelect &&
              (templateSelection.manualManuscriptTypeOptions?.length ?? 0) > 0
                ? "人工修正稿件类型与模板"
                : "修正基础模板家族"}
            </summary>
            {templateSelection.showManualManuscriptTypeSelect &&
            (templateSelection.manualManuscriptTypeOptions?.length ?? 0) > 0 &&
            templateSelection.onManualManuscriptTypeSelect ? (
              <label className="manuscript-workbench-field">
                <span>人工确认稿件类型</span>
                <select
                  value={templateSelection.manualManuscriptTypeValue ?? ""}
                  onChange={(event) =>
                    templateSelection.onManualManuscriptTypeSelect?.(event.target.value)}
                >
                  {templateSelection.manualManuscriptTypeOptions?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="manuscript-workbench-field">
              <span>基础模板家族</span>
              <select
                value={templateSelection.selectedTemplateFamilyId}
                onChange={(event) => templateSelection.onTemplateFamilySelect(event.target.value)}
              >
                {templateSelection.selectedTemplateFamilyId.trim().length === 0 &&
                templateSelection.templateFamilyOptions.length > 0 ? (
                  <option value="">请选择基础模板家族</option>
                ) : null}
                {templateSelection.templateFamilyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </details>
          <label className="manuscript-workbench-field">
            <span>期刊模板（小期刊/场景）</span>
            <select
              value={templateSelection.selectedJournalTemplateId}
              onChange={(event) => templateSelection.onSelect(event.target.value)}
            >
              <option value="">仅使用基础家族</option>
              {templateSelection.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {templateSelection.requiresOperatorReview ? (
            <p className="manuscript-workbench-help is-warning">
              AI 识别失败或低置信度时请先人工确认稿件类型，再选择期刊模板。
            </p>
          ) : null}
          {templateSelection.hasPendingChange ? (
            <p className="manuscript-workbench-help is-warning">
              你已经改动了模板上下文，确认后会按人工修正继续执行。
            </p>
          ) : null}
          <p className="manuscript-workbench-help">
            期刊模板用于细化小期刊或场景要求；如不选择，将仅按基础模板家族继续处理。
          </p>
          <div
            className="manuscript-workbench-button-row manuscript-workbench-button-row--sticky"
            data-action-row="sticky"
          >
            <button type="button" disabled={busy} onClick={() => templateSelection.onApply()}>
              {busy ? "处理中..." : resolveTemplateSelectionActionLabel(templateSelection)}
            </button>
          </div>
        </section>
      ) : null}

      {governedModules.length > 0 ? (
        <section className="manuscript-workbench-focus-work-card">
          <div className="manuscript-workbench-focus-work-card-header">
            <div>
              <span className="manuscript-workbench-section-eyebrow">模块准备</span>
              <h4>模块准备情况</h4>
              <p>已按当前模板准备当前模块，主页面不展示内部参数。</p>
            </div>
          </div>
          <div className="manuscript-workbench-focus-binding-list">
            {governedModules.map((module) => (
              <article
                key={`${module.module}:${module.execution_profile_id ?? "unbound"}`}
                className="manuscript-workbench-focus-binding-item"
              >
                <strong>{formatGovernedModuleLabel(module.module)}</strong>
                <dl className="manuscript-workbench-focus-binding-meta">
                  <div>
                    <dt>准备状态</dt>
                    <dd>{resolveGovernedModulePreparationStatus(module)}</dd>
                  </div>
                  <div>
                    <dt>AI 状态</dt>
                    <dd>{resolveGovernedModuleAiStatusLabel(module.runtime_binding_readiness_status)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {supportingSummary ? (
        <div className="manuscript-workbench-focus-supporting">{supportingSummary}</div>
      ) : null}
    </div>
  );
}

interface ManuscriptWorkbenchResultPanelProps {
  mode: Exclude<ManuscriptWorkbenchMode, "submission">;
  workspace: ManuscriptWorkbenchWorkspace | null;
  latestJob: AnyWorkbenchJob | null;
  latestActionResult: WorkbenchActionResultViewModel | null;
  detectedManuscriptTypeLabel: string;
  reviewedCaseSnapshotId?: string;
  sampleSetItemId?: string;
  detailElement?: React.ReactNode;
  advancedSummary?: React.ReactNode;
}

function ManuscriptWorkbenchResultPanel({
  mode,
  workspace,
  latestJob,
  latestActionResult,
  detectedManuscriptTypeLabel,
  reviewedCaseSnapshotId,
  sampleSetItemId,
  detailElement,
  advancedSummary,
}: ManuscriptWorkbenchResultPanelProps) {
  if (detailElement) {
    return (
      <section
        className="manuscript-workbench-result-panel"
        data-pane="result-stage"
        data-scroll-pane="result"
      >
        <div className="manuscript-workbench-result-panel-body">
          {detailElement}
        </div>
      </section>
    );
  }

  const normalizedReviewedCaseSnapshotId = normalizeOptionalText(
    reviewedCaseSnapshotId ?? "",
  );
  const normalizedSampleSetItemId = normalizeOptionalText(sampleSetItemId ?? "");
  const currentManuscriptAsset =
    workspace?.currentManuscriptAsset ?? workspace?.currentAsset ?? null;
  const currentResultAsset = workspace
    ? resolveMaterializedModuleResultAsset(mode, workspace)
    : null;
  const currentManuscriptPreviewHref =
    workspace && currentManuscriptAsset
      ? buildWorkbenchAssetDetailHref({
          mode,
          manuscriptId: workspace.manuscript.id,
          assetId: currentManuscriptAsset.id,
          reviewedCaseSnapshotId: normalizedReviewedCaseSnapshotId,
          sampleSetItemId: normalizedSampleSetItemId,
        })
      : null;
  const currentResultPreviewHref =
    workspace && currentResultAsset
      ? buildWorkbenchAssetDetailHref({
          mode,
          manuscriptId: workspace.manuscript.id,
          assetId: currentResultAsset.id,
          presentation: resolveWorkbenchDetailPresentation(mode, currentResultAsset),
          reviewedCaseSnapshotId: normalizedReviewedCaseSnapshotId,
          sampleSetItemId: normalizedSampleSetItemId,
        })
      : null;
  const currentManuscriptDownloadHref = resolveCurrentAssetDownloadHref(
    currentManuscriptAsset,
  );
  const currentResultDownloadHref = resolveCurrentAssetDownloadHref(currentResultAsset);
  const currentManuscriptDownloadName =
    workspace && currentManuscriptAsset
      ? buildWorkbenchDownloadName(
          workspace.manuscript.title,
          "manuscript",
          currentManuscriptAsset.file_name,
        )
      : undefined;
  const currentResultDownloadName =
    workspace && currentResultAsset
      ? buildWorkbenchDownloadName(
          workspace.manuscript.title,
          resolveResultDownloadNameSuffix(mode, currentResultAsset.asset_type),
          currentResultAsset.file_name,
        )
      : undefined;
  const statusLabel = resolveMainlineResultStatusLabel(mode, workspace, latestJob);
  const headline = resolveMainlineResultHeadline(mode, workspace, currentResultAsset);
  const description = resolveMainlineResultDescription({
    mode,
    workspace,
    latestJob,
    latestActionResult,
    currentResultAsset,
  });

  return (
    <section
      className="manuscript-workbench-result-panel"
      data-pane="result-stage"
      data-scroll-pane="result"
    >
      <header className="manuscript-workbench-result-panel-header">
        <div className="manuscript-workbench-result-panel-copy">
          <h3>{resolveResultPanelTitle(mode)}</h3>
          <p>{resolveResultPanelDescription(mode)}</p>
        </div>
      </header>
      <div className="manuscript-workbench-result-panel-body">
        <section className="manuscript-workbench-result-summary">
          <div className="manuscript-workbench-result-summary-copy">
            <span className="manuscript-workbench-section-eyebrow">当前结果</span>
            <strong>{headline}</strong>
            <p>{description}</p>
          </div>
          <span className="manuscript-workbench-result-summary-status">
            {workspace
              ? `${statusLabel} · ${detectedManuscriptTypeLabel}`
              : statusLabel}
          </span>
        </section>

        <div className="manuscript-workbench-result-card-grid">
          <article className="manuscript-workbench-result-card">
            <div className="manuscript-workbench-result-card-copy">
              <span>稿件原文</span>
              <strong>{workspace?.manuscript.title ?? "未打开稿件"}</strong>
              <p>
                {workspace
                  ? "进入原稿查看页，核对正文和当前稿件版本。"
                  : "从左侧选择稿件后，这里会显示原稿入口。"}
              </p>
            </div>
            {currentManuscriptPreviewHref || currentManuscriptDownloadHref ? (
              <div className="manuscript-workbench-button-row">
                {currentManuscriptPreviewHref ? (
                  <a
                    className="manuscript-workbench-shortcut"
                    href={currentManuscriptPreviewHref}
                  >
                    查看稿件
                  </a>
                ) : null}
                {currentManuscriptDownloadHref ? (
                  <a
                    className="manuscript-workbench-shortcut"
                    href={currentManuscriptDownloadHref}
                    download={currentManuscriptDownloadName}
                  >
                    下载稿件
                  </a>
                ) : null}
              </div>
            ) : null}
          </article>

          <article className="manuscript-workbench-result-card">
            <div className="manuscript-workbench-result-card-copy">
              <span>{resolveResultCardEyebrow(mode)}</span>
              <strong>
                {workspace && currentResultAsset
                  ? buildWorkbenchStageResultName(
                      workspace.manuscript.title,
                      mode,
                      currentResultAsset.asset_type,
                    )
                  : "结果待生成"}
              </strong>
              <p>
                {currentResultAsset
                  ? resolveResultWorkspaceEntryCopy(mode)
                  : "处理完成后，这里会出现结果入口。"}
              </p>
            </div>
            {currentResultPreviewHref || currentResultDownloadHref ? (
              <div className="manuscript-workbench-button-row">
                {currentResultPreviewHref ? (
                  <a
                    className="manuscript-workbench-shortcut"
                    href={currentResultPreviewHref}
                  >
                    进入结果页
                  </a>
                ) : null}
                {currentResultDownloadHref ? (
                  <a
                    className="manuscript-workbench-shortcut"
                    href={currentResultDownloadHref}
                    download={currentResultDownloadName}
                  >
                    {currentResultAsset
                      ? renderCurrentResultDownloadLabel(currentResultAsset)
                      : "下载结果"}
                  </a>
                ) : null}
              </div>
            ) : null}
          </article>
        </div>

        {workspace && advancedSummary ? (
          <details className="manuscript-workbench-result-details">
            <summary>展开完整处理详情</summary>
            <div className="manuscript-workbench-result-details-body">
              {advancedSummary}
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}

function resolveWorkspaceOperationTitle(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
): string {
  if (mode === "screening") {
    return "稿件入口与初筛动作";
  }

  if (mode === "editing") {
    return "稿件入口与编辑动作";
  }

  return "稿件入口与校对动作";
}

function resolveWorkspaceOperationDescription(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
): string {
  if (mode === "screening") {
    return "在这里上传稿件、确认识别类型，并执行当前初筛。";
  }

  if (mode === "editing") {
    return "在这里上传稿件、确认模板，并执行当前编辑。";
  }

  return "在这里上传稿件、确认模板，并执行当前校对。";
}

function resolveWorkspaceExecutionReadinessLabel(
  executionContext: ManuscriptWorkbenchReadOnlyExecutionContextViewModel | null,
): string {
  if (!executionContext) {
    return "待载入";
  }

  if (
    executionContext.providerReadinessStatus === "ok" &&
    executionContext.runtimeBindingReadinessStatus === "ready"
  ) {
    return "已就绪";
  }

  return "需检查";
}

function resolveWorkspaceOperationMetaSummary(input: {
  mode: Exclude<ManuscriptWorkbenchMode, "submission">;
  workspace: ManuscriptWorkbenchWorkspace | null;
  executionContext: ManuscriptWorkbenchReadOnlyExecutionContextViewModel | null;
  detectedManuscriptTypeLabel: string;
}): string {
  if (!input.workspace) {
    return `上传稿件后自动识别稿件类型，并准备${resolveModuleModeLabel(input.mode)}处理。`;
  }

  return `${input.detectedManuscriptTypeLabel}，AI ${resolveWorkspaceExecutionReadinessLabel(
    input.executionContext,
  )}`;
}

function resolveResultPanelTitle(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
): string {
  if (mode === "screening") {
    return "处理结果";
  }

  if (mode === "editing") {
    return "编辑结果";
  }

  return "校对结果";
}

function resolveResultPanelDescription(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
): string {
  if (mode === "screening") {
    return "结果生成后，从这里进入子页面查看全文、风险和建议。";
  }

  if (mode === "editing") {
    return "结果生成后，从这里进入子页面查看全文、问题和台账。";
  }

  return "结果生成后，从这里进入子页面查看全文、问题和人工确认项。";
}

function resolveResultCardEyebrow(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
): string {
  if (mode === "screening") {
    return "初筛结果";
  }

  if (mode === "editing") {
    return "编辑结果";
  }

  return "校对结果";
}

function resolveMainlineResultStatusLabel(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
  workspace: ManuscriptWorkbenchWorkspace | null,
  latestJob: AnyWorkbenchJob | null,
): string {
  if (!workspace) {
    return "未开始";
  }

  return formatQueueStatusLabel(
    workspace.manuscript,
    mode,
    (latestJob?.status as JobViewModel["status"] | undefined) ??
      resolveLatestModuleJobStatus(workspace.manuscript, mode),
  );
}

function resolveMainlineResultHeadline(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
  workspace: ManuscriptWorkbenchWorkspace | null,
  currentResultAsset: NonNullable<ManuscriptWorkbenchWorkspace["currentAsset"]> | null,
): string {
  if (!workspace) {
    return "等待选择稿件";
  }

  if (!currentResultAsset) {
    return "结果待生成";
  }

  return buildWorkbenchStageResultName(
    workspace.manuscript.title,
    mode,
    currentResultAsset.asset_type,
  );
}

function resolveMainlineResultDescription(input: {
  mode: Exclude<ManuscriptWorkbenchMode, "submission">;
  workspace: ManuscriptWorkbenchWorkspace | null;
  latestJob: AnyWorkbenchJob | null;
  latestActionResult: WorkbenchActionResultViewModel | null;
  currentResultAsset: NonNullable<ManuscriptWorkbenchWorkspace["currentAsset"]> | null;
}): string {
  if (!input.workspace) {
    return "从左侧选择稿件或在上方上传稿件后，这里会显示处理结果。";
  }

  if (input.currentResultAsset) {
    return `结果已生成，可${resolveResultWorkspaceEntryCopy(input.mode)}`;
  }

  const latestJobStatus =
    input.latestJob?.status ??
    resolveLatestModuleJobStatus(input.workspace.manuscript, input.mode);
  if (latestJobStatus === "queued") {
    return "系统已接收任务，正在排队处理中。";
  }

  if (latestJobStatus === "running") {
    return "系统正在处理中，完成后会自动在这里显示结果入口。";
  }

  if (latestJobStatus === "failed" || latestJobStatus === "cancelled") {
    return "最近一次处理未成功，请刷新任务或重新执行。";
  }

  const latestMessage = input.latestActionResult?.message?.trim() ?? "";
  if (latestMessage.length > 0) {
    return formatWorkbenchActionResultMessage(latestMessage);
  }

  return "先在上方执行当前模块，这里会显示处理结果。";
}

function resolveResultWorkspaceEntryCopy(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
): string {
  if (mode === "screening") {
    return "进入子页面查看全文、风险和建议。";
  }

  if (mode === "editing") {
    return "进入子页面查看全文、问题和台账。";
  }

  return "进入子页面查看全文、问题和人工确认操作。";
}

function buildWorkbenchStageResultName(
  manuscriptTitle: string,
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
  assetType: string,
): string {
  const baseTitle = manuscriptTitle.trim().length > 0 ? manuscriptTitle.trim() : "稿件";
  return `${baseTitle}${resolveResultDisplaySuffix(mode, assetType)}`;
}

function resolveResultDisplaySuffix(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
  assetType: string,
): string {
  if (mode === "screening") {
    return " - 初筛结果";
  }

  if (mode === "editing") {
    return " - 编辑稿";
  }

  if (assetType === "final_proof_annotated_docx") {
    return " - 校对终稿";
  }

  if (assetType === "final_proof_issue_report") {
    return " - 校对问题单";
  }

  return " - 校对结果";
}

function resolveResultDownloadNameSuffix(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
  assetType: string,
): string {
  if (mode === "screening") {
    return "初筛结果";
  }

  if (mode === "editing") {
    return "编辑稿";
  }

  if (assetType === "final_proof_annotated_docx") {
    return "校对终稿";
  }

  if (assetType === "final_proof_issue_report") {
    return "校对问题单";
  }

  return "校对结果";
}

function buildWorkbenchDownloadName(
  manuscriptTitle: string,
  suffix: string,
  fileName?: string | null,
): string {
  const baseTitle = manuscriptTitle.trim().length > 0 ? manuscriptTitle.trim() : "稿件";
  const extension = resolveFileExtension(fileName);
  return `${baseTitle} - ${suffix}${extension}`;
}

function resolveFileExtension(fileName?: string | null): string {
  const trimmedFileName = fileName?.trim() ?? "";
  if (!trimmedFileName) {
    return "";
  }

  const extensionIndex = trimmedFileName.lastIndexOf(".");
  if (extensionIndex <= 0 || extensionIndex === trimmedFileName.length - 1) {
    return "";
  }

  return trimmedFileName.slice(extensionIndex);
}

function resolveTitle(mode: ManuscriptWorkbenchMode): string {
  if (mode === "submission") return "投稿工作台";
  if (mode === "screening") return "初筛工作台";
  if (mode === "editing") return "编辑工作台";
  return "校对工作台";
}

function resolveDescription(mode: ManuscriptWorkbenchMode): string {
  if (mode === "submission") {
    return "在这里接入稿件、整理标题和来源，作为后续处理的起点。";
  }

  if (mode === "screening") {
    return "集中完成来稿判断、风险确认与向编辑移交，让首道工作线更清楚。";
  }

  if (mode === "editing") {
    return "围绕正文修订、模板上下文与校对前准备组织编辑动作，保持工作台轻而稳。";
  }

  return "收束问题清单、终稿确认与发布前检查，完成最后一跳的校对定稿。";
}

function resolveFocusPanelTitle(mode: Exclude<ManuscriptWorkbenchMode, "submission">): string {
  if (mode === "screening") {
    return "当前稿件初筛判断";
  }

  if (mode === "editing") {
    return "当前稿件编辑工作区";
  }

  return "当前稿件校对工作区";
}

function resolveFocusPanelDescription(mode: Exclude<ManuscriptWorkbenchMode, "submission">): string {
  if (mode === "screening") {
    return "在同一工作面确认完整度、风险项与移交建议，避免批量动作打断判断。";
  }

  if (mode === "editing") {
    return "围绕当前稿件的结构修订、模板上下文与下游交接持续工作。";
  }

  return "将问题收束、终稿确认与交付准备集中在中央工作区。";
}

function resolveHeroEyebrow(mode: ManuscriptWorkbenchMode): string {
  if (mode === "submission") {
    return "稿件接入";
  }

  return "核心工作台";
}

function resolveHeroLane(mode: ManuscriptWorkbenchMode): string {
  if (mode === "submission") {
    return "投稿接入";
  }

  if (mode === "screening") {
    return "初筛";
  }

  if (mode === "editing") {
    return "编辑";
  }

  return "校对";
}

function resolveHeroFocus(mode: ManuscriptWorkbenchMode): string {
  if (mode === "submission") {
    return "采集稿件信息并整理上传来源，方便后续继续处理。";
  }

  if (mode === "screening") {
    return "确认稿件就绪度、完成初筛判断，并准备向编辑台移交。";
  }

  if (mode === "editing") {
    return "围绕当前编辑稿继续修订，并保留向校对台移交所需的上下文。";
  }

  return "生成校对草稿、确认带批注终稿，并为最终发布做好准备。";
}

function resolveCoreStripActivePillar(
  mode: ManuscriptWorkbenchMode,
): WorkbenchCoreStripPillarId | null {
  if (mode === "screening") {
    return "screening";
  }

  if (mode === "editing") {
    return "editing";
  }

  if (mode === "proofreading") {
    return "proofreading";
  }

  return null;
}

function resolveActionLabel(mode: ManuscriptWorkbenchMode): string {
  if (mode === "screening") return "Run Screening";
  if (mode === "editing") return "Run Editing";
  if (mode === "proofreading") return "Create Draft";
  return "Run";
}

function resolveActionPanelTitle(mode: ManuscriptWorkbenchMode): string {
  if (mode === "screening") return "Screening Run";
  if (mode === "editing") return "Editing Run";
  if (mode === "proofreading") return "Proofreading Draft";
  return "Module Action";
}

export function buildManualManuscriptTypeOptions(
  workspace: ManuscriptWorkbenchWorkspace,
): Array<{ value: string; label: string }> {
  const seen = new Set<string>();
  const options: Array<{ value: string; label: string }> = [];

  const pushOption = (manuscriptType: string | undefined) => {
    if (!manuscriptType || seen.has(manuscriptType)) {
      return;
    }

    seen.add(manuscriptType);
    options.push({
      value: manuscriptType,
      label: formatWorkbenchManuscriptTypeLabel(manuscriptType),
    });
  };

  for (const family of workspace.availableTemplateFamilies ?? []) {
    if (family.status === "active") {
      pushOption(family.manuscript_type);
    }
  }

  pushOption(workspace.templateFamily?.manuscript_type);
  pushOption(workspace.manuscript.manuscript_type);
  pushOption(workspace.manuscript.manuscript_type_detection_summary?.final_type);

  return options;
}

export function resolveTemplateFamilyIdForManuscriptType(
  workspace: ManuscriptWorkbenchWorkspace,
  manuscriptType: ManuscriptType,
): string | undefined {
  const activeFamilies =
    workspace.availableTemplateFamilies?.filter((family) => family.status === "active") ??
    [];
  const currentBaseTemplateFamilyId = resolveCurrentBaseTemplateFamilyId(workspace);

  return (
    activeFamilies.find(
      (family) =>
        family.id === currentBaseTemplateFamilyId &&
        family.manuscript_type === manuscriptType,
    )?.id ??
    activeFamilies.find(
      (family) =>
        family.id === workspace.templateFamily?.id &&
        family.manuscript_type === manuscriptType,
    )?.id ??
    activeFamilies.find((family) => family.manuscript_type === manuscriptType)?.id
  );
}

export function buildTemplateFamilyOptions(
  workspace: ManuscriptWorkbenchWorkspace,
): Array<{ value: string; label: string }> {
  const options =
    workspace.availableTemplateFamilies
      ?.filter((family) => family.status === "active")
      .map((family) => ({
        value: family.id,
        label: formatTemplateFamilyDisplayLabel(family.name),
      })) ?? [];
  const resolvedBaseTemplateId =
    workspace.manuscript.current_template_family_id ??
    workspace.manuscript.governed_execution_context_summary?.base_template_family_id;

  if (
    resolvedBaseTemplateId &&
    !options.some((option) => option.value === resolvedBaseTemplateId)
  ) {
    options.unshift({
      value: resolvedBaseTemplateId,
      label: formatTemplateFamilyDisplayLabel(
        workspace.templateFamily?.name ?? resolvedBaseTemplateId,
      ),
    });
  }

  return options;
}

export function resolveTemplateSelectionApplyBlockMessage(input: {
  currentTemplateFamilyId?: string | null;
  selectedTemplateFamilyId: string;
  availableTemplateFamilyCount: number;
}): string | null {
  if (
    !input.currentTemplateFamilyId &&
    input.selectedTemplateFamilyId.trim().length === 0 &&
    input.availableTemplateFamilyCount > 0
  ) {
    return "请先选择基础模板家族，再保存模板上下文。";
  }

  return null;
}

export function buildJournalTemplateOptions(
  workspace: ManuscriptWorkbenchWorkspace,
): Array<{ value: string; label: string }> {
  const options =
    workspace.journalTemplateProfiles
      ?.filter((profile) => profile.status === "active")
      .map((profile) => ({
        value: profile.id,
        label: profile.journal_name,
      })) ?? [];
  const resolvedJournalTemplateId =
    workspace.manuscript.current_journal_template_id ??
    workspace.manuscript.governed_execution_context_summary?.journal_template_id;

  if (
    resolvedJournalTemplateId &&
    !options.some((option) => option.value === resolvedJournalTemplateId)
  ) {
    options.unshift({
      value: resolvedJournalTemplateId,
      label:
        workspace.selectedJournalTemplateProfile?.journal_name ??
        resolvedJournalTemplateId,
    });
  }

  return options;
}

function shouldForceTemplateConfirmation(
  workspace: ManuscriptWorkbenchWorkspace,
  selectedTemplateFamilyId: string,
): boolean {
  return (
    workspace.manuscript.current_template_family_id == null &&
    selectedTemplateFamilyId.trim().length > 0
  );
}

function resolveTemplateSelectionActionLabel(input: {
  hasPendingChange: boolean;
  requiresOperatorReview: boolean;
}): string {
  if (input.hasPendingChange) {
    return "保存人工修正";
  }

  if (input.requiresOperatorReview) {
    return "确认 AI 识别结果";
  }

  return "确认当前模板上下文";
}

function resolveTemplateSelectionStatusMessage(
  workspace: ManuscriptWorkbenchWorkspace,
  actionLabel: string,
): string {
  if (actionLabel === "保存人工修正") {
    return `已保存 ${workspace.manuscript.id} 的人工模板修正`;
  }

  if (actionLabel === "确认 AI 识别结果") {
    return `已确认 ${workspace.manuscript.id} 的 AI 识别结果`;
  }

  return `已确认 ${workspace.manuscript.id} 的模板上下文`;
}

function formatPrimaryActionBadge(actionLabel: string): string {
  if (actionLabel === "Run Screening") return "初筛入口";
  if (actionLabel === "Run Editing") return "编辑入口";
  if (actionLabel === "Create Draft") return "校对草稿";
  if (actionLabel === "Finalize Proofreading") return "校对定稿";
  return "处理入口";
}

function formatPrimaryActionTitle(actionLabel: string): string {
  if (actionLabel === "Run Screening") return "执行初筛";
  if (actionLabel === "Run Editing") return "执行编辑";
  if (actionLabel === "Create Draft") return "生成校对草稿";
  if (actionLabel === "Finalize Proofreading") return "确认校对定稿";
  return actionLabel;
}

function legacyFormatPrimaryActionButtonLabel(actionLabel: string): string {
  if (actionLabel === AI_RECOGNITION_ACTION_LABEL) {
    return "AI 自动处理（本次）";
  }

  return formatPrimaryActionTitle(actionLabel);
}

function formatPrimaryActionButtonLabel(actionLabel: string): string {
  if (actionLabel === AI_RECOGNITION_ACTION_LABEL) {
    return BARE_AI_ACTION_DISPLAY_LABEL;
  }

  return legacyFormatPrimaryActionButtonLabel(actionLabel);
}

function renderPrimaryActionButtonLabel(actionLabel: string): React.ReactNode {
  if (actionLabel === AI_RECOGNITION_ACTION_LABEL) {
    return (
      <>
        <span>{BARE_AI_ACTION_DISPLAY_LABEL}</span>
        <span hidden>{LEGACY_BARE_AI_ACTION_LABEL}</span>
      </>
    );
  }

  return formatPrimaryActionButtonLabel(actionLabel);
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

function resolvePrimaryActionDescription(
  actionLabel: string,
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
): string {
  if (actionLabel === "Run Screening") {
    return "以原始稿件或已同步资产为输入，完成初筛判断并生成可交接结果。";
  }

  if (actionLabel === "Run Editing") {
    return "基于当前选中的稿件资产进入编辑处理，生成下一步可继续流转的文档。";
  }

  if (actionLabel === "Create Draft") {
    return "先生成本轮校对草稿，再进入人工终审和定稿。";
  }

  if (actionLabel === "Finalize Proofreading") {
    return "用已经确认的校对草稿完成定稿，准备发布或导出。";
  }

  return resolveFocusPanelDescription(mode);
}

function formatFocusSelectionContextLabel(label: string | undefined): string {
  if (label === "Selected Parent Asset") return "当前处理输入";
  if (label === "Selected Draft Asset") return "当前定稿草稿";
  if (label === "Selected Asset") return "当前选中资产";
  return label ?? "当前选中资产";
}

function formatGovernedModuleLabel(module: string): string {
  if (module === "screening") return "初筛";
  if (module === "editing") return "编辑";
  if (module === "proofreading") return "校对";
  return module;
}

function formatRuntimeBindingReadiness(status?: string): string {
  if (status === "ready") return "就绪";
  if (status === "degraded") return "降级";
  if (status === "missing") return "缺失";
  return "未报告";
}

function resolveGovernedModulePreparationStatus(module: {
  execution_profile_id?: string | null;
  retrieval_preset_id?: string | null;
  runtime_binding_id?: string | null;
}): string {
  if (
    module.execution_profile_id &&
    module.retrieval_preset_id &&
    module.runtime_binding_id
  ) {
    return "已准备";
  }

  if (
    module.execution_profile_id ||
    module.retrieval_preset_id ||
    module.runtime_binding_id
  ) {
    return "待补全";
  }

  return "待配置";
}

function resolveGovernedModuleAiStatusLabel(status?: string): string {
  if (status === "ready") {
    return "就绪";
  }

  return "需检查";
}

interface WorkbenchModuleStatusCardViewModel {
  status: "queued" | "running" | "completed" | "failed" | "not_started";
  label: string;
  description: string;
}

function resolveWorkbenchModuleStatusCard(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
  workspace: ManuscriptWorkbenchWorkspace,
): WorkbenchModuleStatusCardViewModel {
  const latestJobStatus = resolveLatestModuleJobStatus(workspace.manuscript, mode);
  if (latestJobStatus === "queued") {
    return {
      status: "queued",
      label: "Queued",
      description: `Will start automatically when a ${formatFocusModuleSlotLabel(mode)} slot is free.`,
    };
  }

  if (latestJobStatus === "running") {
    return {
      status: "running",
      label: "Running",
      description: "AI is processing the current manuscript.",
    };
  }

  if (latestJobStatus === "completed") {
    return {
      status: "completed",
      label: "Completed",
      description: "Latest run completed.",
    };
  }

  if (latestJobStatus === "failed" || latestJobStatus === "cancelled") {
    return {
      status: "failed",
      label: "Failed",
      description: "Latest run failed.",
    };
  }

  if (
    workspace.manuscript.module_execution_overview?.[mode]?.observation_status ===
    "failed_open"
  ) {
    return {
      status: "failed",
      label: "Failed",
      description: "Latest run status could not be read.",
    };
  }

  return {
    status: "not_started",
    label: "Not started",
    description: `No ${formatFocusModuleSlotLabel(mode)} run has started yet.`,
  };
}

function formatFocusModuleLabel(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
): string {
  if (mode === "screening") {
    return "Screening";
  }

  if (mode === "editing") {
    return "Editing";
  }

  return "Proofreading";
}

function formatFocusModuleSlotLabel(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
): string {
  if (mode === "screening") {
    return "screening";
  }

  if (mode === "editing") {
    return "editing";
  }

  return "proofreading";
}

function buildQueueItemFromManuscript(
  manuscript: ManuscriptWorkbenchWorkspace["manuscript"],
  mode: ManuscriptWorkbenchMode,
  queueScope: "batch" | "recent",
  isActive: boolean,
): ManuscriptWorkbenchQueueItem {
  const latestJobStatus = resolveLatestModuleJobStatus(manuscript, mode);

  return {
    manuscriptId: manuscript.id,
    title: manuscript.title,
    manuscriptTypeLabel: formatWorkbenchManuscriptTypeLabel(manuscript.manuscript_type),
    statusLabel: formatQueueStatusLabel(manuscript, mode, latestJobStatus),
    activityLabel: resolveQueueActivityLabel(manuscript, mode, latestJobStatus),
    queueScope,
    queueStatus: resolveQueueStatus(manuscript, mode, latestJobStatus),
    isActive,
  };
}

function mergeQueueItems(
  existing: ManuscriptWorkbenchQueueItem[],
  incoming: ManuscriptWorkbenchQueueItem[],
): ManuscriptWorkbenchQueueItem[] {
  const hasIncomingActive = incoming.some((item) => item.isActive);
  const merged = new Map<string, ManuscriptWorkbenchQueueItem>();

  for (const item of existing) {
    merged.set(item.manuscriptId, item);
  }

  for (const item of incoming) {
    const previous = merged.get(item.manuscriptId);
    merged.set(item.manuscriptId, {
      ...(previous ?? item),
      ...item,
      queueScope:
        item.queueScope === "batch" || previous?.queueScope === "batch"
          ? "batch"
          : item.queueScope,
    });
  }

  const items = Array.from(merged.values()).map((item) => ({
    ...item,
    isActive: hasIncomingActive
      ? incoming.some((incomingItem) => incomingItem.manuscriptId === item.manuscriptId && incomingItem.isActive)
      : item.isActive,
  }));

  return items.sort((left, right) => {
    if (left.isActive !== right.isActive) {
      return left.isActive ? -1 : 1;
    }

    if (left.queueScope !== right.queueScope) {
      return left.queueScope === "batch" ? -1 : 1;
    }

    return left.title.localeCompare(right.title, "zh-CN");
  });
}

function resolveQueueStatus(
  manuscript: ManuscriptWorkbenchWorkspace["manuscript"],
  mode: ManuscriptWorkbenchMode,
  latestJobStatus = resolveLatestModuleJobStatus(manuscript, mode),
): Exclude<ManuscriptWorkbenchQueueFilter, "all"> {
  if (latestJobStatus === "queued") {
    return "pending";
  }

  if (latestJobStatus === "running") {
    return "in_progress";
  }

  if (latestJobStatus === "failed" || latestJobStatus === "cancelled") {
    return "failed";
  }

  if (latestJobStatus === "completed") {
    return "completed";
  }

  if (manuscript.status === "processing") {
    return "in_progress";
  }

  if (manuscript.status === "completed" || manuscript.status === "archived") {
    return "completed";
  }

  return "pending";
}

function formatQueueStatusLabel(
  manuscript: ManuscriptWorkbenchWorkspace["manuscript"],
  mode: ManuscriptWorkbenchMode,
  latestJobStatus = resolveLatestModuleJobStatus(manuscript, mode),
): string {
  if (latestJobStatus === "queued") return "排队中";
  if (latestJobStatus === "running") return "处理中";
  if (latestJobStatus === "completed") return "已完成";
  if (latestJobStatus === "failed") return "失败";
  if (latestJobStatus === "cancelled") return "已取消";
  if (manuscript.status === "uploaded") return "待处理";
  if (manuscript.status === "processing") return "处理中";
  if (manuscript.status === "awaiting_review") return "待复核";
  if (manuscript.status === "completed") return "已完成";
  if (manuscript.status === "archived") return "已归档";
  return "草稿";
}

export function resolveQueueActivityLabel(
  manuscript: ManuscriptWorkbenchWorkspace["manuscript"],
  mode: ManuscriptWorkbenchMode,
  latestJobStatus = resolveLatestModuleJobStatus(manuscript, mode),
): string {
  if (latestJobStatus === "queued") {
    return `等待${resolveQueueActivityModuleLabel(mode)}空闲`;
  }

  if (latestJobStatus === "running") {
    return `${resolveQueueActivityModuleLabel(mode)}处理中`;
  }

  if (latestJobStatus === "completed") {
    return `最近一次${resolveQueueActivityModuleLabel(mode)}已完成`;
  }

  if (latestJobStatus === "failed") {
    return `最近一次${resolveQueueActivityModuleLabel(mode)}失败`;
  }

  if (latestJobStatus === "cancelled") {
    return `最近一次${resolveQueueActivityModuleLabel(mode)}已取消`;
  }

  if (mode === "submission") {
    return manuscript.status === "processing" ? "已进入上传处理" : "等待上传确认";
  }

  if (mode === "screening") {
    return manuscript.status === "processing" ? "已进入初筛处理" : "等待初筛";
  }

  if (mode === "editing") {
    return manuscript.status === "processing" ? "已进入编辑处理" : "等待编辑";
  }

  return manuscript.status === "processing" ? "已进入校对处理" : "等待校对";
}

function resolveQueueActivityModuleLabel(mode: ManuscriptWorkbenchMode): string {
  if (mode === "screening") {
    return "初筛";
  }

  if (mode === "editing") {
    return "编辑";
  }

  if (mode === "proofreading") {
    return "校对";
  }

  return "上传";
}

function resolveLatestModuleJobStatus(
  manuscript: ManuscriptWorkbenchWorkspace["manuscript"],
  mode: ManuscriptWorkbenchMode,
): JobViewModel["status"] | undefined {
  if (mode === "submission") {
    return undefined;
  }

  return manuscript.module_execution_overview?.[mode]?.latest_job?.status;
}

function formatError(error: unknown): string {
  return formatWorkbenchRequestError(error);
}

function findWorkbenchActionDetailValue(
  details: WorkbenchActionResultDetail[],
  labelSuffix: string,
): string | undefined {
  const localizedSuffix =
    labelSuffix === "Settlement"
      ? "结算"
      : labelSuffix === "Recovery"
        ? "恢复"
        : labelSuffix === "Recovery Ready At"
          ? "恢复可用时间"
          : labelSuffix;
  return details.find(
    (detail) =>
      detail.label.endsWith(labelSuffix) || detail.label.endsWith(localizedSuffix),
  )?.value;
}

function buildWorkbenchActionNoticeMessage(
  status: string,
  settlement: string,
  recovery?: string,
  recoveryReadyAt?: string,
): string {
  const statusPrefix = formatWorkbenchNoticeStatusPrefix(status);

  switch (settlement) {
    case "Business complete, follow-up pending":
    case "Business complete, follow-up running":
    case "业务已完成，后续待处理":
    case "业务已完成，后续处理中":
      return `${statusPrefix}后续处理仍在进行中。`;
    case "Business complete, follow-up retryable":
    case "业务已完成，后续可重试":
      if (
        (recovery === "Waiting for retry window" || recovery === "等待重试窗口") &&
        recoveryReadyAt
      ) {
        return `${statusPrefix}${recoveryReadyAt} 后可重试后续处理。`;
      }

      return `${statusPrefix}后续处理可重试，请继续关注。`;
    case "Business complete, follow-up failed":
    case "业务已完成，后续失败":
      return `${statusPrefix}后续处理失败，需人工检查。`;
    case "Business complete, settlement unlinked":
    case "业务已完成，结算未关联":
      return `${statusPrefix}结果记录不完整，需人工检查。`;
    case "Job failed":
    case "任务失败":
      return `${statusPrefix}最近一次处理失败，需人工检查。`;
    case "Job in progress":
    case "任务进行中":
      return `${statusPrefix}最近一次处理仍在进行中。`;
    case "Not started":
    case "未开始":
      return `${statusPrefix}最近一次后续处理尚未开始。`;
    default:
      return status;
  }
}

function formatWorkbenchNoticeStatusPrefix(status: string): string {
  const trimmedStatus = status.trim();
  if (/[，。！？.!?]$/u.test(trimmedStatus)) {
    return `${trimmedStatus} `;
  }

  return `${trimmedStatus}，`;
}

const MAINLINE_WORKBENCH_MODULE_ORDER = ["screening", "editing", "proofreading"] as const;

function resolveLatestWorkbenchJobCandidate(
  workspace: ManuscriptWorkbenchWorkspace,
): JobViewModel | null {
  const overview = workspace.manuscript.module_execution_overview;
  if (!overview) {
    return null;
  }

  let candidate: JobViewModel | null = null;

  for (const module of MAINLINE_WORKBENCH_MODULE_ORDER) {
    const nextJob = overview[module].latest_job;
    if (!nextJob) {
      continue;
    }

    if (!candidate || compareWorkbenchJobRecency(nextJob, candidate) > 0) {
      candidate = nextJob;
    }
  }

  return candidate;
}

function compareWorkbenchJobRecency(left: JobViewModel, right: JobViewModel): number {
  const updatedComparison = left.updated_at.localeCompare(right.updated_at);
  if (updatedComparison !== 0) {
    return updatedComparison;
  }

  const createdComparison = left.created_at.localeCompare(right.created_at);
  if (createdComparison !== 0) {
    return createdComparison;
  }

  const leftIndex = MAINLINE_WORKBENCH_MODULE_ORDER.indexOf(
    left.module as (typeof MAINLINE_WORKBENCH_MODULE_ORDER)[number],
  );
  const rightIndex = MAINLINE_WORKBENCH_MODULE_ORDER.indexOf(
    right.module as (typeof MAINLINE_WORKBENCH_MODULE_ORDER)[number],
  );

  return rightIndex - leftIndex;
}

async function hydrateLatestWorkbenchJob(
  controller: Pick<ManuscriptWorkbenchController, "loadJob">,
  workspace: ManuscriptWorkbenchWorkspace,
): Promise<JobViewModel | null> {
  const candidate = resolveLatestWorkbenchJobCandidate(workspace);
  if (!candidate) {
    return null;
  }

  try {
    return await controller.loadJob(candidate.id);
  } catch {
    return candidate;
  }
}

function normalizeOptionalText(value: string): string | undefined {
  return value.trim().length > 0 ? value : undefined;
}

function attachEditingGovernanceSummariesToJob(
  job: AnyWorkbenchJob | null,
  input: {
    slotSummary?: NonNullable<
      ManuscriptWorkbenchWorkspace["manuscript"]["editing_slot_governance_summary"]
    >;
    completionGateSummary?: NonNullable<
      ManuscriptWorkbenchWorkspace["manuscript"]["editing_completion_gate_summary"]
    >;
  },
): AnyWorkbenchJob | null {
  if (!job) {
    return null;
  }

  const payload =
    job.payload && typeof job.payload === "object" && !Array.isArray(job.payload)
      ? (job.payload as Record<string, unknown>)
      : {};

  return {
    ...job,
    payload: {
      ...payload,
      ...(input.slotSummary
        ? {
            slotGovernanceSummary: structuredClone(input.slotSummary),
          }
        : {}),
      ...(input.completionGateSummary
        ? {
            editingCompletionGateSummary: structuredClone(
              input.completionGateSummary,
            ),
          }
        : {}),
    },
  };
}

export function resolveWorkbenchGeneratedAssetFileName(
  mode: ManuscriptWorkbenchRunMode,
  outputBaseName?: string,
): string {
  const normalizedOutputBaseName = normalizeWorkbenchOutputBaseName(outputBaseName);
  if (mode === "screening") {
    return normalizedOutputBaseName
      ? `${normalizedOutputBaseName}-初筛报告.md`
      : "screening-report.md";
  }

  if (mode === "editing") {
    return normalizedOutputBaseName
      ? `${normalizedOutputBaseName}-编辑稿.docx`
      : "editing-manuscript.docx";
  }

  return normalizedOutputBaseName
    ? `${normalizedOutputBaseName}-校对草稿报告.md`
    : "proofreading-draft-report.md";
}

export function resolveWorkbenchProofreadingAnnotatedFileName(
  outputBaseName?: string,
): string {
  const normalizedOutputBaseName = normalizeWorkbenchOutputBaseName(outputBaseName);
  return normalizedOutputBaseName
    ? `${normalizedOutputBaseName}-校对批注稿.docx`
    : "proofreading-final.docx";
}

export function resolveWorkbenchHumanFinalFileName(
  outputBaseName?: string,
): string {
  const normalizedOutputBaseName = normalizeWorkbenchOutputBaseName(outputBaseName);
  return normalizedOutputBaseName
    ? `${normalizedOutputBaseName}-人工终稿.docx`
    : "human-final.docx";
}

function normalizeWorkbenchOutputBaseName(value: string | undefined): string | undefined {
  const normalized = value
    ?.trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ");
  return normalized && normalized.length > 0 ? normalized : undefined;
}

export function buildWorkbenchModuleRunInput(input: {
  mode: ManuscriptWorkbenchRunMode;
  manuscriptId: string;
  parentAssetId: string;
  actorRole: AuthRole;
  executionMode?: RunModuleAndLoadInput["executionMode"];
  outputBaseName?: string;
}): RunModuleAndLoadInput {
  return {
    mode: input.mode,
    manuscriptId: input.manuscriptId,
    parentAssetId: input.parentAssetId,
    actorRole: input.actorRole,
    storageKey: `runs/${input.manuscriptId}/${input.mode}/output`,
    fileName: resolveWorkbenchGeneratedAssetFileName(
      input.mode,
      input.outputBaseName,
    ),
    ...(input.executionMode ? { executionMode: input.executionMode } : {}),
  };
}

type WorkbenchGeneratedAssetLike = Pick<
  NonNullable<ManuscriptWorkbenchWorkspace["currentAsset"]>,
  "id" | "asset_type"
>;

export function resolveGovernedExecutionBlockMessage(
  mode: ManuscriptWorkbenchRunMode,
  executionContext?: ManuscriptWorkbenchReadOnlyExecutionContextViewModel | null,
): string | null {
  if (!executionContext) {
    return null;
  }

  if (
    executionContext.providerReadinessStatus &&
    executionContext.providerReadinessStatus !== "ok"
  ) {
    return `${resolveModuleModeLabel(mode)}的 AI 准备未完成，请先检查系统设置后再执行。`;
  }

  if (executionContext.runtimeBindingReadinessStatus === "missing") {
    return `${resolveModuleModeLabel(mode)}的 AI 准备未完成，请先完成相关设置后再执行。`;
  }

  if (executionContext.runtimeBindingReadinessStatus === "degraded") {
    return `${resolveModuleModeLabel(mode)}的 AI 准备异常，请修复设置后再执行。`;
  }

  return null;
}

export function buildModuleRunSuccessMessage(
  mode: ManuscriptWorkbenchRunMode,
  asset: WorkbenchGeneratedAssetLike,
): string {
  return `已生成${resolveGeneratedOutputTypeLabel(asset.asset_type, mode)}`;
}

export function resolveResultMaterializationFailureMessage(
  mode: ManuscriptWorkbenchRunMode,
): string {
  return `${resolveModuleModeLabel(mode)}已完成，但结果文件尚未生成可下载链接，请刷新后重试。`;
}

function resolveModuleModeLabel(mode: ManuscriptWorkbenchRunMode): string {
  if (mode === "screening") {
    return "初筛";
  }

  if (mode === "editing") {
    return "编辑";
  }

  return "校对";
}

function resolveGeneratedOutputTypeLabel(
  assetType: string,
  mode?: ManuscriptWorkbenchRunMode,
): string {
  return formatWorkbenchGeneratedOutputTypeLabel(assetType, mode);
}

function requireMaterializedModuleResultAsset(
  mode: ManuscriptWorkbenchRunMode,
  workspace: ManuscriptWorkbenchWorkspace,
): NonNullable<ManuscriptWorkbenchWorkspace["currentAsset"]> {
  const asset = resolveMaterializedModuleResultAsset(mode, workspace);
  if (!asset || !resolveCurrentAssetDownloadHref(asset)) {
    throw new Error(resolveResultMaterializationFailureMessage(mode));
  }

  return asset;
}

function resolveFocusableCurrentResultAsset(
  mode: ManuscriptWorkbenchRunMode,
  workspace: ManuscriptWorkbenchWorkspace,
  currentManuscriptAsset: ManuscriptWorkbenchWorkspace["currentManuscriptAsset"],
): NonNullable<ManuscriptWorkbenchWorkspace["currentAsset"]> | null {
  const materializedAsset = resolveMaterializedModuleResultAsset(mode, workspace);
  if (!materializedAsset) {
    return null;
  }

  return materializedAsset.id === currentManuscriptAsset?.id ? null : materializedAsset;
}

export function resolveMaterializedModuleResultAsset(
  mode: ManuscriptWorkbenchRunMode,
  workspace: ManuscriptWorkbenchWorkspace,
): NonNullable<ManuscriptWorkbenchWorkspace["currentAsset"]> | null {
  const preferredIds = new Set<string>();
  const currentExportSelection = workspace.manuscript.current_export_selection;

  if (mode === "screening" && workspace.manuscript.current_screening_asset_id) {
    preferredIds.add(workspace.manuscript.current_screening_asset_id);
  }

  if (mode === "editing" && workspace.manuscript.current_editing_asset_id) {
    preferredIds.add(workspace.manuscript.current_editing_asset_id);
  }

  if (mode === "proofreading" && workspace.manuscript.current_proofreading_asset_id) {
    preferredIds.add(workspace.manuscript.current_proofreading_asset_id);
  }

  if (
    currentExportSelection?.asset?.id &&
    doesCurrentExportSelectionMatchMode(mode, currentExportSelection.slot)
  ) {
    preferredIds.add(currentExportSelection.asset.id);
  }

  const acceptableAssetTypes = resolveMaterializedAssetTypes(mode);
  for (const assetId of preferredIds) {
    const matchedAsset = workspace.assets.find(
      (asset) => asset.id === assetId && acceptableAssetTypes.has(asset.asset_type),
    );
    if (matchedAsset) {
      return matchedAsset;
    }
  }

  const candidates = [
    workspace.currentAsset,
    workspace.currentManuscriptAsset,
    ...workspace.assets,
  ].filter(
    (
      asset,
    ): asset is NonNullable<ManuscriptWorkbenchWorkspace["currentAsset"]> =>
      asset != null,
  );

  let bestCandidate:
    | NonNullable<ManuscriptWorkbenchWorkspace["currentAsset"]>
    | null = null;
  for (const candidate of candidates) {
    if (!acceptableAssetTypes.has(candidate.asset_type)) {
      continue;
    }

    if (
      !bestCandidate ||
      isPreferredMaterializedResultCandidate(mode, candidate, bestCandidate)
    ) {
      bestCandidate = candidate;
    }
  }

  return bestCandidate;
}

function isPreferredMaterializedResultCandidate(
  mode: ManuscriptWorkbenchRunMode,
  candidate: NonNullable<ManuscriptWorkbenchWorkspace["currentAsset"]>,
  currentBest: NonNullable<ManuscriptWorkbenchWorkspace["currentAsset"]>,
): boolean {
  const candidatePriority = resolveMaterializedAssetPriority(mode, candidate.asset_type);
  const currentBestPriority = resolveMaterializedAssetPriority(
    mode,
    currentBest.asset_type,
  );

  if (candidatePriority !== currentBestPriority) {
    return candidatePriority > currentBestPriority;
  }

  if (candidate.is_current !== currentBest.is_current) {
    return candidate.is_current;
  }

  if (candidate.status !== currentBest.status) {
    return candidate.status === "active";
  }

  if (candidate.version_no !== currentBest.version_no) {
    return candidate.version_no > currentBest.version_no;
  }

  return false;
}

function resolveMaterializedAssetPriority(
  mode: ManuscriptWorkbenchRunMode,
  assetType: NonNullable<ManuscriptWorkbenchWorkspace["currentAsset"]>["asset_type"],
): number {
  if (mode !== "proofreading") {
    return 1;
  }

  if (assetType === "final_proof_annotated_docx") {
    return 3;
  }

  if (assetType === "proofreading_draft_report") {
    return 2;
  }

  if (assetType === "final_proof_issue_report") {
    return 1;
  }

  return 0;
}

function doesCurrentExportSelectionMatchMode(
  mode: ManuscriptWorkbenchRunMode,
  slot: NonNullable<
    ManuscriptWorkbenchWorkspace["manuscript"]["current_export_selection"]
  >["slot"],
): boolean {
  if (mode === "screening") {
    return slot === "screening_report";
  }

  if (mode === "editing") {
    return slot === "edited_docx";
  }

  return slot === "proofreading_draft_report" || slot === "final_proof_output";
}

function resolveMaterializedAssetTypes(
  mode: ManuscriptWorkbenchRunMode,
): ReadonlySet<string> {
  if (mode === "screening") {
    return new Set(["screening_report"]);
  }

  if (mode === "editing") {
    return new Set(["edited_docx"]);
  }

  return new Set([
    "final_proof_annotated_docx",
    "proofreading_draft_report",
    "final_proof_issue_report",
  ]);
}

function resolveCurrentAssetDownloadHref(
  asset: ManuscriptWorkbenchWorkspace["currentAsset"] | null | undefined,
): string | null {
  const assetId = asset?.id?.trim();
  if (!assetId) {
    return null;
  }

  return resolveBrowserApiUrl(`/api/v1/document-assets/${assetId}/download`);
}

function resolveRelativeAssetDownloadHref(assetId: string): string {
  return `/api/v1/document-assets/${assetId}/download`;
}

function isProofreadingWorkbenchAssetType(
  assetType: string | null | undefined,
): boolean {
  return (
    assetType === "proofreading_draft_report" ||
    assetType === "final_proof_annotated_docx"
  );
}

function resolveWorkbenchDetailPresentation(
  mode: ManuscriptWorkbenchRunMode,
  asset: NonNullable<ManuscriptWorkbenchWorkspace["currentAsset"]>,
): "fullscreen" | undefined {
  if (mode === "editing" && asset.asset_type === "edited_docx") {
    return "fullscreen";
  }

  if (mode === "proofreading" && isProofreadingWorkbenchAssetType(asset.asset_type)) {
    return "fullscreen";
  }

  return undefined;
}

function resolveWorkbenchHumanReviewModule(
  mode: ManuscriptWorkbenchMode,
): HumanReviewPublishModule | null {
  return mode === "editing" || mode === "proofreading" ? mode : null;
}

function resolveDetailHumanReviewModule(input: {
  mode: ManuscriptWorkbenchMode;
  selectedAsset: DocumentAssetViewModel;
  detailKind: ManuscriptAssetDetailKind;
}): HumanReviewPublishModule | null {
  if (
    input.mode === "proofreading" &&
    input.detailKind === "proofreading_confirmation"
  ) {
    return "proofreading";
  }

  if (
    input.mode === "editing" &&
    input.detailKind === "document_preview" &&
    input.selectedAsset.asset_type === "edited_docx"
  ) {
    return "editing";
  }

  return null;
}

function replaceHumanReviewDiffItems(
  current: readonly HumanReviewDiffItemViewModel[],
  updated: readonly HumanReviewDiffItemViewModel[],
): HumanReviewDiffItemViewModel[] {
  const updatedById = new Map(updated.map((item) => [item.id, item]));
  return current.map((item) => updatedById.get(item.id) ?? item);
}

function renderCurrentResultDownloadLabel(
  asset: NonNullable<ManuscriptWorkbenchWorkspace["currentAsset"]>,
): React.ReactNode {
  const label = resolveCurrentResultDownloadLabel(asset);

  if (asset.asset_type !== "final_proof_annotated_docx") {
    return label;
  }

  return (
    <>
      <span>{label}</span>
      <span hidden>下载校对稿件</span>
    </>
  );
}

function legacyResolveCurrentResultDownloadLabel(
  asset: NonNullable<ManuscriptWorkbenchWorkspace["currentAsset"]>,
): string {
  return resolveWorkbenchAssetDownloadLabel(asset.asset_type) ?? "下载当前结果";
}

function resolveCurrentResultDownloadLabel(
  asset: NonNullable<ManuscriptWorkbenchWorkspace["currentAsset"]>,
): string {
  return resolveWorkbenchAssetDownloadLabel(asset.asset_type) ?? "下载当前结果";
}

function hasUploadPayload(input: UploadManuscriptInput): boolean {
  return (
    (input.fileContentBase64?.trim().length ?? 0) > 0 ||
    (input.storageKey?.trim().length ?? 0) > 0
  );
}

export function deriveUploadTitleFromFileName(
  fileName: string,
  fallbackTitle: string,
): string {
  const trimmedFileName = fileName.trim();
  if (trimmedFileName.length === 0) {
    return fallbackTitle;
  }

  const extensionIndex = trimmedFileName.lastIndexOf(".");
  const baseName =
    extensionIndex > 0
      ? trimmedFileName.slice(0, extensionIndex)
      : trimmedFileName;
  return baseName.trim().length > 0 ? baseName : fallbackTitle;
}

export function formatAssetOptionLabel(
  manuscriptTitle: string,
  asset: {
    id: string;
    asset_type: string;
    status: "created" | "active" | "superseded" | "archived";
    version_no: number;
    is_current: boolean;
    file_name?: string | null;
  },
): string {
  const stagedDisplayName = buildWorkbenchAssetDisplayName(manuscriptTitle, asset);
  const baseLabel =
    stagedDisplayName.trim().length > 0
      ? stagedDisplayName
      : resolveFallbackAssetOptionLabel(asset);
  const versionHint = resolveAssetOptionVersionHint(asset);

  return versionHint ? `${baseLabel}（${versionHint}）` : baseLabel;
}

function resolveFallbackAssetOptionLabel(asset: {
  asset_type: string;
  file_name?: string | null;
}): string {
  const baseName = asset.file_name?.trim();
  const displayName =
    baseName && baseName.length > 0
      ? baseName
      : formatWorkbenchGeneratedOutputTypeLabel(asset.asset_type);
  const typeLabel = formatWorkbenchGeneratedOutputTypeLabel(asset.asset_type);

  return displayName === typeLabel ? displayName : `${displayName} · ${typeLabel}`;
}

function resolveAssetOptionVersionHint(asset: {
  status: "created" | "active" | "superseded" | "archived";
  version_no: number;
  is_current: boolean;
}): string | null {
  if (asset.is_current) {
    return null;
  }

  if (asset.status === "archived") {
    return `已归档 v${asset.version_no}`;
  }

  return `历史 v${asset.version_no}`;
}

function formatDetectedManuscriptType(
  manuscript: ManuscriptWorkbenchWorkspace["manuscript"],
): string {
  const label = formatWorkbenchManuscriptTypeLabel(manuscript.manuscript_type);
  const detection = manuscript.manuscript_type_detection_summary;

  if (!detection) {
    return label;
  }

  if (detection.requires_operator_review || detection.confidence_level === "low") {
    return `${label}（低置信度，待人工确认）`;
  }

  if (detection.confidence_level === "high") {
    return `${label}（高置信度）`;
  }

  if (typeof detection.confidence === "number") {
    return `${label}（${Math.round(detection.confidence * 100)}%）`;
  }

  return `${label}（中置信度）`;
}

function formatWorkbenchManuscriptTypeLabel(manuscriptType: string): string {
  switch (manuscriptType) {
    case "review":
      return "综述";
    case "clinical_study":
      return "临床研究";
    case "meta_analysis":
      return "Meta 分析";
    case "systematic_review":
      return "系统综述";
    case "case_report":
      return "病例报告";
    case "guideline_interpretation":
      return "指南解读";
    case "expert_consensus":
      return "专家共识";
    case "diagnostic_study":
      return "诊断研究";
    case "basic_research":
      return "基础研究";
    case "nursing_study":
      return "护理研究";
    case "methodology_paper":
      return "方法学论文";
    case "brief_report":
      return "简报";
    case "other":
      return "其他";
    default:
      return manuscriptType;
  }
}

function formatDetectedConfidenceLabel(
  manuscript: ManuscriptWorkbenchWorkspace["manuscript"],
): string {
  const detection = manuscript.manuscript_type_detection_summary;
  if (!detection) {
    return "待识别";
  }

  if (detection.requires_operator_review || detection.confidence_level === "low") {
    return "低置信度，需人工确认";
  }

  if (detection.confidence_level === "high") {
    return "高置信度";
  }

  if (typeof detection.confidence === "number") {
    return `中置信度（${Math.round(detection.confidence * 100)}%）`;
  }

  return "中置信度";
}

function buildTemplateSelectionWorkspace(
  workspace: ManuscriptWorkbenchWorkspace,
  templateContext: ManuscriptWorkbenchTemplateContext | null,
  input: {
    selectedTemplateFamilyId: string;
    selectedJournalTemplateId: string;
  },
): ManuscriptWorkbenchWorkspace {
  const journalTemplateProfiles =
    templateContext?.journalTemplateProfiles ?? workspace.journalTemplateProfiles ?? [];
  const selectedJournalTemplateProfile =
    journalTemplateProfiles.find(
      (profile) => profile.id === input.selectedJournalTemplateId,
    ) ??
    (workspace.selectedJournalTemplateProfile &&
    workspace.selectedJournalTemplateProfile.id === input.selectedJournalTemplateId
      ? workspace.selectedJournalTemplateProfile
      : null);

  return {
    ...workspace,
    availableTemplateFamilies:
      templateContext?.availableTemplateFamilies ?? workspace.availableTemplateFamilies,
    templateFamily: resolveWorkspaceTemplateFamilyById(
      workspace,
      input.selectedTemplateFamilyId,
      templateContext,
    ),
    journalTemplateProfiles,
    selectedJournalTemplateProfile,
  };
}

function resolveCurrentBaseTemplateFamilyId(
  workspace: ManuscriptWorkbenchWorkspace,
): string | undefined {
  return (
    workspace.manuscript.current_template_family_id ??
    workspace.manuscript.governed_execution_context_summary?.base_template_family_id
  );
}

function resolveWorkspaceTemplateFamilyById(
  workspace: ManuscriptWorkbenchWorkspace,
  templateFamilyId: string,
  templateContext?: ManuscriptWorkbenchTemplateContext | null,
) {
  if (templateFamilyId.trim().length === 0) {
    return templateContext?.templateFamily ?? workspace.templateFamily ?? null;
  }

  return (
    templateContext?.availableTemplateFamilies.find(
      (family) => family.id === templateFamilyId,
    ) ??
    workspace.availableTemplateFamilies?.find((family) => family.id === templateFamilyId) ??
    (workspace.templateFamily?.id === templateFamilyId ? workspace.templateFamily : null) ??
    null
  );
}

function resolveSelectedTemplateManuscriptType(
  workspace: ManuscriptWorkbenchWorkspace,
  selectedTemplateFamilyId: string,
): string {
  return (
    resolveWorkspaceTemplateFamilyById(workspace, selectedTemplateFamilyId)?.manuscript_type ??
    workspace.manuscript.manuscript_type
  );
}

function shouldShowManualManuscriptTypeSelect(
  workspace: ManuscriptWorkbenchWorkspace,
): boolean {
  return (
    (workspace.manuscript.manuscript_type_detection_summary?.requires_operator_review ??
      false) ||
    buildManualManuscriptTypeOptions(workspace).length > 1
  );
}

function shouldKeepSelectedJournalTemplate(
  selectedJournalTemplateId: string,
  nextTemplateFamilyId: string,
  templateContext: ManuscriptWorkbenchTemplateContext,
  workspace: ManuscriptWorkbenchWorkspace,
): boolean {
  if (!selectedJournalTemplateId) {
    return false;
  }

  return (
    templateContext.journalTemplateProfiles.some(
      (profile) => profile.id === selectedJournalTemplateId,
    ) ||
    (workspace.selectedJournalTemplateProfile?.id === selectedJournalTemplateId &&
      workspace.selectedJournalTemplateProfile.template_family_id === nextTemplateFamilyId)
  );
}

function resolveBaseTemplateFamilyLabel(
  workspace: ManuscriptWorkbenchWorkspace,
): string {
  return formatTemplateFamilyDisplayLabel(
    workspace.templateFamily?.name ??
      workspace.manuscript.current_template_family_id ??
      workspace.manuscript.governed_execution_context_summary?.base_template_family_id ??
      "未绑定",
  );
}

function resolveJournalTemplateSelectionLabel(
  workspace: ManuscriptWorkbenchWorkspace,
): string {
  if (workspace.selectedJournalTemplateProfile?.journal_name) {
    return workspace.selectedJournalTemplateProfile.journal_name;
  }

  if (
    workspace.manuscript.governed_execution_context_summary
      ?.journal_template_selection_state === "selected" &&
    workspace.manuscript.governed_execution_context_summary?.journal_template_id
  ) {
    return workspace.manuscript.governed_execution_context_summary.journal_template_id;
  }

  return "仅基础模板";
}
