import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { PostgresManuscriptQualityPackageRepository } from "../../src/modules/manuscript-quality-packages/index.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";

test("postgres manuscript quality package repository persists scoped versions and manifests", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);

    const pool = new Pool({ connectionString: databaseUrl });
    try {
      const repository = new PostgresManuscriptQualityPackageRepository({
        client: pool,
      });

      const firstVersion = await repository.reserveNextVersion(
        "general_style_package",
        "Medical Research Style",
        ["general_proofreading"],
      );
      assert.equal(firstVersion, 1);

      await repository.save({
        id: "quality-package-version-1",
        package_name: "Medical Research Style",
        package_kind: "general_style_package",
        target_scopes: ["general_proofreading"],
        version: firstVersion,
        status: "draft",
        manifest: {
          section_expectations: {
            abstract: {
              required_labels: ["objective", "methods", "results", "conclusion"],
            },
          },
        },
      });

      const secondVersion = await repository.reserveNextVersion(
        "general_style_package",
        "Medical Research Style",
        ["general_proofreading"],
      );
      assert.equal(secondVersion, 2);

      const loaded = await repository.findById("quality-package-version-1");
      const scoped = await repository.listByScope({
        packageKind: "general_style_package",
        targetScope: "general_proofreading",
      });

      assert.equal(loaded?.package_kind, "general_style_package");
      assert.deepEqual(loaded?.target_scopes, ["general_proofreading"]);
      assert.equal(loaded?.status, "draft");
      assert.deepEqual(loaded?.manifest, {
        section_expectations: {
          abstract: {
            required_labels: ["objective", "methods", "results", "conclusion"],
          },
        },
      });
      assert.deepEqual(scoped.map((record) => record.id), [
        "quality-package-version-1",
      ]);
    } finally {
      await pool.end();
    }
  });
});
