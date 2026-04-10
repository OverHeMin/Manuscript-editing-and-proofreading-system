import type {
  AiProviderConnectionRecord,
  AiProviderConnectionTestStatus,
  AiProviderCredentialRecord,
} from "./ai-provider-connection-record.ts";
import type { AiProviderConnectionRepository } from "./ai-provider-connection-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface AiProviderConnectionRow {
  id: string;
  name: string;
  provider_kind: string;
  compatibility_mode: string;
  base_url: string;
  enabled: boolean;
  connection_metadata: Record<string, unknown> | null;
  last_test_status: AiProviderConnectionTestStatus;
  last_test_at: Date | string | null;
  last_error_summary: string | null;
  credential_mask: string | null;
  credential_version: number | null;
}

interface AiProviderCredentialRow {
  id: string;
  connection_id: string;
  credential_ciphertext: string;
  credential_mask: string;
  credential_version: number;
  last_rotated_at: Date | string;
}

export class PostgresAiProviderConnectionRepository
  implements AiProviderConnectionRepository
{
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async save(record: AiProviderConnectionRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into ai_provider_connections (
          id,
          name,
          provider_kind,
          compatibility_mode,
          base_url,
          enabled,
          connection_metadata,
          last_test_status,
          last_test_at,
          last_error_summary
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7::jsonb,
          $8::ai_provider_test_status,
          $9,
          $10
        )
        on conflict (id) do update
        set
          name = excluded.name,
          provider_kind = excluded.provider_kind,
          compatibility_mode = excluded.compatibility_mode,
          base_url = excluded.base_url,
          enabled = excluded.enabled,
          connection_metadata = excluded.connection_metadata,
          last_test_status = excluded.last_test_status,
          last_test_at = excluded.last_test_at,
          last_error_summary = excluded.last_error_summary,
          updated_at = now()
      `,
      [
        record.id,
        record.name,
        record.provider_kind,
        record.compatibility_mode,
        normalizeBaseUrl(record.base_url),
        record.enabled,
        record.connection_metadata ?? {},
        record.last_test_status ?? "unknown",
        record.last_test_at ?? null,
        record.last_error_summary ?? null,
      ],
    );
  }

  async findById(id: string): Promise<AiProviderConnectionRecord | undefined> {
    const result = await this.dependencies.client.query<AiProviderConnectionRow>(
      selectConnectionSql(`
        where c.id = $1
      `),
      [id],
    );

    return result.rows[0] ? mapConnectionRow(result.rows[0]) : undefined;
  }

  async list(): Promise<AiProviderConnectionRecord[]> {
    const result = await this.dependencies.client.query<AiProviderConnectionRow>(
      selectConnectionSql(`
        order by c.provider_kind asc, c.name asc, c.id asc
      `),
    );

    return result.rows.map(mapConnectionRow);
  }

  async saveCredential(
    record: AiProviderCredentialRecord,
  ): Promise<AiProviderCredentialRecord> {
    const result = await this.dependencies.client.query<AiProviderCredentialRow>(
      `
        insert into ai_provider_credentials (
          id,
          connection_id,
          credential_ciphertext,
          credential_mask,
          credential_version,
          last_rotated_at
        )
        values ($1, $2, $3, $4, $5, $6)
        on conflict (connection_id) do update
        set
          id = excluded.id,
          credential_ciphertext = excluded.credential_ciphertext,
          credential_mask = excluded.credential_mask,
          credential_version = greatest(
            excluded.credential_version,
            ai_provider_credentials.credential_version + 1
          ),
          last_rotated_at = excluded.last_rotated_at,
          updated_at = now()
        returning
          id,
          connection_id,
          credential_ciphertext,
          credential_mask,
          credential_version,
          last_rotated_at
      `,
      [
        record.id,
        record.connection_id,
        record.credential_ciphertext,
        record.credential_mask,
        record.credential_version ?? 1,
        record.last_rotated_at,
      ],
    );

    const persisted = result.rows[0];
    if (!persisted) {
      throw new Error(
        `Failed to persist credentials for ai provider connection ${record.connection_id}.`,
      );
    }

    return mapCredentialRow(persisted);
  }

  async findCredentialByConnectionId(
    connectionId: string,
  ): Promise<AiProviderCredentialRecord | undefined> {
    const result = await this.dependencies.client.query<AiProviderCredentialRow>(
      `
        select
          id,
          connection_id,
          credential_ciphertext,
          credential_mask,
          credential_version,
          last_rotated_at
        from ai_provider_credentials
        where connection_id = $1
      `,
      [connectionId],
    );

    return result.rows[0] ? mapCredentialRow(result.rows[0]) : undefined;
  }

  async updateConnectionTestStatus(input: {
    connection_id: string;
    status: AiProviderConnectionTestStatus;
    error_summary?: string;
    tested_at: Date;
  }): Promise<void> {
    const result = await this.dependencies.client.query(
      `
        update ai_provider_connections
        set
          last_test_status = $2::ai_provider_test_status,
          last_test_at = $3,
          last_error_summary = $4,
          updated_at = now()
        where id = $1
      `,
      [
        input.connection_id,
        input.status,
        input.tested_at,
        input.error_summary ?? null,
      ],
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new Error(
        `Cannot update test status for unknown ai provider connection ${input.connection_id}.`,
      );
    }
  }
}

function selectConnectionSql(suffix: string): string {
  return `
    select
      c.id,
      c.name,
      c.provider_kind,
      c.compatibility_mode,
      c.base_url,
      c.enabled,
      c.connection_metadata,
      c.last_test_status,
      c.last_test_at,
      c.last_error_summary,
      cred.credential_mask,
      cred.credential_version
    from ai_provider_connections c
    left join ai_provider_credentials cred
      on cred.connection_id = c.id
    ${suffix}
  `;
}

function mapConnectionRow(row: AiProviderConnectionRow): AiProviderConnectionRecord {
  return {
    id: row.id,
    name: row.name,
    provider_kind: row.provider_kind,
    compatibility_mode: row.compatibility_mode,
    base_url: row.base_url,
    enabled: row.enabled,
    connection_metadata: row.connection_metadata ? { ...row.connection_metadata } : {},
    last_test_status: row.last_test_status,
    ...(row.last_test_at ? { last_test_at: new Date(row.last_test_at) } : {}),
    ...(row.last_error_summary
      ? { last_error_summary: row.last_error_summary }
      : {}),
    ...(row.credential_mask && row.credential_version !== null
      ? {
          credential_summary: {
            mask: row.credential_mask,
            version: row.credential_version,
          },
        }
      : {}),
  };
}

function mapCredentialRow(row: AiProviderCredentialRow): AiProviderCredentialRecord {
  return {
    id: row.id,
    connection_id: row.connection_id,
    credential_ciphertext: row.credential_ciphertext,
    credential_mask: row.credential_mask,
    credential_version: row.credential_version,
    last_rotated_at: new Date(row.last_rotated_at),
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/u, "");
  return normalized.length > 0 ? normalized : baseUrl;
}
