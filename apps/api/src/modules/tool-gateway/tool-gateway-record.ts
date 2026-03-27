export type ToolGatewayAccessMode = "read" | "write";
export type ToolGatewayScope =
  | "manuscripts"
  | "assets"
  | "knowledge"
  | "templates"
  | "audit";

export interface ToolGatewayToolRecord {
  id: string;
  name: string;
  scope: ToolGatewayScope;
  access_mode: ToolGatewayAccessMode;
  admin_only: true;
}
