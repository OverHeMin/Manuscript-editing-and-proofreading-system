import test from "node:test";
import assert from "node:assert/strict";
import { runDeepProofreadingAiPasses } from "../../src/modules/proofreading/deep-proofreading-pass-runner.ts";
import type { CreateProofreadingAiPlanInput } from "../../src/modules/proofreading/proofreading-ai-plan-service.ts";

test("deep pass runner sends one pass and one slice context per AI call", async () => {
  const calls: CreateProofreadingAiPlanInput[] = [];
  const result = await runDeepProofreadingAiPasses({
    manuscriptId: "manuscript-1",
    sourceBlocks: [{ text: "见表1。", section: "results" }],
    slices: [
      {
        id: "slice-table-1",
        sliceKind: "table",
        passKinds: ["data_statistics_units_and_tables"],
        sourceBlockIndexes: [0],
        tableIds: ["table-1"],
        tableEvidence: {
          snapshotId: "snapshot-1",
          tableId: "table-1",
          aiReadableTablePayload: {
            tableId: "table-1",
            rowCount: 1,
            columnCount: 1,
            cells: [
              {
                cellId: "table-1-cell-0-0",
                rowIndex: 0,
                columnIndex: 0,
                rowSpan: 1,
                columnSpan: 1,
                text: "P−value",
                characterClasses: [
                  { index: 1, char: "−", codePoint: "U+2212", charClass: "minus" },
                ],
                styleSpans: [],
              },
            ],
            specialCharacterWarnings: ["table-1-cell-0-0:U+2212:minus"],
            lowConfidenceReasons: [],
          },
          fidelityReport: { status: "complete", warnings: [] },
        },
        text: "表1 ALT",
        evidence: [],
      },
    ],
    factLedgerSummary: { factCount: 2, conflictCount: 0 },
    proofreadingAiPlanService: {
      async createPlan(input: CreateProofreadingAiPlanInput) {
        calls.push(structuredClone(input));
        return {
          role: "医学稿件终校审校员",
          summary: "one issue",
          issues: [
            {
              itemId: "ai-issue-1",
              title: "AI发现",
              description: "AI slice issue.",
              severity: "medium",
              source: "residual_ai",
              issueType: "ai.slice",
              blocksFinal: false,
              anchor: { blockIndex: 0, quote: "见表1" },
            },
          ],
          manualReviewItems: [],
        };
      },
    },
  });

  assert.equal(calls.length, 1);
  assert.equal((calls[0]?.passFocus as { passKind?: string })?.passKind, "data_statistics_units_and_tables");
  assert.equal((calls[0]?.sliceContext as { id?: string })?.id, "slice-table-1");
  assert.equal(
    (
      calls[0]?.sliceContext as {
        tableEvidence?: {
          aiReadableTablePayload?: { cells?: Array<{ cellId?: string }> };
        };
      }
    )?.tableEvidence?.aiReadableTablePayload?.cells?.[0]?.cellId,
    "table-1-cell-0-0",
  );
  assert.equal(result.issues[0]?.source, "ai_pass");
  assert.equal(result.issues[0]?.sliceId, "slice-table-1");
});
