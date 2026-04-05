import { randomUUID } from "node:crypto";
import {
  createDirectWriteTransactionManager,
  createScopedWriteTransactionManager,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import {
  InMemoryAgentExecutionRepository,
} from "./in-memory-agent-execution-repository.ts";
import type { ModelRoutingPolicyScopeKind } from "../model-routing-governance/model-routing-governance-record.ts";
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
  routingPolicyVersionId?: string;
  routingPolicyScopeKind?: ModelRoutingPolicyScopeKind;
  routingPolicyScopeValue?: string;
  resolvedModelId?: string;
  fallbackModelId?: string;
  fallbackTrigger?: string;
  orchestrationMaxAttempts?: number;
}

export interface CompleteAgentExecutionLogInput {
  logId: string;
  executionSnapshotId: string;
  verificationEvidenceIds?: string[];
}

export interface AppendVerificationEvidenceInput {
  logId: string;
  evidenceIds: string[];
}

export interface MarkAgentExecutionOrchestrationRunningInput {
  logId: string;
  claimToken?: string;
}

export interface CompleteAgentExecutionOrchestrationInput {
  logId: string;
  claimToken?: string;
  evidenceIds?: string[];
}

export interface FailAgentExecutionOrchestrationInput {
  logId: string;
  claimToken?: string;
  errorMessage: string;
  evidenceIds?: string[];
  nextRetryAt?: string;
}

