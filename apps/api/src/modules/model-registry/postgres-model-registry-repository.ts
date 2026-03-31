import type {
  ModelRegistryRecord,
  ModelRoutingPolicyRecord,
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
}

interface ModelRoutingPolicyRow {
  system_default_model_id: string | null;
  module_defaults: ModelRoutingPolicyRecord["module_defaults"] | null;
  template_overrides: ModelRoutingPolicyRecord["template_overrides"] | null;
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
          fallback_model_id
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
          $9
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
          fallback_model_id
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
          fallback_model_id
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
          fallback_model_id
        from model_registry
        order by provider::text asc, model_name asc, model_version asc, id asc
      `,
    );

    return result.rows.map(mapModelRegistryRow);
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
