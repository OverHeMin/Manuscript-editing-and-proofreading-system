import test from "node:test";
import assert from "node:assert/strict";
import { activateProofreadingRules } from "../../src/modules/proofreading/rule-activation-service.ts";

test("rule activation prioritizes exact table rules before package fallback rules", () => {
  const activated = activateProofreadingRules({
    passKind: "data_statistics_units_and_tables",
    slice: {
      id: "slice-table-1",
      sliceKind: "table",
      passKinds: ["data_statistics_units_and_tables"],
      sourceBlockIndexes: [1],
      tableIds: ["table-1"],
      text: "ALT 表格",
      evidence: [],
    },
    candidates: [
      {
        ruleId: "rule-general",
        score: 5,
        reasons: ["general_package_scope"],
      },
      {
        ruleId: "rule-table",
        score: 12,
        reasons: ["binding_match", "keyword_hit", "medical_package_scope"],
      },
    ],
  });

  assert.deepEqual(activated.map((entry) => entry.ruleId), [
    "rule-table",
    "rule-general",
  ]);
  assert.deepEqual(activated[0]?.reasons.slice(0, 2), [
    "exact_object",
    "binding_match",
  ]);
});
