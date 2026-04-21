import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildHighRiskReviewItemsFromJob,
  buildModuleRunSuccessMessage,
  buildManualFeedbackActionResult,
  buildManualManuscriptTypeOptions,
  buildProofreadingConfirmationDecisions,
  buildJournalTemplateOptions,
  buildWorkbenchModuleRunInput,
  deriveUploadTitleFromFileName,
  resolveGovernedExecutionBlockMessage,
  resolveDetailJobSourceAsset,
  resolveResultMaterializationFailureMessage,
  resolveTemplateFamilyIdForManuscriptType,
  resolveManualFeedbackContext,
  pruneConfirmationState,
  buildTemplateFamilyOptions,
  ManuscriptWorkbenchFocusCanvas,
  ManuscriptWorkbenchPage,
  resolveWorkbenchGeneratedAssetFileName,
  resolveWorkbenchNotice,
} from "../src/features/manuscript-workbench/manuscript-workbench-page.tsx";

function createStubController() {
  return {
    loadWorkspace: async () => {
      throw new Error("not used");
    },
    uploadManuscriptAndLoad: async () => {
      throw new Error("not used");
    },
    uploadManuscriptBatchAndLoad: async () => {
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
    updateTemplateSelectionAndLoad: async () => {
      throw new Error("not used");
    },
  } as never;
}

test("submission workbench keeps the upload intake as the default rendering path", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchPage
      mode="submission"
      controller={createStubController()}
    />,
  );

  assert.match(markup, /manuscript-workbench-shell--submission/);
  assert.match(markup, /data-layout="manuscript-desk-family"/);
  assert.match(markup, /data-pane="intake-compat"/);
  assert.match(markup, /type="file"/);
  assert.match(markup, /multiple/);
  assert.match(markup, /上传稿件/u);
});

test("governed execution preflight exposes explicit provider and runtime readiness failures", () => {
  assert.equal(
    resolveGovernedExecutionBlockMessage("editing", {
      mode: "editing",
      providerReadinessStatus: "warning",
      runtimeBindingReadinessStatus: "ready",
    }),
    "编辑的 AI 提供商未就绪，请先检查模型连接后再执行。",
  );
  assert.equal(
    resolveGovernedExecutionBlockMessage("screening", {
      mode: "screening",
      providerReadinessStatus: "ok",
      runtimeBindingReadinessStatus: "missing",
    }),
    "初筛尚未绑定可用运行时，请先完成运行时绑定后再执行。",
  );
  assert.equal(
    resolveGovernedExecutionBlockMessage("proofreading", {
      mode: "proofreading",
      providerReadinessStatus: "ok",
      runtimeBindingReadinessStatus: "degraded",
    }),
    "校对的运行时绑定处于降级状态，请修复后再执行。",
  );
});

test("module success messages mention the generated output type", () => {
  assert.equal(
    buildModuleRunSuccessMessage("screening", {
      id: "asset-screening-1",
      asset_type: "screening_report",
    }),
    "已生成初筛报告 asset-screening-1",
  );
  assert.equal(
    buildModuleRunSuccessMessage("editing", {
      id: "asset-editing-1",
      asset_type: "edited_docx",
    }),
    "已生成编辑稿件 asset-editing-1",
  );
  assert.equal(
    buildModuleRunSuccessMessage("proofreading", {
      id: "asset-proofreading-1",
      asset_type: "final_proof_annotated_docx",
    }),
    "已生成校对稿件 asset-proofreading-1",
  );
});

test("result materialization failures name the affected module", () => {
  assert.equal(
    resolveResultMaterializationFailureMessage("proofreading"),
    "校对已完成，但结果文件尚未生成可下载链接，请刷新后重试。",
  );
});

