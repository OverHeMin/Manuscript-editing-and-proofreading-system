import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import { createLearningApi } from "../../src/modules/learning/learning-api.ts";
import { FeedbackGovernanceService } from "../../src/modules/feedback-governance/feedback-governance-service.ts";
import { InMemoryFeedbackGovernanceRepository } from "../../src/modules/feedback-governance/in-memory-feedback-governance-repository.ts";
import { InMemoryExecutionTrackingRepository } from "../../src/modules/execution-tracking/in-memory-execution-tracking-repository.ts";
import {
  LearningAnnotatedAssetMismatchError,
  LearningAnnotatedAssetNotFoundError,
  LearningDeidentificationRequiredError,
  LearningCandidateGovernedProvenanceRequiredError,
  LearningHumanFinalAssetRequiredError,
  LearningSnapshotDeidentificationRequiredError,
  LearningService,
} from "../../src/modules/learning/learning-service.ts";
import {
  InMemoryLearningCandidateRepository,
  InMemoryReviewedCaseSnapshotRepository,
} from "../../src/modules/learning/in-memory-learning-repository.ts";
import type { ReviewedCaseSnapshotRecord } from "../../src/modules/learning/learning-record.ts";
import { DocumentAssetService } from "../../src/modules/assets/document-asset-service.ts";
import { InMemoryDocumentAssetRepository } from "../../src/modules/assets/in-memory-document-asset-repository.ts";
import { InMemoryManuscriptRepository } from "../../src/modules/manuscripts/in-memory-manuscript-repository.ts";

const BEFORE_HEADING = "\u6458\u8981 \u76ee\u7684";
const AFTER_HEADING = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09";

class FailingReviewedCaseSnapshotRepository extends InMemoryReviewedCaseSnapshotRepository {
  constructor(
    private readonly shouldFail: (record: ReviewedCaseSnapshotRecord) => boolean,
  ) {
    super();
  }

  override async save(record: ReviewedCaseSnapshotRecord): Promise<void> {
    if (this.shouldFail(record)) {
      throw new Error("Injected reviewed case snapshot persistence failure.");
    }

    await super.save(record);
  }
}

function createLearningHarness(options?: {
  snapshotRepository?: InMemoryReviewedCaseSnapshotRepository;
  candidateRepository?: InMemoryLearningCandidateRepository;
}) {
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const assetRepository = new InMemoryDocumentAssetRepository();
  const feedbackGovernanceRepository = new InMemoryFeedbackGovernanceRepository();
  const executionTrackingRepository = new InMemoryExecutionTrackingRepository();
  const snapshotRepository =
    options?.snapshotRepository ?? new InMemoryReviewedCaseSnapshotRepository();
  const candidateRepository =
    options?.candidateRepository ?? new InMemoryLearningCandidateRepository();
  const issuedIds = [
    "asset-1",
    "asset-2",
    "asset-3",
    "reviewed-snapshot-1",
    "candidate-1",
    "asset-4",
    "reviewed-snapshot-2",
    "candidate-2",
  ];
  const nextId = () => {
    const value = issuedIds.shift();
    assert.ok(value, "Expected a learning test id to be available.");
    return value;
  };

  const documentAssetService = new DocumentAssetService({
    assetRepository,
    manuscriptRepository,
    createId: nextId,
    now: () => new Date("2026-03-27T10:00:00.000Z"),
  });
  const feedbackGovernanceService = new FeedbackGovernanceService({
    repository: feedbackGovernanceRepository,
    executionTrackingRepository,
    assetRepository,
    createId: (() => {
      const ids = ["feedback-1", "link-1", "feedback-2", "link-2"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a feedback governance test id to be available.");
        return value;
      };
    })(),
    now: () => new Date("2026-03-27T10:05:00.000Z"),
  });
  const learningService = new LearningService({
    manuscriptRepository,
    assetRepository,
    snapshotRepository,
    candidateRepository,
    documentAssetService,
    feedbackGovernanceService,
    createId: nextId,
    now: () => new Date("2026-03-27T10:00:00.000Z"),
  });

  return {
    manuscriptRepository,
    assetRepository,
    candidateRepository,
    documentAssetService,
    executionTrackingRepository,
    feedbackGovernanceService,
    learningService,
    learningApi: createLearningApi({
      learningService,
    }),
  };
}

