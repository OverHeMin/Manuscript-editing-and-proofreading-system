import type { AuthRole } from "../auth/roles.ts";
import type { ToolGatewayAccessMode } from "../tool-gateway/types.ts";

export type ToolPermissionPolicyStatus = "draft" | "active" | "archived";

export interface ToolPermissionPolicyViewModel {
  id: string;
  name: string;
  status: ToolPermissionPolicyStatus;
  default_mode: ToolGatewayAccessMode;
  allowed_tool_ids: string[];
  high_risk_tool_ids?: string[];
  write_requires_confirmation: boolean;
  admin_only: true;
}

export interface CreateToolPermissionPolicyInput {
  actorRole: AuthRole;
  name: string;
  defaultMode?: ToolGatewayAccessMode;
  allowedToolIds: string[];
  highRiskToolIds?: string[];
  writeRequiresConfirmation?: boolean;
}

export interface ActivateToolPermissionPolicyInput {
  actorRole: AuthRole;
}

export interface ArchiveToolPermissionPolicyInput {
  actorRole: AuthRole;
}
