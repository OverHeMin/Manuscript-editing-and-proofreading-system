type DemoAppEnv = "local";

export interface DemoServerConfig {
  appEnv: DemoAppEnv;
  port: number;
  host: string;
  allowedOrigins: string[];
  uploadRootDir?: string;
}

const DEFAULT_PORT = 3001;
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_ALLOWED_ORIGINS = [
  "http://127.0.0.1",
  "http://localhost",
] as const;

export function resolveDemoServerConfig(
  env: NodeJS.ProcessEnv = process.env,
): DemoServerConfig {
  const appEnv = parseDemoAppEnv(env.APP_ENV);
  const host = parseDemoHost(env.API_HOST);
  const allowedOrigins = parseDemoAllowedOrigins(env.API_ALLOWED_ORIGINS);

  return {
    appEnv,
    port: parsePort(env.API_PORT),
    host,
    allowedOrigins,
    uploadRootDir: parseOptionalPath(env.UPLOAD_ROOT_DIR),
  };
}

function parseDemoAppEnv(value: string | undefined): DemoAppEnv {
  if (value == null || value.trim().length === 0 || value === "local") {
    return "local";
  }

  throw new Error(
    `Demo-only API runtime requires APP_ENV=local. Received APP_ENV="${value}".`,
  );
}

function parseDemoHost(value: string | undefined): string {
  const host = value?.trim() || DEFAULT_HOST;
  if (isLoopbackHost(host)) {
    return host;
  }

  throw new Error(
    `Demo-only API runtime must bind to a loopback host. Received API_HOST="${host}".`,
  );
}

function parseDemoAllowedOrigins(value: string | undefined): string[] {
  const allowedOrigins = !value?.trim()
    ? [...DEFAULT_ALLOWED_ORIGINS]
    : value
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);

  for (const origin of allowedOrigins) {
    const parsedOrigin = new URL(origin);
    if (!isLoopbackHost(parsedOrigin.hostname)) {
      throw new Error(
        `Demo-only API runtime accepts only local origins. Received "${origin}".`,
      );
    }
  }

  return allowedOrigins;
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

function isLoopbackHost(host: string): boolean {
  const normalizedHost = host.trim().toLowerCase();
  return (
    normalizedHost === "127.0.0.1" ||
    normalizedHost === "localhost" ||
    normalizedHost === "::1" ||
    normalizedHost === "[::1]"
  );
}
