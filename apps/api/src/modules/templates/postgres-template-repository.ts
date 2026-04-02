import type {
  ModuleTemplateRepository,
  TemplateFamilyRepository,
} from "./template-repository.ts";
import type {
  ModuleTemplateRecord,
  TemplateFamilyRecord,
  TemplateModule,
} from "./template-record.ts";
import { TemplateFamilyActiveConflictError } from "./template-governance-service.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface TemplateFamilyRow {
  id: string;
  manuscript_type: TemplateFamilyRecord["manuscript_type"];
  name: string;
  status: TemplateFamilyRecord["status"];
  created_at: Date;
}

interface ModuleTemplateRow {
  id: string;
  template_family_id: string;
  module: TemplateModule;
  manuscript_type: ModuleTemplateRecord["manuscript_type"];
  version_no: number;
  status: ModuleTemplateRecord["status"];
  prompt: string;
  checklist: string[] | string;
  section_requirements: string[] | string;
  source_learning_candidate_id: string | null;
  created_at: Date;
}

const activeTemplateFamilyConstraintName =
  "template_families_active_manuscript_type_uidx";

interface PostgresConstraintError {
  code?: string;
  constraint?: string;
}

export class PostgresTemplateFamilyRepository
  implements TemplateFamilyRepository
{
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async save(record: TemplateFamilyRecord): Promise<void> {
    try {
      await this.dependencies.client.query(
        `
          insert into template_families (
            id,
            manuscript_type,
            name,
            status
          )
          values ($1, $2, $3, $4)
          on conflict (id) do update
          set
            manuscript_type = excluded.manuscript_type,
            name = excluded.name,
            status = excluded.status,
            updated_at = now()
        `,
        [record.id, record.manuscript_type, record.name, record.status],
      );
    } catch (error) {
      if (isActiveTemplateFamilyConstraintError(error)) {
        throw new TemplateFamilyActiveConflictError(
          record.manuscript_type,
          record.id,
        );
      }

      throw error;
    }
  }

  async findById(id: string): Promise<TemplateFamilyRecord | undefined> {
    const result = await this.dependencies.client.query<TemplateFamilyRow>(
      `
        select
          id,
          manuscript_type,
          name,
          status,
          created_at
        from template_families
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapTemplateFamilyRow(result.rows[0]) : undefined;
  }

  async list(): Promise<TemplateFamilyRecord[]> {
    const result = await this.dependencies.client.query<TemplateFamilyRow>(
      `
        select
          id,
          manuscript_type,
          name,
          status,
          created_at
        from template_families
        order by created_at asc, id asc
      `,
    );

    return result.rows.map(mapTemplateFamilyRow);
  }
}

export class PostgresModuleTemplateRepository
  implements ModuleTemplateRepository
{
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async save(record: ModuleTemplateRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into module_templates (
          id,
          template_family_id,
          module,
          manuscript_type,
          version_no,
          status,
          prompt,
          checklist,
          section_requirements,
          source_learning_candidate_id
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
          $9::text[],
          $10
        )
        on conflict (id) do update
        set
          template_family_id = excluded.template_family_id,
          module = excluded.module,
          manuscript_type = excluded.manuscript_type,
          version_no = excluded.version_no,
          status = excluded.status,
          prompt = excluded.prompt,
          checklist = excluded.checklist,
          section_requirements = excluded.section_requirements,
          source_learning_candidate_id = excluded.source_learning_candidate_id,
          updated_at = now()
      `,
      [
        record.id,
        record.template_family_id,
        record.module,
        record.manuscript_type,
        record.version_no,
        record.status,
        record.prompt,
        record.checklist ?? [],
        record.section_requirements ?? [],
        record.source_learning_candidate_id ?? null,
      ],
    );
  }

  async findById(id: string): Promise<ModuleTemplateRecord | undefined> {
    const result = await this.dependencies.client.query<ModuleTemplateRow>(
      `
        select
          id,
          template_family_id,
          module,
          manuscript_type,
          version_no,
          status,
          prompt,
          checklist,
          section_requirements,
          source_learning_candidate_id,
          created_at
        from module_templates
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapModuleTemplateRow(result.rows[0]) : undefined;
  }

  async listByTemplateFamilyId(
    templateFamilyId: string,
  ): Promise<ModuleTemplateRecord[]> {
    const result = await this.dependencies.client.query<ModuleTemplateRow>(
      `
        select
          id,
          template_family_id,
          module,
          manuscript_type,
          version_no,
          status,
          prompt,
          checklist,
          section_requirements,
          source_learning_candidate_id,
          created_at
        from module_templates
        where template_family_id = $1
        order by version_no asc, id asc
      `,
      [templateFamilyId],
    );

    return result.rows.map(mapModuleTemplateRow);
  }

  async listByTemplateFamilyIdAndModule(
    templateFamilyId: string,
    module: TemplateModule,
  ): Promise<ModuleTemplateRecord[]> {
    const result = await this.dependencies.client.query<ModuleTemplateRow>(
      `
        select
          id,
          template_family_id,
          module,
          manuscript_type,
          version_no,
          status,
          prompt,
          checklist,
          section_requirements,
          source_learning_candidate_id,
          created_at
        from module_templates
        where template_family_id = $1
          and module = $2
        order by version_no asc, id asc
      `,
      [templateFamilyId, module],
    );

    return result.rows.map(mapModuleTemplateRow);
  }

  async reserveNextVersionNumber(
    templateFamilyId: string,
    module: TemplateModule,
  ): Promise<number> {
    await this.dependencies.client.query(
      `
        select pg_advisory_xact_lock(hashtext($1))
      `,
      [`module-template-version:${templateFamilyId}:${module}`],
    );

    const result = await this.dependencies.client.query<{ next_version_no: number }>(
      `
        select coalesce(max(version_no), 0) + 1 as next_version_no
        from module_templates
        where template_family_id = $1
          and module = $2
      `,
      [templateFamilyId, module],
    );

    return Number(result.rows[0]?.next_version_no ?? 1);
  }
}

function mapTemplateFamilyRow(row: TemplateFamilyRow): TemplateFamilyRecord {
  return {
    id: row.id,
    manuscript_type: row.manuscript_type,
    name: row.name,
    status: row.status,
  };
}

function mapModuleTemplateRow(row: ModuleTemplateRow): ModuleTemplateRecord {
  const checklist = decodeTextArray(row.checklist);
  const sectionRequirements = decodeTextArray(row.section_requirements);

  return {
    id: row.id,
    template_family_id: row.template_family_id,
    module: row.module,
    manuscript_type: row.manuscript_type,
    version_no: row.version_no,
    status: row.status,
    prompt: row.prompt,
    ...(checklist.length > 0 ? { checklist } : {}),
    ...(sectionRequirements.length > 0
      ? { section_requirements: sectionRequirements }
      : {}),
    ...(row.source_learning_candidate_id != null
      ? { source_learning_candidate_id: row.source_learning_candidate_id }
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

function isActiveTemplateFamilyConstraintError(
  error: unknown,
): error is PostgresConstraintError {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as PostgresConstraintError).code === "23505" &&
    (error as PostgresConstraintError).constraint ===
      activeTemplateFamilyConstraintName
  );
}
