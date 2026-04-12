import type { RuntimeBindingRecord } from "./runtime-binding-record.ts";
import type { RuntimeBindingRepository } from "./runtime-binding-repository.ts";

function cloneRecord(record: RuntimeBindingRecord): RuntimeBindingRecord {
  return {
    ...record,
    skill_package_ids: [...record.skill_package_ids],
    quality_package_version_ids: [...(record.quality_package_version_ids ?? [])],
    verification_check_profile_ids: [...record.verification_check_profile_ids],
    evaluation_suite_ids: [...record.evaluation_suite_ids],
  };
}

function compareRecords(
  left: RuntimeBindingRecord,
  right: RuntimeBindingRecord,
): number {
  if (left.module !== right.module) {
    return left.module.localeCompare(right.module);
  }

  if (left.manuscript_type !== right.manuscript_type) {
    return left.manuscript_type.localeCompare(right.manuscript_type);
  }

  if (left.template_family_id !== right.template_family_id) {
    return left.template_family_id.localeCompare(right.template_family_id);
  }

  if (left.version !== right.version) {
    return left.version - right.version;
  }

  return left.id.localeCompare(right.id);
}

function versionKey(
  module: RuntimeBindingRecord["module"],
  manuscriptType: RuntimeBindingRecord["manuscript_type"],
  templateFamilyId: RuntimeBindingRecord["template_family_id"],
): string {
  return `${module}:${manuscriptType}:${templateFamilyId}`;
}

export class InMemoryRuntimeBindingRepository implements RuntimeBindingRepository {
  private readonly records = new Map<string, RuntimeBindingRecord>();
  private readonly reservedVersions = new Map<string, number>();

  async save(record: RuntimeBindingRecord): Promise<void> {
    this.records.set(record.id, cloneRecord(record));
    const key = versionKey(
      record.module,
      record.manuscript_type,
      record.template_family_id,
    );
    const currentReserved = this.reservedVersions.get(key) ?? 0;
    if (record.version > currentReserved) {
      this.reservedVersions.set(key, record.version);
    }
  }

  async findById(id: string): Promise<RuntimeBindingRecord | undefined> {
    const record = this.records.get(id);
    return record ? cloneRecord(record) : undefined;
  }

  async list(): Promise<RuntimeBindingRecord[]> {
    return [...this.records.values()].sort(compareRecords).map(cloneRecord);
  }

  async listByScope(
    module: RuntimeBindingRecord["module"],
    manuscriptType: RuntimeBindingRecord["manuscript_type"],
    templateFamilyId: RuntimeBindingRecord["template_family_id"],
    activeOnly = false,
  ): Promise<RuntimeBindingRecord[]> {
    return [...this.records.values()]
      .filter(
        (record) =>
          record.module === module &&
          record.manuscript_type === manuscriptType &&
          record.template_family_id === templateFamilyId,
      )
      .filter((record) => !activeOnly || record.status === "active")
      .sort(compareRecords)
      .map(cloneRecord);
  }

  async reserveNextVersion(
    module: RuntimeBindingRecord["module"],
    manuscriptType: RuntimeBindingRecord["manuscript_type"],
    templateFamilyId: RuntimeBindingRecord["template_family_id"],
  ): Promise<number> {
    const key = versionKey(module, manuscriptType, templateFamilyId);
    const currentReserved = this.reservedVersions.get(key);
    if (currentReserved !== undefined) {
      const nextVersion = currentReserved + 1;
      this.reservedVersions.set(key, nextVersion);
      return nextVersion;
    }

    const highestStoredVersion = (await this.listByScope(
      module,
      manuscriptType,
      templateFamilyId,
    )).reduce(
      (currentHighest, record) => Math.max(currentHighest, record.version),
      0,
    );
    const nextVersion = highestStoredVersion + 1;
    this.reservedVersions.set(key, nextVersion);
    return nextVersion;
  }
}
