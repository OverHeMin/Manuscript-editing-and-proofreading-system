export interface KnowledgeReviewActionFeedback {
  status: "idle" | "loading" | "success" | "error" | "manual_recovery";
  message: string | null;
}

export interface KnowledgeReviewActionPanelProps {
  selectedItemId: string | null;
  reviewNote: string;
  feedback: KnowledgeReviewActionFeedback;
  onReviewNoteChange(value: string): void;
  onApprove(): void;
  onReject(): void;
  onManualRecovery(): void;
}

export function KnowledgeReviewActionPanel({
  selectedItemId,
  reviewNote,
  feedback,
  onReviewNoteChange,
  onApprove,
  onReject,
  onManualRecovery,
}: KnowledgeReviewActionPanelProps) {
  const hasSelection = selectedItemId != null;
  const isSubmitting = feedback.status === "loading";
  const isRejectNoteMissing = hasSelection && reviewNote.trim().length === 0;
  const isDisabled = !hasSelection || isSubmitting;

  return (
    <section className="knowledge-review-panel knowledge-review-action-panel">
      <header className="knowledge-review-pane-header knowledge-review-pane-header-compact">
        <div>
          <h2>审核结论</h2>
          <p>在审核站里完成通过或驳回，并记录这条知识条目的审核结论。</p>
        </div>

        <div className="knowledge-review-inline-actions">
          <button type="button" disabled={isDisabled} onClick={onApprove}>
            {isSubmitting ? "提交中..." : "审核通过"}
          </button>
          <button
            type="button"
            disabled={isDisabled}
            className="knowledge-review-reject-button"
            onClick={onReject}
          >
            {isSubmitting ? "提交中..." : "驳回"}
          </button>
        </div>
      </header>

      <div className="knowledge-review-action-body">
        <label className="knowledge-review-action-note">
          <span>审核备注</span>
          <textarea
            value={reviewNote}
            disabled={!hasSelection || isSubmitting}
            placeholder="通过时可选填写；若驳回条目，建议说明原因。"
            onChange={(event) => onReviewNoteChange(event.target.value)}
          />
        </label>

        {isRejectNoteMissing ? (
          <p className="knowledge-review-note-hint">
            建议补充简短审核说明，便于后续处理与追踪。
          </p>
        ) : null}

        {feedback.message ? (
          <div
            className={`knowledge-review-banner ${bannerClassName(feedback.status)}`}
            role={feedback.status === "error" ? "alert" : "status"}
          >
            <p>{feedback.message}</p>
            {feedback.status === "manual_recovery" ? (
              <button type="button" onClick={onManualRecovery}>
                刷新队列
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function bannerClassName(status: KnowledgeReviewActionFeedback["status"]): string {
  if (status === "error") {
    return "knowledge-review-banner-error";
  }

  if (status === "manual_recovery") {
    return "knowledge-review-banner-warning";
  }

  if (status === "success") {
    return "knowledge-review-banner-success";
  }

  return "knowledge-review-banner-neutral";
}
