import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { getRepositoryMigrationFiles } from "../../src/database/migration-ledger.ts";
import { withTemporaryDatabase } from "./support/postgres.ts";
import { getMigrationChecksum, runMigrateProcess } from "./support/migrate-process.ts";

const expectedTableColumns: Record<string, string[]> = {
  roles: ["key", "description", "created_at"],
  users: [
    "id",
    "username",
    "display_name",
    "role_key",
    "password_hash",
    "status",
    "created_at",
    "updated_at",
  ],
  auth_sessions: [
    "id",
    "user_id",
    "provider",
    "issued_at",
    "expires_at",
    "refresh_at",
    "ip_address",
    "user_agent",
    "revoked_at",
  ],
  ai_provider_connections: [
    "id",
    "name",
    "provider_kind",
    "compatibility_mode",
    "base_url",
    "enabled",
    "connection_metadata",
    "last_test_status",
    "last_test_at",
    "last_error_summary",
  ],
  ai_provider_credentials: [
    "id",
    "connection_id",
    "credential_ciphertext",
    "credential_mask",
    "credential_version",
    "last_rotated_at",
  ],
  login_attempts: [
    "username",
    "failure_count",
    "first_failed_at",
    "last_failed_at",
    "locked_until",
  ],
  manuscripts: [
    "id",
    "title",
    "manuscript_type",
    "status",
    "created_by",
    "current_template_family_id",
    "current_journal_template_id",
  ],
  document_assets: [
    "id",
    "manuscript_id",
    "asset_type",
    "status",
    "storage_key",
    "file_name",
    "source_job_id",
    "is_current",
  ],
  jobs: ["id", "manuscript_id", "module", "job_type", "status", "requested_by"],
  template_families: ["id", "manuscript_type", "name", "status"],
  journal_template_profiles: [
    "id",
    "template_family_id",
    "journal_key",
    "journal_name",
    "status",
  ],
  module_templates: [
    "id",
    "template_family_id",
    "module",
    "manuscript_type",
    "version_no",
    "status",
    "prompt",
    "source_learning_candidate_id",
  ],
  knowledge_items: [
    "id",
    "title",
    "canonical_text",
    "knowledge_kind",
    "module_scope",
    "manuscript_types",
    "status",
    "source_learning_candidate_id",
    "projection_source",
  ],
  knowledge_assets: [
    "id",
    "status",
    "current_revision_id",
    "current_approved_revision_id",
    "created_at",
    "updated_at",
  ],
  knowledge_revisions: [
    "id",
    "asset_id",
    "revision_no",
    "status",
    "title",
    "canonical_text",
    "knowledge_kind",
    "module_scope",
    "manuscript_types",
    "effective_at",
    "expires_at",
    "source_learning_candidate_id",
    "projection_source",
    "based_on_revision_id",
    "created_at",
    "updated_at",
  ],
  knowledge_revision_bindings: [
    "id",
    "revision_id",
    "binding_kind",
    "binding_target_id",
    "binding_target_label",
    "created_at",
  ],
  knowledge_revision_content_blocks: [
    "id",
    "revision_id",
    "block_type",
    "order_no",
    "status",
    "content_payload",
    "table_semantics",
    "image_understanding",
    "created_at",
    "updated_at",
  ],
  knowledge_semantic_layers: [
    "revision_id",
    "status",
    "page_summary",
    "retrieval_terms",
    "retrieval_snippets",
    "table_semantics",
    "image_understanding",
    "created_at",
    "updated_at",
  ],
  knowledge_review_actions: [
    "id",
    "knowledge_item_id",
    "revision_id",
    "action",
    "actor_role",
    "review_note",
    "created_at",
  ],
  knowledge_duplicate_acknowledgements: [
    "id",
    "revision_id",
    "matched_asset_ids",
    "highest_severity",
    "acknowledged_by_role",
    "created_at",
  ],
  learning_candidates: [
    "id",
    "type",
    "status",
    "module",
    "manuscript_type",
    "snapshot_asset_id",
    "candidate_payload",
    "suggested_rule_object",
    "suggested_template_family_id",
    "suggested_journal_template_id",
  ],
  learning_writebacks: [
    "id",
    "learning_candidate_id",
    "target_type",
    "status",
    "created_draft_asset_id",
    "created_by",
    "created_at",
    "applied_by",
    "applied_at",
  ],
  harness_gold_set_families: [
    "id",
    "name",
    "module",
    "manuscript_types",
    "measure_focus",
    "template_family_id",
    "admin_only",
    "created_at",
    "updated_at",
  ],
  harness_rubric_definitions: [
    "id",
    "name",
    "version_no",
    "status",
    "module",
    "manuscript_types",
    "scoring_dimensions",
    "created_by",
    "created_at",
    "published_by",
    "published_at",
  ],
  harness_gold_set_versions: [
    "id",
    "family_id",
    "version_no",
    "status",
    "rubric_definition_id",
    "item_count",
    "deidentification_gate_passed",
    "human_review_gate_passed",
    "items",
    "publication_notes",
    "created_by",
    "created_at",
    "published_by",
    "published_at",
    "archived_by",
    "archived_at",
  ],
  harness_dataset_publications: [
    "id",
    "gold_set_version_id",
    "export_format",
    "status",
    "output_uri",
    "deidentification_gate_passed",
    "created_at",
  ],
  knowledge_retrieval_index_entries: [
    "id",
    "knowledge_item_id",
    "module",
    "manuscript_types",
    "template_family_id",
    "title",
    "source_text",
    "source_hash",
    "embedding_provider",
    "embedding_model",
    "embedding_dimensions",
    "embedding_storage_backend",
    "embedding_vector",
    "metadata",
    "created_at",
    "updated_at",
  ],
  knowledge_retrieval_snapshots: [
    "id",
    "module",
    "manuscript_id",
    "manuscript_type",
    "template_family_id",
    "query_text",
    "query_context",
    "retriever_config",
    "retrieved_items",
    "reranked_items",
    "created_at",
  ],
  knowledge_retrieval_quality_runs: [
    "id",
    "gold_set_version_id",
    "module",
    "template_family_id",
    "retrieval_snapshot_ids",
    "retriever_config",
    "reranker_config",
    "metric_summary",
    "created_by",
    "created_at",
  ],
  harness_redaction_profiles: [
    "id",
    "name",
    "redaction_mode",
    "structured_fields",
    "allow_raw_payload_export",
    "created_at",
    "updated_at",
  ],
  harness_integrations: [
    "id",
    "kind",
    "display_name",
    "execution_mode",
    "fail_open",
    "redaction_profile_id",
    "feature_flag_keys",
    "result_envelope_version",
    "config",
    "created_at",
    "updated_at",
  ],
  harness_integration_feature_flag_changes: [
    "id",
    "adapter_id",
    "flag_key",
    "enabled",
    "changed_by",
    "change_reason",
    "created_at",
  ],
  harness_execution_audits: [
    "id",
    "adapter_id",
    "trigger_kind",
    "input_reference",
    "dataset_id",
    "artifact_uri",
    "status",
    "degradation_reason",
    "result_summary",
    "created_at",
  ],
  prompt_templates: [
    "id",
    "name",
    "version",
    "status",
    "module",
    "manuscript_types",
    "template_kind",
    "system_instructions",
    "task_frame",
    "hard_rule_summary",
    "allowed_content_operations",
    "forbidden_operations",
    "manual_review_policy",
    "output_contract",
    "report_style",
    "rollback_target_version",
    "source_learning_candidate_id",
  ],
  editorial_rule_sets: [
    "id",
    "template_family_id",
    "journal_template_id",
    "module",
    "version_no",
    "status",
  ],
  editorial_rules: [
    "id",
    "rule_set_id",
    "order_no",
    "rule_object",
    "rule_type",
    "execution_mode",
    "scope",
    "selector",
    "trigger",
    "action",
    "authoring_payload",
    "evidence_level",
    "explanation_payload",
    "linkage_payload",
    "projection_payload",
    "confidence_policy",
    "severity",
    "enabled",
    "example_before",
    "example_after",
    "manual_review_reason_template",
  ],
  skill_packages: [
    "id",
    "name",
    "version",
    "scope",
    "status",
    "applies_to_modules",
    "dependency_tools",
    "source_learning_candidate_id",
  ],
  execution_profiles: [
    "id",
    "module",
    "manuscript_type",
    "template_family_id",
    "module_template_id",
    "rule_set_id",
    "prompt_template_id",
    "skill_package_ids",
    "knowledge_binding_mode",
    "status",
    "version",
    "notes",
  ],
  knowledge_binding_rules: [
    "id",
    "knowledge_item_id",
    "module",
    "manuscript_types",
    "template_family_ids",
    "module_template_ids",
    "sections",
    "risk_tags",
    "priority",
    "binding_purpose",
    "status",
  ],
  execution_snapshots: [
    "id",
    "manuscript_id",
    "module",
    "job_id",
    "execution_profile_id",
    "module_template_id",
    "module_template_version_no",
    "prompt_template_id",
    "prompt_template_version",
    "skill_package_ids",
    "skill_package_versions",
    "model_id",
    "model_version",
    "knowledge_item_ids",
    "created_asset_ids",
    "agent_execution_log_id",
    "draft_snapshot_id",
    "created_at",
  ],
  knowledge_hit_logs: [
    "id",
    "snapshot_id",
    "knowledge_item_id",
    "match_source_id",
    "binding_rule_id",
    "match_source",
    "match_reasons",
    "score",
    "section",
    "created_at",
  ],
  model_routing_policies: [
    "singleton_key",
    "system_default_model_id",
    "module_defaults",
    "template_overrides",
  ],
  model_routing_policy_scopes: [
    "id",
    "scope_kind",
    "scope_value",
    "active_version_id",
    "created_at",
    "updated_at",
  ],
  model_routing_policy_versions: [
    "id",
    "policy_scope_id",
    "version_no",
    "primary_model_id",
    "fallback_model_ids",
    "evidence_links",
    "notes",
    "status",
    "created_at",
    "updated_at",
  ],
  model_routing_policy_decisions: [
    "id",
    "policy_scope_id",
    "policy_version_id",
    "decision_kind",
    "actor_id",
    "actor_role",
    "reason",
    "evidence_links",
    "created_at",
  ],
  model_registry: [
    "id",
    "provider",
    "model_name",
    "model_version",
    "allowed_modules",
    "fallback_model_id",
    "connection_id",
  ],
  agent_runtimes: [
    "id",
    "name",
    "adapter",
    "status",
    "sandbox_profile_id",
    "allowed_modules",
    "runtime_slot",
    "admin_only",
  ],
  tool_gateway_tools: [
    "id",
    "name",
    "scope",
    "access_mode",
    "admin_only",
  ],
  sandbox_profiles: [
    "id",
    "name",
    "status",
    "sandbox_mode",
    "network_access",
    "approval_required",
    "allowed_tool_ids",
    "admin_only",
  ],
  agent_profiles: [
    "id",
    "name",
    "role_key",
    "status",
    "module_scope",
    "manuscript_types",
    "description",
    "admin_only",
  ],
  runtime_bindings: [
    "id",
    "module",
    "manuscript_type",
    "template_family_id",
    "runtime_id",
    "sandbox_profile_id",
    "agent_profile_id",
    "tool_permission_policy_id",
    "prompt_template_id",
    "skill_package_ids",
    "execution_profile_id",
    "verification_check_profile_ids",
    "evaluation_suite_ids",
    "release_check_profile_id",
    "status",
    "version",
  ],
  tool_permission_policies: [
    "id",
    "name",
    "status",
    "default_mode",
    "allowed_tool_ids",
    "high_risk_tool_ids",
    "write_requires_confirmation",
    "admin_only",
  ],
  agent_execution_logs: [
    "id",
    "manuscript_id",
    "module",
    "triggered_by",
    "runtime_id",
    "sandbox_profile_id",
    "agent_profile_id",
    "runtime_binding_id",
    "tool_permission_policy_id",
    "execution_snapshot_id",
    "routing_policy_version_id",
    "routing_policy_scope_kind",
    "routing_policy_scope_value",
    "resolved_model_id",
    "fallback_model_id",
    "fallback_trigger",
    "knowledge_item_ids",
    "verification_check_profile_ids",
    "evaluation_suite_ids",
    "release_check_profile_id",
    "verification_evidence_ids",
    "status",
    "started_at",
    "finished_at",
  ],
  audit_logs: ["id", "actor_id", "action", "target_table", "target_id", "created_at"],
};

