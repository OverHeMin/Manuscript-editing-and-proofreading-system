import type {
  KnowledgeRepository,
  KnowledgeReviewActionRepository,
} from "./knowledge-repository.ts";
import type {
  KnowledgeRecord,
  KnowledgeReviewActionRecord,
} from "./knowledge-record.ts";

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
  };
}

function cloneReviewActionRecord(
  record: KnowledgeReviewActionRecord,
): KnowledgeReviewActionRecord {
  return { ...record };
}

export class InMemoryKnowledgeRepository implements KnowledgeRepository {
  private readonly records = new Map<string, KnowledgeRecord>();

  async save(record: KnowledgeRecord): Promise<void> {
    this.records.set(record.id, cloneKnowledgeRecord(record));
  }

  async findById(id: string): Promise<KnowledgeRecord | undefined> {
    const record = this.records.get(id);
    return record ? cloneKnowledgeRecord(record) : undefined;
  }

  async list(): Promise<KnowledgeRecord[]> {
    return [...this.records.values()].map(cloneKnowledgeRecord);
  }

  async listByStatus(status: KnowledgeRecord["status"]): Promise<KnowledgeRecord[]> {
    return [...this.records.values()]
      .filter((record) => record.status === status)
      .map(cloneKnowledgeRecord);
  }

  snapshotState(): Map<string, KnowledgeRecord> {
    return new Map(
      [...this.records.entries()].map(([id, record]) => [
        id,
        cloneKnowledgeRecord(record),
      ]),
    );
  }

  restoreState(snapshot: Map<string, KnowledgeRecord>): void {
    this.records.clear();
    for (const [id, record] of snapshot.entries()) {
      this.records.set(id, cloneKnowledgeRecord(record));
    }
  }
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
