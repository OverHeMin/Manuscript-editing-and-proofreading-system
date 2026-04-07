import type {
  KnowledgeRepository,
  KnowledgeReviewActionRepository,
} from "./knowledge-repository.ts";
import type {
  KnowledgeRecord,
  KnowledgeReviewActionRecord,
} from "./knowledge-record.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface KnowledgeRow {
  id: string;
  title: string;
  canonical_text: string;
  summary: string | null;
  knowledge_kind: KnowledgeRecord["knowledge_kind"];
  status: KnowledgeRecord["status"];
  module_scope: KnowledgeRecord["routing"]["module_scope"];
  manuscript_types: string[] | string;
  sections: string[] | string;
  risk_tags: string[] | string;
  discipline_tags: string[] | string;
  evidence_level: KnowledgeRecord["evidence_level"] | null;
  source_type: KnowledgeRecord["source_type"] | null;
  source_link: string | null;
  aliases: string[] | string;
  template_bindings: string[] | string;
  source_learning_candidate_id: string | null;
  projection_source: Record<string, unknown> | string | null;
  created_at: Date;
}

interface KnowledgeReviewActionRow {
  id: string;
  knowledge_item_id: string;
  action: KnowledgeReviewActionRecord["action"];
  actor_role: KnowledgeReviewActionRecord["actor_role"];
  review_note: string | null;
  created_at: Date;
}

export class PostgresKnowledgeRepository implements KnowledgeRepository {
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async save(record: KnowledgeRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into knowledge_items (
          id,
          title,
          canonical_text,
          summary,
          knowledge_kind,
          status,
          module_scope,
          manuscript_types,
          sections,
          risk_tags,
          discipline_tags,
          evidence_level,
          source_type,
          source_link,
          aliases,
          template_bindings,
          source_learning_candidate_id,
          projection_source
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8::manuscript_type[],
          $9::text[],
          $10::text[],
          $11::text[],
          $12,
          $13,
          $14,
          $15::text[],
          $16::text[],
          $17,
          $18::jsonb
        )
        on conflict (id) do update
        set
          title = excluded.title,
          canonical_text = excluded.canonical_text,
          summary = excluded.summary,
          knowledge_kind = excluded.knowledge_kind,
          status = excluded.status,
          module_scope = excluded.module_scope,
          manuscript_types = excluded.manuscript_types,
          sections = excluded.sections,
          risk_tags = excluded.risk_tags,
          discipline_tags = excluded.discipline_tags,
          evidence_level = excluded.evidence_level,
          source_type = excluded.source_type,
          source_link = excluded.source_link,
          aliases = excluded.aliases,
          template_bindings = excluded.template_bindings,
          source_learning_candidate_id = excluded.source_learning_candidate_id,
          projection_source = excluded.projection_source,
          updated_at = now()
      `,
      [
        record.id,
        record.title,
        record.canonical_text,
        record.summary ?? null,
        record.knowledge_kind,
        record.status,
        record.routing.module_scope,
        encodeManuscriptTypes(record.routing.manuscript_types),
        record.routing.sections ?? [],
        record.routing.risk_tags ?? [],
        record.routing.discipline_tags ?? [],
        record.evidence_level ?? null,
        record.source_type ?? null,
        record.source_link ?? null,
        record.aliases ?? [],
        record.template_bindings ?? [],
        record.source_learning_candidate_id ?? null,
        record.projection_source ? JSON.stringify(record.projection_source) : null,
      ],
    );
  }

  async findById(id: string): Promise<KnowledgeRecord | undefined> {
    const result = await this.dependencies.client.query<KnowledgeRow>(
      `
        select
          id,
          title,
          canonical_text,
          summary,
          knowledge_kind,
          status,
          module_scope,
          manuscript_types,
          sections,
          risk_tags,
          discipline_tags,
          evidence_level,
          source_type,
          source_link,
          aliases,
          template_bindings,
          source_learning_candidate_id,
          projection_source,
          created_at
        from knowledge_items
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapKnowledgeRow(result.rows[0]) : undefined;
  }

  async list(): Promise<KnowledgeRecord[]> {
    const result = await this.dependencies.client.query<KnowledgeRow>(
      `
        select
          id,
          title,
          canonical_text,
          summary,
          knowledge_kind,
          status,
          module_scope,
          manuscript_types,
          sections,
          risk_tags,
          discipline_tags,
          evidence_level,
          source_type,
          source_link,
          aliases,
          template_bindings,
          source_learning_candidate_id,
          projection_source,
          created_at
        from knowledge_items
        order by created_at asc, id asc
      `,
    );

    return result.rows.map(mapKnowledgeRow);
  }

