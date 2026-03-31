import type { AgentRuntimeRecord } from "./agent-runtime-record.ts";
import type { AgentRuntimeRepository } from "./agent-runtime-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface AgentRuntimeRow {
  id: string;
  name: string;
  adapter: AgentRuntimeRecord["adapter"];
  status: AgentRuntimeRecord["status"];
  sandbox_profile_id: string | null;
  allowed_modules: AgentRuntimeRecord["allowed_modules"] | string;
  runtime_slot: string | null;
  admin_only: boolean;
}

export class PostgresAgentRuntimeRepository implements AgentRuntimeRepository {
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async save(record: AgentRuntimeRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into agent_runtimes (
          id,
          name,
          adapter,
          status,
          sandbox_profile_id,
          allowed_modules,
          runtime_slot,
          admin_only
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6::module_type[],
          $7,
          $8
        )
        on conflict (id) do update
        set
          name = excluded.name,
          adapter = excluded.adapter,
          status = excluded.status,
          sandbox_profile_id = excluded.sandbox_profile_id,
          allowed_modules = excluded.allowed_modules,
          runtime_slot = excluded.runtime_slot,
          admin_only = excluded.admin_only,
          updated_at = now()
      `,
      [
        record.id,
        record.name,
        record.adapter,
        record.status,
        record.sandbox_profile_id ?? null,
        record.allowed_modules,
        record.runtime_slot ?? null,
        record.admin_only,
      ],
    );
  }

  async findById(id: string): Promise<AgentRuntimeRecord | undefined> {
    const result = await this.dependencies.client.query<AgentRuntimeRow>(
      `
        select
          id,
          name,
          adapter,
          status,
          sandbox_profile_id,
          allowed_modules,
          runtime_slot,
          admin_only
        from agent_runtimes
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapAgentRuntimeRow(result.rows[0]) : undefined;
  }

  async list(): Promise<AgentRuntimeRecord[]> {
    const result = await this.dependencies.client.query<AgentRuntimeRow>(
      `
        select
          id,
          name,
          adapter,
          status,
          sandbox_profile_id,
          allowed_modules,
          runtime_slot,
          admin_only
        from agent_runtimes
        order by name asc, adapter asc, id asc
      `,
    );

    return result.rows.map(mapAgentRuntimeRow);
  }

  async listByModule(
    module: AgentRuntimeRecord["allowed_modules"][number],
    activeOnly = false,
  ): Promise<AgentRuntimeRecord[]> {
    const result = await this.dependencies.client.query<AgentRuntimeRow>(
      `
        select
          id,
          name,
          adapter,
          status,
          sandbox_profile_id,
          allowed_modules,
          runtime_slot,
          admin_only
        from agent_runtimes
        where $1::module_type = any(allowed_modules)
          and ($2::boolean = false or status = 'active')
        order by name asc, adapter asc, id asc
      `,
      [module, activeOnly],
    );

    return result.rows.map(mapAgentRuntimeRow);
  }
}

function mapAgentRuntimeRow(row: AgentRuntimeRow): AgentRuntimeRecord {
  return {
    id: row.id,
    name: row.name,
    adapter: row.adapter,
    status: row.status,
    sandbox_profile_id: row.sandbox_profile_id ?? undefined,
    allowed_modules: decodeTextArray(
      row.allowed_modules,
    ) as AgentRuntimeRecord["allowed_modules"],
    runtime_slot: row.runtime_slot ?? undefined,
    admin_only: row.admin_only as true,
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
