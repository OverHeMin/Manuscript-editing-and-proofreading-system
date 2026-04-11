import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { ModelRegistryRepository } from "../model-registry/model-registry-repository.ts";
import type {
  ModelRoutingPolicyDecisionKind,
  ModelRoutingPolicyDecisionRecord,
  ModelRoutingPolicyEvidenceLinkRecord,
  ModelRoutingPolicyRecord,
  ModelRoutingPolicyScopeKind,
  ModelRoutingPolicyScopeRecord,
  ModelRoutingPolicyVersionEnvelope,
  ModelRoutingPolicyVersionRecord,
} from "./model-routing-governance-record.ts";
import type { ModelRoutingGovernanceRepository } from "./model-routing-governance-repository.ts";

export interface CreateModelRoutingPolicyInput {
  scopeKind: ModelRoutingPolicyScopeKind;
  scopeValue: string;
  primaryModelId: string;
  fallbackModelIds: string[];
  evidenceLinks: ModelRoutingPolicyEvidenceLinkRecord[];
  notes?: string;
}

export interface UpdateDraftModelRoutingPolicyVersionInput {
  primaryModelId?: string;
  fallbackModelIds?: string[];
  evidenceLinks?: ModelRoutingPolicyEvidenceLinkRecord[];
  notes?: string;
}

export interface ModelRoutingPolicyDecisionInput {
  actorId?: string;
  reason?: string;
  evidenceLinks?: ModelRoutingPolicyEvidenceLinkRecord[];
}

export interface ModelRoutingGovernanceServiceOptions {
  repository: ModelRoutingGovernanceRepository;
  modelRegistryRepository: ModelRegistryRepository;
  permissionGuard?: PermissionGuard;
  createId?: () => string;
  now?: () => Date;
}

export class ModelRoutingPolicyNotFoundError extends Error {
  constructor(policyId: string) {
    super(`Model routing policy ${policyId} was not found.`);
    this.name = "ModelRoutingPolicyNotFoundError";
  }
}

export class ModelRoutingPolicyVersionNotFoundError extends Error {
  constructor(versionId: string) {
    super(`Model routing policy version ${versionId} was not found.`);
    this.name = "ModelRoutingPolicyVersionNotFoundError";
  }
}

export class ModelRoutingPolicyScopeConflictError extends Error {
  constructor(scopeKind: string, scopeValue: string) {
    super(`Model routing policy scope ${scopeKind}/${scopeValue} already exists.`);
    this.name = "ModelRoutingPolicyScopeConflictError";
  }
}

export class ModelRoutingGovernanceDraftNotEditableError extends Error {
  constructor(versionId: string, status: string) {
    super(
      `Model routing policy version ${versionId} is ${status} and can no longer be edited as a draft.`,
    );
    this.name = "ModelRoutingGovernanceDraftNotEditableError";
  }
}

export class ModelRoutingGovernanceStatusTransitionError extends Error {
  constructor(versionId: string, fromStatus: string, toStatus: string) {
    super(
      `Model routing policy version ${versionId} cannot transition from ${fromStatus} to ${toStatus}.`,
    );
    this.name = "ModelRoutingGovernanceStatusTransitionError";
  }
}

export class ModelRoutingGovernanceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelRoutingGovernanceValidationError";
  }
}

