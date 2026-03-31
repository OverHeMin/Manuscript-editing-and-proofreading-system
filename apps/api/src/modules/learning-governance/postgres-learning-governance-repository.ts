import type {
  LearningGovernanceRepository,
} from "./learning-governance-repository.ts";
import type {
  LearningWritebackRecord,
} from "./learning-governance-record.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface LearningWritebackRow {
  id: string;
  learning_candidate_id: string;
  target_type: LearningWritebackRecord["target_type"];
  status: LearningWritebackRecord["status"];
  created_draft_asset_id: string | null;
  created_by: string;
  created_at: Date;
  applied_by: string | null;
  applied_at: Date | null;
}

export class PostgresLearningGovernanceRepository
  implements LearningGovernanceRepository
{
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async save(record: LearningWritebackRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into learning_writebacks (
          id,
          learning_candidate_id,
          target_type,
          status,
          created_draft_asset_id,
          created_by,
          created_at,
          applied_by,
          applied_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        on conflict (id) do update
        set
          learning_candidate_id = excluded.learning_candidate_id,
          target_type = excluded.target_type,
          status = excluded.status,
          created_draft_asset_id = excluded.created_draft_asset_id,
          created_by = excluded.created_by,
          created_at = excluded.created_at,
          applied_by = excluded.applied_by,
          applied_at = excluded.applied_at
      `,
      [
        record.id,
        record.learning_candidate_id,
        record.target_type,
        record.status,
        record.created_draft_asset_id ?? null,
        record.created_by,
        record.created_at,
        record.applied_by ?? null,
        record.applied_at ?? null,
      ],
    );
  }

  async findById(id: string): Promise<LearningWritebackRecord | undefined> {
    const result = await this.dependencies.client.query<LearningWritebackRow>(
      `
        select
          id,
          learning_candidate_id,
          target_type,
          status,
          created_draft_asset_id,
          created_by,
          created_at,
          applied_by,
          applied_at
        from learning_writebacks
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapLearningWritebackRow(result.rows[0]) : undefined;
  }

  async list(): Promise<LearningWritebackRecord[]> {
    const result = await this.dependencies.client.query<LearningWritebackRow>(
      `
        select
          id,
          learning_candidate_id,
          target_type,
          status,
          created_draft_asset_id,
          created_by,
          created_at,
          applied_by,
          applied_at
        from learning_writebacks
        order by created_at asc, id asc
      `,
    );

    return result.rows.map(mapLearningWritebackRow);
  }

  async listByCandidateId(
    learningCandidateId: string,
  ): Promise<LearningWritebackRecord[]> {
    const result = await this.dependencies.client.query<LearningWritebackRow>(
      `
        select
          id,
          learning_candidate_id,
          target_type,
          status,
          created_draft_asset_id,
          created_by,
          created_at,
          applied_by,
          applied_at
        from learning_writebacks
        where learning_candidate_id = $1
        order by created_at asc, id asc
      `,
      [learningCandidateId],
    );

    return result.rows.map(mapLearningWritebackRow);
  }
}

function mapLearningWritebackRow(
  row: LearningWritebackRow,
): LearningWritebackRecord {
  return {
    id: row.id,
    learning_candidate_id: row.learning_candidate_id,
    target_type: row.target_type,
    status: row.status,
    created_by: row.created_by,
    created_at: row.created_at.toISOString(),
    ...(row.created_draft_asset_id != null
      ? { created_draft_asset_id: row.created_draft_asset_id }
      : {}),
    ...(row.applied_by != null ? { applied_by: row.applied_by } : {}),
    ...(row.applied_at != null
      ? { applied_at: row.applied_at.toISOString() }
      : {}),
  };
}