test("screening editing and proofreading share the compact desk family without oversized internal intro blocks", () => {
  for (const mode of ["screening", "editing", "proofreading"] as const) {
    const markup = renderToStaticMarkup(
      <ManuscriptWorkbenchPage
        mode={mode}
        actorRole="admin"
        controller={createStubController()}
      />,
    );

    assert.match(markup, /data-layout="manuscript-desk-family"/);
    assert.match(markup, /data-scroll-shell="independent-columns"/);
    assert.match(markup, /data-pane-height="shell-aligned"/);
    assert.match(markup, /data-pane="queue-rail"/);
    assert.match(markup, /data-scroll-pane="queue"/);
    assert.match(markup, /data-pane="focus-canvas"/);
    assert.match(markup, /data-scroll-pane="focus"/);
    assert.match(markup, /data-focus-body="scrollable"/);
    assert.match(markup, /data-pane="batch-slab"/);
    assert.match(markup, /data-scroll-pane="batch"/);
    assert.match(markup, /data-batch-slab="bounded"/);
    assert.match(markup, /上传稿件/u);
    assert.doesNotMatch(markup, /manuscript-workbench-desk-bar/);
    assert.doesNotMatch(markup, /manuscript-workbench-summary-strip/);
    assert.doesNotMatch(markup, /manuscript-workbench-controls-intro/);
    assert.doesNotMatch(markup, /manuscript-workbench-batch-drawer-trigger/);
    assert.doesNotMatch(markup, /manuscript-workbench-batch-slab-meta/);
  }
});

test("workbench notice logic localizes upload and error feedback before rendering", () => {
  const uploadNotice = resolveWorkbenchNotice({
    error: "",
    status: "Uploaded manuscript manuscript-1",
    latestActionResult: {
      tone: "success",
      actionLabel: "Upload Manuscript",
      message: "Uploaded manuscript manuscript-1",
      details: [],
    },
  });
  const errorNotice = resolveWorkbenchNotice({
    error: "Upload failed because the file payload was invalid.",
    status: "",
    latestActionResult: null,
  });

  assert.deepEqual(uploadNotice, {
    tone: "success",
    title: "操作已完成",
    message: "已上传稿件 manuscript-1",
  });
  assert.deepEqual(errorNotice, {
    tone: "error",
    title: "操作失败",
    message: "Upload failed because the file payload was invalid.",
  });
});

test("uploaded manuscript notice stays in completed state even when follow-up settlement is still pending", () => {
  const uploadNotice = resolveWorkbenchNotice({
    error: "",
    status: "Uploaded manuscript manuscript-1",
    latestActionResult: {
      tone: "success",
      actionLabel: "Upload Manuscript",
      message: "Uploaded manuscript manuscript-1",
      details: [
        {
          label: "Job结算",
          value: "business_completed_follow_up_pending",
        },
      ],
    },
  });

  assert.deepEqual(uploadNotice, {
    tone: "success",
    title: "操作已完成",
    message: "已上传稿件 manuscript-1",
  });
});

test("template selection helpers only expose active operator options with localized family labels", () => {
  const workspace = {
    manuscript: {
      current_template_family_id: "family-review-active",
      governed_execution_context_summary: {
        base_template_family_id: "family-review-active",
      },
    },
    availableTemplateFamilies: [
      {
        id: "family-review-active",
        manuscript_type: "review",
        name: "Review 基础模板族",
        status: "active",
      },
      {
        id: "family-review-draft",
        manuscript_type: "review",
        name: "Review governance family",
        status: "draft",
      },
    ],
    templateFamily: {
      id: "family-review-active",
      manuscript_type: "review",
      name: "Review 基础模板族",
      status: "active",
    },
    journalTemplateProfiles: [
      {
        id: "journal-template-active",
        template_family_id: "family-review-active",
        journal_key: "cmj",
        journal_name: "中华医学杂志",
        status: "active",
      },
      {
        id: "journal-template-draft",
        template_family_id: "family-review-active",
        journal_key: "draft",
        journal_name: "草稿模板",
        status: "draft",
      },
    ],
  } as never;

  assert.deepEqual(buildTemplateFamilyOptions(workspace), [
    {
      value: "family-review-active",
      label: "综述基础模板族",
    },
  ]);
  assert.deepEqual(buildJournalTemplateOptions(workspace), [
    {
      value: "journal-template-active",
      label: "中华医学杂志",
    },
  ]);
});

