import type {
  ProofreadingDeepPassKind,
  ProofreadingPassRunOutputRecord,
  ProofreadingPassRunRecord,
  ProofreadingPassRunStatus,
} from "./proofreading-pass-run-record.ts";
import type { ProofreadingPassRunRepository } from "./proofreading-pass-run-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface ProofreadingPassRunRow {
  id: string;
  manuscript_id: string;
  job_id: string;
  snapshot_id: string | null;
  pass_no: number;
  pass_kind: ProofreadingDeepPassKind;
  status: ProofreadingPassRunStatus;
  model_id: string;
  model_version: string | null;
  input_context_digest: string | null;
  rule_ids: string[] | string;
  knowledge_item_ids: string[] | string;
  quality_package_ids: string[] | string;
  prompt_template_id: string | null;
  skill_package_ids: string[] | string;
  output: ProofreadingPassRunOutputRecord | string | null;
  error_message: string | null;
  retry_count: number;
  started_at: Date | string;
  finished_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export class PostgresProofreadingPassRunRepository
  implements ProofreadingPassRunRepository
{
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async saveMany(records: ProofreadingPassRunRecord[]): Promise<void> {
    for (const record of records) {
      await this.save(record);
    }
  }

  async findById(id: string): Promise<ProofreadingPassRunRecord | undefined> {
    const result = await this.dependencies.client.query<ProofreadingPassRunRow>(
      `${selectProofreadingPassRunSql()} where id = $1`,
      [id],
    );

    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  }

  async save(record: ProofreadingPassRunRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into proofreading_pass_runs (
          id,
          manuscript_id,
          job_id,
          snapshot_id,
          pass_no,
          pass_kind,
          status,
          model_id,
          model_version,
          input_context_digest,
          rule_ids,
          knowledge_item_ids,
          quality_package_ids,
          prompt_template_id,
          skill_package_ids,
          output,
          error_message,
          retry_count,
          started_at,
          finished_at,
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
          $11::text[],
          $12::text[],
          $13::text[],
          $14,
          $15::text[],
          $16::jsonb,
          $17,
          $18,
          $19,
          $20,
          $21,
          $22
        )
        on conflict (id) do update
        set
          manuscript_id = excluded.manuscript_id,
          job_id = excluded.job_id,
          snapshot_id = excluded.snapshot_id,
          pass_no = excluded.pass_no,
          pass_kind = excluded.pass_kind,
          status = excluded.status,
          model_id = excluded.model_id,
          model_version = excluded.model_version,
          input_context_digest = excluded.input_context_digest,
          rule_ids = excluded.rule_ids,
          knowledge_item_ids = excluded.knowledge_item_ids,
          quality_package_ids = excluded.quality_package_ids,
          prompt_template_id = excluded.prompt_template_id,
          skill_package_ids = excluded.skill_package_ids,
          output = excluded.output,
          error_message = excluded.error_message,
          retry_count = excluded.retry_count,
          started_at = excluded.started_at,
          finished_at = excluded.finished_at,
          updated_at = excluded.updated_at
      `,
      [
        record.id,
        record.manuscript_id,
        record.job_id,
        record.snapshot_id ?? null,
        record.pass_no,
        record.pass_kind,
        record.status,
        record.model_id,
        record.model_version ?? null,
        record.input_context_digest ?? null,
        record.rule_ids,
        record.knowledge_item_ids,
        record.quality_package_ids,
        record.prompt_template_id ?? null,
        record.skill_package_ids,
        JSON.stringify(record.output ?? null),
        record.error_message ?? null,
        record.retry_count,
        record.started_at,
        record.finished_at ?? null,
        record.created_at,
        record.updated_at,
      ],
    );
  }

  async listByJobId(jobId: string): Promise<ProofreadingPassRunRecord[]> {
    const result = await this.dependencies.client.query<ProofreadingPassRunRow>(
      `${selectProofreadingPassRunSql()} where job_id = $1 order by pass_no asc, created_at asc, id asc`,
      [jobId],
    );

    return result.rows.map(mapRow);
  }

  async listByManuscriptId(manuscriptId: string): Promise<ProofreadingPassRunRecord[]> {
    const result = await this.dependencies.client.query<ProofreadingPassRunRow>(
      `${selectProofreadingPassRunSql()} where manuscript_id = $1 order by pass_no asc, created_at asc, id asc`,
      [manuscriptId],
    );

    return result.rows.map(mapRow);
  }
}

function selectProofreadingPassRunSql(): string {
  return `
    select
      id,
      manuscript_id,
      job_id,
      snapshot_id,
      pass_no,
      pass_kind,
      status,
      model_id,
      model_version,
      input_context_digest,
      rule_ids,
      knowledge_item_ids,
      quality_package_ids,
      prompt_template_id,
      skill_package_ids,
      output,
      error_message,
      retry_count,
      started_at,
      finished_at,
      created_at,
      updated_at
    from proofreading_pass_runs
  `;
}

function mapRow(row: ProofreadingPassRunRow): ProofreadingPassRunRecord {
  const output =
    typeof row.output === "string"
      ? (JSON.parse(row.output) as ProofreadingPassRunOutputRecord | null)
      : row.output;

  return {
    id: row.id,
    manuscript_id: row.manuscript_id,
    job_id: row.job_id,
    ...(row.snapshot_id ? { snapshot_id: row.snapshot_id } : {}),
    pass_no: Number(row.pass_no),
    pass_kind: row.pass_kind,
    status: row.status,
    model_id: row.model_id,
    ...(row.model_version ? { model_version: row.model_version } : {}),
    ...(row.input_context_digest ? { input_context_digest: row.input_context_digest } : {}),
    rule_ids: normalizeStringArray(row.rule_ids),
    knowledge_item_ids: normalizeStringArray(row.knowledge_item_ids),
    quality_package_ids: normalizeStringArray(row.quality_package_ids),
    ...(row.prompt_template_id ? { prompt_template_id: row.prompt_template_id } : {}),
    skill_package_ids: normalizeStringArray(row.skill_package_ids),
    ...(output ? { output } : {}),
    ...(row.error_message ? { error_message: row.error_message } : {}),
    retry_count: Number(row.retry_count),
    started_at: toIsoString(row.started_at),
    ...(row.finished_at ? { finished_at: toIsoString(row.finished_at) } : {}),
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

function normalizeStringArray(value: string[] | string): string[] {
  if (Array.isArray(value)) {
    return [...value];
  }

  return value
    .replace(/[{}]/g, "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
