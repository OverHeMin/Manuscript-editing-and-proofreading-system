import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryAuditService } from "../../src/audit/audit-service.ts";
import { InMemoryLoginAttemptStore } from "../../src/auth/login-attempt-store.ts";
import { BcryptPasswordHasher } from "../../src/auth/password-hasher.ts";
import type {
  AuthSessionRecord,
  AuthSessionRepository,
} from "../../src/auth/auth-session-repository.ts";
import type { RoleKey } from "../../src/users/roles.ts";
import {
  LastActiveAdminDisableError,
  LastActiveAdminDemotionError,
  UserAdminService,
} from "../../src/users/user-admin-service.ts";
import type {
  UserAdminRecord,
  UserAdminRepository,
} from "../../src/users/user-admin-repository.ts";

test("user admin service creates a user with normalized username and hashed password", async () => {
  const repository = new InMemoryUserAdminRepository();
  const sessionRepository = new RecordingAuthSessionRepository();
  const auditService = new InMemoryAuditService();
  const loginAttemptStore = new InMemoryLoginAttemptStore();
  const service = new UserAdminService({
    repository,
    authSessionRepository: sessionRepository,
    loginAttemptStore,
    auditService,
    passwordHasher: new BcryptPasswordHasher({ rounds: 4 }),
    now: () => new Date("2026-04-07T10:00:00.000Z"),
    createId: () => "user-created-1",
  });

  const created = await service.createUser({
    actorId: "admin-1",
    actorRole: "admin",
    username: " Editor.Alice ",
    displayName: "Alice Editor",
    role: "editor",
    password: "pass-1234",
  });

  assert.equal(created.id, "user-created-1");
  assert.equal(created.username, "editor.alice");
  assert.equal(created.displayName, "Alice Editor");
  assert.equal(created.role, "editor");
  assert.equal(created.status, "active");

  const stored = await repository.findByIdIncludingDisabled("user-created-1");
  assert.ok(stored);
  assert.equal(stored.username, "editor.alice");
  assert.notEqual(stored.passwordHash, "pass-1234");
  assert.equal(
    await new BcryptPasswordHasher({ rounds: 4 }).verify("pass-1234", stored.passwordHash),
    true,
  );
  assert.equal(sessionRepository.revokedUserIds.length, 0);
  assert.equal(auditService.list().at(-1)?.action, "system-settings.user.create");
});

test("user admin service resets password and revokes active sessions", async () => {
  const repository = new InMemoryUserAdminRepository([
    createUserRecord({
      id: "user-reset-1",
      username: "reset.user",
      role: "editor",
    }),
  ]);
  const sessionRepository = new RecordingAuthSessionRepository();
  const auditService = new InMemoryAuditService();
  const loginAttemptStore = new InMemoryLoginAttemptStore();
  const service = new UserAdminService({
    repository,
    authSessionRepository: sessionRepository,
    loginAttemptStore,
    auditService,
    passwordHasher: new BcryptPasswordHasher({ rounds: 4 }),
    now: () => new Date("2026-04-07T10:05:00.000Z"),
    createId: () => "unused",
  });

  await loginAttemptStore.recordFailure({
    username: "reset.user",
    recordedAt: new Date("2026-04-07T10:00:00.000Z"),
    failureLimit: 3,
    lockoutWindowMs: 60_000,
  });

  const updated = await service.resetPassword({
    actorId: "admin-1",
    actorRole: "admin",
    userId: "user-reset-1",
    nextPassword: "new-secret",
  });

  assert.equal(updated.id, "user-reset-1");
  assert.deepEqual(sessionRepository.revokedUserIds, ["user-reset-1"]);
  assert.deepEqual(
    await loginAttemptStore.get("reset.user", new Date("2026-04-07T10:06:00.000Z")),
    { failures: 0 },
  );
  assert.equal(auditService.list().at(-1)?.action, "system-settings.user.password-reset");
});

test("user admin service disables a user, revokes sessions, and clears login attempts", async () => {
  const repository = new InMemoryUserAdminRepository([
    createUserRecord({
      id: "admin-1",
      username: "admin.one",
      role: "admin",
    }),
    createUserRecord({
      id: "user-disable-1",
      username: "disable.user",
      role: "proofreader",
    }),
  ]);
  const sessionRepository = new RecordingAuthSessionRepository();
  const auditService = new InMemoryAuditService();
  const loginAttemptStore = new InMemoryLoginAttemptStore();
  const service = new UserAdminService({
    repository,
    authSessionRepository: sessionRepository,
    loginAttemptStore,
    auditService,
    passwordHasher: new BcryptPasswordHasher({ rounds: 4 }),
    now: () => new Date("2026-04-07T10:10:00.000Z"),
    createId: () => "unused",
  });

  await loginAttemptStore.recordFailure({
    username: "disable.user",
    recordedAt: new Date("2026-04-07T10:08:00.000Z"),
    failureLimit: 3,
    lockoutWindowMs: 60_000,
  });

  const disabled = await service.disableUser({
    actorId: "admin-1",
    actorRole: "admin",
    userId: "user-disable-1",
  });

  assert.equal(disabled.status, "disabled");
  assert.deepEqual(sessionRepository.revokedUserIds, ["user-disable-1"]);
  assert.deepEqual(
    await loginAttemptStore.get("disable.user", new Date("2026-04-07T10:11:00.000Z")),
    { failures: 0 },
  );
  assert.equal(auditService.list().at(-1)?.action, "system-settings.user.disable");
});

