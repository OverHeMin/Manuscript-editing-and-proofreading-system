import type { ToolPermissionPolicyRecord } from "./tool-permission-policy-record.ts";
import type { ToolPermissionPolicyRepository } from "./tool-permission-policy-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface ToolPermissionPolicyRow {
  id: string;
  name: string;
  status: ToolPermissionPolicyRecord["status"];
  default_mode: ToolPermissionPolicyRecord["default_mode"];
  allowed_tool_ids: string[] | string;
  high_risk_tool_ids: string[] | string | null;
  write_requires_confirmation: boolean;
  admin_only: boolean;
}

export class PostgresToolPermissionPolicyRepository
  implements ToolPermissionPolicyRepository
{
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async save(record: ToolPermissionPolicyRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into tool_permission_policies (
          id,
          name,
          status,
          default_mode,
          allowed_tool_ids,
          high_risk_tool_ids,
          write_requires_confirmation,
          admin_only
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5::text[],
          $6::text[],
          $7,
          $8
        )
        on conflict (id) do update
        set
          name = excluded.name,
          status = excluded.status,
          default_mode = excluded.default_mode,
          allowed_tool_ids = excluded.allowed_tool_ids,
          high_risk_tool_ids = excluded.high_risk_tool_ids,
          write_requires_confirmation = excluded.write_requires_confirmation,
          admin_only = excluded.admin_only,
          updated_at = now()
      `,
      [
        record.id,
        record.name,
        record.status,
        record.default_mode,
        record.allowed_tool_ids,
        record.high_risk_tool_ids ?? null,
        record.write_requires_confirmation,
        record.admin_only,
      ],
    );
  }

  async findById(id: string): Promise<ToolPermissionPolicyRecord | undefined> {
    const result = await this.dependencies.client.query<ToolPermissionPolicyRow>(
      `
        select
          id,
          name,
          status,
          default_mode,
          allowed_tool_ids,
          high_risk_tool_ids,
          write_requires_confirmation,
          admin_only
        from tool_permission_policies
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapToolPermissionPolicyRow(result.rows[0]) : undefined;
  }

  async list(): Promise<ToolPermissionPolicyRecord[]> {
    const result = await this.dependencies.client.query<ToolPermissionPolicyRow>(
      `
        select
          id,
          name,
          status,
          default_mode,
          allowed_tool_ids,
          high_risk_tool_ids,
          write_requires_confirmation,
          admin_only
        from tool_permission_policies
        order by name asc, id asc
      `,
    );

    return result.rows.map(mapToolPermissionPolicyRow);
  }
}

function mapToolPermissionPolicyRow(
  row: ToolPermissionPolicyRow,
): ToolPermissionPolicyRecord {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    default_mode: row.default_mode,
    allowed_tool_ids: decodeTextArray(row.allowed_tool_ids),
    high_risk_tool_ids: decodeNullableTextArray(row.high_risk_tool_ids),
    write_requires_confirmation: row.write_requires_confirmation,
    admin_only: row.admin_only as true,
  };
}

function decodeNullableTextArray(value: string[] | string | null): string[] | undefined {
  if (value == null) {
    return undefined;
  }

  const decoded = decodeTextArray(value);
  return decoded.length > 0 ? decoded : [];
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
