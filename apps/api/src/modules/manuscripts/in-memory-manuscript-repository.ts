import type { ManuscriptRecord } from "./manuscript-record.ts";
import type { ManuscriptRepository } from "./manuscript-repository.ts";

function cloneRecord(record: ManuscriptRecord): ManuscriptRecord {
  return {
    ...record,
    ...(record.manuscript_type_detection_summary
      ? {
          manuscript_type_detection_summary: {
            ...record.manuscript_type_detection_summary,
            ...(record.manuscript_type_detection_summary.matched_signals
              ? {
                  matched_signals: [
                    ...record.manuscript_type_detection_summary.matched_signals,
                  ],
                }
              : {}),
          },
        }
      : {}),
    ...(record.editing_slot_governance_summary
      ? {
          editing_slot_governance_summary: structuredClone(
            record.editing_slot_governance_summary,
          ),
        }
      : {}),
    ...(record.editing_completion_gate_summary
      ? {
          editing_completion_gate_summary: structuredClone(
            record.editing_completion_gate_summary,
          ),
        }
      : {}),
  };
}

export class InMemoryManuscriptRepository implements ManuscriptRepository {
  private readonly records = new Map<string, ManuscriptRecord>();

  async save(manuscript: ManuscriptRecord): Promise<void> {
    this.records.set(manuscript.id, cloneRecord(manuscript));
  }

  async findById(id: string): Promise<ManuscriptRecord | undefined> {
    const record = this.records.get(id);

    return record ? cloneRecord(record) : undefined;
  }

  async listRecent(limit = 50): Promise<ManuscriptRecord[]> {
    return [...this.records.values()]
      .filter((record) => record.status !== "archived")
      .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
      .slice(0, limit)
      .map(cloneRecord);
  }

  async archive(
    id: string,
    archivedAt: string,
  ): Promise<ManuscriptRecord | undefined> {
    const record = this.records.get(id);

    if (!record) {
      return undefined;
    }

    const archived: ManuscriptRecord = {
      ...record,
      status: "archived",
      updated_at: archivedAt,
    };
    this.records.set(id, cloneRecord(archived));

    return cloneRecord(archived);
  }

  snapshotState(): Map<string, ManuscriptRecord> {
    return new Map(
      [...this.records.entries()].map(([id, record]) => [id, cloneRecord(record)]),
    );
  }

  restoreState(snapshot: Map<string, ManuscriptRecord>): void {
    this.records.clear();
    for (const [id, record] of snapshot.entries()) {
      this.records.set(id, cloneRecord(record));
    }
  }
}
