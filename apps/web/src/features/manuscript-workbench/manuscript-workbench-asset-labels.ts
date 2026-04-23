export function formatWorkbenchAssetTypeLabel(assetType: string): string {
  switch (assetType) {
    case "original":
      return "原稿";
    case "edited_docx":
      return "编辑稿";
    case "screening_report":
      return "初筛报告";
    case "proofreading_draft_report":
      return "校对草稿报告";
    case "final_proof_annotated_docx":
      return "校对批注稿";
    case "final_proof_issue_report":
      return "校对问题报告";
    case "human_final_docx":
      return "人工终稿";
    default:
      return assetType;
  }
}

export function resolveWorkbenchAssetDownloadLabel(assetType: string): string | undefined {
  switch (assetType) {
    case "screening_report":
      return "下载初筛报告";
    case "proofreading_draft_report":
      return "下载校对草稿报告";
    case "final_proof_issue_report":
      return "下载校对问题报告";
    case "edited_docx":
      return "下载编辑稿件";
    case "final_proof_annotated_docx":
      return "下载校对批注稿";
    case "human_final_docx":
      return "下载人工终稿";
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
      return "初筛报告";
    case "edited_docx":
      return "编辑稿件";
    case "proofreading_draft_report":
      return "校对草稿报告";
    case "final_proof_issue_report":
      return "校对问题报告";
    case "final_proof_annotated_docx":
      return "校对批注稿";
    case "human_final_docx":
      return "人工终稿";
    default:
      break;
  }

  if (mode === "screening") {
    return "初筛结果";
  }

  if (mode === "editing") {
    return "编辑稿件";
  }

  if (mode === "proofreading") {
    return "校对结果";
  }

  return "结果文件";
}

export function buildWorkbenchAssetDisplayName(
  manuscriptTitle: string,
  asset: {
    asset_type: string;
    file_name?: string | null;
  },
): string {
  const baseTitle = manuscriptTitle.trim().length > 0 ? manuscriptTitle.trim() : "稿件";
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
      return " - 原稿";
    case "screening_report":
      return " - 初筛结果";
    case "edited_docx":
      return " - 编辑稿";
    case "proofreading_draft_report":
      return " - 校对草稿报告";
    case "final_proof_annotated_docx":
      return " - 校对批注稿";
    case "final_proof_issue_report":
      return " - 校对问题报告";
    case "human_final_docx":
      return " - 人工终稿";
    default:
      return null;
  }
}