const expectedIndexes = [
  "users_username_idx",
  "auth_sessions_user_id_idx",
  "auth_sessions_active_expires_at_idx",
  "manuscripts_status_idx",
  "document_assets_manuscript_id_idx",
  "template_families_active_manuscript_type_uidx",
  "journal_template_profiles_template_family_status_idx",
  "journal_template_profiles_family_id_uidx",
  "knowledge_items_status_module_scope_idx",
  "knowledge_items_manuscript_types_gin_idx",
  "knowledge_items_risk_tags_gin_idx",
  "knowledge_assets_status_updated_at_idx",
  "knowledge_assets_current_approved_revision_id_idx",
  "knowledge_revisions_asset_revision_no_idx",
  "knowledge_revisions_status_updated_at_idx",
  "knowledge_revisions_asset_status_updated_at_idx",
  "knowledge_revision_bindings_revision_id_created_at_idx",
  "knowledge_revision_content_blocks_revision_id_order_no_idx",
  "knowledge_revision_content_blocks_status_idx",
  "knowledge_revision_content_blocks_block_type_idx",
  "knowledge_semantic_layers_status_idx",
  "knowledge_review_actions_knowledge_item_id_created_at_idx",
  "knowledge_review_actions_revision_id_created_at_idx",
  "knowledge_duplicate_acknowledgements_revision_created_at_idx",
  "learning_candidates_status_type_updated_at_idx",
  "learning_writebacks_candidate_target_status_idx",
  "harness_gold_set_families_module_created_at_idx",
  "harness_rubric_definitions_name_status_version_idx",
  "harness_gold_set_versions_family_status_version_idx",
  "harness_dataset_publications_version_created_at_idx",
  "knowledge_retrieval_index_entries_module_updated_at_idx",
  "knowledge_retrieval_index_entries_template_family_updated_at_id",
  "knowledge_retrieval_snapshots_module_created_at_idx",
  "knowledge_retrieval_snapshots_template_family_created_at_idx",
  "knowledge_retrieval_quality_runs_gold_set_created_at_idx",
  "knowledge_retrieval_quality_runs_module_template_created_at_idx",
  "prompt_templates_module_name_status_idx",
  "editorial_rule_sets_template_family_module_status_idx",
  "editorial_rule_sets_journal_template_module_status_idx",
  "editorial_rules_rule_set_order_idx",
  "skill_packages_name_status_idx",
  "execution_profiles_module_manuscript_family_status_idx",
  "knowledge_binding_rules_module_status_priority_idx",
  "execution_snapshots_manuscript_module_created_at_idx",
  "knowledge_hit_logs_snapshot_created_at_idx",
  "module_templates_manuscript_type_module_idx",
  "module_templates_template_family_id_module_status_idx",
  "model_routing_policy_scopes_scope_kind_scope_value_key",
  "model_routing_policy_versions_policy_scope_id_version_no_key",
  "model_routing_policy_versions_policy_scope_status_version_idx",
  "model_routing_policy_versions_active_policy_scope_uidx",
  "model_routing_policy_decisions_policy_scope_created_at_idx",
  "agent_runtimes_allowed_modules_gin_idx",
  "agent_runtimes_status_adapter_runtime_slot_idx",
  "tool_gateway_tools_scope_name_idx",
  "sandbox_profiles_name_status_idx",
  "agent_profiles_role_key_name_status_idx",
  "runtime_bindings_scope_status_version_idx",
  "tool_permission_policies_name_status_idx",
  "agent_execution_logs_manuscript_module_started_at_idx",
  "verification_evidence_retrieval_snapshot_id_idx",
  "verification_evidence_retrieval_quality_run_id_idx",
  "harness_integrations_kind_updated_at_idx",
  "harness_integrations_redaction_profile_id_idx",
  "harness_integration_feature_flag_changes_adapter_created_at_idx",
  "harness_integration_feature_flag_changes_flag_key_created_at_id",
  "harness_execution_audits_adapter_created_at_idx",
  "harness_execution_audits_dataset_created_at_idx",
];

