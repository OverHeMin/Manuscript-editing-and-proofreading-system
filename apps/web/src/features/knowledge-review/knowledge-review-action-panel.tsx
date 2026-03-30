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
        <h2>Review Action</h2>
        <p>Record rationale and complete queue decision.</p>
      </header>

      <label className="knowledge-review-action-note">
        Review note
        <textarea
          value={reviewNote}
          disabled={!hasSelection || isSubmitting}
          placeholder="Optional for approve and reject. Add concise rationale for traceability."
          onChange={(event) => onReviewNoteChange(event.target.value)}
        />
      </label>

      {isRejectNoteMissing ? (
        // Rejection without note remains valid, but we nudge for safer audit quality.
        <p className="knowledge-review-note-hint">
          Rejection without a note is allowed, but a brief rationale is strongly recommended.
        </p>
      ) : null}

      <div className="knowledge-review-action-buttons">
        <button type="button" disabled={isDisabled} onClick={onApprove}>
          {isSubmitting ? "Approving..." : "Approve"}
        </button>
        <button
          type="button"
          disabled={isDisabled}
          className="knowledge-review-reject-button"
          onClick={onReject}
        >
          {isSubmitting ? "Rejecting..." : "Reject"}
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
              Reload queue
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
