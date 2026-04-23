import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ManuscriptWorkbenchWorkspace } from "../src/features/manuscript-workbench/manuscript-workbench-controller.ts";
import {
  buildJobBatchProgressDetails,
  buildJobReviewEvidenceDetails,
  buildManuscriptMainlineReadinessDetails,
  ManuscriptWorkbenchSummary,
} from "../src/features/manuscript-workbench/manuscript-workbench-summary.tsx";

function createEditingWorkspace(): ManuscriptWorkbenchWorkspace {
  const editedAsset = {
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
  };

  return {
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
      editedAsset,
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
    currentAsset: editedAsset,
    currentManuscriptAsset: editedAsset,
    suggestedParentAsset: editedAsset,
    latestProofreadingDraftAsset: null,
  } as unknown as ManuscriptWorkbenchWorkspace;
}

function createScreeningWorkspace(): ManuscriptWorkbenchWorkspace {
  const reportAsset = {
    id: "asset-screening-report-1",
    manuscript_id: "manuscript-2",
    asset_type: "screening_report",
    status: "active",
    storage_key: "runs/screening/report.md",
    mime_type: "text/markdown",
    parent_asset_id: "asset-original-2",
    source_module: "screening",
    source_job_id: "job-screen-1",
    created_by: "editor-1",
    version_no: 2,
    is_current: true,
    file_name: "screening-report.md",
    created_at: "2026-04-15T09:10:00.000Z",
    updated_at: "2026-04-15T09:10:00.000Z",
  };
  const originalAsset = {
    id: "asset-original-2",
    manuscript_id: "manuscript-2",
    asset_type: "original",
    status: "active",
    storage_key: "uploads/screening-review.docx",
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    source_module: "upload",
    created_by: "editor-1",
    version_no: 1,
    is_current: true,
    file_name: "screening-review.docx",
    created_at: "2026-04-15T09:00:00.000Z",
    updated_at: "2026-04-15T09:00:00.000Z",
  };

  return {
    manuscript: {
      id: "manuscript-2",
      title: "Screening review",
      manuscript_type: "review",
      status: "processing",
      created_by: "editor-1",
      current_screening_asset_id: "asset-screening-report-1",
      created_at: "2026-04-15T09:00:00.000Z",
      updated_at: "2026-04-15T09:10:00.000Z",
    },
    assets: [reportAsset, originalAsset],
    currentAsset: reportAsset,
    currentManuscriptAsset: originalAsset,
    suggestedParentAsset: originalAsset,
    latestProofreadingDraftAsset: null,
  } as unknown as ManuscriptWorkbenchWorkspace;
}

function createRecoveryWorkspace(): ManuscriptWorkbenchWorkspace {
  const humanFinalAsset = {
    id: "asset-human-final-1",
    manuscript_id: "manuscript-recovery-1",
    asset_type: "human_final_docx",
    status: "active",
    storage_key: "runs/proofreading/human-final.docx",
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    parent_asset_id: "asset-proof-final-1",
    source_module: "manual",
    created_by: "proofreader-1",
    version_no: 1,
    is_current: true,
    file_name: "human-final.docx",
    created_at: "2026-04-15T10:10:00.000Z",
    updated_at: "2026-04-15T10:10:00.000Z",
  };

  return {
    manuscript: {
      id: "manuscript-recovery-1",
      title: "Recovery candidate",
      manuscript_type: "clinical_study",
      status: "completed",
      created_by: "proofreader-1",
      current_proofreading_asset_id: "asset-human-final-1",
      created_at: "2026-04-15T09:00:00.000Z",
      updated_at: "2026-04-15T10:10:00.000Z",
    },
    assets: [humanFinalAsset],
    currentAsset: humanFinalAsset,
    currentManuscriptAsset: humanFinalAsset,
    suggestedParentAsset: humanFinalAsset,
    latestProofreadingDraftAsset: null,
  } as unknown as ManuscriptWorkbenchWorkspace;
}