const expectedRoleKeys = [
  "admin",
  "editor",
  "knowledge_reviewer",
  "proofreader",
  "screener",
  "user",
];

const expectedMigrationFiles = getRepositoryMigrationFiles();
const legacyInitialChecksum =
  "6140ea1d2280a0712aae27ae1f284131bf1eeb239446ea46ef49298fb8b30920";

const legacyAgentToolingChecksum =
  "f177959ca7039fb15a05b667277235d9fe95ad04bb90d8c9af6783109ab535cd";
const legacyModelRoutingGovernanceChecksum =
  "ebdbfda29dcaa66f6839f1dfe89914327d56f6154340cfaa18fea1bc61da2ab4";
const legacyEditorialRuleEngineChecksum =
  "bff19d8b5bcdebe649b314a987a7dac6c02254404f205ea863fee666000c3882";
const legacyRuleLibraryV2Checksum =
  "68a0e22596898642bc396ac4664b8c5781b0a9dbbd624ed20b228313b11966b5";

test("database schema exposes the required core tables and columns", { concurrency: false }, async () => {
  await withMigratedSchemaClient(async (client) => {
    const tablesResult = await client.query<{
      table_name: string;
      column_name: string;
    }>(
      `
        select table_name, column_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name = any($1::text[])
      `,
      [Object.keys(expectedTableColumns)],
    );

    const columnsByTable = new Map<string, Set<string>>();

    for (const row of tablesResult.rows) {
      if (!columnsByTable.has(row.table_name)) {
        columnsByTable.set(row.table_name, new Set());
      }

      columnsByTable.get(row.table_name)?.add(row.column_name);
    }

    const missingTables = Object.keys(expectedTableColumns).filter(
      (tableName) => !columnsByTable.has(tableName),
    );

    assert.deepEqual(
      missingTables,
      [],
      `Missing core tables: ${missingTables.join(", ") || "none"}`,
    );

    for (const [tableName, expectedColumns] of Object.entries(expectedTableColumns)) {
      const actualColumns = columnsByTable.get(tableName) ?? new Set<string>();
      const missingColumns = expectedColumns.filter((columnName) => !actualColumns.has(columnName));

      assert.deepEqual(
        missingColumns,
        [],
        `Table ${tableName} is missing columns: ${missingColumns.join(", ") || "none"}`,
      );
    }
  });
});

