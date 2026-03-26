import type { AuditService } from "../audit/audit-service.ts";
import type { PublicUser, UserRecord } from "../users/user.ts";
import type { UserRepository } from "../users/user-repository.ts";
import type { AuthProviderName } from "./provider.ts";
import type { PasswordHasher } from "./password-hasher.ts";
import {
  DEFAULT_LOCKOUT_WINDOW_MS,
  DEFAULT_LOGIN_FAILURE_LIMIT,
  DEFAULT_REFRESH_INTERVAL_MS,
  DEFAULT_SESSION_TTL_MS,
} from "./session-policy.ts";

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

interface LoginState {
  failures: number;
  lockedUntil?: number;
}

export interface LoginInput {
  username: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthSession {
  provider: AuthProviderName;
  user: PublicUser;
  issuedAt: string;
  expiresAt: string;
  refreshAt: string;
}

export interface AuthServiceOptions {
  userRepository: UserRepository;
  passwordHasher: PasswordHasher;
  auditService: AuditService;
  loginFailureLimit?: number;
  lockoutWindowMs?: number;
  sessionTtlMs?: number;
  refreshIntervalMs?: number;
  now?: () => Date;
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid username or password.");
    this.name = "InvalidCredentialsError";
  }
}

export class AccountLockedError extends Error {
  constructor() {
    super("Account is temporarily locked after repeated failed login attempts.");
    this.name = "AccountLockedError";
  }
}

export class AuthService {
  private readonly userRepository: UserRepository;
  private readonly passwordHasher: PasswordHasher;
  private readonly auditService: AuditService;
  private readonly loginFailureLimit: number;
  private readonly lockoutWindowMs: number;
  private readonly sessionTtlMs: number;
  private readonly refreshIntervalMs: number;
  private readonly now: () => Date;
  private readonly loginStates = new Map<string, LoginState>();

  constructor(options: AuthServiceOptions) {
    this.userRepository = options.userRepository;
    this.passwordHasher = options.passwordHasher;
    this.auditService = options.auditService;
    this.loginFailureLimit = options.loginFailureLimit ?? DEFAULT_LOGIN_FAILURE_LIMIT;
    this.lockoutWindowMs = options.lockoutWindowMs ?? DEFAULT_LOCKOUT_WINDOW_MS;
    this.sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
    this.refreshIntervalMs =
      options.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;
    this.now = options.now ?? (() => new Date());
  }

  async login(input: LoginInput): Promise<AuthSession> {
    const username = normalizeUsername(input.username);
    const currentTime = this.now().getTime();
    const currentState = this.getLoginState(username, currentTime);

    if (currentState.lockedUntil && currentState.lockedUntil > currentTime) {
      throw new AccountLockedError();
    }

    const user = await this.userRepository.findByUsername(username);
    const passwordMatches = user
      ? await this.passwordHasher.verify(input.password, user.passwordHash)
      : false;

    if (!user || !passwordMatches) {
      this.recordFailure(username, currentState, currentTime);
      throw new InvalidCredentialsError();
    }

    this.loginStates.delete(username);

    const session = this.buildSession(user);
    await this.auditService.record({
      actorId: user.id,
      roleKey: user.role,
      action: "auth.login",
      targetTable: "users",
      targetId: user.id,
      occurredAt: session.issuedAt,
      metadata: {
        authProvider: "local",
        username: user.username,
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return session;
  }

  private buildSession(user: UserRecord): AuthSession {
    const issuedAt = this.now();

    return {
      provider: "local",
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
      issuedAt: issuedAt.toISOString(),
      expiresAt: new Date(issuedAt.getTime() + this.sessionTtlMs).toISOString(),
      refreshAt: new Date(issuedAt.getTime() + this.refreshIntervalMs).toISOString(),
    };
  }

  private getLoginState(username: string, currentTime: number): LoginState {
    const state = this.loginStates.get(username);

    if (!state) {
      return { failures: 0 };
    }

    if (state.lockedUntil && state.lockedUntil <= currentTime) {
      this.loginStates.delete(username);
      return { failures: 0 };
    }

    return state;
  }

  private recordFailure(username: string, state: LoginState, currentTime: number): void {
    const nextFailures = state.failures + 1;
    this.loginStates.set(username, {
      failures: nextFailures,
      lockedUntil:
        nextFailures >= this.loginFailureLimit
          ? currentTime + this.lockoutWindowMs
          : state.lockedUntil,
    });
  }
}
