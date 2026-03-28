import type { TemplateModule } from "../templates/template-record.ts";

export type VerificationCheckType =
  | "browser_qa"
  | "benchmark"
  | "deploy_verification";
export type RegistryAssetStatus = "draft" | "published" | "archived";
export type EvaluationSuiteStatus = "draft" | "active" | "archived";
export type EvaluationSuiteType = "regression" | "release_gate";
export type VerificationEvidenceKind = "url" | "artifact";
export type EvaluationRunStatus = "queued" | "running" | "passed" | "failed";

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