test("database schema exposes the editorial rule learning writeback target", { concurrency: false }, async () => {
  await withMigratedSchemaClient(async (client) => {
    const enumLabelsResult = await client.query<{ enumlabel: string }>(
      `
        select enumlabel
        from pg_enum
        where enumtypid = 'learning_writeback_target'::regtype
        order by enumsortorder
      `,
    );

    assert.deepEqual(
      enumLabelsResult.rows.map((row) => row.enumlabel),
      [
        "knowledge_item",
        "module_template",
        "prompt_template",
        "skill_package",
        "editorial_rule_draft",
      ],
      "Expected learning writeback targets to include editorial_rule_draft for governed rule writeback.",
    );
  });
});

  test("database schema creates the required lookup indexes", { concurrency: false }, async () => {
    await withMigratedSchemaClient(async (client) => {
    const indexesResult = await client.query<{ indexname: string }>(
      `
        select indexname
        from pg_indexes
        where schemaname = 'public'
      `,
    );

    const actualIndexNames = new Set(indexesResult.rows.map((row) => row.indexname));
    const missingIndexes = expectedIndexes.filter((indexName) => !actualIndexNames.has(indexName));

      assert.deepEqual(
        missingIndexes,
        [],
        `Missing lookup indexes: ${missingIndexes.join(", ") || "none"}`,
      );
    });
  });

test(
  "database schema enforces ai provider relationships",
  { concurrency: false },
  async () => {
    await withMigratedSchemaClient(async (client) => {
      const connectionColumnResult = await client.query<{
        is_nullable: string;
      }>(
        `
          select is_nullable
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'model_registry'
            and column_name = 'connection_id'
        `,
      );

      assert.ok(
        connectionColumnResult.rows.length > 0,
        "Expected model_registry.connection_id to exist.",
      );
      assert.equal(
        connectionColumnResult.rows[0].is_nullable,
        "YES",
        "model_registry.connection_id should be nullable.",
      );

      const expectForeignKey = async (
        tableName: string,
        columnName: string,
        referencedTable: string,
      ) => {
        const result = await client.query<{ exists: boolean }>(
          `
            select exists (
              select 1
              from information_schema.table_constraints tc
              join information_schema.key_column_usage kcu
                on tc.constraint_name = kcu.constraint_name
                and tc.constraint_schema = kcu.constraint_schema
              join information_schema.constraint_column_usage ccu
                on ccu.constraint_name = tc.constraint_name
                and ccu.constraint_schema = tc.constraint_schema
              where tc.constraint_schema = 'public'
                and tc.constraint_type = 'FOREIGN KEY'
                and tc.table_name = $1
                and kcu.column_name = $2
                and ccu.table_name = $3
                and ccu.column_name = 'id'
            )
          `,
          [tableName, columnName, referencedTable],
        );

        assert.equal(
          result.rows[0]?.exists,
          true,
          `Expected foreign key from ${tableName}.${columnName} to ${referencedTable}.id`,
        );
      };

      await expectForeignKey("model_registry", "connection_id", "ai_provider_connections");
      await expectForeignKey(
        "ai_provider_credentials",
        "connection_id",
        "ai_provider_connections",
      );

      const uniqueConstraintResult = await client.query<{ exists: boolean }>(
        `
          select exists (
            select 1
            from information_schema.table_constraints tc
            join information_schema.key_column_usage kcu
              on tc.constraint_name = kcu.constraint_name
              and tc.constraint_schema = kcu.constraint_schema
            where tc.constraint_schema = 'public'
              and tc.table_name = 'ai_provider_credentials'
              and tc.constraint_type = 'UNIQUE'
              and kcu.column_name = 'connection_id'
          )
        `,
      );

      const uniqueIndexResult = await client.query<{ exists: boolean }>(
        `
          select exists (
            select 1
            from pg_indexes
            where schemaname = 'public'
              and tablename = 'ai_provider_credentials'
              and indexdef like 'CREATE UNIQUE INDEX%'
              and indexdef like '%(connection_id)%'
          )
        `,
      );

      assert.ok(
        uniqueConstraintResult.rows[0]?.exists || uniqueIndexResult.rows[0]?.exists,
        "Expected ai_provider_credentials.connection_id to be enforced as unique.",
      );
    });
  },
);

  test("migration seeds system roles and records migration bookkeeping", { concurrency: false }, async () => {
  await withMigratedSchemaClient(async (client) => {
    const rolesResult = await client.query<{ key: string }>(
      `
        select key
        from roles
        order by key
      `,
    );
    const migrationResult = await client.query<{ version: string; checksum: string }>(
      `
        select version, checksum
        from schema_migrations
        order by version
      `,
    );

    assert.deepEqual(
      rolesResult.rows.map((row) => row.key),
      expectedRoleKeys,
      "System roles should be present after migration and seeding.",
    );
    assert.deepEqual(
      migrationResult.rows,
      expectedMigrationFiles.map((version) => ({
        version,
        checksum: getMigrationChecksum(version),
      })),
      "Expected migration bookkeeping for all applied database migrations.",
    );
  });
});