function createProofreadingWorkspace(): ManuscriptWorkbenchWorkspace {
  const editedAsset = {
    id: "asset-edited-proof-1",
    manuscript_id: "manuscript-proof-1",
    asset_type: "edited_docx",
    status: "active",
    storage_key: "runs/editing/edited-proof.docx",
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    parent_asset_id: "asset-original-proof-1",
    source_module: "editing",
    source_job_id: "job-edit-proof-1",
    created_by: "editor-1",
    version_no: 2,
    is_current: true,
    file_name: "editing-proof.docx",
    created_at: "2026-04-20T09:00:00.000Z",
    updated_at: "2026-04-20T09:20:00.000Z",
  };
  const draftReportAsset = {
    id: "asset-proof-draft-1",
    manuscript_id: "manuscript-proof-1",
    asset_type: "proofreading_draft_report",
    status: "active",
    storage_key: "runs/proofreading/draft-report.md",
    mime_type: "text/markdown",
    parent_asset_id: "asset-edited-proof-1",
    source_module: "proofreading",
    source_job_id: "job-proof-draft-1",
    created_by: "proofreader-1",
    version_no: 3,
    is_current: false,
    file_name: "proofreading-draft-report.md",
    created_at: "2026-04-20T09:30:00.000Z",
    updated_at: "2026-04-20T09:31:00.000Z",
  };
  const annotatedAsset = {
    id: "asset-proof-annotated-1",
    manuscript_id: "manuscript-proof-1",
    asset_type: "final_proof_annotated_docx",
    status: "active",
    storage_key: "runs/proofreading/annotated.docx",
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    parent_asset_id: "asset-proof-draft-1",
    source_module: "proofreading",
    source_job_id: "job-proof-final-1",
    created_by: "proofreader-1",
    version_no: 4,
    is_current: true,
    file_name: "proofreading-annotated.docx",
    created_at: "2026-04-20T09:35:00.000Z",
    updated_at: "2026-04-20T09:40:00.000Z",
  };
  const originalAsset = {
    id: "asset-original-proof-1",
    manuscript_id: "manuscript-proof-1",
    asset_type: "original",
    status: "superseded",
    storage_key: "uploads/proofreading/original.docx",
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    source_module: "upload",
    created_by: "editor-1",
    version_no: 1,
    is_current: false,
    file_name: "proofreading-original.docx",
    created_at: "2026-04-20T08:50:00.000Z",
    updated_at: "2026-04-20T08:50:00.000Z",
  };

  return {
    manuscript: {
      id: "manuscript-proof-1",
      title: "Proofreading candidate",
      manuscript_type: "clinical_study",
      status: "processing",
      created_by: "proofreader-1",
      current_proofreading_asset_id: "asset-proof-annotated-1",
      created_at: "2026-04-20T08:50:00.000Z",
      updated_at: "2026-04-20T09:40:00.000Z",
      result_asset_matrix: {
        edited_docx: editedAsset,
        proofreading_draft_report: draftReportAsset,
        final_proof_output: annotatedAsset,
      },
    },
    assets: [annotatedAsset, draftReportAsset, editedAsset, originalAsset],
    currentAsset: annotatedAsset,
    currentManuscriptAsset: editedAsset,
    suggestedParentAsset: editedAsset,
    latestProofreadingDraftAsset: draftReportAsset,
  } as unknown as ManuscriptWorkbenchWorkspace;
}

test("summary keeps compact cards and omits the oversized top summary strip", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      mode="editing"
      accessibleHandoffModes={["proofreading"]}
      workspace={createEditingWorkspace()}
      latestJob={
        {
          id: "job-edit-1",
          module: "editing",
          job_type: "editing_run",
          status: "completed",
          requested_by: "editor-1",
          attempt_count: 1,
          created_at: "2026-03-31T09:45:00.000Z",
          updated_at: "2026-03-31T09:46:00.000Z",
        } as never
      }
      latestExport={
        {
          manuscript_id: "manuscript-1",
          asset: createEditingWorkspace().currentAsset,
          download: {
            storage_key: "exports/manuscript-1/current.docx",
            file_name: "editing-final.docx",
            mime_type:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            url: "/api/v1/document-assets/asset-edited-1/download",
          },
        } as never
      }
      latestActionResult={{
        tone: "success",
        actionLabel: "Run Editing",
        message: "Created asset asset-edited-1",
        details: [
          { label: "Asset", value: "asset-edited-1" },
          { label: "Job", value: "job-edit-1" },
        ],
      }}
    />,
  );

  assert.match(markup, /data-summary-layout="compact-manuscript-summary"/);
  assert.doesNotMatch(markup, /manuscript-workbench-summary-strip/);
  assert.match(markup, /\u6700\u8fd1\u64cd\u4f5c\u7ed3\u679c/u);
  assert.match(markup, /\u5efa\u8bae\u4e0b\u4e00\u6b65/u);
  assert.match(markup, /\u7a3f\u4ef6\u6982\u89c8/u);
  assert.match(markup, /\u6700\u8fd1\u4efb\u52a1/u);
  assert.match(markup, /\u6700\u8fd1\u5bfc\u51fa/u);
  assert.match(markup, /\u8d44\u4ea7\u94fe\u8def/u);
  assert.match(markup, /Cardiology review/);
  assert.match(markup, /href="#proofreading\?manuscriptId=manuscript-1"/);
  assert.doesNotMatch(markup, /\u7a3f\u4ef6\u7f16\u53f7/u);
  assert.doesNotMatch(markup, /\u8c03\u8bd5\u5feb\u7167/u);
});

test("summary keeps the quality recovery handoff operator-facing while linking to the review workspace", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      mode="proofreading"
      accessibleHandoffModes={[]}
      canOpenLearningReview
      workspace={createRecoveryWorkspace()}
      latestJob={null}
      latestExport={null}
      latestActionResult={null}
    />,
  );

  assert.match(markup, /\u524d\u5f80\u540e\u7eed\u5ba1\u6838/u);
  assert.match(
    markup,
    /\u5f53\u524d\u9636\u6bb5\uff1a\u5ba1\u6838\u3002\u4e0b\u4e00\u6b65\uff1a\u524d\u5f80\u540e\u7eed\u5ba1\u6838\u5b8c\u6210\u786e\u8ba4\uff0c\u5e76\u7ee7\u7eed\u5904\u7406\u5019\u9009\u9879\u3002/u,
  );
  assert.match(markup, /#template-governance\?[^"]*templateGovernanceView=rule-ledger/u);
  assert.match(markup, /ruleCenterMode=learning/u);
  assert.match(markup, /manuscriptId=manuscript-recovery-1/u);
  assert.doesNotMatch(markup, /\u89c4\u5219\u4e2d\u5fc3/u);
  assert.doesNotMatch(markup, /\u524d\u5f80\u56de\u6d41\u5de5\u4f5c\u533a/u);
  assert.doesNotMatch(markup, /#learning-review/u);
});

