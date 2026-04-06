import React, { useEffect, useState } from "react";
import { createBrowserHttpClient, BrowserHttpClientError } from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/index.ts";
import type {
  DocumentAssetExportViewModel,
  JobViewModel,
  UploadManuscriptInput,
} from "../manuscripts/index.ts";
import type { ModuleJobViewModel } from "../screening/index.ts";
import {
  ManuscriptWorkbenchControls,
} from "./manuscript-workbench-controls.tsx";
import { ManuscriptWorkbenchNotice } from "./manuscript-workbench-notice.tsx";
import { createInlineUploadFields } from "./manuscript-upload-file.ts";
import {
  buildJobPostureDetails,
  buildLatestJobPostureDetails,
  ManuscriptWorkbenchSummary,
  type WorkbenchActionResultViewModel,
  type WorkbenchActionResultDetail,
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
  prefilledManuscriptId?: string;
  prefilledReviewedCaseSnapshotId?: string;
  prefilledSampleSetItemId?: string;
  accessibleHandoffModes?: readonly ManuscriptWorkbenchMode[];
  canOpenLearningReview?: boolean;
  canOpenEvaluationWorkbench?: boolean;
}

export async function loadPrefilledWorkbenchWorkspace(
  controller: Pick<ManuscriptWorkbenchController, "loadWorkspace" | "loadJob">,
  manuscriptId: string,
): Promise<{
  workspace: ManuscriptWorkbenchWorkspace;
  latestJob: JobViewModel | null;
  status: string;
  latestActionResult: WorkbenchActionResultViewModel;
}> {
  const workspace = await controller.loadWorkspace(manuscriptId);
  const latestJob = await hydrateLatestWorkbenchJob(controller, workspace);
  const status = `Auto-loaded manuscript ${workspace.manuscript.id}`;
  const details = [
    {
      label: "Manuscript",
      value: workspace.manuscript.id,
    },
    {
      label: "Current Asset",
      value: workspace.currentAsset?.id ?? "Not available",
    },
    ...(latestJob
      ? [
          {
            label: "Latest Job",
            value: latestJob.id,
          },
          ...buildLatestJobPostureDetails(latestJob),
        ]
      : []),
  ];

  return {
    workspace,
    latestJob,
    status,
    latestActionResult: {
      tone: "success",
      actionLabel: "Load Workspace",
      message: status,
      details,
    },
  };
}

export function buildWorkbenchJobActionResultDetails(
  baseDetails: WorkbenchActionResultDetail[],
  job: JobViewModel | ModuleJobViewModel,
): WorkbenchActionResultDetail[] {
  return [...baseDetails, ...buildJobPostureDetails(job, "Job")];
}

export async function refreshLatestWorkbenchJobContext(
  controller: Pick<ManuscriptWorkbenchController, "loadJob" | "loadWorkspace">,
  input: {
    manuscriptId: string;
    latestJobId: string;
  },
): Promise<{
  latestJob: JobViewModel;
  workspace: ManuscriptWorkbenchWorkspace | null;
  status: string;
  latestActionResult: WorkbenchActionResultViewModel;
}> {
  const latestJob = await controller.loadJob(input.latestJobId);
  let workspace: ManuscriptWorkbenchWorkspace | null = null;

  try {
    workspace = await controller.loadWorkspace(input.manuscriptId);
  } catch {
    workspace = null;
  }

  const status = `Refreshed job ${latestJob.id}`;

  return {
    latestJob,
    workspace,
    status,
    latestActionResult: {
      tone: "success",
      actionLabel: "Refresh Latest Job",
      message: status,
      details: buildWorkbenchJobActionResultDetails(
        [
          {
            label: "Job",
            value: latestJob.id,
          },
          {
            label: "Status",
            value: latestJob.status,
          },
        ],
        latestJob,
      ),
    },
  };
}

const defaultController = createManuscriptWorkbenchController(createBrowserHttpClient());
type AnyWorkbenchJob = JobViewModel | ModuleJobViewModel;

