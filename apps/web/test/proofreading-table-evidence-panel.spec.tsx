import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  buildProofreadingTableEvidence,
  ProofreadingTableEvidencePanel,
} from "../src/features/manuscript-workbench/proofreading-table-evidence-panel.tsx";

test("proofreading table evidence panel renders lossless table anchors and character evidence", () => {
  const evidence = buildProofreadingTableEvidence({
    payload: {
      proofreadingTableEvidence: {
        snapshotId: "snapshot-1",
        status: "complete",
        parserVersion: "lossless-v1",
        tables: [
          {
            tableId: "table-1",
            rowCount: 1,
            columnCount: 1,
            fidelityStatus: "complete",
            warnings: [],
            cells: [
              {
                cellId: "table-1-cell-0-0",
                rowIndex: 0,
                columnIndex: 0,
                text: "P−0.05",
                specialCharacters: [
                  {
                    index: 1,
                    char: "−",
                    codePoint: "U+2212",
                    charClass: "minus",
                  },
                ],
                styleSpans: [
                  {
                    runId: "run-1",
                    startIndex: 0,
                    endIndex: 1,
                    italic: true,
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  });

  assert.equal(evidence?.status, "complete");
  assert.equal(evidence?.tables[0]?.cells[0]?.specialCharacters[0]?.codePoint, "U+2212");

  const markup = renderToStaticMarkup(
    <ProofreadingTableEvidencePanel evidence={evidence} />,
  );

  assert.match(markup, /表格无损证据/u);
  assert.match(markup, /snapshot-1/u);
  assert.match(markup, /table-1/u);
  assert.match(markup, /table-1-cell-0-0/u);
  assert.match(markup, /P−0\.05/u);
  assert.match(markup, /U\+2212 · minus/u);
  assert.match(markup, /斜体/u);
  assert.doesNotMatch(markup, /rawTblXml/u);
});
