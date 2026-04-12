import type { RetrievalPresetRecord } from "./retrieval-preset-record.ts";

export interface RetrievalPresetRepository {
  save(record: RetrievalPresetRecord): Promise<void>;
  findById(id: string): Promise<RetrievalPresetRecord | undefined>;
  listByScope(
    module: RetrievalPresetRecord["module"],
    manuscriptType: RetrievalPresetRecord["manuscript_type"],
    templateFamilyId: RetrievalPresetRecord["template_family_id"],
    activeOnly?: boolean,
  ): Promise<RetrievalPresetRecord[]>;
  reserveNextVersion(
    module: RetrievalPresetRecord["module"],
    manuscriptType: RetrievalPresetRecord["manuscript_type"],
    templateFamilyId: RetrievalPresetRecord["template_family_id"],
  ): Promise<number>;
}
