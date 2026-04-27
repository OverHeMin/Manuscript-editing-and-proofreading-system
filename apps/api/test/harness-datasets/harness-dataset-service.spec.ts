import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import {
  evaluateGoldSetAssertions,
  createHarnessDatasetApi,
  InMemoryHarnessDatasetRepository,
  HarnessDatasetService,
  HarnessGoldSetVersionNotEditableError,
  HarnessGoldSetVersionPublishValidationError,
} from "../../src/modules/harness-datasets/index.ts";

test("gold set assertion runner reports recall misses and false positives", () => {
  const result = evaluateGoldSetAssertions({
    items: [
      {
        source_kind: "reviewed_case_snapshot",
        source_id: "snapshot-proofreading-1",
        manuscript_id: "manuscript-1",
        manuscript_type: "clinical_study",
        deidentification_passed: true,
        human_reviewed: true,
        expected_structured_output: {
          expectedIssues: [
            {
              id: "expected-context-1",
              severity: "critical",
              issueType: "sample_size_consistency",
              layerId: "context_consistency",
              quote: "120例",
            },
            {
              id: "expected-stat-1",
              severity: "medium",
              issueType: "p_value_format",
              layerId: "statistics_expression",
              quote: "P=0.001",
            },
          ],
          criticalRecallThreshold: 1,
          falsePositiveReviewThreshold: 0.2,
          requiredLayers: ["context_consistency", "statistics_expression"],
        },
      },
    ],
    actualIssues: [
      {
        itemId: "actual-context-1",
        title: "样本量前后不一致",
        description: "摘要和结果样本量不一致。",
        severity: "critical",
        source: "residual_ai",
        issueType: "sample_size_consistency",
        blocksFinal: true,
        anchor: {
          blockIndex: 2,
          quote: "120例",
        },
      },
      {
        itemId: "actual-extra-1",
        title: "疑似额外问题",
        description: "没有命中 gold set。",
        severity: "low",
        source: "residual_ai",
        issueType: "language_style",
        blocksFinal: false,
        anchor: {
          blockIndex: 5,
          quote: "明显",
        },
      },
    ],
  });

  assert.equal(result.expectedIssueCount, 2);
  assert.equal(result.matchedExpectedIssueCount, 1);
  assert.equal(result.missedExpectedIssueCount, 1);
  assert.equal(result.falsePositiveIssueCount, 1);
  assert.equal(result.recall, 0.5);
  assert.equal(result.criticalRecall, 1);
  assert.deepEqual(result.missedExpectedIssueIds, ["expected-stat-1"]);
  assert.deepEqual(result.falsePositiveIssueIds, ["actual-extra-1"]);
  assert.equal(result.thresholds.criticalRecallPassed, true);
  assert.equal(result.thresholds.falsePositiveReviewPassed, false);
  assert.equal(result.thresholds.requiredLayerCoveragePassed, false);
  assert.deepEqual(result.harnessQualityReport, {
    mode: "report_only",
    scope: "gold_set_assertions",
    expectedIssueCount: 2,
    actualIssueCount: 2,
    caseCount: 1,
    assertionCount: 2,
    recall: 0.5,
    falsePositiveCount: 1,
    falseNegativeCount: 1,
    ruleHitCoverage: 0,
    knowledgeHitCoverage: 0,
    residualCoverage: 0.5,
    requiredLayerCoverage: {
      requiredLayerCount: 2,
      coveredLayerCount: 1,
      missingLayerIds: ["statistics_expression"],
    },
    manualReviewSamplingRequired: true,
    limitations: [
      "Harness gold-set metrics are bounded by the published cases and do not represent universal manuscript accuracy.",
      "Report-only gates record quality risks without changing release behavior unless enforcement is separately enabled.",
    ],
    residualRisks: [
      "1 expected issue(s) were missed by the current proofreading output.",
      "1 unmatched issue(s) require false-positive review.",
      "1 required layer(s) were not covered by matched expected issues.",
    ],
  });
});

