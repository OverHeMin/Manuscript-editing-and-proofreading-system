import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { AgentProfileRecord } from "./agent-profile-record.ts";
import type { AgentProfileRepository } from "./agent-profile-repository.ts";

export interface CreateAgentProfileInput {
  name: string;
  roleKey: AgentProfileRecord["role_key"];
  moduleScope: AgentProfileRecord["module_scope"];
  manuscriptTypes: AgentProfileRecord["manuscript_types"];
  description?: string;
}

export interface AgentProfileServiceOptions {
  repository: AgentProfileRepository;
  permissionGuard?: PermissionGuard;
  createId?: () => string;
}

export class AgentProfileNotFoundError extends Error {
  constructor(profileId: string) {
    super(`Agent profile ${profileId} was not found.`);
    this.name = "AgentProfileNotFoundError";
  }
}

export class AgentProfileService {
  private readonly repository: AgentProfileRepository;
  private readonly permissionGuard: PermissionGuard;
  private readonly createId: () => string;

  constructor(options: AgentProfileServiceOptions) {
    this.repository = options.repository;
    this.permissionGuard = options.permissionGuard ?? new PermissionGuard();
    this.createId = options.createId ?? (() => randomUUID());
  }

  async createProfile(
    actorRole: RoleKey,
    input: CreateAgentProfileInput,
  ): Promise<AgentProfileRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const record: AgentProfileRecord = {
      id: this.createId(),
      name: input.name,
      role_key: input.roleKey,
      status: "draft",
      module_scope:
        input.moduleScope === "any" ? "any" : [...input.moduleScope],
      manuscript_types:
        input.manuscriptTypes === "any" ? "any" : [...input.manuscriptTypes],
      description: input.description,
      admin_only: true,
    };

    await this.repository.save(record);
    return record;
  }

  listProfiles(): Promise<AgentProfileRecord[]> {
    return this.repository.list();
  }

  async getProfile(profileId: string): Promise<AgentProfileRecord> {
    return this.requireProfile(profileId);
  }

  async publishProfile(
    profileId: string,
    actorRole: RoleKey,
  ): Promise<AgentProfileRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const profile = await this.requireProfile(profileId);
    if (profile.status === "published") {
      return profile;
    }

    const profiles = await this.repository.list();
    for (const existing of profiles) {
      if (
        existing.id !== profile.id &&
        existing.name === profile.name &&
        existing.role_key === profile.role_key &&
        existing.status === "published"
      ) {
        await this.repository.save({
          ...existing,
          status: "archived",
          module_scope:
            existing.module_scope === "any" ? "any" : [...existing.module_scope],
          manuscript_types:
            existing.manuscript_types === "any"
              ? "any"
              : [...existing.manuscript_types],
        });
      }
    }

    const published: AgentProfileRecord = {
      ...profile,
      status: "published",
      module_scope:
        profile.module_scope === "any" ? "any" : [...profile.module_scope],
      manuscript_types:
        profile.manuscript_types === "any"
          ? "any"
          : [...profile.manuscript_types],
    };
    await this.repository.save(published);
    return published;
  }

  async archiveProfile(
    profileId: string,
    actorRole: RoleKey,
  ): Promise<AgentProfileRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const profile = await this.requireProfile(profileId);
    if (profile.status === "archived") {
      return profile;
    }

    const archived: AgentProfileRecord = {
      ...profile,
      status: "archived",
      module_scope:
        profile.module_scope === "any" ? "any" : [...profile.module_scope],
      manuscript_types:
        profile.manuscript_types === "any"
          ? "any"
          : [...profile.manuscript_types],
    };
    await this.repository.save(archived);
    return archived;
  }

  private async requireProfile(profileId: string): Promise<AgentProfileRecord> {
    const record = await this.repository.findById(profileId);
    if (!record) {
      throw new AgentProfileNotFoundError(profileId);
    }

    return record;
  }
}
