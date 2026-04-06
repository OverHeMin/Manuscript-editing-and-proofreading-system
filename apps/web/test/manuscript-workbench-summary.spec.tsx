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

test("manuscript workbench summary preserves evaluation sample context in the evaluation shortcut", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      {...({
        mode: "editing",
        accessibleHandoffModes: ["editing", "proofreading"],
        canOpenEvaluationWorkbench: true,
        prefilledManuscriptId: "manuscript-eval-1",
        prefilledReviewedCaseSnapshotId: "reviewed-case-77",
        prefilledSampleSetItemId: "sample-set-item-22",
        workspace: {
          manuscript: {
            id: "manuscript-eval-1",
            title: "Cardiology evaluation candidate",
            manuscript_type: "clinical_study",
            status: "processing",
            created_by: "editor-1",
            created_at: "2026-03-31T09:00:00.000Z",
            updated_at: "2026-03-31T10:00:00.000Z",
          },
          assets: [],
          currentAsset: null,
          suggestedParentAsset: null,
          latestProofreadingDraftAsset: null,
        },
        latestJob: null,
        latestExport: null,
        latestActionResult: null,
      } as never)}
    />,
  );

  assert.match(markup, /Open Evaluation Workbench/);
  assert.match(
    markup,
    /href="#evaluation-workbench\?manuscriptId=manuscript-eval-1&amp;reviewedCaseSnapshotId=reviewed-case-77&amp;sampleSetItemId=sample-set-item-22"/,
  );
});

test("manuscript workbench summary preserves evaluation sample context in manuscript next-step shortcuts for the same manuscript", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      {...({
        mode: "editing",
        accessibleHandoffModes: ["editing", "proofreading"],
        prefilledManuscriptId: "manuscript-eval-1",
        prefilledReviewedCaseSnapshotId: "reviewed-case-77",
        prefilledSampleSetItemId: "sample-set-item-22",
        workspace: {
          manuscript: {
            id: "manuscript-eval-1",
            title: "Cardiology evaluation candidate",
            manuscript_type: "clinical_study",
            status: "processing",
            created_by: "editor-1",
            created_at: "2026-03-31T09:00:00.000Z",
            updated_at: "2026-03-31T10:00:00.000Z",
          },
          assets: [],
          currentAsset: null,
          suggestedParentAsset: null,
          latestProofreadingDraftAsset: null,
        },
        latestJob: {
          id: "job-edit-1",
          module: "editing",
          job_type: "editing_run",
          status: "completed",
          requested_by: "editor-1",
          attempt_count: 1,
          created_at: "2026-03-31T09:45:00.000Z",
          updated_at: "2026-03-31T09:46:00.000Z",
        },
        latestExport: null,
        latestActionResult: null,
      } as never)}
    />,
  );

  assert.match(markup, /Open Proofreading Workbench/);
  assert.match(
    markup,
    /href="#proofreading\?manuscriptId=manuscript-eval-1&amp;reviewedCaseSnapshotId=reviewed-case-77&amp;sampleSetItemId=sample-set-item-22"/,
  );
});

test("manuscript workbench summary falls back to manuscript-only next-step shortcuts when workspace manuscript does not match handoff manuscript", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      {...({
        mode: "editing",
        accessibleHandoffModes: ["editing", "proofreading"],
        prefilledManuscriptId: "manuscript-source-A",
        prefilledReviewedCaseSnapshotId: "reviewed-case-77",
        prefilledSampleSetItemId: "sample-set-item-22",
        workspace: {
          manuscript: {
            id: "manuscript-target-B",
            title: "Cardiology evaluation mismatch",
            manuscript_type: "clinical_study",
            status: "processing",
            created_by: "editor-1",
            created_at: "2026-03-31T09:00:00.000Z",
            updated_at: "2026-03-31T10:00:00.000Z",
          },
          assets: [],
          currentAsset: null,
          suggestedParentAsset: null,
          latestProofreadingDraftAsset: null,
        },
        latestJob: {
          id: "job-edit-1",
          module: "editing",
          job_type: "editing_run",
          status: "completed",
          requested_by: "editor-1",
          attempt_count: 1,
          created_at: "2026-03-31T09:45:00.000Z",
          updated_at: "2026-03-31T09:46:00.000Z",
        },
        latestExport: null,
        latestActionResult: null,
      } as never)}
    />,
  );

  assert.match(markup, /Open Proofreading Workbench/);
  assert.match(
    markup,
    /href="#proofreading\?manuscriptId=manuscript-target-B"/,
  );
  assert.doesNotMatch(markup, /reviewedCaseSnapshotId=/);
  assert.doesNotMatch(markup, /sampleSetItemId=/);
});

test("manuscript workbench summary falls back to manuscript-only evaluation link when workspace manuscript does not match handoff manuscript", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      {...({
        mode: "editing",
        accessibleHandoffModes: ["editing", "proofreading"],
        canOpenEvaluationWorkbench: true,
        prefilledManuscriptId: "manuscript-source-A",
        prefilledReviewedCaseSnapshotId: "reviewed-case-77",
        prefilledSampleSetItemId: "sample-set-item-22",
        workspace: {
          manuscript: {
            id: "manuscript-target-B",
            title: "Cardiology evaluation mismatch",
            manuscript_type: "clinical_study",
            status: "processing",
            created_by: "editor-1",
            created_at: "2026-03-31T09:00:00.000Z",
            updated_at: "2026-03-31T10:00:00.000Z",
          },
          assets: [],
          currentAsset: null,
          suggestedParentAsset: null,
          latestProofreadingDraftAsset: null,
        },
        latestJob: null,
        latestExport: null,
        latestActionResult: null,
      } as never)}
    />,
  );

  assert.match(markup, /Open Evaluation Workbench/);
  assert.match(
    markup,
    /href="#evaluation-workbench\?manuscriptId=manuscript-target-B"/,
  );
  assert.doesNotMatch(markup, /reviewedCaseSnapshotId=/);
  assert.doesNotMatch(markup, /sampleSetItemId=/);
});

