import type { GovernedHitReviewItemRecord } from "./review-item-record.ts";
import type { ReviewItemsRepository } from "./review-items-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface GovernedHitRow {
  id: string;
  source_status: GovernedHitReviewItemRecord["source_status"];
  review_status: GovernedHitReviewItemRecord["review_status"];
  module: GovernedHitReviewItemRecord["module"];
  manuscript_id: string | null;
  manuscript_type: GovernedHitReviewItemRecord["manuscript_type"];
  snapshot_id: string;
  source_asset_id: string | null;
  title: string;
  summary: string | null;
  excerpt: string | null;
  location: Record<string, unknown> | null;
  risk_level: GovernedHitReviewItemRecord["risk_level"] | null;
  suggestion: string | null;
  rationale: string | null;
  candidate_posture: GovernedHitReviewItemRecord["candidate_posture"] | null;
  decision_source: GovernedHitReviewItemRecord["decision_source"] | null;
  related_rule_ids: string[] | null;
  related_knowledge_item_ids: string[] | null;
  feedback_category: GovernedHitReviewItemRecord["feedback_category"];
  feedback_record_id: string | null;
  recommended_route: GovernedHitReviewItemRecord["recommended_route"];
  learning_candidate_id: string | null;
  origin_payload: Record<string, unknown> | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export class PostgresReviewItemsRepository implements ReviewItemsRepository {
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async saveGovernedHit(record: GovernedHitReviewItemRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into governed_hit_review_items (
          id,
          source_status,
          review_status,
          module,
          manuscript_id,
          manuscript_type,
          snapshot_id,
          source_asset_id,
          title,
          summary,
          excerpt,
          location,
          risk_level,
          suggestion,
          rationale,
          candidate_posture,
          decision_source,
          related_rule_ids,
          related_knowledge_item_ids,
          feedback_category,
          feedback_record_id,
          recommended_route,
          learning_candidate_id,
          origin_payload,
          created_by,
          created_at,
          updated_at
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27
        )
        on conflict (id) do update
        set
          source_status = excluded.source_status,
          review_status = excluded.review_status,
          module = excluded.module,
          manuscript_id = excluded.manuscript_id,
          manuscript_type = excluded.manuscript_type,
          snapshot_id = excluded.snapshot_id,
          source_asset_id = excluded.source_asset_id,
          title = excluded.title,
          summary = excluded.summary,
          excerpt = excluded.excerpt,
          location = excluded.location,
          risk_level = excluded.risk_level,
          suggestion = excluded.suggestion,
          rationale = excluded.rationale,
          candidate_posture = excluded.candidate_posture,
          decision_source = excluded.decision_source,
          related_rule_ids = excluded.related_rule_ids,
          related_knowledge_item_ids = excluded.related_knowledge_item_ids,
          feedback_category = excluded.feedback_category,
          feedback_record_id = excluded.feedback_record_id,
          recommended_route = excluded.recommended_route,
          learning_candidate_id = excluded.learning_candidate_id,
          origin_payload = excluded.origin_payload,
          created_by = excluded.created_by,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `,
      [
        record.id,
        record.source_status,
        record.review_status,
        record.module,
        record.manuscript_id ?? null,
        record.manuscript_type,
        record.snapshot_id,
        record.source_asset_id ?? null,
        record.title,
        record.summary ?? null,
        record.excerpt ?? null,
        record.location ?? {},
        record.risk_level ?? null,
        record.suggestion ?? null,
        record.rationale ?? null,
        record.candidate_posture ?? null,
        record.decision_source ?? null,
        record.related_rule_ids ?? [],
        record.related_knowledge_item_ids ?? [],
        record.feedback_category,
        record.feedback_record_id ?? null,
        record.recommended_route,
        record.learning_candidate_id ?? null,
        record.origin_payload ?? {},
        record.created_by,
        record.created_at,
        record.updated_at,
      ],
    );
  }

  async findGovernedHitById(
    id: string,
  ): Promise<GovernedHitReviewItemRecord | undefined> {
    const result = await this.dependencies.client.query<GovernedHitRow>(
      `
        select
          id,
          source_status,
          review_status,
          module,
          manuscript_id,
          manuscript_type,
          snapshot_id,
          source_asset_id,
          title,
          summary,
          excerpt,
          location,
          risk_level,
          suggestion,
          rationale,
          candidate_posture,
          decision_source,
          related_rule_ids,
          related_knowledge_item_ids,
          feedback_category,
          feedback_record_id,
          recommended_route,
          learning_candidate_id,
          origin_payload,
          created_by,
          created_at,
          updated_at
        from governed_hit_review_items
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapGovernedHitRow(result.rows[0]) : undefined;
  }

  async listGovernedHits(): Promise<GovernedHitReviewItemRecord[]> {
    const result = await this.dependencies.client.query<GovernedHitRow>(
      `
        select
          id,
          source_status,
          review_status,
          module,
          manuscript_id,
          manuscript_type,
          snapshot_id,
          source_asset_id,
          title,
          summary,
          excerpt,
          location,
          risk_level,
          suggestion,
          rationale,
          candidate_posture,
          decision_source,
          related_rule_ids,
          related_knowledge_item_ids,
          feedback_category,
          feedback_record_id,
          recommended_route,
          learning_candidate_id,
          origin_payload,
          created_by,
          created_at,
          updated_at
        from governed_hit_review_items
        order by updated_at desc, created_at desc, id asc
      `,
    );

    return result.rows.map(mapGovernedHitRow);
  }
}

function mapGovernedHitRow(row: GovernedHitRow): GovernedHitReviewItemRecord {
  return {
    id: row.id,
    source_kind: "governed_hit",
    source_status: row.source_status,
    review_status: row.review_status,
    module: row.module,
    manuscript_type: row.manuscript_type,
    snapshot_id: row.snapshot_id,
    title: row.title,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    available_actions: [],
    feedback_category: row.feedback_category,
    ...(row.feedback_record_id != null
      ? { feedback_record_id: row.feedback_record_id }
      : {}),
    recommended_route: row.recommended_route,
    harness_validation_status: "not_required",
    created_by: row.created_by,
    ...(row.manuscript_id != null ? { manuscript_id: row.manuscript_id } : {}),
    ...(row.source_asset_id != null ? { source_asset_id: row.source_asset_id } : {}),
    ...(row.summary != null ? { summary: row.summary } : {}),
    ...(row.excerpt != null ? { excerpt: row.excerpt } : {}),
    ...(row.location && Object.keys(row.location).length > 0
      ? { location: row.location }
      : {}),
    ...(row.risk_level != null ? { risk_level: row.risk_level } : {}),
    ...(row.suggestion != null ? { suggestion: row.suggestion } : {}),
    ...(row.rationale != null ? { rationale: row.rationale } : {}),
    ...(row.candidate_posture != null
      ? { candidate_posture: row.candidate_posture }
      : {}),
    ...(row.decision_source != null ? { decision_source: row.decision_source } : {}),
    ...(row.related_rule_ids != null ? { related_rule_ids: row.related_rule_ids } : {}),
    ...(row.related_knowledge_item_ids != null
      ? { related_knowledge_item_ids: row.related_knowledge_item_ids }
      : {}),
    ...(row.learning_candidate_id != null
      ? { learning_candidate_id: row.learning_candidate_id }
      : {}),
    ...(row.origin_payload && Object.keys(row.origin_payload).length > 0
      ? { origin_payload: row.origin_payload }
      : {}),
  };
}
