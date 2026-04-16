import type { LearningCandidateViewModel } from "../learning-review/types.ts";

export interface RuleLearningActionsProps {
  candidate: LearningCandidateViewModel | null;
  isBusy: boolean;
  onApproveCandidate: () => void | Promise<void>;
  onConvertToRuleDraft: () => void;
  onRejectCandidate?: () => void;
}

export function RuleLearningActions({
  candidate,
  isBusy,
  onApproveCandidate,
  onConvertToRuleDraft,
  onRejectCandidate,
}: RuleLearningActionsProps) {
  const canApprove = candidate?.status === "pending_review";
  const canConvertToRuleDraft = candidate?.status === "approved";

  return (
    <article className="template-governance-card template-governance-recovery-actions">
      <div className="template-governance-panel-header">
        <div>
          <h3>回流处置</h3>
          <p>在确认候选证据后，直接完成批准、驳回或转成规则。</p>
        </div>
      </div>

      <div className="template-governance-actions template-governance-actions-column">
        <button
          type="button"
          disabled={isBusy || !canApprove}
          onClick={() => void onApproveCandidate()}
        >
          {candidate?.status === "approved" ? "已批准候选" : "批准候选"}
        </button>
        <button
          type="button"
          disabled={isBusy || !canConvertToRuleDraft}
          onClick={onConvertToRuleDraft}
        >
          转成规则
        </button>
        <button
          type="button"
          disabled={isBusy || candidate == null || !onRejectCandidate}
          onClick={onRejectCandidate}
        >
          驳回候选
        </button>
      </div>

      <p className="template-governance-context-note template-governance-context-note--compact">
        {candidate?.status === "approved"
          ? "该候选已批准，可以直接进入规则向导并保留完整回流来源。"
          : "先批准候选，再打开规则向导，避免丢失回流上下文。"}
      </p>
    </article>
  );
}
