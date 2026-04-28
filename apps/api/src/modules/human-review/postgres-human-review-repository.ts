import type {
  HumanReviewBackflowAttemptRecord,
  HumanReviewDiffRecord,
  ListHumanReviewDiffItemsFilter,
} from "./human-review-record.ts";
import type {
  HumanReviewDiffItemPatch,
  HumanReviewRepository,
} from "./human-review-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface HumanReviewDiffRow {
  id: string;
  module: HumanReviewDiffRecord["module"];
  manuscript_id: string;
  baseline_asset_id: string;
  working_asset_id: string;
  final_asset_id: string | null;
  source: HumanReviewDiffRecord["source"];
  content_decision: HumanReviewDiffRecord["content_decision"];
  governance_intents: HumanReviewDiffRecord["governance_intents"] | string;
  apply_capability: HumanReviewDiffRecord["apply_capability"];
  complexity_flags:
    | NonNullable<HumanReviewDiffRecord["complexity_flags"]>
    | string
    | null;
  status: HumanReviewDiffRecord["status"];
  before_text: string | null;
  after_text: string | null;
  summary: string | null;
  location: HumanReviewDiffRecord["location"] | string | null;
  note: string | null;
  extraction_revision: number | null;
  backflow_error: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface HumanReviewBackflowAttemptRow {
  id: string;
  diff_item_id: string;
  target: HumanReviewBackflowAttemptRecord["target"];
  status: HumanReviewBackflowAttemptRecord["status"];
  learning_candidate_id: string | null;
  error_message: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const DIFF_ITEM_COLUMNS = `
  id,
  module,
  manuscript_id,
  baseline_asset_id,
  working_asset_id,
  final_asset_id,
  source,
  content_decision,
  governance_intents,
  apply_capability,
  complexity_flags,
  status,
  before_text,
  after_text,
  summary,
  location,
  note,
  extraction_revision,
  backflow_error,
  created_at,
  updated_at
`;

const BACKFLOW_ATTEMPT_COLUMNS = `
  id,
  diff_item_id,
  target,
  status,
  learning_candidate_id,
  error_message,
  created_at,
  updated_at
`;

export class PostgresHumanReviewRepository implements HumanReviewRepository {
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async saveDiffItem(record: HumanReviewDiffRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into human_review_diff_items (
          id,
          module,
          manuscript_id,
          baseline_asset_id,
          working_asset_id,
          final_asset_id,
          source,
          content_decision,
          governance_intents,
          apply_capability,
          complexity_flags,
          status,
          before_text,
          after_text,
          summary,
          location,
          note,
          extraction_revision,
          backflow_error,
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
          $9::jsonb,
          $10,
          $11::jsonb,
          $12,
          $13,
          $14,
          $15,
          $16::jsonb,
          $17,
          $18,
          $19,
          $20,
          $21
        )
        on conflict (id) do update
        set
          module = excluded.module,
          manuscript_id = excluded.manuscript_id,
          baseline_asset_id = excluded.baseline_asset_id,
          working_asset_id = excluded.working_asset_id,
          final_asset_id = excluded.final_asset_id,
          source = excluded.source,
          content_decision = excluded.content_decision,
          governance_intents = excluded.governance_intents,
          apply_capability = excluded.apply_capability,
          complexity_flags = excluded.complexity_flags,
          status = excluded.status,
          before_text = excluded.before_text,
          after_text = excluded.after_text,
          summary = excluded.summary,
          location = excluded.location,
          note = excluded.note,
          extraction_revision = excluded.extraction_revision,
          backflow_error = excluded.backflow_error,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `,
      [
        record.id,
        record.module,
        record.manuscript_id,
        record.baseline_asset_id,
        record.working_asset_id,
        record.final_asset_id ?? null,
        record.source,
        record.content_decision,
        JSON.stringify(record.governance_intents),
        record.apply_capability,
        JSON.stringify(record.complexity_flags ?? []),
        record.status,
        record.before_text ?? null,
        record.after_text ?? null,
        record.summary ?? null,
        record.location ? JSON.stringify(record.location) : null,
        record.note ?? null,
        record.extraction_revision ?? null,
        record.backflow_error ?? null,
        record.created_at,
        record.updated_at,
      ],
    );
  }

  async saveDiffItems(records: readonly HumanReviewDiffRecord[]): Promise<void> {
    for (const record of records) {
      await this.saveDiffItem(record);
    }
  }

  async findDiffItemById(
    id: string,
  ): Promise<HumanReviewDiffRecord | undefined> {
    const result = await this.dependencies.client.query<HumanReviewDiffRow>(
      `
        select ${DIFF_ITEM_COLUMNS}
        from human_review_diff_items
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapDiffRow(result.rows[0]) : undefined;
  }

  async listDiffItems(
    filter?: ListHumanReviewDiffItemsFilter,
  ): Promise<HumanReviewDiffRecord[]> {
    const { clause, values } = buildDiffFilter(filter);
    const result = await this.dependencies.client.query<HumanReviewDiffRow>(
      `
        select ${DIFF_ITEM_COLUMNS}
        from human_review_diff_items
        ${clause}
        order by created_at asc, id asc
      `,
      values,
    );

    return result.rows.map(mapDiffRow);
  }

  async updateDiffItem(
    id: string,
    patch: HumanReviewDiffItemPatch,
  ): Promise<HumanReviewDiffRecord | undefined> {
    const current = await this.findDiffItemById(id);
    if (!current) {
      return undefined;
    }

    const updated = { ...current, ...patch };
    await this.saveDiffItem(updated);
    return updated;
  }

  async saveBackflowAttempt(
    record: HumanReviewBackflowAttemptRecord,
  ): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into human_review_backflow_attempts (
          id,
          diff_item_id,
          target,
          status,
          learning_candidate_id,
          error_message,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        on conflict (diff_item_id, target) do update
        set
          id = excluded.id,
          status = excluded.status,
          learning_candidate_id = excluded.learning_candidate_id,
          error_message = excluded.error_message,
          created_at = human_review_backflow_attempts.created_at,
          updated_at = excluded.updated_at
      `,
      [
        record.id,
        record.diff_item_id,
        record.target,
        record.status,
        record.learning_candidate_id ?? null,
        record.error_message ?? null,
        record.created_at,
        record.updated_at,
      ],
    );
  }

  async findBackflowAttemptById(
    id: string,
  ): Promise<HumanReviewBackflowAttemptRecord | undefined> {
    const result =
      await this.dependencies.client.query<HumanReviewBackflowAttemptRow>(
        `
          select ${BACKFLOW_ATTEMPT_COLUMNS}
          from human_review_backflow_attempts
          where id = $1
        `,
        [id],
      );

    return result.rows[0] ? mapBackflowAttemptRow(result.rows[0]) : undefined;
  }

  async listBackflowAttemptsByDiffItemId(
    diffItemId: string,
  ): Promise<HumanReviewBackflowAttemptRecord[]> {
    const result =
      await this.dependencies.client.query<HumanReviewBackflowAttemptRow>(
        `
          select ${BACKFLOW_ATTEMPT_COLUMNS}
          from human_review_backflow_attempts
          where diff_item_id = $1
          order by created_at asc, id asc
        `,
        [diffItemId],
      );

    return result.rows.map(mapBackflowAttemptRow);
  }
}

function buildDiffFilter(filter?: ListHumanReviewDiffItemsFilter): {
  clause: string;
  values: unknown[];
} {
  if (!filter) {
    return { clause: "", values: [] };
  }

  const conditions: string[] = [];
  const values: unknown[] = [];
  const addCondition = (sql: string, value: unknown): void => {
    values.push(value);
    conditions.push(sql.replace("?", `$${values.length}`));
  };

  if (filter.manuscriptId !== undefined) {
    addCondition("manuscript_id = ?", filter.manuscriptId);
  }

  if (filter.module !== undefined) {
    addCondition("module = ?", filter.module);
  }

  if (filter.workingAssetId !== undefined) {
    addCondition("working_asset_id = ?", filter.workingAssetId);
  }

  if (filter.finalAssetId !== undefined) {
    addCondition("final_asset_id = ?", filter.finalAssetId);
  }

  if (filter.status !== undefined) {
    addCondition("status = ?", filter.status);
  }

  return {
    clause: conditions.length > 0 ? `where ${conditions.join(" and ")}` : "",
    values,
  };
}

function mapDiffRow(row: HumanReviewDiffRow): HumanReviewDiffRecord {
  const complexityFlags = decodeJsonValue<
    NonNullable<HumanReviewDiffRecord["complexity_flags"]>
  >(row.complexity_flags, []);
  const location = decodeJsonValue<HumanReviewDiffRecord["location"] | undefined>(
    row.location,
    undefined,
  );

  return {
    id: row.id,
    module: row.module,
    manuscript_id: row.manuscript_id,
    baseline_asset_id: row.baseline_asset_id,
    working_asset_id: row.working_asset_id,
    source: row.source,
    content_decision: row.content_decision,
    governance_intents: decodeJsonValue(row.governance_intents, {
      rule_candidate: false,
      knowledge_candidate: false,
    }),
    apply_capability: row.apply_capability,
    status: row.status,
    created_at: formatTimestamp(row.created_at),
    updated_at: formatTimestamp(row.updated_at),
    ...(row.final_asset_id != null ? { final_asset_id: row.final_asset_id } : {}),
    ...(row.before_text != null ? { before_text: row.before_text } : {}),
    ...(row.after_text != null ? { after_text: row.after_text } : {}),
    ...(row.summary != null ? { summary: row.summary } : {}),
    ...(row.note != null ? { note: row.note } : {}),
    ...(row.extraction_revision != null
      ? { extraction_revision: row.extraction_revision }
      : {}),
    ...(row.backflow_error != null ? { backflow_error: row.backflow_error } : {}),
    ...(complexityFlags.length > 0 ? { complexity_flags: complexityFlags } : {}),
    ...(location ? { location } : {}),
  };
}

function mapBackflowAttemptRow(
  row: HumanReviewBackflowAttemptRow,
): HumanReviewBackflowAttemptRecord {
  return {
    id: row.id,
    diff_item_id: row.diff_item_id,
    target: row.target,
    status: row.status,
    created_at: formatTimestamp(row.created_at),
    updated_at: formatTimestamp(row.updated_at),
    ...(row.learning_candidate_id != null
      ? { learning_candidate_id: row.learning_candidate_id }
      : {}),
    ...(row.error_message != null ? { error_message: row.error_message } : {}),
  };
}

function decodeJsonValue<T>(value: T | string | null | undefined, fallback: T): T {
  if (value == null) {
    return fallback;
  }

  return typeof value === "string" ? (JSON.parse(value) as T) : value;
}

function formatTimestamp(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
