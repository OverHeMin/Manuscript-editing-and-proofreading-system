import React from "react";
import type {
  HumanReviewContentDecision,
  HumanReviewGovernanceIntent,
} from "@medical/contracts";
import {
  filterHumanReviewDiffItems,
  summarizeHumanReviewDiffItems,
} from "./human-review-state.ts";
import type {
  HumanReviewDiffItemFilters,
  HumanReviewDiffItemViewModel,
  HumanReviewPublishModule,
  HumanReviewPublishPreflightResultViewModel,
} from "./types.ts";

export interface HumanReviewQueueDecisionChangeInput {
  diffItemId: string;
  contentDecision: HumanReviewContentDecision;
  governanceIntents?: HumanReviewGovernanceIntent;
  note?: string;
}

export interface HumanReviewQueueBatchDecisionChangeInput {
  diffItemIds: readonly string[];
  contentDecision: HumanReviewContentDecision;
}

export interface HumanReviewQueueProps {
  module: HumanReviewPublishModule;
  items: readonly HumanReviewDiffItemViewModel[];
  preflight?: HumanReviewPublishPreflightResultViewModel | null;
  isUpdating?: boolean;
  isPublishing?: boolean;
  onDecisionChange?(input: HumanReviewQueueDecisionChangeInput): void;
  onBatchDecisionChange?(input: HumanReviewQueueBatchDecisionChangeInput): void;
  onPreflightPublish?(): void;
  onPublishFinal?(): void;
  onRetryBackflow?(diffItemId: string): void;
}

const CONTENT_DECISIONS: ReadonlyArray<{
  value: HumanReviewContentDecision;
  label: string;
}> = [
  { value: "keep", label: "保留到最终稿" },
  { value: "reject", label: "驳回" },
  { value: "defer", label: "暂不发布" },
];