test("migration bookkeeping tracks the repo migration ledger in release order", () => {
  assert.deepEqual(
    expectedMigrationFiles,
    [
      "0001_initial.sql",
      "0002_model_registry_version_guard.sql",
      "0003_document_assets_file_name.sql",
      "0004_auth_persistence.sql",
      "0005_governed_registry_persistence.sql",
      "0006_prompt_skill_registry_persistence.sql",
      "0007_model_routing_policy_persistence.sql",
      "0008_execution_runtime_persistence.sql",
      "0009_agent_tooling_persistence.sql",
      "0010_learning_review_persistence.sql",
      "0011_verification_ops_persistence.sql",
      "0012_template_family_active_uniqueness.sql",
      "0013_governed_evaluation_run_seeding.sql",
      "0014_agent_tooling_verification_expectations.sql",
      "0015_model_routing_governance_persistence.sql",
      "0016_harness_dataset_governance.sql",
      "0017_retrieval_quality_harness.sql",
      "0018_retrieval_quality_verification_ops.sql",
      "0019_local_first_harness_adapter_platform.sql",
      "0020_agent_execution_model_routing_resolution.sql",
      "0021_agent_execution_orchestration_baseline.sql",
      "0022_agent_execution_orchestration_retry_eligibility.sql",
      "0023_agent_execution_orchestration_attempt_claim_token.sql",
      "0024_execution_snapshot_agent_execution_linkage.sql",
      "0025_editorial_rule_engine_persistence.sql",
      "0026_model_provider_domestic.sql",
      "0027_medical_editorial_rule_authoring_workbench.sql",
      "0028_medical_rule_library_v2_foundations.sql",
      "0029_learning_reviewed_snapshot_source_kind.sql",
      "0030_knowledge_library_v1_revision_governance.sql",
      "0031_knowledge_duplicate_detection_acknowledgements.sql",
      "0032_ai_provider_control_plane.sql",
      "0033_knowledge_library_rich_space.sql",
    ],
    "Expected the repository migration ledger to include the current release-reliability schema set.",
  );
});

test("model_registry rejects duplicate unversioned models", { concurrency: false }, async () => {
  await withMigratedSchemaClient(async (client) => {
    const modelName = `gpt-unversioned-regression-${process.pid}`;

    await client.query(
      `
        delete from model_registry
        where model_name = $1
      `,
      [modelName],
    );

    try {
      await client.query(
        `
          insert into model_registry (
            provider,
            model_name,
            allowed_modules,
            is_prod_allowed
          )
          values (
            'openai',
            $1,
            array['screening']::module_type[],
            false
          )
        `,
        [modelName],
      );

      await assert.rejects(
        () =>
          client.query(
            `
              insert into model_registry (
                provider,
                model_name,
                allowed_modules,
                is_prod_allowed
              )
              values (
                'openai',
                $1,
                array['screening']::module_type[],
                true
              )
            `,
            [modelName],
          ),
        (error: unknown) => {
          assert.equal((error as { code?: string }).code, "23505");
          return true;
        },
        "Expected duplicate logical unversioned models to be rejected.",
      );
    } finally {
      await client.query(
        `
          delete from model_registry
          where model_name = $1
        `,
        [modelName],
      );
    }
  });
});

test("migrate detects checksum mismatches before applying anything new", { concurrency: false }, async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const initialMigration = runMigrateProcess(databaseUrl);
    assert.equal(initialMigration.status, 0, "Expected migrate to succeed for a fresh isolated database.");

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      await client.query(
        `
          update schema_migrations
          set checksum = 'tampered-checksum'
          where version = '0001_initial.sql'
        `,
      );
    } finally {
      await client.end();
    }

    const result = runMigrateProcess(databaseUrl);
    assert.notEqual(result.status, 0, "Expected migrate to fail on checksum mismatch.");
    assert.match(
      `${result.stdout}\n${result.stderr}`,
      /Migration checksum mismatch for 0001_initial\.sql/,
    );

    const verificationClient = new Client({ connectionString: databaseUrl });
    await verificationClient.connect();

    try {
      const migrationResult = await verificationClient.query<{ version: string; checksum: string }>(
        `
          select version, checksum
          from schema_migrations
          order by version
        `,
      );

      assert.deepEqual(
        migrationResult.rows,
        expectedMigrationFiles.map((version) => ({
          version,
          checksum:
            version === "0001_initial.sql" ? "tampered-checksum" : getMigrationChecksum(version),
        })),
        "Expected blocked migration drift to leave bookkeeping untouched except for the injected mismatch.",
      );
    } finally {
      await verificationClient.end();
    }
  });
});

test("migrate accepts line-ending-only checksum differences for existing migrations", { concurrency: false }, async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const initialMigration = runMigrateProcess(databaseUrl);
    assert.equal(initialMigration.status, 0, "Expected migrate to succeed for a fresh isolated database.");

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      for (const fileName of expectedMigrationFiles) {
        await client.query(
          `
            update schema_migrations
            set checksum = $1
            where version = $2
          `,
          [getLineEndingNormalizedMigrationChecksum(fileName), fileName],
        );
      }
    } finally {
      await client.end();
    }

    const rerunMigration = runMigrateProcess(databaseUrl);
    assert.equal(
      rerunMigration.status,
      0,
      `Expected migrate to accept equivalent line-ending-only checksum changes.\n${rerunMigration.stdout}\n${rerunMigration.stderr}`,
    );
  });
});

