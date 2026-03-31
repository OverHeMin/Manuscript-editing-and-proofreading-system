import type {
  DocumentAssetRecord,
  DocumentAssetType,
} from "./document-asset-record.ts";
import type { DocumentAssetRepository } from "./document-asset-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface DocumentAssetRow {
  id: string;
  manuscript_id: string;
  asset_type: DocumentAssetRecord["asset_type"];
  status: DocumentAssetRecord["status"];
  storage_key: string;
  mime_type: string;
  parent_asset_id: string | null;
  source_module: DocumentAssetRecord["source_module"];
  source_job_id: string | null;
  created_by: string;
  version_no: number;
  is_current: boolean;
  file_name: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface NextVersionRow {
  next_version_no: number | string;
}

export class PostgresDocumentAssetRepository implements DocumentAssetRepository {
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async save(record: DocumentAssetRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into document_assets (
          id,
          manuscript_id,
          asset_type,
          status,
          storage_key,
          mime_type,
          parent_asset_id,
          source_module,
          source_job_id,
          created_by,
          version_no,
          is_current,
          file_name,
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
          $15
        )
        on conflict (id) do update
        set
          manuscript_id = excluded.manuscript_id,
          asset_type = excluded.asset_type,
          status = excluded.status,
          storage_key = excluded.storage_key,
          mime_type = excluded.mime_type,
          parent_asset_id = excluded.parent_asset_id,
          source_module = excluded.source_module,
          source_job_id = excluded.source_job_id,
          created_by = excluded.created_by,
          version_no = excluded.version_no,
          is_current = excluded.is_current,
          file_name = excluded.file_name,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `,
      [
        record.id,
        record.manuscript_id,
        record.asset_type,
        record.status,
        record.storage_key,
        record.mime_type,
        record.parent_asset_id ?? null,
        record.source_module,
        record.source_job_id ?? null,
        record.created_by,
        record.version_no,
        record.is_current,
        record.file_name ?? null,
        record.created_at,
        record.updated_at,
      ],
    );
  }

  async findById(id: string): Promise<DocumentAssetRecord | undefined> {
    const result = await this.dependencies.client.query<DocumentAssetRow>(
      `
        select
          id,
          manuscript_id,
          asset_type,
          status,
          storage_key,
          mime_type,
          parent_asset_id,
          source_module,
          source_job_id,
          created_by,
          version_no,
          is_current,
          file_name,
          created_at,
          updated_at
        from document_assets
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapDocumentAssetRow(result.rows[0]) : undefined;
  }

  async listByManuscriptId(manuscriptId: string): Promise<DocumentAssetRecord[]> {
    const result = await this.dependencies.client.query<DocumentAssetRow>(
      `
        select
          id,
          manuscript_id,
          asset_type,
          status,
          storage_key,
          mime_type,
          parent_asset_id,
          source_module,
          source_job_id,
          created_by,
          version_no,
          is_current,
          file_name,
          created_at,
          updated_at
        from document_assets
        where manuscript_id = $1
        order by created_at asc, asset_type asc, version_no asc, id asc
      `,
      [manuscriptId],
    );

    return result.rows.map(mapDocumentAssetRow);
  }

  async listByManuscriptIdAndType(
    manuscriptId: string,
    assetType: DocumentAssetType,
  ): Promise<DocumentAssetRecord[]> {
    const result = await this.dependencies.client.query<DocumentAssetRow>(
      `
        select
          id,
          manuscript_id,
          asset_type,
          status,
          storage_key,
          mime_type,
          parent_asset_id,
          source_module,
          source_job_id,
          created_by,
          version_no,
          is_current,
          file_name,
          created_at,
          updated_at
        from document_assets
        where manuscript_id = $1 and asset_type = $2
        order by created_at asc, asset_type asc, version_no asc, id asc
      `,
      [manuscriptId, assetType],
    );

    return result.rows.map(mapDocumentAssetRow);
  }

  async reserveNextVersionNumber(
    manuscriptId: string,
    assetType: DocumentAssetType,
  ): Promise<number> {
    const result = await this.dependencies.client.query<NextVersionRow>(
      `
        select coalesce(max(version_no), 0) + 1 as next_version_no
        from document_assets
        where manuscript_id = $1 and asset_type = $2
      `,
      [manuscriptId, assetType],
    );

    return Number(result.rows[0]?.next_version_no ?? 1);
  }
}

function mapDocumentAssetRow(row: DocumentAssetRow): DocumentAssetRecord {
  return {
    id: row.id,
    manuscript_id: row.manuscript_id,
    asset_type: row.asset_type,
    status: row.status,
    storage_key: row.storage_key,
    mime_type: row.mime_type,
    ...(row.parent_asset_id ? { parent_asset_id: row.parent_asset_id } : {}),
    source_module: row.source_module,
    ...(row.source_job_id ? { source_job_id: row.source_job_id } : {}),
    created_by: row.created_by,
    version_no: Number(row.version_no),
    is_current: row.is_current,
    ...(row.file_name ? { file_name: row.file_name } : {}),
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
