import test from "node:test";
import assert from "node:assert/strict";
import type {
  DeepProofreadingBudgetDecision,
  DeepProofreadingDiagnostics,
  DeepProofreadingFactLedger,
  DeepProofreadingIssueCard,
  DeepProofreadingPassKind,
  DeepProofreadingSlice,
  DeepProofreadingStageKind,
} from "../../src/modules/proofreading/deep-proofreading-contracts.ts";
import type { ProofreadingIssueSource } from "../../src/modules/proofreading/proofreading-issue-contract.ts";
import type { ProofreadingDeepPassKind } from "../../src/modules/proofreading/proofreading-pass-run-record.ts";

test("deep proofreading contracts separate db-backed ai passes from diagnostic stages", () => {
  const passKind: ProofreadingDeepPassKind = "data_statistics_units_and_tables";
  const deepPassKind: DeepProofreadingPassKind = "final_regression_preparation";
  const stageKind: DeepProofreadingStageKind = "global_fact_ledger_generation";
  const source: ProofreadingIssueSource = "deterministic_check";
  const budgetDecision: DeepProofreadingBudgetDecision = {
    itemId: "knowledge-1",
    itemKind: "knowledge",
    decision: "selected",
    reasons: ["prompt_snippet", "context_rank"],
    estimatedTokens: 120,
  };

  assert.equal(passKind, "data_statistics_units_and_tables");
  assert.equal(deepPassKind, "final_regression_preparation");
  assert.equal(stageKind, "global_fact_ledger_generation");
  assert.equal(source, "deterministic_check");
  assert.equal(budgetDecision.decision, "selected");
});

test("deep proofreading issue cards carry slice, fact, rule, and knowledge evidence", () => {
  const slice: DeepProofreadingSlice = {
    id: "slice-table-1",
    sliceKind: "table",
    passKinds: ["data_statistics_units_and_tables"],
    sourceBlockIndexes: [2],
    tableIds: ["table-1"],
    text: "表1 治疗组 12.3  ±  1.4",
    evidence: [{ kind: "table", id: "table-1" }],
  };
  const ledger: DeepProofreadingFactLedger = {
    schema: "deep_proofreading_fact_ledger.v1",
    facts: [
      {
        id: "fact-table-1-cell-2",
        kind: "table_cell_value",
        label: "治疗组",
        value: "12.3±1.4",
        confidence: "high",
        source: {
          sourceKind: "table_cell",
          tableId: "table-1",
          anchorKey: "table-1:r1:c2",
        },
      },
    ],
    conflicts: [],
    diagnostics: { factCount: 1, conflictCount: 0 },
  };
  const issue: DeepProofreadingIssueCard = {
    itemId: "issue-1",
    title: "表格与正文数值不一致",
    description: "正文 13.3 与表格 12.3 不一致。",
    severity: "high",
    source: "deterministic_check",
    issueType: "medical_data_consistency.narrative_table_value_conflict",
    blocksFinal: false,
    anchor: {
      blockIndex: 2,
      quote: "13.3",
      documentLocator: {
        anchorKind: "table_cell",
        anchorKey: "table-1:r1:c2",
        tableId: "table-1",
      },
    },
    passKind: "data_statistics_units_and_tables",
    sliceId: "slice-table-1",
    relatedFactIds: ["fact-table-1-cell-2"],
    relatedRuleIds: ["rule-table-consistency"],
    relatedKnowledgeItemIds: ["knowledge-table-units"],
    confidence: "high",
    supportingEvidence: [],
    conflictFlags: [],
  };
  const diagnostics: DeepProofreadingDiagnostics = {
    passCounts: { completed: 1, failed: 0, skipped: 0 },
    sliceCounts: { table: 1 },
    selectedRuleCounts: { total: 1 },
    selectedKnowledgeCounts: { total: 1 },
    tableConfidenceCounts: { high: 1, medium: 0, low: 0 },
    tokenEstimates: { prompt: 300, completion: 100 },
    modelCallEstimates: { total: 1 },
    fallbackReasons: [],
  };

  assert.equal(slice.tableIds?.[0], "table-1");
  assert.equal(ledger.facts[0]?.source.sourceKind, "table_cell");
  assert.equal(issue.passKind, "data_statistics_units_and_tables");
  assert.deepEqual(issue.relatedKnowledgeItemIds, ["knowledge-table-units"]);
  assert.equal(diagnostics.tableConfidenceCounts.high, 1);
});