test("manuscript workbench summary falls back to manuscript-only evaluation link without handoff context", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      {...({
        mode: "editing",
        accessibleHandoffModes: ["editing", "proofreading"],
        canOpenEvaluationWorkbench: true,
        workspace: {
          manuscript: {
            id: "manuscript-eval-2",
            title: "Cardiology evaluation fallback",
            manuscript_type: "clinical_study",
            status: "processing",
            created_by: "editor-1",
            created_at: "2026-03-31T09:00:00.000Z",
            updated_at: "2026-03-31T10:00:00.000Z",
          },
          assets: [],
          currentAsset: null,
          suggestedParentAsset: null,
          latestProofreadingDraftAsset: null,
        },
        latestJob: null,
        latestExport: null,
        latestActionResult: null,
      } as never)}
    />,
  );

  assert.match(markup, /Open Evaluation Workbench/);
  assert.match(markup, /href="#evaluation-workbench\?manuscriptId=manuscript-eval-2"/);
  assert.doesNotMatch(markup, /reviewedCaseSnapshotId=/);
  assert.doesNotMatch(markup, /sampleSetItemId=/);
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

test("manuscript workbench summary guides human-final proofreading output into learning review", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      mode="proofreading"
      accessibleHandoffModes={["proofreading"]}
      canOpenLearningReview
      workspace={{
        manuscript: {
          id: "manuscript-learning-1",
          title: "Neurology learning handoff",
          manuscript_type: "clinical_study",
          status: "completed",
          created_by: "proofreader-1",
          current_proofreading_asset_id: "asset-human-final-1",
          created_at: "2026-03-31T09:00:00.000Z",
          updated_at: "2026-03-31T10:10:00.000Z",
        },
        assets: [
          {
            id: "asset-human-final-1",
            manuscript_id: "manuscript-learning-1",
            asset_type: "human_final_docx",
            status: "active",
            storage_key: "runs/manuscript-learning-1/proofreading/human-final.docx",
            mime_type:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            parent_asset_id: "asset-proof-final-1",
            source_module: "manual",
            source_job_id: "job-human-final-1",
            created_by: "proofreader-1",
            version_no: 1,
            is_current: true,
            file_name: "human-final.docx",
            created_at: "2026-03-31T10:10:00.000Z",
            updated_at: "2026-03-31T10:10:00.000Z",
          },
          {
            id: "asset-proof-final-1",
            manuscript_id: "manuscript-learning-1",
            asset_type: "final_proof_annotated_docx",
            status: "superseded",
            storage_key: "runs/manuscript-learning-1/proofreading/final.docx",
            mime_type:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            parent_asset_id: "asset-proof-draft-1",
            source_module: "proofreading",
            source_job_id: "job-proof-final-1",
            created_by: "proofreader-1",
            version_no: 4,
            is_current: true,
            file_name: "proofreading-final.docx",
            created_at: "2026-03-31T10:05:00.000Z",
            updated_at: "2026-03-31T10:05:00.000Z",
          },
        ],
        currentAsset: {
          id: "asset-human-final-1",
          manuscript_id: "manuscript-learning-1",
          asset_type: "human_final_docx",
          status: "active",
          storage_key: "runs/manuscript-learning-1/proofreading/human-final.docx",
          mime_type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          parent_asset_id: "asset-proof-final-1",
          source_module: "manual",
          source_job_id: "job-human-final-1",
          created_by: "proofreader-1",
          version_no: 1,
          is_current: true,
          file_name: "human-final.docx",
          created_at: "2026-03-31T10:10:00.000Z",
          updated_at: "2026-03-31T10:10:00.000Z",
        },
        suggestedParentAsset: null,
        latestProofreadingDraftAsset: null,
      }}
      latestJob={{
        id: "job-human-final-1",
        manuscript_id: "manuscript-learning-1",
        module: "manual",
        job_type: "publish_human_final",
        status: "completed",
        requested_by: "proofreader-1",
        attempt_count: 1,
        created_at: "2026-03-31T10:10:00.000Z",
        updated_at: "2026-03-31T10:10:00.000Z",
      }}
      latestExport={null}
      latestActionResult={null}
    />,
  );

  assert.match(markup, /Hand off this manuscript into learning review/);
  assert.match(
    markup,
    /The human-final manuscript is ready for governed learning snapshot creation\./,
  );
  assert.match(markup, /Open Learning Review/);
  assert.match(markup, /href="#learning-review\?manuscriptId=manuscript-learning-1"/);
});

