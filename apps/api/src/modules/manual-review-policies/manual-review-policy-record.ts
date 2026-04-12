import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { TemplateModule } from "../templates/template-record.ts";

export type ManualReviewPolicyStatus = "draft" | "active" | "archived";

export interface ManualReviewPolicyRecord {
  id: string;
  module: TemplateModule;
  manuscript_type: ManuscriptType;
  template_family_id: string;
  name: string;
  min_confidence_threshold: number;
  high_risk_force_review: boolean;
  conflict_force_review: boolean;
  insufficient_knowledge_force_review: boolean;
  module_blocklist_rules?: string[];
  status: ManualReviewPolicyStatus;
  version: number;
}
