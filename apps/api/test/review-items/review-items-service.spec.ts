import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryEditorialRuleActivationMetricsRepository } from "../../src/modules/editorial-rules/in-memory-editorial-rule-activation-metrics-repository.ts";
import { InMemoryEditorialRuleRepository } from "../../src/modules/editorial-rules/in-memory-editorial-rule-repository.ts";
import { EditorialRuleActivationMetricsService } from "../../src/modules/editorial-rules/editorial-rule-activation-metrics-service.ts";
import { ReviewItemsService } from "../../src/modules/review-items/review-items-service.ts";
import type { GovernedHitReviewItemRecord } from "../../src/modules/review-items/review-item-record.ts";
import type { LearningCandidateRecord } from "../../src/modules/learning/learning-record.ts";
import type { ResidualIssueRecord } from "../../src/modules/residual-learning/residual-learning-record.ts";

function buildResidualIssue(
  overrides: Partial<ResidualIssueRecord> = {},
): ResidualIssueRecord {
  return {
    id: "residual-1",
    module: "proofreading",
    manuscript_id: "manuscript-1",
    manuscript_type: "clinical_study",
    execution_snapshot_id: "snapshot-1",
    issue_type: "terminology_gap",
    source_stage: "model_residual",
    excerpt: "HbA1c naming drift",
    suggestion: "Normalize the governed terminology before reuse.",
    rationale: "The wording still conflicts with the approved proofreading knowledge.",
    novelty_key: "proofreading:terminology_gap:hbA1c naming drift",
    recurrence_count: 1,
    system_confidence_band: "L1_review_pending",
    risk_level: "medium",
    recommended_route: "rule_candidate",
    status: "validation_failed",
    harness_validation_status: "failed",
    created_at: "2026-04-18T08:00:00.000Z",
    updated_at: "2026-04-18T08:00:00.000Z",
    ...overrides,
  };
}

function buildLearningCandidate(
  overrides: Partial<LearningCandidateRecord> = {},
): LearningCandidateRecord {
  return {
    id: "candidate-1",
    type: "rule_candidate",
    status: "pending_review",
    manuscript_id: "manuscript-1",
    module: "editing",
    manuscript_type: "clinical_study",
    governed_provenance_kind: "residual_issue",
    snapshot_asset_id: "asset-1",
    title: "Abstract heading normalization",
    proposal_text: "Normalize the abstract heading before publishing the rule.",
    created_by: "dev.knowledge-reviewer",
    created_at: "2026-04-18T07:58:00.000Z",
    updated_at: "2026-04-18T07:58:00.000Z",
    review_actions: [
      {
        action: "submitted_for_review",
        actor_role: "knowledge_reviewer",
        created_at: "2026-04-18T07:58:00.000Z",
      },
    ],
    ...overrides,
  };
}

function buildGovernedHit(
  overrides: Partial<GovernedHitReviewItemRecord> = {},
): GovernedHitReviewItemRecord {
  return {
    id: "governed-hit-1",
    source_kind: "governed_hit",
    source_status: "submitted",
    review_status: "pending",
    module: "editing",
    manuscript_id: "manuscript-1",
    manuscript_type: "clinical_study",
    snapshot_id: "snapshot-editing-1",
    source_asset_id: "asset-1",
    title: "Submit missed governed hit for review",
    summary: "Route this governed hit through the unified review queue first.",
    excerpt: "The governed heading should have been matched here.",
    created_at: "2026-04-18T08:35:00.000Z",
    updated_at: "2026-04-18T08:35:00.000Z",
    available_actions: [
      "accept_change_only",
      "reject_as_false_positive",
      "route_to_rule_candidate",
      "route_to_knowledge_candidate",
      "route_to_prompt_candidate",
      "archive_as_evidence_only",
    ],
    feedback_category: "missed_hit",
    feedback_record_id: "feedback-1",
    recommended_route: "rule_candidate",
    harness_validation_status: "not_required",
    created_by: "editor-1",
    candidate_posture: "inspect_only",
    decision_source: "execution_hit",
    evidence_pack: {
      location: {
        paragraph_index: 3,
      },
      excerpt: "The governed heading should have been matched here.",
      suggestion: "Normalize the governed heading before routing.",
      rationale: "Route this governed hit through the unified review queue first.",
    },
    ...overrides,
  };
}

