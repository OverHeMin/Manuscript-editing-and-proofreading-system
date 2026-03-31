import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ManuscriptWorkbenchSummary } from "../src/features/manuscript-workbench/manuscript-workbench-summary.tsx";

test("manuscript workbench summary renders operator-facing overview cards and the asset chain", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      mode="editing"
      accessibleHandoffModes={["editing", "proofreading"]}
      workspace={{
        manuscript: {
          id: "manuscript-1",
          title: "Cardiology review",
          manuscript_type: "review",
          status: "processing",
          created_by: "editor-1",
          current_editing_asset_id: "asset-edited-1",
          created_at: "2026-03-31T09:00:00.000Z",
          updated_at: "2026-03-31T10:00:00.000Z",
        },
        assets: [
          {
            id: "asset-edited-1",
            manuscript_id: "manuscript-1",
            asset_type: "edited_docx",
            status: "active",
            storage_key: "runs/editing/final.docx",
            mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            parent_asset_id: "asset-original-1",
            source_module: "editing",
            source_job_id: "job-edit-1",
            created_by: "editor-1",
            version_no: 2,
            is_current: true,
            file_name: "editing-final.docx",
            created_at: "2026-03-31T09:45:00.000Z",
            updated_at: "2026-03-31T09:45:00.000Z",
          },
          {
            id: "asset-original-1",
            manuscript_id: "manuscript-1",
            asset_type: "original",
            status: "superseded",
            storage_key: "uploads/review/review.docx",
            mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            source_module: "upload",
            created_by: "editor-1",
            version_no: 1,
            is_current: false,
            file_name: "review.docx",
            created_at: "2026-03-31T09:00:00.000Z",
            updated_at: "2026-03-31T09:00:00.000Z",
          },
        ],
        currentAsset: {
          id: "asset-edited-1",
          manuscript_id: "manuscript-1",
          asset_type: "edited_docx",
          status: "active",
          storage_key: "runs/editing/final.docx",
          mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          parent_asset_id: "asset-original-1",
          source_module: "editing",
          source_job_id: "job-edit-1",
          created_by: "editor-1",
          version_no: 2,
          is_current: true,
          file_name: "editing-final.docx",
          created_at: "2026-03-31T09:45:00.000Z",
          updated_at: "2026-03-31T09:45:00.000Z",
        },
        suggestedParentAsset: {
          id: "asset-edited-1",
          manuscript_id: "manuscript-1",
          asset_type: "edited_docx",
          status: "active",
          storage_key: "runs/editing/final.docx",
          mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          parent_asset_id: "asset-original-1",
          source_module: "editing",
          source_job_id: "job-edit-1",
          created_by: "editor-1",
          version_no: 2,
          is_current: true,
          file_name: "editing-final.docx",
          created_at: "2026-03-31T09:45:00.000Z",
          updated_at: "2026-03-31T09:45:00.000Z",
        },
        latestProofreadingDraftAsset: null,
      }}
      latestJob={{
        id: "job-edit-1",
        module: "editing",
        job_type: "editing_run",
        status: "completed",
        requested_by: "editor-1",
        attempt_count: 1,
        created_at: "2026-03-31T09:45:00.000Z",
        updated_at: "2026-03-31T09:46:00.000Z",
      }}
      latestExport={{
        manuscript_id: "manuscript-1",
        asset: {
          id: "asset-edited-1",
          manuscript_id: "manuscript-1",
          asset_type: "edited_docx",
          status: "active",
          storage_key: "runs/editing/final.docx",
          mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          parent_asset_id: "asset-original-1",
          source_module: "editing",
          source_job_id: "job-edit-1",
          created_by: "editor-1",
          version_no: 2,
          is_current: true,
          file_name: "editing-final.docx",
          created_at: "2026-03-31T09:45:00.000Z",
          updated_at: "2026-03-31T09:45:00.000Z",
        },
        download: {
          storage_key: "exports/manuscript-1/current.docx",
          file_name: "editing-final.docx",
          mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          url: "/api/v1/document-assets/asset-edited-1/download",
        },
      }}
      latestActionResult={{
        tone: "success",
        actionLabel: "Run Editing",
        message: "Created asset asset-edited-1",
        details: [
          {
            label: "Asset",
            value: "asset-edited-1",
          },
          {
            label: "Job",
            value: "job-edit-1",
          },
        ],
      }}
    />,
  );

  assert.match(markup, /Manuscript Overview/);
  assert.match(markup, /Latest Action Result/);
  assert.match(markup, /Run Editing/);
  assert.match(markup, /Created asset asset-edited-1/);
  assert.match(markup, /job-edit-1/);
  assert.match(markup, /Open Proofreading Workbench/);
  assert.match(markup, /href="#proofreading\?manuscriptId=manuscript-1"/);
  assert.match(markup, /Cardiology review/);
  assert.match(markup, /Current Asset/);
  assert.match(markup, /editing-final\.docx/);
  assert.match(markup, /Latest Job/);
  assert.match(markup, /completed/);
  assert.match(markup, /Latest Export/);
  assert.match(markup, /exports\/manuscript-1\/current\.docx/);
  assert.match(markup, /Download Latest Export/);
  assert.match(
    markup,
    /href="http:\/\/localhost\/api\/v1\/document-assets\/asset-edited-1\/download"/,
  );
  assert.match(markup, /Asset Chain/);
  assert.match(markup, /asset-original-1/);
  assert.match(markup, /Debug Snapshot/);
});