test("manuscript workbench summary prefers settled screening overview over a failed latest job", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      {...({
        mode: "screening",
        accessibleHandoffModes: ["screening", "editing"],
        workspace: {
          manuscript: {
            id: "manuscript-settled-screening-1",
            title: "Respiratory review",
            manuscript_type: "review",
            status: "processing",
            created_by: "operator-1",
            created_at: "2026-04-06T09:00:00.000Z",
            updated_at: "2026-04-06T10:00:00.000Z",
            module_execution_overview: {
              screening: {
                module: "screening",
                observation_status: "reported",
                latest_job: {
                  id: "job-screen-failed-2",
                  manuscript_id: "manuscript-settled-screening-1",
                  module: "screening",
                  job_type: "screening_run",
                  status: "failed",
                  requested_by: "operator-1",
                  attempt_count: 2,
                  created_at: "2026-04-06T09:55:00.000Z",
                  updated_at: "2026-04-06T09:56:00.000Z",
                },
                latest_snapshot: {
                  id: "snapshot-screen-1",
                  manuscript_id: "manuscript-settled-screening-1",
                  module: "screening",
                  job_id: "job-screen-success-1",
                  execution_profile_id: "profile-screening",
                  module_template_id: "template-screening",
                  module_template_version_no: 3,
                  prompt_template_id: "prompt-screening",
                  prompt_template_version: "2026-04-06",
                  skill_package_ids: ["screening-skill-pack"],
                  skill_package_versions: ["1.0.0"],
                  model_id: "model-screening",
                  knowledge_item_ids: ["knowledge-screening-1"],
                  created_asset_ids: ["asset-screening-1"],
                  created_at: "2026-04-06T09:40:00.000Z",
                  agent_execution: {
                    observation_status: "reported",
                    log_id: "agent-log-screening-1",
                  },
                  runtime_binding_readiness: {
                    observation_status: "reported",
                  },
                },
                settlement: {
                  derived_status: "business_completed_settled",
                  business_completed: true,
                  orchestration_completed: true,
                  attention_required: false,
                  reason: "Business execution and governed follow-up are both settled.",
                },
              },
              editing: {
                module: "editing",
                observation_status: "not_started",
              },
              proofreading: {
                module: "proofreading",
                observation_status: "not_started",
              },
            },
          },
          assets: [],
          currentAsset: null,
          suggestedParentAsset: null,
          latestProofreadingDraftAsset: null,
        },
        latestJob: {
          id: "job-screen-failed-2",
          module: "screening",
          job_type: "screening_run",
          status: "failed",
          requested_by: "operator-1",
          attempt_count: 2,
          created_at: "2026-04-06T09:55:00.000Z",
          updated_at: "2026-04-06T09:56:00.000Z",
        },
        latestExport: null,
        latestActionResult: null,
      } as never)}
    />,
  );

  assert.match(markup, /Advance this manuscript into editing/);
  assert.match(markup, /Open Editing Workbench/);
  assert.match(markup, /Screening Settlement/);
  assert.match(markup, /Settled · latest job failed · snapshot snapshot-screen-1/);
});

test("manuscript workbench summary does not present retryable editing follow-up as ready for proofreading", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      {...({
        mode: "editing",
        accessibleHandoffModes: ["editing", "proofreading"],
        workspace: {
          manuscript: {
            id: "manuscript-editing-retryable-1",
            title: "Respiratory editing retry",
            manuscript_type: "review",
            status: "processing",
            created_by: "operator-1",
            current_editing_asset_id: "asset-edited-1",
            created_at: "2026-04-06T09:00:00.000Z",
            updated_at: "2026-04-06T10:00:00.000Z",
            module_execution_overview: {
              screening: {
                module: "screening",
                observation_status: "reported",
                settlement: {
                  derived_status: "business_completed_settled",
                  business_completed: true,
                  orchestration_completed: true,
                  attention_required: false,
                  reason: "Screening is fully settled.",
                },
              },
              editing: {
                module: "editing",
                observation_status: "reported",
                latest_job: {
                  id: "job-editing-2",
                  manuscript_id: "manuscript-editing-retryable-1",
                  module: "editing",
                  job_type: "editing_run",
                  status: "completed",
                  requested_by: "operator-1",
                  attempt_count: 2,
                  created_at: "2026-04-06T09:40:00.000Z",
                  updated_at: "2026-04-06T09:45:00.000Z",
                },
                latest_snapshot: {
                  id: "snapshot-edit-1",
                  manuscript_id: "manuscript-editing-retryable-1",
                  module: "editing",
                  job_id: "job-editing-2",
                  execution_profile_id: "profile-editing",
                  module_template_id: "template-editing",
                  module_template_version_no: 4,
                  prompt_template_id: "prompt-editing",
                  prompt_template_version: "2026-04-06",
                  skill_package_ids: ["editing-skill-pack"],
                  skill_package_versions: ["1.0.0"],
                  model_id: "model-editing",
                  knowledge_item_ids: ["knowledge-editing-1"],
                  created_asset_ids: ["asset-edited-1"],
                  created_at: "2026-04-06T09:45:00.000Z",
                  agent_execution: {
                    observation_status: "reported",
                    log_id: "agent-log-editing-1",
                  },
                  runtime_binding_readiness: {
                    observation_status: "reported",
                  },
                },
                settlement: {
                  derived_status: "business_completed_follow_up_retryable",
                  business_completed: true,
                  orchestration_completed: false,
                  attention_required: false,
                  reason: "Business execution is complete and governed follow-up is retryable.",
                },
              },
              proofreading: {
                module: "proofreading",
                observation_status: "not_started",
              },
            },
          },
          assets: [
            {
              id: "asset-edited-1",
              manuscript_id: "manuscript-editing-retryable-1",
              asset_type: "edited_docx",
              status: "active",
              storage_key: "runs/editing/retryable.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              source_module: "editing",
              source_job_id: "job-editing-2",
              created_by: "operator-1",
              version_no: 2,
              is_current: true,
              file_name: "editing-retryable.docx",
              created_at: "2026-04-06T09:45:00.000Z",
              updated_at: "2026-04-06T09:45:00.000Z",
            },
          ],
          currentAsset: {
            id: "asset-edited-1",
            manuscript_id: "manuscript-editing-retryable-1",
            asset_type: "edited_docx",
            status: "active",
            storage_key: "runs/editing/retryable.docx",
            mime_type:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            source_module: "editing",
            source_job_id: "job-editing-2",
            created_by: "operator-1",
            version_no: 2,
            is_current: true,
            file_name: "editing-retryable.docx",
            created_at: "2026-04-06T09:45:00.000Z",
            updated_at: "2026-04-06T09:45:00.000Z",
          },
          suggestedParentAsset: {
            id: "asset-edited-1",
            manuscript_id: "manuscript-editing-retryable-1",
            asset_type: "edited_docx",
            status: "active",
            storage_key: "runs/editing/retryable.docx",
            mime_type:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            source_module: "editing",
            source_job_id: "job-editing-2",
            created_by: "operator-1",
            version_no: 2,
            is_current: true,
            file_name: "editing-retryable.docx",
            created_at: "2026-04-06T09:45:00.000Z",
            updated_at: "2026-04-06T09:45:00.000Z",
          },
          latestProofreadingDraftAsset: null,
        },
        latestJob: {
          id: "job-editing-2",
          module: "editing",
          job_type: "editing_run",
          status: "completed",
          requested_by: "operator-1",
          attempt_count: 2,
          created_at: "2026-04-06T09:40:00.000Z",
          updated_at: "2026-04-06T09:45:00.000Z",
        },
        latestExport: null,
        latestActionResult: null,
      } as never)}
    />,
  );

  assert.match(markup, /Inspect editing follow-up before proofreading handoff/);
  assert.match(markup, /Business complete, follow-up retryable · latest job completed · snapshot snapshot-edit-1/);
  assert.doesNotMatch(markup, /Open Proofreading Workbench/);
});

