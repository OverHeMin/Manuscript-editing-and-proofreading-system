import type { SandboxProfileRecord } from "./sandbox-profile-record.ts";
import type { SandboxProfileRepository } from "./sandbox-profile-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface SandboxProfileRow {
  id: string;
  name: string;
  status: SandboxProfileRecord["status"];
  sandbox_mode: SandboxProfileRecord["sandbox_mode"];
  network_access: boolean;
  approval_required: boolean;
  allowed_tool_ids: string[] | string | null;
  admin_only: boolean;
}

export class PostgresSandboxProfileRepository
  implements SandboxProfileRepository
{
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async save(record: SandboxProfileRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into sandbox_profiles (
          id,
          name,
          status,
          sandbox_mode,
          network_access,
          approval_required,
          allowed_tool_ids,
          admin_only
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7::text[],
          $8
        )
        on conflict (id) do update
        set
          name = excluded.name,
          status = excluded.status,
          sandbox_mode = excluded.sandbox_mode,
          network_access = excluded.network_access,
          approval_required = excluded.approval_required,
          allowed_tool_ids = excluded.allowed_tool_ids,
          admin_only = excluded.admin_only,
          updated_at = now()
      `,
      [
        record.id,
        record.name,
        record.status,
        record.sandbox_mode,
        record.network_access,
        record.approval_required,
        record.allowed_tool_ids ?? null,
        record.admin_only,
      ],
    );
  }

  async findById(id: string): Promise<SandboxProfileRecord | undefined> {
    const result = await this.dependencies.client.query<SandboxProfileRow>(
      `
        select
          id,
          name,
          status,
          sandbox_mode,
          network_access,
          approval_required,
          allowed_tool_ids,
          admin_only
        from sandbox_profiles
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapSandboxProfileRow(result.rows[0]) : undefined;
  }

  async list(): Promise<SandboxProfileRecord[]> {
    const result = await this.dependencies.client.query<SandboxProfileRow>(
      `
        select
          id,
          name,
          status,
          sandbox_mode,
          network_access,
          approval_required,
          allowed_tool_ids,
          admin_only
        from sandbox_profiles
        order by name asc, id asc
      `,
    );

    return result.rows.map(mapSandboxProfileRow);
  }
}

function mapSandboxProfileRow(row: SandboxProfileRow): SandboxProfileRecord {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    sandbox_mode: row.sandbox_mode,
    network_access: row.network_access,
    approval_required: row.approval_required,
    allowed_tool_ids: decodeNullableTextArray(row.allowed_tool_ids),
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
