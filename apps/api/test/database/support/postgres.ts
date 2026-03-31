import process from "node:process";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { getAdminDatabaseUrl, getDatabaseName, getDatabaseUrl } from "../../../src/database/config.ts";
import { loadAppEnvDefaults } from "../../../src/ops/env-defaults.ts";
import { runMigrateProcess } from "./migrate-process.ts";

const appRoot = path.resolve(import.meta.dirname, "../../..");

loadAppEnvDefaults(appRoot);

const TEST_DATABASE_URL = getDatabaseUrl();

const STARTUP_RETRIES = 30;
const STARTUP_DELAY_MS = 1000;
let readinessPromise: Promise<string> | undefined;

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function ensureDatabaseExists(): Promise<void> {
  const adminClient = new Client({ connectionString: getAdminDatabaseUrl() });
  const databaseName = getDatabaseName();

  await adminClient.connect();

  try {
    const existingDatabase = await adminClient.query<{ present: number }>(
      `
        select 1 as present
        from pg_database
        where datname = $1
      `,
      [databaseName],
    );

    if (existingDatabase.rowCount === 0) {
      const identifier = `"${databaseName.replaceAll('"', "\"\"")}"`;
      await adminClient.query(`create database ${identifier}`);
    }
  } finally {
    await adminClient.end();
  }
}

export async function ensureTestDatabaseReady(): Promise<string> {
  readinessPromise ??= ensureReadyAndMigrated();
  return readinessPromise;
}

export async function withTestClient<T>(
  run: (client: Client) => Promise<T>,
): Promise<T> {
  const connectionString = await ensureTestDatabaseReady();
  const client = new Client({ connectionString });

  await client.connect();

  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

function buildDatabaseUrl(databaseName: string): string {
  const url = new URL(getDatabaseUrl());
  url.pathname = `/${databaseName}`;
  return url.toString();
}

async function dropDatabase(adminClient: Client, databaseName: string): Promise<void> {
  const identifier = `"${databaseName.replaceAll('"', "\"\"")}"`;
  await adminClient.query(
    `
      select pg_terminate_backend(pid)
      from pg_stat_activity
      where datname = $1
        and pid <> pg_backend_pid()
    `,
    [databaseName],
  );
  await adminClient.query(`drop database if exists ${identifier}`);
}

export async function withTemporaryDatabase<T>(
  run: (databaseUrl: string) => Promise<T>,
): Promise<T> {
  const databaseName = `${getDatabaseName()}_${process.pid}_${randomUUID().replaceAll("-", "")}`;
  const databaseUrl = buildDatabaseUrl(databaseName);
  const adminClient = new Client({ connectionString: getAdminDatabaseUrl() });
  const identifier = `"${databaseName.replaceAll('"', "\"\"")}"`;

  await adminClient.connect();

  try {
    await adminClient.query(`create database ${identifier}`);
  } finally {
    await adminClient.end();
  }

  try {
    return await run(databaseUrl);
  } finally {
    const cleanupClient = new Client({ connectionString: getAdminDatabaseUrl() });
    await cleanupClient.connect();

    try {
      await dropDatabase(cleanupClient, databaseName);
    } finally {
      await cleanupClient.end();
    }
  }
}

async function ensureReadyAndMigrated(): Promise<string> {
  await ensureDatabaseExists();

  for (let attempt = 0; attempt < STARTUP_RETRIES; attempt += 1) {
    const client = new Client({ connectionString: TEST_DATABASE_URL });

    try {
      await client.connect();
      await client.query("select 1");
      await client.end();

      const migrate = runMigrateProcess(TEST_DATABASE_URL);
      if (migrate.status !== 0) {
        throw new Error(
          `Expected migrate to succeed for the shared test database.\n${migrate.stdout}\n${migrate.stderr}`,
        );
      }

      return TEST_DATABASE_URL;
    } catch (error) {
      await client.end().catch(() => undefined);

      if (attempt === STARTUP_RETRIES - 1) {
        readinessPromise = undefined;
        throw error;
      }

      await sleep(STARTUP_DELAY_MS);
    }
  }

  readinessPromise = undefined;
  throw new Error("PostgreSQL test container did not become ready.");
}
