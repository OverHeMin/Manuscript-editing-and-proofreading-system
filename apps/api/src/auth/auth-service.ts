import type { AuditService } from "../audit/audit-service.ts";
import type { PublicUser, UserRecord } from "../users/user.ts";
import type { UserRepository } from "../users/user-repository.ts";
import type { LoginAttemptStore } from "./login-attempt-store.ts";
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
  loginAttemptStore: LoginAttemptStore;
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
  private readonly loginAttemptStore: LoginAttemptStore;
  private readonly loginFailureLimit: number;
  private readonly lockoutWindowMs: number;
  private readonly sessionTtlMs: number;
  private readonly refreshIntervalMs: number;
  private readonly now: () => Date;

  constructor(options: AuthServiceOptions) {
    this.userRepository = options.userRepository;
    this.passwordHasher = options.passwordHasher;
    this.auditService = options.auditService;
    this.loginAttemptStore = options.loginAttemptStore;
    this.loginFailureLimit = options.loginFailureLimit ?? DEFAULT_LOGIN_FAILURE_LIMIT;
    this.lockoutWindowMs = options.lockoutWindowMs ?? DEFAULT_LOCKOUT_WINDOW_MS;
    this.sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
    this.refreshIntervalMs =
      options.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;
    this.now = options.now ?? (() => new Date());
  }

  async login(input: LoginInput, provider: AuthProviderName): Promise<AuthSession> {
    const username = normalizeUsername(input.username);
    const currentTime = this.now();
    const currentState = await this.loginAttemptStore.get(username, currentTime);

    if (currentState.lockedUntil && currentState.lockedUntil > currentTime.getTime()) {
      throw new AccountLockedError();
    }

    const user = await this.userRepository.findByUsername(username);
    const passwordMatches = user
      ? await this.passwordHasher.verify(input.password, user.passwordHash)
      : false;

    if (!user || !passwordMatches) {
      await this.loginAttemptStore.recordFailure({
        username,
        attemptedAt: currentTime,
        failureLimit: this.loginFailureLimit,
        lockoutWindowMs: this.lockoutWindowMs,
      });
      throw new InvalidCredentialsError();
    }

    await this.loginAttemptStore.clear(username, currentTime);

    const session = this.buildSession(user, provider);
    await this.auditService.record({
      actorId: user.id,
      roleKey: user.role,
      action: "auth.login",
      targetTable: "users",
      targetId: user.id,
      occurredAt: session.issuedAt,
      metadata: {
        authProvider: provider,
        username: user.username,
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return session;
  }

  private buildSession(user: UserRecord, provider: AuthProviderName): AuthSession {
    const issuedAt = this.now();

    return {
      provider,
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
}
