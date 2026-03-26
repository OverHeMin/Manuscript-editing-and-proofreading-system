import { randomUUID } from "node:crypto";
import type { ManuscriptRepository } from "../manuscripts/manuscript-repository.ts";
import type { ManuscriptRecord } from "../manuscripts/manuscript-record.ts";
import type {
  DocumentAssetRecord,
  DocumentAssetType,
} from "./document-asset-record.ts";
import type { DocumentAssetRepository } from "./document-asset-repository.ts";

export interface CreateDocumentAssetInput {
  manuscriptId: string;
  assetType: DocumentAssetType;
  storageKey: string;
  mimeType: string;
  createdBy: string;
  fileName?: string;
  parentAssetId?: string;
  sourceModule: DocumentAssetRecord["source_module"];
  sourceJobId?: string;
}

export interface DocumentAssetServiceOptions {
  assetRepository: DocumentAssetRepository;
  manuscriptRepository: ManuscriptRepository;
  createId?: () => string;
  now?: () => Date;
}

export class ManuscriptNotFoundError extends Error {
  constructor(manuscriptId: string) {
    super(`Manuscript ${manuscriptId} was not found.`);
    this.name = "ManuscriptNotFoundError";
  }
}

function pointerFieldForAssetType(
  assetType: DocumentAssetType,
): keyof Pick<
  ManuscriptRecord,
  | "current_screening_asset_id"
  | "current_editing_asset_id"
  | "current_proofreading_asset_id"
> | undefined {
  if (assetType === "screening_report") {
    return "current_screening_asset_id";
  }

  if (assetType === "edited_docx") {
    return "current_editing_asset_id";
  }

  if (
    assetType === "final_proof_issue_report" ||
    assetType === "final_proof_annotated_docx"
  ) {
    return "current_proofreading_asset_id";
  }

  return undefined;
}

export class DocumentAssetService {
  private readonly assetRepository: DocumentAssetRepository;
  private readonly manuscriptRepository: ManuscriptRepository;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: DocumentAssetServiceOptions) {
    this.assetRepository = options.assetRepository;
    this.manuscriptRepository = options.manuscriptRepository;
    this.createId = options.createId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  async createAsset(input: CreateDocumentAssetInput): Promise<DocumentAssetRecord> {
    const manuscript = await this.manuscriptRepository.findById(input.manuscriptId);

    if (!manuscript) {
      throw new ManuscriptNotFoundError(input.manuscriptId);
    }

    const existingAssets = await this.assetRepository.listByManuscriptIdAndType(
      input.manuscriptId,
      input.assetType,
    );

    for (const asset of existingAssets.filter((record) => record.is_current)) {
      await this.assetRepository.save({
        ...asset,
        is_current: false,
        status: asset.status === "archived" ? "archived" : "superseded",
        updated_at: this.now().toISOString(),
      });
    }

    const timestamp = this.now().toISOString();
    const asset: DocumentAssetRecord = {
      id: this.createId(),
      manuscript_id: input.manuscriptId,
      asset_type: input.assetType,
      status: "active",
      storage_key: input.storageKey,
      mime_type: input.mimeType,
      parent_asset_id: input.parentAssetId,
      source_module: input.sourceModule,
      source_job_id: input.sourceJobId,
      created_by: input.createdBy,
      version_no: existingAssets.length + 1,
      is_current: true,
      file_name: input.fileName,
      created_at: timestamp,
      updated_at: timestamp,
    };

    await this.assetRepository.save(asset);

    const pointerField = pointerFieldForAssetType(input.assetType);
    if (pointerField) {
      await this.manuscriptRepository.save({
        ...manuscript,
        [pointerField]: asset.id,
        updated_at: timestamp,
      });
    }

    return asset;
  }

  listAssets(manuscriptId: string): Promise<DocumentAssetRecord[]> {
    return this.assetRepository.listByManuscriptId(manuscriptId);
  }
}
