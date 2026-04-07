import { randomUUID } from "node:crypto";
import type { AuditService } from "../audit/audit-service.ts";
import type { AuthSessionRepository } from "../auth/auth-session-repository.ts";
import type { LoginAttemptStore } from "../auth/login-attempt-store.ts";
import type { PasswordHasher } from "../auth/password-hasher.ts";
import type { RoleKey } from "./roles.ts";
import type {
  UserAdminRecord,
  UserAdminRepository,
} from "./user-admin-repository.ts";

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export class UserAdminNotFoundError extends Error {
  constructor(userId: string) {
    super(`User "${userId}" was not found.`);
    this.name = "UserAdminNotFoundError";
  }
}

export class DuplicateUsernameError extends Error {
  constructor(username: string) {
    super(`Username "${username}" already exists.`);
    this.name = "DuplicateUsernameError";
  }
}

export class LastActiveAdminDisableError extends Error {
  constructor() {
    super("The last active admin cannot be disabled.");
    this.name = "LastActiveAdminDisableError";
  }
}

export class LastActiveAdminDemotionError extends Error {
  constructor() {
    super("The last active admin cannot be demoted to a non-admin role.");
    this.name = "LastActiveAdminDemotionError";
  }
}

export interface UserAdminServiceOptions {
  repository: UserAdminRepository;
  authSessionRepository: AuthSessionRepository;
  loginAttemptStore: LoginAttemptStore;
  auditService: AuditService;
  passwordHasher: PasswordHasher;
  now?: () => Date;
  createId?: () => string;
}

export class UserAdminService {
  private readonly repository: UserAdminRepository;
  private readonly authSessionRepository: AuthSessionRepository;
  private readonly loginAttemptStore: LoginAttemptStore;
  private readonly auditService: AuditService;
  private readonly passwordHasher: PasswordHasher;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: UserAdminServiceOptions) {
    this.repository = options.repository;
    this.authSessionRepository = options.authSessionRepository;
    this.loginAttemptStore = options.loginAttemptStore;
    this.auditService = options.auditService;
    this.passwordHasher = options.passwordHasher;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  listUsers(): Promise<UserAdminRecord[]> {
    return this.repository.listAll();
  }

  async createUser(input: {
    actorId?: string;
    actorRole?: RoleKey;
    username: string;
    displayName: string;
    role: RoleKey;
    password: string;
  }): Promise<UserAdminRecord> {
    const normalizedUsername = normalizeUsername(input.username);
    const existing = await this.repository.findByUsernameIncludingDisabled(normalizedUsername);
    if (existing) {
      throw new DuplicateUsernameError(normalizedUsername);
    }

    const timestamp = this.now().toISOString();
    const created = await this.repository.create({
      id: this.createId(),
      username: normalizedUsername,
      displayName: input.displayName.trim(),
      role: input.role,
      status: "active",
      passwordHash: await this.passwordHasher.hash(input.password),
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await this.recordAudit({
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: "system-settings.user.create",
      targetUser: created,
      metadata: {
        resultingRole: created.role,
        resultingStatus: created.status,
      },
    });

    return created;
  }

  async updateUserProfile(input: {
    actorId?: string;
    actorRole?: RoleKey;
    userId: string;
    displayName: string;
    role: RoleKey;
  }): Promise<UserAdminRecord> {
    const current = await this.requireUser(input.userId);
    if (
      current.role === "admin" &&
      current.status === "active" &&
      input.role !== "admin" &&
      (await this.repository.countActiveAdmins(current.id)) === 0
    ) {
      throw new LastActiveAdminDemotionError();
    }

    const updated = await this.repository.updateProfile({
      userId: input.userId,
      displayName: input.displayName.trim(),
      role: input.role,
      updatedAt: this.now().toISOString(),
    });

    await this.recordAudit({
      actorId: input.actorId,
      actorRole: input.actorRole,
      action:
        current.role !== updated.role
          ? "system-settings.user.role-change"
          : "system-settings.user.profile-update",
      targetUser: updated,
      metadata: {
        previousRole: current.role,
        resultingRole: updated.role,
      },
    });

    return updated;
  }

  async resetPassword(input: {
    actorId?: string;
    actorRole?: RoleKey;
    userId: string;
    nextPassword: string;
  }): Promise<UserAdminRecord> {
    const current = await this.requireUser(input.userId);
    const timestamp = this.now();
    const updated = await this.repository.updatePasswordHash({
      userId: input.userId,
      passwordHash: await this.passwordHasher.hash(input.nextPassword),
      updatedAt: timestamp.toISOString(),
    });

    await this.authSessionRepository.revokeAllForUser(input.userId, timestamp.toISOString());
    await this.loginAttemptStore.clear(current.username, timestamp);
    await this.recordAudit({
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: "system-settings.user.password-reset",
      targetUser: updated,
    });

    return updated;
  }

  async disableUser(input: {
    actorId?: string;
    actorRole?: RoleKey;
    userId: string;
  }): Promise<UserAdminRecord> {
    const current = await this.requireUser(input.userId);
    if (
      current.role === "admin" &&
      current.status === "active" &&
      (await this.repository.countActiveAdmins(current.id)) === 0
    ) {
      throw new LastActiveAdminDisableError();
    }

    const timestamp = this.now();
    const updated = await this.repository.updateStatus({
      userId: input.userId,
      status: "disabled",
      updatedAt: timestamp.toISOString(),
    });

    await this.authSessionRepository.revokeAllForUser(input.userId, timestamp.toISOString());
    await this.loginAttemptStore.clear(current.username, timestamp);
    await this.recordAudit({
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: "system-settings.user.disable",
      targetUser: updated,
      metadata: {
        previousStatus: current.status,
        resultingStatus: updated.status,
      },
    });

    return updated;
  }

  async enableUser(input: {
    actorId?: string;
    actorRole?: RoleKey;
    userId: string;
  }): Promise<UserAdminRecord> {
    const current = await this.requireUser(input.userId);
    const timestamp = this.now();
    const updated = await this.repository.updateStatus({
      userId: input.userId,
      status: "active",
      updatedAt: timestamp.toISOString(),
    });

    await this.loginAttemptStore.clear(current.username, timestamp);
    await this.recordAudit({
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: "system-settings.user.enable",
      targetUser: updated,
      metadata: {
        previousStatus: current.status,
        resultingStatus: updated.status,
      },
    });

    return updated;
  }

  private async requireUser(userId: string): Promise<UserAdminRecord> {
    const user = await this.repository.findByIdIncludingDisabled(userId);
    if (!user) {
      throw new UserAdminNotFoundError(userId);
    }

    return user;
  }

  private async recordAudit(input: {
    actorId?: string;
    actorRole?: RoleKey;
    action: string;
    targetUser: UserAdminRecord;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.auditService.record({
      actorId: input.actorId,
      roleKey: input.actorRole,
      action: input.action,
      targetTable: "users",
      targetId: input.targetUser.id,
      occurredAt: this.now().toISOString(),
      metadata: {
        username: input.targetUser.username,
        ...input.metadata,
      },
    });
  }
}
