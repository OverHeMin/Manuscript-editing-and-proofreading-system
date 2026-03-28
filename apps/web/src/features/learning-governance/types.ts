import type { AuthRole } from "../auth/roles.ts";
import type { ManuscriptType } from "../manuscripts/types.ts";
import type { TemplateModule } from "../templates/types.ts";

export type LearningWritebackTarget =
  | "knowledge_item"
  | "module_template"
  | "prompt_template"
  | "skill_package";

export type LearningWritebackStatus = "draft" | "applied" | "archived";

export interface LearningWritebackViewModel {
  id: string;
  learning_candidate_id: string;
  target_type: LearningWritebackTarget;
  status: LearningWritebackStatus;
  created_draft_asset_id?: string;
  created_by: string;
  created_at: string;
  applied_by?: string;
  applied_at?: string;
}

export interface CreateLearningWritebackInput {
  actorRole: AuthRole;
  learningCandidateId: string;
  targetType: LearningWritebackTarget;
  createdBy: string;
}

interface ApplyLearningWritebackBaseInput {
  actorRole: AuthRole;
  writebackId: string;
  targetType: LearningWritebackTarget;
  appliedBy: string;
}

export interface ApplyKnowledgeWritebackInput
  extends ApplyLearningWritebackBaseInput {
  targetType: "knowledge_item";
  title: string;
  canonicalText: string;
  summary?: string;
  knowledgeKind: "rule" | "case_pattern" | "checklist" | "prompt_snippet" | "reference" | "other";
  moduleScope: TemplateModule | "any";
  manuscriptTypes: ManuscriptType[] | "any";
  sections?: string[];
  riskTags?: string[];
  disciplineTags?: string[];
  evidenceLevel?: "low" | "medium" | "high" | "expert_opinion" | "unknown";
  sourceType?: "paper" | "guideline" | "book" | "website" | "internal_case" | "other";
  sourceLink?: string;
  aliases?: string[];
  templateBindings?: string[];
}

export interface ApplyModuleTemplateWritebackInput
  extends ApplyLearningWritebackBaseInput {
  targetType: "module_template";
  templateFamilyId: string;
  module: TemplateModule;
  manuscriptType: ManuscriptType;
  prompt: string;
  checklist?: string[];
  sectionRequirements?: string[];
}

export interface ApplyPromptTemplateWritebackInput
  extends ApplyLearningWritebackBaseInput {
  targetType: "prompt_template";
  name: string;
  version: string;
  module: TemplateModule;
  manuscriptTypes: ManuscriptType[] | "any";
  rollbackTargetVersion?: string;
}

export interface ApplySkillPackageWritebackInput
  extends ApplyLearningWritebackBaseInput {
  targetType: "skill_package";
  name: string;
  version: string;
  appliesToModules: TemplateModule[];
  dependencyTools?: string[];
}

export type ApplyLearningWritebackInput =
  | ApplyKnowledgeWritebackInput
  | ApplyModuleTemplateWritebackInput
  | ApplyPromptTemplateWritebackInput
  | ApplySkillPackageWritebackInput;
