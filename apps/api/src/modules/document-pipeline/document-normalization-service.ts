import type { DocumentAssetRecord } from "../assets/document-asset-record.ts";
import { DocumentAssetService } from "../assets/document-asset-service.ts";

const DOC_MIME_TYPES = new Set(["application/msword"]);
const DOCX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type SourceDocumentType = "doc" | "docx";
export type DocumentConversionStatus =
  | "queued"
  | "not_required"
  | "tool_unavailable";
export type DocumentPreviewStatus = "ready" | "pending_normalization";

export interface DocumentNormalizationRequest {
  manuscriptId: string;
  sourceAssetId: string;
  fileName: string;
  mimeType: string;
  storageKey: string;
}

export interface DocumentPipelineToolingStatus {
  libreOfficeAvailable: boolean;
}

export interface DocumentNormalizationPlan {
  manuscript_id: string;
  source_asset_id: string;
  source_type: SourceDocumentType;
  current_type: SourceDocumentType;
  target_type: "docx";
  derived_asset: {
    asset_type: "normalized_docx";
    parent_asset_id: string;
    file_name: string;
    mime_type: string;
    storage_key: string;
  };
  conversion: {
    required: boolean;
    backend: "libreoffice" | null;
    status: DocumentConversionStatus;
  };
  preview: {
    viewer: "onlyoffice";
    status: DocumentPreviewStatus;
    source_asset_type: "normalized_docx";
    mime_type: string;
  };
  warnings: string[];
}

export interface DocumentNormalizationWorkflowInput
  extends DocumentNormalizationRequest {
  createdBy: string;
  sourceJobId?: string;
}

export interface DocumentNormalizationExecutionResult {
  plan: DocumentNormalizationPlan;
  normalized_asset?: DocumentAssetRecord;
  preview: {
    viewer: "onlyoffice";
    status: DocumentPreviewStatus;
    source_asset_type: "normalized_docx";
    source_asset_id?: string;
    mime_type: string;
    warnings: string[];
  };
}

export class UnsupportedDocumentFormatError extends Error {
  constructor(fileName: string, mimeType: string) {
    super(`Unsupported document format for ${fileName} (${mimeType}).`);
    this.name = "UnsupportedDocumentFormatError";
  }
}

function sniffDocumentType(fileName: string, mimeType: string): SourceDocumentType {
  const normalizedFileName = fileName.toLowerCase();

  if (normalizedFileName.endsWith(".docx")) {
    return "docx";
  }

  if (normalizedFileName.endsWith(".doc")) {
    return "doc";
  }

  if (DOCX_MIME_TYPES.has(mimeType)) {
    return "docx";
  }

  if (DOC_MIME_TYPES.has(mimeType)) {
    return "doc";
  }

  throw new UnsupportedDocumentFormatError(fileName, mimeType);
}

function buildNormalizedFileName(fileName: string): string {
  const extensionIndex = fileName.lastIndexOf(".");
  const baseName =
    extensionIndex >= 0 ? fileName.slice(0, extensionIndex) : fileName;

  return `${baseName}.normalized.docx`;
}

function buildNormalizedStorageKey(
  manuscriptId: string,
  sourceAssetId: string,
  fileName: string,
): string {
  return `normalized/${manuscriptId}/${sourceAssetId}/${buildNormalizedFileName(fileName)}`;
}

export class DocumentNormalizationService {
  planNormalization(
    request: DocumentNormalizationRequest,
    tooling: DocumentPipelineToolingStatus,
  ): DocumentNormalizationPlan {
    const sourceType = sniffDocumentType(request.fileName, request.mimeType);
    const conversionRequired = sourceType === "doc";
    const warnings: string[] = [];

    let conversionStatus: DocumentConversionStatus;
    let conversionBackend: "libreoffice" | null;

    if (conversionRequired && tooling.libreOfficeAvailable) {
      conversionStatus = "queued";
      conversionBackend = "libreoffice";
    } else if (conversionRequired) {
      conversionStatus = "tool_unavailable";
      conversionBackend = "libreoffice";
      warnings.push(
        "LibreOffice unavailable; doc to docx normalization deferred.",
      );
    } else {
      conversionStatus = "not_required";
      conversionBackend = null;
    }

    return {
      manuscript_id: request.manuscriptId,
      source_asset_id: request.sourceAssetId,
      source_type: sourceType,
      current_type: sourceType,
      target_type: "docx",
      derived_asset: {
        asset_type: "normalized_docx",
        parent_asset_id: request.sourceAssetId,
        file_name: buildNormalizedFileName(request.fileName),
        mime_type: DOCX_MIME_TYPE,
        storage_key: buildNormalizedStorageKey(
          request.manuscriptId,
          request.sourceAssetId,
          request.fileName,
        ),
      },
      conversion: {
        required: conversionRequired,
        backend: conversionBackend,
        status: conversionStatus,
      },
      preview: {
        viewer: "onlyoffice",
        status: conversionRequired ? "pending_normalization" : "ready",
        source_asset_type: "normalized_docx",
        mime_type: DOCX_MIME_TYPE,
      },
      warnings,
    };
  }
}

export interface DocumentNormalizationWorkflowServiceOptions {
  normalizationService: DocumentNormalizationService;
  assetService: DocumentAssetService;
  toolingStatus: DocumentPipelineToolingStatus;
}

export class DocumentNormalizationWorkflowService {
  private readonly normalizationService: DocumentNormalizationService;
  private readonly assetService: DocumentAssetService;
  private readonly toolingStatus: DocumentPipelineToolingStatus;

  constructor(options: DocumentNormalizationWorkflowServiceOptions) {
    this.normalizationService = options.normalizationService;
    this.assetService = options.assetService;
    this.toolingStatus = options.toolingStatus;
  }

  async normalize(
    input: DocumentNormalizationWorkflowInput,
  ): Promise<DocumentNormalizationExecutionResult> {
    const plan = this.normalizationService.planNormalization(
      input,
      this.toolingStatus,
    );

    let normalizedAsset: DocumentAssetRecord | undefined;

    if (plan.conversion.status === "not_required") {
      normalizedAsset = await this.registerNormalizedAsset({
        manuscriptId: input.manuscriptId,
        sourceAssetId: input.sourceAssetId,
        storageKey: plan.derived_asset.storage_key,
        fileName: plan.derived_asset.file_name,
        mimeType: plan.derived_asset.mime_type,
        createdBy: input.createdBy,
        sourceJobId: input.sourceJobId,
      });
    }

    return {
      plan,
      normalized_asset: normalizedAsset,
      preview: {
        viewer: "onlyoffice",
        status: normalizedAsset ? "ready" : "pending_normalization",
        source_asset_type: "normalized_docx",
        source_asset_id: normalizedAsset?.id,
        mime_type: plan.preview.mime_type,
        warnings: [...plan.warnings],
      },
    };
  }

  registerNormalizedAsset(input: {
    manuscriptId: string;
    sourceAssetId: string;
    storageKey: string;
    fileName: string;
    mimeType: string;
    createdBy: string;
    sourceJobId?: string;
  }): Promise<DocumentAssetRecord> {
    return this.assetService.createAsset({
      manuscriptId: input.manuscriptId,
      assetType: "normalized_docx",
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      createdBy: input.createdBy,
      fileName: input.fileName,
      parentAssetId: input.sourceAssetId,
      sourceModule: "upload",
      sourceJobId: input.sourceJobId,
    });
  }
}
