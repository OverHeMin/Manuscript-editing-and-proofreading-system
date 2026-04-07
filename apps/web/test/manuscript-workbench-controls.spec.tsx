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

  assert.match(markup, /Operator Console/);
  assert.match(markup, /Run intake, lookup, and governed actions from one desk\./);
  assert.match(markup, /Submission Intake/);
  assert.match(markup, /Workspace Lookup/);
  assert.match(markup, /Proofreading Draft/);
  assert.match(markup, /Finalize Proofreading/);
  assert.match(markup, /Workspace Utilities/);
  assert.match(markup, /Export Current Asset/);
  assert.match(markup, /Refresh Latest Job/);
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

  assert.match(markup, /Operator Console/);
  assert.match(markup, /Add a manuscript title before upload\./);
  assert.match(markup, /Choose a local file or enter a storage key before upload\./);
  assert.match(markup, /Enter a manuscript ID before loading the workspace\./);
  assert.match(markup, /Select a parent asset before starting this module run\./);
  assert.match(markup, /Refresh becomes available after the workspace creates at least one job\./);
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

  assert.match(markup, /Selected Parent Asset/);
  assert.match(markup, /editing-final\.docx/);
  assert.match(markup, /Selected Draft Asset/);
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

  assert.match(markup, /Journal Template/);
  assert.match(markup, /Clinical Study Family/);
  assert.match(markup, /《中西医结合杂志》/);
  assert.match(markup, /Save Template Context/);
});
