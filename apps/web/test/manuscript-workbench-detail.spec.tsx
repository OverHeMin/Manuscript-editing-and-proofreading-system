import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildEditingChangeLedgerEntries,
  buildProofreadingConfirmationItems,
  buildWorkbenchAssetDetailHref,
  ManuscriptWorkbenchAssetDetailPage,
  resolveManuscriptAssetDetailKind,
} from "../src/features/manuscript-workbench/manuscript-workbench-detail.tsx";

test("asset detail helpers build hash-based preview routes for manuscript assets", () => {
  assert.equal(
    buildWorkbenchAssetDetailHref({
      mode: "editing",
      manuscriptId: "manuscript-1",
      assetId: "asset-edited-1",
    }),
    "#editing?manuscriptId=manuscript-1&assetId=asset-edited-1",
  );
  assert.equal(
    buildWorkbenchAssetDetailHref({
      mode: "proofreading",
      manuscriptId: "manuscript-2",
      assetId: "asset-proof-1",
      reviewedCaseSnapshotId: "snapshot-9",
    }),
    "#proofreading?manuscriptId=manuscript-2&assetId=asset-proof-1&reviewedCaseSnapshotId=snapshot-9",
  );
});

test("asset detail kind switches proofreading annotated manuscripts into the dedicated confirmation child page", () => {
  assert.equal(
    resolveManuscriptAssetDetailKind({
      mode: "proofreading",
      assetType: "final_proof_annotated_docx",
    }),
    "proofreading_confirmation",
  );
  assert.equal(
    resolveManuscriptAssetDetailKind({
      mode: "screening",
      assetType: "screening_report",
    }),
    "report_preview",
  );
  assert.equal(
    resolveManuscriptAssetDetailKind({
      mode: "editing",
      assetType: "edited_docx",
    }),
    "document_preview",
  );
});

test("editing detail helpers surface a visible change ledger from appliedChanges", () => {
  const entries = buildEditingChangeLedgerEntries({
    id: "job-edit-1",
    module: "editing",
    job_type: "editing_run",
    status: "completed",
    requested_by: "editor-1",
    attempt_count: 1,
    payload: {
      appliedChanges: [
        {
          ruleId: "rule-abstract-objective",
          before: "Background",
          after: "Objective",
          semantic_hit: {
            paragraph_index: 4,
          },
        },
      ],
    },
    created_at: "2026-04-21T09:00:00.000Z",
    updated_at: "2026-04-21T09:01:00.000Z",
  } as never);

  assert.deepEqual(entries, [
    {
      id: "change-1",
      sourceLabel: "rule-abstract-objective",
      before: "Background",
      after: "Objective",
      locationText: "段落 4",
    },
  ]);
});

test("proofreading detail helpers extract item-based human confirmation rows from proofreading plans", () => {
  const items = buildProofreadingConfirmationItems({
    id: "job-proof-1",
    module: "proofreading",
    job_type: "proofreading_confirm",
    status: "completed",
    requested_by: "proofreader-1",
    attempt_count: 1,
    payload: {
      proofreadingPlan: {
        corrections: [
          {
            targetText: "5 mg per dL",
            replacementText: "5 mg/dL",
            category: "style",
          },
          {
            targetText: "The hemoglobin were stable.",
            replacementText: "The hemoglobin was stable.",
            category: "grammar",
          },
        ],
      },
    },
    created_at: "2026-04-21T09:00:00.000Z",
    updated_at: "2026-04-21T09:01:00.000Z",
  } as never);

  assert.deepEqual(items, [
    {
      itemId: "correction-1",
      targetText: "5 mg per dL",
      replacementText: "5 mg/dL",
      category: "style",
    },
    {
      itemId: "correction-2",
      targetText: "The hemoglobin were stable.",
      replacementText: "The hemoglobin was stable.",
      category: "grammar",
    },
  ]);
});

test("proofreading detail page renders the dedicated child page with explicit confirmation actions", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchAssetDetailPage
      mode="proofreading"
      manuscriptTitle="校对确认稿"
      asset={{
        id: "asset-proof-1",
        manuscript_id: "manuscript-1",
        asset_type: "final_proof_annotated_docx",
        status: "active",
        storage_key: "runs/proofreading/final.docx",
        mime_type:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        source_module: "proofreading",
        created_by: "proofreader-1",
        version_no: 3,
        is_current: true,
        file_name: "proofreading-final.docx",
        created_at: "2026-04-21T09:00:00.000Z",
        updated_at: "2026-04-21T09:05:00.000Z",
      }}
      detailKind="proofreading_confirmation"
      backHref="#proofreading?manuscriptId=manuscript-1"
      downloadHref="http://localhost/api/v1/document-assets/asset-proof-1/download"
      confirmationItems={[
        {
          itemId: "correction-1",
          targetText: "5 mg per dL",
          replacementText: "5 mg/dL",
          category: "style",
        },
      ]}
      confirmationState={{
        "correction-1": {
          action: "accept_and_edit",
          editedReplacementText: "5 mg/dL（人工确认）",
          note: "人工补充了单位表达。",
        },
      }}
    />,
  );

  assert.match(markup, /data-detail-kind="proofreading_confirmation"/);
  assert.match(markup, /人工确认/u);
  assert.match(markup, /接受并编辑/u);
  assert.match(markup, /路由到规则候选/u);
  assert.match(markup, /路由到知识候选/u);
  assert.match(markup, /5 mg per dL/);
  assert.match(markup, /5 mg\/dL（人工确认）/u);
  assert.match(markup, /发布人工终稿/u);
});
