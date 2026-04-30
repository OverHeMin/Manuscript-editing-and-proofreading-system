import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TableEvidenceWorkspace } from "../src/features/table-evidence/table-evidence-workspace.tsx";
import { applyTableEvidencePatch } from "../src/features/table-evidence/table-evidence-patch.ts";
import type {
  TableCorrectionOperation,
  TableCorrectionPatch,
  TableEvidenceAsset,
  TableEvidenceCellSnapshot,
  TableEvidenceRevision,
  TableSourceSnapshot,
} from "../src/features/table-evidence/table-evidence-types.ts";

test("TableEvidenceWorkspace exposes source, corrected, diff, fidelity, and confirmation states", () => {
  const html = renderToStaticMarkup(
    <TableEvidenceWorkspace
      asset={{
        id: "asset-1",
        title: "Table 1",
        source_file_asset_id: "file-1",
        source_file_name: "table.docx",
        source_kind: "docx_upload",
        parser: "python_docx_ooxml",
        parser_version: "table-evidence-v1",
        fidelity_status: "pending",
        created_by: "user-1",
        created_at: "2026-04-29T00:00:00.000Z",
        updated_at: "2026-04-29T00:00:00.000Z",
      }}
      revision={{
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
          object_evidence: [],
          warnings: [],
          grid_cells: [],
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
      }}
      onSavePatch={() => Promise.resolve(buildRevision())}
      onConfirm={() => Promise.resolve()}
      onBind={() => Promise.resolve()}
    />,
  );

  assert.match(html, /data-view-mode="source"/);
  assert.match(html, /data-table-evidence-workspace-layout="responsive"/);
  assert.match(html, /table-evidence-toolbar-stack/);
  assert.match(html, /table-evidence-preview-pane/);
  assert.match(html, /aria-label="上标"/);
  assert.match(html, /x²/);
  assert.match(html, /aria-label="下标"/);
  assert.match(html, /x₂/);
  assert.match(html, /data-view-mode-option="corrected"/);
  assert.match(html, /data-view-mode-option="diff"/);
  assert.match(html, /待确认/);
  assert.match(html, /不可见字符/);
  assert.match(html, /特殊符号/);
  assert.match(html, /table\.docx/);
  assert.match(html, /data-confirm-disabled="true"/);
});

test("repeated run text edits collapse into one applicable patch with the latest text", async () => {
  const { buildReplaceRunTextOperation } = await import(
    "../src/features/table-evidence/table-evidence-cell-editor.tsx"
  );
  const { appendTableEvidenceOperation } = await import(
    "../src/features/table-evidence/table-evidence-workspace.tsx"
  );
  const snapshot = buildSourceSnapshot();
  const cell = snapshot.grid_cells[0];
  assert.ok(cell);

  let patch: TableCorrectionPatch = { patch_id: "patch-1", operations: [] };
  const first = buildReplaceRunTextOperation(cell, "run-1", "first edit");
  assert.ok(first);
  patch = appendTableEvidenceOperation(patch, first);

  const onceCorrected = applyTableEvidencePatch({ sourceSnapshot: snapshot, patch });
  const correctedCell = onceCorrected.grid_cells[0];
  assert.ok(correctedCell);
  const second = buildReplaceRunTextOperation(correctedCell, "run-1", "second edit");
  assert.ok(second);
  patch = appendTableEvidenceOperation(patch, second);

  const finalSnapshot = applyTableEvidencePatch({ sourceSnapshot: snapshot, patch });
  assert.equal(patch.operations.length, 1);
  assert.deepEqual(patch.operations[0], {
    op: "replace_run_text",
    cell_id: "cell-1",
    paragraph_id: "paragraph-1",
    run_id: "run-1",
    before_text: "original",
    after_text: "second edit",
    after_codepoints: [
      "0073",
      "0065",
      "0063",
      "006F",
      "006E",
      "0064",
      "0020",
      "0065",
      "0064",
      "0069",
      "0074",
    ],
  } satisfies TableCorrectionOperation);
  assert.equal(finalSnapshot.grid_cells[0]?.paragraphs[0]?.runs[0]?.text, "second edit");
  assert.equal(finalSnapshot.grid_cells[0]?.text, "second edit\nsecond paragraph");
});

