import type {
  DocumentNormalizationExecutionViewModel,
  DocumentPreviewViewModel,
} from "./types.ts";

export function mapNormalizationPlanToPreview(
  result: DocumentNormalizationExecutionViewModel,
): DocumentPreviewViewModel {
  return {
    manuscript_id: result.plan.manuscript_id,
    source_asset_id: result.preview.source_asset_id,
    normalized_asset_type:
      result.normalized_asset?.asset_type ?? result.plan.derived_asset.asset_type,
    viewer: result.preview.viewer,
    status: result.preview.status,
    mime_type: result.preview.mime_type,
    file_name:
      result.normalized_asset?.file_name ?? result.plan.derived_asset.file_name,
    storage_key:
      result.normalized_asset?.storage_key ?? result.plan.derived_asset.storage_key,
    warnings: [...result.preview.warnings],
  };
}
