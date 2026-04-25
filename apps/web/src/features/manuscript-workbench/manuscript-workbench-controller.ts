import type { AuthRole } from "../auth/index.ts";
import type { ModuleExecutionMode } from "@medical/contracts";
import {
  type HumanFeedbackRecordViewModel,
  type ManualFeedbackCategory,
} from "../feedback-governance/index.ts";
import { getKnowledgeAssetDetail } from "../knowledge-library/knowledge-library-api.ts";
import type { KnowledgeRevisionStatus } from "../knowledge-library/types.ts";
import {
  exportCurrentAsset,
  getJob,
  getManuscript,
  getModuleExecutionConcurrency,
  listManuscriptAssets,
  uploadManuscriptBatch,
  uploadManuscript,
  updateManuscriptTemplateSelection,
  type DocumentAssetExportViewModel,
  type DocumentAssetViewModel,
  type JobViewModel,
  type ModuleExecutionConcurrencySnapshotViewModel,
  type UploadManuscriptBatchInput,
  type UploadManuscriptBatchResult,
  type ModuleExecutionOverviewViewModel,
  type ManuscriptViewModel,
  type UploadManuscriptInput,
  type UploadManuscriptResult,
} from "../manuscripts/index.ts";
import {
  createPreviewSession,
  type DocumentPreviewSessionViewModel,
} from "../document-preview/index.ts";
import {
  listJournalTemplateProfilesByTemplateFamilyId,
  listTemplateFamilies,
  type JournalTemplateProfileViewModel,
  type TemplateFamilyViewModel,
} from "../templates/index.ts";
import {
  runEditing,
  type EditingRunResultViewModel,
} from "../editing/index.ts";
import {
  confirmProofreadingFinal,
  createProofreadingDraft,
  publishProofreadingHumanFinal,
  saveProofreadingConfirmationDraft,
  type ProofreadingConfirmationDecisionInput,
  type ProofreadingConfirmationDraftSaveResultViewModel,
  type ProofreadingHumanFinalPublishResultViewModel,
  type ProofreadingRunResultViewModel,
  type PublishProofreadingHumanFinalInput,
} from "../proofreading/index.ts";
import {
  runScreening,
  type ModuleJobViewModel,
  type ScreeningRunResultViewModel,
} from "../screening/index.ts";
import {
  decideReviewItem,
  submitGovernedHit,
  type DecideReviewItemInput,
  type GovernedHitReviewItemViewModel,
  type ReviewItemDecisionResultViewModel,
} from "../review-items/index.ts";
import type { ManuscriptWorkbenchProofreadingGovernanceHandoffViewModel } from "./manuscript-workbench-governance-handoff.ts";

export type ManuscriptWorkbenchMode =
  | "submission"
  | "screening"
  | "editing"
  | "proofreading";

export type ManuscriptWorkbenchRunMode = Exclude<
  ManuscriptWorkbenchMode,
  "submission"
>;

export interface ManuscriptWorkbenchHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export interface ManuscriptWorkbenchWorkspace {
  manuscript: ManuscriptViewModel;
  assets: DocumentAssetViewModel[];
  currentAsset: DocumentAssetViewModel | null;
  currentManuscriptAsset: DocumentAssetViewModel | null;
  suggestedParentAsset: DocumentAssetViewModel | null;
  latestProofreadingDraftAsset: DocumentAssetViewModel | null;
  knowledgeReferences?: Record<string, ManuscriptWorkbenchKnowledgeReferenceViewModel>;
  availableTemplateFamilies?: TemplateFamilyViewModel[];
  templateFamily?: TemplateFamilyViewModel | null;
  journalTemplateProfiles?: JournalTemplateProfileViewModel[];
  selectedJournalTemplateProfile?: JournalTemplateProfileViewModel | null;
  moduleExecutionConcurrency?: ModuleExecutionConcurrencySnapshotViewModel;
}

export interface ManuscriptWorkbenchKnowledgeReferenceViewModel {
  id: string;
  title: string;
  revisionId?: string;
  status?: KnowledgeRevisionStatus;
}

