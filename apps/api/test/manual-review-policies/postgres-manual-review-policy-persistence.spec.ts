import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { PostgresManualReviewPolicyRepository } from "../../src/modules/manual-review-policies/index.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";

test("postgres manual review policy repository persists scoped versions, active filtering, and json arrays", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);

    const pool = new Pool({ connectionString: databaseUrl });
    try {
      const repository = new PostgresManualReviewPolicyRepository({ client: pool });

      const firstVersion = await repository.reserveNextVersion(
        "editing",
        "clinical_study",
        "family-1",
      );
      assert.equal(firstVersion, 1);

      await repository.save({
        id: "policy-1",
        module: "editing",
        manuscript_type: "clinical_study",
        template_family_id: "family-1",
        name: "Editing review policy v1",
        min_confidence_threshold: 0.82,
        high_risk_force_review: true,
        conflict_force_review: true,
        insufficient_knowledge_force_review: true,
        module_blocklist_rules: ["block-abstract", "block-conclusion"],
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
      const loaded = await repository.findById("policy-1");

      assert.deepEqual(active.map((record) => record.id), ["policy-1"]);
      assert.equal(loaded?.version, 1);
      assert.equal(loaded?.min_confidence_threshold, 0.82);
      assert.deepEqual(loaded?.module_blocklist_rules, [
        "block-abstract",
        "block-conclusion",
      ]);
    } finally {
      await pool.end();
    }
  });
});
