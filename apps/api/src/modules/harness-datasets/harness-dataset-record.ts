import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { TemplateModule } from "../templates/template-record.ts";

export type HarnessGoldSetVersionStatus = "draft" | "published" | "archived";
export type HarnessRubricDefinitionStatus = "draft" | "published" | "archived";
export type HarnessDatasetSourceKind =
  | "reviewed_case_snapshot"
  | "human_final_asset"
  | "evaluation_evidence_pack";
export type HarnessDatasetExportFormat = "json" | "jsonl";
export type HarnessDatasetPublicationStatus = "succeeded" | "failed";

export interface HarnessGoldSetFamilyScopeRecord {
  module: TemplateModule;
  manuscript_types: ManuscriptType[];
  measure_focus: string;
  template_family_id?: string;
}

export interface HarnessGoldSetFamilyRecord {
  id: string;
  name: string;
  description?: string;
  scope: HarnessGoldSetFamilyScopeRecord;
  admin_only: true;
  created_at: string;
  updated_at: string;
}

export interface HarnessGoldSetItemRecord {
  source_kind: HarnessDatasetSourceKind;
  source_id: string;
  manuscript_id: string;
  manuscript_type: ManuscriptType;
  deidentification_passed: boolean;
  human_reviewed: boolean;
  risk_tags?: string[];
  expected_structured_output?: Record<string, unknown>;
}

export interface HarnessGoldSetVersionRecord {
  id: string;
  family_id: string;
  version_no: number;
  status: HarnessGoldSetVersionStatus;
  rubric_definition_id?: string;
  item_count: number;
  deidentification_gate_passed: boolean;
  human_review_gate_passed: boolean;
  items: HarnessGoldSetItemRecord[];
  publication_notes?: string;
  created_by: string;
  created_at: string;
  published_by?: string;
  published_at?: string;
  archived_by?: string;
  archived_at?: string;
}

export interface HarnessRubricDefinitionScopeRecord {
  module: TemplateModule;
  manuscript_types: ManuscriptType[];
}

export interface HarnessRubricDimensionRecord {
  key: string;
  label: string;
  weight?: number;
}

export interface HarnessRubricDefinitionRecord {
  id: string;
  name: string;
  version_no: number;
  status: HarnessRubricDefinitionStatus;
  scope: HarnessRubricDefinitionScopeRecord;
  scoring_dimensions: HarnessRubricDimensionRecord[];
  hard_gate_rules?: string[];
  failure_anchors?: string[];
  borderline_examples?: string[];
  judge_prompt?: string;
  created_by: string;
  created_at: string;
  published_by?: string;
  published_at?: string;
  archived_by?: string;
  archived_at?: string;
}

export interface HarnessDatasetPublicationRecord {
  id: string;
  gold_set_version_id: string;
  export_format: HarnessDatasetExportFormat;
  status: HarnessDatasetPublicationStatus;
  output_uri?: string;
  deidentification_gate_passed: boolean;
  created_at: string;
}