test("review items service only exposes rule-governance residual issues and rule candidates in the rule-center queue", async () => {
  const governedHits = [
    buildGovernedHit(),
    buildGovernedHit({
      id: "governed-hit-routed",
      source_status: "routed_rule_candidate",
      review_status: "routed",
      updated_at: "2026-04-18T08:40:00.000Z",
      available_actions: [],
    }),
  ];
  const residualIssues = [
    buildResidualIssue({
      id: "residual-ready",
      status: "candidate_ready",
      harness_validation_status: "passed",
      updated_at: "2026-04-18T08:10:00.000Z",
      created_at: "2026-04-18T08:05:00.000Z",
    }),
    buildResidualIssue({
      id: "residual-validate",
      status: "validation_failed",
      harness_validation_status: "failed",
      updated_at: "2026-04-18T08:20:00.000Z",
      created_at: "2026-04-18T08:15:00.000Z",
    }),
    buildResidualIssue({
      id: "residual-manual",
      recommended_route: "manual_only",
      status: "manual_only",
      harness_validation_status: "not_required",
      updated_at: "2026-04-18T08:30:00.000Z",
      created_at: "2026-04-18T08:25:00.000Z",
    }),
    buildResidualIssue({
      id: "residual-knowledge",
      recommended_route: "knowledge_candidate",
      status: "candidate_ready",
      harness_validation_status: "passed",
      updated_at: "2026-04-18T08:32:00.000Z",
      created_at: "2026-04-18T08:31:00.000Z",
    }),
  ];
  const learningCandidates = [
    buildLearningCandidate({
      id: "candidate-pending",
      updated_at: "2026-04-18T08:08:00.000Z",
      created_at: "2026-04-18T08:07:00.000Z",
    }),
    buildLearningCandidate({
      id: "candidate-prompt",
      type: "prompt_optimization_candidate",
      updated_at: "2026-04-18T08:09:00.000Z",
      created_at: "2026-04-18T08:06:00.000Z",
    }),
    buildLearningCandidate({
      id: "candidate-knowledge",
      type: "knowledge_candidate",
      updated_at: "2026-04-18T08:09:30.000Z",
      created_at: "2026-04-18T08:06:30.000Z",
    }),
  ];

  const service = new ReviewItemsService({
    reviewItemsRepository: {
      async listGovernedHits() {
        return governedHits;
      },
      async findGovernedHitById() {
        throw new Error("not used");
      },
      async saveGovernedHit() {
        throw new Error("not used");
      },
    },
    residualLearningService: {
      async listIssues() {
        return residualIssues;
      },
    },
    learningService: {
      async listPendingReviewCandidates() {
        return learningCandidates;
      },
      async createHumanFeedbackGovernedLearningCandidate() {
        throw new Error("not used");
      },
      async approveLearningCandidate() {
        throw new Error("not used");
      },
      async rejectLearningCandidate() {
        throw new Error("not used");
      },
    },
  });

  const queue = await service.listReviewItems();

  assert.deepEqual(
    queue.map((item) => ({
      id: item.id,
      source_kind: item.source_kind,
      source_status: item.source_status,
      review_status: item.review_status,
      available_actions: item.available_actions,
      candidate_posture:
        item.source_kind === "governed_hit"
          ? (item as { candidate_posture?: string }).candidate_posture
          : undefined,
      decision_source:
        item.source_kind === "governed_hit"
          ? (item as { decision_source?: string }).decision_source
          : undefined,
    })),
    [
      {
        id: "governed-hit-1",
        source_kind: "governed_hit",
        source_status: "submitted",
        review_status: "pending",
        available_actions: [
          "accept_change_only",
          "reject_as_false_positive",
          "route_to_rule_candidate",
          "route_to_knowledge_candidate",
          "route_to_prompt_candidate",
          "archive_as_evidence_only",
        ],
        candidate_posture: "inspect_only",
        decision_source: "execution_hit",
      },
      {
        id: "residual-validate",
        source_kind: "residual_issue",
        source_status: "validation_failed",
        review_status: "pending",
        available_actions: [
          "validate",
          "accept_change_only",
          "reject_as_false_positive",
          "archive_as_evidence_only",
        ],
        candidate_posture: undefined,
        decision_source: undefined,
      },
      {
        id: "residual-ready",
        source_kind: "residual_issue",
        source_status: "candidate_ready",
        review_status: "pending",
        available_actions: [
          "accept_change_only",
          "reject_as_false_positive",
          "archive_as_evidence_only",
          "route_to_rule_candidate",
          "route_to_knowledge_candidate",
          "route_to_prompt_candidate",
        ],
        candidate_posture: undefined,
        decision_source: undefined,
      },
      {
        id: "candidate-pending",
        source_kind: "learning_candidate",
        source_status: "pending_review",
        review_status: "pending",
        available_actions: ["approve", "reject"],
        candidate_posture: undefined,
        decision_source: undefined,
      },
    ],
  );
  assert.equal(queue[0]?.title, "Submit missed governed hit for review");
  assert.equal(
    queue[2]?.summary,
    "The wording still conflicts with the approved proofreading knowledge.",
  );
  assert.deepEqual(
    (queue[0] as { evidence_pack?: Record<string, unknown> }).evidence_pack,
    {
      location: {
        paragraph_index: 3,
      },
      excerpt: "The governed heading should have been matched here.",
      suggestion: "Normalize the governed heading before routing.",
      rationale: "Route this governed hit through the unified review queue first.",
    },
  );
  assert.equal(queue[3]?.title, "Abstract heading normalization");
  assert.equal(queue[3]?.summary, "Normalize the abstract heading before publishing the rule.");
  assert.equal(
    queue.some((item) => item.id === "governed-hit-routed"),
    false,
  );
  assert.equal(
    queue.some((item) => item.id === "residual-manual"),
    false,
  );
  assert.equal(
    queue.some((item) => item.id === "residual-knowledge"),
    false,
  );
  assert.equal(
    queue.some((item) => item.id === "candidate-prompt"),
    false,
  );
  assert.equal(
    queue.some((item) => item.id === "candidate-knowledge"),
    false,
  );
});

