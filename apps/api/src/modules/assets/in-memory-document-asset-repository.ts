import type {
  DocumentAssetRecord,
  DocumentAssetType,
} from "./document-asset-record.ts";
import type { DocumentAssetRepository } from "./document-asset-repository.ts";

function cloneRecord(record: DocumentAssetRecord): DocumentAssetRecord {
  return { ...record };
}

function compareAssets(left: DocumentAssetRecord, right: DocumentAssetRecord): number {
  if (left.created_at !== right.created_at) {
    return left.created_at.localeCompare(right.created_at);
  }

  if (left.asset_type !== right.asset_type) {
    return left.asset_type.localeCompare(right.asset_type);
  }

  if (left.version_no !== right.version_no) {
    return left.version_no - right.version_no;
  }

  return left.id.localeCompare(right.id);
}

export class InMemoryDocumentAssetRepository implements DocumentAssetRepository {
  private readonly records = new Map<string, DocumentAssetRecord>();

  async save(asset: DocumentAssetRecord): Promise<void> {
    this.records.set(asset.id, cloneRecord(asset));
  }

  async findById(id: string): Promise<DocumentAssetRecord | undefined> {
    const record = this.records.get(id);

    return record ? cloneRecord(record) : undefined;
  }

  async listByManuscriptId(manuscriptId: string): Promise<DocumentAssetRecord[]> {
    return [...this.records.values()]
      .filter((record) => record.manuscript_id === manuscriptId)
      .sort(compareAssets)
      .map(cloneRecord);
  }

  async listByManuscriptIdAndType(
    manuscriptId: string,
    assetType: DocumentAssetType,
  ): Promise<DocumentAssetRecord[]> {
    return [...this.records.values()]
      .filter(
        (record) =>
          record.manuscript_id === manuscriptId &&
          record.asset_type === assetType,
      )
      .sort(compareAssets)
      .map(cloneRecord);
  }
}
