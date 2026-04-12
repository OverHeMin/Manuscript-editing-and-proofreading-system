import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { PostgresRuntimeBindingRepository } from "../../src/modules/runtime-bindings/index.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";

test("postgres runtime binding repository persists scoped versions and active filtering", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);

    const pool = new Pool({ connectionString: databaseUrl });
    try {
      const repository = new PostgresRuntimeBindingRepository({ client: pool });

      const firstVersion = await repository.reserveNextVersion(
        "editing",
        "clinical_study",
        "family-1",
      );
      assert.equal(firstVersion, 1);

      await repository.save({
        id: "binding-1",
        module: "editing",
        manuscript_type: "clinical_study",
        template_family_id: "family-1",
        runtime_id: "runtime-1",
        sandbox_profile_id: "sandbox-1",
        agent_profile_id: "agent-profile-1",
        tool_permission_policy_id: "policy-1",
        prompt_template_id: "prompt-1",
        skill_package_ids: ["skill-1"],
        quality_package_version_ids: ["quality-package-version-1"],
        execution_profile_id: "profile-1",
        verification_check_profile_ids: ["check-profile-1"],
        evaluation_suite_ids: ["suite-1"],
        release_check_profile_id: "release-profile-1",
        status: "active",
        version: firstVersion,
      });

      const secondVersion = await repository.reserveNextVersion(
        "editing",
        "clinical_study",
        "family-1",
      );
      assert.equal(secondVersion, 2);

      const active = await repository.listByScope(
        "editing",
        "clinical_study",
        "family-1",
        true,
      );
      const loaded = await repository.findById("binding-1");

      assert.deepEqual(active.map((record) => record.id), ["binding-1"]);
      assert.equal(loaded?.version, 1);
      assert.deepEqual(loaded?.skill_package_ids, ["skill-1"]);
      assert.deepEqual(loaded?.quality_package_version_ids, [
        "quality-package-version-1",
      ]);
      assert.deepEqual(loaded?.verification_check_profile_ids, [
        "check-profile-1",
      ]);
      assert.deepEqual(loaded?.evaluation_suite_ids, ["suite-1"]);
      assert.equal(loaded?.release_check_profile_id, "release-profile-1");
    } finally {
      await pool.end();
    }
  });
});
