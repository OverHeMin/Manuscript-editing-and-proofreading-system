import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildManualManuscriptTypeOptions,
  buildJournalTemplateOptions,
  deriveUploadTitleFromFileName,
  resolveTemplateFamilyIdForManuscriptType,
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

test("focus canvas shows the one-time bare AI action for governed module work while leaving proofreading finalize unchanged", () => {
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
          secondaryActionLabel: "Run Bare AI Once",
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
});
