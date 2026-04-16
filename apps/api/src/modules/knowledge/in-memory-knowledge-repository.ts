import type {
  KnowledgeAssetRecord,
  KnowledgeContentBlockRecord,
  KnowledgeRecord,
  KnowledgeRevisionBindingRecord,
  KnowledgeRevisionRecord,
  KnowledgeSemanticLayerRecord,
  KnowledgeReviewActionRecord,
} from "./knowledge-record.ts";
import {
  mapLegacyKnowledgeRecordToDuplicateCandidate,
  selectRepresentativeRevisionForDuplicateDetection,
} from "./knowledge-duplicate-detection.ts";
import type {
  KnowledgeDuplicateCandidateGroupRecord,
  KnowledgeRepository,
  KnowledgeReviewActionRepository,
} from "./knowledge-repository.ts";
import {
  projectRuntimeKnowledgeRecord,
  selectRuntimeApprovedKnowledgeRevision,
} from "./knowledge-runtime-projection.ts";

interface KnowledgeRepositorySnapshot {
  legacyRecords: Map<string, KnowledgeRecord>;
  assets: Map<string, KnowledgeAssetRecord>;
  revisions: Map<string, KnowledgeRevisionRecord>;
  bindingsByRevisionId: Map<string, KnowledgeRevisionBindingRecord[]>;
  contentBlocksByRevisionId: Map<string, KnowledgeContentBlockRecord[]>;
  semanticLayersByRevisionId: Map<string, KnowledgeSemanticLayerRecord>;
}

function cloneJsonRecord(
  value: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  return value ? JSON.parse(JSON.stringify(value)) : undefined;
}

function cloneKnowledgeRecord(record: KnowledgeRecord): KnowledgeRecord {
  return {
    ...record,
    routing: {
      ...record.routing,
      manuscript_types:
        record.routing.manuscript_types === "any"
          ? "any"
          : [...record.routing.manuscript_types],
      sections: record.routing.sections ? [...record.routing.sections] : undefined,
      risk_tags: record.routing.risk_tags ? [...record.routing.risk_tags] : undefined,
      discipline_tags: record.routing.discipline_tags
        ? [...record.routing.discipline_tags]
        : undefined,
    },
    aliases: record.aliases ? [...record.aliases] : undefined,
    template_bindings: record.template_bindings
      ? [...record.template_bindings]
      : undefined,
    projection_source: record.projection_source
      ? JSON.parse(JSON.stringify(record.projection_source))
      : undefined,
  };
}

function cloneAssetRecord(record: KnowledgeAssetRecord): KnowledgeAssetRecord {
  return { ...record };
}

function cloneRevisionRecord(record: KnowledgeRevisionRecord): KnowledgeRevisionRecord {
  return {
    ...record,
    routing: {
      ...record.routing,
      manuscript_types:
        record.routing.manuscript_types === "any"
          ? "any"
          : [...record.routing.manuscript_types],
      sections: record.routing.sections ? [...record.routing.sections] : undefined,
      risk_tags: record.routing.risk_tags ? [...record.routing.risk_tags] : undefined,
      discipline_tags: record.routing.discipline_tags
        ? [...record.routing.discipline_tags]
        : undefined,
    },
    aliases: record.aliases ? [...record.aliases] : undefined,
    projection_source: record.projection_source
      ? JSON.parse(JSON.stringify(record.projection_source))
      : undefined,
  };
}

function cloneBindingRecord(
  record: KnowledgeRevisionBindingRecord,
): KnowledgeRevisionBindingRecord {
  return { ...record };
}

function cloneContentBlockRecord(
  record: KnowledgeContentBlockRecord,
): KnowledgeContentBlockRecord {
  return {
    ...record,
    content_payload: JSON.parse(JSON.stringify(record.content_payload)),
    ...(record.table_semantics
      ? { table_semantics: cloneJsonRecord(record.table_semantics) }
      : {}),
    ...(record.image_understanding
      ? { image_understanding: cloneJsonRecord(record.image_understanding) }
      : {}),
  };
}