test("review items service applies unified queue filters before returning items", async () => {
  const service = new ReviewItemsService({
    reviewItemsRepository: {
      async listGovernedHits() {
        return [
          buildGovernedHit({
            id: "governed-hit-filter-match",
            module: "editing",
            manuscript_id: "manuscript-filter-1",
            review_status: "pending",
            risk_level: "high",
          }),
          buildGovernedHit({
            id: "governed-hit-filter-miss",
            module: "proofreading",
            manuscript_id: "manuscript-filter-2",
            review_status: "pending",
            risk_level: "low",
          }),
        ];
      },
      async findGovernedHitById() {
        throw new Error("not used");
      },
      async saveGovernedHit() {
        throw new Error("not used");
      },
    },
    residualLearningService: {
      async listIssues() {
        return [
          buildResidualIssue({
            id: "residual-filter-match",
            module: "editing",
            manuscript_id: "manuscript-filter-1",
            risk_level: "high",
            status: "validation_failed",
            harness_validation_status: "failed",
            updated_at: "2026-04-18T08:12:00.000Z",
            created_at: "2026-04-18T08:11:00.000Z",
          }),
          buildResidualIssue({
            id: "residual-filter-miss",
            module: "proofreading",
            manuscript_id: "manuscript-filter-2",
            risk_level: "medium",
            status: "candidate_ready",
            harness_validation_status: "passed",
            updated_at: "2026-04-18T08:10:00.000Z",
            created_at: "2026-04-18T08:09:00.000Z",
          }),
        ];
      },
    },
    learningService: {
      async listPendingReviewCandidates() {
        return [
          buildLearningCandidate({
            id: "candidate-filter-match",
            module: "editing",
            manuscript_id: "manuscript-filter-1",
            updated_at: "2026-04-18T08:15:00.000Z",
            created_at: "2026-04-18T08:15:00.000Z",
          }),
          buildLearningCandidate({
            id: "candidate-filter-miss",
            module: "proofreading",
            manuscript_id: "manuscript-filter-2",
            updated_at: "2026-04-18T08:14:00.000Z",
            created_at: "2026-04-18T08:14:00.000Z",
          }),
        ];
      },
      async createHumanFeedbackGovernedLearningCandidate() {
        throw new Error("not used");
      },
      async approveLearningCandidate() {
        throw new Error("not used");
      },
      async rejectLearningCandidate() {
        throw new Error("not used");
      },
    },
  });

  const editingQueue = await service.listReviewItems({
    module: "editing",
    manuscriptId: "manuscript-filter-1",
    reviewStatus: "pending",
  });
  const governedQueue = await service.listReviewItems({
    sourceKind: "governed_hit",
    riskLevel: "high",
  });
  const residualQueue = await service.listReviewItems({
    sourceKind: "residual_issue",
    module: "editing",
    riskLevel: "high",
  });

  assert.deepEqual(
    editingQueue.map((item) => item.id),
    [
      "governed-hit-filter-match",
      "candidate-filter-match",
      "residual-filter-match",
    ],
  );
  assert.deepEqual(governedQueue.map((item) => item.id), [
    "governed-hit-filter-match",
  ]);
  assert.deepEqual(residualQueue.map((item) => item.id), [
    "residual-filter-match",
  ]);
});