test("manuscript workbench summary fails open to heuristic guidance when settlement observation is unavailable", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      {...({
        mode: "editing",
        accessibleHandoffModes: ["editing", "proofreading"],
        workspace: {
          manuscript: {
            id: "manuscript-editing-failed-open-1",
            title: "Editing fallback manuscript",
            manuscript_type: "review",
            status: "processing",
            created_by: "operator-1",
            current_editing_asset_id: "asset-edited-1",
            created_at: "2026-04-06T09:00:00.000Z",
            updated_at: "2026-04-06T10:00:00.000Z",
            module_execution_overview: {
              screening: {
                module: "screening",
                observation_status: "reported",
                settlement: {
                  derived_status: "business_completed_settled",
                  business_completed: true,
                  orchestration_completed: true,
                  attention_required: false,
                  reason: "Screening is fully settled.",
                },
              },
              editing: {
                module: "editing",
                observation_status: "failed_open",
                error: "Execution tracking service is unavailable for manuscript settlement overview.",
              },
              proofreading: {
                module: "proofreading",
                observation_status: "not_started",
              },
            },
          },
          assets: [
            {
              id: "asset-edited-1",
              manuscript_id: "manuscript-editing-failed-open-1",
              asset_type: "edited_docx",
              status: "active",
              storage_key: "runs/editing/fallback.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              source_module: "editing",
              source_job_id: "job-editing-3",
              created_by: "operator-1",
              version_no: 2,
              is_current: true,
              file_name: "editing-fallback.docx",
              created_at: "2026-04-06T09:45:00.000Z",
              updated_at: "2026-04-06T09:45:00.000Z",
            },
          ],
          currentAsset: {
            id: "asset-edited-1",
            manuscript_id: "manuscript-editing-failed-open-1",
            asset_type: "edited_docx",
            status: "active",
            storage_key: "runs/editing/fallback.docx",
            mime_type:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            source_module: "editing",
            source_job_id: "job-editing-3",
            created_by: "operator-1",
            version_no: 2,
            is_current: true,
            file_name: "editing-fallback.docx",
            created_at: "2026-04-06T09:45:00.000Z",
            updated_at: "2026-04-06T09:45:00.000Z",
          },
          suggestedParentAsset: {
            id: "asset-edited-1",
            manuscript_id: "manuscript-editing-failed-open-1",
            asset_type: "edited_docx",
            status: "active",
            storage_key: "runs/editing/fallback.docx",
            mime_type:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            source_module: "editing",
            source_job_id: "job-editing-3",
            created_by: "operator-1",
            version_no: 2,
            is_current: true,
            file_name: "editing-fallback.docx",
            created_at: "2026-04-06T09:45:00.000Z",
            updated_at: "2026-04-06T09:45:00.000Z",
          },
          latestProofreadingDraftAsset: null,
        },
        latestJob: {
          id: "job-editing-3",
          module: "editing",
          job_type: "editing_run",
          status: "completed",
          requested_by: "operator-1",
          attempt_count: 1,
          created_at: "2026-04-06T09:40:00.000Z",
          updated_at: "2026-04-06T09:45:00.000Z",
        },
        latestExport: null,
        latestActionResult: null,
      } as never)}
    />,
  );

  assert.match(markup, /Advance this manuscript into proofreading/);
  assert.match(markup, /Editing Settlement/);
  assert.match(markup, /Observation unavailable \(failed open\)/);
});

