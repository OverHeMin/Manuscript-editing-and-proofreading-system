import test from "node:test";
import assert from "node:assert/strict";
import { analyzeProofreadingDocumentSemantics } from "../../src/modules/proofreading/document-semantic-pre-analyzer.ts";

test("semantic pre analyzer tags sections and statistical entities deterministically", () => {
  const result = analyzeProofreadingDocumentSemantics({
    blocks: [
      { section: "abstract", block_kind: "heading", text: "摘要" },
      {
        section: "results",
        block_kind: "paragraph",
        text: "结果见表1，治疗组P < 0.05，ALT为32 U/L，95%CI 1.2～2.1。",
      },
    ],
    tables: [],
  });

  assert.deepEqual(result.blockAnalyses[1]?.semanticRoles, [
    "results",
    "statistical_expression",
    "table_reference",
  ]);
  assert.deepEqual(
    result.entities.map((entry) => entry.kind),
    ["table_reference", "p_value", "unit", "confidence_interval"],
  );
  assert.equal(result.entities[1]?.confidence, "high");
});
