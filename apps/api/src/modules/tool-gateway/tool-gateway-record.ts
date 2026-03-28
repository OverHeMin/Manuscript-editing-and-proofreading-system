export type ToolGatewayAccessMode = "read" | "write";
export type ToolGatewayScope =
  | "manuscripts"
  | "assets"
  | "knowledge"
  | "templates"
  | "audit"
  | "browser_qa"
  | "benchmark"
  | "deploy_verification";

export interface ToolGatewayToolRecord {
  id: string;
  name: string;
  scope: ToolGatewayScope;
  access_mode: ToolGatewayAccessMode;
  admin_only: true;
}
