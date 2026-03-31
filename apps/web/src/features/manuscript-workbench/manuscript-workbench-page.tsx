import React, { useEffect, useState } from "react";
import { createBrowserHttpClient, BrowserHttpClientError } from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/index.ts";
import type { JobViewModel, UploadManuscriptInput } from "../manuscripts/index.ts";
import type { ModuleJobViewModel } from "../screening/index.ts";
import {
  ManuscriptWorkbenchControls,
} from "./manuscript-workbench-controls.tsx";
import { ManuscriptWorkbenchNotice } from "./manuscript-workbench-notice.tsx";
import { createInlineUploadFields } from "./manuscript-upload-file.ts";
import {
  ManuscriptWorkbenchSummary,
  type WorkbenchActionResultViewModel,
} from "./manuscript-workbench-summary.tsx";
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
  const [latestActionResult, setLatestActionResult] =
    useState<WorkbenchActionResultViewModel | null>(null);
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

  async function run(
    actionLabel: string,
    task: () => Promise<WorkbenchActionResultViewModel | void>,
  ) {
    setBusy(true);
    setError("");
    try {
      const result = await task();
      if (result) {
        setLatestActionResult(result);
      }
    } catch (nextError) {
      const message = formatError(nextError);
      setStatus("");
      setError(message);
      setLatestActionResult({
        tone: "error",
        actionLabel,
        message,
        details: [],
      });
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
      setLatestActionResult({
        tone: "success",
        actionLabel: "Attach Manuscript File",
        message: `Attached file ${inlineFields.fileName}`,
        details: [
          {
            label: "File",
            value: inlineFields.fileName,
          },
          {
            label: "MIME Type",
            value: inlineFields.mimeType,
          },
        ],
      });
    } catch (nextError) {
      const message = formatError(nextError);
      setStatus("");
      setError(message);
      setLatestActionResult({
        tone: "error",
        actionLabel: "Attach Manuscript File",
        message,
        details: [],
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="workbench-placeholder">
      <h2>{resolveTitle(mode)}</h2>
      <p>{resolveDescription(mode)}</p>
      {error ? (
        <ManuscriptWorkbenchNotice
          tone="error"
          title="Action Error"
          message={error}
        />
      ) : null}
      {!error && status ? (
        <ManuscriptWorkbenchNotice
          tone="success"
          title="Action Complete"
          message={status}
        />
      ) : null}
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
                  void run("Upload Manuscript", async () => {
                    const result = await controller.uploadManuscriptAndLoad(uploadForm);
                    setWorkspace(result.workspace);
                    setLatestJob(result.upload.job);
                    setStatus(`Uploaded manuscript ${result.upload.manuscript.id}`);
                    return {
                      tone: "success",
                      actionLabel: "Upload Manuscript",
                      message: `Uploaded manuscript ${result.upload.manuscript.id}`,
                      details: [
                        {
                          label: "Manuscript",
                          value: result.upload.manuscript.id,
                        },
                        {
                          label: "Job",
                          value: result.upload.job.id,
                        },
                      ],
                    };
                  }),
              }
            : undefined
        }
        lookup={{
          manuscriptId: lookupId,
          onChange: setLookupId,
          onLoad: () =>
            void run("Load Workspace", async () => {
              const nextWorkspace = await controller.loadWorkspace(lookupId.trim());
              setWorkspace(nextWorkspace);
              setStatus(`Loaded manuscript ${nextWorkspace.manuscript.id}`);
              return {
                tone: "success",
                actionLabel: "Load Workspace",
                message: `Loaded manuscript ${nextWorkspace.manuscript.id}`,
                details: [
                  {
                    label: "Manuscript",
                    value: nextWorkspace.manuscript.id,
                  },
                  {
                    label: "Current Asset",
                    value: nextWorkspace.currentAsset?.id ?? "Not available",
                  },
                ],
              };
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
                    label: formatAssetOptionLabel(asset),
                  })),
                selectedContextLabel: "Selected Parent Asset",
                onSelect: setParentAssetId,
                onRun: () =>
                  void run(resolveActionLabel(mode), async () => {
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
                    return {
                      tone: "success",
                      actionLabel: resolveActionLabel(mode),
                      message: `Created asset ${result.runResult.asset.id}`,
                      details: [
                        {
                          label: "Asset",
                          value: result.runResult.asset.id,
                        },
                        {
                          label: "Job",
                          value: result.runResult.job.id,
                        },
                      ],
                    };
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
                    label: formatAssetOptionLabel(asset),
                  })),
                selectedContextLabel: "Selected Draft Asset",
                onSelect: setDraftAssetId,
                onRun: () =>
                  void run("Finalize Proofreading", async () => {
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
                    return {
                      tone: "success",
                      actionLabel: "Finalize Proofreading",
                      message: `Finalized asset ${result.runResult.asset.id}`,
                      details: [
                        {
                          label: "Asset",
                          value: result.runResult.asset.id,
                        },
                        {
                          label: "Job",
                          value: result.runResult.job.id,
                        },
                      ],
                    };
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
                  void run("Export Current Asset", async () => {
                    const exported = await controller.exportCurrentAsset({
                      manuscriptId: workspace.manuscript.id,
                    });
                    setLatestExport(exported.download.storage_key);
                    setStatus(`Prepared export ${exported.asset.id}`);
                    return {
                      tone: "success",
                      actionLabel: "Export Current Asset",
                      message: `Prepared export ${exported.asset.id}`,
                      details: [
                        {
                          label: "Asset",
                          value: exported.asset.id,
                        },
                        {
                          label: "Storage Key",
                          value: exported.download.storage_key,
                        },
                      ],
                    };
                  }),
                onRefreshLatestJob: () => {
                  if (!latestJob?.id) {
                    return;
                  }

                  void run("Refresh Latest Job", async () => {
                    const nextJob = await controller.loadJob(latestJob.id);
                    setLatestJob(nextJob);
                    setStatus(`Refreshed job ${nextJob.id}`);
                    return {
                      tone: "success",
                      actionLabel: "Refresh Latest Job",
                      message: `Refreshed job ${nextJob.id}`,
                      details: [
                        {
                          label: "Job",
                          value: nextJob.id,
                        },
                        {
                          label: "Status",
                          value: nextJob.status,
                        },
                      ],
                    };
                  });
                },
              }
            : undefined
        }
      />
      {workspace ? (
        <ManuscriptWorkbenchSummary
          mode={mode}
          workspace={workspace}
          latestJob={latestJob}
          latestExport={latestExport}
          latestActionResult={latestActionResult}
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

function formatAssetOptionLabel(asset: {
  id: string;
  asset_type: string;
  file_name?: string | null;
}): string {
  return `${asset.file_name ?? asset.asset_type} · ${asset.asset_type} · ${asset.id}`;
}