export interface ManuscriptWorkbenchTemplateContext {
  availableTemplateFamilies: TemplateFamilyViewModel[];
  templateFamily: TemplateFamilyViewModel | null;
  journalTemplateProfiles: JournalTemplateProfileViewModel[];
}

export interface ManuscriptWorkbenchReadOnlyExecutionContextViewModel {
  mode: ManuscriptWorkbenchRunMode;
  executionProfileId?: string;
  retrievalPresetId?: string;
  runtimeBindingId?: string;
  modelRoutingPolicyVersionId?: string;
  resolvedModelId?: string;
  modelSource?: string;
  providerReadinessStatus?: "ok" | "warning";
  runtimeBindingReadinessStatus?: "ready" | "degraded" | "missing";
}

export interface UploadManuscriptAndLoadResult {
  upload: UploadManuscriptResult;
  workspace: ManuscriptWorkbenchWorkspace;
}

export interface ManuscriptWorkbenchWorkspaceLoadOptions {
  actorRole?: AuthRole;
  mode?: ManuscriptWorkbenchMode;
  includeKnowledgeReferences?: boolean;
  includeTemplateContext?: boolean;
}

export interface UploadManuscriptBatchAndLoadResult {
  upload: UploadManuscriptBatchResult;
  workspace: ManuscriptWorkbenchWorkspace;
}

export type ManuscriptWorkbenchRunResult =
  | ScreeningRunResultViewModel
  | EditingRunResultViewModel
  | ProofreadingRunResultViewModel;

export interface RunModuleAndLoadInput {
  mode: ManuscriptWorkbenchRunMode;
  manuscriptId: string;
  parentAssetId: string;
  actorRole: AuthRole;
  storageKey: string;
  fileName?: string;
  executionMode?: ModuleExecutionMode;
}

export interface FinalizeProofreadingAndLoadInput {
  manuscriptId: string;
  draftAssetId: string;
  actorRole: AuthRole;
  storageKey: string;
  fileName?: string;
}

export interface PublishHumanFinalAndLoadInput {
  manuscriptId: string;
  finalAssetId: string;
  actorRole: AuthRole;
  storageKey: string;
  fileName?: string;
  confirmationDecisions?: PublishProofreadingHumanFinalInput["confirmationDecisions"];
}

export interface RunModuleAndLoadResult {
  runResult: ManuscriptWorkbenchRunResult;
  workspace: ManuscriptWorkbenchWorkspace;
}

export interface SubmitManualFeedbackForReviewInput {
  manuscriptId: string;
  manuscriptType: string;
  module: ManuscriptWorkbenchRunMode;
  snapshotId: string;
  sourceAssetId: string;
  feedbackCategory: ManualFeedbackCategory;
  feedbackText?: string;
  title?: string;
  excerpt?: string;
  location?: Record<string, unknown>;
  riskLevel?: "low" | "medium" | "high" | "critical";
  suggestion?: string;
  rationale?: string;
  candidatePosture?: "candidate_change" | "inspect_only";
  decisionSource?: "manual_feedback" | "execution_hit";
  evidencePack?: {
    location?: Record<string, unknown>;
    excerpt?: string;
    suggestion?: string;
    rationale?: string;
  };
  relatedRuleIds?: string[];
  relatedKnowledgeItemIds?: string[];
  originPayload?: Record<string, unknown>;
}

export interface SubmitManualFeedbackForReviewResult {
  feedback: HumanFeedbackRecordViewModel;
  item: GovernedHitReviewItemViewModel;
}

export interface PublishHumanFinalAndLoadResult {
  runResult: ProofreadingHumanFinalPublishResultViewModel;
  workspace: ManuscriptWorkbenchWorkspace;
}

export interface SaveProofreadingConfirmationDraftInput {
  manuscriptId: string;
  confirmationAssetId: string;
  actorRole: AuthRole;
  confirmationDecisions: ProofreadingConfirmationDecisionInput[];
}

export interface ManuscriptWorkbenchProofreadingGovernanceHandoffOptions {
  snapshotId?: string;
}

