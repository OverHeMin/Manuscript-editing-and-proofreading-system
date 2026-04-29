import type {
  ConfirmedAiTablePackage,
  ConfirmedTableSnapshot,
  TableCorrectionPatch,
  TableEvidenceAsset,
  TableEvidenceBinding,
  TableEvidenceBindingTargetType,
  TableEvidenceRevision,
  TableEvidenceSourceFile,
  TableFidelityReport,
  TableSourceSnapshot,
} from "./table-evidence-record.ts";
import type { TableEvidenceRepository } from "./table-evidence-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface TableEvidenceSourceFileRow {
  id: string;
  storage_key: string;
  file_name: string;
  mime_type: string;
  byte_length: number;
  sha256: string;
  uploaded_by: string;
  uploaded_at: Date;
}

interface TableEvidenceAssetRow {
  id: string;
  title: string;
  source_file_asset_id: string;
  source_file_name: string;
  source_kind: TableEvidenceAsset["source_kind"];
  parser: TableEvidenceAsset["parser"];
  parser_version: string;
  active_revision_id: string | null;
  fidelity_status: TableEvidenceAsset["fidelity_status"];
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

interface TableEvidenceRevisionRow {
  id: string;
  table_evidence_asset_id: string;
  revision_no: number;
  source_snapshot: TableSourceSnapshot | string;
  correction_patch: TableCorrectionPatch | string;
  confirmed_snapshot: ConfirmedTableSnapshot | string | null;
  ai_table_package: ConfirmedAiTablePackage | string | null;
  fidelity_report: TableFidelityReport | string;
  confirmation_status: TableEvidenceRevision["confirmation_status"];
  confirmed_by: string | null;
  confirmed_at: Date | null;
  created_at: Date;
}

interface TableEvidenceBindingRow {
  id: string;
  table_evidence_asset_id: string;
  table_evidence_revision_id: string;
  target_type: TableEvidenceBinding["target_type"];
  target_id: string;
  binding_role: TableEvidenceBinding["binding_role"];
  created_at: Date;
}

export class PostgresTableEvidenceRepository implements TableEvidenceRepository {
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async saveSourceFile(record: TableEvidenceSourceFile): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into table_evidence_source_files (
          id,
          storage_key,
          file_name,
          mime_type,
          byte_length,
          sha256,
          uploaded_by,
          uploaded_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz)
        on conflict (id) do update
        set
          storage_key = excluded.storage_key,
          file_name = excluded.file_name,
          mime_type = excluded.mime_type,
          byte_length = excluded.byte_length,
          sha256 = excluded.sha256,
          uploaded_by = excluded.uploaded_by,
          uploaded_at = excluded.uploaded_at
      `,
      [
        record.id,
        record.storage_key,
        record.file_name,
        record.mime_type,
        record.byte_length,
        record.sha256,
        record.uploaded_by,
        record.uploaded_at,
      ],
    );
  }

  async findSourceFileById(id: string): Promise<TableEvidenceSourceFile | undefined> {
    const result = await this.dependencies.client.query<TableEvidenceSourceFileRow>(
      `
        select *
        from table_evidence_source_files
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapSourceFileRow(result.rows[0]) : undefined;
  }

  async saveAsset(record: TableEvidenceAsset): Promise<void> {
    if (record.active_revision_id) {
      await this.assertRevisionBelongsToAsset(record.id, record.active_revision_id);
    }

    await this.dependencies.client.query(
      `
        insert into table_evidence_assets (
          id,
          title,
          source_file_asset_id,
          source_file_name,
          source_kind,
          parser,
          parser_version,
          active_revision_id,
          fidelity_status,
          created_by,
          created_at,
          updated_at
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5::table_evidence_source_kind,
          $6::table_evidence_parser,
          $7,
          $8,
          $9::table_evidence_fidelity_status,
          $10,
          $11::timestamptz,
          $12::timestamptz
        )
        on conflict (id) do update
        set
          title = excluded.title,
          source_file_asset_id = excluded.source_file_asset_id,
          source_file_name = excluded.source_file_name,
          source_kind = excluded.source_kind,
          parser = excluded.parser,
          parser_version = excluded.parser_version,
          active_revision_id = excluded.active_revision_id,
          fidelity_status = excluded.fidelity_status,
          created_by = excluded.created_by,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `,
      [
        record.id,
        record.title,
        record.source_file_asset_id,
        record.source_file_name,
        record.source_kind,
        record.parser,
        record.parser_version,
        record.active_revision_id ?? null,
        record.fidelity_status,
        record.created_by,
        record.created_at,
        record.updated_at,
      ],
    );
  }