test("review items service lazily creates a feedback record when routing an auto-recorded governed hit", async () => {
  let storedItem = buildGovernedHit({
    id: "governed-hit-auto-1",
    manuscript_id: "manuscript-auto-1",
    snapshot_id: "snapshot-auto-1",
    source_asset_id: "asset-auto-1",
    title: "Auto-recorded governed hit",
    summary: "A governed execution hit was auto-recorded before human routing.",
    created_by: "system:auto",
  });
  delete (storedItem as { feedback_record_id?: string }).feedback_record_id;

  let recordedFeedbackInput:
    | {
        manuscriptId: string;
        module: "screening" | "editing" | "proofreading";
        snapshotId: string;
        feedbackType:
          | "manual_confirmation"
          | "manual_correction"
          | "manual_rejection";
        feedbackText?: string;
        createdBy: string;
      }
    | undefined;
  let routedCandidateInput:
    | {
        snapshotId: string;
      feedbackRecordId: string;
      sourceAssetId: string;
      type: LearningCandidateRecord["type"];
      module: LearningCandidateRecord["module"];
      manuscriptType: string;
        requestedBy: string;
        requestedByRole?: string;
        title?: string;
        proposalText?: string;
        candidatePayload?: Record<string, unknown>;
      }
    | undefined;

  const service = new ReviewItemsService({
    reviewItemsRepository: {
      async listGovernedHits() {
        return [];
      },
      async findGovernedHitById(id) {
        return id === storedItem.id ? storedItem : undefined;
      },
      async saveGovernedHit(record) {
        storedItem = {
          ...record,
        };
      },
    },
    residualLearningService: {
      async listIssues() {
        return [];
      },
    },
    learningService: {
      async listPendingReviewCandidates() {
        return [];
      },
      async createHumanFeedbackGovernedLearningCandidate(input) {
        routedCandidateInput = {
          ...input,
          requestedByRole: input.requestedByRole,
          title: input.title,
          proposalText: input.proposalText,
          candidatePayload: input.candidatePayload,
        };
        return buildLearningCandidate({
          id: "candidate-auto-1",
          title: input.title ?? "candidate-auto-1",
          proposal_text: input.proposalText,
          module: input.module,
          manuscript_type: input.manuscriptType,
          created_by: input.requestedBy,
          governed_provenance_kind: "human_feedback",
        });
      },
      async approveLearningCandidate() {
        throw new Error("not used");
      },
      async rejectLearningCandidate() {
        throw new Error("not used");
      },
    },
    feedbackGovernanceService: {
      async recordHumanFeedback(input) {
        recordedFeedbackInput = {
          ...input,
        };
        return {
          id: "feedback-auto-1",
          manuscript_id: input.manuscriptId,
          module: input.module,
          snapshot_id: input.snapshotId,
          feedback_type: input.feedbackType,
          feedback_text: input.feedbackText,
          created_by: input.createdBy,
          created_at: "2026-04-18T08:45:00.000Z",
        };
      },
    },
  });

  const result = await service.decideReviewItem({
    sourceKind: "governed_hit",
    id: storedItem.id,
    action: "route_to_rule_candidate",
    requestedBy: "knowledge-reviewer-1",
    requestedByRole: "knowledge_reviewer",
  });

  assert.deepEqual(recordedFeedbackInput, {
    manuscriptId: "manuscript-auto-1",
    module: "editing",
    snapshotId: "snapshot-auto-1",
    feedbackType: "manual_rejection",
    feedbackText: "A governed execution hit was auto-recorded before human routing.",
    createdBy: "knowledge-reviewer-1",
  });
  assert.equal(routedCandidateInput?.feedbackRecordId, "feedback-auto-1");
  assert.equal(routedCandidateInput?.snapshotId, "snapshot-auto-1");
  assert.equal(routedCandidateInput?.sourceAssetId, "asset-auto-1");
  assert.equal(storedItem.feedback_record_id, "feedback-auto-1");
  assert.equal(storedItem.learning_candidate_id, "candidate-auto-1");
  assert.equal(storedItem.review_status, "routed");
  assert.equal(result.action, "route_to_rule_candidate");
  assert.equal(result.item?.id, "candidate-auto-1");
});

