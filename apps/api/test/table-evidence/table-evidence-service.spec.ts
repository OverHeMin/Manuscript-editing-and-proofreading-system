import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryTableEvidenceRepository,
  TableEvidenceService,
  applyTableCorrectionPatch,
  normalizeTableEvidenceWorkerResult,
} from "../../src/modules/table-evidence/index.ts";
import type {
  TableEvidenceSourceFile,
  TableSourceSnapshot,
} from "../../src/modules/table-evidence/index.ts";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

test("table evidence service creates a DOCX upload asset and confirms an authoritative AI package", async () => {
  const repository = new InMemoryTableEvidenceRepository();
  const ids = ["asset-1", "rev-1", "patch-1", "rev-2", "package-1"];
  const sourceFile: TableEvidenceSourceFile = {
    id: "file-1",
    storage_key: "uploads/2026/04/29/table.docx",
    file_name: "table.docx",
    mime_type: DOCX_MIME,
    byte_length: 4,
    sha256: "sha256-file",
    uploaded_by: "user-1",
    uploaded_at: "2026-04-29T00:00:00.000Z",
  };
  const sourceSnapshot: TableSourceSnapshot = {
    snapshot_id: "source-table-1",
    table_id: "table-1",
    source_file_asset_id: "file-1",
    parser: "python_docx_ooxml",
    parser_version: "table-evidence-v1",
    row_count: 1,
    column_count: 1,
    notes: [],
    object_evidence: [],
    warnings: [],
    grid_cells: [
      {
        cell_id: "cell-r0-c0",
        row: 0,
        column: 0,
        rowspan: 1,
        colspan: 1,
        role: "header",
        text: "Hcy–L⁻¹",
        codepoints: ["0048", "0063", "0079", "2013", "004C", "207B", "00B9"],
        paragraphs: [
          {
            id: "p-1",
            paragraph_boundary_after: true,
            runs: [
              {
                id: "run-1",
                kind: "text",
                text: "Hcy–L⁻¹",
                codepoints: [
                  "0048",
                  "0063",
                  "0079",
                  "2013",
                  "004C",
                  "207B",
                  "00B9",
                ],
                style: {},
                invisible_chars: [],
              },
            ],
          },
        ],
        runs: [
          {
            id: "run-1",
            kind: "text",
            text: "Hcy–L⁻¹",
            codepoints: ["0048", "0063", "0079", "2013", "004C", "207B", "00B9"],
            style: {},
            invisible_chars: [],
          },
        ],
        header_path: ["Hcy–L⁻¹"],
        row_header_path: [],
        column_header_path: ["Hcy–L⁻¹"],
        invisible_chars: [],
        style_summary: {
          horizontal_alignment: "center",
          vertical_alignment: "center",
        },
      },
    ],
  };

  const service = new TableEvidenceService({
    repository,
    sourceFileService: {
      createSourceFile: async () => sourceFile,
      resolveSourcePath: async () => "C:/tmp/table.docx",
    },
    workerAdapter: {
      extractTables: async () => ({
        parser: "python_docx_ooxml",
        parser_version: "table-evidence-v1",
        tables: [sourceSnapshot],
        warnings: [],
      }),
    },
    createId: () => {
      const id = ids.shift();
      assert.ok(id, "unexpected createId call");
      return id;
    },
    now: () => new Date("2026-04-29T00:00:00.000Z"),
  });

  const created = await service.createAssetFromDocxUpload({
    fileName: "table.docx",
    mimeType: DOCX_MIME,
    fileContentBase64: Buffer.from("fake").toString("base64"),
    actorId: "user-1",
  });

  assert.equal(created.tables.length, 1);
  assert.equal(created.asset.fidelity_status, "pending");

  const confirmed = await service.confirmRevision({
    revisionId: "rev-1",
    actorId: "user-1",
    confirmations: {
      invisibleCharsConfirmed: true,
      specialSymbolsConfirmed: true,
    },
  });

  assert.equal(confirmed.confirmation_status, "confirmed");
  assert.ok(confirmed.ai_table_package);
  assert.equal(confirmed.ai_table_package.authority, "authoritative");
  assert.ok(
    confirmed.ai_table_package.cells[0].codepoints.includes("2013"),
    "confirmed package must preserve the en dash codepoint",
  );
});

