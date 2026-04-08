import type { LearningWritebackViewModel } from "../learning-governance/types.ts";
import type { LearningCandidateViewModel } from "./types.ts";

export interface LearningReviewWorkbenchState {
  queue: LearningCandidateViewModel[];
  activeCandidateId: string | null;
  selectedCandidate: LearningCandidateViewModel | null;
}

export interface ResolveLearningReviewActionTargetsInput {
  selectedCandidate: LearningCandidateViewModel | null;
  approvedCandidate: LearningCandidateViewModel | null;
}

export interface LearningReviewActionTargets {
  approvalCandidate: LearningCandidateViewModel | null;
  writebackCandidate: LearningCandidateViewModel | null;
}

export interface CreateLearningReviewWorkbenchStateInput {
  queue?: readonly LearningCandidateViewModel[];
  activeCandidateId?: string | null;
}

export function createLearningReviewWorkbenchState(
  input: CreateLearningReviewWorkbenchStateInput = {},
): LearningReviewWorkbenchState {
  const queue = [...(input.queue ?? [])];
  const selectedCandidate = resolveLearningReviewActiveCandidate(
    queue,
    input.activeCandidateId ?? null,
  );

  return {
    queue,
    activeCandidateId: selectedCandidate?.id ?? null,
    selectedCandidate,
  };
}

export function resolveLearningReviewActiveCandidate(
  queue: readonly LearningCandidateViewModel[],
  activeCandidateId: string | null,
): LearningCandidateViewModel | null {
  if (queue.length === 0) {
    return null;
  }

  if (activeCandidateId == null) {
    return queue[0] ?? null;
  }

  return queue.find((candidate) => candidate.id === activeCandidateId) ?? queue[0] ?? null;
}

export function selectLearningReviewCandidate(
  state: LearningReviewWorkbenchState,
  candidateId: string,
): LearningReviewWorkbenchState {
  const selectedCandidate = resolveLearningReviewActiveCandidate(
    state.queue,
    candidateId,
  );

  return {
    ...state,
    activeCandidateId: selectedCandidate?.id ?? null,
    selectedCandidate,
  };
}

export function reconcileLearningReviewQueue(
  state: Pick<LearningReviewWorkbenchState, "activeCandidateId">,
  queue: readonly LearningCandidateViewModel[],
): LearningReviewWorkbenchState {
  return createLearningReviewWorkbenchState({
    queue,
    activeCandidateId: state.activeCandidateId,
  });
}

export function resolveNextLearningReviewCandidateIdAfterApproval(
  previousQueue: readonly LearningCandidateViewModel[],
  nextQueue: readonly LearningCandidateViewModel[],
  approvedCandidateId: string,
): string | null {
  if (nextQueue.length === 0) {
    return null;
  }

  const currentIndex = previousQueue.findIndex(
    (candidate) => candidate.id === approvedCandidateId,
  );
  if (currentIndex < 0) {
    return nextQueue[0]?.id ?? null;
  }

  const candidateIds = [
    previousQueue[currentIndex + 1]?.id,
    previousQueue[currentIndex - 1]?.id,
  ];
  const nextIds = new Set(nextQueue.map((candidate) => candidate.id));
  const nextCandidateId = candidateIds.find((candidateId) =>
    candidateId == null ? false : nextIds.has(candidateId),
  );

  return nextCandidateId ?? nextQueue[0]?.id ?? null;
}

export function applyLearningReviewApprovalSuccess(
  state: LearningReviewWorkbenchState,
  approvedCandidateId: string,
): LearningReviewWorkbenchState {
  const nextQueue = state.queue.filter(
    (candidate) => candidate.id !== approvedCandidateId,
  );
  const nextCandidateId = resolveNextLearningReviewCandidateIdAfterApproval(
    state.queue,
    nextQueue,
    approvedCandidateId,
  );

  return createLearningReviewWorkbenchState({
    queue: nextQueue,
    activeCandidateId: nextCandidateId,
  });
}

export function mergeLearningCandidateWritebackSummaries(
  candidate: LearningCandidateViewModel,
  writebacks: readonly LearningWritebackViewModel[],
): LearningCandidateViewModel {
  return {
    ...candidate,
    writeback_summaries: writebacks.map((writeback) => ({ ...writeback })),
  };
}

export function resolveLearningReviewActionTargets(
  input: ResolveLearningReviewActionTargetsInput,
): LearningReviewActionTargets {
  const writebackCandidate =
    input.approvedCandidate?.status === "approved"
      ? input.approvedCandidate
      : input.selectedCandidate?.status === "approved"
        ? input.selectedCandidate
        : null;

  return {
    approvalCandidate: input.selectedCandidate,
    writebackCandidate,
  };
}

export function resolveLearningReviewActiveDraftWritebackId(
  writebacks: readonly LearningWritebackViewModel[],
  preferredWritebackId: string,
): string | null {
  const normalizedPreferredWritebackId = preferredWritebackId.trim();
  const preferredDraft =
    normalizedPreferredWritebackId.length === 0
      ? null
      : writebacks.find(
          (writeback) =>
            writeback.id === normalizedPreferredWritebackId &&
            writeback.status === "draft",
        ) ?? null;

  if (preferredDraft) {
    return preferredDraft.id;
  }

  return writebacks.find((writeback) => writeback.status === "draft")?.id ?? null;
}

export function resolveLearningCandidatePayload(
  candidate: LearningCandidateViewModel | null,
): Record<string, unknown> | null {
  if (!candidate?.candidate_payload) {
    return null;
  }

  return asRecord(candidate.candidate_payload) ?? null;
}

export function resolveLearningCandidateBeforeFragment(
  candidate: LearningCandidateViewModel | null,
): string | null {
  return resolveLearningCandidatePayloadText(candidate, "before_fragment");
}

export function resolveLearningCandidateAfterFragment(
  candidate: LearningCandidateViewModel | null,
): string | null {
  return resolveLearningCandidatePayloadText(candidate, "after_fragment");
}

export function resolveLearningCandidateEvidenceSummary(
  candidate: LearningCandidateViewModel | null,
): string | null {
  return resolveLearningCandidatePayloadText(candidate, "evidence_summary");
}

export function resolveLearningCandidateExtractionRationale(
  candidate: LearningCandidateViewModel | null,
): string | null {
  return (
    resolveLearningCandidatePayloadText(candidate, "extraction_rationale") ??
    candidate?.proposal_text?.trim() ??
    null
  );
}

export function resolveLearningCandidateSelectorSummary(
  candidate: LearningCandidateViewModel | null,
): string {
  const payload = resolveLearningCandidatePayload(candidate);
  const selector = asRecord(payload?.selector);

  return selector ? JSON.stringify(selector, null, 2) : "No selector proposed yet.";
}

function resolveLearningCandidatePayloadText(
  candidate: LearningCandidateViewModel | null,
  key: string,
): string | null {
  const payload = resolveLearningCandidatePayload(candidate);
  const value = payload?.[key];

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}