test("manuscript workbench summary uses latest job execution tracking as fallback guidance when overview is unavailable", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      {...({
        mode: "editing",
        accessibleHandoffModes: ["editing", "proofreading"],
        workspace: {
          manuscript: {
            id: "manuscript-editing-fallback-track-1",
            title: "Editing tracked fallback manuscript",
            manuscript_type: "review",
            status: "processing",
            created_by: "operator-1",
            current_editing_asset_id: "asset-edited-1",
            created_at: "2026-04-06T09:00:00.000Z",
            updated_at: "2026-04-06T10:00:00.000Z",
            module_execution_overview: {
              screening: {
                module: "screening",
                observation_status: "reported",
                settlement: {
                  derived_status: "business_completed_settled",
                  business_completed: true,
                  orchestration_completed: true,
                  attention_required: false,
                  reason: "Screening is fully settled.",
                },
              },
              editing: {
                module: "editing",
                observation_status: "failed_open",
                error: "Execution tracking service is unavailable for manuscript settlement overview.",
              },
              proofreading: {
                module: "proofreading",
                observation_status: "not_started",
              },
            },
          },
          assets: [
            {
              id: "asset-edited-1",
              manuscript_id: "manuscript-editing-fallback-track-1",
              asset_type: "edited_docx",
              status: "active",
              storage_key: "runs/editing/fallback-track.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              source_module: "editing",
              source_job_id: "job-editing-track-9",
              created_by: "operator-1",
              version_no: 2,
              is_current: true,
              file_name: "editing-fallback-track.docx",
              created_at: "2026-04-06T09:45:00.000Z",
              updated_at: "2026-04-06T09:45:00.000Z",
            },
          ],
          currentAsset: {
            id: "asset-edited-1",
            manuscript_id: "manuscript-editing-fallback-track-1",
            asset_type: "edited_docx",
            status: "active",
            storage_key: "runs/editing/fallback-track.docx",
            mime_type:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            source_module: "editing",
            source_job_id: "job-editing-track-9",
            created_by: "operator-1",
            version_no: 2,
            is_current: true,
            file_name: "editing-fallback-track.docx",
            created_at: "2026-04-06T09:45:00.000Z",
            updated_at: "2026-04-06T09:45:00.000Z",
          },
          suggestedParentAsset: {
            id: "asset-edited-1",
            manuscript_id: "manuscript-editing-fallback-track-1",
            asset_type: "edited_docx",
            status: "active",
            storage_key: "runs/editing/fallback-track.docx",
            mime_type:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            source_module: "editing",
            source_job_id: "job-editing-track-9",
            created_by: "operator-1",
            version_no: 2,
            is_current: true,
            file_name: "editing-fallback-track.docx",
            created_at: "2026-04-06T09:45:00.000Z",
            updated_at: "2026-04-06T09:45:00.000Z",
          },
          latestProofreadingDraftAsset: null,
        },
        latestJob: {
          id: "job-editing-track-9",
          manuscript_id: "manuscript-editing-fallback-track-1",
          module: "editing",
          job_type: "editing_run",
          status: "completed",
          requested_by: "operator-1",
          attempt_count: 2,
          created_at: "2026-04-06T09:40:00.000Z",
          updated_at: "2026-04-06T09:45:00.000Z",
          execution_tracking: {
            observation_status: "reported",
            snapshot: {
              id: "snapshot-editing-track-9",
              manuscript_id: "manuscript-editing-fallback-track-1",
              module: "editing",
              job_id: "job-editing-track-9",
              execution_profile_id: "profile-editing",
              module_template_id: "template-editing",
              module_template_version_no: 4,
              prompt_template_id: "prompt-editing",
              prompt_template_version: "2026-04-06",
              skill_package_ids: ["editing-skill-pack"],
              skill_package_versions: ["1.0.0"],
              model_id: "model-editing",
              knowledge_item_ids: ["knowledge-editing-1"],
              created_asset_ids: ["asset-edited-1"],
              created_at: "2026-04-06T09:45:00.000Z",
              agent_execution: {
                observation_status: "reported",
                log_id: "agent-log-editing-track-9",
                log: {
                  id: "agent-log-editing-track-9",
                  status: "completed",
                  orchestration_status: "retryable",
                  completion_summary: {
                    derived_status: "business_completed_follow_up_retryable",
                    business_completed: true,
                    follow_up_required: true,
                    fully_settled: false,
                    attention_required: false,
                  },
                  recovery_summary: {
                    category: "recoverable_now",
                    recovery_readiness: "ready_now",
                    reason: "Retryable orchestration is ready now.",
                  },
                },
              },
              runtime_binding_readiness: {
                observation_status: "reported",
                report: {
                  status: "degraded",
                  scope: {
                    module: "editing",
                    manuscriptType: "review",
                    templateFamilyId: "template-family-1",
                  },
                  issues: [
                    {
                      code: "runtime_not_active",
                      message: "Runtime is not active.",
                    },
                  ],
                  execution_profile_alignment: {
                    status: "drifted",
                    binding_execution_profile_id: "profile-editing",
                    active_execution_profile_id: "profile-editing-active",
                  },
                },
              },
            },
            settlement: {
              derived_status: "business_completed_follow_up_retryable",
              business_completed: true,
              orchestration_completed: false,
              attention_required: false,
              reason: "Business execution is complete and governed follow-up is retryable.",
            },
          },
        },
        latestExport: null,
        latestActionResult: null,
      } as never)}
    />,
  );

  assert.match(markup, /Inspect editing follow-up before proofreading handoff/);
  assert.match(markup, /Settlement/);
  assert.match(markup, /Business complete, follow-up retryable/);
  assert.match(markup, /Recovery Posture/);
  assert.match(markup, /Recoverable now/);
  assert.match(markup, /Runtime Readiness/);
  assert.match(markup, /Degraded \(1 issue\)/);
  assert.doesNotMatch(markup, /Open Proofreading Workbench/);
});