test("run text operation uses the paragraph that owns the selected run", async () => {
  const { buildReplaceRunTextOperation } = await import(
    "../src/features/table-evidence/table-evidence-cell-editor.tsx"
  );
  const snapshot = buildSourceSnapshot();
  const cell = snapshot.grid_cells[0];
  assert.ok(cell);

  const operation = buildReplaceRunTextOperation(cell, "run-2", "second updated");

  assert.deepEqual(operation, {
    op: "replace_run_text",
    cell_id: "cell-1",
    paragraph_id: "paragraph-2",
    run_id: "run-2",
    before_text: "second paragraph",
    after_text: "second updated",
    after_codepoints: [
      "0073",
      "0065",
      "0063",
      "006F",
      "006E",
      "0064",
      "0020",
      "0075",
      "0070",
      "0064",
      "0061",
      "0074",
      "0065",
      "0064",
    ],
  } satisfies TableCorrectionOperation);

  const corrected = applyTableEvidencePatch({
    sourceSnapshot: snapshot,
    patch: { patch_id: "patch-1", operations: [operation] },
  });
  assert.equal(corrected.grid_cells[0]?.paragraphs[1]?.runs[0]?.text, "second updated");
});

test("workspace confirmation confirms the revision returned by patch save", async () => {
  const tableEvidenceWorkspace = await import(
    "../src/features/table-evidence/table-evidence-workspace.tsx"
  );
  const confirmTableEvidenceWorkspaceRevision = (
    tableEvidenceWorkspace as {
      confirmTableEvidenceWorkspaceRevision?: (input: {
        patch: TableCorrectionPatch;
        invisibleCharsConfirmed: boolean;
        specialSymbolsConfirmed: boolean;
        onSavePatch: (patch: TableCorrectionPatch) => Promise<TableEvidenceRevision>;
        onConfirm: (input: {
          revisionId: string;
          invisibleCharsConfirmed: boolean;
          specialSymbolsConfirmed: boolean;
        }) => Promise<void>;
      }) => Promise<void>;
    }
  ).confirmTableEvidenceWorkspaceRevision;

  assert.equal(typeof confirmTableEvidenceWorkspaceRevision, "function");

  const patch: TableCorrectionPatch = { patch_id: "patch-unsaved", operations: [] };
  const confirmedInputs: Array<{
    revisionId: string;
    invisibleCharsConfirmed: boolean;
    specialSymbolsConfirmed: boolean;
  }> = [];

  await confirmTableEvidenceWorkspaceRevision({
    patch,
    invisibleCharsConfirmed: true,
    specialSymbolsConfirmed: true,
    onSavePatch: (savedPatch) => {
      assert.equal(savedPatch, patch);
      return Promise.resolve(
        buildRevision({
          id: "rev-patched",
          revision_no: 2,
          correction_patch: savedPatch,
        }),
      );
    },
    onConfirm: (input) => {
      confirmedInputs.push(input);
      return Promise.resolve();
    },
  });

  assert.deepEqual(confirmedInputs, [
    {
      revisionId: "rev-patched",
      invisibleCharsConfirmed: true,
      specialSymbolsConfirmed: true,
    },
  ]);
});

test("structure toolbar disables incomplete structure mutation actions", () => {
  const html = renderToStaticMarkup(
    <TableEvidenceWorkspace
      asset={buildAsset()}
      revision={buildRevision({
        fidelity_report: {
          status: "pending",
          failure_codes: [],
          unsupported_fact_groups: [],
          required_confirmations: [],
          invisible_chars_confirmed: false,
          special_symbols_confirmed: false,
        },
      })}
      onBind={() => Promise.resolve()}
      onConfirm={() => Promise.resolve()}
      onSavePatch={() => Promise.resolve(buildRevision())}
    />,
  );

  assert.match(html, /data-structure-action="merge-right" disabled=""/);
  assert.match(html, /data-structure-action="split" disabled=""/);
  assert.match(html, /需要完整结构编辑/);
});

