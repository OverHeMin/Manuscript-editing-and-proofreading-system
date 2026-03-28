import type {
  HumanFeedbackRecord,
  KnowledgeBindingRule,
  KnowledgeHitLog,
  LearningCandidateSourceLink,
  ModuleExecutionProfile,
  ModuleExecutionSnapshot,
} from "../src/index.js";

type IsAny<T> = 0 extends 1 & T ? true : false;
type NotAny<T> = IsAny<T> extends true ? false : true;
type Assert<T extends true> = T;
type IsEqual<A, B> = (<T>() => T extends A ? 1 : 2) extends <
  T
>() => T extends B ? 1 : 2
  ? true
  : false;

export const executionProfileStatusCheck: ModuleExecutionProfile["status"] = "active";
export const bindingPurposeCheck: KnowledgeBindingRule["binding_purpose"] = "required";
export const hitSourceCheck: Extract<
  KnowledgeHitLog,
  { match_source: "template_binding" }
>["source"] = {
  type: "template_binding",
  id: "template-binding-1",
};
export const feedbackTypeCheck: HumanFeedbackRecord["feedback_type"] =
  "manual_confirmation";
export const sourceLinkCheck: LearningCandidateSourceLink["learning_candidate_id"] =
  "candidate-1";
export const snapshotModuleCheck: ModuleExecutionSnapshot["module"] = "editing";
export const profilePromptVersionCheck: ModuleExecutionProfile["prompt_template"] = {
  id: "prompt-1",
  version: "1.0.0",
};
export const profileSkillRefCheck: ModuleExecutionProfile["skill_packages"][number] = {
  id: "skill-1",
  version: "2.0.0",
};
export const snapshotModelVersionCheck: ModuleExecutionSnapshot["model"] = {
  id: "model-1",
  version: "2026-03",
};

type _ExecutionProfileStatusNotAny = Assert<
  NotAny<ModuleExecutionProfile["status"]>
>;
type _KnowledgeBindingRuleStatusNotAny = Assert<
  NotAny<KnowledgeBindingRule["status"]>
>;
type _ExecutionProfileTemplateVersionNotAny = Assert<
  NotAny<ModuleExecutionProfile["module_template"]>
>;
type _ExecutionProfileSkillVersionsNotAny = Assert<
  NotAny<ModuleExecutionProfile["skill_packages"]>
>;
type _KnowledgeHitLogSource = Assert<
  IsEqual<
    Extract<KnowledgeHitLog["match_source"], "template_binding" | "binding_rule">,
    "template_binding" | "binding_rule"
  >
>;
type _KnowledgeHitSourceShape = Assert<
  IsEqual<
    Extract<KnowledgeHitLog, { match_source: "binding_rule" }>["source"]["type"],
    "binding_rule"
  >
>;
