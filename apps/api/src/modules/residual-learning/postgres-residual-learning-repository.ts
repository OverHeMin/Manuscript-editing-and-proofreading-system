import type { ResidualIssueRecord } from "./residual-learning-record.ts";
import type { ResidualIssueRepository } from "./residual-learning-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface ResidualIssueRow {
  id: string;
  module: ResidualIssueRecord["module"];
  manuscript_id: string;
  manuscript_type: ResidualIssueRecord["manuscript_type"];
  job_id: string | null;
  execution_snapshot_id: string;
  agent_execution_log_id: string | null;
  output_asset_id: string | null;
  execution_profile_id: string | null;
  runtime_binding_id: string | null;
  prompt_template_id: string | null;
  retrieval_snapshot_id: string | null;
  issue_type: string;
  source_stage: ResidualIssueRecord["source_stage"];
  excerpt: string | null;
  location: Record<string, unknown> | string | null;
  suggestion: string | null;
  rationale: string | null;
  related_rule_ids: string[] | null;
  related_knowledge_item_ids: string[] | null;
  related_quality_issue_ids: string[] | null;
  novelty_key: string;
  recurrence_count: number;
  model_confidence: number | null;
  signal_breakdown: Record<string, unknown> | string | null;
  system_confidence_band: ResidualIssueRecord["system_confidence_band"];
  risk_level: ResidualIssueRecord["risk_level"];
  recommended_route: ResidualIssueRecord["recommended_route"];
  status: ResidualIssueRecord["status"];
  harness_validation_status: ResidualIssueRecord["harness_validation_status"];
  harness_run_id: string | null;
  harness_evidence_pack_id: string | null;
  learning_candidate_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export class PostgresResidualIssueRepository
  implements ResidualIssueRepository
{
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async save(record: ResidualIssueRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into residual_issues (
          id,
          module,
          manuscript_id,
          manuscript_type,
          job_id,
          execution_snapshot_id,
          agent_execution_log_id,
          output_asset_id,
          execution_profile_id,
          runtime_binding_id,
          prompt_template_id,
          retrieval_snapshot_id,
          issue_type,
          source_stage,
          excerpt,
          location,
          suggestion,
          rationale,
          related_rule_ids,
          related_knowledge_item_ids,
          related_quality_issue_ids,
          novelty_key,
          recurrence_count,
          model_confidence,
          signal_breakdown,
          system_confidence_band,
          risk_level,
          recommended_route,
          status,
          harness_validation_status,
          harness_run_id,
          harness_evidence_pack_id,
          learning_candidate_id,
          created_at,
          updated_at
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16::jsonb,
          $17,
          $18,
          $19,
          $20,
          $21,
          $22,
          $23,
          $24,
          $25::jsonb,
          $26,
          $27,
          $28,
          $29,
          $30,
          $31,
          $32,
          $33,
          $34,
          $35
        )
        on conflict (id) do update
        set
          module = excluded.module,
          manuscript_id = excluded.manuscript_id,
          manuscript_type = excluded.manuscript_type,
          job_id = excluded.job_id,
          execution_snapshot_id = excluded.execution_snapshot_id,
          agent_execution_log_id = excluded.agent_execution_log_id,
          output_asset_id = excluded.output_asset_id,
          execution_profile_id = excluded.execution_profile_id,
          runtime_binding_id = excluded.runtime_binding_id,
          prompt_template_id = excluded.prompt_template_id,
          retrieval_snapshot_id = excluded.retrieval_snapshot_id,
          issue_type = excluded.issue_type,
          source_stage = excluded.source_stage,
          excerpt = excluded.excerpt,
          location = excluded.location,
          suggestion = excluded.suggestion,
          rationale = excluded.rationale,
          related_rule_ids = excluded.related_rule_ids,
          related_knowledge_item_ids = excluded.related_knowledge_item_ids,
          related_quality_issue_ids = excluded.related_quality_issue_ids,
          novelty_key = excluded.novelty_key,
          recurrence_count = excluded.recurrence_count,
          model_confidence = excluded.model_confidence,
          signal_breakdown = excluded.signal_breakdown,
          system_confidence_band = excluded.system_confidence_band,
          risk_level = excluded.risk_level,
          recommended_route = excluded.recommended_route,
          status = excluded.status,
          harness_validation_status = excluded.harness_validation_status,
          harness_run_id = excluded.harness_run_id,
          harness_evidence_pack_id = excluded.harness_evidence_pack_id,
          learning_candidate_id = excluded.learning_candidate_id,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `,
      [
        record.id,
        record.module,
        record.manuscript_id,
        record.manuscript_type,
        record.job_id ?? null,
        record.execution_snapshot_id,
        record.agent_execution_log_id ?? null,
        record.output_asset_id ?? null,
        record.execution_profile_id ?? null,
        record.runtime_binding_id ?? null,
        record.prompt_template_id ?? null,
        record.retrieval_snapshot_id ?? null,
        record.issue_type,
        record.source_stage,
        record.excerpt ?? null,
        JSON.stringify(record.location ?? {}),
        record.suggestion ?? null,
        record.rationale ?? null,
        record.related_rule_ids ?? [],
        record.related_knowledge_item_ids ?? [],
        record.related_quality_issue_ids ?? [],
        record.novelty_key,
        record.recurrence_count,
        record.model_confidence ?? null,
        JSON.stringify(record.signal_breakdown ?? {}),
        record.system_confidence_band,
        record.risk_level,
        record.recommended_route,
        record.status,
        record.harness_validation_status,
        record.harness_run_id ?? null,
        record.harness_evidence_pack_id ?? null,
        record.learning_candidate_id ?? null,
        record.created_at,
        record.updated_at,
      ],
    );
  }

  async findById(id: string): Promise<ResidualIssueRecord | undefined> {
    const result = await this.dependencies.client.query<ResidualIssueRow>(
      `
        select
          id,
          module,
          manuscript_id,
          manuscript_type,
          job_id,
          execution_snapshot_id,
          agent_execution_log_id,
          output_asset_id,
          execution_profile_id,
          runtime_binding_id,
          prompt_template_id,
          retrieval_snapshot_id,
          issue_type,
          source_stage,
          excerpt,
          location,
          suggestion,
          rationale,
          related_rule_ids,
          related_knowledge_item_ids,
          related_quality_issue_ids,
          novelty_key,
          recurrence_count,
          model_confidence,
          signal_breakdown,
          system_confidence_band,
          risk_level,
          recommended_route,
          status,
          harness_validation_status,
          harness_run_id,
          harness_evidence_pack_id,
          learning_candidate_id,
          created_at,
          updated_at
        from residual_issues
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapResidualIssueRow(result.rows[0]) : undefined;
  }

  async list(): Promise<ResidualIssueRecord[]> {
    return this.listWhere("", []);
  }

  async listByStatus(
    status: ResidualIssueRecord["status"],
  ): Promise<ResidualIssueRecord[]> {
    return this.listWhere("where status = $1", [status]);
  }

  async listByHarnessValidationStatus(
    status: ResidualIssueRecord["harness_validation_status"],
  ): Promise<ResidualIssueRecord[]> {
    return this.listWhere("where harness_validation_status = $1", [status]);
  }

  async listByExecutionSnapshotId(
    executionSnapshotId: string,
  ): Promise<ResidualIssueRecord[]> {
    return this.listWhere("where execution_snapshot_id = $1", [
      executionSnapshotId,
    ]);
  }

  private async listWhere(
    whereClause: string,
    params: unknown[],
  ): Promise<ResidualIssueRecord[]> {
    const result = await this.dependencies.client.query<ResidualIssueRow>(
      `
        select
          id,
          module,
          manuscript_id,
          manuscript_type,
          job_id,
          execution_snapshot_id,
          agent_execution_log_id,
          output_asset_id,
          execution_profile_id,
          runtime_binding_id,
          prompt_template_id,
          retrieval_snapshot_id,
          issue_type,
          source_stage,
          excerpt,
          location,
          suggestion,
          rationale,
          related_rule_ids,
          related_knowledge_item_ids,
          related_quality_issue_ids,
          novelty_key,
          recurrence_count,
          model_confidence,
          signal_breakdown,
          system_confidence_band,
          risk_level,
          recommended_route,
          status,
          harness_validation_status,
          harness_run_id,
          harness_evidence_pack_id,
          learning_candidate_id,
          created_at,
          updated_at
        from residual_issues
        ${whereClause}
        order by updated_at desc, created_at desc, id asc
      `,
      params,
    );

    return result.rows.map(mapResidualIssueRow);
  }
}

