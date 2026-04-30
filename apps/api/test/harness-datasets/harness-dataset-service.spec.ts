import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import {
  GoldSetAssertionRunner,
  createHarnessDatasetApi,
  InMemoryHarnessDatasetRepository,
  HarnessDatasetService,
  HarnessGoldSetVersionNotEditableError,
  HarnessGoldSetVersionPublishValidationError,
} from "../../src/modules/harness-datasets/index.ts";

function createHarnessDatasetGovernanceHarness() {
  const repository = new InMemoryHarnessDatasetRepository();
  const service = new HarnessDatasetService({
    repository,
    createId: (() => {
      const ids = [
        "family-1",
        "rubric-1",
        "version-1",
        "publication-1",
        "version-2",
      ];

      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a harness dataset governance id.");
        return value;
      };
    })(),
    now: () => new Date("2026-04-04T08:00:00.000Z"),
  });

  return {
    api: createHarnessDatasetApi({
      harnessDatasetService: service,
    }),
  };
}

test("harness dataset governance creates gold-set families, versions, and published rubrics", async () => {
  const { api } = createHarnessDatasetGovernanceHarness();

  await assert.rejects(
    () =>
      api.createGoldSetFamily({
        actorRole: "editor",
        input: {
          name: "Screening high-risk decisions",
          description: "Curated screening decision-quality gold set.",
          scope: {
            module: "screening",
            manuscriptTypes: ["clinical_study"],
            measureFocus: "decision_quality",
          },
        },
      }),
    AuthorizationError,
  );

  const createdFamily = await api.createGoldSetFamily({
    actorRole: "admin",
    input: {
      name: "Screening high-risk decisions",
      description: "Curated screening decision-quality gold set.",
      scope: {
        module: "screening",
        manuscriptTypes: ["clinical_study"],
        measureFocus: "decision_quality",
      },
    },
  });

  assert.equal(createdFamily.status, 201);
  assert.equal(createdFamily.body.scope.module, "screening");

  const draftedRubric = await api.createRubricDefinition({
    actorRole: "admin",
    input: {
      name: "Screening oncology rubric",
      scope: {
        module: "screening",
        manuscriptTypes: ["clinical_study"],
      },
      scoringDimensions: [
        {
          key: "decision_accuracy",
          label: "Decision accuracy",
          weight: 0.7,
        },
        {
          key: "risk_capture",
          label: "Risk capture",
          weight: 0.3,
        },
      ],
      hardGateRules: ["Reject if primary endpoint guidance is missed."],
      failureAnchors: ["Misses explicit oncology risk escalation."],
      borderlineExamples: ["Borderline endpoint ambiguity case."],
      createdBy: "admin-1",
    },
  });
  const createdRubric = await api.publishRubricDefinition({
    actorRole: "admin",
    rubricDefinitionId: draftedRubric.body.id,
    input: {
      publishedBy: "admin-1",
    },
  });

  assert.equal(createdRubric.body.status, "published");

  const createdVersion = await api.createGoldSetVersion({
    actorRole: "admin",
    input: {
      familyId: createdFamily.body.id,
      rubricDefinitionId: createdRubric.body.id,
      createdBy: "admin-1",
      items: [
        {
          sourceKind: "reviewed_case_snapshot",
          sourceId: "snapshot-1",
          manuscriptId: "manuscript-1",
          manuscriptType: "clinical_study",
          deidentificationPassed: true,
          humanReviewed: true,
          riskTags: ["oncology"],
        },
        {
          sourceKind: "human_final_asset",
          sourceId: "asset-1",
          manuscriptId: "manuscript-2",
          manuscriptType: "clinical_study",
          deidentificationPassed: true,
          humanReviewed: true,
        },
        {
          sourceKind: "evaluation_evidence_pack",
          sourceId: "evidence-pack-1",
          manuscriptId: "manuscript-3",
          manuscriptType: "clinical_study",
          deidentificationPassed: true,
          humanReviewed: true,
          expectedStructuredOutput: {
            disposition: "needs_revision",
          },
        },
      ],
      publicationNotes: "Initial oncology gold set draft.",
    },
  });

  assert.equal(createdVersion.body.status, "draft");
  assert.equal(createdVersion.body.item_count, 3);

  const publishedVersion = await api.publishGoldSetVersion({
    actorRole: "admin",
    goldSetVersionId: createdVersion.body.id,
    input: {
      publishedBy: "admin-1",
    },
  });

  assert.equal(publishedVersion.body.status, "published");
});

