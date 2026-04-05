import type { AgentExecutionLogRecord } from "./agent-execution-record.ts";
import type {
  AgentExecutionRepository,
  SaveIfOrchestrationStateMatchesInput,
} from "./agent-execution-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface AgentExecutionLogRow {
  id: string;
  manuscript_id: string;
  module: AgentExecutionLogRecord["module"];
  triggered_by: string;
  runtime_id: string;
  sandbox_profile_id: string;
  agent_profile_id: string;
  runtime_binding_id: string;
  tool_permission_policy_id: string;
  execution_snapshot_id: string | null;
  routing_policy_version_id: string | null;
  routing_policy_scope_kind: AgentExecutionLogRecord["routing_policy_scope_kind"] | null;
  routing_policy_scope_value: string | null;
  resolved_model_id: string | null;
  fallback_model_id: string | null;
  fallback_trigger: string | null;
  knowledge_item_ids: string[] | string;
  verification_check_profile_ids: string[] | string;
  evaluation_suite_ids: string[] | string;
  release_check_profile_id: string | null;
  verification_evidence_ids: string[] | string;
  status: AgentExecutionLogRecord["status"];
  orchestration_status: AgentExecutionLogRecord["orchestration_status"];
  orchestration_attempt_count: number;
  orchestration_max_attempts: number;
  orchestration_last_error: string | null;
  orchestration_last_attempt_started_at: Date | string | null;
  orchestration_last_attempt_finished_at: Date | string | null;
  orchestration_attempt_claim_token: string | null;
  orchestration_next_retry_at: Date | string | null;
  started_at: Date | string;
  finished_at: Date | string | null;
}

