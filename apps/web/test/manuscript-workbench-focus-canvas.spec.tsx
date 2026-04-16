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
  } as never;
}

test("focus canvas makes manuscript processing and AI confirmation the primary work surface", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchFocusCanvas
      mode="screening"
      busy={false}
      workspace={createWorkspace()}
      detectedManuscriptTypeLabel="综述（低置信度，待人工确认）"
      templateSelection={{
        title: "Journal Template",
        resolvedManuscriptTypeLabel: "综述（低置信度，待人工确认）",
        confidenceLabel: "低置信度，需人工确认",
        confidenceLevel: "low",
        requiresOperatorReview: true,
        showManualManuscriptTypeSelect: true,
        manualManuscriptTypeValue: "review",
        manualManuscriptTypeOptions: [
          { value: "review", label: "综述" },
          { value: "clinical_study", label: "临床研究" },
        ],
        baseTemplateLabel: "Review Family",
        selectedTemplateFamilyId: "family-review",
        templateFamilyOptions: [
          { value: "family-review", label: "Review Family" },
          { value: "family-clinical", label: "Clinical Study Family" },
        ],
        selectedJournalTemplateId: "",
        currentAppliedLabel: "仅基础模板",
        hasPendingChange: false,
        options: [{ value: "journal-template-1", label: "Review Journal Template" }],
        onManualManuscriptTypeSelect: () => {},
        onTemplateFamilySelect: () => {},
        onSelect: () => {},
        onApply: () => {},
      }}
      primaryActions={[
        {
          title: "Screening Run",
          selectedAssetId: "asset-original-1",
          emptyLabel: "Select asset",
          actionLabel: "Run Screening",
          options: [{ value: "asset-original-1", label: "原始稿件 / neurology-review.docx" }],
          selectedContextLabel: "Selected Parent Asset",
          onSelect: () => {},
          onRun: () => {},
        },
      ]}
      supportingSummary={<div data-supporting-summary="yes">supporting summary</div>}
    />,
  );

  assert.match(markup, /data-focus-canvas="manuscript-first"/);
  assert.match(markup, /data-action-row="sticky"/);
  assert.match(markup, /处理稿件/u);
  assert.match(markup, /确认 AI 识别结果/u);
  assert.match(markup, /人工确认稿件类型/u);
  assert.match(markup, /人工修正稿件类型与模板/u);
  assert.match(markup, /期刊模板（小期刊\/场景）/u);
  assert.match(markup, /AI 识别失败或低置信度时请先人工确认稿件类型/u);
  assert.match(markup, /自动绑定执行上下文/u);
  assert.match(markup, /screening-profile-1/);
  assert.match(markup, /retrieval-screening-v1/);
  assert.match(markup, /binding-screening-v2/);
  assert.match(markup, /supporting summary/);
  assert.match(markup, /查看当前稿件/u);
  assert.match(markup, /下载当前稿件/u);
  assert.match(
    markup,
    /href="http:\/\/localhost\/api\/v1\/document-assets\/asset-original-1\/download"/,
  );
});