export interface UpdateTemplateSelectionAndLoadInput {
  manuscriptId: string;
  templateFamilyId?: string | null;
  journalTemplateId?: string | null;
}

export interface ManuscriptWorkbenchController {
  loadWorkspace(
    manuscriptId: string,
    options?: ManuscriptWorkbenchWorkspaceLoadOptions,
  ): Promise<ManuscriptWorkbenchWorkspace>;
  loadModuleExecutionConcurrency(): Promise<ModuleExecutionConcurrencySnapshotViewModel>;
  loadProofreadingGovernanceHandoff?(
    manuscriptId: string,
    options?: ManuscriptWorkbenchProofreadingGovernanceHandoffOptions,
  ): Promise<ManuscriptWorkbenchProofreadingGovernanceHandoffViewModel>;
  loadTemplateContext?(
    templateFamilyId: string,
  ): Promise<ManuscriptWorkbenchTemplateContext>;
  uploadManuscriptAndLoad(
    input: UploadManuscriptInput,
  ): Promise<UploadManuscriptAndLoadResult>;
  uploadManuscriptBatchAndLoad?(
    input: UploadManuscriptBatchInput,
  ): Promise<UploadManuscriptBatchAndLoadResult>;
  updateTemplateSelectionAndLoad(
    input: UpdateTemplateSelectionAndLoadInput,
  ): Promise<{ workspace: ManuscriptWorkbenchWorkspace }>;
  runModuleAndLoad(input: RunModuleAndLoadInput): Promise<RunModuleAndLoadResult>;
  finalizeProofreadingAndLoad(
    input: FinalizeProofreadingAndLoadInput,
  ): Promise<RunModuleAndLoadResult>;
  publishHumanFinalAndLoad(
    input: PublishHumanFinalAndLoadInput,
  ): Promise<PublishHumanFinalAndLoadResult>;
  saveProofreadingConfirmationDraft(
    input: SaveProofreadingConfirmationDraftInput,
  ): Promise<ProofreadingConfirmationDraftSaveResultViewModel>;
  submitManualFeedbackForReview(
    input: SubmitManualFeedbackForReviewInput,
  ): Promise<SubmitManualFeedbackForReviewResult>;
  decideReviewItem(
    input: DecideReviewItemInput,
  ): Promise<ReviewItemDecisionResultViewModel>;
  loadJob(jobId: string): Promise<JobViewModel>;
  createPreviewSession(input: {
    manuscriptId: string;
    assetId: string;
    actorRole: AuthRole;
    previewStatus?: "ready" | "pending_normalization";
    comments?: Array<{
      id: string;
      author?: string;
      body: string;
      anchor_text?: string;
      created_at?: string;
    }>;
  }): Promise<DocumentPreviewSessionViewModel>;
  exportCurrentAsset(input: {
    manuscriptId: string;
    preferredAssetType?: DocumentAssetViewModel["asset_type"];
  }): Promise<DocumentAssetExportViewModel>;
}