test("summary still exposes current asset and export metadata after the top strip is removed", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      mode="editing"
      workspace={createEditingWorkspace()}
      latestJob={null}
      latestExport={
        {
          manuscript_id: "manuscript-1",
          asset: createEditingWorkspace().currentAsset,
          download: {
            storage_key: "exports/manuscript-1/current.docx",
            file_name: "editing-final.docx",
            mime_type:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            url: "/api/v1/document-assets/asset-edited-1/download",
          },
        } as never
      }
      latestActionResult={null}
    />,
  );

  assert.match(markup, /\u5f53\u524d\u8d44\u4ea7/u);
  assert.match(markup, /Cardiology review - \u7f16\u8f91\u7a3f/u);
  assert.match(markup, /\u67e5\u770b\u5f53\u524d\u7a3f\u4ef6/u);
  assert.match(markup, /\u4e0b\u8f7d\u5f53\u524d\u7a3f\u4ef6/u);
  assert.match(
    markup,
    /href="#editing\?manuscriptId=manuscript-1&amp;assetId=asset-edited-1"/,
  );
  assert.match(
    markup,
    /href="http:\/\/localhost\/api\/v1\/document-assets\/asset-edited-1\/download"/,
  );
  assert.doesNotMatch(markup, /<code>asset-edited-1<\/code>/u);
  assert.doesNotMatch(markup, /\u5b58\u50a8\u952e/u);
  assert.doesNotMatch(markup, /\u8c03\u8bd5\u5feb\u7167/u);
});

test("summary separates current manuscript shortcuts from report-style current results", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      mode="screening"
      workspace={createScreeningWorkspace()}
      latestJob={null}
      latestExport={null}
      latestActionResult={null}
    />,
  );

  assert.match(markup, /\u67e5\u770b\u5f53\u524d\u7a3f\u4ef6/u);
  assert.match(markup, /\u4e0b\u8f7d\u5f53\u524d\u7a3f\u4ef6/u);
  assert.match(markup, /\u67e5\u770b\u5f53\u524d\u7ed3\u679c/u);
  assert.match(markup, /\u4e0b\u8f7d\u521d\u7b5b\u62a5\u544a/u);
  assert.match(
    markup,
    /href="#screening\?manuscriptId=manuscript-2&amp;assetId=asset-original-2"/,
  );
  assert.match(
    markup,
    /href="#screening\?manuscriptId=manuscript-2&amp;assetId=asset-screening-report-1"/,
  );
  assert.match(
    markup,
    /href="http:\/\/localhost\/api\/v1\/document-assets\/asset-original-2\/download"/,
  );
  assert.match(
    markup,
    /href="http:\/\/localhost\/api\/v1\/document-assets\/asset-screening-report-1\/download"/,
  );
});

test("summary makes proofreading draft reports and annotated confirmation manuscripts semantically distinct", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      mode="proofreading"
      workspace={createProofreadingWorkspace()}
      latestJob={null}
      latestExport={null}
      latestActionResult={null}
    />,
  );

  assert.match(markup, /查看当前结果/u);
  assert.match(markup, /下载校对批注稿/u);
  assert.match(markup, /校对批注稿/u);
  assert.match(markup, /校对草稿报告/u);
  assert.doesNotMatch(markup, /校对终稿/u);
});

test("summary consolidates governed execution evidence into a single current-module trust layer", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      mode="editing"
      workspace={createEditingWorkspace()}
      latestJob={
        {
          id: "job-edit-2",
          module: "editing",
          job_type: "editing_run",
          status: "completed",
          requested_by: "editor-1",
          attempt_count: 1,
          payload: {
            executionMode: "governed",
          },
          created_at: "2026-03-31T09:45:00.000Z",
          updated_at: "2026-03-31T09:46:00.000Z",
        } as never
      }
      latestExport={null}
      latestActionResult={null}
      executionContext={{
        mode: "editing",
        executionProfileId: "execution-profile-editing-1",
        retrievalPresetId: "retrieval-preset-editing-1",
        runtimeBindingId: "runtime-binding-editing-1",
        modelRoutingPolicyVersionId: "routing-policy-editing-1",
        resolvedModelId: "model-editing-1",
        modelSource: "template_family_policy",
        providerReadinessStatus: "ok",
        runtimeBindingReadinessStatus: "ready",
      }}
    />,
  );

  assert.match(markup, /AI 处理准备/u);
  assert.match(markup, /当前方式/u);
  assert.match(markup, /受控处理/u);
  assert.match(markup, /当前模板/u);
  assert.match(markup, /已按当前模板装载/u);
  assert.match(markup, /AI 状态/u);
  assert.match(markup, /已就绪/u);
  assert.doesNotMatch(markup, /治理执行/u);
  assert.doesNotMatch(markup, /受治理执行/u);
  assert.doesNotMatch(markup, /解析模型|路由策略|执行画像|检索预设|运行时绑定|服务商就绪/u);
  assert.doesNotMatch(
    markup,
    /model-editing-1|routing-policy-editing-1|execution-profile-editing-1|retrieval-preset-editing-1|runtime-binding-editing-1/u,
  );
});

