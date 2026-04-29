import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryTableEvidenceRepository } from "../../src/modules/table-evidence/index.ts";

test("table evidence repository stores immutable revisions and target bindings", async () => {
  const repository = new InMemoryTableEvidenceRepository();

  await repository.saveSourceFile({
    id: "file-1",
    storage_key: "uploads/2026/04/29/file.docx",
    file_name: "file.docx",
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    byte_length: 128,
    sha256: "sha256-file",
    uploaded_by: "user-1",
    uploaded_at: "2026-04-29T00:00:00.000Z",
  });

  await repository.saveAsset({
    id: "asset-1",
    title: "Table 1",
    source_file_asset_id: "file-1",
    source_file_name: "file.docx",
    source_kind: "docx_upload",
    parser: "python_docx_ooxml",
    parser_version: "table-evidence-v1",
    fidelity_status: "pending",
    created_by: "user-1",
    created_at: "2026-04-29T00:00:00.000Z",
    updated_at: "2026-04-29T00:00:00.000Z",
  });

  await repository.saveRevision({
    id: "rev-1",
    table_evidence_asset_id: "asset-1",
    revision_no: 1,
    source_snapshot: {
      snapshot_id: "source-1",
      table_id: "table-1",
      source_file_asset_id: "file-1",
      parser: "python_docx_ooxml",
      parser_version: "table-evidence-v1",
      row_count: 1,
      column_count: 1,
      notes: [],
      grid_cells: [],
      object_evidence: [],
      warnings: [],
    },
    correction_patch: { patch_id: "patch-1", operations: [] },
    fidelity_report: {
      status: "pending",
      failure_codes: [],
      unsupported_fact_groups: [],
      required_confirmations: ["invisible_chars", "special_symbols"],
      invisible_chars_confirmed: false,
      special_symbols_confirmed: false,
    },
    confirmation_status: "pending",
    created_at: "2026-04-29T00:00:00.000Z",
  });

  await repository.saveBinding({
    id: "binding-1",
    table_evidence_asset_id: "asset-1",
    table_evidence_revision_id: "rev-1",
    target_type: "knowledge_revision",
    target_id: "knowledge-rev-1",
    binding_role: "source_evidence",
    created_at: "2026-04-29T00:00:00.000Z",
  });

  const bindings = await repository.listBindingsForTarget(
    "knowledge_revision",
    "knowledge-rev-1",
  );
  assert.equal(bindings.length, 1);
  assert.equal(bindings[0].table_evidence_revision_id, "rev-1");

  const revision = await repository.findRevisionById("rev-1");
  assert.equal(revision?.source_snapshot.table_id, "table-1");
});

test("table evidence repository rejects cross-asset active revisions and bindings", async () => {
  const repository = new InMemoryTableEvidenceRepository();

  await seedTwoAssetHarness(repository);

  await repository.setActiveRevision("asset-1", "asset-1-rev-1", "confirmed");
  const asset = await repository.findAssetById("asset-1");
  assert.equal(asset?.active_revision_id, "asset-1-rev-1");
  assert.equal(asset?.fidelity_status, "confirmed");

  await assert.rejects(
    () => repository.setActiveRevision("asset-1", "asset-2-rev-1", "confirmed"),
    /revision asset mismatch/i,
  );

  await repository.saveBinding({
    id: "binding-asset-1",
    table_evidence_asset_id: "asset-1",
    table_evidence_revision_id: "asset-1-rev-1",
    target_type: "knowledge_revision",
    target_id: "knowledge-rev-1",
    binding_role: "source_evidence",
    created_at: "2026-04-29T00:10:00.000Z",
  });

  await assert.rejects(
    () =>
      repository.saveBinding({
        id: "binding-cross-asset",
        table_evidence_asset_id: "asset-1",
        table_evidence_revision_id: "asset-2-rev-1",
        target_type: "knowledge_revision",
        target_id: "knowledge-rev-2",
        binding_role: "source_evidence",
        created_at: "2026-04-29T00:11:00.000Z",
      }),
    /revision asset mismatch/i,
  );

  const bindings = await repository.listBindingsForRevision("asset-1-rev-1");
  assert.deepEqual(
    bindings.map((binding) => binding.id),
    ["binding-asset-1"],
  );

  const revisions = await repository.listRevisionsForAsset("asset-1");
  assert.deepEqual(
    revisions.map((revision) => revision.id),
    ["asset-1-rev-2", "asset-1-rev-1"],
  );

  const searchResults = await repository.searchAssets({
    search: "trial",
    status: "pending",
    limit: 10,
  });
  assert.deepEqual(
    searchResults.map((searchAsset) => searchAsset.id),
    ["asset-2"],
  );
});

