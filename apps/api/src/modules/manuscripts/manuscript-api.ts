import {
  DocumentAssetService,
  ManuscriptNotFoundError,
} from "../assets/document-asset-service.ts";
import { ManuscriptLifecycleService } from "./manuscript-lifecycle-service.ts";
import type { UploadManuscriptInput } from "./manuscript-lifecycle-service.ts";
import type { DocumentAssetRecord } from "../assets/document-asset-record.ts";
import type { JobRecord, JobViewRecord } from "../jobs/job-record.ts";
import type { ManuscriptRecord, ManuscriptViewRecord } from "./manuscript-record.ts";
import type { ExecutionTrackingService } from "../execution-tracking/execution-tracking-service.ts";
import type { ExecutionGovernanceRepository } from "../execution-governance/execution-governance-repository.ts";
import type { RuntimeBindingReadinessService } from "../runtime-bindings/runtime-binding-readiness-service.ts";
import type { AgentExecutionService } from "../agent-execution/agent-execution-service.ts";
import type { ModuleExecutionSnapshotRecord } from "../execution-tracking/execution-tracking-record.ts";
import {
  buildEmptyManuscriptModuleExecutionOverview,
  createNotStartedModuleOverview,
  createNotTrackedJobExecutionObservation,
  deriveManuscriptMainlineReadinessSummary,
  deriveModuleMainlineSettlement,
  MAINLINE_SETTLEMENT_MODULES,
  type MainlineSettlementModule,
} from "./manuscript-mainline-settlement.ts";
import {
  enrichExecutionTrackingSnapshotView,
  type ExecutionTrackingSnapshotViewOptions,
} from "../execution-tracking/execution-tracking-api.ts";
import { DEFAULT_RUNNING_ATTEMPT_STALE_AFTER_MS } from "../agent-execution/agent-execution-view.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export class JobNotFoundError extends Error {
  constructor(jobId: string) {
    super(`Job ${jobId} was not found.`);
    this.name = "JobNotFoundError";
  }
}