test("manual manuscript type helpers expose distinct operator options and resolve the matching base family", () => {
  const workspace = {
    manuscript: {
      manuscript_type: "clinical_study",
      current_template_family_id: "family-clinical-primary",
      governed_execution_context_summary: {
        base_template_family_id: "family-clinical-primary",
      },
    },
    availableTemplateFamilies: [
      {
        id: "family-clinical-primary",
        manuscript_type: "clinical_study",
        name: "Clinical Study base template family",
        status: "active",
      },
      {
        id: "family-clinical-secondary",
        manuscript_type: "clinical_study",
        name: "Clinical Study governance family",
        status: "active",
      },
      {
        id: "family-review",
        manuscript_type: "review",
        name: "Review base template family",
        status: "active",
      },
      {
        id: "family-other-draft",
        manuscript_type: "other",
        name: "Other draft family",
        status: "draft",
      },
    ],
  } as never;

  assert.deepEqual(buildManualManuscriptTypeOptions(workspace), [
    {
      value: "clinical_study",
      label: "临床研究",
    },
    {
      value: "review",
      label: "综述",
    },
  ]);
  assert.equal(
    resolveTemplateFamilyIdForManuscriptType(workspace, "review"),
    "family-review",
  );
  assert.equal(
    resolveTemplateFamilyIdForManuscriptType(workspace, "clinical_study"),
    "family-clinical-primary",
  );
});

test("workbench run helpers use stage-specific generated file names with correct extensions", () => {
  assert.equal(
    resolveWorkbenchGeneratedAssetFileName("screening"),
    "screening-report.md",
  );
  assert.equal(
    resolveWorkbenchGeneratedAssetFileName("editing"),
    "editing-manuscript.docx",
  );
  assert.equal(
    resolveWorkbenchGeneratedAssetFileName("proofreading"),
    "proofreading-draft-report.md",
  );
});

test("AI recognition uses governed module input by default and only sends bare when explicitly requested", () => {
  assert.deepEqual(
    buildWorkbenchModuleRunInput({
      mode: "editing",
      manuscriptId: "manuscript-1",
      parentAssetId: "asset-original-1",
      actorRole: "admin",
    }),
    {
      mode: "editing",
      manuscriptId: "manuscript-1",
      parentAssetId: "asset-original-1",
      actorRole: "admin",
      storageKey: "runs/manuscript-1/editing/output",
      fileName: "editing-manuscript.docx",
    },
  );

  assert.deepEqual(
    buildWorkbenchModuleRunInput({
      mode: "editing",
      manuscriptId: "manuscript-1",
      parentAssetId: "asset-original-1",
      actorRole: "admin",
      executionMode: "bare",
    }),
    {
      mode: "editing",
      manuscriptId: "manuscript-1",
      parentAssetId: "asset-original-1",
      actorRole: "admin",
      storageKey: "runs/manuscript-1/editing/output",
      fileName: "editing-manuscript.docx",
      executionMode: "bare",
    },
  );
});

test("upload title helper defaults single-file titles to the uploaded file name without the extension", () => {
  assert.equal(
    deriveUploadTitleFromFileName("心内科-病例报告.docx", "submission sample manuscript"),
    "心内科-病例报告",
  );
  assert.equal(
    deriveUploadTitleFromFileName("nested.name.review.v2.pdf", "submission sample manuscript"),
    "nested.name.review.v2",
  );
  assert.equal(
    deriveUploadTitleFromFileName("   ", "submission sample manuscript"),
    "submission sample manuscript",
  );
});

