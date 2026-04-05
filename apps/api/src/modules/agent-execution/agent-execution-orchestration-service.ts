import { randomUUID } from "node:crypto";
import type { RoleKey } from "../../users/roles.ts";
import type { EvaluationRunRecord } from "../verification-ops/verification-ops-record.ts";
import { AgentExecutionService } from "./agent-execution-service.ts";
import type { AgentExecutionLogRecord } from "./agent-execution-record.ts";
import { ExecutionTrackingService } from "../execution-tracking/execution-tracking-service.ts";
import { VerificationOpsService } from "../verification-ops/verification-ops-service.ts";

export interface AgentExecutionOrchestrationRecoverySummary {
  processed_count: number;
  completed_count: number;
  retryable_count: number;
  failed_count: number;
  deferred_count: number;
}

export type AgentExecutionOrchestrationInspectionCategory =
  | "recoverable_now"
  | "stale_running"
  | "deferred_retry"
  | "attention_required"
  | "not_recoverable";

export interface AgentExecutionOrchestrationInspectionItem {
  log_id: string;
  manuscript_id: string;
  module: AgentExecutionLogRecord["module"];
  business_status: AgentExecutionLogRecord["status"];
  orchestration_status: AgentExecutionLogRecord["orchestration_status"];
  orchestration_attempt_count: number;
  orchestration_max_attempts: number;
  orchestration_last_attempt_started_at?: string;
  orchestration_last_attempt_finished_at?: string;
  orchestration_next_retry_at?: string;
  category: AgentExecutionOrchestrationInspectionCategory;
  reason: string;
}

export interface AgentExecutionOrchestrationInspectionSummary {
  total_count: number;
  recoverable_now_count: number;
  stale_running_count: number;
  deferred_retry_count: number;
  attention_required_count: number;
  not_recoverable_count: number;
}

export interface AgentExecutionOrchestrationInspectionFocus {
  actionable_count: number;
  displayed_count: number;
  omitted_count: number;
  actionable_only: boolean;
  limit?: number;
}

export interface AgentExecutionOrchestrationInspectionReport {
  summary: AgentExecutionOrchestrationInspectionSummary;
  focus: AgentExecutionOrchestrationInspectionFocus;
  items: AgentExecutionOrchestrationInspectionItem[];
}

export interface AgentExecutionOrchestrationInspectionOptions {
  actionableOnly?: boolean;
  limit?: number;
}

export interface AgentExecutionOrchestrationServiceOptions {
  agentExecutionService: AgentExecutionService;
  executionTrackingService: ExecutionTrackingService;
  verificationOpsService: VerificationOpsService;
  actorRole?: RoleKey;
  now?: () => Date;
  createClaimToken?: () => string;
  runningAttemptStaleAfterMs?: number;
  retryCooldownMs?: number;
}

export class AgentExecutionOrchestrationSnapshotMissingError extends Error {
  constructor(logId: string, snapshotId: string) {
    super(
      `Agent execution log ${logId} references missing execution snapshot ${snapshotId}.`,
    );
    this.name = "AgentExecutionOrchestrationSnapshotMissingError";
  }
}

export class AgentExecutionOrchestrationOutputAssetMissingError extends Error {
  constructor(logId: string, snapshotId: string) {
    super(
      `Agent execution log ${logId} snapshot ${snapshotId} does not contain a governed output asset.`,
    );
    this.name = "AgentExecutionOrchestrationOutputAssetMissingError";
  }
}

export class AgentExecutionOrchestrationBusinessIncompleteError extends Error {
  constructor(logId: string, status: AgentExecutionLogRecord["status"]) {
    super(
      `Agent execution log ${logId} cannot orchestrate follow-up from business status ${status}.`,
    );
    this.name = "AgentExecutionOrchestrationBusinessIncompleteError";
  }
}

export class AgentExecutionOrchestrationSnapshotUnboundError extends Error {
  constructor(logId: string) {
    super(
      `Agent execution log ${logId} cannot orchestrate follow-up without an execution snapshot.`,
    );
    this.name = "AgentExecutionOrchestrationSnapshotUnboundError";
  }
}

export class AgentExecutionOrchestrationGovernedRunFailedError extends Error {
  constructor(
    runId: string,
    readonly evidenceIds: string[],
    message?: string,
  ) {
    super(
      message ??
        `Governed evaluation run ${runId} finished with verification failures.`,
    );
    this.name = "AgentExecutionOrchestrationGovernedRunFailedError";
  }
}

