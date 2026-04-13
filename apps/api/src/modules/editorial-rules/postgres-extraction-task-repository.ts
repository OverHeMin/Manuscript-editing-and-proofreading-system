import type {
  ExtractionTaskCandidateRecord,
  ExtractionTaskRecord,
} from "./extraction-task-record.ts";
import type { ExtractionTaskRepository } from "./extraction-task-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface ExtractionTaskRow {
  id: string;
  task_name: string;
  manuscript_type: ExtractionTaskRecord["manuscript_type"];
  original_file_name: string;
  edited_file_name: string;
  journal_key: string | null;
  source_session_id: string;
  status: ExtractionTaskRecord["status"];
  candidate_count: number;
  pending_confirmation_count: number;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ExtractionTaskCandidateRow {
  id: string;
  task_id: string;
  package_id: string;
  package_kind: ExtractionTaskCandidateRecord["package_kind"];
  title: string;
  confirmation_status: ExtractionTaskCandidateRecord["confirmation_status"];
  suggested_destination: ExtractionTaskCandidateRecord["suggested_destination"];
  candidate_payload: Record<string, unknown> | string;
  semantic_draft_payload: Record<string, unknown> | string;
  intake_payload: Record<string, unknown> | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export class PostgresExtractionTaskRepository implements ExtractionTaskRepository {
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async saveTask(record: ExtractionTaskRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into rule_package_extraction_tasks (
          id,
          task_name,
          manuscript_type,
          original_file_name,
          edited_file_name,
          journal_key,
          source_session_id,
          status,
          candidate_count,
          pending_confirmation_count,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        on conflict (id) do update
        set
          task_name = excluded.task_name,
          manuscript_type = excluded.manuscript_type,
          original_file_name = excluded.original_file_name,
          edited_file_name = excluded.edited_file_name,
          journal_key = excluded.journal_key,
          source_session_id = excluded.source_session_id,
          status = excluded.status,
          candidate_count = excluded.candidate_count,
          pending_confirmation_count = excluded.pending_confirmation_count,
          updated_at = excluded.updated_at
      `,
      [
        record.id,
        record.task_name,
        record.manuscript_type,
        record.original_file_name,
        record.edited_file_name,
        record.journal_key ?? null,
        record.source_session_id,
        record.status,
        record.candidate_count,
        record.pending_confirmation_count,
        record.created_at,
        record.updated_at,
      ],
    );
  }

  async findTaskById(id: string): Promise<ExtractionTaskRecord | undefined> {
    const result = await this.dependencies.client.query<ExtractionTaskRow>(
      `
        select
          id,
          task_name,
          manuscript_type,
          original_file_name,
          edited_file_name,
          journal_key,
          source_session_id,
          status,
          candidate_count,
          pending_confirmation_count,
          created_at,
          updated_at
        from rule_package_extraction_tasks
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapTaskRow(result.rows[0]) : undefined;
  }

  async listTasks(): Promise<ExtractionTaskRecord[]> {
    const result = await this.dependencies.client.query<ExtractionTaskRow>(
      `
        select
          id,
          task_name,
          manuscript_type,
          original_file_name,
          edited_file_name,
          journal_key,
          source_session_id,
          status,
          candidate_count,
          pending_confirmation_count,
          created_at,
          updated_at
        from rule_package_extraction_tasks
        order by created_at desc, id asc
      `,
    );

    return result.rows.map(mapTaskRow);
  }

  async saveCandidate(record: ExtractionTaskCandidateRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into rule_package_extraction_candidates (
          id,
          task_id,
          package_id,
          package_kind,
          title,
          confirmation_status,
          suggested_destination,
          candidate_payload,
          semantic_draft_payload,
          intake_payload,
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
          $8::jsonb,
          $9::jsonb,
          $10::jsonb,
          $11,
          $12
        )
        on conflict (id) do update
        set
          task_id = excluded.task_id,
          package_id = excluded.package_id,
          package_kind = excluded.package_kind,
          title = excluded.title,
          confirmation_status = excluded.confirmation_status,
          suggested_destination = excluded.suggested_destination,
          candidate_payload = excluded.candidate_payload,
          semantic_draft_payload = excluded.semantic_draft_payload,
          intake_payload = excluded.intake_payload,
          updated_at = excluded.updated_at
      `,
      [
        record.id,
        record.task_id,
        record.package_id,
        record.package_kind,
        record.title,
        record.confirmation_status,
        record.suggested_destination,
        JSON.stringify(record.candidate_payload),
        JSON.stringify(record.semantic_draft_payload),
        JSON.stringify(record.intake_payload ?? {}),
        record.created_at,
        record.updated_at,
      ],
    );
  }

  async findCandidateById(
    id: string,
  ): Promise<ExtractionTaskCandidateRecord | undefined> {
    const result = await this.dependencies.client.query<ExtractionTaskCandidateRow>(
      `
        select
          id,
          task_id,
          package_id,
          package_kind,
          title,
          confirmation_status,
          suggested_destination,
          candidate_payload,
          semantic_draft_payload,
          intake_payload,
          created_at,
          updated_at
        from rule_package_extraction_candidates
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapCandidateRow(result.rows[0]) : undefined;
  }

  async listCandidatesByTaskId(
    taskId: string,
  ): Promise<ExtractionTaskCandidateRecord[]> {
    const result = await this.dependencies.client.query<ExtractionTaskCandidateRow>(
      `
        select
          id,
          task_id,
          package_id,
          package_kind,
          title,
          confirmation_status,
          suggested_destination,
          candidate_payload,
          semantic_draft_payload,
          intake_payload,
          created_at,
          updated_at
        from rule_package_extraction_candidates
        where task_id = $1
        order by created_at asc, id asc
      `,
      [taskId],
    );

    return result.rows.map(mapCandidateRow);
  }
}

function mapTaskRow(row: ExtractionTaskRow): ExtractionTaskRecord {
  return {
    id: row.id,
    task_name: row.task_name,
    manuscript_type: row.manuscript_type,
    original_file_name: row.original_file_name,
    edited_file_name: row.edited_file_name,
    ...(row.journal_key ? { journal_key: row.journal_key } : {}),
    source_session_id: row.source_session_id,
    status: row.status,
    candidate_count: Number(row.candidate_count),
    pending_confirmation_count: Number(row.pending_confirmation_count),
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

function mapCandidateRow(
  row: ExtractionTaskCandidateRow,
): ExtractionTaskCandidateRecord {
  const intakePayload = parseJsonObject<Record<string, unknown>>(row.intake_payload);

  return {
    id: row.id,
    task_id: row.task_id,
    package_id: row.package_id,
    package_kind: row.package_kind,
    title: row.title,
    confirmation_status: row.confirmation_status,
    suggested_destination: row.suggested_destination,
    candidate_payload: parseJsonObject<ExtractionTaskCandidateRecord["candidate_payload"]>(
      row.candidate_payload,
    ),
    semantic_draft_payload:
      parseJsonObject<ExtractionTaskCandidateRecord["semantic_draft_payload"]>(
        row.semantic_draft_payload,
      ),
    ...(Object.keys(intakePayload).length > 0 ? { intake_payload: intakePayload } : {}),
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

function parseJsonObject<T extends object>(
  value: Record<string, unknown> | string | null,
): T {
  if (value == null) {
    return {} as T;
  }

  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }

  return value as T;
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
