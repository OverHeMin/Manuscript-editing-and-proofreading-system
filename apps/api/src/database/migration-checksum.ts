import { createHash } from "node:crypto";

export function normalizeMigrationSql(sql: string): string {
  return sql.replaceAll("\r\n", "\n");
}

export function createMigrationChecksum(sql: string): string {
  return createHash("sha256").update(normalizeMigrationSql(sql)).digest("hex");
}
