import type { ManuscriptType } from "../manuscripts/types.ts";
import type { TemplateModule } from "../templates/types.ts";

export type HarnessDatasetSourceKind =
  | "reviewed_case_snapshot"
  | "human_final_asset"
  | "evaluation_evidence_pack";
export type HarnessGoldSetVersionStatus = "draft" | "published" | "archived";
export type HarnessRubricStatus = "draft" | "published" | "archived";
export type HarnessRubricAssignmentStatus = "missing" | HarnessRubricStatus;
export type HarnessDatasetExportFormat = "json" | "jsonl";
export type HarnessDatasetPublicationStatus = "succeeded" | "failed";

export interface HarnessDatasetFamilyScopeViewModel {
  module: TemplateModule;
  manuscriptTypes: ManuscriptType[];
  measureFocus: string;
  templateFamilyId?: string;
}

export interface HarnessDatasetSourceProvenanceViewModel {
  sourceKind: HarnessDatasetSourceKind;
  sourceId: string;
  manuscriptId: string;
  manuscriptType: ManuscriptType;
  deidentificationPassed: boolean;
  humanReviewed: boolean;
  riskTags?: string[];
}

export interface HarnessDatasetRubricAssignmentViewModel {
  status: HarnessRubricAssignmentStatus;
  rubricDefinitionId?: string;
  rubricName?: string;
  rubricVersionNo?: number;
}

export interface HarnessDatasetPublicationViewModel {
  id: string;
  goldSetVersionId: string;
  exportFormat: HarnessDatasetExportFormat;
  status: HarnessDatasetPublicationStatus;
  outputUri?: string;
  deidentificationGatePassed: boolean;
  createdAt: string;
}

export interface HarnessDatasetVersionViewModel {
  id: string;
  familyId: string;
  familyName: string;
  familyScope: HarnessDatasetFamilyScopeViewModel;
  versionNo: number;
  status: HarnessGoldSetVersionStatus;
  itemCount: number;
  createdBy: string;
  createdAt: string;
  publishedBy?: string;
  publishedAt?: string;
  deidentificationGatePassed: boolean;
  humanReviewGatePassed: boolean;
  rubricAssignment: HarnessDatasetRubricAssignmentViewModel;
  sourceProvenance: HarnessDatasetSourceProvenanceViewModel[];
  publications: HarnessDatasetPublicationViewModel[];
}

export interface HarnessDatasetRubricSummaryViewModel {
  id: string;
  name: string;
  versionNo: number;
  status: HarnessRubricStatus;
}

export interface HarnessDatasetsWorkbenchOverview {
  exportRootDir: string;
  rubrics: HarnessDatasetRubricSummaryViewModel[];
  draftVersions: HarnessDatasetVersionViewModel[];
  publishedVersions: HarnessDatasetVersionViewModel[];
  archivedVersions: HarnessDatasetVersionViewModel[];
}

export interface HarnessDatasetExportResultViewModel {
  publication: HarnessDatasetPublicationViewModel;
  outputPath: string;
}

export interface HarnessDatasetWorkbenchApiOverview {
  export_root_dir: string;
  versions: Array<{
    id: string;
    family_id: string;
    family_name: string;
    family_scope: {
      module: TemplateModule;
      manuscript_types: ManuscriptType[];
      measure_focus: string;
      template_family_id?: string;
    };
    version_no: number;
    status: HarnessGoldSetVersionStatus;
    item_count: number;
    created_by: string;
    created_at: string;
    published_by?: string;
    published_at?: string;
    deidentification_gate_passed: boolean;
    human_review_gate_passed: boolean;
    items: Array<{
      source_kind: HarnessDatasetSourceKind;
      source_id: string;
      manuscript_id: string;
      manuscript_type: ManuscriptType;
      deidentification_passed: boolean;
      human_reviewed: boolean;
      risk_tags?: string[];
    }>;
    rubric_assignment: {
      status: HarnessRubricAssignmentStatus;
      rubric_definition_id?: string;
      rubric_name?: string;
      rubric_version_no?: number;
    };
    publications: Array<{
      id: string;
      gold_set_version_id: string;
      export_format: HarnessDatasetExportFormat;
      status: HarnessDatasetPublicationStatus;
      output_uri?: string;
      deidentification_gate_passed: boolean;
      created_at: string;
    }>;
  }>;
  rubrics: Array<{
    id: string;
    name: string;
    version_no: number;
    status: HarnessRubricStatus;
  }>;
}

export interface HarnessDatasetExportApiResult {
  publication: {
    id: string;
    gold_set_version_id: string;
    export_format: HarnessDatasetExportFormat;
    status: HarnessDatasetPublicationStatus;
    output_uri?: string;
    deidentification_gate_passed: boolean;
    created_at: string;
  };
  output_path: string;
}
