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
  assert.equal(issues[2]?.harness_validation_status, "not_required");
});
