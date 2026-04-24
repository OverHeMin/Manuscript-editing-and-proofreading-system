import type { AuthRole } from "../auth/roles.ts";
import type {
  EditingCompletionGateSummary,
  EditingSlotGovernanceSummary,
  EditingSlotManualResolutionKind,
  ModuleExecutionMode,
} from "@medical/contracts";
import type {
  DocumentAssetViewModel,
  ModuleJobViewModel,
} from "../screening/types.ts";

export interface EditingRunResultViewModel {
  job: ModuleJobViewModel;
  asset: DocumentAssetViewModel;
  template_id: string;
  knowledge_item_ids: string[];
  model_id: string;
}

export interface RunEditingInput {
  manuscriptId: string;
  parentAssetId: string;
  requestedBy: string;
  actorRole: AuthRole;
  storageKey: string;
  fileName?: string;
  executionMode?: ModuleExecutionMode;
}

export interface SaveEditingSlotManualResolutionInput {
  manuscriptId: string;
  slotKey: string;
  resolutionKind: EditingSlotManualResolutionKind;
  resolvedText?: string;
  selectedCandidateId?: string;
  note?: string;
}

export interface SaveEditingSlotManualResolutionResultViewModel {
  manuscript_id: string;
  summary: EditingSlotGovernanceSummary;
  completion_gate_summary?: EditingCompletionGateSummary;
}
