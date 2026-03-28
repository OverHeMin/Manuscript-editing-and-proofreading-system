import type {
  LearningCandidate,
  LearningWriteback,
  LearningWritebackTarget,
} from "../src/index.js";

export const learningCandidateTypeCheck: LearningCandidate["type"] =
  "skill_update_candidate";
export const writebackTargetCheck: LearningWritebackTarget = "prompt_template";
export const writebackStatusCheck: LearningWriteback["status"] = "applied";