test("manuscript workbench summary guides screening operators toward the next governed run", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      mode="screening"
      accessibleHandoffModes={["screening", "editing"]}
      workspace={{
        manuscript: {
          id: "manuscript-screen-1",
          title: "Oncology review",
          manuscript_type: "review",
          status: "uploaded",
          created_by: "operator-1",
          created_at: "2026-03-31T09:00:00.000Z",
          updated_at: "2026-03-31T09:05:00.000Z",
        },
        assets: [
          {
            id: "asset-original-1",
            manuscript_id: "manuscript-screen-1",
            asset_type: "original",
            status: "active",
            storage_key: "uploads/oncology/review.docx",
            mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            source_module: "upload",
            created_by: "operator-1",
            version_no: 1,
            is_current: true,
            file_name: "oncology-review.docx",
            created_at: "2026-03-31T09:00:00.000Z",
            updated_at: "2026-03-31T09:00:00.000Z",
          },
        ],
        currentAsset: {
          id: "asset-original-1",
          manuscript_id: "manuscript-screen-1",
          asset_type: "original",
          status: "active",
          storage_key: "uploads/oncology/review.docx",
          mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          source_module: "upload",
          created_by: "operator-1",
          version_no: 1,
          is_current: true,
          file_name: "oncology-review.docx",
          created_at: "2026-03-31T09:00:00.000Z",
          updated_at: "2026-03-31T09:00:00.000Z",
        },
        suggestedParentAsset: {
          id: "asset-original-1",
          manuscript_id: "manuscript-screen-1",
          asset_type: "original",
          status: "active",
          storage_key: "uploads/oncology/review.docx",
          mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          source_module: "upload",
          created_by: "operator-1",
          version_no: 1,
          is_current: true,
          file_name: "oncology-review.docx",
          created_at: "2026-03-31T09:00:00.000Z",
          updated_at: "2026-03-31T09:00:00.000Z",
        },
        latestProofreadingDraftAsset: null,
      }}
      latestJob={null}
      latestExport={null}
      latestActionResult={null}
    />,
  );

  assert.match(markup, /Recommended Next Step/);
  assert.match(markup, /Run screening on the recommended parent asset/);
  assert.match(markup, /Launch Screening Workbench execution before any editing handoff\./);
  assert.match(markup, /oncology-review\.docx/);
});

