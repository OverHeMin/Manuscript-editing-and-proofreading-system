import test from "node:test";
import assert from "node:assert/strict";
import {
  AccountLockedError,
  AuthService,
  InvalidCredentialsError,
} from "../../src/auth/auth-service.ts";
import { BcryptPasswordHasher } from "../../src/auth/password-hasher.ts";
import { InMemoryAuditService } from "../../src/audit/audit-service.ts";
import { InMemoryUserRepository } from "../../src/users/in-memory-user-repository.ts";

test("login failure limit locks the account until the lock window expires", async () => {
  const passwordHasher = new BcryptPasswordHasher({ rounds: 4 });
  const userRepository = new InMemoryUserRepository();
  const auditService = new InMemoryAuditService();

  await userRepository.save({
    id: "user-1",
    username: "editor.alice",
    displayName: "Alice Editor",
    role: "editor",
    passwordHash: await passwordHasher.hash("Correct-Password-123"),
  });

  let now = new Date("2026-03-26T08:00:00.000Z").getTime();
  const authService = new AuthService({
    userRepository,
    passwordHasher,
    auditService,
    loginFailureLimit: 3,
    lockoutWindowMs: 60_000,
    now: () => new Date(now),
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await assert.rejects(
      () =>
        authService.login({
          username: "editor.alice",
          password: "Wrong-Password-123",
        }),
      InvalidCredentialsError,
    );
  }

  await assert.rejects(
    () =>
      authService.login({
        username: "editor.alice",
        password: "Correct-Password-123",
      }),
    AccountLockedError,
  );

  now += 61_000;

  const session = await authService.login({
    username: "editor.alice",
    password: "Correct-Password-123",
  });

  assert.equal(session.user.id, "user-1");
  assert.equal(session.user.role, "editor");
});
