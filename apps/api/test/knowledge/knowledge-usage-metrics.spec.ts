import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryExecutionTrackingRepository } from "../../src/modules/execution-tracking/in-memory-execution-tracking-repository.ts";
import {
  InMemoryKnowledgeRepository,
  InMemoryKnowledgeReviewActionRepository,
} from "../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import { createKnowledgeApi } from "../../src/modules/knowledge/knowledge-api.ts";
import { KnowledgeService } from "../../src/modules/knowledge/knowledge-service.ts";
import { KnowledgeUsageMetricsService } from "../../src/modules/knowledge/knowledge-usage-metrics.ts";
import type { KnowledgeHitLogRecord } from "../../src/modules/execution-tracking/execution-tracking-record.ts";

function buildHitLog(input: {
  id: string;
  knowledgeItemId: string;
  createdAt: string;
}): KnowledgeHitLogRecord {
  return {
    id: input.id,
    snapshot_id: `snapshot-${input.id}`,
    knowledge_item_id: input.knowledgeItemId,
    match_source: "dynamic_routing",
    match_reasons: ["semantic_match"],
    created_at: input.createdAt,
  };
}

test("knowledge usage metrics summarize all-time and recent hit logs by knowledge item", async () => {
  const repository = new InMemoryExecutionTrackingRepository();
  await repository.saveKnowledgeHitLog(
    buildHitLog({
      id: "hit-old",
      knowledgeItemId: "knowledge-1",
      createdAt: "2026-03-01T00:00:00.000Z",
    }),
  );
  await repository.saveKnowledgeHitLog(
    buildHitLog({
      id: "hit-recent-1",
      knowledgeItemId: "knowledge-1",
      createdAt: "2026-04-15T08:00:00.000Z",
    }),
  );
  await repository.saveKnowledgeHitLog(
    buildHitLog({
      id: "hit-recent-2",
      knowledgeItemId: "knowledge-1",
      createdAt: "2026-04-28T08:00:00.000Z",
    }),
  );
  await repository.saveKnowledgeHitLog(
    buildHitLog({
      id: "hit-other",
      knowledgeItemId: "knowledge-2",
      createdAt: "2026-04-20T08:00:00.000Z",
    }),
  );

  const service = new KnowledgeUsageMetricsService({
    executionTrackingRepository: repository,
    now: () => new Date("2026-04-28T12:00:00.000Z"),
  });

  const summaries = await service.summarizeByKnowledgeItemIds([
    "knowledge-1",
    "knowledge-2",
    "knowledge-missing",
  ]);

  assert.deepEqual(summaries.get("knowledge-1"), {
    knowledge_item_id: "knowledge-1",
    retrieval_count: 3,
    retrieval_count_30d: 2,
    last_used_at: "2026-04-28T08:00:00.000Z",
  });
  assert.deepEqual(summaries.get("knowledge-2"), {
    knowledge_item_id: "knowledge-2",
    retrieval_count: 1,
    retrieval_count_30d: 1,
    last_used_at: "2026-04-20T08:00:00.000Z",
  });
  assert.equal(summaries.has("knowledge-missing"), false);
});

test("execution tracking repository lists knowledge hit logs by knowledge item ids", async () => {
  const repository = new InMemoryExecutionTrackingRepository();
  await repository.saveKnowledgeHitLog(
    buildHitLog({
      id: "hit-1",
      knowledgeItemId: "knowledge-1",
      createdAt: "2026-04-28T08:00:00.000Z",
    }),
  );
  await repository.saveKnowledgeHitLog(
    buildHitLog({
      id: "hit-2",
      knowledgeItemId: "knowledge-2",
      createdAt: "2026-04-28T09:00:00.000Z",
    }),
  );
  await repository.saveKnowledgeHitLog(
    buildHitLog({
      id: "hit-3",
      knowledgeItemId: "knowledge-3",
      createdAt: "2026-04-28T10:00:00.000Z",
    }),
  );

  const hitLogs = await repository.listKnowledgeHitLogsByKnowledgeItemIds([
    "knowledge-2",
    "knowledge-1",
  ]);

  assert.deepEqual(
    hitLogs.map((record) => record.id),
    ["hit-1", "hit-2"],
  );
});

test("knowledge library list exposes usage metrics from hit logs without mutating knowledge records", async () => {
  const knowledgeRepository = new InMemoryKnowledgeRepository();
  const reviewActionRepository = new InMemoryKnowledgeReviewActionRepository();
  const executionTrackingRepository = new InMemoryExecutionTrackingRepository();
  const knowledgeService = new KnowledgeService({
    repository: knowledgeRepository,
    reviewActionRepository,
    createId: () => "knowledge-usage-1",
    now: () => new Date("2026-04-28T12:00:00.000Z"),
  });
  const created = await knowledgeService.createLibraryDraft({
    title: "表注处理依据",
    canonicalText: "表注应置于表下，并解释统计缩写。",
    knowledgeKind: "reference",
    moduleScope: "proofreading",
    manuscriptTypes: ["clinical_study"],
  });
  await executionTrackingRepository.saveKnowledgeHitLog(
    buildHitLog({
      id: "hit-recent",
      knowledgeItemId: created.asset.id,
      createdAt: "2026-04-27T08:00:00.000Z",
    }),
  );

  const api = createKnowledgeApi({
    knowledgeService,
    usageMetricsService: new KnowledgeUsageMetricsService({
      executionTrackingRepository,
      now: () => new Date("2026-04-28T12:00:00.000Z"),
    }),
  });

  const response = await api.listLibrary({});
  const item = response.body.items.find(
    (entry) => entry.asset_id === created.asset.id,
  );

  assert.deepEqual(item?.usage_metrics, {
    retrieval_count: 1,
    retrieval_count_30d: 1,
    last_used_at: "2026-04-27T08:00:00.000Z",
    revision_count: 1,
  });
  assert.equal(
    (await knowledgeService.getKnowledgeAsset(created.asset.id)).selected_revision
      .title,
    "表注处理依据",
  );
});
