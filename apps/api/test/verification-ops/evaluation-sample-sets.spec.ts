import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import { InMemoryReviewedCaseSnapshotRepository } from "../../src/modules/learning/in-memory-learning-repository.ts";
import { InMemoryToolGatewayRepository } from "../../src/modules/tool-gateway/in-memory-tool-gateway-repository.ts";
import { createVerificationOpsApi } from "../../src/modules/verification-ops/verification-ops-api.ts";
import { InMemoryVerificationOpsRepository } from "../../src/modules/verification-ops/in-memory-verification-ops-repository.ts";
import {
  EvaluationSampleSetNotFoundError,
  EvaluationSampleSetSourceEligibilityError,
  EvaluationSampleSetSourceSnapshotNotFoundError,
  VerificationOpsService,
} from "../../src/modules/verification-ops/verification-ops-service.ts";

function createEvaluationSampleSetHarness() {
  const ids = [
    "sample-set-1",
    "sample-set-item-1",
    "sample-set-2",
    "sample-set-item-2",
    "sample-set-3",
    "sample-set-item-3",
  ];
  const reviewedCaseSnapshotRepository =
    new InMemoryReviewedCaseSnapshotRepository();
  const verificationOpsApi = createVerificationOpsApi({
    verificationOpsService: new VerificationOpsService({
      repository: new InMemoryVerificationOpsRepository(),
      reviewedCaseSnapshotRepository,
      toolGatewayRepository: new InMemoryToolGatewayRepository(),
      createId: () => {
        const value = ids.shift();
        assert.ok(value, "Expected an evaluation sample-set id to be available.");
        return value;
      },
      now: () => new Date("2026-03-28T15:00:00.000Z"),
    }),
  });

  return {
    verificationOpsApi,
    reviewedCaseSnapshotRepository,
  };
}

test("evaluation sample sets are admin-only and persist snapshot context", async () => {
  const { verificationOpsApi, reviewedCaseSnapshotRepository } =
    createEvaluationSampleSetHarness();

  await reviewedCaseSnapshotRepository.save({
    id: "reviewed-snapshot-1",
    manuscript_id: "manuscript-1",
    module: "proofreading",
    manuscript_type: "case_report",
    human_final_asset_id: "human-final-1",
    deidentification_passed: true,
    annotated_asset_id: "annotated-1",
    snapshot_asset_id: "snapshot-asset-1",
    created_by: "editor-1",
    created_at: "2026-03-28T14:50:00.000Z",
  });

  await assert.rejects(
    () =>
      verificationOpsApi.createEvaluationSampleSet({
        actorRole: "proofreader",
        input: {
          name: "Proofreading Review Samples",
          module: "proofreading",
          sampleItemInputs: [
            {
              reviewedCaseSnapshotId: "reviewed-snapshot-1",
              riskTags: ["terminology", "format"],
            },
          ],
        },
      }),
    AuthorizationError,
  );

  const created = await verificationOpsApi.createEvaluationSampleSet({
    actorRole: "admin",
    input: {
      name: "Proofreading Review Samples",
      module: "proofreading",
      sampleItemInputs: [
        {
          reviewedCaseSnapshotId: "reviewed-snapshot-1",
          riskTags: ["terminology", "format"],
        },
      ],
    },
  });

  assert.equal(created.status, 201);
  assert.equal(created.body.status, "draft");
  assert.equal(created.body.sample_count, 1);
  assert.deepEqual(created.body.manuscript_types, ["case_report"]);
  assert.deepEqual(created.body.risk_tags, ["terminology", "format"]);
  assert.deepEqual(created.body.source_policy, {
    source_kind: "reviewed_case_snapshot",
    requires_deidentification_pass: true,
    requires_human_final_asset: true,
  });

  const items = await verificationOpsApi.listEvaluationSampleSetItems({
    sampleSetId: created.body.id,
  });
  assert.equal(items.status, 200);
  assert.deepEqual(items.body, [
    {
      id: "sample-set-item-1",
      sample_set_id: "sample-set-1",
      manuscript_id: "manuscript-1",
      snapshot_asset_id: "snapshot-asset-1",
      reviewed_case_snapshot_id: "reviewed-snapshot-1",
      module: "proofreading",
      manuscript_type: "case_report",
      risk_tags: ["terminology", "format"],
    },
  ]);
});

