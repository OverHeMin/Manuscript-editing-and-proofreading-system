import type { ManualReviewPolicyRecord } from "./manual-review-policy-record.ts";
import type { ManualReviewPolicyRepository } from "./manual-review-policy-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface ManualReviewPolicyRow {
  id: string;
  module: ManualReviewPolicyRecord["module"];
  manuscript_type: ManualReviewPolicyRecord["manuscript_type"];
  template_family_id: string;
  name: string;
  min_confidence_threshold: number;
  high_risk_force_review: boolean;
  conflict_force_review: boolean;
  insufficient_knowledge_force_review: boolean;
  module_blocklist_rules: string[] | string;
  status: ManualReviewPolicyRecord["status"];
  version: number;
}

export class PostgresManualReviewPolicyRepository
  implements ManualReviewPolicyRepository
{
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async save(record: ManualReviewPolicyRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into manual_review_policies (
          id,
          module,
          manuscript_type,
          template_family_id,
          name,
          min_confidence_threshold,
          high_risk_force_review,
          conflict_force_review,
          insufficient_knowledge_force_review,
          module_blocklist_rules,
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
          $7,
          $8,
          $9,
          $10::text[],
          $11,
          $12
        )
        on conflict (id) do update
        set
          module = excluded.module,
          manuscript_type = excluded.manuscript_type,
          template_family_id = excluded.template_family_id,
          name = excluded.name,
          min_confidence_threshold = excluded.min_confidence_threshold,
          high_risk_force_review = excluded.high_risk_force_review,
          conflict_force_review = excluded.conflict_force_review,
          insufficient_knowledge_force_review = excluded.insufficient_knowledge_force_review,
          module_blocklist_rules = excluded.module_blocklist_rules,
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
        record.min_confidence_threshold,
        record.high_risk_force_review,
        record.conflict_force_review,
        record.insufficient_knowledge_force_review,
        record.module_blocklist_rules ?? [],
        record.status,
        record.version,
      ],
    );
  }

  async findById(id: string): Promise<ManualReviewPolicyRecord | undefined> {
    const result = await this.dependencies.client.query<ManualReviewPolicyRow>(
      `
        select
          id,
          module,
          manuscript_type,
          template_family_id,
          name,
          min_confidence_threshold,
          high_risk_force_review,
          conflict_force_review,
          insufficient_knowledge_force_review,
          module_blocklist_rules,
          status,
          version
        from manual_review_policies
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  }

  async listByScope(
    module: ManualReviewPolicyRecord["module"],
    manuscriptType: ManualReviewPolicyRecord["manuscript_type"],
    templateFamilyId: ManualReviewPolicyRecord["template_family_id"],
    activeOnly = false,
  ): Promise<ManualReviewPolicyRecord[]> {
    const result = await this.dependencies.client.query<ManualReviewPolicyRow>(
      `
        select
          id,
          module,
          manuscript_type,
          template_family_id,
          name,
          min_confidence_threshold,
          high_risk_force_review,
          conflict_force_review,
          insufficient_knowledge_force_review,
          module_blocklist_rules,
          status,
          version
        from manual_review_policies
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
    module: ManualReviewPolicyRecord["module"],
    manuscriptType: ManualReviewPolicyRecord["manuscript_type"],
    templateFamilyId: ManualReviewPolicyRecord["template_family_id"],
  ): Promise<number> {
    await this.dependencies.client.query(
      `
        select pg_advisory_xact_lock(hashtext($1))
      `,
      [
        `manual-review-policy-version:${module}:${manuscriptType}:${templateFamilyId}`,
      ],
    );

    const result = await this.dependencies.client.query<{ next_version: number }>(
      `
        select coalesce(max(version), 0) + 1 as next_version
        from manual_review_policies
        where module = $1
          and manuscript_type = $2
          and template_family_id = $3
      `,
      [module, manuscriptType, templateFamilyId],
    );

    return Number(result.rows[0]?.next_version ?? 1);
  }
}

function mapRow(row: ManualReviewPolicyRow): ManualReviewPolicyRecord {
  const blocklistRules = decodeTextArray(row.module_blocklist_rules);

  return {
    id: row.id,
    module: row.module,
    manuscript_type: row.manuscript_type,
    template_family_id: row.template_family_id,
    name: row.name,
    min_confidence_threshold: Number(row.min_confidence_threshold),
    high_risk_force_review: row.high_risk_force_review,
    conflict_force_review: row.conflict_force_review,
    insufficient_knowledge_force_review: row.insufficient_knowledge_force_review,
    ...(blocklistRules.length > 0 ? { module_blocklist_rules: blocklistRules } : {}),
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
