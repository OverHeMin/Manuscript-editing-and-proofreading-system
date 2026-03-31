import type {
  AuthSessionRecord,
  AuthSessionRepository,
  CreateAuthSessionInput,
} from "./auth-session-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface AuthSessionRow {
  id: string;
  user_id: string;
  provider: AuthSessionRecord["provider"];
  issued_at: Date;
  expires_at: Date;
  refresh_at: Date;
  ip_address: string | null;
  user_agent: string | null;
  revoked_at: Date | null;
}

export class PostgresAuthSessionRepository implements AuthSessionRepository {
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async create(input: CreateAuthSessionInput): Promise<AuthSessionRecord> {
    const result = await this.dependencies.client.query<AuthSessionRow>(
      `
        insert into auth_sessions (
          user_id,
          provider,
          issued_at,
          expires_at,
          refresh_at,
          ip_address,
          user_agent
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        returning
          id,
          user_id,
          provider,
          issued_at,
          expires_at,
          refresh_at,
          ip_address::text,
          user_agent,
          revoked_at
      `,
      [
        input.userId,
        input.provider,
        input.issuedAt,
        input.expiresAt,
        input.refreshAt,
        input.ipAddress ?? null,
        input.userAgent ?? null,
      ],
    );

    return mapAuthSessionRow(result.rows[0]!);
  }

  async findActiveById(sessionId: string, at: Date): Promise<AuthSessionRecord | null> {
    const result = await this.dependencies.client.query<AuthSessionRow>(
      `
        select
          id,
          user_id,
          provider,
          issued_at,
          expires_at,
          refresh_at,
          ip_address::text,
          user_agent,
          revoked_at
        from auth_sessions
        where id = $1
          and revoked_at is null
          and expires_at > $2
      `,
      [sessionId, at.toISOString()],
    );

    return result.rows[0] ? mapAuthSessionRow(result.rows[0]) : null;
  }

  async revoke(sessionId: string, revokedAt: string): Promise<void> {
    await this.dependencies.client.query(
      `
        update auth_sessions
        set revoked_at = coalesce(revoked_at, $2::timestamptz)
        where id = $1
      `,
      [sessionId, revokedAt],
    );
  }
}

function mapAuthSessionRow(row: AuthSessionRow): AuthSessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    issuedAt: row.issued_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    refreshAt: row.refresh_at.toISOString(),
    ipAddress: row.ip_address ?? undefined,
    userAgent: row.user_agent ?? undefined,
    revokedAt: row.revoked_at?.toISOString(),
  };
}
