import type { RuntimeBindingRecord } from "./runtime-binding-record.ts";
import type { RuntimeBindingRepository } from "./runtime-binding-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface RuntimeBindingRow {
  id: string;
  module: RuntimeBindingRecord["module"];
  manuscript_type: RuntimeBindingRecord["manuscript_type"];
  template_family_id: string;
  runtime_id: string;
  sandbox_profile_id: string;
  agent_profile_id: string;
  tool_permission_policy_id: string;
  prompt_template_id: string;
  skill_package_ids: string[] | string;
  execution_profile_id: string | null;
  status: RuntimeBindingRecord["status"];
  version: number;
}

export class PostgresRuntimeBindingRepository implements RuntimeBindingRepository {
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async save(record: RuntimeBindingRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into runtime_bindings (
          id,
          module,
          manuscript_type,
          template_family_id,
          runtime_id,
          sandbox_profile_id,
          agent_profile_id,
          tool_permission_policy_id,
          prompt_template_id,
          skill_package_ids,
          execution_profile_id,
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
          $12,
          $13
        )
        on conflict (id) do update
        set
          module = excluded.module,
          manuscript_type = excluded.manuscript_type,
          template_family_id = excluded.template_family_id,
          runtime_id = excluded.runtime_id,
          sandbox_profile_id = excluded.sandbox_profile_id,
          agent_profile_id = excluded.agent_profile_id,
          tool_permission_policy_id = excluded.tool_permission_policy_id,
          prompt_template_id = excluded.prompt_template_id,
          skill_package_ids = excluded.skill_package_ids,
          execution_profile_id = excluded.execution_profile_id,
          status = excluded.status,
          version = excluded.version,
          updated_at = now()
      `,
      [
        record.id,
        record.module,
        record.manuscript_type,
        record.template_family_id,
        record.runtime_id,
        record.sandbox_profile_id,
        record.agent_profile_id,
        record.tool_permission_policy_id,
        record.prompt_template_id,
        record.skill_package_ids,
        record.execution_profile_id ?? null,
        record.status,
        record.version,
      ],
    );
  }

  async findById(id: string): Promise<RuntimeBindingRecord | undefined> {
    const result = await this.dependencies.client.query<RuntimeBindingRow>(
      `
        select
          id,
          module,
          manuscript_type,
          template_family_id,
          runtime_id,
          sandbox_profile_id,
          agent_profile_id,
          tool_permission_policy_id,
          prompt_template_id,
          skill_package_ids,
          execution_profile_id,
          status,
          version
        from runtime_bindings
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapRuntimeBindingRow(result.rows[0]) : undefined;
  }

  async list(): Promise<RuntimeBindingRecord[]> {
    const result = await this.dependencies.client.query<RuntimeBindingRow>(
      `
        select
          id,
          module,
          manuscript_type,
          template_family_id,
          runtime_id,
          sandbox_profile_id,
          agent_profile_id,
          tool_permission_policy_id,
          prompt_template_id,
          skill_package_ids,
          execution_profile_id,
          status,
          version
        from runtime_bindings
        order by module asc, manuscript_type asc, template_family_id asc, version asc, id asc
      `,
    );

    return result.rows.map(mapRuntimeBindingRow);
  }

  async listByScope(
    module: RuntimeBindingRecord["module"],
    manuscriptType: RuntimeBindingRecord["manuscript_type"],
    templateFamilyId: RuntimeBindingRecord["template_family_id"],
    activeOnly = false,
  ): Promise<RuntimeBindingRecord[]> {
    const result = await this.dependencies.client.query<RuntimeBindingRow>(
      `
        select
          id,
          module,
          manuscript_type,
          template_family_id,
          runtime_id,
          sandbox_profile_id,
          agent_profile_id,
          tool_permission_policy_id,
          prompt_template_id,
          skill_package_ids,
          execution_profile_id,
          status,
          version
        from runtime_bindings
        where module = $1
          and manuscript_type = $2
          and template_family_id = $3
          and ($4::boolean = false or status = 'active')
        order by module asc, manuscript_type asc, template_family_id asc, version asc, id asc
      `,
      [module, manuscriptType, templateFamilyId, activeOnly],
    );

    return result.rows.map(mapRuntimeBindingRow);
  }

  async reserveNextVersion(
    module: RuntimeBindingRecord["module"],
    manuscriptType: RuntimeBindingRecord["manuscript_type"],
    templateFamilyId: RuntimeBindingRecord["template_family_id"],
  ): Promise<number> {
    await this.dependencies.client.query(
      `
        select pg_advisory_xact_lock(hashtext($1))
      `,
      [`runtime-binding-version:${module}:${manuscriptType}:${templateFamilyId}`],
    );

    const result = await this.dependencies.client.query<{ next_version: number }>(
      `
        select coalesce(max(version), 0) + 1 as next_version
        from runtime_bindings
        where module = $1
          and manuscript_type = $2
          and template_family_id = $3
      `,
      [module, manuscriptType, templateFamilyId],
    );

    return Number(result.rows[0]?.next_version ?? 1);
  }
}

function mapRuntimeBindingRow(row: RuntimeBindingRow): RuntimeBindingRecord {
  return {
    id: row.id,
    module: row.module,
    manuscript_type: row.manuscript_type,
    template_family_id: row.template_family_id,
    runtime_id: row.runtime_id,
    sandbox_profile_id: row.sandbox_profile_id,
    agent_profile_id: row.agent_profile_id,
    tool_permission_policy_id: row.tool_permission_policy_id,
    prompt_template_id: row.prompt_template_id,
    skill_package_ids: decodeTextArray(row.skill_package_ids),
    execution_profile_id: row.execution_profile_id ?? undefined,
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
