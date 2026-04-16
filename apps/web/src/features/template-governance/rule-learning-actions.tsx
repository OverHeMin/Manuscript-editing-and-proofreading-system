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
          <h3>转规则动作</h3>
          <p>先完成审核结论，再转成规则草稿。</p>
        </div>
      </div>

      <div className="template-governance-actions template-governance-actions-column">
        <button
          type="button"
          disabled={isBusy || !canApprove}
          onClick={() => void onApproveCandidate()}
        >
          {candidate?.status === "approved" ? "已审核通过" : "审核通过"}
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
      </div>

      <p className="template-governance-context-note template-governance-context-note--compact">
        {candidate?.status === "approved"
          ? "审核结论已完成，可直接转成规则草稿。"
          : "先完成审核结论，再转成规则草稿。"}
      </p>
    </article>
  );
}