test("harness dataset governance can copy a published validation sample set back to an editable draft", async () => {
  const { api } = createHarnessDatasetGovernanceHarness();

  const family = await api.createGoldSetFamily({
    actorRole: "admin",
    input: {
      name: "Editing reusable samples",
      scope: {
        module: "editing",
        manuscriptTypes: ["clinical_study"],
        measureFocus: "conformance",
      },
    },
  });
  const rubric = await api.publishRubricDefinition({
    actorRole: "admin",
    rubricDefinitionId:
      (
        await api.createRubricDefinition({
          actorRole: "admin",
          input: {
            name: "Editing conformance rubric",
            scope: {
              module: "editing",
              manuscriptTypes: ["clinical_study"],
            },
            scoringDimensions: [
              {
                key: "conformance",
                label: "Conformance",
                weight: 1,
              },
            ],
            createdBy: "admin-1",
          },
        })
      ).body.id,
    input: {
      publishedBy: "admin-1",
    },
  });
  const published = await api.publishGoldSetVersion({
    actorRole: "admin",
    goldSetVersionId:
      (
        await api.createGoldSetVersion({
          actorRole: "admin",
          input: {
            familyId: family.body.id,
            rubricDefinitionId: rubric.body.id,
            createdBy: "admin-1",
            items: [
              {
                sourceKind: "reviewed_case_snapshot",
                sourceId: "snapshot-1",
                manuscriptId: "manuscript-1",
                manuscriptType: "clinical_study",
                deidentificationPassed: true,
                humanReviewed: true,
              },
            ],
          },
        })
      ).body.id,
    input: {
      publishedBy: "admin-1",
    },
  });

  const copied = await api.copyGoldSetVersionToDraft({
    actorRole: "admin",
    goldSetVersionId: published.body.id,
    input: {
      createdBy: "admin-2",
      publicationNotes: "Edit copy for next release.",
    },
  });

  assert.equal(copied.status, 201);
  assert.equal(copied.body.status, "draft");
  assert.equal(copied.body.family_id, family.body.id);
  assert.equal(copied.body.version_no, 2);
  assert.equal(copied.body.item_count, 1);
  assert.equal(copied.body.created_by, "admin-2");
  assert.equal(copied.body.publication_notes, "Edit copy for next release.");
});

test("harness dataset governance only publishes deidentified human-reviewed versions and archived history stays immutable", async () => {
  const { api } = createHarnessDatasetGovernanceHarness();

  const family = await api.createGoldSetFamily({
    actorRole: "admin",
    input: {
      name: "Proofreading issue detection",
      scope: {
        module: "proofreading",
        manuscriptTypes: ["review"],
        measureFocus: "issue_detection",
      },
    },
  });

  const rubric = await api.publishRubricDefinition({
    actorRole: "admin",
    rubricDefinitionId:
      (
        await api.createRubricDefinition({
          actorRole: "admin",
          input: {
            name: "Proofreading issue rubric",
            scope: {
              module: "proofreading",
              manuscriptTypes: ["review"],
            },
            scoringDimensions: [
              {
                key: "issue_recall",
                label: "Issue recall",
                weight: 1,
              },
            ],
            createdBy: "admin-2",
          },
        })
      ).body.id,
    input: {
      publishedBy: "admin-2",
    },
  });

  const draftVersion = await api.createGoldSetVersion({
    actorRole: "admin",
    input: {
      familyId: family.body.id,
      rubricDefinitionId: rubric.body.id,
      createdBy: "admin-2",
      items: [
        {
          sourceKind: "reviewed_case_snapshot",
          sourceId: "snapshot-2",
          manuscriptId: "manuscript-4",
          manuscriptType: "review",
          deidentificationPassed: false,
          humanReviewed: true,
        },
      ],
    },
  });

  await assert.rejects(
    () =>
      api.publishGoldSetVersion({
        actorRole: "admin",
        goldSetVersionId: draftVersion.body.id,
        input: {
          publishedBy: "admin-2",
        },
      }),
    HarnessGoldSetVersionPublishValidationError,
  );

  const updatedDraft = await api.updateGoldSetVersionDraft({
    actorRole: "admin",
    goldSetVersionId: draftVersion.body.id,
    input: {
      items: [
        {
          sourceKind: "reviewed_case_snapshot",
          sourceId: "snapshot-2",
          manuscriptId: "manuscript-4",
          manuscriptType: "review",
          deidentificationPassed: true,
          humanReviewed: true,
        },
      ],
      publicationNotes: "Manual de-identification review completed.",
    },
  });

  assert.equal(updatedDraft.body.item_count, 1);

  const published = await api.publishGoldSetVersion({
    actorRole: "admin",
    goldSetVersionId: updatedDraft.body.id,
    input: {
      publishedBy: "admin-2",
    },
  });
  const archived = await api.archiveGoldSetVersion({
    actorRole: "admin",
    goldSetVersionId: published.body.id,
    input: {
      archivedBy: "admin-3",
    },
  });

  assert.equal(archived.body.status, "archived");

  await assert.rejects(
    () =>
      api.updateGoldSetVersionDraft({
        actorRole: "admin",
        goldSetVersionId: archived.body.id,
        input: {
          publicationNotes: "This should not be allowed after archive.",
        },
      }),
    HarnessGoldSetVersionNotEditableError,
  );
});

