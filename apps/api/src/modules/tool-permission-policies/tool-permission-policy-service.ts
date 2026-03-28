import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { ToolGatewayRepository } from "../tool-gateway/tool-gateway-repository.ts";
import type { ToolPermissionPolicyRecord } from "./tool-permission-policy-record.ts";
import type { ToolPermissionPolicyRepository } from "./tool-permission-policy-repository.ts";

export interface CreateToolPermissionPolicyInput {
  name: string;
  defaultMode?: ToolPermissionPolicyRecord["default_mode"];
  allowedToolIds: string[];
  highRiskToolIds?: string[];
  writeRequiresConfirmation?: boolean;
}

export interface ToolPermissionPolicyServiceOptions {
  repository: ToolPermissionPolicyRepository;
  toolGatewayRepository: ToolGatewayRepository;
  permissionGuard?: PermissionGuard;
  createId?: () => string;
}

export class ToolPermissionPolicyNotFoundError extends Error {
  constructor(policyId: string) {
    super(`Tool permission policy ${policyId} was not found.`);
    this.name = "ToolPermissionPolicyNotFoundError";
  }
}

export class ToolPermissionPolicyUnknownToolError extends Error {
  constructor(toolId: string) {
    super(`Tool permission policy references unknown tool ${toolId}.`);
    this.name = "ToolPermissionPolicyUnknownToolError";
  }
}

export class ToolPermissionPolicyHighRiskAllowlistError extends Error {
  constructor(policyId: string, toolId: string) {
    super(
      `Tool permission policy ${policyId} cannot mark high-risk tool ${toolId} without adding it to the allowlist.`,
    );
    this.name = "ToolPermissionPolicyHighRiskAllowlistError";
  }
}

export class ToolPermissionPolicyService {
  private readonly repository: ToolPermissionPolicyRepository;
  private readonly toolGatewayRepository: ToolGatewayRepository;
  private readonly permissionGuard: PermissionGuard;
  private readonly createId: () => string;

  constructor(options: ToolPermissionPolicyServiceOptions) {
    this.repository = options.repository;
    this.toolGatewayRepository = options.toolGatewayRepository;
    this.permissionGuard = options.permissionGuard ?? new PermissionGuard();
    this.createId = options.createId ?? (() => randomUUID());
  }

  async createPolicy(
    actorRole: RoleKey,
    input: CreateToolPermissionPolicyInput,
  ): Promise<ToolPermissionPolicyRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const record: ToolPermissionPolicyRecord = {
      id: this.createId(),
      name: input.name,
      status: "draft",
      default_mode: input.defaultMode ?? "read",
      allowed_tool_ids: [...new Set(input.allowedToolIds)],
      high_risk_tool_ids: input.highRiskToolIds
        ? [...new Set(input.highRiskToolIds)]
        : undefined,
      write_requires_confirmation: input.writeRequiresConfirmation ?? true,
      admin_only: true,
    };

    await this.repository.save(record);
    return record;
  }

  listPolicies(): Promise<ToolPermissionPolicyRecord[]> {
    return this.repository.list();
  }

  async getPolicy(policyId: string): Promise<ToolPermissionPolicyRecord> {
    return this.requirePolicy(policyId);
  }

  async activatePolicy(
    policyId: string,
    actorRole: RoleKey,
  ): Promise<ToolPermissionPolicyRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const policy = await this.requirePolicy(policyId);
    if (policy.status === "active") {
      return policy;
    }

    await this.assertPolicyReferencesAreValid(policy);

    const policies = await this.repository.list();
    for (const existing of policies) {
      if (
        existing.id !== policy.id &&
        existing.name === policy.name &&
        existing.status === "active"
      ) {
        await this.repository.save({
          ...existing,
          status: "archived",
          allowed_tool_ids: [...existing.allowed_tool_ids],
          high_risk_tool_ids: existing.high_risk_tool_ids
            ? [...existing.high_risk_tool_ids]
            : undefined,
        });
      }
    }

    const activePolicy: ToolPermissionPolicyRecord = {
      ...policy,
      status: "active",
      allowed_tool_ids: [...policy.allowed_tool_ids],
      high_risk_tool_ids: policy.high_risk_tool_ids
        ? [...policy.high_risk_tool_ids]
        : undefined,
    };
    await this.repository.save(activePolicy);
    return activePolicy;
  }

  async archivePolicy(
    policyId: string,
    actorRole: RoleKey,
  ): Promise<ToolPermissionPolicyRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const policy = await this.requirePolicy(policyId);
    if (policy.status === "archived") {
      return policy;
    }

    const archived: ToolPermissionPolicyRecord = {
      ...policy,
      status: "archived",
      allowed_tool_ids: [...policy.allowed_tool_ids],
      high_risk_tool_ids: policy.high_risk_tool_ids
        ? [...policy.high_risk_tool_ids]
        : undefined,
    };
    await this.repository.save(archived);
    return archived;
  }

  private async assertPolicyReferencesAreValid(
    policy: ToolPermissionPolicyRecord,
  ): Promise<void> {
    const allowedToolIds = new Set(policy.allowed_tool_ids);
    for (const toolId of allowedToolIds) {
      const tool = await this.toolGatewayRepository.findById(toolId);
      if (!tool) {
        throw new ToolPermissionPolicyUnknownToolError(toolId);
      }
    }

    for (const toolId of policy.high_risk_tool_ids ?? []) {
      const tool = await this.toolGatewayRepository.findById(toolId);
      if (!tool) {
        throw new ToolPermissionPolicyUnknownToolError(toolId);
      }

      if (!allowedToolIds.has(toolId)) {
        throw new ToolPermissionPolicyHighRiskAllowlistError(policy.id, toolId);
      }
    }
  }

  private async requirePolicy(
    policyId: string,
  ): Promise<ToolPermissionPolicyRecord> {
    const record = await this.repository.findById(policyId);
    if (!record) {
      throw new ToolPermissionPolicyNotFoundError(policyId);
    }

    return record;
  }
}
