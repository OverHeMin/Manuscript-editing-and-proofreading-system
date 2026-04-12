import type { ManuscriptQualityScope } from "./manuscript-quality.js";

export type ManuscriptQualityPackageKind =
  | "general_style_package"
  | "medical_analyzer_package";

export type ManuscriptQualityPackageStatus =
  | "draft"
  | "published"
  | "archived";

export interface ManuscriptQualityPackageVersionRef {
  package_id: string;
  package_name: string;
  package_kind: ManuscriptQualityPackageKind;
  target_scopes: ManuscriptQualityScope[];
  version: number;
}
