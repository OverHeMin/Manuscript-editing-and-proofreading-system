import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ManuscriptWorkbenchControls,
} from "../src/features/manuscript-workbench/manuscript-workbench-controls.tsx";
import {
  ManuscriptWorkbenchFocusCanvas,
} from "../src/features/manuscript-workbench/manuscript-workbench-page.tsx";

test("workbench controls render the bare AI action with the localized label", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchControls
      mode="editing"
      busy={false}
      lookup={{
        manuscriptId: "manuscript-1",
        onChange: () => {},
        onLoad: () => {},
      }}
      moduleAction={{
        title: "Editing Run",
        selectedAssetId: "asset-original-1",
        emptyLabel: "请选择资产",
        actionLabel: "Run Editing",
        secondaryActionLabel: "Run AI Recognition",
        options: [
          {
            value: "asset-original-1",
            label: "original.docx · original · asset-original-1",
          },
        ],
        selectedContextLabel: "Selected Parent Asset",
        onSelect: () => {},
        onRun: () => {},
        onSecondaryRun: () => {},
      }}
    />,
  );

  assert.match(markup, /AI识别/u);
  assert.match(markup, /data-secondary-action="available"/u);
});

test("focus canvas points current-result links at the asset download endpoint", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchFocusCanvas
      mode="proofreading"
      busy={false}
      detectedManuscriptTypeLabel="综述（高置信度）"
      workspace={{
        manuscript: {
          id: "manuscript-1",
          title: "心血管综述",
          manuscript_type: "review",
          status: "processing",
          created_by: "editor-1",
          created_at: "2026-04-16T09:00:00.000Z",
          updated_at: "2026-04-16T09:30:00.000Z",
          result_asset_matrix: {},
        },
        assets: [
          {
            id: "asset-proofread-1",
            manuscript_id: "manuscript-1",
            asset_type: "final_proof_annotated_docx",
            status: "active",
            storage_key: "runs/proofreading/output.docx",
            mime_type:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            parent_asset_id: "asset-report-1",
            source_module: "proofreading",
            created_by: "proofreader-1",
            version_no: 2,
            is_current: true,
            file_name: "proofreading-output.docx",
            created_at: "2026-04-16T09:20:00.000Z",
            updated_at: "2026-04-16T09:20:00.000Z",
          },
          {
            id: "asset-original-1",
            manuscript_id: "manuscript-1",
            asset_type: "original",
            status: "active",
            storage_key: "uploads/original.docx",
            mime_type:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            source_module: "upload",
            created_by: "editor-1",
            version_no: 1,
            is_current: true,
            file_name: "original.docx",
            created_at: "2026-04-16T09:00:00.000Z",
            updated_at: "2026-04-16T09:00:00.000Z",
          },
        ],
        currentAsset: {
          id: "asset-proofread-1",
          manuscript_id: "manuscript-1",
          asset_type: "final_proof_annotated_docx",
          status: "active",
          storage_key: "runs/proofreading/output.docx",
          mime_type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          parent_asset_id: "asset-report-1",
          source_module: "proofreading",
          created_by: "proofreader-1",
          version_no: 2,
          is_current: true,
          file_name: "proofreading-output.docx",
          created_at: "2026-04-16T09:20:00.000Z",
          updated_at: "2026-04-16T09:20:00.000Z",
        },
        currentManuscriptAsset: {
          id: "asset-original-1",
          manuscript_id: "manuscript-1",
          asset_type: "original",
          status: "active",
          storage_key: "uploads/original.docx",
          mime_type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          source_module: "upload",
          created_by: "editor-1",
          version_no: 1,
          is_current: true,
          file_name: "original.docx",
          created_at: "2026-04-16T09:00:00.000Z",
          updated_at: "2026-04-16T09:00:00.000Z",
        },
        suggestedParentAsset: {
          id: "asset-original-1",
          manuscript_id: "manuscript-1",
          asset_type: "original",
          status: "active",
          storage_key: "uploads/original.docx",
          mime_type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          source_module: "upload",
          created_by: "editor-1",
          version_no: 1,
          is_current: true,
          file_name: "original.docx",
          created_at: "2026-04-16T09:00:00.000Z",
          updated_at: "2026-04-16T09:00:00.000Z",
        },
        latestProofreadingDraftAsset: null,
      }}
      primaryActions={[
        {
          title: "Proofreading Draft",
          selectedAssetId: "asset-original-1",
          emptyLabel: "请选择资产",
          actionLabel: "Create Draft",
          secondaryActionLabel: "Run AI Recognition",
          options: [
            {
              value: "asset-original-1",
              label: "original.docx · original · asset-original-1",
            },
          ],
          selectedContextLabel: "Selected Parent Asset",
          onSelect: () => {},
          onRun: () => {},
          onSecondaryRun: () => {},
        },
      ]}
    />,
  );

  assert.match(markup, /AI识别/u);
  assert.match(markup, /下载校对稿件/u);
  assert.match(
    markup,
    /href="\/api\/v1\/document-assets\/asset-proofread-1\/download"/u,
  );
});
