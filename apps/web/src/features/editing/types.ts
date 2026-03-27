import type { AuthRole } from "../auth/roles.ts";
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
}
