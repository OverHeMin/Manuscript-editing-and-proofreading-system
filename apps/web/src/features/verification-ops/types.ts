import type { AuthRole } from "../auth/roles.ts";
import type { TemplateModule } from "../templates/types.ts";

export type VerificationCheckType =
  | "browser_qa"
  | "benchmark"
  | "deploy_verification";
export type VerificationRegistryStatus = "draft" | "published" | "archived";
export type EvaluationSuiteStatus = "draft" | "active" | "archived";
export type EvaluationSuiteType = "regression" | "release_gate";
export type VerificationEvidenceKind = "url" | "artifact";
export type EvaluationRunStatus = "queued" | "running" | "passed" | "failed";

export interface VerificationCheckProfileViewModel {
  id: string;
  name: string;
  check_type: VerificationCheckType;
  status: VerificationRegistryStatus;
  tool_ids?: string[];
  admin_only: true;
}

export interface ReleaseCheckProfileViewModel {
  id: string;
  name: string;
  check_type: VerificationCheckType;
  status: VerificationRegistryStatus;
  verification_check_profile_ids: string[];
  admin_only: true;
}

export interface EvaluationSuiteViewModel {
  id: string;
  name: string;
  suite_type: EvaluationSuiteType;
  status: EvaluationSuiteStatus;
  verification_check_profile_ids: string[];
  module_scope: TemplateModule[] | "any";
  admin_only: true;
}

export interface VerificationEvidenceViewModel {
  id: string;
  kind: VerificationEvidenceKind;
  label: string;
  uri?: string;
  artifact_asset_id?: string;
  check_profile_id?: string;
  created_at: string;
}

export interface EvaluationRunViewModel {
  id: string;
  suite_id: string;
  release_check_profile_id?: string;
  status: EvaluationRunStatus;
  evidence_ids: string[];
  started_at: string;
  finished_at?: string;
}

export interface CreateVerificationCheckProfileInput {
  actorRole: AuthRole;
  name: string;
  checkType: VerificationCheckType;
  toolIds?: string[];
}

export interface PublishVerificationCheckProfileInput {
  actorRole: AuthRole;
}

export interface CreateReleaseCheckProfileInput {
  actorRole: AuthRole;
  name: string;
  checkType: VerificationCheckType;
  verificationCheckProfileIds: string[];
}

export interface PublishReleaseCheckProfileInput {
  actorRole: AuthRole;
}

export interface CreateEvaluationSuiteInput {
  actorRole: AuthRole;
  name: string;
  suiteType: EvaluationSuiteType;
  verificationCheckProfileIds: string[];
  moduleScope: TemplateModule[] | "any";
}

export interface ActivateEvaluationSuiteInput {
  actorRole: AuthRole;
}

export interface RecordVerificationEvidenceInput {
  actorRole: AuthRole;
  kind: VerificationEvidenceKind;
  label: string;
  uri?: string;
  artifactAssetId?: string;
  checkProfileId?: string;
}

export interface CreateEvaluationRunInput {
  actorRole: AuthRole;
  suiteId: string;
  releaseCheckProfileId?: string;
}

export interface CompleteEvaluationRunInput {
  actorRole: AuthRole;
  runId: string;
  status: Extract<EvaluationRunStatus, "passed" | "failed">;
  evidenceIds: string[];
}