export function createManuscriptWorkbenchController(
  client: ManuscriptWorkbenchHttpClient,
): ManuscriptWorkbenchController {
  const knowledgeReferenceCache = new Map<
    string,
    ManuscriptWorkbenchKnowledgeReferenceViewModel | null
  >();
  const loadWorkspaceWithKnowledge = (
    manuscriptId: string,
    options?: ManuscriptWorkbenchWorkspaceLoadOptions,
  ) => loadWorkspace(client, manuscriptId, knowledgeReferenceCache, options);

  return {
    loadWorkspace(manuscriptId, options) {
      return loadWorkspaceWithKnowledge(manuscriptId, options);
    },
    async loadModuleExecutionConcurrency() {
      const response = await getModuleExecutionConcurrency(client);
      return response.body;
    },
    loadProofreadingGovernanceHandoff(manuscriptId, options) {
      return loadProofreadingGovernanceHandoff(client, manuscriptId, options);
    },
    async loadTemplateContext(templateFamilyId) {
      const [availableTemplateFamilies, templateFamily, journalTemplateProfiles] =
        await loadTemplateContext(client, templateFamilyId);

      return {
        availableTemplateFamilies,
        templateFamily,
        journalTemplateProfiles,
      };
    },
    async uploadManuscriptAndLoad(input) {
      const response = await uploadManuscript(client, input);
      const [job, workspace] = await Promise.all([
        hydrateWorkbenchActionJob(client, response.body.job),
        loadWorkspaceWithKnowledge(response.body.manuscript.id),
      ]);

      return {
        upload: {
          ...response.body,
          job,
        },
        workspace,
      };
    },
    async uploadManuscriptBatchAndLoad(input) {
      const response = await uploadManuscriptBatch(client, input);
      const firstManuscriptId = response.body.items[0]?.manuscript.id;
      if (!firstManuscriptId) {
        throw new Error("Batch uploads require at least one manuscript item.");
      }

      const [batchJob, workspace] = await Promise.all([
        hydrateWorkbenchActionJob(client, response.body.batch_job),
        loadWorkspaceWithKnowledge(firstManuscriptId),
      ]);

      return {
        upload: {
          ...response.body,
          batch_job: batchJob,
        },
        workspace,
      };
    },
    async updateTemplateSelectionAndLoad(input) {
      await updateManuscriptTemplateSelection(client, input);

      return {
        workspace: await loadWorkspaceWithKnowledge(input.manuscriptId),
      };
    },
    async runModuleAndLoad(input) {
      const runResult = await runModule(client, input);
      const [job, workspace] = await Promise.all([
        hydrateWorkbenchActionJob(client, runResult.job),
        loadWorkspaceWithKnowledge(input.manuscriptId, {
          actorRole: input.actorRole,
          mode: input.mode,
        }),
      ]);

      return {
        runResult: {
          ...runResult,
          job,
        },
        workspace,
      };
    },
    async finalizeProofreadingAndLoad(input) {
      const response = await confirmProofreadingFinal(client, {
        manuscriptId: input.manuscriptId,
        draftAssetId: input.draftAssetId,
        requestedBy: "web-workbench",
        actorRole: input.actorRole,
        storageKey: input.storageKey,
        fileName: input.fileName,
      });
      const [job, workspace] = await Promise.all([
        hydrateWorkbenchActionJob(client, response.body.job),
        loadWorkspaceWithKnowledge(input.manuscriptId, {
          actorRole: input.actorRole,
          mode: "proofreading",
        }),
      ]);

      return {
        runResult: {
          ...response.body,
          job,
        },
        workspace,
      };
    },
    async publishHumanFinalAndLoad(input) {
      const response = await publishProofreadingHumanFinal(client, {
        manuscriptId: input.manuscriptId,
        finalAssetId: input.finalAssetId,
        requestedBy: "web-workbench",
        actorRole: input.actorRole,
        storageKey: input.storageKey,
        fileName: input.fileName,
        confirmationDecisions: input.confirmationDecisions,
      });
      const [job, workspace] = await Promise.all([
        hydrateWorkbenchActionJob(client, response.body.job),
        loadWorkspaceWithKnowledge(input.manuscriptId, {
          actorRole: input.actorRole,
          mode: "proofreading",
        }),
      ]);

      return {
        runResult: {
          ...response.body,
          job,
        },
        workspace,
      };
    },
    async saveProofreadingConfirmationDraft(input) {
      const response = await saveProofreadingConfirmationDraft(client, {
        manuscriptId: input.manuscriptId,
        confirmationAssetId: input.confirmationAssetId,
        requestedBy: "web-workbench",
        actorRole: input.actorRole,
        confirmationDecisions: input.confirmationDecisions,
      });

      return response.body;
    },
    async submitManualFeedbackForReview(input) {
      const response = await submitGovernedHit(client, input);
      return response.body;
    },
    async decideReviewItem(input) {
      const response = await decideReviewItem(client, input);
      return response.body;
    },
    async loadJob(jobId) {
      const response = await getJob(client, jobId);
      return response.body;
    },
    async createPreviewSession(input) {
      const response = await createPreviewSession(client, {
        manuscriptId: input.manuscriptId,
        assetId: input.assetId,
        actorRole: input.actorRole,
        ...(input.previewStatus ? { previewStatus: input.previewStatus } : {}),
        ...(input.comments ? { comments: input.comments } : {}),
      });
      return response.body;
    },
    async exportCurrentAsset(input) {
      const response = await exportCurrentAsset(client, input);
      return response.body;
    },
  };
}