test("summary keeps execution preparation operator-facing even when the latest run had different internal identifiers", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      mode="proofreading"
      workspace={createProofreadingWorkspace()}
      latestJob={
        {
          id: "job-human-final-actual-1",
          module: "manual",
          job_type: "publish_human_final",
          status: "completed",
          requested_by: "proofreader-1",
          attempt_count: 1,
          payload: {
            executionMode: "governed",
            sourceSnapshotId: "snapshot-proofreading-run-actual-1",
            executionProfileId: "execution-profile-proofreading-run-actual-1",
            retrievalPresetId: "retrieval-preset-proofreading-run-actual-1",
            runtimeBindingId: "runtime-binding-proofreading-run-actual-1",
            routingPolicyVersionId: "routing-policy-proofreading-run-actual-1",
            modelId: "model-proofreading-run-actual-1",
            modelSource: "module_policy",
          },
          created_at: "2026-04-20T10:00:00.000Z",
          updated_at: "2026-04-20T10:01:00.000Z",
        } as never
      }
      latestExport={null}
      latestActionResult={null}
      executionContext={{
        mode: "proofreading",
        executionProfileId: "execution-profile-proofreading-current-2",
        retrievalPresetId: "retrieval-preset-proofreading-current-2",
        runtimeBindingId: "runtime-binding-proofreading-current-2",
        modelRoutingPolicyVersionId: "routing-policy-proofreading-current-2",
        resolvedModelId: "model-proofreading-current-2",
        modelSource: "template_family_policy",
        providerReadinessStatus: "ok",
        runtimeBindingReadinessStatus: "ready",
      }}
    />,
  );

  assert.match(markup, /AI 处理准备/u);
  assert.match(markup, /当前方式/u);
  assert.match(markup, /受控处理/u);
  assert.match(markup, /当前模板/u);
  assert.match(markup, /已按当前模板装载/u);
  assert.match(markup, /AI 状态/u);
  assert.match(markup, /已就绪/u);
  assert.doesNotMatch(markup, /execution-profile-proofreading-run-actual-1/);
  assert.doesNotMatch(markup, /retrieval-preset-proofreading-run-actual-1/);
  assert.doesNotMatch(markup, /runtime-binding-proofreading-run-actual-1/);
  assert.doesNotMatch(markup, /routing-policy-proofreading-run-actual-1/);
  assert.doesNotMatch(markup, /model-proofreading-run-actual-1/);
  assert.doesNotMatch(markup, /execution-profile-proofreading-current-2/);
  assert.doesNotMatch(markup, /retrieval-preset-proofreading-current-2/);
  assert.doesNotMatch(markup, /runtime-binding-proofreading-current-2/);
  assert.doesNotMatch(markup, /routing-policy-proofreading-current-2/);
  assert.doesNotMatch(markup, /model-proofreading-current-2/);
});

test("summary helpers localize readiness reasons and batch detail labels for operator display", () => {
  const readinessDetails = buildManuscriptMainlineReadinessDetails({
    observation_status: "reported",
    derived_status: "ready_for_next_step",
    active_module: "screening",
    next_module: "editing",
    runtime_binding_status: "ready",
    reason: "The manuscript is ready for governed screening.",
  });
  const batchDetails = buildJobBatchProgressDetails({
    id: "job-batch-1",
    module: "screening",
    job_type: "manuscript_batch_upload",
    status: "running",
    requested_by: "editor-1",
    attempt_count: 1,
    created_at: "2026-03-31T09:00:00.000Z",
    updated_at: "2026-03-31T09:01:00.000Z",
    batch_progress: {
      lifecycle_status: "running",
      settlement_status: "partial_success",
      total_count: 3,
      queued_count: 0,
      running_count: 1,
      succeeded_count: 2,
      failed_count: 0,
      remaining_count: 1,
      restart_posture: {
        status: "resumed_after_restart",
        reason: "Recovered after restart",
        observed_at: "2026-03-31T09:01:00.000Z",
      },
      items: [],
    },
  } as never);

  assert.equal(
    readinessDetails.find((detail) => detail.label === "\u5c31\u7eea\u539f\u56e0")?.value,
    "\u7a3f\u4ef6\u5df2\u6ee1\u8db3\u53d7\u6cbb\u7406\u521d\u7b5b\u6761\u4ef6\u3002",
  );
  assert.deepEqual(
    batchDetails.map((detail) => detail.label),
    [
      "\u6279\u6b21\u8fdb\u5ea6",
      "\u6279\u6b21\u7ed3\u7b97",
      "\u5df2\u5b8c\u6210",
      "\u5931\u8d25",
      "\u5904\u7406\u4e2d",
      "\u5f85\u5904\u7406",
      "\u91cd\u542f\u72b6\u6001",
    ],
  );
  assert.equal(
    batchDetails.find((detail) => detail.label === "\u6279\u6b21\u7ed3\u7b97")?.value,
    "\u90e8\u5206\u6210\u529f",
  );
});

test("summary renders localized latest action details instead of mixed English labels", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      mode="editing"
      workspace={createEditingWorkspace()}
      latestJob={null}
      latestExport={null}
      latestActionResult={{
        tone: "success",
        actionLabel: "Upload Manuscript",
        message: "Uploaded manuscript manuscript-1",
        details: [
          {
            label: "Job\u7ed3\u7b97",
            value: "business_completed_follow_up_pending",
          },
          {
            label: "Batch Settlement",
            value: "partial_success",
          },
        ],
      }}
    />,
  );

  assert.match(markup, /\u5df2\u4e0a\u4f20\u7a3f\u4ef6/u);
  assert.doesNotMatch(markup, /\u5df2\u4e0a\u4f20\u7a3f\u4ef6 manuscript-1/u);
  assert.match(markup, /\u4efb\u52a1\u7ed3\u7b97/u);
  assert.match(markup, /\u6279\u6b21\u7ed3\u7b97/u);
  assert.match(markup, /\u90e8\u5206\u6210\u529f/u);
  assert.doesNotMatch(markup, /Job\u7ed3\u7b97/);
  assert.doesNotMatch(markup, /Batch Settlement/);
});