test("manuscript workbench summary uses settled latest job execution tracking to advance when overview is missing", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      {...({
        mode: "screening",
        accessibleHandoffModes: ["screening", "editing"],
        workspace: {
          manuscript: {
            id: "manuscript-screening-track-1",
            title: "Screening tracked fallback manuscript",
            manuscript_type: "review",
            status: "processing",
            created_by: "operator-1",
            current_screening_asset_id: "asset-screen-1",
            created_at: "2026-04-06T09:00:00.000Z",
            updated_at: "2026-04-06T10:00:00.000Z",
          },
          assets: [
            {
              id: "asset-screen-1",
              manuscript_id: "manuscript-screening-track-1",
              asset_type: "screening_report",
              status: "active",
              storage_key: "runs/screening/settled.md",
              mime_type: "text/markdown",
              source_module: "screening",
              source_job_id: "job-screening-track-1",
              created_by: "operator-1",
              version_no: 2,
              is_current: true,
              file_name: "screening-settled.md",
              created_at: "2026-04-06T09:45:00.000Z",
              updated_at: "2026-04-06T09:45:00.000Z",
            },
          ],
          currentAsset: {
            id: "asset-screen-1",
            manuscript_id: "manuscript-screening-track-1",
            asset_type: "screening_report",
            status: "active",
            storage_key: "runs/screening/settled.md",
            mime_type: "text/markdown",
            source_module: "screening",
            source_job_id: "job-screening-track-1",
            created_by: "operator-1",
            version_no: 2,
            is_current: true,
            file_name: "screening-settled.md",
            created_at: "2026-04-06T09:45:00.000Z",
            updated_at: "2026-04-06T09:45:00.000Z",
          },
          suggestedParentAsset: {
            id: "asset-screen-1",
            manuscript_id: "manuscript-screening-track-1",
            asset_type: "screening_report",
            status: "active",
            storage_key: "runs/screening/settled.md",
            mime_type: "text/markdown",
            source_module: "screening",
            source_job_id: "job-screening-track-1",
            created_by: "operator-1",
            version_no: 2,
            is_current: true,
            file_name: "screening-settled.md",
            created_at: "2026-04-06T09:45:00.000Z",
            updated_at: "2026-04-06T09:45:00.000Z",
          },
          latestProofreadingDraftAsset: null,
        },
        latestJob: {
          id: "job-screening-track-1",
          manuscript_id: "manuscript-screening-track-1",
          module: "screening",
          job_type: "screening_run",
          status: "completed",
          requested_by: "operator-1",
          attempt_count: 1,
          created_at: "2026-04-06T09:40:00.000Z",
          updated_at: "2026-04-06T09:45:00.000Z",
          execution_tracking: {
            observation_status: "reported",
            snapshot: {
              id: "snapshot-screening-track-1",
              manuscript_id: "manuscript-screening-track-1",
              module: "screening",
              job_id: "job-screening-track-1",
              execution_profile_id: "profile-screening",
              module_template_id: "template-screening",
              module_template_version_no: 4,
              prompt_template_id: "prompt-screening",
              prompt_template_version: "2026-04-06",
              skill_package_ids: ["screening-skill-pack"],
              skill_package_versions: ["1.0.0"],
              model_id: "model-screening",
              knowledge_item_ids: ["knowledge-screening-1"],
              created_asset_ids: ["asset-screen-1"],
              created_at: "2026-04-06T09:45:00.000Z",
              agent_execution: {
                observation_status: "reported",
                log_id: "agent-log-screening-track-1",
                log: {
                  id: "agent-log-screening-track-1",
                  status: "completed",
                  orchestration_status: "completed",
                  completion_summary: {
                    derived_status: "business_completed_settled",
                    business_completed: true,
                    follow_up_required: false,
                    fully_settled: true,
                    attention_required: false,
                  },
                  recovery_summary: {
                    category: "not_recoverable",
                    recovery_readiness: "not_recoverable",
                    reason: "No recovery needed.",
                  },
                },
              },
              runtime_binding_readiness: {
                observation_status: "reported",
                report: {
                  status: "ready",
                  scope: {
                    module: "screening",
                    manuscriptType: "review",
                    templateFamilyId: "template-family-1",
                  },
                  issues: [],
                  execution_profile_alignment: {
                    status: "aligned",
                    binding_execution_profile_id: "profile-screening",
                    active_execution_profile_id: "profile-screening",
                  },
                },
              },
            },
            settlement: {
              derived_status: "business_completed_settled",
              business_completed: true,
              orchestration_completed: true,
              attention_required: false,
              reason: "Screening is settled.",
            },
          },
        },
        latestExport: null,
        latestActionResult: null,
      } as never)}
    />,
  );

  assert.match(markup, /Advance this manuscript into editing/);
  assert.match(markup, /Open Editing Workbench/);
  assert.match(markup, /Settlement/);
  assert.match(markup, /Settled/);
  assert.match(markup, /Recovery Posture/);
  assert.match(markup, /No recovery needed/);
  assert.match(markup, /Runtime Readiness/);
  assert.match(markup, /Ready/);
});

