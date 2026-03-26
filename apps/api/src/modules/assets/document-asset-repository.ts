import type { DocumentAssetRecord, DocumentAssetType } from "./document-asset-record.ts";

export interface DocumentAssetRepository {
  save(asset: DocumentAssetRecord): Promise<void>;
  findById(id: string): Promise<DocumentAssetRecord | undefined>;
  listByManuscriptId(manuscriptId: string): Promise<DocumentAssetRecord[]>;
  listByManuscriptIdAndType(
    manuscriptId: string,
    assetType: DocumentAssetType,
  ): Promise<DocumentAssetRecord[]>;
}
