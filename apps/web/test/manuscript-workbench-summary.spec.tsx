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

  assert.match(markup, /实时稿件台账/);
  assert.match(markup, /稿件总控台/);
  assert.match(markup, /单稿判断工作区/);
  assert.match(markup, /AI 识别稿件类型/);
  assert.match(markup, /稿件概览/);
  assert.match(markup, /最近操作结果/);
  assert.match(markup, /发起编辑执行/);
  assert.match(markup, /已生成资产 asset-edited-1/);
  assert.match(markup, /<span>资产<\/span><strong>asset-edited-1<\/strong>/);
  assert.match(markup, /<span>任务<\/span><strong>job-edit-1<\/strong>/);
  assert.match(markup, /前往校对工作台/);
  assert.match(markup, /href="#proofreading\?manuscriptId=manuscript-1"/);
  assert.match(markup, /Cardiology review/);
  assert.match(markup, /当前资产/);
  assert.match(markup, /editing-final\.docx \/ 编辑稿 \/ asset-edited-1/);
  assert.match(markup, /editing-final\.docx/);
  assert.match(markup, /最近任务/);
  assert.match(markup, /已完成/);
  assert.match(markup, /最近导出/);
  assert.match(markup, /exports\/manuscript-1\/current\.docx/);
  assert.match(markup, /下载最近导出/);
  assert.match(markup, /Word 文档（DOCX）/);
  assert.match(
    markup,
    /href="http:\/\/localhost\/api\/v1\/document-assets\/asset-edited-1\/download"/,
  );
  assert.match(markup, /资产链路/);
  assert.match(markup, /原稿/);
  assert.match(markup, /上传/);
  assert.match(markup, /已替代/);
  assert.match(markup, /asset-original-1/);
  assert.match(markup, /调试快照/);
});

