import type {
  ModelRoutingPolicyDecisionRecord,
  ModelRoutingPolicyEvidenceLinkRecord,
  ModelRoutingPolicyRecord,
  ModelRoutingPolicyScopeKind,
  ModelRoutingPolicyScopeRecord,
  ModelRoutingPolicyVersionRecord,
} from "./model-routing-governance-record.ts";
import type { ModelRoutingGovernanceRepository } from "./model-routing-governance-repository.ts";

function cloneEvidenceLinks(
  evidenceLinks: ModelRoutingPolicyEvidenceLinkRecord[],
): ModelRoutingPolicyEvidenceLinkRecord[] {
  return evidenceLinks.map((link) => ({ ...link }));
}

function cloneScopeRecord(
  record: ModelRoutingPolicyScopeRecord,
): ModelRoutingPolicyScopeRecord {
  return {
    ...record,
  };
}

function cloneVersionRecord(
  record: ModelRoutingPolicyVersionRecord,
): ModelRoutingPolicyVersionRecord {
  return {
    ...record,
    fallback_model_ids: [...record.fallback_model_ids],
    evidence_links: cloneEvidenceLinks(record.evidence_links),
  };
}

function cloneDecisionRecord(
  record: ModelRoutingPolicyDecisionRecord,
): ModelRoutingPolicyDecisionRecord {
  return {
    ...record,
    evidence_links: cloneEvidenceLinks(record.evidence_links),
  };
}

function comparePolicies(
  left: ModelRoutingPolicyRecord,
  right: ModelRoutingPolicyRecord,
): number {
  if (left.scope_kind !== right.scope_kind) {
    return left.scope_kind.localeCompare(right.scope_kind);
  }

  if (left.scope_value !== right.scope_value) {
    return left.scope_value.localeCompare(right.scope_value);
  }

  return left.policy_id.localeCompare(right.policy_id);
}

function compareVersions(
  left: ModelRoutingPolicyVersionRecord,
  right: ModelRoutingPolicyVersionRecord,
): number {
  if (left.version_no !== right.version_no) {
    return left.version_no - right.version_no;
  }

  return left.id.localeCompare(right.id);
}

function compareDecisions(
  left: ModelRoutingPolicyDecisionRecord,
  right: ModelRoutingPolicyDecisionRecord,
): number {
  if (left.created_at !== right.created_at) {
    return left.created_at.localeCompare(right.created_at);
  }

  return left.id.localeCompare(right.id);
}

export class InMemoryModelRoutingGovernanceRepository
  implements ModelRoutingGovernanceRepository
{
  private readonly scopes = new Map<string, ModelRoutingPolicyScopeRecord>();
  private readonly versions = new Map<string, ModelRoutingPolicyVersionRecord>();
  private readonly decisions = new Map<string, ModelRoutingPolicyDecisionRecord>();

  async saveScope(record: ModelRoutingPolicyScopeRecord): Promise<void> {
    this.scopes.set(record.id, cloneScopeRecord(record));
  }

  async findScopeById(
    id: string,
  ): Promise<ModelRoutingPolicyScopeRecord | undefined> {
    const record = this.scopes.get(id);
    return record ? cloneScopeRecord(record) : undefined;
  }

  async findPolicyById(
    policyId: string,
  ): Promise<ModelRoutingPolicyRecord | undefined> {
    const scope = this.scopes.get(policyId);
    return scope ? this.composePolicy(scope) : undefined;
  }

  async findPolicyByScope(
    scopeKind: ModelRoutingPolicyScopeKind,
    scopeValue: string,
  ): Promise<ModelRoutingPolicyRecord | undefined> {
    for (const scope of this.scopes.values()) {
      if (
        scope.scope_kind === scopeKind &&
        scope.scope_value === scopeValue
      ) {
        return this.composePolicy(scope);
      }
    }

    return undefined;
  }

  async listPolicies(): Promise<ModelRoutingPolicyRecord[]> {
    return [...this.scopes.values()]
      .map((scope) => this.composePolicy(scope))
      .sort(comparePolicies);
  }

  async saveVersion(record: ModelRoutingPolicyVersionRecord): Promise<void> {
    this.versions.set(record.id, cloneVersionRecord(record));
  }

  async findVersionById(
    id: string,
  ): Promise<ModelRoutingPolicyVersionRecord | undefined> {
    const record = this.versions.get(id);
    return record ? cloneVersionRecord(record) : undefined;
  }

  async saveDecision(record: ModelRoutingPolicyDecisionRecord): Promise<void> {
    this.decisions.set(record.id, cloneDecisionRecord(record));
  }

  private composePolicy(scope: ModelRoutingPolicyScopeRecord): ModelRoutingPolicyRecord {
    const versions = [...this.versions.values()]
      .filter((record) => record.policy_scope_id === scope.id)
      .sort(compareVersions)
      .map(cloneVersionRecord);
    const decisions = [...this.decisions.values()]
      .filter((record) => record.policy_scope_id === scope.id)
      .sort(compareDecisions)
      .map(cloneDecisionRecord);

    return {
      policy_id: scope.id,
      scope_kind: scope.scope_kind,
      scope_value: scope.scope_value,
      ...(scope.active_version_id
        ? {
            active_version: versions.find(
              (record) => record.id === scope.active_version_id,
            ),
          }
        : {}),
      versions,
      decisions,
    };
  }
}
