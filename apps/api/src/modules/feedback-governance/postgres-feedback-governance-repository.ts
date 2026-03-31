import type {
  FeedbackGovernanceRepository,
} from "./feedback-governance-repository.ts";
import type {
  HumanFeedbackRecord,
  LearningCandidateSourceLinkRecord,
} from "./feedback-governance-record.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface HumanFeedbackRow {
  id: string;
  manuscript_id: string;
  module: HumanFeedbackRecord["module"];
  snapshot_id: string;
  feedback_type: HumanFeedbackRecord["feedback_type"];
  feedback_text: string | null;
  created_by: string;
  created_at: Date;
}

interface LearningCandidateSourceLinkRow {
  id: string;
  learning_candidate_id: string;
  source_kind: LearningCandidateSourceLinkRecord["source_kind"];
  snapshot_kind: LearningCandidateSourceLinkRecord["snapshot_kind"];
  snapshot_id: string;
  feedback_record_id: string | null;
  evaluation_run_id: string | null;
  evidence_pack_id: string | null;
  source_asset_id: string;
  created_at: Date;
}

export class PostgresFeedbackGovernanceRepository
  implements FeedbackGovernanceRepository
{
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async saveHumanFeedback(record: HumanFeedbackRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into human_feedback_records (
          id,
          manuscript_id,
          module,
          snapshot_id,
          feedback_type,
          feedback_text,
          created_by,
          created_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        on conflict (id) do update
        set
          manuscript_id = excluded.manuscript_id,
          module = excluded.module,
          snapshot_id = excluded.snapshot_id,
          feedback_type = excluded.feedback_type,
          feedback_text = excluded.feedback_text,
          created_by = excluded.created_by,
          created_at = excluded.created_at
      `,
      [
        record.id,
        record.manuscript_id,
        record.module,
        record.snapshot_id,
        record.feedback_type,
        record.feedback_text ?? null,
        record.created_by,
        record.created_at,
      ],
    );
  }

  async findHumanFeedbackById(
    id: string,
  ): Promise<HumanFeedbackRecord | undefined> {
    const result = await this.dependencies.client.query<HumanFeedbackRow>(
      `
        select
          id,
          manuscript_id,
          module,
          snapshot_id,
          feedback_type,
          feedback_text,
          created_by,
          created_at
        from human_feedback_records
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapHumanFeedbackRow(result.rows[0]) : undefined;
  }

  async listHumanFeedbackBySnapshotId(
    snapshotId: string,
  ): Promise<HumanFeedbackRecord[]> {
    const result = await this.dependencies.client.query<HumanFeedbackRow>(
      `
        select
          id,
          manuscript_id,
          module,
          snapshot_id,
          feedback_type,
          feedback_text,
          created_by,
          created_at
        from human_feedback_records
        where snapshot_id = $1
        order by created_at asc, id asc
      `,
      [snapshotId],
    );

    return result.rows.map(mapHumanFeedbackRow);
  }

  async saveLearningCandidateSourceLink(
    record: LearningCandidateSourceLinkRecord,
  ): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into learning_candidate_source_links (
          id,
          learning_candidate_id,
          source_kind,
          snapshot_kind,
          snapshot_id,
          feedback_record_id,
          evaluation_run_id,
          evidence_pack_id,
          source_asset_id,
          created_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        on conflict (id) do update
        set
          learning_candidate_id = excluded.learning_candidate_id,
          source_kind = excluded.source_kind,
          snapshot_kind = excluded.snapshot_kind,
          snapshot_id = excluded.snapshot_id,
          feedback_record_id = excluded.feedback_record_id,
          evaluation_run_id = excluded.evaluation_run_id,
          evidence_pack_id = excluded.evidence_pack_id,
          source_asset_id = excluded.source_asset_id,
          created_at = excluded.created_at
      `,
      [
        record.id,
        record.learning_candidate_id,
        record.source_kind,
        record.snapshot_kind,
        record.snapshot_id,
        record.feedback_record_id ?? null,
        record.evaluation_run_id ?? null,
        record.evidence_pack_id ?? null,
        record.source_asset_id,
        record.created_at,
      ],
    );
  }

  async listLearningCandidateSourceLinksByCandidateId(
    learningCandidateId: string,
  ): Promise<LearningCandidateSourceLinkRecord[]> {
    const result =
      await this.dependencies.client.query<LearningCandidateSourceLinkRow>(
        `
          select
            id,
            learning_candidate_id,
            source_kind,
            snapshot_kind,
            snapshot_id,
            feedback_record_id,
            evaluation_run_id,
            evidence_pack_id,
            source_asset_id,
            created_at
          from learning_candidate_source_links
          where learning_candidate_id = $1
          order by created_at asc, id asc
        `,
        [learningCandidateId],
      );

    return result.rows.map(mapLearningCandidateSourceLinkRow);
  }
}

function mapHumanFeedbackRow(row: HumanFeedbackRow): HumanFeedbackRecord {
  return {
    id: row.id,
    manuscript_id: row.manuscript_id,
    module: row.module,
    snapshot_id: row.snapshot_id,
    feedback_type: row.feedback_type,
    created_by: row.created_by,
    created_at: row.created_at.toISOString(),
    ...(row.feedback_text != null ? { feedback_text: row.feedback_text } : {}),
  };
}

function mapLearningCandidateSourceLinkRow(
  row: LearningCandidateSourceLinkRow,
): LearningCandidateSourceLinkRecord {
  return {
    id: row.id,
    learning_candidate_id: row.learning_candidate_id,
    source_kind: row.source_kind,
    snapshot_kind: row.snapshot_kind,
    snapshot_id: row.snapshot_id,
    source_asset_id: row.source_asset_id,
    created_at: row.created_at.toISOString(),
    ...(row.feedback_record_id != null
      ? { feedback_record_id: row.feedback_record_id }
      : {}),
    ...(row.evaluation_run_id != null
      ? { evaluation_run_id: row.evaluation_run_id }
      : {}),
    ...(row.evidence_pack_id != null
      ? { evidence_pack_id: row.evidence_pack_id }
      : {}),
  };
}