test("manuscript workbench summary renders the settled result matrix and current export selection", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      mode="proofreading"
      accessibleHandoffModes={["proofreading"]}
      workspace={{
        manuscript: {
          id: "manuscript-matrix-1",
          title: "Result matrix manuscript",
          manuscript_type: "review",
          status: "completed",
          created_by: "proofreader-1",
          current_screening_asset_id: "asset-screening-1",
          current_editing_asset_id: "asset-edited-1",
          current_proofreading_asset_id: "asset-human-final-1",
          result_asset_matrix: {
            screening_report: {
              id: "asset-screening-1",
              manuscript_id: "manuscript-matrix-1",
              asset_type: "screening_report",
              status: "superseded",
              storage_key: "runs/matrix/screening.md",
              mime_type: "text/markdown",
              source_module: "screening",
              source_job_id: "job-screening-1",
              created_by: "screener-1",
              version_no: 1,
              is_current: true,
              file_name: "screening.md",
              created_at: "2026-04-09T08:00:00.000Z",
              updated_at: "2026-04-09T08:00:00.000Z",
            },
            edited_docx: {
              id: "asset-edited-1",
              manuscript_id: "manuscript-matrix-1",
              asset_type: "edited_docx",
              status: "superseded",
              storage_key: "runs/matrix/editing.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              parent_asset_id: "asset-screening-1",
              source_module: "editing",
              source_job_id: "job-editing-1",
              created_by: "editor-1",
              version_no: 2,
              is_current: true,
              file_name: "editing.docx",
              created_at: "2026-04-09T08:15:00.000Z",
              updated_at: "2026-04-09T08:15:00.000Z",
            },
            proofreading_draft_report: {
              id: "asset-proof-draft-1",
              manuscript_id: "manuscript-matrix-1",
              asset_type: "proofreading_draft_report",
              status: "superseded",
              storage_key: "runs/matrix/proof-draft.md",
              mime_type: "text/markdown",
              parent_asset_id: "asset-edited-1",
              source_module: "proofreading",
              source_job_id: "job-proof-draft-1",
              created_by: "proofreader-1",
              version_no: 3,
              is_current: true,
              file_name: "proof-draft.md",
              created_at: "2026-04-09T08:30:00.000Z",
              updated_at: "2026-04-09T08:30:00.000Z",
            },
            final_proof_output: {
              id: "asset-human-final-1",
              manuscript_id: "manuscript-matrix-1",
              asset_type: "human_final_docx",
              status: "active",
              storage_key: "runs/matrix/human-final.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              parent_asset_id: "asset-edited-1",
              source_module: "manual",
              source_job_id: "job-human-final-1",
              created_by: "proofreader-1",
              version_no: 4,
              is_current: true,
              file_name: "human-final.docx",
              created_at: "2026-04-09T08:45:00.000Z",
              updated_at: "2026-04-09T08:45:00.000Z",
            },
          },
          current_export_selection: {
            slot: "final_proof_output",
            label: "终校输出",
            reason: "已发布人工终稿，默认导出正式交付件。",
            asset: {
              id: "asset-human-final-1",
              manuscript_id: "manuscript-matrix-1",
              asset_type: "human_final_docx",
              status: "active",
              storage_key: "runs/matrix/human-final.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              parent_asset_id: "asset-edited-1",
              source_module: "manual",
              source_job_id: "job-human-final-1",
              created_by: "proofreader-1",
              version_no: 4,
              is_current: true,
              file_name: "human-final.docx",
              created_at: "2026-04-09T08:45:00.000Z",
              updated_at: "2026-04-09T08:45:00.000Z",
            },
          },
          created_at: "2026-04-09T08:00:00.000Z",
          updated_at: "2026-04-09T08:45:00.000Z",
        },
        assets: [],
        currentAsset: null,
        suggestedParentAsset: null,
        latestProofreadingDraftAsset: null,
      }}
      latestJob={null}
      latestExport={{
        manuscript_id: "manuscript-matrix-1",
        asset: {
          id: "asset-human-final-1",
          manuscript_id: "manuscript-matrix-1",
          asset_type: "human_final_docx",
          status: "active",
          storage_key: "runs/matrix/human-final.docx",
          mime_type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          parent_asset_id: "asset-edited-1",
          source_module: "manual",
          source_job_id: "job-human-final-1",
          created_by: "proofreader-1",
          version_no: 4,
          is_current: true,
          file_name: "human-final.docx",
          created_at: "2026-04-09T08:45:00.000Z",
          updated_at: "2026-04-09T08:45:00.000Z",
        },
        selection: {
          slot: "final_proof_output",
          label: "终校输出",
          reason: "已发布人工终稿，默认导出正式交付件。",
        },
        matrix: {
          screening_report: {
            id: "asset-screening-1",
            manuscript_id: "manuscript-matrix-1",
            asset_type: "screening_report",
            status: "superseded",
            storage_key: "runs/matrix/screening.md",
            mime_type: "text/markdown",
            source_module: "screening",
            source_job_id: "job-screening-1",
            created_by: "screener-1",
            version_no: 1,
            is_current: true,
            file_name: "screening.md",
            created_at: "2026-04-09T08:00:00.000Z",
            updated_at: "2026-04-09T08:00:00.000Z",
          },
          edited_docx: {
            id: "asset-edited-1",
            manuscript_id: "manuscript-matrix-1",
            asset_type: "edited_docx",
            status: "superseded",
            storage_key: "runs/matrix/editing.docx",
            mime_type:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            parent_asset_id: "asset-screening-1",
            source_module: "editing",
            source_job_id: "job-editing-1",
            created_by: "editor-1",
            version_no: 2,
            is_current: true,
            file_name: "editing.docx",
            created_at: "2026-04-09T08:15:00.000Z",
            updated_at: "2026-04-09T08:15:00.000Z",
          },
          proofreading_draft_report: {
            id: "asset-proof-draft-1",
            manuscript_id: "manuscript-matrix-1",
            asset_type: "proofreading_draft_report",
            status: "superseded",
            storage_key: "runs/matrix/proof-draft.md",
            mime_type: "text/markdown",
            parent_asset_id: "asset-edited-1",
            source_module: "proofreading",
            source_job_id: "job-proof-draft-1",
            created_by: "proofreader-1",
            version_no: 3,
            is_current: true,
            file_name: "proof-draft.md",
            created_at: "2026-04-09T08:30:00.000Z",
            updated_at: "2026-04-09T08:30:00.000Z",
          },
          final_proof_output: {
            id: "asset-human-final-1",
            manuscript_id: "manuscript-matrix-1",
            asset_type: "human_final_docx",
            status: "active",
            storage_key: "runs/matrix/human-final.docx",
            mime_type:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            parent_asset_id: "asset-edited-1",
            source_module: "manual",
            source_job_id: "job-human-final-1",
            created_by: "proofreader-1",
            version_no: 4,
            is_current: true,
            file_name: "human-final.docx",
            created_at: "2026-04-09T08:45:00.000Z",
            updated_at: "2026-04-09T08:45:00.000Z",
          },
        },
        download: {
          storage_key: "runs/matrix/human-final.docx",
          file_name: "human-final.docx",
          mime_type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          url: "/api/v1/document-assets/asset-human-final-1/download",
        },
      }}
      latestActionResult={null}
    />,
  );

  assert.match(markup, /结果矩阵/);
  assert.match(markup, /初筛报告/);
  assert.match(markup, /编辑稿/);
  assert.match(markup, /校对草稿报告/);
  assert.match(markup, /终校输出/);
  assert.match(markup, /human-final\.docx \/ 人工终稿 \/ asset-human-final-1/);
  assert.match(markup, /当前导出选择/);
  assert.match(markup, /已发布人工终稿，默认导出正式交付件。/);
});

