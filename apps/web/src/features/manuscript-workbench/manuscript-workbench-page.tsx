import React, { useEffect, useState } from "react";
import { createBrowserHttpClient, BrowserHttpClientError } from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/index.ts";
import type { JobViewModel, UploadManuscriptInput } from "../manuscripts/index.ts";
import type { ModuleJobViewModel } from "../screening/index.ts";
import {
  ManuscriptWorkbenchControls,
} from "./manuscript-workbench-controls.tsx";
import { createInlineUploadFields } from "./manuscript-upload-file.ts";
import { ManuscriptWorkbenchSummary } from "./manuscript-workbench-summary.tsx";
import {
  createManuscriptWorkbenchController,
  isSelectableParentAsset,
  type ManuscriptWorkbenchController,
  type ManuscriptWorkbenchMode,
  type ManuscriptWorkbenchWorkspace,
} from "./manuscript-workbench-controller.ts";

export interface ManuscriptWorkbenchPageProps {
  mode: ManuscriptWorkbenchMode;
  actorRole?: AuthRole;
  controller?: ManuscriptWorkbenchController;
}

const defaultController = createManuscriptWorkbenchController(createBrowserHttpClient());
type AnyWorkbenchJob = JobViewModel | ModuleJobViewModel;

export function ManuscriptWorkbenchPage({
  mode,
  actorRole = "user",
  controller = defaultController,
}: ManuscriptWorkbenchPageProps) {
  const canUpload = mode === "submission" || actorRole === "admin";
  const [lookupId, setLookupId] = useState("");
  const [workspace, setWorkspace] = useState<ManuscriptWorkbenchWorkspace | null>(null);
  const [latestJob, setLatestJob] = useState<AnyWorkbenchJob | null>(null);
  const [latestExport, setLatestExport] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [uploadForm, setUploadForm] = useState<UploadManuscriptInput>({
    title: `${mode} sample manuscript`,
    manuscriptType: "review",
    createdBy: "web-workbench",
    fileName: `${mode}-sample.docx`,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "",
  });
  const [parentAssetId, setParentAssetId] = useState("");
  const [draftAssetId, setDraftAssetId] = useState("");
  const canSubmitUpload =
    uploadForm.title.trim().length > 0 &&
    uploadForm.fileName.trim().length > 0 &&
    uploadForm.mimeType.trim().length > 0 &&
    hasUploadPayload(uploadForm);

  useEffect(() => {
    if (!workspace) {
      return;
    }

    setLookupId(workspace.manuscript.id);
    setParentAssetId((current) =>
      workspace.assets.some((asset) => asset.id === current)
        ? current
        : workspace.suggestedParentAsset?.id ?? "",
    );
    setDraftAssetId((current) =>
      workspace.assets.some((asset) => asset.id === current)
        ? current
        : workspace.latestProofreadingDraftAsset?.id ?? "",
    );
  }, [workspace]);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (nextError) {
      setError(formatError(nextError));
    } finally {
      setBusy(false);
    }
  }

  async function attachUploadFile(file: File) {
    setBusy(true);
    setError("");
    try {
      const inlineFields = await createInlineUploadFields(file);
      setUploadForm((current) => ({
        ...current,
        ...inlineFields,
      }));
      setStatus(`Attached file ${inlineFields.fileName}`);
    } catch (nextError) {
      setError(formatError(nextError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="workbench-placeholder">
      <h2>{resolveTitle(mode)}</h2>
      <p>{resolveDescription(mode)}</p>
      {error ? <p>{error}</p> : null}
      {status ? <p>{status}</p> : null}
      <ManuscriptWorkbenchControls
        mode={mode}
        busy={busy}
        intake={
          canUpload
            ? {
                uploadForm,
                canSubmit: canSubmitUpload,
                onTitleChange: (value) =>
                  setUploadForm((current) => ({
                    ...current,
                    title: value,
                  })),
                onManuscriptTypeChange: (value) =>
                  setUploadForm((current) => ({
                    ...current,
                    manuscriptType: value,
                  })),
                onStorageKeyChange: (value) =>
                  setUploadForm((current) => ({
                    ...current,
                    storageKey: normalizeOptionalText(value),
                  })),
                onFileSelect: (file) => {
                  void attachUploadFile(file);
                },
                onSubmit: () =>
                  void run(async () => {
                    const result = await controller.uploadManuscriptAndLoad(uploadForm);
                    setWorkspace(result.workspace);
                    setLatestJob(result.upload.job);
                    setStatus(`Uploaded manuscript ${result.upload.manuscript.id}`);
                  }),
              }
            : undefined
        }
        lookup={{
          manuscriptId: lookupId,
          onChange: setLookupId,
          onLoad: () =>
            void run(async () => {
              const nextWorkspace = await controller.loadWorkspace(lookupId.trim());
              setWorkspace(nextWorkspace);
              setStatus(`Loaded manuscript ${nextWorkspace.manuscript.id}`);
            }),
        }}
        moduleAction={
          workspace && mode !== "submission"
            ? {
                title: resolveActionPanelTitle(mode),
                selectedAssetId: parentAssetId,
                emptyLabel: "Select asset",
                actionLabel: resolveActionLabel(mode),
                options: workspace.assets
                  .filter((asset) => isSelectableParentAsset(asset))
                  .map((asset) => ({
                    value: asset.id,
                    label: `${asset.asset_type} · ${asset.id}`,
                  })),
                onSelect: setParentAssetId,
                onRun: () =>
                  void run(async () => {
                    const result = await controller.runModuleAndLoad({
                      mode,
                      manuscriptId: workspace.manuscript.id,
                      parentAssetId,
                      actorRole,
                      storageKey: `runs/${workspace.manuscript.id}/${mode}/output`,
                      fileName: `${mode}-output`,
                    });
                    setWorkspace(result.workspace);
                    setLatestJob(result.runResult.job);
                    setStatus(`Created asset ${result.runResult.asset.id}`);
                  }),
              }
            : undefined
        }
        finalizeAction={
          workspace && mode === "proofreading"
            ? {
                title: "Proofreading Final",
                selectedAssetId: draftAssetId,
                emptyLabel: "Select draft",
                actionLabel: "Finalize Proofreading",
                options: workspace.assets
                  .filter((asset) => asset.asset_type === "proofreading_draft_report")
                  .map((asset) => ({
                    value: asset.id,
                    label: asset.id,
                  })),
                onSelect: setDraftAssetId,
                onRun: () =>
                  void run(async () => {
                    const result = await controller.finalizeProofreadingAndLoad({
                      manuscriptId: workspace.manuscript.id,
                      draftAssetId,
                      actorRole,
                      storageKey: `runs/${workspace.manuscript.id}/proofreading/final`,
                      fileName: "proofreading-final.docx",
                    });
                    setWorkspace(result.workspace);
                    setLatestJob(result.runResult.job);
                    setStatus(`Finalized asset ${result.runResult.asset.id}`);
                  }),
              }
            : undefined
        }
        utilities={
          workspace
            ? {
                canExport: true,
                canRefreshLatestJob: Boolean(latestJob?.id),
                onExport: () =>
                  void run(async () => {
                    const exported = await controller.exportCurrentAsset({
                      manuscriptId: workspace.manuscript.id,
                    });
                    setLatestExport(exported.download.storage_key);
                    setStatus(`Prepared export ${exported.asset.id}`);
                  }),
                onRefreshLatestJob: () => {
                  if (!latestJob?.id) {
                    return;
                  }

                  void run(async () => {
                    const nextJob = await controller.loadJob(latestJob.id);
                    setLatestJob(nextJob);
                    setStatus(`Refreshed job ${nextJob.id}`);
                  });
                },
              }
            : undefined
        }
      />
      {workspace ? (
        <ManuscriptWorkbenchSummary
          workspace={workspace}
          latestJob={latestJob}
          latestExport={latestExport}
        />
      ) : null}
    </article>
  );
}

function resolveTitle(mode: ManuscriptWorkbenchMode): string {
  if (mode === "submission") return "Submission Workbench";
  if (mode === "screening") return "Screening Workbench";
  if (mode === "editing") return "Editing Workbench";
  return "Proofreading Workbench";
}

function resolveDescription(mode: ManuscriptWorkbenchMode): string {
  if (mode === "submission") return "Use the real HTTP intake contract from the web layer.";
  if (mode === "screening") return "Trigger governed screening runs over the persistent API.";
  if (mode === "editing") return "Trigger governed editing runs over the persistent API.";
  return "Create proofreading drafts and finalize them over the persistent API.";
}

function resolveActionLabel(mode: ManuscriptWorkbenchMode): string {
  if (mode === "screening") return "Run Screening";
  if (mode === "editing") return "Run Editing";
  if (mode === "proofreading") return "Create Draft";
  return "Run";
}

function resolveActionPanelTitle(mode: ManuscriptWorkbenchMode): string {
  if (mode === "screening") return "Screening Run";
  if (mode === "editing") return "Editing Run";
  if (mode === "proofreading") return "Proofreading Draft";
  return "Module Action";
}

function formatError(error: unknown): string {
  if (error instanceof BrowserHttpClientError) {
    return `${error.message}: ${JSON.stringify(error.responseBody)}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown workbench error";
}

function normalizeOptionalText(value: string): string | undefined {
  return value.trim().length > 0 ? value : undefined;
}

function hasUploadPayload(input: UploadManuscriptInput): boolean {
  return (
    (input.fileContentBase64?.trim().length ?? 0) > 0 ||
    (input.storageKey?.trim().length ?? 0) > 0
  );
}
