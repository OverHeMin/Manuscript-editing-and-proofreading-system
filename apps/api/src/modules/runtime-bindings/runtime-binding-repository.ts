import type { RuntimeBindingRecord } from "./runtime-binding-record.ts";

export interface RuntimeBindingRepository {
  save(record: RuntimeBindingRecord): Promise<void>;
  findById(id: string): Promise<RuntimeBindingRecord | undefined>;
  list(): Promise<RuntimeBindingRecord[]>;
  listByScope(
    module: RuntimeBindingRecord["module"],
    manuscriptType: RuntimeBindingRecord["manuscript_type"],
    templateFamilyId: RuntimeBindingRecord["template_family_id"],
    activeOnly?: boolean,
  ): Promise<RuntimeBindingRecord[]>;
  reserveNextVersion(
    module: RuntimeBindingRecord["module"],
    manuscriptType: RuntimeBindingRecord["manuscript_type"],
    templateFamilyId: RuntimeBindingRecord["template_family_id"],
  ): Promise<number>;
}
