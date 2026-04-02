import {
  getManuscript,
  listManuscriptAssets,
  type ManuscriptHttpClient,
} from "../manuscripts/manuscript-api.ts";
import type { DocumentAssetViewModel, ManuscriptViewModel } from "../manuscripts/types.ts";
import type { AuthRole } from "../auth/roles.ts";
import type {
  CreateGovernedLearningCandidateInput,
  CreateReviewedCaseSnapshotInput,
} from "./types.ts";

export interface LoadLearningReviewPrefillInput {
  manuscriptId: string;
  actorRole: AuthRole;
}

export interface LearningReviewPrefillResult {
  status: string;
  snapshotForm: CreateReviewedCaseSnapshotInput;
  candidateForm: CreateGovernedLearningCandidateInput;
}

export async function loadLearningReviewPrefill(
  client: ManuscriptHttpClient,
  input: LoadLearningReviewPrefillInput,
): Promise<LearningReviewPrefillResult> {
  const [manuscriptResponse, assetsResponse] = await Promise.all([
    getManuscript(client, input.manuscriptId),
    listManuscriptAssets(client, input.manuscriptId),
  ]);
  const manuscript = manuscriptResponse.body;
  const assets = sortAssetsForResolution(assetsResponse.body);
  const humanFinalAsset = resolveHumanFinalAsset(manuscript, assets);
  const annotatedAsset = resolveAnnotatedAsset(humanFinalAsset, assets);
  const requestedBy = input.actorRole === "admin" ? "admin-1" : "reviewer-1";

  return {
    status: `Prefilled learning review for manuscript ${manuscript.id}`,
    snapshotForm: {
      manuscriptId: manuscript.id,
      module: "proofreading",
      manuscriptType: manuscript.manuscript_type,
      humanFinalAssetId: humanFinalAsset.id,
      annotatedAssetId: annotatedAsset?.id,
      deidentificationPassed: true,
      requestedBy,
      storageKey: `learning/${manuscript.id}/reviewed-case-snapshot.bin`,
    },
    candidateForm: {
      snapshotId: "",
      type: "rule_candidate",
      title: "Terminology normalization candidate",
      proposalText: "Normalize endpoint terminology and statistics wording.",
      requestedBy,
      deidentificationPassed: true,
      governedSource: {
        sourceKind: "evaluation_experiment",
        reviewedCaseSnapshotId: "",
        evaluationRunId: `eval-${manuscript.id}`,
        evidencePackId: `evidence-${manuscript.id}`,
        sourceAssetId: humanFinalAsset.id,
      },
    },
  };
}

function resolveHumanFinalAsset(
  manuscript: ManuscriptViewModel,
  assets: readonly DocumentAssetViewModel[],
): DocumentAssetViewModel {
  const currentAssetId = manuscript.current_proofreading_asset_id;
  if (currentAssetId) {
    const currentAsset = assets.find((asset) => asset.id === currentAssetId);
    if (currentAsset?.asset_type === "human_final_docx") {
      return currentAsset;
    }
  }

  const humanFinalAsset = assets.find((asset) => asset.asset_type === "human_final_docx");
  if (!humanFinalAsset) {
    throw new Error(
      `Manuscript ${manuscript.id} does not have a human-final asset available for learning review.`,
    );
  }

  return humanFinalAsset;
}

function resolveAnnotatedAsset(
  humanFinalAsset: DocumentAssetViewModel,
  assets: readonly DocumentAssetViewModel[],
): DocumentAssetViewModel | undefined {
  if (humanFinalAsset.parent_asset_id) {
    const parentAsset = assets.find((asset) => asset.id === humanFinalAsset.parent_asset_id);
    if (parentAsset?.asset_type === "final_proof_annotated_docx") {
      return parentAsset;
    }
  }

  return assets.find((asset) => asset.asset_type === "final_proof_annotated_docx");
}

function sortAssetsForResolution(
  assets: readonly DocumentAssetViewModel[],
): DocumentAssetViewModel[] {
  return [...assets].sort((left, right) => {
    if (left.is_current !== right.is_current) {
      return left.is_current ? -1 : 1;
    }

    if (left.created_at !== right.created_at) {
      return right.created_at.localeCompare(left.created_at);
    }

    if (left.version_no !== right.version_no) {
      return right.version_no - left.version_no;
    }

    return right.id.localeCompare(left.id);
  });
}
