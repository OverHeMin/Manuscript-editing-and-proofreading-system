import test from "node:test";
import assert from "node:assert/strict";
import { AuthService } from "../../src/auth/auth-service.ts";
import { BcryptPasswordHasher } from "../../src/auth/password-hasher.ts";
import { InMemoryAuditService } from "../../src/audit/audit-service.ts";
import { InMemoryUserRepository } from "../../src/users/in-memory-user-repository.ts";

test("successful local login writes an audit record for sensitive auth activity", async () => {
  const passwordHasher = new BcryptPasswordHasher({ rounds: 4 });
  const userRepository = new InMemoryUserRepository();
  const auditService = new InMemoryAuditService();

  await userRepository.save({
    id: "user-1",
    username: "admin.min",
    displayName: "Min Admin",
    role: "admin",
    passwordHash: await passwordHasher.hash("Admin-Password-123"),
  });

  const authService = new AuthService({
    userRepository,
    passwordHasher,
    auditService,
    now: () => new Date("2026-03-26T08:30:00.000Z"),
  });

  const session = await authService.login({
    username: "admin.min",
    password: "Admin-Password-123",
    ipAddress: "127.0.0.1",
    userAgent: "node-test",
  });

  assert.equal(session.provider, "local");

  const auditRecords = auditService.list();
  assert.equal(auditRecords.length, 1);
  assert.deepEqual(auditRecords[0], {
    actorId: "user-1",
    action: "auth.login",
    targetTable: "users",
    targetId: "user-1",
    roleKey: "admin",
    occurredAt: "2026-03-26T08:30:00.000Z",
    metadata: {
      authProvider: "local",
      username: "admin.min",
    },
    ipAddress: "127.0.0.1",
    userAgent: "node-test",
  });
});
