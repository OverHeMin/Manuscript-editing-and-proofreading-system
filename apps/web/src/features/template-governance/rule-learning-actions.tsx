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
          <h3>候选动作</h3>
          <p>先完成批准，再决定把候选送入规则草稿或知识说明流程。</p>
        </div>
      </div>

      <div className="template-governance-actions template-governance-actions-column">
        <button type="button" disabled={isBusy || !canApprove} onClick={() => void onApproveCandidate()}>
          批准候选
        </button>
        <button
          type="button"
          disabled={isBusy || !canConvertToRuleDraft}
          onClick={onConvertToRuleDraft}
        >
          转成规则草稿
        </button>
        <button
          type="button"
          disabled={isBusy || candidate == null || !onRejectCandidate}
          onClick={onRejectCandidate}
        >
          驳回候选
        </button>
        <button
          type="button"
          disabled={isBusy || !canConvertToKnowledgeExplanation || !onConvertToKnowledgeExplanation}
          onClick={onConvertToKnowledgeExplanation}
        >
          转成知识说明
        </button>
      </div>

      <p className="template-governance-context-note template-governance-context-note--compact">
        {candidate?.status === "approved"
          ? "该候选已批准，可以直接预填规则草稿。"
          : "先批准候选，才能保留完整回流来源并进入规则创建。"}
      </p>
    </article>
  );
}
