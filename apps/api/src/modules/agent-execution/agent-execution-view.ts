import type {
  AgentExecutionCompletionSummaryRecord,
  AgentExecutionLogRecord,
  AgentExecutionRecoverySummaryRecord,
} from "./agent-execution-record.ts";

export const DEFAULT_RUNNING_ATTEMPT_STALE_AFTER_MS = 5 * 60 * 1000;

export function deriveCompletionSummary(
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

export function deriveRecoverySummary(input: {
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
