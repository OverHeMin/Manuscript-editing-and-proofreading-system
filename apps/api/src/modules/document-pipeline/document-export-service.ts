import type {
  CurrentExportSelectionRecord,
  DocumentAssetRecord,
  DocumentAssetType,
  ResultAssetMatrixRecord,
} from "../assets/document-asset-record.ts";
import {
  compareDocumentAssetRecency,
  resolveCurrentExportSelection,
  resolveResultAssetMatrix,
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
  matrix: ResultAssetMatrixRecord;
  selection?: Omit<CurrentExportSelectionRecord, "asset">;
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
    const manuscript = await this.manuscriptRepository.findById(input.manuscriptId);
    const candidates = input.preferredAssetType
      ? await this.assetRepository.listByManuscriptIdAndType(
          input.manuscriptId,
          input.preferredAssetType,
        )
      : await this.assetRepository.listByManuscriptId(input.manuscriptId);
    const matrix = resolveResultAssetMatrix({
      assets: candidates,
      pointers: {
        screeningAssetId: manuscript?.current_screening_asset_id,
        editingAssetId: manuscript?.current_editing_asset_id,
        proofreadingAssetId: manuscript?.current_proofreading_asset_id,
      },
    });
    const selection = resolveCurrentExportSelection(matrix);
    const asset = await this.resolveCurrentAsset(input, candidates, selection);

    return {
      manuscript_id: input.manuscriptId,
      asset,
      matrix,
      ...(selection
        ? {
            selection: {
              slot: selection.slot,
              label: selection.label,
              reason: selection.reason,
            },
          }
        : {}),
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
    candidates: readonly DocumentAssetRecord[],
    selection: CurrentExportSelectionRecord | undefined,
  ): Promise<DocumentAssetRecord> {
    if (!input.preferredAssetType && selection) {
      return selection.asset;
    }

    if (input.preferredAssetType) {
      return this.resolveLatestUsableAsset(candidates, input);
    }

    return this.resolveLatestUsableAsset(candidates, input);
  }

  private resolveLatestUsableAsset(
    candidates: readonly DocumentAssetRecord[],
    input: ExportCurrentDocumentAssetInput,
  ): DocumentAssetRecord {
    const currentAsset = [...candidates]
      .filter((asset) => asset.is_current && asset.status !== "archived")
      .sort(compareDocumentAssetRecency)[0];

    if (currentAsset) {
      return currentAsset;
    }

    const latestAsset = [...candidates]
      .filter((asset) => asset.status !== "archived")
      .sort(compareDocumentAssetRecency)[0];

    if (!latestAsset) {
      throw new DocumentExportAssetNotFoundError(
        input.manuscriptId,
        input.preferredAssetType,
      );
    }

    return latestAsset;
  }
}
