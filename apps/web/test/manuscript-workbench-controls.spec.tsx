import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ManuscriptWorkbenchControls } from "../src/features/manuscript-workbench/manuscript-workbench-controls.tsx";

test("manuscript workbench controls render compact intake, lookup, actions, and utilities without a manual type selector", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchControls
      mode="proofreading"
      busy={false}
      layout="drawer"
      showLookupPanel={false}
      intake={{
        uploadForm: {
          title: "Neurology case review",
          createdBy: "web-workbench",
          fileName: "case-report.docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          fileContentBase64: "SGVsbG8=",
        },
        attachedFileCount: 2,
        attachedFileNames: ["case-report.docx", "case-report-supplement.docx"],
        canSubmit: true,
        onTitleChange: () => {},
        onManuscriptTypeChange: () => {},
        onStorageKeyChange: () => {},
        onFilesSelect: () => {},
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
            label: "edited_docx 路 asset-edited-1",
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

  assert.match(markup, /manuscript-workbench-controls/);
  assert.match(markup, /manuscript-workbench-batch-drawer-trigger/);
  assert.match(markup, /type="file"/);
  assert.match(markup, /multiple/);
  assert.match(markup, /manuscript-workbench-panel/);
  assert.match(markup, /10/);
  assert.doesNotMatch(markup, /clinical_study/);
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
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
        attachedFileCount: 0,
        attachedFileNames: [],
        canSubmit: false,
        onTitleChange: () => {},
        onManuscriptTypeChange: () => {},
        onStorageKeyChange: () => {},
        onFilesSelect: () => {},
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

  assert.match(markup, /manuscript-workbench-validation-list/);
  assert.match(markup, /class="manuscript-workbench-field is-invalid"/);
  assert.match(markup, /disabled=""/);
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
            label: "editing-final.docx 路 edited_docx 路 asset-edited-1",
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
            label: "proofreading-draft.docx 路 proofreading_draft_report 路 asset-draft-1",
          },
        ],
        selectedContextLabel: "Selected Draft Asset",
        onSelect: () => {},
        onRun: () => {},
      }}
    />,
  );

  assert.match(markup, /editing-final\.docx/);
  assert.match(markup, /proofreading-draft\.docx/);
  assert.match(markup, /manuscript-workbench-selection-context/);
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
        currentAppliedLabel: "Current Journal Template",
        hasPendingChange: false,
        options: [
          {
            value: "journal-template-1",
            label: "Journal Template One",
          },
          {
            value: "journal-template-2",
            label: "Journal Template Two",
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

  assert.match(markup, /Clinical Study Family/);
  assert.match(markup, /Journal Template One/);
  assert.match(markup, /Journal Template Two/);
});