test("manuscript workbench summary renders batch progress counts and restart posture for the latest batch job", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      mode="submission"
      workspace={{
        manuscript: {
          id: "manuscript-batch-1",
          title: "Batch Review A",
          manuscript_type: "review",
          status: "uploaded",
          created_by: "editor-1",
          created_at: "2026-04-09T09:00:00.000Z",
          updated_at: "2026-04-09T09:05:00.000Z",
        },
        assets: [],
        currentAsset: null,
        suggestedParentAsset: null,
        latestProofreadingDraftAsset: null,
      }}
      latestJob={{
        id: "job-batch-1",
        module: "upload",
        job_type: "manuscript_upload_batch",
        status: "cancelled",
        requested_by: "editor-1",
        attempt_count: 0,
        created_at: "2026-04-09T09:00:00.000Z",
        updated_at: "2026-04-09T09:05:00.000Z",
        batch_progress: {
          lifecycle_status: "cancelled",
          settlement_status: "partial_success",
          total_count: 3,
          queued_count: 0,
          running_count: 0,
          succeeded_count: 1,
          failed_count: 0,
          cancelled_count: 2,
          remaining_count: 0,
          restart_posture: {
            status: "resumed_after_restart",
            reason: "Resumed 1 running batch item(s) after server restart.",
            resumed_item_count: 1,
            observed_at: "2026-04-09T09:04:00.000Z",
          },
          items: [
            {
              item_id: "item-1",
              title: "Batch Review A",
              file_name: "batch-review-a.docx",
              manuscript_id: "manuscript-batch-1",
              upload_job_id: "job-upload-batch-1",
              status: "succeeded",
              attempt_count: 1,
              updated_at: "2026-04-09T09:02:00.000Z",
            },
            {
              item_id: "item-2",
              title: "Batch Review B",
              file_name: "batch-review-b.docx",
              manuscript_id: "manuscript-batch-2",
              upload_job_id: "job-upload-batch-2",
              status: "cancelled",
              attempt_count: 2,
              updated_at: "2026-04-09T09:05:00.000Z",
            },
            {
              item_id: "item-3",
              title: "Batch Review C",
              file_name: "batch-review-c.docx",
              manuscript_id: "manuscript-batch-3",
              upload_job_id: "job-upload-batch-3",
              status: "cancelled",
              attempt_count: 0,
              updated_at: "2026-04-09T09:05:00.000Z",
            },
          ],
        },
      }}
      latestExport={null}
      latestActionResult={null}
    />,
  );

  assert.match(markup, /批次进度/u);
  assert.match(markup, /Partial success/i);
  assert.match(markup, /Succeeded/i);
  assert.match(markup, /Failed/i);
  assert.match(markup, /Running/i);
  assert.match(markup, /Remaining/i);
  assert.match(markup, /Restart posture/i);
  assert.match(markup, /Resumed 1 running batch item\(s\) after server restart\./);
  assert.match(markup, /batch-review-b\.docx/);
  assert.match(markup, /cancelled/i);
});

