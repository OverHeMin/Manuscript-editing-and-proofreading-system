import type { AuthRole } from "../auth/roles.ts";

export type ToolGatewayAccessMode = "read" | "write";
export type ToolGatewayScope =
  | "manuscripts"
  | "assets"
  | "knowledge"
  | "templates"
  | "audit";

export interface ToolGatewayToolViewModel {
  id: string;
  name: string;
  scope: ToolGatewayScope;
  access_mode: ToolGatewayAccessMode;
  admin_only: true;
}

export interface CreateToolGatewayToolInput {
  actorRole: AuthRole;
  name: string;
  scope: ToolGatewayScope;
  accessMode?: ToolGatewayAccessMode;
}

export interface UpdateToolGatewayToolInput {
  actorRole: AuthRole;
  scope?: ToolGatewayScope;
  accessMode?: ToolGatewayAccessMode;
}