async function seedLearningContext() {
  const harness = createLearningHarness();

  await harness.manuscriptRepository.save({
    id: "manuscript-1",
    title: "Learning Fixture",
    manuscript_type: "clinical_study",
    status: "completed",
    created_by: "user-1",
    current_screening_asset_id: undefined,
    current_editing_asset_id: undefined,
    current_proofreading_asset_id: undefined,
    current_template_family_id: "family-1",
    created_at: "2026-03-27T09:55:00.000Z",
    updated_at: "2026-03-27T09:55:00.000Z",
  });

  const originalAsset = await harness.documentAssetService.createAsset({
    manuscriptId: "manuscript-1",
    assetType: "original",
    storageKey: "uploads/manuscript-1/original.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "user-1",
    fileName: "original.docx",
    sourceModule: "upload",
  });

  return {
    ...harness,
    originalAsset,
  };
}

test("reviewed case snapshots require a human-final asset", async () => {
  const { learningApi, originalAsset } = await seedLearningContext();

  await assert.rejects(
    () =>
      learningApi.createReviewedCaseSnapshot({
        manuscriptId: "manuscript-1",
        module: "editing",
        manuscriptType: "clinical_study",
        humanFinalAssetId: originalAsset.id,
        deidentificationPassed: true,
        requestedBy: "editor-1",
        storageKey: "learning/manuscript-1/snapshot.bin",
      }),
    LearningHumanFinalAssetRequiredError,
  );
});

test("reviewed case snapshots require a de-identification pass", async () => {
  const { learningApi, documentAssetService, originalAsset } =
    await seedLearningContext();

  const humanFinalAsset = await documentAssetService.createAsset({
    manuscriptId: "manuscript-1",
    assetType: "human_final_docx",
    storageKey: "learning/manuscript-1/human-final.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "editor-1",
    fileName: "human-final.docx",
    parentAssetId: originalAsset.id,
    sourceModule: "manual",
  });

  await assert.rejects(
    () =>
      learningApi.createReviewedCaseSnapshot({
        manuscriptId: "manuscript-1",
        module: "editing",
        manuscriptType: "clinical_study",
        humanFinalAssetId: humanFinalAsset.id,
        deidentificationPassed: false,
        requestedBy: "editor-1",
        storageKey: "learning/manuscript-1/snapshot.bin",
      }),
    LearningSnapshotDeidentificationRequiredError,
  );
});

test("learning candidates require a de-identification pass", async () => {
  const { learningApi, documentAssetService, originalAsset } =
    await seedLearningContext();

  const humanFinalAsset = await documentAssetService.createAsset({
    manuscriptId: "manuscript-1",
    assetType: "human_final_docx",
    storageKey: "learning/manuscript-1/human-final.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "editor-1",
    fileName: "human-final.docx",
    parentAssetId: originalAsset.id,
    sourceModule: "manual",
  });

  const snapshot = await learningApi.createReviewedCaseSnapshot({
    manuscriptId: "manuscript-1",
    module: "editing",
    manuscriptType: "clinical_study",
    humanFinalAssetId: humanFinalAsset.id,
    deidentificationPassed: true,
    requestedBy: "editor-1",
    storageKey: "learning/manuscript-1/snapshot.bin",
  });

  await assert.rejects(
    () =>
      learningApi.createLearningCandidate({
        snapshotId: snapshot.body.id,
        type: "rule_candidate",
        title: "Terminology fix",
        proposalText: "Standardize trial terminology.",
        requestedBy: "editor-1",
        deidentificationPassed: false,
      }),
    LearningDeidentificationRequiredError,
  );
});