async function loadWorkspace(
  client: ManuscriptWorkbenchHttpClient,
  manuscriptId: string,
  knowledgeReferenceCache: Map<
    string,
    ManuscriptWorkbenchKnowledgeReferenceViewModel | null
  >,
  options: ManuscriptWorkbenchWorkspaceLoadOptions = {},
): Promise<ManuscriptWorkbenchWorkspace> {
  const [manuscriptResponse, assetsResponse] = await Promise.all([
    getManuscript(client, manuscriptId),
    listManuscriptAssets(client, manuscriptId),
  ]);
  const assets = sortAssetsNewestFirst(assetsResponse.body);
  const knowledgeReferences = shouldLoadKnowledgeReferences(options)
    ? await loadKnowledgeReferences(client, manuscriptResponse.body, knowledgeReferenceCache)
    : {};
  const [availableTemplateFamilies, templateFamily, journalTemplateProfiles] =
    shouldLoadTemplateContext(options)
      ? await loadTemplateContextBestEffort(
          client,
          manuscriptResponse.body.current_template_family_id ??
            manuscriptResponse.body.governed_execution_context_summary
              ?.base_template_family_id ??
            "",
        )
      : [[], null, [] as JournalTemplateProfileViewModel[]];

  return {
    manuscript: manuscriptResponse.body,
    assets,
    currentAsset: resolveCurrentAsset(manuscriptResponse.body, assets),
    currentManuscriptAsset: resolveCurrentManuscriptAsset(assets),
    suggestedParentAsset: resolveSuggestedParentAsset(manuscriptResponse.body, assets),
    latestProofreadingDraftAsset: resolveLatestProofreadingDraftAsset(assets),
    knowledgeReferences:
      Object.keys(knowledgeReferences).length > 0 ? knowledgeReferences : undefined,
    availableTemplateFamilies,
    templateFamily,
    journalTemplateProfiles,
    selectedJournalTemplateProfile:
      journalTemplateProfiles.find(
        (profile) =>
          profile.id === manuscriptResponse.body.current_journal_template_id,
      ) ?? null,
  };
}

async function loadTemplateContext(
  client: ManuscriptWorkbenchHttpClient,
  templateFamilyId: string,
): Promise<
  [
    TemplateFamilyViewModel[],
    TemplateFamilyViewModel | null,
    JournalTemplateProfileViewModel[],
  ]
> {
  const templateFamilies = (await listTemplateFamilies(client)).body;
  const templateFamily =
    templateFamilies.find((family) => family.id === templateFamilyId) ?? null;

  if (!templateFamily) {
    return [templateFamilies, null, []];
  }

  const journalTemplateProfiles = (
    await listJournalTemplateProfilesByTemplateFamilyId(client, templateFamily.id)
  ).body;

  return [templateFamilies, templateFamily, journalTemplateProfiles];
}

async function loadTemplateContextBestEffort(
  client: ManuscriptWorkbenchHttpClient,
  templateFamilyId: string,
): Promise<
  [
    TemplateFamilyViewModel[],
    TemplateFamilyViewModel | null,
    JournalTemplateProfileViewModel[],
  ]
> {
  try {
    return await loadTemplateContext(client, templateFamilyId);
  } catch {
    return [[], null, []];
  }
}

