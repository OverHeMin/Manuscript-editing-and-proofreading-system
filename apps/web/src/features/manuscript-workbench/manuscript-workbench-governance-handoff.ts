import type { LearningCandidateViewModel } from "../learning-review/index.ts";
import type { ResidualReviewItemViewModel } from "../review-items/index.ts";

export interface ManuscriptWorkbenchProofreadingGovernanceHandoffViewModel {
  residualReviewItems: readonly ResidualReviewItemViewModel[];
  ruleCandidates: readonly LearningCandidateViewModel[];
  knowledgeCandidates: readonly LearningCandidateViewModel[];
}
