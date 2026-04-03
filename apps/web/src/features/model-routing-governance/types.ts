import type { AuthRole } from "../auth/roles.ts";

export type ModelRoutingPolicyScopeKind = "module" | "template_family";
export type ModelRoutingPolicyVersionStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "active"
  | "rejected"
  | "rolled_back"
  | "superseded";
export type ModelRoutingPolicyEvidenceLinkKind =
  | "evaluation_suite"
  | "evaluation_run"
  | "evidence_pack"
  | "recommendation_summary";

export interface ModelRoutingPolicyEvidenceLinkViewModel {
  kind: ModelRoutingPolicyEvidenceLinkKind;
  id: string;
}

export interface ModelRoutingPolicyScopeViewModel {
  id: string;
  scope_kind: ModelRoutingPolicyScopeKind;
  scope_value: string;
  active_version_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ModelRoutingPolicyVersionViewModel {
  id: string;
  policy_scope_id: string;
  scope_kind: ModelRoutingPolicyScopeKind;
  scope_value: string;
  version_no: number;
  primary_model_id: string;
  fallback_model_ids: string[];
  evidence_links: ModelRoutingPolicyEvidenceLinkViewModel[];
  notes?: string;
  status: ModelRoutingPolicyVersionStatus;
  created_at: string;
  updated_at: string;
}

export interface ModelRoutingPolicyDecisionViewModel {
  id: string;
  policy_scope_id: string;
  policy_version_id: string;
  decision_kind: string;
  actor_id?: string;
  actor_role?: AuthRole;
  reason?: string;
  evidence_links: ModelRoutingPolicyEvidenceLinkViewModel[];
  created_at: string;
}

export interface ModelRoutingPolicyViewModel {
  policy_id: string;
  scope_kind: ModelRoutingPolicyScopeKind;
  scope_value: string;
  active_version?: ModelRoutingPolicyVersionViewModel;
  versions: ModelRoutingPolicyVersionViewModel[];
  decisions: ModelRoutingPolicyDecisionViewModel[];
}

export interface ModelRoutingPolicyVersionEnvelopeViewModel {
  policy_id: string;
  scope: ModelRoutingPolicyScopeViewModel;
  version: ModelRoutingPolicyVersionViewModel;
}

export interface CreateModelRoutingPolicyInput {
  actorRole: AuthRole;
  scopeKind: ModelRoutingPolicyScopeKind;
  scopeValue: string;
  primaryModelId: string;
  fallbackModelIds: string[];
  evidenceLinks: ModelRoutingPolicyEvidenceLinkViewModel[];
  notes?: string;
}

export interface CreateModelRoutingPolicyDraftVersionInput {
  actorRole: AuthRole;
  policyId: string;
  input: {
    primaryModelId: string;
    fallbackModelIds: string[];
    evidenceLinks: ModelRoutingPolicyEvidenceLinkViewModel[];
    notes?: string;
  };
}

export interface SaveModelRoutingPolicyDraftInput {
  actorRole: AuthRole;
  versionId: string;
  input: {
    primaryModelId?: string;
    fallbackModelIds?: string[];
    evidenceLinks?: ModelRoutingPolicyEvidenceLinkViewModel[];
    notes?: string;
  };
}

export interface ModelRoutingPolicyDecisionInput {
  actorRole: AuthRole;
  actorId?: string;
  reason?: string;
}

export interface RollbackModelRoutingPolicyInput extends ModelRoutingPolicyDecisionInput {
  policyId: string;
}

export function formatRoutingPolicyScopeKindLabel(
  scopeKind: ModelRoutingPolicyScopeKind,
): string {
  switch (scopeKind) {
    case "template_family":
      return "Template Family Policy";
    case "module":
      return "Module Policy";
  }
}

