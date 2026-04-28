import type { ManuscriptRecord } from "./manuscript-record.ts";

export interface ManuscriptRepository {
  save(manuscript: ManuscriptRecord): Promise<void>;
  findById(id: string): Promise<ManuscriptRecord | undefined>;
  listRecent(limit: number): Promise<ManuscriptRecord[]>;
  archive(id: string, archivedAt: string): Promise<ManuscriptRecord | undefined>;
}
