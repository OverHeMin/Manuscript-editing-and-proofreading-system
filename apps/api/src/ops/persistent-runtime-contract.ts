import path from "node:path";

export type PersistentAppEnv = "development" | "test" | "staging" | "production";
export type RuntimeDependencyMode =
  | "required"
  | "validated_when_configured"
  | "smoke_only";
export type UploadRootSource = "default" | "explicit";

export interface PersistentRuntimeDependencyContract {
  mode: RuntimeDependencyMode;
  url?: string;
  binary?: string;
}

export interface PersistentRuntimeContract {
  appEnv: PersistentAppEnv;
  port: number;
  host: string;
  allowedOrigins: string[];
  databaseUrl: string;
  uploadRootDir: string;
  uploadRootSource: UploadRootSource;
  dependencies: {
    database: PersistentRuntimeDependencyContract;
    uploadRoot: PersistentRuntimeDependencyContract;
    onlyOffice: PersistentRuntimeDependencyContract;
    redis: PersistentRuntimeDependencyContract;
    objectStorage: PersistentRuntimeDependencyContract;
    libreOffice: PersistentRuntimeDependencyContract;
  };
}

const DEFAULT_PORT = 3001;
const DEFAULT_HOST = "0.0.0.0";
const PROD_ONLYOFFICE_JWT_PLACEHOLDER = "change-me-in-prod";

export function resolvePersistentRuntimeContract(
  env: NodeJS.ProcessEnv = process.env,
): PersistentRuntimeContract {
  const appEnv = parsePersistentAppEnv(env.APP_ENV);
  const onlyOfficeJwtSecret = parseOptionalConfiguredValue(
    "ONLYOFFICE_JWT_SECRET",
    env.ONLYOFFICE_JWT_SECRET,
  );

  if (
    (appEnv === "staging" || appEnv === "production") &&
    onlyOfficeJwtSecret === PROD_ONLYOFFICE_JWT_PLACEHOLDER
  ) {
    throw new Error(
      `Persistent API runtime requires ONLYOFFICE_JWT_SECRET to be replaced for APP_ENV="${appEnv}".`,
    );
  }

  const uploadRoot = resolveUploadRoot(appEnv, env.UPLOAD_ROOT_DIR);
  const onlyOfficeUrl = parseOptionalConfiguredUrl("ONLYOFFICE_URL", env.ONLYOFFICE_URL);
  const redisUrl = parseOptionalConfiguredUrl("REDIS_URL", env.REDIS_URL);
  const objectStorageEndpoint = parseOptionalConfiguredUrl(
    "OBJECT_STORAGE_ENDPOINT",
    env.OBJECT_STORAGE_ENDPOINT,
  );
  const libreOfficeBinary = parseOptionalConfiguredValue(
    "LIBREOFFICE_BINARY",
    env.LIBREOFFICE_BINARY,
  );

  return {
    appEnv,
    port: parsePort(env.API_PORT),
    host: env.API_HOST?.trim() || DEFAULT_HOST,
    allowedOrigins: parseAllowedOrigins(env.API_ALLOWED_ORIGINS),
    databaseUrl: parseDatabaseUrl(env.DATABASE_URL),
    uploadRootDir: uploadRoot.path,
    uploadRootSource: uploadRoot.source,
    dependencies: {
      database: {
        mode: "required",
      },
      uploadRoot: {
        mode: "required",
      },
      onlyOffice: {
        mode: "validated_when_configured",
        ...(onlyOfficeUrl ? { url: onlyOfficeUrl } : {}),
      },
      redis: {
        mode: "smoke_only",
        ...(redisUrl ? { url: redisUrl } : {}),
      },
      objectStorage: {
        mode: "smoke_only",
        ...(objectStorageEndpoint ? { url: objectStorageEndpoint } : {}),
      },
      libreOffice: {
        mode: "validated_when_configured",
        ...(libreOfficeBinary ? { binary: libreOfficeBinary } : {}),
      },
    },
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

function parseOptionalConfiguredUrl(
  name: string,
  value: string | undefined,
): string | undefined {
  const normalized = parseOptionalConfiguredValue(name, value);
  return normalized ? new URL(normalized).toString() : undefined;
}

function parseOptionalConfiguredValue(
  name: string,
  value: string | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`Persistent API runtime requires ${name} to be non-empty when set.`);
  }

  return normalized;
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

function resolveUploadRoot(
  appEnv: PersistentAppEnv,
  value: string | undefined,
): { path: string; source: UploadRootSource } {
  const explicitPath = value?.trim();
  if (explicitPath && explicitPath.length > 0) {
    return {
      path: explicitPath,
      source: "explicit",
    };
  }

  return {
    path: path.resolve(process.cwd(), ".local-data", "uploads", appEnv),
    source: "default",
  };
}