test("focus canvas shows the AI recognition action for governed module work while leaving proofreading finalize unchanged", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchFocusCanvas
      mode="editing"
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
            id: "asset-edited-1",
            manuscript_id: "manuscript-1",
            asset_type: "edited_docx",
            status: "active",
            storage_key: "runs/editing/output.docx",
            mime_type:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            parent_asset_id: "asset-original-1",
            source_module: "editing",
            created_by: "editor-1",
            version_no: 2,
            is_current: true,
            file_name: "editing-output.docx",
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
          id: "asset-edited-1",
          manuscript_id: "manuscript-1",
          asset_type: "edited_docx",
          status: "active",
          storage_key: "runs/editing/output.docx",
          mime_type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          parent_asset_id: "asset-original-1",
          source_module: "editing",
          created_by: "editor-1",
          version_no: 2,
          is_current: true,
          file_name: "editing-output.docx",
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
        },
        {
          title: "Proofreading Final",
          selectedAssetId: "asset-draft-1",
          emptyLabel: "请选择校对草稿",
          actionLabel: "Finalize Proofreading",
          options: [
            {
              value: "asset-draft-1",
              label: "proofreading-draft-report.md · proofreading_draft_report · asset-draft-1",
            },
          ],
          selectedContextLabel: "Selected Draft Asset",
          onSelect: () => {},
          onRun: () => {},
        },
      ]}
    />,
  );

  assert.match(markup, /执行编辑/u);
  assert.match(markup, /AI 自动处理（本次）/u);
  assert.match(markup, /确认校对定稿/u);
  assert.match(markup, /data-secondary-action="available"/);
  assert.match(
    markup,
    /href="#editing\?manuscriptId=manuscript-1&amp;assetId=asset-original-1"/,
  );
  assert.match(
    markup,
    /href="#editing\?manuscriptId=manuscript-1&amp;assetId=asset-edited-1"/,
  );
  assert.match(
    markup,
    /href="http:\/\/localhost\/api\/v1\/document-assets\/asset-original-1\/download"/,
  );
  assert.match(
    markup,
    /href="http:\/\/localhost\/api\/v1\/document-assets\/asset-edited-1\/download"/,
  );
});

test("proofreading confirmation helpers keep only active draft rows and serialize item decisions for publish", () => {
  const pruned = pruneConfirmationState(
    {
      "correction-1": {
        action: "accept",
        note: "保留",
      },
      "correction-legacy": {
        action: "reject",
        note: "旧条目",
      },
    },
    [
      {
        itemId: "correction-1",
        targetText: "5 mg per dL",
        replacementText: "5 mg/dL",
        category: "style",
      },
      {
        itemId: "correction-2",
        targetText: "The hemoglobin were stable.",
        replacementText: "The hemoglobin was stable.",
        category: "grammar",
      },
    ],
  );

  assert.deepEqual(pruned, {
    "correction-1": {
      action: "accept",
      note: "保留",
    },
  });

  assert.deepEqual(
    buildProofreadingConfirmationDecisions(
      [
        {
          itemId: "correction-1",
          targetText: "5 mg per dL",
          replacementText: "5 mg/dL",
          category: "style",
        },
        {
          itemId: "correction-2",
          targetText: "The hemoglobin were stable.",
          replacementText: "The hemoglobin was stable.",
          category: "grammar",
        },
      ],
      {
        "correction-1": {
          action: "accept",
          note: "量纲正确",
        },
        "correction-2": {
          action: "accept_and_edit",
          editedReplacementText: "The hemoglobin level was stable.",
          note: "人工补足 level",
        },
      },
    ),
    [
      {
        itemId: "correction-1",
        targetText: "5 mg per dL",
        replacementText: "5 mg/dL",
        action: "accept",
        note: "量纲正确",
      },
      {
        itemId: "correction-2",
        targetText: "The hemoglobin were stable.",
        replacementText: "The hemoglobin was stable.",
        action: "accept_and_edit",
        editedReplacementText: "The hemoglobin level was stable.",
        note: "人工补足 level",
      },
    ],
  );
});

