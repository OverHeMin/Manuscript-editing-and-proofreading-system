import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { TemplateModule } from "../templates/template-record.ts";

export type RetrievalPresetStatus = "draft" | "active" | "archived";

export interface RetrievalPresetRecord {
  id: string;
  module: TemplateModule;
  manuscript_type: ManuscriptType;
  template_family_id: string;
  name: string;
  top_k: number;
  section_filters?: string[];
  risk_tag_filters?: string[];
  rerank_enabled: boolean;
  citation_required: boolean;
  min_retrieval_score?: number;
  status: RetrievalPresetStatus;
  version: number;
}
