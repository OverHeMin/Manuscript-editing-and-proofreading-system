import type {
  EditorialRuleActivationMetricRecord,
} from "./editorial-rule-record.ts";
import type {
  EditorialRuleActivationMetricsRepository,
  IncrementEditorialRuleActivationMetricInput,
} from "./editorial-rule-activation-metrics-repository.ts";

function cloneRecord(
  record: EditorialRuleActivationMetricRecord,
): EditorialRuleActivationMetricRecord {
  return {
    ...record,
  };
}

function metricKey(ruleId: string, metricKeyValue: string): string {
  return `${ruleId}:${metricKeyValue}`;
}

export class InMemoryEditorialRuleActivationMetricsRepository
  implements EditorialRuleActivationMetricsRepository
{
  private readonly metrics = new Map<string, EditorialRuleActivationMetricRecord>();

  async incrementMetric(
    input: IncrementEditorialRuleActivationMetricInput,
  ): Promise<EditorialRuleActivationMetricRecord> {
    const key = metricKey(input.ruleId, input.metricKey);
    const existing = this.metrics.get(key);
    const next: EditorialRuleActivationMetricRecord = existing
      ? {
          ...existing,
          rule_set_id: input.ruleSetId,
          metric_count: existing.metric_count + input.amount,
          updated_at: input.timestamp,
        }
      : {
          rule_id: input.ruleId,
          rule_set_id: input.ruleSetId,
          metric_key: input.metricKey,
          metric_count: input.amount,
          created_at: input.timestamp,
          updated_at: input.timestamp,
        };
    this.metrics.set(key, cloneRecord(next));
    return cloneRecord(next);
  }

  async listMetricsByRuleIds(
    ruleIds: readonly string[],
  ): Promise<EditorialRuleActivationMetricRecord[]> {
    const allowed = new Set(ruleIds);
    return [...this.metrics.values()]
      .filter((record) => allowed.has(record.rule_id))
      .map(cloneRecord);
  }

  async listMetricsByRuleSetIds(
    ruleSetIds: readonly string[],
  ): Promise<EditorialRuleActivationMetricRecord[]> {
    const allowed = new Set(ruleSetIds);
    return [...this.metrics.values()]
      .filter((record) => allowed.has(record.rule_set_id))
      .map(cloneRecord);
  }
}