export class PostgresAgentExecutionRepository implements AgentExecutionRepository {
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async save(record: AgentExecutionLogRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into agent_execution_logs (
          id,
          manuscript_id,
          module,
          triggered_by,
          runtime_id,
          sandbox_profile_id,
          agent_profile_id,
          runtime_binding_id,
          tool_permission_policy_id,
          execution_snapshot_id,
          routing_policy_version_id,
          routing_policy_scope_kind,
          routing_policy_scope_value,
          resolved_model_id,
          fallback_model_id,
          fallback_trigger,
          knowledge_item_ids,
          verification_check_profile_ids,
          evaluation_suite_ids,
          release_check_profile_id,
          verification_evidence_ids,
          status,
          orchestration_status,
          orchestration_attempt_count,
          orchestration_max_attempts,
          orchestration_last_error,
          orchestration_last_attempt_started_at,
          orchestration_last_attempt_finished_at,
          orchestration_attempt_claim_token,
          orchestration_next_retry_at,
          started_at,
          finished_at
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
          $16,
          $17::text[],
          $18::text[],
          $19::text[],
          $20,
          $21::text[],
          $22,
          $23,
          $24,
          $25,
          $26,
          $27,
          $28,
          $29,
          $30,
          $31,
          $32
        )
        on conflict (id) do update
        set
          manuscript_id = excluded.manuscript_id,
          module = excluded.module,
          triggered_by = excluded.triggered_by,
          runtime_id = excluded.runtime_id,
          sandbox_profile_id = excluded.sandbox_profile_id,
          agent_profile_id = excluded.agent_profile_id,
          runtime_binding_id = excluded.runtime_binding_id,
          tool_permission_policy_id = excluded.tool_permission_policy_id,
          execution_snapshot_id = excluded.execution_snapshot_id,
          routing_policy_version_id = excluded.routing_policy_version_id,
          routing_policy_scope_kind = excluded.routing_policy_scope_kind,
          routing_policy_scope_value = excluded.routing_policy_scope_value,
          resolved_model_id = excluded.resolved_model_id,
          fallback_model_id = excluded.fallback_model_id,
          fallback_trigger = excluded.fallback_trigger,
          knowledge_item_ids = excluded.knowledge_item_ids,
          verification_check_profile_ids = excluded.verification_check_profile_ids,
          evaluation_suite_ids = excluded.evaluation_suite_ids,
          release_check_profile_id = excluded.release_check_profile_id,
          verification_evidence_ids = excluded.verification_evidence_ids,
          status = excluded.status,
          orchestration_status = excluded.orchestration_status,
          orchestration_attempt_count = excluded.orchestration_attempt_count,
          orchestration_max_attempts = excluded.orchestration_max_attempts,
          orchestration_last_error = excluded.orchestration_last_error,
          orchestration_last_attempt_started_at = excluded.orchestration_last_attempt_started_at,
          orchestration_last_attempt_finished_at = excluded.orchestration_last_attempt_finished_at,
          orchestration_attempt_claim_token = excluded.orchestration_attempt_claim_token,
          orchestration_next_retry_at = excluded.orchestration_next_retry_at,
          started_at = excluded.started_at,
          finished_at = excluded.finished_at
      `,
      [
        record.id,
        record.manuscript_id,
        record.module,
        record.triggered_by,
        record.runtime_id,
        record.sandbox_profile_id,
        record.agent_profile_id,
        record.runtime_binding_id,
        record.tool_permission_policy_id,
        record.execution_snapshot_id ?? null,
        record.routing_policy_version_id ?? null,
        record.routing_policy_scope_kind ?? null,
        record.routing_policy_scope_value ?? null,
        record.resolved_model_id ?? null,
        record.fallback_model_id ?? null,
        record.fallback_trigger ?? null,
        record.knowledge_item_ids,
        record.verification_check_profile_ids,
        record.evaluation_suite_ids,
        record.release_check_profile_id ?? null,
        record.verification_evidence_ids,
        record.status,
        record.orchestration_status,
        record.orchestration_attempt_count,
        record.orchestration_max_attempts,
        record.orchestration_last_error ?? null,
        record.orchestration_last_attempt_started_at ?? null,
        record.orchestration_last_attempt_finished_at ?? null,
        record.orchestration_attempt_claim_token ?? null,
        record.orchestration_next_retry_at ?? null,
        record.started_at,
        record.finished_at ?? null,
      ],
    );
  }

  async saveIfOrchestrationStateMatches(
    input: SaveIfOrchestrationStateMatchesInput,
  ): Promise<AgentExecutionLogRecord | undefined> {
    const record = input.record;
    const result = await this.dependencies.client.query<AgentExecutionLogRow>(
      `
        update agent_execution_logs
        set
          manuscript_id = $2,
          module = $3,
          triggered_by = $4,
          runtime_id = $5,
          sandbox_profile_id = $6,
          agent_profile_id = $7,
          runtime_binding_id = $8,
          tool_permission_policy_id = $9,
          execution_snapshot_id = $10,
          routing_policy_version_id = $11,
          routing_policy_scope_kind = $12,
          routing_policy_scope_value = $13,
          resolved_model_id = $14,
          fallback_model_id = $15,
          fallback_trigger = $16,
          knowledge_item_ids = $17::text[],
          verification_check_profile_ids = $18::text[],
          evaluation_suite_ids = $19::text[],
          release_check_profile_id = $20,
          verification_evidence_ids = $21::text[],
          status = $22,
          orchestration_status = $23,
          orchestration_attempt_count = $24,
          orchestration_max_attempts = $25,
          orchestration_last_error = $26,
          orchestration_last_attempt_started_at = $27,
          orchestration_last_attempt_finished_at = $28,
          orchestration_attempt_claim_token = $29,
          orchestration_next_retry_at = $30,
          started_at = $31,
          finished_at = $32
        where id = $1
          and orchestration_status = $33
          and orchestration_attempt_count = $34
          and orchestration_last_attempt_started_at is not distinct from $35::timestamptz
          and orchestration_next_retry_at is not distinct from $36::timestamptz
          and orchestration_attempt_claim_token is not distinct from $37
        returning
          id,
          manuscript_id,
          module,
          triggered_by,
          runtime_id,
          sandbox_profile_id,
          agent_profile_id,
          runtime_binding_id,
          tool_permission_policy_id,
          execution_snapshot_id,
          routing_policy_version_id,
          routing_policy_scope_kind,
          routing_policy_scope_value,
          resolved_model_id,
          fallback_model_id,
          fallback_trigger,
          knowledge_item_ids,
          verification_check_profile_ids,
          evaluation_suite_ids,
          release_check_profile_id,
          verification_evidence_ids,
          status,
          orchestration_status,
          orchestration_attempt_count,
          orchestration_max_attempts,
          orchestration_last_error,
          orchestration_last_attempt_started_at,
          orchestration_last_attempt_finished_at,
          orchestration_attempt_claim_token,
          orchestration_next_retry_at,
          started_at,
          finished_at
      `,
      [
        record.id,
        record.manuscript_id,
        record.module,
        record.triggered_by,
        record.runtime_id,
        record.sandbox_profile_id,
        record.agent_profile_id,
        record.runtime_binding_id,
        record.tool_permission_policy_id,
        record.execution_snapshot_id ?? null,
        record.routing_policy_version_id ?? null,
        record.routing_policy_scope_kind ?? null,
        record.routing_policy_scope_value ?? null,
        record.resolved_model_id ?? null,
        record.fallback_model_id ?? null,
        record.fallback_trigger ?? null,
        record.knowledge_item_ids,
        record.verification_check_profile_ids,
        record.evaluation_suite_ids,
        record.release_check_profile_id ?? null,
        record.verification_evidence_ids,
        record.status,
        record.orchestration_status,
        record.orchestration_attempt_count,
        record.orchestration_max_attempts,
        record.orchestration_last_error ?? null,
        record.orchestration_last_attempt_started_at ?? null,
        record.orchestration_last_attempt_finished_at ?? null,
        record.orchestration_attempt_claim_token ?? null,
        record.orchestration_next_retry_at ?? null,
        record.started_at,
        record.finished_at ?? null,
        input.expected.orchestration_status,
        input.expected.orchestration_attempt_count,
        input.expected.orchestration_last_attempt_started_at ?? null,
        input.expected.orchestration_next_retry_at ?? null,
        input.expected.orchestration_attempt_claim_token ?? null,
      ],
    );

    return result.rows[0] ? mapAgentExecutionLogRow(result.rows[0]) : undefined;
  }

  async findById(id: string): Promise<AgentExecutionLogRecord | undefined> {
    const result = await this.dependencies.client.query<AgentExecutionLogRow>(
      `
        select
          id,
          manuscript_id,
          module,
          triggered_by,
          runtime_id,
          sandbox_profile_id,
          agent_profile_id,
          runtime_binding_id,
          tool_permission_policy_id,
          execution_snapshot_id,
          routing_policy_version_id,
          routing_policy_scope_kind,
          routing_policy_scope_value,
          resolved_model_id,
          fallback_model_id,
          fallback_trigger,
          knowledge_item_ids,
          verification_check_profile_ids,
          evaluation_suite_ids,
          release_check_profile_id,
          verification_evidence_ids,
          status,
          orchestration_status,
          orchestration_attempt_count,
          orchestration_max_attempts,
          orchestration_last_error,
          orchestration_last_attempt_started_at,
          orchestration_last_attempt_finished_at,
          orchestration_attempt_claim_token,
          orchestration_next_retry_at,
          started_at,
          finished_at
        from agent_execution_logs
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapAgentExecutionLogRow(result.rows[0]) : undefined;
  }

