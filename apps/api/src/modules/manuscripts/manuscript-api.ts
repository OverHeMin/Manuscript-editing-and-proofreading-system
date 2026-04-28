import type {
  EditingCompletionGatePendingItem,
  EditingCompletionGateSummary,
  GovernedExecutionContextSummary,
} from "@medical/contracts";
import {
  DocumentAssetService,
  ManuscriptNotFoundError,
} from "../assets/document-asset-service.ts";
import { ManuscriptLifecycleService } from "./manuscript-lifecycle-service.ts";
import {
  deriveBatchSettlementStatus,
  type UploadManuscriptBatchInput,
  type UploadManuscriptInput,
} from "./manuscript-lifecycle-service.ts";
import type { DocumentAssetRecord } from "../assets/document-asset-record.ts";
import {
  resolveCurrentExportSelection,
  resolveResultAssetMatrix,
} from "../assets/document-asset-record.ts";
import type {
  JobBatchItemRecord,
  JobBatchLifecycleStatus,
  JobBatchProgressRecord,
  JobBatchStateRecord,
  JobRecord,
  JobViewRecord,
} from "../jobs/job-record.ts";
import type { ManuscriptRecord, ManuscriptViewRecord } from "./manuscript-record.ts";
import type { ExecutionTrackingService } from "../execution-tracking/execution-tracking-service.ts";
import type { ExecutionGovernanceRepository } from "../execution-governance/execution-governance-repository.ts";
import type { ExecutionResolutionService } from "../execution-resolution/execution-resolution-service.ts";
import type { RuntimeBindingReadinessService } from "../runtime-bindings/runtime-binding-readiness-service.ts";
import type { AgentExecutionService } from "../agent-execution/agent-execution-service.ts";
import type {
  ModuleExecutionSnapshotRecord,
  ModuleExecutionSnapshotViewRecord,
  KnowledgeHitLogRecord,
} from "../execution-tracking/execution-tracking-record.ts";
import type { ReviewItemsService } from "../review-items/review-items-service.ts";
import type { ReviewItemRecord } from "../review-items/review-item-record.ts";
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
import { GOVERNED_MANUSCRIPT_MAINLINE_MODULES } from "../shared/module-run-support.ts";
import type {
  ModuleExecutionConcurrencyController,
  ModuleExecutionConcurrencySnapshot,
} from "../shared/module-execution-concurrency-controller.ts";
import type { ProofreadingPassRunRecord } from "../proofreading/proofreading-pass-run-record.ts";
import type { ProofreadingPassRunRepository } from "../proofreading/proofreading-pass-run-repository.ts";

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
    | "getSnapshot"
    | "listSnapshotsByManuscriptId"
    | "listKnowledgeHitLogsBySnapshotId"
  >;
  reviewItemsService?: Pick<ReviewItemsService, "listReviewItems">;
  proofreadingPassRunRepository?: Pick<
    ProofreadingPassRunRepository,
    "listByManuscriptId"
  >;
  executionGovernanceRepository?: Pick<
    ExecutionGovernanceRepository,
    "findProfileById"
  >;
  executionResolutionService?: Pick<
    ExecutionResolutionService,
    "resolveOperatorSummary"
  >;
  runtimeBindingReadinessService?: Pick<
    RuntimeBindingReadinessService,
    "getActiveBindingReadinessForScope"
  >;
  agentExecutionService?: Pick<AgentExecutionService, "getLog">;
  moduleExecutionConcurrencyController?: Pick<
    ModuleExecutionConcurrencyController,
    "getSnapshot"
  >;
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
        body: {
          ...result,
          manuscript: await withGovernedExecutionContextSummary(
            result.manuscript,
            options.executionResolutionService,
          ),
        },
      };
    },

    async uploadBatch(
      input: UploadManuscriptBatchInput,
    ): Promise<
      RouteResponse<Awaited<ReturnType<ManuscriptLifecycleService["uploadBatch"]>>>
    > {
      const result = await manuscriptService.uploadBatch(input);

      return {
        status: 201,
        body: {
          ...result,
          items: await Promise.all(
            result.items.map(async (item) => ({
              ...item,
              manuscript: await withGovernedExecutionContextSummary(
                item.manuscript,
                options.executionResolutionService,
              ),
            })),
          ),
        },
      };
    },

    async listRecent({
      limit,
    }: {
      limit?: number;
    } = {}): Promise<RouteResponse<ManuscriptViewRecord[]>> {
      const manuscripts = await manuscriptService.listRecentManuscripts(limit);

      return {
        status: 200,
        body: await Promise.all(
          manuscripts.map((manuscript) =>
            enrichManuscriptView(manuscript, {
              manuscriptService,
              assetService,
              executionResolutionService: options.executionResolutionService,
              executionTrackingService: options.executionTrackingService,
              executionTrackingViewOptions: {
                executionGovernanceRepository: options.executionGovernanceRepository,
                runtimeBindingReadinessService: options.runtimeBindingReadinessService,
                agentExecutionService: options.agentExecutionService,
                observationTime: observeNow(),
                runningAttemptStaleAfterMs,
              },
            }),
          ),
        ),
      };
    },

    async archiveManuscript({
      manuscriptId,
    }: {
      manuscriptId: string;
    }): Promise<RouteResponse<ManuscriptViewRecord>> {
      const manuscript = await manuscriptService.archiveManuscript(manuscriptId);

      return {
        status: 200,
        body: await enrichManuscriptView(manuscript, {
          manuscriptService,
          assetService,
          executionResolutionService: options.executionResolutionService,
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
          assetService,
          executionResolutionService: options.executionResolutionService,
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

    async getHarnessMatrix({
      manuscriptId,
    }: {
      manuscriptId: string;
    }): Promise<RouteResponse<ManuscriptHarnessMatrixRecord>> {
      const manuscript = await manuscriptService.getManuscript(manuscriptId);

      if (!manuscript) {
        throw new ManuscriptNotFoundError(manuscriptId);
      }

      return {
        status: 200,
        body: await buildManuscriptHarnessMatrix({
          manuscript,
          manuscriptService,
          executionTrackingService: options.executionTrackingService,
          reviewItemsService: options.reviewItemsService,
          proofreadingPassRunRepository: options.proofreadingPassRunRepository,
        }),
      };
    },

    async updateTemplateSelection({
      manuscriptId,
      templateFamilyId,
      journalTemplateId,
    }: {
      manuscriptId: string;
      templateFamilyId?: string | null;
      journalTemplateId?: string | null;
    }): Promise<RouteResponse<ManuscriptViewRecord>> {
      const manuscript = await manuscriptService.updateTemplateSelection({
        manuscriptId,
        templateFamilyId,
        journalTemplateId,
      });

      return {
        status: 200,
        body: await enrichManuscriptView(manuscript, {
          manuscriptService,
          assetService,
          executionResolutionService: options.executionResolutionService,
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

    async getModuleExecutionConcurrency(): Promise<
      RouteResponse<ModuleExecutionConcurrencySnapshot>
    > {
      return {
        status: 200,
        body:
          options.moduleExecutionConcurrencyController?.getSnapshot() ?? {
            active: {
              global: 0,
              screening: 0,
              editing: 0,
              proofreading: 0,
            },
            queued: {
              global: 0,
              screening: 0,
              editing: 0,
              proofreading: 0,
            },
            limits: {
              global: 0,
              screening: 0,
              editing: 0,
              proofreading: 0,
            },
          },
      };
    },
  };
}

export { ManuscriptNotFoundError };

export type ManuscriptHarnessMatrixState =
  | "hit"
  | "missed"
  | "skipped"
  | "false_positive"
  | "manual_added"
  | "observed"
  | "expected_not_run"
  | "unavailable"
  | "failed";

export interface ManuscriptHarnessMatrixItemRecord {
  key: string;
  label: string;
  state: ManuscriptHarnessMatrixState;
  source_kind:
    | "module_execution"
    | "runtime_binding"
    | "model"
    | "prompt_template"
    | "skill_package"
    | "quality_package"
    | "knowledge_hit"
    | "review_item"
    | "governed_hit"
    | "residual_issue"
    | "learning_candidate"
    | "proofreading_deep_pass"
    | "editing_completion_gate"
    | "observation";
  source_id?: string;
  title?: string;
  summary?: string;
  related_rule_ids?: string[];
  related_knowledge_item_ids?: string[];
  evidence?: Record<string, unknown>;
}

export interface ManuscriptHarnessMatrixModuleRecord {
  module: MainlineSettlementModule;
  status: "not_run" | "tracked" | "failed_open";
  latest_snapshot?: Pick<
    ModuleExecutionSnapshotRecord,
    | "id"
    | "job_id"
    | "execution_profile_id"
    | "module_template_id"
    | "module_template_version_no"
    | "prompt_template_id"
    | "prompt_template_version"
    | "skill_package_ids"
    | "skill_package_versions"
    | "model_id"
    | "model_version"
    | "quality_packages"
    | "knowledge_item_ids"
    | "created_asset_ids"
    | "agent_execution_log_id"
    | "created_at"
  >;
  knowledge_hit_logs: KnowledgeHitLogRecord[];
  review_items: ReviewItemRecord[];
  matrix_items: ManuscriptHarnessMatrixItemRecord[];
}

export interface ManuscriptHarnessMatrixRecord {
  manuscript_id: string;
  title: string;
  manuscript_type: ManuscriptRecord["manuscript_type"];
  generated_at: string;
  modules: ManuscriptHarnessMatrixModuleRecord[];
}

async function buildManuscriptHarnessMatrix(input: {
  manuscript: ManuscriptRecord;
  manuscriptService: Pick<ManuscriptLifecycleService, "listJobsByManuscriptId">;
  executionTrackingService?: Pick<
    ExecutionTrackingService,
    "listSnapshotsByManuscriptId" | "listKnowledgeHitLogsBySnapshotId"
  >;
  reviewItemsService?: Pick<ReviewItemsService, "listReviewItems">;
  proofreadingPassRunRepository?: Pick<
    ProofreadingPassRunRepository,
    "listByManuscriptId"
  >;
}): Promise<ManuscriptHarnessMatrixRecord> {
  const snapshots = input.executionTrackingService
    ? await input.executionTrackingService.listSnapshotsByManuscriptId(
        input.manuscript.id,
      )
    : [];
  const jobs = await input.manuscriptService.listJobsByManuscriptId(
    input.manuscript.id,
  );
  const reviewItems = input.reviewItemsService
    ? await input.reviewItemsService.listReviewItems({
        manuscriptId: input.manuscript.id,
        includeDecided: true,
      })
    : [];
  const proofreadingPassRuns = input.proofreadingPassRunRepository
    ? await input.proofreadingPassRunRepository.listByManuscriptId(
        input.manuscript.id,
      )
    : [];
  const modules = await Promise.all(
    MAINLINE_SETTLEMENT_MODULES.map(async (module) =>
      buildManuscriptHarnessMatrixModule({
        module,
        manuscript: input.manuscript,
        snapshots,
        jobs,
        reviewItems: reviewItems.filter((item) => item.module === module),
        proofreadingPassRuns,
        executionTrackingService: input.executionTrackingService,
      }),
    ),
  );

  return {
    manuscript_id: input.manuscript.id,
    title: input.manuscript.title,
    manuscript_type: input.manuscript.manuscript_type,
    generated_at: new Date().toISOString(),
    modules,
  };
}

async function buildManuscriptHarnessMatrixModule(input: {
  module: MainlineSettlementModule;
  manuscript: ManuscriptRecord;
  snapshots: ModuleExecutionSnapshotRecord[];
  jobs: JobRecord[];
  reviewItems: ReviewItemRecord[];
  proofreadingPassRuns: ProofreadingPassRunRecord[];
  executionTrackingService?: Pick<
    ExecutionTrackingService,
    "listKnowledgeHitLogsBySnapshotId"
  >;
}): Promise<ManuscriptHarnessMatrixModuleRecord> {
  const latestSnapshot = selectLatestSnapshotForModule(
    input.snapshots,
    input.module,
  );
  if (!latestSnapshot) {
    return {
      module: input.module,
      status: "not_run",
      knowledge_hit_logs: [],
      review_items: input.reviewItems,
      matrix_items: [
        {
          key: "module.execution",
          label: "Module execution",
          state: "expected_not_run",
          source_kind: "module_execution",
          summary: "This manuscript has not run this module yet.",
        },
        ...input.reviewItems.map(mapReviewItemToHarnessMatrixItem),
      ],
    };
  }

  const knowledgeHitLogs = input.executionTrackingService
    ? await input.executionTrackingService.listKnowledgeHitLogsBySnapshotId(
        latestSnapshot.id,
      )
    : [];
  const latestJob = input.jobs.find((job) => job.id === latestSnapshot.job_id);
  const proofreadingPassItems =
    input.module === "proofreading"
      ? extractProofreadingDeepPassMatrixItems(
          latestJob,
          input.proofreadingPassRuns.filter(
            (passRun) => passRun.job_id === latestJob?.id,
          ),
        )
      : [];
  const editingCompletionGateItems =
    input.module === "editing"
      ? extractEditingCompletionGateMatrixItems(
          input.manuscript.editing_completion_gate_summary,
        )
      : [];

  return {
    module: input.module,
    status: "tracked",
    latest_snapshot: summarizeHarnessSnapshot(latestSnapshot),
    knowledge_hit_logs: knowledgeHitLogs,
    review_items: input.reviewItems,
    matrix_items: [
      {
        key: "module.execution",
        label: "Module execution",
        state: "observed",
        source_kind: "module_execution",
        source_id: latestSnapshot.id,
        summary: `Latest ${input.module} snapshot is tracked.`,
      },
      {
        key: `model.${latestSnapshot.model_id}`,
        label: "Model route",
        state: "observed",
        source_kind: "model",
        source_id: latestSnapshot.model_id,
        summary: latestSnapshot.model_version,
      },
      {
        key: `prompt.${latestSnapshot.prompt_template_id}`,
        label: "Prompt template",
        state: "observed",
        source_kind: "prompt_template",
        source_id: latestSnapshot.prompt_template_id,
        summary: latestSnapshot.prompt_template_version,
      },
      ...latestSnapshot.skill_package_ids.map((skillPackageId, index) => ({
        key: `skill.${skillPackageId}`,
        label: "Skill package",
        state: "observed" as const,
        source_kind: "skill_package" as const,
        source_id: skillPackageId,
        summary: latestSnapshot.skill_package_versions[index],
      })),
      ...(latestSnapshot.quality_packages ?? []).map((qualityPackage) => ({
        key: `quality_package.${qualityPackage.package_id}`,
        label: qualityPackage.package_name,
        state: "observed" as const,
        source_kind: "quality_package" as const,
        source_id: qualityPackage.package_id,
        summary: `${qualityPackage.package_kind} ${qualityPackage.version}`,
      })),
      ...knowledgeHitLogs.map(mapKnowledgeHitLogToHarnessMatrixItem),
      ...editingCompletionGateItems,
      ...proofreadingPassItems,
      ...input.reviewItems.map(mapReviewItemToHarnessMatrixItem),
    ],
  };
}

function summarizeHarnessSnapshot(
  snapshot: ModuleExecutionSnapshotRecord,
): ManuscriptHarnessMatrixModuleRecord["latest_snapshot"] {
  return {
    id: snapshot.id,
    job_id: snapshot.job_id,
    execution_profile_id: snapshot.execution_profile_id,
    module_template_id: snapshot.module_template_id,
    module_template_version_no: snapshot.module_template_version_no,
    prompt_template_id: snapshot.prompt_template_id,
    prompt_template_version: snapshot.prompt_template_version,
    skill_package_ids: [...snapshot.skill_package_ids],
    skill_package_versions: [...snapshot.skill_package_versions],
    model_id: snapshot.model_id,
    model_version: snapshot.model_version,
    ...(snapshot.quality_packages
      ? {
          quality_packages: snapshot.quality_packages.map((entry) => ({
            package_id: entry.package_id,
            package_name: entry.package_name,
            package_kind: entry.package_kind,
            target_scopes: [...entry.target_scopes],
            version: entry.version,
          })),
        }
      : {}),
    knowledge_item_ids: [...snapshot.knowledge_item_ids],
    created_asset_ids: [...snapshot.created_asset_ids],
    agent_execution_log_id: snapshot.agent_execution_log_id,
    created_at: snapshot.created_at,
  };
}

function mapKnowledgeHitLogToHarnessMatrixItem(
  record: KnowledgeHitLogRecord,
): ManuscriptHarnessMatrixItemRecord {
  return {
    key: `knowledge.${record.knowledge_item_id}`,
    label: "Knowledge hit",
    state: "hit",
    source_kind: "knowledge_hit",
    source_id: record.knowledge_item_id,
    summary: record.match_reasons.join("; "),
    evidence: {
      hit_log_id: record.id,
      match_source: record.match_source,
      match_source_id: record.match_source_id,
      binding_rule_id: record.binding_rule_id,
      score: record.score,
      section: record.section,
    },
  };
}

function mapReviewItemToHarnessMatrixItem(
  item: ReviewItemRecord,
): ManuscriptHarnessMatrixItemRecord {
  return {
    key: `review_item.${item.id}`,
    label: "Manual review item",
    state: deriveReviewItemMatrixState(item),
    source_kind: item.source_kind,
    source_id: item.id,
    title: item.title,
    summary: item.summary,
    related_rule_ids: item.related_rule_ids ? [...item.related_rule_ids] : undefined,
    related_knowledge_item_ids: item.related_knowledge_item_ids
      ? [...item.related_knowledge_item_ids]
      : undefined,
    evidence: {
      source_kind: item.source_kind,
      source_status: item.source_status,
      review_status: item.review_status,
      snapshot_id: item.snapshot_id,
    },
  };
}

function extractEditingCompletionGateMatrixItems(
  summary: EditingCompletionGateSummary | undefined,
): ManuscriptHarnessMatrixItemRecord[] {
  if (!summary) {
    return [
      {
        key: "editing_completion_gate.unavailable",
        label: "Editing completion gate",
        state: "unavailable",
        source_kind: "editing_completion_gate",
        summary: "Editing completion gate has not been recorded.",
      },
    ];
  }

  const items: ManuscriptHarnessMatrixItemRecord[] = [
    {
      key: "editing_completion_gate.summary",
      label: "Editing completion gate",
      state:
        summary.observation_status === "failed_open"
          ? "failed"
          : summary.passed
            ? "hit"
            : "missed",
      source_kind: "editing_completion_gate",
      source_id: summary.source_job_id,
      title: summary.passed ? "Editing gate passed" : "Editing gate needs review",
      summary: summary.error ?? `${summary.blocker_count} blocker(s) remain.`,
      evidence: {
        observation_status: summary.observation_status,
        verdict: summary.verdict,
        passed: summary.passed,
        blocker_count: summary.blocker_count,
        generated_at: summary.generated_at,
        current_asset_id: summary.current_asset_id,
      },
    },
  ];

  const pendingGroups: Array<[
    string,
    string,
    EditingCompletionGatePendingItem[],
  ]> = [
    ["unresolved_required_slots", "Unresolved required slot", summary.unresolved_required_slots],
    [
      "pending_manual_resolution_items",
      "Pending manual resolution",
      summary.pending_manual_resolution_items,
    ],
    ["high_risk_object_items", "High-risk object", summary.high_risk_object_items],
    ["table_high_risk_items", "Table high-risk item", summary.table_high_risk_items],
    [
      "blocking_format_failures",
      "Blocking format failure",
      summary.blocking_format_failures,
    ],
  ];

  for (const [groupKey, label, groupItems] of pendingGroups) {
    for (const item of groupItems) {
      items.push(mapEditingCompletionGatePendingItem(groupKey, label, item));
    }
  }

  return items;
}

function mapEditingCompletionGatePendingItem(
  groupKey: string,
  label: string,
  item: EditingCompletionGatePendingItem,
): ManuscriptHarnessMatrixItemRecord {
  return {
    key: `editing_completion_gate.${groupKey}.${item.item_key}`,
    label,
    state: item.status === "resolved" ? "hit" : "missed",
    source_kind: "editing_completion_gate",
    source_id: item.item_key,
    title: item.summary,
    summary: item.detail ?? item.location_text,
    related_rule_ids: item.related_rule_id ? [item.related_rule_id] : undefined,
    evidence: {
      category: item.category,
      source: item.source,
      status: item.status,
      location_text: item.location_text,
      related_slot_key: item.related_slot_key,
      related_rule_id: item.related_rule_id,
      review_item_id: item.review_item_id,
      gate_group: groupKey,
    },
  };
}

function extractProofreadingDeepPassMatrixItems(
  job: JobRecord | undefined,
  persistedPassRuns: ProofreadingPassRunRecord[] = [],
): ManuscriptHarnessMatrixItemRecord[] {
  if (persistedPassRuns.length > 0) {
    return persistedPassRuns.map(mapProofreadingPassRunToMatrixItem);
  }

  const payload = asRecord(job?.payload);
  const passRuns = Array.isArray(payload?.proofreadingDeepPassRuns)
    ? payload.proofreadingDeepPassRuns
    : [];

  return passRuns.flatMap((passRun): ManuscriptHarnessMatrixItemRecord[] => {
    const pass = asRecord(passRun);
    if (!pass) {
      return [];
    }
    const passNo = typeof pass?.pass_no === "number" ? pass.pass_no : undefined;
    const passKind =
      typeof pass?.pass_kind === "string" ? pass.pass_kind : undefined;
    const status = typeof pass?.status === "string" ? pass.status : undefined;
    if (passNo == null || !passKind) {
      return [];
    }

    return [
      {
        key: `proofreading_pass.${passNo}.${passKind}`,
        label: `Proofreading pass ${passNo}`,
        state: status === "completed" ? "hit" : status === "failed" ? "failed" : "observed",
        source_kind: "proofreading_deep_pass",
        source_id: `${job?.id ?? "unknown"}:${passNo}`,
        title: passKind,
        summary: readString(asRecord(pass.output)?.summary),
        evidence: {
          job_id: job?.id,
          pass_no: passNo,
          pass_kind: passKind,
          status,
          model_id: typeof pass.model_id === "string" ? pass.model_id : undefined,
          started_at:
            typeof pass.started_at === "string" ? pass.started_at : undefined,
          finished_at:
            typeof pass.finished_at === "string" ? pass.finished_at : undefined,
          error_message:
            typeof pass.error_message === "string"
              ? pass.error_message
              : undefined,
        },
      },
    ];
  });
}

function mapProofreadingPassRunToMatrixItem(
  passRun: ProofreadingPassRunRecord,
): ManuscriptHarnessMatrixItemRecord {
  return {
    key: `proofreading_pass.${passRun.pass_no}.${passRun.pass_kind}`,
    label: `Proofreading pass ${passRun.pass_no}`,
    state:
      passRun.status === "completed"
        ? "hit"
        : passRun.status === "failed"
          ? "failed"
          : "observed",
    source_kind: "proofreading_deep_pass",
    source_id: passRun.id,
    title: passRun.pass_kind,
    summary: passRun.output?.summary,
    evidence: {
      pass_run_id: passRun.id,
      job_id: passRun.job_id,
      snapshot_id: passRun.snapshot_id,
      pass_no: passRun.pass_no,
      pass_kind: passRun.pass_kind,
      status: passRun.status,
      model_id: passRun.model_id,
      model_version: passRun.model_version,
      rule_ids: passRun.rule_ids,
      knowledge_item_ids: passRun.knowledge_item_ids,
      quality_package_ids: passRun.quality_package_ids,
      prompt_template_id: passRun.prompt_template_id,
      skill_package_ids: passRun.skill_package_ids,
      retry_count: passRun.retry_count,
      started_at: passRun.started_at,
      finished_at: passRun.finished_at,
      error_message: passRun.error_message,
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function deriveReviewItemMatrixState(
  item: ReviewItemRecord,
): ManuscriptHarnessMatrixState {
  if (
    item.source_kind === "governed_hit" &&
    item.source_status === "rejected_as_false_positive"
  ) {
    return "false_positive";
  }

  if (item.source_kind === "governed_hit") {
    if (item.feedback_category === "missed_hit") {
      return "manual_added";
    }

    if (item.feedback_category === "incorrect_hit") {
      return "missed";
    }

    return "skipped";
  }

  if (item.source_kind === "residual_issue") {
    return "missed";
  }

  return "observed";
}

function selectLatestSnapshotForModule(
  snapshots: ModuleExecutionSnapshotRecord[],
  module: MainlineSettlementModule,
): ModuleExecutionSnapshotRecord | undefined {
  return snapshots
    .filter((snapshot) => snapshot.module === module)
    .sort((left, right) => {
      if (left.created_at !== right.created_at) {
        return right.created_at.localeCompare(left.created_at);
      }

      return right.id.localeCompare(left.id);
    })[0];
}

async function enrichManuscriptView(
  manuscript: ManuscriptRecord,
  input: {
    manuscriptService: Pick<ManuscriptLifecycleService, "listJobsByManuscriptId">;
    assetService: Pick<DocumentAssetService, "listAssets">;
    executionResolutionService?: Pick<
      ExecutionResolutionService,
      "resolveOperatorSummary"
    >;
    executionTrackingService?: Pick<
      ExecutionTrackingService,
      "listSnapshotsByManuscriptId"
    >;
    executionTrackingViewOptions: ExecutionTrackingSnapshotViewOptions;
  },
): Promise<ManuscriptViewRecord> {
  const overview = buildEmptyManuscriptModuleExecutionOverview();
  const assets = await input.assetService.listAssets(manuscript.id);
  const resultAssetMatrix = resolveResultAssetMatrix({
    assets,
    pointers: {
      screeningAssetId: manuscript.current_screening_asset_id,
      editingAssetId: manuscript.current_editing_asset_id,
      proofreadingAssetId: manuscript.current_proofreading_asset_id,
    },
  });
  const currentExportSelection = resolveCurrentExportSelection(resultAssetMatrix);
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

    return withGovernedExecutionContextSummary({
      ...manuscript,
      result_asset_matrix: resultAssetMatrix,
      ...(currentExportSelection
        ? { current_export_selection: currentExportSelection }
        : {}),
      module_execution_overview: overview,
      mainline_readiness_summary: readinessSummary,
      mainline_attention_handoff_pack:
        deriveManuscriptMainlineAttentionHandoffPack({
          overview,
          readiness: readinessSummary,
          attemptLedger,
        }),
      mainline_attempt_ledger: attemptLedger,
    }, input.executionResolutionService);
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
          ...(module === "editing" &&
          manuscript.editing_completion_gate_summary
            ? {
                editingCompletionGateSummary:
                  manuscript.editing_completion_gate_summary,
              }
            : {}),
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

  return withGovernedExecutionContextSummary({
    ...manuscript,
    result_asset_matrix: resultAssetMatrix,
    ...(currentExportSelection
      ? { current_export_selection: currentExportSelection }
      : {}),
    module_execution_overview: overview,
    mainline_readiness_summary: readinessSummary,
    mainline_attention_handoff_pack: deriveManuscriptMainlineAttentionHandoffPack({
      overview,
      readiness: readinessSummary,
      attemptLedger,
    }),
    mainline_attempt_ledger: attemptLedger,
  }, input.executionResolutionService);
}

async function enrichJobView(
  job: JobRecord,
  input: {
    executionTrackingService?: Pick<ExecutionTrackingService, "getSnapshot">;
    executionTrackingViewOptions: ExecutionTrackingSnapshotViewOptions;
  },
): Promise<JobViewRecord> {
  const batchProgress = buildJobBatchProgressView(job);
  const snapshotId = extractSnapshotId(job);
  if (!snapshotId) {
    return {
      ...job,
      ...(batchProgress ? { batch_progress: batchProgress } : {}),
      execution_tracking: createNotTrackedJobExecutionObservation(),
    };
  }

  if (!input.executionTrackingService) {
    return {
      ...job,
      ...(batchProgress ? { batch_progress: batchProgress } : {}),
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
        ...(batchProgress ? { batch_progress: batchProgress } : {}),
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
      ...(batchProgress ? { batch_progress: batchProgress } : {}),
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
      ...(batchProgress ? { batch_progress: batchProgress } : {}),
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

function buildJobBatchProgressView(
  job: JobRecord,
): JobBatchProgressRecord | undefined {
  const batch = readJobBatchState(job);
  if (!batch) {
    return undefined;
  }

  const totalCount = batch.items.length;
  const queuedCount = countBatchItems(batch.items, "queued");
  const runningCount = countBatchItems(batch.items, "running");
  const succeededCount = countBatchItems(batch.items, "succeeded");
  const failedCount = countBatchItems(batch.items, "failed");
  const cancelledCount = countBatchItems(batch.items, "cancelled");
  const lifecycleStatus = deriveBatchLifecycleStatus(batch.items);

  return {
    lifecycle_status: lifecycleStatus,
    settlement_status: deriveBatchSettlementStatus(lifecycleStatus, batch.items),
    total_count: totalCount,
    queued_count: queuedCount,
    running_count: runningCount,
    succeeded_count: succeededCount,
    failed_count: failedCount,
    cancelled_count: cancelledCount,
    remaining_count: queuedCount + runningCount,
    restart_posture: batch.restart_posture,
    items: batch.items,
  };
}

function readJobBatchState(job: JobRecord): JobBatchStateRecord | undefined {
  const batch = job.payload?.batch;
  if (!batch || typeof batch !== "object") {
    return undefined;
  }

  return JSON.parse(JSON.stringify(batch)) as JobBatchStateRecord;
}

function countBatchItems(
  items: readonly JobBatchItemRecord[],
  status: JobBatchItemRecord["status"],
): number {
  return items.filter((item) => item.status === status).length;
}

function deriveBatchLifecycleStatus(
  items: readonly JobBatchItemRecord[],
): JobBatchLifecycleStatus {
  if (items.every((item) => item.status === "queued")) {
    return "queued";
  }

  if (
    items.some((item) => item.status === "queued") ||
    items.some((item) => item.status === "running")
  ) {
    return "running";
  }

  if (items.some((item) => item.status === "cancelled")) {
    return "cancelled";
  }

  return "completed";
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

async function withGovernedExecutionContextSummary<
  TManuscript extends ManuscriptRecord,
>(
  manuscript: TManuscript,
  executionResolutionService?: Pick<
    ExecutionResolutionService,
    "resolveOperatorSummary"
  >,
): Promise<TManuscript> {
  return {
    ...manuscript,
    governed_execution_context_summary:
      await buildGovernedExecutionContextSummary(
        manuscript,
        executionResolutionService,
      ),
  } as TManuscript;
}

async function buildGovernedExecutionContextSummary(
  manuscript: ManuscriptRecord,
  executionResolutionService?: Pick<
    ExecutionResolutionService,
    "resolveOperatorSummary"
  >,
): Promise<GovernedExecutionContextSummary> {
  if (!executionResolutionService) {
    return buildFallbackGovernedExecutionContextSummary(
      manuscript,
      manuscript.current_template_family_id
        ? "Execution resolution service is unavailable."
        : undefined,
    );
  }

  try {
    return await executionResolutionService.resolveOperatorSummary({
      manuscriptType: manuscript.manuscript_type,
      baseTemplateFamilyId: manuscript.current_template_family_id,
      journalTemplateId: manuscript.current_journal_template_id,
    });
  } catch (error) {
    return buildFallbackGovernedExecutionContextSummary(
      manuscript,
      error instanceof Error
        ? error.message
        : "Unknown governed execution summary error.",
    );
  }
}

function buildFallbackGovernedExecutionContextSummary(
  manuscript: ManuscriptRecord,
  error?: string,
): GovernedExecutionContextSummary {
  if (!manuscript.current_template_family_id) {
    return {
      observation_status: "reported",
      manuscript_type: manuscript.manuscript_type,
      journal_template_selection_state: manuscript.current_journal_template_id
        ? "selected"
        : "base_family_only",
      ...(manuscript.current_journal_template_id
        ? { journal_template_id: manuscript.current_journal_template_id }
        : {}),
      modules: GOVERNED_MANUSCRIPT_MAINLINE_MODULES.map((module) => ({
        module,
        status: "not_configured",
      })),
    };
  }

  return {
    observation_status: "failed_open",
    manuscript_type: manuscript.manuscript_type,
    base_template_family_id: manuscript.current_template_family_id,
    journal_template_selection_state: manuscript.current_journal_template_id
      ? "selected"
      : "base_family_only",
    ...(manuscript.current_journal_template_id
      ? { journal_template_id: manuscript.current_journal_template_id }
      : {}),
    modules: GOVERNED_MANUSCRIPT_MAINLINE_MODULES.map((module) => ({
      module,
      status: "failed_open",
      ...(error ? { error } : {}),
    })),
    ...(error ? { error } : {}),
  };
}
