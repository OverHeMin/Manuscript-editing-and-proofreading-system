import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { AgentRuntimeRecord } from "./agent-runtime-record.ts";
import type { AgentRuntimeRepository } from "./agent-runtime-repository.ts";

export interface CreateAgentRuntimeInput {
  name: string;
  adapter: AgentRuntimeRecord["adapter"];
  sandboxProfileId?: string;
  allowedModules: string[];
}

export interface AgentRuntimeServiceOptions {
  repository: AgentRuntimeRepository;
  permissionGuard?: PermissionGuard;
  createId?: () => string;
}

export class AgentRuntimeNotFoundError extends Error {
  constructor(runtimeId: string) {
    super(`Agent runtime ${runtimeId} was not found.`);
    this.name = "AgentRuntimeNotFoundError";
  }
}

export class AgentRuntimeService {
  private readonly repository: AgentRuntimeRepository;
  private readonly permissionGuard: PermissionGuard;
  private readonly createId: () => string;

  constructor(options: AgentRuntimeServiceOptions) {
    this.repository = options.repository;
    this.permissionGuard = options.permissionGuard ?? new PermissionGuard();
    this.createId = options.createId ?? (() => randomUUID());
  }

  async createRuntime(
    actorRole: RoleKey,
    input: CreateAgentRuntimeInput,
  ): Promise<AgentRuntimeRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const record: AgentRuntimeRecord = {
      id: this.createId(),
      name: input.name,
      adapter: input.adapter,
      status: "draft",
      sandbox_profile_id: input.sandboxProfileId,
      allowed_modules: [...input.allowedModules],
      admin_only: true,
    };

    await this.repository.save(record);
    return record;
  }

  listRuntimes(): Promise<AgentRuntimeRecord[]> {
    return this.repository.list();
  }

  async getRuntime(runtimeId: string): Promise<AgentRuntimeRecord> {
    return this.requireRuntime(runtimeId);
  }

  async archiveRuntime(
    runtimeId: string,
    actorRole: RoleKey,
  ): Promise<AgentRuntimeRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const existing = await this.requireRuntime(runtimeId);
    const archived: AgentRuntimeRecord = {
      ...existing,
      status: "archived",
      allowed_modules: [...existing.allowed_modules],
    };

    await this.repository.save(archived);
    return archived;
  }

  private async requireRuntime(runtimeId: string): Promise<AgentRuntimeRecord> {
    const record = await this.repository.findById(runtimeId);

    if (!record) {
      throw new AgentRuntimeNotFoundError(runtimeId);
    }

    return record;
  }
}
