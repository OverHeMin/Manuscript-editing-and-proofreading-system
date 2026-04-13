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
