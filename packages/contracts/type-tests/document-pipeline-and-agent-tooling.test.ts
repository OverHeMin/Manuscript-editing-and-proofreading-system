import type {
  DocumentPreviewSession,
  DocumentStructureSnapshot,
  AgentRuntime,
  ToolGatewayTool,
  SkillPackage,
} from "../src/index.js";

export const previewStatusCheck: DocumentPreviewSession["status"] = "ready";
export const previewModeCheck: DocumentPreviewSession["mode"] = "edit";
export const previewSourceAssetTypeCheck: DocumentPreviewSession["source_asset_type"] =
  "edited_docx";
export const previewSaveBackCheck: DocumentPreviewSession["save_back"] = {
  module: "editing",
  baseline_asset_id: "asset-edited-1",
  output_asset_type: "edited_docx",
  callback_token: "header.payload.signature",
};
export const structureSectionCheck: DocumentStructureSnapshot["sections"][number]["heading"] =
  "Methods";
export const runtimeStatusCheck: AgentRuntime["status"] = "active";
export const gatewayToolKindCheck: ToolGatewayTool["access_mode"] = "read";
export const skillScopeCheck: SkillPackage["scope"] = "admin_only";