test("table evidence service keeps legacy unknown symbol warnings in review", async () => {
  const repository = new InMemoryTableEvidenceRepository();
  const ids = ["asset-1", "rev-1", "patch-1", "rev-2", "package-1"];
  const sourceFile: TableEvidenceSourceFile = {
    id: "file-1",
    storage_key: "uploads/2026/04/29/table.docx",
    file_name: "table.docx",
    mime_type: DOCX_MIME,
    byte_length: 4,
    sha256: "sha256-file",
    uploaded_by: "user-1",
    uploaded_at: "2026-04-29T00:00:00.000Z",
  };
  const sourceSnapshot = createOneCellSourceSnapshot({
    warnings: ["legacy_unknown_symbol_mapping:w:sym"],
  });
  const service = new TableEvidenceService({
    repository,
    sourceFileService: {
      createSourceFile: async () => sourceFile,
      resolveSourcePath: async () => "C:/tmp/table.docx",
    },
    workerAdapter: {
      extractTables: async () => ({
        parser: "python_docx_ooxml",
        parser_version: "table-evidence-v1",
        tables: [sourceSnapshot],
        warnings: [],
      }),
    },
    createId: () => {
      const id = ids.shift();
      assert.ok(id, "unexpected createId call");
      return id;
    },
    now: () => new Date("2026-04-29T00:00:00.000Z"),
  });

  await service.createAssetFromDocxUpload({
    fileName: "table.docx",
    mimeType: DOCX_MIME,
    fileContentBase64: Buffer.from("fake").toString("base64"),
    actorId: "user-1",
  });

  const confirmed = await service.confirmRevision({
    revisionId: "rev-1",
    actorId: "user-1",
    confirmations: {
      invisibleCharsConfirmed: true,
      specialSymbolsConfirmed: true,
    },
  });

  assert.equal(confirmed.confirmation_status, "needs_review");
  assert.ok(confirmed.ai_table_package);
  assert.equal(confirmed.ai_table_package.authority, "review_required");
  assert.deepEqual(confirmed.fidelity_report.failure_codes, [
    "legacy_unknown_symbol_mapping:w:sym",
  ]);
});

test("table evidence worker mapping preserves display text and paragraph boundary codepoints", () => {
  const result = normalizeTableEvidenceWorkerResult(
    {
      parser: "python_docx_ooxml",
      parser_version: "table-evidence-v1",
      tables: [
        {
          semantic: {
            table_id: "table-1",
            row_count: 1,
            column_count: 1,
            grid_cells: [
              {
                id: "cell-r0-c0",
                text: "Alpha Beta",
                display_text: "Alpha\nBeta",
                row_index: 0,
                column_index: 0,
                row_span: 1,
                column_span: 1,
                inferred_role: "header",
                paragraphs: [
                  {
                    id: "p-1",
                    paragraph_boundary_after: true,
                    fragments: [
                      {
                        id: "run-1",
                        kind: "text",
                        text: "Alpha",
                        codepoints: ["0041", "006C", "0070", "0068", "0061"],
                        invisible_chars: [],
                        style: {},
                      },
                    ],
                  },
                  {
                    id: "p-2",
                    paragraph_boundary_after: true,
                    fragments: [
                      {
                        id: "run-2",
                        kind: "text",
                        text: "Beta",
                        codepoints: ["0042", "0065", "0074", "0061"],
                        invisible_chars: [],
                        style: {},
                      },
                    ],
                  },
                ],
              },
            ],
            header_cells: [],
            data_cells: [],
          },
        },
      ],
      warnings: [],
    },
    "file-1",
  );

  const cell = result.tables[0].grid_cells[0];
  assert.equal(cell.text, "Alpha\nBeta");
  assert.equal(cell.display_text, "Alpha\nBeta");
  assert.deepEqual(cell.codepoints, [
    "0041",
    "006C",
    "0070",
    "0068",
    "0061",
    "000A",
    "0042",
    "0065",
    "0074",
    "0061",
  ]);
});

