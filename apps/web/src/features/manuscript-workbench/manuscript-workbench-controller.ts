import type { AuthRole } from "../auth/index.ts";
import {
  exportCurrentAsset,
  getJob,
  getManuscript,
  listManuscriptAssets,
  uploadManuscript,
  type DocumentAssetExportViewModel,
  type DocumentAssetViewModel,
  type JobViewModel,
  type ManuscriptViewModel,
  type UploadManuscriptInput,
  type UploadManuscriptResult,
} from "../manuscripts/index.ts";
import {
  runEditing,
  type EditingRunResultViewModel,
} from "../editing/index.ts";
import {
  confirmProofreadingFinal,
  createProofreadingDraft,
  publishProofreadingHumanFinal,
  type ProofreadingHumanFinalPublishResultViewModel,
  type ProofreadingRunResultViewModel,
} from "../proofreading/index.ts";
import {
  runScreening,
  type ModuleJobViewModel,
  type ScreeningRunResultViewModel,
} from "../screening/index.ts";

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
  suggestedParentAsset: DocumentAssetViewModel | null;
  latestProofreadingDraftAsset: DocumentAssetViewModel | null;
}

export interface UploadManuscriptAndLoadResult {
  upload: UploadManuscriptResult;
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
}

export interface RunModuleAndLoadResult {
  runResult: ManuscriptWorkbenchRunResult;
  workspace: ManuscriptWorkbenchWorkspace;
}

export interface PublishHumanFinalAndLoadResult {
  runResult: ProofreadingHumanFinalPublishResultViewModel;
  workspace: ManuscriptWorkbenchWorkspace;
}

export interface ManuscriptWorkbenchController {
  loadWorkspace(manuscriptId: string): Promise<ManuscriptWorkbenchWorkspace>;
  uploadManuscriptAndLoad(
    input: UploadManuscriptInput,
  ): Promise<UploadManuscriptAndLoadResult>;
  runModuleAndLoad(input: RunModuleAndLoadInput): Promise<RunModuleAndLoadResult>;
  finalizeProofreadingAndLoad(
    input: FinalizeProofreadingAndLoadInput,
  ): Promise<RunModuleAndLoadResult>;
  publishHumanFinalAndLoad(
    input: PublishHumanFinalAndLoadInput,
  ): Promise<PublishHumanFinalAndLoadResult>;
  loadJob(jobId: string): Promise<JobViewModel>;
  exportCurrentAsset(input: {
    manuscriptId: string;
    preferredAssetType?: DocumentAssetViewModel["asset_type"];
  }): Promise<DocumentAssetExportViewModel>;
}

export function createManuscriptWorkbenchController(
  client: ManuscriptWorkbenchHttpClient,
): ManuscriptWorkbenchController {
  return {
    loadWorkspace(manuscriptId) {
      return loadWorkspace(client, manuscriptId);
    },
    async uploadManuscriptAndLoad(input) {
      const response = await uploadManuscript(client, input);
      const [job, workspace] = await Promise.all([
        hydrateWorkbenchActionJob(client, response.body.job),
        loadWorkspace(client, response.body.manuscript.id),
      ]);

      return {
        upload: {
          ...response.body,
          job,
        },
        workspace,
      };
    },
    async runModuleAndLoad(input) {
      const runResult = await runModule(client, input);
      const [job, workspace] = await Promise.all([
        hydrateWorkbenchActionJob(client, runResult.job),
        loadWorkspace(client, input.manuscriptId),
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
        loadWorkspace(client, input.manuscriptId),
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
      });
      const [job, workspace] = await Promise.all([
        hydrateWorkbenchActionJob(client, response.body.job),
        loadWorkspace(client, input.manuscriptId),
      ]);

      return {
        runResult: {
          ...response.body,
          job,
        },
        workspace,
      };
    },
    async loadJob(jobId) {
      const response = await getJob(client, jobId);
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
): Promise<ManuscriptWorkbenchWorkspace> {
  const [manuscriptResponse, assetsResponse] = await Promise.all([
    getManuscript(client, manuscriptId),
    listManuscriptAssets(client, manuscriptId),
  ]);
  const assets = sortAssetsNewestFirst(assetsResponse.body);

  return {
    manuscript: manuscriptResponse.body,
    assets,
    currentAsset: resolveCurrentAsset(manuscriptResponse.body, assets),
    suggestedParentAsset: resolveSuggestedParentAsset(manuscriptResponse.body, assets),
    latestProofreadingDraftAsset: resolveLatestProofreadingDraftAsset(assets),
  };
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

  return assets.find((asset) => isSelectableParentAsset(asset)) ?? null;
}

function resolveLatestProofreadingDraftAsset(
  assets: readonly DocumentAssetViewModel[],
): DocumentAssetViewModel | null {
  return assets.find((asset) => asset.asset_type === "proofreading_draft_report") ?? null;
}

export function isSelectableParentAsset(asset: DocumentAssetViewModel): boolean {
  return (
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
