import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { Client } from "pg";
import { getDatabaseUrl } from "../database/config.ts";

const appRoot = path.resolve(import.meta.dirname, "../..");

for (const fileName of [".env", ".env.example"]) {
  loadEnvDefaults(path.join(appRoot, fileName));
}

await assertTcpReachable("Postgres", new URL(getDatabaseUrl()));
await assertTcpReachable("Redis", new URL(requireEnv("REDIS_URL")));
await assertTcpReachable(
  "Object storage",
  new URL(requireEnv("OBJECT_STORAGE_ENDPOINT")),
);
await assertDatabaseReachable(getDatabaseUrl());

console.log("[api] smoke boot OK");

function loadEnvDefaults(filePath: string): void {
  if (!existsSync(filePath)) {
    return;
  }

  const contents = readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function assertDatabaseReachable(connectionString: string): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query("select 1");
  } finally {
    await client.end();
  }
}

async function assertTcpReachable(label: string, url: URL): Promise<void> {
  const port = Number(url.port || defaultPortForProtocol(url.protocol));
  if (!url.hostname || Number.isNaN(port)) {
    throw new Error(`${label} endpoint is invalid: ${url.toString()}`);
  }

  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({
      host: url.hostname,
      port,
    });

    socket.setTimeout(2500);
    socket.once("connect", () => {
      socket.end();
      resolve();
    });
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error(`${label} is not reachable at ${url.toString()}`));
    });
    socket.once("error", (error) => {
      socket.destroy();
      reject(
        new Error(`${label} is not reachable at ${url.toString()}: ${error.message}`),
      );
    });
  });
}

function defaultPortForProtocol(protocol: string): number {
  if (protocol === "postgresql:" || protocol === "postgres:") {
    return 5432;
  }

  if (protocol === "redis:") {
    return 6379;
  }

  if (protocol === "http:") {
    return 80;
  }

  if (protocol === "https:") {
    return 443;
  }

  throw new Error(`Unsupported protocol for smoke boot: ${protocol}`);
}