test("user admin service rejects disabling the last active admin", async () => {
  const repository = new InMemoryUserAdminRepository([
    createUserRecord({
      id: "admin-last-1",
      username: "last.admin",
      role: "admin",
    }),
  ]);
  const service = new UserAdminService({
    repository,
    authSessionRepository: new RecordingAuthSessionRepository(),
    loginAttemptStore: new InMemoryLoginAttemptStore(),
    auditService: new InMemoryAuditService(),
    passwordHasher: new BcryptPasswordHasher({ rounds: 4 }),
    now: () => new Date("2026-04-07T10:15:00.000Z"),
    createId: () => "unused",
  });

  await assert.rejects(
    () =>
      service.disableUser({
        actorId: "admin-last-1",
        actorRole: "admin",
        userId: "admin-last-1",
      }),
    LastActiveAdminDisableError,
  );
});

test("user admin service rejects demoting the last active admin", async () => {
  const repository = new InMemoryUserAdminRepository([
    createUserRecord({
      id: "admin-last-1",
      username: "last.admin",
      role: "admin",
    }),
  ]);
  const service = new UserAdminService({
    repository,
    authSessionRepository: new RecordingAuthSessionRepository(),
    loginAttemptStore: new InMemoryLoginAttemptStore(),
    auditService: new InMemoryAuditService(),
    passwordHasher: new BcryptPasswordHasher({ rounds: 4 }),
    now: () => new Date("2026-04-07T10:20:00.000Z"),
    createId: () => "unused",
  });

  await assert.rejects(
    () =>
      service.updateUserProfile({
        actorId: "admin-last-1",
        actorRole: "admin",
        userId: "admin-last-1",
        displayName: "Still Admin",
        role: "editor",
      }),
    LastActiveAdminDemotionError,
  );
});

class InMemoryUserAdminRepository implements UserAdminRepository {
  private readonly records = new Map<string, UserAdminRecord>();

  constructor(initialRecords: UserAdminRecord[] = []) {
    for (const record of initialRecords) {
      this.records.set(record.id, { ...record });
    }
  }

  async listAll(): Promise<UserAdminRecord[]> {
    return [...this.records.values()].map((record) => ({ ...record }));
  }

  async findByIdIncludingDisabled(userId: string): Promise<UserAdminRecord | null> {
    return this.records.get(userId) ? { ...this.records.get(userId)! } : null;
  }

  async findByUsernameIncludingDisabled(username: string): Promise<UserAdminRecord | null> {
    const normalized = username.trim().toLowerCase();
    const record = [...this.records.values()].find((item) => item.username === normalized);
    return record ? { ...record } : null;
  }

  async create(record: UserAdminRecord): Promise<UserAdminRecord> {
    this.records.set(record.id, { ...record });
    return { ...record };
  }

  async updateProfile(input: {
    userId: string;
    displayName: string;
    role: RoleKey;
    updatedAt: string;
  }): Promise<UserAdminRecord> {
    const current = this.records.get(input.userId);
    assert.ok(current);
    const next = {
      ...current,
      displayName: input.displayName,
      role: input.role,
      updatedAt: input.updatedAt,
    };
    this.records.set(input.userId, next);
    return { ...next };
  }

  async updatePasswordHash(input: {
    userId: string;
    passwordHash: string;
    updatedAt: string;
  }): Promise<UserAdminRecord> {
    const current = this.records.get(input.userId);
    assert.ok(current);
    const next = {
      ...current,
      passwordHash: input.passwordHash,
      updatedAt: input.updatedAt,
    };
    this.records.set(input.userId, next);
    return { ...next };
  }

  async updateStatus(input: {
    userId: string;
    status: UserAdminRecord["status"];
    updatedAt: string;
  }): Promise<UserAdminRecord> {
    const current = this.records.get(input.userId);
    assert.ok(current);
    const next = {
      ...current,
      status: input.status,
      updatedAt: input.updatedAt,
    };
    this.records.set(input.userId, next);
    return { ...next };
  }

  async countActiveAdmins(excludingUserId?: string): Promise<number> {
    return [...this.records.values()].filter(
      (record) =>
        record.status === "active" &&
        record.role === "admin" &&
        record.id !== excludingUserId,
    ).length;
  }
}

class RecordingAuthSessionRepository implements AuthSessionRepository {
  readonly revokedUserIds: string[] = [];

  async create(): Promise<AuthSessionRecord> {
    throw new Error("Not used in this test.");
  }

  async findActiveById(): Promise<AuthSessionRecord | null> {
    throw new Error("Not used in this test.");
  }

  async revoke(): Promise<void> {
    throw new Error("Not used in this test.");
  }

  async revokeAllForUser(userId: string): Promise<void> {
    this.revokedUserIds.push(userId);
  }
}

function createUserRecord(input: {
  id: string;
  username: string;
  role: RoleKey;
}): UserAdminRecord {
  return {
    id: input.id,
    username: input.username,
    displayName: input.username,
    role: input.role,
    status: "active",
    passwordHash: "existing-hash",
    createdAt: "2026-04-07T09:00:00.000Z",
    updatedAt: "2026-04-07T09:00:00.000Z",
  };
}