test("review items service uses a bound default createId when submitting governed hits", async () => {
  let savedItem: GovernedHitReviewItemRecord | undefined;

  const service = new ReviewItemsService({
    reviewItemsRepository: {
      async listGovernedHits() {
        return savedItem ? [savedItem] : [];
      },
      async findGovernedHitById(id) {
        return savedItem?.id === id ? savedItem : undefined;
      },
      async saveGovernedHit(record) {
        savedItem = {
          ...record,
        };
      },
    },
    residualLearningService: {
      async listIssues() {
        return [];
      },
    },
    learningService: {
      async listPendingReviewCandidates() {
        return [];
      },
      async createHumanFeedbackGovernedLearningCandidate() {
        throw new Error("not used");
      },
      async approveLearningCandidate() {
        throw new Error("not used");
      },
      async rejectLearningCandidate() {
        throw new Error("not used");
      },
    },
    feedbackGovernanceService: {
      async recordHumanFeedback(input) {
        return {
          id: "feedback-default-id-1",
          manuscript_id: input.manuscriptId,
          module: input.module,
          snapshot_id: input.snapshotId,
          feedback_type: input.feedbackType,
          feedback_text: input.feedbackText,
          created_by: input.createdBy,
          created_at: "2026-04-18T08:50:00.000Z",
        };
      },
    },
    now: () => new Date("2026-04-18T08:50:00.000Z"),
  });

  const result = await service.submitGovernedHit({
    manuscriptId: "manuscript-default-id-1",
    manuscriptType: "clinical_study",
    module: "proofreading",
    snapshotId: "snapshot-default-id-1",
    sourceAssetId: "asset-default-id-1",
    feedbackCategory: "missing_knowledge",
    feedbackText: "The proofreading run still needs a governed terminology basis.",
    createdBy: "knowledge-reviewer-1",
  });

  assert.match(
    result.item.id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  assert.equal(savedItem?.id, result.item.id);
});

test("review items service records governed-hit activation outcomes for false positives and routed rule candidates", async () => {
  const editorialRuleRepository = new InMemoryEditorialRuleRepository();
  await editorialRuleRepository.saveRuleSet({
    id: "rule-set-metric-1",
    template_family_id: "family-1",
    module: "editing",
    version_no: 1,
    status: "active",
  });
  await editorialRuleRepository.saveRule({
    id: "rule-metric-1",
    rule_set_id: "rule-set-metric-1",
    order_no: 10,
    rule_object: "abstract",
    rule_type: "format",
    execution_mode: "apply_and_inspect",
    scope: {
      sections: ["abstract"],
    },
    selector: {
      section_selector: "abstract",
    },
    trigger: {
      kind: "exact_text",
      text: "摘要 目的",
    },
    action: {
      kind: "replace_heading",
      to: "（摘要　目的）",
    },
    authoring_payload: {},
    confidence_policy: "manual_only",
    severity: "error",
    enabled: true,
  });
  const activationMetricsService = new EditorialRuleActivationMetricsService({
    repository: new InMemoryEditorialRuleActivationMetricsRepository(),
    editorialRuleRepository,
    now: () => new Date("2026-04-18T09:00:00.000Z"),
  });
  const governedHits = new Map<string, GovernedHitReviewItemRecord>();

  const service = new ReviewItemsService({
    reviewItemsRepository: {
      async listGovernedHits() {
        return [...governedHits.values()];
      },
      async findGovernedHitById(id) {
        return governedHits.get(id);
      },
      async saveGovernedHit(record) {
        governedHits.set(record.id, {
          ...record,
        });
      },
    },
    residualLearningService: {
      async listIssues() {
        return [];
      },
    },
    learningService: {
      async listPendingReviewCandidates() {
        return [];
      },
      async createHumanFeedbackGovernedLearningCandidate(input) {
        return buildLearningCandidate({
          id: "candidate-metric-1",
          module: input.module,
          manuscript_type: input.manuscriptType,
          created_by: input.requestedBy,
          title: input.title,
          proposal_text: input.proposalText,
          candidate_payload: input.candidatePayload,
          governed_provenance_kind: "human_feedback",
        });
      },
      async approveLearningCandidate() {
        throw new Error("not used");
      },
      async rejectLearningCandidate() {
        throw new Error("not used");
      },
    },
    feedbackGovernanceService: {
      async recordHumanFeedback(input) {
        return {
          id: `feedback:${input.snapshotId}`,
          manuscript_id: input.manuscriptId,
          module: input.module,
          snapshot_id: input.snapshotId,
          feedback_type: input.feedbackType,
          feedback_text: input.feedbackText,
          created_by: input.createdBy,
          created_at: "2026-04-18T09:00:00.000Z",
        };
      },
    },
    activationMetricsService,
  });

  const recordedHits = await service.recordExecutionGovernedHits({
    manuscriptId: "manuscript-metric-1",
    manuscriptType: "clinical_study",
    module: "editing",
    snapshotId: "snapshot-metric-1",
    sourceAssetId: "asset-metric-1",
    createdBy: "system:auto",
    items: [
      {
        sourceKey: "rule-metric-hit-1",
        title: "Metric hit 1",
        summary: "First governed hit for metrics.",
        candidate_posture: "inspect_only",
        relatedRuleIds: ["rule-metric-1"],
      },
    ],
  });

  await service.decideReviewItem({
    sourceKind: "governed_hit",
    id: recordedHits[0]!.item.id,
    action: "reject_as_false_positive",
  });

  const routedHits = await service.recordExecutionGovernedHits({
    manuscriptId: "manuscript-metric-1",
    manuscriptType: "clinical_study",
    module: "editing",
    snapshotId: "snapshot-metric-2",
    sourceAssetId: "asset-metric-2",
    createdBy: "system:auto",
    items: [
      {
        sourceKey: "rule-metric-hit-2",
        title: "Metric hit 2",
        summary: "Second governed hit for metrics.",
        candidate_posture: "candidate_change",
        relatedRuleIds: ["rule-metric-1"],
      },
    ],
  });

  await service.decideReviewItem({
    sourceKind: "governed_hit",
    id: routedHits[0]!.item.id,
    action: "route_to_rule_candidate",
    requestedBy: "knowledge-reviewer-1",
    requestedByRole: "knowledge_reviewer",
  });

  const metrics = await activationMetricsService.getRuleMetrics("rule-metric-1");
  assert.equal(metrics.totals.governed_hit_count, 2);
  assert.equal(metrics.totals.false_positive_count, 1);
  assert.equal(metrics.totals.human_confirmation_count, 1);
  assert.equal(metrics.totals.routed_rule_candidate_count, 1);
});
