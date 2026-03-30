import type { UserRecord } from "./user.ts";
import type { UserRepository } from "./user-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  role_key: UserRecord["role"];
  password_hash: string;
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async findById(id: string): Promise<UserRecord | null> {
    const result = await this.dependencies.client.query<UserRow>(
      `
        select id, username, display_name, role_key, password_hash
        from users
        where id = $1
          and status = 'active'
      `,
      [id],
    );

    return result.rows[0] ? mapUserRow(result.rows[0]) : null;
  }

  async findByUsername(username: string): Promise<UserRecord | null> {
    const result = await this.dependencies.client.query<UserRow>(
      `
        select id, username, display_name, role_key, password_hash
        from users
        where username = $1
          and status = 'active'
      `,
      [normalizeUsername(username)],
    );

    return result.rows[0] ? mapUserRow(result.rows[0]) : null;
  }

  async save(user: UserRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into users (
          id,
          username,
          display_name,
          role_key,
          password_hash,
          status
        )
        values ($1, $2, $3, $4, $5, 'active')
        on conflict (id) do update
        set
          username = excluded.username,
          display_name = excluded.display_name,
          role_key = excluded.role_key,
          password_hash = excluded.password_hash,
          status = 'active',
          updated_at = now()
      `,
      [
        user.id,
        normalizeUsername(user.username),
        user.displayName,
        user.role,
        user.passwordHash,
      ],
    );
  }
}

function mapUserRow(row: UserRow): UserRecord {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role_key,
    passwordHash: row.password_hash,
  };
}
