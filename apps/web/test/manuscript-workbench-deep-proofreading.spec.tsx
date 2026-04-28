import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildDeepProofreadingEvidence,
  buildProofreadingConfirmationItems,
  ManuscriptWorkbenchAssetDetailPage,
} from "../src/features/manuscript-workbench/manuscript-workbench-detail.tsx";

test("proofreading workspace renders deep proofreading diagnostics as read-only evidence", () => {
  const job = {
    payload: {
      deepProofreading: {
        schema: "deep_proofreading_run.v1",
        factLedgerSummary: {
          factCount: 12,
          conflictCount: 2,
        },
        tableFidelityDiagnostics: {
          tableCount: 3,
          confidenceCounts: { high: 2, medium: 1, low: 0 },
          unsupportedStructureCount: 1,
          lowConfidenceReviewOnly: false,
        },
        selectedRuleDiagnostics: {
          totalSelected: 8,
          byPassKind: { data_statistics_units_and_tables: 5 },
        },
        selectedKnowledgeBudgetDiagnostics: {
          totalSelected: 4,
          totalExcluded: 9,
          estimatedTokens: 800,
          byPassKind: { data_statistics_units_and_tables: 3 },
        },
        passRuns: [
          {
            passKind: "data_statistics_units_and_tables",
            sliceId: "slice-table-1",
            status: "completed",
            issueCount: 2,
          },
        ],
        stageDiagnostics: [
          {
            passKind: "final_regression_preparation",
            status: "completed",
            issueCount: 3,
          },
        ],
        factLedger: {
          facts: [{ id: "fact-ledger-1", label: "ALT", value: "18.2" }],
        },
      },
      proofreadingPlan: {
        role: "医学稿件终校审校员",
        summary: "Deep proofreading produced 1 candidate issue.",
        issues: [
          {
            itemId: "issue-1",
            title: "表格与正文数值可能不一致",
            description: "正文 ALT 为 19.5，表格为 18.2。",
            severity: "high",
            source: "deterministic_check",
            issueType: "medical_data_consistency.numeric_value_mismatch",
            blocksFinal: false,
            anchor: { blockIndex: 0, quote: "ALT为19.5" },
            suggestion: { action: "verify_fact", note: "人工核对。" },
          },
        ],
        manualReviewItems: [],
      },
    },
  };
  const confirmationItems = buildProofreadingConfirmationItems(job as never);
  const evidence = buildDeepProofreadingEvidence(job as never);

  assert.equal(confirmationItems.length, 1);
  assert.equal(
    confirmationItems.some((item) => item.itemId === "fact-ledger-1"),
    false,
  );
  assert.equal(evidence?.factLedgerSummary.conflictCount, 2);

  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchAssetDetailPage
      mode="proofreading"
      manuscriptTitle="深度校对稿件"
      asset={{
        id: "asset-proof-draft-1",
        manuscript_id: "manuscript-proof-1",
        asset_type: "proofreading_draft_report",
        status: "active",
        storage_key: "runs/proofreading/deep.md",
        mime_type: "text/markdown",
        source_module: "proofreading",
        created_by: "proofreader-1",
        version_no: 1,
        is_current: true,
        file_name: "deep.md",
        created_at: "2026-04-28T10:00:00.000Z",
        updated_at: "2026-04-28T10:05:00.000Z",
      }}
      detailKind="proofreading_workspace"
      backHref="#proofreading?manuscriptId=manuscript-proof-1"
      downloadHref="http://localhost/api/v1/document-assets/asset-proof-draft-1/download"
      confirmationItems={confirmationItems}
      deepProofreadingEvidence={evidence}
      proofreadingDocumentBlocks={[
        {
          blockId: "proofreading-block-0",
          blockIndex: 0,
          sectionLabel: "结果",
          blockKind: "paragraph",
          text: "结果见表1，ALT为19.5 U/L。",
        },
      ]}
    />,
  );

  assert.match(markup, /深度校对证据/u);
  assert.match(markup, /全局事实账本/u);
  assert.match(markup, /事实 12 · 冲突 2/u);
  assert.match(markup, /表格 3 · 高 2 · 中 1 · 低 0/u);
  assert.match(markup, /规则 8/u);
  assert.match(markup, /知识 4/u);
  assert.match(markup, /data_statistics_units_and_tables/u);
  assert.match(markup, /final_regression_preparation/u);
  assert.doesNotMatch(markup, /fact-ledger-1/u);
});
