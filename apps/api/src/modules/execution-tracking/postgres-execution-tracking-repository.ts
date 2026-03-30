import type {
  KnowledgeHitLogRecord,
  ModuleExecutionSnapshotRecord,
} from "./execution-tracking-record.ts";
import type { ExecutionTrackingRepository } from "./execution-tracking-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface ExecutionSnapshotRow {
  id: string;
  manuscript_id: string;
  module: ModuleExecutionSnapshotRecord["module"];
  job_id: string;
  execution_profile_id: string;
  module_template_id: string;
  module_template_version_no: number;
  prompt_template_id: string;
  prompt_template_version: string;
  skill_package_ids: string[] | string;
  skill_package_versions: string[] | string;
  model_id: string;
  model_version: string | null;
  knowledge_item_ids: string[] | string;
  created_asset_ids: string[] | string;
  draft_snapshot_id: string | null;
  created_at: Date | string;
}

interface KnowledgeHitLogRow {
  id: string;
  snapshot_id: string;
  knowledge_item_id: string;
  match_source_id: string | null;
  binding_rule_id: string | null;
  match_source: KnowledgeHitLogRecord["match_source"];
  match_reasons: string[] | string;
  score: number | null;
  section: string | null;
  created_at: Date | string;
}

export class PostgresExecutionTrackingRepository
  implements ExecutionTrackingRepository
{
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async saveSnapshot(record: ModuleExecutionSnapshotRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into execution_snapshots (
          id,
          manuscript_id,
          module,
          job_id,
          execution_profile_id,
          module_template_id,
          module_template_version_no,
          prompt_template_id,
          prompt_template_version,
          skill_package_ids,
          skill_package_versions,
          model_id,
          model_version,
          knowledge_item_ids,
          created_asset_ids,
          draft_snapshot_id,
          created_at
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
          $10::text[],
          $11::text[],
          $12,
          $13,
          $14::text[],
          $15::text[],
          $16,
          $17
        )
        on conflict (id) do update
        set
          manuscript_id = excluded.manuscript_id,
          module = excluded.module,
          job_id = excluded.job_id,
          execution_profile_id = excluded.execution_profile_id,
          module_template_id = excluded.module_template_id,
          module_template_version_no = excluded.module_template_version_no,
          prompt_template_id = excluded.prompt_template_id,
          prompt_template_version = excluded.prompt_template_version,
          skill_package_ids = excluded.skill_package_ids,
          skill_package_versions = excluded.skill_package_versions,
          model_id = excluded.model_id,
          model_version = excluded.model_version,
          knowledge_item_ids = excluded.knowledge_item_ids,
          created_asset_ids = excluded.created_asset_ids,
          draft_snapshot_id = excluded.draft_snapshot_id,
          created_at = excluded.created_at
      `,
      [
        record.id,
        record.manuscript_id,
        record.module,
        record.job_id,
        record.execution_profile_id,
        record.module_template_id,
        record.module_template_version_no,
        record.prompt_template_id,
        record.prompt_template_version,
        record.skill_package_ids,
        record.skill_package_versions,
        record.model_id,
        record.model_version ?? null,
        record.knowledge_item_ids,
        record.created_asset_ids,
        record.draft_snapshot_id ?? null,
        record.created_at,
      ],
    );
  }

  async findSnapshotById(
    id: string,
  ): Promise<ModuleExecutionSnapshotRecord | undefined> {
    const result = await this.dependencies.client.query<ExecutionSnapshotRow>(
      `
        select
          id,
          manuscript_id,
          module,
          job_id,
          execution_profile_id,
          module_template_id,
          module_template_version_no,
          prompt_template_id,
          prompt_template_version,
          skill_package_ids,
          skill_package_versions,
          model_id,
          model_version,
          knowledge_item_ids,
          created_asset_ids,
          draft_snapshot_id,
          created_at
        from execution_snapshots
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapExecutionSnapshotRow(result.rows[0]) : undefined;
  }

  async listSnapshots(): Promise<ModuleExecutionSnapshotRecord[]> {
    const result = await this.dependencies.client.query<ExecutionSnapshotRow>(
      `
        select
          id,
          manuscript_id,
          module,
          job_id,
          execution_profile_id,
          module_template_id,
          module_template_version_no,
          prompt_template_id,
          prompt_template_version,
          skill_package_ids,
          skill_package_versions,
          model_id,
          model_version,
          knowledge_item_ids,
          created_asset_ids,
          draft_snapshot_id,
          created_at
        from execution_snapshots
        order by created_at asc, id asc
      `,
    );

    return result.rows.map(mapExecutionSnapshotRow);
  }

  async saveKnowledgeHitLog(record: KnowledgeHitLogRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into knowledge_hit_logs (
          id,
          snapshot_id,
          knowledge_item_id,
          match_source_id,
          binding_rule_id,
          match_source,
          match_reasons,
          score,
          section,
          created_at
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7::text[],
          $8,
          $9,
          $10
        )
        on conflict (id) do update
        set
          snapshot_id = excluded.snapshot_id,
          knowledge_item_id = excluded.knowledge_item_id,
          match_source_id = excluded.match_source_id,
          binding_rule_id = excluded.binding_rule_id,
          match_source = excluded.match_source,
          match_reasons = excluded.match_reasons,
          score = excluded.score,
          section = excluded.section,
          created_at = excluded.created_at
      `,
      [
        record.id,
        record.snapshot_id,
        record.knowledge_item_id,
        record.match_source_id ?? null,
        record.binding_rule_id ?? null,
        record.match_source,
        record.match_reasons,
        record.score ?? null,
        record.section ?? null,
        record.created_at,
      ],
    );
  }

  async listKnowledgeHitLogsBySnapshotId(
    snapshotId: string,
  ): Promise<KnowledgeHitLogRecord[]> {
    const result = await this.dependencies.client.query<KnowledgeHitLogRow>(
      `
        select
          id,
          snapshot_id,
          knowledge_item_id,
          match_source_id,
          binding_rule_id,
          match_source,
          match_reasons,
          score,
          section,
          created_at
        from knowledge_hit_logs
        where snapshot_id = $1
        order by created_at asc, id asc
      `,
      [snapshotId],
    );

    return result.rows.map(mapKnowledgeHitLogRow);
  }
}

function mapExecutionSnapshotRow(
  row: ExecutionSnapshotRow,
): ModuleExecutionSnapshotRecord {
  const createdAt =
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : new Date(row.created_at).toISOString();

  return {
    id: row.id,
    manuscript_id: row.manuscript_id,
    module: row.module,
    job_id: row.job_id,
    execution_profile_id: row.execution_profile_id,
    module_template_id: row.module_template_id,
    module_template_version_no: Number(row.module_template_version_no),
    prompt_template_id: row.prompt_template_id,
    prompt_template_version: row.prompt_template_version,
    skill_package_ids: decodeTextArray(row.skill_package_ids),
    skill_package_versions: decodeTextArray(row.skill_package_versions),
    model_id: row.model_id,
    ...(row.model_version ? { model_version: row.model_version } : {}),
    knowledge_item_ids: decodeTextArray(row.knowledge_item_ids),
    created_asset_ids: decodeTextArray(row.created_asset_ids),
    ...(row.draft_snapshot_id ? { draft_snapshot_id: row.draft_snapshot_id } : {}),
    created_at: createdAt,
  };
}

function mapKnowledgeHitLogRow(row: KnowledgeHitLogRow): KnowledgeHitLogRecord {
  const createdAt =
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : new Date(row.created_at).toISOString();

  return {
    id: row.id,
    snapshot_id: row.snapshot_id,
    knowledge_item_id: row.knowledge_item_id,
    ...(row.match_source_id ? { match_source_id: row.match_source_id } : {}),
    ...(row.binding_rule_id ? { binding_rule_id: row.binding_rule_id } : {}),
    match_source: row.match_source,
    match_reasons: decodeTextArray(row.match_reasons),
    ...(row.score != null ? { score: Number(row.score) } : {}),
    ...(row.section ? { section: row.section } : {}),
    created_at: createdAt,
  };
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
