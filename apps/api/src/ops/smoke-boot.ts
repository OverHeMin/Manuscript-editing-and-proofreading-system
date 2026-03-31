import net from "node:net";
import path from "node:path";
import process from "node:process";
import { Client } from "pg";
import { resolveDemoServerConfig } from "../http/demo-server-config.ts";
import { resolvePersistentServerConfig } from "../http/persistent-server-config.ts";
import { getDatabaseUrl } from "../database/config.ts";
import { loadAppEnvDefaults } from "./env-defaults.ts";

const appRoot = path.resolve(import.meta.dirname, "../..");

loadAppEnvDefaults(appRoot);

const runtimeMode = resolveApiRuntimeMode(process.env);
const databaseUrl =
  runtimeMode === "demo"
    ? getDatabaseUrl()
    : resolvePersistentServerConfig(process.env).databaseUrl;

await assertTcpReachable("Postgres", new URL(databaseUrl));
await assertTcpReachable("Redis", new URL(requireEnv("REDIS_URL")));
await assertTcpReachable(
  "Object storage",
  new URL(requireEnv("OBJECT_STORAGE_ENDPOINT")),
);
requireOptionalUrl("ONLYOFFICE_URL");
requireOptionalValue("ONLYOFFICE_JWT_SECRET");
requireOptionalValue("LIBREOFFICE_BINARY");
await assertDatabaseReachable(databaseUrl);

console.log(`[api] smoke boot OK (${runtimeMode})`);

function resolveApiRuntimeMode(
  env: NodeJS.ProcessEnv,
): "demo" | "persistent-auth-runtime" {
  const appEnv = env.APP_ENV?.trim();
  if (!appEnv || appEnv === "local") {
    resolveDemoServerConfig(env);
    return "demo";
  }

  resolvePersistentServerConfig(env);
  return "persistent-auth-runtime";
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function requireOptionalUrl(name: string): void {
  const value = process.env[name];
  if (!value) {
    return;
  }

  new URL(value);
}

function requireOptionalValue(name: string): void {
  const value = process.env[name];
  if (value !== undefined && value.trim() === "") {
    throw new Error(`Environment variable ${name} must not be empty when set.`);
  }
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
