import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createMigrationChecksum } from "./migration-checksum.ts";

const migrationsDirectory = path.join(import.meta.dirname, "migrations");
const migrationDescriptions = new Map<string, string>([
  [
    "0026_model_provider_domestic.sql",
    "Add domestic model providers to the model_provider enum.",
  ],
  [
    "0027_medical_editorial_rule_authoring_workbench.sql",
    "Add journal template profiles and enriched editorial rule persistence fields.",
  ],
]);
const legacyMigrationChecksums = new Map<string, Set<string>>([
  [
    "0001_initial.sql",
    new Set(["6140ea1d2280a0712aae27ae1f284131bf1eeb239446ea46ef49298fb8b30920"]),
  ],
  [
    "0009_agent_tooling_persistence.sql",
    new Set(["f177959ca7039fb15a05b667277235d9fe95ad04bb90d8c9af6783109ab535cd"]),
  ],
  [
    "0015_model_routing_governance_persistence.sql",
    new Set(["ebdbfda29dcaa66f6839f1dfe89914327d56f6154340cfaa18fea1bc61da2ab4"]),
  ],
  [
    "0025_editorial_rule_engine_persistence.sql",
    new Set(["bff19d8b5bcdebe649b314a987a7dac6c02254404f205ea863fee666000c3882"]),
  ],
  [
    "0026_model_provider_domestic.sql",
    new Set(["462c9abed36fd1e953d49216f15b173e520e521e54ca23820df5fb33a3ca0152"]),
  ],
  [
    "0027_medical_editorial_rule_authoring_workbench.sql",
    new Set(["dbe493b219e1eb1891844a826ede078f2d120b63b213321e5cc4cc658bbbfeb9"]),
  ],
]);

export interface MigrationLedgerEntry {
  version: string;
  description: string;
  checksum: string;
  acceptedLegacyChecksums: string[];
}

let cachedLedger: MigrationLedgerEntry[] | undefined;

export function getRepositoryMigrationFiles(): string[] {
  return readdirSync(migrationsDirectory)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();
}

export function readRepositoryMigrationSql(version: string): string {
  return readFileSync(path.join(migrationsDirectory, version), "utf8");
}

export function getRepositoryMigrationLedger(): MigrationLedgerEntry[] {
  cachedLedger ??= getRepositoryMigrationFiles().map((version) => ({
    version,
    description: migrationDescriptions.get(version) ?? "No description recorded.",
    checksum: createMigrationChecksum(readRepositoryMigrationSql(version)),
    acceptedLegacyChecksums: [...(legacyMigrationChecksums.get(version) ?? [])],
  }));

  return cachedLedger;
}

export function getRepositoryMigrationLedgerMap(): Map<string, MigrationLedgerEntry> {
  return new Map(getRepositoryMigrationLedger().map((entry) => [entry.version, entry]));
}

export function isAcceptedLegacyMigrationChecksum(version: string, checksum: string): boolean {
  return legacyMigrationChecksums.get(version)?.has(checksum) ?? false;
}
