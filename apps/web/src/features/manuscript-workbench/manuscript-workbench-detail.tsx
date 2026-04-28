import React from "react";
import type {
  EditingCompletionGateSummary,
  EditingSlotGovernanceSummary,
  EditingSlotManualResolutionKind,
} from "@medical/contracts";
import { formatWorkbenchHash } from "../../app/workbench-routing.ts";
import {
  buildProofreadingLocateTarget,
  OnlyOfficePreviewSurface,
  type DocumentPreviewLocateTargetViewModel,
  type DocumentPreviewSessionViewModel,
  type OnlyOfficeProofreadingIssueMarkViewModel,
  type ProofreadingDocumentLocatorViewModel,
  supportsOnlyOfficePreviewSurface,
} from "../document-preview/index.ts";
import type {
  KnowledgeHitLogViewModel,
  ModuleExecutionSnapshotViewModel as ExecutionTrackingSnapshotViewModel,
} from "../execution-tracking/types.ts";
import type {
  DocumentAssetViewModel,
  JobViewModel,
} from "../manuscripts/index.ts";
import {
  HumanReviewQueue,
  type HumanReviewDiffItemViewModel,
  type HumanReviewPublishModule,
  type HumanReviewPublishPreflightResultViewModel,
  type HumanReviewQueueBatchDecisionChangeInput,
  type HumanReviewQueueDecisionChangeInput,
} from "../human-review/index.ts";
import type { ProofreadingConfirmationDecisionAction } from "../proofreading/types.ts";
import {
  buildWorkbenchAssetDisplayName,
  formatWorkbenchAssetTypeLabel,
  resolveWorkbenchAssetDownloadLabel,
} from "./manuscript-workbench-asset-labels.ts";
import type {
  ManuscriptWorkbenchKnowledgeReferenceViewModel,
  ManuscriptWorkbenchMode,
} from "./manuscript-workbench-controller.ts";

export type ManuscriptAssetDetailKind =
  | "document_preview"
  | "report_preview"
  | "screening_workspace"
  | "proofreading_workspace"
  | "proofreading_confirmation";

export interface EditingChangeLedgerEntry {
  id: string;
  sourceLabel: string;
  before: string;
  after: string;
  locationText?: string;
  blockIndex?: number;
}

export interface EditingGuardrailEntry {
  id: string;
  sourceStage: "planning" | "docx_transform";
  reasonCode: string;
  excerpt: string;
}

export interface ProofreadingIssueAnchorViewModel {
  blockIndex: number;
  quote: string;
  sectionLabel?: string;
  blockKind?: string;
  documentLocator?: ProofreadingDocumentLocatorViewModel;
}

export interface ProofreadingDocumentBlockViewModel {
  blockId: string;
  blockIndex: number;
  sourceLocator?: string;
  sectionLabel?: string;
  blockKind?: string;
  text: string;
}

type SharedReviewTone = "error" | "neutral" | "success";

interface EditingWorkspaceFocusItemViewModel {
  id: string;
  origin: "slot" | "completion_gate" | "guardrail" | "change_ledger";
  title: string;
  summary: string;
  detail?: string;
  badgeLabel: string;
  tone: SharedReviewTone;
  locationLabel?: string;
  blockIndex?: number;
}

interface ScreeningWorkspaceFocusItemViewModel {
  id: string;
  origin: "risk" | "decision" | "summary" | "quality_finding";
  title: string;
  summary: string;
  detail?: string;
  badgeLabel: string;
  tone: SharedReviewTone;
  locationLabel?: string;
  blockIndex?: number;
}

export interface ProofreadingConfirmationItemViewModel {
  itemId: string;
  title?: string;
  description?: string;
  severity?: string;
  source?: string;
  issueType?: string;
  blocksFinal?: boolean;
  targetText: string;
  replacementText: string;
  category?: string;
  anchor?: ProofreadingIssueAnchorViewModel;
  suggestionAction?: string;
}

export interface ProofreadingConfirmationDraftState {
  action?: ProofreadingConfirmationDecisionAction;
  editedReplacementText?: string;
  note?: string;
}

export interface ProofreadingIssueSummaryViewModel {
  totalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  filteredCount: number;
  processedCount: number;
  pendingCount: number;
}

export interface ProofreadingIssueMarkerViewModel {
  itemId: string;
  title: string;
  blockIndex: number;
  sectionLabel?: string;
  severity?: string;
  processed: boolean;
  selected: boolean;
  positionPercent: number;
  stackIndex: number;
  stackCount: number;
}

export type ProofreadingSeverityFilter =
  | "all"
  | "critical"
  | "high"
  | "medium"
  | "low";

export type ProofreadingStatusFilter = "all" | "pending" | "processed" | "blocking";

export interface DeepProofreadingEvidenceViewModel {
  schema?: string;
  factLedgerSummary: {
    factCount?: number;
    conflictCount?: number;
  };
  tableFidelityDiagnostics: {
    tableCount?: number;
    highCount?: number;
    mediumCount?: number;
    lowCount?: number;
    unsupportedStructureCount?: number;
    lowConfidenceReviewOnly?: boolean;
  };
  selectedRuleDiagnostics: {
    totalSelected?: number;
  };
  selectedKnowledgeBudgetDiagnostics: {
    totalSelected?: number;
    totalExcluded?: number;
    estimatedTokens?: number;
  };
  passRuns: Array<{
    passKind: string;
    sliceId?: string;
    status?: string;
    issueCount?: number;
  }>;
  stageDiagnostics: Array<{
    passKind: string;
    status?: string;
    issueCount?: number;
  }>;
}

export interface EditingSlotManualSaveInput {
  slotKey: string;
  resolutionKind: EditingSlotManualResolutionKind;
  resolvedText?: string;
  selectedCandidateId?: string;
  note?: string;
}
export interface ManuscriptWorkbenchAssetDetailPageProps {
  mode: ManuscriptWorkbenchMode;
  manuscriptTitle: string;
  asset: DocumentAssetViewModel;
  detailKind: ManuscriptAssetDetailKind;
  backHref: string;
  downloadHref: string;
  previewAsset?: DocumentAssetViewModel | null;
  previewDownloadHref?: string | null;
  previewSession?: DocumentPreviewSessionViewModel | null;
  reportBody?: string | null;
  changeLedger?: readonly EditingChangeLedgerEntry[];
  editingGuardrails?: readonly EditingGuardrailEntry[];
  editingSlotSummary?: EditingSlotGovernanceSummary | null;
  editingCompletionGateSummary?: EditingCompletionGateSummary | null;
  editingRuntimeBindingExplanation?: Record<string, unknown> | null;
  editingAutomaticActionLedger?: readonly Record<string, unknown>[];
  executionSnapshot?: ExecutionTrackingSnapshotViewModel | null;
  knowledgeHitLogs?: readonly KnowledgeHitLogViewModel[];
  knowledgeReferences?: Readonly<
    Record<string, ManuscriptWorkbenchKnowledgeReferenceViewModel>
  >;
  deepProofreadingEvidence?: DeepProofreadingEvidenceViewModel | null;
  confirmationItems?: readonly ProofreadingConfirmationItemViewModel[];
  confirmationState?: Readonly<Record<string, ProofreadingConfirmationDraftState>>;
  humanReviewDiffItems?: readonly HumanReviewDiffItemViewModel[];
  humanReviewPreflight?: HumanReviewPublishPreflightResultViewModel | null;
  humanReviewModule?: HumanReviewPublishModule | null;
  screeningDocumentBlocks?: readonly ProofreadingDocumentBlockViewModel[];
  screeningWorkspaceFocusItems?: readonly ScreeningWorkspaceFocusItemViewModel[];
  editingDocumentBlocks?: readonly ProofreadingDocumentBlockViewModel[];
  proofreadingDocumentBlocks?: readonly ProofreadingDocumentBlockViewModel[];
  activeProofreadingIssueId?: string;
  activeProofreadingLocateTarget?: DocumentPreviewLocateTargetViewModel | null;
  isFinalizeEnabled?: boolean;
  isFinalizing?: boolean;
  isHumanReviewUpdating?: boolean;
  savingEditingSlotKey?: string | null;
  onProofreadingIssueSelect?(itemId: string): void;
  onConfirmationActionChange?(
    itemId: string,
    action: ProofreadingConfirmationDecisionAction,
  ): void;
  onConfirmationEditedReplacementTextChange?(itemId: string, value: string): void;
  onConfirmationNoteChange?(itemId: string, value: string): void;
  onSaveDraft?(): void;
  draftSaveLabel?: string;
  isDraftSaving?: boolean;
  onHumanReviewDecisionChange?(input: HumanReviewQueueDecisionChangeInput): void;
  onHumanReviewBatchDecisionChange?(
    input: HumanReviewQueueBatchDecisionChangeInput,
  ): void;
  onHumanReviewPreflight?(): void;
  onHumanReviewPublish?(): void;
  onHumanReviewRetryBackflow?(diffItemId: string): void;
  onEditingSlotSave?(input: EditingSlotManualSaveInput): void;
  onFinalize?(): void;
}

export function buildWorkbenchAssetDetailHref(input: {
  mode: ManuscriptWorkbenchMode;
  manuscriptId: string;
  assetId: string;
  presentation?: "fullscreen";
  reviewedCaseSnapshotId?: string;
  sampleSetItemId?: string;
}): string {
  return formatWorkbenchHash(input.mode, {
    manuscriptId: input.manuscriptId,
    assetId: input.assetId,
    presentation: input.presentation,
    reviewedCaseSnapshotId: input.reviewedCaseSnapshotId,
    sampleSetItemId: input.sampleSetItemId,
  });
}

export function buildWorkbenchAssetCollectionHref(input: {
  mode: ManuscriptWorkbenchMode;
  manuscriptId: string;
  reviewedCaseSnapshotId?: string;
  sampleSetItemId?: string;
}): string {
  return formatWorkbenchHash(input.mode, {
    manuscriptId: input.manuscriptId,
    reviewedCaseSnapshotId: input.reviewedCaseSnapshotId,
    sampleSetItemId: input.sampleSetItemId,
  });
}

export function resolveManuscriptAssetDetailKind(input: {
  mode: ManuscriptWorkbenchMode;
  assetType: DocumentAssetViewModel["asset_type"];
}): ManuscriptAssetDetailKind {
  if (input.mode === "screening" && input.assetType === "screening_report") {
    return "screening_workspace";
  }

  if (input.mode === "proofreading") {
    if (input.assetType === "proofreading_draft_report") {
      return "proofreading_workspace";
    }

    if (input.assetType === "final_proof_annotated_docx") {
      return "proofreading_confirmation";
    }
  }

  if (
    input.assetType === "screening_report" ||
    input.assetType === "final_proof_issue_report"
  ) {
    return "report_preview";
  }

  return "document_preview";
}

export function isPreviewableDocumentAsset(
  asset: DocumentAssetViewModel,
): boolean {
  return resolveManuscriptAssetDetailKind({
    mode: asset.source_module === "proofreading" ? "proofreading" : "editing",
    assetType: asset.asset_type,
  }) === "document_preview";
}

export function buildEditingChangeLedgerEntries(
  job: Pick<JobViewModel, "payload"> | null | undefined,
): EditingChangeLedgerEntry[] {
  const payload = asRecord(job?.payload);
  if (!Array.isArray(payload?.appliedChanges)) {
    return [];
  }

  return payload.appliedChanges.flatMap((entry, index) => {
    const change = asRecord(entry);
    const before = readOptionalString(change?.before);
    const after = readOptionalString(change?.after);
    if (!before || !after) {
      return [];
    }

    return [
      {
        id: `change-${index + 1}`,
        sourceLabel:
          readOptionalString(change?.ruleId) ??
          readOptionalString(change?.source) ??
          `change-${index + 1}`,
        before,
        after,
        locationText: formatLocationText(change?.semantic_hit),
        blockIndex:
          typeof change?.blockIndex === "number" && Number.isInteger(change.blockIndex)
            ? change.blockIndex
            : undefined,
      },
    ];
  });
}

export function buildEditingGuardrailEntries(
  job: Pick<JobViewModel, "payload"> | null | undefined,
): EditingGuardrailEntry[] {
  const payload = asRecord(job?.payload);
  const plan = asRecord(payload?.editingPlan);
  const deduped = new Map<string, EditingGuardrailEntry>();

  for (const item of readStringArray(plan?.manualReviewItems)) {
    const entry = parseEditingGuardrailManualReviewItem(item);
    if (!entry) {
      continue;
    }

    deduped.set(
      `${entry.sourceStage}:${entry.reasonCode}:${entry.excerpt}`,
      entry,
    );
  }

  if (Array.isArray(payload?.skippedAiReplacements)) {
    for (const [index, item] of payload.skippedAiReplacements.entries()) {
      const replacement = asRecord(item);
      const reasonCode = readOptionalString(replacement?.reason);
      const excerpt =
        readOptionalString(replacement?.targetText) ??
        readOptionalString(replacement?.replacementId);
      if (!reasonCode || !excerpt) {
        continue;
      }

      const entry: EditingGuardrailEntry = {
        id: `editing-guardrail-docx-${index + 1}`,
        sourceStage: "docx_transform",
        reasonCode,
        excerpt,
      };
      deduped.set(
        `${entry.sourceStage}:${entry.reasonCode}:${entry.excerpt}`,
        entry,
      );
    }
  }

  return Array.from(deduped.values());
}

export function buildEditingSlotGovernanceSummary(
  job: Pick<JobViewModel, "payload"> | null | undefined,
): EditingSlotGovernanceSummary | undefined {
  const payload = asRecord(job?.payload);
  const summary = asRecord(payload?.slotGovernanceSummary);
  if (
    !summary ||
    !Array.isArray(summary.slots) ||
    !Array.isArray(summary.blocking_slot_keys) ||
    typeof summary.unresolved_required_count !== "number" ||
    (summary.observation_status !== "reported" &&
      summary.observation_status !== "failed_open")
  ) {
    return undefined;
  }

  return structuredClone(summary as unknown as EditingSlotGovernanceSummary);
}

export function buildEditingCompletionGateSummary(
  job: Pick<JobViewModel, "payload"> | null | undefined,
): EditingCompletionGateSummary | undefined {
  const payload = asRecord(job?.payload);
  const summary = asRecord(payload?.editingCompletionGateSummary);
  if (
    !summary ||
    !Array.isArray(summary.unresolved_required_slots) ||
    !Array.isArray(summary.pending_manual_resolution_items) ||
    !Array.isArray(summary.high_risk_object_items) ||
    !Array.isArray(summary.table_high_risk_items) ||
    !Array.isArray(summary.blocking_format_failures) ||
    typeof summary.passed !== "boolean" ||
    typeof summary.blocker_count !== "number" ||
    (summary.observation_status !== "reported" &&
      summary.observation_status !== "failed_open")
  ) {
    return undefined;
  }

  return structuredClone(summary as unknown as EditingCompletionGateSummary);
}

export function buildEditingRuntimeBindingExplanation(
  job: Pick<JobViewModel, "payload"> | null | undefined,
): Record<string, unknown> | undefined {
  const payload = asRecord(job?.payload);
  const explanation = asRecord(payload?.runtimeBindingExplanation);
  return explanation ? structuredClone(explanation) : undefined;
}

export function buildEditingAutomaticActionLedger(
  job: Pick<JobViewModel, "payload"> | null | undefined,
): Record<string, unknown>[] {
  const payload = asRecord(job?.payload);
  if (!Array.isArray(payload?.automaticActionLedger)) {
    return [];
  }

  return payload.automaticActionLedger.flatMap((entry) => {
    const record = asRecord(entry);
    return record ? [structuredClone(record)] : [];
  });
}

export function buildProofreadingConfirmationItems(
  job: Pick<JobViewModel, "payload"> | null | undefined,
): ProofreadingConfirmationItemViewModel[] {
  const payload = asRecord(job?.payload);
  const plan = asRecord(payload?.proofreadingPlan);
  const proofreadingFindings = asRecord(payload?.proofreadingFindings);
  const planIssueItems = Array.isArray(plan?.issues)
    ? plan.issues.flatMap((entry, index) => {
        const issue = asRecord(entry);
        const anchor = asRecord(issue?.anchor);
        const suggestion = asRecord(issue?.suggestion);
        const targetText =
          readOptionalString(anchor?.quote) ??
          readOptionalString(issue?.targetText);
        const replacementText =
          readOptionalString(suggestion?.replacementText) ??
          readOptionalString(issue?.replacementText) ??
          "";
        if (!targetText) {
          return [];
        }

        return [
          {
            itemId: readOptionalString(issue?.itemId) ?? `issue-${index + 1}`,
            title: readOptionalString(issue?.title),
            description: readOptionalString(issue?.description),
            severity: readOptionalString(issue?.severity),
            source: readOptionalString(issue?.source),
            issueType: readOptionalString(issue?.issueType),
            blocksFinal: Boolean(issue?.blocksFinal),
            targetText,
            replacementText,
            anchor: normalizeProofreadingAnchor(anchor, index, targetText),
            suggestionAction: readOptionalString(suggestion?.action),
          },
        ];
      })
    : [];
  const correctionItems =
    planIssueItems.length === 0 && Array.isArray(plan?.corrections)
      ? plan.corrections.flatMap((entry, index) => {
          const correction = asRecord(entry);
          const targetText = readOptionalString(correction?.targetText);
          const replacementText = readOptionalString(correction?.replacementText);
          if (!targetText || !replacementText) {
            return [];
          }

          return [
            {
              itemId: `correction-${index + 1}`,
              issueType: readOptionalString(correction?.category),
              category: readOptionalString(correction?.category),
              targetText,
              replacementText,
              anchor: {
                blockIndex: index,
                quote: targetText,
              },
              suggestionAction: "replace_text",
            },
          ];
        })
      : [];
  const qualityFindingItems =
    buildProofreadingQualityFindingConfirmationItems(proofreadingFindings);
  const failedCheckItems =
    buildProofreadingFailedCheckConfirmationItems(proofreadingFindings);
  const baseItems = planIssueItems.length > 0 ? planIssueItems : correctionItems;

  return dedupeProofreadingConfirmationItems([
    ...baseItems,
    ...qualityFindingItems,
    ...failedCheckItems,
  ]);
}

