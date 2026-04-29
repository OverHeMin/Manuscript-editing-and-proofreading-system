import assert from "node:assert/strict";
import test from "node:test";
import { applyTableEvidencePatch } from "../src/features/table-evidence/table-evidence-patch.ts";

test("table evidence patch previews run text replacement without mutating the source snapshot", () => {
  const sourceSnapshot = {
    snapshot_id: "snapshot-1",
    table_id: "table-1",
    source_file_asset_id: "source-file-1",
    parser: "python_docx_ooxml",
    parser_version: "1.0.0",
    row_count: 1,
    column_count: 1,
    notes: [],
    grid_cells: [
      {
        cell_id: "cell-1",
        row: 0,
        column: 0,
        rowspan: 1,
        colspan: 1,
        role: "data",
        text: "A\u2013B",
        display_text: "A\u2013B",
        codepoints: ["0041", "2013", "0042"],
        paragraphs: [
          {
            id: "paragraph-1",
            paragraph_boundary_after: false,
            runs: [
              {
                id: "run-1",
                kind: "text",
                text: "A\u2013B",
                codepoints: ["0041", "2013", "0042"],
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
            text: "A\u2013B",
            codepoints: ["0041", "2013", "0042"],
            style: {},
            invisible_chars: [],
          },
        ],
        header_path: [],
        row_header_path: [],
        column_header_path: [],
        invisible_chars: [],
        style_summary: {},
      },
    ],
    object_evidence: [],
    warnings: [],
  } as const;

  const confirmed = applyTableEvidencePatch({
    sourceSnapshot,
    patch: {
      patch_id: "patch-1",
      operations: [
        {
          op: "replace_run_text",
          cell_id: "cell-1",
          paragraph_id: "paragraph-1",
          run_id: "run-1",
          before_text: "A\u2013B",
          after_text: "A\u2212B",
          after_codepoints: ["0041", "2212", "0042"],
        },
      ],
    },
  });

  assert.equal(sourceSnapshot.grid_cells[0]?.text, "A\u2013B");
  assert.deepEqual(sourceSnapshot.grid_cells[0]?.codepoints, ["0041", "2013", "0042"]);
  assert.equal(confirmed.grid_cells[0]?.text, "A\u2212B");
  assert.equal(confirmed.grid_cells[0]?.display_text, "A\u2212B");
  assert.deepEqual(confirmed.grid_cells[0]?.codepoints, ["0041", "2212", "0042"]);
  assert.equal(confirmed.grid_cells[0]?.paragraphs[0]?.runs[0]?.text, "A\u2212B");
  assert.deepEqual(confirmed.grid_cells[0]?.paragraphs[0]?.runs[0]?.codepoints, [
    "0041",
    "2212",
    "0042",
  ]);
});

test("table evidence patch rejects stale run text before applying replacement", () => {
  const sourceSnapshot = createPatchSourceSnapshot();

  assert.throws(
    () =>
      applyTableEvidencePatch({
        sourceSnapshot,
        patch: {
          patch_id: "patch-stale",
          operations: [
            {
              op: "replace_run_text",
              cell_id: "cell-1",
              paragraph_id: "paragraph-1",
              run_id: "run-1",
              before_text: "stale",
              after_text: "A\u2212B",
              after_codepoints: ["0041", "2212", "0042"],
            },
          ],
        },
      }),
    /before_text mismatch/,
  );
});

test("table evidence patch throws for missing correction targets", () => {
  const sourceSnapshot = createPatchSourceSnapshot();

  assert.throws(
    () =>
      applyTableEvidencePatch({
        sourceSnapshot,
        patch: {
          patch_id: "patch-missing",
          operations: [
            {
              op: "set_cell_alignment",
              cell_id: "missing-cell",
              horizontal_alignment: "center",
            },
          ],
        },
      }),
    /cell missing-cell was not found/,
  );
});

test("table evidence patch recomputes paragraph boundaries with newline codepoints", () => {
  const sourceSnapshot = {
    ...createPatchSourceSnapshot(),
    grid_cells: [
      {
        ...createPatchSourceSnapshot().grid_cells[0],
        paragraphs: [
          {
            id: "paragraph-1",
            paragraph_boundary_after: true,
            runs: [
              {
                id: "run-1",
                kind: "text",
                text: "A",
                codepoints: ["0041"],
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
                text: "B",
                codepoints: ["0042"],
                style: {},
                invisible_chars: [],
              },
            ],
          },
        ],
      },
    ],
  } as const;

  const confirmed = applyTableEvidencePatch({
    sourceSnapshot,
    patch: { patch_id: "patch-boundary", operations: [] },
  });

  assert.equal(confirmed.grid_cells[0]?.text, "A\nB");
  assert.deepEqual(confirmed.grid_cells[0]?.codepoints, ["0041", "000A", "0042"]);
});

test("table evidence patch preserves no-paragraph cell text and codepoints", () => {
  const sourceSnapshot = {
    ...createPatchSourceSnapshot(),
    grid_cells: [
      {
        ...createPatchSourceSnapshot().grid_cells[0],
        text: "raw",
        display_text: "raw",
        codepoints: ["0072", "0061", "0077"],
        paragraphs: [],
        runs: [],
      },
    ],
  } as const;

  const confirmed = applyTableEvidencePatch({
    sourceSnapshot,
    patch: { patch_id: "patch-no-paragraph", operations: [] },
  });

  assert.equal(confirmed.grid_cells[0]?.text, "raw");
  assert.equal(confirmed.grid_cells[0]?.display_text, "raw");
  assert.deepEqual(confirmed.grid_cells[0]?.codepoints, ["0072", "0061", "0077"]);
});

function createPatchSourceSnapshot() {
  return {
    snapshot_id: "snapshot-1",
    table_id: "table-1",
    source_file_asset_id: "source-file-1",
    parser: "python_docx_ooxml",
    parser_version: "1.0.0",
    row_count: 1,
    column_count: 1,
    notes: [],
    grid_cells: [
      {
        cell_id: "cell-1",
        row: 0,
        column: 0,
        rowspan: 1,
        colspan: 1,
        role: "data",
        text: "A\u2013B",
        display_text: "A\u2013B",
        codepoints: ["0041", "2013", "0042"],
        paragraphs: [
          {
            id: "paragraph-1",
            paragraph_boundary_after: false,
            runs: [
              {
                id: "run-1",
                kind: "text",
                text: "A\u2013B",
                codepoints: ["0041", "2013", "0042"],
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
            text: "A\u2013B",
            codepoints: ["0041", "2013", "0042"],
            style: {},
            invisible_chars: [],
          },
        ],
        header_path: [],
        row_header_path: [],
        column_header_path: [],
        invisible_chars: [],
        style_summary: {},
      },
    ],
    object_evidence: [],
    warnings: [],
  } as const;
}
