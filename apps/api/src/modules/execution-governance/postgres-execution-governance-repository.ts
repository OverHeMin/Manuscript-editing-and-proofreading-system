import type {
  KnowledgeBindingRuleRecord,
  ModuleExecutionProfileRecord,
} from "./execution-governance-record.ts";
import type { ExecutionGovernanceRepository } from "./execution-governance-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface ExecutionProfileRow {
  id: string;
  module: ModuleExecutionProfileRecord["module"];
  manuscript_type: ModuleExecutionProfileRecord["manuscript_type"];
  template_family_id: string;
  module_template_id: string;
  rule_set_id: string;
  prompt_template_id: string;
  skill_package_ids: string[] | string;
  knowledge_binding_mode: ModuleExecutionProfileRecord["knowledge_binding_mode"];
  status: ModuleExecutionProfileRecord["status"];
  version: number;
  notes: string | null;
}

interface KnowledgeBindingRuleRow {
  id: string;
  knowledge_item_id: string;
  module: KnowledgeBindingRuleRecord["module"];
  manuscript_types: string[] | string | null;
  template_family_ids: string[] | string | null;
  module_template_ids: string[] | string | null;
  sections: string[] | string;
  risk_tags: string[] | string;
  priority: number;
  binding_purpose: KnowledgeBindingRuleRecord["binding_purpose"];
  status: KnowledgeBindingRuleRecord["status"];
}

