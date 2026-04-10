import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildWorkbenchJobActionResultDetails,
  loadPrefilledWorkbenchWorkspace,
  resolveWorkbenchNotice,
  refreshLatestWorkbenchJobContext,
  ManuscriptWorkbenchPage,
} from "../src/features/manuscript-workbench/manuscript-workbench-page.tsx";
import {
  ManuscriptWorkbenchSummary,
  resolveWorkbenchActionOutcomePill,
  resolveWorkbenchLatestJobExecutionPosturePill,
  resolveWorkbenchLatestJobStatusPill,
} from "../src/features/manuscript-workbench/manuscript-workbench-summary.tsx";

test("submission workbench renders a real multi-file picker for inline batch uploads", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchPage
      mode="submission"
      controller={{
        loadWorkspace: async () => {
          throw new Error("not used");
        },
        uploadManuscriptAndLoad: async () => {
          throw new Error("not used");
        },
        runModuleAndLoad: async () => {
          throw new Error("not used");
        },
        finalizeProofreadingAndLoad: async () => {
          throw new Error("not used");
        },
        publishHumanFinalAndLoad: async () => {
          throw new Error("not used");
        },
        loadJob: async () => {
          throw new Error("not used");
        },
        exportCurrentAsset: async () => {
          throw new Error("not used");
        },
      }}
    />,
  );

  assert.match(markup, /manuscript-workbench-shell--submission/);
  assert.match(markup, /投稿工作台/);
  assert.match(markup, /工作线定位/);
  assert.match(markup, /type="file"/);
  assert.match(markup, /multiple/);
  assert.match(markup, /存储键/);
  assert.match(markup, /上传稿件/);
});

test("editing workbench renders a distinct localized hero for the current mainline lane", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchPage
      mode="editing"
      controller={{
        loadWorkspace: async () => {
          throw new Error("not used");
        },
        uploadManuscriptAndLoad: async () => {
          throw new Error("not used");
        },
        runModuleAndLoad: async () => {
          throw new Error("not used");
        },
        finalizeProofreadingAndLoad: async () => {
          throw new Error("not used");
        },
        publishHumanFinalAndLoad: async () => {
          throw new Error("not used");
        },
        loadJob: async () => {
          throw new Error("not used");
        },
        exportCurrentAsset: async () => {
          throw new Error("not used");
        },
      }}
    />,
  );

  assert.match(markup, /manuscript-workbench-shell--editing/);
  assert.match(markup, /核心四大工作台/u);
  assert.match(markup, /初筛/u);
  assert.match(markup, /校对/u);
  assert.match(markup, /知识库/u);
  assert.match(markup, /workbench-core-strip-card is-active/);
  assert.match(markup, /编辑工作台/);
  assert.match(markup, /核心工作台/);
  assert.match(markup, /当前焦点/);
});

test("manuscript workbench page prefills lookup state from a workbench handoff", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchPage
      mode="proofreading"
      prefilledManuscriptId="manuscript-9"
      controller={{
        loadWorkspace: async () => {
          throw new Error("not used");
        },
        uploadManuscriptAndLoad: async () => {
          throw new Error("not used");
        },
        runModuleAndLoad: async () => {
          throw new Error("not used");
        },
        finalizeProofreadingAndLoad: async () => {
          throw new Error("not used");
        },
        publishHumanFinalAndLoad: async () => {
          throw new Error("not used");
        },
        loadJob: async () => {
          throw new Error("not used");
        },
        exportCurrentAsset: async () => {
          throw new Error("not used");
        },
      }}
    />,
  );

  assert.match(markup, /manuscript-9/);
  assert.match(markup, /该工作台已根据上一环节稿件自动带入。/);
  assert.doesNotMatch(markup, /评测移交上下文/);
});

test("manuscript workbench page renders evaluation handoff context when reviewed snapshot and sample ids are provided", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchPage
      mode="proofreading"
      prefilledManuscriptId="manuscript-9"
      prefilledReviewedCaseSnapshotId="reviewed-case-77"
      prefilledSampleSetItemId="sample-set-item-22"
      controller={{
        loadWorkspace: async () => {
          throw new Error("not used");
        },
        uploadManuscriptAndLoad: async () => {
          throw new Error("not used");
        },
        runModuleAndLoad: async () => {
          throw new Error("not used");
        },
        finalizeProofreadingAndLoad: async () => {
          throw new Error("not used");
        },
        publishHumanFinalAndLoad: async () => {
          throw new Error("not used");
        },
        loadJob: async () => {
          throw new Error("not used");
        },
        exportCurrentAsset: async () => {
          throw new Error("not used");
        },
      }}
    />,
  );

  assert.match(markup, /该工作台已根据上一环节稿件自动带入。/);
  assert.match(markup, /评测移交上下文/);
  assert.match(markup, /工作区仍按稿件维度自动加载，以下标识用于保留你进入时的评测样本上下文。/);
  assert.match(markup, /reviewed-case-77/);
  assert.match(markup, /sample-set-item-22/);
});

test("manuscript workbench page shows an explicit loading state while a handed-off workspace is auto-loading", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchPage
      mode="proofreading"
      prefilledManuscriptId="manuscript-9"
      controller={{
        loadWorkspace: async () => {
          throw new Error("not used");
        },
        uploadManuscriptAndLoad: async () => {
          throw new Error("not used");
        },
        runModuleAndLoad: async () => {
          throw new Error("not used");
        },
        finalizeProofreadingAndLoad: async () => {
          throw new Error("not used");
        },
        publishHumanFinalAndLoad: async () => {
          throw new Error("not used");
        },
        loadJob: async () => {
          throw new Error("not used");
        },
        exportCurrentAsset: async () => {
          throw new Error("not used");
        },
      }}
    />,
  );

  assert.match(markup, /正在加载稿件 manuscript-9\.\.\./);
  assert.match(
    markup,
    /正在拉取工作区资产与最新治理状态，完成后即可继续操作。/,
  );
  assert.match(markup, /manuscript-workbench-loading-card/);
});

test("resolveWorkbenchNotice keeps the generic success notice when no posture details are present", () => {
  assert.deepEqual(
    resolveWorkbenchNotice({
      error: "",
      status: "Attached file manuscript.docx",
      latestActionResult: {
        tone: "success",
        actionLabel: "Attach Manuscript File",
        message: "Attached file manuscript.docx",
        details: [
          {
            label: "File",
            value: "manuscript.docx",
          },
        ],
      },
    }),
    {
      tone: "success",
      title: "Action Complete",
      message: "Attached file manuscript.docx",
    },
  );
});

test("resolveWorkbenchNotice keeps the complete notice when job settlement is settled", () => {
  assert.deepEqual(
    resolveWorkbenchNotice({
      error: "",
      status: "Created asset asset-proof-1",
      latestActionResult: {
        tone: "success",
        actionLabel: "Create Draft",
        message: "Created asset asset-proof-1",
        details: [
          {
            label: "Asset",
            value: "asset-proof-1",
          },
          {
            label: "Job Settlement",
            value: "Settled",
          },
        ],
      },
    }),
    {
      tone: "success",
      title: "Action Complete",
      message: "Created asset asset-proof-1",
    },
  );
});

test("resolveWorkbenchNotice downgrades success wording when governed follow-up is retryable", () => {
  assert.deepEqual(
    resolveWorkbenchNotice({
      error: "",
      status: "Created asset asset-edit-2",
      latestActionResult: {
        tone: "success",
        actionLabel: "Run Editing",
        message: "Created asset asset-edit-2",
        details: [
          {
            label: "Asset",
            value: "asset-edit-2",
          },
          {
            label: "Job Settlement",
            value: "Business complete, follow-up retryable",
          },
          {
            label: "Job Recovery",
            value: "Recoverable now",
          },
        ],
      },
    }),
    {
      tone: "success",
      title: "Action Recorded",
      message: "Created asset asset-edit-2 Governed follow-up is retryable and still needs attention.",
    },
  );
});