function cloneSemanticLayerRecord(
  record: KnowledgeSemanticLayerRecord,
): KnowledgeSemanticLayerRecord {
  return {
    ...record,
    ...(record.retrieval_terms
      ? { retrieval_terms: [...record.retrieval_terms] }
      : {}),
    ...(record.retrieval_snippets
      ? { retrieval_snippets: [...record.retrieval_snippets] }
      : {}),
    ...(record.table_semantics
      ? { table_semantics: cloneJsonRecord(record.table_semantics) }
      : {}),
    ...(record.image_understanding
      ? { image_understanding: cloneJsonRecord(record.image_understanding) }
      : {}),
  };
}

function cloneReviewActionRecord(
  record: KnowledgeReviewActionRecord,
): KnowledgeReviewActionRecord {
  return { ...record };
}

function cloneLegacyReviewActionRecord(
  record: KnowledgeReviewActionRecord,
): KnowledgeReviewActionRecord {
  return {
    id: record.id,
    knowledge_item_id: record.knowledge_item_id,
    action: record.action,
    actor_role: record.actor_role,
    ...(record.review_note != null ? { review_note: record.review_note } : {}),
    created_at: record.created_at,
  };
}

export class InMemoryKnowledgeRepository implements KnowledgeRepository {
  private readonly legacyRecords = new Map<string, KnowledgeRecord>();
  private readonly assets = new Map<string, KnowledgeAssetRecord>();
  private readonly revisions = new Map<string, KnowledgeRevisionRecord>();
  private readonly bindingsByRevisionId = new Map<string, KnowledgeRevisionBindingRecord[]>();
  private readonly contentBlocksByRevisionId = new Map<
    string,
    KnowledgeContentBlockRecord[]
  >();
  private readonly semanticLayersByRevisionId = new Map<
    string,
    KnowledgeSemanticLayerRecord
  >();

  async save(record: KnowledgeRecord): Promise<void> {
    this.legacyRecords.set(record.id, cloneKnowledgeRecord(record));
  }

  async findById(id: string): Promise<KnowledgeRecord | undefined> {
    if (this.assets.has(id)) {
      return this.projectAuthoringKnowledgeRecord(id);
    }

    const record = this.legacyRecords.get(id);
    return record ? cloneKnowledgeRecord(record) : undefined;
  }

  async findApprovedById(id: string): Promise<KnowledgeRecord | undefined> {
    if (this.assets.has(id)) {
      return this.projectApprovedKnowledgeRecord(id);
    }

    const record = this.legacyRecords.get(id);
    if (!record || record.status !== "approved") {
      return undefined;
    }

    return cloneKnowledgeRecord(record);
  }

  async list(): Promise<KnowledgeRecord[]> {
    const projected = [...this.assets.keys()]
      .map((assetId) => this.projectAuthoringKnowledgeRecord(assetId))
      .filter((record): record is KnowledgeRecord => record != null);
    const shadowedIds = new Set(this.assets.keys());
    const legacy = [...this.legacyRecords.entries()]
      .filter(([id]) => !shadowedIds.has(id))
      .map(([, record]) => cloneKnowledgeRecord(record));

    return [...projected, ...legacy];
  }

  async listApproved(): Promise<KnowledgeRecord[]> {
    const projected = (
      await Promise.all(
        [...this.assets.keys()].map((assetId) =>
          this.projectApprovedKnowledgeRecord(assetId),
        ),
      )
    ).filter((record): record is KnowledgeRecord => record != null);
    const shadowedIds = new Set(this.assets.keys());
    const legacy = [...this.legacyRecords.entries()]
      .filter(
        ([id, record]) => !shadowedIds.has(id) && record.status === "approved",
      )
      .map(([, record]) => cloneKnowledgeRecord(record));

    return [...projected, ...legacy];
  }

  async listByStatus(status: KnowledgeRecord["status"]): Promise<KnowledgeRecord[]> {
    return (await this.list()).filter((record) => record.status === status);
  }

  async saveAsset(record: KnowledgeAssetRecord): Promise<void> {
    this.assets.set(record.id, cloneAssetRecord(record));
  }

  async findAssetById(id: string): Promise<KnowledgeAssetRecord | undefined> {
    const record = this.assets.get(id);
    return record ? cloneAssetRecord(record) : undefined;
  }

  async listAssets(): Promise<KnowledgeAssetRecord[]> {
    return [...this.assets.values()].map(cloneAssetRecord);
  }

