import test from "node:test";
import assert from "node:assert/strict";

import { normalizeTableEvidenceWorkerResult } from "../../src/modules/document-pipeline/table-evidence-worker-adapter.ts";

test("normalizes python worker lossless table output into runtime evidence snapshot", () => {
  const snapshot = normalizeTableEvidenceWorkerResult({
    manuscriptId: "manuscript-1",
    assetId: "asset-1",
    sourceStorageKey: "uploads/source.docx",
    docxHash: "docx-hash",
    parserVersion: "lossless-v1",
    snapshotId: "snapshot-1",
    createdAt: "2026-04-30T01:00:00.000Z",
    workerResult: {
      status: "ready",
      tables: [
        {
          order: 1,
          body_path: "word/document.xml/body/tbl[1]",
          raw_tbl_xml: "<w:tbl/>",
          ooxml_hash: "table-hash",
          row_count: 1,
          column_count: 1,
          raw_rows: [
            [
              {
                text: "P−value",
                tc_path: "word/document.xml/body/tbl[1]/tr[1]/tc[1]",
                raw_xml_text: "<w:tc/>",
                tc_hash: "cell-hash",
                row_span: 1,
                column_span: 1,
                grid_column_index: 0,
                characters: [
                  {
                    index: 1,
                    char: "−",
                    codePoint: "U+2212",
                    unicodeName: "MINUS SIGN",
                    charClass: "minus",
                    sourceRunId: "run-1",
                    preserved: true,
                    visible: true,
                  },
                ],
                style_spans: [
                  {
                    run_id: "run-1",
                    start_index: 0,
                    end_index: 1,
                    italic: true,
                    script_position: "superscript",
                  },
                ],
                runs: [
                  {
                    run_id: "run-1",
                    runPath: "word/document.xml/body/tbl[1]/tr[1]/tc[1]/p[1]/r[1]",
                    rawRunXml: "<w:r/>",
                    runHash: "run-hash",
                    text: "P",
                    characters: [],
                    style_span: {
                      run_id: "run-1",
                      start_index: 0,
                      end_index: 1,
                      italic: true,
                      script_position: "superscript",
                    },
                  },
                ],
                paragraphs: [
                  {
                    paragraph_id: "p-1",
                    p_path: "word/document.xml/body/tbl[1]/tr[1]/tc[1]/p[1]",
                    raw_p_xml: "<w:p/>",
                    p_hash: "p-hash",
                  },
                ],
              },
            ],
          ],
        },
      ],
      warnings: [],
    },
  });

  assert.equal(snapshot.status, "complete");
  assert.equal(snapshot.tables[0].tableId, "table-1");
  assert.equal(snapshot.tables[0].ooxmlHash, "table-hash");
  assert.equal(snapshot.tables[0].cells[0].cellId, "table-1-cell-0-0");
  assert.equal(snapshot.tables[0].cells[0].characters[0].charClass, "minus");
  assert.equal(snapshot.tables[0].aiPayload.cells[0].characterClasses[0].codePoint, "U+2212");
  assert.equal(snapshot.tables[0].cells[0].styleSpans[0].runId, "run-1");
  assert.equal(snapshot.tables[0].aiPayload.cells[0].styleSpans[0].italic, true);
  assert.equal(
    snapshot.tables[0].aiPayload.cells[0].styleSpans[0].scriptPosition,
    "superscript",
  );
});
