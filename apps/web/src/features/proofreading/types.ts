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
  confirmationDecisions?: ProofreadingConfirmationDecisionInput[];
}

export interface SaveProofreadingConfirmationDraftInput {
  manuscriptId: string;
  confirmationAssetId: string;
  requestedBy: string;
  actorRole: AuthRole;
  confirmationDecisions: ProofreadingConfirmationDecisionInput[];
}

export interface ProofreadingHumanFinalPublishResultViewModel {
  job: ModuleJobViewModel;
  asset: DocumentAssetViewModel;
}

export interface ProofreadingConfirmationDraftSaveResultViewModel {
  job: ModuleJobViewModel;
}

export type ProofreadingConfirmationDecisionAction =
  | "accepted"
  | "accepted_with_manual_edit"
  | "rejected"
  | "accept"
  | "accept_and_edit"
  | "reject"
  | "manual_only"
  | "escalated"
  | "route_to_rule_candidate"
  | "route_to_knowledge_candidate";

export interface ProofreadingConfirmationDecisionInput {
  itemId: string;
  targetText: string;
  replacementText: string;
  action: ProofreadingConfirmationDecisionAction;
  editedReplacementText?: string;
  note?: string;
}