test("table correction patches recompute display text with paragraph boundary codepoints", () => {
  const confirmed = applyTableCorrectionPatch({
    sourceSnapshot: {
      snapshot_id: "source-table-1",
      table_id: "table-1",
      source_file_asset_id: "file-1",
      parser: "python_docx_ooxml",
      parser_version: "table-evidence-v1",
      row_count: 1,
      column_count: 1,
      notes: [],
      object_evidence: [],
      warnings: [],
      grid_cells: [
        {
          cell_id: "cell-r0-c0",
          row: 0,
          column: 0,
          rowspan: 1,
          colspan: 1,
          role: "header",
          text: "Alpha\nBeta",
          display_text: "Alpha\nBeta",
          codepoints: [
            "0041",
            "006C",
            "0070",
            "0068",
            "0061",
            "000A",
            "0042",
            "0065",
            "0074",
            "0061",
          ],
          paragraphs: [
            {
              id: "p-1",
              paragraph_boundary_after: true,
              runs: [
                {
                  id: "run-1",
                  kind: "text",
                  text: "Alpha",
                  codepoints: ["0041", "006C", "0070", "0068", "0061"],
                  style: {},
                  invisible_chars: [],
                },
              ],
            },
            {
              id: "p-2",
              paragraph_boundary_after: true,
              runs: [
                {
                  id: "run-2",
                  kind: "text",
                  text: "Beta",
                  codepoints: ["0042", "0065", "0074", "0061"],
                  style: {},
                  invisible_chars: [],
                },
              ],
            },
          ],
          runs: [
            {
              id: "run-1",
              kind: "text",
              text: "Alpha",
              codepoints: ["0041", "006C", "0070", "0068", "0061"],
              style: {},
              invisible_chars: [],
            },
            {
              id: "run-2",
              kind: "text",
              text: "Beta",
              codepoints: ["0042", "0065", "0074", "0061"],
              style: {},
              invisible_chars: [],
            },
          ],
          header_path: ["Alpha\nBeta"],
          row_header_path: [],
          column_header_path: ["Alpha\nBeta"],
          invisible_chars: [],
          style_summary: {},
        },
      ],
    },
    patch: {
      patch_id: "patch-1",
      operations: [
        {
          op: "replace_run_text",
          cell_id: "cell-r0-c0",
          paragraph_id: "p-2",
          run_id: "run-2",
          before_text: "Beta",
          after_text: "Gamma",
          after_codepoints: ["0047", "0061", "006D", "006D", "0061"],
        },
      ],
    },
  });

  const cell = confirmed.grid_cells[0];
  assert.equal(cell.text, "Alpha\nGamma");
  assert.equal(cell.display_text, "Alpha\nGamma");
  assert.deepEqual(cell.codepoints, [
    "0041",
    "006C",
    "0070",
    "0068",
    "0061",
    "000A",
    "0047",
    "0061",
    "006D",
    "006D",
    "0061",
  ]);
});

test("table evidence confirmation preserves text-only cells without paragraph snapshots", async () => {
  const repository = new InMemoryTableEvidenceRepository();
  const ids = ["asset-1", "rev-1", "patch-1", "rev-2", "package-1"];
  const sourceFile = createSourceFile();
  const sourceSnapshot = createTextOnlySourceSnapshot();
  const service = createMockedService({ repository, ids, sourceFile, sourceSnapshot });

  await service.createAssetFromDocxUpload(createUploadInput());
  const confirmed = await service.confirmRevision({
    revisionId: "rev-1",
    actorId: "user-1",
    confirmations: {
      invisibleCharsConfirmed: true,
      specialSymbolsConfirmed: true,
    },
  });

  const cell = confirmed.ai_table_package?.cells[0];
  assert.ok(cell);
  assert.equal(cell.text, "Plain");
  assert.equal(cell.display_text, "Plain");
  assert.deepEqual(cell.codepoints, ["0050", "006C", "0061", "0069", "006E"]);
});