test("manuscript workbench summary shows latest job execution tracking alongside raw job status", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      {...({
        mode: "editing",
        accessibleHandoffModes: ["editing", "proofreading"],
        workspace: {
          manuscript: {
            id: "manuscript-job-tracking-1",
            title: "Tracked editing job",
            manuscript_type: "review",
            status: "processing",
            created_by: "operator-1",
            created_at: "2026-04-06T09:00:00.000Z",
            updated_at: "2026-04-06T10:00:00.000Z",
          },
          assets: [],
          currentAsset: null,
          suggestedParentAsset: null,
          latestProofreadingDraftAsset: null,
        },
        latestJob: {
          id: "job-editing-track-1",
          manuscript_id: "manuscript-job-tracking-1",
          module: "editing",
          job_type: "editing_run",
          status: "completed",
          requested_by: "operator-1",
          attempt_count: 1,
          created_at: "2026-04-06T09:40:00.000Z",
          updated_at: "2026-04-06T09:45:00.000Z",
          execution_tracking: {
            observation_status: "reported",
            snapshot: {
              id: "tracked-snapshot-1",
              manuscript_id: "manuscript-job-tracking-1",
              module: "editing",
              job_id: "job-editing-track-1",
              execution_profile_id: "profile-editing",
              module_template_id: "template-editing",
              module_template_version_no: 4,
              prompt_template_id: "prompt-editing",
              prompt_template_version: "2026-04-06",
              skill_package_ids: ["editing-skill-pack"],
              skill_package_versions: ["1.0.0"],
              model_id: "model-editing",
              knowledge_item_ids: ["knowledge-editing-1"],
              created_asset_ids: ["asset-edited-1"],
              created_at: "2026-04-06T09:45:00.000Z",
              agent_execution: {
                observation_status: "reported",
                log_id: "agent-log-editing-1",
              },
              runtime_binding_readiness: {
                observation_status: "reported",
              },
            },
            settlement: {
              derived_status: "business_completed_follow_up_pending",
              business_completed: true,
              orchestration_completed: false,
              attention_required: false,
              reason: "Business execution is complete and governed follow-up is pending.",
            },
          },
        },
        latestExport: null,
        latestActionResult: null,
      } as never)}
    />,
  );

  assert.match(markup, /Latest Job/);
  assert.match(markup, /Status/);
  assert.match(markup, /Execution Settlement/);
  assert.match(markup, /Business complete, follow-up pending/);
  assert.match(markup, /Execution Snapshot/);
  assert.match(markup, /tracked-snapshot-1/);
});

test("manuscript workbench summary shows latest job recovery and runtime readiness posture", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      {...({
        mode: "editing",
        accessibleHandoffModes: ["editing", "proofreading"],
        workspace: {
          manuscript: {
            id: "manuscript-job-posture-1",
            title: "Tracked editing posture",
            manuscript_type: "review",
            status: "processing",
            created_by: "operator-1",
            created_at: "2026-04-06T09:00:00.000Z",
            updated_at: "2026-04-06T10:00:00.000Z",
          },
          assets: [],
          currentAsset: null,
          suggestedParentAsset: null,
          latestProofreadingDraftAsset: null,
        },
        latestJob: {
          id: "job-editing-posture-1",
          manuscript_id: "manuscript-job-posture-1",
          module: "editing",
          job_type: "editing_run",
          status: "completed",
          requested_by: "operator-1",
          attempt_count: 1,
          created_at: "2026-04-06T09:40:00.000Z",
          updated_at: "2026-04-06T09:45:00.000Z",
          execution_tracking: {
            observation_status: "reported",
            snapshot: {
              id: "tracked-snapshot-posture-1",
              manuscript_id: "manuscript-job-posture-1",
              module: "editing",
              job_id: "job-editing-posture-1",
              execution_profile_id: "profile-editing",
              module_template_id: "template-editing",
              module_template_version_no: 4,
              prompt_template_id: "prompt-editing",
              prompt_template_version: "2026-04-06",
              skill_package_ids: ["editing-skill-pack"],
              skill_package_versions: ["1.0.0"],
              model_id: "model-editing",
              knowledge_item_ids: ["knowledge-editing-1"],
              created_asset_ids: ["asset-edited-1"],
              created_at: "2026-04-06T09:45:00.000Z",
              agent_execution: {
                observation_status: "reported",
                log_id: "agent-log-editing-posture-1",
                log: {
                  id: "agent-log-editing-posture-1",
                  status: "completed",
                  orchestration_status: "retryable",
                  completion_summary: {
                    derived_status: "business_completed_follow_up_retryable",
                    business_completed: true,
                    follow_up_required: true,
                    fully_settled: false,
                    attention_required: false,
                  },
                  recovery_summary: {
                    category: "deferred_retry",
                    recovery_readiness: "waiting_retry_eligibility",
                    recovery_ready_at: "2026-04-06T11:30:00.000Z",
                    reason: "Retryable orchestration is deferred until 2026-04-06T11:30:00.000Z.",
                  },
                },
              },
              runtime_binding_readiness: {
                observation_status: "reported",
                report: {
                  status: "degraded",
                  scope: {
                    module: "editing",
                    manuscriptType: "review",
                    templateFamilyId: "template-family-1",
                  },
                  issues: [
                    {
                      code: "runtime_not_active",
                      message: "Runtime is not active.",
                    },
                    {
                      code: "binding_execution_profile_drift",
                      message: "Binding execution profile drift detected.",
                    },
                  ],
                  execution_profile_alignment: {
                    status: "drifted",
                    binding_execution_profile_id: "profile-editing",
                    active_execution_profile_id: "profile-editing-active",
                  },
                },
              },
            },
            settlement: {
              derived_status: "business_completed_follow_up_retryable",
              business_completed: true,
              orchestration_completed: false,
              attention_required: false,
              reason: "Business execution is complete and governed follow-up is retryable.",
            },
          },
        },
        latestExport: null,
        latestActionResult: null,
      } as never)}
    />,
  );

  assert.match(markup, /Recovery Posture/);
  assert.match(markup, /Waiting for retry window/);
  assert.match(markup, /Recovery Ready At/);
  assert.match(markup, /2026-04-06 11:30:00Z/);
  assert.match(markup, /Runtime Binding Readiness/);
  assert.match(markup, /Degraded \(2 issues\)/);
});

