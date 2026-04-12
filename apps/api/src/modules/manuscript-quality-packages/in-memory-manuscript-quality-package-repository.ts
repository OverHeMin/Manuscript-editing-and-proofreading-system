import type {
  ManuscriptQualityPackageKind,
  ManuscriptQualityScope,
} from "@medical/contracts";
import type {
  ListManuscriptQualityPackagesByScopeInput,
  ManuscriptQualityPackageRepository,
} from "./manuscript-quality-package-repository.ts";
import type { ManuscriptQualityPackageRecord } from "./manuscript-quality-package-record.ts";

function normalizeScopes(
  scopes: readonly ManuscriptQualityScope[],
): ManuscriptQualityScope[] {
  return [...scopes].sort((left, right) => left.localeCompare(right));
}

function cloneRecord(
  record: ManuscriptQualityPackageRecord,
): ManuscriptQualityPackageRecord {
  return {
    ...record,
    target_scopes: [...record.target_scopes],
    manifest: structuredClone(record.manifest),
  };
}

function compareRecords(
  left: ManuscriptQualityPackageRecord,
  right: ManuscriptQualityPackageRecord,
): number {
  if (left.package_kind !== right.package_kind) {
    return left.package_kind.localeCompare(right.package_kind);
  }

  if (left.package_name !== right.package_name) {
    return left.package_name.localeCompare(right.package_name);
  }

  if (left.version !== right.version) {
    return left.version - right.version;
  }

  return left.id.localeCompare(right.id);
}

function versionKey(
  packageKind: ManuscriptQualityPackageKind,
  packageName: string,
  targetScopes: readonly ManuscriptQualityScope[],
): string {
  return `${packageKind}:${packageName}:${normalizeScopes(targetScopes).join("|")}`;
}

export class InMemoryManuscriptQualityPackageRepository
  implements ManuscriptQualityPackageRepository
{
  private readonly records = new Map<string, ManuscriptQualityPackageRecord>();
  private readonly reservedVersions = new Map<string, number>();

  async save(record: ManuscriptQualityPackageRecord): Promise<void> {
    const normalizedRecord: ManuscriptQualityPackageRecord = {
      ...record,
      target_scopes: normalizeScopes(record.target_scopes),
      manifest: structuredClone(record.manifest),
    };
    this.records.set(record.id, normalizedRecord);

    const key = versionKey(
      record.package_kind,
      record.package_name,
      normalizedRecord.target_scopes,
    );
    const currentReserved = this.reservedVersions.get(key) ?? 0;
    if (normalizedRecord.version > currentReserved) {
      this.reservedVersions.set(key, normalizedRecord.version);
    }
  }

  async findById(id: string): Promise<ManuscriptQualityPackageRecord | undefined> {
    const record = this.records.get(id);
    return record ? cloneRecord(record) : undefined;
  }

  async list(): Promise<ManuscriptQualityPackageRecord[]> {
    return [...this.records.values()].sort(compareRecords).map(cloneRecord);
  }

  async listByScope(
    input: ListManuscriptQualityPackagesByScopeInput,
  ): Promise<ManuscriptQualityPackageRecord[]> {
    return [...this.records.values()]
      .filter((record) =>
        input.packageKind ? record.package_kind === input.packageKind : true,
      )
      .filter((record) =>
        input.packageName ? record.package_name === input.packageName : true,
      )
      .filter((record) =>
        input.targetScope ? record.target_scopes.includes(input.targetScope) : true,
      )
      .filter((record) => (input.status ? record.status === input.status : true))
      .sort(compareRecords)
      .map(cloneRecord);
  }

  async reserveNextVersion(
    packageKind: ManuscriptQualityPackageKind,
    packageName: string,
    targetScopes: ManuscriptQualityScope[],
  ): Promise<number> {
    const key = versionKey(packageKind, packageName, targetScopes);
    const currentReserved = this.reservedVersions.get(key);
    if (currentReserved !== undefined) {
      const nextVersion = currentReserved + 1;
      this.reservedVersions.set(key, nextVersion);
      return nextVersion;
    }

    const highestStoredVersion = (await this.listByScope({
      packageKind,
      packageName,
    }))
      .filter((record) => {
        const left = normalizeScopes(record.target_scopes);
        const right = normalizeScopes(targetScopes);
        return left.length === right.length && left.every((value, index) => value === right[index]);
      })
      .reduce(
        (currentHighest, record) => Math.max(currentHighest, record.version),
        0,
      );
    const nextVersion = highestStoredVersion + 1;
    this.reservedVersions.set(key, nextVersion);
    return nextVersion;
  }
}
