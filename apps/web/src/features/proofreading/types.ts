import type { AuthRole } from "../auth/roles.ts";
import type { ModuleExecutionMode } from "@medical/contracts";
import type {
  DocumentAssetViewModel,
  ModuleJobViewModel,
} from "../screening/types.ts";

export interface ProofreadingRunResultViewModel {
  job: ModuleJobViewModel;
  asset: DocumentAssetViewModel;
  template_id: string;
  knowledge_item_ids: string[];
  model_id: string;
}

export interface CreateProofreadingDraftInput {
  manuscriptId: string;
  parentAssetId: string;
  requestedBy: string;
  actorRole: AuthRole;
  storageKey: string;
  fileName?: string;
  executionMode?: ModuleExecutionMode;
}

export interface ConfirmProofreadingFinalInput {
  manuscriptId: string;
  draftAssetId: string;
  requestedBy: string;
  actorRole: AuthRole;
  storageKey: string;
  fileName?: string;
}

export interface PublishProofreadingHumanFinalInput {
  manuscriptId: string;
  finalAssetId: string;
  requestedBy: string;
  actorRole: AuthRole;
  storageKey: string;
  fileName?: string;
}

export interface ProofreadingHumanFinalPublishResultViewModel {
  job: ModuleJobViewModel;
  asset: DocumentAssetViewModel;
}