test("manuscript workbench summary shows the resolved base family and journal template context", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      mode="editing"
      workspace={{
        manuscript: {
          id: "manuscript-template-1",
          title: "Journal scoped manuscript",
          manuscript_type: "clinical_study",
          status: "processing",
          created_by: "editor-1",
          current_template_family_id: "family-1",
          current_journal_template_id: "journal-template-1",
          created_at: "2026-04-07T09:00:00.000Z",
          updated_at: "2026-04-07T09:30:00.000Z",
        },
        assets: [],
        currentAsset: null,
        suggestedParentAsset: null,
        latestProofreadingDraftAsset: null,
        templateFamily: {
          id: "family-1",
          manuscript_type: "clinical_study",
          name: "Clinical Study Family",
          status: "active",
        },
        journalTemplateProfiles: [
          {
            id: "journal-template-1",
            template_family_id: "family-1",
            journal_key: "zxyjhzz",
            journal_name: "《中西医结合杂志》",
            status: "active",
          },
        ],
        selectedJournalTemplateProfile: {
          id: "journal-template-1",
          template_family_id: "family-1",
          journal_key: "zxyjhzz",
          journal_name: "《中西医结合杂志》",
          status: "active",
        },
      }}
      latestJob={null}
      latestExport={null}
      latestActionResult={null}
    />,
  );

  assert.match(markup, /基础模板族/);
  assert.match(markup, /Clinical Study Family/);
  assert.match(markup, /期刊模板/);
  assert.match(markup, /《中西医结合杂志》/);
  assert.match(markup, /期刊覆写/);
  assert.match(markup, /已启用/);
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

  assert.match(markup, /前往评估工作台/);
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

  assert.match(markup, /前往校对工作台/);
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

  assert.match(markup, /前往校对工作台/);
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

  assert.match(markup, /前往评估工作台/);
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

  assert.match(markup, /前往评估工作台/);
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

  assert.match(markup, /建议下一步/);
  assert.match(markup, /在推荐父资产上发起初筛/);
  assert.match(markup, /在进入编辑前，请先完成初筛工作台执行。/);
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

  assert.match(markup, /完成已审校对草稿定稿/);
  assert.match(markup, /生成校对终稿前仍需人工确认。/);
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

  assert.match(markup, /将该稿件移交学习审核/);
  assert.match(
    markup,
    /人工终稿已就绪，可进入学习快照治理流程。/,
  );
  assert.match(markup, /前往学习审核/);
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

  assert.match(markup, /推进稿件进入编辑/);
  assert.match(markup, /前往编辑工作台/);
  assert.match(markup, /初筛结算/);
  assert.match(markup, /已结算 · 最近任务失败 · 快照 snapshot-screen-1/);
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

  assert.match(markup, /校对交接前请检查编辑后续处理/);
  assert.match(markup, /业务已完成，后续可重试 · 最近任务已完成 · 快照 snapshot-edit-1/);
  assert.doesNotMatch(markup, /前往校对工作台/);
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

  assert.match(markup, /推进稿件进入校对/);
  assert.match(markup, /编辑结算/);
  assert.match(markup, /观测不可用（failed open）/);
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

  assert.match(markup, /校对交接前请检查编辑后续处理/);
  assert.match(markup, /结算状态/);
  assert.match(markup, /业务已完成，后续可重试/);
  assert.match(markup, /恢复态势/);
  assert.match(markup, /当前可恢复/);
  assert.match(markup, /运行时就绪度/);
  assert.match(markup, /已降级（1 项问题）/);
  assert.doesNotMatch(markup, /前往校对工作台/);
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

  assert.match(markup, /推进稿件进入编辑/);
  assert.match(markup, /前往编辑工作台/);
  assert.match(markup, /结算状态/);
  assert.match(markup, /已结算/);
  assert.match(markup, /恢复态势/);
  assert.match(markup, /无需恢复/);
  assert.match(markup, /运行时就绪度/);
  assert.match(markup, /就绪/);
});

