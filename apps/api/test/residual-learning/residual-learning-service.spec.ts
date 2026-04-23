import test from "node:test";
import assert from "node:assert/strict";
import type { ManuscriptQualityIssue } from "@medical/contracts";
import { InMemoryResidualIssueRepository } from "../../src/modules/residual-learning/in-memory-residual-learning-repository.ts";
import { ResidualLearningService } from "../../src/modules/residual-learning/residual-learning-service.ts";

function createQualityIssue(
  overrides: Partial<ManuscriptQualityIssue>,
): ManuscriptQualityIssue {
  return {
    issue_id: "quality-1",
    module_scope: "general_proofreading",
    issue_type: "style_consistency_gap",
    category: "consistency",
    severity: "low",
    action: "suggest_fix",
    confidence: 0.82,
    source_kind: "deterministic_rule",
    text_excerpt: "Spacing issue already covered",
    explanation: "The governed quality package already flagged this spacing issue.",
    ...overrides,
  };
}

test("observeProofreadingResiduals filters covered issues, boosts recurrence, and routes candidate families truthfully", async () => {
  const repository = new InMemoryResidualIssueRepository();
  const service = new ResidualLearningService({
    residualIssueRepository: repository,
    createId: (() => {
      const ids = ["residual-1", "residual-2", "residual-3"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a residual issue id to be available.");
        return value;
      };
    })(),
    now: () => new Date("2026-04-18T10:00:00.000Z"),
  });

  await repository.save({
    id: "historic-1",
    module: "proofreading",
    manuscript_id: "manuscript-0",
    manuscript_type: "clinical_study",
    execution_snapshot_id: "snapshot-0",
    issue_type: "unit_expression_gap",
    source_stage: "model_residual",
    excerpt: "5 mg per dL",
    novelty_key: "unit_expression_gap:5 mg per dL",
    recurrence_count: 1,
    system_confidence_band: "L1_review_pending",
    risk_level: "low",
    recommended_route: "rule_candidate",
    status: "validation_pending",
    harness_validation_status: "queued",
    created_at: "2026-04-17T10:00:00.000Z",
    updated_at: "2026-04-17T10:00:00.000Z",
  });

  const issues = await service.observeProofreadingResiduals({
    manuscriptId: "manuscript-1",
    manuscriptType: "clinical_study",
    executionSnapshotId: "snapshot-1",
    knownRuleIds: ["rule-covered"],
    knownKnowledgeItemIds: ["knowledge-covered"],
    qualityIssues: [
      createQualityIssue({
        issue_id: "quality-covered-1",
        text_excerpt: "Spacing issue already covered",
      }),
    ],
    sourceBlocks: [
      {
        section: "results",
        blockIndex: 0,
        text: "Dose was 5 mg per dL and HbA1c naming drift remained in the report.",
        residualHints: [
          {
            issue_type: "style_consistency_gap",
            excerpt: "Spacing issue already covered",
            suggestion: "Ignore because the governed baseline already covered it.",
            rationale: "Covered baseline issues should not re-enter residual learning.",
            related_rule_ids: ["rule-covered"],
            model_confidence: 0.95,
          },
          {
            issue_type: "unit_expression_gap",
            excerpt: "5 mg per dL",
            suggestion: "Normalize the unit expression to mg/dL.",
            rationale: "This is a repeatable unit-formatting pattern.",
            model_confidence: 0.86,
          },
          {
            issue_type: "terminology_gap",
            excerpt: "HbA1c naming drift remained in the report.",
            suggestion: "Add reusable terminology guidance for HbA1c naming.",
            rationale: "This requires explanation-heavy knowledge, not a brittle hard rule.",
            model_confidence: 0.78,
          },
          {
            issue_type: "medical_meaning_risk",
            excerpt: "Increase insulin due to low glucose",
            suggestion: "Escalate for manual review.",
            rationale: "Potential medical meaning risk must not become an automated candidate.",
            model_confidence: 0.97,
            risk_level: "high",
          },
        ],
      },
    ],
  });

  assert.equal(issues.length, 3);
  assert.equal(issues[0]?.recommended_route, "rule_candidate");
  assert.equal(issues[0]?.system_confidence_band, "L2_candidate_ready");
  assert.equal(issues[0]?.recurrence_count, 2);
  assert.equal(issues[1]?.recommended_route, "knowledge_candidate");
  assert.equal(issues[1]?.harness_validation_status, "queued");
  assert.equal(issues[2]?.recommended_route, "manual_only");
  assert.equal(issues[2]?.status, "manual_review_pending");
  assert.equal(issues[2]?.harness_validation_status, "not_required");
});