export class AgentExecutionOrchestrationService {
  private static readonly DEFAULT_RUNNING_ATTEMPT_STALE_AFTER_MS = 5 * 60 * 1000;
  private static readonly DEFAULT_RETRY_COOLDOWN_MS = 60 * 1000;
  private readonly agentExecutionService: AgentExecutionService;
  private readonly executionTrackingService: ExecutionTrackingService;
  private readonly verificationOpsService: VerificationOpsService;
  private readonly actorRole: RoleKey;
  private readonly now: () => Date;
  private readonly createClaimToken: () => string;
  private readonly runningAttemptStaleAfterMs: number;
  private readonly retryCooldownMs: number;

  constructor(options: AgentExecutionOrchestrationServiceOptions) {
    this.agentExecutionService = options.agentExecutionService;
    this.executionTrackingService = options.executionTrackingService;
    this.verificationOpsService = options.verificationOpsService;
    this.actorRole = options.actorRole ?? "admin";
    this.now = options.now ?? (() => new Date());
    this.createClaimToken = options.createClaimToken ?? (() => randomUUID());
    this.runningAttemptStaleAfterMs = Math.max(
      0,
      options.runningAttemptStaleAfterMs ??
        AgentExecutionOrchestrationService.DEFAULT_RUNNING_ATTEMPT_STALE_AFTER_MS,
    );
    this.retryCooldownMs = Math.max(
      0,
      options.retryCooldownMs ??
        AgentExecutionOrchestrationService.DEFAULT_RETRY_COOLDOWN_MS,
    );
  }

  async dispatchBestEffort(logId: string): Promise<AgentExecutionLogRecord> {
    const result = await this.dispatchWithOwnership(logId);
    return result.log;
  }

  private async dispatchWithOwnership(
    logId: string,
  ): Promise<{ log: AgentExecutionLogRecord; claimed: boolean }> {
    const existing = await this.agentExecutionService.getLog(logId);
    if (!this.isRecoverable(existing)) {
      return {
        log: existing,
        claimed: false,
      };
    }

    const claimToken = this.createClaimToken();
    const claimed = await this.agentExecutionService.claimOrchestrationAttempt({
      logId,
      claimToken,
      expectedOrchestrationStatus: existing.orchestration_status,
      expectedAttemptCount: existing.orchestration_attempt_count,
      expectedLastAttemptStartedAt: existing.orchestration_last_attempt_started_at,
      expectedNextRetryAt: existing.orchestration_next_retry_at,
      expectedAttemptClaimToken: existing.orchestration_attempt_claim_token,
    });
    if (!claimed) {
      return {
        log: await this.agentExecutionService.getLog(logId),
        claimed: false,
      };
    }

    try {
      const evidenceIds = await this.executeGovernedFollowUp(logId);
      return {
        log: await this.agentExecutionService.completeOrchestration({
          logId,
          claimToken,
          evidenceIds,
        }),
        claimed: true,
      };
    } catch (error) {
      return {
        log: await this.agentExecutionService.failOrchestrationAttempt({
          logId,
          claimToken,
          errorMessage: formatError(error),
          evidenceIds:
            error instanceof AgentExecutionOrchestrationGovernedRunFailedError
              ? error.evidenceIds
              : undefined,
          nextRetryAt: this.computeNextRetryAt(),
        }),
        claimed: true,
      };
    }
  }

  async recoverPending(): Promise<AgentExecutionOrchestrationRecoverySummary> {
    const logs = await this.agentExecutionService.listLogs();
    const summary: AgentExecutionOrchestrationRecoverySummary = {
      processed_count: 0,
      completed_count: 0,
      retryable_count: 0,
      failed_count: 0,
      deferred_count: 0,
    };

    for (const log of logs) {
      if (isDeferredRetry(log, this.now())) {
        summary.deferred_count += 1;
        continue;
      }

      if (!this.isRecoverable(log)) {
        continue;
      }

      const updated = await this.dispatchWithOwnership(log.id);
      if (!updated.claimed) {
        continue;
      }

      summary.processed_count += 1;
      if (updated.log.orchestration_status === "completed") {
        summary.completed_count += 1;
      } else if (updated.log.orchestration_status === "retryable") {
        summary.retryable_count += 1;
      } else if (updated.log.orchestration_status === "failed") {
        summary.failed_count += 1;
      }
    }

    return summary;
  }

