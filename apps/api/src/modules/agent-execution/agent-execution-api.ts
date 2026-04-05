import type {
  AgentExecutionCompletionSummaryRecord,
  AgentExecutionLogRecord,
  AgentExecutionLogViewRecord,
  AgentExecutionRecoverySummaryRecord,
  AgentExecutionRuntimeBindingReadinessObservationRecord,
} from "./agent-execution-record.ts";
import type {
  AgentExecutionService,
  CompleteAgentExecutionLogInput,
  CreateAgentExecutionLogInput,
} from "./agent-execution-service.ts";
import type { RuntimeBindingReadinessService } from "../runtime-bindings/runtime-binding-readiness-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateAgentExecutionApiOptions {
  agentExecutionService: AgentExecutionService;
  runtimeBindingReadinessService?: Pick<
    RuntimeBindingReadinessService,
    "getBindingReadiness"
  >;
  now?: () => Date;
  runningAttemptStaleAfterMs?: number;
}

const DEFAULT_RUNNING_ATTEMPT_STALE_AFTER_MS = 5 * 60 * 1000;

export function createAgentExecutionApi(
  options: CreateAgentExecutionApiOptions,
) {
  const { agentExecutionService } = options;
  const observeNow = options.now ?? (() => new Date());
  const runningAttemptStaleAfterMs = Math.max(
    0,
    options.runningAttemptStaleAfterMs ?? DEFAULT_RUNNING_ATTEMPT_STALE_AFTER_MS,
  );

  return {
    async createLog({
      input,
    }: {
      input: CreateAgentExecutionLogInput;
    }): Promise<RouteResponse<AgentExecutionLogViewRecord>> {
      const record = await agentExecutionService.createLog(input);
      return {
        status: 201,
        body: await enrichLogView({
          record,
          observationTime: observeNow(),
          runtimeBindingReadinessService: options.runtimeBindingReadinessService,
          runningAttemptStaleAfterMs,
        }),
      };
    },

    async completeLog({
      logId,
      executionSnapshotId,
      verificationEvidenceIds,
    }: CompleteAgentExecutionLogInput): Promise<
      RouteResponse<AgentExecutionLogViewRecord>
    > {
      const record = await agentExecutionService.completeLog({
        logId,
        executionSnapshotId,
        verificationEvidenceIds,
      });
      return {
        status: 200,
        body: await enrichLogView({
          record,
          observationTime: observeNow(),
          runtimeBindingReadinessService: options.runtimeBindingReadinessService,
          runningAttemptStaleAfterMs,
        }),
      };
    },

    async getLog({
      logId,
    }: {
      logId: string;
    }): Promise<RouteResponse<AgentExecutionLogViewRecord>> {
      const record = await agentExecutionService.getLog(logId);
      return {
        status: 200,
        body: await enrichLogView({
          record,
          observationTime: observeNow(),
          runtimeBindingReadinessService: options.runtimeBindingReadinessService,
          runningAttemptStaleAfterMs,
        }),
      };
    },

    async listLogs(): Promise<RouteResponse<AgentExecutionLogViewRecord[]>> {
      const records = await agentExecutionService.listLogs();
      const observationTime = observeNow();
      return {
        status: 200,
        body: await Promise.all(
          records.map((record) =>
            enrichLogView({
              record,
              observationTime,
              runtimeBindingReadinessService:
                options.runtimeBindingReadinessService,
              runningAttemptStaleAfterMs,
            }),
          ),
        ),
      };
    },
  };
}

async function enrichLogView(input: {
  record: AgentExecutionLogRecord;
  observationTime: Date;
  runtimeBindingReadinessService?: Pick<
    RuntimeBindingReadinessService,
    "getBindingReadiness"
  >;
  runningAttemptStaleAfterMs: number;
}): Promise<AgentExecutionLogViewRecord> {
  return {
    ...input.record,
    knowledge_item_ids: [...input.record.knowledge_item_ids],
    verification_check_profile_ids: [
      ...input.record.verification_check_profile_ids,
    ],
    evaluation_suite_ids: [...input.record.evaluation_suite_ids],
    verification_evidence_ids: [...input.record.verification_evidence_ids],
    completion_summary: deriveCompletionSummary(input.record),
    recovery_summary: deriveRecoverySummary({
      record: input.record,
      now: input.observationTime,
      runningAttemptStaleAfterMs: input.runningAttemptStaleAfterMs,
    }),
    runtime_binding_readiness: await observeRuntimeBindingReadiness({
      bindingId: input.record.runtime_binding_id,
      runtimeBindingReadinessService: input.runtimeBindingReadinessService,
    }),
  };
}

function deriveCompletionSummary(
  record: AgentExecutionLogRecord,
): AgentExecutionCompletionSummaryRecord {
  if (record.status === "failed") {
    return {
      derived_status: "business_failed",
      business_completed: false,
      follow_up_required: false,
      fully_settled: false,
      attention_required: true,
    };
  }

  if (record.status !== "completed") {
    return {
      derived_status: "business_in_progress",
      business_completed: false,
      follow_up_required: record.orchestration_status !== "not_required",
      fully_settled: false,
      attention_required: false,
    };
  }

  if (record.orchestration_status === "not_required") {
    return {
      derived_status: "business_completed_settled",
      business_completed: true,
      follow_up_required: false,
      fully_settled: true,
      attention_required: false,
    };
  }

  if (record.orchestration_status === "completed") {
    return {
      derived_status: "business_completed_settled",
      business_completed: true,
      follow_up_required: true,
      fully_settled: true,
      attention_required: false,
    };
  }

  if (record.orchestration_status === "pending") {
    return {
      derived_status: "business_completed_follow_up_pending",
      business_completed: true,
      follow_up_required: true,
      fully_settled: false,
      attention_required: false,
    };
  }

  if (record.orchestration_status === "running") {
    return {
      derived_status: "business_completed_follow_up_running",
      business_completed: true,
      follow_up_required: true,
      fully_settled: false,
      attention_required: false,
    };
  }

  if (record.orchestration_status === "retryable") {
    return {
      derived_status: "business_completed_follow_up_retryable",
      business_completed: true,
      follow_up_required: true,
      fully_settled: false,
      attention_required: false,
    };
  }

  return {
    derived_status: "business_completed_follow_up_failed",
    business_completed: true,
    follow_up_required: true,
    fully_settled: false,
    attention_required: true,
  };
}

