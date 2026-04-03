import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  loadPrefilledWorkbenchWorkspace,
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