test("summary formats hydrated knowledge references with titles before falling back to raw ids", () => {
  const details = buildJobReviewEvidenceDetails(
    {
      id: "job-screening-knowledge-1",
      module: "screening",
      job_type: "screening_run",
      status: "completed",
      requested_by: "editor-1",
      attempt_count: 1,
      created_at: "2026-04-16T08:00:00.000Z",
      updated_at: "2026-04-16T08:01:00.000Z",
      execution_tracking: {
        observation_status: "reported",
        snapshot: {
          id: "snapshot-screening-1",
          manuscript_id: "manuscript-1",
          module: "screening",
          job_id: "job-screening-knowledge-1",
          execution_profile_id: "execution-profile-1",
          module_template_id: "template-screening-1",
          module_template_version_no: 3,
          prompt_template_id: "prompt-screening-1",
          prompt_template_version: "2026-04-01",
          skill_package_ids: ["pkg-1"],
          skill_package_versions: ["2026.04"],
          model_id: "model-screening-1",
          knowledge_item_ids: [
            "knowledge-screening-1",
            "knowledge-editing-2",
            "knowledge-unresolved-3",
          ],
          created_asset_ids: ["asset-screening-1"],
          created_at: "2026-04-16T08:01:00.000Z",
          agent_execution: {
            observation_status: "not_linked",
          },
          runtime_binding_readiness: {
            observation_status: "reported",
            report: {
              status: "ready",
              checked_at: "2026-04-16T08:01:00.000Z",
              issues: [],
            },
          },
        },
      },
    } as never,
    {
      "knowledge-screening-1": {
        id: "knowledge-screening-1",
        title: "Primary endpoint rule",
        revisionId: "knowledge-screening-1-revision-4",
        status: "approved",
      },
      "knowledge-editing-2": {
        id: "knowledge-editing-2",
        title: "Style glossary",
        revisionId: "knowledge-editing-2-revision-2",
        status: "draft",
      },
    },
  );

  assert.equal(
    details.find((detail) => detail.label === "\u77e5\u8bc6\u5f15\u7528")?.value,
    "Primary endpoint rule\uff08knowledge-screening-1\uff09; Style glossary\uff08knowledge-editing-2\uff09; knowledge-unresolved-3",
  );
});

test("summary localizes readiness guidance, attention reasons, and overview template family labels", () => {
  const baseWorkspace = createEditingWorkspace();
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      mode="screening"
      workspace={
        {
          ...baseWorkspace,
          manuscript: {
            ...baseWorkspace.manuscript,
            manuscript_type: "review",
            current_template_family_id: "family-review-active",
            mainline_readiness_summary: {
              observation_status: "reported",
              derived_status: "ready_for_next_step",
              active_module: "screening",
              next_module: "editing",
              runtime_binding_status: "ready",
              reason: "The manuscript is ready for governed screening.",
            },
            mainline_attention_handoff_pack: {
              observation_status: "reported",
              attention_status: "clear",
              handoff_status: "ready_now",
              from_module: "screening",
              to_module: "editing",
              reason: "The manuscript is ready for governed screening.",
              attention_items: [],
            },
          },
          templateFamily: {
            id: "family-review-active",
            manuscript_type: "review",
            name: "Review \u57fa\u7840\u6a21\u677f\u65cf",
            status: "active",
          },
        } as ManuscriptWorkbenchWorkspace
      }
      latestJob={null}
      latestExport={null}
      latestActionResult={null}
    />,
  );

  assert.match(
    markup,
    /<span>\u6267\u884c\u5efa\u8bae<\/span><strong>\u7a3f\u4ef6\u5df2\u6ee1\u8db3\u53d7\u6cbb\u7406\u521d\u7b5b\u6761\u4ef6\u3002<\/strong>/u,
  );
  assert.match(
    markup,
    /<span>\u4e3b\u8981\u5173\u6ce8\u539f\u56e0<\/span><strong>\u7a3f\u4ef6\u5df2\u6ee1\u8db3\u53d7\u6cbb\u7406\u521d\u7b5b\u6761\u4ef6\u3002<\/strong>/u,
  );
  assert.match(
    markup,
    /<span>\u57fa\u7840\u6a21\u677f\u65cf<\/span><strong>\u7efc\u8ff0\u57fa\u7840\u6a21\u677f\u65cf<\/strong>/u,
  );
});

