import test from "node:test";
import assert from "node:assert/strict";
import {
  applyLearningReviewApprovalSuccess,
  createLearningReviewWorkbenchState,
  mergeLearningCandidateWritebackSummaries,
  reconcileLearningReviewQueue,
  resolveLearningReviewActionTargets,
  resolveLearningReviewActiveDraftWritebackId,
} from "../src/features/learning-review/learning-review-workbench-state.ts";
import type { LearningCandidateViewModel } from "../src/features/learning-review/types.ts";
import type { LearningWritebackViewModel } from "../src/features/learning-governance/types.ts";

const pendingOne: LearningCandidateViewModel = {
  id: "learning-pending-1",
  type: "rule_candidate",
  status: "pending_review",
  module: "editing",
  manuscript_type: "clinical_study",
  governed_provenance_kind: "evaluation_experiment",
  title: "Pending candidate one",
  proposal_text: "Normalize terminology.",
  created_by: "editor-1",
  created_at: "2026-03-29T08:00:00.000Z",
  updated_at: "2026-03-29T09:00:00.000Z",
};

const pendingTwo: LearningCandidateViewModel = {
  id: "learning-pending-2",
  type: "checklist_update_candidate",
  status: "pending_review",
  module: "proofreading",
  manuscript_type: "clinical_study",
  governed_provenance_kind: "evaluation_experiment",
  title: "Pending candidate two",
  proposal_text: "Add final checklist gate.",
  created_by: "editor-1",
  created_at: "2026-03-29T08:10:00.000Z",
  updated_at: "2026-03-29T09:10:00.000Z",
};

const pendingThree: LearningCandidateViewModel = {
  id: "learning-pending-3",
  type: "prompt_optimization_candidate",
  status: "pending_review",
  module: "screening",
  manuscript_type: "review",
  governed_provenance_kind: "evaluation_experiment",
  title: "Pending candidate three",
  proposal_text: "Tighten screening prompt.",
  created_by: "editor-1",
  created_at: "2026-03-29T08:20:00.000Z",
  updated_at: "2026-03-29T09:20:00.000Z",
};

const approvedOne: LearningCandidateViewModel = {
  ...pendingOne,
  id: "learning-approved-1",
  status: "approved",
  title: "Approved candidate one",
};

test("learning review approval removes the current candidate and auto-advances", () => {
  const state = createLearningReviewWorkbenchState({
    queue: [pendingOne, pendingTwo, pendingThree],
    activeCandidateId: "learning-pending-2",
  });

  const nextState = applyLearningReviewApprovalSuccess(state, "learning-pending-2");

  assert.deepEqual(
    nextState.queue.map((candidate) => candidate.id),
    ["learning-pending-1", "learning-pending-3"],
  );
  assert.equal(nextState.activeCandidateId, "learning-pending-3");
  assert.equal(nextState.selectedCandidate?.id, "learning-pending-3");
});

test("learning review queue reconciliation preserves the selected candidate when possible", () => {
  const state = createLearningReviewWorkbenchState({
    queue: [pendingOne, pendingTwo],
    activeCandidateId: "learning-pending-2",
  });

  const reconciled = reconcileLearningReviewQueue(state, [
    {
      ...pendingTwo,
      proposal_text: "Updated draft after reviewer note.",
      updated_at: "2026-03-29T10:00:00.000Z",
    },
    pendingThree,
  ]);

  assert.deepEqual(
    reconciled.queue.map((candidate) => candidate.id),
    ["learning-pending-2", "learning-pending-3"],
  );
  assert.equal(reconciled.activeCandidateId, "learning-pending-2");
  assert.equal(reconciled.selectedCandidate?.proposal_text, "Updated draft after reviewer note.");
});

test("learning review writeback summaries merge into candidate detail without mutating queue fields", () => {
  const writebacks: LearningWritebackViewModel[] = [
    {
      id: "writeback-1",
      learning_candidate_id: "learning-pending-1",
      target_type: "knowledge_item",
      status: "draft",
      created_by: "admin-1",
      created_at: "2026-03-29T11:00:00.000Z",
    },
  ];

  const merged = mergeLearningCandidateWritebackSummaries(pendingOne, writebacks);

  assert.equal(merged.id, pendingOne.id);
  assert.equal(merged.writeback_summaries?.length, 1);
  assert.equal(merged.writeback_summaries?.[0]?.id, "writeback-1");
  assert.equal(pendingOne.writeback_summaries, undefined);
});

test("learning review primary actions use the selected candidate for approval and approved handoff for writeback", () => {
  const pendingTargets = resolveLearningReviewActionTargets({
    selectedCandidate: pendingTwo,
    approvedCandidate: null,
  });

  assert.equal(pendingTargets.approvalCandidate?.id, "learning-pending-2");
  assert.equal(pendingTargets.writebackCandidate, null);

  const approvedTargets = resolveLearningReviewActionTargets({
    selectedCandidate: pendingThree,
    approvedCandidate: approvedOne,
  });

  assert.equal(approvedTargets.approvalCandidate?.id, "learning-pending-3");
  assert.equal(approvedTargets.writebackCandidate?.id, "learning-approved-1");
});

test("learning review apply action reuses the active draft writeback without manual id entry", () => {
  const writebacks: LearningWritebackViewModel[] = [
    {
      id: "writeback-draft-1",
      learning_candidate_id: "learning-approved-1",
      target_type: "knowledge_item",
      status: "draft",
      created_by: "admin-1",
      created_at: "2026-03-29T11:00:00.000Z",
    },
    {
      id: "writeback-applied-1",
      learning_candidate_id: "learning-approved-1",
      target_type: "knowledge_item",
      status: "applied",
      created_by: "admin-1",
      created_at: "2026-03-29T11:05:00.000Z",
    },
  ];

  assert.equal(
    resolveLearningReviewActiveDraftWritebackId(writebacks, ""),
    "writeback-draft-1",
  );
  assert.equal(
    resolveLearningReviewActiveDraftWritebackId(writebacks, "writeback-draft-1"),
    "writeback-draft-1",
  );
  assert.equal(
    resolveLearningReviewActiveDraftWritebackId(writebacks, "writeback-missing"),
    "writeback-draft-1",
  );
  assert.equal(
    resolveLearningReviewActiveDraftWritebackId(
      writebacks.filter((record) => record.status === "applied"),
      "",
    ),
    null,
  );
});