test("learning candidate approval is restricted to the dedicated learning review permission", async () => {
  const {
    learningApi,
    learningService,
    documentAssetService,
    executionTrackingRepository,
    feedbackGovernanceService,
    originalAsset,
  } =
    await seedLearningContext();

  const humanFinalAsset = await documentAssetService.createAsset({
    manuscriptId: "manuscript-1",
    assetType: "human_final_docx",
    storageKey: "learning/manuscript-1/human-final.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "editor-1",
    fileName: "human-final.docx",
    parentAssetId: originalAsset.id,
    sourceModule: "manual",
  });

  const snapshot = await learningApi.createReviewedCaseSnapshot({
    manuscriptId: "manuscript-1",
    module: "editing",
    manuscriptType: "clinical_study",
    humanFinalAssetId: humanFinalAsset.id,
    deidentificationPassed: true,
    requestedBy: "editor-1",
    storageKey: "learning/manuscript-1/snapshot.bin",
  });
  const candidate = await learningApi.createLearningCandidate({
    snapshotId: snapshot.body.id,
    type: "rule_candidate",
    title: "Terminology fix",
    proposalText: "Standardize trial terminology.",
    requestedBy: "editor-1",
    deidentificationPassed: true,
  });

  await seedGovernedExecutionSnapshot(executionTrackingRepository);

  await assert.rejects(
    () =>
      learningApi.approveLearningCandidate({
        candidateId: candidate.body.id,
        actorRole: "editor",
      }),
    AuthorizationError,
  );

  const sourceAsset = await documentAssetService.createAsset({
    manuscriptId: "manuscript-1",
    assetType: "final_proof_annotated_docx",
    storageKey: "runs/manuscript-1/editing/annotated.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "editor-1",
    fileName: "annotated.docx",
    parentAssetId: humanFinalAsset.id,
    sourceModule: "editing",
    sourceJobId: "job-1",
  });
  const feedback = await feedbackGovernanceService.recordHumanFeedback({
    manuscriptId: "manuscript-1",
    module: "editing",
    snapshotId: "execution-snapshot-1",
    feedbackType: "manual_correction",
    feedbackText: "Normalize terminology according to the governed template.",
    createdBy: "editor-1",
  });
  await learningService.attachGovernedSource({
    candidateId: candidate.body.id,
    snapshotId: "execution-snapshot-1",
    feedbackRecordId: feedback.id,
    sourceAssetId: sourceAsset.id,
  });

  const reviewerApproved = await learningApi.approveLearningCandidate({
    candidateId: candidate.body.id,
    actorRole: "admin",
  });

  assert.equal(reviewerApproved.status, 200);
  assert.equal(reviewerApproved.body.status, "approved");
});

test("learning candidates stay draft until governed provenance is attached", async () => {
  const {
    learningApi,
    learningService,
    candidateRepository,
    documentAssetService,
    executionTrackingRepository,
    feedbackGovernanceService,
    originalAsset,
  } = await seedLearningContext();

  const humanFinalAsset = await documentAssetService.createAsset({
    manuscriptId: "manuscript-1",
    assetType: "human_final_docx",
    storageKey: "learning/manuscript-1/human-final.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "editor-1",
    fileName: "human-final.docx",
    parentAssetId: originalAsset.id,
    sourceModule: "manual",
  });

  const reviewedSnapshot = await learningApi.createReviewedCaseSnapshot({
    manuscriptId: "manuscript-1",
    module: "editing",
    manuscriptType: "clinical_study",
    humanFinalAssetId: humanFinalAsset.id,
    deidentificationPassed: true,
    requestedBy: "editor-1",
    storageKey: "learning/manuscript-1/snapshot.bin",
  });
  const candidate = await learningApi.createLearningCandidate({
    snapshotId: reviewedSnapshot.body.id,
    type: "rule_candidate",
    title: "Terminology fix",
    proposalText: "Replace outdated disease naming with the current standard.",
    requestedBy: "editor-1",
    deidentificationPassed: true,
  });

  assert.equal(candidate.body.status, "draft");

  await assert.rejects(
    () =>
      learningApi.approveLearningCandidate({
        candidateId: candidate.body.id,
        actorRole: "knowledge_reviewer",
      }),
    LearningCandidateGovernedProvenanceRequiredError,
  );

  await seedGovernedExecutionSnapshot(executionTrackingRepository);

  const sourceAsset = await documentAssetService.createAsset({
    manuscriptId: "manuscript-1",
    assetType: "final_proof_annotated_docx",
    storageKey: "runs/manuscript-1/editing/annotated.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "editor-1",
    fileName: "annotated.docx",
    parentAssetId: humanFinalAsset.id,
    sourceModule: "editing",
    sourceJobId: "job-1",
  });
  const feedback = await feedbackGovernanceService.recordHumanFeedback({
    manuscriptId: "manuscript-1",
    module: "editing",
    snapshotId: "execution-snapshot-1",
    feedbackType: "manual_correction",
    feedbackText: "The governed editing output was adjusted by the reviewer.",
    createdBy: "editor-1",
  });

  const sourceLink = await learningService.attachGovernedSource({
    candidateId: candidate.body.id,
    snapshotId: "execution-snapshot-1",
    feedbackRecordId: feedback.id,
    sourceAssetId: sourceAsset.id,
  });
  const storedCandidate = await candidateRepository.findById(candidate.body.id);

  assert.equal(sourceLink.learning_candidate_id, candidate.body.id);
  assert.equal(storedCandidate?.status, "pending_review");

  const approved = await learningApi.approveLearningCandidate({
    candidateId: candidate.body.id,
    actorRole: "knowledge_reviewer",
  });

  assert.equal(approved.body.status, "approved");
});

