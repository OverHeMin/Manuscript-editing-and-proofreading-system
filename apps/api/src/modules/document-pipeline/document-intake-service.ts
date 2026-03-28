import {
  type DocumentNormalizationExecutionResult,
  type DocumentNormalizationWorkflowInput,
  type DocumentPreviewStatus,
  DocumentNormalizationWorkflowService,
} from "./document-normalization-service.ts";

export interface DocumentIntakeResult {
  normalization: DocumentNormalizationExecutionResult;
  preview: {
    manuscript_id: string;
    source_asset_id?: string;
    normalized_asset_type: "normalized_docx";
    viewer: "onlyoffice";
    status: DocumentPreviewStatus;
    mime_type: string;
    file_name: string;
    storage_key: string;
    warnings: string[];
  };
}

export interface DocumentIntakeServiceOptions {
  workflowService: DocumentNormalizationWorkflowService;
}

export class DocumentIntakeService {
  private readonly workflowService: DocumentNormalizationWorkflowService;

  constructor(options: DocumentIntakeServiceOptions) {
    this.workflowService = options.workflowService;
  }

  async intakeUploadedManuscript(
    input: DocumentNormalizationWorkflowInput,
  ): Promise<DocumentIntakeResult> {
    const normalization = await this.workflowService.normalize(input);

    return {
      normalization,
      preview: {
        manuscript_id: normalization.plan.manuscript_id,
        source_asset_id: normalization.preview.source_asset_id,
        normalized_asset_type: normalization.plan.derived_asset.asset_type,
        viewer: normalization.preview.viewer,
        status: normalization.preview.status,
        mime_type: normalization.preview.mime_type,
        file_name:
          normalization.normalized_asset?.file_name ??
          normalization.plan.derived_asset.file_name,
        storage_key:
          normalization.normalized_asset?.storage_key ??
          normalization.plan.derived_asset.storage_key,
        warnings: [...normalization.preview.warnings],
      },
    };
  }
}