test("table evidence repository keeps revision asset membership immutable", async () => {
  const repository = new InMemoryTableEvidenceRepository();

  await seedTwoAssetHarness(repository);

  await assert.rejects(
    () =>
      repository.saveRevision(
        createRevision("asset-1-rev-1", "asset-2", 3, "2026-04-29T00:10:00.000Z"),
      ),
    /revision asset membership is immutable/i,
  );

  const revision = await repository.findRevisionById("asset-1-rev-1");
  assert.equal(revision?.table_evidence_asset_id, "asset-1");
});

test("table evidence repository rejects same-id revision overwrites", async () => {
  const repository = new InMemoryTableEvidenceRepository();

  await seedTwoAssetHarness(repository);

  await assert.rejects(
    () =>
      repository.saveRevision({
        ...createRevision(
          "asset-1-rev-1",
          "asset-1",
          99,
          "2026-04-29T00:12:00.000Z",
        ),
        correction_patch: { patch_id: "replacement-patch", operations: [] },
        confirmation_status: "confirmed",
        fidelity_report: {
          status: "confirmed",
          failure_codes: [],
          unsupported_fact_groups: [],
          required_confirmations: [],
          invisible_chars_confirmed: true,
          special_symbols_confirmed: true,
        },
      }),
    /revision id is append-only/i,
  );

  const revision = await repository.findRevisionById("asset-1-rev-1");
  assert.equal(revision?.revision_no, 1);
  assert.equal(revision?.confirmation_status, "pending");
  assert.equal(revision?.correction_patch.patch_id, "asset-1-rev-1-patch");
});

async function seedTwoAssetHarness(
  repository: InMemoryTableEvidenceRepository,
): Promise<void> {
  await repository.saveSourceFile({
    id: "file-1",
    storage_key: "uploads/2026/04/29/file-1.docx",
    file_name: "file-1.docx",
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    byte_length: 128,
    sha256: "sha256-file-1",
    uploaded_by: "user-1",
    uploaded_at: "2026-04-29T00:00:00.000Z",
  });
  await repository.saveSourceFile({
    id: "file-2",
    storage_key: "uploads/2026/04/29/file-2.docx",
    file_name: "file-2.docx",
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    byte_length: 256,
    sha256: "sha256-file-2",
    uploaded_by: "user-1",
    uploaded_at: "2026-04-29T00:01:00.000Z",
  });
  await repository.saveAsset({
    id: "asset-1",
    title: "Trial Table Alpha",
    source_file_asset_id: "file-1",
    source_file_name: "file-1.docx",
    source_kind: "docx_upload",
    parser: "python_docx_ooxml",
    parser_version: "table-evidence-v1",
    fidelity_status: "pending",
    created_by: "user-1",
    created_at: "2026-04-29T00:00:00.000Z",
    updated_at: "2026-04-29T00:00:00.000Z",
  });
  await repository.saveAsset({
    id: "asset-2",
    title: "Trial Table Beta",
    source_file_asset_id: "file-2",
    source_file_name: "file-2.docx",
    source_kind: "docx_upload",
    parser: "python_docx_ooxml",
    parser_version: "table-evidence-v1",
    fidelity_status: "pending",
    created_by: "user-1",
    created_at: "2026-04-29T00:01:00.000Z",
    updated_at: "2026-04-29T00:01:00.000Z",
  });
  await repository.saveRevision(
    createRevision("asset-1-rev-1", "asset-1", 1, "2026-04-29T00:00:00.000Z"),
  );
  await repository.saveRevision(
    createRevision("asset-1-rev-2", "asset-1", 2, "2026-04-29T00:05:00.000Z"),
  );
  await repository.saveRevision(
    createRevision("asset-2-rev-1", "asset-2", 1, "2026-04-29T00:01:00.000Z"),
  );
}

function createRevision(
  id: string,
  assetId: string,
  revisionNo: number,
  createdAt: string,
) {
  return {
    id,
    table_evidence_asset_id: assetId,
    revision_no: revisionNo,
    source_snapshot: {
      snapshot_id: `${id}-source`,
      table_id: `${id}-table`,
      source_file_asset_id: assetId === "asset-1" ? "file-1" : "file-2",
      parser: "python_docx_ooxml" as const,
      parser_version: "table-evidence-v1",
      row_count: 1,
      column_count: 1,
      notes: [],
      grid_cells: [],
      object_evidence: [],
      warnings: [],
    },
    correction_patch: { patch_id: `${id}-patch`, operations: [] },
    fidelity_report: {
      status: "pending" as const,
      failure_codes: [],
      unsupported_fact_groups: [],
      required_confirmations: [],
      invisible_chars_confirmed: false,
      special_symbols_confirmed: false,
    },
    confirmation_status: "pending" as const,
    created_at: createdAt,
  };
}
