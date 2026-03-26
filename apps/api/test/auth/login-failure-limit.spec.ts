import test from "node:test";
import assert from "node:assert/strict";
import {
  AccountLockedError,
  AuthService,
  InvalidCredentialsError,
} from "../../src/auth/auth-service.ts";
import type { PasswordHasher } from "../../src/auth/password-hasher.ts";
import { BcryptPasswordHasher } from "../../src/auth/password-hasher.ts";
import { InMemoryAuditService } from "../../src/audit/audit-service.ts";
import { InMemoryLoginAttemptStore } from "../../src/auth/login-attempt-store.ts";
import { InMemoryUserRepository } from "../../src/users/in-memory-user-repository.ts";

test("login failure limit locks the account until the lock window expires", async () => {
  const passwordHasher = new BcryptPasswordHasher({ rounds: 4 });
  const userRepository = new InMemoryUserRepository();
  const auditService = new InMemoryAuditService();
  const loginAttemptStore = new InMemoryLoginAttemptStore();

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
    loginAttemptStore,
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
        }, "local"),
      InvalidCredentialsError,
    );
  }

  await assert.rejects(
    () =>
      authService.login({
        username: "editor.alice",
        password: "Correct-Password-123",
      }, "local"),
    AccountLockedError,
  );

  now += 61_000;

  const session = await authService.login({
    username: "editor.alice",
    password: "Correct-Password-123",
  }, "local");

  assert.equal(session.user.id, "user-1");
  assert.equal(session.user.role, "editor");
});

class VerificationBarrier {
  private arrivalCount = 0;
  private readonly releasePromise: Promise<void>;
  private release!: () => void;

  constructor(private readonly targetCount: number) {
    this.releasePromise = new Promise((resolve) => {
      this.release = resolve;
    });
  }

  async wait(): Promise<void> {
    this.arrivalCount += 1;

    if (this.arrivalCount >= this.targetCount) {
      this.release();
    }

    await this.releasePromise;
  }
}

class BarrierPasswordHasher implements PasswordHasher {
  constructor(
    private readonly baseHasher: PasswordHasher,
    private readonly barrier: VerificationBarrier,
  ) {}

  hash(password: string): Promise<string> {
    return this.baseHasher.hash(password);
  }

  async verify(password: string, digest: string): Promise<boolean> {
    await this.barrier.wait();
    return this.baseHasher.verify(password, digest);
  }
}

class DeferredPasswordHasher implements PasswordHasher {
  private readonly releases: Array<() => void> = [];
  private readonly waiters: Promise<void>[] = [];
  private verifyCount = 0;

  constructor(
    private readonly baseHasher: PasswordHasher,
    private readonly deferredVerifyIndexes: number[],
  ) {}

  hash(password: string): Promise<string> {
    return this.baseHasher.hash(password);
  }

  async verify(password: string, digest: string): Promise<boolean> {
    this.verifyCount += 1;

    if (this.deferredVerifyIndexes.includes(this.verifyCount)) {
      const waiter = new Promise<void>((resolve) => {
        this.releases.push(resolve);
      });
      this.waiters.push(waiter);
      await waiter;
    }

    return this.baseHasher.verify(password, digest);
  }

  async waitForDeferredCount(expectedCount: number): Promise<void> {
    while (this.waiters.length < expectedCount) {
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    }
  }

  releaseNext(): void {
    const release = this.releases.shift();

    if (!release) {
      throw new Error("No deferred verification is waiting for release.");
    }

    release();
  }
}

test("concurrent failed logins accumulate and trigger lockout", async () => {
  const baseHasher = new BcryptPasswordHasher({ rounds: 4 });
  const userRepository = new InMemoryUserRepository();
  const auditService = new InMemoryAuditService();
  const loginAttemptStore = new InMemoryLoginAttemptStore();
  const barrier = new VerificationBarrier(3);
  const passwordHasher = new BarrierPasswordHasher(baseHasher, barrier);

  await userRepository.save({
    id: "user-2",
    username: "proofreader.chen",
    displayName: "Chen Proofreader",
    role: "proofreader",
    passwordHash: await baseHasher.hash("Correct-Password-456"),
  });

  const authService = new AuthService({
    userRepository,
    passwordHasher,
    auditService,
    loginAttemptStore,
    loginFailureLimit: 3,
    lockoutWindowMs: 60_000,
    now: () => new Date("2026-03-26T09:00:00.000Z"),
  });

  const failedAttempts = await Promise.allSettled(
    Array.from({ length: 3 }, () =>
      authService.login({
        username: "proofreader.chen",
        password: "Wrong-Password-456",
      }, "local"),
    ),
  );

  assert.equal(
    failedAttempts.every(
      (result) =>
        result.status === "rejected" &&
        result.reason instanceof InvalidCredentialsError,
    ),
    true,
  );

  await assert.rejects(
    () =>
      authService.login({
        username: "proofreader.chen",
        password: "Correct-Password-456",
      }, "local"),
    AccountLockedError,
  );
});

test("an older slow failure cannot shorten a newer lockout window", async () => {
  const baseHasher = new BcryptPasswordHasher({ rounds: 4 });
  const userRepository = new InMemoryUserRepository();
  const auditService = new InMemoryAuditService();
  const loginAttemptStore = new InMemoryLoginAttemptStore();
  const passwordHasher = new DeferredPasswordHasher(baseHasher, [1]);

  await userRepository.save({
    id: "user-3",
    username: "editor.zhao",
    displayName: "Zhao Editor",
    role: "editor",
    passwordHash: await baseHasher.hash("Correct-Password-789"),
  });

  let now = new Date("2026-03-26T10:00:00.000Z").getTime();
  const authService = new AuthService({
    userRepository,
    passwordHasher,
    auditService,
    loginAttemptStore,
    loginFailureLimit: 1,
    lockoutWindowMs: 60_000,
    now: () => new Date(now),
  });

  const olderSlowFailure = authService.login({
    username: "editor.zhao",
    password: "Wrong-Password-789",
  }, "local");

  await passwordHasher.waitForDeferredCount(1);

  now += 10_000;

  await assert.rejects(
    () =>
      authService.login({
        username: "editor.zhao",
        password: "Wrong-Password-789",
      }, "local"),
    InvalidCredentialsError,
  );

  passwordHasher.releaseNext();

  await assert.rejects(() => olderSlowFailure, InvalidCredentialsError);

  now = new Date("2026-03-26T10:01:05.000Z").getTime();

  await assert.rejects(
    () =>
      authService.login({
        username: "editor.zhao",
        password: "Correct-Password-789",
      }, "local"),
    AccountLockedError,
  );
});
