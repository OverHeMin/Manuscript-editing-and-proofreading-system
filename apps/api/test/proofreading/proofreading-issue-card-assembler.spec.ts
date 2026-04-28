import test from "node:test";
import assert from "node:assert/strict";
import { assembleDeepProofreadingIssueCards } from "../../src/modules/proofreading/proofreading-issue-card-assembler.ts";
import type { DeepProofreadingIssueCard } from "../../src/modules/proofreading/deep-proofreading-contracts.ts";

test("issue assembler keeps deterministic card as main card and merges weaker duplicates", () => {
  const cards = assembleDeepProofreadingIssueCards({
    deterministicIssues: [
      buildIssue("det-1", "deterministic_check", "table-1:r1:c1"),
    ],
    aiIssues: [buildIssue("ai-1", "ai_pass", "table-1:r1:c1")],
    residualIssues: [buildIssue("res-1", "residual_ai", "table-1:r1:c1")],
  });

  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.itemId, "det-1");
  assert.equal(cards[0]?.source, "deterministic_check");
  assert.deepEqual(
    cards[0]?.supportingEvidence.map((entry) => entry.id),
    ["ai-1", "res-1"],
  );
});

function buildIssue(
  itemId: string,
  source: DeepProofreadingIssueCard["source"],
  anchorKey: string,
): DeepProofreadingIssueCard {
  return {
    itemId,
    title: "数值不一致",
    description: "同一位置报告了数值问题。",
    severity: "high",
    source,
    issueType: "numeric_value_mismatch",
    blocksFinal: false,
    anchor: {
      blockIndex: 1,
      quote: "12.3",
      documentLocator: { anchorKind: "table_cell", anchorKey },
    },
    passKind: "data_statistics_units_and_tables",
    sliceId: "slice-table-1",
    relatedFactIds: ["fact-1"],
    confidence: "high",
    supportingEvidence: [],
    conflictFlags: [],
  };
}