  async findAssetById(id: string): Promise<TableEvidenceAsset | undefined> {
    const result = await this.dependencies.client.query<TableEvidenceAssetRow>(
      `
        select *
        from table_evidence_assets
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapAssetRow(result.rows[0]) : undefined;
  }

  async searchAssets(input: {
    search?: string;
    status?: TableEvidenceAsset["fidelity_status"];
    limit: number;
  }): Promise<TableEvidenceAsset[]> {
    const result = await this.dependencies.client.query<TableEvidenceAssetRow>(
      `
        select *
        from table_evidence_assets
        where ($1::text is null or title ilike '%' || $1 || '%' or source_file_name ilike '%' || $1 || '%')
          and ($2::table_evidence_fidelity_status is null or fidelity_status = $2)
        order by updated_at desc, id asc
        limit $3
      `,
      [input.search ?? null, input.status ?? null, input.limit],
    );

    return result.rows.map(mapAssetRow);
  }

  async saveRevision(record: TableEvidenceRevision): Promise<void> {
    const existing = await this.dependencies.client.query<{
      table_evidence_asset_id: string;
    }>(
      `
        select table_evidence_asset_id
        from table_evidence_revisions
        where id = $1
      `,
      [record.id],
    );

    if (
      existing.rows[0] &&
      existing.rows[0].table_evidence_asset_id !== record.table_evidence_asset_id
    ) {
      throw new Error(
        `Table evidence revision asset membership is immutable: revision ${record.id} belongs to asset ${existing.rows[0].table_evidence_asset_id}, not ${record.table_evidence_asset_id}.`,
      );
    }
    if (existing.rows[0]) {
      throw new Error(
        `Table evidence revision id is append-only: revision ${record.id} already exists.`,
      );
    }

    const result = await this.dependencies.client.query(
      `
        insert into table_evidence_revisions (
          id,
          table_evidence_asset_id,
          revision_no,
          source_snapshot,
          correction_patch,
          confirmed_snapshot,
          ai_table_package,
          fidelity_report,
          confirmation_status,
          confirmed_by,
          confirmed_at,
          created_at
        )
        values (
          $1,
          $2,
          $3,
          $4::jsonb,
          $5::jsonb,
          $6::jsonb,
          $7::jsonb,
          $8::jsonb,
          $9::table_evidence_confirmation_status,
          $10,
          $11::timestamptz,
          $12::timestamptz
        )
        on conflict (id) do nothing
      `,
      [
        record.id,
        record.table_evidence_asset_id,
        record.revision_no,
        JSON.stringify(record.source_snapshot),
        JSON.stringify(record.correction_patch),
        record.confirmed_snapshot ? JSON.stringify(record.confirmed_snapshot) : null,
        record.ai_table_package ? JSON.stringify(record.ai_table_package) : null,
        JSON.stringify(record.fidelity_report),
        record.confirmation_status,
        record.confirmed_by ?? null,
        record.confirmed_at ?? null,
        record.created_at,
      ],
    );

    if (result.rowCount === 0) {
      throw new Error(
        `Table evidence revision id is append-only: revision ${record.id} already exists.`,
      );
    }
  }

  async findRevisionById(id: string): Promise<TableEvidenceRevision | undefined> {
    const result = await this.dependencies.client.query<TableEvidenceRevisionRow>(
      `
        select *
        from table_evidence_revisions
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapRevisionRow(result.rows[0]) : undefined;
  }

  async listRevisionsForAsset(assetId: string): Promise<TableEvidenceRevision[]> {
    const result = await this.dependencies.client.query<TableEvidenceRevisionRow>(
      `
        select *
        from table_evidence_revisions
        where table_evidence_asset_id = $1
        order by created_at desc, id asc
      `,
      [assetId],
    );

    return result.rows.map(mapRevisionRow);
  }

  async setActiveRevision(
    assetId: string,
    revisionId: string,
    fidelityStatus: TableEvidenceAsset["fidelity_status"],
  ): Promise<void> {
    await this.assertRevisionBelongsToAsset(assetId, revisionId);

    await this.dependencies.client.query(
      `
        update table_evidence_assets
        set
          active_revision_id = $2,
          fidelity_status = $3::table_evidence_fidelity_status,
          updated_at = now()
        where id = $1
      `,
      [assetId, revisionId, fidelityStatus],
    );
  }

  async saveBinding(record: TableEvidenceBinding): Promise<void> {
    await this.assertRevisionBelongsToAsset(
      record.table_evidence_asset_id,
      record.table_evidence_revision_id,
    );

    await this.dependencies.client.query(
      `
        insert into table_evidence_bindings (
          id,
          table_evidence_asset_id,
          table_evidence_revision_id,
          target_type,
          target_id,
          binding_role,
          created_at
        )
        values (
          $1,
          $2,
          $3,
          $4::table_evidence_binding_target_type,
          $5,
          $6::table_evidence_binding_role,
          $7::timestamptz
        )
        on conflict (id) do update
        set
          table_evidence_asset_id = excluded.table_evidence_asset_id,
          table_evidence_revision_id = excluded.table_evidence_revision_id,
          target_type = excluded.target_type,
          target_id = excluded.target_id,
          binding_role = excluded.binding_role,
          created_at = excluded.created_at
      `,
      [
        record.id,
        record.table_evidence_asset_id,
        record.table_evidence_revision_id,
        record.target_type,
        record.target_id,
        record.binding_role,
        record.created_at,
      ],
    );
  }

  async listBindingsForTarget(
    targetType: TableEvidenceBindingTargetType,
    targetId: string,
  ): Promise<TableEvidenceBinding[]> {
    const result = await this.dependencies.client.query<TableEvidenceBindingRow>(
      `
        select *
        from table_evidence_bindings
        where target_type = $1::table_evidence_binding_target_type
          and target_id = $2
        order by created_at desc, id asc
      `,
      [targetType, targetId],
    );

    return result.rows.map(mapBindingRow);
  }

  async listBindingsForRevision(revisionId: string): Promise<TableEvidenceBinding[]> {
    const result = await this.dependencies.client.query<TableEvidenceBindingRow>(
      `
        select *
        from table_evidence_bindings
        where table_evidence_revision_id = $1
        order by created_at desc, id asc
      `,
      [revisionId],
    );

    return result.rows.map(mapBindingRow);
  }

  private async assertRevisionBelongsToAsset(
    assetId: string,
    revisionId: string,
  ): Promise<void> {
    const result = await this.dependencies.client.query(
      `
        select 1
        from table_evidence_revisions
        where id = $1
          and table_evidence_asset_id = $2
      `,
      [revisionId, assetId],
    );

    if (result.rowCount !== 1) {
      throw new Error(
        `Table evidence revision asset mismatch: revision ${revisionId} does not belong to asset ${assetId}.`,
      );
    }
  }
}

function mapSourceFileRow(row: TableEvidenceSourceFileRow): TableEvidenceSourceFile {
  return {
    id: row.id,
    storage_key: row.storage_key,
    file_name: row.file_name,
    mime_type: row.mime_type,
    byte_length: row.byte_length,
    sha256: row.sha256,
    uploaded_by: row.uploaded_by,
    uploaded_at: row.uploaded_at.toISOString(),
  };
}

function mapAssetRow(row: TableEvidenceAssetRow): TableEvidenceAsset {
  return {
    id: row.id,
    title: row.title,
    source_file_asset_id: row.source_file_asset_id,
    source_file_name: row.source_file_name,
    source_kind: row.source_kind,
    parser: row.parser,
    parser_version: row.parser_version,
    ...(row.active_revision_id ? { active_revision_id: row.active_revision_id } : {}),
    fidelity_status: row.fidelity_status,
    created_by: row.created_by,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function mapRevisionRow(row: TableEvidenceRevisionRow): TableEvidenceRevision {
  return {
    id: row.id,
    table_evidence_asset_id: row.table_evidence_asset_id,
    revision_no: row.revision_no,
    source_snapshot: parseJsonValue<TableSourceSnapshot>(row.source_snapshot),
    correction_patch: parseJsonValue<TableCorrectionPatch>(row.correction_patch),
    ...(row.confirmed_snapshot
      ? { confirmed_snapshot: parseJsonValue<ConfirmedTableSnapshot>(row.confirmed_snapshot) }
      : {}),
    ...(row.ai_table_package
      ? { ai_table_package: parseJsonValue<ConfirmedAiTablePackage>(row.ai_table_package) }
      : {}),
    fidelity_report: parseJsonValue<TableFidelityReport>(row.fidelity_report),
    confirmation_status: row.confirmation_status,
    ...(row.confirmed_by ? { confirmed_by: row.confirmed_by } : {}),
    ...(row.confirmed_at ? { confirmed_at: row.confirmed_at.toISOString() } : {}),
    created_at: row.created_at.toISOString(),
  };
}

function mapBindingRow(row: TableEvidenceBindingRow): TableEvidenceBinding {
  return {
    id: row.id,
    table_evidence_asset_id: row.table_evidence_asset_id,
    table_evidence_revision_id: row.table_evidence_revision_id,
    target_type: row.target_type,
    target_id: row.target_id,
    binding_role: row.binding_role,
    created_at: row.created_at.toISOString(),
  };
}

function parseJsonValue<T>(value: T | string): T {
  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }

  return value;
}
