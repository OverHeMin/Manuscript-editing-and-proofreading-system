import type { ManuscriptRecord } from "./manuscript-record.ts";

export interface ManuscriptRepository {
  save(manuscript: ManuscriptRecord): Promise<void>;
  findById(id: string): Promise<ManuscriptRecord | undefined>;
}