test("manuscript workbench summary renders posture-aware high-risk governed review cards", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      mode="proofreading"
      canOpenLearningReview
      manualFeedback={
        {
          selectedCategory: "",
          note: "",
          isSubmitting: false,
          onCategoryChange: () => {},
          onNoteChange: () => {},
          onSubmit: () => {},
          highRiskReviewItems: [
            {
              id: "risk-table-1",
              title: "\u8868\u683c\u5355\u4f4d\u683c\u5f0f\u9700\u8981\u4eba\u5de5\u786e\u8ba4",
              feedbackCategory: "incorrect_hit",
              candidate_posture: "candidate_change",
              riskLevel: "high",
              summary:
                "\u5355\u4f4d\u5199\u6cd5\u4e0e\u6cbb\u7406\u89c4\u5219\u4e0d\u4e00\u81f4\uff0c\u9700\u8981\u4eba\u5de5\u786e\u8ba4\u3002",
              excerpt: "5 mg per dL",
              suggestion: "5 mg/dL",
              rationale:
                "\u8868\u683c\u6807\u9898\u548c\u5355\u4f4d\u683c\u5f0f\u5b58\u5728\u9ad8\u98ce\u9669\u504f\u5dee\u3002",
              locationText: "\u8868\u683c table-1 / header_cell / \u6bb5\u843d 3",
              evidence_pack: {
                location: {
                  table_id: "table-1",
                  semantic_target: "header_cell",
                  paragraph_index: 3,
                },
                excerpt: "5 mg per dL",
                suggestion: "5 mg/dL",
                rationale:
                  "\u8868\u683c\u6807\u9898\u548c\u5355\u4f4d\u683c\u5f0f\u5b58\u5728\u9ad8\u98ce\u9669\u504f\u5dee\u3002",
              },
              relatedRuleIds: ["rule-table-unit-1"],
            },
            {
              id: "risk-proof-1",
              title: "Inspect-only proofreading review item",
              feedbackCategory: "incorrect_hit",
              candidate_posture: "inspect_only",
              riskLevel: "high",
              summary: "Inspect before confirming writeback.",
              rationale: "Proofreading evidence requires human confirmation.",
              locationText: "Paragraph 6",
              evidence_pack: {
                location: {
                  paragraph_index: 6,
                },
                rationale: "Proofreading evidence requires human confirmation.",
              },
            },
          ],
          onSubmitHighRiskItem: () => {},
          onRecordManualOnly: () => {},
        } as never
      }
      workspace={
        {
          manuscript: {
            id: "manuscript-risk-1",
            title: "\u8868\u683c\u6821\u5bf9\u7a3f",
            manuscript_type: "clinical_study",
            status: "processing",
            created_by: "editor-1",
            created_at: "2026-04-18T09:00:00.000Z",
            updated_at: "2026-04-18T09:10:00.000Z",
            result_asset_matrix: {},
          },
          assets: [],
          currentAsset: null,
          currentManuscriptAsset: null,
          suggestedParentAsset: null,
          latestProofreadingDraftAsset: null,
        } as never
      }
      latestJob={
        {
          id: "job-proofreading-1",
          manuscript_id: "manuscript-risk-1",
          module: "proofreading",
          job_type: "proofreading_draft_run",
          status: "completed",
          requested_by: "proofreader-1",
          attempt_count: 1,
          payload: {
            proofreadingFindings: {
              failedChecks: [
                {
                  ruleId: "rule-table-unit-1",
                  expected: "5 mg/dL",
                  actual: "5 mg per dL",
                  severity: "error",
                  blockIndex: 2,
                  semantic_hit: {
                    table_id: "table-1",
                    semantic_target: "header_cell",
                  },
                },
              ],
            },
          },
          created_at: "2026-04-18T09:05:00.000Z",
          updated_at: "2026-04-18T09:10:00.000Z",
          execution_tracking: {
            observation_status: "not_tracked",
          },
        } as never
      }
      latestExport={null}
      latestActionResult={null}
    />,
  );

  assert.match(markup, /\u9ad8\u98ce\u9669\u590d\u6838/u);
  assert.match(markup, /\u8868\u683c\u5355\u4f4d\u683c\u5f0f\u9700\u8981\u4eba\u5de5\u786e\u8ba4/u);
  assert.match(markup, /5 mg per dL/);
  assert.match(markup, /5 mg\/dL/);
  assert.match(markup, /\u63d0\u4ea4\u590d\u6838/u);
  assert.match(markup, /\u4ec5\u8bb0\u5f55\u4eba\u5de5\u5904\u7406/u);
  assert.match(markup, /\u67e5\u770b\u5b9a\u4f4d/u);
  assert.match(markup, /\u8868\u683c table-1/u);
  assert.match(markup, /\u6bb5\u843d 3/u);
  assert.match(markup, /\u5904\u7406\u65b9\u5f0f/u);
  assert.match(markup, /\u5019\u9009\u4fee\u6539/u);
  assert.match(markup, /\u4ec5\u68c0\u67e5/u);
});

