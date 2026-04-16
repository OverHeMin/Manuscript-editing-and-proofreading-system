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
  const reviewActions = candidate?.review_actions ?? [];

  return (
    <article className="template-governance-card template-governance-recovery-detail">
      <div className="template-governance-panel-header">
        <div>
          <h3>回流候选详情</h3>
          <p>核对证据、差异和建议去向后，先完成审核结论，再决定如何沉淀为规则草稿。</p>
        </div>
      </div>

      {candidate ? (
        <div className="template-governance-stack">
          <div className="template-governance-chip-row">
            <span className="template-governance-chip">回流候选</span>
            <span className="template-governance-chip template-governance-chip-secondary">
              {formatCandidateStatus(candidate.status)}
            </span>
            <span className="template-governance-chip template-governance-chip-secondary">
              {formatLearningModule(candidate.module)}
            </span>
            <span className="template-governance-chip template-governance-chip-secondary">
              {formatLearningManuscriptType(candidate.manuscript_type)}
            </span>
          </div>

          <div className="template-governance-detail-grid">
            <div>
              <span>候选标题</span>
              <strong>{candidate.title ?? candidate.id}</strong>
            </div>
            <div>
              <span>建议规则对象</span>
              <strong>{candidate.suggested_rule_object ?? "manual_review"}</strong>
            </div>
            <div>
              <span>建议模板族</span>
              <p>{candidate.suggested_template_family_id ?? "未提供"}</p>
            </div>
            <div>
              <span>建议期刊模板</span>
              <p>{candidate.suggested_journal_template_id ?? "模板族默认范围"}</p>
            </div>
            <div>
              <span>回流来源</span>
              <p>{formatGovernedProvenance(candidate.governed_provenance_kind)}</p>
            </div>
            <div>
              <span>来源快照</span>
              <p>{candidate.snapshot_asset_id ?? "未记录"}</p>
            </div>
          </div>

          <div className="template-governance-detail-grid">
            <div className="template-governance-field-full">
              <span>候选说明</span>
              <p>{candidate.proposal_text ?? "暂无候选说明。"}</p>
            </div>
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

          {reviewActions.length > 0 ? (
            <div className="template-governance-learning-fragment">
              <span>审核历史</span>
              <ul className="template-governance-list">
                {reviewActions.map((action, index) => (
                  <li key={`${action.action}-${action.created_at}-${index}`}>
                    <div className="template-governance-list-button template-governance-overview-list-item">
                      <span>{formatReviewAction(action.action)}</span>
                      <small>
                        {formatActorRole(action.actor_role)} · {action.created_at}
                      </small>
                      <strong>{action.review_note ?? "未附加说明"}</strong>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="template-governance-empty">
          先从回流候选队列中选择一项，再查看它的证据与转规则上下文。
        </p>
      )}
    </article>
  );
}

function formatCandidateStatus(value: string): string {
  switch (value) {
    case "pending_review":
      return "待审核";
    case "approved":
      return "审核通过";
    case "rejected":
      return "已驳回候选";
    default:
      return value;
  }
}

function formatGovernedProvenance(value: string | null | undefined): string {
  switch (value) {
    case "reviewed_case_snapshot":
      return "人工复核快照";
    case "governed_rule":
      return "已治理规则";
    case "governed_knowledge":
      return "已治理知识";
    default:
      return "未标注";
  }
}

function formatReviewAction(value: string): string {
  switch (value) {
    case "submitted_for_review":
      return "提交审核";
    case "approved":
      return "审核通过";
    case "rejected":
      return "驳回候选";
    default:
      return value;
  }
}

function formatActorRole(value: string): string {
  switch (value) {
    case "admin":
      return "管理员";
    case "knowledge_reviewer":
      return "知识审核员";
    default:
      return value;
  }
}

function formatLearningModule(value: string): string {
  switch (value) {
    case "screening":
      return "初筛";
    case "editing":
      return "编辑";
    case "proofreading":
      return "校对";
    case "learning":
      return "学习改写";
    default:
      return value;
  }
}

function formatLearningManuscriptType(value: string): string {
  switch (value) {
    case "clinical_study":
      return "临床研究";
    case "systematic_review":
      return "系统综述";
    case "meta_analysis":
      return "Meta 分析";
    case "case_report":
      return "病例报告";
    case "guideline_interpretation":
      return "指南解读";
    case "expert_consensus":
      return "专家共识";
    case "diagnostic_study":
      return "诊断研究";
    case "basic_research":
      return "基础研究";
    case "nursing_study":
      return "护理研究";
    case "methodology_paper":
      return "方法学论文";
    case "brief_report":
      return "简报";
    case "other":
      return "其他";
    case "review":
    default:
      return "综述";
  }
}
