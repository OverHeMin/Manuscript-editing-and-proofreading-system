import type {
  GovernedContentModuleRepository,
  ModuleTemplateRepository,
  TemplateCompositionRepository,
  TemplateFamilyRepository,
} from "./template-repository.ts";
import type {
  GovernedContentModuleRecord,
  JournalTemplateProfileRecord,
  ModuleTemplateRecord,
  TemplateCompositionRecord,
  TemplateFamilyRecord,
  TemplateModule,
} from "./template-record.ts";
import {
  JournalTemplateProfileKeyConflictError,
  TemplateFamilyActiveConflictError,
} from "./template-governance-service.ts";
import type { RuleEvidenceExample } from "@medical/contracts";

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

interface JournalTemplateProfileRow {
  id: string;
  template_family_id: string;
  journal_key: string;
  journal_name: string;
  status: JournalTemplateProfileRecord["status"];
  created_at: Date;
}

interface GovernedContentModuleRow {
  id: string;
  module_class: GovernedContentModuleRecord["module_class"];
  name: string;
  category: string;
  manuscript_type_scope: GovernedContentModuleRecord["manuscript_type_scope"] | string;
  execution_module_scope: GovernedContentModuleRecord["execution_module_scope"] | string;
  applicable_sections: string[] | string;
  summary: string;
  guidance: string[] | string;
  examples: RuleExampleRow[] | string;
  evidence_level: GovernedContentModuleRecord["evidence_level"] | null;
  risk_level: GovernedContentModuleRecord["risk_level"] | null;
  source_task_id: string | null;
  source_candidate_id: string | null;
  status: GovernedContentModuleRecord["status"];
  created_at: Date;
  updated_at: Date;
}

interface RuleExampleRow {
  before: string;
  after: string;
  note?: string;
}

interface TemplateCompositionRow {
  id: string;
  name: string;
  manuscript_type: TemplateCompositionRecord["manuscript_type"];
  journal_scope: string | null;
  general_module_ids: string[] | string;
  medical_module_ids: string[] | string;
  execution_module_scope: TemplateCompositionRecord["execution_module_scope"] | string;
  notes: string | null;
  source_task_id: string | null;
  source_candidate_ids: string[] | string;
  version_no: number;
  status: TemplateCompositionRecord["status"];
  created_at: Date;
  updated_at: Date;
}

const activeTemplateFamilyConstraintName =
  "template_families_active_manuscript_type_uidx";
const journalTemplateProfileFamilyKeyConstraintName =
  "journal_template_profiles_template_family_journal_key_key";

interface PostgresConstraintError {
  code?: string;
  constraint?: string;
}