test("table evidence fidelity warnings require review even after confirmations", async () => {
  const repository = new InMemoryTableEvidenceRepository();
  const ids = ["asset-1", "rev-1", "patch-1", "rev-2", "package-1"];
  const sourceSnapshot = createOneCellSourceSnapshot({
    warnings: ["image_only_table", "nested_table_unsupported"],
  });
  const service = createMockedService({
    repository,
    ids,
    sourceFile: createSourceFile(),
    sourceSnapshot,
  });

  await service.createAssetFromDocxUpload(createUploadInput());
  const confirmed = await service.confirmRevision({
    revisionId: "rev-1",
    actorId: "user-1",
    confirmations: {
      invisibleCharsConfirmed: true,
      specialSymbolsConfirmed: true,
    },
  });

  assert.equal(confirmed.confirmation_status, "needs_review");
  assert.equal(confirmed.ai_table_package?.authority, "review_required");
  assert.deepEqual(confirmed.fidelity_report.failure_codes, [
    "image_only_table",
    "nested_table_unsupported",
  ]);
});

test("table correction patches reject missing targets and stale before text", () => {
  const sourceSnapshot = createOneCellSourceSnapshot();

  assert.throws(
    () =>
      applyTableCorrectionPatch({
        sourceSnapshot,
        patch: {
          patch_id: "patch-missing-run",
          operations: [
            {
              op: "replace_run_text",
              cell_id: "cell-r0-c0",
              paragraph_id: "p-1",
              run_id: "missing-run",
              before_text: "Hcy–L⁻¹",
              after_text: "Hcy",
              after_codepoints: ["0048", "0063", "0079"],
            },
          ],
        },
      }),
    /run missing-run/i,
  );

  assert.throws(
    () =>
      applyTableCorrectionPatch({
        sourceSnapshot,
        patch: {
          patch_id: "patch-stale-before",
          operations: [
            {
              op: "replace_run_text",
              cell_id: "cell-r0-c0",
              paragraph_id: "p-1",
              run_id: "run-1",
              before_text: "stale",
              after_text: "Hcy",
              after_codepoints: ["0048", "0063", "0079"],
            },
          ],
        },
      }),
    /before_text/i,
  );

  assert.throws(
    () =>
      applyTableCorrectionPatch({
        sourceSnapshot,
        patch: {
          patch_id: "patch-missing-symbol-confirmation",
          operations: [
            {
              op: "confirm_special_symbols",
              cell_ids: ["cell-r0-c0"],
              confirmed_symbol_run_ids: ["missing-symbol-run"],
            },
          ],
        },
      }),
    /symbol run missing-symbol-run/i,
  );

  assert.throws(
    () =>
      applyTableCorrectionPatch({
        sourceSnapshot,
        patch: {
          patch_id: "patch-missing-invisible-confirmation",
          operations: [
            {
              op: "confirm_invisible_chars",
              cell_ids: ["cell-r0-c0"],
              confirmed_invisible_char_ids: ["missing-invisible-char"],
            },
          ],
        },
      }),
    /invisible char missing-invisible-char/i,
  );
});

test("table correction confirmation targets must belong to declared cells", () => {
  const sourceSnapshot = createTwoCellConfirmationSourceSnapshot();

  assert.throws(
    () =>
      applyTableCorrectionPatch({
        sourceSnapshot,
        patch: {
          patch_id: "patch-cross-cell-symbol",
          operations: [
            {
              op: "confirm_special_symbols",
              cell_ids: ["cell-1"],
              confirmed_symbol_run_ids: ["cell-2-symbol-run"],
            },
          ],
        },
      }),
    /symbol run cell-2-symbol-run/i,
  );

  assert.throws(
    () =>
      applyTableCorrectionPatch({
        sourceSnapshot,
        patch: {
          patch_id: "patch-cross-cell-invisible",
          operations: [
            {
              op: "confirm_invisible_chars",
              cell_ids: ["cell-1"],
              confirmed_invisible_char_ids: ["cell-2-invisible"],
            },
          ],
        },
      }),
    /invisible char cell-2-invisible/i,
  );
});

