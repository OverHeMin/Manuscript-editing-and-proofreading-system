import type { LearningWritebackViewModel } from "../learning-governance/types.ts";
import {
  isGovernedHitReviewItem,
  isLearningCandidateReviewItem,
  isResidualReviewItem,
  type ReviewItemViewModel,
} from "../review-items/index.ts";

export interface RuleLearningActionsProps {
  item: ReviewItemViewModel | null;
  actorRole?: string;
  editorialRuleDraftWriteback: LearningWritebackViewModel | null;
  isBusy: boolean;
  onValidateResidualItem: () => void | Promise<void>;
  onAcceptChangeOnly: () => void | Promise<void>;
  onRejectFalsePositive: () => void | Promise<void>;
  onArchiveEvidenceOnly: () => void | Promise<void>;
  onRouteToRuleCandidate: () => void | Promise<void>;
  onRouteToKnowledgeCandidate: () => void | Promise<void>;
  onRouteToPromptCandidate: () => void | Promise<void>;
  onApproveLearningCandidate: () => void | Promise<void>;
  onConvertToRuleDraft: () => void | Promise<void>;
  onRejectLearningCandidate: () => void | Promise<void>;
}

export function RuleLearningActions({
  item,
  actorRole = "admin",
  editorialRuleDraftWriteback,
  isBusy,
  onValidateResidualItem,
  onAcceptChangeOnly,
  onRejectFalsePositive,
  onArchiveEvidenceOnly,
  onRouteToRuleCandidate,
  onRouteToKnowledgeCandidate,
  onRouteToPromptCandidate,
  onApproveLearningCandidate,
  onConvertToRuleDraft,
  onRejectLearningCandidate,
}: RuleLearningActionsProps) {
  const isGovernedHit = isGovernedHitReviewItem(item);
  const isResidualItem = isResidualReviewItem(item);
  const isLearningCandidate = isLearningCandidateReviewItem(item);
  const isRuleLearningCandidate =
    isLearningCandidate && item.type === "rule_candidate";
  const isReviewSource = isGovernedHit || isResidualItem;

  const canValidateResidual =
    isResidualItem &&
    item.available_actions.includes("validate") &&
    actorRole === "admin";
  const canAcceptChangeOnly =
    isReviewSource && item.available_actions.includes("accept_change_only");
  const canRejectFalsePositive =
    isReviewSource && item.available_actions.includes("reject_as_false_positive");
  const canArchiveEvidenceOnly =
    isReviewSource && item.available_actions.includes("archive_as_evidence_only");
  const canRouteToRuleCandidate =
    isReviewSource && item.available_actions.includes("route_to_rule_candidate");
  const canRouteToKnowledgeCandidate =
    isReviewSource && item.available_actions.includes("route_to_knowledge_candidate");
  const canRouteToPromptCandidate =
    isReviewSource && item.available_actions.includes("route_to_prompt_candidate");
  const canApproveLearningCandidate =
    isLearningCandidate && item.available_actions.includes("approve");
  const canRejectLearningCandidate =
    isLearningCandidate && item.available_actions.includes("reject");
  const canConvertToRuleDraft =
    isRuleLearningCandidate &&
    item.source_status === "approved" &&
    actorRole === "admin" &&
    editorialRuleDraftWriteback?.status !== "applied";

  return (
    <article className="template-governance-card template-governance-recovery-actions">
      <div className="template-governance-panel-header">
        <div>
          <h3>回流动作</h3>
        </div>
      </div>

      <div className="template-governance-actions template-governance-actions-column">
        {isResidualItem ? (
          <button
            type="button"
            disabled={isBusy || !canValidateResidual}
            onClick={() => void onValidateResidualItem()}
          >
            {actorRole === "admin"
              ? "执行 Harness 复验"
              : "需管理员执行 Harness 复验"}
          </button>
        ) : null}

        {isReviewSource ? (
          <>
            <button
              type="button"
              disabled={isBusy || !canRouteToRuleCandidate}
              onClick={() => void onRouteToRuleCandidate()}
            >
              转规则候选
            </button>
            <button
              type="button"
              disabled={isBusy || !canRouteToKnowledgeCandidate}
              onClick={() => void onRouteToKnowledgeCandidate()}
            >
              转知识候选
            </button>
            <button
              type="button"
              disabled={isBusy || !canRouteToPromptCandidate}
              onClick={() => void onRouteToPromptCandidate()}
            >
              转 Prompt 候选
            </button>
            <button
              type="button"
              disabled={isBusy || !canAcceptChangeOnly}
              onClick={() => void onAcceptChangeOnly()}
            >
              仅人工处理
            </button>
            <button
              type="button"
              disabled={isBusy || !canRejectFalsePositive}
              onClick={() => void onRejectFalsePositive()}
            >
              误报驳回
            </button>
            <button
              type="button"
              disabled={isBusy || !canArchiveEvidenceOnly}
              onClick={() => void onArchiveEvidenceOnly()}
            >
              只保留证据
            </button>
          </>
        ) : null}

        {isLearningCandidate ? (
          <>
            <button
              type="button"
              disabled={isBusy || !canApproveLearningCandidate}
              onClick={() => void onApproveLearningCandidate()}
            >
              {item.source_status === "approved" ? "已审核通过" : "审核通过"}
            </button>
            {isRuleLearningCandidate ? (
              <button
                type="button"
                disabled={isBusy || !canConvertToRuleDraft}
                onClick={() => void onConvertToRuleDraft()}
              >
                {resolveRuleDraftActionLabel(editorialRuleDraftWriteback)}
              </button>
            ) : null}
            <button
              type="button"
              disabled={isBusy || !canRejectLearningCandidate}
              onClick={() => void onRejectLearningCandidate()}
            >
              驳回候选
            </button>
          </>
        ) : null}
      </div>

      <p className="template-governance-context-note template-governance-context-note--compact">
        {resolveActionNote({
          item,
          actorRole,
          editorialRuleDraftWriteback,
          canConvertToRuleDraft,
          canValidateResidual,
        })}
      </p>
    </article>
  );
}

