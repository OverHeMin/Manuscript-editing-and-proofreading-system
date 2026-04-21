import React from "react";
import { formatWorkbenchHash } from "../../app/workbench-routing.ts";
import type { DocumentPreviewSessionViewModel } from "../document-preview/index.ts";
import type {
  DocumentAssetViewModel,
  JobViewModel,
} from "../manuscripts/index.ts";
import type { ProofreadingConfirmationDecisionAction } from "../proofreading/types.ts";
import type { ManuscriptWorkbenchMode } from "./manuscript-workbench-controller.ts";

export type ManuscriptAssetDetailKind =
  | "document_preview"
  | "report_preview"
  | "proofreading_confirmation";

export interface EditingChangeLedgerEntry {
  id: string;
  sourceLabel: string;
  before: string;
  after: string;
  locationText?: string;
}

export interface ProofreadingConfirmationItemViewModel {
  itemId: string;
  targetText: string;
  replacementText: string;
  category?: string;
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
  confirmationItems?: readonly ProofreadingConfirmationItemViewModel[];
  confirmationState?: Readonly<Record<string, ProofreadingConfirmationDraftState>>;
  isFinalizeEnabled?: boolean;
  isFinalizing?: boolean;
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
  if (
    input.mode === "proofreading" &&
    input.assetType === "final_proof_annotated_docx"
  ) {
    return "proofreading_confirmation";
  }

  if (
    input.assetType === "screening_report" ||
    input.assetType === "proofreading_draft_report" ||
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
  }) !== "report_preview";
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
        } satisfies EditingChangeLedgerEntry,
      ];
    });
}