test("observeProofreadingResiduals uses a bound default createId when residuals are recorded", async () => {
  const repository = new InMemoryResidualIssueRepository();
  const service = new ResidualLearningService({
    residualIssueRepository: repository,
    now: () => new Date("2026-04-18T10:05:00.000Z"),
  });

  const issues = await service.observeProofreadingResiduals({
    manuscriptId: "manuscript-default-id-1",
    manuscriptType: "clinical_study",
    executionSnapshotId: "snapshot-default-id-1",
    knownRuleIds: [],
    knownKnowledgeItemIds: [],
    sourceBlocks: [
      {
        section: "discussion",
        blockIndex: 0,
        text: "HbA1c naming drift remained in the report.",
        residualHints: [
          {
            issue_type: "terminology_gap",
            excerpt: "HbA1c naming drift remained in the report.",
            suggestion: "Normalize the governed terminology before reuse.",
            rationale: "This needs a reusable knowledge-backed explanation.",
            model_confidence: 0.81,
          },
        ],
      },
    ],
  });

  assert.equal(issues.length, 1);
  assert.match(
    issues[0]?.id ?? "",
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
});

test("observeProofreadingResiduals routes cross-section contradiction issue families to manual review even when the model marks them medium risk", async () => {
  const repository = new InMemoryResidualIssueRepository();
  const service = new ResidualLearningService({
    residualIssueRepository: repository,
    createId: (() => {
      const ids = [
        "residual-cross-section-1",
        "residual-cross-section-2",
        "residual-cross-section-3",
        "residual-cross-section-4",
        "residual-cross-section-5",
      ];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a cross-section residual issue id to be available.");
        return value;
      };
    })(),
    now: () => new Date("2026-04-18T10:10:00.000Z"),
  });

  const issues = await service.observeProofreadingResiduals({
    manuscriptId: "manuscript-cross-section-1",
    manuscriptType: "clinical_study",
    executionSnapshotId: "snapshot-cross-section-1",
    knownRuleIds: [],
    knownKnowledgeItemIds: [],
    sourceBlocks: [
      {
        section: "discussion",
        blockIndex: 0,
        text: "Cross-section contradictions remain in the governed proofreading report.",
        residualHints: [
          {
            issue_type: "study_design_consistency",
            excerpt: "Abstract says randomized double blind but methods say open label.",
            suggestion: "Escalate the study design contradiction for manual review.",
            rationale: "Study design contradictions must not be auto-routed.",
            risk_level: "medium",
          },
          {
            issue_type: "population_definition_consistency",
            excerpt: "The cohort is called elderly but the mean age is 57.4 years.",
            suggestion: "Escalate the population-definition contradiction for manual review.",
            rationale: "Population-definition contradictions must not be auto-routed.",
            risk_level: "medium",
          },
          {
            issue_type: "sample_size_consistency",
            excerpt: "Abstract reports 162 cases, methods 148, results 156.",
            suggestion: "Escalate the sample-size contradiction for manual review.",
            rationale: "Sample-size contradictions must not be auto-routed.",
            risk_level: "medium",
          },
          {
            issue_type: "results_vs_conclusion_alignment",
            excerpt: "The conclusion claims lower MACE risk without outcome data.",
            suggestion: "Escalate the conclusion overclaim for manual review.",
            rationale: "Conclusion overclaims must not be auto-routed.",
            risk_level: "medium",
          },
          {
            issue_type: "follow_up_window_consistency",
            excerpt: "The discussion says 12 months while results stop at 24 weeks.",
            suggestion: "Escalate the follow-up contradiction for manual review.",
            rationale: "Follow-up-window contradictions must not be auto-routed.",
            risk_level: "medium",
          },
        ],
      },
    ],
  });

  assert.deepEqual(
    issues.map((issue) => ({
      issue_type: issue.issue_type,
      recommended_route: issue.recommended_route,
      status: issue.status,
      harness_validation_status: issue.harness_validation_status,
    })),
    [
      {
        issue_type: "study_design_consistency",
        recommended_route: "manual_only",
        status: "manual_review_pending",
        harness_validation_status: "not_required",
      },
      {
        issue_type: "population_definition_consistency",
        recommended_route: "manual_only",
        status: "manual_review_pending",
        harness_validation_status: "not_required",
      },
      {
        issue_type: "sample_size_consistency",
        recommended_route: "manual_only",
        status: "manual_review_pending",
        harness_validation_status: "not_required",
      },
      {
        issue_type: "results_vs_conclusion_alignment",
        recommended_route: "manual_only",
        status: "manual_review_pending",
        harness_validation_status: "not_required",
      },
      {
        issue_type: "follow_up_window_consistency",
        recommended_route: "manual_only",
        status: "manual_review_pending",
        harness_validation_status: "not_required",
      },
    ],
  );
});