test("workspace disables confirmation for each independent blocking reason", () => {
  const cases: Array<{
    name: string;
    revision: TableEvidenceRevision;
    expectedDetail: RegExp;
  }> = [
    {
      name: "status needs_review only",
      revision: buildRevision({
        fidelity_report: {
          status: "needs_review",
          failure_codes: [],
          unsupported_fact_groups: [],
          required_confirmations: [],
          invisible_chars_confirmed: true,
          special_symbols_confirmed: true,
        },
      }),
      expectedDetail: /data-fidelity-status="needs_review"/,
    },
    {
      name: "failure codes only",
      revision: buildRevision({
        fidelity_report: {
          status: "pending",
          failure_codes: ["run_style_incomplete"],
          unsupported_fact_groups: [],
          required_confirmations: [],
          invisible_chars_confirmed: true,
          special_symbols_confirmed: true,
        },
      }),
      expectedDetail: /run_style_incomplete/,
    },
    {
      name: "unsupported fact groups only",
      revision: buildRevision({
        fidelity_report: {
          status: "pending",
          failure_codes: [],
          unsupported_fact_groups: ["floating_object_anchor"],
          required_confirmations: [],
          invisible_chars_confirmed: true,
          special_symbols_confirmed: true,
        },
      }),
      expectedDetail: /floating_object_anchor/,
    },
    {
      name: "patch apply error only",
      revision: buildRevision({
        correction_patch: buildStaleBeforeTextPatch(),
        fidelity_report: {
          status: "pending",
          failure_codes: [],
          unsupported_fact_groups: [],
          required_confirmations: [],
          invisible_chars_confirmed: true,
          special_symbols_confirmed: true,
        },
      }),
      expectedDetail: /before_text mismatch/,
    },
  ];

  for (const entry of cases) {
    const html = renderToStaticMarkup(
      <TableEvidenceWorkspace
        asset={buildAsset()}
        revision={entry.revision}
        onBind={() => Promise.resolve()}
        onConfirm={() => Promise.resolve()}
        onSavePatch={() => Promise.resolve(buildRevision())}
      />,
    );

    assert.match(html, /data-confirm-disabled="true"/, entry.name);
    assert.match(html, entry.expectedDetail, entry.name);
  }
});

test("workspace allows confirmation when needs_review only reflects now-satisfied required confirmations", () => {
  const html = renderToStaticMarkup(
    <TableEvidenceWorkspace
      asset={buildAsset()}
      revision={buildRevision({
        fidelity_report: {
          status: "needs_review",
          failure_codes: [],
          unsupported_fact_groups: [],
          required_confirmations: ["invisible_chars", "special_symbols"],
          invisible_chars_confirmed: true,
          special_symbols_confirmed: true,
        },
      })}
      onBind={() => Promise.resolve()}
      onConfirm={() => Promise.resolve()}
      onSavePatch={() => Promise.resolve(buildRevision())}
    />,
  );

  assert.match(html, /data-fidelity-status="needs_review"/);
  assert.match(html, /data-confirm-disabled="false"/);
});

test("workspace labels configured binding target type", () => {
  const html = renderToStaticMarkup(
    <TableEvidenceWorkspace
      asset={buildAsset()}
      bindingTargetId="rule-draft-1"
      bindingTargetLabel="规则草稿 ID"
      bindingTargetType="rule_draft"
      revision={buildRevision()}
      onBind={() => Promise.resolve()}
      onConfirm={() => Promise.resolve()}
      onSavePatch={() => Promise.resolve(buildRevision())}
    />,
  );

  assert.match(html, /规则草稿 ID/);
  assert.match(html, /value="rule-draft-1"/);
});

test("workspace exposes stale patch errors and disables save and confirm", () => {
  const html = renderToStaticMarkup(
    <TableEvidenceWorkspace
      asset={buildAsset()}
      revision={buildRevision({
        correction_patch: buildStaleBeforeTextPatch(),
        fidelity_report: {
          status: "pending",
          failure_codes: [],
          unsupported_fact_groups: [],
          required_confirmations: [],
          invisible_chars_confirmed: true,
          special_symbols_confirmed: true,
        },
      })}
      onBind={() => Promise.resolve()}
      onConfirm={() => Promise.resolve()}
      onSavePatch={() => Promise.resolve(buildRevision())}
    />,
  );

  assert.match(html, /修订补丁错误/);
  assert.match(html, /before_text mismatch/);
  assert.match(html, /data-save-disabled="true"/);
  assert.match(html, /data-confirm-disabled="true"/);
});