test("proofreading confirmation detail follows the parent draft asset so the human-confirmation page keeps the AI correction list", () => {
  const draftAsset = {
    id: "asset-proof-draft-1",
    manuscript_id: "manuscript-1",
    asset_type: "proofreading_draft_report",
    status: "active",
    storage_key: "runs/proofreading/draft.md",
    mime_type: "text/markdown",
    source_module: "proofreading",
    source_job_id: "job-proof-draft-1",
    created_by: "proofreader-1",
    version_no: 3,
    is_current: false,
    file_name: "proofreading-draft.md",
    created_at: "2026-04-21T09:00:00.000Z",
    updated_at: "2026-04-21T09:00:00.000Z",
  } as never;
  const finalAsset = {
    id: "asset-proof-final-1",
    manuscript_id: "manuscript-1",
    asset_type: "final_proof_annotated_docx",
    status: "active",
    storage_key: "runs/proofreading/final.docx",
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    parent_asset_id: "asset-proof-draft-1",
    source_module: "proofreading",
    source_job_id: "job-proof-final-1",
    created_by: "proofreader-1",
    version_no: 4,
    is_current: true,
    file_name: "proofreading-final.docx",
    created_at: "2026-04-21T09:05:00.000Z",
    updated_at: "2026-04-21T09:05:00.000Z",
  } as never;

  assert.equal(
    resolveDetailJobSourceAsset({
      selectedAsset: finalAsset,
      assets: [finalAsset, draftAsset],
      mode: "proofreading",
    })?.id,
    "asset-proof-draft-1",
  );

  assert.equal(
    resolveDetailJobSourceAsset({
      selectedAsset: {
        ...finalAsset,
        asset_type: "edited_docx",
      },
      assets: [finalAsset, draftAsset],
      mode: "editing",
    })?.id,
    "asset-proof-final-1",
  );
});

test("manual feedback helpers derive the governed snapshot context and build rule-center-aware action results", () => {
  const context = resolveManualFeedbackContext(
    "editing",
    {
      manuscript: {
        id: "manuscript-feedback-1",
        title: "Feedback manuscript",
        manuscript_type: "clinical_study",
        status: "processing",
        created_by: "editor-1",
        module_execution_overview: {
          screening: {
            module: "screening",
            observation_status: "not_started",
          },
          editing: {
            module: "editing",
            observation_status: "reported",
            latest_snapshot: {
              id: "snapshot-editing-1",
              manuscript_id: "manuscript-feedback-1",
              module: "editing",
              job_id: "job-editing-1",
              execution_profile_id: "execution-profile-editing-1",
              module_template_id: "template-editing-1",
              module_template_version_no: 2,
              prompt_template_id: "prompt-editing-1",
              prompt_template_version: "2026-04-01",
              skill_package_ids: ["pkg-editing"],
              skill_package_versions: ["2026.04"],
              model_id: "model-editing-1",
              knowledge_item_ids: [],
              created_asset_ids: ["asset-edited-1"],
              created_at: "2026-04-18T09:10:00.000Z",
              agent_execution: {
                observation_status: "not_linked",
              },
              runtime_binding_readiness: {
                observation_status: "reported",
                report: {
                  status: "ready",
                  checked_at: "2026-04-18T09:10:00.000Z",
                  issues: [],
                },
              },
            },
          },
          proofreading: {
            module: "proofreading",
            observation_status: "not_started",
          },
        },
        created_at: "2026-04-18T09:00:00.000Z",
        updated_at: "2026-04-18T09:10:00.000Z",
      },
      assets: [],
      currentAsset: {
        id: "asset-edited-1",
        manuscript_id: "manuscript-feedback-1",
        asset_type: "edited_docx",
        status: "active",
        storage_key: "runs/editing/output.docx",
        mime_type:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        parent_asset_id: "asset-original-1",
        source_module: "editing",
        source_job_id: "job-editing-1",
        created_by: "editor-1",
        version_no: 2,
        is_current: true,
        file_name: "editing-output.docx",
        created_at: "2026-04-18T09:10:00.000Z",
        updated_at: "2026-04-18T09:10:00.000Z",
      },
      currentManuscriptAsset: null,
      suggestedParentAsset: null,
      latestProofreadingDraftAsset: null,
    } as never,
  );

  assert.deepEqual(context, {
    snapshotId: "snapshot-editing-1",
    sourceAssetId: "asset-edited-1",
  });

  assert.deepEqual(
    buildManualFeedbackActionResult({
      feedbackCategory: "missing_knowledge",
      feedbackRecordId: "feedback-1",
      reviewItemId: "review-item-1",
      recommendedRoute: "knowledge_candidate",
    }),
    {
      tone: "success",
      actionLabel: "Submit Review Item",
      message: "Submitted review item review-item-1",
      details: [
        {
          label: "Feedback Type",
          value: "missing_knowledge",
        },
        {
          label: "Feedback Record",
          value: "feedback-1",
        },
        {
          label: "Review Item",
          value: "review-item-1",
        },
        {
          label: "Recommended Route",
          value: "knowledge_candidate",
        },
      ],
    },
  );
});