test("observeProofreadingResiduals routes new proofreading quality-control issue families away from evidence-only fallback", async () => {
  const repository = new InMemoryResidualIssueRepository();
  const service = new ResidualLearningService({
    residualIssueRepository: repository,
    createId: (() => {
      const ids = [
        "residual-quality-family-1",
        "residual-quality-family-2",
        "residual-quality-family-3",
        "residual-quality-family-4",
      ];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a quality-family residual issue id to be available.");
        return value;
      };
    })(),
    now: () => new Date("2026-04-18T10:15:00.000Z"),
  });

  const issues = await service.observeProofreadingResiduals({
    manuscriptId: "manuscript-quality-family-1",
    manuscriptType: "clinical_study",
    executionSnapshotId: "snapshot-quality-family-1",
    knownRuleIds: [],
    knownKnowledgeItemIds: [],
    sourceBlocks: [
      {
        section: "results",
        blockIndex: 0,
        text: "Multiple governed proofreading risks remain unresolved.",
        residualHints: [
          {
            issue_type: "cross_section_contradiction",
            excerpt: "The abstract and methods describe incompatible trial structures.",
            suggestion: "Escalate the contradiction for manual review.",
            rationale: "Cross-section contradictions must not drop to evidence-only.",
            risk_level: "medium",
          },
          {
            issue_type: "conclusion_overclaim",
            excerpt: "The conclusion claims reduced MACE without outcome data.",
            suggestion: "Escalate the overclaim for manual review.",
            rationale: "Conclusion overclaims must not drop to evidence-only.",
            risk_level: "medium",
          },
          {
            issue_type: "statistical_interpretation_error",
            excerpt: "The confidence interval crosses 1.0 but the text claims significance.",
            suggestion: "Escalate the statistical interpretation risk for manual review.",
            rationale: "Statistical interpretation risks must not drop to evidence-only.",
            risk_level: "medium",
          },
          {
            issue_type: "terminology_consistency",
            excerpt: "ASCVD is expanded inconsistently and hs-CRP casing drifts across sections.",
            suggestion: "Capture reusable terminology guidance for proofreading.",
            rationale: "Terminology consistency should remain learnable rather than disappear.",
            risk_level: "medium",
          },
        ],
      },
    ],
  });

  assert.deepEqual(
    issues.map((issue) => ({
      issue_type: issue.issue_type,
      recommended_route: issue.recommended_route,
      status: issue.status,
      harness_validation_status: issue.harness_validation_status,
    })),
    [
      {
        issue_type: "cross_section_contradiction",
        recommended_route: "manual_only",
        status: "manual_review_pending",
        harness_validation_status: "not_required",
      },
      {
        issue_type: "conclusion_overclaim",
        recommended_route: "manual_only",
        status: "manual_review_pending",
        harness_validation_status: "not_required",
      },
      {
        issue_type: "statistical_interpretation_error",
        recommended_route: "manual_only",
        status: "manual_review_pending",
        harness_validation_status: "not_required",
      },
      {
        issue_type: "terminology_consistency",
        recommended_route: "knowledge_candidate",
        status: "validation_pending",
        harness_validation_status: "queued",
      },
    ],
  );
});

test("manual-review residuals stay pending until an explicit manual-only decision is recorded", async () => {
  const repository = new InMemoryResidualIssueRepository();
  const service = new ResidualLearningService({
    residualIssueRepository: repository,
    createId: () => "residual-manual-review-1",
    now: (() => {
      const timestamps = [
        "2026-04-18T10:20:00.000Z",
        "2026-04-18T10:25:00.000Z",
      ];
      return () => new Date(timestamps.shift() ?? "2026-04-18T10:25:00.000Z");
    })(),
  });

  const [pendingIssue] = await service.observeProofreadingResiduals({
    manuscriptId: "manuscript-manual-review-1",
    manuscriptType: "clinical_study",
    executionSnapshotId: "snapshot-manual-review-1",
    knownRuleIds: [],
    knownKnowledgeItemIds: [],
    sourceBlocks: [
      {
        section: "discussion",
        blockIndex: 0,
        text: "The discussion conclusion overstates the observed outcome.",
        residualHints: [
          {
            issue_type: "conclusion_overclaim",
            excerpt: "The intervention is definitively curative.",
            suggestion: "Escalate this contradiction for manual review.",
            rationale: "Medical meaning contradictions require human confirmation.",
            risk_level: "high",
          },
        ],
      },
    ],
  });

  assert.equal(pendingIssue?.recommended_route, "manual_only");
  assert.equal(pendingIssue?.status, "manual_review_pending");
  assert.equal(pendingIssue?.harness_validation_status, "not_required");

  const resolvedIssue = await service.resolveIssueDecision({
    issueId: "residual-manual-review-1",
    resolution: "manual_only",
  });

  assert.equal(resolvedIssue.status, "manual_only");
  assert.equal(resolvedIssue.recommended_route, "manual_only");
  assert.equal(resolvedIssue.harness_validation_status, "not_required");
});
