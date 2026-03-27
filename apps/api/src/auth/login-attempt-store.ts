interface LoginAttemptStateRecord {
  failures: number;
  lockedUntil?: number;
}

export interface LoginAttemptState {
  failures: number;
  lockedUntil?: number;
}

export interface RecordLoginFailureInput {
  username: string;
  recordedAt: Date;
  failureLimit: number;
  lockoutWindowMs: number;
}

export interface LoginAttemptStore {
  get(username: string, at: Date): Promise<LoginAttemptState>;
  recordFailure(input: RecordLoginFailureInput): Promise<LoginAttemptState>;
  clear(username: string, at: Date): Promise<void>;
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export class InMemoryLoginAttemptStore implements LoginAttemptStore {
  private readonly states = new Map<string, LoginAttemptStateRecord>();
  private readonly tails = new Map<string, Promise<void>>();

  async get(username: string, at: Date): Promise<LoginAttemptState> {
    return this.withSerializedAccess(username, () => this.readState(username, at));
  }

  async recordFailure(input: RecordLoginFailureInput): Promise<LoginAttemptState> {
    return this.withSerializedAccess(input.username, () => {
      const currentState = this.readState(input.username, input.recordedAt);
      const nextFailures = currentState.failures + 1;
      const nextLockedUntil =
        nextFailures >= input.failureLimit
          ? input.recordedAt.getTime() + input.lockoutWindowMs
          : currentState.lockedUntil;
      const nextState: LoginAttemptStateRecord = {
        failures: nextFailures,
        lockedUntil: Math.max(currentState.lockedUntil ?? 0, nextLockedUntil ?? 0) || undefined,
      };

      this.states.set(normalizeUsername(input.username), nextState);
      return { ...nextState };
    });
  }

  async clear(username: string, at: Date): Promise<void> {
    await this.withSerializedAccess(username, () => {
      this.readState(username, at);
      this.states.delete(normalizeUsername(username));
    });
  }

  private readState(username: string, at: Date): LoginAttemptState {
    const key = normalizeUsername(username);
    const state = this.states.get(key);

    if (!state) {
      return { failures: 0 };
    }

    if (state.lockedUntil && state.lockedUntil <= at.getTime()) {
      this.states.delete(key);
      return { failures: 0 };
    }

    return { ...state };
  }

  private async withSerializedAccess<T>(
    username: string,
    operation: () => T | Promise<T>,
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