test("saving a correction patch clears stale confirmed package metadata", async () => {
  const repository = new InMemoryTableEvidenceRepository();
  const ids = ["asset-1", "rev-1", "patch-1", "rev-2", "package-1", "rev-3"];
  const service = createMockedService({
    repository,
    ids,
    sourceFile: createSourceFile(),
    sourceSnapshot: createOneCellSourceSnapshot(),
  });

  await service.createAssetFromDocxUpload(createUploadInput());
  const confirmed = await service.confirmRevision({
    revisionId: "rev-1",
    actorId: "user-1",
    confirmations: {
      invisibleCharsConfirmed: true,
      specialSymbolsConfirmed: true,
    },
  });
  assert.equal(confirmed.ai_table_package?.authority, "authoritative");

  const updated = await service.saveCorrectionPatch({
    revisionId: confirmed.id,
    patch: {
      patch_id: "patch-updated",
      operations: [
        {
          op: "replace_run_text",
          cell_id: "cell-r0-c0",
          paragraph_id: "p-1",
          run_id: "run-1",
          before_text: "Hcy–L⁻¹",
          after_text: "Hcy",
          after_codepoints: ["0048", "0063", "0079"],
        },
      ],
    },
  });

  assert.equal(updated.confirmation_status, "needs_review");
  assert.equal(updated.ai_table_package, undefined);
  assert.equal(updated.confirmed_by, undefined);
  assert.equal(updated.confirmed_at, undefined);
  assert.equal(updated.fidelity_report.status, "needs_review");
  assert.equal(updated.fidelity_report.invisible_chars_confirmed, false);
  assert.equal(updated.fidelity_report.special_symbols_confirmed, false);
  assert.deepEqual(updated.fidelity_report.required_confirmations, [
    "invisible_chars",
    "special_symbols",
  ]);
  const asset = await repository.findAssetById("asset-1");
  assert.equal(asset?.fidelity_status, "needs_review");
});

test("saving a correction patch appends a new active revision instead of overwriting the source revision", async () => {
  const repository = new InMemoryTableEvidenceRepository();
  const ids = ["asset-1", "rev-1", "patch-1", "rev-2"];
  const service = createMockedService({
    repository,
    ids,
    sourceFile: createSourceFile(),
    sourceSnapshot: createOneCellSourceSnapshot(),
  });

  await service.createAssetFromDocxUpload(createUploadInput());
  const updated = await service.saveCorrectionPatch({
    revisionId: "rev-1",
    patch: {
      patch_id: "patch-updated",
      operations: [
        {
          op: "replace_run_text",
          cell_id: "cell-r0-c0",
          paragraph_id: "p-1",
          run_id: "run-1",
          before_text: "Hcy–L⁻¹",
          after_text: "Hcy",
          after_codepoints: ["0048", "0063", "0079"],
        },
      ],
    },
  });

  assert.equal(updated.id, "rev-2");
  assert.equal(updated.revision_no, 2);
  assert.equal(updated.confirmation_status, "needs_review");

  const original = await repository.findRevisionById("rev-1");
  assert.equal(original?.confirmation_status, "pending");
  assert.deepEqual(original?.correction_patch.operations, []);

  const revisions = await repository.listRevisionsForAsset("asset-1");
  assert.deepEqual(
    revisions.map((revision) => revision.id).sort(),
    ["rev-1", "rev-2"],
  );
  const asset = await repository.findAssetById("asset-1");
  assert.equal(asset?.active_revision_id, "rev-2");
});