  async saveRevision(record: KnowledgeRevisionRecord): Promise<void> {
    this.revisions.set(record.id, cloneRevisionRecord(record));
  }

  async findRevisionById(id: string): Promise<KnowledgeRevisionRecord | undefined> {
    const record = this.revisions.get(id);
    return record ? cloneRevisionRecord(record) : undefined;
  }

  async listRevisionsByAssetId(assetId: string): Promise<KnowledgeRevisionRecord[]> {
    return [...this.revisions.values()]
      .filter((record) => record.asset_id === assetId)
      .sort(compareRevisionRecordsDesc)
      .map(cloneRevisionRecord);
  }

  async listRevisionsByStatus(
    status: KnowledgeRevisionRecord["status"],
  ): Promise<KnowledgeRevisionRecord[]> {
    return [...this.revisions.values()]
      .filter((record) => record.status === status)
      .sort(compareRevisionRecordsDesc)
      .map(cloneRevisionRecord);
  }

  async replaceRevisionBindings(
    revisionId: string,
    records: readonly KnowledgeRevisionBindingRecord[],
  ): Promise<void> {
    this.bindingsByRevisionId.set(
      revisionId,
      records.map(cloneBindingRecord),
    );
  }

  async listBindingsByRevisionId(
    revisionId: string,
  ): Promise<KnowledgeRevisionBindingRecord[]> {
    return (this.bindingsByRevisionId.get(revisionId) ?? []).map(cloneBindingRecord);
  }

  async replaceRevisionContentBlocks(
    revisionId: string,
    records: readonly KnowledgeContentBlockRecord[],
  ): Promise<void> {
    this.contentBlocksByRevisionId.set(
      revisionId,
      records.map(cloneContentBlockRecord),
    );
  }

  async listContentBlocksByRevisionId(
    revisionId: string,
  ): Promise<KnowledgeContentBlockRecord[]> {
    return (this.contentBlocksByRevisionId.get(revisionId) ?? [])
      .slice()
      .sort(compareContentBlockRecordsAsc)
      .map(cloneContentBlockRecord);
  }

  async saveSemanticLayer(record: KnowledgeSemanticLayerRecord): Promise<void> {
    this.semanticLayersByRevisionId.set(
      record.revision_id,
      cloneSemanticLayerRecord(record),
    );
  }

  async findSemanticLayerByRevisionId(
    revisionId: string,
  ): Promise<KnowledgeSemanticLayerRecord | undefined> {
    const record = this.semanticLayersByRevisionId.get(revisionId);
    return record ? cloneSemanticLayerRecord(record) : undefined;
  }

  async listDuplicateCheckCandidatesByAsset(): Promise<
    KnowledgeDuplicateCandidateGroupRecord[]
  > {
    const grouped: KnowledgeDuplicateCandidateGroupRecord[] = [];

    for (const asset of this.assets.values()) {
      const revisions = this.resolveRevisionList(asset.id);
      const representativeRevision =
        selectRepresentativeRevisionForDuplicateDetection(revisions, {
          preferredApprovedRevisionId: asset.current_approved_revision_id,
          preferredCurrentRevisionId: asset.current_revision_id,
        });
      if (!representativeRevision) {
        continue;
      }

      grouped.push({
        asset: cloneAssetRecord(asset),
        representative_revision: cloneRevisionRecord(representativeRevision),
        bindings: (this.bindingsByRevisionId.get(representativeRevision.id) ?? []).map(
          (binding) => binding.binding_target_id,
        ),
      });
    }

    const shadowedIds = new Set(this.assets.keys());
    for (const [legacyId, legacyRecord] of this.legacyRecords.entries()) {
      if (shadowedIds.has(legacyId)) {
        continue;
      }

      const candidate = mapLegacyKnowledgeRecordToDuplicateCandidate(legacyRecord);
      grouped.push({
        asset: cloneAssetRecord(candidate.asset),
        representative_revision: cloneRevisionRecord(candidate.revision),
        bindings: [...candidate.bindings],
      });
    }

    return grouped.sort(compareDuplicateCandidateGroups);
  }

