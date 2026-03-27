import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { ToolGatewayToolRecord } from "./tool-gateway-record.ts";
import type { ToolGatewayRepository } from "./tool-gateway-repository.ts";

export interface CreateToolGatewayToolInput {
  name: string;
  scope: ToolGatewayToolRecord["scope"];
  accessMode?: ToolGatewayToolRecord["access_mode"];
}

export interface UpdateToolGatewayToolInput {
  scope?: ToolGatewayToolRecord["scope"];
  accessMode?: ToolGatewayToolRecord["access_mode"];
}

export interface ToolGatewayServiceOptions {
  repository: ToolGatewayRepository;
  permissionGuard?: PermissionGuard;
  createId?: () => string;
}

export class ToolGatewayToolNotFoundError extends Error {
  constructor(toolId: string) {
    super(`Tool gateway entry ${toolId} was not found.`);
    this.name = "ToolGatewayToolNotFoundError";
  }
}

export class ToolGatewayService {
  private readonly repository: ToolGatewayRepository;
  private readonly permissionGuard: PermissionGuard;
  private readonly createId: () => string;

  constructor(options: ToolGatewayServiceOptions) {
    this.repository = options.repository;
    this.permissionGuard = options.permissionGuard ?? new PermissionGuard();
    this.createId = options.createId ?? (() => randomUUID());
  }

  async createTool(
    actorRole: RoleKey,
    input: CreateToolGatewayToolInput,
  ): Promise<ToolGatewayToolRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const record: ToolGatewayToolRecord = {
      id: this.createId(),
      name: input.name,
      scope: input.scope,
      access_mode: input.accessMode ?? "read",
      admin_only: true,
    };

    await this.repository.save(record);
    return record;
  }

  listTools(): Promise<ToolGatewayToolRecord[]> {
    return this.repository.list();
  }

  async getTool(toolId: string): Promise<ToolGatewayToolRecord> {
    return this.requireTool(toolId);
  }

  async updateTool(
    toolId: string,
    actorRole: RoleKey,
    input: UpdateToolGatewayToolInput,
  ): Promise<ToolGatewayToolRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const existing = await this.requireTool(toolId);
    const updated: ToolGatewayToolRecord = {
      ...existing,
      scope: input.scope ?? existing.scope,
      access_mode: input.accessMode ?? existing.access_mode,
    };

    await this.repository.save(updated);
    return updated;
  }

  private async requireTool(toolId: string): Promise<ToolGatewayToolRecord> {
    const record = await this.repository.findById(toolId);

    if (!record) {
      throw new ToolGatewayToolNotFoundError(toolId);
    }

    return record;
  }
}
