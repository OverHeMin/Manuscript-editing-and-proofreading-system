import { useEffect, useMemo, useState } from "react";
import { createBrowserHttpClient } from "../../lib/browser-http-client.ts";
import {
  getManuscriptHarnessMatrix,
  retryProofreadingDeepPassRun,
} from "../manuscripts/manuscript-api.ts";
import { decideReviewItem, submitGovernedHit } from "../review-items/review-items-api.ts";
import type {
  ManuscriptHarnessMatrixItemViewModel,
  ManuscriptHarnessMatrixModuleViewModel,
  ManuscriptHarnessMatrixViewModel,
} from "../manuscripts/types.ts";

export interface ManuscriptHarnessPageProps {
  prefilledManuscriptId?: string;
}

const client = createBrowserHttpClient();

interface MissedHitDraft {
  module: ManuscriptHarnessMatrixModuleViewModel["module"];
  title: string;
  feedbackText: string;
}

type HarnessReviewAction =
  | "accept_change_only"
  | "reject_as_false_positive"
  | "route_to_rule_candidate"
  | "route_to_knowledge_candidate"
  | "route_to_prompt_candidate"
  | "archive_as_evidence_only";

export function ManuscriptHarnessPage({
  prefilledManuscriptId,
}: ManuscriptHarnessPageProps) {
  const [manuscriptId, setManuscriptId] = useState(prefilledManuscriptId ?? "");
  const [matrix, setMatrix] = useState<ManuscriptHarnessMatrixViewModel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [decidingItemKey, setDecidingItemKey] = useState("");
  const [retryingItemKey, setRetryingItemKey] = useState("");
  const [submittingMissedModule, setSubmittingMissedModule] = useState("");
  const [missedHitDraft, setMissedHitDraft] = useState<MissedHitDraft>({
    module: "proofreading",
    title: "",
    feedbackText: "",
  });
  const [error, setError] = useState("");
  const normalizedManuscriptId = manuscriptId.trim();

  useEffect(() => {
    setManuscriptId(prefilledManuscriptId ?? "");
  }, [prefilledManuscriptId]);

  useEffect(() => {
    if ((prefilledManuscriptId ?? "").trim().length === 0) {
      return;
    }

    void loadMatrix((prefilledManuscriptId ?? "").trim());
  }, [prefilledManuscriptId]);

  async function loadMatrix(nextManuscriptId = normalizedManuscriptId) {
    if (nextManuscriptId.length === 0) {
      setError("请先输入稿件编号。");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const response = await getManuscriptHarnessMatrix(client, nextManuscriptId);
      setMatrix(response.body);
    } catch (nextError) {
      setMatrix(null);
      setError(nextError instanceof Error ? nextError.message : "加载 Harness 矩阵失败。");
    } finally {
      setIsLoading(false);
    }
  }

  const totals = useMemo(() => summarizeMatrix(matrix), [matrix]);

  async function decideMatrixItem(
    item: ManuscriptHarnessMatrixItemViewModel,
    action: HarnessReviewAction,
  ) {
    if (!isReviewDecidableItem(item)) {
      return;
    }

    setDecidingItemKey(item.key);
    setError("");
    try {
      await decideReviewItem(client, {
        sourceKind: item.source_kind,
        id: item.source_id,
        action,
        title: item.title ?? item.label,
        proposalText: resolveMatrixItemProposalText(item),
      });
      await loadMatrix(normalizedManuscriptId);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "提交 Harness 判定失败。");
    } finally {
      setDecidingItemKey("");
    }
  }

  async function retryDeepPassItem(item: ManuscriptHarnessMatrixItemViewModel) {
    const passRunId = getEvidenceString(item, "pass_run_id");
    if (!passRunId) {
      return;
    }

    setRetryingItemKey(item.key);
    setError("");
    try {
      await retryProofreadingDeepPassRun(client, passRunId);
      await loadMatrix(normalizedManuscriptId);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "重试深度校对轮次失败。");
    } finally {
      setRetryingItemKey("");
    }
  }

  async function submitMissedHit(module: ManuscriptHarnessMatrixModuleViewModel) {
    if (!matrix || !module.latest_snapshot) {
      return;
    }
    const title = missedHitDraft.title.trim();
    const feedbackText = missedHitDraft.feedbackText.trim();
    if (!title || !feedbackText) {
      setError("请先填写漏检标题和说明。");
      return;
    }

    setSubmittingMissedModule(module.module);
    setError("");
    try {
      await submitGovernedHit(client, {
        manuscriptId: matrix.manuscript_id,
        manuscriptType: matrix.manuscript_type,
        module: module.module,
        snapshotId: module.latest_snapshot.id,
        sourceAssetId:
          module.latest_snapshot.created_asset_ids[0] ?? module.latest_snapshot.job_id,
        feedbackCategory: "missed_hit",
        feedbackText,
        title,
        candidatePosture: "candidate_change",
        decisionSource: "manual_feedback",
        relatedKnowledgeItemIds: module.latest_snapshot.knowledge_item_ids,
        originPayload: {
          source: "manuscript_harness_matrix",
          module: module.module,
          snapshot_id: module.latest_snapshot.id,
        },
      });
      setMissedHitDraft({ module: module.module, title: "", feedbackText: "" });
      await loadMatrix(normalizedManuscriptId);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "提交漏检项失败。");
    } finally {
      setSubmittingMissedModule("");
    }
  }

  return (
    <article className="manuscript-workbench-page manuscript-harness-page">
      <header className="manuscript-workbench-hero">
        <div>
          <span className="manuscript-workbench-section-eyebrow">
            Harness 质量矩阵
          </span>
          <h2>稿件级 AI 控制视图</h2>
          <p>
            按筛稿、编辑、校对三大模块展示已命中、未执行、人工补充和疑似漏检项目。
          </p>
        </div>
        <div className="manuscript-workbench-desk-stat">
          <span>矩阵项目</span>
          <strong>{totals.total}</strong>
        </div>
      </header>

      <section className="manuscript-workbench-controls manuscript-harness-toolbar">
        <div className="manuscript-workbench-controls-grid">
          <article className="manuscript-workbench-panel">
            <div className="manuscript-workbench-panel-heading">
              <div>
                <h3>打开稿件矩阵</h3>
                <p>输入稿件编号后读取后端派生的只读验证结果。</p>
              </div>
            </div>
            <div className="manuscript-workbench-panel-body">
              <label>
                <span>稿件编号</span>
                <input
                  value={manuscriptId}
                  onChange={(event) => setManuscriptId(event.target.value)}
                />
              </label>
              <div className="manuscript-workbench-button-row manuscript-workbench-button-row--sticky">
                <button
                  type="button"
                  disabled={isLoading || normalizedManuscriptId.length === 0}
                  onClick={() => void loadMatrix()}
                >
                  {isLoading ? "加载中..." : "查看 Harness 矩阵"}
                </button>
              </div>
              {error ? (
                <p className="manuscript-workbench-help is-warning">{error}</p>
              ) : null}
            </div>
          </article>
        </div>
      </section>

      {matrix ? (
        <section className="manuscript-workbench-result-panel">
          <header className="manuscript-workbench-result-panel-header">
            <div>
              <h3>{matrix.title}</h3>
              <p>
                稿件：{matrix.manuscript_id} · 类型：{matrix.manuscript_type} ·
                生成：{formatDateTime(matrix.generated_at)}
              </p>
            </div>
            <div className="manuscript-workbench-desk-stat">
              <span>命中 / 人工</span>
              <strong>
                {totals.hit} / {totals.manual}
              </strong>
            </div>
          </header>
          <section className="manuscript-harness-summary-grid" aria-label="Harness 质量摘要">
            <HarnessSummaryCard label="命中项" value={totals.hit} tone="success" />
            <HarnessSummaryCard label="未命中 / 人工补充" value={totals.missed + totals.manual} tone="warning" />
            <HarnessSummaryCard label="误报 / 失败" value={totals.falsePositive + totals.failed} tone="danger" />
            <HarnessSummaryCard label="深度校对轮次" value={totals.deepPasses} tone="neutral" />
          </section>
          <section className="manuscript-harness-breakdown-grid" aria-label="Harness 来源分布">
            <HarnessBreakdownList
              title="状态分布"
              rows={totals.byState.map(([state, count]) => [formatState(state), count])}
            />
            <HarnessBreakdownList
              title="来源分布"
              rows={totals.bySourceKind.map(([sourceKind, count]) => [
                formatSourceKind(sourceKind),
                count,
              ])}
            />
          </section>
          <div className="manuscript-harness-module-grid">
            {matrix.modules.map((module) => (
              <HarnessModuleCard
                key={module.module}
                module={module}
                decidingItemKey={decidingItemKey}
                retryingItemKey={retryingItemKey}
                onDecideItem={decideMatrixItem}
                onRetryDeepPassItem={retryDeepPassItem}
                missedHitDraft={missedHitDraft}
                submittingMissedModule={submittingMissedModule}
                onChangeMissedHitDraft={setMissedHitDraft}
                onSubmitMissedHit={submitMissedHit}
              />
            ))}
          </div>
        </section>
      ) : (
        <section className="manuscript-workbench-result-panel" role="status">
          <h3>尚未加载矩阵</h3>
          <p>从稿件工作台按钮进入时会自动带入稿件编号，也可以手动输入后查看。</p>
        </section>
      )}
    </article>
  );
}

function HarnessSummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "danger" | "neutral";
}) {
  return (
    <article className={`manuscript-harness-summary-card is-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function HarnessBreakdownList({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, number]>;
}) {
  return (
    <article className="manuscript-harness-breakdown-card">
      <h4>{title}</h4>
      <dl>
        {rows.map(([label, count]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{count}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function HarnessModuleCard({
  module,
  decidingItemKey,
  retryingItemKey,
  onDecideItem,
  onRetryDeepPassItem,
  missedHitDraft,
  submittingMissedModule,
  onChangeMissedHitDraft,
  onSubmitMissedHit,
}: {
  module: ManuscriptHarnessMatrixModuleViewModel;
  decidingItemKey: string;
  retryingItemKey: string;
  onDecideItem: (
    item: ManuscriptHarnessMatrixItemViewModel,
    action: HarnessReviewAction,
  ) => void;
  onRetryDeepPassItem: (item: ManuscriptHarnessMatrixItemViewModel) => void;
  missedHitDraft: MissedHitDraft;
  submittingMissedModule: string;
  onChangeMissedHitDraft: (draft: MissedHitDraft) => void;
  onSubmitMissedHit: (module: ManuscriptHarnessMatrixModuleViewModel) => void;
}) {
  const moduleTotals = summarizeModule(module);
  const activeMissedDraft =
    missedHitDraft.module === module.module
      ? missedHitDraft
      : { module: module.module, title: "", feedbackText: "" };

  return (
    <article className="manuscript-workbench-panel manuscript-harness-module-card">
      <div className="manuscript-workbench-panel-heading">
        <div>
          <h3>{formatModule(module.module)}</h3>
          <p>{formatModuleStatus(module.status)}</p>
        </div>
        <span className="manuscript-harness-state-pill">
          {moduleTotals.hit} 命中 · {moduleTotals.manual} 人工
        </span>
      </div>
      <div className="manuscript-workbench-panel-body">
        {module.latest_snapshot ? (
          <dl className="manuscript-harness-snapshot">
            <div>
              <dt>Snapshot</dt>
              <dd>{module.latest_snapshot.id}</dd>
            </div>
            <div>
              <dt>模型</dt>
              <dd>{module.latest_snapshot.model_id}</dd>
            </div>
            <div>
              <dt>知识命中</dt>
              <dd>{module.latest_snapshot.knowledge_item_ids.length}</dd>
            </div>
          </dl>
        ) : (
          <p className="manuscript-workbench-help is-warning">该模块尚未执行。</p>
        )}
        <div className="manuscript-harness-item-list">
          {module.matrix_items.map((item) => (
            <HarnessMatrixItem
              key={item.key}
              item={item}
              isDeciding={decidingItemKey === item.key}
              isRetrying={retryingItemKey === item.key}
              onDecideItem={onDecideItem}
              onRetryDeepPassItem={onRetryDeepPassItem}
            />
          ))}
        </div>
        {module.latest_snapshot ? (
          <section className="manuscript-harness-missed-form">
            <h4>人工补漏</h4>
            <label>
              <span>漏检标题</span>
              <input
                value={activeMissedDraft.title}
                onChange={(event) =>
                  onChangeMissedHitDraft({
                    ...activeMissedDraft,
                    title: event.target.value,
                  })
                }
                placeholder={`${formatModule(module.module)}中漏掉的问题`}
              />
            </label>
            <label>
              <span>漏检说明</span>
              <textarea
                value={activeMissedDraft.feedbackText}
                onChange={(event) =>
                  onChangeMissedHitDraft({
                    ...activeMissedDraft,
                    feedbackText: event.target.value,
                  })
                }
                placeholder="说明 AI 漏掉了什么、为什么应该命中。"
              />
            </label>
            <button
              type="button"
              disabled={submittingMissedModule === module.module}
              onClick={() => onSubmitMissedHit(module)}
            >
              {submittingMissedModule === module.module ? "提交中..." : "提交为漏检项"}
            </button>
          </section>
        ) : null}
      </div>
    </article>
  );
}

function HarnessMatrixItem({
  item,
  isDeciding,
  isRetrying,
  onDecideItem,
  onRetryDeepPassItem,
}: {
  item: ManuscriptHarnessMatrixItemViewModel;
  isDeciding: boolean;
  isRetrying: boolean;
  onDecideItem: (
    item: ManuscriptHarnessMatrixItemViewModel,
    action: HarnessReviewAction,
  ) => void;
  onRetryDeepPassItem: (item: ManuscriptHarnessMatrixItemViewModel) => void;
}) {
  const evidenceRows = buildEvidenceRows(item);
  const canDecide = isReviewDecidableItem(item);
  const canRetry = isRetryableDeepPassItem(item);
  const decisionBadge = getReviewDecisionBadge(item);

  return (
    <div className={`manuscript-harness-item is-${item.state}`}>
      <div>
        <strong>{item.title ?? item.label}</strong>
        <span>{formatState(item.state)}</span>
      </div>
      <p>{item.summary ?? item.source_id ?? item.key}</p>
      <dl className="manuscript-harness-item-meta">
        <div>
          <dt>来源</dt>
          <dd>{formatSourceKind(item.source_kind)}</dd>
        </div>
        <div>
          <dt>来源 ID</dt>
          <dd>{item.source_id ?? "无"}</dd>
        </div>
      </dl>
      {decisionBadge ? (
        <p className="manuscript-harness-decision-badge">{decisionBadge}</p>
      ) : null}
      {item.related_rule_ids?.length ? (
        <p className="manuscript-harness-item-tags">
          规则：{item.related_rule_ids.join(" / ")}
        </p>
      ) : null}
      {item.related_knowledge_item_ids?.length ? (
        <p className="manuscript-harness-item-tags">
          知识：{item.related_knowledge_item_ids.join(" / ")}
        </p>
      ) : null}
      {evidenceRows.length > 0 ? (
        <details className="manuscript-harness-evidence">
          <summary>查看证据字段（{evidenceRows.length}）</summary>
          <dl>
            {evidenceRows.map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{formatEvidenceValue(value)}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
      {canDecide ? (
        <div className="manuscript-harness-decision-actions">
          <button
            type="button"
            disabled={isDeciding}
            onClick={() => onDecideItem(item, "accept_change_only")}
          >
            采纳
          </button>
          <button
            type="button"
            disabled={isDeciding}
            onClick={() => onDecideItem(item, "reject_as_false_positive")}
          >
            标记误报
          </button>
          <button
            type="button"
            disabled={isDeciding}
            onClick={() => onDecideItem(item, "archive_as_evidence_only")}
          >
            仅留证据
          </button>
          <button
            type="button"
            disabled={isDeciding}
            onClick={() => onDecideItem(item, "route_to_rule_candidate")}
          >
            转规则
          </button>
          <button
            type="button"
            disabled={isDeciding}
            onClick={() => onDecideItem(item, "route_to_knowledge_candidate")}
          >
            转知识
          </button>
          <button
            type="button"
            disabled={isDeciding}
            onClick={() => onDecideItem(item, "route_to_prompt_candidate")}
          >
            转 Prompt
          </button>
        </div>
      ) : null}
      {canRetry ? (
        <div className="manuscript-harness-decision-actions">
          <button
            type="button"
            disabled={isRetrying}
            onClick={() => onRetryDeepPassItem(item)}
          >
            {isRetrying ? "重试中..." : "重试该轮"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function getReviewDecisionBadge(
  item: ManuscriptHarnessMatrixItemViewModel,
): string | null {
  const reviewStatus = getEvidenceString(item, "review_status");
  const sourceStatus = getEvidenceString(item, "source_status");

  if (reviewStatus !== "decided" || !sourceStatus) {
    return null;
  }

  switch (sourceStatus) {
    case "accepted_change_only":
      return "人工判定：采纳";
    case "rejected_as_false_positive":
      return "人工判定：误报";
    case "archived_as_evidence_only":
    case "evidence_only":
      return "人工判定：仅留证据";
    case "manual_only":
      return "人工判定：人工处理";
    default:
      return `人工判定：${sourceStatus}`;
  }
}

function getEvidenceString(
  item: ManuscriptHarnessMatrixItemViewModel,
  key: string,
): string | null {
  const value = item.evidence?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function resolveMatrixItemProposalText(
  item: ManuscriptHarnessMatrixItemViewModel,
): string | undefined {
  const evidence = item.evidence ?? {};
  const evidenceText =
    getEvidenceString(item, "excerpt") ??
    getEvidenceString(item, "suggestion") ??
    getEvidenceString(item, "rationale") ??
    getEvidenceString(item, "source_status");

  return item.summary ?? evidenceText ?? item.title ?? item.label;
}

function isRetryableDeepPassItem(
  item: ManuscriptHarnessMatrixItemViewModel,
): boolean {
  return (
    item.source_kind === "proofreading_deep_pass" &&
    item.state === "failed" &&
    getEvidenceString(item, "pass_run_id") !== null
  );
}

function isReviewDecidableItem(
  item: ManuscriptHarnessMatrixItemViewModel,
): item is ManuscriptHarnessMatrixItemViewModel & {
  source_kind: "governed_hit" | "residual_issue";
  source_id: string;
} {
  return (
    (item.source_kind === "governed_hit" ||
      item.source_kind === "residual_issue") &&
    typeof item.source_id === "string" &&
    item.source_id.length > 0 &&
    item.state !== "false_positive"
  );
}

function buildEvidenceRows(
  item: ManuscriptHarnessMatrixItemViewModel,
): Array<[string, unknown]> {
  const rows: Array<[string, unknown]> = [];
  if (item.evidence) {
    rows.push(...Object.entries(item.evidence));
  }

  return rows.filter(([, value]) => value !== undefined && value !== null);
}

function summarizeMatrix(matrix: ManuscriptHarnessMatrixViewModel | null) {
  const items = matrix?.modules.flatMap((module) => module.matrix_items) ?? [];
  const byState = countBy(items, (item) => item.state);
  const bySourceKind = countBy(items, (item) => item.source_kind);

  return {
    total: items.length,
    hit: items.filter((item) => item.state === "hit").length,
    manual: items.filter((item) => item.state === "manual_added").length,
    missed: items.filter((item) => item.state === "missed").length,
    falsePositive: items.filter((item) => item.state === "false_positive").length,
    failed: items.filter((item) => item.state === "failed").length,
    deepPasses: items.filter((item) => item.source_kind === "proofreading_deep_pass").length,
    byState,
    bySourceKind,
  };
}

function countBy<TItem, TKey extends string>(
  items: readonly TItem[],
  selectKey: (item: TItem) => TKey,
): Array<[TKey, number]> {
  const counts = new Map<TKey, number>();
  for (const item of items) {
    const key = selectKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()].sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  });
}

function summarizeModule(module: ManuscriptHarnessMatrixModuleViewModel) {
  return {
    hit: module.matrix_items.filter((item) => item.state === "hit").length,
    manual: module.matrix_items.filter((item) => item.state === "manual_added")
      .length,
  };
}

function formatModule(module: ManuscriptHarnessMatrixModuleViewModel["module"]) {
  switch (module) {
    case "screening":
      return "筛稿";
    case "editing":
      return "编辑";
    case "proofreading":
      return "校对";
  }
}

function formatModuleStatus(
  status: ManuscriptHarnessMatrixModuleViewModel["status"],
) {
  switch (status) {
    case "tracked":
      return "已执行并纳入 Harness 追踪";
    case "not_run":
      return "尚未执行";
    case "failed_open":
      return "观察失败，已失败打开";
  }
}

function formatState(state: ManuscriptHarnessMatrixItemViewModel["state"]) {
  switch (state) {
    case "hit":
      return "命中";
    case "missed":
      return "未命中";
    case "skipped":
      return "跳过";
    case "false_positive":
      return "误报";
    case "manual_added":
      return "人工补充";
    case "observed":
      return "已观察";
    case "expected_not_run":
      return "尚未执行";
    case "unavailable":
      return "不可用";
    case "failed":
      return "失败";
  }
}

function formatSourceKind(
  sourceKind: ManuscriptHarnessMatrixItemViewModel["source_kind"],
) {
  switch (sourceKind) {
    case "module_execution":
      return "模块执行";
    case "runtime_binding":
      return "运行时绑定";
    case "model":
      return "模型";
    case "prompt_template":
      return "提示词";
    case "skill_package":
      return "Skill 包";
    case "quality_package":
      return "质量包";
    case "knowledge_hit":
      return "知识命中";
    case "review_item":
      return "人工复核项";
    case "governed_hit":
      return "治理命中";
    case "residual_issue":
      return "残差问题";
    case "learning_candidate":
      return "学习候选";
    case "proofreading_deep_pass":
      return "深度校对轮次";
    case "editing_completion_gate":
      return "编辑完成门禁";
    case "observation":
      return "观察项";
  }
}

function formatEvidenceValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.map(formatEvidenceValue).join(" / ") : "空";
  }
  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return "无";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