  snapshotState(): KnowledgeRepositorySnapshot {
    return {
      legacyRecords: new Map(
        [...this.legacyRecords.entries()].map(([id, record]) => [
          id,
          cloneKnowledgeRecord(record),
        ]),
      ),
      assets: new Map(
        [...this.assets.entries()].map(([id, record]) => [id, cloneAssetRecord(record)]),
      ),
      revisions: new Map(
        [...this.revisions.entries()].map(([id, record]) => [
          id,
          cloneRevisionRecord(record),
        ]),
      ),
      bindingsByRevisionId: new Map(
        [...this.bindingsByRevisionId.entries()].map(([revisionId, records]) => [
          revisionId,
          records.map(cloneBindingRecord),
        ]),
      ),
      contentBlocksByRevisionId: new Map(
        [...this.contentBlocksByRevisionId.entries()].map(([revisionId, records]) => [
          revisionId,
          records.map(cloneContentBlockRecord),
        ]),
      ),
      semanticLayersByRevisionId: new Map(
        [...this.semanticLayersByRevisionId.entries()].map(([revisionId, record]) => [
          revisionId,
          cloneSemanticLayerRecord(record),
        ]),
      ),
    };
  }

  restoreState(snapshot: KnowledgeRepositorySnapshot): void {
    this.legacyRecords.clear();
    this.assets.clear();
    this.revisions.clear();
    this.bindingsByRevisionId.clear();
    this.contentBlocksByRevisionId.clear();
    this.semanticLayersByRevisionId.clear();

    for (const [id, record] of snapshot.legacyRecords.entries()) {
      this.legacyRecords.set(id, cloneKnowledgeRecord(record));
    }
    for (const [id, record] of snapshot.assets.entries()) {
      this.assets.set(id, cloneAssetRecord(record));
    }
    for (const [id, record] of snapshot.revisions.entries()) {
      this.revisions.set(id, cloneRevisionRecord(record));
    }
    for (const [revisionId, records] of snapshot.bindingsByRevisionId.entries()) {
      this.bindingsByRevisionId.set(
        revisionId,
        records.map(cloneBindingRecord),
      );
    }
    for (const [revisionId, records] of snapshot.contentBlocksByRevisionId.entries()) {
      this.contentBlocksByRevisionId.set(
        revisionId,
        records.map(cloneContentBlockRecord),
      );
    }
    for (const [revisionId, record] of snapshot.semanticLayersByRevisionId.entries()) {
      this.semanticLayersByRevisionId.set(
        revisionId,
        cloneSemanticLayerRecord(record),
      );
    }
  }

  private projectAuthoringKnowledgeRecord(
    assetId: string,
  ): KnowledgeRecord | undefined {
    const asset = this.assets.get(assetId);
    if (!asset) {
      return undefined;
    }

    const revisions = this.resolveRevisionList(asset.id);
    const selectedRevision =
      revisions.find(
        (revision) =>
          revision.status === "draft" || revision.status === "pending_review",
      ) ??
      (asset.current_revision_id
        ? this.revisions.get(asset.current_revision_id)
        : undefined) ??
      revisions[0];

    return selectedRevision
      ? this.projectKnowledgeRecordFromRevision(selectedRevision)
      : undefined;
  }

  private async projectApprovedKnowledgeRecord(
    assetId: string,
  ): Promise<KnowledgeRecord | undefined> {
    const asset = this.assets.get(assetId);
    if (!asset) {
      return undefined;
    }

    const revisions = this.resolveRevisionList(asset.id);
    const revision = selectRuntimeApprovedKnowledgeRevision(revisions, {
      preferredRevisionId: asset.current_approved_revision_id,
    });
    if (!revision) {
      return undefined;
    }

    const bindings = this.bindingsByRevisionId.get(revision.id) ?? [];
    const semanticLayer = this.semanticLayersByRevisionId.get(revision.id);

    return projectRuntimeKnowledgeRecord({
      revision,
      bindings,
      semanticLayer,
    });
  }

