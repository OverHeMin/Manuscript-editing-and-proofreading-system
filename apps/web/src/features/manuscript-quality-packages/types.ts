import type { AuthRole } from "../auth/index.ts";

export type ManuscriptQualityScope =
  | "general_proofreading"
  | "medical_specialized";

export type ManuscriptQualityPackageKind =
  | "general_style_package"
  | "medical_analyzer_package";

export type ManuscriptQualityPackageStatus =
  | "draft"
  | "published"
  | "archived";

export interface ManuscriptQualityPackageViewModel {
  id: string;
  package_name: string;
  package_kind: ManuscriptQualityPackageKind;
  target_scopes: ManuscriptQualityScope[];
  version: number;
  status: ManuscriptQualityPackageStatus;
  manifest: Record<string, unknown>;
}

export interface CreateManuscriptQualityPackageDraftInput {
  actorRole: AuthRole;
  packageName: string;
  packageKind: ManuscriptQualityPackageKind;
  targetScopes: ManuscriptQualityScope[];
  manifest: Record<string, unknown>;
}

export interface ListManuscriptQualityPackagesInput {
  packageKind?: ManuscriptQualityPackageKind;
  packageName?: string;
  targetScope?: ManuscriptQualityScope;
  status?: ManuscriptQualityPackageStatus;
}

export interface PublishManuscriptQualityPackageVersionInput {
  actorRole: AuthRole;
}
