import test from "node:test";
import assert from "node:assert/strict";
import { ProofreadingService } from "../../src/modules/proofreading/proofreading-service.ts";
import { seedMedicalQualityFixture } from "../shared/medical-quality-fixture.ts";

test("proofreading draft passes governed checks, manual review items, and prompt guardrails into AI planning", async () => {
  const harness = await seedMedicalQualityFixture();
  let recordedPlanInput: Record<string, unknown> | undefined;

  await harness.editorialRuleRepository.saveRule({
    id: "rule-proofreading-manual-1",
    rule_set_id: "rule-set-proofreading-1",
    order_no: 20,
    rule_object: "generic",
    rule_type: "content",
    execution_mode: "apply_and_inspect",
    scope: {},
    selector: {},
    trigger: {
      kind: "exact_text",
      text: "ALT remained stable.",
    },
    action: {
      kind: "rewrite_content",
    },
    authoring_payload: {},
    confidence_policy: "manual_only",
    severity: "error",
    enabled: true,
    manual_review_reason_template: "confirm_medical_term_expansion",
  });

  const proofreadingService = new ProofreadingService({
    manuscriptRepository: harness.manuscriptRepository,
    assetRepository: harness.assetRepository,
    moduleTemplateRepository: harness.moduleTemplateRepository,
    promptSkillRegistryRepository: harness.promptSkillRegistryRepository,
    knowledgeRepository: harness.knowledgeRepository,
    executionGovernanceService: harness.executionGovernanceService,
    executionTrackingService: harness.executionTrackingService,
    jobRepository: harness.jobRepository,
    documentAssetService: harness.documentAssetService,
    aiGatewayService: harness.aiGatewayService,
    sandboxProfileService: harness.sandboxProfileService,
    agentProfileService: harness.agentProfileService,
    agentRuntimeService: harness.agentRuntimeService,
    runtimeBindingService: harness.runtimeBindingService,
    toolPermissionPolicyService: harness.toolPermissionPolicyService,
    agentExecutionService: harness.agentExecutionService,
    agentExecutionOrchestrationService: {
      async dispatchBestEffort() {
        return undefined;
      },
    } as never,
    proofreadingAiPlanService: {
      async createPlan(input: Record<string, unknown>) {
        recordedPlanInput = structuredClone(input);
        return {
          role: "医学稿件终校审校员",
          summary: "No residual issues.",
          issues: [],
          manualReviewItems: [],
        };
      },
    } as never,
    proofreadingSourceBlockResolver: {
      async resolveBlocks() {
        return [
          {
            section: "abstract",
            block_kind: "heading",
            text: "摘要 目的",
          },
          {
            section: "results",
            block_kind: "paragraph",
            text: "Dose was 5 mg per dL and ALT remained stable.",
          },
        ];
      },
    } as never,
    manuscriptQualityService: {
      async runChecks() {
        return {
          requested_scopes: ["general_proofreading", "medical_specialized"],
          completed_scopes: ["general_proofreading", "medical_specialized"],
          issues: [
            {
              issue_id: "quality-proofreading-1",
              module_scope: "medical_specialized",
              issue_type: "medical_logic.overclaim",
              category: "medical_logic",
              severity: "high",
              action: "manual_review",
              confidence: 0.89,
              text_excerpt:
                "Dose was 5 mg per dL and ALT remained stable.",
              explanation: "Confirm whether the dosage unit formatting is correct.",
            },
          ],
          quality_findings_summary: {
            total_issue_count: 1,
            issue_count_by_scope: {
              medical_specialized: 1,
            },
            issue_count_by_action: {
              manual_review: 1,
            },
            issue_count_by_severity: {
              high: 1,
            },
            highest_action: "manual_review",
            representative_issue_ids: ["quality-proofreading-1"],
          },
          resolved_quality_packages: [],
        };
      },
    } as never,
    now: () => new Date("2026-04-23T10:00:00.000Z"),
    createId: () => "job-proofreading-plan-context-1",
  } as never);

  await proofreadingService.createDraft({
    manuscriptId: "manuscript-1",
    parentAssetId: harness.originalAssetId,
    requestedBy: "proofreader-1",
    actorRole: "proofreader",
    storageKey: "proofreading/manuscript-1/plan-context-report.md",
    fileName: "plan-context-report.md",
  });

  assert.deepEqual(
    (
      recordedPlanInput as {
        governedFailedChecks?: Array<Record<string, unknown>>;
      }
    )?.governedFailedChecks?.map((item) => ({
      ruleId: item.ruleId,
      actual: item.actual,
      expected: item.expected,
      blockIndex: item.blockIndex,
    })),
    [
      {
        ruleId: "rule-abstract-objective-proofreading",
        actual: "摘要 目的",
        expected: "（摘要　目的）",
        blockIndex: 0,
      },
    ],
  );
  assert.deepEqual(
    (
      recordedPlanInput as {
        governedManualReviewItems?: Array<Record<string, unknown>>;
      }
    )?.governedManualReviewItems?.map((item) => ({
      ruleId: item.ruleId,
      reason: item.reason,
    })),
    [
      {
        ruleId: "rule-proofreading-manual-1",
        reason: "confirm_medical_term_expansion",
      },
    ],
  );
  assert.equal(
    (
      recordedPlanInput as {
        promptGuardrails?: Record<string, unknown>;
      }
    )?.promptGuardrails?.manualReviewPolicy,
    "Escalate any medical meaning risk or unresolved rule match.",
  );
  assert.deepEqual(
    (
      recordedPlanInput as {
        qualityIssues?: Array<Record<string, unknown>>;
      }
    )?.qualityIssues?.map((item) => ({
      issue_type: item.issue_type,
      severity: item.severity,
    })),
    [
      {
        issue_type: "medical_logic.overclaim",
        severity: "high",
      },
    ],
  );
});
