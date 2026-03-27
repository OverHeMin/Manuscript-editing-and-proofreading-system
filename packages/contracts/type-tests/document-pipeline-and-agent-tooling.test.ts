import type {
  DocumentPreviewSession,
  DocumentStructureSnapshot,
  AgentRuntime,
  ToolGatewayTool,
  SkillPackage,
} from "../src/index.js";

export const previewStatusCheck: DocumentPreviewSession["status"] = "ready";
export const structureSectionCheck: DocumentStructureSnapshot["sections"][number]["heading"] =
  "Methods";
export const runtimeStatusCheck: AgentRuntime["status"] = "active";
export const gatewayToolKindCheck: ToolGatewayTool["access_mode"] = "read";
export const skillScopeCheck: SkillPackage["scope"] = "admin_only";
