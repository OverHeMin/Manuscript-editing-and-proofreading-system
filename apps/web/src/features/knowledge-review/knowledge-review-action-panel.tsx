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
      <header className="knowledge-review-pane-header">
        <h2>审核动作</h2>
        <p>记录审核依据，并完成当前队列决策。</p>
      </header>

      <label className="knowledge-review-action-note">
        审核备注
        <textarea
          value={reviewNote}
          disabled={!hasSelection || isSubmitting}
          placeholder="通过或驳回都可填写，用于补充简短审核依据。"
          onChange={(event) => onReviewNoteChange(event.target.value)}
        />
      </label>

      {isRejectNoteMissing ? (
        // Rejection without note remains valid, but we nudge for safer audit quality.
        <p className="knowledge-review-note-hint">
          驳回时允许不填写备注，但仍建议补充一句简短原因，便于后续追溯。
        </p>
      ) : null}

      <div className="knowledge-review-action-buttons">
        <button type="button" disabled={isDisabled} onClick={onApprove}>
          {isSubmitting ? "正在提交..." : "通过"}
        </button>
        <button
          type="button"
          disabled={isDisabled}
          className="knowledge-review-reject-button"
          onClick={onReject}
        >
          {isSubmitting ? "正在提交..." : "驳回"}
        </button>
      </div>

      {feedback.message ? (
        <div
          className={`knowledge-review-banner ${bannerClassName(feedback.status)}`}
          role={feedback.status === "error" ? "alert" : "status"}
        >
          <p>{feedback.message}</p>
          {feedback.status === "manual_recovery" ? (
            <button type="button" onClick={onManualRecovery}>
              重新加载队列
            </button>
          ) : null}
        </div>
      ) : null}
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