test("summary renders operator feedback choices and explains rule-candidate routing after submit", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      mode="editing"
      workspace={createEditingWorkspace()}
      latestJob={null}
      latestExport={null}
      latestActionResult={null}
      canOpenLearningReview
      manualFeedback={{
        selectedCategory: "incorrect_hit",
        note: "Terminology was matched to the wrong governed rule.",
        isSubmitting: false,
        lastSubmitted: {
          feedbackCategory: "incorrect_hit",
          feedbackRecordId: "feedback-1",
          reviewItemId: "review-item-manual-1",
          recommendedRoute: "rule_candidate",
        },
        onCategoryChange: () => undefined,
        onNoteChange: () => undefined,
        onSubmit: () => undefined,
      }}
    />,
  );

  assert.match(markup, /\u4eba\u5de5\u53cd\u9988/u);
  assert.match(markup, /\u8fd9\u6b21\u6ca1\u547d\u4e2d/u);
  assert.match(markup, /\u5c06\u8865\u5145\u4e3a\u89c4\u5219\u5019\u9009/u);
  assert.match(markup, /\u547d\u4e2d\u9519\u8bef/u);
  assert.match(markup, /\u5c06\u4fee\u6b63\u4e3a\u89c4\u5219\u5019\u9009/u);
  assert.match(markup, /\u7f3a\u5c11\u77e5\u8bc6/u);
  assert.match(markup, /\u5c06\u8865\u5145\u4e3a\u77e5\u8bc6\u5019\u9009/u);
  assert.match(markup, /\u8bb0\u5f55\u5230\u5f85\u5ba1\u6838\u961f\u5217/u);
  assert.match(markup, /\u63d0\u4ea4\u590d\u6838\u9879/u);
  assert.match(markup, /\u5df2\u8bb0\u5f55\u5230\u5f85\u5ba1\u6838\u961f\u5217/u);
  assert.match(markup, /\u89c4\u5219\u5019\u9009/u);
  assert.match(markup, /\u524d\u5f80\u5b66\u4e60\u5ba1\u6838/u);
  assert.match(
    markup,
      /href="#template-governance\?[^"]*ruleCenterMode=learning[^"]*reviewItemId=review-item-manual-1"/u,
  );
  assert.doesNotMatch(markup, /\u5df2\u63d0\u4ea4\u590d\u6838\u9879 review-item-manual-1/u);
  assert.doesNotMatch(markup, /\u6cbb\u7406\u4e2d\u5fc3/u);
});

test("summary explains knowledge-candidate routing without sending operators to the rule center", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      mode="editing"
      workspace={createEditingWorkspace()}
      latestJob={null}
      latestExport={null}
      latestActionResult={null}
      canOpenLearningReview
      manualFeedback={{
        selectedCategory: "missing_knowledge",
        note: "The current governed set is missing a disease-specific evidence reference.",
        isSubmitting: false,
        lastSubmitted: {
          feedbackCategory: "missing_knowledge",
          feedbackRecordId: "feedback-knowledge-1",
          reviewItemId: "review-item-knowledge-1",
          recommendedRoute: "knowledge_candidate",
        },
        onCategoryChange: () => undefined,
        onNoteChange: () => undefined,
        onSubmit: () => undefined,
      }}
    />,
  );

  assert.match(markup, /\u5df2\u8bb0\u5f55\u5230\u5f85\u5ba1\u6838\u961f\u5217/u);
  assert.match(markup, /\u77e5\u8bc6\u5019\u9009/u);
  assert.match(
    markup,
    /\u590d\u6838\u9879\u5df2\u8fdb\u5165\u77e5\u8bc6\u5ba1\u6838\u961f\u5217/u,
  );
  assert.doesNotMatch(markup, /\u5df2\u63d0\u4ea4\u590d\u6838\u9879 review-item-knowledge-1/u);
  assert.doesNotMatch(
    markup,
    /href="#template-governance\?[^"]*reviewItemId=review-item-knowledge-1/u,
  );
  assert.doesNotMatch(markup, /\u524d\u5f80\u5b66\u4e60\u5ba1\u6838/u);
});

