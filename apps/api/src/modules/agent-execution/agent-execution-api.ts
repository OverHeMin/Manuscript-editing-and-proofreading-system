import type {
  AgentExecutionLogRecord,
  AgentExecutionLogViewRecord,
  AgentExecutionRuntimeBindingReadinessObservationRecord,
} from "./agent-execution-record.ts";
import {
  DEFAULT_RUNNING_ATTEMPT_STALE_AFTER_MS,
  deriveCompletionSummary,
  deriveRecoverySummary,
} from "./agent-execution-view.ts";
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
