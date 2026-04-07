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
import type {
  ModuleExecutionSnapshotRecord,
  ModuleExecutionSnapshotViewRecord,
} from "../execution-tracking/execution-tracking-record.ts";
import {
  buildEmptyManuscriptModuleExecutionOverview,
  createNotStartedModuleOverview,
  createNotTrackedJobExecutionObservation,
  deriveManuscriptMainlineAttentionHandoffPack,
  deriveManuscriptMainlineReadinessSummary,
  deriveModuleMainlineSettlement,
  MAINLINE_SETTLEMENT_MODULES,
  type MainlineSettlementModule,
  type MainlineAttemptLedgerItemRecord,
  type ManuscriptMainlineAttemptLedgerRecord,
} from "./manuscript-mainline-settlement.ts";
import {
  enrichExecutionTrackingSnapshotView,
  type ExecutionTrackingSnapshotViewOptions,
} from "../execution-tracking/execution-tracking-api.ts";
import { DEFAULT_RUNNING_ATTEMPT_STALE_AFTER_MS } from "../agent-execution/agent-execution-view.ts";

const MAINLINE_ATTEMPT_LEDGER_VISIBLE_LIMIT = 9;

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

    async updateTemplateSelection({
      manuscriptId,
      journalTemplateId,
    }: {
      manuscriptId: string;
      journalTemplateId?: string | null;
    }): Promise<RouteResponse<ManuscriptViewRecord>> {
      const manuscript = await manuscriptService.updateTemplateSelection({
        manuscriptId,
        journalTemplateId,
      });

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
  let jobs: JobRecord[] = [];

  try {
    jobs = await input.manuscriptService.listJobsByManuscriptId(manuscript.id);
  } catch (error) {
    const message = normalizeObservationError(
      error,
      "Unknown manuscript settlement observation error.",
    );
    for (const module of MAINLINE_SETTLEMENT_MODULES) {
      overview[module] = {
        module,
        observation_status: "failed_open",
        error: message,
      };
    }

    const readinessSummary = deriveManuscriptMainlineReadinessSummary(overview);
    const attemptLedger = buildFailedOpenMainlineAttemptLedger(message);

    return {
      ...manuscript,
      module_execution_overview: overview,
      mainline_readiness_summary: readinessSummary,
      mainline_attention_handoff_pack:
        deriveManuscriptMainlineAttentionHandoffPack({
          overview,
          readiness: readinessSummary,
          attemptLedger,
        }),
      mainline_attempt_ledger: attemptLedger,
    };
  }

  let snapshotViews: ModuleExecutionSnapshotViewRecord[] = [];
  let snapshotViewsById = new Map<string, ModuleExecutionSnapshotViewRecord>();
  let snapshotObservationError: string | undefined;

  try {
    if (input.executionTrackingService) {
      const snapshots = await input.executionTrackingService.listSnapshotsByManuscriptId(
        manuscript.id,
      );
      snapshotViews = await buildSnapshotViewCollection(
        snapshots,
        input.executionTrackingViewOptions,
      );
      snapshotViewsById = new Map(
        snapshotViews.map((snapshot) => [snapshot.id, snapshot]),
      );
    }
  } catch (error) {
    snapshotObservationError = normalizeObservationError(
      error,
      "Unknown manuscript settlement observation error.",
    );
  }

  try {
    for (const module of MAINLINE_SETTLEMENT_MODULES) {
      const latestJob = selectLatestJobForModule(jobs, module);
      const latestSnapshot = selectLatestSnapshotViewForModule(snapshotViews, module);
      const latestJobSnapshotId = latestJob ? extractSnapshotId(latestJob) : undefined;

      if (!latestJob && !latestSnapshot) {
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

      if (latestJobSnapshotId && snapshotObservationError) {
        overview[module] = {
          module,
          observation_status: "failed_open",
          latest_job: latestJob,
          error: snapshotObservationError,
        };
        continue;
      }

      if (latestJobSnapshotId && !snapshotViewsById.has(latestJobSnapshotId)) {
        overview[module] = {
          module,
          observation_status: "failed_open",
          latest_job: latestJob,
          error: `Execution snapshot ${latestJobSnapshotId} was not found for manuscript settlement overview.`,
        };
        continue;
      }

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
    const message = normalizeObservationError(
      error,
      "Unknown manuscript settlement observation error.",
    );
    for (const module of MAINLINE_SETTLEMENT_MODULES) {
      overview[module] = {
        module,
        observation_status: "failed_open",
        error: message,
      };
    }
  }

  let attemptLedger: ManuscriptMainlineAttemptLedgerRecord;
  try {
    attemptLedger = deriveMainlineAttemptLedger({
      jobs,
      snapshotViewsById,
      visibleLimit: MAINLINE_ATTEMPT_LEDGER_VISIBLE_LIMIT,
    });
  } catch (error) {
    attemptLedger = buildFailedOpenMainlineAttemptLedger(
      normalizeObservationError(
        error,
        "Unknown manuscript attempt ledger observation error.",
      ),
      countMainlineJobs(jobs),
    );
  }

  const readinessSummary = deriveManuscriptMainlineReadinessSummary(overview);

  return {
    ...manuscript,
    module_execution_overview: overview,
    mainline_readiness_summary: readinessSummary,
    mainline_attention_handoff_pack: deriveManuscriptMainlineAttentionHandoffPack({
      overview,
      readiness: readinessSummary,
      attemptLedger,
    }),
    mainline_attempt_ledger: attemptLedger,
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

function selectLatestSnapshotViewForModule(
  snapshots: readonly ModuleExecutionSnapshotViewRecord[],
  module: MainlineSettlementModule,
): ModuleExecutionSnapshotViewRecord | undefined {
  return [...snapshots]
    .filter((snapshot) => snapshot.module === module)
    .sort((left, right) =>
      compareDescending(left.created_at, right.created_at, left.id, right.id),
    )[0];
}

async function buildSnapshotViewCollection(
  snapshots: readonly ModuleExecutionSnapshotRecord[],
  options: ExecutionTrackingSnapshotViewOptions,
): Promise<ModuleExecutionSnapshotViewRecord[]> {
  const views: ModuleExecutionSnapshotViewRecord[] = [];
  for (const snapshot of snapshots) {
    views.push(await enrichExecutionTrackingSnapshotView(snapshot, options));
  }

  return views;
}

function deriveMainlineAttemptLedger(input: {
  jobs: readonly JobRecord[];
  snapshotViewsById: ReadonlyMap<string, ModuleExecutionSnapshotViewRecord>;
  visibleLimit: number;
}): ManuscriptMainlineAttemptLedgerRecord {
  const visibleLimit = Math.max(0, input.visibleLimit);
  const mainlineJobs = [...input.jobs]
    .filter((job): job is JobRecord & { module: MainlineSettlementModule } =>
      isMainlineSettlementModule(job.module),
    )
    .sort((left, right) =>
      compareDescending(left.updated_at, right.updated_at, left.id, right.id),
    );
  const visibleJobs = mainlineJobs.slice(0, visibleLimit);
  const seenModules = new Set<MainlineSettlementModule>();
  const items: MainlineAttemptLedgerItemRecord[] = [];

  for (const job of visibleJobs) {
    const isLatestForModule = !seenModules.has(job.module);
    seenModules.add(job.module);

    try {
      items.push(
        buildMainlineAttemptLedgerItem({
          job,
          snapshot: resolveLedgerSnapshot(job, input.snapshotViewsById),
          isLatestForModule,
        }),
      );
    } catch (error) {
      items.push(
        buildFailedOpenMainlineAttemptLedgerItem({
          job,
          isLatestForModule,
          reason: normalizeObservationError(
            error,
            "Attempt ledger item observation failed open.",
          ),
        }),
      );
    }
  }

  return {
    observation_status: "reported",
    total_attempts: mainlineJobs.length,
    visible_attempts: visibleJobs.length,
    truncated: mainlineJobs.length > visibleJobs.length,
    ...(visibleJobs[0] ? { latest_event_at: visibleJobs[0].updated_at } : {}),
    items,
  };
}

function buildMainlineAttemptLedgerItem(input: {
  job: JobRecord & { module: MainlineSettlementModule };
  snapshot?: ModuleExecutionSnapshotViewRecord;
  isLatestForModule: boolean;
}): MainlineAttemptLedgerItemRecord {
  const { job, snapshot, isLatestForModule } = input;
  const snapshotId = extractSnapshotId(job);
  const base = {
    module: job.module,
    job_id: job.id,
    job_status: job.status,
    job_attempt_count: job.attempt_count,
    created_at: job.created_at,
    updated_at: job.updated_at,
    ...(job.started_at ? { started_at: job.started_at } : {}),
    ...(job.finished_at ? { finished_at: job.finished_at } : {}),
    ...(snapshotId ? { snapshot_id: snapshotId } : {}),
    is_latest_for_module: isLatestForModule,
  };

  if (!snapshot) {
    return {
      ...base,
      evidence_status: "job_only",
      reason: buildJobOnlyLedgerReason(job),
    };
  }

  const settlement = deriveModuleMainlineSettlement({
    latestJob: job,
    latestSnapshot: snapshot,
  });
  const agentLog =
    snapshot.agent_execution.observation_status === "reported"
      ? snapshot.agent_execution.log
      : undefined;
  const runtimeBindingReport =
    snapshot.runtime_binding_readiness.observation_status === "reported"
      ? snapshot.runtime_binding_readiness.report
      : undefined;

  return {
    ...base,
    snapshot_id: snapshot.id,
    evidence_status: "snapshot_linked",
    ...(settlement ? { settlement_status: settlement.derived_status } : {}),
    ...(agentLog
      ? {
          orchestration_status: agentLog.orchestration_status,
          orchestration_attempt_count: agentLog.orchestration_attempt_count,
          recovery_category: agentLog.recovery_summary.category,
          ...(agentLog.recovery_summary.recovery_ready_at
            ? { recovery_ready_at: agentLog.recovery_summary.recovery_ready_at }
            : {}),
        }
      : {}),
    ...(runtimeBindingReport
      ? {
          runtime_binding_status: runtimeBindingReport.status,
          runtime_binding_issue_count: runtimeBindingReport.issues.length,
        }
      : {}),
    reason:
      settlement?.reason ??
      "Execution snapshot is linked, but settlement details are unavailable.",
  };
}

function buildFailedOpenMainlineAttemptLedgerItem(input: {
  job: JobRecord & { module: MainlineSettlementModule };
  isLatestForModule: boolean;
  reason: string;
}): MainlineAttemptLedgerItemRecord {
  return {
    module: input.job.module,
    job_id: input.job.id,
    job_status: input.job.status,
    job_attempt_count: input.job.attempt_count,
    created_at: input.job.created_at,
    updated_at: input.job.updated_at,
    ...(input.job.started_at ? { started_at: input.job.started_at } : {}),
    ...(input.job.finished_at ? { finished_at: input.job.finished_at } : {}),
    ...(extractSnapshotId(input.job)
      ? { snapshot_id: extractSnapshotId(input.job) }
      : {}),
    evidence_status: "failed_open",
    is_latest_for_module: input.isLatestForModule,
    reason: input.reason,
  };
}

function resolveLedgerSnapshot(
  job: JobRecord,
  snapshotViewsById: ReadonlyMap<string, ModuleExecutionSnapshotViewRecord>,
): ModuleExecutionSnapshotViewRecord | undefined {
  const snapshotId = extractSnapshotId(job);
  return snapshotId ? snapshotViewsById.get(snapshotId) : undefined;
}

function buildFailedOpenMainlineAttemptLedger(
  error: string,
  totalAttempts = 0,
): ManuscriptMainlineAttemptLedgerRecord {
  return {
    observation_status: "failed_open",
    total_attempts: totalAttempts,
    visible_attempts: 0,
    truncated: false,
    items: [],
    error,
  };
}

function countMainlineJobs(jobs: readonly JobRecord[]): number {
  return jobs.filter((job) => isMainlineSettlementModule(job.module)).length;
}

function isMainlineSettlementModule(
  module: JobRecord["module"],
): module is MainlineSettlementModule {
  return MAINLINE_SETTLEMENT_MODULES.includes(module as MainlineSettlementModule);
}

function buildJobOnlyLedgerReason(
  job: JobRecord & { module: MainlineSettlementModule },
): string {
  const moduleLabel = formatMainlineModuleLabel(job.module);
  switch (job.status) {
    case "completed":
      return `${moduleLabel} completed without linked snapshot evidence.`;
    case "failed":
      return `${moduleLabel} failed before snapshot evidence was written.`;
    case "cancelled":
      return `${moduleLabel} was cancelled before snapshot evidence was written.`;
    case "running":
      return `${moduleLabel} is still running without linked snapshot evidence.`;
    case "queued":
      return `${moduleLabel} is queued without linked snapshot evidence yet.`;
  }
}

function normalizeObservationError(
  error: unknown,
  fallback: string,
): string {
  return error instanceof Error ? error.message : fallback;
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

function formatMainlineModuleLabel(module: MainlineSettlementModule): string {
  if (module === "screening") {
    return "Screening";
  }
  if (module === "editing") {
    return "Editing";
  }

  return "Proofreading";
}
