import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildJobBatchProgressDetails,
  buildJobReviewEvidenceDetails,
  buildManuscriptMainlineReadinessDetails,
  ManuscriptWorkbenchSummary,
} from "../src/features/manuscript-workbench/manuscript-workbench-summary.tsx";

function createEditingWorkspace() {
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
    currentManuscriptAsset: {
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
  } as never;
}

function createScreeningWorkspace() {
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
    assets: [
      {
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
      },
      {
        id: "asset-original-2",
        manuscript_id: "manuscript-2",
        asset_type: "original",
        status: "active",
        storage_key: "uploads/screening-review.docx",
        mime_type:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        source_module: "upload",
        created_by: "editor-1",
        version_no: 1,
        is_current: true,
        file_name: "screening-review.docx",
        created_at: "2026-04-15T09:00:00.000Z",
        updated_at: "2026-04-15T09:00:00.000Z",
      },
    ],
    currentAsset: {
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
    },
    currentManuscriptAsset: {
      id: "asset-original-2",
      manuscript_id: "manuscript-2",
      asset_type: "original",
      status: "active",
      storage_key: "uploads/screening-review.docx",
      mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      source_module: "upload",
      created_by: "editor-1",
      version_no: 1,
      is_current: true,
      file_name: "screening-review.docx",
      created_at: "2026-04-15T09:00:00.000Z",
      updated_at: "2026-04-15T09:00:00.000Z",
    },
    suggestedParentAsset: {
      id: "asset-original-2",
      manuscript_id: "manuscript-2",
      asset_type: "original",
      status: "active",
      storage_key: "uploads/screening-review.docx",
      mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      source_module: "upload",
      created_by: "editor-1",
      version_no: 1,
      is_current: true,
      file_name: "screening-review.docx",
      created_at: "2026-04-15T09:00:00.000Z",
      updated_at: "2026-04-15T09:00:00.000Z",
    },
    latestProofreadingDraftAsset: null,
  } as never;
}

function createRecoveryWorkspace() {
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
    assets: [
      {
        id: "asset-human-final-1",
        manuscript_id: "manuscript-recovery-1",
        asset_type: "human_final_docx",
        status: "active",
        storage_key: "runs/proofreading/human-final.docx",
        mime_type:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        parent_asset_id: "asset-proof-final-1",
        source_module: "manual",
        created_by: "proofreader-1",
        version_no: 1,
        is_current: true,
        file_name: "human-final.docx",
        created_at: "2026-04-15T10:10:00.000Z",
        updated_at: "2026-04-15T10:10:00.000Z",
      },
    ],
    currentAsset: {
      id: "asset-human-final-1",
      manuscript_id: "manuscript-recovery-1",
      asset_type: "human_final_docx",
      status: "active",
      storage_key: "runs/proofreading/human-final.docx",
      mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      parent_asset_id: "asset-proof-final-1",
      source_module: "manual",
      created_by: "proofreader-1",
      version_no: 1,
      is_current: true,
      file_name: "human-final.docx",
      created_at: "2026-04-15T10:10:00.000Z",
      updated_at: "2026-04-15T10:10:00.000Z",
    },
    currentManuscriptAsset: {
      id: "asset-human-final-1",
      manuscript_id: "manuscript-recovery-1",
      asset_type: "human_final_docx",
      status: "active",
      storage_key: "runs/proofreading/human-final.docx",
      mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      parent_asset_id: "asset-proof-final-1",
      source_module: "manual",
      created_by: "proofreader-1",
      version_no: 1,
      is_current: true,
      file_name: "human-final.docx",
      created_at: "2026-04-15T10:10:00.000Z",
      updated_at: "2026-04-15T10:10:00.000Z",
    },
    suggestedParentAsset: {
      id: "asset-human-final-1",
      manuscript_id: "manuscript-recovery-1",
      asset_type: "human_final_docx",
      status: "active",
      storage_key: "runs/proofreading/human-final.docx",
      mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      parent_asset_id: "asset-proof-final-1",
      source_module: "manual",
      created_by: "proofreader-1",
      version_no: 1,
      is_current: true,
      file_name: "human-final.docx",
      created_at: "2026-04-15T10:10:00.000Z",
      updated_at: "2026-04-15T10:10:00.000Z",
    },
    latestProofreadingDraftAsset: null,
  } as never;
}

test("summary keeps compact cards and omits the oversized top summary strip", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      mode="editing"
      accessibleHandoffModes={["proofreading"]}
      workspace={createEditingWorkspace()}
      latestJob={{
        id: "job-edit-1",
        module: "editing",
        job_type: "editing_run",
        status: "completed",
        requested_by: "editor-1",
        attempt_count: 1,
        created_at: "2026-03-31T09:45:00.000Z",
        updated_at: "2026-03-31T09:46:00.000Z",
      } as never}
      latestExport={{
        manuscript_id: "manuscript-1",
        asset: {
          id: "asset-edited-1",
          manuscript_id: "manuscript-1",
          asset_type: "edited_docx",
          status: "active",
          storage_key: "runs/editing/final.docx",
          mime_type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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
          mime_type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          url: "/api/v1/document-assets/asset-edited-1/download",
        },
      } as never}
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

  assert.match(markup, /data-summary-layout="compact-manuscript-summary"/);
  assert.doesNotMatch(markup, /manuscript-workbench-summary-strip/);
  assert.match(markup, /最近操作结果/u);
  assert.match(markup, /建议下一步/u);
  assert.match(markup, /稿件概览/u);
  assert.match(markup, /最近任务/u);
  assert.match(markup, /最近导出/u);
  assert.match(markup, /资产链路/u);
  assert.match(markup, /Cardiology review/);
  assert.match(markup, /href="#proofreading\?manuscriptId=manuscript-1"/);
});