test.skip("editing table inspection findings become high-risk review cards with semantic location", () => {
  const items = buildHighRiskReviewItemsFromJob({
    id: "job-editing-table-1",
    manuscript_id: "manuscript-1",
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
          semantic_hit: {
            table_id: "table-1",
            semantic_target: "header_cell",
            header_path: ["Treatment group", "n (%)"],
            column_key: "Treatment group > n (%)",
            override_source: "journal",
          },
        },
      ],
    },
    created_at: "2026-04-18T10:00:00.000Z",
    updated_at: "2026-04-18T10:01:00.000Z",
  } as never);

    assert.deepEqual(items, [
      {
        id: "rule-table-treatment-group",
        title: "规则 rule-table-treatment-group 需要人工确认",
        feedbackCategory: "incorrect_hit",
        candidate_posture: "inspect_only",
        riskLevel: "high",
        summary: "命中的表格规则需要人工复核后再决定是否沉淀。",
        excerpt:
          'Matched semantic target "header_cell" in table "table-1" for header path "Treatment group > n (%)". Check treatment group header formatting.',
        location: {
        table_id: "table-1",
        semantic_target: "header_cell",
        header_path: ["Treatment group", "n (%)"],
        column_key: "Treatment group > n (%)",
        override_source: "journal",
        },
        locationText: "表格 table-1 / header_cell",
        suggestion: undefined,
        rationale:
          'Matched semantic target "header_cell" in table "table-1" for header path "Treatment group > n (%)". Check treatment group header formatting.',
        evidence_pack: {
          location: {
            table_id: "table-1",
            semantic_target: "header_cell",
            header_path: ["Treatment group", "n (%)"],
            column_key: "Treatment group > n (%)",
            override_source: "journal",
          },
          excerpt:
            'Matched semantic target "header_cell" in table "table-1" for header path "Treatment group > n (%)". Check treatment group header formatting.',
          rationale:
            'Matched semantic target "header_cell" in table "table-1" for header path "Treatment group > n (%)". Check treatment group header formatting.',
        },
        relatedRuleIds: ["rule-table-treatment-group"],
        relatedKnowledgeItemIds: undefined,
        originPayload: {
          source: "table_inspection_finding",
          ruleId: "rule-table-treatment-group",
        semantic_hit: {
          table_id: "table-1",
          semantic_target: "header_cell",
          header_path: ["Treatment group", "n (%)"],
          column_key: "Treatment group > n (%)",
          override_source: "journal",
        },
      },
    },
  ]);
});