test("manuscript workbench summary falls back to latest job posture inside module overview when overview is failed open", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      {...({
        mode: "editing",
        accessibleHandoffModes: ["editing", "proofreading"],
        workspace: {
          manuscript: {
            id: "manuscript-editing-overview-fallback-1",
            title: "Editing overview fallback manuscript",
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
                  reason: "Screening is settled.",
                },
              },
              editing: {
                module: "editing",
                observation_status: "failed_open",
                error: "Overview observation failed open.",
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
          id: "job-editing-overview-fallback-1",
          manuscript_id: "manuscript-editing-overview-fallback-1",
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
              id: "snapshot-editing-overview-fallback-1",
              manuscript_id: "manuscript-editing-overview-fallback-1",
              module: "editing",
              job_id: "job-editing-overview-fallback-1",
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
                log_id: "agent-log-editing-overview-fallback-1",
                log: {
                  id: "agent-log-editing-overview-fallback-1",
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

  assert.match(markup, /编辑结算/);
  assert.match(markup, /业务已完成，后续可重试/);
  assert.match(markup, /当前可恢复/);
  assert.match(markup, /绑定已降级/);
  assert.match(markup, /最近追踪任务/);
  assert.doesNotMatch(markup, /观测不可用（failed open）/);
});

test("manuscript workbench summary keeps overview module metrics visible and uses latest job fallback when manuscript overview is missing", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      {...({
        mode: "screening",
        accessibleHandoffModes: ["screening", "editing"],
        workspace: {
          manuscript: {
            id: "manuscript-overview-missing-1",
            title: "Overview missing fallback manuscript",
            manuscript_type: "review",
            status: "processing",
            created_by: "operator-1",
            current_screening_asset_id: "asset-screen-1",
            created_at: "2026-04-06T09:00:00.000Z",
            updated_at: "2026-04-06T10:00:00.000Z",
          },
          assets: [],
          currentAsset: null,
          suggestedParentAsset: null,
          latestProofreadingDraftAsset: null,
        },
        latestJob: {
          id: "job-screening-overview-fallback-1",
          manuscript_id: "manuscript-overview-missing-1",
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
              id: "snapshot-screening-overview-fallback-1",
              manuscript_id: "manuscript-overview-missing-1",
              module: "screening",
              job_id: "job-screening-overview-fallback-1",
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
                log_id: "agent-log-screening-overview-fallback-1",
                log: {
                  id: "agent-log-screening-overview-fallback-1",
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

  assert.match(markup, /初筛结算/);
  assert.match(markup, /已结算/);
  assert.match(markup, /无需恢复/);
  assert.match(markup, /快照 snapshot-screening-overview-fallback-1/);
  assert.match(markup, /最近追踪任务/);
  assert.match(markup, /编辑结算/);
  assert.match(markup, /校对结算/);
  assert.match(markup, /未上报/);
});

test("manuscript workbench summary reuses matching overview posture in the Latest Job card when the latest job is a raw fallback candidate", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      {...({
        mode: "editing",
        accessibleHandoffModes: ["editing", "proofreading"],
        workspace: {
          manuscript: {
            id: "manuscript-latest-job-overview-fallback-1",
            title: "Latest job overview fallback manuscript",
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
                  reason: "Screening is settled.",
                },
              },
              editing: {
                module: "editing",
                observation_status: "reported",
                latest_job: {
                  id: "job-editing-overview-card-1",
                  manuscript_id: "manuscript-latest-job-overview-fallback-1",
                  module: "editing",
                  job_type: "editing_run",
                  status: "completed",
                  requested_by: "operator-1",
                  attempt_count: 2,
                  created_at: "2026-04-06T09:40:00.000Z",
                  updated_at: "2026-04-06T09:45:00.000Z",
                },
                latest_snapshot: {
                  id: "snapshot-editing-overview-card-1",
                  manuscript_id: "manuscript-latest-job-overview-fallback-1",
                  module: "editing",
                  job_id: "job-editing-overview-card-1",
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
                    log_id: "agent-log-editing-overview-card-1",
                    log: {
                      id: "agent-log-editing-overview-card-1",
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
          id: "job-editing-overview-card-1",
          manuscript_id: "manuscript-latest-job-overview-fallback-1",
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

  assert.match(markup, /最近任务/);
  assert.match(markup, /执行结算/);
  assert.match(markup, /业务已完成，后续可重试/);
  assert.match(markup, /恢复态势/);
  assert.match(markup, /当前可恢复/);
  assert.match(markup, /运行时绑定就绪度/);
  assert.match(markup, /已降级（1 项问题）/);
  assert.match(markup, /执行快照/);
  assert.match(markup, /snapshot-editing-overview-card-1/);
});

test("manuscript workbench summary reuses settled overview posture in the Latest Job card when the raw latest job matches screening overview", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      {...({
        mode: "screening",
        accessibleHandoffModes: ["screening", "editing"],
        workspace: {
          manuscript: {
            id: "manuscript-latest-job-screening-overview-1",
            title: "Latest job screening overview fallback manuscript",
            manuscript_type: "review",
            status: "processing",
            created_by: "operator-1",
            current_screening_asset_id: "asset-screen-1",
            created_at: "2026-04-06T09:00:00.000Z",
            updated_at: "2026-04-06T10:00:00.000Z",
            module_execution_overview: {
              screening: {
                module: "screening",
                observation_status: "reported",
                latest_job: {
                  id: "job-screening-overview-card-1",
                  manuscript_id: "manuscript-latest-job-screening-overview-1",
                  module: "screening",
                  job_type: "screening_run",
                  status: "completed",
                  requested_by: "operator-1",
                  attempt_count: 1,
                  created_at: "2026-04-06T09:40:00.000Z",
                  updated_at: "2026-04-06T09:45:00.000Z",
                },
                latest_snapshot: {
                  id: "snapshot-screening-overview-card-1",
                  manuscript_id: "manuscript-latest-job-screening-overview-1",
                  module: "screening",
                  job_id: "job-screening-overview-card-1",
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
                    log_id: "agent-log-screening-overview-card-1",
                    log: {
                      id: "agent-log-screening-overview-card-1",
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
          id: "job-screening-overview-card-1",
          manuscript_id: "manuscript-latest-job-screening-overview-1",
          module: "screening",
          job_type: "screening_run",
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

  assert.match(markup, /最近任务/);
  assert.match(markup, /执行结算/);
  assert.match(markup, /已结算/);
  assert.match(markup, /恢复态势/);
  assert.match(markup, /无需恢复/);
  assert.match(markup, /运行时绑定就绪度/);
  assert.match(markup, /就绪/);
  assert.match(markup, /执行快照/);
  assert.match(markup, /snapshot-screening-overview-card-1/);
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

  assert.match(markup, /最近任务/);
  assert.match(markup, /状态/);
  assert.match(markup, /执行结算/);
  assert.match(markup, /业务已完成，后续待处理/);
  assert.match(markup, /执行快照/);
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

  assert.match(markup, /恢复态势/);
  assert.match(markup, /等待重试窗口/);
  assert.match(markup, /恢复可用时间/);
  assert.match(markup, /2026-04-06 11:30:00Z/);
  assert.match(markup, /运行时绑定就绪度/);
  assert.match(markup, /已降级（2 项问题）/);
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

  assert.match(markup, /编辑结算/);
  assert.match(markup, /等待重试窗口/);
  assert.match(markup, /恢复时间 2026-04-06 11:30:00Z/);
  assert.match(markup, /绑定缺失/);
  assert.match(markup, /恢复态势/);
  assert.match(markup, /运行时就绪度/);
  assert.match(markup, /缺失（1 项问题）/);
  assert.doesNotMatch(markup, /前往校对工作台/);
});

test("manuscript workbench summary renders read-only review evidence for the latest proofreading job", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      {...({
        mode: "proofreading",
        accessibleHandoffModes: ["proofreading"],
        workspace: {
          manuscript: {
            id: "manuscript-review-evidence-1",
            title: "Proofreading review evidence manuscript",
            manuscript_type: "clinical_study",
            status: "awaiting_review",
            created_by: "proofreader-1",
            current_proofreading_asset_id: "asset-proof-draft-evidence-1",
            created_at: "2026-04-09T09:00:00.000Z",
            updated_at: "2026-04-09T10:00:00.000Z",
          },
          assets: [
            {
              id: "asset-proof-draft-evidence-1",
              manuscript_id: "manuscript-review-evidence-1",
              asset_type: "proofreading_draft_report",
              status: "active",
              storage_key: "runs/proofreading/evidence.md",
              mime_type: "text/markdown",
              parent_asset_id: "asset-edit-1",
              source_module: "proofreading",
              source_job_id: "job-proof-evidence-1",
              created_by: "proofreader-1",
              version_no: 3,
              is_current: true,
              file_name: "proofreading-evidence.md",
              created_at: "2026-04-09T09:45:00.000Z",
              updated_at: "2026-04-09T09:45:00.000Z",
            },
          ],
          currentAsset: {
            id: "asset-proof-draft-evidence-1",
            manuscript_id: "manuscript-review-evidence-1",
            asset_type: "proofreading_draft_report",
            status: "active",
            storage_key: "runs/proofreading/evidence.md",
            mime_type: "text/markdown",
            parent_asset_id: "asset-edit-1",
            source_module: "proofreading",
            source_job_id: "job-proof-evidence-1",
            created_by: "proofreader-1",
            version_no: 3,
            is_current: true,
            file_name: "proofreading-evidence.md",
            created_at: "2026-04-09T09:45:00.000Z",
            updated_at: "2026-04-09T09:45:00.000Z",
          },
          suggestedParentAsset: null,
          latestProofreadingDraftAsset: {
            id: "asset-proof-draft-evidence-1",
            manuscript_id: "manuscript-review-evidence-1",
            asset_type: "proofreading_draft_report",
            status: "active",
            storage_key: "runs/proofreading/evidence.md",
            mime_type: "text/markdown",
            parent_asset_id: "asset-edit-1",
            source_module: "proofreading",
            source_job_id: "job-proof-evidence-1",
            created_by: "proofreader-1",
            version_no: 3,
            is_current: true,
            file_name: "proofreading-evidence.md",
            created_at: "2026-04-09T09:45:00.000Z",
            updated_at: "2026-04-09T09:45:00.000Z",
          },
        },
        latestJob: {
          id: "job-proof-evidence-1",
          manuscript_id: "manuscript-review-evidence-1",
          module: "proofreading",
          job_type: "proofreading_draft_run",
          status: "completed",
          requested_by: "proofreader-1",
          attempt_count: 1,
          created_at: "2026-04-09T09:40:00.000Z",
          updated_at: "2026-04-09T09:45:00.000Z",
          payload: {
            proofreadingFindings: {
              failedChecks: [
                {
                  ruleId: "rule-table-header",
                  expected: "Treatment group",
                  actual: "Treatmnt group",
                },
                {
                  ruleId: "rule-abbreviation",
                  expected: "统一缩写",
                  actual: "缩写未说明",
                },
              ],
              manualReviewItems: [
                {
                  ruleId: "rule-abbreviation",
                  reason: "术语缩写需要人工确认。",
                },
                {
                  ruleId: "rule-table-header",
                  reason: "表头格式需要人工复核。",
                },
              ],
            },
          },
          execution_tracking: {
            observation_status: "reported",
            settlement: {
              derived_status: "business_completed_follow_up_pending",
              business_completed: true,
              orchestration_completed: false,
              attention_required: false,
              reason: "Proofreading findings require manual review before final output.",
            },
            snapshot: {
              id: "snapshot-proof-evidence-1",
              manuscript_id: "manuscript-review-evidence-1",
              module: "proofreading",
              job_id: "job-proof-evidence-1",
              execution_profile_id: "profile-proofreading",
              module_template_id: "template-proofreading",
              module_template_version_no: 2,
              prompt_template_id: "prompt-proofreading",
              prompt_template_version: "2026-04-08",
              skill_package_ids: ["proofreading-skill-pack"],
              skill_package_versions: ["1.1.0"],
              model_id: "model-proofreading-1",
              model_version: "2026-04-07",
              knowledge_item_ids: [
                "knowledge-proofreading-1",
                "knowledge-proofreading-2",
              ],
              created_asset_ids: ["asset-proof-draft-evidence-1"],
              created_at: "2026-04-09T09:45:00.000Z",
              agent_execution: {
                observation_status: "reported",
                log_id: "agent-log-proof-evidence-1",
                log: {
                  id: "agent-log-proof-evidence-1",
                  status: "completed",
                  orchestration_status: "pending",
                  completion_summary: {
                    derived_status: "business_completed_follow_up_pending",
                    business_completed: true,
                    follow_up_required: true,
                    fully_settled: false,
                    attention_required: false,
                  },
                  recovery_summary: {
                    category: "recoverable_now",
                    recovery_readiness: "ready_now",
                    reason: "Manual review is still pending.",
                  },
                },
              },
              runtime_binding_readiness: {
                observation_status: "reported",
                report: {
                  status: "ready",
                  scope: {
                    module: "proofreading",
                    manuscriptType: "clinical_study",
                    templateFamilyId: "template-family-proofreading",
                  },
                  issues: [],
                  execution_profile_alignment: {
                    status: "aligned",
                    binding_execution_profile_id: "profile-proofreading",
                    active_execution_profile_id: "profile-proofreading",
                  },
                },
              },
            },
          },
        },
        latestExport: null,
        latestActionResult: null,
      } as never)}
    />,
  );

  assert.match(markup, /审核证据/);
  assert.match(markup, /人工复核/);
  assert.match(markup, /需要人工复核（2 项）/);
  assert.match(markup, /规则命中/);
  assert.match(markup, /rule-table-header/);
  assert.match(markup, /rule-abbreviation/);
  assert.match(markup, /知识引用/);
  assert.match(markup, /knowledge-proofreading-1/);
  assert.match(markup, /knowledge-proofreading-2/);
  assert.match(markup, /模型版本/);
  assert.match(markup, /model-proofreading-1 \/ 2026-04-07/);
  assert.match(markup, /原因摘要/);
  assert.match(markup, /术语缩写需要人工确认。/);
  assert.match(markup, /表头格式需要人工复核。/);
});