export function buildProofreadingDocumentBlocks(
  job: Pick<JobViewModel, "payload"> | null | undefined,
): ProofreadingDocumentBlockViewModel[] {
  return buildWorkbenchDocumentBlocks({
    job,
    payloadKey: "proofreadingSourceBlocks",
    blockPrefix: "proofreading-block",
  });
}

export function buildDeepProofreadingEvidence(
  job: Pick<JobViewModel, "payload"> | null | undefined,
): DeepProofreadingEvidenceViewModel | null {
  const payload = asRecord(job?.payload);
  const deepProofreading = asRecord(payload?.deepProofreading);
  if (!deepProofreading) {
    return null;
  }

  const factLedgerSummary = asRecord(deepProofreading.factLedgerSummary);
  const tableFidelityDiagnostics = asRecord(
    deepProofreading.tableFidelityDiagnostics,
  );
  const confidenceCounts = asRecord(tableFidelityDiagnostics?.confidenceCounts);
  const selectedRuleDiagnostics = asRecord(
    deepProofreading.selectedRuleDiagnostics,
  );
  const selectedKnowledgeBudgetDiagnostics = asRecord(
    deepProofreading.selectedKnowledgeBudgetDiagnostics,
  );

  return {
    schema: readOptionalString(deepProofreading.schema),
    factLedgerSummary: {
      factCount: readOptionalNumber(factLedgerSummary?.factCount),
      conflictCount: readOptionalNumber(factLedgerSummary?.conflictCount),
    },
    tableFidelityDiagnostics: {
      tableCount: readOptionalNumber(tableFidelityDiagnostics?.tableCount),
      highCount: readOptionalNumber(confidenceCounts?.high),
      mediumCount: readOptionalNumber(confidenceCounts?.medium),
      lowCount: readOptionalNumber(confidenceCounts?.low),
      unsupportedStructureCount: readOptionalNumber(
        tableFidelityDiagnostics?.unsupportedStructureCount,
      ),
      lowConfidenceReviewOnly:
        tableFidelityDiagnostics?.lowConfidenceReviewOnly === true,
    },
    selectedRuleDiagnostics: {
      totalSelected: readOptionalNumber(selectedRuleDiagnostics?.totalSelected),
    },
    selectedKnowledgeBudgetDiagnostics: {
      totalSelected: readOptionalNumber(
        selectedKnowledgeBudgetDiagnostics?.totalSelected,
      ),
      totalExcluded: readOptionalNumber(
        selectedKnowledgeBudgetDiagnostics?.totalExcluded,
      ),
      estimatedTokens: readOptionalNumber(
        selectedKnowledgeBudgetDiagnostics?.estimatedTokens,
      ),
    },
    passRuns: Array.isArray(deepProofreading.passRuns)
      ? deepProofreading.passRuns.flatMap((entry) => {
          const passRun = asRecord(entry);
          const passKind = readOptionalString(passRun?.passKind);
          if (!passKind) {
            return [];
          }
          return [
            {
              passKind,
              sliceId: readOptionalString(passRun?.sliceId),
              status: readOptionalString(passRun?.status),
              issueCount: readOptionalNumber(passRun?.issueCount),
            },
          ];
        })
      : [],
    stageDiagnostics: Array.isArray(deepProofreading.stageDiagnostics)
      ? deepProofreading.stageDiagnostics.flatMap((entry) => {
          const stage = asRecord(entry);
          const passKind = readOptionalString(stage?.passKind);
          if (!passKind) {
            return [];
          }
          return [
            {
              passKind,
              status: readOptionalString(stage?.status),
              issueCount: readOptionalNumber(stage?.issueCount),
            },
          ];
        })
      : [],
  };
}

export function buildScreeningDocumentBlocks(
  job: Pick<JobViewModel, "payload"> | null | undefined,
): ProofreadingDocumentBlockViewModel[] {
  return buildWorkbenchDocumentBlocks({
    job,
    payloadKey: "screeningSourceBlocks",
    blockPrefix: "screening-block",
  });
}

export function buildEditingDocumentBlocks(
  job: Pick<JobViewModel, "payload"> | null | undefined,
): ProofreadingDocumentBlockViewModel[] {
  return buildWorkbenchDocumentBlocks({
    job,
    payloadKey: "editingSourceBlocks",
    blockPrefix: "editing-block",
  });
}

function buildWorkbenchDocumentBlocks(input: {
  job: Pick<JobViewModel, "payload"> | null | undefined;
  payloadKey:
    | "proofreadingSourceBlocks"
    | "editingSourceBlocks"
    | "screeningSourceBlocks";
  blockPrefix: string;
}): ProofreadingDocumentBlockViewModel[] {
  const payload = asRecord(input.job?.payload);
  const blocks = payload?.[input.payloadKey];
  if (!Array.isArray(blocks)) {
    return [];
  }

  return blocks.flatMap((entry, index) => {
    const block = asRecord(entry);
    const text = readOptionalString(block?.text);
    if (!text) {
      return [];
    }

    const blockIndex =
      typeof block?.blockIndex === "number" && Number.isInteger(block.blockIndex)
        ? block.blockIndex
        : index;
    const sourceLocator = readOptionalString(block?.source_locator);

    return [
      {
        blockId: `${input.blockPrefix}-${blockIndex}`,
        blockIndex,
        ...(sourceLocator ? { sourceLocator } : {}),
        sectionLabel: readOptionalString(block?.section),
        blockKind: readOptionalString(block?.block_kind),
        text,
      },
    ];
  });
}

function buildEditingWorkspaceFocusItems(input: {
  documentBlocks: readonly ProofreadingDocumentBlockViewModel[];
  changeLedger: readonly EditingChangeLedgerEntry[];
  editingGuardrails: readonly EditingGuardrailEntry[];
  editingSlotSummary?: EditingSlotGovernanceSummary | null;
  editingCompletionGateSummary?: EditingCompletionGateSummary | null;
}): EditingWorkspaceFocusItemViewModel[] {
  const items: EditingWorkspaceFocusItemViewModel[] = [];

  for (const slot of input.editingSlotSummary?.slots ?? []) {
    if (slot.state === "resolved_auto") {
      continue;
    }

    const primaryCandidate = slot.candidates[0];
    const blockIndex = resolveEditingDocumentBlockIndex({
      documentBlocks: input.documentBlocks,
      locator: primaryCandidate?.source_locator,
      excerpts: [
        primaryCandidate?.raw_text,
        primaryCandidate?.normalized_text,
        slot.resolved_text,
      ],
    });
    const detailParts = [
      slot.required ? "必填槽位" : "非必填槽位",
      `完成门槛：${slot.completion_gate}`,
      primaryCandidate?.source_locator ? `来源：${primaryCandidate.source_locator}` : undefined,
    ].filter((value): value is string => Boolean(value));

    items.push({
      id: `slot:${slot.slot_key}`,
      origin: "slot",
      title: `槽位 · ${slot.label}`,
      summary: slot.resolution_reason,
      detail: detailParts.join(" · ") || undefined,
      badgeLabel: formatEditingSlotStateLabel(slot.state),
      tone: slot.state === "resolved_manual" ? "neutral" : "error",
      locationLabel: primaryCandidate?.source_locator ?? slot.anchor,
      blockIndex,
    });
  }

  for (const item of flattenEditingCompletionGateItems(
    input.editingCompletionGateSummary,
  )) {
    items.push({
      id: `gate:${item.item_key}`,
      origin: "completion_gate",
      title: `门禁 · ${item.summary}`,
      summary:
        item.detail ?? `${formatEditingCompletionGateSourceLabel(item.source)}待处理`,
      detail: formatEditingCompletionGatePendingItemMeta(item),
      badgeLabel: formatEditingCompletionGatePendingCategoryLabel(item.category),
      tone:
        item.status === "resolved"
          ? "success"
          : item.status === "waived"
            ? "neutral"
            : "error",
      locationLabel: item.location_text ?? item.related_slot_key,
      blockIndex: resolveEditingDocumentBlockIndex({
        documentBlocks: input.documentBlocks,
        locator: item.location_text,
        excerpts: [item.summary, item.detail],
      }),
    });
  }

  for (const entry of input.editingGuardrails) {
    items.push({
      id: `guardrail:${entry.id}`,
      origin: "guardrail",
      title: `拦截 · ${formatEditingGuardrailReasonLabel(entry.reasonCode)}`,
      summary: entry.excerpt,
      detail: formatEditingGuardrailSourceStageLabel(entry.sourceStage),
      badgeLabel: "守门拦截",
      tone: "error",
      blockIndex: resolveEditingDocumentBlockIndex({
        documentBlocks: input.documentBlocks,
        excerpts: [entry.excerpt],
      }),
    });
  }

  for (const entry of input.changeLedger) {
    items.push({
      id: `ledger:${entry.id}`,
      origin: "change_ledger",
      title: `改动 · ${entry.sourceLabel}`,
      summary: `${entry.before} -> ${entry.after}`,
      detail: entry.locationText,
      badgeLabel: "已落稿改动",
      tone: "success",
      locationLabel: entry.locationText,
      blockIndex: resolveEditingDocumentBlockIndex({
        documentBlocks: input.documentBlocks,
        explicitBlockIndex: entry.blockIndex,
        locator: entry.locationText,
        excerpts: [entry.before, entry.after],
      }),
    });
  }

  return items;
}

export function buildScreeningWorkspaceFocusItems(input: {
  job: Pick<JobViewModel, "payload"> | null | undefined;
  documentBlocks: readonly ProofreadingDocumentBlockViewModel[];
}): ScreeningWorkspaceFocusItemViewModel[] {
  const payload = asRecord(input.job?.payload);
  const screeningReport = asRecord(payload?.screeningReport);
  const qualityFindingSummary = asRecord(payload?.qualityFindingSummary);
  const majorFindings = readStringArray(screeningReport?.majorFindings);
  const minorFindings = readStringArray(screeningReport?.minorFindings);
  const medicalReviewSignals = Array.isArray(payload?.medicalReviewSignals)
    ? payload.medicalReviewSignals
    : [];
  const items: ScreeningWorkspaceFocusItemViewModel[] = [];
  const riskLevel = readOptionalString(screeningReport?.riskLevel);
  const recommendedDecision = readOptionalString(screeningReport?.recommendedDecision);
  const summary = readOptionalString(screeningReport?.summary);
  const highestAction = readOptionalString(qualityFindingSummary?.highest_action);

  if (riskLevel) {
    const riskDetailParts = [
      highestAction
        ? `最高动作：${formatQualityActionLabel(
            highestAction as
              NonNullable<
                NonNullable<
                  ExecutionTrackingSnapshotViewModel["quality_findings_summary"]
                >["highest_action"]
              >,
          )}`
        : undefined,
      medicalReviewSignals.length > 0
        ? `医学复核信号：${medicalReviewSignals.length} 项`
        : undefined,
    ].filter((value): value is string => Boolean(value));

    items.push({
      id: "screening-risk",
      origin: "risk",
      title: "风险等级",
      summary: formatScreeningRiskLevelLabel(riskLevel),
      detail: riskDetailParts.join(" · ") || undefined,
      badgeLabel: "总体风险",
      tone: resolveScreeningRiskTone(riskLevel),
    });
  }

  if (recommendedDecision) {
    items.push({
      id: "screening-decision",
      origin: "decision",
      title: "建议结论",
      summary: formatScreeningDecisionLabel(recommendedDecision),
      detail:
        majorFindings.length > 0
          ? `主要发现 ${majorFindings.length} 项`
          : minorFindings.length > 0
            ? `次要发现 ${minorFindings.length} 项`
            : undefined,
      badgeLabel: "处理建议",
      tone: resolveScreeningDecisionTone(recommendedDecision),
    });
  }

  if (
    summary ||
    majorFindings.length > 0 ||
    minorFindings.length > 0 ||
    typeof qualityFindingSummary?.total_issue_count === "number"
  ) {
    const summaryDetailParts = [
      majorFindings.length > 0 ? `主要发现：${majorFindings.join("；")}` : undefined,
      minorFindings.length > 0 ? `次要发现：${minorFindings.join("；")}` : undefined,
      typeof qualityFindingSummary?.total_issue_count === "number"
        ? `质量问题：${qualityFindingSummary.total_issue_count} 项`
        : undefined,
    ].filter((value): value is string => Boolean(value));

    items.push({
      id: "screening-summary",
      origin: "summary",
      title: "证据摘要",
      summary: summary ?? "已生成初筛摘要，可结合正文继续人工判断。",
      detail: summaryDetailParts.join(" · ") || undefined,
      badgeLabel: "摘要",
      tone: "neutral",
    });
  }

  if (Array.isArray(payload?.qualityFindings)) {
    for (const [index, entry] of payload.qualityFindings.entries()) {
      const finding = asRecord(entry);
      if (!finding) {
        continue;
      }

      const severity = readOptionalString(finding.severity);
      const action = readOptionalString(finding.action);
      const excerpt = readOptionalString(finding.text_excerpt);
      const explanation = readOptionalString(finding.explanation);
      const issueSummary = readOptionalString(finding.summary);
      const blockIndex = resolveEditingDocumentBlockIndex({
        documentBlocks: input.documentBlocks,
        explicitBlockIndex:
          typeof finding.paragraph_index === "number" &&
          Number.isInteger(finding.paragraph_index)
            ? finding.paragraph_index
            : undefined,
        excerpts: [excerpt, issueSummary, explanation],
      });
      const detailParts = [
        issueSummary,
        excerpt ? `原文：${excerpt}` : undefined,
        action
          ? `动作：${formatQualityActionLabel(
              action as NonNullable<
                NonNullable<
                  ExecutionTrackingSnapshotViewModel["quality_findings_summary"]
                >["highest_action"]
              >,
            )}`
          : undefined,
        readOptionalString(finding.source_id)
          ? `来源：${readOptionalString(finding.source_id)}`
          : undefined,
      ].filter((value): value is string => Boolean(value));

      items.push({
        id:
          readOptionalString(finding.issue_id) ??
          `screening-quality-finding-${index + 1}`,
        origin: "quality_finding",
        title:
          readOptionalString(finding.issue_type) ??
          `质量命中 ${index + 1}`,
        summary: explanation ?? issueSummary ?? excerpt ?? "需要人工核查。",
        detail: detailParts.join(" · ") || undefined,
        badgeLabel: severity ? formatSeverityLabel(severity) : "中",
        tone: resolveScreeningFindingTone(severity, action),
        locationLabel:
          typeof finding.paragraph_index === "number"
            ? `段落 ${finding.paragraph_index}`
            : undefined,
        blockIndex,
      });
    }
  }

  return items;
}

function flattenEditingCompletionGateItems(
  summary?: EditingCompletionGateSummary | null,
): EditingCompletionGateSummary["unresolved_required_slots"] {
  if (!summary) {
    return [];
  }

  return [
    ...summary.unresolved_required_slots,
    ...summary.pending_manual_resolution_items,
    ...summary.high_risk_object_items,
    ...summary.table_high_risk_items,
    ...summary.blocking_format_failures,
  ];
}

export function buildAssetPreviewComments(input: {
  asset: DocumentAssetViewModel;
  job: Pick<JobViewModel, "payload"> | null | undefined;
}): Array<{
  id: string;
  author?: string;
  body: string;
  anchor_text?: string;
}> {
  if (input.asset.asset_type === "edited_docx") {
    return buildEditingChangeLedgerEntries(input.job).map((entry) => ({
      id: entry.id,
      author: "AI 编辑",
      body: `${entry.before} -> ${entry.after}`,
      anchor_text: entry.before,
    }));
  }

  const confirmationItems = buildProofreadingConfirmationItems(input.job);
  if (confirmationItems.length > 0) {
    return confirmationItems.map((item) => ({
      id: item.itemId,
      author: "AI 校对",
      body: item.replacementText
        ? `${item.targetText} -> ${item.replacementText}`
        : item.description ?? item.targetText,
      anchor_text: item.targetText,
    }));
  }

  const payload = asRecord(input.job?.payload);
  if (Array.isArray(payload?.confirmationDecisions)) {
    return payload.confirmationDecisions.flatMap((entry, index) => {
      const decision = asRecord(entry);
      const targetText = readOptionalString(decision?.targetText);
      const replacementText =
        readOptionalString(decision?.finalReplacementText) ??
        readOptionalString(decision?.replacementText);
      if (!targetText || !replacementText) {
        return [];
      }

      return [
        {
          id: readOptionalString(decision?.itemId) ?? `decision-${index + 1}`,
          author: "人工确认",
          body: `${targetText} -> ${replacementText}`,
          anchor_text: targetText,
        },
      ];
    });
  }

  return [];
}

