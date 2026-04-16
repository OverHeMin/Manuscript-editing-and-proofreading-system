import React, { useEffect, useState } from "react";
import {
  WorkbenchCoreStrip,
  type WorkbenchCoreStripPillarId,
} from "../../app/workbench-core-strip.tsx";
import {
  createBrowserHttpClient,
  BrowserHttpClientError,
  resolveBrowserApiUrl,
} from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/index.ts";
import type {
  DocumentAssetExportViewModel,
  JobViewModel,
  ManuscriptType,
  UploadManuscriptInput,
} from "../manuscripts/index.ts";
import { MAX_MANUSCRIPT_BATCH_UPLOAD_COUNT } from "../manuscripts/index.ts";
import type { ModuleJobViewModel } from "../screening/index.ts";
import {
  ManuscriptWorkbenchControls,
  type ManuscriptWorkbenchActionPanelProps,
  type ManuscriptWorkbenchLookupPanelProps,
  type ManuscriptWorkbenchTemplateSelectionPanelProps,
} from "./manuscript-workbench-controls.tsx";
import {
  ManuscriptWorkbenchQueuePane,
  type ManuscriptWorkbenchQueueFilter,
  type ManuscriptWorkbenchQueueItem,
} from "./manuscript-workbench-queue-pane.tsx";
import { ManuscriptWorkbenchBatchDrawer } from "./manuscript-workbench-batch-drawer.tsx";
import {
  ManuscriptWorkbenchNotice,
  type ManuscriptWorkbenchNoticeProps,
} from "./manuscript-workbench-notice.tsx";
import { createInlineUploadFields } from "./manuscript-upload-file.ts";
import {
  buildJobBatchProgressDetails,
  buildJobPostureDetails,
  buildJobReviewEvidenceDetails,
  buildLatestJobPostureDetails,
  buildManuscriptMainlineAttentionHandoffPackDetails,
  buildManuscriptMainlineAttemptLedgerDetails,
  buildManuscriptMainlineReadinessDetails,
  formatWorkbenchActionResultMessage,
  ManuscriptWorkbenchSummary,
  type WorkbenchActionResultViewModel,
  type WorkbenchActionResultDetail,
} from "./manuscript-workbench-summary.tsx";
import {
  createManuscriptWorkbenchController,
  isSelectableParentAsset,
  resolveWorkbenchReadOnlyExecutionContext,
  type ManuscriptWorkbenchController,
  type ManuscriptWorkbenchMode,
  type ManuscriptWorkbenchRunMode,
  type ManuscriptWorkbenchTemplateContext,
  type ManuscriptWorkbenchWorkspace,
} from "./manuscript-workbench-controller.ts";

const BARE_AI_ACTION_LABEL = "Run Bare AI Once";

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
  return [
    ...baseDetails,
    ...buildJobPostureDetails(job, "Job", overview),
    ...buildJobBatchProgressDetails(job),
    ...buildJobReviewEvidenceDetails(job),
  ];
}

