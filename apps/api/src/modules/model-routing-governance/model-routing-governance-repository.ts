import type {
  ModelRoutingPolicyDecisionRecord,
  ModelRoutingPolicyRecord,
  ModelRoutingPolicyScopeKind,
  ModelRoutingPolicyScopeRecord,
  ModelRoutingPolicyVersionRecord,
} from "./model-routing-governance-record.ts";

export interface ModelRoutingGovernanceRepository {
  saveScope(record: ModelRoutingPolicyScopeRecord): Promise<void>;
  findScopeById(id: string): Promise<ModelRoutingPolicyScopeRecord | undefined>;
  findPolicyById(policyId: string): Promise<ModelRoutingPolicyRecord | undefined>;
  findPolicyByScope(
    scopeKind: ModelRoutingPolicyScopeKind,
    scopeValue: string,
  ): Promise<ModelRoutingPolicyRecord | undefined>;
  listPolicies(): Promise<ModelRoutingPolicyRecord[]>;
  saveVersion(record: ModelRoutingPolicyVersionRecord): Promise<void>;
  findVersionById(id: string): Promise<ModelRoutingPolicyVersionRecord | undefined>;
  saveDecision(record: ModelRoutingPolicyDecisionRecord): Promise<void>;
}