export function buildProofreadingConfirmationItems(
  job: Pick<JobViewModel, "payload"> | null | undefined,
): ProofreadingConfirmationItemViewModel[] {
  const payload = asRecord(job?.payload);
  const plan = asRecord(payload?.proofreadingPlan);
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
          targetText,
          replacementText,
          category: readOptionalString(correction?.category),
        } satisfies ProofreadingConfirmationItemViewModel,
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
      body: `${entry.before} → ${entry.after}`,
      anchor_text: entry.before,
    }));
  }

  const confirmationItems = buildProofreadingConfirmationItems(input.job);
  if (confirmationItems.length > 0) {
    return confirmationItems.map((item) => ({
      id: item.itemId,
      author: "AI 校对",
      body: `${item.targetText} → ${item.replacementText}`,
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

        return [{
          id: readOptionalString(decision?.itemId) ?? `decision-${index + 1}`,
          author: "人工确认",
          body: `${targetText} → ${replacementText}`,
          anchor_text: targetText,
        }];
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
      ...renderCorrectionSection(buildProofreadingConfirmationItems(job)),
      ...renderStringArraySection(
        "人工核查项",
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
  confirmationItems = [],
  confirmationState = {},
  isFinalizeEnabled = false,
  isFinalizing = false,
  onConfirmationActionChange,
  onConfirmationEditedReplacementTextChange,
  onConfirmationNoteChange,
  onFinalize,
}: ManuscriptWorkbenchAssetDetailPageProps) {
  const decidedCount = confirmationItems.filter(
    (item) => confirmationState[item.itemId]?.action,
  ).length;

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

      <div
        className={`manuscript-workbench-detail-layout${
          detailKind === "proofreading_confirmation"
            ? " is-proofreading-confirmation"
            : ""
        }`}
      >
        <article className="manuscript-workbench-detail-preview-card">
          <div className="manuscript-workbench-detail-card-header">
            <div>
              <h4>{resolvePreviewPanelTitle(detailKind)}</h4>
              <p>{asset.file_name ?? asset.id}</p>
            </div>
            {previewSession ? (
              <div className="manuscript-workbench-detail-session-metrics">
                <span>{previewSession.viewer}</span>
                <strong>{formatPreviewStatusLabel(previewSession.status)}</strong>
              </div>
            ) : null}
          </div>

          {previewSession ? (
            <dl className="manuscript-workbench-detail-metadata">
              <div>
                <dt>预览模式</dt>
                <dd>{previewSession.mode}</dd>
              </div>
              <div>
                <dt>批注数量</dt>
                <dd>{String(previewSession.comments.length)}</dd>
              </div>
              <div>
                <dt>评论来源</dt>
                <dd>{previewSession.comment_source}</dd>
              </div>
              <div>
                <dt>资产类型</dt>
                <dd>{asset.asset_type}</dd>
              </div>
            </dl>
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
              <p>当前页展示了真实文件入口，可直接打开或下载；如有批注与改动，也会同步显示在这里。</p>
            </div>
          )}
        </article>

        {detailKind === "proofreading_confirmation" ? (
          <article className="manuscript-workbench-detail-confirmation-card">
            <div className="manuscript-workbench-detail-card-header">
              <div>
                <h4>人工确认</h4>
                <p>
                  已确认 {decidedCount}/{confirmationItems.length} 项。只有这里明确确认过的内容，才会进入人工终稿并决定是否回流。
                </p>
              </div>
            </div>

            <div className="manuscript-workbench-detail-confirmation-list">
              {confirmationItems.map((item) => {
                const draft = confirmationState[item.itemId] ?? {};
                return (
                  <article
                    key={item.itemId}
                    className="manuscript-workbench-detail-confirmation-item"
                  >
                    <header>
                      <strong>{item.category ? `${item.category} 修改项` : "校对修改项"}</strong>
                      <span>{item.itemId}</span>
                    </header>
                    <dl>
                      <div>
                        <dt>原文</dt>
                        <dd>{item.targetText}</dd>
                      </div>
                      <div>
                        <dt>建议修改</dt>
                        <dd>{item.replacementText}</dd>
                      </div>
                    </dl>
                    <div className="manuscript-workbench-detail-decision-grid">
                      {CONFIRMATION_ACTIONS.map((action) => (
                        <button
                          key={action.value}
                          type="button"
                          className={
                            draft.action === action.value
                              ? "is-selected"
                              : undefined
                          }
                          onClick={() =>
                            onConfirmationActionChange?.(item.itemId, action.value)
                          }
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                    {draft.action === "accept_and_edit" ? (
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
                      <span>批注说明</span>
                      <textarea
                        value={draft.note ?? ""}
                        onChange={(event) =>
                          onConfirmationNoteChange?.(item.itemId, event.target.value)
                        }
                      />
                    </label>
                  </article>
                );
              })}
            </div>

            <div className="manuscript-workbench-button-row manuscript-workbench-button-row--sticky">
              <button
                type="button"
                disabled={!isFinalizeEnabled || isFinalizing}
                onClick={() => onFinalize?.()}
              >
                {isFinalizing ? "发布中..." : "发布人工终稿"}
              </button>
            </div>
          </article>
        ) : changeLedger.length > 0 ? (
          <article className="manuscript-workbench-detail-ledger-card">
            <div className="manuscript-workbench-detail-card-header">
              <div>
                <h4>改动台账</h4>
                <p>这一页展示 AI 编辑的真实改动条目，和预览批注一一对应。</p>
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

const CONFIRMATION_ACTIONS: ReadonlyArray<{
  value: ProofreadingConfirmationDecisionAction;
  label: string;
}> = [
  { value: "accept", label: "接受" },
  { value: "accept_and_edit", label: "接受并编辑" },
  { value: "reject", label: "拒绝" },
  { value: "manual_only", label: "仅人工处理" },
  { value: "route_to_rule_candidate", label: "路由到规则候选" },
  { value: "route_to_knowledge_candidate", label: "路由到知识候选" },
];

function resolveDetailEyebrow(detailKind: ManuscriptAssetDetailKind): string {
  if (detailKind === "proofreading_confirmation") {
    return "人工确认子页";
  }

  if (detailKind === "report_preview") {
    return "结果预览";
  }

  return "稿件预览";
}

function resolveDetailTitle(
  detailKind: ManuscriptAssetDetailKind,
  mode: ManuscriptWorkbenchMode,
): string {
  if (detailKind === "proofreading_confirmation") {
    return "校对确认与发布";
  }

  if (detailKind === "report_preview") {
    return mode === "screening" ? "初筛报告预览" : "校对报告预览";
  }

  return mode === "editing" ? "编辑稿预览" : "稿件预览";
}

function resolvePreviewPanelTitle(detailKind: ManuscriptAssetDetailKind): string {
  if (detailKind === "report_preview") {
    return "报告正文";
  }

  return "预览会话";
}

function resolveDetailDownloadLabel(asset: DocumentAssetViewModel): string {
  if (asset.asset_type === "edited_docx") {
    return "下载编辑稿件";
  }

  if (asset.asset_type === "final_proof_annotated_docx") {
    return "下载校对稿件";
  }

  if (asset.asset_type === "human_final_docx") {
    return "下载人工终稿";
  }

  if (asset.asset_type === "screening_report") {
    return "下载初筛报告";
  }

  if (
    asset.asset_type === "proofreading_draft_report" ||
    asset.asset_type === "final_proof_issue_report"
  ) {
    return "下载校对报告";
  }

  return "下载当前稿件";
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

function renderStringArraySection(title: string, items: readonly string[]): string[] {
  if (items.length === 0) {
    return [];
  }

  return [title, ...items.map((item) => `- ${item}`), ""];
}

function renderCorrectionSection(
  items: readonly ProofreadingConfirmationItemViewModel[],
): string[] {
  if (items.length === 0) {
    return [];
  }

  return [
    "校对建议",
    ...items.map(
      (item) =>
        `- [${item.category ?? "uncategorized"}] ${item.targetText} -> ${item.replacementText}`,
    ),
    "",
  ];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
  );
}

function formatLocationText(value: unknown): string | undefined {
  const location = asRecord(value);
  if (!location) {
    return undefined;
  }

  const paragraphIndex =
    typeof location.paragraph_index === "number" ? location.paragraph_index : undefined;
  if (paragraphIndex != null) {
    return `段落 ${paragraphIndex}`;
  }

  const tableId = readOptionalString(location.table_id);
  const semanticTarget = readOptionalString(location.semantic_target);
  if (tableId && semanticTarget) {
    return `表格 ${tableId} / ${semanticTarget}`;
  }

  const sectionHeading = readOptionalString(location.section_heading);
  if (sectionHeading) {
    return sectionHeading;
  }

  return undefined;
}
