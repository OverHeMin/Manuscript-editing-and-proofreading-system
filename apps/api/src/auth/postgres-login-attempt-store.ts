import type {
  LoginAttemptState,
  LoginAttemptStore,
  RecordLoginFailureInput,
} from "./login-attempt-store.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface LoginAttemptRow {
  username: string;
  failure_count: number;
  first_failed_at: Date;
  last_failed_at: Date;
  locked_until: Date | null;
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export class PostgresLoginAttemptStore implements LoginAttemptStore {
  private readonly tails = new Map<string, Promise<void>>();

  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async get(username: string, at: Date): Promise<LoginAttemptState> {
    return this.withSerializedAccess(username, () => this.readState(username, at));
  }

  async recordFailure(input: RecordLoginFailureInput): Promise<LoginAttemptState> {
    return this.withSerializedAccess(input.username, async () => {
      const currentState = await this.readState(input.username, input.recordedAt);
      const nextFailures = currentState.failures + 1;
      const nextLockedUntil =
        nextFailures >= input.failureLimit
          ? input.recordedAt.getTime() + input.lockoutWindowMs
          : currentState.lockedUntil;

      await this.dependencies.client.query(
        `
          insert into login_attempts (
            username,
            failure_count,
            first_failed_at,
            last_failed_at,
            locked_until
          )
          values ($1, $2, $3, $4, $5)
          on conflict (username) do update
          set
            failure_count = excluded.failure_count,
            first_failed_at = excluded.first_failed_at,
            last_failed_at = excluded.last_failed_at,
            locked_until = excluded.locked_until
        `,
        [
          normalizeUsername(input.username),
          nextFailures,
          input.recordedAt.toISOString(),
          input.recordedAt.toISOString(),
          nextLockedUntil ? new Date(nextLockedUntil).toISOString() : null,
        ],
      );

      return toLoginAttemptState(nextFailures, nextLockedUntil);
    });
  }

  async clear(username: string, at: Date): Promise<void> {
    await this.withSerializedAccess(username, async () => {
      await this.readState(username, at);
      await this.dependencies.client.query(
        `
          delete from login_attempts
          where username = $1
        `,
        [normalizeUsername(username)],
      );
    });
  }

  private async readState(username: string, at: Date): Promise<LoginAttemptState> {
    const result = await this.dependencies.client.query<LoginAttemptRow>(
      `
        select
          username,
          failure_count,
          first_failed_at,
          last_failed_at,
          locked_until
        from login_attempts
        where username = $1
      `,
      [normalizeUsername(username)],
    );

    const row = result.rows[0];
    if (!row) {
      return { failures: 0 };
    }

    if (row.locked_until && row.locked_until.getTime() <= at.getTime()) {
      await this.dependencies.client.query(
        `
          delete from login_attempts
          where username = $1
        `,
        [normalizeUsername(username)],
      );
      return { failures: 0 };
    }

    return toLoginAttemptState(row.failure_count, row.locked_until?.getTime());
  }

  private async withSerializedAccess<T>(
    username: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const key = normalizeUsername(username);
    const previousTail = this.tails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const currentLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    const nextTail = previousTail.catch(() => undefined).then(() => currentLock);

    this.tails.set(key, nextTail);
    await previousTail.catch(() => undefined);

    try {
      return await operation();
    } finally {
      release();

      if (this.tails.get(key) === nextTail) {
        this.tails.delete(key);
      }
    }
  }
}

function toLoginAttemptState(
  failures: number,
  lockedUntil?: number,
): LoginAttemptState {
  return lockedUntil
    ? {
        failures,
        lockedUntil,
      }
    : { failures };
}