test("learning candidates persist structured rule payloads and suggested editorial scope", async () => {
  const { learningApi, documentAssetService, originalAsset } =
    await seedLearningContext();

  const humanFinalAsset = await documentAssetService.createAsset({
    manuscriptId: "manuscript-1",
    assetType: "human_final_docx",
    storageKey: "learning/manuscript-1/human-final.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "editor-1",
    fileName: "human-final.docx",
    parentAssetId: originalAsset.id,
    sourceModule: "manual",
  });

  const snapshot = await learningApi.createReviewedCaseSnapshot({
    manuscriptId: "manuscript-1",
    module: "editing",
    manuscriptType: "clinical_study",
    humanFinalAssetId: humanFinalAsset.id,
    deidentificationPassed: true,
    requestedBy: "editor-1",
    storageKey: "learning/manuscript-1/snapshot.bin",
  });
  const candidate = await learningApi.createLearningCandidate({
    snapshotId: snapshot.body.id,
    type: "rule_candidate",
    title: "Abstract heading normalization",
    proposalText: "Normalize abstract objective headings to the journal style.",
    requestedBy: "editor-1",
    deidentificationPassed: true,
    candidatePayload: {
      scope: {
        sections: ["abstract"],
      },
      selector: {
        section_selector: "abstract",
        label_selector: {
          text: BEFORE_HEADING,
        },
      },
      trigger: {
        kind: "exact_text",
        text: BEFORE_HEADING,
      },
      action: {
        kind: "replace_heading",
        to: AFTER_HEADING,
      },
    },
    suggestedRuleObject: "abstract",
    suggestedTemplateFamilyId: "family-1",
    suggestedJournalTemplateId: "journal-template-1",
  });

  assert.deepEqual(candidate.body.candidate_payload, {
    scope: {
      sections: ["abstract"],
    },
    selector: {
      section_selector: "abstract",
      label_selector: {
        text: BEFORE_HEADING,
      },
    },
    trigger: {
      kind: "exact_text",
      text: BEFORE_HEADING,
    },
    action: {
      kind: "replace_heading",
      to: AFTER_HEADING,
    },
  });
  assert.equal(candidate.body.suggested_rule_object, "abstract");
  assert.equal(candidate.body.suggested_template_family_id, "family-1");
  assert.equal(candidate.body.suggested_journal_template_id, "journal-template-1");
});

test("reviewed case snapshot creation rolls back the snapshot asset on persistence failure", async () => {
  const snapshotRepository = new FailingReviewedCaseSnapshotRepository(() => true);
  const { learningApi, documentAssetService, assetRepository, originalAsset } =
    await seedLearningContextWithOverrides({
      snapshotRepository,
    });

  const humanFinalAsset = await documentAssetService.createAsset({
    manuscriptId: "manuscript-1",
    assetType: "human_final_docx",
    storageKey: "learning/manuscript-1/human-final.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "editor-1",
    fileName: "human-final.docx",
    parentAssetId: originalAsset.id,
    sourceModule: "manual",
  });

  await assert.rejects(
    () =>
      learningApi.createReviewedCaseSnapshot({
        manuscriptId: "manuscript-1",
        module: "editing",
        manuscriptType: "clinical_study",
        humanFinalAssetId: humanFinalAsset.id,
        deidentificationPassed: true,
        requestedBy: "editor-1",
        storageKey: "learning/manuscript-1/snapshot.bin",
      }),
    /snapshot persistence failure/i,
  );

  const snapshotAssets = await assetRepository.listByManuscriptIdAndType(
    "manuscript-1",
    "learning_snapshot_attachment",
  );

  assert.deepEqual(snapshotAssets, []);
});

test("reviewed case snapshots persist the manuscript type from the stored manuscript record", async () => {
  const { learningApi, documentAssetService, originalAsset } =
    await seedLearningContext();

  const humanFinalAsset = await documentAssetService.createAsset({
    manuscriptId: "manuscript-1",
    assetType: "human_final_docx",
    storageKey: "learning/manuscript-1/human-final.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "editor-1",
    fileName: "human-final.docx",
    parentAssetId: originalAsset.id,
    sourceModule: "manual",
  });

  const snapshot = await learningApi.createReviewedCaseSnapshot({
    manuscriptId: "manuscript-1",
    module: "editing",
    manuscriptType: "other",
    humanFinalAssetId: humanFinalAsset.id,
    deidentificationPassed: true,
    requestedBy: "editor-1",
    storageKey: "learning/manuscript-1/snapshot.bin",
  });

  assert.equal(snapshot.body.manuscript_type, "clinical_study");
});

