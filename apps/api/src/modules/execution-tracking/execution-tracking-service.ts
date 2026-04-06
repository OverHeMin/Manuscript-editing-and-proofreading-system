import { randomUUID } from "node:crypto";
import {
  createDirectWriteTransactionManager,
  createScopedWriteTransactionManager,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import {
  InMemoryExecutionTrackingRepository,
} from "./in-memory-execution-tracking-repository.ts";
import type {
  ExecutionTrackingRepository,
} from "./execution-tracking-repository.ts";
import type {
  KnowledgeHitLogRecord,
  ModuleExecutionSnapshotRecord,
} from "./execution-tracking-record.ts";

export interface RecordKnowledgeHitInput {
  knowledgeItemId: string;
  matchSourceId?: string;
  bindingRuleId?: string;
  matchSource: KnowledgeHitLogRecord["match_source"];
  matchReasons: string[];
  score?: number;
  section?: string;
}

export interface RecordExecutionSnapshotInput {
  manuscriptId: string;
  module: ModuleExecutionSnapshotRecord["module"];
  jobId: string;
  executionProfileId: string;
  moduleTemplateId: string;
  moduleTemplateVersionNo: number;
  promptTemplateId: string;
  promptTemplateVersion: string;
  skillPackageIds: string[];
  skillPackageVersions: string[];
  modelId: string;
  modelVersion?: string;
  createdAssetIds?: string[];
  agentExecutionLogId?: string;
  draftSnapshotId?: string;
  knowledgeHits: RecordKnowledgeHitInput[];
}

interface ExecutionTrackingWriteContext {
  repository: ExecutionTrackingRepository;
}

export interface ExecutionTrackingServiceOptions {
  repository: ExecutionTrackingRepository;
  transactionManager?: WriteTransactionManager<ExecutionTrackingWriteContext>;
  createId?: () => string;
  now?: () => Date;
}

export class ExecutionTrackingSkillPackageVersionMismatchError extends Error {
  constructor() {
    super("Skill package ids and versions must have the same length.");
    this.name = "ExecutionTrackingSkillPackageVersionMismatchError";
  }
}

export class ExecutionTrackingService {
  private readonly repository: ExecutionTrackingRepository;
  private readonly transactionManager: WriteTransactionManager<ExecutionTrackingWriteContext>;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: ExecutionTrackingServiceOptions) {
    this.repository = options.repository;
    this.transactionManager =
      options.transactionManager ??
      createExecutionTrackingTransactionManager({
        repository: this.repository,
      });
    this.createId = options.createId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  async recordSnapshot(
    input: RecordExecutionSnapshotInput,
  ): Promise<ModuleExecutionSnapshotRecord> {
    if (input.skillPackageIds.length !== input.skillPackageVersions.length) {
      throw new ExecutionTrackingSkillPackageVersionMismatchError();
    }

    return this.transactionManager.withTransaction(async ({ repository }) => {
      const timestamp = this.now().toISOString();
      const snapshotId = this.createId();
      const knowledgeItemIds = dedupePreserveOrder(
        input.knowledgeHits.map((hit) => hit.knowledgeItemId),
      );
      const snapshot: ModuleExecutionSnapshotRecord = {
        id: snapshotId,
        manuscript_id: input.manuscriptId,
        module: input.module,
        job_id: input.jobId,
        execution_profile_id: input.executionProfileId,
        module_template_id: input.moduleTemplateId,
        module_template_version_no: input.moduleTemplateVersionNo,
        prompt_template_id: input.promptTemplateId,
        prompt_template_version: input.promptTemplateVersion,
        skill_package_ids: [...input.skillPackageIds],
        skill_package_versions: [...input.skillPackageVersions],
        model_id: input.modelId,
        model_version: input.modelVersion,
        knowledge_item_ids: knowledgeItemIds,
        created_asset_ids: input.createdAssetIds ? [...input.createdAssetIds] : [],
        agent_execution_log_id: input.agentExecutionLogId,
        draft_snapshot_id: input.draftSnapshotId,
        created_at: timestamp,
      };

      await repository.saveSnapshot(snapshot);

      for (const hit of input.knowledgeHits) {
        const record: KnowledgeHitLogRecord = {
          id: this.createId(),
          snapshot_id: snapshotId,
          knowledge_item_id: hit.knowledgeItemId,
          match_source_id: hit.matchSourceId,
          binding_rule_id: hit.bindingRuleId,
          match_source: hit.matchSource,
          match_reasons: [...hit.matchReasons],
          score: hit.score,
          section: hit.section,
          created_at: timestamp,
        };
        await repository.saveKnowledgeHitLog(record);
      }

      return snapshot;
    });
  }

  getSnapshot(snapshotId: string): Promise<ModuleExecutionSnapshotRecord | undefined> {
    return this.repository.findSnapshotById(snapshotId);
  }

  listSnapshotsByManuscriptId(
    manuscriptId: string,
  ): Promise<ModuleExecutionSnapshotRecord[]> {
    return this.repository.listSnapshotsByManuscriptId(manuscriptId);
  }

  listKnowledgeHitLogsBySnapshotId(
    snapshotId: string,
  ): Promise<KnowledgeHitLogRecord[]> {
    return this.repository.listKnowledgeHitLogsBySnapshotId(snapshotId);
  }
}

function createExecutionTrackingTransactionManager(
  context: ExecutionTrackingWriteContext,
): WriteTransactionManager<ExecutionTrackingWriteContext> {
  if (context.repository instanceof InMemoryExecutionTrackingRepository) {
    return createScopedWriteTransactionManager({
      queueKey: context.repository,
      context,
      repositories: [context.repository],
    });
  }

  return createDirectWriteTransactionManager(context);
}

function dedupePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}