test("gold-set content gates fail passed executions when recall, precision, citations, or manual review are weak", () => {
  const runner = new GoldSetAssertionRunner();

  const result = runner.evaluate({
    mode: "internal_test",
    executionStatus: "passed",
    goldSetItems: [
      {
        itemId: "case-terminology",
        manuscriptSnippet: "A terminology mismatch in the intervention name.",
        expectedIssues: [
          {
            issueId: "expected-terminology",
            category: "terminology",
            expectedRuleHitIds: ["rule-term-001"],
            expectedKnowledgeItemIds: ["knowledge-term-001"],
            riskLevel: "high",
          },
        ],
      },
      {
        itemId: "case-table",
        manuscriptSnippet: "The text says n=80 while the table total is n=78.",
        expectedIssues: [
          {
            issueId: "expected-table-text",
            category: "table_text_consistency",
            expectedRuleHitIds: ["rule-table-001"],
            riskLevel: "high",
          },
        ],
      },
      {
        itemId: "case-statistics",
        manuscriptSnippet: "The P value is formatted as P =0.000.",
        expectedIssues: [
          {
            issueId: "expected-statistics",
            category: "statistical_expression",
            expectedRuleHitIds: ["rule-stat-001"],
            riskLevel: "medium",
          },
        ],
      },
    ],
    findings: [
      {
        findingId: "finding-terminology",
        itemId: "case-terminology",
        matchedExpectedIssueId: "expected-terminology",
        ruleHitIds: ["rule-term-001"],
        knowledgeItemIds: [],
        manualReview: {
          required: true,
          outcome: "rejected",
        },
      },
      {
        findingId: "finding-false-positive",
        itemId: "case-table",
        ruleHitIds: [],
        knowledgeItemIds: [],
      },
    ],
    thresholds: {
      recall: 0.8,
      precision: 0.6,
      highRiskManualReviewPassRate: 0.9,
    },
  });

  assert.equal(result.executionStatus, "passed");
  assert.equal(result.contentGate.status, "failed");
  assert.equal(result.metrics.expectedIssueCount, 3);
  assert.equal(result.metrics.detectedExpectedIssueCount, 1);
  assert.equal(result.metrics.falseNegativeCount, 2);
  assert.equal(result.metrics.falsePositiveCount, 1);
  assert.ok(result.failedGateIds.includes("recall_threshold"));
  assert.ok(result.failedGateIds.includes("precision_threshold"));
  assert.ok(result.failedGateIds.includes("expected_knowledge_citations"));
  assert.ok(result.failedGateIds.includes("high_risk_manual_review_pass_rate"));
  assert.deepEqual(
    result.falseNegatives.map((item) => item.issueId),
    ["expected-table-text", "expected-statistics"],
  );
});

test("harness dataset service attaches content quality gates while preserving execution status", () => {
  const service = new HarnessDatasetService({
    repository: new InMemoryHarnessDatasetRepository(),
  });

  const result = service.evaluateContentQualityGate({
    mode: "internal_test",
    executionStatus: "passed",
    goldSetItems: [
      {
        itemId: "case-terminology",
        manuscriptSnippet: "Terminology fixture.",
        expectedIssues: [
          {
            issueId: "expected-terminology",
            category: "terminology",
            expectedRuleHitIds: ["rule-term-001"],
            riskLevel: "high",
          },
        ],
      },
      {
        itemId: "case-table",
        manuscriptSnippet: "Table fixture.",
        expectedIssues: [
          {
            issueId: "expected-table-text",
            category: "table_text_consistency",
            expectedRuleHitIds: ["rule-table-001"],
            riskLevel: "medium",
          },
        ],
      },
      {
        itemId: "case-statistics",
        manuscriptSnippet: "Statistics fixture.",
        expectedIssues: [
          {
            issueId: "expected-statistics",
            category: "statistical_expression",
            expectedRuleHitIds: ["rule-stat-001"],
            riskLevel: "medium",
          },
        ],
      },
    ],
    findings: [],
  });

  assert.equal(result.executionStatus, "passed");
  assert.equal(result.contentGate.status, "failed");
  assert.ok(result.failedGateIds.includes("recall_threshold"));
});
