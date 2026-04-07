import type { RoleKey } from "./roles.ts";
import type {
  UserAdminRecord,
  UserAdminRepository,
  UserAdminStatus,
} from "./user-admin-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface UserAdminRow {
  id: string;
  username: string;
  display_name: string;
  role_key: RoleKey;
  status: UserAdminStatus;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export class PostgresUserAdminRepository implements UserAdminRepository {
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async listAll(): Promise<UserAdminRecord[]> {
    const result = await this.dependencies.client.query<UserAdminRow>(
      `
        select
          id,
          username,
          display_name,
          role_key,
          status,
          password_hash,
          created_at,
          updated_at
        from users
        order by username asc
      `,
    );

    return result.rows.map(mapUserAdminRow);
  }

  async findByIdIncludingDisabled(userId: string): Promise<UserAdminRecord | null> {
    const result = await this.dependencies.client.query<UserAdminRow>(
      `
        select
          id,
          username,
          display_name,
          role_key,
          status,
          password_hash,
          created_at,
          updated_at
        from users
        where id = $1
      `,
      [userId],
    );

    return result.rows[0] ? mapUserAdminRow(result.rows[0]) : null;
  }

  async findByUsernameIncludingDisabled(username: string): Promise<UserAdminRecord | null> {
    const result = await this.dependencies.client.query<UserAdminRow>(
      `
        select
          id,
          username,
          display_name,
          role_key,
          status,
          password_hash,
          created_at,
          updated_at
        from users
        where username = $1
      `,
      [normalizeUsername(username)],
    );

    return result.rows[0] ? mapUserAdminRow(result.rows[0]) : null;
  }

  async create(record: UserAdminRecord): Promise<UserAdminRecord> {
    const result = await this.dependencies.client.query<UserAdminRow>(
      `
        insert into users (
          id,
          username,
          display_name,
          role_key,
          status,
          password_hash,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning
          id,
          username,
          display_name,
          role_key,
          status,
          password_hash,
          created_at,
          updated_at
      `,
      [
        record.id,
        normalizeUsername(record.username),
        record.displayName,
        record.role,
        record.status,
        record.passwordHash,
        record.createdAt,
        record.updatedAt,
      ],
    );

    return mapUserAdminRow(result.rows[0]!);
  }

  async updateProfile(input: {
    userId: string;
    displayName: string;
    role: RoleKey;
    updatedAt: string;
  }): Promise<UserAdminRecord> {
    const result = await this.dependencies.client.query<UserAdminRow>(
      `
        update users
        set
          display_name = $2,
          role_key = $3,
          updated_at = $4
        where id = $1
        returning
          id,
          username,
          display_name,
          role_key,
          status,
          password_hash,
          created_at,
          updated_at
      `,
      [input.userId, input.displayName, input.role, input.updatedAt],
    );

    return mapUserAdminRow(result.rows[0]!);
  }

  async updatePasswordHash(input: {
    userId: string;
    passwordHash: string;
    updatedAt: string;
  }): Promise<UserAdminRecord> {
    const result = await this.dependencies.client.query<UserAdminRow>(
      `
        update users
        set
          password_hash = $2,
          updated_at = $3
        where id = $1
        returning
          id,
          username,
          display_name,
          role_key,
          status,
          password_hash,
          created_at,
          updated_at
      `,
      [input.userId, input.passwordHash, input.updatedAt],
    );

    return mapUserAdminRow(result.rows[0]!);
  }

  async updateStatus(input: {
    userId: string;
    status: UserAdminStatus;
    updatedAt: string;
  }): Promise<UserAdminRecord> {
    const result = await this.dependencies.client.query<UserAdminRow>(
      `
        update users
        set
          status = $2,
          updated_at = $3
        where id = $1
        returning
          id,
          username,
          display_name,
          role_key,
          status,
          password_hash,
          created_at,
          updated_at
      `,
      [input.userId, input.status, input.updatedAt],
    );

    return mapUserAdminRow(result.rows[0]!);
  }

  async countActiveAdmins(excludingUserId?: string): Promise<number> {
    const result = excludingUserId
      ? await this.dependencies.client.query<{ count: string }>(
          `
            select count(*)::text as count
            from users
            where status = 'active'
              and role_key = 'admin'
              and id <> $1
          `,
          [excludingUserId],
        )
      : await this.dependencies.client.query<{ count: string }>(
          `
            select count(*)::text as count
            from users
            where status = 'active'
              and role_key = 'admin'
          `,
        );

    return Number(result.rows[0]?.count ?? "0");
  }
}

function mapUserAdminRow(row: UserAdminRow): UserAdminRecord {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role_key,
    status: row.status,
    passwordHash: row.password_hash,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
