import type { ManualReviewPolicyRecord } from "./manual-review-policy-record.ts";
import type { ManualReviewPolicyRepository } from "./manual-review-policy-repository.ts";

function cloneRecord(
  record: ManualReviewPolicyRecord,
): ManualReviewPolicyRecord {
  return {
    ...record,
    module_blocklist_rules: record.module_blocklist_rules
      ? [...record.module_blocklist_rules]
      : undefined,
  };
}

function compareRecords(
  left: ManualReviewPolicyRecord,
  right: ManualReviewPolicyRecord,
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
  module: ManualReviewPolicyRecord["module"],
  manuscriptType: ManualReviewPolicyRecord["manuscript_type"],
  templateFamilyId: ManualReviewPolicyRecord["template_family_id"],
): string {
  return `${module}:${manuscriptType}:${templateFamilyId}`;
}

export class InMemoryManualReviewPolicyRepository
  implements ManualReviewPolicyRepository
{
  private readonly records = new Map<string, ManualReviewPolicyRecord>();
  private readonly reservedVersions = new Map<string, number>();

  async save(record: ManualReviewPolicyRecord): Promise<void> {
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

  async findById(id: string): Promise<ManualReviewPolicyRecord | undefined> {
    const record = this.records.get(id);
    return record ? cloneRecord(record) : undefined;
  }

  async listByScope(
    module: ManualReviewPolicyRecord["module"],
    manuscriptType: ManualReviewPolicyRecord["manuscript_type"],
    templateFamilyId: ManualReviewPolicyRecord["template_family_id"],
    activeOnly = false,
  ): Promise<ManualReviewPolicyRecord[]> {
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
    module: ManualReviewPolicyRecord["module"],
    manuscriptType: ManualReviewPolicyRecord["manuscript_type"],
    templateFamilyId: ManualReviewPolicyRecord["template_family_id"],
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
