import React from "react";
import { formatWorkbenchHash } from "../../app/workbench-routing.ts";
import type { DocumentPreviewSessionViewModel } from "../document-preview/index.ts";
import type {
  KnowledgeHitLogViewModel,
  ModuleExecutionSnapshotViewModel as ExecutionTrackingSnapshotViewModel,
} from "../execution-tracking/types.ts";
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
import type {
  ManuscriptWorkbenchKnowledgeReferenceViewModel,
  ManuscriptWorkbenchMode,
} from "./manuscript-workbench-controller.ts";

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

export interface ManuscriptWorkbenchAssetDetailPageProps {
  mode: ManuscriptWorkbenchMode;
  manuscriptTitle: string;
  asset: DocumentAssetViewModel;
  detailKind: ManuscriptAssetDetailKind;
  backHref: string;
  downloadHref: string;
  previewSession?: DocumentPreviewSessionViewModel | null;
  reportBody?: string | null;
  changeLedger?: readonly EditingChangeLedgerEntry[];
  editingGuardrails?: readonly EditingGuardrailEntry[];
  executionSnapshot?: ExecutionTrackingSnapshotViewModel | null;
  knowledgeHitLogs?: readonly KnowledgeHitLogViewModel[];
  knowledgeReferences?: Readonly<
    Record<string, ManuscriptWorkbenchKnowledgeReferenceViewModel>
  >;
  confirmationItems?: readonly ProofreadingConfirmationItemViewModel[];
  confirmationState?: Readonly<Record<string, ProofreadingConfirmationDraftState>>;
  proofreadingDocumentBlocks?: readonly ProofreadingDocumentBlockViewModel[];
  activeProofreadingIssueId?: string;
  isFinalizeEnabled?: boolean;
  isFinalizing?: boolean;
  onProofreadingIssueSelect?(itemId: string): void;
  onConfirmationActionChange?(
    itemId: string,
    action: ProofreadingConfirmationDecisionAction,
  ): void;
  onConfirmationEditedReplacementTextChange?(itemId: string, value: string): void;
  onConfirmationNoteChange?(itemId: string, value: string): void;
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

export function buildProofreadingConfirmationItems(
  job: Pick<JobViewModel, "payload"> | null | undefined,
): ProofreadingConfirmationItemViewModel[] {
  const payload = asRecord(job?.payload);
  const plan = asRecord(payload?.proofreadingPlan);

  if (Array.isArray(plan?.issues)) {
    return plan.issues.flatMap((entry, index) => {
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
    });
  }

  if (!Array.isArray(plan?.corrections)) {
    return [];
  }

  return plan.corrections.flatMap((entry, index) => {
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
  });
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
  previewSession = null,
  reportBody = null,
  changeLedger = [],
  editingGuardrails = [],
  executionSnapshot = null,
  knowledgeHitLogs = [],
  knowledgeReferences,
  confirmationItems = [],
  confirmationState = {},
  proofreadingDocumentBlocks = [],
  activeProofreadingIssueId,
  isFinalizeEnabled = false,
  isFinalizing = false,
  onProofreadingIssueSelect,
  onConfirmationActionChange,
  onConfirmationEditedReplacementTextChange,
  onConfirmationNoteChange,
  onFinalize,
}: ManuscriptWorkbenchAssetDetailPageProps) {
  const assetRoleLabel = formatWorkbenchAssetTypeLabel(asset.asset_type);
  const assetDisplayName = buildWorkbenchAssetDisplayName(manuscriptTitle, asset);
  const previewOperationalState = resolvePreviewOperationalState({
    asset,
    previewSession,
  });
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

  if (
    detailKind === "proofreading_workspace" ||
    detailKind === "proofreading_confirmation"
  ) {
    const activeIssue =
      confirmationItems.find((item) => item.itemId === activeProofreadingIssueId) ??
      confirmationItems[0] ??
      null;
    const activeIssueDraft =
      (activeIssue && confirmationState[activeIssue.itemId]) ?? {};
    const activeBlockIndex = activeIssue?.anchor?.blockIndex;

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

        <div className="manuscript-workbench-proofreading-layout-grid">
          <article className="manuscript-workbench-proofreading-manuscript-pane">
            <div className="manuscript-workbench-detail-card-header">
              <div>
                <h4>稿件原文</h4>
                <p>{assetDisplayName}</p>
                <small>{assetRoleLabel}</small>
              </div>
            </div>
            {proofreadingDocumentBlocks.length > 0 ? (
              <div className="manuscript-workbench-proofreading-block-list">
                {proofreadingDocumentBlocks.map((block) => (
                  <article
                    key={block.blockId}
                    id={block.blockId}
                    className={`manuscript-workbench-proofreading-block${
                      activeBlockIndex === block.blockIndex ? " is-selected" : ""
                    }`}
                    data-selected={
                      activeBlockIndex === block.blockIndex ? "true" : "false"
                    }
                  >
                    <header>
                      <strong>{block.sectionLabel ?? `段落 ${block.blockIndex + 1}`}</strong>
                      <span>{block.blockKind ?? "paragraph"}</span>
                    </header>
                    <p>{block.text}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="manuscript-workbench-detail-empty">
                <strong>暂无稿件正文块</strong>
                <p>当前校对任务没有保存可定位的全文块，无法进入问题工作台定位模式。</p>
              </div>
            )}
          </article>

          <article className="manuscript-workbench-proofreading-issue-pane">
            <div className="manuscript-workbench-detail-card-header">
              <div>
                <h4>问题队列</h4>
                <p>点击问题可定位到对应稿件位置，并在右侧展开人工确认。</p>
              </div>
            </div>
            {confirmationItems.length > 0 ? (
              <div className="manuscript-workbench-proofreading-issue-list">
                {confirmationItems.map((item) => {
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
                          <strong>{item.title ?? item.itemId}</strong>
                          <p>{item.anchor?.sectionLabel ?? "未标注章节"}</p>
                        </div>
                        <span className={resolveSeverityClassName(item.severity)}>
                          {formatSeverityLabel(item.severity)}
                        </span>
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
              <button
                type="button"
                disabled={!isFinalizeEnabled || isFinalizing}
                onClick={() => onFinalize?.()}
              >
                {isFinalizing ? "发布中..." : "发布人工终稿"}
              </button>
            </div>

            {governanceEvidenceCard}
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

        {editingGuardrailCard}

        {governanceEvidenceCard}
      </div>
    </section>
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
    sectionLabel: readOptionalString(value.sectionLabel),
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

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : [];
}
