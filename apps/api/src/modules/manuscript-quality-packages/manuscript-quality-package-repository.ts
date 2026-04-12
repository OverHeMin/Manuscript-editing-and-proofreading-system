import type {
  ManuscriptQualityPackageKind,
  ManuscriptQualityPackageStatus,
  ManuscriptQualityScope,
} from "@medical/contracts";
import type { ManuscriptQualityPackageRecord } from "./manuscript-quality-package-record.ts";

export interface ListManuscriptQualityPackagesByScopeInput {
  packageKind?: ManuscriptQualityPackageKind;
  packageName?: string;
  targetScope?: ManuscriptQualityScope;
  status?: ManuscriptQualityPackageStatus;
}

export interface ManuscriptQualityPackageRepository {
  save(record: ManuscriptQualityPackageRecord): Promise<void>;
  findById(id: string): Promise<ManuscriptQualityPackageRecord | undefined>;
  list(): Promise<ManuscriptQualityPackageRecord[]>;
  listByScope(
    input: ListManuscriptQualityPackagesByScopeInput,
  ): Promise<ManuscriptQualityPackageRecord[]>;
  reserveNextVersion(
    packageKind: ManuscriptQualityPackageKind,
    packageName: string,
    targetScopes: ManuscriptQualityScope[],
  ): Promise<number>;
}
