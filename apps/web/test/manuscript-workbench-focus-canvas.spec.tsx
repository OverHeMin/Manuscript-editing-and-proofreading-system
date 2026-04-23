import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ManuscriptWorkbenchFocusCanvas } from "../src/features/manuscript-workbench/manuscript-workbench-page.tsx";

function createWorkspace() {
  return {
    manuscript: {
      id: "manuscript-1",
      title: "Neurology review",
      manuscript_type: "review",
      manuscript_type_detection_summary: {
        confidence_level: "low",
        confidence: 0.43,
        requires_operator_review: true,
      },
      governed_execution_context_summary: {
        observation_status: "reported",
        manuscript_type: "review",
        base_template_family_id: "family-review",
        journal_template_selection_state: "base_family_only",
        modules: [
          {
            module: "screening",
            status: "resolved",
            execution_profile_id: "screening-profile-1",
            retrieval_preset_id: "retrieval-screening-v1",
            runtime_binding_id: "binding-screening-v2",
            runtime_binding_readiness_status: "ready",
          },
          {
            module: "editing",
            status: "resolved",
            execution_profile_id: "editing-profile-1",
            retrieval_preset_id: "retrieval-editing-v1",
            runtime_binding_id: "binding-editing-v2",
            runtime_binding_readiness_status: "ready",
          },
        ],
      },
      module_execution_overview: {
        screening: {
          module: "screening",
          observation_status: "reported",
          latest_job: {
            id: "job-screening-queued-1",
            manuscript_id: "manuscript-1",
            module: "screening",
            job_type: "screening_run",
            status: "queued",
            requested_by: "editor-1",
            attempt_count: 0,
            created_at: "2026-04-15T09:06:00.000Z",
            updated_at: "2026-04-15T09:06:00.000Z",
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
      status: "uploaded",
      created_by: "editor-1",
      current_template_family_id: undefined,
      current_journal_template_id: undefined,
      created_at: "2026-04-15T09:00:00.000Z",
      updated_at: "2026-04-15T09:05:00.000Z",
    },
    assets: [
      {
        id: "asset-original-1",
        manuscript_id: "manuscript-1",
        asset_type: "original",
        status: "active",
        storage_key: "uploads/neurology-review.docx",
        mime_type:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        source_module: "upload",
        created_by: "editor-1",
        version_no: 1,
        is_current: true,
        file_name: "neurology-review.docx",
        created_at: "2026-04-15T09:00:00.000Z",
        updated_at: "2026-04-15T09:00:00.000Z",
      },
    ],
    currentAsset: {
      id: "asset-original-1",
      manuscript_id: "manuscript-1",
      asset_type: "original",
      status: "active",
      storage_key: "uploads/neurology-review.docx",
      mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      source_module: "upload",
      created_by: "editor-1",
      version_no: 1,
      is_current: true,
      file_name: "neurology-review.docx",
      created_at: "2026-04-15T09:00:00.000Z",
      updated_at: "2026-04-15T09:00:00.000Z",
    },
    suggestedParentAsset: {
      id: "asset-original-1",
      manuscript_id: "manuscript-1",
      asset_type: "original",
      status: "active",
      storage_key: "uploads/neurology-review.docx",
      mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      source_module: "upload",
      created_by: "editor-1",
      version_no: 1,
      is_current: true,
      file_name: "neurology-review.docx",
      created_at: "2026-04-15T09:00:00.000Z",
      updated_at: "2026-04-15T09:00:00.000Z",
    },
    latestProofreadingDraftAsset: null,
    moduleExecutionConcurrency: {
      active: {
        global: 1,
        screening: 1,
        editing: 0,
        proofreading: 0,
      },
      queued: {
        global: 2,
        screening: 1,
        editing: 1,
        proofreading: 0,
      },
      limits: {
        global: 2,
        screening: 2,
        editing: 1,
        proofreading: 1,
      },
    },
  } as never;
}

test("focus canvas surfaces the current module state without exposing internal binding identifiers", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchFocusCanvas
      mode="screening"
      busy={false}
      workspace={createWorkspace()}
      detectedManuscriptTypeLabel="Review (needs manual confirmation)"
      templateSelection={undefined}
      primaryActions={[
        {
          title: "Screening Run",
          selectedAssetId: "asset-original-1",
          emptyLabel: "Select asset",
          actionLabel: "Run Screening",
          options: [
            {
              value: "asset-original-1",
              label: "Original manuscript / neurology-review.docx",
            },
          ],
          selectedContextLabel: "Selected Parent Asset",
          onSelect: () => {},
          onRun: () => {},
        },
      ]}
      supportingSummary={<div data-supporting-summary="yes">supporting summary</div>}
    />,
  );

  assert.match(markup, /data-focus-canvas="manuscript-first"/);
  assert.match(markup, /data-module-status-card="screening"/);
  assert.match(markup, /data-module-status="queued"/);
  assert.match(markup, /data-concurrency-scope="global"/);
  assert.match(markup, /data-concurrency-scope="screening"/);
  assert.match(markup, /Queued/);
  assert.match(markup, /Will start automatically when a screening slot is free\./);
  assert.match(markup, /Active 1 \/ 2/);
  assert.match(markup, /Queued 1 \/ 2/);
  assert.match(markup, /data-action-row="sticky"/);
  assert.match(markup, /模块准备情况/u);
  assert.match(markup, /已按当前模板准备当前模块/u);
  assert.match(markup, /准备状态/u);
  assert.match(markup, /已准备/u);
  assert.match(markup, /AI 状态/u);
  assert.match(markup, /就绪/u);
  assert.doesNotMatch(markup, /自动绑定执行上下文/u);
  assert.doesNotMatch(markup, /执行画像/u);
  assert.doesNotMatch(markup, /检索预设/u);
  assert.doesNotMatch(markup, /运行时绑定/u);
  assert.doesNotMatch(markup, /screening-profile-1/);
  assert.doesNotMatch(markup, /retrieval-screening-v1/);
  assert.doesNotMatch(markup, /binding-screening-v2/);
  assert.match(markup, /supporting summary/);
  assert.match(
    markup,
    /href="http:\/\/localhost\/api\/v1\/document-assets\/asset-original-1\/download"/,
  );
});
