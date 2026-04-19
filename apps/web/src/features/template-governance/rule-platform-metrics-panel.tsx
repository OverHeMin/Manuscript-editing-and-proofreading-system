import type {
  EditorialRuleActivationMetricsSummary,
  EditorialRuleReleaseComparisonSummary,
  EditorialRuleSetViewModel,
  EditorialRuleViewModel,
} from "../editorial-rules/types.ts";

interface RulePlatformMetricsPanelProps {
  selectedRuleSet: EditorialRuleSetViewModel;
  rules: readonly EditorialRuleViewModel[];
}

interface MetricCardDefinition {
  label: string;
  value: string | number;
}

export function RulePlatformMetricsPanel({
  selectedRuleSet,
  rules,
}: RulePlatformMetricsPanelProps) {
  const summary = selectedRuleSet.metrics_summary;
  const comparison = selectedRuleSet.release_comparison;
  const rankedRules = rules
    .filter((rule) => rule.metrics_summary != null)
    .sort(compareRulesByMetrics)
    .slice(0, 5);

  return (
    <article className="template-governance-card" data-rule-metrics-panel="field">
      <div className="template-governance-panel-header">
        <div>
          <h3>规则激活指标</h3>
          <p>把命中、误报、人工确认和写回效果集中展示，方便判断这套规则是否值得继续放量。</p>
        </div>
      </div>

      {summary ? (
        <div className="template-governance-detail-grid">
          {buildMetricCards(summary).map((card) => (
            <div key={card.label}>
              <span>{card.label}</span>
              <p>{card.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="template-governance-empty">
          当前规则集还没有积累到可用的激活指标，先完成命中和人工决策后再看趋势。
        </p>
      )}

      <section
        className="template-governance-stack"
        data-release-comparison-status={comparison?.status ?? "none"}
        data-release-comparison-recommendation={comparison?.recommendation ?? "none"}
      >
        <strong>版本对比</strong>
        {comparison ? (
          <>
            <small>
              {formatComparisonStatus(comparison.status)} /{" "}
              {formatComparisonRecommendation(comparison.recommendation)}
            </small>
            <div className="template-governance-detail-grid">
              <div>
                <span>基线规则集</span>
                <p>{comparison.baseline_rule_set_id ?? "无可用基线"}</p>
              </div>
              <div>
                <span>当前候选</span>
                <p>{comparison.compared_rule_set_id}</p>
              </div>
              <div>
                <span>基线误报率</span>
                <p>{formatPercent(comparison.baseline_metrics.rates.false_positive_rate)}</p>
              </div>
              <div>
                <span>当前误报率</span>
                <p>{formatPercent(comparison.candidate_metrics.rates.false_positive_rate)}</p>
              </div>
              <div>
                <span>基线写回成功率</span>
                <p>{formatPercent(comparison.baseline_metrics.rates.writeback_success_rate)}</p>
              </div>
              <div>
                <span>当前写回成功率</span>
                <p>{formatPercent(comparison.candidate_metrics.rates.writeback_success_rate)}</p>
              </div>
            </div>
            {comparison.reasons.length > 0 ? (
              <ul className="template-governance-list">
                {comparison.reasons.map((reason, index) => (
                  <li key={`${reason}-${index}`}>
                    <div className="template-governance-list-button">
                      <span>{reason}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="template-governance-empty">
            还没有可展示的基线对比结果，等候选集或现网集积累到命中数据后再自动给出建议。
          </p>
        )}
      </section>

      <section className="template-governance-stack">
        <strong>规则排行</strong>
        {rankedRules.length > 0 ? (
          <ul className="template-governance-list">
            {rankedRules.map((rule) => (
              <li key={rule.id}>
                <div
                  className="template-governance-list-button"
                  data-rule-metric-row={rule.id}
                >
                  <span>
                    {rule.rule_object} / #{rule.order_no}
                  </span>
                  <small>
                    命中 {rule.metrics_summary?.totals.governed_hit_count ?? 0} 次，误报率{" "}
                    {formatPercent(rule.metrics_summary?.rates.false_positive_rate ?? 0)}
                  </small>
                  <strong>
                    写回成功率{" "}
                    {formatPercent(rule.metrics_summary?.rates.writeback_success_rate ?? 0)}
                  </strong>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="template-governance-empty">
            当前规则集还没有单条规则指标排行。
          </p>
        )}
      </section>
    </article>
  );
}

function buildMetricCards(
  summary: EditorialRuleActivationMetricsSummary,
): MetricCardDefinition[] {
  return [
    {
      label: "命中次数",
      value: summary.totals.governed_hit_count,
    },
    {
      label: "误报率",
      value: formatPercent(summary.rates.false_positive_rate),
    },
    {
      label: "人工确认率",
      value: formatPercent(summary.rates.human_confirmation_rate),
    },
    {
      label: "仅接受修改",
      value: summary.totals.accept_change_only_count,
    },
    {
      label: "转规则候选",
      value: summary.totals.routed_rule_candidate_count,
    },
    {
      label: "写回成功率",
      value: formatPercent(summary.rates.writeback_success_rate),
    },
  ];
}

function compareRulesByMetrics(
  left: EditorialRuleViewModel,
  right: EditorialRuleViewModel,
): number {
  const hitDifference =
    (right.metrics_summary?.totals.governed_hit_count ?? 0) -
    (left.metrics_summary?.totals.governed_hit_count ?? 0);
  if (hitDifference !== 0) {
    return hitDifference;
  }

  return left.order_no - right.order_no;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatComparisonStatus(
  status: EditorialRuleReleaseComparisonSummary["status"],
): string {
  switch (status) {
    case "stable":
      return "稳定";
    case "degraded":
      return "劣化";
    case "insufficient_data":
    default:
      return "数据不足";
  }
}

function formatComparisonRecommendation(
  recommendation: EditorialRuleReleaseComparisonSummary["recommendation"],
): string {
  switch (recommendation) {
    case "promote":
      return "建议推进发布";
    case "rollback_recommended":
      return "建议回滚";
    case "hold":
    default:
      return "建议保持观察";
  }
}