test("summary routes the quality recovery handoff into the rule center workspace", () => {
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

  assert.match(markup, /\u524d\u5f80\u89c4\u5219\u4e2d\u5fc3/u);
  assert.match(
    markup,
    /\u5f53\u524d\u9636\u6bb5\uff1a\u5ba1\u6838\u3002\u4e0b\u4e00\u6b65\uff1a\u524d\u5f80\u89c4\u5219\u4e2d\u5fc3\u5b8c\u6210\u5ba1\u6838\uff0c\u5e76\u7ee7\u7eed\u8f6c\u6210\u89c4\u5219\u8349\u7a3f\u3002/u,
  );
  assert.match(markup, /#template-governance\?[^"]*templateGovernanceView=rule-ledger/u);
  assert.match(markup, /ruleCenterMode=learning/u);
  assert.match(markup, /manuscriptId=manuscript-recovery-1/u);
  assert.doesNotMatch(markup, /\u524d\u5f80\u56de\u6d41\u5de5\u4f5c\u533a/u);
  assert.doesNotMatch(markup, /#learning-review/u);
});

test("summary still exposes current asset and export metadata after the top strip is removed", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      mode="editing"
      workspace={createEditingWorkspace()}
      latestJob={null}
      latestExport={{
        manuscript_id: "manuscript-1",
        asset: {
          id: "asset-edited-1",
          manuscript_id: "manuscript-1",
          asset_type: "edited_docx",
          status: "active",
          storage_key: "runs/editing/final.docx",
          mime_type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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
          mime_type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          url: "/api/v1/document-assets/asset-edited-1/download",
        },
      } as never}
      latestActionResult={null}
    />,
  );

  assert.match(markup, /当前资产/u);
  assert.match(markup, /editing-final\.docx/);
  assert.match(markup, /查看当前稿件/u);
  assert.match(markup, /下载当前稿件/u);
  assert.match(
    markup,
    /href="http:\/\/localhost\/api\/v1\/document-assets\/asset-edited-1\/download"/,
  );
  assert.match(markup, /target="_blank"/);
  assert.match(markup, /exports\/manuscript-1\/current\.docx/);
  assert.match(
    markup,
    /href="http:\/\/localhost\/api\/v1\/document-assets\/asset-edited-1\/download"/,
  );
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

  assert.match(markup, /查看当前稿件/u);
  assert.match(markup, /下载当前稿件/u);
  assert.match(markup, /查看当前结果/u);
  assert.match(markup, /下载初筛报告/u);
  assert.match(
    markup,
    /href="http:\/\/localhost\/api\/v1\/document-assets\/asset-original-2\/download"/,
  );
  assert.match(
    markup,
    /href="http:\/\/localhost\/api\/v1\/document-assets\/asset-screening-report-1\/download"/,
  );
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
    readinessDetails.find((detail) => detail.label === "就绪原因")?.value,
    "稿件已满足受治理初筛条件。",
  );
  assert.deepEqual(
    batchDetails.map((detail) => detail.label),
    ["批次进度", "批次结算", "已完成", "失败", "处理中", "待处理", "重启状态"],
  );
  assert.equal(
    batchDetails.find((detail) => detail.label === "批次结算")?.value,
    "部分成功",
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
            label: "Job结算",
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

  assert.match(markup, /已上传稿件 manuscript-1/u);
  assert.match(markup, /任务结算/u);
  assert.match(markup, /批次结算/u);
  assert.match(markup, /部分成功/u);
  assert.doesNotMatch(markup, /Job结算/);
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
    details.find((detail) => detail.label === "知识引用")?.value,
    "Primary endpoint rule（knowledge-screening-1）; Style glossary（knowledge-editing-2）; knowledge-unresolved-3",
  );
});

test("summary localizes readiness guidance, attention reasons, and overview template family labels", () => {
  const baseWorkspace = createEditingWorkspace();
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      mode="screening"
      workspace={{
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
          name: "Review 基础模板族",
          status: "active",
        },
      } as never}
      latestJob={null}
      latestExport={null}
      latestActionResult={null}
    />,
  );

  assert.match(markup, /<span>执行建议<\/span><strong>稿件已满足受治理初筛条件。<\/strong>/u);
  assert.match(markup, /<span>主要关注原因<\/span><strong>稿件已满足受治理初筛条件。<\/strong>/u);
  assert.match(markup, /<span>基础模板族<\/span><strong>综述基础模板族<\/strong>/u);
});

test("summary renders operator feedback choices and opens the submitted learning candidate in the rule center", () => {
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
          learningCandidateId: "candidate-manual-1",
        },
        onCategoryChange: () => undefined,
        onNoteChange: () => undefined,
        onSubmit: () => undefined,
      }}
    />,
  );

  assert.match(markup, /人工反馈/u);
  assert.match(markup, /这次没命中/u);
  assert.match(markup, /命中错误/u);
  assert.match(markup, /缺少知识/u);
  assert.match(markup, /已提交至规则中心待审核/u);
  assert.match(markup, /candidate-manual-1/u);
  assert.match(
    markup,
    /href="#template-governance\?[^"]*ruleCenterMode=learning[^"]*learningCandidateId=candidate-manual-1/u,
  );
});