  private projectKnowledgeRecordFromRevision(
    revision: KnowledgeRevisionRecord,
  ): KnowledgeRecord {
    const bindings = this.bindingsByRevisionId.get(revision.id) ?? [];

    return {
      id: revision.asset_id,
      title: revision.title,
      canonical_text: revision.canonical_text,
      knowledge_kind: revision.knowledge_kind,
      status: revision.status,
      routing: {
        ...revision.routing,
        manuscript_types:
          revision.routing.manuscript_types === "any"
            ? "any"
            : [...revision.routing.manuscript_types],
        sections: revision.routing.sections ? [...revision.routing.sections] : undefined,
        risk_tags: revision.routing.risk_tags
          ? [...revision.routing.risk_tags]
          : undefined,
        discipline_tags: revision.routing.discipline_tags
          ? [...revision.routing.discipline_tags]
          : undefined,
      },
      ...(revision.summary != null ? { summary: revision.summary } : {}),
      ...(revision.evidence_level != null
        ? { evidence_level: revision.evidence_level }
        : {}),
      ...(revision.source_type != null ? { source_type: revision.source_type } : {}),
      ...(revision.source_link != null ? { source_link: revision.source_link } : {}),
      ...(revision.aliases ? { aliases: [...revision.aliases] } : {}),
      ...(bindings.length > 0
        ? {
            template_bindings: bindings.map((binding) => binding.binding_target_id),
          }
        : {}),
      ...(revision.source_learning_candidate_id != null
        ? { source_learning_candidate_id: revision.source_learning_candidate_id }
        : {}),
      ...(revision.projection_source != null
        ? {
            projection_source: JSON.parse(
              JSON.stringify(revision.projection_source),
            ) as NonNullable<KnowledgeRecord["projection_source"]>,
          }
        : {}),
    };
  }

  private resolveRevisionList(assetId: string): KnowledgeRevisionRecord[] {
    return [...this.revisions.values()]
      .filter((record) => record.asset_id === assetId)
      .sort(compareRevisionRecordsDesc);
  }
}

function compareDuplicateCandidateGroups(
  left: KnowledgeDuplicateCandidateGroupRecord,
  right: KnowledgeDuplicateCandidateGroupRecord,
): number {
  return (
    left.asset.id.localeCompare(right.asset.id) ||
    left.representative_revision.id.localeCompare(right.representative_revision.id)
  );
}

export class InMemoryKnowledgeReviewActionRepository
  implements KnowledgeReviewActionRepository
{
  private readonly records = new Map<string, KnowledgeReviewActionRecord>();

  async save(record: KnowledgeReviewActionRecord): Promise<void> {
    this.records.set(record.id, cloneReviewActionRecord(record));
  }

  async listByKnowledgeItemId(
    knowledgeItemId: string,
  ): Promise<KnowledgeReviewActionRecord[]> {
    return [...this.records.values()]
      .filter((record) => record.knowledge_item_id === knowledgeItemId)
      .sort(compareReviewActionRecordsAsc)
      .map(cloneReviewActionRecord);
  }

  async listByRevisionId(
    revisionId: string,
  ): Promise<KnowledgeReviewActionRecord[]> {
    return [...this.records.values()]
      .filter((record) => record.revision_id === revisionId)
      .sort(compareReviewActionRecordsAsc)
      .map(cloneReviewActionRecord);
  }

  snapshotState(): Map<string, KnowledgeReviewActionRecord> {
    return new Map(
      [...this.records.entries()].map(([id, record]) => [
        id,
        cloneReviewActionRecord(record),
      ]),
    );
  }

  restoreState(snapshot: Map<string, KnowledgeReviewActionRecord>): void {
    this.records.clear();
    for (const [id, record] of snapshot.entries()) {
      this.records.set(id, cloneReviewActionRecord(record));
    }
  }
}

function compareRevisionRecordsDesc(
  left: KnowledgeRevisionRecord,
  right: KnowledgeRevisionRecord,
): number {
  return (
    right.revision_no - left.revision_no ||
    right.updated_at.localeCompare(left.updated_at) ||
    right.id.localeCompare(left.id)
  );
}

function compareReviewActionRecordsAsc(
  left: KnowledgeReviewActionRecord,
  right: KnowledgeReviewActionRecord,
): number {
  return (
    left.created_at.localeCompare(right.created_at) ||
    left.id.localeCompare(right.id)
  );
}

function compareContentBlockRecordsAsc(
  left: KnowledgeContentBlockRecord,
  right: KnowledgeContentBlockRecord,
): number {
  return left.order_no - right.order_no || left.id.localeCompare(right.id);
}
