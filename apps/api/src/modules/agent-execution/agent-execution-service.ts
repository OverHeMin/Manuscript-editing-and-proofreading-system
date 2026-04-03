import { randomUUID } from "node:crypto";
import {
  createDirectWriteTransactionManager,
  createScopedWriteTransactionManager,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import {
  InMemoryAgentExecutionRepository,
} from "./in-memory-agent-execution-repository.ts";
import type { AgentExecutionLogRecord } from "./agent-execution-record.ts";
import type { AgentExecutionRepository } from "./agent-execution-repository.ts";

export interface CreateAgentExecutionLogInput {
  manuscriptId: string;
  module: AgentExecutionLogRecord["module"];
  triggeredBy: string;
  runtimeId: string;
  sandboxProfileId: string;
  agentProfileId: string;
  runtimeBindingId: string;
  toolPermissionPolicyId: string;
  knowledgeItemIds: string[];
  verificationCheckProfileIds?: string[];
  evaluationSuiteIds?: string[];
  releaseCheckProfileId?: string;
}

export interface CompleteAgentExecutionLogInput {
  logId: string;
  executionSnapshotId: string;
  verificationEvidenceIds?: string[];
}

interface AgentExecutionWriteContext {
  repository: AgentExecutionRepository;
}

export interface AgentExecutionServiceOptions {
  repository: AgentExecutionRepository;
  transactionManager?: WriteTransactionManager<AgentExecutionWriteContext>;
  createId?: () => string;
  now?: () => Date;
}

export class AgentExecutionLogNotFoundError extends Error {
  constructor(logId: string) {
    super(`Agent execution log ${logId} was not found.`);
    this.name = "AgentExecutionLogNotFoundError";
  }
}

export class AgentExecutionService {
  private readonly repository: AgentExecutionRepository;
  private readonly transactionManager: WriteTransactionManager<AgentExecutionWriteContext>;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: AgentExecutionServiceOptions) {
    this.repository = options.repository;
    this.transactionManager =
      options.transactionManager ??
      createAgentExecutionTransactionManager({
        repository: this.repository,
      });
    this.createId = options.createId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  async createLog(
    input: CreateAgentExecutionLogInput,
  ): Promise<AgentExecutionLogRecord> {
    return this.transactionManager.withTransaction(async ({ repository }) => {
      const record: AgentExecutionLogRecord = {
        id: this.createId(),
        manuscript_id: input.manuscriptId,
        module: input.module,
        triggered_by: input.triggeredBy,
        runtime_id: input.runtimeId,
        sandbox_profile_id: input.sandboxProfileId,
        agent_profile_id: input.agentProfileId,
        runtime_binding_id: input.runtimeBindingId,
        tool_permission_policy_id: input.toolPermissionPolicyId,
        knowledge_item_ids: dedupePreserveOrder(input.knowledgeItemIds),
        verification_check_profile_ids: dedupePreserveOrder(
          input.verificationCheckProfileIds ?? [],
        ),
        evaluation_suite_ids: dedupePreserveOrder(input.evaluationSuiteIds ?? []),
        release_check_profile_id: input.releaseCheckProfileId,
        verification_evidence_ids: [],
        status: "running",
        started_at: this.now().toISOString(),
        finished_at: undefined,
      };

      await repository.save(record);
      return record;
    });
  }

  async completeLog(
    input: CompleteAgentExecutionLogInput,
  ): Promise<AgentExecutionLogRecord> {
    return this.transactionManager.withTransaction(async ({ repository }) => {
      const existing = await repository.findById(input.logId);
      if (!existing) {
        throw new AgentExecutionLogNotFoundError(input.logId);
      }

      const completed: AgentExecutionLogRecord = {
        ...existing,
        knowledge_item_ids: [...existing.knowledge_item_ids],
        verification_check_profile_ids: [
          ...existing.verification_check_profile_ids,
        ],
        evaluation_suite_ids: [...existing.evaluation_suite_ids],
        release_check_profile_id: existing.release_check_profile_id,
        execution_snapshot_id: input.executionSnapshotId,
        verification_evidence_ids: dedupePreserveOrder(
          input.verificationEvidenceIds ?? [],
        ),
        status: "completed",
        finished_at: this.now().toISOString(),
      };

      await repository.save(completed);
      return completed;
    });
  }

  async getLog(logId: string): Promise<AgentExecutionLogRecord> {
    const record = await this.repository.findById(logId);
    if (!record) {
      throw new AgentExecutionLogNotFoundError(logId);
    }

    return record;
  }

  listLogs(): Promise<AgentExecutionLogRecord[]> {
    return this.repository.list();
  }
}

function createAgentExecutionTransactionManager(
  context: AgentExecutionWriteContext,
): WriteTransactionManager<AgentExecutionWriteContext> {
  if (context.repository instanceof InMemoryAgentExecutionRepository) {
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
