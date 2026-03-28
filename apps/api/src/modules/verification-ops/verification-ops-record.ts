import type { TemplateModule } from "../templates/template-record.ts";
import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";

export type VerificationCheckType =
  | "browser_qa"
  | "benchmark"
  | "deploy_verification";
export type RegistryAssetStatus = "draft" | "published" | "archived";
export type EvaluationSuiteStatus = "draft" | "active" | "archived";
export type EvaluationSuiteType = "regression" | "release_gate";
export type VerificationEvidenceKind = "url" | "artifact";
export type EvaluationRunStatus = "queued" | "running" | "passed" | "failed";
export type EvaluationSampleSetSourceKind = "reviewed_case_snapshot";

export interface EvaluationSampleSetSourcePolicyRecord {
  source_kind: EvaluationSampleSetSourceKind;
  requires_deidentification_pass: true;
  requires_human_final_asset: true;
}

export interface EvaluationSampleSetRecord {
  id: string;
  name: string;
  module: TemplateModule;
  manuscript_types: ManuscriptType[];
  risk_tags?: string[];
  sample_count: number;
  source_policy: EvaluationSampleSetSourcePolicyRecord;
  status: RegistryAssetStatus;
  admin_only: true;
}

export interface EvaluationSampleSetItemRecord {
  id: string;
  sample_set_id: string;
  manuscript_id: string;
  snapshot_asset_id: string;
  reviewed_case_snapshot_id: string;
  module: TemplateModule;
  manuscript_type: ManuscriptType;
  risk_tags?: string[];
}

export interface VerificationCheckProfileRecord {
  id: string;
  name: string;
  check_type: VerificationCheckType;
  status: RegistryAssetStatus;
  tool_ids?: string[];
  admin_only: true;
}

export interface ReleaseCheckProfileRecord {
  id: string;
  name: string;
  check_type: VerificationCheckType;
  status: RegistryAssetStatus;
  verification_check_profile_ids: string[];
  admin_only: true;
}

export interface EvaluationSuiteRecord {
  id: string;
  name: string;
  suite_type: EvaluationSuiteType;
  status: EvaluationSuiteStatus;
  verification_check_profile_ids: string[];
  module_scope: TemplateModule[] | "any";
  admin_only: true;
}

export interface VerificationEvidenceRecord {
  id: string;
  kind: VerificationEvidenceKind;
  label: string;
  uri?: string;
  artifact_asset_id?: string;
  check_profile_id?: string;
  created_at: string;
}

export interface EvaluationRunRecord {
  id: string;
  suite_id: string;
  release_check_profile_id?: string;
  status: EvaluationRunStatus;
  evidence_ids: string[];
  started_at: string;
  finished_at?: string;
}
