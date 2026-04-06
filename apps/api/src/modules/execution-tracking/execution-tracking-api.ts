import type {
  ExecutionTrackingAgentExecutionObservationRecord,
  KnowledgeHitLogRecord,
  ModuleExecutionSnapshotRecord,
  ModuleExecutionSnapshotViewRecord,
  ExecutionTrackingRuntimeBindingReadinessObservationRecord,
} from "./execution-tracking-record.ts";
import type { AgentExecutionService } from "../agent-execution/agent-execution-service.ts";
import {
  DEFAULT_RUNNING_ATTEMPT_STALE_AFTER_MS,
  deriveCompletionSummary,
  deriveRecoverySummary,
} from "../agent-execution/agent-execution-view.ts";
import type {
  ExecutionTrackingService,
  RecordExecutionSnapshotInput,
} from "./execution-tracking-service.ts";
import type { ExecutionGovernanceRepository } from "../execution-governance/execution-governance-repository.ts";
import type { RuntimeBindingReadinessService } from "../runtime-bindings/runtime-binding-readiness-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateExecutionTrackingApiOptions {
  executionTrackingService: ExecutionTrackingService;
  executionGovernanceRepository?: Pick<
    ExecutionGovernanceRepository,
    "findProfileById"
  >;
  runtimeBindingReadinessService?: Pick<
    RuntimeBindingReadinessService,
    "getActiveBindingReadinessForScope"
  >;
  agentExecutionService?: Pick<AgentExecutionService, "getLog">;
  now?: () => Date;
  runningAttemptStaleAfterMs?: number;
}

export interface ExecutionTrackingSnapshotViewOptions
  extends Pick<
    CreateExecutionTrackingApiOptions,
    | "executionGovernanceRepository"
    | "runtimeBindingReadinessService"
    | "agentExecutionService"
  > {
  observationTime: Date;
  runningAttemptStaleAfterMs: number;
}

export function createExecutionTrackingApi(
  options: CreateExecutionTrackingApiOptions,
) {
  const { executionTrackingService } = options;
  const observeNow = options.now ?? (() => new Date());
  const runningAttemptStaleAfterMs = Math.max(
    0,
    options.runningAttemptStaleAfterMs ?? DEFAULT_RUNNING_ATTEMPT_STALE_AFTER_MS,
  );

  return {
    async recordSnapshot({
      input,
    }: {
      input: RecordExecutionSnapshotInput;
    }): Promise<RouteResponse<ModuleExecutionSnapshotViewRecord>> {
      const snapshot = await executionTrackingService.recordSnapshot(input);
      return {
        status: 201,
        body: await enrichExecutionTrackingSnapshotView(snapshot, {
          ...options,
          observationTime: observeNow(),
          runningAttemptStaleAfterMs,
        }),
      };
    },

    async getSnapshot({
      snapshotId,
    }: {
      snapshotId: string;
    }): Promise<RouteResponse<ModuleExecutionSnapshotViewRecord | undefined>> {
      const snapshot = await executionTrackingService.getSnapshot(snapshotId);
      return {
        status: 200,
        body: snapshot
          ? await enrichExecutionTrackingSnapshotView(snapshot, {
              ...options,
              observationTime: observeNow(),
              runningAttemptStaleAfterMs,
            })
          : undefined,
      };
    },

    async listKnowledgeHitLogsBySnapshotId({
      snapshotId,
    }: {
      snapshotId: string;
    }): Promise<RouteResponse<KnowledgeHitLogRecord[]>> {
      return {
        status: 200,
        body: await executionTrackingService.listKnowledgeHitLogsBySnapshotId(
          snapshotId,
        ),
      };
    },
  };
}

export async function enrichExecutionTrackingSnapshotView(
  record: ModuleExecutionSnapshotRecord,
  options: ExecutionTrackingSnapshotViewOptions,
): Promise<ModuleExecutionSnapshotViewRecord> {
  return {
    ...record,
    skill_package_ids: [...record.skill_package_ids],
    skill_package_versions: [...record.skill_package_versions],
    knowledge_item_ids: [...record.knowledge_item_ids],
    created_asset_ids: [...record.created_asset_ids],
    agent_execution: await observeLinkedAgentExecution({
      logId: record.agent_execution_log_id,
      agentExecutionService: options.agentExecutionService,
      observationTime: options.observationTime,
      runningAttemptStaleAfterMs: options.runningAttemptStaleAfterMs,
    }),
    runtime_binding_readiness: await observeRuntimeBindingReadiness({
      executionProfileId: record.execution_profile_id,
      executionGovernanceRepository: options.executionGovernanceRepository,
      runtimeBindingReadinessService: options.runtimeBindingReadinessService,
    }),
  };
}

async function observeRuntimeBindingReadiness(input: {
  executionProfileId: string;
  executionGovernanceRepository?: Pick<
    ExecutionGovernanceRepository,
    "findProfileById"
  >;
  runtimeBindingReadinessService?: Pick<
    RuntimeBindingReadinessService,
    "getActiveBindingReadinessForScope"
  >;
}): Promise<ExecutionTrackingRuntimeBindingReadinessObservationRecord> {
  if (!input.executionGovernanceRepository) {
    return {
      observation_status: "failed_open",
      error: "Execution governance repository is unavailable.",
    };
  }

  if (!input.runtimeBindingReadinessService) {
    return {
      observation_status: "failed_open",
      error: "Runtime binding readiness service is unavailable.",
    };
  }

  try {
    const profile = await input.executionGovernanceRepository.findProfileById(
      input.executionProfileId,
    );
    if (!profile) {
      return {
        observation_status: "failed_open",
        error: `Execution profile ${input.executionProfileId} is unavailable for runtime binding readiness observation.`,
      };
    }

    return {
      observation_status: "reported",
      report:
        await input.runtimeBindingReadinessService.getActiveBindingReadinessForScope(
          {
            module: profile.module,
            manuscriptType: profile.manuscript_type,
            templateFamilyId: profile.template_family_id,
          },
        ),
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

async function observeLinkedAgentExecution(input: {
  logId?: string;
  agentExecutionService?: Pick<AgentExecutionService, "getLog">;
  observationTime: Date;
  runningAttemptStaleAfterMs: number;
}): Promise<ExecutionTrackingAgentExecutionObservationRecord> {
  if (!input.logId) {
    return {
      observation_status: "not_linked",
    };
  }

  if (!input.agentExecutionService) {
    return {
      observation_status: "failed_open",
      log_id: input.logId,
      error: "Agent execution service is unavailable.",
    };
  }

  try {
    const log = await input.agentExecutionService.getLog(input.logId);
    return {
      observation_status: "reported",
      log_id: log.id,
      log: {
        id: log.id,
        status: log.status,
        orchestration_status: log.orchestration_status,
        completion_summary: deriveCompletionSummary(log),
        recovery_summary: deriveRecoverySummary({
          record: log,
          now: input.observationTime,
          runningAttemptStaleAfterMs: input.runningAttemptStaleAfterMs,
        }),
      },
    };
  } catch (error) {
    return {
      observation_status: "failed_open",
      log_id: input.logId,
      error:
        error instanceof Error
          ? error.message
          : "Unknown linked agent execution observation error.",
    };
  }
}
