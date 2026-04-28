import type { ExecutionTrackingRepository } from "../execution-tracking/execution-tracking-repository.ts";
import type { KnowledgeHitLogRecord } from "../execution-tracking/execution-tracking-record.ts";

export interface KnowledgeUsageMetricSummaryRecord {
  knowledge_item_id: string;
  retrieval_count: number;
  retrieval_count_30d: number;
  last_used_at?: string;
}

export interface KnowledgeUsageMetricsServiceOptions {
  executionTrackingRepository: ExecutionTrackingRepository;
  now?: () => Date;
}

export class KnowledgeUsageMetricsService {
  private readonly executionTrackingRepository: ExecutionTrackingRepository;
  private readonly now: () => Date;

  constructor(options: KnowledgeUsageMetricsServiceOptions) {
    this.executionTrackingRepository = options.executionTrackingRepository;
    this.now = options.now ?? (() => new Date());
  }

  async summarizeByKnowledgeItemIds(
    knowledgeItemIds: readonly string[],
  ): Promise<Map<string, KnowledgeUsageMetricSummaryRecord>> {
    const normalizedIds = Array.from(
      new Set(knowledgeItemIds.map((id) => id.trim()).filter(Boolean)),
    );
    if (normalizedIds.length === 0) {
      return new Map();
    }

    const hitLogs =
      await this.executionTrackingRepository.listKnowledgeHitLogsByKnowledgeItemIds(
        normalizedIds,
      );
    return summarizeKnowledgeUsageMetrics(hitLogs, this.now());
  }
}

export function summarizeKnowledgeUsageMetrics(
  hitLogs: readonly KnowledgeHitLogRecord[],
  now: Date,
): Map<string, KnowledgeUsageMetricSummaryRecord> {
  const summaries = new Map<string, KnowledgeUsageMetricSummaryRecord>();
  const recentThreshold = now.getTime() - 30 * 24 * 60 * 60 * 1000;

  for (const hitLog of hitLogs) {
    const current =
      summaries.get(hitLog.knowledge_item_id) ??
      ({
        knowledge_item_id: hitLog.knowledge_item_id,
        retrieval_count: 0,
        retrieval_count_30d: 0,
      } satisfies KnowledgeUsageMetricSummaryRecord);

    current.retrieval_count += 1;
    const createdAt = Date.parse(hitLog.created_at);
    if (!Number.isNaN(createdAt)) {
      if (createdAt >= recentThreshold) {
        current.retrieval_count_30d += 1;
      }

      if (
        !current.last_used_at ||
        createdAt > Date.parse(current.last_used_at)
      ) {
        current.last_used_at = new Date(createdAt).toISOString();
      }
    }

    summaries.set(hitLog.knowledge_item_id, current);
  }

  return summaries;
}
