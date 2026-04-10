import type { ManuscriptModule } from "../jobs/job-record.ts";

export type DocumentAssetStatus =
  | "created"
  | "active"
  | "superseded"
  | "archived";

export type DocumentAssetType =
  | "original"
  | "normalized_docx"
  | "screening_report"
  | "edited_docx"
  | "proofreading_draft_report"
  | "final_proof_issue_report"
  | "final_proof_annotated_docx"
  | "pdf_consistency_report"
  | "human_final_docx"
  | "learning_snapshot_attachment";

export interface DocumentAssetRecord {
  id: string;
  manuscript_id: string;
  asset_type: DocumentAssetType;
  status: DocumentAssetStatus;
  storage_key: string;
  mime_type: string;
  parent_asset_id?: string;
  source_module: ManuscriptModule;
  source_job_id?: string;
  created_by: string;
  version_no: number;
  is_current: boolean;
  file_name?: string;
  created_at: string;
  updated_at: string;
}

export type ResultAssetMatrixSlot =
  | "screening_report"
  | "edited_docx"
  | "proofreading_draft_report"
  | "final_proof_output";

export interface ResultAssetMatrixRecord<TAsset = DocumentAssetRecord> {
  screening_report?: TAsset;
  edited_docx?: TAsset;
  proofreading_draft_report?: TAsset;
  final_proof_output?: TAsset;
}

export interface CurrentExportSelectionRecord<TAsset = DocumentAssetRecord> {
  slot: ResultAssetMatrixSlot;
  label: string;
  reason: string;
  asset: TAsset;
}

interface AssetResolutionInput<TAsset extends AssetViewLike> {
  assets: readonly TAsset[];
  pointers?: {
    screeningAssetId?: string;
    editingAssetId?: string;
    proofreadingAssetId?: string;
  };
}

type AssetViewLike = Pick<
  DocumentAssetRecord,
  "id" | "asset_type" | "status" | "is_current" | "created_at" | "version_no"
>;

const PROOFREADING_FINAL_OUTPUT_PRIORITY: readonly DocumentAssetType[] = [
  "human_final_docx",
  "final_proof_annotated_docx",
  "final_proof_issue_report",
];

export function compareDocumentAssetRecency(
  left: AssetViewLike,
  right: AssetViewLike,
): number {
  if (left.created_at !== right.created_at) {
    return right.created_at.localeCompare(left.created_at);
  }

  if (left.version_no !== right.version_no) {
    return right.version_no - left.version_no;
  }

  return right.id.localeCompare(left.id);
}

export function resolveResultAssetMatrix<TAsset extends AssetViewLike>(
  input: AssetResolutionInput<TAsset>,
): ResultAssetMatrixRecord<TAsset> {
  return {
    screening_report: resolveCurrentStageAsset(input.assets, ["screening_report"], {
      preferredId: input.pointers?.screeningAssetId,
    }),
    edited_docx: resolveCurrentStageAsset(input.assets, ["edited_docx"], {
      preferredId: input.pointers?.editingAssetId,
    }),
    proofreading_draft_report: resolveCurrentStageAsset(
      input.assets,
      ["proofreading_draft_report"],
    ),
    final_proof_output: resolveCurrentStageAsset(
      input.assets,
      PROOFREADING_FINAL_OUTPUT_PRIORITY,
      {
        preferredId: input.pointers?.proofreadingAssetId,
      },
    ),
  };
}

export function resolveCurrentExportSelection<TAsset extends AssetViewLike>(
  matrix: ResultAssetMatrixRecord<TAsset>,
): CurrentExportSelectionRecord<TAsset> | undefined {
  if (matrix.final_proof_output) {
    return {
      slot: "final_proof_output",
      label: "终校输出",
      reason: describeFinalProofOutputReason(matrix.final_proof_output.asset_type),
      asset: matrix.final_proof_output,
    };
  }

  if (matrix.proofreading_draft_report) {
    return {
      slot: "proofreading_draft_report",
      label: "校对草稿报告",
      reason: "已生成校对草稿，默认导出最新校对草稿报告。",
      asset: matrix.proofreading_draft_report,
    };
  }

  if (matrix.edited_docx) {
    return {
      slot: "edited_docx",
      label: "编辑稿",
      reason: "当前最靠后的可交付资产是编辑稿。",
      asset: matrix.edited_docx,
    };
  }

  if (matrix.screening_report) {
    return {
      slot: "screening_report",
      label: "初筛报告",
      reason: "当前最靠后的可交付资产是初筛报告。",
      asset: matrix.screening_report,
    };
  }

  return undefined;
}

export function shouldAdvanceProofreadingCurrentAsset(
  existingAssetType: DocumentAssetType | undefined,
  nextAssetType: DocumentAssetType,
): boolean {
  const nextPriority = getProofreadingFinalOutputPriority(nextAssetType);
  if (nextPriority === 0) {
    return false;
  }

  const existingPriority = getProofreadingFinalOutputPriority(existingAssetType);
  return nextPriority >= existingPriority;
}

function resolveCurrentStageAsset<TAsset extends AssetViewLike>(
  assets: readonly TAsset[],
  preferredTypes: readonly DocumentAssetType[],
  options?: {
    preferredId?: string;
  },
): TAsset | undefined {
  if (options?.preferredId) {
    const preferredAsset = assets.find((asset) => asset.id === options.preferredId);
    if (
      preferredAsset &&
      preferredTypes.includes(preferredAsset.asset_type) &&
      isUsableCurrentAsset(preferredAsset)
    ) {
      return preferredAsset;
    }
  }

  for (const assetType of preferredTypes) {
    const currentAsset = [...assets]
      .filter(
        (asset) =>
          asset.asset_type === assetType && isUsableCurrentAsset(asset),
      )
      .sort(compareDocumentAssetRecency)[0];
    if (currentAsset) {
      return currentAsset;
    }
  }

  for (const assetType of preferredTypes) {
    const latestAsset = [...assets]
      .filter(
        (asset) =>
          asset.asset_type === assetType && asset.status !== "archived",
      )
      .sort(compareDocumentAssetRecency)[0];
    if (latestAsset) {
      return latestAsset;
    }
  }

  return undefined;
}

function isUsableCurrentAsset(asset: AssetViewLike): boolean {
  return asset.is_current && asset.status !== "archived";
}

function getProofreadingFinalOutputPriority(
  assetType: DocumentAssetType | undefined,
): number {
  if (!assetType) {
    return 0;
  }

  const index = PROOFREADING_FINAL_OUTPUT_PRIORITY.indexOf(assetType);
  return index === -1 ? 0 : PROOFREADING_FINAL_OUTPUT_PRIORITY.length - index;
}

function describeFinalProofOutputReason(assetType: DocumentAssetType): string {
  switch (assetType) {
    case "human_final_docx":
      return "已发布人工终稿，默认导出正式交付件。";
    case "final_proof_annotated_docx":
      return "已生成终校输出，默认导出最新终校交付件。";
    case "final_proof_issue_report":
      return "已生成终校结果，默认导出最新终校结果报告。";
    default:
      return "当前最靠后的可交付资产已作为默认导出项。";
  }
}
