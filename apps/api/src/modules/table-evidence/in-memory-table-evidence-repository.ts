import type {
  TableEvidenceAsset,
  TableEvidenceBinding,
  TableEvidenceBindingTargetType,
  TableEvidenceRevision,
  TableEvidenceSourceFile,
} from "./table-evidence-record.ts";
import type { TableEvidenceRepository } from "./table-evidence-repository.ts";

function clone<T>(record: T): T {
  return structuredClone(record);
}

export class InMemoryTableEvidenceRepository implements TableEvidenceRepository {
  private readonly sourceFiles = new Map<string, TableEvidenceSourceFile>();
  private readonly assets = new Map<string, TableEvidenceAsset>();
  private readonly revisions = new Map<string, TableEvidenceRevision>();
  private readonly bindings = new Map<string, TableEvidenceBinding>();

  async saveSourceFile(record: TableEvidenceSourceFile): Promise<void> {
    this.sourceFiles.set(record.id, clone(record));
  }

  async findSourceFileById(id: string): Promise<TableEvidenceSourceFile | undefined> {
    const record = this.sourceFiles.get(id);
    return record ? clone(record) : undefined;
  }

  async saveAsset(record: TableEvidenceAsset): Promise<void> {
    if (record.active_revision_id) {
      this.assertRevisionBelongsToAsset(record.id, record.active_revision_id);
    }

    this.assets.set(record.id, clone(record));
  }

  async findAssetById(id: string): Promise<TableEvidenceAsset | undefined> {
    const record = this.assets.get(id);
    return record ? clone(record) : undefined;
  }

  async searchAssets(input: {
    search?: string;
    status?: TableEvidenceAsset["fidelity_status"];
    limit: number;
  }): Promise<TableEvidenceAsset[]> {
    const search = input.search?.toLocaleLowerCase();

    return Array.from(this.assets.values())
      .filter((record) => {
        const matchesSearch =
          search == null ||
          record.title.toLocaleLowerCase().includes(search) ||
          record.source_file_name.toLocaleLowerCase().includes(search);
        const matchesStatus =
          input.status == null || record.fidelity_status === input.status;

        return matchesSearch && matchesStatus;
      })
      .sort(
        (left, right) =>
          right.updated_at.localeCompare(left.updated_at) || left.id.localeCompare(right.id),
      )
      .slice(0, input.limit)
      .map((record) => clone(record));
  }

  async saveRevision(record: TableEvidenceRevision): Promise<void> {
    const existing = this.revisions.get(record.id);
    if (
      existing &&
      existing.table_evidence_asset_id !== record.table_evidence_asset_id
    ) {
      throw new Error(
        `Table evidence revision asset membership is immutable: revision ${record.id} belongs to asset ${existing.table_evidence_asset_id}, not ${record.table_evidence_asset_id}.`,
      );
    }

    this.revisions.set(record.id, clone(record));
  }

  async findRevisionById(id: string): Promise<TableEvidenceRevision | undefined> {
    const record = this.revisions.get(id);
    return record ? clone(record) : undefined;
  }

  async listRevisionsForAsset(assetId: string): Promise<TableEvidenceRevision[]> {
    return Array.from(this.revisions.values())
      .filter((record) => record.table_evidence_asset_id === assetId)
      .sort(
        (left, right) =>
          right.created_at.localeCompare(left.created_at) || left.id.localeCompare(right.id),
      )
      .map((record) => clone(record));
  }

  async setActiveRevision(
    assetId: string,
    revisionId: string,
    fidelityStatus: TableEvidenceAsset["fidelity_status"],
  ): Promise<void> {
    const asset = this.assets.get(assetId);
    if (!asset) {
      return;
    }
    this.assertRevisionBelongsToAsset(assetId, revisionId);

    this.assets.set(assetId, {
      ...clone(asset),
      active_revision_id: revisionId,
      fidelity_status: fidelityStatus,
      updated_at: new Date().toISOString(),
    });
  }

  async saveBinding(record: TableEvidenceBinding): Promise<void> {
    this.assertRevisionBelongsToAsset(
      record.table_evidence_asset_id,
      record.table_evidence_revision_id,
    );

    this.bindings.set(record.id, clone(record));
  }

  async listBindingsForTarget(
    targetType: TableEvidenceBindingTargetType,
    targetId: string,
  ): Promise<TableEvidenceBinding[]> {
    return Array.from(this.bindings.values())
      .filter((record) => record.target_type === targetType && record.target_id === targetId)
      .sort(
        (left, right) =>
          right.created_at.localeCompare(left.created_at) || left.id.localeCompare(right.id),
      )
      .map((record) => clone(record));
  }

  async listBindingsForRevision(revisionId: string): Promise<TableEvidenceBinding[]> {
    return Array.from(this.bindings.values())
      .filter((record) => record.table_evidence_revision_id === revisionId)
      .sort(
        (left, right) =>
          right.created_at.localeCompare(left.created_at) || left.id.localeCompare(right.id),
      )
      .map((record) => clone(record));
  }

  private assertRevisionBelongsToAsset(assetId: string, revisionId: string): void {
    const revision = this.revisions.get(revisionId);
    if (!revision || revision.table_evidence_asset_id !== assetId) {
      throw new Error(
        `Table evidence revision asset mismatch: revision ${revisionId} does not belong to asset ${assetId}.`,
      );
    }
  }
}