export function resolveWorkbenchNotice(input: {
  error: string;
  status: string;
  latestActionResult: WorkbenchActionResultViewModel | null;
}): ManuscriptWorkbenchNoticeProps | null {
  if (input.error) {
    return {
      tone: "error",
      title: "操作失败",
      message: input.error,
    };
  }

  const fallbackMessage =
    input.status.trim() || input.latestActionResult?.message.trim() || "";
  const localizedFallbackMessage = formatWorkbenchActionResultMessage(fallbackMessage);
  if (!fallbackMessage) {
    return null;
  }

  if (!input.latestActionResult || input.latestActionResult.tone !== "success") {
    return {
      tone: "success",
      title: "操作已完成",
      message: localizedFallbackMessage,
    };
  }

  if (
    input.latestActionResult.actionLabel === "Upload Manuscript" ||
    fallbackMessage.startsWith("Uploaded manuscript ")
  ) {
    return {
      tone: "success",
      title: "操作已完成",
      message: localizedFallbackMessage,
    };
  }

  const settlement = findWorkbenchActionDetailValue(input.latestActionResult.details, "Settlement");
  if (!settlement || settlement === "Settled" || settlement === "已结算") {
    return {
      tone: "success",
      title: "操作已完成",
      message: localizedFallbackMessage,
    };
  }

  return {
    tone: "success",
    title: "操作已记录",
    message: buildWorkbenchActionNoticeMessage(
      localizedFallbackMessage,
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
    createdBy: "web-workbench",
    fileName: `${mode}-sample.docx`,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "",
  });
  const [attachedUploadFiles, setAttachedUploadFiles] = useState<
    Array<{
      fileName: string;
      mimeType: string;
      fileContentBase64: string;
    }>
  >([]);
  const [parentAssetId, setParentAssetId] = useState("");
  const [draftAssetId, setDraftAssetId] = useState("");
  const [selectedTemplateFamilyId, setSelectedTemplateFamilyId] = useState("");
  const [selectedJournalTemplateId, setSelectedJournalTemplateId] = useState("");
  const [selectedTemplateContext, setSelectedTemplateContext] =
    useState<ManuscriptWorkbenchTemplateContext | null>(null);
  const [queueItems, setQueueItems] = useState<ManuscriptWorkbenchQueueItem[]>([]);
  const [activeQueueFilter, setActiveQueueFilter] =
    useState<ManuscriptWorkbenchQueueFilter>("all");
  const canSubmitUpload =
    uploadForm.title.trim().length > 0 &&
    uploadForm.fileName.trim().length > 0 &&
    uploadForm.mimeType.trim().length > 0 &&
    attachedUploadFiles.length <= MAX_MANUSCRIPT_BATCH_UPLOAD_COUNT &&
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
    setSelectedTemplateFamilyId(
      workspace.manuscript.current_template_family_id ??
        workspace.manuscript.governed_execution_context_summary?.base_template_family_id ??
        "",
    );
    setSelectedJournalTemplateId(
      workspace.manuscript.current_journal_template_id ?? "",
    );
    setQueueItems((current) =>
      mergeQueueItems(current, [
        buildQueueItemFromManuscript(workspace.manuscript, mode, "recent", true),
      ]),
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
    setAttachedUploadFiles([]);
    setParentAssetId("");
    setDraftAssetId("");
    setSelectedTemplateFamilyId("");
    setSelectedJournalTemplateId("");
    setSelectedTemplateContext(null);
  }, [normalizedPrefilledManuscriptId]);

  useEffect(() => {
    if (!workspace) {
      setSelectedTemplateContext(null);
      return;
    }

    const currentBaseTemplateFamilyId =
      resolveCurrentBaseTemplateFamilyId(workspace) ?? "";
    const nextTemplateFamilyId = selectedTemplateFamilyId.trim();

    if (
      nextTemplateFamilyId.length === 0 ||
      nextTemplateFamilyId === currentBaseTemplateFamilyId
    ) {
      setSelectedTemplateContext({
        availableTemplateFamilies: workspace.availableTemplateFamilies ?? [],
        templateFamily: workspace.templateFamily ?? null,
        journalTemplateProfiles: workspace.journalTemplateProfiles ?? [],
      });
      return;
    }

    const fallbackContext: ManuscriptWorkbenchTemplateContext = {
      availableTemplateFamilies: workspace.availableTemplateFamilies ?? [],
      templateFamily:
        workspace.availableTemplateFamilies?.find(
          (family) => family.id === nextTemplateFamilyId,
        ) ?? null,
      journalTemplateProfiles: [],
    };

    if (!controller.loadTemplateContext) {
      setSelectedTemplateContext(fallbackContext);
      return;
    }

    let cancelled = false;
    void controller.loadTemplateContext(nextTemplateFamilyId)
      .then((templateContext) => {
        if (cancelled) {
          return;
        }

        setSelectedTemplateContext(templateContext);
        setSelectedJournalTemplateId((current) =>
          shouldKeepSelectedJournalTemplate(
            current,
            nextTemplateFamilyId,
            templateContext,
            workspace,
          )
            ? current
            : "",
        );
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setSelectedTemplateContext(fallbackContext);
        setSelectedJournalTemplateId("");
      });

    return () => {
      cancelled = true;
    };
  }, [controller, selectedTemplateFamilyId, workspace]);

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

  async function attachUploadFiles(files: File[]) {
    setBusy(true);
    setError("");
    try {
      const inlineFieldsList = await Promise.all(
        files.map((file) => createInlineUploadFields(file)),
      );
      const primaryInlineFields = inlineFieldsList[0];
      if (!primaryInlineFields) {
        throw new Error("No upload files were selected.");
      }

      setAttachedUploadFiles(inlineFieldsList);
      setUploadForm((current) => ({
        ...current,
        ...primaryInlineFields,
        title:
          inlineFieldsList.length === 1
            ? deriveUploadTitleFromFileName(primaryInlineFields.fileName, current.title)
            : current.title,
      }));
      setStatus(
        inlineFieldsList.length > 1
          ? `Attached ${inlineFieldsList.length} files for batch upload`
          : `Attached file ${primaryInlineFields.fileName}`,
      );
      setLatestActionResult({
        tone: "success",
        actionLabel: "Attach Manuscript File",
        message:
          inlineFieldsList.length > 1
            ? `Attached ${inlineFieldsList.length} files for batch upload`
            : `Attached file ${primaryInlineFields.fileName}`,
        details: [
          {
            label: "File",
            value:
              inlineFieldsList.length > 1
                ? `${inlineFieldsList.length} files`
                : primaryInlineFields.fileName,
          },
          {
            label: "MIME Type",
            value:
              inlineFieldsList.length > 1
                ? "Mixed inline batch"
                : primaryInlineFields.mimeType,
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
      forceApply?: boolean;
    } = {
      forceApply: false,
    },
  ) {
    const nextTemplateFamilyId =
      normalizeOptionalText(selectedTemplateFamilyId) ??
      currentWorkspace.manuscript.current_template_family_id ??
      currentWorkspace.manuscript.governed_execution_context_summary?.base_template_family_id ??
      null;
    const nextJournalTemplateId =
      normalizeOptionalText(selectedJournalTemplateId) ?? null;
    const currentTemplateFamilyId =
      currentWorkspace.manuscript.current_template_family_id ??
      currentWorkspace.manuscript.governed_execution_context_summary?.base_template_family_id ??
      null;
    const currentJournalTemplateId =
      currentWorkspace.manuscript.current_journal_template_id ?? null;
    if (
      !input.forceApply &&
      nextTemplateFamilyId === currentTemplateFamilyId &&
      nextJournalTemplateId === currentJournalTemplateId
    ) {
      return currentWorkspace;
    }

    const result = await controller.updateTemplateSelectionAndLoad({
      manuscriptId: currentWorkspace.manuscript.id,
      templateFamilyId: nextTemplateFamilyId,
      journalTemplateId: nextJournalTemplateId,
    });
    setWorkspace(result.workspace);

    return result.workspace;
  }

  async function loadWorkspaceIntoBench(manuscriptId: string) {
    const result = await loadPrefilledWorkbenchWorkspace(controller, manuscriptId);
    setWorkspace(result.workspace);
    setLatestJob(result.latestJob);
    setLatestExport(null);
    setLookupId(result.workspace.manuscript.id);
    setStatus(`Loaded manuscript ${result.workspace.manuscript.id}`);
    return {
      ...result.latestActionResult,
      message: `Loaded manuscript ${result.workspace.manuscript.id}`,
    };
  }

function buildTemplateContextActionResult(
  updatedWorkspace: ManuscriptWorkbenchWorkspace,
  actionLabel: string,
  message: string,
  ): WorkbenchActionResultViewModel {
    return {
      tone: "success",
      actionLabel,
      message,
      details: [
        {
          label: "Base Template Family",
          value: resolveBaseTemplateFamilyLabel(updatedWorkspace),
        },
        {
          label: "Journal Template",
          value: resolveJournalTemplateSelectionLabel(updatedWorkspace),
        },
        {
          label: "Journal Overrides",
          value:
            updatedWorkspace.selectedJournalTemplateProfile != null ||
            updatedWorkspace.manuscript.current_journal_template_id
              ? "已启用"
              : "仅基础模板",
        },
      ],
    };
  }

  const lookupPanel: ManuscriptWorkbenchLookupPanelProps = {
    manuscriptId: lookupId,
    onChange: setLookupId,
    onLoad: () =>
      void run("Load Workspace", async () => {
        return loadWorkspaceIntoBench(lookupId.trim());
      }),
  };

  const intakePanel = canUpload
    ? {
        uploadForm,
        attachedFileCount: attachedUploadFiles.length,
        attachedFileNames: attachedUploadFiles.map((file) => file.fileName),
        canSubmit: canSubmitUpload,
        onTitleChange: (value: string) =>
          setUploadForm((current) => ({
            ...current,
            title: value,
          })),
        onStorageKeyChange: (value: string) =>
          setUploadForm((current) => ({
            ...current,
            storageKey: normalizeOptionalText(value),
          })),
        onFilesSelect: (files: File[]) => {
          void attachUploadFiles(files);
        },
        onSubmit: () =>
          void run("Upload Manuscript", async () => {
            if (attachedUploadFiles.length > 1) {
              if (!controller.uploadManuscriptBatchAndLoad) {
                throw new Error("当前工作台控制器暂不支持批量上传。");
              }

              if (attachedUploadFiles.length > MAX_MANUSCRIPT_BATCH_UPLOAD_COUNT) {
                throw new Error(
                  `批量上传最多不能超过 ${MAX_MANUSCRIPT_BATCH_UPLOAD_COUNT} 篇稿件。`,
                );
              }

              const result = await controller.uploadManuscriptBatchAndLoad({
                createdBy: uploadForm.createdBy,
                items: attachedUploadFiles.map((file) => ({
                  title: deriveUploadTitleFromFileName(file.fileName, uploadForm.title),
                  fileName: file.fileName,
                  mimeType: file.mimeType,
                  fileContentBase64: file.fileContentBase64,
                })),
              });
              setWorkspace(result.workspace);
              setLatestJob(result.upload.batch_job);
              setQueueItems((current) =>
                mergeQueueItems(
                  current,
                  result.upload.items.map((item, index) =>
                    buildQueueItemFromManuscript(
                      item.manuscript,
                      mode,
                      "batch",
                      index === 0,
                    )
                  ),
                ),
              );
              setStatus(`Uploaded batch ${result.upload.batch_job.id}`);
              return {
                tone: "success" as const,
                actionLabel: "Upload Manuscript",
                message: `Uploaded batch ${result.upload.batch_job.id}`,
                details: buildWorkbenchJobActionResultDetails(
                  [
                    {
                      label: "Batch Job",
                      value: result.upload.batch_job.id,
                    },
                    {
                      label: "Batch Items",
                      value: String(result.upload.items.length),
                    },
                  ],
                  result.upload.batch_job,
                  result.workspace.manuscript.module_execution_overview,
                ),
              };
            }

            const result = await controller.uploadManuscriptAndLoad(uploadForm);
            setWorkspace(result.workspace);
            setLatestJob(result.upload.job);
            setQueueItems((current) =>
              mergeQueueItems(current, [
                buildQueueItemFromManuscript(result.upload.manuscript, mode, "recent", true),
              ]),
            );
            setStatus(`Uploaded manuscript ${result.upload.manuscript.id}`);
            return {
              tone: "success" as const,
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
    : undefined;

  const templateSelectionWorkspace = workspace
    ? buildTemplateSelectionWorkspace(workspace, selectedTemplateContext, {
        selectedTemplateFamilyId,
        selectedJournalTemplateId,
      })
    : null;
  const hasPendingTemplateChange =
    workspace != null
      ? (resolveCurrentBaseTemplateFamilyId(workspace) ?? "") !==
          selectedTemplateFamilyId ||
        (workspace.manuscript.current_journal_template_id ?? "") !==
          selectedJournalTemplateId
      : false;
  const templateSelectionPanel =
    templateSelectionWorkspace &&
    (templateSelectionWorkspace.templateFamily ||
      templateSelectionWorkspace.availableTemplateFamilies?.length ||
      templateSelectionWorkspace.manuscript.governed_execution_context_summary)
      ? {
          title: "Journal Template",
          resolvedManuscriptTypeLabel: formatDetectedManuscriptType(
            templateSelectionWorkspace.manuscript,
          ),
          confidenceLabel: formatDetectedConfidenceLabel(
            templateSelectionWorkspace.manuscript,
          ),
          confidenceLevel:
            templateSelectionWorkspace.manuscript.manuscript_type_detection_summary
              ?.confidence_level ??
            "medium",
          requiresOperatorReview:
            templateSelectionWorkspace.manuscript.manuscript_type_detection_summary
              ?.requires_operator_review ?? false,
          showManualManuscriptTypeSelect:
            shouldShowManualManuscriptTypeSelect(templateSelectionWorkspace),
          manualManuscriptTypeValue: resolveSelectedTemplateManuscriptType(
            templateSelectionWorkspace,
            selectedTemplateFamilyId,
          ),
          manualManuscriptTypeOptions: buildManualManuscriptTypeOptions(
            templateSelectionWorkspace,
          ),
          baseTemplateLabel: resolveBaseTemplateFamilyLabel(
            templateSelectionWorkspace,
          ),
          selectedTemplateFamilyId,
          templateFamilyOptions: buildTemplateFamilyOptions(
            templateSelectionWorkspace,
          ),
          selectedJournalTemplateId,
          currentAppliedLabel: resolveJournalTemplateSelectionLabel(
            templateSelectionWorkspace,
          ),
          hasPendingChange: hasPendingTemplateChange,
          options: buildJournalTemplateOptions(templateSelectionWorkspace),
          onManualManuscriptTypeSelect: (value: string) => {
            const nextTemplateFamilyId = resolveTemplateFamilyIdForManuscriptType(
              templateSelectionWorkspace,
              value as ManuscriptType,
            );
            if (!nextTemplateFamilyId) {
              return;
            }

            setSelectedTemplateFamilyId(nextTemplateFamilyId);
            setSelectedJournalTemplateId("");
          },
          onTemplateFamilySelect: (value: string) => {
            setSelectedTemplateFamilyId(value);
            setSelectedJournalTemplateId("");
          },
          onSelect: setSelectedJournalTemplateId,
          onApply: () =>
            void run(resolveTemplateSelectionActionLabel({
              hasPendingChange: hasPendingTemplateChange,
              requiresOperatorReview:
                templateSelectionWorkspace.manuscript.manuscript_type_detection_summary
                  ?.requires_operator_review ?? false,
            }), async () => {
              if (!workspace) {
                throw new Error("模板上下文尚未加载，暂时无法保存。");
              }

              const actionLabel = resolveTemplateSelectionActionLabel({
                hasPendingChange: hasPendingTemplateChange,
                requiresOperatorReview:
                  templateSelectionWorkspace.manuscript.manuscript_type_detection_summary
                    ?.requires_operator_review ?? false,
              });
              const updatedWorkspace = await persistTemplateSelection(workspace, {
                forceApply: shouldForceTemplateConfirmation(
                  workspace,
                  selectedTemplateFamilyId,
                ),
              });
              const message = resolveTemplateSelectionStatusMessage(
                updatedWorkspace,
                actionLabel,
              );
              setStatus(message);
              return buildTemplateContextActionResult(
                updatedWorkspace,
                actionLabel,
                message,
              );
            }),
        }
      : undefined;

  const moduleActionPanel =
    workspace && mode !== "submission"
      ? {
          title: resolveActionPanelTitle(mode),
          selectedAssetId: parentAssetId,
          emptyLabel: "请选择资产",
          actionLabel: resolveActionLabel(mode),
          secondaryActionLabel: BARE_AI_ACTION_LABEL,
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
                fileName: resolveWorkbenchGeneratedAssetFileName(mode),
              });
              setWorkspace(result.workspace);
              setLatestJob(result.runResult.job);
              setStatus(`Created asset ${result.runResult.asset.id}`);
              return {
                tone: "success" as const,
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
          onSecondaryRun: () =>
            void run(BARE_AI_ACTION_LABEL, async () => {
              const result = await controller.runModuleAndLoad({
                mode,
                manuscriptId: workspace.manuscript.id,
                parentAssetId,
                actorRole,
                storageKey: `runs/${workspace.manuscript.id}/${mode}/output`,
                fileName: resolveWorkbenchGeneratedAssetFileName(mode),
                executionMode: "bare",
              });
              setWorkspace(result.workspace);
              setLatestJob(result.runResult.job);
              setStatus(`Created asset ${result.runResult.asset.id}`);
              return {
                tone: "success" as const,
                actionLabel: BARE_AI_ACTION_LABEL,
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
      : undefined;

  const finalizeActionPanel =
    workspace && mode === "proofreading"
      ? {
          title: "Proofreading Final",
          selectedAssetId: draftAssetId,
          emptyLabel: "请选择校对草稿",
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
                tone: "success" as const,
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
      : undefined;

  const utilitiesPanel = workspace
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
              tone: "success" as const,
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
              tone: "success" as const,
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
    : undefined;

  const shouldUseMainlineLayout = mode !== "submission";
  const shouldShowDeskBar = mode === "submission";
  const detectedManuscriptTypeLabel = workspace
    ? formatDetectedManuscriptType(workspace.manuscript)
    : "待 AI 识别";
  const executionContext = workspace
    ? resolveWorkbenchReadOnlyExecutionContext(mode, workspace)
    : null;
  const auxiliarySectionCount = [
    Boolean(intakePanel),
    Boolean(executionContext),
    Boolean(utilitiesPanel),
    Boolean(!workspace),
  ].filter(Boolean).length;
  const focusPrimaryActions: ManuscriptWorkbenchActionPanelProps[] = [];
  if (moduleActionPanel) {
    focusPrimaryActions.push(moduleActionPanel);
  }
  if (finalizeActionPanel) {
    focusPrimaryActions.push(finalizeActionPanel);
  }
  const summaryElement = workspace ? (
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
  ) : null;

  return (
    <article
      className={`workbench-placeholder manuscript-workbench-shell manuscript-workbench-shell--${mode}`}
      data-layout="manuscript-desk-family"
    >
      {shouldShowDeskBar ? (
        <section className="manuscript-workbench-desk-bar">
        <div className="manuscript-workbench-shell-copy">
          <span className="manuscript-workbench-section-eyebrow">
            {mode === "submission"
              ? "\u7a3f\u4ef6\u63a5\u5165"
              : "\u6838\u5fc3\u5de5\u4f5c\u53f0"}
          </span>
          <h2>{resolveTitle(mode)}</h2>
          <p>{resolveDescription(mode)}</p>
          {activeCoreStripPillar ? (
            <WorkbenchCoreStrip activePillarId={activeCoreStripPillar} />
          ) : null}
        </div>
        <dl className="manuscript-workbench-shell-metrics">
          <div className="manuscript-workbench-desk-stat">
            <span>{"\u5de5\u4f5c\u7ebf\u5b9a\u4f4d"}</span>
            <strong>{resolveHeroLane(mode)}</strong>
          </div>
          <div className="manuscript-workbench-desk-stat">
            <span>{"\u5f53\u524d\u7126\u70b9"}</span>
            <strong>{resolveHeroFocus(mode)}</strong>
          </div>
        </dl>
        </section>
      ) : null}
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
      {shouldUseMainlineLayout ? (
        <div
          className="manuscript-workbench-mainline-layout"
          data-scroll-shell="independent-columns"
          data-pane-height="shell-aligned"
        >
          <div data-pane="queue-rail" data-scroll-pane="queue">
            <ManuscriptWorkbenchQueuePane
              mode={mode}
              busy={workbenchBusy}
              lookup={lookupPanel}
              workspace={workspace}
              latestJob={latestJob}
              queueItems={queueItems}
              activeQueueFilter={activeQueueFilter}
              onQueueFilterChange={setActiveQueueFilter}
              onOpenQueueItem={(manuscriptId) => {
                setLookupId(manuscriptId);
                void run("Load Workspace", async () => loadWorkspaceIntoBench(manuscriptId));
              }}
            />
          </div>
          <div data-pane="focus-canvas" data-scroll-pane="focus">
            <section className="manuscript-workbench-focus-panel">
              <header className="manuscript-workbench-focus-panel-header">
                <div className="manuscript-workbench-focus-panel-copy">
                <h3>{resolveFocusPanelTitle(mode)}</h3>
              </div>
                <div className="manuscript-workbench-focus-type-card">
                <span>AI 识别稿件类型</span>
                <strong>{detectedManuscriptTypeLabel}</strong>
                </div>
              </header>
              <div
                className="manuscript-workbench-focus-panel-body"
                data-focus-body="scrollable"
              >
                <ManuscriptWorkbenchFocusCanvas
              mode={mode}
              busy={workbenchBusy}
              workspace={workspace}
              detectedManuscriptTypeLabel={detectedManuscriptTypeLabel}
              templateSelection={templateSelectionPanel}
              primaryActions={focusPrimaryActions}
            />
                {summaryElement ?? (
              <section className="manuscript-workbench-focus-empty">
                <h3>加载当前稿件后开始判断</h3>
                <p>
                  上传或加载稿件后，这里会直接展开摘要、风险和交接信息。
                </p>
              </section>
                )}
              </div>
            </section>
          </div>
          <div data-pane="batch-slab" data-scroll-pane="batch">
            <ManuscriptWorkbenchBatchDrawer mode={mode} sectionCount={auxiliarySectionCount}>
              <ManuscriptWorkbenchControls
                mode={mode}
                busy={workbenchBusy}
                layout="drawer"
                showLookupPanel={!workspace}
                intake={intakePanel}
                lookup={lookupPanel}
                executionContext={executionContext ?? undefined}
                utilities={utilitiesPanel}
              />
            </ManuscriptWorkbenchBatchDrawer>
          </div>
        </div>
      ) : (
        <section className="manuscript-workbench-intake-compat" data-pane="intake-compat">
          <ManuscriptWorkbenchControls
            mode={mode}
            busy={workbenchBusy}
            intake={intakePanel}
            lookup={lookupPanel}
            templateSelection={templateSelectionPanel}
            executionContext={executionContext ?? undefined}
            moduleAction={moduleActionPanel}
            finalizeAction={finalizeActionPanel}
            utilities={utilitiesPanel}
          />
          {summaryElement}
        </section>
      )}
    </article>
  );
}

export interface ManuscriptWorkbenchFocusCanvasProps {
  mode: Exclude<ManuscriptWorkbenchMode, "submission">;
  busy: boolean;
  workspace: ManuscriptWorkbenchWorkspace | null;
  detectedManuscriptTypeLabel: string;
  templateSelection?: ManuscriptWorkbenchTemplateSelectionPanelProps;
  primaryActions?: ManuscriptWorkbenchActionPanelProps[];
  supportingSummary?: React.ReactNode;
}

export function ManuscriptWorkbenchFocusCanvas({
  mode,
  busy,
  workspace,
  detectedManuscriptTypeLabel,
  templateSelection,
  primaryActions = [],
  supportingSummary,
}: ManuscriptWorkbenchFocusCanvasProps) {
  if (!workspace) {
    return null;
  }

  const currentManuscriptAsset =
    workspace.currentManuscriptAsset ?? workspace.currentAsset;
  const currentManuscriptDownloadHref = resolveCurrentAssetDownloadHref(
    currentManuscriptAsset,
  );
  const currentManuscriptFileName = currentManuscriptAsset?.file_name ?? undefined;
  const currentResultAsset =
    workspace.currentAsset &&
    workspace.currentAsset.id !== currentManuscriptAsset?.id
      ? workspace.currentAsset
      : null;
  const currentResultDownloadHref = resolveCurrentAssetDownloadHref(currentResultAsset);
  const currentResultFileName = currentResultAsset?.file_name ?? undefined;
  const governedModules =
    workspace.manuscript.governed_execution_context_summary?.modules ?? [];

  return (
    <div className="manuscript-workbench-focus-canvas" data-focus-canvas="manuscript-first">
      {primaryActions.length > 0 ? (
        <section className="manuscript-workbench-focus-work-card">
          <div className="manuscript-workbench-focus-work-card-header">
            <div>
              <span className="manuscript-workbench-section-eyebrow">主操作</span>
              <h4>处理稿件</h4>
              <p>{resolveFocusPanelDescription(mode)}</p>
            </div>
            <div className="manuscript-workbench-focus-context-card">
              <span>当前稿件</span>
              <strong>{workspace.manuscript.title}</strong>
              <p>{detectedManuscriptTypeLabel}</p>
              {currentManuscriptDownloadHref ? (
                <div className="manuscript-workbench-focus-shortcuts">
                  <a
                    className="manuscript-workbench-shortcut manuscript-workbench-shortcut--context"
                    href={currentManuscriptDownloadHref}
                    target="_blank"
                    rel="noreferrer"
                  >
                    查看当前稿件
                  </a>
                  <a
                    className="manuscript-workbench-shortcut manuscript-workbench-shortcut--context"
                    href={currentManuscriptDownloadHref}
                    download={currentManuscriptFileName}
                  >
                    下载当前稿件
                  </a>
                </div>
              ) : null}
              {currentResultAsset && currentResultDownloadHref ? (
                <div className="manuscript-workbench-focus-shortcuts">
                  <a
                    className="manuscript-workbench-shortcut manuscript-workbench-shortcut--context"
                    href={currentResultDownloadHref}
                    target="_blank"
                    rel="noreferrer"
                  >
                    查看当前结果
                  </a>
                  <a
                    className="manuscript-workbench-shortcut manuscript-workbench-shortcut--context"
                    href={currentResultDownloadHref}
                    download={currentResultFileName}
                  >
                    {resolveCurrentResultDownloadLabel(currentResultAsset)}
                  </a>
                </div>
              ) : null}
            </div>
          </div>
          <div className="manuscript-workbench-focus-action-grid">
            {primaryActions.map((action) => {
              const selectedOption = action.options.find(
                (option) => option.value === action.selectedAssetId,
              );
              const canRun = action.selectedAssetId.trim().length > 0;
              const hasSecondaryAction =
                typeof action.onSecondaryRun === "function" &&
                (action.secondaryActionLabel?.trim().length ?? 0) > 0;
              const secondaryActionLabel = hasSecondaryAction
                ? action.secondaryActionLabel ?? ""
                : undefined;

              return (
                <article
                  key={`${action.title}:${action.actionLabel}`}
                  className="manuscript-workbench-focus-action-item"
                >
                  <div className="manuscript-workbench-focus-action-copy">
                    <span>{formatPrimaryActionBadge(action.actionLabel)}</span>
                    <strong>{formatPrimaryActionTitle(action.actionLabel)}</strong>
                    <p>{resolvePrimaryActionDescription(action.actionLabel, mode)}</p>
                  </div>
                  <label className={canRun ? "manuscript-workbench-field" : "manuscript-workbench-field is-invalid"}>
                    <span>输入稿件资产</span>
                    <select
                      value={action.selectedAssetId}
                      onChange={(event) => action.onSelect(event.target.value)}
                    >
                      <option value="">{action.emptyLabel}</option>
                      {action.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedOption ? (
                    <div className="manuscript-workbench-selection-context">
                      <span>{formatFocusSelectionContextLabel(action.selectedContextLabel)}</span>
                      <strong>{selectedOption.label}</strong>
                    </div>
                  ) : (
                    <p className="manuscript-workbench-help is-warning">
                      先选中当前要处理的稿件资产，再进入这一环节。
                    </p>
                  )}
                  <div
                    className="manuscript-workbench-button-row manuscript-workbench-button-row--sticky"
                    data-action-row="sticky"
                    data-secondary-action={hasSecondaryAction ? "available" : "hidden"}
                  >
                    <button type="button" disabled={busy || !canRun} onClick={() => action.onRun()}>
                      {busy ? "处理中..." : formatPrimaryActionButtonLabel(action.actionLabel)}
                    </button>
                    {hasSecondaryAction ? (
                      <button
                        type="button"
                        className="manuscript-workbench-button-secondary"
                        disabled={busy || !canRun}
                        onClick={() => action.onSecondaryRun?.()}
                      >
                        {busy
                          ? "处理中..."
                          : formatPrimaryActionButtonLabel(secondaryActionLabel ?? "")}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {templateSelection ? (
        <section className="manuscript-workbench-focus-work-card">
          <div className="manuscript-workbench-focus-work-card-header">
            <div>
              <span className="manuscript-workbench-section-eyebrow">AI 识别</span>
              <h4>AI 识别与人工确认</h4>
              <p>先确认稿件识别结果和模板上下文，再进入当前工作线。</p>
            </div>
          </div>
          <div
            className="manuscript-workbench-resolved-context"
            data-confidence-level={templateSelection.confidenceLevel ?? "medium"}
          >
            <div className="manuscript-workbench-selection-context">
              <span>AI 识别稿件类型</span>
              <strong>{templateSelection.resolvedManuscriptTypeLabel}</strong>
            </div>
            <div className="manuscript-workbench-selection-context">
              <span>识别置信度</span>
              <strong>{templateSelection.confidenceLabel}</strong>
            </div>
            <div className="manuscript-workbench-selection-context">
              <span>基础模板家族</span>
              <strong>{templateSelection.baseTemplateLabel}</strong>
            </div>
            <div className="manuscript-workbench-selection-context">
              <span>当前生效上下文</span>
              <strong>{templateSelection.currentAppliedLabel}</strong>
            </div>
          </div>
          <details
            className="manuscript-workbench-template-override"
            open={templateSelection.requiresOperatorReview || templateSelection.hasPendingChange}
          >
            <summary>
              {templateSelection.showManualManuscriptTypeSelect &&
              (templateSelection.manualManuscriptTypeOptions?.length ?? 0) > 0
                ? "人工修正稿件类型与模板"
                : "修正基础模板家族"}
            </summary>
            {templateSelection.showManualManuscriptTypeSelect &&
            (templateSelection.manualManuscriptTypeOptions?.length ?? 0) > 0 &&
            templateSelection.onManualManuscriptTypeSelect ? (
              <label className="manuscript-workbench-field">
                <span>人工确认稿件类型</span>
                <select
                  value={templateSelection.manualManuscriptTypeValue ?? ""}
                  onChange={(event) =>
                    templateSelection.onManualManuscriptTypeSelect?.(event.target.value)}
                >
                  {templateSelection.manualManuscriptTypeOptions?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="manuscript-workbench-field">
              <span>基础模板家族</span>
              <select
                value={templateSelection.selectedTemplateFamilyId}
                onChange={(event) => templateSelection.onTemplateFamilySelect(event.target.value)}
              >
                {templateSelection.templateFamilyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </details>
          <label className="manuscript-workbench-field">
            <span>期刊模板（小期刊/场景）</span>
            <select
              value={templateSelection.selectedJournalTemplateId}
              onChange={(event) => templateSelection.onSelect(event.target.value)}
            >
              <option value="">仅使用基础家族</option>
              {templateSelection.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {templateSelection.requiresOperatorReview ? (
            <p className="manuscript-workbench-help is-warning">
              AI 识别失败或低置信度时请先人工确认稿件类型，再选择期刊模板。
            </p>
          ) : null}
          {templateSelection.hasPendingChange ? (
            <p className="manuscript-workbench-help is-warning">
              你已经改动了模板上下文，确认后会按人工修正继续执行。
            </p>
          ) : null}
          <p className="manuscript-workbench-help">
            期刊模板用于细化小期刊或场景要求；如不选择，将仅按基础模板家族继续处理。
          </p>
          <div
            className="manuscript-workbench-button-row manuscript-workbench-button-row--sticky"
            data-action-row="sticky"
          >
            <button type="button" disabled={busy} onClick={() => templateSelection.onApply()}>
              {busy ? "处理中..." : resolveTemplateSelectionActionLabel(templateSelection)}
            </button>
          </div>
        </section>
      ) : null}

      {governedModules.length > 0 ? (
        <section className="manuscript-workbench-focus-work-card">
          <div className="manuscript-workbench-focus-work-card-header">
            <div>
              <span className="manuscript-workbench-section-eyebrow">自动绑定</span>
              <h4>自动绑定执行上下文</h4>
              <p>AI 识别后已为各工作线准备执行画像、检索预设与运行时绑定。</p>
            </div>
          </div>
          <div className="manuscript-workbench-focus-binding-list">
            {governedModules.map((module) => (
              <article
                key={`${module.module}:${module.execution_profile_id ?? "unbound"}`}
                className="manuscript-workbench-focus-binding-item"
              >
                <strong>{formatGovernedModuleLabel(module.module)}</strong>
                <dl className="manuscript-workbench-focus-binding-meta">
                  <div>
                    <dt>执行画像</dt>
                    <dd>{module.execution_profile_id ?? "未绑定"}</dd>
                  </div>
                  <div>
                    <dt>检索预设</dt>
                    <dd>{module.retrieval_preset_id ?? "未绑定"}</dd>
                  </div>
                  <div>
                    <dt>运行时绑定</dt>
                    <dd>{module.runtime_binding_id ?? "未绑定"}</dd>
                  </div>
                  <div>
                    <dt>运行时就绪</dt>
                    <dd>{formatRuntimeBindingReadiness(module.runtime_binding_readiness_status)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {supportingSummary ? (
        <div className="manuscript-workbench-focus-supporting">{supportingSummary}</div>
      ) : null}
    </div>
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

function resolveFocusPanelTitle(mode: Exclude<ManuscriptWorkbenchMode, "submission">): string {
  if (mode === "screening") {
    return "当前稿件初筛判断";
  }

  if (mode === "editing") {
    return "当前稿件编辑工作区";
  }

  return "当前稿件校对工作区";
}

function resolveFocusPanelDescription(mode: Exclude<ManuscriptWorkbenchMode, "submission">): string {
  if (mode === "screening") {
    return "在同一工作面确认完整度、风险项与移交建议，避免批量动作打断判断。";
  }

  if (mode === "editing") {
    return "围绕当前稿件的结构修订、模板上下文与下游交接持续工作。";
  }

  return "将问题收束、终稿确认与交付准备集中在中央工作区。";
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

export function buildManualManuscriptTypeOptions(
  workspace: ManuscriptWorkbenchWorkspace,
): Array<{ value: string; label: string }> {
  const seen = new Set<string>();
  const options: Array<{ value: string; label: string }> = [];

  const pushOption = (manuscriptType: string | undefined) => {
    if (!manuscriptType || seen.has(manuscriptType)) {
      return;
    }

    seen.add(manuscriptType);
    options.push({
      value: manuscriptType,
      label: formatWorkbenchManuscriptTypeLabel(manuscriptType),
    });
  };

  for (const family of workspace.availableTemplateFamilies ?? []) {
    if (family.status === "active") {
      pushOption(family.manuscript_type);
    }
  }

  pushOption(workspace.templateFamily?.manuscript_type);
  pushOption(workspace.manuscript.manuscript_type);
  pushOption(workspace.manuscript.manuscript_type_detection_summary?.final_type);

  return options;
}

export function resolveTemplateFamilyIdForManuscriptType(
  workspace: ManuscriptWorkbenchWorkspace,
  manuscriptType: ManuscriptType,
): string | undefined {
  const activeFamilies =
    workspace.availableTemplateFamilies?.filter((family) => family.status === "active") ??
    [];
  const currentBaseTemplateFamilyId = resolveCurrentBaseTemplateFamilyId(workspace);

  return (
    activeFamilies.find(
      (family) =>
        family.id === currentBaseTemplateFamilyId &&
        family.manuscript_type === manuscriptType,
    )?.id ??
    activeFamilies.find(
      (family) =>
        family.id === workspace.templateFamily?.id &&
        family.manuscript_type === manuscriptType,
    )?.id ??
    activeFamilies.find((family) => family.manuscript_type === manuscriptType)?.id
  );
}

export function buildTemplateFamilyOptions(
  workspace: ManuscriptWorkbenchWorkspace,
): Array<{ value: string; label: string }> {
  const options =
    workspace.availableTemplateFamilies
      ?.filter((family) => family.status === "active")
      .map((family) => ({
        value: family.id,
        label: formatTemplateFamilyDisplayLabel(family.name),
      })) ?? [];
  const resolvedBaseTemplateId =
    workspace.manuscript.current_template_family_id ??
    workspace.manuscript.governed_execution_context_summary?.base_template_family_id;

  if (
    resolvedBaseTemplateId &&
    !options.some((option) => option.value === resolvedBaseTemplateId)
  ) {
    options.unshift({
      value: resolvedBaseTemplateId,
      label: formatTemplateFamilyDisplayLabel(
        workspace.templateFamily?.name ?? resolvedBaseTemplateId,
      ),
    });
  }

  return options;
}

export function buildJournalTemplateOptions(
  workspace: ManuscriptWorkbenchWorkspace,
): Array<{ value: string; label: string }> {
  const options =
    workspace.journalTemplateProfiles
      ?.filter((profile) => profile.status === "active")
      .map((profile) => ({
        value: profile.id,
        label: profile.journal_name,
      })) ?? [];
  const resolvedJournalTemplateId =
    workspace.manuscript.current_journal_template_id ??
    workspace.manuscript.governed_execution_context_summary?.journal_template_id;

  if (
    resolvedJournalTemplateId &&
    !options.some((option) => option.value === resolvedJournalTemplateId)
  ) {
    options.unshift({
      value: resolvedJournalTemplateId,
      label:
        workspace.selectedJournalTemplateProfile?.journal_name ??
        resolvedJournalTemplateId,
    });
  }

  return options;
}

function shouldForceTemplateConfirmation(
  workspace: ManuscriptWorkbenchWorkspace,
  selectedTemplateFamilyId: string,
): boolean {
  return (
    workspace.manuscript.current_template_family_id == null &&
    selectedTemplateFamilyId.trim().length > 0
  );
}

function resolveTemplateSelectionActionLabel(input: {
  hasPendingChange: boolean;
  requiresOperatorReview: boolean;
}): string {
  if (input.hasPendingChange) {
    return "保存人工修正";
  }

  if (input.requiresOperatorReview) {
    return "确认 AI 识别结果";
  }

  return "确认当前模板上下文";
}

function resolveTemplateSelectionStatusMessage(
  workspace: ManuscriptWorkbenchWorkspace,
  actionLabel: string,
): string {
  if (actionLabel === "保存人工修正") {
    return `已保存 ${workspace.manuscript.id} 的人工模板修正`;
  }

  if (actionLabel === "确认 AI 识别结果") {
    return `已确认 ${workspace.manuscript.id} 的 AI 识别结果`;
  }

  return `已确认 ${workspace.manuscript.id} 的模板上下文`;
}

function formatPrimaryActionBadge(actionLabel: string): string {
  if (actionLabel === "Run Screening") return "初筛入口";
  if (actionLabel === "Run Editing") return "编辑入口";
  if (actionLabel === "Create Draft") return "校对草稿";
  if (actionLabel === "Finalize Proofreading") return "校对定稿";
  return "处理入口";
}

function formatPrimaryActionTitle(actionLabel: string): string {
  if (actionLabel === "Run Screening") return "执行初筛";
  if (actionLabel === "Run Editing") return "执行编辑";
  if (actionLabel === "Create Draft") return "生成校对草稿";
  if (actionLabel === "Finalize Proofreading") return "确认校对定稿";
  return actionLabel;
}

function formatPrimaryActionButtonLabel(actionLabel: string): string {
  if (actionLabel === BARE_AI_ACTION_LABEL) {
    return "AI 自动处理（本次）";
  }

  return formatPrimaryActionTitle(actionLabel);
}

function formatTemplateFamilyDisplayLabel(value: string): string {
  return value
    .replace(/^Review\b/u, "综述")
    .replace(/^Clinical Study\b/u, "临床研究")
    .replace(/^Case Report\b/u, "病例报告")
    .replace(/\bgovernance family\b/iu, "治理模板族")
    .replace(/\bbase template family\b/iu, "基础模板族")
    .replace(/\s+基础模板族/u, "基础模板族")
    .replace(/\s+治理模板族/u, "治理模板族");
}

function resolvePrimaryActionDescription(
  actionLabel: string,
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
): string {
  if (actionLabel === "Run Screening") {
    return "以原始稿件或已同步资产为输入，完成初筛判断并生成可交接结果。";
  }

  if (actionLabel === "Run Editing") {
    return "基于当前选中的稿件资产进入编辑处理，生成下一步可继续流转的文档。";
  }

  if (actionLabel === "Create Draft") {
    return "先生成本轮校对草稿，再进入人工终审和定稿。";
  }

  if (actionLabel === "Finalize Proofreading") {
    return "用已经确认的校对草稿完成定稿，准备发布或导出。";
  }

  return resolveFocusPanelDescription(mode);
}

function formatFocusSelectionContextLabel(label: string | undefined): string {
  if (label === "Selected Parent Asset") return "当前处理输入";
  if (label === "Selected Draft Asset") return "当前定稿草稿";
  if (label === "Selected Asset") return "当前选中资产";
  return label ?? "当前选中资产";
}

function formatGovernedModuleLabel(module: string): string {
  if (module === "screening") return "初筛";
  if (module === "editing") return "编辑";
  if (module === "proofreading") return "校对";
  return module;
}

function formatRuntimeBindingReadiness(status?: string): string {
  if (status === "ready") return "就绪";
  if (status === "degraded") return "降级";
  if (status === "missing") return "缺失";
  return "未报告";
}

function buildQueueItemFromManuscript(
  manuscript: ManuscriptWorkbenchWorkspace["manuscript"],
  mode: ManuscriptWorkbenchMode,
  queueScope: "batch" | "recent",
  isActive: boolean,
): ManuscriptWorkbenchQueueItem {
  return {
    manuscriptId: manuscript.id,
    title: manuscript.title,
    manuscriptTypeLabel: formatWorkbenchManuscriptTypeLabel(manuscript.manuscript_type),
    statusLabel: formatQueueStatusLabel(manuscript.status),
    activityLabel: resolveQueueActivityLabel(mode, manuscript),
    queueScope,
    queueStatus: resolveQueueStatus(manuscript.status),
    isActive,
  };
}

function mergeQueueItems(
  existing: ManuscriptWorkbenchQueueItem[],
  incoming: ManuscriptWorkbenchQueueItem[],
): ManuscriptWorkbenchQueueItem[] {
  const hasIncomingActive = incoming.some((item) => item.isActive);
  const merged = new Map<string, ManuscriptWorkbenchQueueItem>();

  for (const item of existing) {
    merged.set(item.manuscriptId, item);
  }

  for (const item of incoming) {
    const previous = merged.get(item.manuscriptId);
    merged.set(item.manuscriptId, {
      ...(previous ?? item),
      ...item,
      queueScope:
        item.queueScope === "batch" || previous?.queueScope === "batch"
          ? "batch"
          : item.queueScope,
    });
  }

  const items = Array.from(merged.values()).map((item) => ({
    ...item,
    isActive: hasIncomingActive
      ? incoming.some((incomingItem) => incomingItem.manuscriptId === item.manuscriptId && incomingItem.isActive)
      : item.isActive,
  }));

  return items.sort((left, right) => {
    if (left.isActive !== right.isActive) {
      return left.isActive ? -1 : 1;
    }

    if (left.queueScope !== right.queueScope) {
      return left.queueScope === "batch" ? -1 : 1;
    }

    return left.title.localeCompare(right.title, "zh-CN");
  });
}

function resolveQueueStatus(
  status: ManuscriptWorkbenchWorkspace["manuscript"]["status"],
): Exclude<ManuscriptWorkbenchQueueFilter, "all"> {
  if (status === "processing") {
    return "in_progress";
  }

  if (status === "completed" || status === "archived") {
    return "completed";
  }

  return "pending";
}

function formatQueueStatusLabel(
  status: ManuscriptWorkbenchWorkspace["manuscript"]["status"],
): string {
  if (status === "uploaded") return "待处理";
  if (status === "processing") return "处理中";
  if (status === "awaiting_review") return "待复核";
  if (status === "completed") return "已完成";
  if (status === "archived") return "已归档";
  return "草稿";
}

function resolveQueueActivityLabel(
  mode: ManuscriptWorkbenchMode,
  manuscript: ManuscriptWorkbenchWorkspace["manuscript"],
): string {
  if (mode === "submission") {
    return manuscript.status === "processing" ? "已进入上传处理" : "等待上传确认";
  }

  if (mode === "screening") {
    return manuscript.status === "processing" ? "已进入初筛处理" : "等待初筛";
  }

  if (mode === "editing") {
    return manuscript.status === "processing" ? "已进入编辑处理" : "等待编辑";
  }

  return manuscript.status === "processing" ? "已进入校对处理" : "等待校对";
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
  const localizedSuffix =
    labelSuffix === "Settlement"
      ? "结算"
      : labelSuffix === "Recovery"
        ? "恢复"
        : labelSuffix === "Recovery Ready At"
          ? "恢复可用时间"
          : labelSuffix;
  return details.find(
    (detail) =>
      detail.label.endsWith(labelSuffix) || detail.label.endsWith(localizedSuffix),
  )?.value;
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
    case "业务已完成，后续待处理":
    case "业务已完成，后续处理中":
      return `${status} 后续治理流程尚未结算。`;
    case "Business complete, follow-up retryable":
    case "业务已完成，后续可重试":
      if (
        (recovery === "Waiting for retry window" || recovery === "等待重试窗口") &&
        recoveryReadyAt
      ) {
        return `${status} 后续治理流程可在 ${recoveryReadyAt} 后重试，仍需关注。`;
      }

      return `${status} 后续治理流程可重试，仍需关注。`;
    case "Business complete, follow-up failed":
    case "业务已完成，后续失败":
      return `${status} 后续治理流程失败，需人工检查。`;
    case "Business complete, settlement unlinked":
    case "业务已完成，结算未关联":
      return `${status} 结算链路未关联，需人工检查。`;
    case "Job failed":
    case "任务失败":
      return `${status} 最近一次治理执行失败，需人工检查。`;
    case "Job in progress":
    case "任务进行中":
      return `${status} 最近一次治理执行仍在进行中。`;
    case "Not started":
    case "未开始":
      return `${status} 最近一次治理后续流程尚未开始。`;
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

export function resolveWorkbenchGeneratedAssetFileName(
  mode: ManuscriptWorkbenchRunMode,
): string {
  if (mode === "screening") {
    return "screening-report.md";
  }

  if (mode === "editing") {
    return "editing-manuscript.docx";
  }

  return "proofreading-draft-report.md";
}

function resolveCurrentAssetDownloadHref(
  asset: ManuscriptWorkbenchWorkspace["currentAsset"] | null | undefined,
): string | null {
  const assetId = asset?.id?.trim();
  if (!assetId) {
    return null;
  }

  return resolveBrowserApiUrl(`/api/v1/document-assets/${assetId}/download`);
}

function resolveCurrentResultDownloadLabel(
  asset: NonNullable<ManuscriptWorkbenchWorkspace["currentAsset"]>,
): string {
  if (asset.asset_type === "screening_report") {
    return "下载初筛报告";
  }

  if (asset.asset_type === "proofreading_draft_report") {
    return "下载校对草稿";
  }

  if (asset.asset_type === "final_proof_issue_report") {
    return "下载校对问题报告";
  }

  if (asset.asset_type === "edited_docx") {
    return "下载编辑稿";
  }

  if (asset.asset_type === "final_proof_annotated_docx") {
    return "下载校对定稿";
  }

  if (asset.asset_type === "human_final_docx") {
    return "下载人工终稿";
  }

  return "下载当前结果";
}

function hasUploadPayload(input: UploadManuscriptInput): boolean {
  return (
    (input.fileContentBase64?.trim().length ?? 0) > 0 ||
    (input.storageKey?.trim().length ?? 0) > 0
  );
}

export function deriveUploadTitleFromFileName(
  fileName: string,
  fallbackTitle: string,
): string {
  const trimmedFileName = fileName.trim();
  if (trimmedFileName.length === 0) {
    return fallbackTitle;
  }

  const extensionIndex = trimmedFileName.lastIndexOf(".");
  const baseName =
    extensionIndex > 0
      ? trimmedFileName.slice(0, extensionIndex)
      : trimmedFileName;
  return baseName.trim().length > 0 ? baseName : fallbackTitle;
}

function formatAssetOptionLabel(asset: {
  id: string;
  asset_type: string;
  file_name?: string | null;
}): string {
  return `${asset.file_name ?? asset.asset_type} · ${asset.asset_type} · ${asset.id}`;
}

function formatDetectedManuscriptType(
  manuscript: ManuscriptWorkbenchWorkspace["manuscript"],
): string {
  const label = formatWorkbenchManuscriptTypeLabel(manuscript.manuscript_type);
  const detection = manuscript.manuscript_type_detection_summary;

  if (!detection) {
    return label;
  }

  if (detection.requires_operator_review || detection.confidence_level === "low") {
    return `${label}（低置信度，待人工确认）`;
  }

  if (detection.confidence_level === "high") {
    return `${label}（高置信度）`;
  }

  if (typeof detection.confidence === "number") {
    return `${label}（${Math.round(detection.confidence * 100)}%）`;
  }

  return `${label}（中置信度）`;
}

function formatWorkbenchManuscriptTypeLabel(manuscriptType: string): string {
  switch (manuscriptType) {
    case "review":
      return "综述";
    case "clinical_study":
      return "临床研究";
    case "meta_analysis":
      return "Meta 分析";
    case "systematic_review":
      return "系统综述";
    case "case_report":
      return "病例报告";
    case "guideline_interpretation":
      return "指南解读";
    case "expert_consensus":
      return "专家共识";
    case "diagnostic_study":
      return "诊断研究";
    case "basic_research":
      return "基础研究";
    case "nursing_study":
      return "护理研究";
    case "methodology_paper":
      return "方法学论文";
    case "brief_report":
      return "简报";
    case "other":
      return "其他";
    default:
      return manuscriptType;
  }
}

function formatDetectedConfidenceLabel(
  manuscript: ManuscriptWorkbenchWorkspace["manuscript"],
): string {
  const detection = manuscript.manuscript_type_detection_summary;
  if (!detection) {
    return "待识别";
  }

  if (detection.requires_operator_review || detection.confidence_level === "low") {
    return "低置信度，需人工确认";
  }

  if (detection.confidence_level === "high") {
    return "高置信度";
  }

  if (typeof detection.confidence === "number") {
    return `中置信度（${Math.round(detection.confidence * 100)}%）`;
  }

  return "中置信度";
}

function buildTemplateSelectionWorkspace(
  workspace: ManuscriptWorkbenchWorkspace,
  templateContext: ManuscriptWorkbenchTemplateContext | null,
  input: {
    selectedTemplateFamilyId: string;
    selectedJournalTemplateId: string;
  },
): ManuscriptWorkbenchWorkspace {
  const journalTemplateProfiles =
    templateContext?.journalTemplateProfiles ?? workspace.journalTemplateProfiles ?? [];
  const selectedJournalTemplateProfile =
    journalTemplateProfiles.find(
      (profile) => profile.id === input.selectedJournalTemplateId,
    ) ??
    (workspace.selectedJournalTemplateProfile &&
    workspace.selectedJournalTemplateProfile.id === input.selectedJournalTemplateId
      ? workspace.selectedJournalTemplateProfile
      : null);

  return {
    ...workspace,
    availableTemplateFamilies:
      templateContext?.availableTemplateFamilies ?? workspace.availableTemplateFamilies,
    templateFamily: resolveWorkspaceTemplateFamilyById(
      workspace,
      input.selectedTemplateFamilyId,
      templateContext,
    ),
    journalTemplateProfiles,
    selectedJournalTemplateProfile,
  };
}

function resolveCurrentBaseTemplateFamilyId(
  workspace: ManuscriptWorkbenchWorkspace,
): string | undefined {
  return (
    workspace.manuscript.current_template_family_id ??
    workspace.manuscript.governed_execution_context_summary?.base_template_family_id
  );
}

function resolveWorkspaceTemplateFamilyById(
  workspace: ManuscriptWorkbenchWorkspace,
  templateFamilyId: string,
  templateContext?: ManuscriptWorkbenchTemplateContext | null,
) {
  if (templateFamilyId.trim().length === 0) {
    return templateContext?.templateFamily ?? workspace.templateFamily ?? null;
  }

  return (
    templateContext?.availableTemplateFamilies.find(
      (family) => family.id === templateFamilyId,
    ) ??
    workspace.availableTemplateFamilies?.find((family) => family.id === templateFamilyId) ??
    (workspace.templateFamily?.id === templateFamilyId ? workspace.templateFamily : null) ??
    null
  );
}

function resolveSelectedTemplateManuscriptType(
  workspace: ManuscriptWorkbenchWorkspace,
  selectedTemplateFamilyId: string,
): string {
  return (
    resolveWorkspaceTemplateFamilyById(workspace, selectedTemplateFamilyId)?.manuscript_type ??
    workspace.manuscript.manuscript_type
  );
}

function shouldShowManualManuscriptTypeSelect(
  workspace: ManuscriptWorkbenchWorkspace,
): boolean {
  return (
    (workspace.manuscript.manuscript_type_detection_summary?.requires_operator_review ??
      false) ||
    buildManualManuscriptTypeOptions(workspace).length > 1
  );
}

function shouldKeepSelectedJournalTemplate(
  selectedJournalTemplateId: string,
  nextTemplateFamilyId: string,
  templateContext: ManuscriptWorkbenchTemplateContext,
  workspace: ManuscriptWorkbenchWorkspace,
): boolean {
  if (!selectedJournalTemplateId) {
    return false;
  }

  return (
    templateContext.journalTemplateProfiles.some(
      (profile) => profile.id === selectedJournalTemplateId,
    ) ||
    (workspace.selectedJournalTemplateProfile?.id === selectedJournalTemplateId &&
      workspace.selectedJournalTemplateProfile.template_family_id === nextTemplateFamilyId)
  );
}

function resolveBaseTemplateFamilyLabel(
  workspace: ManuscriptWorkbenchWorkspace,
): string {
  return formatTemplateFamilyDisplayLabel(
    workspace.templateFamily?.name ??
      workspace.manuscript.current_template_family_id ??
      workspace.manuscript.governed_execution_context_summary?.base_template_family_id ??
      "未绑定",
  );
}

function resolveJournalTemplateSelectionLabel(
  workspace: ManuscriptWorkbenchWorkspace,
): string {
  if (workspace.selectedJournalTemplateProfile?.journal_name) {
    return workspace.selectedJournalTemplateProfile.journal_name;
  }

  if (
    workspace.manuscript.governed_execution_context_summary
      ?.journal_template_selection_state === "selected" &&
    workspace.manuscript.governed_execution_context_summary?.journal_template_id
  ) {
    return workspace.manuscript.governed_execution_context_summary.journal_template_id;
  }

  return "仅基础模板";
}