export interface CreateManuscriptApiOptions {
  manuscriptService: ManuscriptLifecycleService;
  assetService: DocumentAssetService;
  executionTrackingService?: Pick<
    ExecutionTrackingService,
    "getSnapshot" | "listSnapshotsByManuscriptId"
  >;
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

export function createManuscriptApi(options: CreateManuscriptApiOptions) {
  const { manuscriptService, assetService } = options;
  const observeNow = options.now ?? (() => new Date());
  const runningAttemptStaleAfterMs = Math.max(
    0,
    options.runningAttemptStaleAfterMs ?? DEFAULT_RUNNING_ATTEMPT_STALE_AFTER_MS,
  );

  return {
    async upload(
      input: UploadManuscriptInput,
    ): Promise<RouteResponse<Awaited<ReturnType<ManuscriptLifecycleService["upload"]>>>> {
      const result = await manuscriptService.upload(input);

      return {
        status: 201,
        body: result,
      };
    },

    async getManuscript({
      manuscriptId,
    }: {
      manuscriptId: string;
    }): Promise<RouteResponse<ManuscriptViewRecord>> {
      const manuscript = await manuscriptService.getManuscript(manuscriptId);

      if (!manuscript) {
        throw new ManuscriptNotFoundError(manuscriptId);
      }

      return {
        status: 200,
        body: await enrichManuscriptView(manuscript, {
          manuscriptService,
          executionTrackingService: options.executionTrackingService,
          executionTrackingViewOptions: {
            executionGovernanceRepository: options.executionGovernanceRepository,
            runtimeBindingReadinessService: options.runtimeBindingReadinessService,
            agentExecutionService: options.agentExecutionService,
            observationTime: observeNow(),
            runningAttemptStaleAfterMs,
          },
        }),
      };
    },

    async listAssets({
      manuscriptId,
    }: {
      manuscriptId: string;
    }): Promise<RouteResponse<DocumentAssetRecord[]>> {
      const manuscript = await manuscriptService.getManuscript(manuscriptId);

      if (!manuscript) {
        throw new ManuscriptNotFoundError(manuscriptId);
      }

      return {
        status: 200,
        body: await assetService.listAssets(manuscriptId),
      };
    },

    async getJob({
      jobId,
    }: {
      jobId: string;
    }): Promise<RouteResponse<JobViewRecord>> {
      const job = await manuscriptService.getJob(jobId);

      if (!job) {
        throw new JobNotFoundError(jobId);
      }

      return {
        status: 200,
        body: await enrichJobView(job, {
          executionTrackingService: options.executionTrackingService,
          executionTrackingViewOptions: {
            executionGovernanceRepository: options.executionGovernanceRepository,
            runtimeBindingReadinessService: options.runtimeBindingReadinessService,
            agentExecutionService: options.agentExecutionService,
            observationTime: observeNow(),
            runningAttemptStaleAfterMs,
          },
        }),
      };
    },
  };
}

export { ManuscriptNotFoundError };

async function enrichManuscriptView(
  manuscript: ManuscriptRecord,
  input: {
    manuscriptService: Pick<ManuscriptLifecycleService, "listJobsByManuscriptId">;
    executionTrackingService?: Pick<
      ExecutionTrackingService,
      "listSnapshotsByManuscriptId"
    >;
    executionTrackingViewOptions: ExecutionTrackingSnapshotViewOptions;
  },
): Promise<ManuscriptViewRecord> {
  const overview = buildEmptyManuscriptModuleExecutionOverview();

  try {
    const jobs = await input.manuscriptService.listJobsByManuscriptId(manuscript.id);
    const snapshots = input.executionTrackingService
      ? await input.executionTrackingService.listSnapshotsByManuscriptId(manuscript.id)
      : [];

    for (const module of MAINLINE_SETTLEMENT_MODULES) {
      const latestJob = selectLatestJobForModule(jobs, module);
      const latestSnapshotRecord = selectLatestSnapshotForModule(snapshots, module);
      const latestJobSnapshotId = latestJob ? extractSnapshotId(latestJob) : undefined;

      if (!latestJob && !latestSnapshotRecord) {
        overview[module] = createNotStartedModuleOverview(module);
        continue;
      }

      if (latestJobSnapshotId && !input.executionTrackingService) {
        overview[module] = {
          module,
          observation_status: "failed_open",
          latest_job: latestJob,
          error: "Execution tracking service is unavailable for manuscript settlement overview.",
        };
        continue;
      }

      if (latestJobSnapshotId && !latestSnapshotRecord) {
        overview[module] = {
          module,
          observation_status: "failed_open",
          latest_job: latestJob,
          error: `Execution snapshot ${latestJobSnapshotId} was not found for manuscript settlement overview.`,
        };
        continue;
      }

      const latestSnapshot = latestSnapshotRecord
        ? await enrichExecutionTrackingSnapshotView(
            latestSnapshotRecord,
            input.executionTrackingViewOptions,
          )
        : undefined;

      overview[module] = {
        module,
        observation_status: "reported",
        ...(latestJob ? { latest_job: latestJob } : {}),
        ...(latestSnapshot ? { latest_snapshot: latestSnapshot } : {}),
        settlement: deriveModuleMainlineSettlement({
          latestJob,
          latestSnapshot,
        }),
      };
    }
  } catch (error) {
    for (const module of MAINLINE_SETTLEMENT_MODULES) {
      overview[module] = {
        module,
        observation_status: "failed_open",
        error:
          error instanceof Error
            ? error.message
            : "Unknown manuscript settlement observation error.",
      };
    }
  }

  return {
    ...manuscript,
    module_execution_overview: overview,
    mainline_readiness_summary: deriveManuscriptMainlineReadinessSummary(overview),
  };
}

async function enrichJobView(
  job: JobRecord,
  input: {
    executionTrackingService?: Pick<ExecutionTrackingService, "getSnapshot">;
    executionTrackingViewOptions: ExecutionTrackingSnapshotViewOptions;
  },
): Promise<JobViewRecord> {
  const snapshotId = extractSnapshotId(job);
  if (!snapshotId) {
    return {
      ...job,
      execution_tracking: createNotTrackedJobExecutionObservation(),
    };
  }

  if (!input.executionTrackingService) {
    return {
      ...job,
      execution_tracking: {
        observation_status: "failed_open",
        error: "Execution tracking service is unavailable.",
      },
    };
  }

  try {
    const snapshot = await input.executionTrackingService.getSnapshot(snapshotId);
    if (!snapshot) {
      return {
        ...job,
        execution_tracking: {
          observation_status: "failed_open",
          error: `Execution snapshot ${snapshotId} was not found.`,
        },
      };
    }

    const snapshotView = await enrichExecutionTrackingSnapshotView(
      snapshot,
      input.executionTrackingViewOptions,
    );

    return {
      ...job,
      execution_tracking: {
        observation_status: "reported",
        snapshot: snapshotView,
        settlement: deriveModuleMainlineSettlement({
          latestJob: job,
          latestSnapshot: snapshotView,
        }),
      },
    };
  } catch (error) {
    return {
      ...job,
      execution_tracking: {
        observation_status: "failed_open",
        error:
          error instanceof Error
            ? error.message
            : "Unknown job execution tracking observation error.",
      },
    };
  }
}

function selectLatestJobForModule(
  jobs: readonly JobRecord[],
  module: MainlineSettlementModule,
): JobRecord | undefined {
  return [...jobs]
    .filter((job) => job.module === module)
    .sort((left, right) =>
      compareDescending(left.updated_at, right.updated_at, left.id, right.id),
    )[0];
}

function selectLatestSnapshotForModule(
  snapshots: readonly ModuleExecutionSnapshotRecord[],
  module: MainlineSettlementModule,
): ModuleExecutionSnapshotRecord | undefined {
  return [...snapshots]
    .filter((snapshot) => snapshot.module === module)
    .sort((left, right) =>
      compareDescending(left.created_at, right.created_at, left.id, right.id),
    )[0];
}

function compareDescending(
  leftTime: string,
  rightTime: string,
  leftId: string,
  rightId: string,
): number {
  if (leftTime !== rightTime) {
    return rightTime.localeCompare(leftTime);
  }

  return rightId.localeCompare(leftId);
}

function extractSnapshotId(job: JobRecord | JobViewRecord): string | undefined {
  if (!job.payload || typeof job.payload !== "object") {
    return undefined;
  }

  const snapshotId = job.payload["snapshotId"];
  return typeof snapshotId === "string" && snapshotId.length > 0
    ? snapshotId
    : undefined;
}
