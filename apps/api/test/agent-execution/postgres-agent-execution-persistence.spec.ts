import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { PostgresAgentExecutionRepository } from "../../src/modules/agent-execution/index.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";

test("postgres agent execution repository persists running and completed logs", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);

    const pool = new Pool({ connectionString: databaseUrl });
    try {
      const repository = new PostgresAgentExecutionRepository({ client: pool });

      await repository.save({
        id: "log-1",
        manuscript_id: "manuscript-1",
        module: "editing",
        triggered_by: "admin-1",
        runtime_id: "runtime-1",
        sandbox_profile_id: "sandbox-1",
        agent_profile_id: "agent-profile-1",
        runtime_binding_id: "binding-1",
        tool_permission_policy_id: "policy-1",
        knowledge_item_ids: ["knowledge-1"],
        verification_check_profile_ids: ["check-profile-1"],
        evaluation_suite_ids: ["suite-1"],
        release_check_profile_id: "release-profile-1",
        verification_evidence_ids: [],
        status: "running",
        started_at: "2026-03-30T08:00:00.000Z",
      });
      await repository.save({
        id: "log-1",
        manuscript_id: "manuscript-1",
        module: "editing",
        triggered_by: "admin-1",
        runtime_id: "runtime-1",
        sandbox_profile_id: "sandbox-1",
        agent_profile_id: "agent-profile-1",
        runtime_binding_id: "binding-1",
        tool_permission_policy_id: "policy-1",
        execution_snapshot_id: "snapshot-1",
        routing_policy_version_id: "00000000-0000-0000-0000-000000000201",
        routing_policy_scope_kind: "template_family",
        routing_policy_scope_value: "family-1",
        resolved_model_id: "00000000-0000-0000-0000-000000000301",
        fallback_model_id: "00000000-0000-0000-0000-000000000302",
        fallback_trigger: "rate_limit",
        knowledge_item_ids: ["knowledge-1"],
        verification_check_profile_ids: ["check-profile-1"],
        evaluation_suite_ids: ["suite-1"],
        release_check_profile_id: "release-profile-1",
        verification_evidence_ids: ["evidence-1"],
        status: "completed",
        started_at: "2026-03-30T08:00:00.000Z",
        finished_at: "2026-03-30T08:05:00.000Z",
      });

      const loaded = await repository.findById("log-1");
      const list = await repository.list();

      assert.equal(loaded?.status, "completed");
      assert.equal(loaded?.execution_snapshot_id, "snapshot-1");
      assert.equal(
        loaded?.routing_policy_version_id,
        "00000000-0000-0000-0000-000000000201",
      );
      assert.equal(loaded?.routing_policy_scope_kind, "template_family");
      assert.equal(loaded?.routing_policy_scope_value, "family-1");
      assert.equal(
        loaded?.resolved_model_id,
        "00000000-0000-0000-0000-000000000301",
      );
      assert.equal(
        loaded?.fallback_model_id,
        "00000000-0000-0000-0000-000000000302",
      );
      assert.equal(loaded?.fallback_trigger, "rate_limit");
      assert.deepEqual(loaded?.verification_check_profile_ids, [
        "check-profile-1",
      ]);
      assert.deepEqual(loaded?.evaluation_suite_ids, ["suite-1"]);
      assert.equal(loaded?.release_check_profile_id, "release-profile-1");
      assert.deepEqual(loaded?.verification_evidence_ids, ["evidence-1"]);
      assert.deepEqual(list.map((record) => record.id), ["log-1"]);
    } finally {
      await pool.end();
    }
  });
});
