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

  assert.match(markup, /Submission Intake/);
  assert.match(markup, /Workspace Lookup/);
  assert.match(markup, /Proofreading Draft/);
  assert.match(markup, /Finalize Proofreading/);
  assert.match(markup, /Workspace Utilities/);
  assert.match(markup, /Export Current Asset/);
  assert.match(markup, /Refresh Latest Job/);
});
