import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ManuscriptWorkbenchControls } from "../src/features/manuscript-workbench/manuscript-workbench-controls.tsx";

test("manuscript workbench controls render structured operator panels for upload, lookup, actions, and utilities", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchControls
      mode="proofreading"
      busy={false}
      layout="drawer"
      showLookupPanel={false}
      intake={{
        uploadForm: {
          title: "Neurology case review",
          manuscriptType: "case_report",
          createdBy: "web-workbench",
          fileName: "case-report.docx",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          fileContentBase64: "SGVsbG8=",
        },
        canSubmit: true,
        onTitleChange: () => {},
        onManuscriptTypeChange: () => {},
        onStorageKeyChange: () => {},
        onFileSelect: () => {},
        onSubmit: () => {},
      }}
      lookup={{
        manuscriptId: "manuscript-1",
        onChange: () => {},
        onLoad: () => {},
      }}
      moduleAction={{
        title: "Proofreading Draft",
        selectedAssetId: "asset-edited-1",
        emptyLabel: "Select asset",
        actionLabel: "Create Draft",
        options: [
          {
            value: "asset-edited-1",
            label: "edited_docx · asset-edited-1",
          },
        ],
        onSelect: () => {},
        onRun: () => {},
      }}
      finalizeAction={{
        selectedAssetId: "asset-draft-1",
        emptyLabel: "Select draft",
        actionLabel: "Finalize Proofreading",
        options: [
          {
            value: "asset-draft-1",
            label: "asset-draft-1",
          },
        ],
        onSelect: () => {},
        onRun: () => {},
      }}
      utilities={{
        canExport: true,
        canRefreshLatestJob: true,
        onExport: () => {},
        onRefreshLatestJob: () => {},
      }}
    />,
  );

  assert.match(markup, /批量处理与辅助动作/);
  assert.match(markup, /低频能力按需展开/);
  assert.match(markup, /manuscript-workbench-batch-drawer-trigger/);
  assert.match(markup, /批量处理/);
  assert.match(markup, /稿件接入/);
  assert.match(markup, /校对草稿生成/);
  assert.match(markup, /校对定稿/);
  assert.match(markup, /工作区工具/);
  assert.match(markup, /导出当前资产/);
  assert.match(markup, /刷新最新任务/);
});

test("manuscript workbench controls show inline guidance when required operator inputs are still missing", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchControls
      mode="editing"
      busy={false}
      intake={{
        uploadForm: {
          title: "",
          manuscriptType: "review",
          createdBy: "web-workbench",
          fileName: "editing-sample.docx",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
        canSubmit: false,
        onTitleChange: () => {},
        onManuscriptTypeChange: () => {},
        onStorageKeyChange: () => {},
        onFileSelect: () => {},
        onSubmit: () => {},
      }}
      lookup={{
        manuscriptId: "",
        onChange: () => {},
        onLoad: () => {},
      }}
      moduleAction={{
        title: "Editing Run",
        selectedAssetId: "",
        emptyLabel: "Select asset",
        actionLabel: "Run Editing",
        options: [],
        onSelect: () => {},
        onRun: () => {},
      }}
      utilities={{
        canExport: true,
        canRefreshLatestJob: false,
        onExport: () => {},
        onRefreshLatestJob: () => {},
      }}
    />,
  );

  assert.match(markup, /工作台操作区/);
  assert.match(markup, /请先填写稿件标题。/);
  assert.match(markup, /请先选择本地文件或填写存储键。/);
  assert.match(markup, /请先输入稿件 ID 再加载工作区。/);
  assert.match(markup, /请先选择父资产再启动当前模块。/);
  assert.match(markup, /工作区至少生成一条任务后，才可刷新最新任务。/);
  assert.match(markup, /class="manuscript-workbench-field is-invalid"/);
});

test("manuscript workbench controls surface the currently selected asset context for operators", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchControls
      mode="proofreading"
      busy={false}
      lookup={{
        manuscriptId: "manuscript-1",
        onChange: () => {},
        onLoad: () => {},
      }}
      moduleAction={{
        title: "Proofreading Draft",
        selectedAssetId: "asset-edited-1",
        emptyLabel: "Select asset",
        actionLabel: "Create Draft",
        options: [
          {
            value: "asset-edited-1",
            label: "editing-final.docx · edited_docx · asset-edited-1",
          },
        ],
        selectedContextLabel: "Selected Parent Asset",
        onSelect: () => {},
        onRun: () => {},
      }}
      finalizeAction={{
        selectedAssetId: "asset-draft-1",
        emptyLabel: "Select draft",
        actionLabel: "Finalize Proofreading",
        options: [
          {
            value: "asset-draft-1",
            label: "proofreading-draft.docx · proofreading_draft_report · asset-draft-1",
          },
        ],
        selectedContextLabel: "Selected Draft Asset",
        onSelect: () => {},
        onRun: () => {},
      }}
    />,
  );

  assert.match(markup, /已选父资产/);
  assert.match(markup, /editing-final\.docx/);
  assert.match(markup, /已选草稿资产/);
  assert.match(markup, /proofreading-draft\.docx/);
});

test("manuscript workbench controls render a journal template selector beside module actions", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchControls
      mode="editing"
      busy={false}
      lookup={{
        manuscriptId: "manuscript-1",
        onChange: () => {},
        onLoad: () => {},
      }}
      templateSelection={{
        title: "Journal Template",
        baseTemplateLabel: "Clinical Study Family",
        selectedJournalTemplateId: "journal-template-1",
        currentAppliedLabel: "《中西医结合杂志》",
        hasPendingChange: false,
        options: [
          {
            value: "journal-template-1",
            label: "《中西医结合杂志》",
          },
          {
            value: "journal-template-2",
            label: "《临床研究杂志》",
          },
        ],
        onSelect: () => {},
        onApply: () => {},
      }}
      moduleAction={{
        title: "Editing Run",
        selectedAssetId: "asset-edited-1",
        emptyLabel: "Select asset",
        actionLabel: "Run Editing",
        options: [
          {
            value: "asset-edited-1",
            label: "editing-final.docx 路 edited_docx 路 asset-edited-1",
          },
        ],
        onSelect: () => {},
        onRun: () => {},
      }}
    />,
  );

  assert.match(markup, /期刊模板/);
  assert.match(markup, /Clinical Study Family/);
  assert.match(markup, /《中西医结合杂志》/);
  assert.match(markup, /保存模板上下文/);
});
