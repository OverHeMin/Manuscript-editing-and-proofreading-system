import type {
  EditorialRuleActivationMetricKey,
  EditorialRuleActivationMetricRecord,
} from "./editorial-rule-record.ts";

export interface IncrementEditorialRuleActivationMetricInput {
  ruleId: string;
  ruleSetId: string;
  metricKey: EditorialRuleActivationMetricKey;
  amount: number;
  timestamp: string;
}

export interface EditorialRuleActivationMetricsRepository {
  incrementMetric(
    input: IncrementEditorialRuleActivationMetricInput,
  ): Promise<EditorialRuleActivationMetricRecord>;
  listMetricsByRuleIds(
    ruleIds: readonly string[],
  ): Promise<EditorialRuleActivationMetricRecord[]>;
  listMetricsByRuleSetIds(
    ruleSetIds: readonly string[],
  ): Promise<EditorialRuleActivationMetricRecord[]>;
}