function resolveRuleDraftActionLabel(
  writeback: LearningWritebackViewModel | null,
): string {
  switch (writeback?.status) {
    case "applied":
      return "规则草稿已生成";
    case "draft":
      return "完成规则草稿写回";
    default:
      return "转成规则草稿";
  }
}

function resolveActionNote(input: {
  item: ReviewItemViewModel | null;
  actorRole: string;
  editorialRuleDraftWriteback: LearningWritebackViewModel | null;
  canConvertToRuleDraft: boolean;
  canValidateResidual: boolean;
}): string {
  const {
    item,
    actorRole,
    editorialRuleDraftWriteback,
    canConvertToRuleDraft,
    canValidateResidual,
  } = input;

  if (isGovernedHitReviewItem(item)) {
    return "人工反馈命中已进入统一复核，可直接决定转知识、转规则，或仅归档人工处理结果。";
  }

  if (isResidualReviewItem(item)) {
    return canValidateResidual
      ? "先完成 Harness 复验，再决定是否转成候选或只保留人工处理结论。"
      : "当前残差项已可直接做路由或归档决策。";
  }

  if (isLearningCandidateReviewItem(item)) {
    if (
      item.type === "rule_candidate" &&
      editorialRuleDraftWriteback?.status === "applied"
    ) {
      return "规则草稿写回已完成，可在规则台账继续查看和完善沉淀结果。";
    }

    if (
      item.type === "rule_candidate" &&
      editorialRuleDraftWriteback?.status === "draft"
    ) {
      return "已创建规则草稿写回记录，还可以继续完成规则草稿写回。";
    }

    if (item.type === "rule_candidate" && canConvertToRuleDraft) {
      return actorRole === "admin"
        ? "规则候选已审核通过，可继续转成规则草稿。"
        : "规则候选已审核通过，需管理员继续写回规则草稿。";
    }

    return "学习候选已进入审核阶段，确认结论后会继续进入对应资产沉淀链路。";
  }

  return "先完成审核结论，再决定是否转成规则草稿。";
}