export interface ClaimAgentExecutionOrchestrationInput {
  logId: string;
  claimToken: string;
  expectedOrchestrationStatus: AgentExecutionLogRecord["orchestration_status"];
  expectedAttemptCount: number;
  expectedLastAttemptStartedAt?: string;
  expectedNextRetryAt?: string;
  expectedAttemptClaimToken?: string;
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
      const evaluationSuiteIds = dedupePreserveOrder(input.evaluationSuiteIds ?? []);
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
        routing_policy_version_id: input.routingPolicyVersionId,
        routing_policy_scope_kind: input.routingPolicyScopeKind,
        routing_policy_scope_value: input.routingPolicyScopeValue,
        resolved_model_id: input.resolvedModelId,
        fallback_model_id: input.fallbackModelId,
        fallback_trigger: input.fallbackTrigger,
        knowledge_item_ids: dedupePreserveOrder(input.knowledgeItemIds),
        verification_check_profile_ids: dedupePreserveOrder(
          input.verificationCheckProfileIds ?? [],
        ),
        evaluation_suite_ids: evaluationSuiteIds,
        release_check_profile_id: input.releaseCheckProfileId,
        verification_evidence_ids: [],
        status: "running",
        orchestration_status:
          evaluationSuiteIds.length > 0 ? "pending" : "not_required",
        orchestration_attempt_count: 0,
        orchestration_max_attempts: Math.max(
          1,
          input.orchestrationMaxAttempts ?? 3,
        ),
        orchestration_last_error: undefined,
        orchestration_last_attempt_started_at: undefined,
        orchestration_last_attempt_finished_at: undefined,
        orchestration_attempt_claim_token: undefined,
        orchestration_next_retry_at: undefined,
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
        orchestration_status:
          existing.evaluation_suite_ids.length > 0
            ? existing.orchestration_status === "completed"
              ? "completed"
              : "pending"
            : "not_required",
        orchestration_attempt_count: existing.orchestration_attempt_count,
        orchestration_max_attempts: existing.orchestration_max_attempts,
        orchestration_last_error: existing.orchestration_last_error,
        orchestration_last_attempt_started_at:
          existing.orchestration_last_attempt_started_at,
        orchestration_last_attempt_finished_at:
          existing.orchestration_last_attempt_finished_at,
        orchestration_attempt_claim_token:
          existing.orchestration_attempt_claim_token,
        orchestration_next_retry_at: existing.orchestration_next_retry_at,
        finished_at: this.now().toISOString(),
      };

      await repository.save(completed);
      return completed;
    });
  }

  async appendVerificationEvidence(
    input: AppendVerificationEvidenceInput,
  ): Promise<AgentExecutionLogRecord> {
    return this.updateLog(input.logId, (existing) => ({
      ...cloneLogRecord(existing),
      verification_evidence_ids: dedupePreserveOrder([
        ...existing.verification_evidence_ids,
        ...input.evidenceIds,
      ]),
    }));
  }

  async markOrchestrationRunning(
    input: MarkAgentExecutionOrchestrationRunningInput,
  ): Promise<AgentExecutionLogRecord> {
    const timestamp = this.now().toISOString();
    return this.updateLog(input.logId, (existing) => ({
      ...cloneLogRecord(existing),
      orchestration_status: "running",
      orchestration_attempt_count: existing.orchestration_attempt_count + 1,
      orchestration_last_error: undefined,
      orchestration_last_attempt_started_at: timestamp,
      orchestration_last_attempt_finished_at: undefined,
      orchestration_attempt_claim_token: input.claimToken,
      orchestration_next_retry_at: undefined,
    }));
  }

  async claimOrchestrationAttempt(
    input: ClaimAgentExecutionOrchestrationInput,
  ): Promise<AgentExecutionLogRecord | undefined> {
    const timestamp = this.now().toISOString();
    return this.transactionManager.withTransaction(async ({ repository }) => {
      const existing = await repository.findById(input.logId);
      if (!existing) {
        throw new AgentExecutionLogNotFoundError(input.logId);
      }

      const claimed = await repository.saveIfOrchestrationStateMatches({
        record: {
          ...cloneLogRecord(existing),
          orchestration_status: "running",
          orchestration_attempt_count: existing.orchestration_attempt_count + 1,
          orchestration_last_error: undefined,
          orchestration_last_attempt_started_at: timestamp,
          orchestration_last_attempt_finished_at: undefined,
          orchestration_attempt_claim_token: input.claimToken,
          orchestration_next_retry_at: undefined,
        },
        expected: {
          orchestration_status: input.expectedOrchestrationStatus,
          orchestration_attempt_count: input.expectedAttemptCount,
          orchestration_last_attempt_started_at:
            input.expectedLastAttemptStartedAt,
          orchestration_next_retry_at: input.expectedNextRetryAt,
          orchestration_attempt_claim_token: input.expectedAttemptClaimToken,
        },
      });

      return claimed;
    });
  }

  async completeOrchestration(
    input: CompleteAgentExecutionOrchestrationInput,
  ): Promise<AgentExecutionLogRecord> {
    const timestamp = this.now().toISOString();
    return this.transactionManager.withTransaction(async ({ repository }) => {
      const existing = await repository.findById(input.logId);
      if (!existing) {
        throw new AgentExecutionLogNotFoundError(input.logId);
      }

      if (
        input.claimToken != null &&
        existing.orchestration_attempt_claim_token !== input.claimToken
      ) {
        return existing;
      }

      const updated = {
        ...cloneLogRecord(existing),
        verification_evidence_ids: dedupePreserveOrder([
          ...existing.verification_evidence_ids,
          ...(input.evidenceIds ?? []),
        ]),
        orchestration_status: "completed" as const,
        orchestration_last_error: undefined,
        orchestration_last_attempt_finished_at: timestamp,
        orchestration_attempt_claim_token: undefined,
        orchestration_next_retry_at: undefined,
      };

      if (input.claimToken == null) {
        await repository.save(updated);
        return updated;
      }

      const claimed = await repository.saveIfOrchestrationStateMatches({
        record: updated,
        expected: {
          orchestration_status: existing.orchestration_status,
          orchestration_attempt_count: existing.orchestration_attempt_count,
          orchestration_last_attempt_started_at:
            existing.orchestration_last_attempt_started_at,
          orchestration_next_retry_at: existing.orchestration_next_retry_at,
          orchestration_attempt_claim_token: input.claimToken,
        },
      });

      return claimed ?? (await repository.findById(input.logId)) ?? existing;
    });
  }

  async failOrchestrationAttempt(
    input: FailAgentExecutionOrchestrationInput,
  ): Promise<AgentExecutionLogRecord> {
    const timestamp = this.now().toISOString();
    return this.transactionManager.withTransaction(async ({ repository }) => {
      const existing = await repository.findById(input.logId);
      if (!existing) {
        throw new AgentExecutionLogNotFoundError(input.logId);
      }

      if (
        input.claimToken != null &&
        existing.orchestration_attempt_claim_token !== input.claimToken
      ) {
        return existing;
      }

      const exhausted =
        existing.orchestration_attempt_count >= existing.orchestration_max_attempts;
      const updated = {
        ...cloneLogRecord(existing),
        verification_evidence_ids: dedupePreserveOrder([
          ...existing.verification_evidence_ids,
          ...(input.evidenceIds ?? []),
        ]),
        orchestration_status: exhausted ? ("failed" as const) : ("retryable" as const),
        orchestration_last_error: input.errorMessage,
        orchestration_last_attempt_finished_at: timestamp,
        orchestration_attempt_claim_token: undefined,
        orchestration_next_retry_at:
          exhausted ? undefined : input.nextRetryAt ?? undefined,
      };

      if (input.claimToken == null) {
        await repository.save(updated);
        return updated;
      }

      const claimed = await repository.saveIfOrchestrationStateMatches({
        record: updated,
        expected: {
          orchestration_status: existing.orchestration_status,
          orchestration_attempt_count: existing.orchestration_attempt_count,
          orchestration_last_attempt_started_at:
            existing.orchestration_last_attempt_started_at,
          orchestration_next_retry_at: existing.orchestration_next_retry_at,
          orchestration_attempt_claim_token: input.claimToken,
        },
      });

      return claimed ?? (await repository.findById(input.logId)) ?? existing;
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

  private async updateLog(
    logId: string,
    updater: (existing: AgentExecutionLogRecord) => AgentExecutionLogRecord,
  ): Promise<AgentExecutionLogRecord> {
    return this.transactionManager.withTransaction(async ({ repository }) => {
      const existing = await repository.findById(logId);
      if (!existing) {
        throw new AgentExecutionLogNotFoundError(logId);
      }

      const updated = updater(existing);
      await repository.save(updated);
      return updated;
    });
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

function cloneLogRecord(record: AgentExecutionLogRecord): AgentExecutionLogRecord {
  return {
    ...record,
    knowledge_item_ids: [...record.knowledge_item_ids],
    verification_check_profile_ids: [...record.verification_check_profile_ids],
    evaluation_suite_ids: [...record.evaluation_suite_ids],
    verification_evidence_ids: [...record.verification_evidence_ids],
    orchestration_attempt_claim_token: record.orchestration_attempt_claim_token,
    orchestration_next_retry_at: record.orchestration_next_retry_at,
  };
}
