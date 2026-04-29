import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SpecialCodepointInspector } from "../src/features/table-evidence/special-codepoint-inspector.tsx";
import { TableEvidenceRenderer } from "../src/features/table-evidence/table-evidence-renderer.tsx";

test("table evidence renderer exposes codepoints, invisible marks, and three-line header class", () => {
  const snapshot = {
    snapshot_id: "snapshot-1",
    source_snapshot_id: "source-snapshot-1",
    row_count: 1,
    column_count: 1,
    notes: [],
    grid_cells: [
      {
        cell_id: "cell-header-1",
        row: 0,
        column: 0,
        rowspan: 1,
        colspan: 1,
        role: "header",
        text: " A\u00A0",
        display_text: " A\u00A0",
        codepoints: ["0020", "0041", "00A0"],
        paragraphs: [],
        runs: [],
        header_path: [],
        row_header_path: [],
        column_header_path: [],
        invisible_chars: [
          {
            id: "space-1",
            kind: "leading_space",
            codepoint: "0020",
            offset: 0,
            length: 1,
          },
          {
            id: "nbsp-1",
            kind: "nbsp",
            codepoint: "00A0",
            offset: 2,
            length: 1,
          },
        ],
        style_summary: {
          border_profile: "three_line_header",
        },
      },
    ],
  } as const;

  const html = renderToStaticMarkup(
    <TableEvidenceRenderer
      snapshot={snapshot}
      showInvisibleCharacters={true}
      selectedCellId="cell-header-1"
      onSelectCell={() => undefined}
    />,
  );

  assert.match(html, /data-codepoints="0020 0041 00A0"/);
  assert.match(html, /data-mark="NBSP"/);
  assert.doesNotMatch(html, />NBSP</);
  assert.doesNotMatch(html, />\u00B7</);
  assert.match(html, /three-line-header/);
});

test("table evidence renderer preserves sparse column positions with placeholders", () => {
  const snapshot = {
    snapshot_id: "snapshot-1",
    source_snapshot_id: "source-snapshot-1",
    row_count: 1,
    column_count: 2,
    notes: [],
    grid_cells: [
      {
        cell_id: "cell-col-1",
        row: 0,
        column: 1,
        rowspan: 1,
        colspan: 1,
        role: "data",
        text: "Right column",
        display_text: "Right column",
        codepoints: [
          "0052",
          "0069",
          "0067",
          "0068",
          "0074",
          "0020",
          "0063",
          "006F",
          "006C",
          "0075",
          "006D",
          "006E",
        ],
        paragraphs: [],
        runs: [],
        header_path: [],
        row_header_path: [],
        column_header_path: [],
        invisible_chars: [],
        style_summary: {},
      },
    ],
  } as const;

  const html = renderToStaticMarkup(<TableEvidenceRenderer snapshot={snapshot} />);

  const placeholderIndex = html.indexOf('data-placeholder="true"');
  const cellIndex = html.indexOf('data-cell-id="cell-col-1"');
  assert.ok(placeholderIndex >= 0);
  assert.ok(cellIndex > placeholderIndex);
});

test("special codepoint inspector shows semantic labels and symbol metadata", () => {
  const cell = {
    cell_id: "cell-symbols",
    row: 0,
    column: 0,
    rowspan: 1,
    colspan: 1,
    role: "data",
    text: "A\u2013B \u2212\u00A0",
    display_text: "A\u2013B \u2212\u00A0",
    codepoints: ["0041", "2013", "0042", "0020", "2212", "00A0"],
    paragraphs: [],
    runs: [
      {
        id: "run-en-dash",
        kind: "text",
        text: "A\u2013B",
        codepoints: ["0041", "2013", "0042"],
        style: {},
        invisible_chars: [],
      },
      {
        id: "run-minus",
        kind: "symbol",
        text: "\u2212",
        codepoints: ["2212"],
        style: {},
        symbol_font: "Cambria Math",
        symbol_char: "\u2212",
        invisible_chars: [],
      },
      {
        id: "run-nbsp",
        kind: "text",
        text: "\u00A0",
        codepoints: ["00A0"],
        style: {},
        invisible_chars: [],
      },
    ],
    header_path: [],
    row_header_path: [],
    column_header_path: [],
    invisible_chars: [],
    style_summary: {},
  } as const;

  const html = renderToStaticMarkup(<SpecialCodepointInspector cell={cell} />);

  assert.match(html, /U\+2013 EN DASH/);
  assert.match(html, /U\+2212 MINUS SIGN/);
  assert.match(html, /U\+00A0 NO-BREAK SPACE/);
  assert.match(html, /run-minus/);
  assert.match(html, /Cambria Math/);
});
