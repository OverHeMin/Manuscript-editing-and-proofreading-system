export type SandboxProfileStatus = "draft" | "active" | "archived";
export type SandboxMode = "read_only" | "workspace_write" | "full_access";

export interface SandboxProfileRecord {
  id: string;
  name: string;
  status: SandboxProfileStatus;
  sandbox_mode: SandboxMode;
  network_access: boolean;
  approval_required: boolean;
  allowed_tool_ids?: string[];
  admin_only: true;
}