async function loadProofreadingGovernanceHandoff(
  client: ManuscriptWorkbenchHttpClient,
  manuscriptId: string,
  options: ManuscriptWorkbenchProofreadingGovernanceHandoffOptions = {},
): Promise<ManuscriptWorkbenchProofreadingGovernanceHandoffViewModel> {
  const normalizedManuscriptId = manuscriptId.trim();
  const normalizedSnapshotId = options.snapshotId?.trim() ?? "";
  if (normalizedManuscriptId.length === 0) {
    return {
      residualReviewItems: [],
      ruleCandidates: [],
      knowledgeCandidates: [],
    };
  }

  const response = await client.request<Partial<ManuscriptWorkbenchProofreadingGovernanceHandoffViewModel>>({
      method: "GET",
      url:
        "/api/v1/modules/proofreading/governance-handoff" +
        `?manuscriptId=${encodeURIComponent(normalizedManuscriptId)}` +
        (normalizedSnapshotId
          ? `&snapshotId=${encodeURIComponent(normalizedSnapshotId)}`
          : ""),
    });

  return {
    residualReviewItems: response.body.residualReviewItems ?? [],
    ruleCandidates: response.body.ruleCandidates ?? [],
    knowledgeCandidates: response.body.knowledgeCandidates ?? [],
  };
}

async function loadKnowledgeReferences(
  client: ManuscriptWorkbenchHttpClient,
  manuscript: ManuscriptViewModel,
  cache: Map<string, ManuscriptWorkbenchKnowledgeReferenceViewModel | null>,
): Promise<Record<string, ManuscriptWorkbenchKnowledgeReferenceViewModel>> {
  const knowledgeItemIds = collectReferencedKnowledgeItemIds(manuscript);
  if (knowledgeItemIds.length === 0) {
    return {};
  }

  const missingIds = knowledgeItemIds.filter((knowledgeItemId) => !cache.has(knowledgeItemId));
  if (missingIds.length > 0) {
    const loadedReferences = await Promise.all(
      missingIds.map(async (knowledgeItemId) => {
        try {
          const response = await getKnowledgeAssetDetail(client, knowledgeItemId);
          return [knowledgeItemId, mapKnowledgeReference(response.body)] as const;
        } catch {
          return [knowledgeItemId, null] as const;
        }
      }),
    );

    for (const [knowledgeItemId, reference] of loadedReferences) {
      cache.set(knowledgeItemId, reference);
    }
  }

  const references: Record<string, ManuscriptWorkbenchKnowledgeReferenceViewModel> = {};
  for (const knowledgeItemId of knowledgeItemIds) {
    const reference = cache.get(knowledgeItemId);
    if (reference) {
      references[knowledgeItemId] = reference;
    }
  }

  return references;
}

function collectReferencedKnowledgeItemIds(manuscript: ManuscriptViewModel): string[] {
  const overview = manuscript.module_execution_overview;
  if (!overview) {
    return [];
  }

  return dedupeIds([
    ...resolveSnapshotKnowledgeItemIds(overview.screening),
    ...resolveSnapshotKnowledgeItemIds(overview.editing),
    ...resolveSnapshotKnowledgeItemIds(overview.proofreading),
  ]);
}

function resolveSnapshotKnowledgeItemIds(
  overview: ModuleExecutionOverviewViewModel,
): string[] {
  if (!overview || overview.observation_status !== "reported") {
    return [];
  }

  return dedupeIds(overview.latest_snapshot?.knowledge_item_ids ?? []);
}

function mapKnowledgeReference(detail: Awaited<ReturnType<typeof getKnowledgeAssetDetail>>["body"]): ManuscriptWorkbenchKnowledgeReferenceViewModel {
  const revision = detail.current_approved_revision ?? detail.selected_revision;

  return {
    id: detail.asset.id,
    title: revision.title,
    revisionId: revision.id,
    status: revision.status,
  };
}

