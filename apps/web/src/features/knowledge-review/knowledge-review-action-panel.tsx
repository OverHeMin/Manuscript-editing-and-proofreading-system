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
          <h2>审核动作</h2>
          <p>备注与决策保持同区处理，减少来回滚动。</p>
        </div>

        <div className="knowledge-review-inline-actions">
          <button type="button" disabled={isDisabled} onClick={onApprove}>
            {isSubmitting ? "提交中..." : "通过"}
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
            placeholder="通过时可选填写；若要驳回，强烈建议说明原因。"
            onChange={(event) => onReviewNoteChange(event.target.value)}
          />
        </label>

        {isRejectNoteMissing ? (
          <p className="knowledge-review-note-hint">
            建议补充简短审核说明，便于后续修改与追踪。
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
