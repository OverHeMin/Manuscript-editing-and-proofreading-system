import type {
  ManuscriptQualityFindingSummary,
  ManuscriptQualityIssue,
  ManuscriptQualityPackageVersionRef,
  ManuscriptQualityScope,
} from "@medical/contracts";
import type { DocumentStructureTableSnapshot } from "../document-pipeline/document-structure-service.ts";

export const MEDICAL_SPECIALIZED_ISSUE_TYPES = [
  "medical_terminology",
  "medical_data_consistency",
  "statistical_expression",
  "evidence_alignment",
  "ethics_privacy",
] as const;

export type MedicalSpecializedIssueType =
  (typeof MEDICAL_SPECIALIZED_ISSUE_TYPES)[number];

export type ManuscriptQualityTargetModule =
  | "screening"
  | "editing"
  | "proofreading";

export interface ManuscriptQualitySourceBlock {
  text: string;
  style?: string;
}

export interface ManuscriptQualityRuntimePackage
  extends ManuscriptQualityPackageVersionRef {
  manifest: Record<string, unknown>;
}

export interface ManuscriptQualityWorkerInput {
  blocks: ManuscriptQualitySourceBlock[];
  tableSnapshots?: DocumentStructureTableSnapshot[];
  qualityPackages?: ManuscriptQualityRuntimePackage[];
}

export interface ManuscriptQualityWorkerResult {
  module_scope: ManuscriptQualityScope;
  issues: ManuscriptQualityIssue[];
  normalized_text?: string;
  paragraph_blocks?: Array<Record<string, unknown>>;
  sentence_blocks?: Array<Record<string, unknown>>;
}

export interface ManuscriptQualityRunInput {
  blocks: ManuscriptQualitySourceBlock[];
  requestedScopes?: ManuscriptQualityScope[];
  targetModule?: ManuscriptQualityTargetModule;
  tableSnapshots?: DocumentStructureTableSnapshot[];
  qualityPackageVersionIds?: string[];
}

export interface ManuscriptQualityRunResult {
  requested_scopes: ManuscriptQualityScope[];
  completed_scopes: ManuscriptQualityScope[];
  issues: ManuscriptQualityIssue[];
  quality_findings_summary: ManuscriptQualityFindingSummary;
  resolved_quality_packages: ManuscriptQualityPackageVersionRef[];
}

export interface ManuscriptQualityWorkerAdapter {
  runGeneralProofreading(
    input: ManuscriptQualityWorkerInput,
  ): Promise<ManuscriptQualityWorkerResult>;
  runMedicalSpecialized?(
    input: ManuscriptQualityWorkerInput,
  ): Promise<ManuscriptQualityWorkerResult>;
}