  async listByStatus(status: KnowledgeRecord["status"]): Promise<KnowledgeRecord[]> {
    const result = await this.dependencies.client.query<KnowledgeRow>(
      `
        select
          id,
          title,
          canonical_text,
          summary,
          knowledge_kind,
          status,
          module_scope,
          manuscript_types,
          sections,
          risk_tags,
          discipline_tags,
          evidence_level,
          source_type,
          source_link,
          aliases,
          template_bindings,
          source_learning_candidate_id,
          projection_source,
          created_at
        from knowledge_items
        where status = $1
        order by created_at asc, id asc
      `,
      [status],
    );

    return result.rows.map(mapKnowledgeRow);
  }
}

export class PostgresKnowledgeReviewActionRepository
  implements KnowledgeReviewActionRepository
{
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async save(record: KnowledgeReviewActionRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into knowledge_review_actions (
          id,
          knowledge_item_id,
          action,
          actor_role,
          review_note,
          created_at
        )
        values ($1, $2, $3, $4, $5, $6)
        on conflict (id) do update
        set
          knowledge_item_id = excluded.knowledge_item_id,
          action = excluded.action,
          actor_role = excluded.actor_role,
          review_note = excluded.review_note,
          created_at = excluded.created_at
      `,
      [
        record.id,
        record.knowledge_item_id,
        record.action,
        record.actor_role,
        record.review_note ?? null,
        record.created_at,
      ],
    );
  }

  async listByKnowledgeItemId(
    knowledgeItemId: string,
  ): Promise<KnowledgeReviewActionRecord[]> {
    const result = await this.dependencies.client.query<KnowledgeReviewActionRow>(
      `
        select
          id,
          knowledge_item_id,
          action,
          actor_role,
          review_note,
          created_at
        from knowledge_review_actions
        where knowledge_item_id = $1
        order by created_at asc, id asc
      `,
      [knowledgeItemId],
    );

    return result.rows.map(mapKnowledgeReviewActionRow);
  }
}

function mapKnowledgeRow(row: KnowledgeRow): KnowledgeRecord {
  const manuscriptTypes = decodeTextArray(row.manuscript_types);
  const sections = decodeTextArray(row.sections);
  const riskTags = decodeTextArray(row.risk_tags);
  const disciplineTags = decodeTextArray(row.discipline_tags);
  const aliases = decodeTextArray(row.aliases);
  const templateBindings = decodeTextArray(row.template_bindings);

  return {
    id: row.id,
    title: row.title,
    canonical_text: row.canonical_text,
    knowledge_kind: row.knowledge_kind,
    status: row.status,
    routing: {
      module_scope: row.module_scope,
      manuscript_types:
        manuscriptTypes.length === 0
          ? "any"
          : [...manuscriptTypes] as KnowledgeRecord["routing"]["manuscript_types"],
      ...(sections.length > 0 ? { sections } : {}),
      ...(riskTags.length > 0 ? { risk_tags: riskTags } : {}),
      ...(disciplineTags.length > 0
        ? { discipline_tags: disciplineTags }
        : {}),
    },
    ...(row.summary != null ? { summary: row.summary } : {}),
    ...(row.evidence_level != null ? { evidence_level: row.evidence_level } : {}),
    ...(row.source_type != null ? { source_type: row.source_type } : {}),
    ...(row.source_link != null ? { source_link: row.source_link } : {}),
    ...(aliases.length > 0 ? { aliases } : {}),
    ...(templateBindings.length > 0
      ? { template_bindings: templateBindings }
      : {}),
    ...(row.source_learning_candidate_id != null
      ? { source_learning_candidate_id: row.source_learning_candidate_id }
      : {}),
    ...(row.projection_source != null
      ? {
          projection_source: parseJsonObject<KnowledgeRecord["projection_source"]>(
            row.projection_source,
          ),
        }
      : {}),
  };
}

function mapKnowledgeReviewActionRow(
  row: KnowledgeReviewActionRow,
): KnowledgeReviewActionRecord {
  return {
    id: row.id,
    knowledge_item_id: row.knowledge_item_id,
    action: row.action,
    actor_role: row.actor_role,
    ...(row.review_note != null ? { review_note: row.review_note } : {}),
    created_at: row.created_at.toISOString(),
  };
}

function encodeManuscriptTypes(
  manuscriptTypes: KnowledgeRecord["routing"]["manuscript_types"],
): string[] {
  return manuscriptTypes === "any" ? [] : [...manuscriptTypes];
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

function parseJsonObject<T>(
  value: Record<string, unknown> | string | null,
): T {
  if (value == null) {
    return undefined as T;
  }

  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }

  return value as T;
}