test("confirming a revision appends a new active revision with an authoritative package", async () => {
  const repository = new InMemoryTableEvidenceRepository();
  const ids = ["asset-1", "rev-1", "patch-1", "rev-2", "package-1"];
  const service = createMockedService({
    repository,
    ids,
    sourceFile: createSourceFile(),
    sourceSnapshot: createOneCellSourceSnapshot(),
  });

  await service.createAssetFromDocxUpload(createUploadInput());
  const confirmed = await service.confirmRevision({
    revisionId: "rev-1",
    actorId: "user-1",
    confirmations: {
      invisibleCharsConfirmed: true,
      specialSymbolsConfirmed: true,
    },
  });

  assert.equal(confirmed.id, "rev-2");
  assert.equal(confirmed.revision_no, 2);
  assert.equal(confirmed.ai_table_package?.revision_id, "rev-2");
  assert.equal(confirmed.ai_table_package?.revision_no, 2);

  const original = await repository.findRevisionById("rev-1");
  assert.equal(original?.confirmation_status, "pending");
  assert.equal(original?.ai_table_package, undefined);
  const asset = await repository.findAssetById("asset-1");
  assert.equal(asset?.active_revision_id, "rev-2");
});

test("DOCX uploads persist a pending revision for every extracted table", async () => {
  const repository = new InMemoryTableEvidenceRepository();
  const ids = ["asset-1", "rev-1", "patch-1", "rev-2", "patch-2"];
  const firstTable = createOneCellSourceSnapshot();
  const secondTable: TableSourceSnapshot = {
    ...createTextOnlySourceSnapshot(),
    snapshot_id: "source-table-2",
    table_id: "table-2",
  };
  const service = new TableEvidenceService({
    repository,
    sourceFileService: {
      createSourceFile: async () => createSourceFile(),
      resolveSourcePath: async () => "C:/tmp/table.docx",
    },
    workerAdapter: {
      extractTables: async () => ({
        parser: "python_docx_ooxml",
        parser_version: "table-evidence-v1",
        tables: [firstTable, secondTable],
        warnings: [],
      }),
    },
    createId: () => {
      const id = ids.shift();
      assert.ok(id, "unexpected createId call");
      return id;
    },
    now: () => new Date("2026-04-29T00:00:00.000Z"),
  });

  const created = await service.createAssetFromDocxUpload(createUploadInput());

  assert.equal(created.tables.length, 2);
  assert.deepEqual(
    created.revisions.map((revision) => revision.source_snapshot.table_id),
    ["table-1", "table-2"],
  );
  assert.deepEqual(
    created.revisions.map((revision) => revision.revision_no),
    [1, 2],
  );
  const persisted = await repository.listRevisionsForAsset("asset-1");
  assert.deepEqual(
    persisted.map((revision) => revision.source_snapshot.table_id).sort(),
    ["table-1", "table-2"],
  );
});

test("table evidence worker normalizer marks malformed cell payloads as unconfirmable", () => {
  const result = normalizeTableEvidenceWorkerResult(
    {
      parser: "python_docx_ooxml",
      parser_version: "table-evidence-v1",
      tables: [
        {
          semantic: {
            table_id: "table-1",
            row_count: 1,
            column_count: 1,
            grid_cells: [
              {
                id: "cell-r0-c0",
                text: "Alpha",
              },
            ],
          },
        },
      ],
      warnings: [],
    },
    "file-1",
  );

  assert.deepEqual(result.tables[0].warnings, [
    "worker_payload_invalid:cell_missing_required_fields",
  ]);
});

test("table evidence worker normalizer distinguishes text box table warnings", () => {
  const result = normalizeTableEvidenceWorkerResult(
    {
      parser: "python_docx_ooxml",
      parser_version: "table-evidence-v1",
      tables: [
        {
          semantic: {
            table_id: "table-1",
            row_count: 1,
            column_count: 1,
            grid_cells: [
              {
                id: "cell-r0-c0",
                text: "Alpha",
                row_index: 0,
                column_index: 0,
                row_span: 1,
                column_span: 1,
                inferred_role: "header",
                paragraphs: [],
                object_evidence: [
                  {
                    object_kind: "text_box_table",
                  },
                ],
              },
            ],
          },
        },
      ],
      warnings: [],
    },
    "file-1",
  );

  assert.ok(result.tables[0].warnings.includes("text_box_table_unsupported"));
  assert.ok(!result.tables[0].warnings.includes("nested_table_unsupported"));
});