function mapResidualIssueRow(row: ResidualIssueRow): ResidualIssueRecord {
  const location = parseOptionalJsonObject(row.location);
  const signalBreakdown = parseOptionalJsonObject(row.signal_breakdown);

  return {
    id: row.id,
    module: row.module,
    manuscript_id: row.manuscript_id,
    manuscript_type: row.manuscript_type,
    execution_snapshot_id: row.execution_snapshot_id,
    issue_type: row.issue_type,
    source_stage: row.source_stage,
    novelty_key: row.novelty_key,
    recurrence_count: row.recurrence_count,
    system_confidence_band: row.system_confidence_band,
    risk_level: row.risk_level,
    recommended_route: row.recommended_route,
    status: row.status,
    harness_validation_status: row.harness_validation_status,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    ...(row.job_id != null ? { job_id: row.job_id } : {}),
    ...(row.agent_execution_log_id != null
      ? { agent_execution_log_id: row.agent_execution_log_id }
      : {}),
    ...(row.output_asset_id != null
      ? { output_asset_id: row.output_asset_id }
      : {}),
    ...(row.execution_profile_id != null
      ? { execution_profile_id: row.execution_profile_id }
      : {}),
    ...(row.runtime_binding_id != null
      ? { runtime_binding_id: row.runtime_binding_id }
      : {}),
    ...(row.prompt_template_id != null
      ? { prompt_template_id: row.prompt_template_id }
      : {}),
    ...(row.retrieval_snapshot_id != null
      ? { retrieval_snapshot_id: row.retrieval_snapshot_id }
      : {}),
    ...(row.excerpt != null ? { excerpt: row.excerpt } : {}),
    ...(location ? { location } : {}),
    ...(row.suggestion != null ? { suggestion: row.suggestion } : {}),
    ...(row.rationale != null ? { rationale: row.rationale } : {}),
    ...(row.related_rule_ids != null && row.related_rule_ids.length > 0
      ? { related_rule_ids: row.related_rule_ids }
      : {}),
    ...(row.related_knowledge_item_ids != null &&
    row.related_knowledge_item_ids.length > 0
      ? { related_knowledge_item_ids: row.related_knowledge_item_ids }
      : {}),
    ...(row.related_quality_issue_ids != null &&
    row.related_quality_issue_ids.length > 0
      ? { related_quality_issue_ids: row.related_quality_issue_ids }
      : {}),
    ...(row.model_confidence != null
      ? { model_confidence: row.model_confidence }
      : {}),
    ...(signalBreakdown ? { signal_breakdown: signalBreakdown } : {}),
    ...(row.harness_run_id != null ? { harness_run_id: row.harness_run_id } : {}),
    ...(row.harness_evidence_pack_id != null
      ? { harness_evidence_pack_id: row.harness_evidence_pack_id }
      : {}),
    ...(row.learning_candidate_id != null
      ? { learning_candidate_id: row.learning_candidate_id }
      : {}),
  };
}

function parseOptionalJsonObject(
  value: Record<string, unknown> | string | null,
): Record<string, unknown> | undefined {
  if (value == null) {
    return undefined;
  }

  const parsed =
    typeof value === "string"
      ? (JSON.parse(value) as Record<string, unknown>)
      : value;

  return Object.keys(parsed).length > 0 ? parsed : undefined;
}