test("migrate repairs accepted legacy 0001 initial checksum rows by normalizing bookkeeping", { concurrency: false }, async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const initialMigration = runMigrateProcess(databaseUrl);
    assert.equal(initialMigration.status, 0, "Expected migrate to succeed for a fresh isolated database.");

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      await client.query(
        `
          update schema_migrations
          set checksum = $1
          where version = '0001_initial.sql'
        `,
        [legacyInitialChecksum],
      );
    } finally {
      await client.end();
    }

    const rerunMigration = runMigrateProcess(databaseUrl);
    assert.equal(
      rerunMigration.status,
      0,
      `Expected migrate to normalize the accepted legacy 0001 checksum.\n${rerunMigration.stdout}\n${rerunMigration.stderr}`,
    );

    const verificationClient = new Client({ connectionString: databaseUrl });
    await verificationClient.connect();

    try {
      const migrationResult = await verificationClient.query<{ version: string; checksum: string }>(
        `
          select version, checksum
          from schema_migrations
          where version = '0001_initial.sql'
        `,
      );

      assert.deepEqual(migrationResult.rows, [
        {
          version: "0001_initial.sql",
          checksum: getMigrationChecksum("0001_initial.sql"),
        },
      ]);
    } finally {
      await verificationClient.end();
    }
  });
});

test("migrate repairs legacy 0009 agent-tooling databases by backfilling verification expectation columns", { concurrency: false }, async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const initialMigration = runMigrateProcess(databaseUrl);
    assert.equal(initialMigration.status, 0, "Expected migrate to succeed for a fresh isolated database.");

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      await client.query(`
        alter table runtime_bindings
          drop column if exists verification_check_profile_ids,
          drop column if exists evaluation_suite_ids,
          drop column if exists release_check_profile_id
      `);
      await client.query(`
        alter table agent_execution_logs
          drop column if exists verification_check_profile_ids,
          drop column if exists evaluation_suite_ids,
          drop column if exists release_check_profile_id
      `);
      await client.query(
        `
          delete from schema_migrations
          where version = '0014_agent_tooling_verification_expectations.sql'
        `,
      );
      await client.query(
        `
          update schema_migrations
          set checksum = $1
          where version = '0009_agent_tooling_persistence.sql'
        `,
        [legacyAgentToolingChecksum],
      );
    } finally {
      await client.end();
    }

    const rerunMigration = runMigrateProcess(databaseUrl);
    assert.equal(
      rerunMigration.status,
      0,
      `Expected migrate to repair legacy 0009 agent-tooling databases.\n${rerunMigration.stdout}\n${rerunMigration.stderr}`,
    );

    const verificationClient = new Client({ connectionString: databaseUrl });
    await verificationClient.connect();

    try {
      const columnsResult = await verificationClient.query<{
        table_name: string;
        column_name: string;
      }>(
        `
          select table_name, column_name
          from information_schema.columns
          where table_schema = 'public'
            and table_name in ('runtime_bindings', 'agent_execution_logs')
            and column_name in (
              'verification_check_profile_ids',
              'evaluation_suite_ids',
              'release_check_profile_id'
            )
          order by table_name, column_name
        `,
      );

      assert.deepEqual(
        columnsResult.rows,
        [
          {
            table_name: "agent_execution_logs",
            column_name: "evaluation_suite_ids",
          },
          {
            table_name: "agent_execution_logs",
            column_name: "release_check_profile_id",
          },
          {
            table_name: "agent_execution_logs",
            column_name: "verification_check_profile_ids",
          },
          {
            table_name: "runtime_bindings",
            column_name: "evaluation_suite_ids",
          },
          {
            table_name: "runtime_bindings",
            column_name: "release_check_profile_id",
          },
          {
            table_name: "runtime_bindings",
            column_name: "verification_check_profile_ids",
          },
        ],
        "Expected migrate to restore verification expectation columns for legacy 0009 databases.",
      );
    } finally {
      await verificationClient.end();
    }
  });
});

test("migrate repairs legacy 0015 model routing databases by normalizing checksum and applying routed execution columns", { concurrency: false }, async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const initialMigration = runMigrateProcess(databaseUrl);
    assert.equal(initialMigration.status, 0, "Expected migrate to succeed for a fresh isolated database.");

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      await client.query(
        `
          delete from schema_migrations
          where version = '0020_agent_execution_model_routing_resolution.sql'
        `,
      );
      await client.query(
        `
          update schema_migrations
          set checksum = $1
          where version = '0015_model_routing_governance_persistence.sql'
        `,
        [legacyModelRoutingGovernanceChecksum],
      );
    } finally {
      await client.end();
    }

    const rerunMigration = runMigrateProcess(databaseUrl);
    assert.equal(
      rerunMigration.status,
      0,
      `Expected migrate to repair legacy 0015 model-routing databases.\n${rerunMigration.stdout}\n${rerunMigration.stderr}`,
    );

    const verificationClient = new Client({ connectionString: databaseUrl });
    await verificationClient.connect();

    try {
      const columnsResult = await verificationClient.query<{
        column_name: string;
      }>(
        `
          select column_name
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'agent_execution_logs'
            and column_name in (
              'routing_policy_version_id',
              'routing_policy_scope_kind',
              'routing_policy_scope_value',
              'resolved_model_id',
              'fallback_model_id',
              'fallback_trigger'
            )
          order by column_name
        `,
      );
      const migrationResult = await verificationClient.query<{ version: string; checksum: string }>(
        `
          select version, checksum
          from schema_migrations
          where version in (
            '0015_model_routing_governance_persistence.sql',
            '0020_agent_execution_model_routing_resolution.sql'
          )
          order by version
        `,
      );

      assert.deepEqual(
        columnsResult.rows,
        [
          { column_name: "fallback_model_id" },
          { column_name: "fallback_trigger" },
          { column_name: "resolved_model_id" },
          { column_name: "routing_policy_scope_kind" },
          { column_name: "routing_policy_scope_value" },
          { column_name: "routing_policy_version_id" },
        ],
        "Expected migrate to preserve routed execution columns for legacy 0015 databases.",
      );
      assert.deepEqual(
        migrationResult.rows,
        [
          {
            version: "0015_model_routing_governance_persistence.sql",
            checksum: getMigrationChecksum("0015_model_routing_governance_persistence.sql"),
          },
          {
            version: "0020_agent_execution_model_routing_resolution.sql",
            checksum: getMigrationChecksum("0020_agent_execution_model_routing_resolution.sql"),
          },
        ],
        "Expected migrate to normalize legacy 0015 checksum and record the new routed execution migration.",
      );
    } finally {
      await verificationClient.end();
    }
  });
});

