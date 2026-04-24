import type { LearningWritebackViewModel } from "../learning-governance/types.ts";
import {
  resolveLearningCandidateAfterFragment,
  resolveLearningCandidateBeforeFragment,
  resolveLearningCandidateEvidenceSummary,
  resolveLearningCandidateExtractionRationale,
  resolveLearningCandidateSelectorSummary,
} from "../learning-review/learning-review-workbench-state.ts";
import {
  isGovernedHitReviewItem,
  isLearningCandidateReviewItem,
  isResidualReviewItem,
  type ReviewItemViewModel,
} from "../review-items/index.ts";

export interface RuleLearningDiffCardProps {
  item: ReviewItemViewModel | null;
  editorialRuleDraftWriteback?: LearningWritebackViewModel | null;
}

export function RuleLearningDiffCard({
  item,
  editorialRuleDraftWriteback = null,
}: RuleLearningDiffCardProps) {
  if (isLearningCandidateReviewItem(item)) {
    const beforeFragment = resolveLearningCandidateBeforeFragment(item);
    const afterFragment = resolveLearningCandidateAfterFragment(item);
    const evidenceSummary = resolveLearningCandidateEvidenceSummary(item);
    const extractionRationale =
      resolveLearningCandidateExtractionRationale(item);
    const selectorSummary = resolveLearningCandidateSelectorSummary(item);
    const reviewActions = item.review_actions ?? [];

    return (
      <article className="template-governance-card template-governance-recovery-detail">
        <div className="template-governance-panel-header">
          <div>
            <h3>回流项详情</h3>
            <p>核对证据、差异和建议去向后，再决定如何沉淀或回写。</p>
          </div>
        </div>

        <div className="template-governance-stack">
          <div className="template-governance-chip-row">
            <span className="template-governance-chip">回流候选</span>
            <span className="template-governance-chip template-governance-chip-secondary">
              {formatCandidateStatus(item.source_status)}
            </span>
            <span className="template-governance-chip template-governance-chip-secondary">
              {formatLearningModule(item.module)}
            </span>
            <span className="template-governance-chip template-governance-chip-secondary">
              {formatLearningManuscriptType(item.manuscript_type)}
            </span>
          </div>

          <div className="template-governance-detail-grid">
            <div>
              <span>候选标题</span>
              <strong>{item.title ?? item.id}</strong>
            </div>
            <div>
              <span>建议规则对象</span>
              <strong>{item.suggested_rule_object ?? "manual_review"}</strong>
            </div>
            <div>
              <span>建议模板族</span>
              <p>{item.suggested_template_family_id ?? "未提供"}</p>
            </div>
            <div>
              <span>建议期刊模板</span>
              <p>{item.suggested_journal_template_id ?? "模板族默认范围"}</p>
            </div>
            <div>
              <span>回流来源</span>
              <p>{formatGovernedProvenance(item.governed_provenance_kind)}</p>
            </div>
            <div>
              <span>来源快照</span>
              <p>{item.snapshot_asset_id ?? "未记录"}</p>
            </div>
          </div>

          <div className="template-governance-detail-grid">
            <div className="template-governance-field-full">
              <span>候选说明</span>
              <p>{item.proposal_text ?? "暂无候选说明。"}</p>
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

          {item.type === "rule_candidate" ? (
            <div className="template-governance-detail-grid">
              <div>
                <span>规则草稿写回</span>
                <strong>{formatRuleDraftWritebackStatus(editorialRuleDraftWriteback)}</strong>
              </div>
              <div>
                <span>写回记录</span>
                <p>{editorialRuleDraftWriteback?.id ?? "尚未创建"}</p>
              </div>
              <div>
                <span>规则草稿资产</span>
                <p>{editorialRuleDraftWriteback?.created_draft_asset_id ?? "尚未生成"}</p>
              </div>
            </div>
          ) : null}

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
      </article>
    );
  }

  if (isResidualReviewItem(item)) {
    return (
      <article className="template-governance-card template-governance-recovery-detail">
        <div className="template-governance-panel-header">
          <div>
            <h3>回流项详情</h3>
            <p>核对证据、差异和建议去向后，再决定如何沉淀或回写。</p>
          </div>
        </div>

        <div className="template-governance-stack">
          <div className="template-governance-chip-row">
            <span className="template-governance-chip">残差问题</span>
            <span className="template-governance-chip template-governance-chip-secondary">
              {formatResidualStatus(item.source_status)}
            </span>
            <span className="template-governance-chip template-governance-chip-secondary">
              {formatLearningModule(item.module)}
            </span>
            <span className="template-governance-chip template-governance-chip-secondary">
              {formatLearningManuscriptType(item.manuscript_type)}
            </span>
            {item.risk_level ? (
              <span className="template-governance-chip template-governance-chip-secondary">
                风险 {formatRiskLevel(item.risk_level)}
              </span>
            ) : null}
          </div>

          <div className="template-governance-detail-grid">
            <div>
              <span>残差标题</span>
              <strong>{item.title}</strong>
            </div>
            <div>
              <span>残差类型</span>
              <strong>{item.issue_type}</strong>
            </div>
            <div>
              <span>建议去向</span>
              <p>{formatResidualRoute(item.recommended_route)}</p>
            </div>
            <div>
              <span>Harness 状态</span>
              <p>{formatHarnessStatus(item.harness_validation_status)}</p>
            </div>
            <div>
              <span>执行快照</span>
              <p>{item.execution_snapshot_id}</p>
            </div>
            <div>
              <span>来源资产</span>
              <p>{item.source_asset_id ?? "未记录"}</p>
            </div>
          </div>

          <div className="template-governance-detail-grid">
            <div className="template-governance-field-full">
              <span>残差摘要</span>
              <p>{item.summary ?? "暂无残差摘要。"}</p>
            </div>
            <div>
              <span>规则依据</span>
              <p>{item.rationale ?? "暂无规则依据。"}</p>
            </div>
            <div>
              <span>建议处理</span>
              <p>{item.suggestion ?? "暂无建议处理。"}</p>
            </div>
          </div>

          <div className="template-governance-learning-fragment">
            <span>问题片段</span>
            <pre>{item.excerpt ?? "暂无问题片段。"}</pre>
          </div>
        </div>
      </article>
    );
  }

  if (isGovernedHitReviewItem(item)) {
    return (
      <article className="template-governance-card template-governance-recovery-detail">
        <div className="template-governance-panel-header">
          <div>
            <h3>回流项详情</h3>
            <p>核对证据、差异和建议去向后，再决定如何沉淀或回写。</p>
          </div>
        </div>

        <div className="template-governance-stack">
          <div className="template-governance-chip-row">
            <span className="template-governance-chip">人工反馈命中</span>
            <span className="template-governance-chip template-governance-chip-secondary">
              {formatGovernedHitStatus(item.source_status)}
            </span>
            <span className="template-governance-chip template-governance-chip-secondary">
              {formatLearningModule(item.module)}
            </span>
            <span className="template-governance-chip template-governance-chip-secondary">
              {formatLearningManuscriptType(item.manuscript_type)}
            </span>
          </div>

          <div className="template-governance-detail-grid">
            <div>
              <span>复核标题</span>
              <strong>{item.title}</strong>
            </div>
            <div>
              <span>反馈类型</span>
              <strong>{formatGovernedFeedbackCategory(item.feedback_category)}</strong>
            </div>
            <div>
              <span>推荐去向</span>
              <p>{formatResidualRoute(item.recommended_route)}</p>
            </div>
            <div>
              <span>反馈记录</span>
              <p>{item.feedback_record_id ?? "自动执行命中，待人工确认"}</p>
            </div>
            <div>
              <span>来源快照</span>
              <p>{item.snapshot_id}</p>
            </div>
            <div>
              <span>来源资产</span>
              <p>{item.source_asset_id ?? "未记录"}</p>
            </div>
          </div>

          <div className="template-governance-detail-grid">
            <div className="template-governance-field-full">
              <span>人工反馈摘要</span>
              <p>{item.summary ?? "暂无人工反馈摘要。"}</p>
            </div>
            <div>
              <span>人工处理建议</span>
              <p>{item.suggestion ?? "暂无处理建议。"}</p>
            </div>
            <div>
              <span>复核状态</span>
              <p>{formatReviewStatus(item.review_status)}</p>
            </div>
          </div>

          <div className="template-governance-learning-fragment">
            <span>原始片段</span>
            <pre>{item.excerpt ?? item.summary ?? "暂无原始片段。"}</pre>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="template-governance-card template-governance-recovery-detail">
      <div className="template-governance-panel-header">
        <div>
          <h3>回流项详情</h3>
          <p>核对证据、差异和建议去向后，再决定如何沉淀或回写。</p>
        </div>
      </div>
      <p className="template-governance-empty">
        先从回流队列中选择一项，再查看它的证据与治理上下文。
      </p>
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
      return "已驳回";
    default:
      return value;
  }
}

function formatResidualStatus(value: string): string {
  switch (value) {
    case "validation_pending":
      return "待复验";
    case "candidate_ready":
      return "可生成候选";
    case "validation_failed":
      return "复验未通过";
    case "manual_review_pending":
      return "待人工复核";
    case "manual_only":
      return "仅人工处理";
    case "evidence_only":
      return "只保留证据";
    default:
      return value;
  }
}

function formatGovernedHitStatus(value: string): string {
  switch (value) {
    case "submitted":
      return "待复核";
    case "accepted_change_only":
      return "仅人工处理";
    case "rejected_as_false_positive":
      return "误报驳回";
    case "routed_rule_candidate":
      return "已转规则候选";
    case "routed_knowledge_candidate":
      return "已转知识候选";
    case "routed_prompt_candidate":
      return "已转 Prompt 候选";
    case "archived_as_evidence_only":
      return "只保留证据";
    default:
      return value;
  }
}

function formatResidualRoute(value: string | undefined): string {
  switch (value) {
    case "rule_candidate":
      return "规则候选";
    case "knowledge_candidate":
      return "知识候选";
    case "prompt_template_candidate":
      return "Prompt 候选";
    case "manual_only":
      return "仅人工处理";
    case "evidence_only":
      return "只保留证据";
    default:
      return value ?? "未指定";
  }
}

function formatHarnessStatus(value: string | undefined): string {
  switch (value) {
    case "queued":
      return "待执行";
    case "passed":
      return "已通过";
    case "failed":
      return "未通过";
    case "not_required":
      return "不要求";
    default:
      return value ?? "未记录";
  }
}

function formatRiskLevel(value: string): string {
  switch (value) {
    case "critical":
      return "极高";
    case "high":
      return "高";
    case "medium":
      return "中";
    case "low":
      return "低";
    default:
      return value;
  }
}

function formatGovernedProvenance(value: string | null | undefined): string {
  switch (value) {
    case "reviewed_case_snapshot":
      return "人工复核快照";
    case "residual_issue":
      return "校对残余问题";
    case "human_feedback":
      return "人工反馈";
    case "evaluation_experiment":
      return "评测实验";
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
      return "知识治理员";
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

function formatRuleDraftWritebackStatus(
  writeback: LearningWritebackViewModel | null,
): string {
  switch (writeback?.status) {
    case "applied":
      return "已写回";
    case "draft":
      return "待应用";
    case "archived":
      return "已归档";
    default:
      return "未创建";
  }
}

function formatGovernedFeedbackCategory(value: string): string {
  switch (value) {
    case "missed_hit":
      return "漏命中";
    case "incorrect_hit":
      return "错误命中";
    case "missing_knowledge":
      return "缺少知识";
    default:
      return value;
  }
}

function formatReviewStatus(value: string): string {
  switch (value) {
    case "pending":
      return "待复核";
    case "decided":
      return "已决策";
    case "routed":
      return "已路由";
    default:
      return value;
  }
}