export function HumanReviewQueue({
  module,
  items,
  preflight = null,
  isUpdating = false,
  isPublishing = false,
  onDecisionChange,
  onBatchDecisionChange,
  onPreflightPublish,
  onPublishFinal,
  onRetryBackflow,
}: HumanReviewQueueProps) {
  const [statusFilter, setStatusFilter] =
    React.useState<NonNullable<HumanReviewDiffItemFilters["status"]>>("all");
  const [governanceIntentFilter, setGovernanceIntentFilter] =
    React.useState<NonNullable<HumanReviewDiffItemFilters["governanceIntent"]>>(
      "all",
    );
  const filteredItems = filterHumanReviewDiffItems(items, {
    status: statusFilter,
    governanceIntent: governanceIntentFilter,
  });
  const summary = summarizeHumanReviewDiffItems(items);
  const preflightSummary = preflight?.summary;
  const canPublish = preflight?.can_publish ?? summary.can_publish;

  return (
    <section
      className="manuscript-workbench-detail-ledger-card human-review-queue"
      data-human-review-queue="true"
      data-human-review-module={module}
    >
      <div className="manuscript-workbench-detail-card-header">
        <div>
          <h4>人工差异核验</h4>
          <p>OnlyOffice 负责正文修改，右侧只负责确认是否进终稿和是否回流规则/知识。</p>
        </div>
      </div>

      <section className="human-review-queue-gate" aria-label="发布门禁">
        <header>
          <strong>发布门禁</strong>
          <span>{canPublish ? "可发布" : "未满足"}</span>
        </header>
        <div className="human-review-queue-summary">
          <span>{`全部 ${summary.total_count}`}</span>
          <span>{`待确认 ${preflightSummary?.unconfirmed_count ?? summary.unconfirmed_count}`}</span>
          <span>{`暂不发布 ${preflightSummary?.deferred_count ?? summary.deferred_count}`}</span>
          <span>{`已保留 ${preflightSummary?.kept_count ?? summary.kept_count}`}</span>
          <span>{`已驳回 ${preflightSummary?.rejected_count ?? summary.rejected_count}`}</span>
          <span>{`规则候选 ${summary.rule_intent_count}`}</span>
          <span>{`知识候选 ${summary.knowledge_intent_count}`}</span>
        </div>
        {preflight?.blocking_reasons.length ? (
          <ul className="human-review-queue-blockers">
            {preflight.blocking_reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className="manuscript-workbench-proofreading-issue-filters">
        <label className="manuscript-workbench-field">
          <span>确认状态</span>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as NonNullable<
                  HumanReviewDiffItemFilters["status"]
                >,
              )
            }
          >
            <option value="all">全部</option>
            <option value="unconfirmed">待确认</option>
            <option value="keep">保留</option>
            <option value="reject">驳回</option>
            <option value="defer">暂不发布</option>
            <option value="unsafe">阻断项</option>
            <option value="writeback_failed">回流失败</option>
          </select>
        </label>
        <label className="manuscript-workbench-field">
          <span>治理动作</span>
          <select
            value={governanceIntentFilter}
            onChange={(event) =>
              setGovernanceIntentFilter(
                event.target.value as NonNullable<
                  HumanReviewDiffItemFilters["governanceIntent"]
                >,
              )
            }
          >
            <option value="all">全部</option>
            <option value="rule_candidate">转规则候选</option>
            <option value="knowledge_candidate">转知识候选</option>
          </select>
        </label>
      </div>

      <div className="manuscript-workbench-button-row">
        <span>{`当前筛选 ${filteredItems.length} 项`}</span>
        <button
          type="button"
          disabled={filteredItems.length === 0 || isUpdating}
          onClick={() =>
            onBatchDecisionChange?.({
              diffItemIds: filteredItems.map((item) => item.id),
              contentDecision: "keep",
            })
          }
        >
          当前筛选全部保留
        </button>
        <button
          type="button"
          disabled={filteredItems.length === 0 || isUpdating}
          onClick={() =>
            onBatchDecisionChange?.({
              diffItemIds: filteredItems.map((item) => item.id),
              contentDecision: "reject",
            })
          }
        >
          当前筛选全部驳回
        </button>
      </div>

      {filteredItems.length > 0 ? (
        <div className="manuscript-workbench-proofreading-issue-list">
          {filteredItems.map((item, index) => (
            <article
              key={item.id}
              className="manuscript-workbench-proofreading-issue"
              data-human-review-diff-item-id={item.id}
            >
              <header className="manuscript-workbench-proofreading-issue-toggle">
                <div>
                  <small>{`差异 ${index + 1} · ${formatDiffSourceLabel(item.source)}`}</small>
                  <strong>{item.summary ?? item.id}</strong>
                  <p>{formatDiffLocationLabel(item)}</p>
                </div>
                <div className="manuscript-workbench-proofreading-issue-toggle-meta">
                  <span>{formatContentDecisionLabel(item.content_decision)}</span>
                  <small>{formatApplyCapabilityLabel(item)}</small>
                </div>
              </header>

              <dl className="manuscript-workbench-detail-proofreading-diff">
                <div>
                  <dt>基线文本</dt>
                  <dd>{item.before_text ?? "无"}</dd>
                </div>
                <div>
                  <dt>工作稿文本</dt>
                  <dd>{item.after_text ?? "无"}</dd>
                </div>
              </dl>

              <div className="manuscript-workbench-detail-decision-grid">
                {CONTENT_DECISIONS.map((decision) => (
                  <button
                    key={decision.value}
                    type="button"
                    className={
                      item.content_decision === decision.value
                        ? "is-selected"
                        : undefined
                    }
                    disabled={isUpdating}
                    onClick={() =>
                      onDecisionChange?.({
                        diffItemId: item.id,
                        contentDecision: decision.value,
                        governanceIntents: item.governance_intents,
                      })
                    }
                  >
                    {decision.label}
                  </button>
                ))}
              </div>

              <div className="manuscript-workbench-button-row">
                <label className="manuscript-workbench-checkbox">
                  <input
                    type="checkbox"
                    checked={item.governance_intents.rule_candidate}
                    disabled={isUpdating}
                    onChange={(event) =>
                      onDecisionChange?.({
                        diffItemId: item.id,
                        contentDecision: item.content_decision,
                        governanceIntents: {
                          ...item.governance_intents,
                          rule_candidate: event.target.checked,
                        },
                      })
                    }
                  />
                  <span>转规则候选</span>
                </label>
                <label className="manuscript-workbench-checkbox">
                  <input
                    type="checkbox"
                    checked={item.governance_intents.knowledge_candidate}
                    disabled={isUpdating}
                    onChange={(event) =>
                      onDecisionChange?.({
                        diffItemId: item.id,
                        contentDecision: item.content_decision,
                        governanceIntents: {
                          ...item.governance_intents,
                          knowledge_candidate: event.target.checked,
                        },
                      })
                    }
                  />
                  <span>转知识候选</span>
                </label>
              </div>

              <label className="manuscript-workbench-field">
                <span>备注（可选）</span>
                <textarea
                  value={item.note ?? ""}
                  disabled={isUpdating}
                  onChange={(event) =>
                    onDecisionChange?.({
                      diffItemId: item.id,
                      contentDecision: item.content_decision,
                      governanceIntents: item.governance_intents,
                      note: event.target.value,
                    })
                  }
                />
              </label>

              {item.status === "writeback_failed" && onRetryBackflow ? (
                <button
                  type="button"
                  className="manuscript-workbench-button-secondary"
                  disabled={isUpdating}
                  onClick={() => onRetryBackflow(item.id)}
                >
                  重试候选回流
                </button>
              ) : null}
              {item.backflow_error ? (
                <p className="manuscript-workbench-proofreading-draft-status">
                  {item.backflow_error}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="manuscript-workbench-detail-empty">
          <strong>当前筛选下没有差异</strong>
          <p>保存 OnlyOffice 工作稿后，系统会把可识别差异放入这里确认。</p>
        </div>
      )}

      <div className="manuscript-workbench-button-row manuscript-workbench-button-row--sticky">
        <button
          type="button"
          className="manuscript-workbench-button-secondary"
          disabled={isUpdating}
          onClick={() => onPreflightPublish?.()}
        >
          刷新发布门禁
        </button>
        <button
          type="button"
          disabled={!canPublish || isPublishing || isUpdating}
          onClick={() => onPublishFinal?.()}
        >
          {isPublishing ? "生成中..." : "生成最终稿"}
        </button>
      </div>
    </section>
  );
}

function formatDiffSourceLabel(
  source: HumanReviewDiffItemViewModel["source"],
): string {
  switch (source) {
    case "ai_suggestion":
      return "AI建议";
    case "human_added":
      return "人工新增";
    case "human_overrode_ai":
      return "人工改写AI建议";
    case "human_reverted_ai":
      return "人工撤回AI建议";
  }
}

function formatContentDecisionLabel(decision: HumanReviewContentDecision): string {
  switch (decision) {
    case "keep":
      return "保留到最终稿";
    case "reject":
      return "驳回";
    case "defer":
      return "暂不发布";
    case "unconfirmed":
      return "待确认";
  }
}

function formatApplyCapabilityLabel(item: HumanReviewDiffItemViewModel): string {
  if (item.status === "blocks_publish") {
    return "阻断发布";
  }

  switch (item.apply_capability) {
    case "auto_apply_revert":
      return "可自动落稿";
    case "keep_only_no_safe_revert":
      return "只能保留";
    case "unsafe_needs_manual_review":
      return "需人工处理";
  }
}

function formatDiffLocationLabel(item: HumanReviewDiffItemViewModel): string {
  const parts = [
    item.location?.section_label,
    typeof item.location?.block_index === "number"
      ? `块 ${item.location.block_index}`
      : undefined,
    item.location?.quote,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" / ") : "未标注位置";
}