test("migrate repairs legacy 0025 editorial rule databases by restoring projected knowledge columns", { concurrency: false }, async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const initialMigration = runMigrateProcess(databaseUrl);
    assert.equal(initialMigration.status, 0, "Expected migrate to succeed for a fresh isolated database.");

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      await client.query(`
        alter table knowledge_items
          drop column if exists projection_source
      `);
      await client.query(
        `
          update schema_migrations
          set checksum = $1
          where version = '0025_editorial_rule_engine_persistence.sql'
        `,
        [legacyEditorialRuleEngineChecksum],
      );
    } finally {
      await client.end();
    }

    const rerunMigration = runMigrateProcess(databaseUrl);
    assert.equal(
      rerunMigration.status,
      0,
      `Expected migrate to repair legacy 0025 editorial-rule databases.\n${rerunMigration.stdout}\n${rerunMigration.stderr}`,
    );

    const verificationClient = new Client({ connectionString: databaseUrl });
    await verificationClient.connect();

    try {
      const columnsResult = await verificationClient.query<{ column_name: string }>(
        `
          select column_name
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'knowledge_items'
            and column_name = 'projection_source'
        `,
      );
      const migrationResult = await verificationClient.query<{ version: string; checksum: string }>(
        `
          select version, checksum
          from schema_migrations
          where version = '0025_editorial_rule_engine_persistence.sql'
        `,
      );

      assert.deepEqual(
        columnsResult.rows,
        [{ column_name: "projection_source" }],
        "Expected migrate to restore the projected knowledge provenance column for legacy 0025 databases.",
      );
      assert.deepEqual(migrationResult.rows, [
        {
          version: "0025_editorial_rule_engine_persistence.sql",
          checksum: getMigrationChecksum("0025_editorial_rule_engine_persistence.sql"),
        },
      ]);
    } finally {
      await verificationClient.end();
    }
  });
});

test("migrate repairs legacy 0028 rule-library databases by restoring editorial rule draft writeback coverage", { concurrency: false }, async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      await applyRepositoryMigrationsThrough(
        client,
        "0027_medical_editorial_rule_authoring_workbench.sql",
      );

      await client.query("begin");

      try {
        await client.query(createLegacyRuleLibraryV2MigrationSql());
        await client.query(
          `
            insert into schema_migrations (version, checksum)
            values ($1, $2)
          `,
          [
            "0028_medical_rule_library_v2_foundations.sql",
            legacyRuleLibraryV2Checksum,
          ],
        );
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }

      const beforeRepairEnum = await client.query<{ enumlabel: string }>(
        `
          select enumlabel
          from pg_enum e
          join pg_type t on t.oid = e.enumtypid
          where t.typname = 'learning_writeback_target'
            and enumlabel = 'editorial_rule_draft'
        `,
      );

      assert.deepEqual(
        beforeRepairEnum.rows,
        [],
        "Expected the legacy 0028 fixture to miss the editorial_rule_draft enum value before repair.",
      );
    } finally {
      await client.end();
    }

    const rerunMigration = runMigrateProcess(databaseUrl);
    assert.equal(
      rerunMigration.status,
      0,
      `Expected migrate to repair legacy 0028 rule-library databases.\n${rerunMigration.stdout}\n${rerunMigration.stderr}`,
    );

    const verificationClient = new Client({ connectionString: databaseUrl });
    await verificationClient.connect();

    try {
      const enumResult = await verificationClient.query<{ enumlabel: string }>(
        `
          select enumlabel
          from pg_enum e
          join pg_type t on t.oid = e.enumtypid
          where t.typname = 'learning_writeback_target'
            and enumlabel = 'editorial_rule_draft'
        `,
      );
      const migrationResult = await verificationClient.query<{ version: string; checksum: string }>(
        `
          select version, checksum
          from schema_migrations
          where version in (
            '0028_medical_rule_library_v2_foundations.sql',
            '0029_learning_reviewed_snapshot_source_kind.sql',
            '0030_knowledge_library_v1_revision_governance.sql',
            '0031_knowledge_duplicate_detection_acknowledgements.sql',
            '0032_ai_provider_control_plane.sql',
            '0033_knowledge_library_rich_space.sql'
          )
          order by version
        `,
      );

      assert.deepEqual(enumResult.rows, [{ enumlabel: "editorial_rule_draft" }]);
      assert.deepEqual(migrationResult.rows, [
        {
          version: "0028_medical_rule_library_v2_foundations.sql",
          checksum: getMigrationChecksum("0028_medical_rule_library_v2_foundations.sql"),
        },
        {
          version: "0029_learning_reviewed_snapshot_source_kind.sql",
          checksum: getMigrationChecksum("0029_learning_reviewed_snapshot_source_kind.sql"),
        },
        {
          version: "0030_knowledge_library_v1_revision_governance.sql",
          checksum: getMigrationChecksum("0030_knowledge_library_v1_revision_governance.sql"),
        },
        {
          version: "0031_knowledge_duplicate_detection_acknowledgements.sql",
          checksum: getMigrationChecksum("0031_knowledge_duplicate_detection_acknowledgements.sql"),
        },
        {
          version: "0032_ai_provider_control_plane.sql",
          checksum: getMigrationChecksum("0032_ai_provider_control_plane.sql"),
        },
        {
          version: "0033_knowledge_library_rich_space.sql",
          checksum: getMigrationChecksum("0033_knowledge_library_rich_space.sql"),
        },
      ]);
    } finally {
      await verificationClient.end();
    }
  });
});

