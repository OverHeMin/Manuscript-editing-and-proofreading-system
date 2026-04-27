export function formatWorkbenchAssetTypeLabel(assetType: string): string {
  switch (assetType) {
    case "original":
      return "\u539f\u7a3f";
    case "edited_docx":
      return "\u7f16\u8f91\u7a3f";
    case "screening_report":
      return "\u521d\u7b5b\u62a5\u544a";
    case "proofreading_draft_report":
      return "\u6821\u5bf9\u8349\u7a3f\u62a5\u544a";
    case "final_proof_annotated_docx":
      return "\u6821\u5bf9\u6279\u6ce8\u7a3f";
    case "final_proof_issue_report":
      return "\u6821\u5bf9\u95ee\u9898\u62a5\u544a";
    case "human_final_docx":
      return "\u4eba\u5de5\u7ec8\u7a3f";
    default:
      return assetType;
  }
}

export function resolveWorkbenchAssetDownloadLabel(assetType: string): string | undefined {
  switch (assetType) {
    case "screening_report":
      return "\u4e0b\u8f7d\u521d\u7b5b\u62a5\u544a";
    case "proofreading_draft_report":
      return "\u4e0b\u8f7d\u6821\u5bf9\u8349\u7a3f\u62a5\u544a";
    case "final_proof_issue_report":
      return "\u4e0b\u8f7d\u6821\u5bf9\u95ee\u9898\u62a5\u544a";
    case "edited_docx":
      return "\u4e0b\u8f7d\u7f16\u8f91\u7a3f";
    case "final_proof_annotated_docx":
      return "\u4e0b\u8f7d\u6821\u5bf9\u6279\u6ce8\u7a3f";
    case "human_final_docx":
      return "\u4e0b\u8f7d\u4eba\u5de5\u7ec8\u7a3f";
    default:
      return undefined;
  }
}

export function formatWorkbenchGeneratedOutputTypeLabel(
  assetType: string,
  mode?: "screening" | "editing" | "proofreading",
): string {
  switch (assetType) {
    case "screening_report":
      return "\u521d\u7b5b\u62a5\u544a";
    case "edited_docx":
      return "\u7f16\u8f91\u7a3f\u4ef6";
    case "proofreading_draft_report":
      return "\u6821\u5bf9\u8349\u7a3f\u62a5\u544a";
    case "final_proof_issue_report":
      return "\u6821\u5bf9\u95ee\u9898\u62a5\u544a";
    case "final_proof_annotated_docx":
      return "\u6821\u5bf9\u6279\u6ce8\u7a3f";
    case "human_final_docx":
      return "\u4eba\u5de5\u7ec8\u7a3f";
    default:
      break;
  }

  if (mode === "screening") {
    return "\u521d\u7b5b\u7ed3\u679c";
  }

  if (mode === "editing") {
    return "\u7f16\u8f91\u7a3f\u4ef6";
  }

  if (mode === "proofreading") {
    return "\u6821\u5bf9\u7ed3\u679c";
  }

  return "\u7ed3\u679c\u6587\u4ef6";
}

export function buildWorkbenchAssetDisplayName(
  manuscriptTitle: string,
  asset: {
    asset_type: string;
    file_name?: string | null;
  },
): string {
  const baseTitle = manuscriptTitle.trim().length > 0 ? manuscriptTitle.trim() : "\u7a3f\u4ef6";
  const suffix = resolveWorkbenchAssetDisplaySuffix(asset.asset_type);
  if (suffix) {
    return `${baseTitle}${suffix}`;
  }

  const baseName = asset.file_name?.trim();
  if (baseName && baseName.length > 0) {
    return baseName;
  }

  return formatWorkbenchGeneratedOutputTypeLabel(asset.asset_type);
}

function resolveWorkbenchAssetDisplaySuffix(assetType: string): string | null {
  switch (assetType) {
    case "original":
      return " - \u539f\u7a3f";
    case "screening_report":
      return " - \u521d\u7b5b\u7ed3\u679c";
    case "edited_docx":
      return " - \u7f16\u8f91\u7a3f";
    case "proofreading_draft_report":
      return " - \u6821\u5bf9\u8349\u7a3f\u62a5\u544a";
    case "final_proof_annotated_docx":
      return " - \u6821\u5bf9\u6279\u6ce8\u7a3f";
    case "final_proof_issue_report":
      return " - \u6821\u5bf9\u95ee\u9898\u62a5\u544a";
    case "human_final_docx":
      return " - \u4eba\u5de5\u7ec8\u7a3f";
    default:
      return null;
  }
}
