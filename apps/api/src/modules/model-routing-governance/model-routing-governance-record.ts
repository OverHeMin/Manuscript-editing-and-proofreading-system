import type { RoleKey } from "../../users/roles.ts";

export type ModelRoutingPolicyScopeKind = "module" | "template_family";
export type SystemSettingsModuleKey = "screening" | "editing" | "proofreading";
export type ModelRoutingPolicyVersionStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "active"
  | "rejected"
  | "rolled_back"
  | "superseded";
export type ModelRoutingPolicyDecisionKind =
  | "create_draft"
  | "update_draft"
  | "submit_for_review"
  | "approve"
  | "reject"
  | "activate"
  | "rollback"
  | "supersede";
export type ModelRoutingPolicyEvidenceLinkKind =
  | "evaluation_suite"
  | "evaluation_run"
  | "evidence_pack"
  | "recommendation_summary";

export interface ModelRoutingPolicyEvidenceLinkRecord {
  kind: ModelRoutingPolicyEvidenceLinkKind;
  id: string;
}

export interface ModelRoutingPolicyScopeRecord {
  id: string;
  scope_kind: ModelRoutingPolicyScopeKind;
  scope_value: string;
  active_version_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ModelRoutingPolicyVersionRecord {
  id: string;
  policy_scope_id: string;
  scope_kind: ModelRoutingPolicyScopeKind;
  scope_value: string;
  version_no: number;
  primary_model_id: string;
  fallback_model_ids: string[];
  temperature?: number | null;
  evidence_links: ModelRoutingPolicyEvidenceLinkRecord[];
  notes?: string;
  status: ModelRoutingPolicyVersionStatus;
  created_at: string;
  updated_at: string;
}

export interface ModelRoutingPolicyDecisionRecord {
  id: string;
  policy_scope_id: string;
  policy_version_id: string;
  decision_kind: ModelRoutingPolicyDecisionKind;
  actor_id?: string;
  actor_role?: RoleKey;
  reason?: string;
  evidence_links: ModelRoutingPolicyEvidenceLinkRecord[];
  created_at: string;
}

export interface ModelRoutingPolicyRecord {
  policy_id: string;
  scope_kind: ModelRoutingPolicyScopeKind;
  scope_value: string;
  active_version?: ModelRoutingPolicyVersionRecord;
  versions: ModelRoutingPolicyVersionRecord[];
  decisions: ModelRoutingPolicyDecisionRecord[];
}

export interface ModelRoutingPolicyVersionEnvelope {
  policy_id: string;
  scope: ModelRoutingPolicyScopeRecord;
  version: ModelRoutingPolicyVersionRecord;
}

export interface SystemSettingsModuleDefaultRecord {
  module_key: SystemSettingsModuleKey;
  primary_model_id?: string;
  primary_model_name?: string;
  fallback_model_id?: string;
  fallback_model_name?: string;
  temperature?: number | null;
}