export class PostgresTemplateFamilyRepository
  implements
    TemplateFamilyRepository,
    GovernedContentModuleRepository,
    TemplateCompositionRepository
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

  async saveJournalTemplateProfile(
    record: JournalTemplateProfileRecord,
  ): Promise<void> {
    try {
      await this.dependencies.client.query(
        `
          insert into journal_template_profiles (
            id,
            template_family_id,
            journal_key,
            journal_name,
            status
          )
          values ($1, $2, $3, $4, $5)
          on conflict (id) do update
          set
            template_family_id = excluded.template_family_id,
            journal_key = excluded.journal_key,
            journal_name = excluded.journal_name,
            status = excluded.status,
            updated_at = now()
        `,
        [
          record.id,
          record.template_family_id,
          record.journal_key,
          record.journal_name,
          record.status,
        ],
      );
    } catch (error) {
      if (isJournalTemplateFamilyKeyConstraintError(error)) {
        throw new JournalTemplateProfileKeyConflictError(
          record.template_family_id,
          record.journal_key,
        );
      }

      throw error;
    }
  }

  async findJournalTemplateProfileById(
    id: string,
  ): Promise<JournalTemplateProfileRecord | undefined> {
    const result = await this.dependencies.client.query<JournalTemplateProfileRow>(
      `
        select
          id,
          template_family_id,
          journal_key,
          journal_name,
          status,
          created_at
        from journal_template_profiles
        where id = $1
      `,
      [id],
    );

    return result.rows[0]
      ? mapJournalTemplateProfileRow(result.rows[0])
      : undefined;
  }

  async findJournalTemplateProfileByTemplateFamilyIdAndJournalKey(
    templateFamilyId: string,
    journalKey: string,
  ): Promise<JournalTemplateProfileRecord | undefined> {
    const result = await this.dependencies.client.query<JournalTemplateProfileRow>(
      `
        select
          id,
          template_family_id,
          journal_key,
          journal_name,
          status,
          created_at
        from journal_template_profiles
        where template_family_id = $1
          and journal_key = $2
      `,
      [templateFamilyId, journalKey],
    );

    return result.rows[0]
      ? mapJournalTemplateProfileRow(result.rows[0])
      : undefined;
  }

  async listJournalTemplateProfilesByTemplateFamilyId(
    templateFamilyId: string,
  ): Promise<JournalTemplateProfileRecord[]> {
    const result = await this.dependencies.client.query<JournalTemplateProfileRow>(
      `
        select
          id,
          template_family_id,
          journal_key,
          journal_name,
          status,
          created_at
        from journal_template_profiles
        where template_family_id = $1
        order by created_at asc, id asc
      `,
      [templateFamilyId],
    );

    return result.rows.map(mapJournalTemplateProfileRow);
  }

  async saveContentModule(record: GovernedContentModuleRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into governed_content_modules (
          id,
          module_class,
          name,
          category,
          manuscript_type_scope,
          execution_module_scope,
          applicable_sections,
          summary,
          guidance,
          examples,
          evidence_level,
          risk_level,
          source_task_id,
          source_candidate_id,
          status
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5::manuscript_type[],
          $6::module_type[],
          $7::text[],
          $8,
          $9::text[],
          $10::jsonb,
          $11,
          $12,
          $13,
          $14,
          $15
        )
        on conflict (id) do update
        set
          module_class = excluded.module_class,
          name = excluded.name,
          category = excluded.category,
          manuscript_type_scope = excluded.manuscript_type_scope,
          execution_module_scope = excluded.execution_module_scope,
          applicable_sections = excluded.applicable_sections,
          summary = excluded.summary,
          guidance = excluded.guidance,
          examples = excluded.examples,
          evidence_level = excluded.evidence_level,
          risk_level = excluded.risk_level,
          source_task_id = excluded.source_task_id,
          source_candidate_id = excluded.source_candidate_id,
          status = excluded.status,
          updated_at = now()
      `,
      [
        record.id,
        record.module_class,
        record.name,
        record.category,
        record.manuscript_type_scope,
        record.execution_module_scope,
        record.applicable_sections ?? [],
        record.summary,
        record.guidance ?? [],
        JSON.stringify(record.examples ?? []),
        record.evidence_level ?? null,
        record.risk_level ?? null,
        record.source_task_id ?? null,
        record.source_candidate_id ?? null,
        record.status,
      ],
    );
  }

  async findContentModuleById(
    id: string,
  ): Promise<GovernedContentModuleRecord | undefined> {
    const result = await this.dependencies.client.query<GovernedContentModuleRow>(
      `
        select
          id,
          module_class,
          name,
          category,
          manuscript_type_scope,
          execution_module_scope,
          applicable_sections,
          summary,
          guidance,
          examples,
          evidence_level,
          risk_level,
          source_task_id,
          source_candidate_id,
          status,
          created_at,
          updated_at
        from governed_content_modules
        where id = $1
      `,
      [id],
    );

    return result.rows[0]
      ? mapGovernedContentModuleRow(result.rows[0])
      : undefined;
  }

  async listContentModules(input?: {
    moduleClass?: GovernedContentModuleRecord["module_class"];
  }): Promise<GovernedContentModuleRecord[]> {
    const result = await this.dependencies.client.query<GovernedContentModuleRow>(
      `
        select
          id,
          module_class,
          name,
          category,
          manuscript_type_scope,
          execution_module_scope,
          applicable_sections,
          summary,
          guidance,
          examples,
          evidence_level,
          risk_level,
          source_task_id,
          source_candidate_id,
          status,
          created_at,
          updated_at
        from governed_content_modules
        where ($1::text is null or module_class = $1)
        order by created_at asc, id asc
      `,
      [input?.moduleClass ?? null],
    );

    return result.rows.map(mapGovernedContentModuleRow);
  }

  async saveTemplateComposition(record: TemplateCompositionRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into template_compositions (
          id,
          name,
          manuscript_type,
          journal_scope,
          general_module_ids,
          medical_module_ids,
          execution_module_scope,
          notes,
          source_task_id,
          source_candidate_ids,
          version_no,
          status
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5::uuid[],
          $6::uuid[],
          $7::module_type[],
          $8,
          $9,
          $10::uuid[],
          $11,
          $12
        )
        on conflict (id) do update
        set
          name = excluded.name,
          manuscript_type = excluded.manuscript_type,
          journal_scope = excluded.journal_scope,
          general_module_ids = excluded.general_module_ids,
          medical_module_ids = excluded.medical_module_ids,
          execution_module_scope = excluded.execution_module_scope,
          notes = excluded.notes,
          source_task_id = excluded.source_task_id,
          source_candidate_ids = excluded.source_candidate_ids,
          version_no = excluded.version_no,
          status = excluded.status,
          updated_at = now()
      `,
      [
        record.id,
        record.name,
        record.manuscript_type,
        record.journal_scope ?? null,
        record.general_module_ids,
        record.medical_module_ids,
        record.execution_module_scope,
        record.notes ?? null,
        record.source_task_id ?? null,
        record.source_candidate_ids ?? [],
        record.version_no,
        record.status,
      ],
    );
  }

  async findTemplateCompositionById(
    id: string,
  ): Promise<TemplateCompositionRecord | undefined> {
    const result = await this.dependencies.client.query<TemplateCompositionRow>(
      `
        select
          id,
          name,
          manuscript_type,
          journal_scope,
          general_module_ids,
          medical_module_ids,
          execution_module_scope,
          notes,
          source_task_id,
          source_candidate_ids,
          version_no,
          status,
          created_at,
          updated_at
        from template_compositions
        where id = $1
      `,
      [id],
    );

    return result.rows[0]
      ? mapTemplateCompositionRow(result.rows[0])
      : undefined;
  }

  async listTemplateCompositions(): Promise<TemplateCompositionRecord[]> {
    const result = await this.dependencies.client.query<TemplateCompositionRow>(
      `
        select
          id,
          name,
          manuscript_type,
          journal_scope,
          general_module_ids,
          medical_module_ids,
          execution_module_scope,
          notes,
          source_task_id,
          source_candidate_ids,
          version_no,
          status,
          created_at,
          updated_at
        from template_compositions
        order by created_at asc, id asc
      `,
    );

    return result.rows.map(mapTemplateCompositionRow);
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

function mapJournalTemplateProfileRow(
  row: JournalTemplateProfileRow,
): JournalTemplateProfileRecord {
  return {
    id: row.id,
    template_family_id: row.template_family_id,
    journal_key: row.journal_key,
    journal_name: row.journal_name,
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

function mapGovernedContentModuleRow(
  row: GovernedContentModuleRow,
): GovernedContentModuleRecord {
  const applicableSections = decodeTextArray(row.applicable_sections);
  const guidance = decodeTextArray(row.guidance);

  return {
    id: row.id,
    module_class: row.module_class,
    name: row.name,
    category: row.category,
    manuscript_type_scope: decodeTypedTextArray<GovernedContentModuleRecord["manuscript_type_scope"][number]>(
      row.manuscript_type_scope,
    ),
    execution_module_scope: decodeTypedTextArray<GovernedContentModuleRecord["execution_module_scope"][number]>(
      row.execution_module_scope,
    ),
    ...(applicableSections.length > 0
      ? { applicable_sections: applicableSections }
      : {}),
    summary: row.summary,
    ...(guidance.length > 0 ? { guidance } : {}),
    ...(decodeRuleExamples(row.examples).length > 0
      ? { examples: decodeRuleExamples(row.examples) }
      : {}),
    ...(row.evidence_level ? { evidence_level: row.evidence_level } : {}),
    ...(row.risk_level ? { risk_level: row.risk_level } : {}),
    ...(row.source_task_id ? { source_task_id: row.source_task_id } : {}),
    ...(row.source_candidate_id
      ? { source_candidate_id: row.source_candidate_id }
      : {}),
    status: row.status,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function mapTemplateCompositionRow(
  row: TemplateCompositionRow,
): TemplateCompositionRecord {
  const sourceCandidateIds = decodeTextArray(row.source_candidate_ids);

  return {
    id: row.id,
    name: row.name,
    manuscript_type: row.manuscript_type,
    ...(row.journal_scope ? { journal_scope: row.journal_scope } : {}),
    general_module_ids: decodeTextArray(row.general_module_ids),
    medical_module_ids: decodeTextArray(row.medical_module_ids),
    execution_module_scope: decodeTypedTextArray<TemplateCompositionRecord["execution_module_scope"][number]>(
      row.execution_module_scope,
    ),
    ...(row.notes ? { notes: row.notes } : {}),
    ...(row.source_task_id ? { source_task_id: row.source_task_id } : {}),
    ...(sourceCandidateIds.length > 0
      ? { source_candidate_ids: sourceCandidateIds }
      : {}),
    version_no: row.version_no,
    status: row.status,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
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

function decodeTypedTextArray<T extends string>(value: string[] | string): T[] {
  return decodeTextArray(value) as T[];
}

function decodeRuleExamples(value: RuleExampleRow[] | string): RuleEvidenceExample[] {
  if (Array.isArray(value)) {
    return value.map((example) => ({ ...example }));
  }

  if (!value || value.trim().length === 0) {
    return [];
  }

  return JSON.parse(value) as RuleEvidenceExample[];
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

function isJournalTemplateFamilyKeyConstraintError(
  error: unknown,
): error is PostgresConstraintError {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as PostgresConstraintError).code === "23505" &&
    (error as PostgresConstraintError).constraint ===
      journalTemplateProfileFamilyKeyConstraintName
  );
}
