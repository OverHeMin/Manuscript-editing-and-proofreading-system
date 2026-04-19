import test from "node:test";
import assert from "node:assert/strict";
import type { LearningWritebackViewModel } from "../src/features/learning-governance/types.ts";
import type {
  GovernedHitReviewItemViewModel,
  LearningCandidateReviewItemViewModel,
  ResidualReviewItemViewModel,
} from "../src/features/review-items/types.ts";
import {
  filterRuleLearningReviewItems,
  resolveEditorialRuleDraftWriteback,
} from "../src/features/template-governance/rule-learning-state.ts";

const residualRuleItem: ResidualReviewItemViewModel = {
  id: "residual-rule-1",
  source_kind: "residual_issue",
  source_status: "candidate_ready",
  review_status: "pending",
  module: "editing",
  manuscript_id: "manuscript-1",
  manuscript_type: "clinical_study",
  title: "Abstract heading residual",
  summary: "Normalize abstract heading punctuation.",
  created_at: "2026-04-18T08:00:00.000Z",
  updated_at: "2026-04-18T08:05:00.000Z",
  available_actions: ["route_to_rule_candidate", "archive_as_evidence_only"],
  issue_type: "format_gap",
  execution_snapshot_id: "snapshot-1",
  recommended_route: "rule_candidate",
  harness_validation_status: "passed",
};

const governedRuleItem: GovernedHitReviewItemViewModel = {
  id: "governed-rule-1",
  source_kind: "governed_hit",
  source_status: "submitted",
  review_status: "pending",
  module: "editing",
  manuscript_id: "manuscript-1",
  manuscript_type: "clinical_study",
  snapshot_id: "snapshot-governed-1",
  title: "Missed governed rule",
  summary: "A governed hit was missed in the edited manuscript.",
  created_at: "2026-04-18T07:55:00.000Z",
  updated_at: "2026-04-18T07:57:00.000Z",
  available_actions: ["route_to_rule_candidate", "accept_change_only"],
  feedback_category: "missed_hit",
  feedback_record_id: "feedback-1",
  recommended_route: "rule_candidate",
  harness_validation_status: "not_required",
  created_by: "editor-1",
};

const residualKnowledgeItem: ResidualReviewItemViewModel = {
  ...residualRuleItem,
  id: "residual-knowledge-1",
  recommended_route: "knowledge_candidate",
};

const ruleCandidateItem: LearningCandidateReviewItemViewModel = {
  id: "candidate-rule-1",
  source_kind: "learning_candidate",
  source_status: "approved",
  review_status: "decided",
  status: "approved",
  module: "editing",
  manuscript_type: "clinical_study",
  title: "Abstract heading normalization",
  summary: "Normalize abstract heading punctuation.",
  created_at: "2026-04-18T08:10:00.000Z",
  updated_at: "2026-04-18T08:12:00.000Z",
  available_actions: [],
  candidate_type: "rule_candidate",
  type: "rule_candidate",
  created_by: "reviewer-1",
};

const knowledgeCandidateItem: LearningCandidateReviewItemViewModel = {
  ...ruleCandidateItem,
  id: "candidate-knowledge-1",
  candidate_type: "knowledge_candidate",
  type: "knowledge_candidate",
};

test("rule learning state keeps only rule-governance items in the rule-center queue", () => {
  const filtered = filterRuleLearningReviewItems([
    governedRuleItem,
    residualRuleItem,
    residualKnowledgeItem,
    ruleCandidateItem,
    knowledgeCandidateItem,
  ]);

  assert.deepEqual(
    filtered.map((item) => item.id),
    [
      "governed-rule-1",
      "residual-rule-1",
      "candidate-rule-1",
    ],
  );
});

test("rule learning state applies unified review filters across sources and statuses", () => {
  const filtered = filterRuleLearningReviewItems(
    [
      governedRuleItem,
      {
        ...governedRuleItem,
        id: "governed-proofreading-1",
        module: "proofreading",
        risk_level: "low",
      } as GovernedHitReviewItemViewModel,
      {
        ...residualRuleItem,
        id: "residual-critical-1",
        risk_level: "critical",
      },
      {
        ...ruleCandidateItem,
        id: "candidate-pending-1",
        review_status: "pending",
        source_status: "pending_review",
      },
      knowledgeCandidateItem,
    ],
    {
      sourceKind: "governed_hit",
      module: "editing",
      reviewStatus: "pending",
    },
  );
  const highRisk = filterRuleLearningReviewItems(
    [
      governedRuleItem,
      {
        ...residualRuleItem,
        id: "residual-critical-1",
        risk_level: "critical",
      },
      knowledgeCandidateItem,
    ],
    {
      riskLevel: "critical",
    },
  );

  assert.deepEqual(filtered.map((item) => item.id), ["governed-rule-1"]);
  assert.deepEqual(highRisk.map((item) => item.id), ["residual-critical-1"]);
});

test("rule learning state prefers an applied editorial rule writeback and falls back to a draft", () => {
  const writebacks: LearningWritebackViewModel[] = [
    {
      id: "writeback-knowledge-1",
      learning_candidate_id: "candidate-rule-1",
      target_type: "knowledge_item",
      status: "applied",
      created_draft_asset_id: "knowledge-1",
      created_by: "admin-1",
      created_at: "2026-04-18T08:20:00.000Z",
      applied_by: "admin-1",
      applied_at: "2026-04-18T08:21:00.000Z",
    },
    {
      id: "writeback-rule-draft-1",
      learning_candidate_id: "candidate-rule-1",
      target_type: "editorial_rule_draft",
      status: "draft",
      created_by: "admin-1",
      created_at: "2026-04-18T08:22:00.000Z",
    },
    {
      id: "writeback-rule-applied-1",
      learning_candidate_id: "candidate-rule-1",
      target_type: "editorial_rule_draft",
      status: "applied",
      created_draft_asset_id: "editorial-rule-1",
      created_by: "admin-1",
      created_at: "2026-04-18T08:23:00.000Z",
      applied_by: "admin-1",
      applied_at: "2026-04-18T08:24:00.000Z",
    },
  ];

  assert.equal(
    resolveEditorialRuleDraftWriteback(writebacks)?.id,
    "writeback-rule-applied-1",
  );
  assert.equal(resolveEditorialRuleDraftWriteback([]), null);
});