export function ManuscriptWorkbenchPage({
  mode,
  actorRole = "user",
  controller = defaultController,
  prefilledManuscriptId,
  prefilledReviewedCaseSnapshotId,
  prefilledSampleSetItemId,
  accessibleHandoffModes,
  canOpenLearningReview = false,
  canOpenEvaluationWorkbench = false,
}: ManuscriptWorkbenchPageProps) {
  const canUpload = mode === "submission" || actorRole === "admin";
  const normalizedPrefilledManuscriptId = prefilledManuscriptId?.trim() ?? "";
  const normalizedPrefilledReviewedCaseSnapshotId =
    prefilledReviewedCaseSnapshotId?.trim() ?? "";
  const normalizedPrefilledSampleSetItemId = prefilledSampleSetItemId?.trim() ?? "";
  const hasEvaluationHandoffContext =
    normalizedPrefilledReviewedCaseSnapshotId.length > 0 ||
    normalizedPrefilledSampleSetItemId.length > 0;
  const [lookupId, setLookupId] = useState(normalizedPrefilledManuscriptId);
  const [workspace, setWorkspace] = useState<ManuscriptWorkbenchWorkspace | null>(null);
  const shouldShowEvaluationHandoffContext =
    hasEvaluationHandoffContext &&
    normalizedPrefilledManuscriptId.length > 0 &&
    (workspace ? workspace.manuscript.id === normalizedPrefilledManuscriptId : true);
  const [latestJob, setLatestJob] = useState<AnyWorkbenchJob | null>(null);
  const [latestExport, setLatestExport] = useState<DocumentAssetExportViewModel | null>(null);
  const [latestActionResult, setLatestActionResult] =
    useState<WorkbenchActionResultViewModel | null>(null);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [isPrefillLoading, setIsPrefillLoading] = useState(
    normalizedPrefilledManuscriptId.length > 0,
  );
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
  const workbenchBusy = busy || isPrefillLoading;

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

  useEffect(() => {
    if (normalizedPrefilledManuscriptId.length === 0) {
      setIsPrefillLoading(false);
      return;
    }

    setIsPrefillLoading(true);
    setLookupId(normalizedPrefilledManuscriptId);
    setWorkspace(null);
    setLatestJob(null);
    setLatestExport(null);
    setLatestActionResult(null);
    setStatus("");
    setError("");
    setParentAssetId("");
    setDraftAssetId("");
  }, [normalizedPrefilledManuscriptId]);

  useEffect(() => {
    if (normalizedPrefilledManuscriptId.length === 0) {
      return;
    }

    let cancelled = false;
    setBusy(true);
    setError("");

    void loadPrefilledWorkbenchWorkspace(controller, normalizedPrefilledManuscriptId)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setWorkspace(result.workspace);
        setLatestJob(result.latestJob);
        setLatestExport(null);
        setStatus(result.status);
        setLatestActionResult(result.latestActionResult);
      })
      .catch((nextError) => {
        if (cancelled) {
          return;
        }

        const message = formatError(nextError);
        setStatus("");
        setError(message);
        setLatestActionResult({
          tone: "error",
          actionLabel: "Load Workspace",
          message,
          details: [],
        });
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false);
          setIsPrefillLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [controller, normalizedPrefilledManuscriptId]);

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
      {normalizedPrefilledManuscriptId.length > 0 ? (
        <p className="manuscript-workbench-prefill-note">
          This workbench was prefilled from the previous manuscript handoff.
        </p>
      ) : null}
      {shouldShowEvaluationHandoffContext ? (
        <section className="manuscript-workbench-evaluation-context-card" aria-live="polite">
          <div className="manuscript-workbench-evaluation-context-copy">
            <span className="manuscript-workbench-evaluation-context-eyebrow">
              Evaluation Handoff Context
            </span>
            <p>
              Workspace auto-load remains manuscript-scoped. These IDs identify the
              evaluation sample context you navigated from.
            </p>
          </div>
          <dl className="manuscript-workbench-evaluation-context-metrics">
            {normalizedPrefilledReviewedCaseSnapshotId.length > 0 ? (
              <>
                <dt>Reviewed Case Snapshot ID</dt>
                <dd>{normalizedPrefilledReviewedCaseSnapshotId}</dd>
              </>
            ) : null}
            {normalizedPrefilledSampleSetItemId.length > 0 ? (
              <>
                <dt>Sample Set Item ID</dt>
                <dd>{normalizedPrefilledSampleSetItemId}</dd>
              </>
            ) : null}
          </dl>
        </section>
      ) : null}
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
      {normalizedPrefilledManuscriptId.length > 0 && isPrefillLoading && !workspace ? (
        <section
          className="manuscript-workbench-loading-card"
          aria-live="polite"
          aria-label={`Loading manuscript ${normalizedPrefilledManuscriptId}`}
        >
          <div className="manuscript-workbench-loading-copy">
            <span className="manuscript-workbench-loading-eyebrow">
              Manuscript Handoff
            </span>
            <h3>{`Loading manuscript ${normalizedPrefilledManuscriptId}...`}</h3>
            <p>
              Fetching workspace assets and latest governed state before enabling actions.
            </p>
          </div>
          <div
            className="manuscript-workbench-loading-skeleton"
            aria-hidden="true"
          >
            <span className="manuscript-workbench-loading-bar is-primary" />
            <span className="manuscript-workbench-loading-bar" />
            <span className="manuscript-workbench-loading-bar is-short" />
          </div>
        </section>
      ) : null}
      <ManuscriptWorkbenchControls
        mode={mode}
        busy={workbenchBusy}
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
                      details: buildWorkbenchJobActionResultDetails(
                        [
                          {
                            label: "Manuscript",
                            value: result.upload.manuscript.id,
                          },
                          {
                            label: "Job",
                            value: result.upload.job.id,
                          },
                        ],
                        result.upload.job,
                      ),
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
              const result = await loadPrefilledWorkbenchWorkspace(controller, lookupId.trim());
              setWorkspace(result.workspace);
              setLatestJob(result.latestJob);
              setStatus(`Loaded manuscript ${result.workspace.manuscript.id}`);
              return {
                ...result.latestActionResult,
                message: `Loaded manuscript ${result.workspace.manuscript.id}`,
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
                      details: buildWorkbenchJobActionResultDetails(
                        [
                          {
                            label: "Asset",
                            value: result.runResult.asset.id,
                          },
                          {
                            label: "Job",
                            value: result.runResult.job.id,
                          },
                        ],
                        result.runResult.job,
                      ),
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
                      details: buildWorkbenchJobActionResultDetails(
                        [
                          {
                            label: "Asset",
                            value: result.runResult.asset.id,
                          },
                          {
                            label: "Job",
                            value: result.runResult.job.id,
                          },
                        ],
                        result.runResult.job,
                      ),
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
                    setLatestExport(exported);
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
                          label: "Export File Name",
                          value: exported.download.file_name ?? exported.asset.file_name ?? "Not provided",
                        },
                        {
                          label: "Download MIME Type",
                          value: exported.download.mime_type,
                        },
                        {
                          label: "Storage Key",
                          value: exported.download.storage_key,
                        },
                      ],
                    };
                  }),
                canPublishHumanFinal:
                  mode === "proofreading" &&
                  workspace.currentAsset?.asset_type === "final_proof_annotated_docx",
                onPublishHumanFinal: () =>
                  void run("Publish Human Final", async () => {
                    if (workspace.currentAsset?.asset_type !== "final_proof_annotated_docx") {
                      throw new Error(
                        "A finalized proofreading asset is required before publishing the human-final manuscript.",
                      );
                    }

                    const result = await controller.publishHumanFinalAndLoad({
                      manuscriptId: workspace.manuscript.id,
                      finalAssetId: workspace.currentAsset.id,
                      actorRole,
                      storageKey: `runs/${workspace.manuscript.id}/proofreading/human-final`,
                      fileName: "human-final.docx",
                    });
                    setWorkspace(result.workspace);
                    setLatestJob(result.runResult.job);
                    setLatestExport(null);
                    setStatus(`Published human-final asset ${result.runResult.asset.id}`);
                    return {
                      tone: "success",
                      actionLabel: "Publish Human Final",
                      message: `Published human-final asset ${result.runResult.asset.id}`,
                      details: buildWorkbenchJobActionResultDetails(
                        [
                          {
                            label: "Asset",
                            value: result.runResult.asset.id,
                          },
                          {
                            label: "Job",
                            value: result.runResult.job.id,
                          },
                        ],
                        result.runResult.job,
                      ),
                    };
                  }),
                onRefreshLatestJob: () => {
                  if (!latestJob?.id) {
                    return;
                  }

                  void run("Refresh Latest Job", async () => {
                    const result = await refreshLatestWorkbenchJobContext(controller, {
                      manuscriptId: workspace.manuscript.id,
                      latestJobId: latestJob.id,
                    });
                    setLatestJob(result.latestJob);
                    if (result.workspace) {
                      setWorkspace(result.workspace);
                    }
                    setStatus(result.status);
                    return result.latestActionResult;
                  });
                },
              }
            : undefined
        }
      />
      {workspace ? (
        <ManuscriptWorkbenchSummary
          mode={mode}
          accessibleHandoffModes={accessibleHandoffModes}
          canOpenLearningReview={canOpenLearningReview}
          canOpenEvaluationWorkbench={canOpenEvaluationWorkbench}
          prefilledManuscriptId={normalizedPrefilledManuscriptId}
          prefilledReviewedCaseSnapshotId={normalizedPrefilledReviewedCaseSnapshotId}
          prefilledSampleSetItemId={normalizedPrefilledSampleSetItemId}
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

const MAINLINE_WORKBENCH_MODULE_ORDER = ["screening", "editing", "proofreading"] as const;

function resolveLatestWorkbenchJobCandidate(
  workspace: ManuscriptWorkbenchWorkspace,
): JobViewModel | null {
  const overview = workspace.manuscript.module_execution_overview;
  if (!overview) {
    return null;
  }

  let candidate: JobViewModel | null = null;

  for (const module of MAINLINE_WORKBENCH_MODULE_ORDER) {
    const nextJob = overview[module].latest_job;
    if (!nextJob) {
      continue;
    }

    if (!candidate || compareWorkbenchJobRecency(nextJob, candidate) > 0) {
      candidate = nextJob;
    }
  }

  return candidate;
}

function compareWorkbenchJobRecency(left: JobViewModel, right: JobViewModel): number {
  const updatedComparison = left.updated_at.localeCompare(right.updated_at);
  if (updatedComparison !== 0) {
    return updatedComparison;
  }

  const createdComparison = left.created_at.localeCompare(right.created_at);
  if (createdComparison !== 0) {
    return createdComparison;
  }

  const leftIndex = MAINLINE_WORKBENCH_MODULE_ORDER.indexOf(
    left.module as (typeof MAINLINE_WORKBENCH_MODULE_ORDER)[number],
  );
  const rightIndex = MAINLINE_WORKBENCH_MODULE_ORDER.indexOf(
    right.module as (typeof MAINLINE_WORKBENCH_MODULE_ORDER)[number],
  );

  return rightIndex - leftIndex;
}

async function hydrateLatestWorkbenchJob(
  controller: Pick<ManuscriptWorkbenchController, "loadJob">,
  workspace: ManuscriptWorkbenchWorkspace,
): Promise<JobViewModel | null> {
  const candidate = resolveLatestWorkbenchJobCandidate(workspace);
  if (!candidate) {
    return null;
  }

  try {
    return await controller.loadJob(candidate.id);
  } catch {
    return candidate;
  }
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
