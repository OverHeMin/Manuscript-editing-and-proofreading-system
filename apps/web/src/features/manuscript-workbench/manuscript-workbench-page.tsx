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
import {
  MAX_MANUSCRIPT_BATCH_UPLOAD_COUNT,
  retryProofreadingDeepPassRun,
} from "../manuscripts/index.ts";
import type { ModuleJobViewModel } from "../screening/index.ts";
import type {
  ProofreadingConfirmationDecisionAction,
  ProofreadingConfirmationDecisionInput,
} from "../proofreading/index.ts";
import {
  ManuscriptWorkbenchControls,
  type ManuscriptWorkbenchActionPanelProps,
  type ManuscriptWorkbenchIntakePanelProps,
  type ManuscriptWorkbenchLookupPanelProps,
  type ManuscriptWorkbenchTemplateSelectionPanelProps,
  type ManuscriptWorkbenchUtilitiesPanelProps,
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
import { ManuscriptWorkbenchCurrentCard } from "./manuscript-workbench-current-card.tsx";
import { Progress } from "@/components/ui/progress";
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
  buildProofreadingConfirmationItems,
  buildProofreadingDeepPassAuditRuns,
  buildProofreadingLayerMatrix,
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
const BARE_AI_ACTION_DISPLAY_LABEL = "AI 自动处理（本次）";
const LEGACY_BARE_AI_ACTION_LABEL = "AI 自动处理（本次）";
const WORKBENCH_QUEUE_CACHE_KEY = "medsys.manuscript-workbench.recent-manuscripts.v1";

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
  presentation?: "default" | "fullscreen";
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
          label: "\u4ea7\u51fa\u7c7b\u578b",
          value: resolveGeneratedOutputTypeLabel(
            input.publishedAsset.asset_type,
            "proofreading",
          ),
        },
        ...(confirmationSummary
          ? [
              {
                label: "\u786e\u8ba4\u6761\u76ee",
                value: String(confirmationSummary.totalItems),
              },
              {
                label: "\u5199\u5165\u7ec8\u7a3f",
                value: String(confirmationSummary.acceptedIntoManuscriptCount),
              },
              {
                label: "\u62d2\u7edd",
                value: String(confirmationSummary.rejectedCount),
              },
              {
                label: "\u89c4\u5219\u5019\u9009",
                value: String(confirmationSummary.routedRuleCandidateCount),
              },
              {
                label: "\u77e5\u8bc6\u5019\u9009",
                value: String(confirmationSummary.routedKnowledgeCandidateCount),
              },
              {
                label: "\u4ec5\u4eba\u5de5\u5904\u7406",
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
      title: "\u64cd\u4f5c\u5931\u8d25",
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
      title: "\u64cd\u4f5c\u5df2\u5b8c\u6210",
      message: localizedFallbackMessage,
    };
  }

  if (
    input.latestActionResult.actionLabel === "Upload Manuscript" ||
    fallbackMessage.startsWith("Uploaded manuscript ")
  ) {
    return {
      tone: "success",
      title: "\u64cd\u4f5c\u5df2\u5b8c\u6210",
      message: localizedFallbackMessage,
    };
  }

  const settlement = findWorkbenchActionDetailValue(input.latestActionResult.details, "Settlement");
  if (!settlement || settlement === "Settled" || settlement === "已结算") {
    return {
      tone: "success",
      title: "\u64cd\u4f5c\u5df2\u5b8c\u6210",
      message: localizedFallbackMessage,
    };
  }

  return {
    tone: "success",
    title: "\u64cd\u4f5c\u5df2\u8bb0\u5f55",
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
const proofreadingPassRetryClient = createBrowserHttpClient();

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

    if (!draft.action && !editedReplacementText && !note) {
      continue;
    }

    next[item.itemId] = {
      ...(draft.action ? { action: draft.action } : {}),
      ...(editedReplacementText ? { editedReplacementText } : {}),
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

    return [
      {
        itemId: item.itemId,
        targetText: item.targetText,
        replacementText: item.replacementText,
        action: draft.action,
        ...(editedReplacementText ? { editedReplacementText } : {}),
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

  return savedDecisionCount > 0 ? `??? ${savedDecisionCount} ?` : "";
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
    comments: buildAssetPreviewComments({
      asset: input.selectedAsset,
      job: input.detailJob,
    }),
  };
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
  presentation = "default",
  prefilledReviewedCaseSnapshotId,
  prefilledSampleSetItemId,
  accessibleHandoffModes,
  canOpenLearningReview = false,
  canOpenEvaluationWorkbench = false,
}: ManuscriptWorkbenchPageProps) {
  const canUpload = mode === "submission" || actorRole === "admin";
  const normalizedPrefilledManuscriptId = prefilledManuscriptId?.trim() ?? "";
  const normalizedPrefilledAssetId = prefilledAssetId?.trim() ?? "";
  const normalizedPrefilledReviewedCaseSnapshotId =
    prefilledReviewedCaseSnapshotId?.trim() ?? "";
  const normalizedPrefilledSampleSetItemId = prefilledSampleSetItemId?.trim() ?? "";
  const [lookupId, setLookupId] = useState("");
  const [queueSearch, setQueueSearch] = useState("");
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
  const [retryingProofreadingPassRunId, setRetryingProofreadingPassRunId] =
    useState<string | null>(null);
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
  const [activeQueueFilter, setActiveQueueFilter] =
    useState<ManuscriptWorkbenchQueueFilter>("all");
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
    rememberWorkbenchQueueManuscript(workspace.manuscript);
  }, [workspace]);

  useEffect(() => {
    if (mode === "submission") {
      return;
    }

    let cancelled = false;
    void controller
      .listManuscripts(50)
      .then((manuscripts) => {
        if (cancelled) {
          return;
        }

        setQueueItems((current) =>
          mergeQueueItems(
            current,
            manuscripts.map((manuscript, index) =>
              buildQueueItemFromManuscript(
                manuscript,
                mode,
                "recent",
                workspace?.manuscript.id === manuscript.id,
              ),
            ),
          ),
        );
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        const cachedManuscripts = readRememberedWorkbenchQueueManuscripts();
        setQueueItems((current) =>
          mergeQueueItems(
            current,
            cachedManuscripts.map((manuscript) =>
              buildQueueItemFromManuscript(
                manuscript,
                mode,
                "recent",
                workspace?.manuscript.id === manuscript.id,
              ),
            ),
          ),
        );
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
    setIsConfirmationDraftSaving(false);
    setRetryingProofreadingPassRunId(null);
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
      setIsConfirmationDraftSaving(false);
      setRetryingProofreadingPassRunId(null);
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
      setIsConfirmationDraftSaving(false);
      setActiveProofreadingIssueId("");
      setRetryingProofreadingPassRunId(null);
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

  async function retryProofreadingPassRun(passRunId: string) {
    if (!workspace || retryingProofreadingPassRunId) {
      return;
    }

    setRetryingProofreadingPassRunId(passRunId);
    setError("");
    setDetailError("");
    setStatus("Retrying failed proofreading segments...");

    try {
      await retryProofreadingDeepPassRun(proofreadingPassRetryClient, passRunId);
      const nextWorkspace = await syncWorkspaceConcurrencySnapshot(
        await controller.loadWorkspace(workspace.manuscript.id, {
          actorRole,
          mode: "proofreading",
        }),
      );
      setWorkspace(nextWorkspace);
      const selectedAsset = nextWorkspace.assets.find(
        (asset) => asset.id === selectedAssetId,
      );
      const nextDetailJobAsset = selectedAsset
        ? resolveDetailJobSourceAsset({
            selectedAsset,
            assets: nextWorkspace.assets,
            mode,
          })
        : null;
      const nextDetailJob = nextDetailJobAsset
        ? await hydrateWorkbenchDetailJob(controller, {
            sourceJobId: nextDetailJobAsset.source_job_id,
            latestJob,
          })
        : null;
      setDetailJob(nextDetailJob);
      setStatus("Failed proofreading segments retried. Review the audit card before finalizing.");
    } catch (nextError) {
      const message = formatError(nextError);
      setError(message);
      setLatestActionResult({
        tone: "error",
        actionLabel: "Retry Proofreading Segments",
        message,
        details: [{ label: "Pass Run ID", value: passRunId }],
      });
    } finally {
      setRetryingProofreadingPassRunId(null);
    }
  }

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
          (decisions.length > 0 ? `??? ${decisions.length} ?` : ""),
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
      const message = `瀹歌弓绻氱€涙ɑ蝎娴ｅ秷顥嗛崘绛圭窗${input.slotKey}`;

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
            label: "??",
            value: nextWorkspace.manuscript.id,
          },
          {
            label: "??",
            value: input.slotKey,
          },
          {
            label: "??",
            value:
              input.resolutionKind === "picked_candidate"
                ? "????"
                : input.resolutionKind === "manual_entry"
                  ? "????"
                  : "????",
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
      const message = "??????????";
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

  async function archiveQueueItemFromBench(manuscriptId: string) {
    const confirmed =
      typeof window === "undefined" ||
      window.confirm("????????????");

    if (!confirmed) {
      return;
    }

    await controller.archiveManuscript(manuscriptId);
    setQueueItems((current) =>
      current.filter((item) => item.manuscriptId !== manuscriptId),
    );
    forgetWorkbenchQueueManuscript(manuscriptId);

    if (workspace?.manuscript.id === manuscriptId) {
      setWorkspace(null);
      setLatestJob(null);
      setLatestExport(null);
      setLatestActionResult(null);
      setLookupId("");
      setParentAssetId("");
      setDraftAssetId("");
      setSelectedAssetId("");
      setProofreadingGovernanceHandoff(null);
    }

    setStatus("瀹歌弓绮犻崢鍡楀蕉鐠佹澘缍嶉崚鐘绘珟");
    return {
      tone: "success" as const,
      actionLabel: "??",
      message: "瀹歌弓绮犻崢鍡楀蕉鐠佹澘缍嶉崚鐘绘珟",
      details: [
        {
          label: "??",
          value: manuscriptId,
        },
      ],
    };
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
              ? "???"
              : "???",
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
                throw new Error("????");
              }

              if (attachedUploadFiles.length > MAX_MANUSCRIPT_BATCH_UPLOAD_COUNT) {
                throw new Error(
                  `?????? ${MAX_MANUSCRIPT_BATCH_UPLOAD_COUNT} ???`,
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
                throw new Error("????");
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
          emptyLabel: "鐠囩兘鈧瀚ㄧ挧鍕獓",
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
          emptyLabel: "??",
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
  const isDedicatedProofreadingDetail =
    presentation === "fullscreen" &&
    (detailKind === "proofreading_workspace" ||
      detailKind === "proofreading_confirmation");
  const currentProofreadingAsset =
    mode === "proofreading" && workspace
      ? resolveMaterializedModuleResultAsset("proofreading", workspace)
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
            presentation: "fullscreen",
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
    : "???";
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
  const canSaveConfirmationDraft = canSaveProofreadingConfirmationDraft({
    detailKind,
    assetType: selectedAsset?.asset_type,
  });

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
        ? "??????"
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
            confirmationItems={confirmationItems}
            confirmationState={confirmationState}
            proofreadingPassRuns={buildProofreadingDeepPassAuditRuns(detailJob)}
            proofreadingLayerMatrix={buildProofreadingLayerMatrix(detailJob)}
            retryingProofreadingPassRunId={retryingProofreadingPassRunId}
            onProofreadingPassRunRetry={(passRunId) =>
              void retryProofreadingPassRun(passRunId)
            }
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
                  ...(action !== "accepted_with_manual_edit" &&
                    action !== "accept_and_edit"
                    ? {
                        editedReplacementText: undefined,
                      }
                    : {}),
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
      {presentation !== "fullscreen" && normalizedPrefilledManuscriptId.length > 0 ? (
        <p className="manuscript-workbench-prefill-note">
          鐠囥儱浼愭担婊冨酱瀹稿弶鐗撮幑顔荤瑐娑撯偓閻滎垵濡粙澶告閼奉亜濮╃敮锕€鍙嗛妴?
        </p>
      ) : null}
      {presentation !== "fullscreen" && notice ? (
        <ManuscriptWorkbenchNotice {...notice} />
      ) : null}
      {normalizedPrefilledManuscriptId.length > 0 && isPrefillLoading && !workspace ? (
        <section
          className="manuscript-workbench-loading-card"
          aria-live="polite"
          aria-label="Loading manuscript workspace"
        >
          <div className="manuscript-workbench-loading-copy">
            <span className="manuscript-workbench-loading-eyebrow">
              缁嬪じ娆㈢粔璁虫唉
            </span>
            <h3>濮濓絽婀崝鐘烘祰缁嬪じ娆?..</h3>
            <p>
              濮濓絽婀幏澶婂絿瀹搞儰缍旈崠楦跨カ娴溠傜瑢閺堚偓閺傜増涓嶉悶鍡欏Ц閹緤绱濈€瑰本鍨氶崥搴″祮閸欘垳鎴风紒顓熸惙娴ｆ嚎鈧?
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
          className="manuscript-workbench-detail-focus-shell manuscript-workbench-detail-focus-shell--standalone"
          data-layout="proofreading-detail-focus"
        >
          {detailElement}
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
              searchValue={queueSearch}
              workspace={workspace}
              latestJob={latestJob}
              queueItems={queueItems}
              activeQueueFilter={activeQueueFilter}
              onSearchChange={setQueueSearch}
              onQueueFilterChange={setActiveQueueFilter}
              onOpenQueueItem={(manuscriptId) => {
                setLookupId(manuscriptId);
                void run("Load Workspace", async () => loadWorkspaceIntoBench(manuscriptId));
              }}
              onDeleteQueueItem={(manuscriptId) => {
                void run("Delete History", async () =>
                  archiveQueueItemFromBench(manuscriptId),
                );
              }}
                />
          </div>
          <div
            className="manuscript-workbench-mainline-workspace"
            data-pane="workspace-column"
            data-scroll-pane="workspace"
          >
            <section hidden className="manuscript-workbench-operation-panel" />
            <div data-pane="workspace-stage">
            <ManuscriptWorkbenchSimpleCanvas
              mode={resultPanelMode}
              busy={workbenchBusy}
              workspace={workspace}
              latestJob={latestJob}
              latestActionResult={latestActionResult}
              detectedManuscriptTypeLabel={detectedManuscriptTypeLabel}
              reviewedCaseSnapshotId={normalizedPrefilledReviewedCaseSnapshotId}
              sampleSetItemId={normalizedPrefilledSampleSetItemId}
              intake={intakePanel}
              templateSelection={templateSelectionPanel}
              moduleAction={moduleActionPanel}
              finalizeAction={visibleFinalizeActionPanel}
              utilities={utilitiesPanel}
              detailElement={detailElement}
              advancedSummary={summaryElement}
            />
            </div>
            <section hidden className="manuscript-workbench-result-panel" data-pane="result-stage" />
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

interface ManuscriptWorkbenchSimpleCanvasProps {
  mode: Exclude<ManuscriptWorkbenchMode, "submission">;
  busy: boolean;
  workspace: ManuscriptWorkbenchWorkspace | null;
  latestJob: AnyWorkbenchJob | null;
  latestActionResult: WorkbenchActionResultViewModel | null;
  detectedManuscriptTypeLabel: string;
  reviewedCaseSnapshotId?: string;
  sampleSetItemId?: string;
  intake?: ManuscriptWorkbenchIntakePanelProps;
  templateSelection?: ManuscriptWorkbenchTemplateSelectionPanelProps;
  moduleAction?: ManuscriptWorkbenchActionPanelProps;
  finalizeAction?: ManuscriptWorkbenchActionPanelProps;
  utilities?: ManuscriptWorkbenchUtilitiesPanelProps;
  detailElement?: React.ReactNode;
  advancedSummary?: React.ReactNode;
}

function ManuscriptWorkbenchSimpleCanvas({
  mode,
  busy,
  workspace,
  latestJob,
  latestActionResult,
  detectedManuscriptTypeLabel,
  reviewedCaseSnapshotId,
  sampleSetItemId,
  intake,
  templateSelection,
  moduleAction,
  finalizeAction,
  utilities,
  detailElement,
  advancedSummary,
}: ManuscriptWorkbenchSimpleCanvasProps) {
  if (detailElement) {
    return (
      <section className="manuscript-workbench-simple-canvas" data-simple-stage="detail">
        <a className="manuscript-workbench-simple-back-link" href={buildSimpleWorkbenchBackHref(mode, workspace)}>
          鏉╂柨娲栧銉ょ稊閸?        </a>
        {detailElement}
      </section>
    );
  }

  if (!workspace) {
    return (
      <section className="manuscript-workbench-simple-canvas" data-simple-stage="empty">
        <div className="manuscript-workbench-simple-hero">
          <span>{resolveSimpleModuleTitle(mode)}</span>
          <h2>{resolveSimpleEmptyTitle(mode)}</h2>
          <p>{resolveSimpleEmptyDescription(mode)}</p>
        </div>
        {intake ? <SimpleIntakePanel busy={busy} intake={intake} /> : null}
      </section>
    );
  }

  const currentManuscriptAsset =
    workspace.currentManuscriptAsset ?? workspace.currentAsset ?? null;
  const currentResultAsset = resolveMaterializedModuleResultAsset(mode, workspace);
  const currentManuscriptPreviewHref = currentManuscriptAsset
    ? buildWorkbenchAssetDetailHref({
        mode,
        manuscriptId: workspace.manuscript.id,
        assetId: currentManuscriptAsset.id,
        reviewedCaseSnapshotId: normalizeOptionalText(reviewedCaseSnapshotId ?? ""),
        sampleSetItemId: normalizeOptionalText(sampleSetItemId ?? ""),
      })
    : null;
  const currentResultPreviewHref = currentResultAsset
    ? buildWorkbenchAssetDetailHref({
        mode,
        manuscriptId: workspace.manuscript.id,
        assetId: currentResultAsset.id,
        reviewedCaseSnapshotId: normalizeOptionalText(reviewedCaseSnapshotId ?? ""),
        sampleSetItemId: normalizeOptionalText(sampleSetItemId ?? ""),
        presentation: mode === "editing" ? "fullscreen" : undefined,
      })
    : null;
  const currentResultDownloadHref = resolveCurrentAssetDownloadHref(currentResultAsset);
  const currentResultDownloadName = currentResultAsset
    ? buildWorkbenchDownloadName(
        workspace.manuscript.title,
        resolveResultDownloadNameSuffix(mode, currentResultAsset.asset_type),
        currentResultAsset.file_name,
      )
    : undefined;
  const statusLabel = resolveMainlineResultStatusLabel(mode, workspace, latestJob);
  const progressStatus = resolveSimpleProgressStatus(mode, workspace, latestJob);
  const progressValue = resolveSimpleProgressValue(progressStatus);
  const primaryAction = resolveSimplePrimaryAction({
    mode,
    busy,
    moduleAction,
    finalizeAction,
    utilities,
    currentResultAsset,
    currentResultPreviewHref,
  });
  const hasResult = Boolean(currentResultAsset);
  const advancedHref = currentResultPreviewHref ?? currentManuscriptPreviewHref ?? "#";

  return (
    <section className="manuscript-workbench-simple-canvas" data-simple-stage="loaded">
      <div className="manuscript-workbench-simple-hero">
        <span>{resolveSimpleModuleTitle(mode)}</span>
        <h2>{workspace.manuscript.title}</h2>
        <p>{`${statusLabel} 璺?${detectedManuscriptTypeLabel}`}</p>
      </div>

      <div className="manuscript-workbench-simple-progress" data-progress-status={progressStatus}>
        <div>
          <span>{resolveSimpleProgressLabel(progressStatus)}</span>
          <strong>{progressValue}%</strong>
        </div>
        <Progress
          value={progressValue}
          className={progressStatus === "running" ? "manuscript-workbench-progress-running" : undefined}
        />
      </div>

      <div className="manuscript-workbench-simple-actions">
        {primaryAction.kind === "button" ? (
          <button
            type="button"
            disabled={primaryAction.disabled}
            onClick={primaryAction.onClick}
          >
            {primaryAction.label}
          </button>
        ) : (
          <a
            className="manuscript-workbench-simple-primary-link"
            href={primaryAction.href}
          >
            {primaryAction.label}
          </a>
        )}
        {currentManuscriptPreviewHref ? (
          <a className="manuscript-workbench-simple-secondary-link" href={currentManuscriptPreviewHref}>
            閺屻儳婀呴崢鐔侯焾
          </a>
        ) : null}
        {currentResultDownloadHref ? (
          <a
            className="manuscript-workbench-simple-secondary-link"
            href={currentResultDownloadHref}
            download={currentResultDownloadName}
          >
            娑撳娴囩紒鎾寸亯
          </a>
        ) : null}
      </div>

      {templateSelection?.requiresOperatorReview || templateSelection?.hasPendingChange ? (
        <div className="manuscript-workbench-simple-inline-panel">
          <SimpleTemplatePanel busy={busy} templateSelection={templateSelection} />
        </div>
      ) : null}

      <div className="manuscript-workbench-simple-result">
        <span>{hasResult ? "?????" : "????"}</span>
        <strong>{resolveMainlineResultHeadline(mode, workspace, currentResultAsset)}</strong>
        <p>
          {resolveMainlineResultDescription({
            mode,
            workspace,
            latestJob,
            latestActionResult,
            currentResultAsset,
          })}
        </p>
      </div>

      <div className="manuscript-workbench-simple-footer-actions">
        {advancedSummary ? (
          <a
            className="manuscript-workbench-simple-secondary-link"
            href={advancedHref}
          >
            閺屻儳婀呯拠锔剧矎瀹搞儰缍旈崣?          </a>
        ) : null}
        {utilities?.canRefreshLatestJob ? (
          <button
            type="button"
            className="manuscript-workbench-simple-text-button"
            disabled={busy}
            onClick={() => utilities.onRefreshLatestJob()}
          >
            閸掗攱鏌婇悩鑸碘偓?          </button>
        ) : null}
      </div>
    </section>
  );
}

type SimpleProgressStatus = "queued" | "running" | "completed" | "failed" | "not_started";

type SimplePrimaryAction =
  | {
      kind: "button";
      label: string;
      disabled: boolean;
      onClick(): void;
    }
  | {
      kind: "link";
      label: string;
      href: string;
    };

function buildSimpleWorkbenchBackHref(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
  workspace: ManuscriptWorkbenchWorkspace | null,
): string {
  if (!workspace) {
    return `#${mode}`;
  }

  return buildWorkbenchAssetCollectionHref({
    mode,
    manuscriptId: workspace.manuscript.id,
  });
}

function resolveSimpleModuleTitle(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
): string {
  if (mode === "screening") return "\u521d\u7b5b";
  if (mode === "editing") return "\u7f16\u8f91";
  return "\u6821\u5bf9";
}

function resolveSimpleEmptyTitle(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
): string {
  return `${resolveSimpleModuleTitle(mode)}工作台`;
}

function resolveSimpleEmptyDescription(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
): string {
  if (mode === "screening") {
    return "\u4e0a\u4f20\u7a3f\u4ef6\u540e\u53ef\u542f\u52a8\u521d\u7b5b\uff0c\u7cfb\u7edf\u4f1a\u751f\u6210\u521d\u7b5b\u62a5\u544a\u5e76\u4fdd\u7559\u6267\u884c\u8bc1\u636e\u3002";
  }

  if (mode === "editing") {
    return "\u9009\u62e9\u7a3f\u4ef6\u540e\u53ef\u542f\u52a8\u7f16\u8f91\uff0c\u7cfb\u7edf\u4f1a\u751f\u6210\u7f16\u8f91\u7a3f\u4ef6\u5e76\u4fdd\u7559\u89c4\u5219\u4e0e\u77e5\u8bc6\u8c03\u7528\u8bc1\u636e\u3002";
  }

  return "\u9009\u62e9\u7a3f\u4ef6\u540e\u53ef\u542f\u52a8\u6821\u5bf9\uff0c\u7cfb\u7edf\u4f1a\u6267\u884c\u89c4\u5219\u3001\u77e5\u8bc6\u3001\u901a\u7528\u533b\u5b66\u5305\u548c\u6b8b\u5dee\u5206\u6790\uff0c\u5e76\u8fdb\u5165\u4eba\u5de5\u786e\u8ba4\u3002";
}

function resolveSimpleProgressStatus(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
  workspace: ManuscriptWorkbenchWorkspace | null,
  latestJob: AnyWorkbenchJob | null,
): SimpleProgressStatus {
  const status =
    latestJob?.module === mode
      ? latestJob.status
      : workspace?.manuscript.module_execution_overview?.[mode]?.latest_job?.status;

  if (status === "queued") return "queued";
  if (status === "running") return "running";
  if (status === "completed") return "completed";
  if (status === "failed" || status === "cancelled") return "failed";
  return "not_started";
}

function resolveSimpleProgressValue(status: SimpleProgressStatus): number {
  if (status === "completed") return 100;
  if (status === "running") return 62;
  if (status === "queued") return 28;
  if (status === "failed") return 100;
  return 8;
}

function resolveSimpleProgressLabel(status: SimpleProgressStatus): string {
  if (status === "completed") return "\u5df2\u5b8c\u6210";
  if (status === "running") return "\u5904\u7406\u4e2d";
  if (status === "queued") return "\u6392\u961f\u4e2d";
  if (status === "failed") return "\u5904\u7406\u5931\u8d25";
  return "\u5f85\u5f00\u59cb";
}

function resolveSimplePrimaryAction(input: {
  mode: Exclude<ManuscriptWorkbenchMode, "submission">;
  busy: boolean;
  moduleAction?: ManuscriptWorkbenchActionPanelProps;
  finalizeAction?: ManuscriptWorkbenchActionPanelProps;
  utilities?: ManuscriptWorkbenchUtilitiesPanelProps;
  currentResultAsset: NonNullable<ManuscriptWorkbenchWorkspace["currentAsset"]> | null;
  currentResultPreviewHref: string | null;
}): SimplePrimaryAction {
  if (
    input.mode === "proofreading" &&
    input.utilities?.onPublishHumanFinal &&
    input.utilities.canPublishHumanFinal
  ) {
    return {
      kind: "button",
      label: "??????",
      disabled: input.busy,
      onClick: () => input.utilities?.onPublishHumanFinal?.(),
    };
  }

  if (input.currentResultAsset && input.currentResultPreviewHref) {
    return {
      kind: "link",
      label: resolveSimpleResultEntryLabel(input.mode),
      href: input.currentResultPreviewHref,
    };
  }

  if (input.moduleAction) {
    return {
      kind: "button",
      label: formatPrimaryActionButtonLabel(input.moduleAction.actionLabel),
      disabled:
        input.busy || input.moduleAction.selectedAssetId.trim().length === 0,
      onClick: () => input.moduleAction?.onRun(),
    };
  }

  if (input.finalizeAction) {
    return {
      kind: "button",
      label: formatPrimaryActionButtonLabel(input.finalizeAction.actionLabel),
      disabled:
        input.busy || input.finalizeAction.selectedAssetId.trim().length === 0,
      onClick: () => input.finalizeAction?.onRun(),
    };
  }

  return {
    kind: "button",
    label: "???????",
    disabled: true,
    onClick: () => {},
  };
}

function resolveSimpleResultEntryLabel(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
): string {
  if (mode === "editing") return "\u6253\u5f00\u7f16\u8f91\u5de5\u4f5c\u53f0";
  return "\u67e5\u770b\u5f53\u524d\u7ed3\u679c";
}

function SimpleIntakePanel({
  busy,
  intake,
}: {
  busy: boolean;
  intake: ManuscriptWorkbenchIntakePanelProps;
}) {
  const [isDragActive, setIsDragActive] = useState(false);
  const hasFiles =
    intake.attachedFileCount > 0 ||
    (intake.uploadForm.fileContentBase64?.trim().length ?? 0) > 0 ||
    (intake.uploadForm.storageKey?.trim().length ?? 0) > 0;

  function handleSelectedFiles(files: FileList | File[] | null | undefined) {
    const selectedFiles = Array.isArray(files) ? files : Array.from(files ?? []);
    if (selectedFiles.length > 0) {
      intake.onFilesSelect(selectedFiles);
    }
  }

  return (
    <div className="manuscript-workbench-simple-upload">
      <div
        className={isDragActive ? "manuscript-workbench-simple-dropzone is-active" : "manuscript-workbench-simple-dropzone"}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragActive(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragActive(false);
          handleSelectedFiles(event.dataTransfer?.files);
        }}
      >
        <span aria-hidden="true">+</span>
        <strong>????</strong>
        <p>?? .doc / .docx ????????????????</p>
        <input
          type="file"
          multiple
          onChange={(event) => handleSelectedFiles(event.target.files)}
          aria-label="??????"
        />
      </div>
      <button
        type="button"
        disabled={busy || !intake.canSubmit}
        onClick={() => intake.onSubmit()}
      >
        {busy ? "???..." : "????"}
      </button>
    </div>
  );
}

function SimpleTemplatePanel({
  busy,
  templateSelection,
}: {
  busy: boolean;
  templateSelection: ManuscriptWorkbenchTemplateSelectionPanelProps;
}) {
  return (
    <div className="manuscript-workbench-simple-template">
      <div>
        <span>????</span>
        <strong>{templateSelection.resolvedManuscriptTypeLabel}</strong>
        <p>{templateSelection.confidenceLabel}</p>
      </div>
      <select
        value={templateSelection.selectedJournalTemplateId}
        onChange={(event) => templateSelection.onSelect(event.target.value)}
      >
        <option value="">??????</option>
        {templateSelection.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button type="button" disabled={busy} onClick={() => templateSelection.onApply()}>
        ????
      </button>
    </div>
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
        reviewedCaseSnapshotId: normalizeOptionalText(reviewedCaseSnapshotId ?? ""),
        sampleSetItemId: normalizeOptionalText(sampleSetItemId ?? ""),
        presentation: mode === "editing" ? "fullscreen" : undefined,
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
              <span className="manuscript-workbench-section-eyebrow">????</span>
              <h4>????</h4>
              <p>{resolveFocusPanelDescription(mode)}</p>
            </div>
            <div className="manuscript-workbench-focus-context-card">
              <span>????</span>
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
                    查看原稿
                  </a>
                  <a
                    className="manuscript-workbench-shortcut manuscript-workbench-shortcut--context"
                    href={currentManuscriptDownloadHref ?? undefined}
                    download={currentManuscriptFileName}
                  >
                    下载原稿
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
                    {mode === "editing" ? "打开编辑工作台" : "查看当前结果"}
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
                    下载结果
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
                    <span>??????</span>
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
                      閸忓牓鈧鑵戣ぐ鎾冲鐟曚礁顦╅悶鍡欐畱缁嬪じ娆㈢挧鍕獓閿涘苯鍟€鏉╂稑鍙嗘潻娆庣閻滎垵濡妴?
                    </p>
                  )}
                  <div
                    className="manuscript-workbench-button-row manuscript-workbench-button-row--sticky"
                    data-action-row="sticky"
                    data-secondary-action={hasSecondaryAction ? "available" : "hidden"}
                  >
                    <button type="button" disabled={busy || !canRun} onClick={() => action.onRun()}>
                      {busy ? "???..." : formatPrimaryActionButtonLabel(action.actionLabel)}
                    </button>
                    {hasSecondaryAction ? (
                      <button
                        type="button"
                        className="manuscript-workbench-button-secondary"
                        disabled={busy || !canRun}
                        onClick={() => action.onSecondaryRun?.()}
                      >
                        {busy ? "???..." : renderPrimaryActionButtonLabel(secondaryActionLabel ?? "")}
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
              <span className="manuscript-workbench-section-eyebrow">AI ????</span>
              <h4>????</h4>
              <p>????????????????????</p>
            </div>
          </div>
          <div
            className="manuscript-workbench-resolved-context"
            data-confidence-level={templateSelection.confidenceLevel ?? "medium"}
          >
            <div className="manuscript-workbench-selection-context">
              <span>????</span>
              <strong>{templateSelection.resolvedManuscriptTypeLabel}</strong>
            </div>
            <div className="manuscript-workbench-selection-context">
              <span>???</span>
              <strong>{templateSelection.confidenceLabel}</strong>
            </div>
            <div className="manuscript-workbench-selection-context">
              <span>???</span>
              <strong>{templateSelection.baseTemplateLabel}</strong>
            </div>
            <div className="manuscript-workbench-selection-context">
              <span>????</span>
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
                ? "????????"
                : "????"}
            </summary>
            {templateSelection.showManualManuscriptTypeSelect &&
            (templateSelection.manualManuscriptTypeOptions?.length ?? 0) > 0 &&
            templateSelection.onManualManuscriptTypeSelect ? (
              <label className="manuscript-workbench-field">
                <span>????</span>
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
              <span>???</span>
              <select
                value={templateSelection.selectedTemplateFamilyId}
                onChange={(event) => templateSelection.onTemplateFamilySelect(event.target.value)}
              >
                {templateSelection.selectedTemplateFamilyId.trim().length === 0 &&
                templateSelection.templateFamilyOptions.length > 0 ? (
                  <option value="">?????</option>
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
            <span>????</span>
            <select
              value={templateSelection.selectedJournalTemplateId}
              onChange={(event) => templateSelection.onSelect(event.target.value)}
            >
              <option value="">??????</option>
              {templateSelection.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {templateSelection.requiresOperatorReview ? (
            <p className="manuscript-workbench-help is-warning">
              AI ?????????????????????????
            </p>
          ) : null}
          {templateSelection.hasPendingChange ? (
            <p className="manuscript-workbench-help is-warning">
              ??????????????????
            </p>
          ) : null}
          <p className="manuscript-workbench-help">
            ???????????????????
          </p>
          <div
            className="manuscript-workbench-button-row manuscript-workbench-button-row--sticky"
            data-action-row="sticky"
          >
            <button type="button" disabled={busy} onClick={() => templateSelection.onApply()}>
              {busy ? "???..." : resolveTemplateSelectionActionLabel(templateSelection)}
            </button>
          </div>
        </section>
      ) : null}

      {governedModules.length > 0 ? (
        <section className="manuscript-workbench-focus-work-card">
          <div className="manuscript-workbench-focus-work-card-header">
            <div>
              <span className="manuscript-workbench-section-eyebrow">????</span>
              <h4>??????</h4>
              <p>??????????????</p>
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
                    <dt>????</dt>
                    <dd>{resolveGovernedModulePreparationStatus(module)}</dd>
                  </div>
                  <div>
                    <dt>AI ??</dt>
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

  if (!workspace) {
    return null;
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
          reviewedCaseSnapshotId: normalizedReviewedCaseSnapshotId,
          sampleSetItemId: normalizedSampleSetItemId,
          presentation: mode === "editing" ? "fullscreen" : undefined,
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
            <span className="manuscript-workbench-section-eyebrow">瑜版挸澧犵紒鎾寸亯</span>
            <strong>{headline}</strong>
            <p>{description}</p>
          </div>
          <span className="manuscript-workbench-result-summary-status">
            {workspace
              ? `${statusLabel} 璺?${detectedManuscriptTypeLabel}`
              : statusLabel}
          </span>
        </section>

        <div className="manuscript-workbench-result-card-grid">
          <article className="manuscript-workbench-result-card">
            <div className="manuscript-workbench-result-card-copy">
              <span>缁嬪じ娆㈤崢鐔告瀮</span>
              <strong>{workspace?.manuscript.title ?? "閺堫亝澧﹀鈧粙澶告"}</strong>
              <p>
                {workspace
                  ? "鏉╂稑鍙嗛崢鐔侯焾閺屻儳婀呮い纰夌礉閺嶇顕锝嗘瀮閸滃苯缍嬮崜宥囶焾娴犲墎澧楅張顑锯偓"
                  : "选择或上传稿件后，这里会显示原稿入口。"}
              </p>
            </div>
            {currentManuscriptPreviewHref || currentManuscriptDownloadHref ? (
              <div className="manuscript-workbench-button-row">
                {currentManuscriptPreviewHref ? (
                  <a
                    className="manuscript-workbench-shortcut"
                    href={currentManuscriptPreviewHref}
                  >
                    閺屻儳婀呯粙澶告
                  </a>
                ) : null}
                {currentManuscriptDownloadHref ? (
                  <a
                    className="manuscript-workbench-shortcut"
                    href={currentManuscriptDownloadHref}
                    download={currentManuscriptDownloadName}
                  >
                    娑撳娴囩粙澶告
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
                    {mode === "editing" ? "???????" : "?????"}
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
                      : "????"}
                  </a>
                ) : null}
              </div>
            ) : null}
          </article>
        </div>

        {workspace && advancedSummary ? (
          <details className="manuscript-workbench-result-details">
            <summary>??????</summary>
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
    return "";
  }

  if (mode === "editing") {
    return "";
  }

  return "缁嬪じ娆㈤崗銉ュ經娑撳孩鐗庣€电懓濮╂担";
}

function resolveWorkspaceOperationDescription(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
): string {
  if (mode === "screening") {
    return "閸︺劏绻栭柌灞肩瑐娴肩姷顭堟禒韬测偓浣衡€樼拋銈堢槕閸掝偆琚崹瀣剁礉楠炶埖澧界悰灞界秼閸撳秴鍨电粵娑栤偓";
  }

  if (mode === "editing") {
    return "閸︺劏绻栭柌灞肩瑐娴肩姷顭堟禒韬测偓浣衡€樼拋銈喣侀弶鍖＄礉楠炶埖澧界悰灞界秼閸撳秶绱潏鎴欌偓";
  }

  return "";
}

function resolveWorkspaceExecutionReadinessLabel(
  executionContext: ManuscriptWorkbenchReadOnlyExecutionContextViewModel | null,
): string {
  if (!executionContext) {
    return "瀵板懓娴囬崗";
  }

  if (
    executionContext.providerReadinessStatus === "ok" &&
    executionContext.runtimeBindingReadinessStatus === "ready"
  ) {
    return "瀹告彃姘ㄧ紒";
  }

  return "";
}

function resolveWorkspaceOperationMetaSummary(input: {
  mode: Exclude<ManuscriptWorkbenchMode, "submission">;
  workspace: ManuscriptWorkbenchWorkspace | null;
  executionContext: ManuscriptWorkbenchReadOnlyExecutionContextViewModel | null;
  detectedManuscriptTypeLabel: string;
}): string {
  if (!input.workspace) {
    return `当前稿件还没有生成 ${resolveModuleModeLabel(input.mode)} 结果`;
  }

  return `${input.detectedManuscriptTypeLabel}閿涘瓑I ${resolveWorkspaceExecutionReadinessLabel(
    input.executionContext,
  )}`;
}

function resolveResultPanelTitle(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
): string {
  if (mode === "screening") {
    return "婢跺嫮鎮婄紒鎾寸亯";
  }

  if (mode === "editing") {
    return "缂傛牞绶紒鎾寸亯";
  }

  return "";
}

function resolveResultPanelDescription(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
): string {
  if (mode === "screening") {
    return "缂佹挻鐏夐悽鐔稿灇閸氬函绱濇禒搴ょ箹闁插矁绻橀崗銉ョ摍妞ょ敻娼伴弻銉ф箙閸忋劍鏋冮妴渚€顥撻梽鈺佹嫲瀵ら缚顔呴妴";
  }

  if (mode === "editing") {
    return "缂佹挻鐏夐悽鐔稿灇閸氬函绱濇禒搴ょ箹闁插矁绻橀崗銉ョ摍妞ょ敻娼伴弻銉ф箙閸忋劍鏋冮妴渚€妫舵０妯烘嫲閸欐媽澶勯妴";
  }

  return "";
}

function resolveResultCardEyebrow(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
): string {
  if (mode === "screening") {
    return "閸掓繄鐡紒鎾寸亯";
  }

  if (mode === "editing") {
    return "缂傛牞绶紒鎾寸亯";
  }

  return "";
}

function resolveMainlineResultStatusLabel(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
  workspace: ManuscriptWorkbenchWorkspace | null,
  latestJob: AnyWorkbenchJob | null,
): string {
  if (!workspace) {
    return "閺堫亜绱戞慨";
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
    return "";
  }

  if (!currentResultAsset) {
    return "";
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
    return "娴犲骸涔忔笟褔鈧瀚ㄧ粙澶告閹存牕婀稉濠冩煙娑撳﹣绱剁粙澶告閸氬函绱濇潻娆撳櫡娴兼碍妯夌粈鍝勵槱閻炲棛绮ㄩ弸婧库偓";
  }

  if (input.currentResultAsset) {
    return `缂佹挻鐏夊鑼晸閹存劧绱濋崣?{resolveResultWorkspaceEntryCopy(input.mode)}`;
  }

  const latestJobStatus =
    input.latestJob?.status ??
    resolveLatestModuleJobStatus(input.workspace.manuscript, input.mode);
  if (latestJobStatus === "queued") {
    return "";
  }

  if (latestJobStatus === "running") {
    return "缁崵绮哄锝呮躬婢跺嫮鎮婃稉顓ㄧ礉鐎瑰本鍨氶崥搴濈窗閼奉亜濮╅崷銊ㄧ箹闁插本妯夌粈铏圭波閺嬫粌鍙嗛崣锝冣偓";
  }

  if (latestJobStatus === "failed" || latestJobStatus === "cancelled") {
    return "閺堚偓鏉╂垳绔村▎鈥愁槱閻炲棙婀幋鎰閿涘矁顕崚閿嬫煀娴犺濮熼幋鏍櫢閺傜増澧界悰灞烩偓";
  }

  const latestMessage = input.latestActionResult?.message?.trim() ?? "";
  if (latestMessage.length > 0) {
    return formatWorkbenchActionResultMessage(latestMessage);
  }

  return "閸忓牆婀稉濠冩煙閹笛嗩攽瑜版挸澧犲Ο鈥虫健閿涘矁绻栭柌灞肩窗閺勫墽銇氭径鍕倞缂佹挻鐏夐妴";
}

function resolveResultWorkspaceEntryCopy(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
): string {
  if (mode === "screening") {
    return "鏉╂稑鍙嗙€涙劙銆夐棃銏＄叀閻鍙忛弬鍥モ偓渚€顥撻梽鈺佹嫲瀵ら缚顔呴妴";
  }

  if (mode === "editing") {
    return "鏉╂稑鍙嗙€涙劙銆夐棃銏＄叀閻鍙忛弬鍥モ偓渚€妫舵０妯烘嫲閸欐媽澶勯妴";
  }

  return "鏉╂稑鍙嗙€涙劙銆夐棃銏＄叀閻鍙忛弬鍥モ偓渚€妫舵０妯烘嫲娴滃搫浼愮涵顔款吇閹垮秳缍旈妴";
}

function buildWorkbenchStageResultName(
  manuscriptTitle: string,
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
  assetType: string,
): string {
  const baseTitle = manuscriptTitle.trim().length > 0 ? manuscriptTitle.trim() : "?????";
  return `${baseTitle}${resolveResultDisplaySuffix(mode, assetType)}`;
}

function resolveResultDisplaySuffix(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
  assetType: string,
): string {
  if (mode === "screening") {
    return " - 閸掓繄鐡紒鎾寸亯";
  }

  if (mode === "editing") {
    return " - 缂傛牞绶粙";
  }

  if (assetType === "final_proof_annotated_docx") {
    return "";
  }

  if (assetType === "final_proof_issue_report") {
    return " - 閺嶁€愁嚠闂傤噣顣介崡";
  }

  return "";
}

function resolveResultDownloadNameSuffix(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
  assetType: string,
): string {
  if (mode === "screening") {
    return "????";
  }

  if (mode === "editing") {
    return "???";
  }

  if (assetType === "final_proof_annotated_docx") {
    return "?????";
  }

  if (assetType === "final_proof_issue_report") {
    return "??????";
  }

  return "??????";
}

function buildWorkbenchDownloadName(
  manuscriptTitle: string,
  suffix: string,
  fileName?: string | null,
): string {
  const baseTitle = manuscriptTitle.trim().length > 0 ? manuscriptTitle.trim() : "?????";
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
  return "閺嶁€愁嚠瀹搞儰缍旈崣";
}

function resolveDescription(mode: ManuscriptWorkbenchMode): string {
  if (mode === "submission") {
    return "";
  }

  if (mode === "screening") {
    return "";
  }

  if (mode === "editing") {
    return "";
  }

  return "閺€鑸垫将闂傤噣顣藉〒鍛礋閵嗕胶绮撶粙璺ㄢ€樼拋銈勭瑢閸欐垵绔烽崜宥嗩梾閺屻儻绱濈€瑰本鍨氶張鈧崥搴濈鐠哄磭娈戦弽鈥愁嚠鐎规氨顭堥妴";
}

function resolveFocusPanelTitle(mode: Exclude<ManuscriptWorkbenchMode, "submission">): string {
  if (mode === "screening") {
    return "瑜版挸澧犵粙澶告閸掓繄鐡崚銈嗘焽";
  }

  if (mode === "editing") {
    return "";
  }

  return "瑜版挸澧犵粙澶告閺嶁€愁嚠瀹搞儰缍旈崠";
}

function resolveFocusPanelDescription(mode: Exclude<ManuscriptWorkbenchMode, "submission">): string {
  if (mode === "screening") {
    return "";
  }

  if (mode === "editing") {
    return "閸ュ绮ぐ鎾冲缁嬪じ娆㈤惃鍕波閺嬪嫪鎱ㄧ拋顫偓浣鼓侀弶澶哥瑐娑撳鏋冩稉搴濈瑓濞撻晲姘﹂幒銉﹀瘮缂侇厼浼愭担婧库偓";
  }

  return "";
}

function resolveHeroEyebrow(mode: ManuscriptWorkbenchMode): string {
  if (mode === "submission") {
    return "缁嬪じ娆㈤幒銉ュ弳";
  }

  return "";
}

function resolveHeroLane(mode: ManuscriptWorkbenchMode): string {
  if (mode === "submission") {
    return "閹舵洜顭堥幒銉ュ弳";
  }

  if (mode === "screening") {
    return "";
  }

  if (mode === "editing") {
    return "";
  }

  return "閺嶁€愁嚠";
}

function resolveHeroFocus(mode: ManuscriptWorkbenchMode): string {
  if (mode === "submission") {
    return "";
  }

  if (mode === "screening") {
    return "";
  }

  if (mode === "editing") {
    return "閸ュ绮ぐ鎾冲缂傛牞绶粙璺ㄦ埛缂侇厺鎱ㄧ拋顫礉楠炴湹绻氶悾娆忔倻閺嶁€愁嚠閸欐壆些娴溿倖澧嶉棁鈧惃鍕瑐娑撳鏋冮妴";
  }

  return "閻㈢喐鍨氶弽鈥愁嚠閼藉顭堥妴浣衡€樼拋銈呯敨閹佃鏁炵紒鍫㈩焾閿涘苯鑻熸稉鐑樻付缂佸牆褰傜敮鍐ㄤ粵婵傝棄鍣径鍥モ偓";
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
    return "\u8bf7\u5148\u9009\u62e9\u57fa\u7840\u6a21\u677f\u5bb6\u65cf\uff0c\u518d\u4fdd\u5b58\u6a21\u677f\u4e0a\u4e0b\u6587\u3002";
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
    return "";
  }

  if (input.requiresOperatorReview) {
    return "绾喛顓?AI 鐠囧棗鍩嗙紒鎾寸亯";
  }

  return "";
}

function resolveTemplateSelectionStatusMessage(
  workspace: ManuscriptWorkbenchWorkspace,
  actionLabel: string,
): string {
  if (actionLabel === "Select Manuscript") {
    return `??? ${workspace.manuscript.id}`;
  }

  if (actionLabel === "Apply Template") {
    return `?? ${workspace.manuscript.id} ????`;
  }

  return `?? ${workspace.manuscript.id} ??????`;
}

function formatPrimaryActionBadge(actionLabel: string): string {
  if (actionLabel === "Run Screening") return "\u7b5b\u7a3f";
  if (actionLabel === "Run Editing") return "\u7f16\u8f91";
  if (actionLabel === "Finalize Proofreading") return "\u6821\u5bf9";
  if (actionLabel === AI_RECOGNITION_ACTION_LABEL) return "AI";
  return "\u5904\u7406";
}

function formatPrimaryActionTitle(actionLabel: string): string {
  if (actionLabel === "Run Screening") return "\u6267\u884c\u7b5b\u7a3f";
  if (actionLabel === "Run Editing") return "\u6267\u884c\u7f16\u8f91";
  if (actionLabel === "Finalize Proofreading") return "\u786e\u8ba4\u6821\u5bf9\u5b9a\u7a3f";
  if (actionLabel === AI_RECOGNITION_ACTION_LABEL) return "AI \u81ea\u52a8\u5904\u7406\uff08\u672c\u6b21\uff09";
  return actionLabel;
}

function legacyFormatPrimaryActionButtonLabel(actionLabel: string): string {
  if (actionLabel === AI_RECOGNITION_ACTION_LABEL) {
    return "AI \u81ea\u52a8\u5904\u7406\uff08\u672c\u6b21\uff09";
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
    .replace(/\s+/gu, " ")
    .replace(/^Clinical Study\b/u, "\u4e34\u5e8a\u7814\u7a76")
    .replace(/^Case Report\b/u, "\u75c5\u4f8b\u62a5\u544a")
    .replace(/^Review\b/u, "\u7efc\u8ff0")
    .replace(/\bgovernance family\b/iu, "\u6cbb\u7406\u5bb6\u65cf")
    .replace(/\bbase template family\b/iu, "\u57fa\u7840\u6a21\u677f\u65cf")
    .replace(/\s+\u57fa\u7840\u6a21\u677f\u65cf/iu, "\u57fa\u7840\u6a21\u677f\u65cf")
}

function resolvePrimaryActionDescription(
  actionLabel: string,
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
): string {
  if (actionLabel === "Run Screening") {
    return "娴犮儱甯慨瀣焾娴犺埖鍨ㄥ鎻掓倱濮濄儴绁禍褌璐熸潏鎾冲弳閿涘苯鐣幋鎰灥缁涙稑鍨介弬顓炶嫙閻㈢喐鍨氶崣顖欐唉閹恒儳绮ㄩ弸婧库偓";
  }

  if (actionLabel === "Run Editing") {
    return "閸╄桨绨ぐ鎾冲闁鑵戦惃鍕焾娴犳儼绁禍褑绻橀崗銉х椽鏉堟垵顦╅悶鍡礉閻㈢喐鍨氭稉瀣╃濮濄儱褰茬紒褏鐢诲ù浣芥祮閻ㄥ嫭鏋冨锝冣偓";
  }

  if (actionLabel === "Create Draft") {
    return "閸忓牏鏁撻幋鎰拱鏉烆喗鐗庣€电宕忕粙鍖＄礉閸愬秷绻橀崗銉ゆ眽瀹搞儳绮撶€光€虫嫲鐎规氨顭堥妴";
  }

  if (actionLabel === "Finalize Proofreading") {
    return "??????????????????";
  }

  return resolveFocusPanelDescription(mode);
}

function formatFocusSelectionContextLabel(label: string | undefined): string {
  if (!label) return "???";
  if (label === "Selected Draft Asset") return "????";
  if (label === "Selected Manuscript") return "????";
  return label;
}

function formatGovernedModuleLabel(module: string): string {
  if (module === "screening") return "??";
  if (module === "editing") return "??";
  if (module === "proofreading") return "??";
  return module;
}

function formatRuntimeBindingReadiness(status?: string): string {
  if (status === "ready") return "???";
  if (status === "blocked") return "???";
  if (status === "partial") return "????";
  return "???";
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
    return "???";
  }

  if (
    module.execution_profile_id ||
    module.retrieval_preset_id ||
    module.runtime_binding_id
  ) {
    return "????";
  }

  return "???";
}

function resolveGovernedModuleAiStatusLabel(status?: string): string {
  if (status === "ready") {
    return "???";
  }

  return status ? formatRuntimeBindingReadiness(status) : "???";
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

function rememberWorkbenchQueueManuscript(
  manuscript: ManuscriptWorkbenchWorkspace["manuscript"],
): void {
  if (typeof window === "undefined") {
    return;
  }

  const cached = readRememberedWorkbenchQueueManuscripts();
  const next = [
    manuscript,
    ...cached.filter((item) => item.id !== manuscript.id),
  ].slice(0, 50);
  window.localStorage.setItem(WORKBENCH_QUEUE_CACHE_KEY, JSON.stringify(next));
}

function forgetWorkbenchQueueManuscript(manuscriptId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const next = readRememberedWorkbenchQueueManuscripts().filter(
    (item) => item.id !== manuscriptId,
  );
  window.localStorage.setItem(WORKBENCH_QUEUE_CACHE_KEY, JSON.stringify(next));
}

function readRememberedWorkbenchQueueManuscripts(): ManuscriptWorkbenchWorkspace["manuscript"][] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(WORKBENCH_QUEUE_CACHE_KEY) ?? "[]",
    ) as ManuscriptWorkbenchWorkspace["manuscript"][];

    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item?.id === "string" && typeof item?.title === "string")
      : [];
  } catch {
    return [];
  }
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
  if (latestJobStatus === "queued") return "\u6392\u961f\u4e2d";
  if (latestJobStatus === "running") return "\u5904\u7406\u4e2d";
  if (latestJobStatus === "completed") return "\u5df2\u5b8c\u6210";
  if (latestJobStatus === "failed") return "\u5931\u8d25";
  if (latestJobStatus === "cancelled") return "\u5df2\u53d6\u6d88";
  if (manuscript.status === "uploaded") return "\u5f85\u5904\u7406";
  if (manuscript.status === "processing") return "\u5904\u7406\u4e2d";
  if (manuscript.status === "awaiting_review") return "\u5f85\u5ba1\u6838";
  if (manuscript.status === "completed") return "\u5df2\u5b8c\u6210";
  if (manuscript.status === "archived") return "\u5df2\u5f52\u6863";
  return "\u5f85\u5904\u7406";
}

export function resolveQueueActivityLabel(
  manuscript: ManuscriptWorkbenchWorkspace["manuscript"],
  mode: ManuscriptWorkbenchMode,
  latestJobStatus = resolveLatestModuleJobStatus(manuscript, mode),
): string {
  if (latestJobStatus === "queued") {
    return `\u7b49\u5f85${resolveQueueActivityModuleLabel(mode)}\u7a7a\u95f2`;
  }

  if (latestJobStatus === "running") {
    return `${resolveQueueActivityModuleLabel(mode)}\u5904\u7406\u4e2d`;
  }

  if (latestJobStatus === "completed") {
    return `\u6700\u8fd1\u4e00\u6b21${resolveQueueActivityModuleLabel(mode)}\u5df2\u5b8c\u6210`;
  }

  if (latestJobStatus === "failed") {
    return `\u6700\u8fd1\u4e00\u6b21${resolveQueueActivityModuleLabel(mode)}\u5931\u8d25`;
  }

  if (latestJobStatus === "cancelled") {
    return `\u6700\u8fd1\u4e00\u6b21${resolveQueueActivityModuleLabel(mode)}\u5df2\u53d6\u6d88`;
  }

  if (mode === "submission") {
    return manuscript.status === "processing" ? "???" : "???";
  }

  if (mode === "screening") {
    return manuscript.status === "processing" ? "???" : "???";
  }

  if (mode === "editing") {
    return manuscript.status === "processing" ? "???" : "???";
  }

  return manuscript.status === "processing" ? "???" : "???";
}

function resolveQueueActivityModuleLabel(mode: ManuscriptWorkbenchMode): string {
  if (mode === "screening") return "\u521d\u7b5b";
  if (mode === "editing") return "\u7f16\u8f91";
  if (mode === "proofreading") return "\u6821\u5bf9";
  return "\u63d0\u4ea4";
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
      ? "\u7ed3\u7b97"
      : labelSuffix === "Recovery"
        ? "\u6062\u590d"
        : labelSuffix === "Recovery Ready At"
          ? "\u6062\u590d\u53ef\u7528\u65f6\u95f4"
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
    case "\u4e1a\u52a1\u5df2\u5b8c\u6210\uff0c\u540e\u7eed\u5f85\u5904\u7406":
    case "\u4e1a\u52a1\u5df2\u5b8c\u6210\uff0c\u540e\u7eed\u5904\u7406\u4e2d":
      return `${statusPrefix}\uff0c\u540e\u7eed\u5904\u7406\u4ecd\u5728\u8fdb\u884c\u4e2d\u3002`;
    case "Business complete, follow-up retryable":
    case "\u4e1a\u52a1\u5df2\u5b8c\u6210\uff0c\u540e\u7eed\u53ef\u91cd\u8bd5":
      if ((recovery === "Waiting for retry window" || recovery === "\u7b49\u5f85\u91cd\u8bd5\u7a97\u53e3") && recoveryReadyAt) {
        return `${statusPrefix}${recoveryReadyAt} \u540e\u53ef\u91cd\u8bd5\u3002`;
      }
      return `${statusPrefix}\u540e\u7eed\u5904\u7406\u53ef\u91cd\u8bd5\uff0c\u8bf7\u7ee7\u7eed\u5173\u6ce8\u3002`;
    case "Business complete, follow-up failed":
    case "\u4e1a\u52a1\u5df2\u5b8c\u6210\uff0c\u540e\u7eed\u5931\u8d25":
      return `${statusPrefix}\u540e\u7eed\u5904\u7406\u5931\u8d25\uff0c\u9700\u4eba\u5de5\u68c0\u67e5\u3002`;
    case "Business complete, settlement unlinked":
    case "\u4e1a\u52a1\u5df2\u5b8c\u6210\uff0c\u7ed3\u7b97\u672a\u5173\u8054":
      return `${statusPrefix}\u7ed3\u679c\u8bb0\u5f55\u4e0d\u5b8c\u6574\uff0c\u9700\u4eba\u5de5\u68c0\u67e5\u3002`;
    case "Job failed":
    case "\u4efb\u52a1\u5931\u8d25":
      return `${statusPrefix}\u6700\u8fd1\u4e00\u6b21\u5904\u7406\u5931\u8d25\uff0c\u9700\u4eba\u5de5\u68c0\u67e5\u3002`;
    case "Job in progress":
    case "\u4efb\u52a1\u8fdb\u884c\u4e2d":
      return `${statusPrefix}\u6700\u8fd1\u4e00\u6b21\u5904\u7406\u4ecd\u5728\u8fdb\u884c\u4e2d\u3002`;
    case "Not started":
    case "\u672a\u5f00\u59cb":
      return `${statusPrefix}\u6700\u8fd1\u4e00\u6b21\u540e\u7eed\u5904\u7406\u5c1a\u672a\u5f00\u59cb\u3002`;
    default:
      return status;
  }
}

function formatWorkbenchNoticeStatusPrefix(status: string): string {
  const trimmedStatus = status.trim();
  if (/[閿涘被鈧偊绱掗敍?!?]$/u.test(trimmedStatus)) {
    return `${trimmedStatus} `;
  }

  return `${trimmedStatus}`;
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
      ? `${normalizedOutputBaseName}-\u7b5b\u7a3f\u62a5\u544a.md`
      : "screening-report.md";
  }

  if (mode === "editing") {
    return normalizedOutputBaseName
      ? `${normalizedOutputBaseName}-\u7f16\u8f91\u7a3f.docx`
      : "editing-manuscript.docx";
  }

  return normalizedOutputBaseName
    ? `${normalizedOutputBaseName}-\u6821\u5bf9\u8349\u7a3f\u62a5\u544a.md`
    : "proofreading-draft-report.md";
}

export function resolveWorkbenchProofreadingAnnotatedFileName(
  outputBaseName?: string,
): string {
  const normalizedOutputBaseName = normalizeWorkbenchOutputBaseName(outputBaseName);
  return normalizedOutputBaseName
    ? `${normalizedOutputBaseName}-\u6821\u5bf9\u6279\u6ce8\u7a3f.docx`
    : "proofreading-final.docx";
}

export function resolveWorkbenchHumanFinalFileName(
  outputBaseName?: string,
): string {
  const normalizedOutputBaseName = normalizeWorkbenchOutputBaseName(outputBaseName);
  return normalizedOutputBaseName
    ? `${normalizedOutputBaseName}-\u4eba\u5de5\u7ec8\u7a3f.docx`
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
    return `${resolveModuleModeLabel(mode)}\u7684 AI \u51c6\u5907\u672a\u5b8c\u6210\uff0c\u8bf7\u5148\u68c0\u67e5\u7cfb\u7edf\u8bbe\u7f6e\u540e\u518d\u6267\u884c\u3002`;
  }

  if (executionContext.runtimeBindingReadinessStatus === "missing") {
    return `${resolveModuleModeLabel(mode)}\u7684 AI \u51c6\u5907\u672a\u5b8c\u6210\uff0c\u8bf7\u5148\u5b8c\u6210\u76f8\u5173\u8bbe\u7f6e\u540e\u518d\u6267\u884c\u3002`;
  }

  if (executionContext.runtimeBindingReadinessStatus === "degraded") {
    return `${resolveModuleModeLabel(mode)}\u7684 AI \u51c6\u5907\u5f02\u5e38\uff0c\u8bf7\u4fee\u590d\u8bbe\u7f6e\u540e\u518d\u6267\u884c\u3002`;
  }

  return null;
}

export function buildModuleRunSuccessMessage(
  mode: ManuscriptWorkbenchRunMode,
  asset: WorkbenchGeneratedAssetLike,
): string {
  return `\u5df2\u751f\u6210${resolveGeneratedOutputTypeLabel(asset.asset_type, mode)}`;
}

export function resolveResultMaterializationFailureMessage(
  mode: ManuscriptWorkbenchRunMode,
): string {
  return `${resolveModuleModeLabel(mode)}\u5df2\u5b8c\u6210\uff0c\u4f46\u7ed3\u679c\u6587\u4ef6\u5c1a\u672a\u751f\u6210\u53ef\u4e0b\u8f7d\u94fe\u63a5\uff0c\u8bf7\u5237\u65b0\u540e\u91cd\u8bd5\u3002`;
}

function resolveModuleModeLabel(mode: ManuscriptWorkbenchRunMode): string {
  if (mode === "screening") return "\u521d\u7b5b";
  if (mode === "editing") return "\u7f16\u8f91";
  return "\u6821\u5bf9";
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
      <span hidden>\u4e0b\u8f7d\u6821\u5bf9\u6279\u6ce8\u7a3f</span>
    </>
  );
}

function legacyResolveCurrentResultDownloadLabel(
  asset: NonNullable<ManuscriptWorkbenchWorkspace["currentAsset"]>,
): string {
  return resolveCurrentResultDownloadLabel(asset);
}

function resolveCurrentResultDownloadLabel(
  asset: NonNullable<ManuscriptWorkbenchWorkspace["currentAsset"]>,
): string {
  if (asset.asset_type === "edited_docx") {
    return "\u4e0b\u8f7d\u7f16\u8f91\u7a3f";
  }

  if (asset.asset_type === "screening_report") {
    return "\u4e0b\u8f7d\u7b5b\u7a3f\u7ed3\u679c";
  }

  if (asset.asset_type === "final_proof_annotated_docx") {
    return "\u4e0b\u8f7d\u6821\u5bf9\u6279\u6ce8\u7a3f";
  }

  return "\u4e0b\u8f7d\u7ed3\u679c";
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

  return versionHint ? `${baseLabel}\uff08${versionHint}\uff09` : baseLabel;
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

  return displayName === typeLabel ? displayName : `${displayName} ? ${typeLabel}`;
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
    return `\u5386\u53f2 v${asset.version_no}`;
  }

  return `\u5386\u53f2 v${asset.version_no}`;
}

function formatDetectedManuscriptType(
  manuscript: ManuscriptWorkbenchWorkspace["manuscript"],
): string {
  const label = formatWorkbenchManuscriptTypeLabel(manuscript.manuscript_type);
  const detection = manuscript.manuscript_type_detection_summary;

  if (!detection) return label;
  if (detection.requires_operator_review || detection.confidence_level === "low") {
    return `${label}\uff08\u9700\u4eba\u5de5\u786e\u8ba4\uff09`;
  }
  if (detection.confidence_level === "high") return `${label}\uff08\u9ad8\u7f6e\u4fe1\uff09`;
  if (typeof detection.confidence === "number") return `${label}\uff08\u7f6e\u4fe1\u5ea6 ${Math.round(detection.confidence * 100)}%\uff09`;
  return label;
}

function formatWorkbenchManuscriptTypeLabel(manuscriptType: string): string {
  switch (manuscriptType) {
    case "review":
      return "\u7efc\u8ff0";
    case "clinical_study":
      return "\u4e34\u5e8a\u7814\u7a76";
    case "meta_analysis":
      return "Meta \u5206\u6790";
    case "systematic_review":
      return "\u7cfb\u7edf\u7efc\u8ff0";
    case "case_report":
      return "\u75c5\u4f8b\u62a5\u544a";
    case "guideline_interpretation":
      return "\u6307\u5357\u89e3\u8bfb";
    case "expert_consensus":
      return "\u4e13\u5bb6\u5171\u8bc6";
    case "diagnostic_study":
      return "\u8bca\u65ad\u7814\u7a76";
    case "basic_research":
      return "\u57fa\u7840\u7814\u7a76";
    case "nursing_study":
      return "\u62a4\u7406\u7814\u7a76";
    case "methodology_paper":
      return "\u65b9\u6cd5\u5b66\u8bba\u6587";
    case "brief_report":
      return "\u77ed\u7bc7\u62a5\u544a";
    case "other":
      return "\u5176\u4ed6";
    default:
      return manuscriptType;
  }
}

function formatDetectedConfidenceLabel(
  manuscript: ManuscriptWorkbenchWorkspace["manuscript"],
): string {
  const detection = manuscript.manuscript_type_detection_summary;
  if (!detection) return "";
  if (detection.requires_operator_review || detection.confidence_level === "low") return "\u4f4e\u7f6e\u4fe1\uff0c\u9700\u4eba\u5de5\u786e\u8ba4";
  if (detection.confidence_level === "high") return "\u9ad8\u7f6e\u4fe1";
  if (typeof detection.confidence === "number") return `\u7f6e\u4fe1\u5ea6 ${Math.round(detection.confidence * 100)}%`;
  return "\u7f6e\u4fe1\u5ea6\u672a\u77e5";
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
      "默认模板",
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

  return "";
}