test("table evidence worker normalizer falls back empty header paths to cell text", () => {
  const result = normalizeTableEvidenceWorkerResult(
    {
      parser: "python_docx_ooxml",
      parser_version: "table-evidence-v1",
      tables: [
        {
          semantic: {
            table_id: "table-1",
            row_count: 1,
            column_count: 1,
            header_cells: [
              {
                source_cell_id: "cell-r0-c0",
                header_path: [],
              },
            ],
            grid_cells: [
              {
                id: "cell-r0-c0",
                text: "Header A",
                row_index: 0,
                column_index: 0,
                row_span: 1,
                column_span: 1,
                inferred_role: "header",
                paragraphs: [],
              },
            ],
          },
        },
      ],
      warnings: [],
    },
    "file-1",
  );

  assert.deepEqual(result.tables[0].grid_cells[0].header_path, ["Header A"]);
});

function createOneCellSourceSnapshot(input: {
  warnings?: string[];
} = {}): TableSourceSnapshot {
  return {
    snapshot_id: "source-table-1",
    table_id: "table-1",
    source_file_asset_id: "file-1",
    parser: "python_docx_ooxml",
    parser_version: "table-evidence-v1",
    row_count: 1,
    column_count: 1,
    notes: [],
    object_evidence: [],
    warnings: input.warnings ?? [],
    grid_cells: [
      {
        cell_id: "cell-r0-c0",
        row: 0,
        column: 0,
        rowspan: 1,
        colspan: 1,
        role: "header",
        text: "Hcy–L⁻¹",
        codepoints: ["0048", "0063", "0079", "2013", "004C", "207B", "00B9"],
        paragraphs: [
          {
            id: "p-1",
            paragraph_boundary_after: true,
            runs: [
              {
                id: "run-1",
                kind: "text",
                text: "Hcy–L⁻¹",
                codepoints: [
                  "0048",
                  "0063",
                  "0079",
                  "2013",
                  "004C",
                  "207B",
                  "00B9",
                ],
                style: {},
                invisible_chars: [],
              },
            ],
          },
        ],
        runs: [
          {
            id: "run-1",
            kind: "text",
            text: "Hcy–L⁻¹",
            codepoints: ["0048", "0063", "0079", "2013", "004C", "207B", "00B9"],
            style: {},
            invisible_chars: [],
          },
        ],
        header_path: ["Hcy–L⁻¹"],
        row_header_path: [],
        column_header_path: ["Hcy–L⁻¹"],
        invisible_chars: [],
        style_summary: {
          horizontal_alignment: "center",
          vertical_alignment: "center",
        },
      },
    ],
  };
}

function createTwoCellConfirmationSourceSnapshot(): TableSourceSnapshot {
  return {
    snapshot_id: "source-table-1",
    table_id: "table-1",
    source_file_asset_id: "file-1",
    parser: "python_docx_ooxml",
    parser_version: "table-evidence-v1",
    row_count: 1,
    column_count: 2,
    notes: [],
    object_evidence: [],
    warnings: [],
    grid_cells: [
      createConfirmationCell({
        cellId: "cell-1",
        column: 0,
        text: "Cell 1",
        runId: "cell-1-symbol-run",
        invisibleCharId: "cell-1-invisible",
      }),
      createConfirmationCell({
        cellId: "cell-2",
        column: 1,
        text: "Cell 2",
        runId: "cell-2-symbol-run",
        invisibleCharId: "cell-2-invisible",
      }),
    ],
  };
}

