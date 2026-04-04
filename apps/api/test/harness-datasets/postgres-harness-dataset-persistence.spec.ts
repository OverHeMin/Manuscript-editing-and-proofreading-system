import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import {
  HarnessDatasetService,
  PostgresHarnessDatasetRepository,
  HarnessGoldSetVersionNotEditableError,
} from "../../src/modules/harness-datasets/index.ts";
import { createPostgresWriteTransactionManager } from "../../src/modules/shared/write-transaction-manager.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";

test("postgres harness dataset repository persists families, gold-set versions, rubrics, and publication audit history", async () => {
  await withMigratedHarnessDatasetPool(async (pool) => {
    const repository = new PostgresHarnessDatasetRepository({ client: pool });

    await repository.saveGoldSetFamily({
      id: "00000000-0000-0000-0000-000000001601",
      name: "Editing conformance",
      description: "Curated editing conformance gold set.",
      scope: {
        module: "editing",
        manuscript_types: ["review"],
        measure_focus: "editing_conformance",
      },
      admin_only: true,
      created_at: "2026-04-04T09:00:00.000Z",
      updated_at: "2026-04-04T09:00:00.000Z",
    });

    await repository.saveRubricDefinition({
      id: "00000000-0000-0000-0000-000000001602",
      name: "Editing conformance rubric",
      version_no: 1,
      status: "published",
      scope: {
        module: "editing",
        manuscript_types: ["review"],
      },
      scoring_dimensions: [
        {
          key: "structure",
          label: "Structure",
          weight: 0.6,
        },
      ],
      hard_gate_rules: ["Reject if section order is broken."],
      failure_anchors: ["Breaks abstract or discussion structure."],
      borderline_examples: ["Minor heading normalization disagreement."],
      created_by: "admin-1",
      created_at: "2026-04-04T09:05:00.000Z",
      published_by: "admin-1",
      published_at: "2026-04-04T09:06:00.000Z",
    });

    await repository.saveGoldSetVersion({
      id: "00000000-0000-0000-0000-000000001603",
      family_id: "00000000-0000-0000-0000-000000001601",
      version_no: 1,
      status: "published",
      rubric_definition_id: "00000000-0000-0000-0000-000000001602",
      item_count: 2,
      deidentification_gate_passed: true,
      human_review_gate_passed: true,
      items: [
        {
          source_kind: "reviewed_case_snapshot",
          source_id: "snapshot-1",
          manuscript_id: "manuscript-1",
          manuscript_type: "review",
          deidentification_passed: true,
          human_reviewed: true,
        },
        {
          source_kind: "evaluation_evidence_pack",
          source_id: "evidence-pack-1",
          manuscript_id: "manuscript-2",
          manuscript_type: "review",
          deidentification_passed: true,
          human_reviewed: true,
          expected_structured_output: {
            section_order: "stable",
          },
        },
      ],
      publication_notes: "Published editing conformance baseline.",
      created_by: "admin-1",
      created_at: "2026-04-04T09:10:00.000Z",
      published_by: "admin-1",
      published_at: "2026-04-04T09:15:00.000Z",
    });

    await repository.saveDatasetPublication({
      id: "00000000-0000-0000-0000-000000001604",
      gold_set_version_id: "00000000-0000-0000-0000-000000001603",
      export_format: "json",
      status: "succeeded",
      output_uri: ".local-data/harness-exports/editing-conformance-v1.json",
      deidentification_gate_passed: true,
      created_at: "2026-04-04T09:20:00.000Z",
    });

    const family = await repository.findGoldSetFamilyById(
      "00000000-0000-0000-0000-000000001601",
    );
    const version = await repository.findGoldSetVersionById(
      "00000000-0000-0000-0000-000000001603",
    );
    const rubric = await repository.findRubricDefinitionById(
      "00000000-0000-0000-0000-000000001602",
    );
    const publications = await repository.listDatasetPublicationsByVersionId(
      "00000000-0000-0000-0000-000000001603",
    );

    assert.equal(family?.scope.module, "editing");
    assert.equal(version?.item_count, 2);
    assert.equal(version?.items[1]?.source_kind, "evaluation_evidence_pack");
    assert.equal(rubric?.status, "published");
    assert.deepEqual(
      publications.map((record) => ({
        export_format: record.export_format,
        status: record.status,
        output_uri: record.output_uri,
      })),
      [
        {
          export_format: "json",
          status: "succeeded",
          output_uri: ".local-data/harness-exports/editing-conformance-v1.json",
        },
      ],
    );
  });
});

test("postgres harness dataset service keeps archived published versions immutable", async () => {
  await withMigratedHarnessDatasetPool(async (pool) => {
    const repository = new PostgresHarnessDatasetRepository({ client: pool });
    const service = new HarnessDatasetService({
      repository,
      transactionManager: createPostgresWriteTransactionManager({
        getClient: async () => pool.connect(),
        createContext: (client) => ({
          repository: new PostgresHarnessDatasetRepository({ client }),
        }),
      }),
      createId: (() => {
        const ids = [
          "00000000-0000-0000-0000-000000001611",
          "00000000-0000-0000-0000-000000001612",
          "00000000-0000-0000-0000-000000001613",
        ];

        return () => {
          const value = ids.shift();
          assert.ok(value, "Expected a PostgreSQL harness dataset id.");
          return value;
        };
      })(),
      now: () => new Date("2026-04-04T10:00:00.000Z"),
    });

    const family = await service.createGoldSetFamily("admin", {
      name: "Screening calibration",
      scope: {
        module: "screening",
        manuscriptTypes: ["clinical_study"],
        measureFocus: "calibration",
      },
    });
    const rubric = await service.createRubricDefinition("admin", {
      name: "Screening calibration rubric",
      scope: {
        module: "screening",
        manuscriptTypes: ["clinical_study"],
      },
      scoringDimensions: [
        {
          key: "calibration",
          label: "Calibration",
          weight: 1,
        },
      ],
      createdBy: "admin-1",
    });
    await service.publishRubricDefinition("admin", rubric.id, {
      publishedBy: "admin-1",
    });

    const version = await service.createGoldSetVersion("admin", {
      familyId: family.id,
      rubricDefinitionId: rubric.id,
      createdBy: "admin-1",
      items: [
        {
          sourceKind: "reviewed_case_snapshot",
          sourceId: "snapshot-11",
          manuscriptId: "manuscript-11",
          manuscriptType: "clinical_study",
          deidentificationPassed: true,
          humanReviewed: true,
        },
      ],
    });
    await service.publishGoldSetVersion("admin", version.id, {
      publishedBy: "admin-1",
    });
    const archived = await service.archiveGoldSetVersion("admin", version.id, {
      archivedBy: "admin-2",
    });

    await assert.rejects(
      () =>
        service.updateGoldSetVersionDraft("admin", archived.id, {
          publicationNotes: "archive should freeze the published version",
        }),
      HarnessGoldSetVersionNotEditableError,
    );

    const loaded = await repository.findGoldSetVersionById(archived.id);
    assert.equal(loaded?.status, "archived");
    assert.equal(loaded?.published_by, "admin-1");
  });
});

async function withMigratedHarnessDatasetPool(
  run: (pool: Pool) => Promise<void>,
): Promise<void> {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for the temporary harness dataset database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const pool = new Pool({
      connectionString: databaseUrl,
      max: 8,
    });

    try {
      await run(pool);
    } finally {
      await pool.end();
    }
  });
}