test("reviewed case snapshots reject annotated assets that do not belong to the same manuscript", async () => {
  const { learningApi, manuscriptRepository, documentAssetService, originalAsset } =
    await seedLearningContext();

  await manuscriptRepository.save({
    id: "manuscript-2",
    title: "Foreign Fixture",
    manuscript_type: "review",
    status: "completed",
    created_by: "user-2",
    current_screening_asset_id: undefined,
    current_editing_asset_id: undefined,
    current_proofreading_asset_id: undefined,
    current_template_family_id: "family-2",
    created_at: "2026-03-27T09:56:00.000Z",
    updated_at: "2026-03-27T09:56:00.000Z",
  });

  const humanFinalAsset = await documentAssetService.createAsset({
    manuscriptId: "manuscript-1",
    assetType: "human_final_docx",
    storageKey: "learning/manuscript-1/human-final.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "editor-1",
    fileName: "human-final.docx",
    parentAssetId: originalAsset.id,
    sourceModule: "manual",
  });
  const foreignOriginalAsset = await documentAssetService.createAsset({
    manuscriptId: "manuscript-2",
    assetType: "original",
    storageKey: "uploads/manuscript-2/original.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "user-2",
    fileName: "foreign.docx",
    sourceModule: "upload",
  });

  await assert.rejects(
    () =>
      learningApi.createReviewedCaseSnapshot({
        manuscriptId: "manuscript-1",
        module: "editing",
        manuscriptType: "clinical_study",
        humanFinalAssetId: humanFinalAsset.id,
        annotatedAssetId: foreignOriginalAsset.id,
        deidentificationPassed: true,
        requestedBy: "editor-1",
        storageKey: "learning/manuscript-1/snapshot.bin",
      }),
    LearningAnnotatedAssetMismatchError,
  );

  await assert.rejects(
    () =>
      learningApi.createReviewedCaseSnapshot({
        manuscriptId: "manuscript-1",
        module: "editing",
        manuscriptType: "clinical_study",
        humanFinalAssetId: humanFinalAsset.id,
        annotatedAssetId: "missing-annotated-asset",
        deidentificationPassed: true,
        requestedBy: "editor-1",
        storageKey: "learning/manuscript-1/snapshot.bin",
      }),
    LearningAnnotatedAssetNotFoundError,
  );
});

async function seedLearningContextWithOverrides(options?: {
  snapshotRepository?: InMemoryReviewedCaseSnapshotRepository;
  candidateRepository?: InMemoryLearningCandidateRepository;
}) {
  const harness = createLearningHarness(options);

  await harness.manuscriptRepository.save({
    id: "manuscript-1",
    title: "Learning Fixture",
    manuscript_type: "clinical_study",
    status: "completed",
    created_by: "user-1",
    current_screening_asset_id: undefined,
    current_editing_asset_id: undefined,
    current_proofreading_asset_id: undefined,
    current_template_family_id: "family-1",
    created_at: "2026-03-27T09:55:00.000Z",
    updated_at: "2026-03-27T09:55:00.000Z",
  });

  const originalAsset = await harness.documentAssetService.createAsset({
    manuscriptId: "manuscript-1",
    assetType: "original",
    storageKey: "uploads/manuscript-1/original.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "user-1",
    fileName: "original.docx",
    sourceModule: "upload",
  });

  return {
    ...harness,
    originalAsset,
  };
}

async function seedGovernedExecutionSnapshot(
  executionTrackingRepository: InMemoryExecutionTrackingRepository,
) {
  await executionTrackingRepository.saveSnapshot({
    id: "execution-snapshot-1",
    manuscript_id: "manuscript-1",
    module: "editing",
    job_id: "job-1",
    execution_profile_id: "profile-1",
    module_template_id: "template-1",
    module_template_version_no: 1,
    prompt_template_id: "prompt-1",
    prompt_template_version: "1.0.0",
    skill_package_ids: ["skill-1"],
    skill_package_versions: ["1.0.0"],
    model_id: "model-1",
    knowledge_item_ids: ["knowledge-1"],
    created_asset_ids: ["asset-1"],
    created_at: "2026-03-27T09:59:00.000Z",
  });
}
