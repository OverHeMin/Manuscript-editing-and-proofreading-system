import type {
  DocumentAssetRecord,
  DocumentAssetType,
} from "../assets/document-asset-record.ts";
import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";

export interface ExportCurrentDocumentAssetInput {
  manuscriptId: string;
  preferredAssetType?: DocumentAssetType;
}

export interface DocumentExportResult {
  manuscript_id: string;
  asset: DocumentAssetRecord;
  download: {
    storage_key: string;
    file_name?: string;
    mime_type: string;
  };
}

export interface DocumentExportServiceOptions {
  assetRepository: DocumentAssetRepository;
}

export class DocumentExportAssetNotFoundError extends Error {
  constructor(manuscriptId: string, preferredAssetType?: DocumentAssetType) {
    super(
      preferredAssetType
        ? `No exportable ${preferredAssetType} asset was found for manuscript ${manuscriptId}.`
        : `No exportable asset was found for manuscript ${manuscriptId}.`,
    );
    this.name = "DocumentExportAssetNotFoundError";
  }
}

function sortAssetsByRecency(
  left: DocumentAssetRecord,
  right: DocumentAssetRecord,
): number {
  if (left.created_at !== right.created_at) {
    return right.created_at.localeCompare(left.created_at);
  }

  if (left.version_no !== right.version_no) {
    return right.version_no - left.version_no;
  }

  return right.id.localeCompare(left.id);
}

export class DocumentExportService {
  private readonly assetRepository: DocumentAssetRepository;

  constructor(options: DocumentExportServiceOptions) {
    this.assetRepository = options.assetRepository;
  }

  async exportCurrentAsset(
    input: ExportCurrentDocumentAssetInput,
  ): Promise<DocumentExportResult> {
    const asset = await this.resolveCurrentAsset(input);

    return {
      manuscript_id: input.manuscriptId,
      asset,
      download: {
        storage_key: asset.storage_key,
        file_name: asset.file_name,
        mime_type: asset.mime_type,
      },
    };
  }

  private async resolveCurrentAsset(
    input: ExportCurrentDocumentAssetInput,
  ): Promise<DocumentAssetRecord> {
    const candidates = input.preferredAssetType
      ? await this.assetRepository.listByManuscriptIdAndType(
          input.manuscriptId,
          input.preferredAssetType,
        )
      : await this.assetRepository.listByManuscriptId(input.manuscriptId);

    const currentAsset = candidates.find(
      (asset) => asset.is_current && asset.status !== "archived",
    );

    if (currentAsset) {
      return currentAsset;
    }

    const latestAsset = [...candidates]
      .filter((asset) => asset.status !== "archived")
      .sort(sortAssetsByRecency)[0];

    if (!latestAsset) {
      throw new DocumentExportAssetNotFoundError(
        input.manuscriptId,
        input.preferredAssetType,
      );
    }

    return latestAsset;
  }
}
