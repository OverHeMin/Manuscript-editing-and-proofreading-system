import React, { useEffect, useState } from "react";
import { createBrowserHttpClient, BrowserHttpClientError } from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/index.ts";
import type { JobViewModel, ManuscriptType, UploadManuscriptInput } from "../manuscripts/index.ts";
import type { ModuleJobViewModel } from "../screening/index.ts";
import { createInlineUploadFields } from "./manuscript-upload-file.ts";
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
const manuscriptTypeOptions: ManuscriptType[] = [
  "clinical_study",
  "review",
  "systematic_review",
  "meta_analysis",
  "case_report",
  "guideline_interpretation",
  "expert_consensus",
  "diagnostic_study",
  "basic_research",
  "nursing_study",
  "methodology_paper",
  "brief_report",
  "other",
];

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
      {canUpload ? (
        <>
          <p>
            <label>
              Title{" "}
              <input
                value={uploadForm.title}
                onChange={(event) =>
                  setUploadForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
            </label>
          </p>
          <p>
            <label>
              Manuscript Type{" "}
              <select
                value={uploadForm.manuscriptType}
                onChange={(event) =>
                  setUploadForm((current) => ({
                    ...current,
                    manuscriptType: event.target.value as ManuscriptType,
                  }))
                }
              >
                {manuscriptTypeOptions.map((manuscriptType) => (
                  <option key={manuscriptType} value={manuscriptType}>
                    {manuscriptType}
                  </option>
                ))}
              </select>
            </label>
          </p>
          <p>
            <label>
              Storage Key{" "}
              <input
                value={uploadForm.storageKey ?? ""}
                placeholder="Optional when a local file is selected"
                onChange={(event) =>
                  setUploadForm((current) => ({
                    ...current,
                    storageKey: normalizeOptionalText(event.target.value),
                  }))
                }
              />
            </label>
          </p>
          <p>
            <label>
              Manuscript File{" "}
              <input
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) {
                    return;
                  }

                  void attachUploadFile(file);
                }}
              />
            </label>
          </p>
          <p>
            {uploadForm.fileContentBase64
              ? `Selected local file: ${uploadForm.fileName}`
              : "No local file selected. Enter a storage key to keep using metadata-only uploads."}
          </p>
          <p>
            <button
              type="button"
              disabled={busy || !canSubmitUpload}
              onClick={() =>
                void run(async () => {
                  const result = await controller.uploadManuscriptAndLoad(uploadForm);
                  setWorkspace(result.workspace);
                  setLatestJob(result.upload.job);
                  setStatus(`Uploaded manuscript ${result.upload.manuscript.id}`);
                })
              }
            >
              {busy ? "Working..." : "Upload Manuscript"}
            </button>
          </p>
        </>
      ) : null}
      <p>
        <label>
          Manuscript ID{" "}
          <input value={lookupId} onChange={(event) => setLookupId(event.target.value)} />
        </label>{" "}
        <button type="button" disabled={busy} onClick={() => void run(async () => {
          const nextWorkspace = await controller.loadWorkspace(lookupId.trim());
          setWorkspace(nextWorkspace);
          setStatus(`Loaded manuscript ${nextWorkspace.manuscript.id}`);
        })}>
          Load Workspace
        </button>
      </p>
      {workspace ? (
        <>
          {mode !== "submission" ? (
            <p>
              <label>
                Parent Asset{" "}
                <select value={parentAssetId} onChange={(event) => setParentAssetId(event.target.value)}>
                  <option value="">Select asset</option>
                  {workspace.assets.filter((asset) => isSelectableParentAsset(asset)).map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.asset_type} · {asset.id}
                    </option>
                  ))}
                </select>
              </label>{" "}
              <button type="button" disabled={busy || parentAssetId.length === 0} onClick={() => void run(async () => {
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
              })}>
                {busy ? "Working..." : resolveActionLabel(mode)}
              </button>
            </p>
          ) : null}
          {mode === "proofreading" ? (
            <p>
              <label>
                Draft Asset{" "}
                <select value={draftAssetId} onChange={(event) => setDraftAssetId(event.target.value)}>
                  <option value="">Select draft</option>
                  {workspace.assets.filter((asset) => asset.asset_type === "proofreading_draft_report").map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.id}
                    </option>
                  ))}
                </select>
              </label>{" "}
              <button type="button" disabled={busy || draftAssetId.length === 0} onClick={() => void run(async () => {
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
              })}>
                {busy ? "Working..." : "Finalize Proofreading"}
              </button>
            </p>
          ) : null}
          <p>
            <button type="button" disabled={busy} onClick={() => void run(async () => {
              const exported = await controller.exportCurrentAsset({ manuscriptId: workspace.manuscript.id });
              setLatestExport(exported.download.storage_key);
              setStatus(`Prepared export ${exported.asset.id}`);
            })}>
              Export Current Asset
            </button>
            {latestJob?.id ? (
              <>
                {" "}
                <button type="button" disabled={busy} onClick={() => void run(async () => {
                  const nextJob = await controller.loadJob(latestJob.id);
                  setLatestJob(nextJob);
                  setStatus(`Refreshed job ${nextJob.id}`);
                })}>
                  Refresh Latest Job
                </button>
              </>
            ) : null}
          </p>
          <pre>{JSON.stringify({ workspace, latestJob, latestExport }, null, 2)}</pre>
        </>
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