export class PostgresExecutionGovernanceRepository
  implements ExecutionGovernanceRepository
{
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async saveProfile(record: ModuleExecutionProfileRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into execution_profiles (
          id,
          module,
          manuscript_type,
          template_family_id,
          module_template_id,
          rule_set_id,
          prompt_template_id,
          skill_package_ids,
          knowledge_binding_mode,
          status,
          version,
          notes
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8::text[],
          $9,
          $10,
          $11,
          $12
        )
        on conflict (id) do update
        set
          module = excluded.module,
          manuscript_type = excluded.manuscript_type,
          template_family_id = excluded.template_family_id,
          module_template_id = excluded.module_template_id,
          rule_set_id = excluded.rule_set_id,
          prompt_template_id = excluded.prompt_template_id,
          skill_package_ids = excluded.skill_package_ids,
          knowledge_binding_mode = excluded.knowledge_binding_mode,
          status = excluded.status,
          version = excluded.version,
          notes = excluded.notes,
          updated_at = now()
      `,
      [
        record.id,
        record.module,
        record.manuscript_type,
        record.template_family_id,
        record.module_template_id,
        record.rule_set_id,
        record.prompt_template_id,
        record.skill_package_ids,
        record.knowledge_binding_mode,
        record.status,
        record.version,
        record.notes ?? null,
      ],
    );
  }

  async findProfileById(
    id: string,
  ): Promise<ModuleExecutionProfileRecord | undefined> {
    const result = await this.dependencies.client.query<ExecutionProfileRow>(
      `
        select
          id,
          module,
          manuscript_type,
          template_family_id,
          module_template_id,
          rule_set_id,
          prompt_template_id,
          skill_package_ids,
          knowledge_binding_mode,
          status,
          version,
          notes
        from execution_profiles
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapExecutionProfileRow(result.rows[0]) : undefined;
  }

  async listProfiles(): Promise<ModuleExecutionProfileRecord[]> {
    const result = await this.dependencies.client.query<ExecutionProfileRow>(
      `
        select
          id,
          module,
          manuscript_type,
          template_family_id,
          module_template_id,
          rule_set_id,
          prompt_template_id,
          skill_package_ids,
          knowledge_binding_mode,
          status,
          version,
          notes
        from execution_profiles
        order by module asc, manuscript_type asc, template_family_id asc, version asc, id asc
      `,
    );

    return result.rows.map(mapExecutionProfileRow);
  }

  async reserveNextProfileVersion(
    module: ModuleExecutionProfileRecord["module"],
    manuscriptType: ModuleExecutionProfileRecord["manuscript_type"],
    templateFamilyId: ModuleExecutionProfileRecord["template_family_id"],
  ): Promise<number> {
    await this.dependencies.client.query(
      `
        select pg_advisory_xact_lock(hashtext($1))
      `,
      [`execution-profile-version:${module}:${manuscriptType}:${templateFamilyId}`],
    );

    const result = await this.dependencies.client.query<{ next_version: number }>(
      `
        select coalesce(max(version), 0) + 1 as next_version
        from execution_profiles
        where module = $1
          and manuscript_type = $2
          and template_family_id = $3
      `,
      [module, manuscriptType, templateFamilyId],
    );

    return Number(result.rows[0]?.next_version ?? 1);
  }

  async saveKnowledgeBindingRule(
    record: KnowledgeBindingRuleRecord,
  ): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into knowledge_binding_rules (
          id,
          knowledge_item_id,
          module,
          manuscript_types,
          template_family_ids,
          module_template_ids,
          sections,
          risk_tags,
          priority,
          binding_purpose,
          status
        )
        values (
          $1,
          $2,
          $3,
          $4::manuscript_type[],
          $5::text[],
          $6::text[],
          $7::text[],
          $8::text[],
          $9,
          $10,
          $11
        )
        on conflict (id) do update
        set
          knowledge_item_id = excluded.knowledge_item_id,
          module = excluded.module,
          manuscript_types = excluded.manuscript_types,
          template_family_ids = excluded.template_family_ids,
          module_template_ids = excluded.module_template_ids,
          sections = excluded.sections,
          risk_tags = excluded.risk_tags,
          priority = excluded.priority,
          binding_purpose = excluded.binding_purpose,
          status = excluded.status,
          updated_at = now()
      `,
      [
        record.id,
        record.knowledge_item_id,
        record.module,
        record.manuscript_types === "any" ? null : record.manuscript_types,
        record.template_family_ids ?? null,
        record.module_template_ids ?? null,
        record.sections ?? [],
        record.risk_tags ?? [],
        record.priority,
        record.binding_purpose,
        record.status,
      ],
    );
  }

  async findKnowledgeBindingRuleById(
    id: string,
  ): Promise<KnowledgeBindingRuleRecord | undefined> {
    const result = await this.dependencies.client.query<KnowledgeBindingRuleRow>(
      `
        select
          id,
          knowledge_item_id,
          module,
          manuscript_types,
          template_family_ids,
          module_template_ids,
          sections,
          risk_tags,
          priority,
          binding_purpose,
          status
        from knowledge_binding_rules
        where id = $1
      `,
      [id],
    );

    return result.rows[0]
      ? mapKnowledgeBindingRuleRow(result.rows[0])
      : undefined;
  }

  async listKnowledgeBindingRules(): Promise<KnowledgeBindingRuleRecord[]> {
    const result = await this.dependencies.client.query<KnowledgeBindingRuleRow>(
      `
        select
          id,
          knowledge_item_id,
          module,
          manuscript_types,
          template_family_ids,
          module_template_ids,
          sections,
          risk_tags,
          priority,
          binding_purpose,
          status
        from knowledge_binding_rules
        order by priority desc, module asc, id asc
      `,
    );

    return result.rows.map(mapKnowledgeBindingRuleRow);
  }
}

function mapExecutionProfileRow(
  row: ExecutionProfileRow,
): ModuleExecutionProfileRecord {
  return {
    id: row.id,
    module: row.module,
    manuscript_type: row.manuscript_type,
    template_family_id: row.template_family_id,
    module_template_id: row.module_template_id,
    rule_set_id: row.rule_set_id,
    prompt_template_id: row.prompt_template_id,
    skill_package_ids: decodeTextArray(row.skill_package_ids),
    knowledge_binding_mode: row.knowledge_binding_mode,
    status: row.status,
    version: Number(row.version),
    ...(row.notes ? { notes: row.notes } : {}),
  };
}

function mapKnowledgeBindingRuleRow(
  row: KnowledgeBindingRuleRow,
): KnowledgeBindingRuleRecord {
  const templateFamilyIds = decodeNullableTextArray(row.template_family_ids);
  const moduleTemplateIds = decodeNullableTextArray(row.module_template_ids);
  const sections = decodeTextArray(row.sections);
  const riskTags = decodeTextArray(row.risk_tags);

  return {
    id: row.id,
    knowledge_item_id: row.knowledge_item_id,
    module: row.module,
    manuscript_types:
      row.manuscript_types == null
        ? "any"
        : (decodeTextArray(row.manuscript_types) as KnowledgeBindingRuleRecord["manuscript_types"]),
    ...(templateFamilyIds ? { template_family_ids: templateFamilyIds } : {}),
    ...(moduleTemplateIds ? { module_template_ids: moduleTemplateIds } : {}),
    ...(sections.length > 0 ? { sections } : {}),
    ...(riskTags.length > 0 ? { risk_tags: riskTags } : {}),
    priority: Number(row.priority),
    binding_purpose: row.binding_purpose,
    status: row.status,
  };
}

function decodeNullableTextArray(value: string[] | string | null): string[] | undefined {
  if (value == null) {
    return undefined;
  }

  const decoded = decodeTextArray(value);
  return decoded.length > 0 ? decoded : undefined;
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
