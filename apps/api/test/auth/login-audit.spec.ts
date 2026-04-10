import test from "node:test";
import assert from "node:assert/strict";
import { AuthService } from "../../src/auth/auth-service.ts";
import {
  type AuthenticationProvider,
  LocalAuthenticationProvider,
} from "../../src/auth/local-auth-provider.ts";
import { BcryptPasswordHasher } from "../../src/auth/password-hasher.ts";
import { InMemoryAuditService } from "../../src/audit/audit-service.ts";
import { InMemoryLoginAttemptStore } from "../../src/auth/login-attempt-store.ts";
import { InMemoryUserRepository } from "../../src/users/in-memory-user-repository.ts";
import type { AuthProviderName } from "../../src/auth/provider.ts";

test("successful local login writes an audit record for sensitive auth activity", async () => {
  const passwordHasher = new BcryptPasswordHasher({ rounds: 4 });
  const userRepository = new InMemoryUserRepository();
  const auditService = new InMemoryAuditService();
  const loginAttemptStore = new InMemoryLoginAttemptStore();

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
    loginAttemptStore,
    now: () => new Date("2026-03-26T08:30:00.000Z"),
  });
  const provider = new LocalAuthenticationProvider(authService);

  const session = await provider.authenticate({
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

class NamedAuthenticationProvider implements AuthenticationProvider {
  constructor(
    readonly name: AuthProviderName,
    private readonly authService: AuthService,
  ) {}

  authenticate(input: Parameters<AuthService["login"]>[0]) {
    return this.authService.login(input, this.name);
  }
}

test("session and audit provider identity come from the provider path", async () => {
  const passwordHasher = new BcryptPasswordHasher({ rounds: 4 });
  const userRepository = new InMemoryUserRepository();
  const auditService = new InMemoryAuditService();
  const loginAttemptStore = new InMemoryLoginAttemptStore();

  await userRepository.save({
    id: "user-2",
    username: "sso.li",
    displayName: "Li Reviewer",
    role: "knowledge_reviewer",
    passwordHash: await passwordHasher.hash("Reviewer-Password-123"),
  });

  const authService = new AuthService({
    userRepository,
    passwordHasher,
    auditService,
    loginAttemptStore,
    now: () => new Date("2026-03-26T08:45:00.000Z"),
  });
  const provider = new NamedAuthenticationProvider("ldap", authService);

  const session = await provider.authenticate({
    username: "sso.li",
    password: "Reviewer-Password-123",
  });

  assert.equal(session.provider, "ldap");
  assert.equal(auditService.list()[0]?.metadata?.authProvider, "ldap");
  assert.equal(auditService.list()[0]?.roleKey, "knowledge_reviewer");
  assert.equal(auditService.list()[0]?.targetId, "user-2");
});
