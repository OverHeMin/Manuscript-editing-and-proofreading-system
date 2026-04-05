import type {
  AgentExecutionCompletionSummaryRecord,
  AgentExecutionLogRecord,
  AgentExecutionLogViewRecord,
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
}

export function createAgentExecutionApi(
  options: CreateAgentExecutionApiOptions,
) {
  const { agentExecutionService } = options;

  return {
    async createLog({
      input,
    }: {
      input: CreateAgentExecutionLogInput;
    }): Promise<RouteResponse<AgentExecutionLogViewRecord>> {
      const record = await agentExecutionService.createLog(input);
      return {
        status: 201,
        body: await enrichLogView(record, options.runtimeBindingReadinessService),
      };
    },

    async completeLog({
      logId,
      executionSnapshotId,
      verificationEvidenceIds,
    }: CompleteAgentExecutionLogInput): Promise<RouteResponse<AgentExecutionLogViewRecord>> {
      const record = await agentExecutionService.completeLog({
        logId,
        executionSnapshotId,
        verificationEvidenceIds,
      });
      return {
        status: 200,
        body: await enrichLogView(record, options.runtimeBindingReadinessService),
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
        body: await enrichLogView(record, options.runtimeBindingReadinessService),
      };
    },

    async listLogs(): Promise<RouteResponse<AgentExecutionLogViewRecord[]>> {
      const records = await agentExecutionService.listLogs();
      return {
        status: 200,
        body: await Promise.all(
          records.map((record) =>
            enrichLogView(record, options.runtimeBindingReadinessService),
          ),
        ),
      };
    },
  };
}

async function enrichLogView(
  record: AgentExecutionLogRecord,
  runtimeBindingReadinessService?: Pick<
    RuntimeBindingReadinessService,
    "getBindingReadiness"
  >,
): Promise<AgentExecutionLogViewRecord> {
  return {
    ...record,
    knowledge_item_ids: [...record.knowledge_item_ids],
    verification_check_profile_ids: [...record.verification_check_profile_ids],
    evaluation_suite_ids: [...record.evaluation_suite_ids],
    verification_evidence_ids: [...record.verification_evidence_ids],
    completion_summary: deriveCompletionSummary(record),
    runtime_binding_readiness: await observeRuntimeBindingReadiness({
      bindingId: record.runtime_binding_id,
      runtimeBindingReadinessService,
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
