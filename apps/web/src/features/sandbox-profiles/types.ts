import type { AuthRole } from "../auth/roles.ts";

export type SandboxProfileStatus = "draft" | "active" | "archived";
export type SandboxMode = "read_only" | "workspace_write" | "full_access";

export interface SandboxProfileViewModel {
  id: string;
  name: string;
  status: SandboxProfileStatus;
  sandbox_mode: SandboxMode;
  network_access: boolean;
  approval_required: boolean;
  allowed_tool_ids?: string[];
  admin_only: true;
}

export interface CreateSandboxProfileInput {
  actorRole: AuthRole;
  name: string;
  sandboxMode: SandboxMode;
  networkAccess: boolean;
  approvalRequired: boolean;
  allowedToolIds?: string[];
}

export interface ActivateSandboxProfileInput {
  actorRole: AuthRole;
}

export interface ArchiveSandboxProfileInput {
  actorRole: AuthRole;
}
