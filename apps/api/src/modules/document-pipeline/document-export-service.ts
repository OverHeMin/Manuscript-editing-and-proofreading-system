import type {
  DocumentAssetRecord,
  DocumentAssetType,
} from "../assets/document-asset-record.ts";
import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";
import type { ManuscriptRepository } from "../manuscripts/manuscript-repository.ts";

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
    url: string;
  };
}

export interface DocumentExportServiceOptions {
  assetRepository: DocumentAssetRepository;
  manuscriptRepository: ManuscriptRepository;
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
  private readonly manuscriptRepository: ManuscriptRepository;

  constructor(options: DocumentExportServiceOptions) {
    this.assetRepository = options.assetRepository;
    this.manuscriptRepository = options.manuscriptRepository;
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
        url: `/api/v1/document-assets/${asset.id}/download`,
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

    if (input.preferredAssetType) {
      return this.resolveLatestUsableAsset(candidates, input);
    }

    const manuscript = await this.manuscriptRepository.findById(input.manuscriptId);
    const preferredAssetIds = [
      manuscript?.current_proofreading_asset_id,
      manuscript?.current_editing_asset_id,
      manuscript?.current_screening_asset_id,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    for (const assetId of preferredAssetIds) {
      const asset = await this.assetRepository.findById(assetId);
      if (asset && asset.manuscript_id === input.manuscriptId && asset.status !== "archived") {
        return asset;
      }
    }

    return this.resolveLatestUsableAsset(candidates, input);
  }

  private resolveLatestUsableAsset(
    candidates: readonly DocumentAssetRecord[],
    input: ExportCurrentDocumentAssetInput,
  ): DocumentAssetRecord {
    const currentAsset = [...candidates]
      .filter((asset) => asset.is_current && asset.status !== "archived")
      .sort(sortAssetsByRecency)[0];

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
