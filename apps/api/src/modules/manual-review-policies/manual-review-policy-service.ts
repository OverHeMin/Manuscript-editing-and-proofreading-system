import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { TemplateModule } from "../templates/template-record.ts";
import type { ManualReviewPolicyRecord } from "./manual-review-policy-record.ts";
import type { ManualReviewPolicyRepository } from "./manual-review-policy-repository.ts";

export interface CreateManualReviewPolicyInput {
  module: TemplateModule;
  manuscriptType: ManuscriptType;
  templateFamilyId: string;
  name: string;
  minConfidenceThreshold: number;
  highRiskForceReview: boolean;
  conflictForceReview: boolean;
  insufficientKnowledgeForceReview: boolean;
  moduleBlocklistRules?: string[];
}

export interface ManualReviewPolicyScopeInput {
  module: TemplateModule;
  manuscriptType: ManuscriptType;
  templateFamilyId: string;
}

export interface ManualReviewPolicyServiceOptions {
  repository: ManualReviewPolicyRepository;
  permissionGuard?: PermissionGuard;
  createId?: () => string;
}

export class ManualReviewPolicyNotFoundError extends Error {
  constructor(policyId: string) {
    super(`Manual review policy ${policyId} was not found.`);
    this.name = "ManualReviewPolicyNotFoundError";
  }
}

export class ManualReviewPolicyStatusTransitionError extends Error {
  constructor(policyId: string, fromStatus: string, toStatus: string) {
    super(
      `Manual review policy ${policyId} cannot transition from ${fromStatus} to ${toStatus}.`,
    );
    this.name = "ManualReviewPolicyStatusTransitionError";
  }
}

export class ActiveManualReviewPolicyNotFoundError extends Error {
  constructor(module: string, manuscriptType: string, templateFamilyId: string) {
    super(
      `No active manual review policy exists for ${module}/${manuscriptType}/${templateFamilyId}.`,
    );
    this.name = "ActiveManualReviewPolicyNotFoundError";
  }
}

export class ManualReviewPolicyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManualReviewPolicyValidationError";
  }
}

export class ManualReviewPolicyService {
  private readonly repository: ManualReviewPolicyRepository;
  private readonly permissionGuard: PermissionGuard;
  private readonly createId: () => string;

  constructor(options: ManualReviewPolicyServiceOptions) {
    this.repository = options.repository;
    this.permissionGuard = options.permissionGuard ?? new PermissionGuard();
    this.createId = options.createId ?? (() => randomUUID());
  }

  async createPolicy(
    actorRole: RoleKey,
    input: CreateManualReviewPolicyInput,
  ): Promise<ManualReviewPolicyRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const record = await this.buildDraftRecord(input);
    this.assertValidRecord(record);
    await this.repository.save(record);
    return record;
  }

  async activatePolicy(
    policyId: string,
    actorRole: RoleKey,
  ): Promise<ManualReviewPolicyRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const policy = await this.requirePolicy(policyId);
    if (policy.status === "active") {
      this.assertValidRecord(policy);
      return policy;
    }
    if (policy.status !== "draft" && policy.status !== "archived") {
      throw new ManualReviewPolicyStatusTransitionError(
        policyId,
        policy.status,
        "active",
      );
    }

    this.assertValidRecord(policy);

    const activePolicies = await this.repository.listByScope(
      policy.module,
      policy.manuscript_type,
      policy.template_family_id,
      true,
    );
    for (const existing of activePolicies) {
      if (existing.id !== policy.id) {
        await this.repository.save({
          ...existing,
          status: "archived",
        });
      }
    }

    const activePolicy: ManualReviewPolicyRecord = {
      ...policy,
      status: "active",
    };
    await this.repository.save(activePolicy);
    return activePolicy;
  }

  async archivePolicy(
    policyId: string,
    actorRole: RoleKey,
  ): Promise<ManualReviewPolicyRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const policy = await this.requirePolicy(policyId);
    if (policy.status === "archived") {
      return policy;
    }

    const archivedPolicy: ManualReviewPolicyRecord = {
      ...policy,
      status: "archived",
    };
    await this.repository.save(archivedPolicy);
    return archivedPolicy;
  }

  async getPolicy(policyId: string): Promise<ManualReviewPolicyRecord> {
    return this.requirePolicy(policyId);
  }

  listPoliciesForScope(
    input: ManualReviewPolicyScopeInput & { activeOnly?: boolean },
  ): Promise<ManualReviewPolicyRecord[]> {
    return this.repository.listByScope(
      input.module,
      input.manuscriptType,
      input.templateFamilyId,
      input.activeOnly,
    );
  }

  async getActivePolicyForScope(
    input: ManualReviewPolicyScopeInput,
  ): Promise<ManualReviewPolicyRecord> {
    const match = (
      await this.repository.listByScope(
        input.module,
        input.manuscriptType,
        input.templateFamilyId,
        true,
      )
    )
      .sort((left, right) => right.version - left.version)[0];

    if (!match) {
      throw new ActiveManualReviewPolicyNotFoundError(
        input.module,
        input.manuscriptType,
        input.templateFamilyId,
      );
    }

    return match;
  }

  private async buildDraftRecord(
    input: CreateManualReviewPolicyInput,
  ): Promise<ManualReviewPolicyRecord> {
    const version = await this.repository.reserveNextVersion(
      input.module,
      input.manuscriptType,
      input.templateFamilyId,
    );

    const blocklistRules = normalizeStringArray(input.moduleBlocklistRules);

    return {
      id: this.createId(),
      module: input.module,
      manuscript_type: input.manuscriptType,
      template_family_id: input.templateFamilyId,
      name: input.name.trim(),
      min_confidence_threshold: input.minConfidenceThreshold,
      high_risk_force_review: input.highRiskForceReview,
      conflict_force_review: input.conflictForceReview,
      insufficient_knowledge_force_review: input.insufficientKnowledgeForceReview,
      ...(blocklistRules.length > 0
        ? { module_blocklist_rules: blocklistRules }
        : {}),
      status: "draft",
      version,
    };
  }

  private assertValidRecord(record: ManualReviewPolicyRecord): void {
    if (record.name.length === 0) {
      throw new ManualReviewPolicyValidationError(
        "Manual review policy name is required.",
      );
    }
    if (
      record.min_confidence_threshold < 0 ||
      record.min_confidence_threshold > 1
    ) {
      throw new ManualReviewPolicyValidationError(
        "Manual review policy min_confidence_threshold must be between 0 and 1.",
      );
    }
  }

  private async requirePolicy(
    policyId: string,
  ): Promise<ManualReviewPolicyRecord> {
    const policy = await this.repository.findById(policyId);
    if (!policy) {
      throw new ManualReviewPolicyNotFoundError(policyId);
    }

    return policy;
  }
}

function normalizeStringArray(values?: string[]): string[] {
  if (!values) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (normalized.length === 0 || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}
