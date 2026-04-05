import type {
  KnowledgeHitLogRecord,
  ModuleExecutionSnapshotRecord,
  ModuleExecutionSnapshotViewRecord,
  ExecutionTrackingRuntimeBindingReadinessObservationRecord,
} from "./execution-tracking-record.ts";
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
}

export function createExecutionTrackingApi(
  options: CreateExecutionTrackingApiOptions,
) {
  const { executionTrackingService } = options;

  return {
    async recordSnapshot({
      input,
    }: {
      input: RecordExecutionSnapshotInput;
    }): Promise<RouteResponse<ModuleExecutionSnapshotViewRecord>> {
      const snapshot = await executionTrackingService.recordSnapshot(input);
      return {
        status: 201,
        body: await enrichSnapshotView(snapshot, options),
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
        body: snapshot ? await enrichSnapshotView(snapshot, options) : undefined,
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

async function enrichSnapshotView(
  record: ModuleExecutionSnapshotRecord,
  options: Pick<
    CreateExecutionTrackingApiOptions,
    "executionGovernanceRepository" | "runtimeBindingReadinessService"
  >,
): Promise<ModuleExecutionSnapshotViewRecord> {
  return {
    ...record,
    skill_package_ids: [...record.skill_package_ids],
    skill_package_versions: [...record.skill_package_versions],
    knowledge_item_ids: [...record.knowledge_item_ids],
    created_asset_ids: [...record.created_asset_ids],
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
