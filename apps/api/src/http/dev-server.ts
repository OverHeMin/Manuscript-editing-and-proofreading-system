import path from "node:path";
import process from "node:process";
import { createApiHttpServer } from "./api-http-server.ts";
import { loadAppEnvDefaults } from "../ops/env-defaults.ts";

const appRoot = path.resolve(import.meta.dirname, "../..");

loadAppEnvDefaults(appRoot);

const appEnv = parseAppEnv(process.env.APP_ENV);
const port = parsePort(process.env.API_PORT);
const host = process.env.API_HOST?.trim() || "127.0.0.1";
const allowedOrigins = parseAllowedOrigins(process.env.API_ALLOWED_ORIGINS);
const server = createApiHttpServer({
  appEnv,
  allowedOrigins,
  seedDemoKnowledgeReviewData: appEnv === "local",
});

server.listen(port, host, () => {
  console.log(`[api] listening on http://${host}:${port}`);
});

function parseAppEnv(value: string | undefined): "local" | "test" | "production" {
  if (value === "test" || value === "production") {
    return value;
  }

  return "local";
}

function parsePort(value: string | undefined): number {
  if (!value) {
    return 3001;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid API_PORT "${value}". Expected a positive integer.`);
  }

  return port;
}

function parseAllowedOrigins(value: string | undefined): string[] {
  if (!value?.trim()) {
    return ["http://127.0.0.1:4173", "http://localhost:4173"];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
