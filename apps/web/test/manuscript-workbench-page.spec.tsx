import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildWorkbenchJobActionResultDetails,
  loadPrefilledWorkbenchWorkspace,
  refreshLatestWorkbenchJobContext,
  ManuscriptWorkbenchPage,
} from "../src/features/manuscript-workbench/manuscript-workbench-page.tsx";
import { ManuscriptWorkbenchSummary } from "../src/features/manuscript-workbench/manuscript-workbench-summary.tsx";

test("submission workbench renders a real file picker for inline uploads", () => {
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

  assert.match(markup, /type="file"/);
  assert.match(markup, /Storage Key/);
  assert.match(markup, /Upload Manuscript/);
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
  assert.match(markup, /This workbench was prefilled from the previous manuscript handoff\./);
  assert.doesNotMatch(markup, /Evaluation Handoff Context/);
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

  assert.match(markup, /This workbench was prefilled from the previous manuscript handoff\./);
  assert.match(markup, /Evaluation Handoff Context/);
  assert.match(markup, /Workspace auto-load remains manuscript-scoped\. These IDs identify the evaluation sample context you navigated from\./);
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

  assert.match(markup, /Loading manuscript manuscript-9\.\.\./);
  assert.match(
    markup,
    /Fetching workspace assets and latest governed state before enabling actions\./,
  );
  assert.match(markup, /manuscript-workbench-loading-card/);
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
      label: "Latest Job Settlement",
      value: "Business complete, follow-up pending",
    },
    {
      label: "Latest Job Recovery",
      value: "Recoverable now",
    },
    {
      label: "Latest Job Runtime Readiness",
      value: "Degraded (2 issues)",
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
      label: "Latest Job Settlement",
      value: "Business complete, follow-up retryable",
    },
    {
      label: "Latest Job Recovery",
      value: "Recoverable now",
    },
    {
      label: "Latest Job Runtime Readiness",
      value: "Ready",
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
      label: "Job Settlement",
      value: "Business complete, follow-up retryable",
    },
    {
      label: "Job Recovery",
      value: "Waiting for retry window",
    },
    {
      label: "Job Recovery Ready At",
      value: "2026-04-06 11:30:00Z",
    },
    {
      label: "Job Runtime Readiness",
      value: "Degraded (1 issue)",
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
      label: "Job Settlement",
      value: "Business complete, follow-up retryable",
    },
    {
      label: "Job Recovery",
      value: "Recoverable now",
    },
    {
      label: "Job Runtime Readiness",
      value: "Degraded (1 issue)",
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
      label: "Job Settlement",
      value: "Business complete, follow-up retryable",
    },
    {
      label: "Job Recovery",
      value: "Waiting for retry window",
    },
    {
      label: "Job Recovery Ready At",
      value: "2026-04-06 11:30:00Z",
    },
    {
      label: "Job Runtime Readiness",
      value: "Ready",
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

test("refreshLatestWorkbenchJobContext refreshes the latest job and resynchronizes workspace when both reads succeed", async () => {
  const refreshedWorkspace = {
    manuscript: {
      id: "manuscript-refresh-1",
      title: "Resynchronized manuscript",
      manuscript_type: "review" as const,
      status: "processing" as const,
      created_by: "operator-1",
      current_editing_asset_id: "asset-edited-2",
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
      label: "Job Settlement",
      value: "Settled",
    },
    {
      label: "Job Recovery",
      value: "No recovery needed",
    },
    {
      label: "Job Runtime Readiness",
      value: "Ready",
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
      label: "Job Settlement",
      value: "Business complete, follow-up retryable",
    },
    {
      label: "Job Recovery",
      value: "Recoverable now",
    },
    {
      label: "Job Runtime Readiness",
      value: "Degraded (1 issue)",
    },
  ]);
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

  assert.match(markup, /Latest Export/);
  assert.match(markup, /Prepared for downstream delivery/);
  assert.match(markup, /Export File Name/);
  assert.match(markup, /proofreading-final\.docx/);
  assert.match(markup, /Download MIME Type/);
  assert.match(
    markup,
    /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/,
  );
  assert.match(markup, /Download Latest Export/);
  assert.match(
    markup,
    /href="http:\/\/localhost\/api\/v1\/document-assets\/asset-proof-final-1\/download"/,
  );
});
