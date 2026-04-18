import type {
  EvaluationEvidencePack,
  EvaluationPromotionRecommendation,
  EvaluationRunItem,
  EvaluationSampleSet,
  FrozenExperimentBinding,
  VerificationCheckType,
} from "../src/index.js";

export const sampleSetStatusCheck: EvaluationSampleSet["status"] = "published";
export const bindingLaneCheck: FrozenExperimentBinding["lane"] = "candidate";
export const runItemFailureCheck: EvaluationRunItem["failure_kind"] =
  "regression_failed";
export const evidencePackStatusCheck: EvaluationEvidencePack["summary_status"] =
  "needs_review";
export const recommendationStatusCheck:
  EvaluationPromotionRecommendation["status"] = "recommended";
export const residualValidationCheckType: VerificationCheckType =
  "residual_issue_validation";