export class ModelRoutingGovernanceService {
  private readonly repository: ModelRoutingGovernanceRepository;
  private readonly modelRegistryRepository: ModelRegistryRepository;
  private readonly permissionGuard: PermissionGuard;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: ModelRoutingGovernanceServiceOptions) {
    this.repository = options.repository;
    this.modelRegistryRepository = options.modelRegistryRepository;
    this.permissionGuard = options.permissionGuard ?? new PermissionGuard();
    this.createId = options.createId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  async createPolicy(
    actorRole: RoleKey,
    input: CreateModelRoutingPolicyInput,
  ): Promise<ModelRoutingPolicyVersionEnvelope> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const normalizedScope = normalizeScope(input.scopeKind, input.scopeValue);
    const existing = await this.repository.findPolicyByScope(
      normalizedScope.scope_kind,
      normalizedScope.scope_value,
    );

    if (existing) {
      throw new ModelRoutingPolicyScopeConflictError(
        normalizedScope.scope_kind,
        normalizedScope.scope_value,
      );
    }

    const normalizedModels = await this.validateModelSelection({
      scopeKind: normalizedScope.scope_kind,
      scopeValue: normalizedScope.scope_value,
      primaryModelId: input.primaryModelId,
      fallbackModelIds: input.fallbackModelIds,
    });
    const timestamp = this.now().toISOString();
    const scope: ModelRoutingPolicyScopeRecord = {
      id: this.createId(),
      scope_kind: normalizedScope.scope_kind,
      scope_value: normalizedScope.scope_value,
      created_at: timestamp,
      updated_at: timestamp,
    };
    const version: ModelRoutingPolicyVersionRecord = {
      id: this.createId(),
      policy_scope_id: scope.id,
      scope_kind: scope.scope_kind,
      scope_value: scope.scope_value,
      version_no: 1,
      primary_model_id: normalizedModels.primaryModelId,
      fallback_model_ids: normalizedModels.fallbackModelIds,
      evidence_links: cloneEvidenceLinks(input.evidenceLinks),
      ...(input.notes ? { notes: input.notes } : {}),
      status: "draft",
      created_at: timestamp,
      updated_at: timestamp,
    };

    await this.repository.saveScope(scope);
    await this.repository.saveVersion(version);
    await this.repository.saveDecision(
      this.createDecision({
        policyScopeId: scope.id,
        policyVersionId: version.id,
        decisionKind: "create_draft",
        actorRole,
        reason: input.notes,
        evidenceLinks: version.evidence_links,
      }),
    );

    return {
      policy_id: scope.id,
      scope,
      version,
    };
  }

  listPolicies(): Promise<ModelRoutingPolicyRecord[]> {
    return this.repository.listPolicies();
  }

  async updateDraftVersion(
    versionId: string,
    actorRole: RoleKey,
    input: UpdateDraftModelRoutingPolicyVersionInput,
  ): Promise<ModelRoutingPolicyVersionEnvelope> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const version = await this.requireVersion(versionId);
    if (version.status !== "draft") {
      throw new ModelRoutingGovernanceDraftNotEditableError(
        versionId,
        version.status,
      );
    }

    const normalizedModels = await this.validateModelSelection({
      scopeKind: version.scope_kind,
      scopeValue: version.scope_value,
      primaryModelId: input.primaryModelId ?? version.primary_model_id,
      fallbackModelIds: input.fallbackModelIds ?? version.fallback_model_ids,
    });
    const updatedVersion: ModelRoutingPolicyVersionRecord = {
      ...version,
      primary_model_id: normalizedModels.primaryModelId,
      fallback_model_ids: normalizedModels.fallbackModelIds,
      evidence_links:
        input.evidenceLinks === undefined
          ? cloneEvidenceLinks(version.evidence_links)
          : cloneEvidenceLinks(input.evidenceLinks),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      updated_at: this.now().toISOString(),
    };

    await this.repository.saveVersion(updatedVersion);
    await this.repository.saveDecision(
      this.createDecision({
        policyScopeId: updatedVersion.policy_scope_id,
        policyVersionId: updatedVersion.id,
        decisionKind: "update_draft",
        actorRole,
        reason: updatedVersion.notes,
        evidenceLinks: updatedVersion.evidence_links,
      }),
    );

    return {
      policy_id: updatedVersion.policy_scope_id,
      scope: await this.requireScope(updatedVersion.policy_scope_id),
      version: updatedVersion,
    };
  }

  async createDraftVersion(
    policyId: string,
    actorRole: RoleKey,
    input: Omit<CreateModelRoutingPolicyInput, "scopeKind" | "scopeValue">,
  ): Promise<ModelRoutingPolicyVersionEnvelope> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const policy = await this.requirePolicy(policyId);
    const normalizedModels = await this.validateModelSelection({
      scopeKind: policy.scope_kind,
      scopeValue: policy.scope_value,
      primaryModelId: input.primaryModelId,
      fallbackModelIds: input.fallbackModelIds,
    });
    const timestamp = this.now().toISOString();
    const version: ModelRoutingPolicyVersionRecord = {
      id: this.createId(),
      policy_scope_id: policy.policy_id,
      scope_kind: policy.scope_kind,
      scope_value: policy.scope_value,
      version_no:
        policy.versions.reduce(
          (highestVersion, record) => Math.max(highestVersion, record.version_no),
          0,
        ) + 1,
      primary_model_id: normalizedModels.primaryModelId,
      fallback_model_ids: normalizedModels.fallbackModelIds,
      evidence_links: cloneEvidenceLinks(input.evidenceLinks),
      ...(input.notes ? { notes: input.notes } : {}),
      status: "draft",
      created_at: timestamp,
      updated_at: timestamp,
    };

    await this.repository.saveVersion(version);
    await this.repository.saveDecision(
      this.createDecision({
        policyScopeId: version.policy_scope_id,
        policyVersionId: version.id,
        decisionKind: "create_draft",
        actorRole,
        reason: input.notes,
        evidenceLinks: version.evidence_links,
      }),
    );

    return {
      policy_id: version.policy_scope_id,
      scope: await this.requireScope(version.policy_scope_id),
      version,
    };
  }

  submitVersion(
    versionId: string,
    actorRole: RoleKey,
    input: ModelRoutingPolicyDecisionInput = {},
  ): Promise<ModelRoutingPolicyVersionEnvelope> {
    return this.transitionVersion(versionId, actorRole, {
      from: "draft",
      to: "pending_review",
      decisionKind: "submit_for_review",
      actorId: input.actorId,
      reason: input.reason,
    });
  }

  approveVersion(
    versionId: string,
    actorRole: RoleKey,
    input: ModelRoutingPolicyDecisionInput = {},
  ): Promise<ModelRoutingPolicyVersionEnvelope> {
    return this.transitionVersion(versionId, actorRole, {
      from: "pending_review",
      to: "approved",
      decisionKind: "approve",
      actorId: input.actorId,
      reason: input.reason,
      requireEvidence: true,
    });
  }

  rejectVersion(
    versionId: string,
    actorRole: RoleKey,
    input: ModelRoutingPolicyDecisionInput = {},
  ): Promise<ModelRoutingPolicyVersionEnvelope> {
    return this.transitionVersion(versionId, actorRole, {
      from: "pending_review",
      to: "rejected",
      decisionKind: "reject",
      actorId: input.actorId,
      reason: input.reason,
    });
  }

  async activateVersion(
    versionId: string,
    actorRole: RoleKey,
    input: ModelRoutingPolicyDecisionInput = {},
  ): Promise<ModelRoutingPolicyVersionEnvelope> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const version = await this.requireVersion(versionId);
    if (version.status === "active") {
      return {
        policy_id: version.policy_scope_id,
        scope: await this.requireScope(version.policy_scope_id),
        version,
      };
    }

    if (
      version.status !== "approved" &&
      version.status !== "superseded" &&
      version.status !== "rolled_back"
    ) {
      throw new ModelRoutingGovernanceStatusTransitionError(
        versionId,
        version.status,
        "active",
      );
    }

    this.assertEvidenceLinksPresent(version);

    const scope = await this.requireScope(version.policy_scope_id);
    if (scope.active_version_id && scope.active_version_id !== version.id) {
      const activeVersion = await this.requireVersion(scope.active_version_id);
      const supersededVersion: ModelRoutingPolicyVersionRecord = {
        ...activeVersion,
        status: "superseded",
        updated_at: this.now().toISOString(),
      };

      await this.repository.saveVersion(supersededVersion);
      await this.repository.saveDecision(
        this.createDecision({
          policyScopeId: supersededVersion.policy_scope_id,
          policyVersionId: supersededVersion.id,
          decisionKind: "supersede",
          actorRole,
          actorId: input.actorId,
          reason: input.reason,
          evidenceLinks: supersededVersion.evidence_links,
        }),
      );
    }

    const activeVersion: ModelRoutingPolicyVersionRecord = {
      ...version,
      status: "active",
      updated_at: this.now().toISOString(),
    };
    const updatedScope: ModelRoutingPolicyScopeRecord = {
      ...scope,
      active_version_id: activeVersion.id,
      updated_at: this.now().toISOString(),
    };

    await this.repository.saveVersion(activeVersion);
    await this.repository.saveScope(updatedScope);
    await this.repository.saveDecision(
      this.createDecision({
        policyScopeId: activeVersion.policy_scope_id,
        policyVersionId: activeVersion.id,
        decisionKind: "activate",
        actorRole,
        actorId: input.actorId,
        reason: input.reason,
        evidenceLinks: activeVersion.evidence_links,
      }),
    );

    return {
      policy_id: activeVersion.policy_scope_id,
      scope: updatedScope,
      version: activeVersion,
    };
  }

  async rollbackPolicy(
    policyId: string,
    actorRole: RoleKey,
    input: ModelRoutingPolicyDecisionInput = {},
  ): Promise<ModelRoutingPolicyVersionEnvelope> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const policy = await this.requirePolicy(policyId);
    if (!policy.active_version) {
      throw new ModelRoutingGovernanceValidationError(
        `Model routing policy ${policyId} has no active version to roll back.`,
      );
    }

    const rolledBackVersion: ModelRoutingPolicyVersionRecord = {
      ...policy.active_version,
      status: "rolled_back",
      updated_at: this.now().toISOString(),
    };
    const scope = await this.requireScope(policyId);
    const updatedScope: ModelRoutingPolicyScopeRecord = {
      ...scope,
      active_version_id: undefined,
      updated_at: this.now().toISOString(),
    };

    await this.repository.saveVersion(rolledBackVersion);
    await this.repository.saveScope(updatedScope);
    await this.repository.saveDecision(
      this.createDecision({
        policyScopeId: rolledBackVersion.policy_scope_id,
        policyVersionId: rolledBackVersion.id,
        decisionKind: "rollback",
        actorRole,
        actorId: input.actorId,
        reason: input.reason,
        evidenceLinks: rolledBackVersion.evidence_links,
      }),
    );

    return {
      policy_id: rolledBackVersion.policy_scope_id,
      scope: updatedScope,
      version: rolledBackVersion,
    };
  }

  async findActivePolicy(
    scopeKind: ModelRoutingPolicyScopeKind,
    scopeValue: string,
  ): Promise<ModelRoutingPolicyRecord | undefined> {
    const normalizedScope = normalizeScope(scopeKind, scopeValue);
    const policy = await this.repository.findPolicyByScope(
      normalizedScope.scope_kind,
      normalizedScope.scope_value,
    );

    return policy?.active_version ? policy : undefined;
  }

  private async transitionVersion(
    versionId: string,
    actorRole: RoleKey,
    input: {
      from: ModelRoutingPolicyVersionRecord["status"];
      to: ModelRoutingPolicyVersionRecord["status"];
      decisionKind: ModelRoutingPolicyDecisionKind;
      actorId?: string;
      reason?: string;
      requireEvidence?: boolean;
    },
  ): Promise<ModelRoutingPolicyVersionEnvelope> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const version = await this.requireVersion(versionId);
    if (version.status !== input.from) {
      throw new ModelRoutingGovernanceStatusTransitionError(
        versionId,
        version.status,
        input.to,
      );
    }

    if (input.requireEvidence) {
      this.assertEvidenceLinksPresent(version);
    }

    const updatedVersion: ModelRoutingPolicyVersionRecord = {
      ...version,
      status: input.to,
      updated_at: this.now().toISOString(),
    };

    await this.repository.saveVersion(updatedVersion);
    await this.repository.saveDecision(
      this.createDecision({
        policyScopeId: updatedVersion.policy_scope_id,
        policyVersionId: updatedVersion.id,
        decisionKind: input.decisionKind,
        actorRole,
        actorId: input.actorId,
        reason: input.reason,
        evidenceLinks: updatedVersion.evidence_links,
      }),
    );

    return {
      policy_id: updatedVersion.policy_scope_id,
      scope: await this.requireScope(updatedVersion.policy_scope_id),
      version: updatedVersion,
    };
  }

  private async validateModelSelection(input: {
    scopeKind: ModelRoutingPolicyScopeKind;
    scopeValue: string;
    primaryModelId: string;
    fallbackModelIds: string[];
  }): Promise<{ primaryModelId: string; fallbackModelIds: string[] }> {
    const primaryModel = await this.requireModel(
      input.primaryModelId,
      "primaryModelId",
    );
    this.assertProductionModel(primaryModel.id, primaryModel.is_prod_allowed);
    this.assertScopeCompatibility({
      scopeKind: input.scopeKind,
      scopeValue: input.scopeValue,
      modelId: primaryModel.id,
      allowedModules: primaryModel.allowed_modules,
      referenceField: "primaryModelId",
    });

    const fallbackModelIds = [...new Set(input.fallbackModelIds)];
    for (const fallbackModelId of fallbackModelIds) {
      const fallbackModel = await this.requireModel(
        fallbackModelId,
        "fallbackModelIds",
      );
      this.assertProductionModel(fallbackModel.id, fallbackModel.is_prod_allowed);
      this.assertScopeCompatibility({
        scopeKind: input.scopeKind,
        scopeValue: input.scopeValue,
        modelId: fallbackModel.id,
        allowedModules: fallbackModel.allowed_modules,
        referenceField: "fallbackModelIds",
      });
    }

    return {
      primaryModelId: primaryModel.id,
      fallbackModelIds,
    };
  }

  private async requireModel(modelId: string, referenceField: string) {
    const model = await this.modelRegistryRepository.findById(modelId);
    if (!model) {
      throw new ModelRoutingGovernanceValidationError(
        `${referenceField} references missing model ${modelId}.`,
      );
    }

    return model;
  }

  private assertProductionModel(modelId: string, isProdAllowed: boolean) {
    if (!isProdAllowed) {
      throw new ModelRoutingGovernanceValidationError(
        `Model ${modelId} must be production-approved before it can be routed.`,
      );
    }
  }

  private assertScopeCompatibility(input: {
    scopeKind: ModelRoutingPolicyScopeKind;
    scopeValue: string;
    modelId: string;
    allowedModules: string[];
    referenceField: string;
  }) {
    if (input.scopeKind !== "module") {
      return;
    }

    if (
      !ROUTABLE_MODULES.includes(
        input.scopeValue as (typeof ROUTABLE_MODULES)[number],
      )
    ) {
      throw new ModelRoutingGovernanceValidationError(
        `Module scope ${input.scopeValue} is not routeable in Phase 10B.`,
      );
    }

    if (!input.allowedModules.includes(input.scopeValue)) {
      throw new ModelRoutingGovernanceValidationError(
        `${input.referenceField} model ${input.modelId} must support module ${input.scopeValue}.`,
      );
    }
  }

  private assertEvidenceLinksPresent(version: ModelRoutingPolicyVersionRecord) {
    if (version.evidence_links.length === 0) {
      throw new ModelRoutingGovernanceValidationError(
        `Model routing policy version ${version.id} requires evidence links before approval or activation.`,
      );
    }
  }

  private async requirePolicy(policyId: string): Promise<ModelRoutingPolicyRecord> {
    const policy = await this.repository.findPolicyById(policyId);
    if (!policy) {
      throw new ModelRoutingPolicyNotFoundError(policyId);
    }

    return policy;
  }

  private async requireScope(policyId: string): Promise<ModelRoutingPolicyScopeRecord> {
    const scope = await this.repository.findScopeById(policyId);
    if (!scope) {
      throw new ModelRoutingPolicyNotFoundError(policyId);
    }

    return scope;
  }

  private async requireVersion(
    versionId: string,
  ): Promise<ModelRoutingPolicyVersionRecord> {
    const version = await this.repository.findVersionById(versionId);
    if (!version) {
      throw new ModelRoutingPolicyVersionNotFoundError(versionId);
    }

    return version;
  }

  private createDecision(input: {
    policyScopeId: string;
    policyVersionId: string;
    decisionKind: ModelRoutingPolicyDecisionKind;
    actorRole: RoleKey;
    actorId?: string;
    reason?: string;
    evidenceLinks: ModelRoutingPolicyEvidenceLinkRecord[];
  }): ModelRoutingPolicyDecisionRecord {
    return {
      id: this.createId(),
      policy_scope_id: input.policyScopeId,
      policy_version_id: input.policyVersionId,
      decision_kind: input.decisionKind,
      ...(input.actorId ? { actor_id: input.actorId } : {}),
      actor_role: input.actorRole,
      ...(input.reason ? { reason: input.reason } : {}),
      evidence_links: cloneEvidenceLinks(input.evidenceLinks),
      created_at: this.now().toISOString(),
    };
  }
}

function normalizeScope(
  scopeKind: ModelRoutingPolicyScopeKind,
  scopeValue: string,
): { scope_kind: ModelRoutingPolicyScopeKind; scope_value: string } {
  const normalizedValue = scopeValue.trim();
  if (!normalizedValue) {
    throw new ModelRoutingGovernanceValidationError(
      "Model routing policy scope value is required.",
    );
  }

  if (
    scopeKind === "module" &&
    !ROUTABLE_MODULES.includes(normalizedValue as (typeof ROUTABLE_MODULES)[number])
  ) {
    throw new ModelRoutingGovernanceValidationError(
      `Module scope ${normalizedValue} is not routeable in Phase 10B.`,
    );
  }

  return {
    scope_kind: scopeKind,
    scope_value: normalizedValue,
  };
}

function cloneEvidenceLinks(
  evidenceLinks: ModelRoutingPolicyEvidenceLinkRecord[],
): ModelRoutingPolicyEvidenceLinkRecord[] {
  return evidenceLinks.map((link) => ({ ...link }));
}

const ROUTABLE_MODULES = ["screening", "editing", "proofreading"] as const;
