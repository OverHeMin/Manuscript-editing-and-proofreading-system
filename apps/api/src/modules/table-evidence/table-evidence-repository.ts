import type {
  TableEvidenceAsset,
  TableEvidenceBinding,
  TableEvidenceBindingTargetType,
  TableEvidenceRevision,
  TableEvidenceSourceFile,
} from "./table-evidence-record.ts";

export interface TableEvidenceRepository {
  saveSourceFile(record: TableEvidenceSourceFile): Promise<void>;
  findSourceFileById(id: string): Promise<TableEvidenceSourceFile | undefined>;
  saveAsset(record: TableEvidenceAsset): Promise<void>;
  findAssetById(id: string): Promise<TableEvidenceAsset | undefined>;
  searchAssets(input: {
    search?: string;
    status?: TableEvidenceAsset["fidelity_status"];
    limit: number;
  }): Promise<TableEvidenceAsset[]>;
  saveRevision(record: TableEvidenceRevision): Promise<void>;
  findRevisionById(id: string): Promise<TableEvidenceRevision | undefined>;
  listRevisionsForAsset(assetId: string): Promise<TableEvidenceRevision[]>;
  setActiveRevision(
    assetId: string,
    revisionId: string,
    fidelityStatus: TableEvidenceAsset["fidelity_status"],
  ): Promise<void>;
  saveBinding(record: TableEvidenceBinding): Promise<void>;
  listBindingsForTarget(
    targetType: TableEvidenceBindingTargetType,
    targetId: string,
  ): Promise<TableEvidenceBinding[]>;
  listBindingsForRevision(revisionId: string): Promise<TableEvidenceBinding[]>;
}