function deriveRecoverySummary(input: {
  record: AgentExecutionLogRecord;
  now: Date;
  runningAttemptStaleAfterMs: number;
}): AgentExecutionRecoverySummaryRecord {
  const { record, now, runningAttemptStaleAfterMs } = input;

  if (record.status !== "completed") {
    return {
      category: "not_recoverable",
      recovery_readiness: "not_recoverable",
      reason: `Business execution is ${record.status}, so governed follow-up is not recoverable yet.`,
    };
  }

  if (record.orchestration_status === "pending") {
    return {
      category: "recoverable_now",
      recovery_readiness: "ready_now",
      reason: "Pending orchestration is ready to replay now.",
    };
  }

  if (record.orchestration_status === "retryable") {
    if (isRetryEligible(record, now)) {
      return {
        category: "recoverable_now",
        recovery_readiness: "ready_now",
        reason: "Retryable orchestration is eligible to replay now.",
      };
    }

    return {
      category: "deferred_retry",
      recovery_readiness: "waiting_retry_eligibility",
      recovery_ready_at: record.orchestration_next_retry_at,
      reason:
        record.orchestration_next_retry_at != null
          ? `Retryable orchestration is deferred until ${record.orchestration_next_retry_at}.`
          : "Retryable orchestration is deferred until its next retry eligibility is reached.",
    };
  }

  if (record.orchestration_status === "running") {
    if (isStaleRunningAttempt(record, now, runningAttemptStaleAfterMs)) {
      return {
        category: "stale_running",
        recovery_readiness: "ready_now",
        reason: "Running orchestration attempt is stale and reclaimable.",
      };
    }

    return {
      category: "not_recoverable",
      recovery_readiness: "waiting_running_timeout",
      recovery_ready_at: computeRunningReclaimableAt(
        record,
        runningAttemptStaleAfterMs,
      ),
      reason:
        "Running orchestration attempt is still fresh and should not be reclaimed yet.",
    };
  }

  if (record.orchestration_status === "failed") {
    return {
      category: "attention_required",
      recovery_readiness: "not_recoverable",
      reason:
        record.orchestration_last_error != null
          ? `Orchestration failed terminally: ${record.orchestration_last_error}`
          : "Orchestration failed terminally and needs operator attention.",
    };
  }

  if (record.orchestration_status === "completed") {
    return {
      category: "not_recoverable",
      recovery_readiness: "not_recoverable",
      reason: "Orchestration is already completed.",
    };
  }

  return {
    category: "not_recoverable",
    recovery_readiness: "not_recoverable",
    reason: "No governed follow-up orchestration is required for this execution.",
  };
}

function isStaleRunningAttempt(
  record: AgentExecutionLogRecord,
  now: Date,
  staleAfterMs: number,
): boolean {
  const startedAt = record.orchestration_last_attempt_started_at;
  if (!startedAt) {
    return true;
  }

  const startedAtMs = Date.parse(startedAt);
  if (Number.isNaN(startedAtMs)) {
    return true;
  }

  return now.getTime() - startedAtMs >= staleAfterMs;
}

function isRetryEligible(record: AgentExecutionLogRecord, now: Date): boolean {
  const nextRetryAt = record.orchestration_next_retry_at;
  if (!nextRetryAt) {
    return true;
  }

  const nextRetryAtMs = Date.parse(nextRetryAt);
  if (Number.isNaN(nextRetryAtMs)) {
    return true;
  }

  return now.getTime() >= nextRetryAtMs;
}

function computeRunningReclaimableAt(
  record: AgentExecutionLogRecord,
  staleAfterMs: number,
): string | undefined {
  const startedAt = record.orchestration_last_attempt_started_at;
  if (!startedAt) {
    return undefined;
  }

  const startedAtMs = Date.parse(startedAt);
  if (Number.isNaN(startedAtMs)) {
    return undefined;
  }

  return new Date(startedAtMs + staleAfterMs).toISOString();
}

async function observeRuntimeBindingReadiness(input: {
  bindingId: string;
  runtimeBindingReadinessService?: Pick<
    RuntimeBindingReadinessService,
    "getBindingReadiness"
  >;
}): Promise<AgentExecutionRuntimeBindingReadinessObservationRecord> {
  if (!input.runtimeBindingReadinessService) {
    return {
      observation_status: "failed_open",
      error: "Runtime binding readiness service is unavailable.",
    };
  }

  try {
    const report = await input.runtimeBindingReadinessService.getBindingReadiness(
      input.bindingId,
    );
    return {
      observation_status: "reported",
      report,
    };
  } catch (error) {
    return {
      observation_status: "failed_open",
      error:
        error instanceof Error
          ? error.message
          : "Unknown runtime binding readiness observation error.",
    };
  }
}
