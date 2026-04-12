import type { LearningCandidateViewModel } from "../learning-review/types.ts";
import {
  resolveLearningCandidateAfterFragment,
  resolveLearningCandidateBeforeFragment,
  resolveLearningCandidateEvidenceSummary,
  resolveLearningCandidateExtractionRationale,
  resolveLearningCandidateSelectorSummary,
} from "../learning-review/learning-review-workbench-state.ts";

export interface RuleLearningDiffCardProps {
  candidate: LearningCandidateViewModel | null;
}

export function RuleLearningDiffCard({ candidate }: RuleLearningDiffCardProps) {
  const beforeFragment = resolveLearningCandidateBeforeFragment(candidate);
  const afterFragment = resolveLearningCandidateAfterFragment(candidate);
  const evidenceSummary = resolveLearningCandidateEvidenceSummary(candidate);
  const extractionRationale = resolveLearningCandidateExtractionRationale(candidate);
  const selectorSummary = resolveLearningCandidateSelectorSummary(candidate);

  return (
    <article className="template-governance-card">
      <div className="template-governance-panel-header">
        <div>
          <h3>规则候选复核</h3>
          <p>先看清候选证据、前后差异和建议选择器，再决定是否沉淀为规则。</p>
        </div>
      </div>

      {candidate ? (
        <div className="template-governance-stack">
          <div className="template-governance-detail-grid">
            <div>
              <span>候选标题</span>
              <strong>{candidate.title ?? candidate.id}</strong>
            </div>
            <div>
              <span>状态</span>
              <strong>{candidate.status}</strong>
            </div>
            <div>
              <span>所属模块</span>
              <strong>{candidate.module}</strong>
            </div>
            <div>
              <span>规则对象</span>
              <strong>{candidate.suggested_rule_object ?? "manual_review"}</strong>
            </div>
          </div>

          <div className="template-governance-detail-grid">
            <div>
              <span>模板族</span>
              <p>{candidate.suggested_template_family_id ?? "未建议"}</p>
            </div>
            <div>
              <span>期刊模板</span>
              <p>{candidate.suggested_journal_template_id ?? "模板族默认范围"}</p>
            </div>
          </div>

          <div className="template-governance-detail-grid">
            <div>
              <span>提取依据</span>
              <p>{extractionRationale ?? "暂无提取依据。"}</p>
            </div>
            <div>
              <span>证据摘要</span>
              <p>{evidenceSummary ?? "暂无证据摘要。"}</p>
            </div>
          </div>

          <div className="template-governance-learning-diff-grid">
            <div className="template-governance-learning-fragment">
              <span>修改前</span>
              <pre>{beforeFragment ?? "暂无修改前片段。"}</pre>
            </div>
            <div className="template-governance-learning-fragment">
              <span>修改后</span>
              <pre>{afterFragment ?? "暂无修改后片段。"}</pre>
            </div>
          </div>

          <div className="template-governance-learning-fragment">
            <span>建议选择器</span>
            <pre>{selectorSummary}</pre>
          </div>
        </div>
      ) : (
        <p className="template-governance-empty">
          先从队列中选择一个规则候选，再查看它的证据与建议上下文。
        </p>
      )}
    </article>
  );
}
