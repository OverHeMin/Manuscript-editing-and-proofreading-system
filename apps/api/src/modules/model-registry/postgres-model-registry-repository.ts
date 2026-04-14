import type {
  ModelRegistryRecord,
  ModelRoutingPolicyRecord,
  SystemSettingsModelRecord,
} from "./model-record.ts";
import type {
  ModelRegistryRepository,
  ModelRoutingPolicyRepository,
} from "./model-registry-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface ModelRegistryRow {
  id: string;
  provider: ModelRegistryRecord["provider"];
  model_name: string;
  model_version: string;
  allowed_modules: ModelRegistryRecord["allowed_modules"] | string;
  is_prod_allowed: boolean;
  cost_profile: ModelRegistryRecord["cost_profile"] | null;
  rate_limit: ModelRegistryRecord["rate_limit"] | null;
  fallback_model_id: string | null;
  connection_id: string | null;
}

interface ModelRoutingPolicyRow {
  system_default_model_id: string | null;
  module_defaults: ModelRoutingPolicyRecord["module_defaults"] | null;
  template_overrides: ModelRoutingPolicyRecord["template_overrides"] | null;
}

interface SystemSettingsModelRow extends ModelRegistryRow {
  connection_name: string | null;
  fallback_model_name: string | null;
}

export class PostgresModelRegistryRepository
  implements ModelRegistryRepository
{
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async save(record: ModelRegistryRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into model_registry (
          id,
          provider,
          model_name,
          model_version,
          allowed_modules,
          is_prod_allowed,
          cost_profile,
          rate_limit,
          fallback_model_id,
          connection_id
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5::module_type[],
          $6,
          $7::jsonb,
          $8::jsonb,
          $9,
          $10
        )
        on conflict (id) do update
        set
          provider = excluded.provider,
          model_name = excluded.model_name,
          model_version = excluded.model_version,
          allowed_modules = excluded.allowed_modules,
          is_prod_allowed = excluded.is_prod_allowed,
          cost_profile = excluded.cost_profile,
          rate_limit = excluded.rate_limit,
          fallback_model_id = excluded.fallback_model_id,
          connection_id = excluded.connection_id,
          updated_at = now()
      `,
      [
        record.id,
        record.provider,
        record.model_name,
        record.model_version,
        record.allowed_modules,
        record.is_prod_allowed,
        record.cost_profile ?? null,
        record.rate_limit ?? null,
        record.fallback_model_id ?? null,
        record.connection_id ?? null,
      ],
    );
  }

  async findById(id: string): Promise<ModelRegistryRecord | undefined> {
    const result = await this.dependencies.client.query<ModelRegistryRow>(
      `
        select
          id,
          provider,
          model_name,
          model_version,
          allowed_modules,
          is_prod_allowed,
          cost_profile,
          rate_limit,
          fallback_model_id,
          connection_id
        from model_registry
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapModelRegistryRow(result.rows[0]) : undefined;
  }

  async findByProviderModelVersion(
    provider: ModelRegistryRecord["provider"],
    modelName: string,
    modelVersion: string,
  ): Promise<ModelRegistryRecord | undefined> {
    const result = await this.dependencies.client.query<ModelRegistryRow>(
      `
        select
          id,
          provider,
          model_name,
          model_version,
          allowed_modules,
          is_prod_allowed,
          cost_profile,
          rate_limit,
          fallback_model_id,
          connection_id
        from model_registry
        where provider = $1
          and model_name = $2
          and model_version = $3
      `,
      [provider, modelName, modelVersion],
    );

    return result.rows[0] ? mapModelRegistryRow(result.rows[0]) : undefined;
  }

  async list(): Promise<ModelRegistryRecord[]> {
    const result = await this.dependencies.client.query<ModelRegistryRow>(
      `
        select
          id,
          provider,
          model_name,
          model_version,
          allowed_modules,
          is_prod_allowed,
          cost_profile,
          rate_limit,
          fallback_model_id,
          connection_id
        from model_registry
        order by provider::text asc, model_name asc, model_version asc, id asc
      `,
    );

    return result.rows.map(mapModelRegistryRow);
  }

  async listSystemSettingsModels(): Promise<SystemSettingsModelRecord[]> {
    const result = await this.dependencies.client.query<SystemSettingsModelRow>(
      `
        select
          m.id,
          m.provider,
          m.model_name,
          m.model_version,
          m.allowed_modules,
          m.is_prod_allowed,
          m.cost_profile,
          m.rate_limit,
          m.fallback_model_id,
          m.connection_id,
          connection_record.name as connection_name,
          fallback_record.model_name as fallback_model_name
        from model_registry m
        left join ai_provider_connections connection_record
          on connection_record.id = m.connection_id
        left join model_registry fallback_record
          on fallback_record.id = m.fallback_model_id
        order by m.provider::text asc, m.model_name asc, m.model_version asc, m.id asc
      `,
    );

    return result.rows.map(mapSystemSettingsModelRow);
  }
}

export class PostgresModelRoutingPolicyRepository
  implements ModelRoutingPolicyRepository
{
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async get(): Promise<ModelRoutingPolicyRecord> {
    const result = await this.dependencies.client.query<ModelRoutingPolicyRow>(
      `
        select
          system_default_model_id,
          module_defaults,
          template_overrides
        from model_routing_policies
        where singleton_key = 'default'
      `,
    );

    return result.rows[0]
      ? mapModelRoutingPolicyRow(result.rows[0])
      : {
          system_default_model_id: undefined,
          module_defaults: {},
          template_overrides: {},
        };
  }

  async save(record: ModelRoutingPolicyRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into model_routing_policies (
          singleton_key,
          system_default_model_id,
          module_defaults,
          template_overrides
        )
        values (
          'default',
          $1,
          $2::jsonb,
          $3::jsonb
        )
        on conflict (singleton_key) do update
        set
          system_default_model_id = excluded.system_default_model_id,
          module_defaults = excluded.module_defaults,
          template_overrides = excluded.template_overrides,
          updated_at = now()
      `,
      [
        record.system_default_model_id ?? null,
        record.module_defaults,
        record.template_overrides,
      ],
    );
  }
}

function mapModelRegistryRow(row: ModelRegistryRow): ModelRegistryRecord {
  return {
    id: row.id,
    provider: row.provider,
    model_name: row.model_name,
    model_version: row.model_version,
    allowed_modules: decodeTextArray(
      row.allowed_modules,
    ) as ModelRegistryRecord["allowed_modules"],
    is_prod_allowed: row.is_prod_allowed,
    ...(row.cost_profile ? { cost_profile: { ...row.cost_profile } } : {}),
    ...(row.rate_limit ? { rate_limit: { ...row.rate_limit } } : {}),
    ...(row.fallback_model_id
      ? { fallback_model_id: row.fallback_model_id }
      : {}),
    ...(row.connection_id ? { connection_id: row.connection_id } : {}),
  };
}

function mapSystemSettingsModelRow(
  row: SystemSettingsModelRow,
): SystemSettingsModelRecord {
  return {
    ...mapModelRegistryRow(row),
    ...(row.connection_name ? { connection_name: row.connection_name } : {}),
    ...(row.fallback_model_name
      ? { fallback_model_name: row.fallback_model_name }
      : {}),
  };
}

function mapModelRoutingPolicyRow(
  row: ModelRoutingPolicyRow,
): ModelRoutingPolicyRecord {
  return {
    ...(row.system_default_model_id
      ? { system_default_model_id: row.system_default_model_id }
      : {}),
    module_defaults: { ...(row.module_defaults ?? {}) },
    template_overrides: { ...(row.template_overrides ?? {}) },
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
