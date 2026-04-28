import test from "node:test";
import assert from "node:assert/strict";
import { DocumentAssetService } from "../../src/modules/assets/document-asset-service.ts";
import type { DocumentAssetRecord } from "../../src/modules/assets/document-asset-record.ts";
import { InMemoryDocumentAssetRepository } from "../../src/modules/assets/in-memory-document-asset-repository.ts";
import type { ApplyDeterministicDocxRulesInput } from "../../src/modules/editorial-execution/types.ts";
import { InMemoryHumanReviewRepository } from "../../src/modules/human-review/in-memory-human-review-repository.ts";
import type { HumanReviewDiffRecord } from "../../src/modules/human-review/human-review-record.ts";
import { HumanReviewService } from "../../src/modules/human-review/human-review-service.ts";
import { InMemoryJobRepository } from "../../src/modules/jobs/in-memory-job-repository.ts";
import { InMemoryManuscriptRepository } from "../../src/modules/manuscripts/in-memory-manuscript-repository.ts";

function createHarness(options: {
  reviewItemsService?: ConstructorParameters<typeof HumanReviewService>[0]["reviewItemsService"];
} = {}) {
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const assetRepository = new InMemoryDocumentAssetRepository();
  const jobRepository = new InMemoryJobRepository();
  const humanReviewRepository = new InMemoryHumanReviewRepository();
  const transformCalls: ApplyDeterministicDocxRulesInput[] = [];
  const assetService = new DocumentAssetService({
    manuscriptRepository,
    assetRepository,
    createId: () => "asset-human-final-1",
    now: () => new Date("2026-04-28T01:00:00.000Z"),
  });
  const service = new HumanReviewService({
    repository: humanReviewRepository,
    manuscriptRepository,
    assetRepository,
    jobRepository,
    documentAssetService: assetService,
    editorialDocxTransformService: {
      async applyDeterministicRules(input) {
        transformCalls.push(input);
        return {
          appliedRuleIds: [],
          appliedChanges: [],
          tableInspectionFindings: [],
          tablePatchPlans: [],
          tablePatchResults: [],
          skippedAiReplacements: [],
        };
      },
    },
    reviewItemsService: options.reviewItemsService,
    createId: () => "job-human-review-publish-1",
    now: () => new Date("2026-04-28T01:05:00.000Z"),
  });

  return {
    manuscriptRepository,
    assetRepository,
    humanReviewRepository,
    service,
    transformCalls,
  };
}

async function seedManuscriptAndAssets(input: {
  manuscriptRepository: InMemoryManuscriptRepository;
  assetRepository: InMemoryDocumentAssetRepository;
}) {
  await input.manuscriptRepository.save({
    id: "manuscript-1",
    title: "Human Review Publish",
    manuscript_type: "review",
    status: "awaiting_review",
    created_by: "proofreader-1",
    current_proofreading_asset_id: "asset-base",
    created_at: "2026-04-28T00:00:00.000Z",
    updated_at: "2026-04-28T00:00:00.000Z",
  });
  await input.assetRepository.save(createAsset("asset-base", "final_proof_annotated_docx"));
  await input.assetRepository.save(createAsset("asset-work", "human_review_working_docx"));
}

function createAsset(
  id: string,
  assetType: DocumentAssetRecord["asset_type"],
): DocumentAssetRecord {
  return {
    id,
    manuscript_id: "manuscript-1",
    asset_type: assetType,
    status: "active",
    storage_key: `runs/human-review/${id}.docx`,
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    parent_asset_id: assetType === "human_review_working_docx" ? "asset-base" : undefined,
    source_module: assetType === "human_review_working_docx" ? "manual" : "proofreading",
    source_job_id: `job-${id}`,
    created_by: "proofreader-1",
    version_no: 1,
    is_current: assetType !== "human_review_working_docx",
    file_name: `${id}.docx`,
    created_at: "2026-04-28T00:00:00.000Z",
    updated_at: "2026-04-28T00:00:00.000Z",
  };
}

function createDiff(
  overrides: Partial<HumanReviewDiffRecord> = {},
): HumanReviewDiffRecord {
  return {
    id: "diff-1",
    module: "proofreading",
    manuscript_id: "manuscript-1",
    baseline_asset_id: "asset-base",
    working_asset_id: "asset-work",
    source: "human_overrode_ai",
    content_decision: "unconfirmed",
    governance_intents: { rule_candidate: false, knowledge_candidate: false },
    apply_capability: "auto_apply_revert",
    status: "pending",
    before_text: "ALT remained stable.",
    after_text: "Serum ALT remained stable.",
    created_at: "2026-04-28T00:00:00.000Z",
    updated_at: "2026-04-28T00:00:00.000Z",
    ...overrides,
  };
}

