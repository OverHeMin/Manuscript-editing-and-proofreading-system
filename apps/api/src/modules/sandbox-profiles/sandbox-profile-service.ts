import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { SandboxProfileRecord } from "./sandbox-profile-record.ts";
import type { SandboxProfileRepository } from "./sandbox-profile-repository.ts";

export interface CreateSandboxProfileInput {
  name: string;
  sandboxMode: SandboxProfileRecord["sandbox_mode"];
  networkAccess: boolean;
  approvalRequired: boolean;
  allowedToolIds?: string[];
}

export interface SandboxProfileServiceOptions {
  repository: SandboxProfileRepository;
  permissionGuard?: PermissionGuard;
  createId?: () => string;
}

export class SandboxProfileNotFoundError extends Error {
  constructor(profileId: string) {
    super(`Sandbox profile ${profileId} was not found.`);
    this.name = "SandboxProfileNotFoundError";
  }
}

export class SandboxProfileService {
  private readonly repository: SandboxProfileRepository;
  private readonly permissionGuard: PermissionGuard;
  private readonly createId: () => string;

  constructor(options: SandboxProfileServiceOptions) {
    this.repository = options.repository;
    this.permissionGuard = options.permissionGuard ?? new PermissionGuard();
    this.createId = options.createId ?? (() => randomUUID());
  }

  async createProfile(
    actorRole: RoleKey,
    input: CreateSandboxProfileInput,
  ): Promise<SandboxProfileRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const record: SandboxProfileRecord = {
      id: this.createId(),
      name: input.name,
      status: "draft",
      sandbox_mode: input.sandboxMode,
      network_access: input.networkAccess,
      approval_required: input.approvalRequired,
      allowed_tool_ids: input.allowedToolIds
        ? [...new Set(input.allowedToolIds)]
        : undefined,
      admin_only: true,
    };

    await this.repository.save(record);
    return record;
  }

  listProfiles(): Promise<SandboxProfileRecord[]> {
    return this.repository.list();
  }

  async getProfile(profileId: string): Promise<SandboxProfileRecord> {
    return this.requireProfile(profileId);
  }

  async activateProfile(
    profileId: string,
    actorRole: RoleKey,
  ): Promise<SandboxProfileRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const profile = await this.requireProfile(profileId);
    if (profile.status === "active") {
      return profile;
    }

    const profiles = await this.repository.list();
    for (const existing of profiles) {
      if (
        existing.id !== profile.id &&
        existing.name === profile.name &&
        existing.status === "active"
      ) {
        await this.repository.save({
          ...existing,
          status: "archived",
          allowed_tool_ids: existing.allowed_tool_ids
            ? [...existing.allowed_tool_ids]
            : undefined,
        });
      }
    }

    const activeProfile: SandboxProfileRecord = {
      ...profile,
      status: "active",
      allowed_tool_ids: profile.allowed_tool_ids
        ? [...profile.allowed_tool_ids]
        : undefined,
    };
    await this.repository.save(activeProfile);
    return activeProfile;
  }

  async archiveProfile(
    profileId: string,
    actorRole: RoleKey,
  ): Promise<SandboxProfileRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const profile = await this.requireProfile(profileId);
    if (profile.status === "archived") {
      return profile;
    }

    const archived: SandboxProfileRecord = {
      ...profile,
      status: "archived",
      allowed_tool_ids: profile.allowed_tool_ids
        ? [...profile.allowed_tool_ids]
        : undefined,
    };
    await this.repository.save(archived);
    return archived;
  }

  private async requireProfile(
    profileId: string,
  ): Promise<SandboxProfileRecord> {
    const record = await this.repository.findById(profileId);
    if (!record) {
      throw new SandboxProfileNotFoundError(profileId);
    }

    return record;
  }
}
