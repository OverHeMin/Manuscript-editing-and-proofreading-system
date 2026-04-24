import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createMigrationChecksum } from "./migration-checksum.ts";
import { resolveApiPackageRoot } from "./package-root.ts";

const migrationsDirectory = path.join(
  resolveApiPackageRoot(import.meta.dirname),
  "src",
  "database",
  "migrations",
);
const migrationDescriptions = new Map<string, string>([
  [
    "0026_model_provider_domestic.sql",
    "Add domestic model providers to the model_provider enum.",
  ],
  [
    "0027_medical_editorial_rule_authoring_workbench.sql",
    "Add journal template profiles and enriched editorial rule persistence fields.",
  ],
  [
    "0028_medical_rule_library_v2_foundations.sql",
    "Add V2 rule explainability fields plus learning candidate payload and suggestion persistence.",
  ],
  [
    "0029_learning_reviewed_snapshot_source_kind.sql",
    "Allow reviewed case snapshots to serve as governed learning candidate provenance.",
  ],
  [
    "0031_knowledge_duplicate_detection_acknowledgements.sql",
    "Persist duplicate acknowledgement audit trails for revision-governed knowledge review.",
  ],
  [
    "0032_ai_provider_control_plane.sql",
    "Add ai provider connection and credential persistence plus nullable model registry connection linkage.",
  ],
  [
    "0033_knowledge_library_rich_space.sql",
    "Add revision-rich knowledge content blocks and semantic retrieval layers.",
  ],
  [
    "0034_harness_control_plane_p0.sql",
    "Add governed retrieval presets and manual review policies for the Harness control plane.",
  ],
  [
    "0035_harness_control_plane_rollback_history.sql",
    "Persist Harness environment rollback snapshots for governed recovery history.",
  ],
  [
    "0036_execution_snapshot_quality_findings_summary.sql",
    "Persist advisory manuscript quality finding summaries on execution snapshots.",
  ],
  [
    "0037_manuscript_quality_package_governance.sql",
    "Persist governed manuscript quality package versions for general and medical analyzers.",
  ],
  [
    "0038_manuscript_quality_runtime_refs.sql",
    "Persist runtime binding quality package refs and frozen execution snapshot quality package versions.",
  ],
  [
    "0039_rule_package_extraction_tasks.sql",
    "Persist rule-package extraction tasks and AI semantic confirmation candidates for the rule center ledger.",
  ],
  [
    "0040_rule_center_content_modules_and_template_compositions.sql",
    "Persist governed content modules and template compositions for the rule center ledgers.",
  ],
  [
    "0041_manuscript_type_detection_summary.sql",
    "Persist upload-time manuscript type detection summaries on manuscripts.",
  ],
  [
    "0043_rule_wizard_knowledge_item_binding_kind.sql",
    "Allow rule-wizard knowledge revisions to bind linked knowledge items explicitly.",
  ],
  [
    "0044_proofreading_residual_learning_v1.sql",
    "Add residual issue persistence and governed learning enum support for proofreading self-learning.",
  ],
  [
    "0047_rule_execution_hit_posture.sql",
    "Persist governed execution hit posture and decision provenance for review intake.",
  ],
  [
    "0048_rule_platform_scope_release_governance.sql",
    "Persist rule priority plus rule-set release scope, promotion evidence, and rollback references for governed rollout.",
  ],
  [
    "0049_rule_activation_metrics.sql",
    "Persist per-rule governed activation, decision, and writeback metrics.",
  ],
  [
    "0050_online_execution_regression.sql",
    "Extend evaluation suite types for module, scope, and rule-family online regression.",
  ],
  [
    "0052_journal_template_target_model_versioning.sql",
    "Persist journal template target models and version history for template governance.",
  ],
  [
    "0053_manuscript_editing_slot_governance_summary.sql",
    "Persist manuscript-level editing slot governance summaries for rerun-stable metadata resolution.",
  ],
  [
    "0054_manuscript_editing_completion_gate_summary.sql",
    "Persist manuscript-level editing completion gate summaries for truthful editing settlement and rerun replay.",
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
  [
    "0028_medical_rule_library_v2_foundations.sql",
    new Set(["68a0e22596898642bc396ac4664b8c5781b0a9dbbd624ed20b228313b11966b5"]),
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