test("summary surfaces proofreading residual progression without duplicating the governance desk", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      mode="proofreading"
      workspace={createProofreadingWorkspace()}
      latestJob={null}
      latestExport={null}
      latestActionResult={null}
      canOpenLearningReview
      proofreadingGovernanceHandoff={{
        residualReviewItems: [
          {
            id: "residual-observed-1",
            source_kind: "residual_issue",
            source_status: "observed",
            review_status: "pending",
            module: "proofreading",
            manuscript_id: "manuscript-proof-1",
            manuscript_type: "clinical_study",
            snapshot_id: "snapshot-proofreading-1",
            title: "Residual issue observed",
            created_at: "2026-04-21T09:00:00.000Z",
            updated_at: "2026-04-21T09:01:00.000Z",
            available_actions: ["validate"],
            issue_type: "statistical_expression",
            execution_snapshot_id: "snapshot-proofreading-1",
            recommended_route: "rule_candidate",
            harness_validation_status: "not_required",
          },
          {
            id: "residual-harness-1",
            source_kind: "residual_issue",
            source_status: "validation_pending",
            review_status: "pending",
            module: "proofreading",
            manuscript_id: "manuscript-proof-1",
            manuscript_type: "clinical_study",
            snapshot_id: "snapshot-proofreading-2",
            title: "Residual issue queued for Harness",
            created_at: "2026-04-21T09:02:00.000Z",
            updated_at: "2026-04-21T09:03:00.000Z",
            available_actions: ["validate"],
            issue_type: "table_note",
            execution_snapshot_id: "snapshot-proofreading-2",
            recommended_route: "rule_candidate",
            harness_validation_status: "queued",
          },
          {
            id: "residual-ready-1",
            source_kind: "residual_issue",
            source_status: "candidate_ready",
            review_status: "pending",
            module: "proofreading",
            manuscript_id: "manuscript-proof-1",
            manuscript_type: "clinical_study",
            snapshot_id: "snapshot-proofreading-3",
            title: "Residual issue ready for candidate creation",
            created_at: "2026-04-21T09:04:00.000Z",
            updated_at: "2026-04-21T09:05:00.000Z",
            available_actions: [
              "route_to_rule_candidate",
              "route_to_knowledge_candidate",
              "route_to_prompt_candidate",
            ],
            issue_type: "unit_normalization",
            execution_snapshot_id: "snapshot-proofreading-3",
            recommended_route: "rule_candidate",
            harness_validation_status: "passed",
          },
        ],
        ruleCandidates: [
          {
            id: "candidate-proofreading-1",
            type: "rule_candidate",
            status: "pending_review",
            manuscript_id: "manuscript-proof-1",
            module: "proofreading",
            manuscript_type: "clinical_study",
            governed_provenance_kind: "residual_issue",
            title: "Rule candidate from proofreading residual",
            created_by: "reviewer-1",
            created_at: "2026-04-21T09:06:00.000Z",
            updated_at: "2026-04-21T09:06:00.000Z",
          },
          {
            id: "candidate-proofreading-human-1",
            type: "rule_candidate",
            status: "pending_review",
            manuscript_id: "manuscript-proof-1",
            module: "proofreading",
            manuscript_type: "clinical_study",
            governed_provenance_kind: "human_feedback",
            title: "Rule candidate from proofreading human confirmation",
            created_by: "reviewer-1",
            created_at: "2026-04-21T09:07:00.000Z",
            updated_at: "2026-04-21T09:07:00.000Z",
          },
        ],
      }}
    />,
  );

  assert.match(markup, /\u6821\u5bf9\u56de\u6d41\u8fdb\u5ea6/u);
  assert.match(markup, /\u5df2\u53d1\u73b0\u6b8b\u5dee/u);
  assert.match(markup, /Harness \u5f85\u590d\u9a8c/u);
  assert.match(markup, /\u5019\u9009\u5df2\u5c31\u7eea/u);
  assert.match(markup, /\u5df2\u751f\u6210\u5019\u9009/u);
  assert.match(
    markup,
    /<span>\u5df2\u751f\u6210\u5019\u9009<\/span>\s*<strong>2<\/strong>/u,
  );
  assert.match(markup, /\u53ea\u663e\u793a\u6821\u5bf9\u4e3b\u7ebf\u9700\u8981\u5173\u6ce8\u7684\u5173\u952e\u8fdb\u5ea6/u);
  assert.match(markup, /\u8be6\u7ec6\u590d\u9a8c\u548c\u5019\u9009\u5904\u7406\u8bf7\u5230\u540e\u7eed\u5ba1\u6838\u7ee7\u7eed\u5b8c\u6210/u);
  assert.match(markup, /\u524d\u5f80\u540e\u7eed\u5ba1\u6838/u);
  assert.match(
    markup,
    /href="#template-governance\?[^"]*manuscriptId=manuscript-proof-1[^"]*templateGovernanceView=rule-ledger[^"]*ruleCenterMode=learning/u,
  );
  assert.doesNotMatch(markup, /\u89c4\u5219\u4e2d\u5fc3\u7ee7\u7eed\u590d\u9a8c\u4e0e\u5019\u9009\u5904\u7406/u);
  assert.doesNotMatch(markup, /\u7edf\u4e00\u590d\u6838\u961f\u5217/u);
});

test("job review evidence details include editing table inspection hits and nested proofreading quality reasons", () => {
  const editingDetails = buildJobReviewEvidenceDetails({
    id: "job-editing-1",
    manuscript_id: "manuscript-risk-1",
    module: "editing",
    job_type: "editing_run",
    status: "completed",
    requested_by: "editor-1",
    attempt_count: 1,
    payload: {
      tableInspectionFindings: [
        {
          ruleId: "rule-table-treatment-group",
          reason:
            'Matched semantic target "header_cell" in table "table-1" for header path "Treatment group > n (%)". Check treatment group header formatting.',
        },
      ],
    },
    created_at: "2026-04-18T09:05:00.000Z",
    updated_at: "2026-04-18T09:10:00.000Z",
  } as never);
  const proofreadingDetails = buildJobReviewEvidenceDetails({
    id: "job-proofreading-2",
    manuscript_id: "manuscript-risk-1",
    module: "proofreading",
    job_type: "proofreading_draft_run",
    status: "completed",
    requested_by: "proofreader-1",
    attempt_count: 1,
    payload: {
      proofreadingFindings: {
        qualityFindings: [
          {
            explanation:
              "\u7edf\u8ba1\u8868\u8fbe\u5b58\u5728\u9ad8\u98ce\u9669\u8bef\u89e3\u7a7a\u95f4",
            recommended_route: "knowledge_candidate",
          },
        ],
      },
    },
    created_at: "2026-04-18T09:05:00.000Z",
    updated_at: "2026-04-18T09:10:00.000Z",
  } as never);

  assert.deepEqual(editingDetails, [
    {
      label: "\u89c4\u5219\u547d\u4e2d",
      value: "rule-table-treatment-group",
    },
    {
      label: "\u9ad8\u98ce\u9669\u8bc1\u636e",
      value:
        'Matched semantic target "header_cell" in table "table-1" for header path "Treatment group > n (%)". Check treatment group header formatting.',
    },
    {
      label: "\u5efa\u8bae\u6d41\u5411",
      value: "\u89c4\u5219\u5019\u9009",
    },
  ]);
  assert.deepEqual(proofreadingDetails, [
    {
      label: "\u9ad8\u98ce\u9669\u8bc1\u636e",
      value: "\u7edf\u8ba1\u8868\u8fbe\u5b58\u5728\u9ad8\u98ce\u9669\u8bef\u89e3\u7a7a\u95f4",
    },
    {
      label: "\u5efa\u8bae\u6d41\u5411",
      value: "\u77e5\u8bc6\u5019\u9009",
    },
  ]);
});
