import type { ToolGatewayAccessMode } from "../tool-gateway/tool-gateway-record.ts";

export type ToolPermissionPolicyStatus = "draft" | "active" | "archived";

export interface ToolPermissionPolicyRecord {
  id: string;
  name: string;
  status: ToolPermissionPolicyStatus;
  default_mode: ToolGatewayAccessMode;
  allowed_tool_ids: string[];
  high_risk_tool_ids?: string[];
  write_requires_confirmation: boolean;
  admin_only: true;
}
