import type {
  KnowledgeRepository,
  KnowledgeReviewActionRepository,
} from "./knowledge-repository.ts";
import type {
  KnowledgeAssetRecord,
  KnowledgeRecord,
  KnowledgeRevisionBindingRecord,
  KnowledgeRevisionRecord,
  KnowledgeReviewActionRecord,
} from "./knowledge-record.ts";
import { selectRuntimeApprovedKnowledgeRevision } from "./knowledge-runtime-projection.ts";

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

interface KnowledgeAssetRow {
  id: string;
  status: KnowledgeAssetRecord["status"];
  current_revision_id: string | null;
  current_approved_revision_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface KnowledgeRevisionRow {
  id: string;
  asset_id: string;
  revision_no: number;
  status: KnowledgeRevisionRecord["status"];
  title: string;
  canonical_text: string;
  summary: string | null;
  knowledge_kind: KnowledgeRevisionRecord["knowledge_kind"];
  module_scope: KnowledgeRevisionRecord["routing"]["module_scope"];
  manuscript_types: string[] | string;
  sections: string[] | string;
  risk_tags: string[] | string;
  discipline_tags: string[] | string;
  evidence_level: KnowledgeRevisionRecord["evidence_level"] | null;
  source_type: KnowledgeRevisionRecord["source_type"] | null;
  source_link: string | null;
  effective_at: Date | null;
  expires_at: Date | null;
  aliases: string[] | string;
  source_learning_candidate_id: string | null;
  projection_source: Record<string, unknown> | string | null;
  based_on_revision_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface KnowledgeRevisionBindingRow {
  id: string;
  revision_id: string;
  binding_kind: KnowledgeRevisionBindingRecord["binding_kind"];
  binding_target_id: string;
  binding_target_label: string;
  created_at: Date;
}

interface KnowledgeReviewActionRow {
  id: string;
  knowledge_item_id: string;
  revision_id: string | null;
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
          $1::uuid,
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
    const asset = await this.findAssetById(id);
    if (asset) {
      return this.projectAuthoringKnowledgeRecord(asset);
    }

    const result = await this.dependencies.client.query<KnowledgeRow>(
      `
        select
          id::text as id,
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
          source_learning_candidate_id::text,
          projection_source,
          created_at
        from knowledge_items
        where id::text = $1
      `,
      [id],
    );

    return result.rows[0] ? mapKnowledgeRow(result.rows[0]) : undefined;
  }

  async findApprovedById(id: string): Promise<KnowledgeRecord | undefined> {
    const asset = await this.findAssetById(id);
    if (asset) {
      return this.projectApprovedKnowledgeRecord(asset);
    }

    const result = await this.dependencies.client.query<KnowledgeRow>(
      `
        select
          id::text as id,
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
          source_learning_candidate_id::text,
          projection_source,
          created_at
        from knowledge_items
        where id::text = $1
          and status = 'approved'
      `,
      [id],
    );

    return result.rows[0] ? mapKnowledgeRow(result.rows[0]) : undefined;
  }

  async list(): Promise<KnowledgeRecord[]> {
    const projected = await this.listProjectedKnowledgeRecords("authoring");
    const shadowedIds = new Set(projected.map((record) => record.id));
    const legacy = (await this.listLegacyKnowledgeRecords()).filter(
      (record) => !shadowedIds.has(record.id),
    );

    return [...projected, ...legacy];
  }

  async listApproved(): Promise<KnowledgeRecord[]> {
    const projected = await this.listProjectedKnowledgeRecords("approved");
    const shadowedIds = new Set(projected.map((record) => record.id));
    const legacy = (await this.listLegacyKnowledgeRecords("approved")).filter(
      (record) => !shadowedIds.has(record.id),
    );

    return [...projected, ...legacy];
  }

  async listByStatus(status: KnowledgeRecord["status"]): Promise<KnowledgeRecord[]> {
    return (await this.list()).filter((record) => record.status === status);
  }

  async saveAsset(record: KnowledgeAssetRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into knowledge_assets (
          id,
          status,
          current_revision_id,
          current_approved_revision_id,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz)
        on conflict (id) do update
        set
          status = excluded.status,
          current_revision_id = excluded.current_revision_id,
          current_approved_revision_id = excluded.current_approved_revision_id,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `,
      [
        record.id,
        record.status,
        record.current_revision_id ?? null,
        record.current_approved_revision_id ?? null,
        record.created_at,
        record.updated_at,
      ],
    );
  }

  async findAssetById(id: string): Promise<KnowledgeAssetRecord | undefined> {
    const result = await this.dependencies.client.query<KnowledgeAssetRow>(
      `
        select
          id,
          status,
          current_revision_id,
          current_approved_revision_id,
          created_at,
          updated_at
        from knowledge_assets
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapKnowledgeAssetRow(result.rows[0]) : undefined;
  }

  async listAssets(): Promise<KnowledgeAssetRecord[]> {
    const result = await this.dependencies.client.query<KnowledgeAssetRow>(
      `
        select
          id,
          status,
          current_revision_id,
          current_approved_revision_id,
          created_at,
          updated_at
        from knowledge_assets
        order by created_at asc, id asc
      `,
    );

    return result.rows.map(mapKnowledgeAssetRow);
  }

  async saveRevision(record: KnowledgeRevisionRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into knowledge_revisions (
          id,
          asset_id,
          revision_no,
          status,
          title,
          canonical_text,
          summary,
          knowledge_kind,
          module_scope,
          manuscript_types,
          sections,
          risk_tags,
          discipline_tags,
          evidence_level,
          source_type,
          source_link,
          effective_at,
          expires_at,
          aliases,
          source_learning_candidate_id,
          projection_source,
          based_on_revision_id,
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
          $10::manuscript_type[],
          $11::text[],
          $12::text[],
          $13::text[],
          $14,
          $15,
          $16,
          $17::timestamptz,
          $18::timestamptz,
          $19::text[],
          $20,
          $21::jsonb,
          $22,
          $23::timestamptz,
          $24::timestamptz
        )
        on conflict (id) do update
        set
          asset_id = excluded.asset_id,
          revision_no = excluded.revision_no,
          status = excluded.status,
          title = excluded.title,
          canonical_text = excluded.canonical_text,
          summary = excluded.summary,
          knowledge_kind = excluded.knowledge_kind,
          module_scope = excluded.module_scope,
          manuscript_types = excluded.manuscript_types,
          sections = excluded.sections,
          risk_tags = excluded.risk_tags,
          discipline_tags = excluded.discipline_tags,
          evidence_level = excluded.evidence_level,
          source_type = excluded.source_type,
          source_link = excluded.source_link,
          effective_at = excluded.effective_at,
          expires_at = excluded.expires_at,
          aliases = excluded.aliases,
          source_learning_candidate_id = excluded.source_learning_candidate_id,
          projection_source = excluded.projection_source,
          based_on_revision_id = excluded.based_on_revision_id,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `,
      [
        record.id,
        record.asset_id,
        record.revision_no,
        record.status,
        record.title,
        record.canonical_text,
        record.summary ?? null,
        record.knowledge_kind,
        record.routing.module_scope,
        encodeManuscriptTypes(record.routing.manuscript_types),
        record.routing.sections ?? [],
        record.routing.risk_tags ?? [],
        record.routing.discipline_tags ?? [],
        record.evidence_level ?? null,
        record.source_type ?? null,
        record.source_link ?? null,
        record.effective_at ?? null,
        record.expires_at ?? null,
        record.aliases ?? [],
        record.source_learning_candidate_id ?? null,
        record.projection_source ? JSON.stringify(record.projection_source) : null,
        record.based_on_revision_id ?? null,
        record.created_at,
        record.updated_at,
      ],
    );
  }

  async findRevisionById(id: string): Promise<KnowledgeRevisionRecord | undefined> {
    const result = await this.dependencies.client.query<KnowledgeRevisionRow>(
      `
        select
          id,
          asset_id,
          revision_no,
          status,
          title,
          canonical_text,
          summary,
          knowledge_kind,
          module_scope,
          manuscript_types,
          sections,
          risk_tags,
          discipline_tags,
          evidence_level,
          source_type,
          source_link,
          effective_at,
          expires_at,
          aliases,
          source_learning_candidate_id,
          projection_source,
          based_on_revision_id,
          created_at,
          updated_at
        from knowledge_revisions
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapKnowledgeRevisionRow(result.rows[0]) : undefined;
  }

  async listRevisionsByAssetId(assetId: string): Promise<KnowledgeRevisionRecord[]> {
    const result = await this.dependencies.client.query<KnowledgeRevisionRow>(
      `
        select
          id,
          asset_id,
          revision_no,
          status,
          title,
          canonical_text,
          summary,
          knowledge_kind,
          module_scope,
          manuscript_types,
          sections,
          risk_tags,
          discipline_tags,
          evidence_level,
          source_type,
          source_link,
          effective_at,
          expires_at,
          aliases,
          source_learning_candidate_id,
          projection_source,
          based_on_revision_id,
          created_at,
          updated_at
        from knowledge_revisions
        where asset_id = $1
        order by revision_no desc, updated_at desc, id desc
      `,
      [assetId],
    );

    return result.rows.map(mapKnowledgeRevisionRow);
  }

  async listRevisionsByStatus(
    status: KnowledgeRevisionRecord["status"],
  ): Promise<KnowledgeRevisionRecord[]> {
    const result = await this.dependencies.client.query<KnowledgeRevisionRow>(
      `
        select
          id,
          asset_id,
          revision_no,
          status,
          title,
          canonical_text,
          summary,
          knowledge_kind,
          module_scope,
          manuscript_types,
          sections,
          risk_tags,
          discipline_tags,
          evidence_level,
          source_type,
          source_link,
          effective_at,
          expires_at,
          aliases,
          source_learning_candidate_id,
          projection_source,
          based_on_revision_id,
          created_at,
          updated_at
        from knowledge_revisions
        where status = $1
        order by updated_at desc, id desc
      `,
      [status],
    );

    return result.rows.map(mapKnowledgeRevisionRow);
  }

  async replaceRevisionBindings(
    revisionId: string,
    records: readonly KnowledgeRevisionBindingRecord[],
  ): Promise<void> {
    await this.dependencies.client.query(
      `
        delete from knowledge_revision_bindings
        where revision_id = $1
      `,
      [revisionId],
    );

    for (const record of records) {
      await this.dependencies.client.query(
        `
          insert into knowledge_revision_bindings (
            id,
            revision_id,
            binding_kind,
            binding_target_id,
            binding_target_label,
            created_at
          )
          values ($1, $2, $3, $4, $5, $6::timestamptz)
        `,
        [
          record.id,
          record.revision_id,
          record.binding_kind,
          record.binding_target_id,
          record.binding_target_label,
          record.created_at,
        ],
      );
    }
  }

  async listBindingsByRevisionId(
    revisionId: string,
  ): Promise<KnowledgeRevisionBindingRecord[]> {
    const result =
      await this.dependencies.client.query<KnowledgeRevisionBindingRow>(
        `
          select
            id,
            revision_id,
            binding_kind,
            binding_target_id,
            binding_target_label,
            created_at
          from knowledge_revision_bindings
          where revision_id = $1
          order by created_at asc, id asc
        `,
        [revisionId],
      );

    return result.rows.map(mapKnowledgeRevisionBindingRow);
  }

  private async listLegacyKnowledgeRecords(
    status?: KnowledgeRecord["status"],
  ): Promise<KnowledgeRecord[]> {
    const result = await this.dependencies.client.query<KnowledgeRow>(
      `
        select
          id::text as id,
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
          source_learning_candidate_id::text,
          projection_source,
          created_at
        from knowledge_items
        ${status ? "where status = $1" : ""}
        order by created_at asc, id asc
      `,
      status ? [status] : [],
    );

    return result.rows.map(mapKnowledgeRow);
  }

  private async listProjectedKnowledgeRecords(
    projection: "authoring" | "approved",
  ): Promise<KnowledgeRecord[]> {
    const assets = await this.listAssets();
    const projected = await Promise.all(
      assets.map((asset) =>
        projection === "approved"
          ? this.projectApprovedKnowledgeRecord(asset)
          : this.projectAuthoringKnowledgeRecord(asset),
      ),
    );

    return projected.filter((record): record is KnowledgeRecord => record != null);
  }

  private async projectAuthoringKnowledgeRecord(
    asset: KnowledgeAssetRecord,
  ): Promise<KnowledgeRecord | undefined> {
    const revisions = await this.listRevisionsByAssetId(asset.id);
    const selectedRevision =
      revisions.find(
        (revision) =>
          revision.status === "draft" || revision.status === "pending_review",
      ) ??
      revisions.find((revision) => revision.id === asset.current_revision_id) ??
      revisions[0];

    return selectedRevision
      ? this.projectKnowledgeRecordFromRevision(selectedRevision)
      : undefined;
  }

  private async projectApprovedKnowledgeRecord(
    asset: KnowledgeAssetRecord,
  ): Promise<KnowledgeRecord | undefined> {
    const revisions = await this.listRevisionsByAssetId(asset.id);
    const revision = selectRuntimeApprovedKnowledgeRevision(revisions, {
      preferredRevisionId: asset.current_approved_revision_id,
    });
    return revision ? this.projectKnowledgeRecordFromRevision(revision) : undefined;
  }

  private async projectKnowledgeRecordFromRevision(
    revision: KnowledgeRevisionRecord,
  ): Promise<KnowledgeRecord> {
    const bindings = await this.listBindingsByRevisionId(revision.id);
    const routing: KnowledgeRecord["routing"] = {
      module_scope: revision.routing.module_scope,
      manuscript_types:
        revision.routing.manuscript_types === "any"
          ? "any"
          : [...revision.routing.manuscript_types],
      ...(revision.routing.sections ? { sections: [...revision.routing.sections] } : {}),
      ...(revision.routing.risk_tags ? { risk_tags: [...revision.routing.risk_tags] } : {}),
      ...(revision.routing.discipline_tags
        ? { discipline_tags: [...revision.routing.discipline_tags] }
        : {}),
    };

    return {
      id: revision.asset_id,
      title: revision.title,
      canonical_text: revision.canonical_text,
      knowledge_kind: revision.knowledge_kind,
      status: revision.status,
      routing,
      ...(revision.summary != null ? { summary: revision.summary } : {}),
      ...(revision.evidence_level != null
        ? { evidence_level: revision.evidence_level }
        : {}),
      ...(revision.source_type != null ? { source_type: revision.source_type } : {}),
      ...(revision.source_link != null ? { source_link: revision.source_link } : {}),
      ...(revision.aliases ? { aliases: [...revision.aliases] } : {}),
      ...(bindings.length > 0
        ? {
            template_bindings: bindings.map((binding) => binding.binding_target_id),
          }
        : {}),
      ...(revision.source_learning_candidate_id != null
        ? { source_learning_candidate_id: revision.source_learning_candidate_id }
        : {}),
      ...(revision.projection_source != null
        ? {
            projection_source: JSON.parse(
              JSON.stringify(revision.projection_source),
            ) as NonNullable<KnowledgeRecord["projection_source"]>,
          }
        : {}),
    };
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
          revision_id,
          action,
          actor_role,
          review_note,
          created_at
        )
        values ($1, $2, $3, $4, $5, $6, $7::timestamptz)
        on conflict (id) do update
        set
          knowledge_item_id = excluded.knowledge_item_id,
          revision_id = excluded.revision_id,
          action = excluded.action,
          actor_role = excluded.actor_role,
          review_note = excluded.review_note,
          created_at = excluded.created_at
      `,
      [
        record.id,
        record.knowledge_item_id,
        record.revision_id ?? null,
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
          revision_id,
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

    return result.rows.map(mapLegacyKnowledgeReviewActionRow);
  }

  async listByRevisionId(
    revisionId: string,
  ): Promise<KnowledgeReviewActionRecord[]> {
    const result = await this.dependencies.client.query<KnowledgeReviewActionRow>(
      `
        select
          id,
          knowledge_item_id,
          revision_id,
          action,
          actor_role,
          review_note,
          created_at
        from knowledge_review_actions
        where revision_id = $1
        order by created_at asc, id asc
      `,
      [revisionId],
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

function mapKnowledgeAssetRow(row: KnowledgeAssetRow): KnowledgeAssetRecord {
  return {
    id: row.id,
    status: row.status,
    ...(row.current_revision_id != null
      ? { current_revision_id: row.current_revision_id }
      : {}),
    ...(row.current_approved_revision_id != null
      ? { current_approved_revision_id: row.current_approved_revision_id }
      : {}),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function mapKnowledgeRevisionRow(row: KnowledgeRevisionRow): KnowledgeRevisionRecord {
  const manuscriptTypes = decodeTextArray(row.manuscript_types);
  const sections = decodeTextArray(row.sections);
  const riskTags = decodeTextArray(row.risk_tags);
  const disciplineTags = decodeTextArray(row.discipline_tags);
  const aliases = decodeTextArray(row.aliases);

  return {
    id: row.id,
    asset_id: row.asset_id,
    revision_no: row.revision_no,
    status: row.status,
    title: row.title,
    canonical_text: row.canonical_text,
    knowledge_kind: row.knowledge_kind,
    routing: {
      module_scope: row.module_scope,
      manuscript_types:
        manuscriptTypes.length === 0
          ? "any"
          : [...manuscriptTypes] as KnowledgeRevisionRecord["routing"]["manuscript_types"],
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
    ...(row.effective_at != null
      ? { effective_at: row.effective_at.toISOString() }
      : {}),
    ...(row.expires_at != null ? { expires_at: row.expires_at.toISOString() } : {}),
    ...(aliases.length > 0 ? { aliases } : {}),
    ...(row.source_learning_candidate_id != null
      ? { source_learning_candidate_id: row.source_learning_candidate_id }
      : {}),
    ...(row.projection_source != null
      ? {
          projection_source: parseJsonObject<KnowledgeRevisionRecord["projection_source"]>(
            row.projection_source,
          ),
        }
      : {}),
    ...(row.based_on_revision_id != null
      ? { based_on_revision_id: row.based_on_revision_id }
      : {}),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function mapKnowledgeRevisionBindingRow(
  row: KnowledgeRevisionBindingRow,
): KnowledgeRevisionBindingRecord {
  return {
    id: row.id,
    revision_id: row.revision_id,
    binding_kind: row.binding_kind,
    binding_target_id: row.binding_target_id,
    binding_target_label: row.binding_target_label,
    created_at: row.created_at.toISOString(),
  };
}

function mapKnowledgeReviewActionRow(
  row: KnowledgeReviewActionRow,
): KnowledgeReviewActionRecord {
  return {
    id: row.id,
    knowledge_item_id: row.knowledge_item_id,
    ...(row.revision_id != null ? { revision_id: row.revision_id } : {}),
    action: row.action,
    actor_role: row.actor_role,
    ...(row.review_note != null ? { review_note: row.review_note } : {}),
    created_at: row.created_at.toISOString(),
  };
}

function mapLegacyKnowledgeReviewActionRow(
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
