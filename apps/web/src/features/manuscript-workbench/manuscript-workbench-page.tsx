import React, { useEffect, useState } from "react";
import {
  WorkbenchCoreStrip,
  type WorkbenchCoreStripPillarId,
} from "../../app/workbench-core-strip.tsx";
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
import {
  ManuscriptWorkbenchNotice,
  type ManuscriptWorkbenchNoticeProps,
} from "./manuscript-workbench-notice.tsx";
import { createInlineUploadFields } from "./manuscript-upload-file.ts";
import {
  buildJobPostureDetails,
  buildLatestJobPostureDetails,
  buildManuscriptMainlineAttentionHandoffPackDetails,
  buildManuscriptMainlineAttemptLedgerDetails,
  buildManuscriptMainlineReadinessDetails,
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
    ...buildManuscriptMainlineReadinessDetails(
      workspace.manuscript.mainline_readiness_summary,
    ),
    ...buildManuscriptMainlineAttentionHandoffPackDetails(
      workspace.manuscript.mainline_attention_handoff_pack,
    ),
    ...buildManuscriptMainlineAttemptLedgerDetails(
      workspace.manuscript.mainline_attempt_ledger,
    ),
    ...(latestJob
        ? [
          {
            label: "Latest Job",
            value: latestJob.id,
          },
          ...buildLatestJobPostureDetails(
            latestJob,
            workspace.manuscript.module_execution_overview,
          ),
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
  overview?: ManuscriptWorkbenchWorkspace["manuscript"]["module_execution_overview"],
): WorkbenchActionResultDetail[] {
  return [...baseDetails, ...buildJobPostureDetails(job, "Job", overview)];
}

export function resolveWorkbenchNotice(input: {
  error: string;
  status: string;
  latestActionResult: WorkbenchActionResultViewModel | null;
}): ManuscriptWorkbenchNoticeProps | null {
  if (input.error) {
    return {
      tone: "error",
      title: "Action Error",
      message: input.error,
    };
  }

  const fallbackMessage =
    input.status.trim() || input.latestActionResult?.message.trim() || "";
  if (!fallbackMessage) {
    return null;
  }

  if (!input.latestActionResult || input.latestActionResult.tone !== "success") {
    return {
      tone: "success",
      title: "Action Complete",
      message: fallbackMessage,
    };
  }

  const settlement = findWorkbenchActionDetailValue(input.latestActionResult.details, "Settlement");
  if (!settlement || settlement === "Settled") {
    return {
      tone: "success",
      title: "Action Complete",
      message: fallbackMessage,
    };
  }

  return {
    tone: "success",
    title: "Action Recorded",
    message: buildWorkbenchActionNoticeMessage(
      fallbackMessage,
      settlement,
      findWorkbenchActionDetailValue(input.latestActionResult.details, "Recovery"),
      findWorkbenchActionDetailValue(input.latestActionResult.details, "Recovery Ready At"),
    ),
  };
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
      details: [
        ...buildWorkbenchJobActionResultDetails(
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
          workspace?.manuscript.module_execution_overview,
        ),
        ...buildManuscriptMainlineReadinessDetails(
          workspace?.manuscript.mainline_readiness_summary,
        ),
        ...buildManuscriptMainlineAttentionHandoffPackDetails(
          workspace?.manuscript.mainline_attention_handoff_pack,
        ),
        ...buildManuscriptMainlineAttemptLedgerDetails(
          workspace?.manuscript.mainline_attempt_ledger,
        ),
      ],
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
  const [selectedJournalTemplateId, setSelectedJournalTemplateId] = useState("");
  const canSubmitUpload =
    uploadForm.title.trim().length > 0 &&
    uploadForm.fileName.trim().length > 0 &&
    uploadForm.mimeType.trim().length > 0 &&
    hasUploadPayload(uploadForm);
  const workbenchBusy = busy || isPrefillLoading;
  const activeCoreStripPillar = resolveCoreStripActivePillar(mode);
  const notice = resolveWorkbenchNotice({
    error,
    status,
    latestActionResult,
  });

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
    setSelectedJournalTemplateId(
      workspace.manuscript.current_journal_template_id ?? "",
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
    setSelectedJournalTemplateId("");
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

  async function persistTemplateSelection(
    currentWorkspace: ManuscriptWorkbenchWorkspace,
    input: {
      emitActionResult: boolean;
    } = {
      emitActionResult: false,
    },
  ) {
    const nextJournalTemplateId =
      normalizeOptionalText(selectedJournalTemplateId) ?? null;
    const currentJournalTemplateId =
      currentWorkspace.manuscript.current_journal_template_id ?? null;
    if (nextJournalTemplateId === currentJournalTemplateId) {
      return currentWorkspace;
    }

    const result = await controller.updateTemplateSelectionAndLoad({
      manuscriptId: currentWorkspace.manuscript.id,
      journalTemplateId: nextJournalTemplateId,
    });
    setWorkspace(result.workspace);
    if (input.emitActionResult) {
      const appliedJournalLabel =
        result.workspace.selectedJournalTemplateProfile?.journal_name ?? "Base family only";
      setStatus(`Updated template context for ${result.workspace.manuscript.id}`);
      setLatestActionResult({
        tone: "success",
        actionLabel: "Save Template Context",
        message: `Updated template context for ${result.workspace.manuscript.id}`,
        details: [
          {
            label: "Base Template Family",
            value:
              result.workspace.templateFamily?.name ??
              result.workspace.manuscript.current_template_family_id ??
              "Not bound",
          },
          {
            label: "Journal Template",
            value: appliedJournalLabel,
          },
          {
            label: "Journal Overrides",
            value:
              result.workspace.selectedJournalTemplateProfile != null
                ? "Active"
                : "Base only",
          },
        ],
      });
    }

    return result.workspace;
  }

  return (
    <article
      className={`workbench-placeholder manuscript-workbench-shell manuscript-workbench-shell--${mode}`}
    >
      <header className="manuscript-workbench-hero">
        <div className="manuscript-workbench-hero-copy">
          <span className="manuscript-workbench-hero-eyebrow">
            {resolveHeroEyebrow(mode)}
          </span>
          <h2>{resolveTitle(mode)}</h2>
          <p>{resolveDescription(mode)}</p>
          {activeCoreStripPillar ? (
            <WorkbenchCoreStrip activePillarId={activeCoreStripPillar} />
          ) : null}
        </div>
        <dl className="manuscript-workbench-hero-metrics">
          <div className="manuscript-workbench-hero-metric">
            <dt>工作线定位</dt>
            <dd>{resolveHeroLane(mode)}</dd>
          </div>
          <div className="manuscript-workbench-hero-metric">
            <dt>当前焦点</dt>
            <dd>{resolveHeroFocus(mode)}</dd>
          </div>
        </dl>
      </header>
      {normalizedPrefilledManuscriptId.length > 0 ? (
        <p className="manuscript-workbench-prefill-note">
          该工作台已根据上一环节稿件自动带入。
        </p>
      ) : null}
      {shouldShowEvaluationHandoffContext ? (
        <section className="manuscript-workbench-evaluation-context-card" aria-live="polite">
          <div className="manuscript-workbench-evaluation-context-copy">
            <span className="manuscript-workbench-evaluation-context-eyebrow">
              评测移交上下文
            </span>
            <p>
              工作区仍按稿件维度自动加载，以下标识用于保留你进入时的评测样本上下文。
            </p>
          </div>
          <dl className="manuscript-workbench-evaluation-context-metrics">
            {normalizedPrefilledReviewedCaseSnapshotId.length > 0 ? (
              <>
                <dt>已审核案例快照 ID</dt>
                <dd>{normalizedPrefilledReviewedCaseSnapshotId}</dd>
              </>
            ) : null}
            {normalizedPrefilledSampleSetItemId.length > 0 ? (
              <>
                <dt>样本集条目 ID</dt>
                <dd>{normalizedPrefilledSampleSetItemId}</dd>
              </>
            ) : null}
          </dl>
        </section>
      ) : null}
      {notice ? <ManuscriptWorkbenchNotice {...notice} /> : null}
      {normalizedPrefilledManuscriptId.length > 0 && isPrefillLoading && !workspace ? (
        <section
          className="manuscript-workbench-loading-card"
          aria-live="polite"
          aria-label={`Loading manuscript ${normalizedPrefilledManuscriptId}`}
        >
          <div className="manuscript-workbench-loading-copy">
            <span className="manuscript-workbench-loading-eyebrow">
              稿件移交
            </span>
            <h3>{`正在加载稿件 ${normalizedPrefilledManuscriptId}...`}</h3>
            <p>
              正在拉取工作区资产与最新治理状态，完成后即可继续操作。
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
                        result.workspace.manuscript.module_execution_overview,
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
        templateSelection={
          workspace &&
          (mode === "editing" || mode === "proofreading") &&
          workspace.templateFamily
            ? {
                title: "Journal Template",
                baseTemplateLabel: workspace.templateFamily.name,
                selectedJournalTemplateId,
                currentAppliedLabel:
                  workspace.selectedJournalTemplateProfile?.journal_name ??
                  "Base family only",
                hasPendingChange:
                  (workspace.manuscript.current_journal_template_id ?? "") !==
                  selectedJournalTemplateId,
                options: (workspace.journalTemplateProfiles ?? []).map((profile) => ({
                  value: profile.id,
                  label: profile.journal_name,
                })),
                onSelect: setSelectedJournalTemplateId,
                onApply: () =>
                  void run("Save Template Context", async () => {
                    const updatedWorkspace = await persistTemplateSelection(workspace, {
                      emitActionResult: true,
                    });
                    return {
                      tone: "success",
                      actionLabel: "Save Template Context",
                      message: `Updated template context for ${updatedWorkspace.manuscript.id}`,
                      details: [
                        {
                          label: "Base Template Family",
                          value:
                            updatedWorkspace.templateFamily?.name ??
                            updatedWorkspace.manuscript.current_template_family_id ??
                            "Not bound",
                        },
                        {
                          label: "Journal Template",
                          value:
                            updatedWorkspace.selectedJournalTemplateProfile?.journal_name ??
                            "Base family only",
                        },
                        {
                          label: "Journal Overrides",
                          value:
                            updatedWorkspace.selectedJournalTemplateProfile != null
                              ? "Active"
                              : "Base only",
                        },
                      ],
                    };
                  }),
              }
            : undefined
        }
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
                    const synchronizedWorkspace = await persistTemplateSelection(workspace);
                    const result = await controller.runModuleAndLoad({
                      mode,
                      manuscriptId: synchronizedWorkspace.manuscript.id,
                      parentAssetId,
                      actorRole,
                      storageKey: `runs/${synchronizedWorkspace.manuscript.id}/${mode}/output`,
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
                        result.workspace.manuscript.module_execution_overview,
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
                        result.workspace.manuscript.module_execution_overview,
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
                        result.workspace.manuscript.module_execution_overview,
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
  if (mode === "submission") return "投稿工作台";
  if (mode === "screening") return "初筛工作台";
  if (mode === "editing") return "编辑工作台";
  return "校对工作台";
}

function resolveDescription(mode: ManuscriptWorkbenchMode): string {
  if (mode === "submission") {
    return "通过当前 Web 壳层接入稿件，并为后续治理流程建立统一入口。";
  }

  if (mode === "screening") {
    return "集中完成来稿判断、风险确认与向编辑移交，让首道工作线更清楚。";
  }

  if (mode === "editing") {
    return "围绕正文修订、模板上下文与校对前准备组织编辑动作，保持工作台轻而稳。";
  }

  return "收束问题清单、终稿确认与发布前检查，完成最后一跳的校对定稿。";
}

function resolveHeroEyebrow(mode: ManuscriptWorkbenchMode): string {
  if (mode === "submission") {
    return "稿件接入";
  }

  return "核心工作台";
}

function resolveHeroLane(mode: ManuscriptWorkbenchMode): string {
  if (mode === "submission") {
    return "投稿接入";
  }

  if (mode === "screening") {
    return "初筛";
  }

  if (mode === "editing") {
    return "编辑";
  }

  return "校对";
}

function resolveHeroFocus(mode: ManuscriptWorkbenchMode): string {
  if (mode === "submission") {
    return "采集稿件元数据并为后续治理流程建立统一起点。";
  }

  if (mode === "screening") {
    return "确认稿件就绪度、完成初筛判断，并准备向编辑台移交。";
  }

  if (mode === "editing") {
    return "围绕治理稿继续修订，并保留向校对台移交所需的上下文。";
  }

  return "生成校对草稿、确认带批注终稿，并为最终发布做好准备。";
}

function resolveCoreStripActivePillar(
  mode: ManuscriptWorkbenchMode,
): WorkbenchCoreStripPillarId | null {
  if (mode === "screening") {
    return "screening";
  }

  if (mode === "editing") {
    return "editing";
  }

  if (mode === "proofreading") {
    return "proofreading";
  }

  return null;
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

function findWorkbenchActionDetailValue(
  details: WorkbenchActionResultDetail[],
  labelSuffix: string,
): string | undefined {
  return details.find((detail) => detail.label.endsWith(labelSuffix))?.value;
}

function buildWorkbenchActionNoticeMessage(
  status: string,
  settlement: string,
  recovery?: string,
  recoveryReadyAt?: string,
): string {
  switch (settlement) {
    case "Business complete, follow-up pending":
    case "Business complete, follow-up running":
      return `${status} Governed follow-up is not settled yet.`;
    case "Business complete, follow-up retryable":
      if (recovery === "Waiting for retry window" && recoveryReadyAt) {
        return `${status} Governed follow-up is retryable after ${recoveryReadyAt} and still needs attention.`;
      }

      return `${status} Governed follow-up is retryable and still needs attention.`;
    case "Business complete, follow-up failed":
      return `${status} Governed follow-up failed and needs inspection.`;
    case "Business complete, settlement unlinked":
      return `${status} Settlement linkage is incomplete and needs inspection.`;
    case "Job failed":
      return `${status} The latest governed attempt failed and needs inspection.`;
    case "Job in progress":
      return `${status} The latest governed run is still in progress.`;
    case "Not started":
      return `${status} The latest governed follow-up has not started yet.`;
    default:
      return status;
  }
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
