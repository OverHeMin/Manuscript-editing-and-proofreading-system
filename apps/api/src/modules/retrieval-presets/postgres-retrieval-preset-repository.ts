import type { RetrievalPresetRecord } from "./retrieval-preset-record.ts";
import type { RetrievalPresetRepository } from "./retrieval-preset-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface RetrievalPresetRow {
  id: string;
  module: RetrievalPresetRecord["module"];
  manuscript_type: RetrievalPresetRecord["manuscript_type"];
  template_family_id: string;
  name: string;
  top_k: number;
  section_filters: string[] | string;
  risk_tag_filters: string[] | string;
  rerank_enabled: boolean;
  citation_required: boolean;
  min_retrieval_score: number | null;
  status: RetrievalPresetRecord["status"];
  version: number;
}

export class PostgresRetrievalPresetRepository
  implements RetrievalPresetRepository
{
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async save(record: RetrievalPresetRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into retrieval_presets (
          id,
          module,
          manuscript_type,
          template_family_id,
          name,
          top_k,
          section_filters,
          risk_tag_filters,
          rerank_enabled,
          citation_required,
          min_retrieval_score,
          status,
          version
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7::text[],
          $8::text[],
          $9,
          $10,
          $11,
          $12,
          $13
        )
        on conflict (id) do update
        set
          module = excluded.module,
          manuscript_type = excluded.manuscript_type,
          template_family_id = excluded.template_family_id,
          name = excluded.name,
          top_k = excluded.top_k,
          section_filters = excluded.section_filters,
          risk_tag_filters = excluded.risk_tag_filters,
          rerank_enabled = excluded.rerank_enabled,
          citation_required = excluded.citation_required,
          min_retrieval_score = excluded.min_retrieval_score,
          status = excluded.status,
          version = excluded.version,
          updated_at = now()
      `,
      [
        record.id,
        record.module,
        record.manuscript_type,
        record.template_family_id,
        record.name,
        record.top_k,
        record.section_filters ?? [],
        record.risk_tag_filters ?? [],
        record.rerank_enabled,
        record.citation_required,
        record.min_retrieval_score ?? null,
        record.status,
        record.version,
      ],
    );
  }

  async findById(id: string): Promise<RetrievalPresetRecord | undefined> {
    const result = await this.dependencies.client.query<RetrievalPresetRow>(
      `
        select
          id,
          module,
          manuscript_type,
          template_family_id,
          name,
          top_k,
          section_filters,
          risk_tag_filters,
          rerank_enabled,
          citation_required,
          min_retrieval_score,
          status,
          version
        from retrieval_presets
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  }

  async listByScope(
    module: RetrievalPresetRecord["module"],
    manuscriptType: RetrievalPresetRecord["manuscript_type"],
    templateFamilyId: RetrievalPresetRecord["template_family_id"],
    activeOnly = false,
  ): Promise<RetrievalPresetRecord[]> {
    const result = await this.dependencies.client.query<RetrievalPresetRow>(
      `
        select
          id,
          module,
          manuscript_type,
          template_family_id,
          name,
          top_k,
          section_filters,
          risk_tag_filters,
          rerank_enabled,
          citation_required,
          min_retrieval_score,
          status,
          version
        from retrieval_presets
        where module = $1
          and manuscript_type = $2
          and template_family_id = $3
          and ($4::boolean = false or status = 'active')
        order by module asc, manuscript_type asc, template_family_id asc, version asc, id asc
      `,
      [module, manuscriptType, templateFamilyId, activeOnly],
    );

    return result.rows.map(mapRow);
  }

  async reserveNextVersion(
    module: RetrievalPresetRecord["module"],
    manuscriptType: RetrievalPresetRecord["manuscript_type"],
    templateFamilyId: RetrievalPresetRecord["template_family_id"],
  ): Promise<number> {
    await this.dependencies.client.query(
      `
        select pg_advisory_xact_lock(hashtext($1))
      `,
      [`retrieval-preset-version:${module}:${manuscriptType}:${templateFamilyId}`],
    );

    const result = await this.dependencies.client.query<{ next_version: number }>(
      `
        select coalesce(max(version), 0) + 1 as next_version
        from retrieval_presets
        where module = $1
          and manuscript_type = $2
          and template_family_id = $3
      `,
      [module, manuscriptType, templateFamilyId],
    );

    return Number(result.rows[0]?.next_version ?? 1);
  }
}

function mapRow(row: RetrievalPresetRow): RetrievalPresetRecord {
  const sectionFilters = decodeTextArray(row.section_filters);
  const riskTagFilters = decodeTextArray(row.risk_tag_filters);

  return {
    id: row.id,
    module: row.module,
    manuscript_type: row.manuscript_type,
    template_family_id: row.template_family_id,
    name: row.name,
    top_k: Number(row.top_k),
    ...(sectionFilters.length > 0 ? { section_filters: sectionFilters } : {}),
    ...(riskTagFilters.length > 0 ? { risk_tag_filters: riskTagFilters } : {}),
    rerank_enabled: row.rerank_enabled,
    citation_required: row.citation_required,
    ...(row.min_retrieval_score == null
      ? {}
      : { min_retrieval_score: Number(row.min_retrieval_score) }),
    status: row.status,
    version: Number(row.version),
  };
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
