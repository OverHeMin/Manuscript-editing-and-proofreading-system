import type {
  ReviewedCaseSnapshotRepository,
  LearningCandidateRepository,
} from "./learning-repository.ts";
import type {
  LearningCandidateRecord,
  ReviewedCaseSnapshotRecord,
} from "./learning-record.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface LearningCandidateRow {
  id: string;
  type: LearningCandidateRecord["type"];
  status: LearningCandidateRecord["status"];
  module: LearningCandidateRecord["module"];
  manuscript_type: LearningCandidateRecord["manuscript_type"];
  governed_provenance_kind:
    | LearningCandidateRecord["governed_provenance_kind"]
    | null;
  governed_feedback_record_id: string | null;
  governed_evaluation_run_id: string | null;
  governed_evidence_pack_id: string | null;
  human_final_asset_id: string | null;
  annotated_asset_id: string | null;
  snapshot_asset_id: string | null;
  title: string | null;
  proposal_text: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

interface ReviewedCaseSnapshotRow {
  id: string;
  manuscript_id: string;
  module: ReviewedCaseSnapshotRecord["module"];
  manuscript_type: ReviewedCaseSnapshotRecord["manuscript_type"];
  human_final_asset_id: string;
  deidentification_passed: boolean;
  annotated_asset_id: string | null;
  snapshot_asset_id: string;
  created_by: string;
  created_at: Date;
}

export class PostgresReviewedCaseSnapshotRepository
  implements ReviewedCaseSnapshotRepository
{
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async save(record: ReviewedCaseSnapshotRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into reviewed_case_snapshots (
          id,
          manuscript_id,
          module,
          manuscript_type,
          human_final_asset_id,
          deidentification_passed,
          annotated_asset_id,
          snapshot_asset_id,
          created_by,
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
          $10
        )
        on conflict (id) do update
        set
          manuscript_id = excluded.manuscript_id,
          module = excluded.module,
          manuscript_type = excluded.manuscript_type,
          human_final_asset_id = excluded.human_final_asset_id,
          deidentification_passed = excluded.deidentification_passed,
          annotated_asset_id = excluded.annotated_asset_id,
          snapshot_asset_id = excluded.snapshot_asset_id,
          created_by = excluded.created_by,
          created_at = excluded.created_at
      `,
      [
        record.id,
        record.manuscript_id,
        record.module,
        record.manuscript_type,
        record.human_final_asset_id,
        record.deidentification_passed,
        record.annotated_asset_id ?? null,
        record.snapshot_asset_id,
        record.created_by,
        record.created_at,
      ],
    );
  }

  async findById(id: string): Promise<ReviewedCaseSnapshotRecord | undefined> {
    const result = await this.dependencies.client.query<ReviewedCaseSnapshotRow>(
      `
        select
          id,
          manuscript_id,
          module,
          manuscript_type,
          human_final_asset_id,
          deidentification_passed,
          annotated_asset_id,
          snapshot_asset_id,
          created_by,
          created_at
        from reviewed_case_snapshots
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapReviewedCaseSnapshotRow(result.rows[0]) : undefined;
  }
}