test("gold set assertion runner requires severity, layer, and block locator matches when provided", () => {
  const result = evaluateGoldSetAssertions({
    items: [
      {
        source_kind: "reviewed_case_snapshot",
        source_id: "snapshot-proofreading-locator",
        manuscript_id: "manuscript-1",
        manuscript_type: "clinical_study",
        deidentification_passed: true,
        human_reviewed: true,
        expected_structured_output: {
          expectedIssues: [
            {
              id: "expected-locator-1",
              severity: "critical",
              issueType: "sample_size_consistency",
              layerId: "context_consistency",
              quote: "n=120",
              blockIndex: 3,
            },
          ],
        },
      },
    ],
    actualIssues: [
      {
        itemId: "actual-wrong-severity-layer-block",
        title: "Same quote but wrong locator metadata",
        description: "This should not satisfy the stricter gold-set assertion.",
        severity: "medium",
        source: "residual_ai",
        issueType: "sample_size_consistency",
        blocksFinal: false,
        anchor: {
          blockIndex: 4,
          quote: "n=120",
        },
      },
    ],
  });

  assert.equal(result.matchedExpectedIssueCount, 0);
  assert.deepEqual(result.missedExpectedIssueIds, ["expected-locator-1"]);
  assert.deepEqual(result.falsePositiveIssueIds, [
    "actual-wrong-severity-layer-block",
  ]);
});

test("gold set residual discovery layer matches residual-ai issues without residual issue type wording", () => {
  const result = evaluateGoldSetAssertions({
    items: [
      {
        source_kind: "reviewed_case_snapshot",
        source_id: "snapshot-proofreading-residual-source",
        manuscript_id: "manuscript-1",
        manuscript_type: "clinical_study",
        deidentification_passed: true,
        human_reviewed: true,
        expected_structured_output: {
          expectedIssues: [
            {
              id: "expected-residual-source-1",
              layerId: "residual_discovery",
            },
          ],
          requiredLayers: ["residual_discovery"],
        },
      },
    ],
    actualIssues: [
      {
        itemId: "actual-terminology-error-1",
        title: "英文摘要中药物名称翻译错误",
        description: "真实模型残差发现的术语错误。",
        severity: "critical",
        source: "residual_ai",
        issueType: "terminology_error",
        blocksFinal: false,
        anchor: {
          blockIndex: 1,
          quote: "Edaravone and Dexmedetomidine",
        },
      },
    ],
  });

  assert.equal(result.matchedExpectedIssueCount, 1);
  assert.equal(result.thresholds.requiredLayerCoveragePassed, true);
});

test("gold set residual discovery layer matches residual-ai terminology consistency issues from real acceptance", () => {
  const result = evaluateGoldSetAssertions({
    items: [
      {
        source_kind: "reviewed_case_snapshot",
        source_id: "snapshot-proofreading-residual-terminology",
        manuscript_id: "manuscript-1",
        manuscript_type: "clinical_study",
        deidentification_passed: true,
        human_reviewed: true,
        expected_structured_output: {
          expectedIssues: [
            {
              id: "expected-residual-terminology-1",
              layerId: "residual_discovery",
            },
          ],
          requiredLayers: ["residual_discovery"],
        },
      },
    ],
    actualIssues: [
      {
        itemId: "actual-terminology-consistency-1",
        title: "正文首次出现PD-1时未给出英文全称",
        description: "真实模型残差发现的术语一致性问题。",
        severity: "medium",
        source: "residual_ai",
        issueType: "terminology_consistency",
        blocksFinal: false,
        anchor: {
          blockIndex: 12,
          quote: "程序性死亡受体-1（programmed death-1，PD-1）",
        },
      },
    ],
  });

  assert.equal(result.matchedExpectedIssueCount, 1);
  assert.equal(result.thresholds.requiredLayerCoveragePassed, true);
});

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