test.skip("proofreading nested quality findings become high-risk review cards", () => {
  const items = buildHighRiskReviewItemsFromJob({
    id: "job-proofreading-quality-1",
    manuscript_id: "manuscript-1",
    module: "proofreading",
    job_type: "proofreading_draft_run",
    status: "completed",
    requested_by: "proofreader-1",
    attempt_count: 1,
    payload: {
      proofreadingFindings: {
        qualityFindings: [
          {
            id: "quality-1",
            title: "统计学表达需人工确认",
            summary: "P 值表达与期刊规范不一致",
            excerpt: "P < 0.05",
            suggestion: "P=0.032",
            rationale: "统计表达存在高风险误解空间",
            candidate_posture: "candidate_change",
            evidence_pack: {
              location: {
                paragraph_index: 6,
              },
              excerpt: "P < 0.05",
              suggestion: "P=0.032",
              rationale: "统计表达存在高风险误解空间",
            },
            severity: "error",
            location: {
              paragraph_index: 6,
            },
            relatedRuleIds: ["rule-statistics-1"],
          },
        ],
      },
    },
    created_at: "2026-04-18T10:00:00.000Z",
    updated_at: "2026-04-18T10:01:00.000Z",
  } as never);

  assert.deepEqual(items, [
      {
        id: "quality-1",
        title: "统计学表达需人工确认",
        feedbackCategory: "incorrect_hit",
        candidate_posture: "candidate_change",
        riskLevel: "high",
        summary: "P 值表达与期刊规范不一致",
        excerpt: "P < 0.05",
        location: {
          paragraph_index: 6,
        },
        locationText: "段落 6",
        suggestion: "P=0.032",
        rationale: "统计表达存在高风险误解空间",
        evidence_pack: {
          location: {
            paragraph_index: 6,
          },
          excerpt: "P < 0.05",
          suggestion: "P=0.032",
          rationale: "统计表达存在高风险误解空间",
        },
        relatedRuleIds: ["rule-statistics-1"],
        relatedKnowledgeItemIds: undefined,
        originPayload: {
          source: "generic_high_risk_item",
        itemId: "quality-1",
      },
    },
  ]);
});

test("proofreading nested quality findings expose rule routing metadata on the high-risk review card", () => {
  const items = buildHighRiskReviewItemsFromJob({
    id: "job-proofreading-quality-1",
    manuscript_id: "manuscript-1",
    module: "proofreading",
    job_type: "proofreading_draft_run",
    status: "completed",
    requested_by: "proofreader-1",
    attempt_count: 1,
    payload: {
      proofreadingFindings: {
        qualityFindings: [
          {
            id: "quality-1",
            title: "ç»Ÿè®¡å­¦è¡¨è¾¾éœ€äººå·¥ç¡®è®¤",
            summary: "P å€¼è¡¨è¾¾ä¸ŽæœŸåˆŠè§„èŒƒä¸ä¸€è‡´",
            excerpt: "P < 0.05",
            suggestion: "P=0.032",
            rationale: "ç»Ÿè®¡è¡¨è¾¾å­˜åœ¨é«˜é£Žé™©è¯¯è§£ç©ºé—´",
            candidate_posture: "candidate_change",
            evidence_pack: {
              location: {
                paragraph_index: 6,
              },
              excerpt: "P < 0.05",
              suggestion: "P=0.032",
              rationale: "ç»Ÿè®¡è¡¨è¾¾å­˜åœ¨é«˜é£Žé™©è¯¯è§£ç©ºé—´",
            },
            severity: "error",
            location: {
              paragraph_index: 6,
            },
            relatedRuleIds: ["rule-statistics-1"],
          },
        ],
      },
    },
    created_at: "2026-04-18T10:00:00.000Z",
    updated_at: "2026-04-18T10:01:00.000Z",
  } as never);

  assert.equal(items.length, 1);

  const [item] = items;
  assert.equal(item?.id, "quality-1");
  assert.equal(typeof item?.title, "string");
  assert.ok((item?.title?.length ?? 0) > 0);
  assert.equal(item?.feedbackCategory, "incorrect_hit");
  assert.equal(item?.candidate_posture, "candidate_change");
  assert.equal(item?.riskLevel, "high");
  assert.equal(typeof item?.summary, "string");
  assert.ok((item?.summary?.length ?? 0) > 0);
  assert.equal(item?.excerpt, "P < 0.05");
  assert.deepEqual(item?.location, {
    paragraph_index: 6,
  });
  assert.equal(item?.locationText, "\u6bb5\u843d 6");
  assert.equal(item?.suggestion, "P=0.032");
  assert.equal(typeof item?.rationale, "string");
  assert.ok((item?.rationale?.length ?? 0) > 0);
  assert.deepEqual(item?.evidence_pack, {
    location: {
      paragraph_index: 6,
    },
    excerpt: "P < 0.05",
    suggestion: "P=0.032",
    rationale: item?.rationale,
  });
  assert.deepEqual(item?.relatedRuleIds, ["rule-statistics-1"]);
  assert.deepEqual(item?.relatedKnowledgeItemIds, []);
  assert.equal(item?.recommendedRoute, "rule_candidate");
  assert.deepEqual(item?.originPayload, {
    source: "generic_high_risk_item",
    itemId: "quality-1",
  });
});