export class PostgresLearningCandidateRepository
  implements LearningCandidateRepository
{
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async save(record: LearningCandidateRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into learning_candidates (
          id,
          type,
          status,
          module,
          manuscript_type,
          governed_provenance_kind,
          governed_feedback_record_id,
          governed_evaluation_run_id,
          governed_evidence_pack_id,
          human_final_asset_id,
          annotated_asset_id,
          snapshot_asset_id,
          title,
          proposal_text,
          created_by,
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
          $15,
          $16,
          $17
        )
        on conflict (id) do update
        set
          type = excluded.type,
          status = excluded.status,
          module = excluded.module,
          manuscript_type = excluded.manuscript_type,
          governed_provenance_kind = excluded.governed_provenance_kind,
          governed_feedback_record_id = excluded.governed_feedback_record_id,
          governed_evaluation_run_id = excluded.governed_evaluation_run_id,
          governed_evidence_pack_id = excluded.governed_evidence_pack_id,
          human_final_asset_id = excluded.human_final_asset_id,
          annotated_asset_id = excluded.annotated_asset_id,
          snapshot_asset_id = excluded.snapshot_asset_id,
          title = excluded.title,
          proposal_text = excluded.proposal_text,
          created_by = excluded.created_by,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `,
      [
        record.id,
        record.type,
        record.status,
        record.module,
        record.manuscript_type,
        record.governed_provenance_kind ?? null,
        record.governed_feedback_record_id ?? null,
        record.governed_evaluation_run_id ?? null,
        record.governed_evidence_pack_id ?? null,
        record.human_final_asset_id ?? null,
        record.annotated_asset_id ?? null,
        record.snapshot_asset_id ?? null,
        record.title ?? null,
        record.proposal_text ?? null,
        record.created_by,
        record.created_at,
        record.updated_at,
      ],
    );
  }

  async findById(id: string): Promise<LearningCandidateRecord | undefined> {
    const result = await this.dependencies.client.query<LearningCandidateRow>(
      `
        select
          id,
          type,
          status,
          module,
          manuscript_type,
          governed_provenance_kind,
          governed_feedback_record_id,
          governed_evaluation_run_id,
          governed_evidence_pack_id,
          human_final_asset_id,
          annotated_asset_id,
          snapshot_asset_id,
          title,
          proposal_text,
          created_by,
          created_at,
          updated_at
        from learning_candidates
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapLearningCandidateRow(result.rows[0]) : undefined;
  }

  async list(): Promise<LearningCandidateRecord[]> {
    const result = await this.dependencies.client.query<LearningCandidateRow>(
      `
        select
          id,
          type,
          status,
          module,
          manuscript_type,
          governed_provenance_kind,
          governed_feedback_record_id,
          governed_evaluation_run_id,
          governed_evidence_pack_id,
          human_final_asset_id,
          annotated_asset_id,
          snapshot_asset_id,
          title,
          proposal_text,
          created_by,
          created_at,
          updated_at
        from learning_candidates
        order by updated_at desc, created_at desc, id asc
      `,
    );

    return result.rows.map(mapLearningCandidateRow);
  }

  async listByStatus(
    status: LearningCandidateRecord["status"],
  ): Promise<LearningCandidateRecord[]> {
    const result = await this.dependencies.client.query<LearningCandidateRow>(
      `
        select
          id,
          type,
          status,
          module,
          manuscript_type,
          governed_provenance_kind,
          governed_feedback_record_id,
          governed_evaluation_run_id,
          governed_evidence_pack_id,
          human_final_asset_id,
          annotated_asset_id,
          snapshot_asset_id,
          title,
          proposal_text,
          created_by,
          created_at,
          updated_at
        from learning_candidates
        where status = $1
        order by updated_at desc, created_at desc, id asc
      `,
      [status],
    );

    return result.rows.map(mapLearningCandidateRow);
  }
}

function mapLearningCandidateRow(
  row: LearningCandidateRow,
): LearningCandidateRecord {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    module: row.module,
    manuscript_type: row.manuscript_type,
    created_by: row.created_by,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    ...(row.governed_provenance_kind != null
      ? { governed_provenance_kind: row.governed_provenance_kind }
      : {}),
    ...(row.governed_feedback_record_id != null
      ? { governed_feedback_record_id: row.governed_feedback_record_id }
      : {}),
    ...(row.governed_evaluation_run_id != null
      ? { governed_evaluation_run_id: row.governed_evaluation_run_id }
      : {}),
    ...(row.governed_evidence_pack_id != null
      ? { governed_evidence_pack_id: row.governed_evidence_pack_id }
      : {}),
    ...(row.human_final_asset_id != null
      ? { human_final_asset_id: row.human_final_asset_id }
      : {}),
    ...(row.annotated_asset_id != null
      ? { annotated_asset_id: row.annotated_asset_id }
      : {}),
    ...(row.snapshot_asset_id != null
      ? { snapshot_asset_id: row.snapshot_asset_id }
      : {}),
    ...(row.title != null ? { title: row.title } : {}),
    ...(row.proposal_text != null
      ? { proposal_text: row.proposal_text }
      : {}),
  };
}

function mapReviewedCaseSnapshotRow(
  row: ReviewedCaseSnapshotRow,
): ReviewedCaseSnapshotRecord {
  return {
    id: row.id,
    manuscript_id: row.manuscript_id,
    module: row.module,
    manuscript_type: row.manuscript_type,
    human_final_asset_id: row.human_final_asset_id,
    deidentification_passed: row.deidentification_passed,
    snapshot_asset_id: row.snapshot_asset_id,
    created_by: row.created_by,
    created_at: row.created_at.toISOString(),
    ...(row.annotated_asset_id != null
      ? { annotated_asset_id: row.annotated_asset_id }
      : {}),
  };
}
