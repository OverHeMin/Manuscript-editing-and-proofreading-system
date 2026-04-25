import React from "react";
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
  DocumentAssetViewModel,
  JobViewModel,
} from "../manuscripts/index.ts";
import type { ProofreadingConfirmationDecisionAction } from "../proofreading/types.ts";
import {
  buildWorkbenchAssetDisplayName,
  formatWorkbenchAssetTypeLabel,
  resolveWorkbenchAssetDownloadLabel,
} from "./manuscript-workbench-asset-labels.ts";
import type { ManuscriptWorkbenchMode } from "./manuscript-workbench-controller.ts";

export type ManuscriptAssetDetailKind =
  | "document_preview"
  | "report_preview"
  | "proofreading_workspace"
  | "proofreading_confirmation";

export interface EditingChangeLedgerEntry {
  id: string;
  sourceLabel: string;
  before: string;
  after: string;
  locationText?: string;
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
  sectionLabel?: string;
  blockKind?: string;
  text: string;
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
  confirmationItems?: readonly ProofreadingConfirmationItemViewModel[];
  confirmationState?: Readonly<Record<string, ProofreadingConfirmationDraftState>>;
  proofreadingDocumentBlocks?: readonly ProofreadingDocumentBlockViewModel[];
  activeProofreadingIssueId?: string;
  activeProofreadingLocateTarget?: DocumentPreviewLocateTargetViewModel | null;
  isFinalizeEnabled?: boolean;
  isFinalizing?: boolean;
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
  onFinalize?(): void;
}

export function buildWorkbenchAssetDetailHref(input: {
  mode: ManuscriptWorkbenchMode;
  manuscriptId: string;
  assetId: string;
  reviewedCaseSnapshotId?: string;
  sampleSetItemId?: string;
}): string {
  return formatWorkbenchHash(input.mode, {
    manuscriptId: input.manuscriptId,
    assetId: input.assetId,
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
      },
    ];
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
  const payload = asRecord(job?.payload);
  if (!Array.isArray(payload?.proofreadingSourceBlocks)) {
    return [];
  }

  return payload.proofreadingSourceBlocks.flatMap((entry, index) => {
    const block = asRecord(entry);
    const text = readOptionalString(block?.text);
    if (!text) {
      return [];
    }

    const blockIndex =
      typeof block?.blockIndex === "number" && Number.isInteger(block.blockIndex)
        ? block.blockIndex
        : index;

    return [
      {
        blockId: `proofreading-block-${blockIndex}`,
        blockIndex,
        sectionLabel: readOptionalString(block?.section),
        blockKind: readOptionalString(block?.block_kind),
        text,
      },
    ];
  });
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
  confirmationItems = [],
  confirmationState = {},
  proofreadingDocumentBlocks = [],
  activeProofreadingIssueId,
  activeProofreadingLocateTarget = null,
  isFinalizeEnabled = false,
  isFinalizing = false,
  onProofreadingIssueSelect,
  onConfirmationActionChange,
  onConfirmationEditedReplacementTextChange,
  onConfirmationNoteChange,
  onSaveDraft,
  draftSaveLabel,
  isDraftSaving = false,
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
                <h4>问题队列</h4>
                <p>点击问题可定位到对应稿件位置，并在右侧展开人工确认。</p>
              </div>
              <div className="manuscript-workbench-proofreading-issue-summary">
                <strong>{`共发现 ${issueSummary.totalCount} 项问题`}</strong>
                <span>{`高 ${issueSummary.highCount} · 中 ${issueSummary.mediumCount} · 低 ${issueSummary.lowCount}`}</span>
                <small>{`当前显示 ${issueSummary.filteredCount} / 共 ${issueSummary.totalCount}`}</small>
              </div>
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
            {confirmationItems.length > 0 ? (
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
            {draftSaveLabel ? (
              <p className="manuscript-workbench-proofreading-draft-status">
                {draftSaveLabel}
              </p>
            ) : null}
          </article>
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

        {changeLedger.length > 0 ? (
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
        ) : null}
      </div>
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

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : [];
}