  async inspectBacklog(
    options: AgentExecutionOrchestrationInspectionOptions = {},
  ): Promise<AgentExecutionOrchestrationInspectionReport> {
    const logs = await this.agentExecutionService.listLogs();
    const normalizedLimit =
      options.limit != null ? Math.max(0, Math.trunc(options.limit)) : undefined;
    const report: AgentExecutionOrchestrationInspectionReport = {
      summary: {
        total_count: logs.length,
        recoverable_now_count: 0,
        stale_running_count: 0,
        deferred_retry_count: 0,
        attention_required_count: 0,
        not_recoverable_count: 0,
      },
      focus: {
        actionable_count: 0,
        displayed_count: 0,
        omitted_count: 0,
        actionable_only: options.actionableOnly === true,
        limit: normalizedLimit,
      },
      items: [],
    };
    const items: AgentExecutionOrchestrationInspectionItem[] = [];

    for (const log of logs) {
      const item = inspectOrchestrationLog(
        log,
        this.now(),
        this.runningAttemptStaleAfterMs,
      );
      items.push(item);

      if (item.category === "recoverable_now") {
        report.summary.recoverable_now_count += 1;
      } else if (item.category === "stale_running") {
        report.summary.stale_running_count += 1;
      } else if (item.category === "deferred_retry") {
        report.summary.deferred_retry_count += 1;
      } else if (item.category === "attention_required") {
        report.summary.attention_required_count += 1;
      } else {
        report.summary.not_recoverable_count += 1;
      }
    }

    const sorted = [...items].sort(compareInspectionItems);
    const actionable = sorted.filter((item) => item.category !== "not_recoverable");
    report.focus.actionable_count = actionable.length;

    const visibleBase =
      options.actionableOnly === true ? actionable : sorted;
    const visible =
      normalizedLimit != null
        ? visibleBase.slice(0, normalizedLimit)
        : visibleBase;

    report.focus.displayed_count = visible.length;
    report.focus.omitted_count = Math.max(0, visibleBase.length - visible.length);
    report.items = visible;

    return report;
  }

  private isRecoverable(log: AgentExecutionLogRecord): boolean {
    if (log.status !== "completed") {
      return false;
    }

    return (
      log.orchestration_status === "pending" ||
      (log.orchestration_status === "retryable" &&
        isRetryEligible(log, this.now())) ||
      (log.orchestration_status === "running" &&
        isStaleRunningAttempt(
          log,
          this.now(),
          this.runningAttemptStaleAfterMs,
        ))
    );
  }

  private async executeGovernedFollowUp(logId: string): Promise<string[]> {
    const log = await this.agentExecutionService.getLog(logId);
    if (log.status !== "completed") {
      throw new AgentExecutionOrchestrationBusinessIncompleteError(log.id, log.status);
    }
    if (!log.execution_snapshot_id) {
      throw new AgentExecutionOrchestrationSnapshotUnboundError(log.id);
    }

    const snapshot = await this.executionTrackingService.getSnapshot(
      log.execution_snapshot_id,
    );
    if (!snapshot) {
      throw new AgentExecutionOrchestrationSnapshotMissingError(
        log.id,
        log.execution_snapshot_id,
      );
    }

    const outputAssetId = snapshot.created_asset_ids[0];
    if (!outputAssetId) {
      throw new AgentExecutionOrchestrationOutputAssetMissingError(
        log.id,
        snapshot.id,
      );
    }

    const runs = await this.verificationOpsService.seedGovernedExecutionRuns(
      this.actorRole,
      {
        suiteIds: log.evaluation_suite_ids,
        releaseCheckProfileId: log.release_check_profile_id,
        governedSource: {
          source_kind: "governed_module_execution",
          manuscript_id: log.manuscript_id,
          source_module: log.module,
          agent_execution_log_id: log.id,
          execution_snapshot_id: snapshot.id,
          output_asset_id: outputAssetId,
        },
      },
    );

    const evidenceIds = [...log.verification_evidence_ids];
    for (const seededRun of runs) {
      const run = await this.ensureRunFinalized(seededRun);
      evidenceIds.push(...run.evidence_ids);
      if (run.status === "failed") {
        const evidence = await this.verificationOpsService.listEvaluationRunEvidence(
          this.actorRole,
          run.id,
        );
        const lastEvidence = evidence[evidence.length - 1];
        throw new AgentExecutionOrchestrationGovernedRunFailedError(
          run.id,
          dedupePreserveOrder(evidenceIds),
          lastEvidence?.label ??
            `Governed evaluation run ${run.id} finished with verification failures.`,
        );
      }
    }

    return dedupePreserveOrder(evidenceIds);
  }

  private async ensureRunFinalized(
    run: EvaluationRunRecord,
  ): Promise<EvaluationRunRecord> {
    if (run.status === "queued") {
      return this.verificationOpsService.executeSeededGovernedRunChecks(
        this.actorRole,
        {
          runId: run.id,
        },
      );
    }

    if (run.status === "passed" || run.status === "failed") {
      return run;
    }

    throw new Error(
      `Governed evaluation run ${run.id} is not recoverable from status ${run.status}.`,
    );
  }

