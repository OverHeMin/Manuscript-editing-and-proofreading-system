import type { ManuscriptRecord } from "./manuscript-record.ts";
import type { ManuscriptRepository } from "./manuscript-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface ManuscriptRow {
  id: string;
  title: string;
  manuscript_type: ManuscriptRecord["manuscript_type"];
  status: ManuscriptRecord["status"];
  created_by: string;
  current_screening_asset_id: string | null;
  current_editing_asset_id: string | null;
  current_proofreading_asset_id: string | null;
  current_template_family_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export class PostgresManuscriptRepository implements ManuscriptRepository {
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async save(record: ManuscriptRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into manuscripts (
          id,
          title,
          manuscript_type,
          status,
          created_by,
          current_screening_asset_id,
          current_editing_asset_id,
          current_proofreading_asset_id,
          current_template_family_id,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        on conflict (id) do update
        set
          title = excluded.title,
          manuscript_type = excluded.manuscript_type,
          status = excluded.status,
          created_by = excluded.created_by,
          current_screening_asset_id = excluded.current_screening_asset_id,
          current_editing_asset_id = excluded.current_editing_asset_id,
          current_proofreading_asset_id = excluded.current_proofreading_asset_id,
          current_template_family_id = excluded.current_template_family_id,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `,
      [
        record.id,
        record.title,
        record.manuscript_type,
        record.status,
        record.created_by,
        record.current_screening_asset_id ?? null,
        record.current_editing_asset_id ?? null,
        record.current_proofreading_asset_id ?? null,
        record.current_template_family_id ?? null,
        record.created_at,
        record.updated_at,
      ],
    );
  }

  async findById(id: string): Promise<ManuscriptRecord | undefined> {
    const result = await this.dependencies.client.query<ManuscriptRow>(
      `
        select
          id,
          title,
          manuscript_type,
          status,
          created_by,
          current_screening_asset_id,
          current_editing_asset_id,
          current_proofreading_asset_id,
          current_template_family_id,
          created_at,
          updated_at
        from manuscripts
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapManuscriptRow(result.rows[0]) : undefined;
  }
}

function mapManuscriptRow(row: ManuscriptRow): ManuscriptRecord {
  return {
    id: row.id,
    title: row.title,
    manuscript_type: row.manuscript_type,
    status: row.status,
    created_by: row.created_by,
    ...(row.current_screening_asset_id
      ? { current_screening_asset_id: row.current_screening_asset_id }
      : {}),
    ...(row.current_editing_asset_id
      ? { current_editing_asset_id: row.current_editing_asset_id }
      : {}),
    ...(row.current_proofreading_asset_id
      ? { current_proofreading_asset_id: row.current_proofreading_asset_id }
      : {}),
    ...(row.current_template_family_id
      ? { current_template_family_id: row.current_template_family_id }
      : {}),
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
