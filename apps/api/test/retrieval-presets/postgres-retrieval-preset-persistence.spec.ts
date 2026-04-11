import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { PostgresRetrievalPresetRepository } from "../../src/modules/retrieval-presets/index.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";

test("postgres retrieval preset repository persists scoped versions, active filtering, and json arrays", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);

    const pool = new Pool({ connectionString: databaseUrl });
    try {
      const repository = new PostgresRetrievalPresetRepository({ client: pool });

      const firstVersion = await repository.reserveNextVersion(
        "editing",
        "clinical_study",
        "family-1",
      );
      assert.equal(firstVersion, 1);

      await repository.save({
        id: "preset-1",
        module: "editing",
        manuscript_type: "clinical_study",
        template_family_id: "family-1",
        name: "Editing retrieval v1",
        top_k: 6,
        section_filters: ["discussion", "references"],
        risk_tag_filters: ["high_risk", "conflict"],
        rerank_enabled: true,
        citation_required: true,
        min_retrieval_score: 0.64,
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
      const loaded = await repository.findById("preset-1");

      assert.deepEqual(active.map((record) => record.id), ["preset-1"]);
      assert.equal(loaded?.version, 1);
      assert.deepEqual(loaded?.section_filters, ["discussion", "references"]);
      assert.deepEqual(loaded?.risk_tag_filters, ["high_risk", "conflict"]);
      assert.equal(loaded?.min_retrieval_score, 0.64);
    } finally {
      await pool.end();
    }
  });
});