  private computeNextRetryAt(): string {
    return new Date(this.now().getTime() + this.retryCooldownMs).toISOString();
  }
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

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isStaleRunningAttempt(
  log: AgentExecutionLogRecord,
  now: Date,
  staleAfterMs: number,
): boolean {
  const startedAt = log.orchestration_last_attempt_started_at;
  if (!startedAt) {
    return true;
  }

  const startedAtMs = Date.parse(startedAt);
  if (Number.isNaN(startedAtMs)) {
    return true;
  }

  return now.getTime() - startedAtMs >= staleAfterMs;
}

function isRetryEligible(log: AgentExecutionLogRecord, now: Date): boolean {
  const nextRetryAt = log.orchestration_next_retry_at;
  if (!nextRetryAt) {
    return true;
  }

  const nextRetryAtMs = Date.parse(nextRetryAt);
  if (Number.isNaN(nextRetryAtMs)) {
    return true;
  }

  return now.getTime() >= nextRetryAtMs;
}

function isDeferredRetry(log: AgentExecutionLogRecord, now: Date): boolean {
  return (
    log.status === "completed" &&
    log.orchestration_status === "retryable" &&
    !isRetryEligible(log, now)
  );
}

function inspectOrchestrationLog(
  log: AgentExecutionLogRecord,
  now: Date,
  staleAfterMs: number,
): AgentExecutionOrchestrationInspectionItem {
  let category: AgentExecutionOrchestrationInspectionCategory;
  let reason: string;

  if (log.status !== "completed") {
    category = "not_recoverable";
    reason = `Business execution is ${log.status}, so governed follow-up is not recoverable yet.`;
  } else if (log.orchestration_status === "pending") {
    category = "recoverable_now";
    reason = "Pending orchestration is ready to replay now.";
  } else if (log.orchestration_status === "retryable") {
    if (isRetryEligible(log, now)) {
      category = "recoverable_now";
      reason = "Retryable orchestration is eligible to replay now.";
    } else {
      category = "deferred_retry";
      reason =
        log.orchestration_next_retry_at != null
          ? `Retryable orchestration is deferred until ${log.orchestration_next_retry_at}.`
          : "Retryable orchestration is deferred until its next retry eligibility is reached.";
    }
  } else if (log.orchestration_status === "running") {
    if (isStaleRunningAttempt(log, now, staleAfterMs)) {
      category = "stale_running";
      reason = "Running orchestration attempt is stale and reclaimable.";
    } else {
      category = "not_recoverable";
      reason = "Running orchestration attempt is still fresh and should not be reclaimed yet.";
    }
  } else if (log.orchestration_status === "failed") {
    category = "attention_required";
    reason =
      log.orchestration_last_error != null
        ? `Orchestration failed terminally: ${log.orchestration_last_error}`
        : "Orchestration failed terminally and needs operator attention.";
  } else if (log.orchestration_status === "completed") {
    category = "not_recoverable";
    reason = "Orchestration is already completed.";
  } else {
    category = "not_recoverable";
    reason = "No governed follow-up orchestration is required for this execution.";
  }

  return {
    log_id: log.id,
    manuscript_id: log.manuscript_id,
    module: log.module,
    business_status: log.status,
    orchestration_status: log.orchestration_status,
    orchestration_attempt_count: log.orchestration_attempt_count,
    orchestration_max_attempts: log.orchestration_max_attempts,
    orchestration_last_attempt_started_at:
      log.orchestration_last_attempt_started_at,
    orchestration_last_attempt_finished_at:
      log.orchestration_last_attempt_finished_at,
    orchestration_next_retry_at: log.orchestration_next_retry_at,
    category,
    reason,
  };
}

function compareInspectionItems(
  left: AgentExecutionOrchestrationInspectionItem,
  right: AgentExecutionOrchestrationInspectionItem,
): number {
  const priorityDelta =
    inspectionCategoryPriority(left.category) -
    inspectionCategoryPriority(right.category);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const leftTimestamp =
    left.orchestration_next_retry_at ??
    left.orchestration_last_attempt_started_at ??
    left.orchestration_last_attempt_finished_at;
  const rightTimestamp =
    right.orchestration_next_retry_at ??
    right.orchestration_last_attempt_started_at ??
    right.orchestration_last_attempt_finished_at;
  if (leftTimestamp != null && rightTimestamp != null && leftTimestamp !== rightTimestamp) {
    return leftTimestamp.localeCompare(rightTimestamp);
  }

  if (leftTimestamp != null && rightTimestamp == null) {
    return -1;
  }

  if (leftTimestamp == null && rightTimestamp != null) {
    return 1;
  }

  return left.log_id.localeCompare(right.log_id);
}

function inspectionCategoryPriority(
  category: AgentExecutionOrchestrationInspectionCategory,
): number {
  if (category === "attention_required") {
    return 0;
  }

  if (category === "stale_running") {
    return 1;
  }

  if (category === "recoverable_now") {
    return 2;
  }

  if (category === "deferred_retry") {
    return 3;
  }

  return 4;
}
