import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { PostgresUserAdminRepository } from "../../src/users/postgres-user-admin-repository.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";

test("postgres user admin repository lists mixed-status users and counts active admins", async () => {
  await withMigratedClient(async (client) => {
    await client.query(
      `
        insert into users (
          id,
          username,
          display_name,
          role_key,
          password_hash,
          status
        )
        values
          ('admin-1', 'admin.one', 'Admin One', 'admin', 'hash-1', 'active'),
          ('editor-1', 'editor.one', 'Editor One', 'editor', 'hash-2', 'disabled'),
          ('admin-2', 'admin.two', 'Admin Two', 'admin', 'hash-3', 'active')
      `,
    );

    const repository = new PostgresUserAdminRepository({ client });

    const listed = await repository.listAll();
    assert.deepEqual(
      listed.map((record) => ({
        id: record.id,
        username: record.username,
        role: record.role,
        status: record.status,
      })),
      [
        {
          id: "admin-1",
          username: "admin.one",
          role: "admin",
          status: "active",
        },
        {
          id: "admin-2",
          username: "admin.two",
          role: "admin",
          status: "active",
        },
        {
          id: "editor-1",
          username: "editor.one",
          role: "editor",
          status: "disabled",
        },
      ],
    );

    assert.equal(await repository.countActiveAdmins(), 2);
    assert.equal(await repository.countActiveAdmins("admin-1"), 1);
  });
});

test("postgres user admin repository updates profile role status and password hash in place", async () => {
  await withMigratedClient(async (client) => {
    await client.query(
      `
        insert into users (
          id,
          username,
          display_name,
          role_key,
          password_hash,
          status
        )
        values ('user-1', 'editor.one', 'Editor One', 'editor', 'hash-1', 'active')
      `,
    );

    const repository = new PostgresUserAdminRepository({ client });

    await repository.updateProfile({
      userId: "user-1",
      displayName: "Editor Prime",
      role: "proofreader",
      updatedAt: "2026-04-07T10:00:00.000Z",
    });
    await repository.updatePasswordHash({
      userId: "user-1",
      passwordHash: "hash-2",
      updatedAt: "2026-04-07T10:01:00.000Z",
    });
    const updated = await repository.updateStatus({
      userId: "user-1",
      status: "disabled",
      updatedAt: "2026-04-07T10:02:00.000Z",
    });

    assert.equal(updated.displayName, "Editor Prime");
    assert.equal(updated.role, "proofreader");
    assert.equal(updated.passwordHash, "hash-2");
    assert.equal(updated.status, "disabled");

    const loaded = await repository.findByIdIncludingDisabled("user-1");
    assert.deepEqual(loaded, updated);
  });
});

async function withMigratedClient(run: (client: Client) => Promise<void>): Promise<void> {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for the temporary user admin persistence database.\n${migrate.stdout}\n${migrate.stderr}`,
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