export function buildProofreadingConfirmationDraftState(
  job: Pick<JobViewModel, "payload"> | null | undefined,
): Record<string, ProofreadingConfirmationDraftState> {
  const payload = asRecord(job?.payload);
  const confirmationDraft = asRecord(payload?.confirmationDraft);
  const serializedDecisions = Array.isArray(confirmationDraft?.confirmationDecisions)
    ? confirmationDraft.confirmationDecisions
    : Array.isArray(payload?.confirmationDecisions)
      ? payload.confirmationDecisions
      : [];

  return serializedDecisions.reduce<Record<string, ProofreadingConfirmationDraftState>>(
    (result, entry) => {
      const decision = asRecord(entry);
      const itemId = readOptionalString(decision?.itemId);
      const action = readOptionalString(decision?.action) as
        | ProofreadingConfirmationDecisionAction
        | undefined;

      if (!itemId || !action) {
        return result;
      }

      result[itemId] = {
        action,
        ...(readOptionalString(decision?.finalReplacementText) ??
        readOptionalString(decision?.editedReplacementText)
          ? {
              editedReplacementText:
                readOptionalString(decision?.finalReplacementText) ??
                readOptionalString(decision?.editedReplacementText),
            }
          : {}),
        ...(readOptionalString(decision?.note)
          ? {
              note: readOptionalString(decision?.note),
            }
          : {}),
      };

      return result;
    },
    {},
  );
}

export function buildProofreadingIssueSummary(
  items: readonly ProofreadingConfirmationItemViewModel[],
  confirmationState: Readonly<Record<string, ProofreadingConfirmationDraftState>>,
  filteredCount = items.length,
): ProofreadingIssueSummaryViewModel {
  const highCount = items.filter((item) =>
    item.severity === "high" || item.severity === "critical"
  ).length;
  const mediumCount = items.filter((item) => item.severity === "medium").length;
  const lowCount = items.filter((item) => {
    const severity = item.severity ?? "low";
    return severity !== "high" && severity !== "critical" && severity !== "medium";
  }).length;
  const processedCount = items.filter((item) => confirmationState[item.itemId]?.action).length;

  return {
    totalCount: items.length,
    highCount,
    mediumCount,
    lowCount,
    filteredCount,
    processedCount,
    pendingCount: Math.max(items.length - processedCount, 0),
  };
}

export function filterProofreadingConfirmationItems(input: {
  items: readonly ProofreadingConfirmationItemViewModel[];
  confirmationState: Readonly<Record<string, ProofreadingConfirmationDraftState>>;
  severityFilter: ProofreadingSeverityFilter;
  statusFilter: ProofreadingStatusFilter;
}): ProofreadingConfirmationItemViewModel[] {
  return input.items.filter((item) => {
    if (
      input.severityFilter !== "all" &&
      (item.severity ?? "low") !== input.severityFilter
    ) {
      return false;
    }

    const draft = input.confirmationState[item.itemId];
    const isProcessed = Boolean(draft?.action);
    const isBlocking =
      item.blocksFinal || item.severity === "high" || item.severity === "critical";

    switch (input.statusFilter) {
      case "pending":
        return !isProcessed;
      case "processed":
        return isProcessed;
      case "blocking":
        return isBlocking;
      default:
        return true;
    }
  });
}

export function buildProofreadingIssueMarkers(input: {
  items: readonly ProofreadingConfirmationItemViewModel[];
  confirmationState: Readonly<Record<string, ProofreadingConfirmationDraftState>>;
  proofreadingDocumentBlocks: readonly ProofreadingDocumentBlockViewModel[];
  activeIssueId?: string;
}): ProofreadingIssueMarkerViewModel[] {
  const anchoredItems = input.items
    .filter(
      (item): item is ProofreadingConfirmationItemViewModel & {
        anchor: NonNullable<ProofreadingConfirmationItemViewModel["anchor"]>;
      } => Boolean(item.anchor),
    )
    .sort((left, right) => {
      const blockDelta = left.anchor.blockIndex - right.anchor.blockIndex;
      if (blockDelta !== 0) {
        return blockDelta;
      }

      return left.itemId.localeCompare(right.itemId);
    });

  if (anchoredItems.length === 0) {
    return [];
  }

  const maxDocumentBlockIndex = Math.max(
    ...input.proofreadingDocumentBlocks.map((block) => block.blockIndex),
    ...anchoredItems.map((item) => item.anchor.blockIndex),
    0,
  );
  const markersPerBlock = anchoredItems.reduce<Map<number, number>>((result, item) => {
    result.set(item.anchor.blockIndex, (result.get(item.anchor.blockIndex) ?? 0) + 1);
    return result;
  }, new Map<number, number>());
  const runningStackByBlock = new Map<number, number>();

  return anchoredItems.map((item) => {
    const blockIndex = item.anchor.blockIndex;
    const stackIndex = runningStackByBlock.get(blockIndex) ?? 0;
    runningStackByBlock.set(blockIndex, stackIndex + 1);

    return {
      itemId: item.itemId,
      title: item.title ?? item.issueType ?? item.itemId,
      blockIndex,
      sectionLabel: item.anchor.sectionLabel,
      severity: item.severity,
      processed: Boolean(input.confirmationState[item.itemId]?.action),
      selected: item.itemId === input.activeIssueId,
      positionPercent:
        maxDocumentBlockIndex <= 0 ? 0 : (blockIndex / maxDocumentBlockIndex) * 100,
      stackIndex,
      stackCount: markersPerBlock.get(blockIndex) ?? 1,
    };
  });
}

export function resolveProofreadingFallbackFocusTarget(input: {
  proofreadingDocumentBlocks: readonly ProofreadingDocumentBlockViewModel[];
  activeBlockIndex?: number | null;
}): {
  blockId: string;
  blockIndex: number;
} | null {
  if (typeof input.activeBlockIndex !== "number" || !Number.isInteger(input.activeBlockIndex)) {
    return null;
  }

  const matchingBlock = input.proofreadingDocumentBlocks.find(
    (block) => block.blockIndex === input.activeBlockIndex,
  );
  if (!matchingBlock) {
    return null;
  }

  return {
    blockId: matchingBlock.blockId,
    blockIndex: matchingBlock.blockIndex,
  };
}

export function buildAssetReportPreviewBody(
  job: Pick<JobViewModel, "payload"> | null | undefined,
): string | null {
  const payload = asRecord(job?.payload);
  const reportMarkdown = readOptionalString(payload?.reportMarkdown);
  if (reportMarkdown) {
    return reportMarkdown;
  }

  const screeningReport = asRecord(payload?.screeningReport);
  if (screeningReport) {
    const sections = [
      "# 初筛报告",
      "",
      readOptionalString(screeningReport.summary)
        ? `摘要：${readOptionalString(screeningReport.summary)}`
        : "",
      readOptionalString(screeningReport.riskLevel)
        ? `风险等级：${readOptionalString(screeningReport.riskLevel)}`
        : "",
      readOptionalString(screeningReport.recommendedDecision)
        ? `建议结论：${readOptionalString(screeningReport.recommendedDecision)}`
        : "",
      "",
      ...renderStringArraySection(
        "主要发现",
        readStringArray(screeningReport.majorFindings),
      ),
      ...renderStringArraySection(
        "次要发现",
        readStringArray(screeningReport.minorFindings),
      ),
    ].filter((line) => line.length > 0);

    return sections.join("\n");
  }

  const plan = asRecord(payload?.proofreadingPlan);
  if (plan) {
    const sections = [
      "# 校对报告",
      "",
      readOptionalString(plan.summary) ? `摘要：${readOptionalString(plan.summary)}` : "",
      ...renderProofreadingIssueSection(buildProofreadingConfirmationItems(job)),
      ...renderStringArraySection(
        "人工核验",
        readStringArray(plan.manualReviewItems),
      ),
    ].filter((line) => line.length > 0);

    return sections.join("\n");
  }

  return null;
}

