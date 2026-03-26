import process from "node:process";
import { Client } from "pg";
import { getAdminDatabaseUrl, getDatabaseName, getDatabaseUrl } from "../../../src/database/config.ts";

const TEST_DATABASE_URL = getDatabaseUrl();

const STARTUP_RETRIES = 30;
const STARTUP_DELAY_MS = 1000;

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
  await ensureDatabaseExists();

  for (let attempt = 0; attempt < STARTUP_RETRIES; attempt += 1) {
    const client = new Client({ connectionString: TEST_DATABASE_URL });

    try {
      await client.connect();
      await client.query("select 1");
      await client.end();
      return TEST_DATABASE_URL;
    } catch (error) {
      await client.end().catch(() => undefined);

      if (attempt === STARTUP_RETRIES - 1) {
        throw error;
      }

      await sleep(STARTUP_DELAY_MS);
    }
  }

  throw new Error("PostgreSQL test container did not become ready.");
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