test("resolveWorkbenchNotice keeps the error notice unchanged", () => {
  assert.deepEqual(
    resolveWorkbenchNotice({
      error: "temporary workspace read failure",
      status: "",
      latestActionResult: {
        tone: "error",
        actionLabel: "Load Workspace",
        message: "temporary workspace read failure",
        details: [],
      },
    }),
    {
      tone: "error",
      title: "Action Error",
      message: "temporary workspace read failure",
    },
  );
});

test("resolveWorkbenchActionOutcomePill keeps the generic success pill when no posture details are present", () => {
  assert.deepEqual(
    resolveWorkbenchActionOutcomePill({
      tone: "success",
      actionLabel: "Attach Manuscript File",
      message: "Attached file manuscript.docx",
      details: [
        {
          label: "File",
          value: "manuscript.docx",
        },
      ],
    }),
    {
      tone: "success",
      label: "成功",
    },
  );
});

test("resolveWorkbenchActionOutcomePill downgrades retryable action posture to an attention pill", () => {
  assert.deepEqual(
    resolveWorkbenchActionOutcomePill({
      tone: "success",
      actionLabel: "Run Editing",
      message: "Created asset asset-edit-2",
      details: [
        {
          label: "Asset",
          value: "asset-edit-2",
        },
        {
          label: "Job Settlement",
          value: "Business complete, follow-up retryable",
        },
      ],
    }),
    {
      tone: "error",
      label: "后续可重试",
    },
  );
});

test("resolveWorkbenchLatestJobExecutionPosturePill prefers hydrated execution tracking over overview fallback", () => {
  assert.deepEqual(
    resolveWorkbenchLatestJobExecutionPosturePill(
      {
        id: "job-editing-1",
        manuscript_id: "manuscript-1",
        module: "editing",
        job_type: "editing_run",
        status: "completed",
        requested_by: "operator-1",
        attempt_count: 2,
        created_at: "2026-04-06T09:40:00.000Z",
        updated_at: "2026-04-06T09:45:00.000Z",
        execution_tracking: {
          observation_status: "reported",
          settlement: {
            derived_status: "business_completed_follow_up_retryable",
            business_completed: true,
            orchestration_completed: false,
            attention_required: false,
            reason: "Editing follow-up is retryable.",
          },
          snapshot: {
            id: "snapshot-editing-1",
            manuscript_id: "manuscript-1",
            module: "editing",
            job_id: "job-editing-1",
            execution_profile_id: "profile-editing",
            module_template_id: "template-editing",
            module_template_version_no: 4,
            prompt_template_id: "prompt-editing",
            prompt_template_version: "2026-04-06",
            skill_package_ids: ["editing-skill-pack"],
            skill_package_versions: ["1.0.0"],
            model_id: "model-editing",
            knowledge_item_ids: ["knowledge-editing-1"],
            created_asset_ids: ["asset-edit-2"],
            created_at: "2026-04-06T09:45:00.000Z",
            agent_execution: {
              observation_status: "reported",
              log_id: "agent-log-editing-1",
              log: {
                id: "agent-log-editing-1",
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
                status: "ready",
                scope: {
                  module: "editing",
                  manuscriptType: "review",
                  templateFamilyId: "template-family-1",
                },
                issues: [],
                execution_profile_alignment: {
                  status: "aligned",
                  binding_execution_profile_id: "profile-editing",
                  active_execution_profile_id: "profile-editing",
                },
              },
            },
          },
        },
      },
      {
        screening: {
          module: "screening",
          observation_status: "not_started",
        },
        editing: {
          module: "editing",
          observation_status: "reported",
          latest_job: {
            id: "job-editing-1",
            manuscript_id: "manuscript-1",
            module: "editing",
            job_type: "editing_run",
            status: "completed",
            requested_by: "operator-1",
            attempt_count: 2,
            created_at: "2026-04-06T09:40:00.000Z",
            updated_at: "2026-04-06T09:45:00.000Z",
          },
          settlement: {
            derived_status: "business_completed_settled",
            business_completed: true,
            orchestration_completed: true,
            attention_required: false,
            reason: "Editing is settled.",
          },
        },
        proofreading: {
          module: "proofreading",
          observation_status: "not_started",
        },
      },
    ),
    {
      tone: "error",
      label: "后续可重试",
    },
  );
});