function buildAsset(overrides: Partial<TableEvidenceAsset> = {}): TableEvidenceAsset {
  return {
    id: "asset-1",
    title: "Table 1",
    source_file_asset_id: "file-1",
    source_file_name: "table.docx",
    source_kind: "docx_upload",
    parser: "python_docx_ooxml",
    parser_version: "table-evidence-v1",
    fidelity_status: "pending",
    created_by: "user-1",
    created_at: "2026-04-29T00:00:00.000Z",
    updated_at: "2026-04-29T00:00:00.000Z",
    ...overrides,
  };
}

function buildRevision(overrides: Partial<TableEvidenceRevision> = {}): TableEvidenceRevision {
  return {
    id: "rev-1",
    table_evidence_asset_id: "asset-1",
    revision_no: 1,
    source_snapshot: buildSourceSnapshot(),
    correction_patch: { patch_id: "patch-1", operations: [] },
    fidelity_report: {
      status: "pending",
      failure_codes: [],
      unsupported_fact_groups: [],
      required_confirmations: [],
      invisible_chars_confirmed: false,
      special_symbols_confirmed: false,
    },
    confirmation_status: "pending",
    created_at: "2026-04-29T00:00:00.000Z",
    ...overrides,
  };
}

function buildStaleBeforeTextPatch(): TableCorrectionPatch {
  return {
    patch_id: "stale-patch",
    operations: [
      {
        op: "replace_run_text",
        cell_id: "cell-1",
        paragraph_id: "paragraph-1",
        run_id: "run-1",
        before_text: "stale",
        after_text: "new",
        after_codepoints: ["006E", "0065", "0077"],
      },
    ],
  };
}

function buildSourceSnapshot(): TableSourceSnapshot {
  return {
    snapshot_id: "source-1",
    table_id: "table-1",
    source_file_asset_id: "file-1",
    parser: "python_docx_ooxml",
    parser_version: "table-evidence-v1",
    row_count: 1,
    column_count: 1,
    notes: [],
    object_evidence: [],
    warnings: [],
    grid_cells: [buildCell()],
  };
}

function buildCell(): TableEvidenceCellSnapshot {
  return {
    cell_id: "cell-1",
    row: 0,
    column: 0,
    rowspan: 1,
    colspan: 1,
    role: "data",
    text: "original\nsecond paragraph",
    display_text: "original\nsecond paragraph",
    codepoints: [
      "006F",
      "0072",
      "0069",
      "0067",
      "0069",
      "006E",
      "0061",
      "006C",
      "000A",
      "0073",
      "0065",
      "0063",
      "006F",
      "006E",
      "0064",
      "0020",
      "0070",
      "0061",
      "0072",
      "0061",
      "0067",
      "0072",
      "0061",
      "0070",
      "0068",
    ],
    paragraphs: [
      {
        id: "paragraph-1",
        paragraph_boundary_after: true,
        runs: [
          {
            id: "run-1",
            kind: "text",
            text: "original",
            codepoints: [
              "006F",
              "0072",
              "0069",
              "0067",
              "0069",
              "006E",
              "0061",
              "006C",
            ],
            style: {},
            invisible_chars: [],
          },
        ],
      },
      {
        id: "paragraph-2",
        paragraph_boundary_after: false,
        runs: [
          {
            id: "run-2",
            kind: "text",
            text: "second paragraph",
            codepoints: [
              "0073",
              "0065",
              "0063",
              "006F",
              "006E",
              "0064",
              "0020",
              "0070",
              "0061",
              "0072",
              "0061",
              "0067",
              "0072",
              "0061",
              "0070",
              "0068",
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
        text: "original",
        codepoints: [
          "006F",
          "0072",
          "0069",
          "0067",
          "0069",
          "006E",
          "0061",
          "006C",
        ],
        style: {},
        invisible_chars: [],
      },
      {
        id: "run-2",
        kind: "text",
        text: "second paragraph",
        codepoints: [
          "0073",
          "0065",
          "0063",
          "006F",
          "006E",
          "0064",
          "0020",
          "0070",
          "0061",
          "0072",
          "0061",
          "0067",
          "0072",
          "0061",
          "0070",
          "0068",
        ],
        style: {},
        invisible_chars: [],
      },
    ],
    header_path: [],
    row_header_path: [],
    column_header_path: [],
    invisible_chars: [],
    style_summary: {},
  };
}