test("evaluation sample sets only accept governed reviewed snapshots", async () => {
  const { verificationOpsApi, reviewedCaseSnapshotRepository } =
    createEvaluationSampleSetHarness();

  await reviewedCaseSnapshotRepository.save({
    id: "reviewed-snapshot-2",
    manuscript_id: "manuscript-2",
    module: "proofreading",
    manuscript_type: "review",
    human_final_asset_id: "human-final-2",
    deidentification_passed: false,
    snapshot_asset_id: "snapshot-asset-2",
    created_by: "editor-2",
    created_at: "2026-03-28T14:51:00.000Z",
  });

  await reviewedCaseSnapshotRepository.save({
    id: "reviewed-snapshot-3",
    manuscript_id: "manuscript-3",
    module: "editing",
    manuscript_type: "clinical_study",
    human_final_asset_id: "human-final-3",
    deidentification_passed: true,
    snapshot_asset_id: "snapshot-asset-3",
    created_by: "editor-3",
    created_at: "2026-03-28T14:52:00.000Z",
  });

  await assert.rejects(
    () =>
      verificationOpsApi.createEvaluationSampleSet({
        actorRole: "admin",
        input: {
          name: "Missing Snapshot Samples",
          module: "proofreading",
          sampleItemInputs: [
            {
              reviewedCaseSnapshotId: "missing-snapshot",
            },
          ],
        },
      }),
    EvaluationSampleSetSourceSnapshotNotFoundError,
  );

  await assert.rejects(
    () =>
      verificationOpsApi.createEvaluationSampleSet({
        actorRole: "admin",
        input: {
          name: "Ungoverned Samples",
          module: "proofreading",
          sampleItemInputs: [
            {
              reviewedCaseSnapshotId: "reviewed-snapshot-2",
            },
          ],
        },
      }),
    EvaluationSampleSetSourceEligibilityError,
  );

  await assert.rejects(
    () =>
      verificationOpsApi.createEvaluationSampleSet({
        actorRole: "admin",
        input: {
          name: "Module Mismatch Samples",
          module: "proofreading",
          sampleItemInputs: [
            {
              reviewedCaseSnapshotId: "reviewed-snapshot-3",
            },
          ],
        },
      }),
    EvaluationSampleSetSourceEligibilityError,
  );
});

test("evaluation sample sets publish as frozen admin-owned assets", async () => {
  const { verificationOpsApi, reviewedCaseSnapshotRepository } =
    createEvaluationSampleSetHarness();

  await reviewedCaseSnapshotRepository.save({
    id: "reviewed-snapshot-1",
    manuscript_id: "manuscript-1",
    module: "screening",
    manuscript_type: "clinical_study",
    human_final_asset_id: "human-final-1",
    deidentification_passed: true,
    snapshot_asset_id: "snapshot-asset-1",
    created_by: "screener-1",
    created_at: "2026-03-28T14:53:00.000Z",
  });

  const created = await verificationOpsApi.createEvaluationSampleSet({
    actorRole: "admin",
    input: {
      name: "Screening Regression Samples",
      module: "screening",
      sampleItemInputs: [
        {
          reviewedCaseSnapshotId: "reviewed-snapshot-1",
          riskTags: ["scope"],
        },
      ],
    },
  });

  await assert.rejects(
    () =>
      verificationOpsApi.publishEvaluationSampleSet({
        actorRole: "editor",
        sampleSetId: created.body.id,
      }),
    AuthorizationError,
  );

  const published = await verificationOpsApi.publishEvaluationSampleSet({
    actorRole: "admin",
    sampleSetId: created.body.id,
  });
  assert.equal(published.status, 200);
  assert.equal(published.body.status, "published");

  await assert.rejects(
    () =>
      verificationOpsApi.publishEvaluationSampleSet({
        actorRole: "admin",
        sampleSetId: "missing-sample-set",
      }),
    EvaluationSampleSetNotFoundError,
  );
});
