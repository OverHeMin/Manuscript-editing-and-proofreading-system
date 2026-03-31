import type { JobRecord } from "./job-record.ts";
import type { JobRepository } from "./job-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface JobRow {
  id: string;
  manuscript_id: string | null;
  module: JobRecord["module"];
  job_type: string;
  status: JobRecord["status"];
  requested_by: string;
  payload: Record<string, unknown> | string | null;
  attempt_count: number;
  started_at: Date | string | null;
  finished_at: Date | string | null;
  error_message: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export class PostgresJobRepository implements JobRepository {
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async save(record: JobRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into jobs (
          id,
          manuscript_id,
          module,
          job_type,
          status,
          requested_by,
          payload,
          attempt_count,
          started_at,
          finished_at,
          error_message,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13)
        on conflict (id) do update
        set
          manuscript_id = excluded.manuscript_id,
          module = excluded.module,
          job_type = excluded.job_type,
          status = excluded.status,
          requested_by = excluded.requested_by,
          payload = excluded.payload,
          attempt_count = excluded.attempt_count,
          started_at = excluded.started_at,
          finished_at = excluded.finished_at,
          error_message = excluded.error_message,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `,
      [
        record.id,
        record.manuscript_id ?? null,
        record.module,
        record.job_type,
        record.status,
        record.requested_by,
        JSON.stringify(record.payload ?? null),
        record.attempt_count,
        record.started_at ?? null,
        record.finished_at ?? null,
        record.error_message ?? null,
        record.created_at,
        record.updated_at,
      ],
    );
  }

  async findById(id: string): Promise<JobRecord | undefined> {
    const result = await this.dependencies.client.query<JobRow>(
      `
        select
          id,
          manuscript_id,
          module,
          job_type,
          status,
          requested_by,
          payload,
          attempt_count,
          started_at,
          finished_at,
          error_message,
          created_at,
          updated_at
        from jobs
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapJobRow(result.rows[0]) : undefined;
  }
}

function mapJobRow(row: JobRow): JobRecord {
  const payload =
    typeof row.payload === "string"
      ? JSON.parse(row.payload)
      : row.payload ?? undefined;

  return {
    id: row.id,
    ...(row.manuscript_id ? { manuscript_id: row.manuscript_id } : {}),
    module: row.module,
    job_type: row.job_type,
    status: row.status,
    requested_by: row.requested_by,
    ...(payload ? { payload } : {}),
    attempt_count: Number(row.attempt_count),
    ...(row.started_at ? { started_at: toIsoString(row.started_at) } : {}),
    ...(row.finished_at ? { finished_at: toIsoString(row.finished_at) } : {}),
    ...(row.error_message ? { error_message: row.error_message } : {}),
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