test("editing table inspection findings expose semantic evidence and rule routing metadata", () => {
  const items = buildHighRiskReviewItemsFromJob({
    id: "job-editing-table-1",
    manuscript_id: "manuscript-1",
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
          semantic_hit: {
            table_id: "table-1",
            semantic_target: "header_cell",
            header_path: ["Treatment group", "n (%)"],
            column_key: "Treatment group > n (%)",
            override_source: "journal",
          },
        },
      ],
    },
    created_at: "2026-04-18T10:00:00.000Z",
    updated_at: "2026-04-18T10:01:00.000Z",
  } as never);

  assert.equal(items.length, 1);

  const [item] = items;
  assert.equal(item?.id, "rule-table-treatment-group");
  assert.equal(
    item?.title,
    "\u89c4\u5219 rule-table-treatment-group \u9700\u8981\u4eba\u5de5\u786e\u8ba4",
  );
  assert.equal(item?.feedbackCategory, "incorrect_hit");
  assert.equal(item?.candidate_posture, "inspect_only");
  assert.equal(item?.riskLevel, "high");
  assert.equal(
    item?.summary,
    "\u547d\u4e2d\u7684\u8868\u683c\u89c4\u5219\u9700\u8981\u4eba\u5de5\u590d\u6838\u540e\u518d\u51b3\u5b9a\u662f\u5426\u6c89\u6dc0\u3002",
  );
  assert.equal(
    item?.excerpt,
    'Matched semantic target "header_cell" in table "table-1" for header path "Treatment group > n (%)". Check treatment group header formatting.',
  );
  assert.deepEqual(item?.location, {
    table_id: "table-1",
    semantic_target: "header_cell",
    header_path: ["Treatment group", "n (%)"],
    column_key: "Treatment group > n (%)",
    override_source: "journal",
  });
  assert.equal(item?.locationText, "\u8868\u683c table-1 / header_cell");
  assert.equal(item?.suggestion, undefined);
  assert.equal(
    item?.rationale,
    'Matched semantic target "header_cell" in table "table-1" for header path "Treatment group > n (%)". Check treatment group header formatting.',
  );
  assert.deepEqual(item?.evidence_pack, {
    location: item?.location,
    excerpt:
      'Matched semantic target "header_cell" in table "table-1" for header path "Treatment group > n (%)". Check treatment group header formatting.',
    rationale:
      'Matched semantic target "header_cell" in table "table-1" for header path "Treatment group > n (%)". Check treatment group header formatting.',
  });
  assert.deepEqual(item?.relatedRuleIds, ["rule-table-treatment-group"]);
  assert.equal(item?.relatedKnowledgeItemIds, undefined);
  assert.equal(item?.recommendedRoute, "rule_candidate");
  assert.deepEqual(item?.originPayload, {
    source: "table_inspection_finding",
    ruleId: "rule-table-treatment-group",
    semantic_hit: item?.location,
  });
});
