import type {
  EditorialRuleActivationMetricKey,
  EditorialRuleActivationMetricRecord,
} from "./editorial-rule-record.ts";
import type {
  EditorialRuleActivationMetricsRepository,
  IncrementEditorialRuleActivationMetricInput,
} from "./editorial-rule-activation-metrics-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface EditorialRuleActivationMetricRow {
  rule_id: string;
  rule_set_id: string;
  metric_key: EditorialRuleActivationMetricKey;
  metric_count: number;
  created_at: Date;
  updated_at: Date;
}

export class PostgresEditorialRuleActivationMetricsRepository
  implements EditorialRuleActivationMetricsRepository
{
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async incrementMetric(
    input: IncrementEditorialRuleActivationMetricInput,
  ): Promise<EditorialRuleActivationMetricRecord> {
    const result =
      await this.dependencies.client.query<EditorialRuleActivationMetricRow>(
        `
          insert into editorial_rule_activation_metrics (
            rule_id,
            rule_set_id,
            metric_key,
            metric_count,
            created_at,
            updated_at
          )
          values ($1::uuid, $2::uuid, $3, $4, $5::timestamptz, $5::timestamptz)
          on conflict (rule_id, metric_key) do update
          set
            rule_set_id = excluded.rule_set_id,
            metric_count =
              editorial_rule_activation_metrics.metric_count + excluded.metric_count,
            updated_at = excluded.updated_at
          returning
            rule_id,
            rule_set_id,
            metric_key,
            metric_count,
            created_at,
            updated_at
        `,
        [
          input.ruleId,
          input.ruleSetId,
          input.metricKey,
          input.amount,
          input.timestamp,
        ],
      );

    return mapMetricRow(result.rows[0]!);
  }

  async listMetricsByRuleIds(
    ruleIds: readonly string[],
  ): Promise<EditorialRuleActivationMetricRecord[]> {
    if (ruleIds.length === 0) {
      return [];
    }

    const result =
      await this.dependencies.client.query<EditorialRuleActivationMetricRow>(
        `
          select
            rule_id,
            rule_set_id,
            metric_key,
            metric_count,
            created_at,
            updated_at
          from editorial_rule_activation_metrics
          where rule_id = any($1::uuid[])
          order by rule_id asc, metric_key asc
        `,
        [ruleIds],
      );

    return result.rows.map(mapMetricRow);
  }

  async listMetricsByRuleSetIds(
    ruleSetIds: readonly string[],
  ): Promise<EditorialRuleActivationMetricRecord[]> {
    if (ruleSetIds.length === 0) {
      return [];
    }

    const result =
      await this.dependencies.client.query<EditorialRuleActivationMetricRow>(
        `
          select
            rule_id,
            rule_set_id,
            metric_key,
            metric_count,
            created_at,
            updated_at
          from editorial_rule_activation_metrics
          where rule_set_id = any($1::uuid[])
          order by rule_set_id asc, rule_id asc, metric_key asc
        `,
        [ruleSetIds],
      );

    return result.rows.map(mapMetricRow);
  }
}

function mapMetricRow(
  row: EditorialRuleActivationMetricRow,
): EditorialRuleActivationMetricRecord {
  return {
    rule_id: row.rule_id,
    rule_set_id: row.rule_set_id,
    metric_key: row.metric_key,
    metric_count: Number(row.metric_count),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
