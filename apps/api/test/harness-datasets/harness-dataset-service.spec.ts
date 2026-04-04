import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import {
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
