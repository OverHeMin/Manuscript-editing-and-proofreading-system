import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { PostgresAuditService } from "../../src/audit/postgres-audit-service.ts";
import { PostgresAuthSessionRepository } from "../../src/auth/postgres-auth-session-repository.ts";
import { PostgresLoginAttemptStore } from "../../src/auth/postgres-login-attempt-store.ts";
import { PostgresUserRepository } from "../../src/users/postgres-user-repository.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";

test("postgres user repository normalizes usernames on save and lookup", async () => {
  await withMigratedClient(async (client) => {
    const repository = new PostgresUserRepository({ client });

    await repository.save({
      id: "user-1",
      username: "Editor.Alice",
      displayName: "Alice Editor",
      role: "editor",
      passwordHash: "hash-1",
    });

    const loaded = await repository.findByUsername(" editor.alice ");
    assert.deepEqual(loaded, {
      id: "user-1",
      username: "editor.alice",
      displayName: "Alice Editor",
      role: "editor",
      passwordHash: "hash-1",
    });
  });
});

test("postgres login attempt store records lock windows and can clear the username state", async () => {
  await withMigratedClient(async (client) => {
    const store = new PostgresLoginAttemptStore({ client });
    const firstFailureAt = new Date("2026-03-30T09:00:00.000Z");

    const firstState = await store.recordFailure({
      username: " Reviewer.Li ",
      recordedAt: firstFailureAt,
      failureLimit: 3,
      lockoutWindowMs: 60_000,
    });
    assert.deepEqual(firstState, {
      failures: 1,
    });

    const thirdState = await store.recordFailure({
      username: "reviewer.li",
      recordedAt: new Date("2026-03-30T09:00:10.000Z"),
      failureLimit: 3,
      lockoutWindowMs: 60_000,
    });
    await store.recordFailure({
      username: "reviewer.li",
      recordedAt: new Date("2026-03-30T09:00:20.000Z"),
      failureLimit: 3,
      lockoutWindowMs: 60_000,
    });

    assert.equal(thirdState.failures, 2);

    const lockedState = await store.get(
      "reviewer.li",
      new Date("2026-03-30T09:00:21.000Z"),
    );
    assert.equal(lockedState.failures, 3);
    assert.equal(lockedState.lockedUntil, Date.parse("2026-03-30T09:01:20.000Z"));

    await store.clear("reviewer.li", new Date("2026-03-30T09:01:21.000Z"));
    assert.deepEqual(
      await store.get("reviewer.li", new Date("2026-03-30T09:01:21.000Z")),
      { failures: 0 },
    );
  });
});

test("postgres auth session repository creates loads and revokes active sessions", async () => {
  await withMigratedClient(async (client) => {
    const userRepository = new PostgresUserRepository({ client });
    const repository = new PostgresAuthSessionRepository({ client });

    await userRepository.save({
      id: "user-2",
      username: "proofreader.chen",
      displayName: "Chen Proofreader",
      role: "proofreader",
      passwordHash: "hash-2",
    });

    const created = await repository.create({
      userId: "user-2",
      provider: "local",
      issuedAt: "2026-03-30T10:00:00.000Z",
      expiresAt: "2026-03-30T18:00:00.000Z",
      refreshAt: "2026-03-30T10:30:00.000Z",
      ipAddress: "127.0.0.1",
      userAgent: "node-test",
    });

    assert.ok(created.id);
    assert.equal(created.userId, "user-2");
    assert.equal(created.provider, "local");

    const loaded = await repository.findActiveById(
      created.id,
      new Date("2026-03-30T10:05:00.000Z"),
    );
    assert.deepEqual(loaded, created);

    await repository.revoke(created.id, "2026-03-30T10:10:00.000Z");
    assert.equal(
      await repository.findActiveById(
        created.id,
        new Date("2026-03-30T10:11:00.000Z"),
      ),
      null,
    );
  });
});

test("postgres auth session repository can revoke all active sessions for a user", async () => {
  await withMigratedClient(async (client) => {
    const userRepository = new PostgresUserRepository({ client });
    const repository = new PostgresAuthSessionRepository({ client });

    await userRepository.save({
      id: "user-2b",
      username: "proofreader.zhou",
      displayName: "Zhou Proofreader",
      role: "proofreader",
      passwordHash: "hash-2b",
    });

    const first = await repository.create({
      userId: "user-2b",
      provider: "local",
      issuedAt: "2026-03-30T10:00:00.000Z",
      expiresAt: "2026-03-30T18:00:00.000Z",
      refreshAt: "2026-03-30T10:30:00.000Z",
    });
    const second = await repository.create({
      userId: "user-2b",
      provider: "local",
      issuedAt: "2026-03-30T11:00:00.000Z",
      expiresAt: "2026-03-30T19:00:00.000Z",
      refreshAt: "2026-03-30T11:30:00.000Z",
    });

    await repository.revokeAllForUser("user-2b", "2026-03-30T12:00:00.000Z");

    assert.equal(
      await repository.findActiveById(first.id, new Date("2026-03-30T12:01:00.000Z")),
      null,
    );
    assert.equal(
      await repository.findActiveById(second.id, new Date("2026-03-30T12:01:00.000Z")),
      null,
    );
  });
});

test("postgres audit service writes sensitive auth records to audit_logs", async () => {
  await withMigratedClient(async (client) => {
    const auditService = new PostgresAuditService({ client });

    await auditService.record({
      actorId: "user-3",
      roleKey: "admin",
      action: "auth.login",
      targetTable: "users",
      targetId: "user-3",
      occurredAt: "2026-03-30T11:00:00.000Z",
      metadata: {
        authProvider: "local",
        username: "admin.min",
      },
      ipAddress: "127.0.0.1",
      userAgent: "node-test",
    });

    const result = await client.query<{
      actor_id: string;
      role_key: string;
      action: string;
      target_table: string;
      target_id: string;
      metadata: { authProvider: string; username: string };
      ip_address: string;
      user_agent: string;
    }>(
      `
        select actor_id, role_key, action, target_table, target_id, metadata, host(ip_address) as ip_address, user_agent
        from audit_logs
      `,
    );

    assert.equal(result.rowCount, 1);
    assert.deepEqual(result.rows[0], {
      actor_id: "user-3",
      role_key: "admin",
      action: "auth.login",
      target_table: "users",
      target_id: "user-3",
      metadata: {
        authProvider: "local",
        username: "admin.min",
      },
      ip_address: "127.0.0.1",
      user_agent: "node-test",
    });
  });
});

async function withMigratedClient(run: (client: Client) => Promise<void>): Promise<void> {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for the temporary auth persistence database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      await run(client);
    } finally {
      await client.end();
    }
  });
}
