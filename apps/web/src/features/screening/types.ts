import type { AuthRole } from "../auth/roles.ts";

export interface ModuleJobViewModel {
  id: string;
  module: string;
  job_type: string;
  status: string;
  requested_by: string;
  payload?: Record<string, unknown>;
  attempt_count: number;
  started_at?: string;
  finished_at?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentAssetViewModel {
  id: string;
  manuscript_id: string;
  asset_type: string;
  status: string;
  storage_key: string;
  mime_type: string;
  parent_asset_id?: string;
  source_module: string;
  source_job_id?: string;
  created_by: string;
  version_no: number;
  is_current: boolean;
  file_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ScreeningRunResultViewModel {
  job: ModuleJobViewModel;
  asset: DocumentAssetViewModel;
  template_id: string;
  knowledge_item_ids: string[];
  model_id: string;
}

export interface RunScreeningInput {
  manuscriptId: string;
  parentAssetId: string;
  requestedBy: string;
  actorRole: AuthRole;
  storageKey: string;
  fileName?: string;
}
