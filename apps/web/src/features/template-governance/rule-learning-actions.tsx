import type { LearningCandidateViewModel } from "../learning-review/types.ts";

export interface RuleLearningActionsProps {
  candidate: LearningCandidateViewModel | null;
  isBusy: boolean;
  onApproveCandidate: () => void | Promise<void>;
  onConvertToRuleDraft: () => void;
  onRejectCandidate?: () => void;
  onConvertToKnowledgeExplanation?: () => void;
}

export function RuleLearningActions({
  candidate,
  isBusy,
  onApproveCandidate,
  onConvertToRuleDraft,
  onRejectCandidate,
  onConvertToKnowledgeExplanation,
}: RuleLearningActionsProps) {
  const canApprove = candidate?.status === "pending_review";
  const canConvertToRuleDraft = candidate?.status === "approved";
  const canConvertToKnowledgeExplanation = candidate != null;

  return (
    <article className="template-governance-card">
      <div className="template-governance-panel-header">
        <div>
          <h3>Candidate Actions</h3>
          <p>Approve first, then move the governed candidate into a rule draft or knowledge explanation workflow.</p>
        </div>
      </div>

      <div className="template-governance-actions template-governance-actions-column">
        <button type="button" disabled={isBusy || !canApprove} onClick={() => void onApproveCandidate()}>
          Approve Candidate
        </button>
        <button
          type="button"
          disabled={isBusy || !canConvertToRuleDraft}
          onClick={onConvertToRuleDraft}
        >
          Convert To Rule Draft
        </button>
        <button
          type="button"
          disabled={isBusy || candidate == null || !onRejectCandidate}
          onClick={onRejectCandidate}
        >
          Reject Candidate
        </button>
        <button
          type="button"
          disabled={isBusy || !canConvertToKnowledgeExplanation || !onConvertToKnowledgeExplanation}
          onClick={onConvertToKnowledgeExplanation}
        >
          Convert To Knowledge Explanation
        </button>
      </div>

      <p className="template-governance-context-note template-governance-context-note--compact">
        {candidate?.status === "approved"
          ? "This candidate is approved and ready to prefill a governed rule draft."
          : "Approve the candidate first to preserve governed provenance before authoring."}
      </p>
    </article>
  );
}
