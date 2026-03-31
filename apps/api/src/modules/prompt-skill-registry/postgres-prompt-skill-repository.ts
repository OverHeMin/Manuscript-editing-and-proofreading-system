import type {
  PromptTemplateRecord,
  SkillPackageRecord,
} from "./prompt-skill-record.ts";
import type { PromptSkillRegistryRepository } from "./prompt-skill-repository.ts";
import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface PromptTemplateRow {
  id: string;
  name: string;
  version: string;
  status: PromptTemplateRecord["status"];
  module: PromptTemplateRecord["module"];
  manuscript_types: ManuscriptType[] | string | null;
  rollback_target_version: string | null;
  source_learning_candidate_id: string | null;
}

interface SkillPackageRow {
  id: string;
  name: string;
  version: string;
  scope: SkillPackageRecord["scope"];
  status: SkillPackageRecord["status"];
  applies_to_modules: SkillPackageRecord["applies_to_modules"] | string;
  dependency_tools: string[] | string;
  source_learning_candidate_id: string | null;
}

export class PostgresPromptSkillRegistryRepository
  implements PromptSkillRegistryRepository
{
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async saveSkillPackage(record: SkillPackageRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into skill_packages (
          id,
          name,
          version,
          scope,
          status,
          applies_to_modules,
          dependency_tools,
          source_learning_candidate_id
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6::module_type[],
          $7::text[],
          $8
        )
        on conflict (id) do update
        set
          name = excluded.name,
          version = excluded.version,
          scope = excluded.scope,
          status = excluded.status,
          applies_to_modules = excluded.applies_to_modules,
          dependency_tools = excluded.dependency_tools,
          source_learning_candidate_id = excluded.source_learning_candidate_id,
          updated_at = now()
      `,
      [
        record.id,
        record.name,
        record.version,
        record.scope,
        record.status,
        record.applies_to_modules,
        record.dependency_tools ?? [],
        record.source_learning_candidate_id ?? null,
      ],
    );
  }

  async findSkillPackageById(id: string): Promise<SkillPackageRecord | undefined> {
    const result = await this.dependencies.client.query<SkillPackageRow>(
      `
        select
          id,
          name,
          version,
          scope,
          status,
          applies_to_modules,
          dependency_tools,
          source_learning_candidate_id
        from skill_packages
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapSkillPackageRow(result.rows[0]) : undefined;
  }

  async listSkillPackages(): Promise<SkillPackageRecord[]> {
    const result = await this.dependencies.client.query<SkillPackageRow>(
      `
        select
          id,
          name,
          version,
          scope,
          status,
          applies_to_modules,
          dependency_tools,
          source_learning_candidate_id
        from skill_packages
        order by name asc, version asc, id asc
      `,
    );

    return result.rows.map(mapSkillPackageRow);
  }

  async listSkillPackagesByName(name: string): Promise<SkillPackageRecord[]> {
    const result = await this.dependencies.client.query<SkillPackageRow>(
      `
        select
          id,
          name,
          version,
          scope,
          status,
          applies_to_modules,
          dependency_tools,
          source_learning_candidate_id
        from skill_packages
        where name = $1
        order by name asc, version asc, id asc
      `,
      [name],
    );

    return result.rows.map(mapSkillPackageRow);
  }

  async savePromptTemplate(record: PromptTemplateRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into prompt_templates (
          id,
          name,
          version,
          status,
          module,
          manuscript_types,
          rollback_target_version,
          source_learning_candidate_id
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6::manuscript_type[],
          $7,
          $8
        )
        on conflict (id) do update
        set
          name = excluded.name,
          version = excluded.version,
          status = excluded.status,
          module = excluded.module,
          manuscript_types = excluded.manuscript_types,
          rollback_target_version = excluded.rollback_target_version,
          source_learning_candidate_id = excluded.source_learning_candidate_id,
          updated_at = now()
      `,
      [
        record.id,
        record.name,
        record.version,
        record.status,
        record.module,
        record.manuscript_types === "any" ? null : record.manuscript_types,
        record.rollback_target_version ?? null,
        record.source_learning_candidate_id ?? null,
      ],
    );
  }

  async findPromptTemplateById(
    id: string,
  ): Promise<PromptTemplateRecord | undefined> {
    const result = await this.dependencies.client.query<PromptTemplateRow>(
      `
        select
          id,
          name,
          version,
          status,
          module,
          manuscript_types,
          rollback_target_version,
          source_learning_candidate_id
        from prompt_templates
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapPromptTemplateRow(result.rows[0]) : undefined;
  }

  async listPromptTemplates(): Promise<PromptTemplateRecord[]> {
    const result = await this.dependencies.client.query<PromptTemplateRow>(
      `
        select
          id,
          name,
          version,
          status,
          module,
          manuscript_types,
          rollback_target_version,
          source_learning_candidate_id
        from prompt_templates
        order by module asc, name asc, version asc, id asc
      `,
    );

    return result.rows.map(mapPromptTemplateRow);
  }

  async listPromptTemplatesByNameAndModule(
    name: string,
    module: PromptTemplateRecord["module"],
  ): Promise<PromptTemplateRecord[]> {
    const result = await this.dependencies.client.query<PromptTemplateRow>(
      `
        select
          id,
          name,
          version,
          status,
          module,
          manuscript_types,
          rollback_target_version,
          source_learning_candidate_id
        from prompt_templates
        where name = $1
          and module = $2
        order by module asc, name asc, version asc, id asc
      `,
      [name, module],
    );

    return result.rows.map(mapPromptTemplateRow);
  }
}

function mapPromptTemplateRow(row: PromptTemplateRow): PromptTemplateRecord {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    status: row.status,
    module: row.module,
    manuscript_types:
      row.manuscript_types == null
        ? "any"
        : decodeTextArray(row.manuscript_types) as ManuscriptType[],
    ...(row.rollback_target_version
      ? {
          rollback_target_version: row.rollback_target_version,
        }
      : {}),
    ...(row.source_learning_candidate_id
      ? {
          source_learning_candidate_id: row.source_learning_candidate_id,
        }
      : {}),
  };
}

function mapSkillPackageRow(row: SkillPackageRow): SkillPackageRecord {
  const appliesToModules = decodeTextArray(row.applies_to_modules) as SkillPackageRecord["applies_to_modules"];
  const dependencyTools = decodeTextArray(row.dependency_tools);

  return {
    id: row.id,
    name: row.name,
    version: row.version,
    scope: row.scope,
    status: row.status,
    applies_to_modules: appliesToModules,
    ...(dependencyTools.length > 0
      ? {
          dependency_tools: dependencyTools,
        }
      : {}),
    ...(row.source_learning_candidate_id
      ? {
          source_learning_candidate_id: row.source_learning_candidate_id,
        }
      : {}),
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
