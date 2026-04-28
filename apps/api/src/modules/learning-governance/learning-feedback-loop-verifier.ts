export interface LearningFeedbackLoopResidualIssueInput {
  id: string;
  status: string;
  learningCandidateId?: string;
  signalBreakdown?: {
    promotion_evidence?: {
      source?: string;
    };
  };
}

export interface LearningFeedbackLoopCandidateInput {
  id: string;
  status: "draft" | "pending_review" | "approved" | "rejected" | "archived";
}

export interface LearningFeedbackLoopWritebackInput {
  id: string;
  status: "draft" | "applied" | "archived";
  targetType: string;
  createdDraftAssetId?: string;
}

export interface LearningFeedbackLoopVerificationInput {
  residualIssue: LearningFeedbackLoopResidualIssueInput;
  learningCandidate?: LearningFeedbackLoopCandidateInput;
  writeback?: LearningFeedbackLoopWritebackInput;
  laterProofreadingContext?: {
    knowledgeItemIds: string[];
    ruleIds: string[];
  };
  goldSetCoverage?: {
    beforeHitCount: number;
    afterHitCount: number;
    noRegressionExplanation?: string;
  };
}

export interface LearningFeedbackLoopVerificationResult {
  status: "closed" | "blocked";
  stageStatus: {
    detected: boolean;
    humanConfirmed: boolean;
    candidateCreated: boolean;
    approved: boolean;
    activated: boolean;
  };
  failedGateIds: string[];
  activatedKnowledgeItemIds: string[];
  activatedRuleIds: string[];
  coverageDelta: number;
  noRegressionExplanation?: string;
}

export class LearningFeedbackLoopVerifier {
  evaluate(
    input: LearningFeedbackLoopVerificationInput,
  ): LearningFeedbackLoopVerificationResult {
    const detected = Boolean(input.residualIssue.id);
    const humanConfirmed =
      input.residualIssue.signalBreakdown?.promotion_evidence?.source ===
      "proofreading_confirmation";
    const candidateCreated =
      input.residualIssue.status === "candidate_created" &&
      Boolean(input.residualIssue.learningCandidateId);
    const approved = input.learningCandidate?.status === "approved";
    const activated =
      approved &&
      input.writeback?.status === "applied" &&
      Boolean(input.writeback.createdDraftAssetId) &&
      isActivatedInLaterContext(input);
    const coverageDelta =
      (input.goldSetCoverage?.afterHitCount ?? 0) -
      (input.goldSetCoverage?.beforeHitCount ?? 0);
    const noRegressionExplanation =
      input.goldSetCoverage?.noRegressionExplanation?.trim();

    const failedGateIds: string[] = [];
    if (!detected) {
      failedGateIds.push("residual_not_detected");
    }
    if (!candidateCreated) {
      failedGateIds.push("candidate_not_created");
    }
    if (input.learningCandidate?.status === "rejected") {
      failedGateIds.push("candidate_rejected");
    } else if (!approved) {
      failedGateIds.push("candidate_not_approved");
    }
    if (!activated) {
      failedGateIds.push("activation_not_observed");
    }
    if (activated && coverageDelta <= 0 && !noRegressionExplanation) {
      failedGateIds.push("no_regression_explanation_required");
    }

    return {
      status: failedGateIds.length ? "blocked" : "closed",
      stageStatus: {
        detected,
        humanConfirmed,
        candidateCreated,
        approved,
        activated,
      },
      failedGateIds,
      activatedKnowledgeItemIds: activated
        ? matchingActivatedKnowledgeItemIds(input)
        : [],
      activatedRuleIds: activated ? matchingActivatedRuleIds(input) : [],
      coverageDelta,
      ...(noRegressionExplanation ? { noRegressionExplanation } : {}),
    };
  }
}

function isActivatedInLaterContext(
  input: LearningFeedbackLoopVerificationInput,
): boolean {
  if (!input.writeback?.createdDraftAssetId) {
    return false;
  }

  return (
    input.laterProofreadingContext?.knowledgeItemIds.includes(
      input.writeback.createdDraftAssetId,
    ) ||
    input.laterProofreadingContext?.ruleIds.includes(
      input.writeback.createdDraftAssetId,
    ) ||
    false
  );
}

function matchingActivatedKnowledgeItemIds(
  input: LearningFeedbackLoopVerificationInput,
): string[] {
  const createdDraftAssetId = input.writeback?.createdDraftAssetId;
  if (!createdDraftAssetId) {
    return [];
  }

  return input.laterProofreadingContext?.knowledgeItemIds.includes(
    createdDraftAssetId,
  )
    ? [createdDraftAssetId]
    : [];
}

function matchingActivatedRuleIds(
  input: LearningFeedbackLoopVerificationInput,
): string[] {
  const createdDraftAssetId = input.writeback?.createdDraftAssetId;
  if (!createdDraftAssetId) {
    return [];
  }

  return input.laterProofreadingContext?.ruleIds.includes(createdDraftAssetId)
    ? [createdDraftAssetId]
    : [];
}
