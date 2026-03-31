import type { ToolGatewayToolRecord } from "./tool-gateway-record.ts";
import type { ToolGatewayRepository } from "./tool-gateway-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface ToolGatewayRow {
  id: string;
  name: string;
  scope: ToolGatewayToolRecord["scope"];
  access_mode: ToolGatewayToolRecord["access_mode"];
  admin_only: boolean;
}

export class PostgresToolGatewayRepository implements ToolGatewayRepository {
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async save(record: ToolGatewayToolRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into tool_gateway_tools (
          id,
          name,
          scope,
          access_mode,
          admin_only
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5
        )
        on conflict (id) do update
        set
          name = excluded.name,
          scope = excluded.scope,
          access_mode = excluded.access_mode,
          admin_only = excluded.admin_only,
          updated_at = now()
      `,
      [
        record.id,
        record.name,
        record.scope,
        record.access_mode,
        record.admin_only,
      ],
    );
  }

  async findById(id: string): Promise<ToolGatewayToolRecord | undefined> {
    const result = await this.dependencies.client.query<ToolGatewayRow>(
      `
        select
          id,
          name,
          scope,
          access_mode,
          admin_only
        from tool_gateway_tools
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapToolGatewayRow(result.rows[0]) : undefined;
  }

  async list(): Promise<ToolGatewayToolRecord[]> {
    const result = await this.dependencies.client.query<ToolGatewayRow>(
      `
        select
          id,
          name,
          scope,
          access_mode,
          admin_only
        from tool_gateway_tools
        order by scope asc, name asc, id asc
      `,
    );

    return result.rows.map(mapToolGatewayRow);
  }

  async listByScope(
    scope: ToolGatewayToolRecord["scope"],
  ): Promise<ToolGatewayToolRecord[]> {
    const result = await this.dependencies.client.query<ToolGatewayRow>(
      `
        select
          id,
          name,
          scope,
          access_mode,
          admin_only
        from tool_gateway_tools
        where scope = $1
        order by scope asc, name asc, id asc
      `,
      [scope],
    );

    return result.rows.map(mapToolGatewayRow);
  }
}

function mapToolGatewayRow(row: ToolGatewayRow): ToolGatewayToolRecord {
  return {
    id: row.id,
    name: row.name,
    scope: row.scope,
    access_mode: row.access_mode,
    admin_only: row.admin_only as true,
  };
}
