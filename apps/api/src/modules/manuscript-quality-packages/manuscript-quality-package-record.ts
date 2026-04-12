import type {
  ManuscriptQualityPackageKind,
  ManuscriptQualityPackageStatus,
  ManuscriptQualityScope,
} from "@medical/contracts";

export interface ManuscriptQualityPackageRecord {
  id: string;
  package_name: string;
  package_kind: ManuscriptQualityPackageKind;
  target_scopes: ManuscriptQualityScope[];
  version: number;
  status: ManuscriptQualityPackageStatus;
  manifest: Record<string, unknown>;
}
