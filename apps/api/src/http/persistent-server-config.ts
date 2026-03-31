export type PersistentAppEnv = "development" | "test" | "staging" | "production";

export interface PersistentServerConfig {
  appEnv: PersistentAppEnv;
  port: number;
  host: string;
  allowedOrigins: string[];
  databaseUrl: string;
  uploadRootDir?: string;
}

const DEFAULT_PORT = 3001;
const DEFAULT_HOST = "0.0.0.0";

export function resolvePersistentServerConfig(
  env: NodeJS.ProcessEnv = process.env,
): PersistentServerConfig {
  return {
    appEnv: parsePersistentAppEnv(env.APP_ENV),
    port: parsePort(env.API_PORT),
    host: env.API_HOST?.trim() || DEFAULT_HOST,
    allowedOrigins: parseAllowedOrigins(env.API_ALLOWED_ORIGINS),
    databaseUrl: parseDatabaseUrl(env.DATABASE_URL),
    uploadRootDir: parseOptionalPath(env.UPLOAD_ROOT_DIR),
  };
}

function parsePersistentAppEnv(value: string | undefined): PersistentAppEnv {
  const normalized = value?.trim();

  switch (normalized) {
    case "development":
    case "test":
    case "staging":
    case "production":
      return normalized;
    case undefined:
    case "":
      return "development";
    default:
      throw new Error(
        `Persistent API runtime requires APP_ENV to be development, test, staging, or production. Received APP_ENV="${value}".`,
      );
  }
}

function parseAllowedOrigins(value: string | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
    .map((origin) => new URL(origin).toString().replace(/\/$/, ""));
}

function parseDatabaseUrl(value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(
      "Persistent API runtime requires DATABASE_URL for PostgreSQL-backed auth state.",
    );
  }

  return new URL(value).toString();
}

function parsePort(value: string | undefined): number {
  if (!value) {
    return DEFAULT_PORT;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid API_PORT "${value}". Expected a positive integer.`);
  }

  return port;
}

function parseOptionalPath(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}