test("manuscript workbench summary incorporates recovery and readiness posture into module overview and read-only guidance details", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      {...({
        mode: "editing",
        accessibleHandoffModes: ["editing", "proofreading"],
        workspace: {
          manuscript: {
            id: "manuscript-posture-overview-1",
            title: "Respiratory editing posture",
            manuscript_type: "review",
            status: "processing",
            created_by: "operator-1",
            current_editing_asset_id: "asset-edited-1",
            created_at: "2026-04-06T09:00:00.000Z",
            updated_at: "2026-04-06T10:00:00.000Z",
            module_execution_overview: {
              screening: {
                module: "screening",
                observation_status: "reported",
                settlement: {
                  derived_status: "business_completed_settled",
                  business_completed: true,
                  orchestration_completed: true,
                  attention_required: false,
                  reason: "Screening is fully settled.",
                },
              },
              editing: {
                module: "editing",
                observation_status: "reported",
                latest_job: {
                  id: "job-editing-posture-2",
                  manuscript_id: "manuscript-posture-overview-1",
                  module: "editing",
                  job_type: "editing_run",
                  status: "completed",
                  requested_by: "operator-1",
                  attempt_count: 2,
                  created_at: "2026-04-06T09:40:00.000Z",
                  updated_at: "2026-04-06T09:45:00.000Z",
                },
                latest_snapshot: {
                  id: "snapshot-edit-posture-1",
                  manuscript_id: "manuscript-posture-overview-1",
                  module: "editing",
                  job_id: "job-editing-posture-2",
                  execution_profile_id: "profile-editing",
                  module_template_id: "template-editing",
                  module_template_version_no: 4,
                  prompt_template_id: "prompt-editing",
                  prompt_template_version: "2026-04-06",
                  skill_package_ids: ["editing-skill-pack"],
                  skill_package_versions: ["1.0.0"],
                  model_id: "model-editing",
                  knowledge_item_ids: ["knowledge-editing-1"],
                  created_asset_ids: ["asset-edited-1"],
                  created_at: "2026-04-06T09:45:00.000Z",
                  agent_execution: {
                    observation_status: "reported",
                    log_id: "agent-log-editing-posture-2",
                    log: {
                      id: "agent-log-editing-posture-2",
                      status: "completed",
                      orchestration_status: "retryable",
                      completion_summary: {
                        derived_status: "business_completed_follow_up_retryable",
                        business_completed: true,
                        follow_up_required: true,
                        fully_settled: false,
                        attention_required: false,
                      },
                      recovery_summary: {
                        category: "deferred_retry",
                        recovery_readiness: "waiting_retry_eligibility",
                        recovery_ready_at: "2026-04-06T11:30:00.000Z",
                        reason: "Retryable orchestration is deferred until 2026-04-06T11:30:00.000Z.",
                      },
                    },
                  },
                  runtime_binding_readiness: {
                    observation_status: "reported",
                    report: {
                      status: "missing",
                      scope: {
                        module: "editing",
                        manuscriptType: "review",
                        templateFamilyId: "template-family-1",
                      },
                      issues: [
                        {
                          code: "missing_active_binding",
                          message: "Missing active binding.",
                        },
                      ],
                      execution_profile_alignment: {
                        status: "missing_active_profile",
                        binding_execution_profile_id: "profile-editing",
                      },
                    },
                  },
                },
                settlement: {
                  derived_status: "business_completed_follow_up_retryable",
                  business_completed: true,
                  orchestration_completed: false,
                  attention_required: false,
                  reason: "Business execution is complete and governed follow-up is retryable.",
                },
              },
              proofreading: {
                module: "proofreading",
                observation_status: "not_started",
              },
            },
          },
          assets: [],
          currentAsset: null,
          suggestedParentAsset: null,
          latestProofreadingDraftAsset: null,
        },
        latestJob: {
          id: "job-editing-posture-2",
          module: "editing",
          job_type: "editing_run",
          status: "completed",
          requested_by: "operator-1",
          attempt_count: 2,
          created_at: "2026-04-06T09:40:00.000Z",
          updated_at: "2026-04-06T09:45:00.000Z",
        },
        latestExport: null,
        latestActionResult: null,
      } as never)}
    />,
  );

  assert.match(markup, /Editing Settlement/);
  assert.match(markup, /Waiting for retry window/);
  assert.match(markup, /ready at 2026-04-06 11:30:00Z/);
  assert.match(markup, /binding missing/);
  assert.match(markup, /Recovery Posture/);
  assert.match(markup, /Runtime Readiness/);
  assert.match(markup, /Missing \(1 issue\)/);
  assert.doesNotMatch(markup, /Open Proofreading Workbench/);
});
