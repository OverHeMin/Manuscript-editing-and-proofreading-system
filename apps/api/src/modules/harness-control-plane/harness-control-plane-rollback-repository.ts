import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { TemplateModule } from "../templates/template-record.ts";

export interface HarnessEnvironmentRollbackScopeInput {
  module: TemplateModule;
  manuscriptType: ManuscriptType;
  templateFamilyId: string;
}

export interface HarnessEnvironmentRollbackSnapshotRecord {
  execution_profile_id: string;
  runtime_binding_id: string;
  model_routing_policy_version_id: string;
  retrieval_preset_id?: string;
  manual_review_policy_id?: string;
}

export interface HarnessEnvironmentRollbackEntryRecord {
  id: string;
  scope: HarnessEnvironmentRollbackScopeInput;
  snapshot: HarnessEnvironmentRollbackSnapshotRecord;
  created_at: string;
}

export interface HarnessControlPlaneRollbackRepository {
  appendSnapshot(input: {
    scope: HarnessEnvironmentRollbackScopeInput;
    snapshot: HarnessEnvironmentRollbackSnapshotRecord;
  }): Promise<HarnessEnvironmentRollbackEntryRecord>;
  getLatestSnapshot(
    scope: HarnessEnvironmentRollbackScopeInput,
  ): Promise<HarnessEnvironmentRollbackEntryRecord | undefined>;
  deleteSnapshot(snapshotId: string): Promise<void>;
}
