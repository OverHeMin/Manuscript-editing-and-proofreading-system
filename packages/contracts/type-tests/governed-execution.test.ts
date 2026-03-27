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
export const hitSourceCheck: KnowledgeHitLog["match_source"] = "template_binding";
export const feedbackTypeCheck: HumanFeedbackRecord["feedback_type"] =
  "manual_confirmation";
export const sourceLinkCheck: LearningCandidateSourceLink["learning_candidate_id"] =
  "candidate-1";
export const snapshotModuleCheck: ModuleExecutionSnapshot["module"] = "editing";

type _ExecutionProfileStatusNotAny = Assert<
  NotAny<ModuleExecutionProfile["status"]>
>;
type _KnowledgeBindingRuleStatusNotAny = Assert<
  NotAny<KnowledgeBindingRule["status"]>
>;
type _KnowledgeHitLogSource = Assert<
  IsEqual<
    Extract<KnowledgeHitLog["match_source"], "template_binding" | "binding_rule">,
    "template_binding" | "binding_rule"
  >
>;