test("migrate blocks unknown database migration versions instead of treating them as pending repo work", { concurrency: false }, async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const initialMigration = runMigrateProcess(databaseUrl);
    assert.equal(initialMigration.status, 0, "Expected migrate to succeed for a fresh isolated database.");

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      await client.query(
        `
          insert into schema_migrations (version, checksum)
          values ('9999_manual_hotfix.sql', 'manual-hotfix-checksum')
        `,
      );
    } finally {
      await client.end();
    }

    const rerunMigration = runMigrateProcess(databaseUrl);
    assert.notEqual(
      rerunMigration.status,
      0,
      "Expected unknown database migration versions to remain blocking drift.",
    );
    assert.match(
      `${rerunMigration.stdout}\n${rerunMigration.stderr}`,
      /Unknown database migration version 9999_manual_hotfix\.sql/,
    );
  });
});

test("model routing governance schema enforces unique scope identity and only one active version per scope", { concurrency: false }, async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      await client.query(
        `
          insert into model_registry (
            id,
            provider,
            model_name,
            model_version,
            allowed_modules,
            is_prod_allowed
          )
          values
            (
              '00000000-0000-0000-0000-000000000101',
              'openai',
              'gpt-5-primary',
              '2026-04',
              array['screening']::module_type[],
              true
            ),
            (
              '00000000-0000-0000-0000-000000000102',
              'openai',
              'gpt-5-secondary',
              '2026-04',
              array['screening']::module_type[],
              true
            )
        `,
      );

      await client.query(
        `
          insert into model_routing_policy_scopes (
            id,
            scope_kind,
            scope_value
          )
          values (
            '00000000-0000-0000-0000-000000000201',
            'template_family',
            'family-1'
          )
        `,
      );

      await assert.rejects(
        () =>
          client.query(
            `
              insert into model_routing_policy_scopes (
                id,
                scope_kind,
                scope_value
              )
              values (
                '00000000-0000-0000-0000-000000000202',
                'template_family',
                'family-1'
              )
            `,
          ),
        (error: unknown) => {
          assert.equal((error as { code?: string }).code, "23505");
          return true;
        },
      );

      await client.query(
        `
          insert into model_routing_policy_versions (
            id,
            policy_scope_id,
            version_no,
            primary_model_id,
            fallback_model_ids,
            evidence_links,
            notes,
            status
          )
          values (
            '00000000-0000-0000-0000-000000000301',
            '00000000-0000-0000-0000-000000000201',
            1,
            '00000000-0000-0000-0000-000000000101',
            '{}'::uuid[],
            '[{\"kind\":\"evaluation_run\",\"id\":\"run-1\"}]'::jsonb,
            'First active version.',
            'active'
          )
        `,
      );

      await assert.rejects(
        () =>
          client.query(
            `
              insert into model_routing_policy_versions (
                id,
                policy_scope_id,
                version_no,
                primary_model_id,
                fallback_model_ids,
                evidence_links,
                notes,
                status
              )
              values (
                '00000000-0000-0000-0000-000000000302',
                '00000000-0000-0000-0000-000000000201',
                2,
                '00000000-0000-0000-0000-000000000102',
                '{}'::uuid[],
                '[{\"kind\":\"evaluation_run\",\"id\":\"run-2\"}]'::jsonb,
                'Second active version should be rejected.',
                'active'
              )
            `,
          ),
        (error: unknown) => {
          assert.equal((error as { code?: string }).code, "23505");
          return true;
        },
      );
    } finally {
      await client.end();
    }
  });
});

function getLineEndingNormalizedMigrationChecksum(fileName: string): string {
  const migrationFilePath = path.join(
    import.meta.dirname,
    "../../src/database/migrations",
    fileName,
  );
  const migrationSql = readFileSync(migrationFilePath, "utf8").replaceAll("\r\n", "\n");
  return createHash("sha256").update(migrationSql).digest("hex");
}

async function withMigratedSchemaClient<T>(
  run: (client: Client) => Promise<T>,
): Promise<T> {
  return withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for the temporary schema database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      return await run(client);
    } finally {
      await client.end();
    }
  });
}

async function applyRepositoryMigrationsThrough(client: Client, stopAtVersion: string): Promise<void> {
  await client.query(`
    create table if not exists schema_migrations (
      version text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);

  for (const version of expectedMigrationFiles) {
    const migrationSql = readFileSync(
      path.join(import.meta.dirname, "../../src/database/migrations", version),
      "utf8",
    );
    const checksum = getMigrationChecksum(version);

    await client.query("begin");

    try {
      await client.query(migrationSql);
      await client.query(
        `
          insert into schema_migrations (version, checksum)
          values ($1, $2)
        `,
        [version, checksum],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }

    if (version === stopAtVersion) {
      return;
    }
  }

  throw new Error(`Unable to stop at migration ${stopAtVersion}.`);
}

function createLegacyRuleLibraryV2MigrationSql(): string {
  return readFileSync(
    path.join(
      import.meta.dirname,
      "../../src/database/migrations/0028_medical_rule_library_v2_foundations.sql",
    ),
    "utf8",
  )
    .replaceAll("\r\n", "\n")
    .replace(
      /\ndo \$\$\nbegin\n  if exists \([\s\S]*?end\n\$\$;\n/u,
      "\n",
    );
}
