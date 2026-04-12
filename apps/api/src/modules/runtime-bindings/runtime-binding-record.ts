import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { TemplateModule } from "../templates/template-record.ts";

export type RuntimeBindingStatus = "draft" | "active" | "archived";

export interface RuntimeBindingRecord {
  id: string;
  module: TemplateModule;
  manuscript_type: ManuscriptType;
  template_family_id: string;
  runtime_id: string;
  sandbox_profile_id: string;
  agent_profile_id: string;
  tool_permission_policy_id: string;
  prompt_template_id: string;
  skill_package_ids: string[];
  quality_package_version_ids?: string[];
  execution_profile_id?: string;
  verification_check_profile_ids: string[];
  evaluation_suite_ids: string[];
  release_check_profile_id?: string;
  status: RuntimeBindingStatus;
  version: number;
}
