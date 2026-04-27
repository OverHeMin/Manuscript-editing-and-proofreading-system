import type {
  EditingCompletionGateSummary,
  EditingSlotGovernanceSummary,
  ManuscriptTypeDetectionSummary,
} from "@medical/contracts";
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
  manuscript_type_detection_summary: ManuscriptTypeDetectionSummary | string | null;
  status: ManuscriptRecord["status"];
  created_by: string;
  current_screening_asset_id: string | null;
  current_editing_asset_id: string | null;
  current_proofreading_asset_id: string | null;
  current_template_family_id: string | null;
  current_journal_template_id: string | null;
  editing_slot_governance_summary: EditingSlotGovernanceSummary | string | null;
  editing_completion_gate_summary: EditingCompletionGateSummary | string | null;
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
          manuscript_type_detection_summary,
          status,
          created_by,
          current_screening_asset_id,
          current_editing_asset_id,
          current_proofreading_asset_id,
          current_template_family_id,
          current_journal_template_id,
          editing_slot_governance_summary,
          editing_completion_gate_summary,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        on conflict (id) do update
        set
          title = excluded.title,
          manuscript_type = excluded.manuscript_type,
          manuscript_type_detection_summary = excluded.manuscript_type_detection_summary,
          status = excluded.status,
          created_by = excluded.created_by,
          current_screening_asset_id = excluded.current_screening_asset_id,
          current_editing_asset_id = excluded.current_editing_asset_id,
          current_proofreading_asset_id = excluded.current_proofreading_asset_id,
          current_template_family_id = excluded.current_template_family_id,
          current_journal_template_id = excluded.current_journal_template_id,
          editing_slot_governance_summary = excluded.editing_slot_governance_summary,
          editing_completion_gate_summary = excluded.editing_completion_gate_summary,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `,
      [
        record.id,
        record.title,
        record.manuscript_type,
        record.manuscript_type_detection_summary ?? null,
        record.status,
        record.created_by,
        record.current_screening_asset_id ?? null,
        record.current_editing_asset_id ?? null,
        record.current_proofreading_asset_id ?? null,
        record.current_template_family_id ?? null,
        record.current_journal_template_id ?? null,
        record.editing_slot_governance_summary ?? null,
        record.editing_completion_gate_summary ?? null,
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
          manuscript_type_detection_summary,
          status,
          created_by,
          current_screening_asset_id,
          current_editing_asset_id,
          current_proofreading_asset_id,
          current_template_family_id,
          current_journal_template_id,
          editing_slot_governance_summary,
          editing_completion_gate_summary,
          created_at,
          updated_at
        from manuscripts
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapManuscriptRow(result.rows[0]) : undefined;
  }

  async listRecent(limit = 50): Promise<ManuscriptRecord[]> {
    const boundedLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
    const result = await this.dependencies.client.query<ManuscriptRow>(
      `
        select
          id,
          title,
          manuscript_type,
          manuscript_type_detection_summary,
          status,
          created_by,
          current_screening_asset_id,
          current_editing_asset_id,
          current_proofreading_asset_id,
          current_template_family_id,
          current_journal_template_id,
          editing_slot_governance_summary,
          editing_completion_gate_summary,
          created_at,
          updated_at
        from manuscripts
        where status <> 'archived'
        order by updated_at desc, created_at desc
        limit $1
      `,
      [boundedLimit],
    );

    return result.rows.map(mapManuscriptRow);
  }

  async archive(
    id: string,
    archivedAt: string,
  ): Promise<ManuscriptRecord | undefined> {
    const result = await this.dependencies.client.query<ManuscriptRow>(
      `
        update manuscripts
        set
          status = 'archived',
          updated_at = $2
        where id = $1
        returning
          id,
          title,
          manuscript_type,
          manuscript_type_detection_summary,
          status,
          created_by,
          current_screening_asset_id,
          current_editing_asset_id,
          current_proofreading_asset_id,
          current_template_family_id,
          current_journal_template_id,
          editing_slot_governance_summary,
          editing_completion_gate_summary,
          created_at,
          updated_at
      `,
      [id, archivedAt],
    );

    return result.rows[0] ? mapManuscriptRow(result.rows[0]) : undefined;
  }
}

function mapManuscriptRow(row: ManuscriptRow): ManuscriptRecord {
  return {
    id: row.id,
    title: row.title,
    manuscript_type: row.manuscript_type,
    ...(normalizeDetectionSummary(row.manuscript_type_detection_summary)
      ? {
          manuscript_type_detection_summary: normalizeDetectionSummary(
            row.manuscript_type_detection_summary,
          )!,
        }
      : {}),
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
    ...(row.current_journal_template_id
      ? { current_journal_template_id: row.current_journal_template_id }
      : {}),
    ...(normalizeEditingSlotGovernanceSummary(row.editing_slot_governance_summary)
      ? {
          editing_slot_governance_summary: normalizeEditingSlotGovernanceSummary(
            row.editing_slot_governance_summary,
          )!,
        }
      : {}),
    ...(normalizeEditingCompletionGateSummary(row.editing_completion_gate_summary)
      ? {
          editing_completion_gate_summary: normalizeEditingCompletionGateSummary(
            row.editing_completion_gate_summary,
          )!,
        }
      : {}),
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

function normalizeDetectionSummary(
  value: ManuscriptRow["manuscript_type_detection_summary"],
): ManuscriptTypeDetectionSummary | undefined {
  if (!value) {
    return undefined;
  }

  const parsed =
    typeof value === "string"
      ? (JSON.parse(value) as ManuscriptTypeDetectionSummary)
      : value;

  return {
    ...parsed,
    ...(parsed.matched_signals
      ? { matched_signals: [...parsed.matched_signals] }
      : {}),
  };
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function normalizeEditingSlotGovernanceSummary(
  value: ManuscriptRow["editing_slot_governance_summary"],
): EditingSlotGovernanceSummary | undefined {
  if (!value) {
    return undefined;
  }

  return structuredClone(
    typeof value === "string"
      ? (JSON.parse(value) as EditingSlotGovernanceSummary)
      : value,
  );
}

function normalizeEditingCompletionGateSummary(
  value: ManuscriptRow["editing_completion_gate_summary"],
): EditingCompletionGateSummary | undefined {
  if (!value) {
    return undefined;
  }

  return structuredClone(
    typeof value === "string"
      ? (JSON.parse(value) as EditingCompletionGateSummary)
      : value,
  );
}
