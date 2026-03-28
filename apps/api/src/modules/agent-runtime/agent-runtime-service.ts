import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { TemplateModule } from "../templates/template-record.ts";
import type { AgentRuntimeRecord } from "./agent-runtime-record.ts";
import type { AgentRuntimeRepository } from "./agent-runtime-repository.ts";

export interface CreateAgentRuntimeInput {
  name: string;
  adapter: AgentRuntimeRecord["adapter"];
  sandboxProfileId?: string;
  allowedModules: TemplateModule[];
  runtimeSlot?: string;
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
      runtime_slot: input.runtimeSlot,
      admin_only: true,
    };

    await this.repository.save(record);
    return record;
  }

  listRuntimes(): Promise<AgentRuntimeRecord[]> {
    return this.repository.list();
  }

  listRuntimesByModule(
    module: TemplateModule,
    activeOnly = false,
  ): Promise<AgentRuntimeRecord[]> {
    return this.repository.listByModule(module, activeOnly);
  }

  async getRuntime(runtimeId: string): Promise<AgentRuntimeRecord> {
    return this.requireRuntime(runtimeId);
  }

  async publishRuntime(
    runtimeId: string,
    actorRole: RoleKey,
  ): Promise<AgentRuntimeRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const existing = await this.requireRuntime(runtimeId);
    if (existing.status === "active") {
      return existing;
    }

    const runtimes = await this.repository.list();
    for (const runtime of runtimes) {
      if (
        runtime.id !== existing.id &&
        runtime.status === "active" &&
        shareActivationScope(runtime, existing)
      ) {
        await this.repository.save({
          ...runtime,
          status: "archived",
          allowed_modules: [...runtime.allowed_modules],
        });
      }
    }

    const published: AgentRuntimeRecord = {
      ...existing,
      status: "active",
      allowed_modules: [...existing.allowed_modules],
    };
    await this.repository.save(published);
    return published;
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
      runtime_slot: existing.runtime_slot,
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

function shareActivationScope(
  left: AgentRuntimeRecord,
  right: AgentRuntimeRecord,
): boolean {
  const leftScope = left.runtime_slot ? `slot:${left.runtime_slot}` : `adapter:${left.adapter}`;
  const rightScope =
    right.runtime_slot ? `slot:${right.runtime_slot}` : `adapter:${right.adapter}`;

  return leftScope === rightScope;
}