test("resolveWorkbenchLatestJobExecutionPosturePill falls back to overview-backed posture when hydration is unavailable", () => {
  assert.deepEqual(
    resolveWorkbenchLatestJobExecutionPosturePill(
      {
        id: "job-proofreading-1",
        manuscript_id: "manuscript-2",
        module: "proofreading",
        job_type: "proofreading_finalize",
        status: "completed",
        requested_by: "operator-1",
        attempt_count: 1,
        created_at: "2026-04-06T10:00:00.000Z",
        updated_at: "2026-04-06T10:05:00.000Z",
      },
      {
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
          settlement: {
            derived_status: "business_completed_settled",
            business_completed: true,
            orchestration_completed: true,
            attention_required: false,
            reason: "Editing is settled.",
          },
        },
        proofreading: {
          module: "proofreading",
          observation_status: "reported",
          latest_job: {
            id: "job-proofreading-1",
            manuscript_id: "manuscript-2",
            module: "proofreading",
            job_type: "proofreading_finalize",
            status: "completed",
            requested_by: "operator-1",
            attempt_count: 1,
            created_at: "2026-04-06T10:00:00.000Z",
            updated_at: "2026-04-06T10:05:00.000Z",
          },
          settlement: {
            derived_status: "business_completed_follow_up_pending",
            business_completed: true,
            orchestration_completed: false,
            attention_required: false,
            reason: "Proofreading follow-up is pending.",
          },
          latest_snapshot: {
            id: "snapshot-proofreading-1",
            manuscript_id: "manuscript-2",
            module: "proofreading",
            job_id: "job-proofreading-1",
            execution_profile_id: "profile-proofreading",
            module_template_id: "template-proofreading",
            module_template_version_no: 4,
            prompt_template_id: "prompt-proofreading",
            prompt_template_version: "2026-04-06",
            skill_package_ids: ["proofreading-skill-pack"],
            skill_package_versions: ["1.0.0"],
            model_id: "model-proofreading",
            knowledge_item_ids: ["knowledge-proofreading-1"],
            created_asset_ids: ["asset-proof-1"],
            created_at: "2026-04-06T10:05:00.000Z",
            agent_execution: {
              observation_status: "reported",
              log_id: "agent-log-proofreading-1",
              log: {
                id: "agent-log-proofreading-1",
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
                  reason: "Pending orchestration is recoverable now.",
                },
              },
            },
            runtime_binding_readiness: {
              observation_status: "reported",
              report: {
                status: "ready",
                scope: {
                  module: "proofreading",
                  manuscriptType: "review",
                  templateFamilyId: "template-family-1",
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
    ),
    {
      tone: "neutral",
      label: "后续待处理",
    },
  );
});

test("resolveWorkbenchLatestJobStatusPill keeps raw completed status as neutral evidence when posture is available", () => {
  assert.deepEqual(
    resolveWorkbenchLatestJobStatusPill(
      {
        id: "job-editing-2",
        manuscript_id: "manuscript-3",
        module: "editing",
        job_type: "editing_run",
        status: "completed",
        requested_by: "operator-1",
        attempt_count: 1,
        created_at: "2026-04-06T10:10:00.000Z",
        updated_at: "2026-04-06T10:15:00.000Z",
        execution_tracking: {
          observation_status: "reported",
          settlement: {
            derived_status: "business_completed_follow_up_pending",
            business_completed: true,
            orchestration_completed: false,
            attention_required: false,
            reason: "Editing follow-up is pending.",
          },
          snapshot: {
            id: "snapshot-editing-2",
            manuscript_id: "manuscript-3",
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
            created_asset_ids: ["asset-edit-3"],
            created_at: "2026-04-06T10:15:00.000Z",
            agent_execution: {
              observation_status: "reported",
              log_id: "agent-log-editing-2",
              log: {
                id: "agent-log-editing-2",
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
                  reason: "Pending orchestration is recoverable now.",
                },
              },
            },
            runtime_binding_readiness: {
              observation_status: "reported",
              report: {
                status: "ready",
                scope: {
                  module: "editing",
                  manuscriptType: "review",
                  templateFamilyId: "template-family-1",
                },
                issues: [],
                execution_profile_alignment: {
                  status: "aligned",
                  binding_execution_profile_id: "profile-editing",
                  active_execution_profile_id: "profile-editing",
                },
              },
            },
          },
        },
      },
      undefined,
    ),
    {
      tone: "neutral",
      label: "已完成",
    },
  );
});

test("loadPrefilledWorkbenchWorkspace loads workspace data and creates an operator-facing status result", async () => {
  const workspace = {
    manuscript: {
      id: "manuscript-9",
      title: "Neurology review",
      manuscript_type: "review" as const,
      status: "processing" as const,
      created_by: "editor-1",
      created_at: "2026-03-31T09:00:00.000Z",
      updated_at: "2026-03-31T10:00:00.000Z",
    },
    assets: [],
    currentAsset: null,
    suggestedParentAsset: null,
    latestProofreadingDraftAsset: null,
  };

  let loadWorkspaceArgs: unknown[] | null = null;
  const result = await loadPrefilledWorkbenchWorkspace(
    {
      loadWorkspace: async (...args: unknown[]) => {
        loadWorkspaceArgs = args;
        const manuscriptId = args[0] as string;
        assert.equal(manuscriptId, "manuscript-9");
        return workspace;
      },
      uploadManuscriptAndLoad: async () => {
        throw new Error("not used");
      },
      runModuleAndLoad: async () => {
        throw new Error("not used");
      },
      finalizeProofreadingAndLoad: async () => {
        throw new Error("not used");
      },
      publishHumanFinalAndLoad: async () => {
        throw new Error("not used");
      },
      loadJob: async () => {
        throw new Error("not used");
      },
      exportCurrentAsset: async () => {
        throw new Error("not used");
      },
    },
    "manuscript-9",
  );

  assert.equal(result.workspace, workspace);
  assert.equal(result.latestJob, null);
  assert.equal(result.status, "Auto-loaded manuscript manuscript-9");
  assert.deepEqual(loadWorkspaceArgs, ["manuscript-9"]);
  assert.deepEqual(result.latestActionResult, {
    tone: "success",
    actionLabel: "Load Workspace",
    message: "Auto-loaded manuscript manuscript-9",
    details: [
      {
        label: "Manuscript",
        value: "manuscript-9",
      },
      {
        label: "Current Asset",
        value: "Not available",
      },
    ],
  });
});

test("loadPrefilledWorkbenchWorkspace appends mainline readiness details when manuscript readiness is reported", async () => {
  const workspace = {
    manuscript: {
      id: "manuscript-11",
      title: "Restart-safe readiness",
      manuscript_type: "review" as const,
      status: "processing" as const,
      created_by: "editor-2",
      created_at: "2026-04-06T09:00:00.000Z",
      updated_at: "2026-04-06T10:00:00.000Z",
      mainline_readiness_summary: {
        observation_status: "reported" as const,
        derived_status: "ready_for_next_step" as const,
        next_module: "screening" as const,
        reason: "The manuscript is ready for governed screening.",
      },
      mainline_attention_handoff_pack: {
        observation_status: "reported" as const,
        attention_status: "clear" as const,
        handoff_status: "ready_now" as const,
        to_module: "screening" as const,
        reason: "The manuscript is ready for governed screening.",
        attention_items: [],
      },
      mainline_attempt_ledger: {
        observation_status: "reported" as const,
        total_attempts: 2,
        visible_attempts: 2,
        latest_event_at: "2026-04-06T10:00:00.000Z",
        truncated: false,
        items: [
          {
            module: "editing" as const,
            job_id: "job-editing-ledger-1",
            job_status: "completed" as const,
            job_attempt_count: 2,
            created_at: "2026-04-06T09:50:00.000Z",
            updated_at: "2026-04-06T10:00:00.000Z",
            evidence_status: "snapshot_linked" as const,
            settlement_status: "business_completed_follow_up_retryable" as const,
            orchestration_status: "retryable",
            orchestration_attempt_count: 2,
            recovery_category: "recoverable_now" as const,
            is_latest_for_module: true,
            reason: "Editing follow-up is retryable.",
          },
          {
            module: "screening" as const,
            job_id: "job-screening-ledger-1",
            job_status: "completed" as const,
            job_attempt_count: 1,
            created_at: "2026-04-06T09:20:00.000Z",
            updated_at: "2026-04-06T09:30:00.000Z",
            evidence_status: "snapshot_linked" as const,
            settlement_status: "business_completed_settled" as const,
            orchestration_status: "completed",
            orchestration_attempt_count: 1,
            recovery_category: "not_recoverable" as const,
            is_latest_for_module: true,
            reason: "Screening is settled.",
          },
        ],
      },
    },
    assets: [],
    currentAsset: null,
    suggestedParentAsset: null,
    latestProofreadingDraftAsset: null,
  };

  const result = await loadPrefilledWorkbenchWorkspace(
    {
      loadWorkspace: async () => workspace,
      uploadManuscriptAndLoad: async () => {
        throw new Error("not used");
      },
      runModuleAndLoad: async () => {
        throw new Error("not used");
      },
      finalizeProofreadingAndLoad: async () => {
        throw new Error("not used");
      },
      publishHumanFinalAndLoad: async () => {
        throw new Error("not used");
      },
      loadJob: async () => {
        throw new Error("not used");
      },
      exportCurrentAsset: async () => {
        throw new Error("not used");
      },
    },
    "manuscript-11",
  );

  assert.deepEqual(result.latestActionResult.details, [
    {
      label: "Manuscript",
      value: "manuscript-11",
    },
    {
      label: "Current Asset",
      value: "Not available",
    },
    {
      label: "主线就绪度",
      value: "可进入下一步",
    },
    {
      label: "下一模块",
      value: "初筛",
    },
    {
      label: "就绪原因",
      value: "The manuscript is ready for governed screening.",
    },
    {
      label: "关注状态",
      value: "清晰",
    },
    {
      label: "下一主线交接",
      value: "初筛 可立即交接",
    },
    {
      label: "主要关注原因",
      value: "The manuscript is ready for governed screening.",
    },
    {
      label: "主线尝试",
      value: "共 2 次（显示 2 次）",
    },
    {
      label: "最近主线活动",
      value: "编辑第 2 次尝试 · 业务已完成，后续可重试",
    },
  ]);
});

test("loadPrefilledWorkbenchWorkspace restores the newest tracked mainline job from manuscript settlement overview", async () => {
  const workspace = {
    manuscript: {
      id: "manuscript-10",
      title: "Cardiology review",
      manuscript_type: "review" as const,
      status: "processing" as const,
      created_by: "editor-1",
      created_at: "2026-04-06T09:00:00.000Z",
      updated_at: "2026-04-06T10:00:00.000Z",
      module_execution_overview: {
        screening: {
          module: "screening" as const,
          observation_status: "reported" as const,
          latest_job: {
            id: "job-screen-1",
            manuscript_id: "manuscript-10",
            module: "screening" as const,
            job_type: "screening_run",
            status: "completed" as const,
            requested_by: "editor-1",
            attempt_count: 1,
            created_at: "2026-04-06T09:20:00.000Z",
            updated_at: "2026-04-06T09:21:00.000Z",
          },
        },
        editing: {
          module: "editing" as const,
          observation_status: "reported" as const,
          latest_job: {
            id: "job-edit-2",
            manuscript_id: "manuscript-10",
            module: "editing" as const,
            job_type: "editing_run",
            status: "completed" as const,
            requested_by: "editor-1",
            attempt_count: 2,
            created_at: "2026-04-06T09:40:00.000Z",
            updated_at: "2026-04-06T09:45:00.000Z",
          },
        },
        proofreading: {
          module: "proofreading" as const,
          observation_status: "not_started" as const,
        },
      },
    },
    assets: [],
    currentAsset: null,
    suggestedParentAsset: null,
    latestProofreadingDraftAsset: null,
  };
  const hydratedJob = {
    id: "job-edit-2",
    manuscript_id: "manuscript-10",
    module: "editing" as const,
    job_type: "editing_run",
    status: "completed" as const,
    requested_by: "editor-1",
    attempt_count: 2,
    created_at: "2026-04-06T09:40:00.000Z",
    updated_at: "2026-04-06T09:45:00.000Z",
    execution_tracking: {
      observation_status: "reported" as const,
      snapshot: {
        id: "snapshot-edit-2",
        manuscript_id: "manuscript-10",
        module: "editing" as const,
        job_id: "job-edit-2",
        execution_profile_id: "profile-editing",
        module_template_id: "template-editing",
        module_template_version_no: 4,
        prompt_template_id: "prompt-editing",
        prompt_template_version: "2026-04-06",
        skill_package_ids: ["editing-skill-pack"],
        skill_package_versions: ["1.0.0"],
        model_id: "model-editing",
        knowledge_item_ids: ["knowledge-editing-1"],
        created_asset_ids: ["asset-edit-2"],
        created_at: "2026-04-06T09:45:00.000Z",
        agent_execution: {
          observation_status: "reported" as const,
          log_id: "agent-log-edit-2",
          log: {
            id: "agent-log-edit-2",
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
              reason: "Pending orchestration is ready to replay now.",
            },
          },
        },
        runtime_binding_readiness: {
          observation_status: "reported" as const,
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
        derived_status: "business_completed_follow_up_pending" as const,
        business_completed: true,
        orchestration_completed: false,
        attention_required: false,
        reason: "Business execution is complete and governed follow-up is pending.",
      },
    },
  };

  let loadedJobId = "";
  const result = await loadPrefilledWorkbenchWorkspace(
    {
      loadWorkspace: async () => workspace,
      loadJob: async (jobId: string) => {
        loadedJobId = jobId;
        return hydratedJob;
      },
    },
    "manuscript-10",
  );

  assert.equal(loadedJobId, "job-edit-2");
  assert.deepEqual(result.latestJob, hydratedJob);
  assert.deepEqual(result.latestActionResult.details, [
    {
      label: "Manuscript",
      value: "manuscript-10",
    },
    {
      label: "Current Asset",
      value: "Not available",
    },
    {
      label: "Latest Job",
      value: "job-edit-2",
    },
    {
      label: "最近任务结算",
      value: "业务已完成，后续待处理",
    },
    {
      label: "最近任务恢复",
      value: "当前可恢复",
    },
    {
      label: "最近任务运行时就绪度",
      value: "已降级（2 项问题）",
    },
  ]);
});

test("loadPrefilledWorkbenchWorkspace fails open when latest tracked job hydration cannot be loaded", async () => {
  const fallbackJob = {
    id: "job-proof-3",
    manuscript_id: "manuscript-11",
    module: "proofreading" as const,
    job_type: "proofreading_finalize",
    status: "completed" as const,
    requested_by: "editor-1",
    attempt_count: 3,
    created_at: "2026-04-06T09:50:00.000Z",
    updated_at: "2026-04-06T09:55:00.000Z",
  };
  const workspace = {
    manuscript: {
      id: "manuscript-11",
      title: "Neurology review",
      manuscript_type: "review" as const,
      status: "processing" as const,
      created_by: "editor-1",
      created_at: "2026-04-06T09:00:00.000Z",
      updated_at: "2026-04-06T10:00:00.000Z",
      module_execution_overview: {
        screening: {
          module: "screening" as const,
          observation_status: "not_started" as const,
        },
        editing: {
          module: "editing" as const,
          observation_status: "not_started" as const,
        },
        proofreading: {
          module: "proofreading" as const,
          observation_status: "reported" as const,
          latest_job: fallbackJob,
          latest_snapshot: {
            id: "snapshot-proof-3",
            manuscript_id: "manuscript-11",
            module: "proofreading" as const,
            job_id: "job-proof-3",
            execution_profile_id: "profile-proofreading",
            module_template_id: "template-proofreading",
            module_template_version_no: 4,
            prompt_template_id: "prompt-proofreading",
            prompt_template_version: "2026-04-06",
            skill_package_ids: ["proofreading-skill-pack"],
            skill_package_versions: ["1.0.0"],
            model_id: "model-proofreading",
            knowledge_item_ids: ["knowledge-proofreading-1"],
            created_asset_ids: ["asset-proof-3"],
            created_at: "2026-04-06T10:00:00.000Z",
            agent_execution: {
              observation_status: "reported" as const,
              log_id: "agent-log-proof-3",
              log: {
                id: "agent-log-proof-3",
                status: "completed" as const,
                orchestration_status: "retryable" as const,
                completion_summary: {
                  derived_status: "business_completed_follow_up_retryable" as const,
                  business_completed: true,
                  follow_up_required: true,
                  fully_settled: false,
                  attention_required: false,
                },
                recovery_summary: {
                  category: "recoverable_now" as const,
                  recovery_readiness: "ready_now" as const,
                  reason: "Retryable orchestration is ready now.",
                },
              },
            },
            runtime_binding_readiness: {
              observation_status: "reported" as const,
              report: {
                status: "ready" as const,
                scope: {
                  module: "proofreading" as const,
                  manuscriptType: "review" as const,
                  templateFamilyId: "template-family-1",
                },
                issues: [],
                execution_profile_alignment: {
                  status: "aligned" as const,
                  binding_execution_profile_id: "profile-proofreading",
                  active_execution_profile_id: "profile-proofreading",
                },
              },
            },
          },
          settlement: {
            derived_status: "business_completed_follow_up_retryable" as const,
            business_completed: true,
            orchestration_completed: false,
            attention_required: false,
            reason: "Proofreading follow-up is retryable.",
          },
        },
      },
    },
    assets: [],
    currentAsset: null,
    suggestedParentAsset: null,
    latestProofreadingDraftAsset: null,
  };

  const result = await loadPrefilledWorkbenchWorkspace(
    {
      loadWorkspace: async () => workspace,
      loadJob: async () => {
        throw new Error("temporary read failure");
      },
    },
    "manuscript-11",
  );

  assert.equal(result.workspace, workspace);
  assert.deepEqual(result.latestJob, fallbackJob);
  assert.deepEqual(result.latestActionResult.details, [
    {
      label: "Manuscript",
      value: "manuscript-11",
    },
    {
      label: "Current Asset",
      value: "Not available",
    },
    {
      label: "Latest Job",
      value: "job-proof-3",
    },
    {
      label: "最近任务结算",
      value: "业务已完成，后续可重试",
    },
    {
      label: "最近任务恢复",
      value: "当前可恢复",
    },
    {
      label: "最近任务运行时就绪度",
      value: "就绪",
    },
  ]);
});

test("buildWorkbenchJobActionResultDetails appends hydrated execution posture for job-bearing actions", () => {
  const details = buildWorkbenchJobActionResultDetails(
    [
      {
        label: "Asset",
        value: "asset-editing-1",
      },
      {
        label: "Job",
        value: "job-editing-1",
      },
    ],
    {
      id: "job-editing-1",
      manuscript_id: "manuscript-action-1",
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
          id: "snapshot-editing-1",
          manuscript_id: "manuscript-action-1",
          module: "editing",
          job_id: "job-editing-1",
          execution_profile_id: "profile-editing",
          module_template_id: "template-editing",
          module_template_version_no: 4,
          prompt_template_id: "prompt-editing",
          prompt_template_version: "2026-04-06",
          skill_package_ids: ["editing-skill-pack"],
          skill_package_versions: ["1.0.0"],
          model_id: "model-editing",
          knowledge_item_ids: ["knowledge-editing-1"],
          created_asset_ids: ["asset-editing-1"],
          created_at: "2026-04-06T09:45:00.000Z",
          agent_execution: {
            observation_status: "reported",
            log_id: "agent-log-editing-1",
            log: {
              id: "agent-log-editing-1",
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
  );

  assert.deepEqual(details, [
    {
      label: "Asset",
      value: "asset-editing-1",
    },
    {
      label: "Job",
      value: "job-editing-1",
    },
    {
      label: "Job结算",
      value: "业务已完成，后续可重试",
    },
    {
      label: "Job恢复",
      value: "等待重试窗口",
    },
    {
      label: "Job恢复可用时间",
      value: "2026-04-06 11:30:00Z",
    },
    {
      label: "Job运行时就绪度",
      value: "已降级（1 项问题）",
    },
    {
      label: "知识引用",
      value: "knowledge-editing-1",
    },
    {
      label: "模型版本",
      value: "model-editing",
    },
    {
      label: "原因摘要",
      value: "Business execution is complete and governed follow-up is retryable.",
    },
  ]);
});

test("buildWorkbenchJobActionResultDetails reuses matching overview posture for raw fail-open action-result jobs", () => {
  const buildDetailsWithOverview = buildWorkbenchJobActionResultDetails as unknown as (
    baseDetails: unknown,
    job: unknown,
    overview: unknown,
  ) => Array<{ label: string; value: string }>;
  const details = buildDetailsWithOverview(
    [
      {
        label: "Job",
        value: "job-editing-fallback-1",
      },
      {
        label: "Status",
        value: "completed",
      },
    ],
    {
      id: "job-editing-fallback-1",
      manuscript_id: "manuscript-action-fallback-1",
      module: "editing",
      job_type: "editing_run",
      status: "completed",
      requested_by: "operator-1",
      attempt_count: 1,
      created_at: "2026-04-06T09:40:00.000Z",
      updated_at: "2026-04-06T09:45:00.000Z",
    },
    {
      screening: {
        module: "screening",
        observation_status: "not_started",
      },
      editing: {
        module: "editing",
        observation_status: "reported",
        latest_job: {
          id: "job-editing-fallback-1",
          manuscript_id: "manuscript-action-fallback-1",
          module: "editing",
          job_type: "editing_run",
          status: "completed",
          requested_by: "operator-1",
          attempt_count: 1,
          created_at: "2026-04-06T09:40:00.000Z",
          updated_at: "2026-04-06T09:45:00.000Z",
        },
        latest_snapshot: {
          id: "snapshot-editing-fallback-1",
          manuscript_id: "manuscript-action-fallback-1",
          module: "editing",
          job_id: "job-editing-fallback-1",
          execution_profile_id: "profile-editing",
          module_template_id: "template-editing",
          module_template_version_no: 4,
          prompt_template_id: "prompt-editing",
          prompt_template_version: "2026-04-06",
          skill_package_ids: ["editing-skill-pack"],
          skill_package_versions: ["1.0.0"],
          model_id: "model-editing",
          knowledge_item_ids: ["knowledge-editing-1"],
          created_asset_ids: ["asset-editing-1"],
          created_at: "2026-04-06T09:45:00.000Z",
          agent_execution: {
            observation_status: "reported",
            log_id: "agent-log-editing-fallback-1",
            log: {
              id: "agent-log-editing-fallback-1",
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
  );

  assert.deepEqual(details, [
    {
      label: "Job",
      value: "job-editing-fallback-1",
    },
    {
      label: "Status",
      value: "completed",
    },
    {
      label: "Job结算",
      value: "业务已完成，后续可重试",
    },
    {
      label: "Job恢复",
      value: "当前可恢复",
    },
    {
      label: "Job运行时就绪度",
      value: "已降级（1 项问题）",
    },
  ]);
});

test("buildWorkbenchJobActionResultDetails keeps hydrated execution posture ahead of overview fallback", () => {
  const buildDetailsWithOverview = buildWorkbenchJobActionResultDetails as unknown as (
    baseDetails: unknown,
    job: unknown,
    overview: unknown,
  ) => Array<{ label: string; value: string }>;
  const details = buildDetailsWithOverview(
    [
      {
        label: "Job",
        value: "job-editing-hydrated-wins-1",
      },
    ],
    {
      id: "job-editing-hydrated-wins-1",
      manuscript_id: "manuscript-action-hydrated-wins-1",
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
          id: "snapshot-editing-hydrated-wins-1",
          manuscript_id: "manuscript-action-hydrated-wins-1",
          module: "editing",
          job_id: "job-editing-hydrated-wins-1",
          execution_profile_id: "profile-editing",
          module_template_id: "template-editing",
          module_template_version_no: 4,
          prompt_template_id: "prompt-editing",
          prompt_template_version: "2026-04-06",
          skill_package_ids: ["editing-skill-pack"],
          skill_package_versions: ["1.0.0"],
          model_id: "model-editing",
          knowledge_item_ids: ["knowledge-editing-1"],
          created_asset_ids: ["asset-editing-1"],
          created_at: "2026-04-06T09:45:00.000Z",
          agent_execution: {
            observation_status: "reported",
            log_id: "agent-log-editing-hydrated-wins-1",
            log: {
              id: "agent-log-editing-hydrated-wins-1",
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
              status: "ready",
              scope: {
                module: "editing",
                manuscriptType: "review",
                templateFamilyId: "template-family-1",
              },
              issues: [],
              execution_profile_alignment: {
                status: "aligned",
                binding_execution_profile_id: "profile-editing",
                active_execution_profile_id: "profile-editing",
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
    {
      screening: {
        module: "screening",
        observation_status: "not_started",
      },
      editing: {
        module: "editing",
        observation_status: "reported",
        latest_job: {
          id: "job-editing-hydrated-wins-1",
          manuscript_id: "manuscript-action-hydrated-wins-1",
          module: "editing",
          job_type: "editing_run",
          status: "completed",
          requested_by: "operator-1",
          attempt_count: 1,
          created_at: "2026-04-06T09:40:00.000Z",
          updated_at: "2026-04-06T09:45:00.000Z",
        },
        settlement: {
          derived_status: "business_completed_settled",
          business_completed: true,
          orchestration_completed: true,
          attention_required: false,
          reason: "Editing is settled.",
        },
      },
      proofreading: {
        module: "proofreading",
        observation_status: "not_started",
      },
    },
  );

  assert.deepEqual(details, [
    {
      label: "Job",
      value: "job-editing-hydrated-wins-1",
    },
    {
      label: "Job结算",
      value: "业务已完成，后续可重试",
    },
    {
      label: "Job恢复",
      value: "等待重试窗口",
    },
    {
      label: "Job恢复可用时间",
      value: "2026-04-06 11:30:00Z",
    },
    {
      label: "Job运行时就绪度",
      value: "就绪",
    },
    {
      label: "知识引用",
      value: "knowledge-editing-1",
    },
    {
      label: "模型版本",
      value: "model-editing",
    },
    {
      label: "原因摘要",
      value: "Business execution is complete and governed follow-up is retryable.",
    },
  ]);
});

test("buildWorkbenchJobActionResultDetails fails open to base details when execution posture is unavailable", () => {
  const details = buildWorkbenchJobActionResultDetails(
    [
      {
        label: "Job",
        value: "job-upload-1",
      },
      {
        label: "Status",
        value: "queued",
      },
    ],
    {
      id: "job-upload-1",
      manuscript_id: "manuscript-action-2",
      module: "upload",
      job_type: "manuscript_upload",
      status: "queued",
      requested_by: "operator-1",
      attempt_count: 0,
      created_at: "2026-04-06T09:00:00.000Z",
      updated_at: "2026-04-06T09:00:00.000Z",
    },
  );

  assert.deepEqual(details, [
    {
      label: "Job",
      value: "job-upload-1",
    },
    {
      label: "Status",
      value: "queued",
    },
  ]);
});

test("buildWorkbenchJobActionResultDetails appends review evidence summary for proofreading jobs", () => {
  const details = buildWorkbenchJobActionResultDetails(
    [
      {
        label: "Asset",
        value: "asset-proof-evidence-1",
      },
      {
        label: "Job",
        value: "job-proof-evidence-1",
      },
    ],
    {
      id: "job-proof-evidence-1",
      manuscript_id: "manuscript-proof-evidence-1",
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
            },
            {
              ruleId: "rule-abbreviation",
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
          manuscript_id: "manuscript-proof-evidence-1",
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
          created_asset_ids: ["asset-proof-evidence-1"],
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
  );

  assert.deepEqual(
    details.filter((detail) =>
      [
        "人工复核",
        "规则命中",
        "知识引用",
        "模型版本",
        "原因摘要",
      ].includes(detail.label)
    ),
    [
      {
        label: "人工复核",
        value: "需要人工复核（2 项）",
      },
      {
        label: "规则命中",
        value: "rule-table-header, rule-abbreviation",
      },
      {
        label: "知识引用",
        value: "knowledge-proofreading-1, knowledge-proofreading-2",
      },
      {
        label: "模型版本",
        value: "model-proofreading-1 / 2026-04-07",
      },
      {
        label: "原因摘要",
        value: "术语缩写需要人工确认。 | 表头格式需要人工复核。",
      },
    ],
  );
});

test("refreshLatestWorkbenchJobContext refreshes the latest job and resynchronizes workspace when both reads succeed", async () => {
  const refreshedWorkspace = {
    manuscript: {
      id: "manuscript-refresh-1",
      title: "Resynchronized manuscript",
      manuscript_type: "review" as const,
      status: "processing" as const,
      created_by: "operator-1",
      current_editing_asset_id: "asset-edited-2",
      mainline_readiness_summary: {
        observation_status: "reported" as const,
        derived_status: "ready_for_next_step" as const,
        next_module: "proofreading" as const,
        reason: "Editing is settled and proofreading can begin.",
      },
      mainline_attention_handoff_pack: {
        observation_status: "reported" as const,
        attention_status: "clear" as const,
        handoff_status: "ready_now" as const,
        from_module: "editing" as const,
        to_module: "proofreading" as const,
        latest_job_id: "job-editing-refresh-1",
        latest_snapshot_id: "snapshot-refresh-1",
        reason: "Editing is settled and proofreading can begin.",
        attention_items: [],
      },
      mainline_attempt_ledger: {
        observation_status: "reported" as const,
        total_attempts: 2,
        visible_attempts: 2,
        latest_event_at: "2026-04-06T11:45:00.000Z",
        truncated: false,
        items: [
          {
            module: "editing" as const,
            job_id: "job-editing-refresh-1",
            job_status: "completed" as const,
            job_attempt_count: 2,
            created_at: "2026-04-06T11:30:00.000Z",
            updated_at: "2026-04-06T11:45:00.000Z",
            evidence_status: "snapshot_linked" as const,
            settlement_status: "business_completed_settled" as const,
            orchestration_status: "completed",
            orchestration_attempt_count: 1,
            recovery_category: "not_recoverable" as const,
            is_latest_for_module: true,
            reason: "Editing is settled.",
          },
          {
            module: "screening" as const,
            job_id: "job-screening-refresh-1",
            job_status: "completed" as const,
            job_attempt_count: 1,
            created_at: "2026-04-06T10:40:00.000Z",
            updated_at: "2026-04-06T10:55:00.000Z",
            evidence_status: "job_only" as const,
            is_latest_for_module: true,
            reason: "Screening completed without linked snapshot evidence.",
          },
        ],
      },
      module_execution_overview: {
        screening: {
          module: "screening" as const,
          observation_status: "reported" as const,
          settlement: {
            derived_status: "business_completed_settled" as const,
            business_completed: true,
            orchestration_completed: true,
            attention_required: false,
            reason: "Screening is settled.",
          },
        },
        editing: {
          module: "editing" as const,
          observation_status: "reported" as const,
          settlement: {
            derived_status: "business_completed_settled" as const,
            business_completed: true,
            orchestration_completed: true,
            attention_required: false,
            reason: "Editing is settled.",
          },
        },
        proofreading: {
          module: "proofreading" as const,
          observation_status: "not_started" as const,
        },
      },
      created_at: "2026-04-06T09:00:00.000Z",
      updated_at: "2026-04-06T11:45:00.000Z",
    },
    assets: [
      {
        id: "asset-edited-2",
        manuscript_id: "manuscript-refresh-1",
        asset_type: "edited_docx" as const,
        status: "active" as const,
        storage_key: "runs/editing/settled.docx",
        mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        source_module: "editing" as const,
        source_job_id: "job-editing-refresh-1",
        created_by: "operator-1",
        version_no: 2,
        is_current: true,
        file_name: "editing-settled.docx",
        created_at: "2026-04-06T11:40:00.000Z",
        updated_at: "2026-04-06T11:40:00.000Z",
      },
    ],
    currentAsset: {
      id: "asset-edited-2",
      manuscript_id: "manuscript-refresh-1",
      asset_type: "edited_docx" as const,
      status: "active" as const,
      storage_key: "runs/editing/settled.docx",
      mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      source_module: "editing" as const,
      source_job_id: "job-editing-refresh-1",
      created_by: "operator-1",
      version_no: 2,
      is_current: true,
      file_name: "editing-settled.docx",
      created_at: "2026-04-06T11:40:00.000Z",
      updated_at: "2026-04-06T11:40:00.000Z",
    },
    suggestedParentAsset: {
      id: "asset-edited-2",
      manuscript_id: "manuscript-refresh-1",
      asset_type: "edited_docx" as const,
      status: "active" as const,
      storage_key: "runs/editing/settled.docx",
      mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      source_module: "editing" as const,
      source_job_id: "job-editing-refresh-1",
      created_by: "operator-1",
      version_no: 2,
      is_current: true,
      file_name: "editing-settled.docx",
      created_at: "2026-04-06T11:40:00.000Z",
      updated_at: "2026-04-06T11:40:00.000Z",
    },
    latestProofreadingDraftAsset: null,
  };
  const refreshedJob = {
    id: "job-editing-refresh-1",
    manuscript_id: "manuscript-refresh-1",
    module: "editing" as const,
    job_type: "editing_run",
    status: "completed" as const,
    requested_by: "operator-1",
    attempt_count: 2,
    created_at: "2026-04-06T11:30:00.000Z",
    updated_at: "2026-04-06T11:45:00.000Z",
    execution_tracking: {
      observation_status: "reported" as const,
      settlement: {
        derived_status: "business_completed_settled" as const,
        business_completed: true,
        orchestration_completed: true,
        attention_required: false,
        reason: "Editing is settled.",
      },
      snapshot: {
        id: "snapshot-refresh-1",
        manuscript_id: "manuscript-refresh-1",
        module: "editing" as const,
        job_id: "job-editing-refresh-1",
        execution_profile_id: "profile-editing",
        module_template_id: "template-editing",
        module_template_version_no: 4,
        prompt_template_id: "prompt-editing",
        prompt_template_version: "2026-04-06",
        skill_package_ids: ["editing-skill-pack"],
        skill_package_versions: ["1.0.0"],
        model_id: "model-editing",
        knowledge_item_ids: ["knowledge-editing-1"],
        created_asset_ids: ["asset-edited-2"],
        created_at: "2026-04-06T11:45:00.000Z",
        agent_execution: {
          observation_status: "reported" as const,
          log_id: "agent-log-refresh-1",
          log: {
            id: "agent-log-refresh-1",
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
              category: "not_recoverable" as const,
              recovery_readiness: "not_recoverable" as const,
              reason: "No recovery needed.",
            },
          },
        },
        runtime_binding_readiness: {
          observation_status: "reported" as const,
          report: {
            status: "ready" as const,
            scope: {
              module: "editing" as const,
              manuscriptType: "review" as const,
              templateFamilyId: "template-family-1",
            },
            issues: [],
            execution_profile_alignment: {
              status: "aligned" as const,
              binding_execution_profile_id: "profile-editing",
              active_execution_profile_id: "profile-editing",
            },
          },
        },
      },
    },
  };

  const result = await refreshLatestWorkbenchJobContext(
    {
      loadJob: async (jobId: string) => {
        assert.equal(jobId, "job-editing-refresh-1");
        return refreshedJob;
      },
      loadWorkspace: async (manuscriptId: string) => {
        assert.equal(manuscriptId, "manuscript-refresh-1");
        return refreshedWorkspace;
      },
    },
    {
      manuscriptId: "manuscript-refresh-1",
      latestJobId: "job-editing-refresh-1",
    },
  );

  assert.deepEqual(result.latestJob, refreshedJob);
  assert.deepEqual(result.workspace, refreshedWorkspace);
  assert.equal(result.status, "Refreshed job job-editing-refresh-1");
  assert.deepEqual(result.latestActionResult.details, [
    {
      label: "Job",
      value: "job-editing-refresh-1",
    },
    {
      label: "Status",
      value: "completed",
    },
    {
      label: "Job结算",
      value: "已结算",
    },
    {
      label: "Job恢复",
      value: "无需恢复",
    },
    {
      label: "Job运行时就绪度",
      value: "就绪",
    },
    {
      label: "知识引用",
      value: "knowledge-editing-1",
    },
    {
      label: "模型版本",
      value: "model-editing",
    },
    {
      label: "原因摘要",
      value: "Editing is settled.",
    },
    {
      label: "主线就绪度",
      value: "可进入下一步",
    },
    {
      label: "下一模块",
      value: "校对",
    },
    {
      label: "就绪原因",
      value: "Editing is settled and proofreading can begin.",
    },
    {
      label: "关注状态",
      value: "清晰",
    },
    {
      label: "下一主线交接",
      value: "编辑 -> 校对 可立即交接",
    },
    {
      label: "主要关注原因",
      value: "Editing is settled and proofreading can begin.",
    },
    {
      label: "主线尝试",
      value: "共 2 次（显示 2 次）",
    },
    {
      label: "最近主线活动",
      value: "编辑第 2 次尝试 · 已结算",
    },
  ]);
});

test("refreshLatestWorkbenchJobContext fails open when workspace resynchronization fails after job refresh", async () => {
  const refreshedJob = {
    id: "job-editing-refresh-2",
    manuscript_id: "manuscript-refresh-2",
    module: "editing" as const,
    job_type: "editing_run",
    status: "completed" as const,
    requested_by: "operator-1",
    attempt_count: 2,
    created_at: "2026-04-06T11:30:00.000Z",
    updated_at: "2026-04-06T11:45:00.000Z",
    execution_tracking: {
      observation_status: "reported" as const,
      settlement: {
        derived_status: "business_completed_follow_up_retryable" as const,
        business_completed: true,
        orchestration_completed: false,
        attention_required: false,
        reason: "Editing follow-up is retryable.",
      },
      snapshot: {
        id: "snapshot-refresh-2",
        manuscript_id: "manuscript-refresh-2",
        module: "editing" as const,
        job_id: "job-editing-refresh-2",
        execution_profile_id: "profile-editing",
        module_template_id: "template-editing",
        module_template_version_no: 4,
        prompt_template_id: "prompt-editing",
        prompt_template_version: "2026-04-06",
        skill_package_ids: ["editing-skill-pack"],
        skill_package_versions: ["1.0.0"],
        model_id: "model-editing",
        knowledge_item_ids: ["knowledge-editing-1"],
        created_asset_ids: ["asset-edited-2"],
        created_at: "2026-04-06T11:45:00.000Z",
        agent_execution: {
          observation_status: "reported" as const,
          log_id: "agent-log-refresh-2",
          log: {
            id: "agent-log-refresh-2",
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
              category: "recoverable_now" as const,
              recovery_readiness: "ready_now" as const,
              reason: "Retryable orchestration is ready now.",
            },
          },
        },
        runtime_binding_readiness: {
          observation_status: "reported" as const,
          report: {
            status: "degraded" as const,
            scope: {
              module: "editing" as const,
              manuscriptType: "review" as const,
              templateFamilyId: "template-family-1",
            },
            issues: [
              {
                code: "runtime_not_active",
                message: "Runtime is not active.",
              },
            ],
            execution_profile_alignment: {
              status: "drifted" as const,
              binding_execution_profile_id: "profile-editing",
              active_execution_profile_id: "profile-editing-active",
            },
          },
        },
      },
    },
  };

  const result = await refreshLatestWorkbenchJobContext(
    {
      loadJob: async () => refreshedJob,
      loadWorkspace: async () => {
        throw new Error("temporary workspace read failure");
      },
    },
    {
      manuscriptId: "manuscript-refresh-2",
      latestJobId: "job-editing-refresh-2",
    },
  );

  assert.deepEqual(result.latestJob, refreshedJob);
  assert.equal(result.workspace, null);
  assert.equal(result.status, "Refreshed job job-editing-refresh-2");
  assert.deepEqual(result.latestActionResult.details, [
    {
      label: "Job",
      value: "job-editing-refresh-2",
    },
    {
      label: "Status",
      value: "completed",
    },
    {
      label: "Job结算",
      value: "业务已完成，后续可重试",
    },
    {
      label: "Job恢复",
      value: "当前可恢复",
    },
    {
      label: "Job运行时就绪度",
      value: "已降级（1 项问题）",
    },
    {
      label: "知识引用",
      value: "knowledge-editing-1",
    },
    {
      label: "模型版本",
      value: "model-editing",
    },
    {
      label: "原因摘要",
      value: "Editing follow-up is retryable.",
    },
  ]);
});

test("manuscript workbench summary renders mainline readiness and uses it for mainline recommendation when available", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      mode="screening"
      accessibleHandoffModes={["editing"]}
      workspace={{
        manuscript: {
          id: "manuscript-ready-1",
          title: "Ready manuscript",
          manuscript_type: "review",
          status: "processing",
          created_by: "editor-1",
          current_screening_asset_id: "asset-screening-ready-1",
          created_at: "2026-04-06T08:00:00.000Z",
          updated_at: "2026-04-06T08:30:00.000Z",
          mainline_readiness_summary: {
            observation_status: "reported",
            derived_status: "ready_for_next_step",
            next_module: "editing",
            reason: "Screening is settled and editing can begin.",
          },
        },
        assets: [
          {
            id: "asset-screening-ready-1",
            manuscript_id: "manuscript-ready-1",
            asset_type: "screening_report",
            status: "active",
            storage_key: "runs/manuscript-ready-1/screening/output.md",
            mime_type: "text/markdown",
            source_module: "screening",
            source_job_id: "job-screening-ready-1",
            created_by: "editor-1",
            version_no: 2,
            is_current: true,
            file_name: "screening-output.md",
            created_at: "2026-04-06T08:20:00.000Z",
            updated_at: "2026-04-06T08:20:00.000Z",
          },
        ],
        currentAsset: {
          id: "asset-screening-ready-1",
          manuscript_id: "manuscript-ready-1",
          asset_type: "screening_report",
          status: "active",
          storage_key: "runs/manuscript-ready-1/screening/output.md",
          mime_type: "text/markdown",
          source_module: "screening",
          source_job_id: "job-screening-ready-1",
          created_by: "editor-1",
          version_no: 2,
          is_current: true,
          file_name: "screening-output.md",
          created_at: "2026-04-06T08:20:00.000Z",
          updated_at: "2026-04-06T08:20:00.000Z",
        },
        suggestedParentAsset: {
          id: "asset-screening-ready-1",
          manuscript_id: "manuscript-ready-1",
          asset_type: "screening_report",
          status: "active",
          storage_key: "runs/manuscript-ready-1/screening/output.md",
          mime_type: "text/markdown",
          source_module: "screening",
          source_job_id: "job-screening-ready-1",
          created_by: "editor-1",
          version_no: 2,
          is_current: true,
          file_name: "screening-output.md",
          created_at: "2026-04-06T08:20:00.000Z",
          updated_at: "2026-04-06T08:20:00.000Z",
        },
        latestProofreadingDraftAsset: null,
      }}
      latestJob={null}
      latestExport={null}
      latestActionResult={null}
    />,
  );

  assert.match(markup, /主线就绪度/);
  assert.match(markup, /可进入下一步/);
  assert.match(markup, /下一模块/);
  assert.match(markup, /editing/);
  assert.match(markup, /推进稿件进入编辑/);
  assert.match(markup, /Screening is settled and editing can begin\./);
  assert.match(markup, /前往编辑工作台/);
});

test("manuscript workbench summary renders recent mainline activity inside the manuscript overview card", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      mode="editing"
      workspace={{
        manuscript: {
          id: "manuscript-ledger-1",
          title: "Timeline manuscript",
          manuscript_type: "review",
          status: "processing",
          created_by: "editor-ledger",
          created_at: "2026-04-06T08:00:00.000Z",
          updated_at: "2026-04-06T10:30:00.000Z",
          mainline_attention_handoff_pack: {
            observation_status: "reported",
            attention_status: "action_required",
            handoff_status: "blocked_by_attention",
            focus_module: "editing",
            from_module: "editing",
            to_module: "proofreading",
            latest_job_id: "job-editing-ledger-2",
            latest_snapshot_id: "snapshot-editing-ledger-2",
            reason: "Editing follow-up is retryable before proofreading can begin.",
            attention_items: [
              {
                module: "editing",
                kind: "follow_up_retryable",
                severity: "action_required",
                job_id: "job-editing-ledger-2",
                snapshot_id: "snapshot-editing-ledger-2",
                recovery_ready_at: "2026-04-06T10:31:00.000Z",
                summary: "Governed follow-up can be retried before proofreading handoff.",
              },
            ],
          },
          mainline_attempt_ledger: {
            observation_status: "reported",
            total_attempts: 3,
            visible_attempts: 3,
            latest_event_at: "2026-04-06T10:30:00.000Z",
            truncated: false,
            items: [
              {
                module: "editing",
                job_id: "job-editing-ledger-2",
                job_status: "completed",
                job_attempt_count: 2,
                created_at: "2026-04-06T10:00:00.000Z",
                updated_at: "2026-04-06T10:30:00.000Z",
                evidence_status: "snapshot_linked",
                settlement_status: "business_completed_follow_up_retryable",
                orchestration_status: "retryable",
                orchestration_attempt_count: 2,
                recovery_category: "recoverable_now",
                is_latest_for_module: true,
                reason: "Editing follow-up is retryable.",
              },
              {
                module: "editing",
                job_id: "job-editing-ledger-1",
                job_status: "failed",
                job_attempt_count: 1,
                created_at: "2026-04-06T09:20:00.000Z",
                updated_at: "2026-04-06T09:30:00.000Z",
                evidence_status: "job_only",
                is_latest_for_module: false,
                reason: "Latest job failed before snapshot evidence was written.",
              },
              {
                module: "screening",
                job_id: "job-screening-ledger-1",
                job_status: "completed",
                job_attempt_count: 1,
                created_at: "2026-04-06T08:20:00.000Z",
                updated_at: "2026-04-06T08:40:00.000Z",
                evidence_status: "snapshot_linked",
                settlement_status: "business_completed_settled",
                orchestration_status: "completed",
                orchestration_attempt_count: 1,
                recovery_category: "not_recoverable",
                is_latest_for_module: true,
                reason: "Screening is settled.",
              },
            ],
          },
        },
        assets: [],
        currentAsset: null,
        suggestedParentAsset: null,
        latestProofreadingDraftAsset: null,
      }}
      latestJob={null}
      latestExport={null}
      latestActionResult={null}
    />,
  );

  assert.match(markup, /关注状态/);
  assert.match(markup, /需要处理/);
  assert.match(markup, /下一主线交接/);
  assert.match(markup, /编辑 -&gt; 校对/);
  assert.match(markup, /主要关注原因/);
  assert.match(
    markup,
    /Editing follow-up is retryable before proofreading can begin\./i,
  );
  assert.match(markup, /关注事项/);
  assert.match(
    markup,
    /Governed follow-up can be retried before proofreading handoff\./i,
  );
  assert.match(markup, /主线尝试/);
  assert.match(markup, /共 3 次（显示 3 次）/);
  assert.match(markup, /最近主线活动/);
  assert.match(markup, /编辑第 2 次尝试/);
  assert.match(markup, /editing follow-up is retryable\./i);
  assert.match(markup, /初筛第 1 次尝试/);
});

test("manuscript workbench summary shows prepared export metadata for finalized proofreading output", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchSummary
      mode="proofreading"
      workspace={{
        manuscript: {
          id: "manuscript-9",
          title: "Neurology review",
          manuscript_type: "review",
          status: "completed",
          created_by: "editor-1",
          current_proofreading_asset_id: "asset-proof-final-1",
          created_at: "2026-03-31T09:00:00.000Z",
          updated_at: "2026-03-31T10:00:00.000Z",
        },
        assets: [
          {
            id: "asset-proof-final-1",
            manuscript_id: "manuscript-9",
            asset_type: "final_proof_annotated_docx",
            status: "active",
            storage_key: "runs/manuscript-9/proofreading/final",
            mime_type:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            parent_asset_id: "asset-proof-draft-1",
            source_module: "proofreading",
            source_job_id: "job-proof-final-1",
            created_by: "proofreader-1",
            version_no: 4,
            is_current: true,
            file_name: "proofreading-final.docx",
            created_at: "2026-03-31T10:00:00.000Z",
            updated_at: "2026-03-31T10:00:00.000Z",
          },
        ],
        currentAsset: {
          id: "asset-proof-final-1",
          manuscript_id: "manuscript-9",
          asset_type: "final_proof_annotated_docx",
          status: "active",
          storage_key: "runs/manuscript-9/proofreading/final",
          mime_type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          parent_asset_id: "asset-proof-draft-1",
          source_module: "proofreading",
          source_job_id: "job-proof-final-1",
          created_by: "proofreader-1",
          version_no: 4,
          is_current: true,
          file_name: "proofreading-final.docx",
          created_at: "2026-03-31T10:00:00.000Z",
          updated_at: "2026-03-31T10:00:00.000Z",
        },
        suggestedParentAsset: null,
        latestProofreadingDraftAsset: {
          id: "asset-proof-draft-1",
          manuscript_id: "manuscript-9",
          asset_type: "proofreading_draft_report",
          status: "superseded",
          storage_key: "runs/manuscript-9/proofreading/output",
          mime_type: "text/markdown",
          parent_asset_id: "asset-edited-1",
          source_module: "proofreading",
          source_job_id: "job-proof-draft-1",
          created_by: "proofreader-1",
          version_no: 3,
          is_current: false,
          file_name: "proofreading-output",
          created_at: "2026-03-31T09:45:00.000Z",
          updated_at: "2026-03-31T09:45:00.000Z",
        },
      }}
      latestJob={null}
      latestExport={{
        manuscript_id: "manuscript-9",
        asset: {
          id: "asset-proof-final-1",
          manuscript_id: "manuscript-9",
          asset_type: "final_proof_annotated_docx",
          status: "active",
          storage_key: "runs/manuscript-9/proofreading/final",
          mime_type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          parent_asset_id: "asset-proof-draft-1",
          source_module: "proofreading",
          source_job_id: "job-proof-final-1",
          created_by: "proofreader-1",
          version_no: 4,
          is_current: true,
          file_name: "proofreading-final.docx",
          created_at: "2026-03-31T10:00:00.000Z",
          updated_at: "2026-03-31T10:00:00.000Z",
        },
        download: {
          storage_key: "runs/manuscript-9/proofreading/final",
          file_name: "proofreading-final.docx",
          mime_type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          url: "/api/v1/document-assets/asset-proof-final-1/download",
        },
      }}
      latestActionResult={null}
    />,
  );

  assert.match(markup, /最近导出/);
  assert.match(markup, /已准备好下游交付/);
  assert.match(markup, /导出文件名/);
  assert.match(markup, /proofreading-final\.docx/);
  assert.match(markup, /下载 MIME 类型/);
  assert.match(markup, /Word 文档（DOCX）/);
  assert.match(markup, /下载最近导出/);
  assert.match(
    markup,
    /href="http:\/\/localhost\/api\/v1\/document-assets\/asset-proof-final-1\/download"/,
  );
});
