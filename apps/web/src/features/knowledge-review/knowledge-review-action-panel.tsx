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
        <h2>Review Actions</h2>
        <p>Record reviewer rationale and complete the current revision decision.</p>
      </header>

      <label className="knowledge-review-action-note">
        Review Note
        <textarea
          value={reviewNote}
          disabled={!hasSelection || isSubmitting}
          placeholder="Optional for approval, strongly recommended when sending a revision back to draft."
          onChange={(event) => onReviewNoteChange(event.target.value)}
        />
      </label>

      {isRejectNoteMissing ? (
        <p className="knowledge-review-note-hint">
          A short reviewer note makes the draft handback easier to follow up.
        </p>
      ) : null}

      <div className="knowledge-review-action-buttons">
        <button type="button" disabled={isDisabled} onClick={onApprove}>
          {isSubmitting ? "Submitting..." : "Approve"}
        </button>
        <button
          type="button"
          disabled={isDisabled}
          className="knowledge-review-reject-button"
          onClick={onReject}
        >
          {isSubmitting ? "Submitting..." : "Send Back To Draft"}
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
              Reload Queue
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