test("manuscript workbench summary guides proofreading operators to finalize an existing draft", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      mode="proofreading"
      accessibleHandoffModes={["proofreading"]}
      workspace={{
        manuscript: {
          id: "manuscript-proof-1",
          title: "Neurology case study",
          manuscript_type: "case_report",
          status: "processing",
          created_by: "operator-1",
          current_editing_asset_id: "asset-edited-1",
          created_at: "2026-03-31T09:00:00.000Z",
          updated_at: "2026-03-31T10:00:00.000Z",
        },
        assets: [
          {
            id: "asset-draft-1",
            manuscript_id: "manuscript-proof-1",
            asset_type: "proofreading_draft_report",
            status: "active",
            storage_key: "runs/proofreading/draft.docx",
            mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            parent_asset_id: "asset-edited-1",
            source_module: "proofreading",
            source_job_id: "job-proof-1",
            created_by: "operator-1",
            version_no: 3,
            is_current: false,
            file_name: "proofreading-draft.docx",
            created_at: "2026-03-31T09:45:00.000Z",
            updated_at: "2026-03-31T09:45:00.000Z",
          },
          {
            id: "asset-edited-1",
            manuscript_id: "manuscript-proof-1",
            asset_type: "edited_docx",
            status: "active",
            storage_key: "runs/editing/final.docx",
            mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            source_module: "editing",
            created_by: "operator-1",
            version_no: 2,
            is_current: true,
            file_name: "editing-final.docx",
            created_at: "2026-03-31T09:30:00.000Z",
            updated_at: "2026-03-31T09:30:00.000Z",
          },
        ],
        currentAsset: {
          id: "asset-edited-1",
          manuscript_id: "manuscript-proof-1",
          asset_type: "edited_docx",
          status: "active",
          storage_key: "runs/editing/final.docx",
          mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          source_module: "editing",
          created_by: "operator-1",
          version_no: 2,
          is_current: true,
          file_name: "editing-final.docx",
          created_at: "2026-03-31T09:30:00.000Z",
          updated_at: "2026-03-31T09:30:00.000Z",
        },
        suggestedParentAsset: {
          id: "asset-edited-1",
          manuscript_id: "manuscript-proof-1",
          asset_type: "edited_docx",
          status: "active",
          storage_key: "runs/editing/final.docx",
          mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          source_module: "editing",
          created_by: "operator-1",
          version_no: 2,
          is_current: true,
          file_name: "editing-final.docx",
          created_at: "2026-03-31T09:30:00.000Z",
          updated_at: "2026-03-31T09:30:00.000Z",
        },
        latestProofreadingDraftAsset: {
          id: "asset-draft-1",
          manuscript_id: "manuscript-proof-1",
          asset_type: "proofreading_draft_report",
          status: "active",
          storage_key: "runs/proofreading/draft.docx",
          mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          parent_asset_id: "asset-edited-1",
          source_module: "proofreading",
          source_job_id: "job-proof-1",
          created_by: "operator-1",
          version_no: 3,
          is_current: false,
          file_name: "proofreading-draft.docx",
          created_at: "2026-03-31T09:45:00.000Z",
          updated_at: "2026-03-31T09:45:00.000Z",
        },
      }}
      latestJob={{
        id: "job-proof-1",
        module: "proofreading",
        job_type: "proofreading_run",
        status: "completed",
        requested_by: "operator-1",
        attempt_count: 1,
        created_at: "2026-03-31T09:45:00.000Z",
        updated_at: "2026-03-31T09:46:00.000Z",
      }}
      latestExport={null}
      latestActionResult={null}
    />,
  );

  assert.match(markup, /Finalize the reviewed proofreading draft/);
  assert.match(markup, /Human confirmation is still required before producing the proofreading final\./);
  assert.match(markup, /proofreading-draft\.docx/);
});