function dedupeIds(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function shouldLoadKnowledgeReferences(
  options: ManuscriptWorkbenchWorkspaceLoadOptions,
): boolean {
  if (typeof options.includeKnowledgeReferences === "boolean") {
    return options.includeKnowledgeReferences;
  }

  return canLoadPrivilegedWorkbenchEnrichment(options.actorRole);
}

function shouldLoadTemplateContext(
  options: ManuscriptWorkbenchWorkspaceLoadOptions,
): boolean {
  if (typeof options.includeTemplateContext === "boolean") {
    return options.includeTemplateContext;
  }

  return canLoadPrivilegedWorkbenchEnrichment(options.actorRole);
}

function canLoadPrivilegedWorkbenchEnrichment(actorRole?: AuthRole): boolean {
  if (actorRole == null) {
    return true;
  }

  return actorRole === "admin" || actorRole === "knowledge_reviewer";
}

async function runModule(
  client: ManuscriptWorkbenchHttpClient,
  input: RunModuleAndLoadInput,
): Promise<ManuscriptWorkbenchRunResult> {
  switch (input.mode) {
    case "screening": {
      const response = await runScreening(client, {
        manuscriptId: input.manuscriptId,
        parentAssetId: input.parentAssetId,
        requestedBy: "web-workbench",
        actorRole: input.actorRole,
        storageKey: input.storageKey,
        fileName: input.fileName,
        ...(input.executionMode ? { executionMode: input.executionMode } : {}),
      });
      return response.body;
    }
    case "editing": {
      const response = await runEditing(client, {
        manuscriptId: input.manuscriptId,
        parentAssetId: input.parentAssetId,
        requestedBy: "web-workbench",
        actorRole: input.actorRole,
        storageKey: input.storageKey,
        fileName: input.fileName,
        ...(input.executionMode ? { executionMode: input.executionMode } : {}),
      });
      return response.body;
    }
    case "proofreading": {
      const response = await createProofreadingDraft(client, {
        manuscriptId: input.manuscriptId,
        parentAssetId: input.parentAssetId,
        requestedBy: "web-workbench",
        actorRole: input.actorRole,
        storageKey: input.storageKey,
        fileName: input.fileName,
        ...(input.executionMode ? { executionMode: input.executionMode } : {}),
      });
      return response.body;
    }
  }
}

async function hydrateWorkbenchActionJob<TJob extends { id: string }>(
  client: ManuscriptWorkbenchHttpClient,
  job: TJob,
): Promise<TJob> {
  try {
    const response = await getJob(client, job.id);
    return response.body as unknown as TJob;
  } catch {
    return job;
  }
}

function resolveCurrentAsset(
  manuscript: ManuscriptViewModel,
  assets: readonly DocumentAssetViewModel[],
): DocumentAssetViewModel | null {
  const exportSelectedAssetId = manuscript.current_export_selection?.asset?.id;
  if (exportSelectedAssetId) {
    const exportSelectedAsset = assets.find((asset) => asset.id === exportSelectedAssetId);
    if (exportSelectedAsset) {
      return exportSelectedAsset;
    }
  }

  const preferredIds = [
    manuscript.current_proofreading_asset_id,
    manuscript.current_editing_asset_id,
    manuscript.current_screening_asset_id,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  for (const assetId of preferredIds) {
    const matched = assets.find((asset) => asset.id === assetId);
    if (matched) {
      return matched;
    }
  }

  return assets.find((asset) => asset.is_current) ?? assets[0] ?? null;
}

const MANUSCRIPT_DOCUMENT_ASSET_PRIORITY: readonly DocumentAssetViewModel["asset_type"][] = [
  "human_final_docx",
  "final_proof_annotated_docx",
  "edited_docx",
  "normalized_docx",
  "original",
];

const SUGGESTED_PARENT_ASSET_PRIORITY: readonly DocumentAssetViewModel["asset_type"][] = [
  "edited_docx",
  "normalized_docx",
  "original",
  "human_final_docx",
  "final_proof_annotated_docx",
];

function resolveCurrentManuscriptAsset(
  assets: readonly DocumentAssetViewModel[],
): DocumentAssetViewModel | null {
  for (const assetType of MANUSCRIPT_DOCUMENT_ASSET_PRIORITY) {
    const currentAsset = assets.find(
      (asset) =>
        asset.asset_type === assetType &&
        asset.is_current &&
        asset.status !== "archived",
    );
    if (currentAsset) {
      return currentAsset;
    }
  }

  for (const assetType of MANUSCRIPT_DOCUMENT_ASSET_PRIORITY) {
    const latestAsset = assets.find(
      (asset) =>
        asset.asset_type === assetType &&
        asset.status !== "archived",
    );
    if (latestAsset) {
      return latestAsset;
    }
  }

  return null;
}

function resolveSuggestedParentAsset(
  manuscript: ManuscriptViewModel,
  assets: readonly DocumentAssetViewModel[],
): DocumentAssetViewModel | null {
  const preferredIds = [
    manuscript.current_editing_asset_id,
    manuscript.current_screening_asset_id,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  for (const assetId of preferredIds) {
    const matched = assets.find(
      (asset) => asset.id === assetId && isSelectableParentAsset(asset),
    );
    if (matched) {
      return matched;
    }
  }

  for (const assetType of SUGGESTED_PARENT_ASSET_PRIORITY) {
    const matched = assets.find(
      (asset) =>
        asset.asset_type === assetType &&
        asset.status !== "archived" &&
        isSelectableParentAsset(asset),
    );
    if (matched) {
      return matched;
    }
  }

  return assets.find((asset) => isSelectableParentAsset(asset)) ?? null;
}

function resolveLatestProofreadingDraftAsset(
  assets: readonly DocumentAssetViewModel[],
): DocumentAssetViewModel | null {
  return assets.find((asset) => asset.asset_type === "proofreading_draft_report") ?? null;
}

export function isSelectableParentAsset(asset: DocumentAssetViewModel): boolean {
  return (
    asset.asset_type !== "screening_report" &&
    asset.asset_type !== "proofreading_draft_report" &&
    asset.asset_type !== "final_proof_issue_report"
  );
}

function sortAssetsNewestFirst(
  assets: readonly DocumentAssetViewModel[],
): DocumentAssetViewModel[] {
  return [...assets].sort((left, right) => {
    if (left.version_no !== right.version_no) {
      return right.version_no - left.version_no;
    }

    return right.created_at.localeCompare(left.created_at);
  });
}

export function isModuleJob(job: JobViewModel | ModuleJobViewModel): job is ModuleJobViewModel {
  return !("manuscript_id" in job);
}

export function resolveWorkbenchReadOnlyExecutionContext(
  mode: ManuscriptWorkbenchMode,
  workspace: Pick<ManuscriptWorkbenchWorkspace, "manuscript">,
): ManuscriptWorkbenchReadOnlyExecutionContextViewModel | null {
  if (mode === "submission") {
    return null;
  }

  const governedExecutionContext = workspace.manuscript.governed_execution_context_summary;
  if (!governedExecutionContext || governedExecutionContext.observation_status !== "reported") {
    return null;
  }

  const moduleSummary = governedExecutionContext.modules.find(
    (candidate) => candidate.module === mode,
  );
  if (!moduleSummary) {
    return null;
  }

  const hasReadOnlyContext = [
    moduleSummary.execution_profile_id,
    moduleSummary.model_routing_policy_version_id,
    moduleSummary.resolved_model_id,
    moduleSummary.model_source,
    moduleSummary.provider_readiness_status,
    moduleSummary.runtime_binding_readiness_status,
  ].some((value) => value != null);

  if (!hasReadOnlyContext) {
    return null;
  }

  return {
    mode,
    ...(moduleSummary.execution_profile_id
      ? { executionProfileId: moduleSummary.execution_profile_id }
      : {}),
    ...(moduleSummary.retrieval_preset_id
      ? { retrievalPresetId: moduleSummary.retrieval_preset_id }
      : {}),
    ...(moduleSummary.runtime_binding_id
      ? { runtimeBindingId: moduleSummary.runtime_binding_id }
      : {}),
    ...(moduleSummary.model_routing_policy_version_id
      ? {
          modelRoutingPolicyVersionId:
            moduleSummary.model_routing_policy_version_id,
        }
      : {}),
    ...(moduleSummary.resolved_model_id
      ? { resolvedModelId: moduleSummary.resolved_model_id }
      : {}),
    ...(moduleSummary.model_source
      ? { modelSource: moduleSummary.model_source }
      : {}),
    ...(moduleSummary.provider_readiness_status
      ? { providerReadinessStatus: moduleSummary.provider_readiness_status }
      : {}),
    ...(moduleSummary.runtime_binding_readiness_status
      ? {
          runtimeBindingReadinessStatus:
            moduleSummary.runtime_binding_readiness_status,
        }
      : {}),
  };
}
