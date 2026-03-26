import process from "node:process";

const DEFAULT_DATABASE_NAME = "medical_api";
const DEFAULT_ADMIN_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/postgres";

export function getAdminDatabaseUrl(): string {
  return process.env.DATABASE_ADMIN_URL ?? DEFAULT_ADMIN_DATABASE_URL;
}

export function getDatabaseUrl(): string {
  return (
    process.env.DATABASE_URL ??
    `postgresql://postgres:postgres@127.0.0.1:5432/${DEFAULT_DATABASE_NAME}?schema=public`
  );
}

export function getDatabaseName(): string {
  const url = new URL(getDatabaseUrl());
  return url.pathname.replace(/^\//, "") || DEFAULT_DATABASE_NAME;
}