export function ManuscriptWorkbenchAssetDetailPage({
  mode,
  manuscriptTitle,
  asset,
  detailKind,
  backHref,
  downloadHref,
  previewAsset = null,
  previewDownloadHref = null,
  previewSession = null,
  reportBody = null,
  changeLedger = [],
  editingGuardrails = [],
  editingSlotSummary = null,
  editingCompletionGateSummary = null,
  editingRuntimeBindingExplanation = null,
  editingAutomaticActionLedger = [],
  executionSnapshot = null,
  knowledgeHitLogs = [],
  knowledgeReferences,
  deepProofreadingEvidence = null,
  confirmationItems = [],
  confirmationState = {},
  humanReviewDiffItems = [],
  humanReviewPreflight = null,
  humanReviewModule = null,
  screeningDocumentBlocks = [],
  screeningWorkspaceFocusItems = [],
  editingDocumentBlocks = [],
  proofreadingDocumentBlocks = [],
  activeProofreadingIssueId,
  activeProofreadingLocateTarget = null,
  isFinalizeEnabled = false,
  isFinalizing = false,
  isHumanReviewUpdating = false,
  savingEditingSlotKey = null,
  onProofreadingIssueSelect,
  onConfirmationActionChange,
  onConfirmationEditedReplacementTextChange,
  onConfirmationNoteChange,
  onSaveDraft,
  draftSaveLabel,
  isDraftSaving = false,
  onHumanReviewDecisionChange,
  onHumanReviewBatchDecisionChange,
  onHumanReviewPreflight,
  onHumanReviewPublish,
  onHumanReviewRetryBackflow,
  onEditingSlotSave,
  onFinalize,
}: ManuscriptWorkbenchAssetDetailPageProps) {
  const assetRoleLabel = formatWorkbenchAssetTypeLabel(asset.asset_type);
  const assetDisplayName = buildWorkbenchAssetDisplayName(manuscriptTitle, asset);
  const previewOperationalState = resolvePreviewOperationalState({
    asset,
    previewSession,
  });
  const [severityFilter, setSeverityFilter] = React.useState<ProofreadingSeverityFilter>("all");
  const [statusFilter, setStatusFilter] = React.useState<ProofreadingStatusFilter>("all");
  const governanceEvidenceCard = renderGovernanceEvidenceCard({
    executionSnapshot,
    knowledgeHitLogs,
    knowledgeReferences,
  });
  const editingGuardrailCard =
    editingGuardrails.length > 0
      ? renderEditingGuardrailCard({
          entries: editingGuardrails,
        })
      : null;
  const editingCompletionGateCard = editingCompletionGateSummary
    ? <EditingCompletionGateCard summary={editingCompletionGateSummary} />
    : null;
  const editingRuntimeBindingCard = editingRuntimeBindingExplanation
    ? (
        <EditingRuntimeBindingCard
          explanation={editingRuntimeBindingExplanation}
          automaticActionLedger={editingAutomaticActionLedger}
        />
      )
    : null;
  const changeLedgerCard =
    changeLedger.length > 0
      ? (
          <article className="manuscript-workbench-detail-ledger-card">
            <div className="manuscript-workbench-detail-card-header">
              <div>
                <h4>改动台账</h4>
                <p>这里展示 AI 编辑已落地的真实改动。</p>
              </div>
            </div>
            <ul className="manuscript-workbench-detail-ledger-list">
              {changeLedger.map((entry) => (
                <li key={entry.id} className="manuscript-workbench-detail-ledger-item">
                  <header>
                    <strong>{entry.sourceLabel}</strong>
                    {entry.locationText ? <span>{entry.locationText}</span> : null}
                  </header>
                  <dl>
                    <div>
                      <dt>修改前</dt>
                      <dd>{entry.before}</dd>
                    </div>
                    <div>
                      <dt>修改后</dt>
                      <dd>{entry.after}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </article>
        )
      : null;
  const editingSlotGovernanceCard =
    editingSlotSummary?.slots.length
      ? (
          <EditingSlotGovernanceCard
            assetId={asset.id}
            summary={editingSlotSummary}
            savingSlotKey={savingEditingSlotKey}
            onSave={onEditingSlotSave}
          />
        )
      : null;
  const [activeScreeningFocusId, setActiveScreeningFocusId] = React.useState("");
  React.useEffect(() => {
    setActiveScreeningFocusId((current) => {
      if (current && screeningWorkspaceFocusItems.some((item) => item.id === current)) {
        return current;
      }

      return screeningWorkspaceFocusItems[0]?.id ?? "";
    });
  }, [
    asset.id,
    screeningWorkspaceFocusItems.length,
    screeningWorkspaceFocusItems[0]?.id,
  ]);

  const activeScreeningFocus =
    screeningWorkspaceFocusItems.find((item) => item.id === activeScreeningFocusId) ??
    screeningWorkspaceFocusItems[0] ??
    null;
  const activeScreeningBlock =
    activeScreeningFocus?.blockIndex != null
      ? findWorkbenchDocumentBlockByIndex(
          screeningDocumentBlocks,
          activeScreeningFocus.blockIndex,
        )
      : null;

  React.useEffect(() => {
    if (!activeScreeningBlock || typeof document === "undefined") {
      return;
    }

    document.getElementById(activeScreeningBlock.blockId)?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
  }, [asset.id, activeScreeningBlock?.blockId]);

  const editingWorkspaceFocusItems = buildEditingWorkspaceFocusItems({
    documentBlocks: editingDocumentBlocks,
    changeLedger,
    editingGuardrails,
    editingSlotSummary,
    editingCompletionGateSummary,
  });
  const [activeEditingFocusId, setActiveEditingFocusId] = React.useState("");

  React.useEffect(() => {
    setActiveEditingFocusId((current) => {
      if (current && editingWorkspaceFocusItems.some((item) => item.id === current)) {
        return current;
      }

      return editingWorkspaceFocusItems[0]?.id ?? "";
    });
  }, [
    asset.id,
    editingWorkspaceFocusItems.length,
    editingWorkspaceFocusItems[0]?.id,
  ]);

  const activeEditingFocus =
    editingWorkspaceFocusItems.find((item) => item.id === activeEditingFocusId) ??
    editingWorkspaceFocusItems[0] ??
    null;
  const activeEditingBlock =
    activeEditingFocus?.blockIndex != null
      ? findWorkbenchDocumentBlockByIndex(
          editingDocumentBlocks,
          activeEditingFocus.blockIndex,
        )
      : null;

  React.useEffect(() => {
    if (!activeEditingBlock || typeof document === "undefined") {
      return;
    }

    document.getElementById(activeEditingBlock.blockId)?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
  }, [asset.id, activeEditingBlock?.blockId]);

  if (detailKind === "screening_workspace") {
    return (
      <section
        className="manuscript-workbench-detail-page manuscript-workbench-proofreading-layout manuscript-workbench-editing-layout"
        data-detail-kind={detailKind}
        data-screening-layout="shared-review"
      >
        <header className="manuscript-workbench-detail-header">
          <div className="manuscript-workbench-detail-copy">
            <span className="manuscript-workbench-section-eyebrow">
              初筛共享审阅工作台
            </span>
            <h3>左全文右风险建议的初筛审阅台</h3>
            <p>{manuscriptTitle}</p>
          </div>
          <div className="manuscript-workbench-detail-actions">
            <a className="manuscript-workbench-shortcut" href={backHref}>
              返回工作台
            </a>
            <a
              className="manuscript-workbench-shortcut"
              href={downloadHref}
              target="_blank"
              rel="noreferrer"
            >
              打开当前文件
            </a>
            <a className="manuscript-workbench-shortcut" href={downloadHref} download>
              {resolveDetailDownloadLabel(asset)}
            </a>
          </div>
        </header>

        <div className="manuscript-workbench-proofreading-layout-grid manuscript-workbench-editing-layout-grid">
          <article className="manuscript-workbench-proofreading-manuscript-pane">
            <div className="manuscript-workbench-detail-card-header">
              <div>
                <h4>稿件全文</h4>
                <p>{assetDisplayName}</p>
                <small>{assetRoleLabel}</small>
              </div>
            </div>
            {screeningDocumentBlocks.length > 0 ? (
              <div className="manuscript-workbench-proofreading-block-list">
                {screeningDocumentBlocks.map((block) => (
                  <article
                    key={block.blockId}
                    id={block.blockId}
                    className={`manuscript-workbench-proofreading-block${
                      activeScreeningBlock?.blockIndex === block.blockIndex
                        ? " is-selected"
                        : ""
                    }`}
                    data-selected={
                      activeScreeningBlock?.blockIndex === block.blockIndex
                        ? "true"
                        : "false"
                    }
                  >
                    <header>
                      <strong>{formatWorkbenchDocumentBlockLabel(block)}</strong>
                      <span>{block.blockKind ?? "paragraph"}</span>
                    </header>
                    <p>{block.text}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="manuscript-workbench-detail-empty">
                <strong>暂无稿件正文块</strong>
                <p>当前初筛结果没有保存可定位的全文块，暂时无法进入全文定位审阅。</p>
              </div>
            )}
          </article>

          <article className="manuscript-workbench-proofreading-issue-pane manuscript-workbench-editing-focus-pane">
            <div className="manuscript-workbench-detail-card-header">
              <div>
                <h4>风险与建议</h4>
                <p>右侧点击条目后，可在左侧全文继续核对相关上下文。</p>
              </div>
            </div>
            {screeningWorkspaceFocusItems.length > 0 ? (
              <div className="manuscript-workbench-proofreading-issue-list manuscript-workbench-editing-focus-list">
                {screeningWorkspaceFocusItems.map((item) => {
                  const isSelected = activeScreeningFocus?.id === item.id;
                  const linkedBlock =
                    item.blockIndex != null
                      ? findWorkbenchDocumentBlockByIndex(
                          screeningDocumentBlocks,
                          item.blockIndex,
                        )
                      : null;

                  return (
                    <article
                      key={item.id}
                      className={`manuscript-workbench-proofreading-issue${
                        isSelected ? " is-selected" : ""
                      }`}
                    >
                      <button
                        type="button"
                        className="manuscript-workbench-proofreading-issue-toggle"
                        onClick={() => setActiveScreeningFocusId(item.id)}
                      >
                        <div>
                          <strong>{item.title}</strong>
                          <p>
                            {item.locationLabel ??
                              (linkedBlock
                                ? formatWorkbenchDocumentBlockLabel(linkedBlock)
                                : "未定位到正文块")}
                          </p>
                        </div>
                        <span className={resolveTonePillClassName(item.tone)}>
                          {item.badgeLabel}
                        </span>
                      </button>

                      {isSelected ? (
                        <div className="manuscript-workbench-proofreading-issue-detail manuscript-workbench-editing-focus-detail">
                          <p>{item.summary}</p>
                          {item.detail ? <p>{item.detail}</p> : null}
                          <dl className="manuscript-workbench-detail-metadata">
                            <div>
                              <dt>来源</dt>
                              <dd>{formatScreeningWorkspaceFocusOriginLabel(item.origin)}</dd>
                            </div>
                            <div>
                              <dt>正文定位</dt>
                              <dd>
                                {linkedBlock
                                  ? formatWorkbenchDocumentBlockLabel(linkedBlock)
                                  : "当前未定位到正文块"}
                              </dd>
                            </div>
                            {item.locationLabel ? (
                              <div>
                                <dt>原始锚点</dt>
                                <dd>{item.locationLabel}</dd>
                              </div>
                            ) : null}
                          </dl>
                          {linkedBlock ? (
                            <div className="manuscript-workbench-selection-context">
                              <span>正文上下文</span>
                              <strong>{linkedBlock.text}</strong>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="manuscript-workbench-detail-empty">
                <strong>当前没有结构化风险与建议</strong>
                <p>初筛结果已生成，但没有沉淀出可供右栏审阅的结构化条目。</p>
              </div>
            )}
          </article>
        </div>

        <div className="manuscript-workbench-detail-layout manuscript-workbench-detail-layout--supporting">
          {governanceEvidenceCard}
        </div>
      </section>
    );
  }

  if (
    detailKind === "proofreading_workspace" ||
    detailKind === "proofreading_confirmation"
  ) {
    const filteredConfirmationItems = filterProofreadingConfirmationItems({
      items: confirmationItems,
      confirmationState,
      severityFilter,
      statusFilter,
    });
    const issueSummary = buildProofreadingIssueSummary(
      confirmationItems,
      confirmationState,
      filteredConfirmationItems.length,
    );
    const activeIssue =
      filteredConfirmationItems.find((item) => item.itemId === activeProofreadingIssueId) ??
      filteredConfirmationItems[0] ??
      null;
    const activeIssueDraft =
      (activeIssue && confirmationState[activeIssue.itemId]) ?? {};
    const issueMarkers = buildProofreadingIssueMarkers({
      items: filteredConfirmationItems,
      confirmationState,
      proofreadingDocumentBlocks,
      activeIssueId: activeIssue?.itemId ?? activeProofreadingIssueId,
    });
    const selectedIssueId = activeIssue?.itemId ?? activeProofreadingIssueId;
    const onlyOfficeIssueMarks = React.useMemo<OnlyOfficeProofreadingIssueMarkViewModel[]>(
      () =>
        filteredConfirmationItems.flatMap((item) => {
          if (!item.anchor) {
            return [];
          }

          const locateTarget = buildProofreadingLocateTarget(item.anchor);
          return [
            {
              itemId: item.itemId,
              title: item.title ?? item.issueType ?? item.itemId,
              ...(item.severity
                ? {
                    severity: item.severity,
                  }
                : {}),
              processed: Boolean(confirmationState[item.itemId]?.action),
              selected: item.itemId === selectedIssueId,
              blockIndex: locateTarget.blockIndex,
              quote: locateTarget.quote,
              ...(locateTarget.sectionLabel
                ? {
                    sectionLabel: locateTarget.sectionLabel,
                  }
                : {}),
              anchorKey: locateTarget.anchorKey,
              anchorKind: locateTarget.anchorKind,
              confidence: locateTarget.confidence,
            },
          ];
        }),
      [
        confirmationState,
        filteredConfirmationItems,
        selectedIssueId,
      ],
    );
    const activeLocateTarget =
      activeIssue?.itemId === activeProofreadingIssueId && activeProofreadingLocateTarget
        ? activeProofreadingLocateTarget
        : activeIssue?.anchor
          ? buildProofreadingLocateTarget(activeIssue.anchor)
          : null;
    const activeBlockIndex = activeLocateTarget?.blockIndex ?? activeIssue?.anchor?.blockIndex;
    const showsOnlyOfficeSurface = Boolean(
      previewSession && supportsOnlyOfficePreviewSurface(previewSession),
    );
    const fallbackFocusTarget = resolveProofreadingFallbackFocusTarget({
      proofreadingDocumentBlocks,
      activeBlockIndex,
    });
    const manuscriptPreviewAsset = previewAsset ?? asset;
    const manuscriptPreviewLabel = buildWorkbenchAssetDisplayName(
      manuscriptTitle,
      manuscriptPreviewAsset,
    );
    const manuscriptPreviewRoleLabel = formatWorkbenchAssetTypeLabel(
      manuscriptPreviewAsset.asset_type,
    );
    const manuscriptPreviewHref = previewDownloadHref ?? downloadHref;
    const showsHumanReviewDiffQueue = humanReviewDiffItems.length > 0;
    const resolvedHumanReviewModule =
      humanReviewModule ??
      (mode === "proofreading" ? "proofreading" : null);

    React.useEffect(() => {
      if (showsOnlyOfficeSurface || !fallbackFocusTarget || typeof document === "undefined") {
        return;
      }

      document
        .getElementById(fallbackFocusTarget.blockId)
        ?.scrollIntoView({
          block: "center",
          behavior: "smooth",
        });
    }, [fallbackFocusTarget, showsOnlyOfficeSurface]);

    return (
      <section
        className="manuscript-workbench-detail-page manuscript-workbench-proofreading-layout"
        data-detail-kind={detailKind}
        data-proofreading-layout="issue-workbench"
      >
        <header className="manuscript-workbench-detail-header">
          <div className="manuscript-workbench-detail-copy">
            <span className="manuscript-workbench-section-eyebrow">
              {detailKind === "proofreading_workspace"
                ? "校对问题工作台"
                : "校对人工确认"}
            </span>
            <h3>
              {detailKind === "proofreading_workspace"
                ? "问题驱动工作台"
                : "人工确认与发布"}
            </h3>
            <p>{manuscriptTitle}</p>
          </div>
          <div className="manuscript-workbench-detail-actions">
            <a className="manuscript-workbench-shortcut" href={backHref}>
              返回工作台
            </a>
            <a
              className="manuscript-workbench-shortcut"
              href={manuscriptPreviewHref}
              target="_blank"
              rel="noreferrer"
            >
              打开稿件原文
            </a>
            <a className="manuscript-workbench-shortcut" href={downloadHref} download>
              {resolveDetailDownloadLabel(asset)}
            </a>
          </div>
        </header>

        <div className="manuscript-workbench-proofreading-layout-grid">
          <article
            className="manuscript-workbench-proofreading-manuscript-pane"
            data-preview-session-ready={previewOperationalState ? "true" : "false"}
            data-active-locate-anchor-key={activeLocateTarget?.anchorKey ?? ""}
            data-active-locate-anchor-kind={activeLocateTarget?.anchorKind ?? ""}
          >
            <div className="manuscript-workbench-detail-card-header">
              <div>
                <h4>稿件原文</h4>
                <p>{manuscriptPreviewLabel}</p>
                <small>{manuscriptPreviewRoleLabel}</small>
              </div>
            </div>
            <div
              className="manuscript-workbench-proofreading-manuscript-workarea"
              data-proofreading-marker-count={issueMarkers.length}
            >
              {issueMarkers.length > 0 ? (
                <aside
                  className="manuscript-workbench-proofreading-marker-rail"
                  aria-label="稿件问题标记"
                >
                  <div className="manuscript-workbench-proofreading-marker-rail-header">
                    <span>问题标记</span>
                    <strong>{`共 ${issueMarkers.length} 处`}</strong>
                  </div>
                  <div className="manuscript-workbench-proofreading-marker-track">
                    {issueMarkers.map((marker, index) => {
                      const markerStyle = {
                        top: `${marker.positionPercent}%`,
                        "--proofreading-marker-stack-offset": `${(
                          marker.stackIndex -
                          (marker.stackCount - 1) / 2
                        ) * 12}px`,
                      } as React.CSSProperties;

                      return (
                        <button
                          key={marker.itemId}
                          type="button"
                          className={`manuscript-workbench-proofreading-marker severity-${marker.severity ?? "medium"}${
                            marker.selected ? " is-selected" : ""
                          }${marker.processed ? " is-processed" : ""}`}
                          style={markerStyle}
                          title={`${index + 1}. ${marker.title}`}
                          aria-label={`${index + 1}. ${marker.title}，${
                            marker.sectionLabel ?? `段落 ${marker.blockIndex + 1}`
                          }`}
                          data-proofreading-marker-item-id={marker.itemId}
                          data-proofreading-marker-selected={marker.selected ? "true" : "false"}
                          data-proofreading-marker-processed={marker.processed ? "true" : "false"}
                          data-proofreading-marker-block-index={marker.blockIndex}
                          onClick={() => onProofreadingIssueSelect?.(marker.itemId)}
                        >
                          <span>{index + 1}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="manuscript-workbench-proofreading-marker-rail-footnote">
                    点标记可跳到对应问题
                  </p>
                </aside>
              ) : null}

              <div className="manuscript-workbench-proofreading-manuscript-content">
                {showsOnlyOfficeSurface ? (
                  <>
                    <OnlyOfficePreviewSurface
                      previewSession={previewSession!}
                      activeLocateTarget={activeLocateTarget}
                      issueMarks={onlyOfficeIssueMarks}
                      onIssueSelection={onProofreadingIssueSelect}
                    />
                    {proofreadingDocumentBlocks.length > 0 ? (
                      <details className="manuscript-workbench-proofreading-fallback">
                        <summary>结构化定位备用视图</summary>
                        {renderProofreadingDocumentBlocks({
                          proofreadingDocumentBlocks,
                          confirmationItems,
                          confirmationState,
                          activeBlockIndex,
                        })}
                      </details>
                    ) : null}
                  </>
                ) : proofreadingDocumentBlocks.length > 0 ? (
                  renderProofreadingDocumentBlocks({
                    proofreadingDocumentBlocks,
                    confirmationItems,
                    confirmationState,
                    activeBlockIndex,
                  })
                ) : (
                  <div className="manuscript-workbench-detail-empty">
                    <strong>暂无稿件正文块</strong>
                    <p>当前校对任务没有保存可定位的全文块，无法进入问题工作台定位模式。</p>
                  </div>
                )}
              </div>
            </div>
          </article>

          <article className="manuscript-workbench-proofreading-issue-pane">
            <div className="manuscript-workbench-detail-card-header">
              <div>
                <h4>{showsHumanReviewDiffQueue ? "差异队列" : "问题队列"}</h4>
                <p>
                  {showsHumanReviewDiffQueue
                    ? "确认每一处差异是否进入最终稿，并选择是否回流规则或知识候选。"
                    : "点击问题可定位到对应稿件位置，并在右侧展开人工确认。"}
                </p>
              </div>
              {showsHumanReviewDiffQueue ? null : (
                <div className="manuscript-workbench-proofreading-issue-summary">
                  <strong>{`共发现 ${issueSummary.totalCount} 项问题`}</strong>
                  <span>{`高 ${issueSummary.highCount} · 中 ${issueSummary.mediumCount} · 低 ${issueSummary.lowCount}`}</span>
                  <small>{`当前显示 ${issueSummary.filteredCount} / 共 ${issueSummary.totalCount}`}</small>
                </div>
              )}
              {previewOperationalState || activeLocateTarget ? (
                <dl className="manuscript-workbench-detail-metadata">
                  {previewOperationalState ? (
                    <div>
                      <dt>预览</dt>
                      <dd>{formatPreviewStatusLabel(previewOperationalState.status)}</dd>
                    </div>
                  ) : null}
                  {activeLocateTarget ? (
                    <div>
                      <dt>定位锚点</dt>
                      <dd>{activeLocateTarget.anchorKey}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
            </div>
            {showsHumanReviewDiffQueue && resolvedHumanReviewModule ? (
              <HumanReviewQueue
                module={resolvedHumanReviewModule}
                items={humanReviewDiffItems}
                preflight={humanReviewPreflight}
                isUpdating={isHumanReviewUpdating}
                isPublishing={isFinalizing}
                onDecisionChange={onHumanReviewDecisionChange}
                onBatchDecisionChange={onHumanReviewBatchDecisionChange}
                onPreflightPublish={onHumanReviewPreflight}
                onPublishFinal={onHumanReviewPublish}
                onRetryBackflow={onHumanReviewRetryBackflow}
              />
            ) : confirmationItems.length > 0 ? (
              <div className="manuscript-workbench-proofreading-issue-list">
                <div className="manuscript-workbench-proofreading-issue-filters">
                  <label className="manuscript-workbench-field">
                    <span>严重度</span>
                    <select
                      value={severityFilter}
                      onChange={(event) =>
                        setSeverityFilter(event.target.value as ProofreadingSeverityFilter)
                      }
                    >
                      <option value="all">全部</option>
                      <option value="critical">严重</option>
                      <option value="high">高</option>
                      <option value="medium">中</option>
                      <option value="low">低</option>
                    </select>
                  </label>
                  <label className="manuscript-workbench-field">
                    <span>状态</span>
                    <select
                      value={statusFilter}
                      onChange={(event) =>
                        setStatusFilter(event.target.value as ProofreadingStatusFilter)
                      }
                    >
                      <option value="all">全部</option>
                      <option value="pending">未处理</option>
                      <option value="processed">已处理</option>
                      <option value="blocking">阻断项</option>
                    </select>
                  </label>
                </div>
                {filteredConfirmationItems.map((item, index) => {
                  const draft = confirmationState[item.itemId] ?? {};
                  const isSelected = activeIssue?.itemId === item.itemId;
                  return (
                    <article
                      key={item.itemId}
                      className={`manuscript-workbench-proofreading-issue${
                        isSelected ? " is-selected" : ""
                      }`}
                    >
                      <button
                        type="button"
                        className="manuscript-workbench-proofreading-issue-toggle"
                        onClick={() => onProofreadingIssueSelect?.(item.itemId)}
                      >
                        <div>
                          <small>{`问题 ${index + 1}`}</small>
                          <strong>{item.title ?? item.itemId}</strong>
                          <p>{item.anchor?.sectionLabel ?? "未标注章节"}</p>
                        </div>
                        <div className="manuscript-workbench-proofreading-issue-toggle-meta">
                          <span className={resolveSeverityClassName(item.severity)}>
                            {formatSeverityLabel(item.severity)}
                          </span>
                          {draft.action ? (
                            <small>{resolveProofreadingDecisionLabel(draft.action)}</small>
                          ) : (
                            <small>待处理</small>
                          )}
                        </div>
                      </button>

                      {isSelected ? (
                        <div className="manuscript-workbench-proofreading-issue-detail">
                          {item.description ? <p>{item.description}</p> : null}
                          <dl className="manuscript-workbench-detail-metadata">
                            <div>
                              <dt>来源</dt>
                              <dd>{item.source ?? "residual_ai"}</dd>
                            </div>
                            <div>
                              <dt>问题类型</dt>
                              <dd>{item.issueType ?? item.category ?? "未标注"}</dd>
                            </div>
                            <div>
                              <dt>定位</dt>
                              <dd>{item.anchor?.sectionLabel ?? `段落 ${item.anchor?.blockIndex ?? 0}`}</dd>
                            </div>
                            <div>
                              <dt>阻断终稿</dt>
                              <dd>{item.blocksFinal ? "是" : "否"}</dd>
                            </div>
                          </dl>
                          <dl className="manuscript-workbench-detail-proofreading-diff">
                            <div>
                              <dt>原文</dt>
                              <dd>{item.targetText}</dd>
                            </div>
                            <div>
                              <dt>建议</dt>
                              <dd>{item.replacementText || "仅提示人工核验"}</dd>
                            </div>
                          </dl>
                          <div className="manuscript-workbench-detail-decision-grid">
                            {CONFIRMATION_ACTIONS.map((action) => (
                              <button
                                key={action.value}
                                type="button"
                                className={
                                  draft.action === action.value ? "is-selected" : undefined
                                }
                                onClick={() =>
                                  onConfirmationActionChange?.(item.itemId, action.value)
                                }
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                          {draft.action === "accepted_with_manual_edit" ? (
                            <label className="manuscript-workbench-field">
                              <span>人工修订文本</span>
                              <textarea
                                value={draft.editedReplacementText ?? ""}
                                onChange={(event) =>
                                  onConfirmationEditedReplacementTextChange?.(
                                    item.itemId,
                                    event.target.value,
                                  )
                                }
                              />
                            </label>
                          ) : null}
                          <label className="manuscript-workbench-field">
                            <span>人工备注</span>
                            <textarea
                              value={draft.note ?? ""}
                              onChange={(event) =>
                                onConfirmationNoteChange?.(
                                  item.itemId,
                                  event.target.value,
                                )
                              }
                            />
                          </label>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="manuscript-workbench-detail-empty">
                <strong>当前没有可确认的问题</strong>
                <p>本次校对没有生成结构化问题队列，暂时无法进入人工核验工作台。</p>
              </div>
            )}

            {deepProofreadingEvidence
              ? renderDeepProofreadingEvidenceCard(deepProofreadingEvidence)
              : null}

            {showsHumanReviewDiffQueue ? null : (
              <div className="manuscript-workbench-button-row manuscript-workbench-button-row--sticky">
                {onSaveDraft ? (
                  <button
                    type="button"
                    className="manuscript-workbench-button-secondary"
                    disabled={isDraftSaving}
                    onClick={() => onSaveDraft?.()}
                  >
                    {isDraftSaving ? "保存中..." : "保存进度"}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={!isFinalizeEnabled || isFinalizing}
                  onClick={() => onFinalize?.()}
                >
                  {isFinalizing ? "发布中..." : "发布人工终稿"}
                </button>
              </div>
            )}
            {!showsHumanReviewDiffQueue && draftSaveLabel ? (
              <p className="manuscript-workbench-proofreading-draft-status">
                {draftSaveLabel}
              </p>
            ) : null}
            {governanceEvidenceCard}
          </article>
        </div>
      </section>
    );
  }

  if (
    mode === "editing" &&
    detailKind === "document_preview" &&
    asset.asset_type === "edited_docx"
  ) {
    const showsOnlyOfficeSurface = Boolean(
      previewSession && supportsOnlyOfficePreviewSurface(previewSession),
    );

    return (
      <section
        className="manuscript-workbench-detail-page manuscript-workbench-editing-onlyoffice-layout"
        data-detail-kind={detailKind}
        data-editing-layout="onlyoffice-review"
      >
        <header className="manuscript-workbench-detail-header">
          <div className="manuscript-workbench-detail-copy">
            <span className="manuscript-workbench-section-eyebrow">
              编辑结果核验
            </span>
            <h3>编辑稿全文核验页</h3>
            <p>{manuscriptTitle}</p>
          </div>
          <div className="manuscript-workbench-detail-actions">
            <a className="manuscript-workbench-shortcut" href={backHref}>
              返回工作台
            </a>
            <a
              className="manuscript-workbench-shortcut"
              href={downloadHref}
              target="_blank"
              rel="noreferrer"
            >
              打开编辑稿
            </a>
            <a className="manuscript-workbench-shortcut" href={downloadHref} download>
              {resolveDetailDownloadLabel(asset)}
            </a>
          </div>
        </header>

        <div className="manuscript-workbench-editing-onlyoffice-grid">
          <article className="manuscript-workbench-editing-onlyoffice-document">
            <div className="manuscript-workbench-detail-card-header">
              <div>
                <h4>编辑稿全文</h4>
                <p>{assetDisplayName}</p>
                <small>{assetRoleLabel}</small>
              </div>
            </div>
            {showsOnlyOfficeSurface ? (
              <OnlyOfficePreviewSurface previewSession={previewSession!} />
            ) : editingDocumentBlocks.length > 0 ? (
              <div className="manuscript-workbench-proofreading-block-list">
                {editingDocumentBlocks.map((block) => (
                  <article
                    key={block.blockId}
                    id={block.blockId}
                    className="manuscript-workbench-proofreading-block"
                  >
                    <header>
                      <strong>{formatWorkbenchDocumentBlockLabel(block)}</strong>
                      <span>{block.blockKind ?? "paragraph"}</span>
                    </header>
                    <p>{block.text}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="manuscript-workbench-detail-empty">
                <strong>编辑稿预览暂不可用</strong>
                <p>可以先打开或下载编辑稿，待预览服务完成转换后再回到本页核验。</p>
              </div>
            )}
          </article>

          <aside className="manuscript-workbench-editing-onlyoffice-review">
            {humanReviewDiffItems.length > 0 && humanReviewModule ? (
              <HumanReviewQueue
                module={humanReviewModule}
                items={humanReviewDiffItems}
                preflight={humanReviewPreflight}
                isUpdating={isHumanReviewUpdating}
                isPublishing={isFinalizing}
                onDecisionChange={onHumanReviewDecisionChange}
                onBatchDecisionChange={onHumanReviewBatchDecisionChange}
                onPreflightPublish={onHumanReviewPreflight}
                onPublishFinal={onHumanReviewPublish}
                onRetryBackflow={onHumanReviewRetryBackflow}
              />
            ) : null}

            <section className="manuscript-workbench-detail-ledger-card">
              <div className="manuscript-workbench-detail-card-header">
                <div>
                  <h4>人工核验</h4>
                  <p>在左侧通读编辑稿，右侧只保留必要核验入口。</p>
                </div>
              </div>
              <dl className="manuscript-workbench-detail-metadata">
                <div>
                  <dt>编辑稿</dt>
                  <dd>{assetDisplayName}</dd>
                </div>
                <div>
                  <dt>预览</dt>
                  <dd>
                    {previewOperationalState
                      ? formatPreviewStatusLabel(previewOperationalState.status)
                      : "待生成"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="manuscript-workbench-detail-ledger-card">
              <div className="manuscript-workbench-detail-card-header">
                <div>
                  <h4>改动台账</h4>
                  <p>{changeLedger.length > 0 ? `共 ${changeLedger.length} 条` : "暂无台账"}</p>
                </div>
              </div>
              {changeLedger.length > 0 ? (
                <ul className="manuscript-workbench-detail-ledger-list manuscript-workbench-detail-ledger-list--compact">
                  {changeLedger.slice(0, 6).map((entry) => (
                    <li key={entry.id} className="manuscript-workbench-detail-ledger-item">
                      <header>
                        <strong>{entry.sourceLabel}</strong>
                        {entry.locationText ? <span>{entry.locationText}</span> : null}
                      </header>
                      <p>{entry.after}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="manuscript-workbench-detail-empty">
                  <strong>暂无改动台账</strong>
                  <p>当前编辑任务没有保存结构化改动记录。</p>
                </div>
              )}
            </section>

            <section className="manuscript-workbench-detail-ledger-card">
              <div className="manuscript-workbench-detail-card-header">
                <div>
                  <h4>阻断项</h4>
                  <p>只提示会影响人工放行的问题。</p>
                </div>
              </div>
              {editingCompletionGateCard || editingGuardrailCard || editingSlotGovernanceCard ? (
                <details className="manuscript-workbench-result-details">
                  <summary>查看阻断详情</summary>
                  <div className="manuscript-workbench-result-details-body">
                    {editingCompletionGateCard}
                    {editingGuardrailCard}
                    {editingSlotGovernanceCard}
                  </div>
                </details>
              ) : (
                <div className="manuscript-workbench-detail-empty">
                  <strong>暂无阻断项</strong>
                  <p>当前编辑结果没有需要优先处理的阻断问题。</p>
                </div>
              )}
            </section>

            <details className="manuscript-workbench-result-details">
              <summary>查看详细治理信息</summary>
              <div className="manuscript-workbench-result-details-body">
                {editingRuntimeBindingCard}
                {governanceEvidenceCard}
              </div>
            </details>
          </aside>
        </div>
      </section>
    );
  }

  if (
    mode === "editing" &&
    detailKind === "document_preview" &&
    editingDocumentBlocks.length > 0
  ) {
    return (
      <section
        className="manuscript-workbench-detail-page manuscript-workbench-proofreading-layout manuscript-workbench-editing-layout"
        data-detail-kind={detailKind}
        data-editing-layout="shared-review"
      >
        <header className="manuscript-workbench-detail-header">
          <div className="manuscript-workbench-detail-copy">
            <span className="manuscript-workbench-section-eyebrow">
              编辑共享审阅工作台
            </span>
            <h3>左全文右问题的编辑审阅台</h3>
            <p>{manuscriptTitle}</p>
          </div>
          <div className="manuscript-workbench-detail-actions">
            <a className="manuscript-workbench-shortcut" href={backHref}>
              返回工作台
            </a>
            <a
              className="manuscript-workbench-shortcut"
              href={downloadHref}
              target="_blank"
              rel="noreferrer"
            >
              打开当前文件
            </a>
            <a className="manuscript-workbench-shortcut" href={downloadHref} download>
              {resolveDetailDownloadLabel(asset)}
            </a>
          </div>
        </header>

        <div className="manuscript-workbench-proofreading-layout-grid manuscript-workbench-editing-layout-grid">
          <article className="manuscript-workbench-proofreading-manuscript-pane">
            <div className="manuscript-workbench-detail-card-header">
              <div>
                <h4>稿件全文</h4>
                <p>{assetDisplayName}</p>
                <small>{assetRoleLabel}</small>
              </div>
            </div>
            <div className="manuscript-workbench-proofreading-block-list">
              {editingDocumentBlocks.map((block) => (
                <article
                  key={block.blockId}
                  id={block.blockId}
                  className={`manuscript-workbench-proofreading-block${
                    activeEditingBlock?.blockIndex === block.blockIndex
                      ? " is-selected"
                      : ""
                  }`}
                  data-selected={
                    activeEditingBlock?.blockIndex === block.blockIndex
                      ? "true"
                      : "false"
                  }
                >
                  <header>
                    <strong>{formatWorkbenchDocumentBlockLabel(block)}</strong>
                    <span>{block.blockKind ?? "paragraph"}</span>
                  </header>
                  <p>{block.text}</p>
                </article>
              ))}
            </div>
          </article>

          <article className="manuscript-workbench-proofreading-issue-pane manuscript-workbench-editing-focus-pane">
            <div className="manuscript-workbench-detail-card-header">
              <div>
                <h4>问题与台账</h4>
                <p>右侧点击条目即可定位到全文对应位置，改动台账也会并排进入审阅。</p>
              </div>
            </div>
            {editingWorkspaceFocusItems.length > 0 ? (
              <div className="manuscript-workbench-proofreading-issue-list manuscript-workbench-editing-focus-list">
                {editingWorkspaceFocusItems.map((item) => {
                  const isSelected = activeEditingFocus?.id === item.id;
                  const linkedBlock =
                    item.blockIndex != null
                      ? findWorkbenchDocumentBlockByIndex(
                          editingDocumentBlocks,
                          item.blockIndex,
                        )
                      : null;

                  return (
                    <article
                      key={item.id}
                      className={`manuscript-workbench-proofreading-issue${
                        isSelected ? " is-selected" : ""
                      }`}
                    >
                      <button
                        type="button"
                        className="manuscript-workbench-proofreading-issue-toggle"
                        onClick={() => setActiveEditingFocusId(item.id)}
                      >
                        <div>
                          <strong>{item.title}</strong>
                          <p>
                            {item.locationLabel ??
                              (linkedBlock
                                ? formatWorkbenchDocumentBlockLabel(linkedBlock)
                                : "未定位到正文块")}
                          </p>
                        </div>
                        <span className={resolveTonePillClassName(item.tone)}>
                          {item.badgeLabel}
                        </span>
                      </button>

                      {isSelected ? (
                        <div className="manuscript-workbench-proofreading-issue-detail manuscript-workbench-editing-focus-detail">
                          <p>{item.summary}</p>
                          {item.detail ? <p>{item.detail}</p> : null}
                          <dl className="manuscript-workbench-detail-metadata">
                            <div>
                              <dt>来源</dt>
                              <dd>{formatEditingWorkspaceFocusOriginLabel(item.origin)}</dd>
                            </div>
                            <div>
                              <dt>正文定位</dt>
                              <dd>
                                {linkedBlock
                                  ? formatWorkbenchDocumentBlockLabel(linkedBlock)
                                  : "当前未定位到正文块"}
                              </dd>
                            </div>
                            {item.locationLabel ? (
                              <div>
                                <dt>原始锚点</dt>
                                <dd>{item.locationLabel}</dd>
                              </div>
                            ) : null}
                          </dl>
                          {linkedBlock ? (
                            <div className="manuscript-workbench-selection-context">
                              <span>正文上下文</span>
                              <strong>{linkedBlock.text}</strong>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="manuscript-workbench-detail-empty">
                <strong>当前没有结构化问题与台账</strong>
                <p>全文块已加载，但本次编辑任务没有沉淀出可审阅的问题或落稿记录。</p>
              </div>
            )}
          </article>
        </div>

        <div className="manuscript-workbench-detail-layout manuscript-workbench-detail-layout--supporting">
          {editingSlotGovernanceCard}
          {editingRuntimeBindingCard}
          {editingCompletionGateCard}
          {changeLedgerCard}
          {editingGuardrailCard}
          {governanceEvidenceCard}
        </div>
      </section>
    );
  }

  return (
    <section
      className="manuscript-workbench-detail-page"
      data-detail-kind={detailKind}
    >
      <header className="manuscript-workbench-detail-header">
        <div className="manuscript-workbench-detail-copy">
          <span className="manuscript-workbench-section-eyebrow">
            {resolveDetailEyebrow(detailKind)}
          </span>
          <h3>{resolveDetailTitle(detailKind, mode)}</h3>
          <p>{manuscriptTitle}</p>
        </div>
        <div className="manuscript-workbench-detail-actions">
          <a className="manuscript-workbench-shortcut" href={backHref}>
            返回工作台
          </a>
          <a
            className="manuscript-workbench-shortcut"
            href={downloadHref}
            target="_blank"
            rel="noreferrer"
          >
            打开当前文件
          </a>
          <a className="manuscript-workbench-shortcut" href={downloadHref} download>
            {resolveDetailDownloadLabel(asset)}
          </a>
        </div>
      </header>

      <div className="manuscript-workbench-detail-layout">
        <article className="manuscript-workbench-detail-preview-card">
          <div className="manuscript-workbench-detail-card-header">
            <div>
              <h4>{resolvePreviewPanelTitle(detailKind)}</h4>
              <p>{assetDisplayName}</p>
              <small>{assetRoleLabel}</small>
            </div>
            {previewSession ? (
              <div className="manuscript-workbench-detail-session-metrics">
                <span>{formatPreviewViewerLabel(previewSession.viewer)}</span>
                <strong>
                  {formatPreviewStatusLabel(
                    previewOperationalState?.status ?? previewSession.status,
                  )}
                </strong>
              </div>
            ) : null}
          </div>

          {previewSession ? (
            <dl className="manuscript-workbench-detail-metadata">
              <div>
                <dt>查看方式</dt>
                <dd>{formatPreviewModeLabel(previewSession.mode)}</dd>
              </div>
              <div>
                <dt>批注数量</dt>
                <dd>{String(previewSession.comments.length)}</dd>
              </div>
              <div>
                <dt>批注来源</dt>
                <dd>{formatPreviewCommentSourceLabel(previewSession.comment_source)}</dd>
              </div>
            </dl>
          ) : null}

          {previewOperationalState?.warnings.length ? (
            <ul className="manuscript-workbench-detail-warning-list">
              {previewOperationalState.warnings.map((warning, index) => (
                <li key={`${warning}-${index}`}>{warning}</li>
              ))}
            </ul>
          ) : null}

          {reportBody ? (
            <pre className="manuscript-workbench-detail-report-body">{reportBody}</pre>
          ) : previewSession?.comments.length ? (
            <ul className="manuscript-workbench-detail-comment-list">
              {previewSession.comments.map((comment) => (
                <li
                  key={comment.id}
                  className="manuscript-workbench-detail-comment-item"
                >
                  <strong>{comment.anchor_text ?? "未定位锚点"}</strong>
                  <p>{comment.body}</p>
                  <small>{comment.author ?? "系统批注"}</small>
                </li>
              ))}
            </ul>
          ) : (
            <div className="manuscript-workbench-detail-empty">
              <strong>该资产已生成。</strong>
              <p>当前页面提供真实文件入口，可直接打开或下载。</p>
            </div>
          )}
        </article>

        {changeLedgerCard}

        {editingCompletionGateCard}

        {editingSlotGovernanceCard}

        {editingRuntimeBindingCard}

        {editingGuardrailCard}

        {governanceEvidenceCard}
      </div>
    </section>
  );
}

function renderDeepProofreadingEvidenceCard(
  evidence: DeepProofreadingEvidenceViewModel,
): React.ReactElement {
  return (
    <section
      className="manuscript-workbench-detail-card manuscript-workbench-proofreading-deep-evidence"
      aria-label="深度校对证据"
    >
      <div className="manuscript-workbench-detail-card-header">
        <div>
          <h4>深度校对证据</h4>
          <p>只读展示本次深度校对的事实账本、表格提取、规则激活与知识预算。</p>
        </div>
        <span className="manuscript-workbench-status-pill is-neutral">
          {evidence.schema ?? "未记录"}
        </span>
      </div>
      <dl className="manuscript-workbench-detail-metadata">
        <div>
          <dt>全局事实账本</dt>
          <dd>
            {`事实 ${formatOptionalNumber(evidence.factLedgerSummary.factCount)} · 冲突 ${formatOptionalNumber(
              evidence.factLedgerSummary.conflictCount,
            )}`}
          </dd>
        </div>
        <div>
          <dt>表格校对层</dt>
          <dd>
            {`表格 ${formatOptionalNumber(evidence.tableFidelityDiagnostics.tableCount)} · 高 ${formatOptionalNumber(
              evidence.tableFidelityDiagnostics.highCount,
            )} · 中 ${formatOptionalNumber(
              evidence.tableFidelityDiagnostics.mediumCount,
            )} · 低 ${formatOptionalNumber(evidence.tableFidelityDiagnostics.lowCount)}`}
          </dd>
        </div>
        <div>
          <dt>规则激活</dt>
          <dd>{`规则 ${formatOptionalNumber(evidence.selectedRuleDiagnostics.totalSelected)}`}</dd>
        </div>
        <div>
          <dt>知识预算</dt>
          <dd>
            {`知识 ${formatOptionalNumber(
              evidence.selectedKnowledgeBudgetDiagnostics.totalSelected,
            )} · 排除 ${formatOptionalNumber(
              evidence.selectedKnowledgeBudgetDiagnostics.totalExcluded,
            )} · 估算 ${formatOptionalNumber(
              evidence.selectedKnowledgeBudgetDiagnostics.estimatedTokens,
            )} tokens`}
          </dd>
        </div>
      </dl>
      {evidence.passRuns.length > 0 ? (
        <div className="manuscript-workbench-proofreading-deep-list">
          <strong>分片执行层</strong>
          <ul>
            {evidence.passRuns.map((passRun, index) => (
              <li key={`${passRun.passKind}:${passRun.sliceId ?? index}`}>
                <span>{passRun.passKind}</span>
                <small>
                  {[
                    passRun.sliceId,
                    passRun.status ?? "未记录",
                    `问题 ${formatOptionalNumber(passRun.issueCount)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {evidence.stageDiagnostics.length > 0 ? (
        <div className="manuscript-workbench-proofreading-deep-list">
          <strong>诊断阶段</strong>
          <ul>
            {evidence.stageDiagnostics.map((stage, index) => (
              <li key={`${stage.passKind}:${index}`}>
                <span>{stage.passKind}</span>
                <small>
                  {[stage.status ?? "未记录", `问题 ${formatOptionalNumber(stage.issueCount)}`]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function renderProofreadingDocumentBlocks(input: {
  proofreadingDocumentBlocks: readonly ProofreadingDocumentBlockViewModel[];
  confirmationItems: readonly ProofreadingConfirmationItemViewModel[];
  confirmationState: Readonly<Record<string, ProofreadingConfirmationDraftState>>;
  activeBlockIndex?: number;
}) {
  return (
    <div className="manuscript-workbench-proofreading-block-list">
      {input.proofreadingDocumentBlocks.map((block) => {
        const matchingItems = input.confirmationItems.filter(
          (item) => item.anchor?.blockIndex === block.blockIndex,
        );
        const processedCount = matchingItems.filter(
          (item) => input.confirmationState[item.itemId]?.action,
        ).length;
        const isSelectedBlock = input.activeBlockIndex === block.blockIndex;
        const isFullyProcessed =
          processedCount > 0 && processedCount === matchingItems.length;

        return (
          <article
            key={block.blockId}
            id={block.blockId}
            className={`manuscript-workbench-proofreading-block${
              isSelectedBlock ? " is-selected" : ""
            }${
              matchingItems.length > 0 ? " has-issue" : ""
            }${
              isFullyProcessed ? " is-processed" : ""
            }`}
            data-selected={isSelectedBlock ? "true" : "false"}
          >
            <header>
              <strong>{block.sectionLabel ?? `段落 ${block.blockIndex + 1}`}</strong>
              <span>{block.blockKind ?? "paragraph"}</span>
              {matchingItems.length > 0 ? (
                <small>
                  {isFullyProcessed
                    ? `已处理 ${processedCount} 项`
                    : `问题 ${matchingItems.length} 项`}
                </small>
              ) : null}
            </header>
            <p>{block.text}</p>
          </article>
        );
      })}
    </div>
  );
}

const CONFIRMATION_ACTIONS: ReadonlyArray<{
  value: ProofreadingConfirmationDecisionAction;
  label: string;
}> = [
  { value: "accepted", label: "采纳" },
  { value: "accepted_with_manual_edit", label: "采纳并手改" },
  { value: "rejected", label: "驳回" },
  { value: "manual_only", label: "仅人工处理" },
  { value: "escalated", label: "升级处理" },
  { value: "route_to_rule_candidate", label: "转规则候选" },
  { value: "route_to_knowledge_candidate", label: "转知识候选" },
];

function renderGovernanceEvidenceCard(input: {
  executionSnapshot?: ExecutionTrackingSnapshotViewModel | null;
  knowledgeHitLogs?: readonly KnowledgeHitLogViewModel[];
  knowledgeReferences?: Readonly<
    Record<string, ManuscriptWorkbenchKnowledgeReferenceViewModel>
  >;
}) {
  const snapshot = input.executionSnapshot ?? null;
  const knowledgeHitLogs = input.knowledgeHitLogs ?? [];
  const qualityPackages = snapshot?.quality_packages ?? [];
  const qualityFindingsSummary = snapshot?.quality_findings_summary;

  return (
    <article className="manuscript-workbench-detail-ledger-card manuscript-workbench-detail-governance-card">
      <div className="manuscript-workbench-detail-card-header">
        <div>
          <h4>治理命中依据</h4>
          <p>这里展示当前结果为什么会命中规则、知识和质量包。</p>
        </div>
      </div>

      <dl className="manuscript-workbench-detail-metadata">
        <div>
          <dt>快照 ID</dt>
          <dd>{snapshot?.id ?? "未记录"}</dd>
        </div>
        <div>
          <dt>质量包</dt>
          <dd>
            {qualityPackages.length > 0
              ? qualityPackages.map(formatQualityPackageLabel).join("；")
              : "未记录"}
          </dd>
        </div>
        <div>
          <dt>质量发现</dt>
          <dd>
            {qualityFindingsSummary
              ? `${qualityFindingsSummary.total_issue_count} 项`
              : "未记录"}
          </dd>
        </div>
        {qualityFindingsSummary?.highest_action ? (
          <div>
            <dt>最高动作</dt>
            <dd>{formatQualityActionLabel(qualityFindingsSummary.highest_action)}</dd>
          </div>
        ) : null}
      </dl>

      {knowledgeHitLogs.length > 0 ? (
        <ul className="manuscript-workbench-detail-comment-list">
          {knowledgeHitLogs.map((log) => {
            const reference = input.knowledgeReferences?.[log.knowledge_item_id];
            const label = reference?.title ?? log.knowledge_item_id;
            const activationSource = formatKnowledgeHitActivationSource(
              log,
              qualityPackages,
            );

            return (
              <li
                key={log.id}
                className="manuscript-workbench-detail-comment-item"
              >
                <strong>{label}</strong>
                {reference?.title ? <small>{log.knowledge_item_id}</small> : null}
                <p>
                  {log.match_reasons.length > 0
                    ? log.match_reasons.join("；")
                    : "未记录命中原因"}
                </p>
                <dl className="manuscript-workbench-detail-metadata">
                  <div>
                    <dt>命中来源</dt>
                    <dd>{formatKnowledgeHitMatchSourceLabel(log.match_source)}</dd>
                  </div>
                  {activationSource ? (
                    <div>
                      <dt>激活链路</dt>
                      <dd>{activationSource}</dd>
                    </div>
                  ) : null}
                  {log.binding_rule_id ? (
                    <div>
                      <dt>绑定规则</dt>
                      <dd>{log.binding_rule_id}</dd>
                    </div>
                  ) : null}
                  {log.section ? (
                    <div>
                      <dt>章节</dt>
                      <dd>{log.section}</dd>
                    </div>
                  ) : null}
                  {typeof log.score === "number" ? (
                    <div>
                      <dt>命中分数</dt>
                      <dd>{log.score.toFixed(2)}</dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="manuscript-workbench-detail-empty">
          <strong>暂无知识命中日志</strong>
          <p>当前任务没有保存可追溯的知识命中说明。</p>
        </div>
      )}
    </article>
  );
}

function renderEditingGuardrailCard(input: {
  entries: readonly EditingGuardrailEntry[];
}) {
  return (
    <article className="manuscript-workbench-detail-ledger-card manuscript-workbench-detail-governance-card">
      <div className="manuscript-workbench-detail-card-header">
        <div>
          <h4>自动改动被拦截</h4>
          <p>这些候选改动没有自动写入文档，而是被编辑守门降级为人工核验。</p>
        </div>
      </div>

      <ul className="manuscript-workbench-detail-comment-list">
        {input.entries.map((entry) => (
          <li key={entry.id} className="manuscript-workbench-detail-comment-item">
            <strong>{formatEditingGuardrailReasonLabel(entry.reasonCode)}</strong>
            <p>{entry.excerpt}</p>
            <dl className="manuscript-workbench-detail-metadata">
              <div>
                <dt>来源阶段</dt>
                <dd>{formatEditingGuardrailSourceStageLabel(entry.sourceStage)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </article>
  );
}

interface EditingSlotDraftState {
  resolvedText?: string;
  note?: string;
}

function EditingSlotGovernanceCard(input: {
  assetId: string;
  summary: EditingSlotGovernanceSummary;
  savingSlotKey?: string | null;
  onSave?(input: EditingSlotManualSaveInput): void;
}) {
  const [drafts, setDrafts] = React.useState<Record<string, EditingSlotDraftState>>({});
  const isSavingAnySlot = Boolean(input.savingSlotKey);

  React.useEffect(() => {
    setDrafts({});
  }, [input.assetId, input.summary.generated_at, input.summary.target_model_version_id]);

  return (
    <article className="manuscript-workbench-detail-ledger-card manuscript-workbench-detail-governance-card">
      <div className="manuscript-workbench-detail-card-header">
        <div>
          <h4>前置信息槽位</h4>
          <p>这里展示目标模型要求的前置元数据槽位、当前命中状态和阻断原因。</p>
        </div>
      </div>

      <dl className="manuscript-workbench-detail-metadata">
        <div>
          <dt>阻断槽位</dt>
          <dd>
            {input.summary.blocking_slot_keys.length > 0
              ? input.summary.blocking_slot_keys.join("；")
              : "无"}
          </dd>
        </div>
        <div>
          <dt>未解决必填</dt>
          <dd>{String(input.summary.unresolved_required_count)}</dd>
        </div>
        {input.summary.target_model_version_no != null ? (
          <div>
            <dt>目标模型版本</dt>
            <dd>{`v${input.summary.target_model_version_no}`}</dd>
          </div>
        ) : null}
      </dl>

      <ul className="manuscript-workbench-detail-comment-list">
        {input.summary.slots.map((slot) => (
          <li key={slot.slot_key} className="manuscript-workbench-detail-comment-item">
            <strong>
              {slot.label} · {formatEditingSlotStateLabel(slot.state)}
            </strong>
            <p>{slot.resolution_reason}</p>
            <dl className="manuscript-workbench-detail-metadata">
              <div>
                <dt>锚点</dt>
                <dd>{slot.anchor}</dd>
              </div>
              <div>
                <dt>候选数</dt>
                <dd>{String(slot.candidate_count)}</dd>
              </div>
              <div>
                <dt>完成门槛</dt>
                <dd>{slot.completion_gate}</dd>
              </div>
              {slot.resolved_text ? (
                <div>
                  <dt>当前内容</dt>
                  <dd>{slot.resolved_text}</dd>
                </div>
              ) : null}
              {slot.manual_resolution ? (
                <div>
                  <dt>人工裁决</dt>
                  <dd>
                    {formatEditingSlotManualResolutionKindLabel(
                      slot.manual_resolution.resolution_kind,
                    )}
                  </dd>
                </div>
              ) : null}
              {slot.manual_resolution?.note ? (
                <div>
                  <dt>人工备注</dt>
                  <dd>{slot.manual_resolution.note}</dd>
                </div>
              ) : null}
            </dl>
            {slot.candidates.length > 0 ? (
              <ul className="manuscript-workbench-detail-comment-list">
                {slot.candidates.slice(0, 3).map((candidate) => (
                  <li
                    key={candidate.candidate_id}
                    className="manuscript-workbench-detail-comment-item"
                  >
                    <strong>{candidate.raw_text}</strong>
                    <small>
                      {candidate.source_zone} · {candidate.source_locator}
                    </small>
                    {input.onSave ? (
                      <div className="manuscript-workbench-detail-slot-candidate-actions">
                        <button
                          type="button"
                          className="manuscript-workbench-button-secondary"
                          disabled={isSavingAnySlot}
                          onClick={() =>
                            input.onSave?.({
                              slotKey: slot.slot_key,
                              resolutionKind: "picked_candidate",
                              selectedCandidateId: candidate.candidate_id,
                              note: readOptionalString(drafts[slot.slot_key]?.note),
                            })
                          }
                        >
                          {input.savingSlotKey === slot.slot_key ? "保存中..." : "采用此候选"}
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {input.onSave ? (
              <div className="manuscript-workbench-detail-slot-actions">
                <label className="manuscript-workbench-field">
                  <span>人工录入内容</span>
                  <textarea
                    value={drafts[slot.slot_key]?.resolvedText ?? ""}
                    disabled={isSavingAnySlot}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [slot.slot_key]: {
                          ...current[slot.slot_key],
                          resolvedText: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label className="manuscript-workbench-field">
                  <span>人工备注</span>
                  <textarea
                    value={drafts[slot.slot_key]?.note ?? ""}
                    disabled={isSavingAnySlot}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [slot.slot_key]: {
                          ...current[slot.slot_key],
                          note: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <div className="manuscript-workbench-button-row">
                  <button
                    type="button"
                    disabled={
                      isSavingAnySlot ||
                      !readOptionalString(drafts[slot.slot_key]?.resolvedText)
                    }
                    onClick={() =>
                      input.onSave?.({
                        slotKey: slot.slot_key,
                        resolutionKind: "manual_entry",
                        resolvedText: readOptionalString(
                          drafts[slot.slot_key]?.resolvedText,
                        ),
                        note: readOptionalString(drafts[slot.slot_key]?.note),
                      })
                    }
                  >
                    {input.savingSlotKey === slot.slot_key ? "保存中..." : "保存人工录入"}
                  </button>
                  <button
                    type="button"
                    className="manuscript-workbench-button-secondary"
                    disabled={isSavingAnySlot}
                    onClick={() =>
                      input.onSave?.({
                        slotKey: slot.slot_key,
                        resolutionKind: "waived",
                        note: readOptionalString(drafts[slot.slot_key]?.note),
                      })
                    }
                  >
                    {input.savingSlotKey === slot.slot_key ? "保存中..." : "标记为豁免"}
                  </button>
                </div>
                <p className="manuscript-workbench-detail-slot-note">
                  候选可直接采用；若稿件里没有可靠候选，可人工录入或在确认后标记豁免。
                </p>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </article>
  );
}

function EditingCompletionGateCard(input: {
  summary: EditingCompletionGateSummary;
}) {
  const sections = [
    {
      key: "required-slots",
      title: "必填槽位阻断",
      items: input.summary.unresolved_required_slots,
    },
    {
      key: "manual-resolution",
      title: "人工处理项",
      items: input.summary.pending_manual_resolution_items,
    },
    {
      key: "high-risk-objects",
      title: "高风险对象",
      items: input.summary.high_risk_object_items,
    },
    {
      key: "table-high-risk",
      title: "表格高风险项",
      items: input.summary.table_high_risk_items,
    },
    {
      key: "blocking-format-failures",
      title: "格式阻断项",
      items: input.summary.blocking_format_failures,
    },
  ].filter((section) => section.items.length > 0);

  return (
    <article className="manuscript-workbench-detail-ledger-card manuscript-workbench-detail-governance-card">
      <div className="manuscript-workbench-detail-card-header">
        <div>
          <h4>编辑完成门禁</h4>
          <p>这里展示编辑结果是否真的可以交接，以及当前仍在阻断完成的具体问题。</p>
        </div>
      </div>

      <dl className="manuscript-workbench-detail-metadata">
        <div>
          <dt>门禁判定</dt>
          <dd>
            {input.summary.observation_status === "failed_open"
              ? "观测失败打开"
              : formatEditingCompletionGateVerdictLabel(input.summary.verdict)}
          </dd>
        </div>
        <div>
          <dt>阻断总数</dt>
          <dd>{String(input.summary.blocker_count)}</dd>
        </div>
        <div>
          <dt>通过状态</dt>
          <dd>{input.summary.passed ? "已通过" : "未通过"}</dd>
        </div>
        {input.summary.target_model_version_no != null ? (
          <div>
            <dt>目标模型版本</dt>
            <dd>{`v${input.summary.target_model_version_no}`}</dd>
          </div>
        ) : null}
      </dl>

      {input.summary.observation_status === "failed_open" ? (
        <div className="manuscript-workbench-detail-empty">
          <strong>门禁观测不可用</strong>
          <p>
            {input.summary.error ??
              "编辑完成门禁 failed open，当前结果不能视为可信完成。"}
          </p>
        </div>
      ) : input.summary.passed ? (
        <div className="manuscript-workbench-detail-empty">
          <strong>当前编辑结果已通过门禁</strong>
          <p>必填槽位、人工处理项、高风险对象和格式阻断项均已清空。</p>
        </div>
      ) : (
        sections.map((section) => (
          <div
            key={section.key}
            className="manuscript-workbench-metric manuscript-workbench-activity-section"
          >
            <span>{section.title}</span>
            <ul className="manuscript-workbench-detail-comment-list">
              {section.items.map((item) => (
                <li
                  key={item.item_key}
                  className="manuscript-workbench-detail-comment-item"
                >
                  <strong>{item.summary}</strong>
                  {renderEditingCompletionGateItemDetail(item)}
                  {section.key === "table-high-risk" ? (
                    <TableHighRiskReviewActionGuide item={item} />
                  ) : null}
                  <small>{formatEditingCompletionGatePendingItemMeta(item)}</small>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      {input.summary.override_reasons?.length ? (
        <div className="manuscript-workbench-metric manuscript-workbench-activity-section">
          <span>人工覆盖理由</span>
          <ul className="manuscript-workbench-detail-comment-list">
            {input.summary.override_reasons.map((reason, index) => (
              <li
                key={`${reason}-${index}`}
                className="manuscript-workbench-detail-comment-item"
              >
                <strong>覆盖理由 {index + 1}</strong>
                <p>{reason}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {input.summary.manual_object_decisions?.length ? (
        <div className="manuscript-workbench-metric manuscript-workbench-activity-section">
          <span>人工对象裁决</span>
          <ul className="manuscript-workbench-detail-comment-list">
            {input.summary.manual_object_decisions.map((decision) => (
              <li
                key={decision.item_key}
                className="manuscript-workbench-detail-comment-item"
              >
                <strong>{decision.item_key}</strong>
                <p>{formatEditingCompletionGateDecisionLabel(decision.decision)}</p>
                {decision.note ? <small>{decision.note}</small> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

function TableHighRiskReviewActionGuide(input: {
  item: EditingCompletionGateSummary["unresolved_required_slots"][number];
}) {
  const reviewItemId = input.item.review_item_id;
  const hasReviewRoute = Boolean(reviewItemId);

  return (
    <div className="manuscript-workbench-detail-comment-copy">
      <p>
        表格专属核对动作：接受改动仅在已确认表格内容、结构和样式均保真时使用；拒绝改动会保留人工复核阻断；覆盖放行必须填写覆盖理由；延后处理保持当前门禁阻断。
      </p>
      <p>
        {hasReviewRoute
          ? `已绑定真实复核项 ${reviewItemId}，可在工作台摘要的高风险复核区提交复核或记录仅人工处理。`
          : "尚未生成真实复核项，当前只允许保留阻断，不显示可点击假按钮。"}
      </p>
    </div>
  );
}

function EditingRuntimeBindingCard(input: {
  explanation: Record<string, unknown>;
  automaticActionLedger: readonly Record<string, unknown>[];
}) {
  const decisionClasses = readStringArray(input.explanation.decisionClasses);
  const unsupportedGroups = readStringArray(
    input.explanation.unsupportedTableFactGroups,
  );
  const tableCount =
    typeof input.explanation.tableCount === "number"
      ? input.explanation.tableCount
      : 0;

  return (
    <article className="manuscript-workbench-detail-ledger-card manuscript-workbench-detail-governance-card">
      <div className="manuscript-workbench-detail-card-header">
        <div>
          <h4>运行时绑定与自动动作账本</h4>
          <p>展示本次编辑实际绑定的期刊目标模型、表格证据、规则决策和写回验证状态。</p>
        </div>
      </div>

      <dl className="manuscript-workbench-detail-metadata">
        <div>
          <dt>表格证据数</dt>
          <dd>{String(tableCount)}</dd>
        </div>
        <div>
          <dt>目标模型版本</dt>
          <dd>
            {typeof input.explanation.targetModelVersionNo === "number"
              ? `v${input.explanation.targetModelVersionNo}`
              : "未绑定"}
          </dd>
        </div>
        <div>
          <dt>决策类别</dt>
          <dd>{decisionClasses.length > 0 ? decisionClasses.join(" / ") : "未记录"}</dd>
        </div>
        <div>
          <dt>证据缺口</dt>
          <dd>{unsupportedGroups.length > 0 ? unsupportedGroups.join(" / ") : "无"}</dd>
        </div>
      </dl>

      {input.automaticActionLedger.length > 0 ? (
        <ul className="manuscript-workbench-detail-comment-list">
          {input.automaticActionLedger.map((entry, index) => (
            <li
              key={`${readOptionalString(entry.action_id) ?? "action"}-${index}`}
              className="manuscript-workbench-detail-comment-item"
            >
              <strong>
                {readOptionalString(entry.action_class) ?? "automatic_action"} ·{" "}
                {readOptionalString(entry.patch_type) ?? "unknown_patch"}
              </strong>
              <p>
                {`规则 ${readOptionalString(entry.rule_id) ?? "未记录"}，表格 ${
                  readOptionalString(entry.table_id) ?? "未记录"
                }，写回 ${readOptionalString(entry.writeback_status) ?? "未尝试"}`}
              </p>
              {asRecord(entry.validation_snapshot) ? (
                <small>
                  {`验证 ${
                    readOptionalString(asRecord(entry.validation_snapshot)?.status) ??
                    "未记录"
                  } · 回滚点 ${
                    readOptionalString(asRecord(entry.rollback_point)?.source_patch_id) ??
                    "未记录"
                  }`}
                </small>
              ) : null}
              {readStringArray(entry.downgrade_reasons).length > 0 ? (
                <p>
                  {`降级原因：${readStringArray(entry.downgrade_reasons).join("；")}`}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="manuscript-workbench-detail-empty">
          <strong>暂无自动动作账本</strong>
          <p>本次运行没有产生表格写回或重建动作，或旧任务尚未记录该账本。</p>
        </div>
      )}
    </article>
  );
}

function formatKnowledgeHitMatchSourceLabel(
  value: KnowledgeHitLogViewModel["match_source"],
): string {
  switch (value) {
    case "binding_rule":
      return "绑定规则";
    case "template_binding":
      return "模板绑定";
    case "dynamic_routing":
      return "动态路由";
    case "knowledge_item_binding":
      return "知识项绑定";
    case "draft_snapshot_reuse":
      return "复用草稿快照";
    default:
      return value;
  }
}

function formatKnowledgeHitActivationSource(
  log: KnowledgeHitLogViewModel,
  qualityPackages: NonNullable<ExecutionTrackingSnapshotViewModel["quality_packages"]>,
): string | undefined {
  const sourceId = log.match_source_id?.trim();
  if (!sourceId) {
    return undefined;
  }

  const [prefix, second, third] = sourceId.split(":");
  switch (prefix) {
    case "template_family":
      return `模板族激活：${second ?? sourceId}`;
    case "module_template":
      return `模块模板激活：${second ?? sourceId}`;
    case "journal_template":
      return `期刊模板激活：${second ?? sourceId}`;
    case "knowledge_item":
      return `关联知识项激活：${second ?? sourceId}`;
    case "general_package":
    case "medical_package":
      return formatRuntimeQualityPackageActivation({
        matchPrefix: prefix,
        packageId: second,
        qualityPackages,
      });
    case "general_package_kind":
    case "medical_package_kind":
      return formatRuntimeQualityPackageActivation({
        matchPrefix: prefix === "general_package_kind" ? "general_package" : "medical_package",
        packageId: third,
        qualityPackages,
        packageKind: normalizeQualityPackageKind(second),
        kindFallback: true,
      });
    default:
      return sourceId;
  }
}

function formatRuntimeQualityPackageActivation(input: {
  matchPrefix: "general_package" | "medical_package";
  packageId?: string;
  qualityPackages: NonNullable<ExecutionTrackingSnapshotViewModel["quality_packages"]>;
  packageKind?: NonNullable<
    ExecutionTrackingSnapshotViewModel["quality_packages"]
  >[number]["package_kind"];
  kindFallback?: boolean;
}): string {
  const scopeLabel = input.matchPrefix === "general_package" ? "通用包" : "医用包";
  const matchedPackage =
    (input.packageId &&
      input.qualityPackages.find((entry) => entry.package_id === input.packageId)) ||
    undefined;
  const runtimeKindLabel =
    input.packageKind || matchedPackage?.package_kind
      ? formatQualityPackageKindLabel(
          input.packageKind ?? matchedPackage?.package_kind ?? "general_style_package",
        )
      : scopeLabel;
  const packageLabel = matchedPackage
    ? `${formatQualityPackageLabel(matchedPackage)}（${matchedPackage.package_id}）`
    : input.packageId ?? "未记录";

  if (input.kindFallback) {
    return `按${scopeLabel}类型激活：${runtimeKindLabel} -> ${packageLabel}`;
  }

  return `精确${scopeLabel}版本激活：${packageLabel}`;
}

function normalizeQualityPackageKind(
  value: string | undefined,
): NonNullable<
  ExecutionTrackingSnapshotViewModel["quality_packages"]
>[number]["package_kind"] | undefined {
  if (
    value === "general_style_package" ||
    value === "medical_analyzer_package"
  ) {
    return value;
  }

  return undefined;
}

function formatEditingGuardrailReasonLabel(reasonCode: string): string {
  switch (reasonCode) {
    case "meaning_risk":
      return "存在语义风险（meaning_risk）";
    case "anchor_not_precise":
      return "锚点不够精确（anchor_not_precise）";
    case "numeric_entity_present":
      return "包含数值实体（numeric_entity_present）";
    case "medical_entity_present":
      return "包含医学实体（medical_entity_present）";
    case "object_type_not_safe":
      return "对象类型不安全（object_type_not_safe）";
    case "insufficient_style_evidence":
      return "样式证据不足（insufficient_style_evidence）";
    default:
      return reasonCode;
  }
}

function formatEditingGuardrailSourceStageLabel(
  value: EditingGuardrailEntry["sourceStage"],
): string {
  switch (value) {
    case "planning":
      return "AI 规划拦截";
    case "docx_transform":
      return "DOCX 落稿拦截";
    default:
      return value;
  }
}

function formatEditingSlotStateLabel(
  value: EditingSlotGovernanceSummary["slots"][number]["state"],
): string {
  switch (value) {
    case "resolved_auto":
      return "自动解决";
    case "resolved_manual":
      return "人工解决";
    case "recognized_misplaced":
      return "识别到但位置不对";
    case "conflicted_candidates":
      return "候选冲突";
    case "low_confidence_pending_review":
      return "低置信待核对";
    default:
      return "缺失";
  }
}

function formatEditingSlotManualResolutionKindLabel(
  value: EditingSlotManualResolutionKind,
): string {
  switch (value) {
    case "picked_candidate":
      return "采用候选";
    case "manual_entry":
      return "人工录入";
    case "waived":
      return "人工豁免";
    default:
      return value;
  }
}

function formatEditingCompletionGateVerdictLabel(
  value: EditingCompletionGateSummary["verdict"],
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

function formatEditingCompletionGatePendingItemMeta(
  item: EditingCompletionGateSummary["unresolved_required_slots"][number],
): string {
  const parts = [
    formatEditingCompletionGateSourceLabel(item.source),
    item.location_text,
    item.related_slot_key ? `槽位 ${item.related_slot_key}` : undefined,
    item.related_rule_id ? `规则 ${item.related_rule_id}` : undefined,
    item.review_item_id ? `复核项 ${item.review_item_id}` : undefined,
    item.status === "waived"
      ? "已豁免"
      : item.status === "resolved"
        ? "已解决"
        : "待处理",
  ].filter((value): value is string => Boolean(value));

  return parts.join(" · ");
}

function renderEditingCompletionGateItemDetail(
  item: EditingCompletionGateSummary["unresolved_required_slots"][number],
) {
  if (!item.detail) {
    return null;
  }

  if (item.category !== "high_risk_object") {
    return <p>{item.detail}</p>;
  }

  const segments = item.detail
    .split("；")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length <= 1) {
    return <p>{item.detail}</p>;
  }

  return (
    <div className="manuscript-workbench-detail-comment-copy">
      {segments.map((segment) => (
        <p key={segment}>{segment}</p>
      ))}
    </div>
  );
}

function formatEditingCompletionGateSourceLabel(
  value: EditingCompletionGateSummary["unresolved_required_slots"][number]["source"],
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

function formatEditingCompletionGateDecisionLabel(
  value: NonNullable<
    EditingCompletionGateSummary["manual_object_decisions"]
  >[number]["decision"],
): string {
  switch (value) {
    case "accepted_change_only":
      return "仅接受改动";
    case "manual_only":
      return "仅人工处理";
    case "waived":
      return "人工豁免";
    default:
      return value;
  }
}

function formatQualityPackageLabel(
  value: NonNullable<ExecutionTrackingSnapshotViewModel["quality_packages"]>[number],
): string {
  return `${value.package_name} v${value.version} · ${formatQualityPackageKindLabel(
    value.package_kind,
  )}`;
}

function formatQualityPackageKindLabel(
  value: NonNullable<ExecutionTrackingSnapshotViewModel["quality_packages"]>[number]["package_kind"],
): string {
  switch (value) {
    case "general_style_package":
      return "通用包";
    case "medical_analyzer_package":
      return "医用包";
    default:
      return value;
  }
}

function formatQualityActionLabel(
  value: NonNullable<
    NonNullable<ExecutionTrackingSnapshotViewModel["quality_findings_summary"]>["highest_action"]
  >,
): string {
  switch (value) {
    case "auto_fix":
      return "自动修正";
    case "suggest_fix":
      return "建议修正";
    case "manual_review":
      return "人工复核";
    case "block":
      return "阻断";
    default:
      return value;
  }
}

function resolveDetailEyebrow(detailKind: ManuscriptAssetDetailKind): string {
  if (detailKind === "report_preview") {
    return "结果预览";
  }

  return "稿件预览";
}

function resolveDetailTitle(
  detailKind: ManuscriptAssetDetailKind,
  mode: ManuscriptWorkbenchMode,
): string {
  if (detailKind === "report_preview") {
    return mode === "screening" ? "初筛报告预览" : "校对报告预览";
  }

  return mode === "editing" ? "编辑稿预览" : "稿件预览";
}

function resolvePreviewPanelTitle(detailKind: ManuscriptAssetDetailKind): string {
  return detailKind === "report_preview" ? "报告正文" : "稿件预览";
}

function resolveDetailDownloadLabel(asset: DocumentAssetViewModel): string {
  return resolveWorkbenchAssetDownloadLabel(asset.asset_type) ?? "下载当前稿件";
}

export function resolvePreviewOperationalState(input: {
  asset: DocumentAssetViewModel;
  previewSession?: DocumentPreviewSessionViewModel | null;
}):
  | {
      status: DocumentPreviewSessionViewModel["status"];
      warnings: string[];
    }
  | null {
  if (!input.previewSession) {
    return null;
  }

  if (isLegacyDocAsset(input.asset)) {
    return {
      status: "pending_normalization",
      warnings:
        input.previewSession.warnings.length > 0
          ? [...input.previewSession.warnings]
          : ["Legacy .doc source is awaiting normalization to .docx."],
    };
  }

  return {
    status: input.previewSession.status,
    warnings: [...input.previewSession.warnings],
  };
}

function formatPreviewStatusLabel(
  status: DocumentPreviewSessionViewModel["status"],
): string {
  if (status === "ready") {
    return "预览就绪";
  }

  if (status === "pending_normalization") {
    return "等待规范化";
  }

  return status;
}

function formatPreviewViewerLabel(
  viewer: DocumentPreviewSessionViewModel["viewer"],
): string {
  if (viewer === "onlyoffice") {
    return "文档预览";
  }

  return "稿件预览";
}

function formatPreviewModeLabel(
  mode: DocumentPreviewSessionViewModel["mode"],
): string {
  if (mode === "view") {
    return "只读查看";
  }

  return mode;
}

function formatPreviewCommentSourceLabel(
  commentSource: DocumentPreviewSessionViewModel["comment_source"],
): string {
  if (commentSource === "onlyoffice") {
    return "文档批注";
  }

  return "系统批注";
}

function resolveProofreadingDecisionLabel(
  action: ProofreadingConfirmationDecisionAction,
): string {
  const matchingAction = CONFIRMATION_ACTIONS.find((entry) => entry.value === action);
  return matchingAction?.label ?? "已处理";
}

function isLegacyDocAsset(asset: DocumentAssetViewModel): boolean {
  const normalizedFileName = asset.file_name?.trim().toLowerCase();
  if (normalizedFileName?.endsWith(".docx")) {
    return false;
  }

  if (normalizedFileName?.endsWith(".doc")) {
    return true;
  }

  return asset.mime_type === "application/msword";
}

function renderStringArraySection(title: string, items: readonly string[]): string[] {
  if (items.length === 0) {
    return [];
  }

  return [title, ...items.map((item) => `- ${item}`), ""];
}

function renderProofreadingIssueSection(
  items: readonly ProofreadingConfirmationItemViewModel[],
): string[] {
  if (items.length === 0) {
    return [];
  }

  return [
    "问题队列",
    ...items.map(
      (item) =>
        `- [${item.severity ?? "medium"}] ${item.title ?? item.itemId}: ${item.targetText}`,
    ),
    "",
  ];
}

function resolveEditingDocumentBlockIndex(input: {
  documentBlocks: readonly ProofreadingDocumentBlockViewModel[];
  explicitBlockIndex?: number;
  locator?: string;
  excerpts?: readonly (string | undefined)[];
}): number | undefined {
  if (
    typeof input.explicitBlockIndex === "number" &&
    Number.isInteger(input.explicitBlockIndex)
  ) {
    const directMatch = findWorkbenchDocumentBlockByIndex(
      input.documentBlocks,
      input.explicitBlockIndex,
    );
    if (directMatch) {
      return directMatch.blockIndex;
    }
  }

  const parsedIndex = input.locator
    ? parseWorkbenchDocumentBlockIndexFromLocator(input.locator)
    : undefined;
  if (typeof parsedIndex === "number") {
    const locatorMatch =
      input.documentBlocks.find((block) => block.sourceLocator === input.locator) ??
      findWorkbenchDocumentBlockByIndex(input.documentBlocks, parsedIndex);
    if (locatorMatch) {
      return locatorMatch.blockIndex;
    }
  }

  for (const excerpt of input.excerpts ?? []) {
    const matchedIndex = findWorkbenchDocumentBlockIndexByText(
      input.documentBlocks,
      excerpt,
    );
    if (typeof matchedIndex === "number") {
      return matchedIndex;
    }
  }

  return undefined;
}

function parseWorkbenchDocumentBlockIndexFromLocator(
  value: string,
): number | undefined {
  const bodyParagraphMatch = value.match(/body:p:(\d+)/iu);
  if (bodyParagraphMatch) {
    return Number(bodyParagraphMatch[1]);
  }

  const paragraphLabelMatch = value.match(/段落\s*(\d+)/u);
  if (paragraphLabelMatch) {
    return Number(paragraphLabelMatch[1]);
  }

  return undefined;
}

function findWorkbenchDocumentBlockByIndex(
  blocks: readonly ProofreadingDocumentBlockViewModel[],
  blockIndex: number,
): ProofreadingDocumentBlockViewModel | undefined {
  return blocks.find((block) => block.blockIndex === blockIndex);
}

function findWorkbenchDocumentBlockIndexByText(
  blocks: readonly ProofreadingDocumentBlockViewModel[],
  value: string | undefined,
): number | undefined {
  const normalizedNeedle = normalizeSearchableText(value);
  if (!normalizedNeedle || normalizedNeedle.length < 3) {
    return undefined;
  }

  const matchedBlock = blocks.find((block) =>
    normalizeSearchableText(block.text)?.includes(normalizedNeedle),
  );
  return matchedBlock?.blockIndex;
}

function normalizeSearchableText(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\s+/gu, " ").trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function formatWorkbenchDocumentBlockLabel(
  block: ProofreadingDocumentBlockViewModel,
): string {
  return block.sectionLabel ?? `段落 ${block.blockIndex + 1}`;
}

function formatEditingWorkspaceFocusOriginLabel(
  value: EditingWorkspaceFocusItemViewModel["origin"],
): string {
  switch (value) {
    case "slot":
      return "前置信息槽位";
    case "completion_gate":
      return "编辑完成门禁";
    case "guardrail":
      return "自动改动被拦截";
    case "change_ledger":
      return "改动台账";
    default:
      return value;
  }
}

function formatScreeningWorkspaceFocusOriginLabel(
  value: ScreeningWorkspaceFocusItemViewModel["origin"],
): string {
  switch (value) {
    case "risk":
      return "初筛风险判断";
    case "decision":
      return "初筛建议结论";
    case "summary":
      return "初筛证据摘要";
    case "quality_finding":
      return "质量问题";
    default:
      return value;
  }
}

function formatScreeningRiskLevelLabel(value: string): string {
  switch (value) {
    case "critical":
      return "严重风险";
    case "high":
      return "高风险";
    case "low":
      return "低风险";
    default:
      return "中风险";
  }
}

function formatScreeningDecisionLabel(value: string): string {
  switch (value) {
    case "accept":
      return "建议录用";
    case "minor_revision":
      return "建议小修";
    case "major_revision":
      return "建议大修";
    case "reject":
      return "建议退稿";
    default:
      return value;
  }
}

function resolveScreeningRiskTone(value: string): SharedReviewTone {
  if (value === "critical" || value === "high") {
    return "error";
  }

  if (value === "low") {
    return "success";
  }

  return "neutral";
}

function resolveScreeningDecisionTone(value: string): SharedReviewTone {
  if (value === "accept") {
    return "success";
  }

  if (value === "minor_revision") {
    return "neutral";
  }

  return "error";
}

function resolveScreeningFindingTone(
  severity?: string,
  action?: string,
): SharedReviewTone {
  if (severity === "critical" || severity === "high" || action === "block") {
    return "error";
  }

  if (action === "manual_review" || severity === "medium") {
    return "neutral";
  }

  return "success";
}

function formatEditingCompletionGatePendingCategoryLabel(
  value: EditingCompletionGateSummary["unresolved_required_slots"][number]["category"],
): string {
  switch (value) {
    case "required_slot":
      return "必填槽位";
    case "manual_resolution":
      return "人工处理";
    case "high_risk_object":
      return "高风险对象";
    case "table_high_risk":
      return "表格高风险";
    case "blocking_format_failure":
      return "格式阻断";
    default:
      return value;
  }
}

function resolveTonePillClassName(
  tone: SharedReviewTone,
): string {
  return `manuscript-workbench-status-pill ${
    tone === "success"
      ? "is-success"
      : tone === "neutral"
        ? "is-neutral"
        : "is-error"
  }`;
}

function formatLocationText(value: unknown): string | undefined {
  const semanticHit = asRecord(value);
  if (
    semanticHit &&
    typeof semanticHit.paragraph_index === "number" &&
    Number.isFinite(semanticHit.paragraph_index)
  ) {
    return `段落 ${semanticHit.paragraph_index}`;
  }

  return undefined;
}

function formatSeverityLabel(severity?: string): string {
  switch (severity) {
    case "critical":
      return "严重";
    case "high":
      return "高";
    case "low":
      return "低";
    default:
      return "中";
  }
}

function formatOptionalNumber(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : "未记录";
}

function resolveSeverityClassName(severity?: string): string {
  return `manuscript-workbench-status-pill ${
    severity === "critical" || severity === "high"
      ? "is-error"
      : severity === "low"
        ? "is-neutral"
        : "is-success"
  }`;
}

function normalizeProofreadingAnchor(
  value: Record<string, unknown> | undefined,
  index: number,
  targetText: string,
): ProofreadingIssueAnchorViewModel | undefined {
  if (!value) {
    return {
      blockIndex: index,
      quote: targetText,
    };
  }

  const blockIndex =
    typeof value.blockIndex === "number" && Number.isInteger(value.blockIndex)
      ? value.blockIndex
      : index;
  const quote = readOptionalString(value.quote) ?? targetText;
  if (!quote) {
    return undefined;
  }

  return {
    blockIndex,
    quote,
    ...(readOptionalString(value.sectionLabel)
      ? {
          sectionLabel: readOptionalString(value.sectionLabel),
        }
      : {}),
    ...(readOptionalString(value.blockKind)
      ? {
          blockKind: readOptionalString(value.blockKind),
        }
      : {}),
    ...(normalizeProofreadingDocumentLocator(asRecord(value.documentLocator))
      ? {
          documentLocator: normalizeProofreadingDocumentLocator(
            asRecord(value.documentLocator),
          ),
        }
      : {}),
  };
}

function buildProofreadingQualityFindingConfirmationItems(
  proofreadingFindings: Record<string, unknown> | undefined,
): ProofreadingConfirmationItemViewModel[] {
  const qualityFindings = Array.isArray(proofreadingFindings?.qualityFindings)
    ? proofreadingFindings.qualityFindings
    : [];

  return qualityFindings.flatMap((entry, index) => {
    const finding = asRecord(entry);
    if (!finding) {
      return [];
    }

    const evidencePack = asRecord(finding.evidence_pack);
    const targetText =
      readOptionalString(finding.excerpt) ??
      readOptionalString(evidencePack?.excerpt);
    if (!targetText) {
      return [];
    }

    const replacementText =
      readOptionalString(finding.suggestion) ??
      readOptionalString(evidencePack?.suggestion) ??
      "";
    const severity = normalizeProofreadingSeverity(finding.severity);
    const location = asRecord(finding.location) ?? asRecord(evidencePack?.location);
    const anchor = buildProofreadingQualityFindingAnchor(location, index, targetText);
    const blocksFinal =
      Boolean(finding.blocksFinal) || severity === "high" || severity === "critical";

    return [
      {
        itemId: readOptionalString(finding.id) ?? `quality-${index + 1}`,
        title: readOptionalString(finding.title),
        description:
          readOptionalString(finding.summary) ??
          readOptionalString(finding.rationale) ??
          readOptionalString(evidencePack?.rationale),
        ...(severity
          ? {
              severity,
            }
          : {}),
        source: "quality_check",
        issueType:
          readOptionalString(finding.issueType) ??
          readOptionalString(finding.issue_type) ??
          "quality",
        blocksFinal,
        targetText,
        replacementText,
        ...(anchor
          ? {
              anchor,
            }
          : {}),
        ...(replacementText
          ? {
              suggestionAction: "replace_text",
            }
          : {}),
      },
    ];
  });
}

function buildProofreadingFailedCheckConfirmationItems(
  proofreadingFindings: Record<string, unknown> | undefined,
): ProofreadingConfirmationItemViewModel[] {
  const failedChecks = Array.isArray(proofreadingFindings?.failedChecks)
    ? proofreadingFindings.failedChecks
    : [];

  return failedChecks.flatMap((entry, index) => {
    const failedCheck = asRecord(entry);
    if (!failedCheck) {
      return [];
    }

    const targetText =
      readOptionalString(failedCheck.actual) ??
      readOptionalString(failedCheck.excerpt);
    if (!targetText) {
      return [];
    }

    const replacementText =
      readOptionalString(failedCheck.expected) ??
      readOptionalString(failedCheck.suggestion) ??
      "";
    const ruleId = readOptionalString(failedCheck.ruleId);
    const severity = normalizeProofreadingSeverity(failedCheck.severity);
    const description =
      readOptionalString(failedCheck.explanation) ??
      readOptionalString(failedCheck.reason);
    const location =
      asRecord(failedCheck.location) ?? asRecord(failedCheck.semantic_hit);
    const anchor = buildProofreadingQualityFindingAnchor(location, index, targetText);
    const blocksFinal =
      Boolean(failedCheck.blocksFinal) || severity === "high" || severity === "critical";

    return [
      {
        itemId: ruleId ?? `failed-check-${index + 1}`,
        title: ruleId
          ? `规则 ${ruleId} 需要人工确认`
          : "高风险规则命中需要人工确认",
        ...(description
          ? {
              description,
            }
          : {}),
        ...(severity
          ? {
              severity,
            }
          : {}),
        source: "quality_check",
        issueType: "failed_check",
        blocksFinal,
        targetText,
        replacementText,
        ...(anchor
          ? {
              anchor,
            }
          : {}),
        ...(replacementText
          ? {
              suggestionAction: "replace_text",
            }
          : {}),
      },
    ];
  });
}

function buildProofreadingQualityFindingAnchor(
  location: Record<string, unknown> | undefined,
  index: number,
  targetText: string,
): ProofreadingIssueAnchorViewModel | undefined {
  if (!location) {
    return normalizeProofreadingAnchor(undefined, index, targetText);
  }

  const blockIndex =
    typeof location.blockIndex === "number" && Number.isInteger(location.blockIndex)
      ? location.blockIndex
      : typeof location.paragraph_index === "number" &&
          Number.isInteger(location.paragraph_index)
        ? location.paragraph_index
        : index;
  const quote = resolveProofreadingLocationSearchQuote(location, targetText);

  return normalizeProofreadingAnchor(
    {
      blockIndex,
      quote,
      ...(readOptionalString(location.sectionLabel)
        ? {
            sectionLabel: readOptionalString(location.sectionLabel),
          }
        : {}),
      ...(readOptionalString(location.blockKind)
        ? {
            blockKind: readOptionalString(location.blockKind),
          }
        : {}),
    },
    blockIndex,
    targetText,
  );
}

function resolveProofreadingLocationSearchQuote(
  location: Record<string, unknown>,
  fallbackQuote: string,
): string {
  const semanticTarget =
    readOptionalString(location.semantic_target) ??
    readOptionalString(location.semanticTarget);
  const headerPath = readStringArray(location.header_path ?? location.headerPath);
  const rowKey = readOptionalString(location.row_key) ?? readOptionalString(location.rowKey);
  const columnKey =
    readOptionalString(location.column_key) ?? readOptionalString(location.columnKey);
  const footnoteAnchor =
    readOptionalString(location.footnote_anchor) ??
    readOptionalString(location.footnoteAnchor);
  const candidates: string[] = [];

  if (semanticTarget === "header_cell") {
    const leafHeaderText =
      headerPath.length > 0 ? headerPath[headerPath.length - 1] : undefined;
    if (leafHeaderText) {
      candidates.push(leafHeaderText);
    }
  }

  if (semanticTarget === "data_cell" && rowKey) {
    candidates.push(rowKey);
  }

  if (semanticTarget === "footnote_item" && footnoteAnchor) {
    candidates.push(footnoteAnchor);
  }

  const trailingColumnSegment = extractTrailingSemanticPathSegment(columnKey);
  if (trailingColumnSegment) {
    candidates.push(trailingColumnSegment);
  }

  const fallbackPathSegment = extractTrailingSemanticPathSegment(fallbackQuote);
  if (fallbackPathSegment) {
    candidates.push(fallbackPathSegment);
  }

  const firstUsableCandidate = dedupeSemanticSearchCandidates(candidates).find(
    (candidate) => candidate.length > 0,
  );

  return firstUsableCandidate ?? fallbackQuote;
}

function extractTrailingSemanticPathSegment(value: string | undefined): string | undefined {
  const normalized = readOptionalString(value);
  if (!normalized || !normalized.includes(">")) {
    return normalized;
  }

  const segments = normalized
    .split(">")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .filter((entry) => !/^table-\d+$/iu.test(entry));
  if (segments.length === 0) {
    return normalized;
  }

  return segments[segments.length - 1];
}

function dedupeSemanticSearchCandidates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    const normalized = readOptionalString(value);
    if (!normalized) {
      continue;
    }

    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    deduped.push(normalized);
  }

  return deduped;
}

function normalizeProofreadingSeverity(value: unknown): string | undefined {
  const severity = readOptionalString(value);
  switch (severity) {
    case "critical":
    case "high":
    case "medium":
    case "low":
      return severity;
    case "error":
      return "high";
    case "warning":
      return "medium";
    case "info":
      return "low";
    default:
      return severity;
  }
}

function dedupeProofreadingConfirmationItems(
  items: readonly ProofreadingConfirmationItemViewModel[],
): ProofreadingConfirmationItemViewModel[] {
  const deduped = new Map<string, ProofreadingConfirmationItemViewModel>();

  for (const item of items) {
    if (!deduped.has(item.itemId)) {
      deduped.set(item.itemId, item);
    }
  }

  return [...deduped.values()];
}

function normalizeProofreadingDocumentLocator(
  value: Record<string, unknown> | undefined,
): ProofreadingDocumentLocatorViewModel | undefined {
  if (!value) {
    return undefined;
  }

  const anchorKind = readOptionalString(value.anchorKind);
  const anchorKey = readOptionalString(value.anchorKey);
  if (!anchorKind || !anchorKey) {
    return undefined;
  }

  return {
    anchorKind: anchorKind as ProofreadingDocumentLocatorViewModel["anchorKind"],
    anchorKey,
    ...(readOptionalString(value.confidence)
      ? {
          confidence:
            readOptionalString(value.confidence) as ProofreadingDocumentLocatorViewModel["confidence"],
        }
      : {}),
    ...(typeof value.blockIndex === "number" && Number.isInteger(value.blockIndex)
      ? {
          blockIndex: value.blockIndex,
        }
      : {}),
    ...(readOptionalString(value.sectionLabel)
      ? {
          sectionLabel: readOptionalString(value.sectionLabel),
        }
      : {}),
    ...(typeof value.ordinalWithinSection === "number" &&
    Number.isInteger(value.ordinalWithinSection)
      ? {
          ordinalWithinSection: value.ordinalWithinSection,
        }
      : {}),
    ...(readOptionalString(value.tableId)
      ? {
          tableId: readOptionalString(value.tableId),
        }
      : {}),
    ...(readOptionalString(value.tableTarget)
      ? {
          tableTarget: readOptionalString(value.tableTarget),
        }
      : {}),
    ...(readOptionalString(value.rowKey)
      ? {
          rowKey: readOptionalString(value.rowKey),
        }
      : {}),
    ...(readOptionalString(value.columnKey)
      ? {
          columnKey: readOptionalString(value.columnKey),
        }
      : {}),
    ...(readOptionalString(value.footnoteAnchor)
      ? {
          footnoteAnchor: readOptionalString(value.footnoteAnchor),
        }
      : {}),
  };
}

function parseEditingGuardrailManualReviewItem(
  value: string,
): EditingGuardrailEntry | undefined {
  const prefix = "editing_guardrail:";
  if (!value.startsWith(prefix)) {
    return undefined;
  }

  const remainder = value.slice(prefix.length);
  const separatorIndex = remainder.indexOf(":");
  if (separatorIndex <= 0) {
    return undefined;
  }

  const reasonCode = remainder.slice(0, separatorIndex).trim();
  const excerpt = remainder.slice(separatorIndex + 1).trim();
  if (!reasonCode || !excerpt) {
    return undefined;
  }

  return {
    id: `editing-guardrail-plan:${reasonCode}:${excerpt}`,
    sourceStage: "planning",
    reasonCode,
    excerpt,
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : [];
}
