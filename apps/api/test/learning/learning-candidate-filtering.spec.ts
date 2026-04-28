import test from "node:test";
import assert from "node:assert/strict";
import { DocumentAssetService } from "../../src/modules/assets/document-asset-service.ts";
import { InMemoryDocumentAssetRepository } from "../../src/modules/assets/in-memory-document-asset-repository.ts";
import { InMemoryExecutionTrackingRepository } from "../../src/modules/execution-tracking/in-memory-execution-tracking-repository.ts";
import { FeedbackGovernanceService } from "../../src/modules/feedback-governance/feedback-governance-service.ts";
import { InMemoryFeedbackGovernanceRepository } from "../../src/modules/feedback-governance/in-memory-feedback-governance-repository.ts";
import {
  InMemoryLearningCandidateRepository,
  InMemoryReviewedCaseSnapshotRepository,
} from "../../src/modules/learning/in-memory-learning-repository.ts";
import { createLearningApi } from "../../src/modules/learning/learning-api.ts";
import { LearningService } from "../../src/modules/learning/learning-service.ts";
import { InMemoryManuscriptRepository } from "../../src/modules/manuscripts/in-memory-manuscript-repository.ts";

function createHarness() {
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const assetRepository = new InMemoryDocumentAssetRepository();
  const snapshotRepository = new InMemoryReviewedCaseSnapshotRepository();
  const candidateRepository = new InMemoryLearningCandidateRepository();
  const feedbackGovernanceRepository = new InMemoryFeedbackGovernanceRepository();
  const executionTrackingRepository = new InMemoryExecutionTrackingRepository();
  const documentAssetService = new DocumentAssetService({
    assetRepository,
    manuscriptRepository,
    createId: () => "asset-generated",
    now: () => new Date("2026-04-28T09:00:00.000Z"),
  });
  const feedbackGovernanceService = new FeedbackGovernanceService({
    repository: feedbackGovernanceRepository,
    executionTrackingRepository,
    assetRepository,
    reviewedCaseSnapshotRepository: snapshotRepository,
  });
  const learningService = new LearningService({
    manuscriptRepository,
    assetRepository,
    snapshotRepository,
    candidateRepository,
    documentAssetService,
    feedbackGovernanceService,
  });

  return {
    api: createLearningApi({ learningService }),
    candidateRepository,
  };
}

test("learning api filters pending proofreading knowledge candidates for the target workbench", async () => {
  const { api, candidateRepository } = createHarness();
  await candidateRepository.save({
    id: "candidate-knowledge-proofreading",
    type: "knowledge_candidate",
    status: "pending_review",
    manuscript_id: "manuscript-1",
    module: "proofreading",
    manuscript_type: "clinical_study",
    title: "Table note knowledge",
    proposal_text: "Turn table note handling into reusable knowledge.",
    created_by: "proofreader-1",
    created_at: "2026-04-28T08:00:00.000Z",
    updated_at: "2026-04-28T08:00:00.000Z",
  });
  await candidateRepository.save({
    id: "candidate-rule-proofreading",
    type: "rule_candidate",
    status: "pending_review",
    manuscript_id: "manuscript-1",
    module: "proofreading",
    manuscript_type: "clinical_study",
    created_by: "proofreader-1",
    created_at: "2026-04-28T08:01:00.000Z",
    updated_at: "2026-04-28T08:01:00.000Z",
  });
  await candidateRepository.save({
    id: "candidate-knowledge-editing-approved",
    type: "knowledge_candidate",
    status: "approved",
    manuscript_id: "manuscript-2",
    module: "editing",
    manuscript_type: "review",
    created_by: "editor-1",
    created_at: "2026-04-28T08:02:00.000Z",
    updated_at: "2026-04-28T08:02:00.000Z",
  });

  const response = await api.listLearningCandidates({
    type: "knowledge_candidate",
    status: "pending_review",
    module: "proofreading",
    manuscriptId: "manuscript-1",
  });

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.map((candidate) => candidate.id),
    ["candidate-knowledge-proofreading"],
  );
});
