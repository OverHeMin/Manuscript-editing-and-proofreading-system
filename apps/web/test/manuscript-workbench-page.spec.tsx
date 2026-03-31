import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  loadPrefilledWorkbenchWorkspace,
  ManuscriptWorkbenchPage,
} from "../src/features/manuscript-workbench/manuscript-workbench-page.tsx";

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

  const result = await loadPrefilledWorkbenchWorkspace(
    {
      loadWorkspace: async (manuscriptId: string) => {
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
