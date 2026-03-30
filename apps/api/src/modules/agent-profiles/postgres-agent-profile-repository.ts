import type { AgentProfileRecord } from "./agent-profile-record.ts";
import type { AgentProfileRepository } from "./agent-profile-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface AgentProfileRow {
  id: string;
  name: string;
  role_key: AgentProfileRecord["role_key"];
  status: AgentProfileRecord["status"];
  module_scope: string[] | string | null;
  manuscript_types: string[] | string | null;
  description: string | null;
  admin_only: boolean;
}

export class PostgresAgentProfileRepository implements AgentProfileRepository {
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async save(record: AgentProfileRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into agent_profiles (
          id,
          name,
          role_key,
          status,
          module_scope,
          manuscript_types,
          description,
          admin_only
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5::module_type[],
          $6::manuscript_type[],
          $7,
          $8
        )
        on conflict (id) do update
        set
          name = excluded.name,
          role_key = excluded.role_key,
          status = excluded.status,
          module_scope = excluded.module_scope,
          manuscript_types = excluded.manuscript_types,
          description = excluded.description,
          admin_only = excluded.admin_only,
          updated_at = now()
      `,
      [
        record.id,
        record.name,
        record.role_key,
        record.status,
        record.module_scope === "any" ? null : record.module_scope,
        record.manuscript_types === "any" ? null : record.manuscript_types,
        record.description ?? null,
        record.admin_only,
      ],
    );
  }

  async findById(id: string): Promise<AgentProfileRecord | undefined> {
    const result = await this.dependencies.client.query<AgentProfileRow>(
      `
        select
          id,
          name,
          role_key,
          status,
          module_scope,
          manuscript_types,
          description,
          admin_only
        from agent_profiles
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapAgentProfileRow(result.rows[0]) : undefined;
  }

  async list(): Promise<AgentProfileRecord[]> {
    const result = await this.dependencies.client.query<AgentProfileRow>(
      `
        select
          id,
          name,
          role_key,
          status,
          module_scope,
          manuscript_types,
          description,
          admin_only
        from agent_profiles
        order by role_key asc, name asc, id asc
      `,
    );

    return result.rows.map(mapAgentProfileRow);
  }
}

function mapAgentProfileRow(row: AgentProfileRow): AgentProfileRecord {
  return {
    id: row.id,
    name: row.name,
    role_key: row.role_key,
    status: row.status,
    module_scope:
      row.module_scope == null
        ? "any"
        : (decodeTextArray(row.module_scope) as AgentProfileRecord["module_scope"]),
    manuscript_types:
      row.manuscript_types == null
        ? "any"
        : (decodeTextArray(
            row.manuscript_types,
          ) as AgentProfileRecord["manuscript_types"]),
    description: row.description ?? undefined,
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