test("human review publish blocks missing and deferred decisions", async () => {
  const { manuscriptRepository, assetRepository, humanReviewRepository, service } =
    createHarness();
  await seedManuscriptAndAssets({ manuscriptRepository, assetRepository });
  await humanReviewRepository.saveDiffItem(createDiff());

  await assert.rejects(
    () =>
      service.publishConfirmedFinal({
        manuscriptId: "manuscript-1",
        module: "proofreading",
      }),
    /all human review differences must be confirmed/u,
  );

  await humanReviewRepository.updateDiffItem("diff-1", {
    content_decision: "defer",
    status: "pending",
  });
  await assert.rejects(
    () =>
      service.publishConfirmedFinal({
        manuscriptId: "manuscript-1",
        module: "proofreading",
      }),
    /all human review differences must be confirmed/u,
  );
});

test("human review publish blocks unsafe unresolved differences", async () => {
  const { manuscriptRepository, assetRepository, humanReviewRepository, service } =
    createHarness();
  await seedManuscriptAndAssets({ manuscriptRepository, assetRepository });
  await humanReviewRepository.saveDiffItem(
    createDiff({
      content_decision: "keep",
      apply_capability: "unsafe_needs_manual_review",
      complexity_flags: ["table_structure"],
      status: "blocks_publish",
    }),
  );

  await assert.rejects(
    () =>
      service.publishConfirmedFinal({
        manuscriptId: "manuscript-1",
        module: "proofreading",
      }),
    /unsafe human review differences/u,
  );
});

test("human review publish applies kept text diffs and excludes rejected diffs", async () => {
  const {
    manuscriptRepository,
    assetRepository,
    humanReviewRepository,
    service,
    transformCalls,
  } = createHarness();
  await seedManuscriptAndAssets({ manuscriptRepository, assetRepository });
  await humanReviewRepository.saveDiffItems([
    createDiff({
      id: "diff-keep",
      content_decision: "keep",
      status: "confirmed",
      before_text: "ALT remained stable.",
      after_text: "Serum ALT remained stable.",
    }),
    createDiff({
      id: "diff-reject",
      content_decision: "reject",
      status: "confirmed",
      before_text: "This correction should be rejected.",
      after_text: "Rejected replacement.",
    }),
  ]);

  const result = await service.publishConfirmedFinal({
    manuscriptId: "manuscript-1",
    module: "proofreading",
    requestedBy: "proofreader-1",
    outputStorageKey: "runs/human-review/final.docx",
    outputFileName: "human-final.docx",
  });

  assert.equal(result.asset.asset_type, "human_final_docx");
  assert.equal(result.job.job_type, "human_review_publish_final");
  assert.equal(transformCalls.length, 1);
  assert.equal(transformCalls[0]?.sourceAssetId, "asset-base");
  assert.deepEqual(transformCalls[0]?.aiReplacements, [
    {
      targetText: "ALT remained stable.",
      replacementText: "Serum ALT remained stable.",
      reason: "Human review diff diff-keep kept by reviewer.",
    },
  ]);

  const keep = await humanReviewRepository.findDiffItemById("diff-keep");
  const reject = await humanReviewRepository.findDiffItemById("diff-reject");
  assert.equal(keep?.final_asset_id, result.asset.id);
  assert.equal(reject?.final_asset_id, result.asset.id);
  assert.equal(keep?.status, "published_writeback_done");
  assert.equal(reject?.status, "published_writeback_done");
});

test("human review publish keeps final asset when candidate backflow fails", async () => {
  const {
    manuscriptRepository,
    assetRepository,
    humanReviewRepository,
    service,
  } = createHarness({
    reviewItemsService: {
      async submitGovernedHit() {
        throw new Error("candidate service unavailable");
      },
      async decideReviewItem() {
        throw new Error("decideReviewItem should not run after submit failure.");
      },
    },
  });
  await seedManuscriptAndAssets({ manuscriptRepository, assetRepository });
  await humanReviewRepository.saveDiffItem(
    createDiff({
      id: "diff-rule-1",
      content_decision: "keep",
      status: "confirmed",
      governance_intents: { rule_candidate: true, knowledge_candidate: false },
    }),
  );

  const result = await service.publishConfirmedFinal({
    manuscriptId: "manuscript-1",
    module: "proofreading",
    requestedBy: "proofreader-1",
    actorRole: "proofreader",
    outputStorageKey: "runs/human-review/final.docx",
    outputFileName: "human-final.docx",
  });

  assert.equal(result.asset.asset_type, "human_final_docx");
  assert.equal(result.backflow.summary.failed_count, 1);
  const item = await humanReviewRepository.findDiffItemById("diff-rule-1");
  assert.equal(item?.status, "writeback_failed");
  assert.match(item?.backflow_error ?? "", /candidate service unavailable/u);
  const attempts =
    await humanReviewRepository.listBackflowAttemptsByDiffItemId("diff-rule-1");
  assert.equal(attempts[0]?.target, "rule_candidate");
  assert.equal(attempts[0]?.status, "failed");
});