  async list(): Promise<AgentExecutionLogRecord[]> {
    const result = await this.dependencies.client.query<AgentExecutionLogRow>(
      `
        select
          id,
          manuscript_id,
          module,
          triggered_by,
          runtime_id,
          sandbox_profile_id,
          agent_profile_id,
          runtime_binding_id,
          tool_permission_policy_id,
          execution_snapshot_id,
          routing_policy_version_id,
          routing_policy_scope_kind,
          routing_policy_scope_value,
          resolved_model_id,
          fallback_model_id,
          fallback_trigger,
          knowledge_item_ids,
          verification_check_profile_ids,
          evaluation_suite_ids,
          release_check_profile_id,
          verification_evidence_ids,
          status,
          orchestration_status,
          orchestration_attempt_count,
          orchestration_max_attempts,
          orchestration_last_error,
          orchestration_last_attempt_started_at,
          orchestration_last_attempt_finished_at,
          orchestration_attempt_claim_token,
          orchestration_next_retry_at,
          started_at,
          finished_at
        from agent_execution_logs
        order by started_at asc, id asc
      `,
    );

    return result.rows.map(mapAgentExecutionLogRow);
  }
}

function mapAgentExecutionLogRow(
  row: AgentExecutionLogRow,
): AgentExecutionLogRecord {
  return {
    id: row.id,
    manuscript_id: row.manuscript_id,
    module: row.module,
    triggered_by: row.triggered_by,
    runtime_id: row.runtime_id,
    sandbox_profile_id: row.sandbox_profile_id,
    agent_profile_id: row.agent_profile_id,
    runtime_binding_id: row.runtime_binding_id,
    tool_permission_policy_id: row.tool_permission_policy_id,
    execution_snapshot_id: row.execution_snapshot_id ?? undefined,
    routing_policy_version_id: row.routing_policy_version_id ?? undefined,
    routing_policy_scope_kind: row.routing_policy_scope_kind ?? undefined,
    routing_policy_scope_value: row.routing_policy_scope_value ?? undefined,
    resolved_model_id: row.resolved_model_id ?? undefined,
    fallback_model_id: row.fallback_model_id ?? undefined,
    fallback_trigger: row.fallback_trigger ?? undefined,
    knowledge_item_ids: decodeTextArray(row.knowledge_item_ids),
    verification_check_profile_ids: decodeTextArray(
      row.verification_check_profile_ids,
    ),
    evaluation_suite_ids: decodeTextArray(row.evaluation_suite_ids),
    release_check_profile_id: row.release_check_profile_id ?? undefined,
    verification_evidence_ids: decodeTextArray(row.verification_evidence_ids),
    status: row.status,
    orchestration_status: row.orchestration_status,
    orchestration_attempt_count: Number(row.orchestration_attempt_count),
    orchestration_max_attempts: Number(row.orchestration_max_attempts),
    orchestration_last_error: row.orchestration_last_error ?? undefined,
    orchestration_last_attempt_started_at: row.orchestration_last_attempt_started_at
      ? toIsoString(row.orchestration_last_attempt_started_at)
      : undefined,
    orchestration_last_attempt_finished_at: row.orchestration_last_attempt_finished_at
      ? toIsoString(row.orchestration_last_attempt_finished_at)
      : undefined,
    orchestration_attempt_claim_token:
      row.orchestration_attempt_claim_token ?? undefined,
    orchestration_next_retry_at: row.orchestration_next_retry_at
      ? toIsoString(row.orchestration_next_retry_at)
      : undefined,
    started_at: toIsoString(row.started_at),
    finished_at: row.finished_at ? toIsoString(row.finished_at) : undefined,
  };
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function decodeTextArray(value: string[] | string): string[] {
  if (Array.isArray(value)) {
    return [...value];
  }

  if (!value || value === "{}") {
    return [];
  }

  return value
    .slice(1, -1)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => item.replace(/^"(.*)"$/, "$1"));
}
