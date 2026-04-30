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
import type { ReviewItemsService } from "../../src/modules/review-items/review-items-service.ts";

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
    jobRepository,
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

test("human review publish blocks kept diffs that V1 cannot safely materialize", async () => {
  const { manuscriptRepository, assetRepository, humanReviewRepository, service } =
    createHarness();
  await seedManuscriptAndAssets({ manuscriptRepository, assetRepository });
  await humanReviewRepository.saveDiffItems([
    createDiff({
      id: "diff-added",
      source: "human_added",
      content_decision: "keep",
      status: "confirmed",
      before_text: "",
      after_text: "新增人工补充段落。",
    }),
    createDiff({
      id: "diff-no-safe-revert",
      content_decision: "keep",
      status: "confirmed",
      apply_capability: "keep_only_no_safe_revert",
      before_text: "Baseline text.",
      after_text: "Working text.",
    }),
  ]);

  const preflight = await service.preflightPublish({
    manuscriptId: "manuscript-1",
    module: "proofreading",
  });

  assert.equal(preflight.can_publish, false);
  assert.match(
    preflight.blocking_reasons.join("; "),
    /cannot be safely written to the final manuscript/u,
  );
  await assert.rejects(
    () =>
      service.publishConfirmedFinal({
        manuscriptId: "manuscript-1",
        module: "proofreading",
      }),
    /cannot be safely written to the final manuscript/u,
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

test("human review publish merges confirmed AI proofreading issues with human edit diffs", async () => {
  const {
    manuscriptRepository,
    assetRepository,
    humanReviewRepository,
    service,
    transformCalls,
  } = createHarness();
  await seedManuscriptAndAssets({ manuscriptRepository, assetRepository });
  await humanReviewRepository.saveDiffItem(
    createDiff({
      id: "human-diff-keep",
      content_decision: "keep",
      status: "confirmed",
      before_text: "ALT remained stable.",
      after_text: "Serum ALT remained stable.",
    }),
  );

  const result = await service.publishConfirmedFinal({
    manuscriptId: "manuscript-1",
    module: "proofreading",
    requestedBy: "proofreader-1",
    outputStorageKey: "runs/human-review/final.docx",
    outputFileName: "human-final.docx",
    proofreadingConfirmationDecisions: [
      {
        itemId: "ai-issue-1",
        targetText: "5 mg per dL",
        replacementText: "5 mg/dL",
        finalReplacementText: "5 mg/dL",
        action: "accepted",
      },
      {
        itemId: "ai-issue-2",
        targetText: "unchanged AI suggestion",
        replacementText: "unused replacement",
        finalReplacementText: "unused replacement",
        action: "rejected",
      },
    ],
  });

  assert.equal(result.asset.asset_type, "human_final_docx");
  assert.equal(transformCalls.length, 1);
  assert.equal(transformCalls[0]?.sourceAssetId, "asset-base");
  assert.deepEqual(transformCalls[0]?.aiReplacements, [
    {
      targetText: "5 mg per dL",
      replacementText: "5 mg/dL",
      reason: "Proofreading confirmation ai-issue-1 kept by reviewer.",
    },
    {
      targetText: "ALT remained stable.",
      replacementText: "Serum ALT remained stable.",
      reason: "Human review diff human-diff-keep kept by reviewer.",
    },
  ]);
  assert.deepEqual(result.job.payload?.proofreadingConfirmationDecisionIds, [
    "ai-issue-1",
    "ai-issue-2",
  ]);
});

test("human review publish blocks incomplete AI proofreading confirmations", async () => {
  const {
    manuscriptRepository,
    assetRepository,
    jobRepository,
    humanReviewRepository,
    service,
  } = createHarness();
  await seedManuscriptAndAssets({ manuscriptRepository, assetRepository });
  await jobRepository.save({
    id: "job-asset-base",
    manuscript_id: "manuscript-1",
    module: "proofreading",
    job_type: "proofreading_run",
    status: "completed",
    requested_by: "proofreader-1",
    payload: {
      proofreadingPlan: {
        issues: [
          {
            itemId: "ai-issue-1",
            anchor: { quote: "5 mg per dL" },
            suggestion: { replacementText: "5 mg/dL" },
          },
          {
            itemId: "ai-issue-2",
            anchor: { quote: "The hemoglobin were stable." },
            suggestion: { replacementText: "The hemoglobin was stable." },
          },
        ],
      },
    },
    attempt_count: 1,
    created_at: "2026-04-28T00:00:00.000Z",
    updated_at: "2026-04-28T00:00:00.000Z",
  });
  await humanReviewRepository.saveDiffItem(
    createDiff({
      id: "human-diff-keep",
      content_decision: "keep",
      status: "confirmed",
      before_text: "ALT remained stable.",
      after_text: "Serum ALT remained stable.",
    }),
  );

  await assert.rejects(
    () =>
      service.publishConfirmedFinal({
        manuscriptId: "manuscript-1",
        module: "proofreading",
        requestedBy: "proofreader-1",
        outputStorageKey: "runs/human-review/final.docx",
        outputFileName: "human-final.docx",
        proofreadingConfirmationDecisions: [
          {
            itemId: "ai-issue-1",
            targetText: "5 mg per dL",
            replacementText: "5 mg/dL",
            finalReplacementText: "5 mg/dL",
            action: "accepted",
          },
          {
            itemId: "ai-issue-2",
            targetText: "The hemoglobin were stable.",
            replacementText: "The hemoglobin was stable.",
            finalReplacementText: "The hemoglobin was stable.",
            action: "escalated",
          },
        ],
    }),
    /AI proofreading issue ai-issue-2 is escalated and must be resolved/u,
  );

  await assert.rejects(
    () =>
      service.publishConfirmedFinal({
        manuscriptId: "manuscript-1",
        module: "proofreading",
        requestedBy: "proofreader-1",
        outputStorageKey: "runs/human-review/final.docx",
        outputFileName: "human-final.docx",
        proofreadingConfirmationDecisions: [
          {
            itemId: "ai-issue-1",
            targetText: "5 mg per dL",
            replacementText: "5 mg/dL",
            finalReplacementText: "5 mg/dL",
            action: "accepted",
          },
        ],
      }),
    /AI proofreading issues must all be confirmed/u,
  );

  await assert.rejects(
    () =>
      service.publishConfirmedFinal({
        manuscriptId: "manuscript-1",
        module: "proofreading",
        requestedBy: "proofreader-1",
        outputStorageKey: "runs/human-review/final.docx",
        outputFileName: "human-final.docx",
        proofreadingConfirmationItemCount: 2,
        proofreadingConfirmationDecisions: [
          {
            itemId: "ai-issue-1",
            targetText: "5 mg per dL",
            replacementText: "5 mg/dL",
            finalReplacementText: "5 mg/dL",
            action: "accepted",
          },
        ],
      }),
    /AI proofreading issues must all be confirmed/u,
  );

  await assert.rejects(
    () =>
      service.publishConfirmedFinal({
        manuscriptId: "manuscript-1",
        module: "proofreading",
        requestedBy: "proofreader-1",
        outputStorageKey: "runs/human-review/final.docx",
        outputFileName: "human-final.docx",
        proofreadingConfirmationDecisions: [
          {
            itemId: "ai-issue-1",
            targetText: "5 mg per dL",
            replacementText: "5 mg/dL",
            finalReplacementText: "5 mg/dL",
            action: "accepted",
          },
          {
            itemId: "ai-issue-2",
            targetText: "The hemoglobin were stable.",
            replacementText: "The hemoglobin was stable.",
            finalReplacementText: "The hemoglobin was stable.",
            action: "manual_only",
            blocksFinal: true,
          },
        ],
      }),
    /AI proofreading issue ai-issue-2 still requires manual confirmation/u,
  );
});

test("human review publish keeps accepted AI issue while routing it to rule and knowledge candidates", async () => {
  const governedHitSubmissions: Array<{
    feedbackCategory?: string;
    excerpt?: string;
    suggestion?: string;
    originPayload?: Record<string, unknown>;
  }> = [];
  const reviewDecisions: Array<{
    action?: string;
    proposalText?: string;
  }> = [];
  const {
    manuscriptRepository,
    assetRepository,
    humanReviewRepository,
    service,
    transformCalls,
  } = createHarness({
    reviewItemsService: {
      async submitGovernedHit(
        input: Parameters<ReviewItemsService["submitGovernedHit"]>[0],
      ) {
        governedHitSubmissions.push({
          feedbackCategory: input.feedbackCategory,
          excerpt: input.excerpt,
          suggestion: input.suggestion,
          originPayload: input.originPayload,
        });
        return {
          feedback: null,
          item: {
            id: `review-item-${governedHitSubmissions.length}`,
            title: input.title,
          },
        };
      },
      async decideReviewItem(
        input: Parameters<ReviewItemsService["decideReviewItem"]>[0],
      ) {
        reviewDecisions.push({
          action: input.action,
          proposalText:
            "proposalText" in input ? input.proposalText : undefined,
        });
        return {
          action: input.action,
          item: {
            id: `learning-candidate-${reviewDecisions.length}`,
          },
        };
      },
    } as never,
  });
  await seedManuscriptAndAssets({ manuscriptRepository, assetRepository });
  await humanReviewRepository.saveDiffItem(
    createDiff({
      id: "human-diff-keep",
      content_decision: "keep",
      status: "confirmed",
      before_text: "ALT remained stable.",
      after_text: "Serum ALT remained stable.",
    }),
  );

  const result = await service.publishConfirmedFinal({
    manuscriptId: "manuscript-1",
    module: "proofreading",
    requestedBy: "proofreader-1",
    outputStorageKey: "runs/human-review/final.docx",
    outputFileName: "human-final.docx",
    proofreadingConfirmationDecisions: [
      {
        itemId: "ai-issue-1",
        targetText: "5 mg per dL",
        replacementText: "5 mg/dL",
        finalReplacementText: "5 mg/dL",
        action: "accepted",
        routeToRuleCandidate: true,
        routeToKnowledgeCandidate: true,
      },
    ],
  });

  assert.equal(result.asset.asset_type, "human_final_docx");
  assert.deepEqual(transformCalls[0]?.aiReplacements, [
    {
      targetText: "5 mg per dL",
      replacementText: "5 mg/dL",
      reason: "Proofreading confirmation ai-issue-1 kept by reviewer.",
    },
    {
      targetText: "ALT remained stable.",
      replacementText: "Serum ALT remained stable.",
      reason: "Human review diff human-diff-keep kept by reviewer.",
    },
  ]);
  assert.deepEqual(result.job.payload?.proofreadingConfirmationDecisionIds, [
    "ai-issue-1",
  ]);
  assert.deepEqual(result.job.payload?.proofreadingConfirmationGovernanceIntents, [
    {
      itemId: "ai-issue-1",
      ruleCandidate: true,
      knowledgeCandidate: true,
    },
  ]);
  assert.deepEqual(
    governedHitSubmissions.map((submission) => ({
      feedbackCategory: submission.feedbackCategory,
      excerpt: submission.excerpt,
      suggestion: submission.suggestion,
      routeAction: submission.originPayload?.routeAction,
    })),
    [
      {
        feedbackCategory: "missed_hit",
        excerpt: "5 mg per dL",
        suggestion: "5 mg/dL",
        routeAction: "route_to_rule_candidate",
      },
      {
        feedbackCategory: "missing_knowledge",
        excerpt: "5 mg per dL",
        suggestion: "5 mg/dL",
        routeAction: "route_to_knowledge_candidate",
      },
    ],
  );
  assert.deepEqual(reviewDecisions, [
    {
      action: "route_to_rule_candidate",
      proposalText: "5 mg/dL",
    },
    {
      action: "route_to_knowledge_candidate",
      proposalText: "5 mg/dL",
    },
  ]);
  assert.deepEqual(result.job.payload?.proofreadingConfirmationBackflow, {
    attempted_count: 2,
    succeeded_count: 2,
    failed_count: 0,
  });
  assert.deepEqual(result.backflow.summary, {
    attempted_count: 2,
    succeeded_count: 2,
    failed_count: 0,
  });
});

test("human review publish creates an edited docx final for editing module", async () => {
  const {
    manuscriptRepository,
    assetRepository,
    humanReviewRepository,
    service,
    transformCalls,
  } = createHarness();
  await manuscriptRepository.save({
    id: "manuscript-1",
    title: "Editing Human Review Publish",
    manuscript_type: "review",
    status: "awaiting_review",
    created_by: "editor-1",
    current_editing_asset_id: "asset-edit-base",
    created_at: "2026-04-28T00:00:00.000Z",
    updated_at: "2026-04-28T00:00:00.000Z",
  });
  await assetRepository.save(createAsset("asset-edit-base", "edited_docx"));
  await assetRepository.save(
    createAsset("asset-edit-work", "human_review_working_docx"),
  );
  await humanReviewRepository.saveDiffItem(
    createDiff({
      id: "diff-edit-1",
      module: "editing",
      baseline_asset_id: "asset-edit-base",
      working_asset_id: "asset-edit-work",
      content_decision: "keep",
      status: "confirmed",
      before_text: "Methods were described.",
      after_text: "The methods were described.",
    }),
  );

  const result = await service.publishConfirmedFinal({
    manuscriptId: "manuscript-1",
    module: "editing",
    requestedBy: "editor-1",
    actorRole: "editor",
    outputStorageKey: "runs/human-review/editing-final.docx",
    outputFileName: "editing-final.docx",
  });

  assert.equal(result.asset.asset_type, "edited_docx");
  assert.equal(result.asset.source_module, "editing");
  assert.equal(result.asset.parent_asset_id, "asset-edit-base");
  assert.equal(transformCalls[0]?.sourceAssetId, "asset-edit-base");
  assert.deepEqual(transformCalls[0]?.aiReplacements, [
    {
      targetText: "Methods were described.",
      replacementText: "The methods were described.",
      reason: "Human review diff diff-edit-1 kept by reviewer.",
    },
  ]);
  const manuscript = await manuscriptRepository.findById("manuscript-1");
  assert.equal(manuscript?.current_editing_asset_id, result.asset.id);
  assert.equal(manuscript?.current_proofreading_asset_id, undefined);
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