function createConfirmationCell(input: {
  cellId: string;
  column: number;
  text: string;
  runId: string;
  invisibleCharId: string;
}) {
  return {
    cell_id: input.cellId,
    row: 0,
    column: input.column,
    rowspan: 1,
    colspan: 1,
    role: "header" as const,
    text: input.text,
    codepoints: [...input.text].map((character) =>
      character.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0") ?? "",
    ),
    paragraphs: [
      {
        id: `${input.cellId}-paragraph`,
        paragraph_boundary_after: true,
        runs: [
          {
            id: input.runId,
            kind: "symbol" as const,
            text: input.text,
            codepoints: [...input.text].map((character) =>
              character.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0") ?? "",
            ),
            style: {},
            invisible_chars: [
              {
                id: input.invisibleCharId,
                kind: "space" as const,
                codepoint: "0020",
                offset: 4,
                length: 1,
              },
            ],
          },
        ],
      },
    ],
    runs: [
      {
        id: input.runId,
        kind: "symbol" as const,
        text: input.text,
        codepoints: [...input.text].map((character) =>
          character.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0") ?? "",
        ),
        style: {},
        invisible_chars: [
          {
            id: input.invisibleCharId,
            kind: "space" as const,
            codepoint: "0020",
            offset: 4,
            length: 1,
          },
        ],
      },
    ],
    header_path: [input.text],
    row_header_path: [],
    column_header_path: [input.text],
    invisible_chars: [
      {
        id: input.invisibleCharId,
        kind: "space" as const,
        codepoint: "0020",
        offset: 4,
        length: 1,
      },
    ],
    style_summary: {},
  };
}

function createTextOnlySourceSnapshot(): TableSourceSnapshot {
  return {
    snapshot_id: "source-table-1",
    table_id: "table-1",
    source_file_asset_id: "file-1",
    parser: "python_docx_ooxml",
    parser_version: "table-evidence-v1",
    row_count: 1,
    column_count: 1,
    notes: [],
    object_evidence: [],
    warnings: [],
    grid_cells: [
      {
        cell_id: "cell-r0-c0",
        row: 0,
        column: 0,
        rowspan: 1,
        colspan: 1,
        role: "header",
        text: "Plain",
        display_text: "Plain",
        codepoints: ["0050", "006C", "0061", "0069", "006E"],
        paragraphs: [],
        runs: [],
        header_path: ["Plain"],
        row_header_path: [],
        column_header_path: ["Plain"],
        invisible_chars: [],
        style_summary: {},
      },
    ],
  };
}

function createSourceFile(): TableEvidenceSourceFile {
  return {
    id: "file-1",
    storage_key: "uploads/2026/04/29/table.docx",
    file_name: "table.docx",
    mime_type: DOCX_MIME,
    byte_length: 4,
    sha256: "sha256-file",
    uploaded_by: "user-1",
    uploaded_at: "2026-04-29T00:00:00.000Z",
  };
}

function createUploadInput() {
  return {
    fileName: "table.docx",
    mimeType: DOCX_MIME,
    fileContentBase64: Buffer.from("fake").toString("base64"),
    actorId: "user-1",
  };
}

function createMockedService(input: {
  repository: InMemoryTableEvidenceRepository;
  ids: string[];
  sourceFile: TableEvidenceSourceFile;
  sourceSnapshot: TableSourceSnapshot;
}): TableEvidenceService {
  return new TableEvidenceService({
    repository: input.repository,
    sourceFileService: {
      createSourceFile: async () => input.sourceFile,
      resolveSourcePath: async () => "C:/tmp/table.docx",
    },
    workerAdapter: {
      extractTables: async () => ({
        parser: "python_docx_ooxml",
        parser_version: "table-evidence-v1",
        tables: [input.sourceSnapshot],
        warnings: [],
      }),
    },
    createId: () => {
      const id = input.ids.shift();
      assert.ok(id, "unexpected createId call");
      return id;
    },
    now: () => new Date("2026-04-29T00:00:00.000Z"),
  });
}
