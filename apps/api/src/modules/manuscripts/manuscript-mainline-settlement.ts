import type { JobRecord } from "../jobs/job-record.ts";
import type { ModuleExecutionSnapshotViewRecord } from "../execution-tracking/execution-tracking-record.ts";

export const MAINLINE_SETTLEMENT_MODULES = [
  "screening",
  "editing",
  "proofreading",
] as const;

export type MainlineSettlementModule =
  (typeof MAINLINE_SETTLEMENT_MODULES)[number];

export type ModuleMainlineSettlementDerivedStatus =
  | "not_started"
  | "job_in_progress"
  | "job_failed"
  | "business_completed_unlinked"
  | "business_completed_follow_up_pending"
  | "business_completed_follow_up_running"
  | "business_completed_follow_up_retryable"
  | "business_completed_follow_up_failed"
  | "business_completed_settled";

export interface ModuleMainlineSettlementRecord {
  derived_status: ModuleMainlineSettlementDerivedStatus;
  business_completed: boolean;
  orchestration_completed: boolean;
  attention_required: boolean;
  reason: string;
}

export interface ModuleExecutionOverviewRecord {
  module: MainlineSettlementModule;
  observation_status: "reported" | "not_started" | "failed_open";
  latest_job?: JobRecord;
  latest_snapshot?: ModuleExecutionSnapshotViewRecord;
  settlement?: ModuleMainlineSettlementRecord;
  error?: string;
}

export interface ManuscriptModuleExecutionOverviewRecord {
  screening: ModuleExecutionOverviewRecord;
  editing: ModuleExecutionOverviewRecord;
  proofreading: ModuleExecutionOverviewRecord;
}

export type ManuscriptMainlineReadinessDerivedStatus =
  | "ready_for_next_step"
  | "in_progress"
  | "waiting_for_follow_up"
  | "attention_required"
  | "completed";

export interface ManuscriptMainlineReadinessSummaryRecord {
  observation_status: "reported" | "failed_open";
  derived_status?: ManuscriptMainlineReadinessDerivedStatus;
  active_module?: MainlineSettlementModule;
  next_module?: MainlineSettlementModule;
  recovery_ready_at?: string;
  runtime_binding_status?: "ready" | "degraded" | "missing";
  runtime_binding_issue_count?: number;
  reason?: string;
  error?: string;
}

export type MainlineAttentionHandoffObservationStatus =
  | "reported"
  | "failed_open";

export type MainlineAttentionStatus = "clear" | "monitoring" | "action_required";

export type MainlineHandoffStatus =
  | "ready_now"
  | "blocked_by_in_progress"
  | "blocked_by_follow_up"
  | "blocked_by_attention"
  | "completed";

export type MainlineAttentionItemKind =
  | "job_in_progress"
  | "follow_up_pending"
  | "follow_up_running"
  | "follow_up_retryable"
  | "follow_up_failed"
  | "settlement_unlinked"
  | "job_failed"
  | "runtime_binding_degraded"
  | "runtime_binding_missing";

export type MainlineAttentionItemSeverity = "monitoring" | "action_required";

export interface MainlineAttentionItemRecord {
  module: MainlineSettlementModule;
  kind: MainlineAttentionItemKind;
  severity: MainlineAttentionItemSeverity;
  job_id?: string;
  snapshot_id?: string;
  recovery_ready_at?: string;
  summary: string;
}

export interface ManuscriptMainlineAttentionHandoffPackRecord {
  observation_status: MainlineAttentionHandoffObservationStatus;
  attention_status?: MainlineAttentionStatus;
  handoff_status?: MainlineHandoffStatus;
  focus_module?: MainlineSettlementModule;
  from_module?: MainlineSettlementModule;
  to_module?: MainlineSettlementModule;
  latest_job_id?: string;
  latest_snapshot_id?: string;
  recovery_ready_at?: string;
  runtime_binding_status?: "ready" | "degraded" | "missing";
  runtime_binding_issue_count?: number;
  reason?: string;
  attention_items: MainlineAttentionItemRecord[];
  error?: string;
}

export type MainlineAttemptLedgerObservationStatus = "reported" | "failed_open";

export type MainlineAttemptLedgerEvidenceStatus =
  | "snapshot_linked"
  | "job_only"
  | "failed_open";

export interface MainlineAttemptLedgerItemRecord {
  module: MainlineSettlementModule;
  job_id: string;
  job_status: JobRecord["status"];
  job_attempt_count: number;
  created_at: string;
  updated_at: string;
  started_at?: string;
  finished_at?: string;
  snapshot_id?: string;
  evidence_status: MainlineAttemptLedgerEvidenceStatus;
  settlement_status?: ModuleMainlineSettlementDerivedStatus;
  orchestration_status?: string;
  orchestration_attempt_count?: number;
  recovery_category?: string;
  recovery_ready_at?: string;
  runtime_binding_status?: "ready" | "degraded" | "missing";
  runtime_binding_issue_count?: number;
  is_latest_for_module: boolean;
  reason: string;
}

export interface ManuscriptMainlineAttemptLedgerRecord {
  observation_status: MainlineAttemptLedgerObservationStatus;
  total_attempts: number;
  visible_attempts: number;
  truncated: boolean;
  latest_event_at?: string;
  items: MainlineAttemptLedgerItemRecord[];
  error?: string;
}

export interface JobExecutionTrackingObservationRecord {
  observation_status: "reported" | "not_tracked" | "failed_open";
  snapshot?: ModuleExecutionSnapshotViewRecord;
  settlement?: ModuleMainlineSettlementRecord;
  error?: string;
}

export function createNotStartedModuleOverview(
  module: MainlineSettlementModule,
): ModuleExecutionOverviewRecord {
  return {
    module,
    observation_status: "not_started",
  };
}

export function createNotTrackedJobExecutionObservation(): JobExecutionTrackingObservationRecord {
  return {
    observation_status: "not_tracked",
  };
}

export function deriveModuleMainlineSettlement(input: {
  latestJob?: JobRecord;
  latestSnapshot?: ModuleExecutionSnapshotViewRecord;
}): ModuleMainlineSettlementRecord | undefined {
  const { latestJob, latestSnapshot } = input;

  if (!latestJob && !latestSnapshot) {
    return undefined;
  }

  if (!latestSnapshot) {
    if (latestJob?.status === "failed" || latestJob?.status === "cancelled") {
      return {
        derived_status: "job_failed",
        business_completed: false,
        orchestration_completed: false,
        attention_required: true,
        reason: `Latest job is ${latestJob.status} and no execution snapshot exists yet.`,
      };
    }

    return {
      derived_status: "job_in_progress",
      business_completed: false,
      orchestration_completed: false,
      attention_required: false,
      reason:
        latestJob != null
          ? `Latest job is ${latestJob.status} and no execution snapshot exists yet.`
          : "Execution snapshot is not available yet.",
    };
  }

  const observation = latestSnapshot.agent_execution;
  if (observation.observation_status !== "reported" || !observation.log) {
    return {
      derived_status: "business_completed_unlinked",
      business_completed: true,
      orchestration_completed: false,
      attention_required: observation.observation_status === "failed_open",
      reason:
        observation.observation_status === "failed_open"
          ? observation.error ?? "Linked agent execution observation failed open."
          : "Business snapshot exists without linked execution settlement.",
    };
  }

  const completion = observation.log.completion_summary;

  switch (completion.derived_status) {
    case "business_completed_settled":
      return {
        derived_status: "business_completed_settled",
        business_completed: true,
        orchestration_completed: true,
        attention_required: false,
        reason: "Business execution and governed follow-up are both settled.",
      };
    case "business_completed_follow_up_pending":
      return {
        derived_status: "business_completed_follow_up_pending",
        business_completed: true,
        orchestration_completed: false,
        attention_required: false,
        reason: "Business execution is complete and governed follow-up is pending.",
      };
    case "business_completed_follow_up_running":
      return {
        derived_status: "business_completed_follow_up_running",
        business_completed: true,
        orchestration_completed: false,
        attention_required: false,
        reason: "Business execution is complete and governed follow-up is running.",
      };
    case "business_completed_follow_up_retryable":
      return {
        derived_status: "business_completed_follow_up_retryable",
        business_completed: true,
        orchestration_completed: false,
        attention_required: false,
        reason: "Business execution is complete and governed follow-up is retryable.",
      };
    case "business_completed_follow_up_failed":
      return {
        derived_status: "business_completed_follow_up_failed",
        business_completed: true,
        orchestration_completed: false,
        attention_required: true,
        reason: "Business execution is complete but governed follow-up failed.",
      };
    case "business_failed":
      return {
        derived_status: "job_failed",
        business_completed: false,
        orchestration_completed: false,
        attention_required: true,
        reason: "Business execution failed.",
      };
    case "business_in_progress":
      return {
        derived_status: "job_in_progress",
        business_completed: false,
        orchestration_completed: false,
        attention_required: false,
        reason: "Business execution is still in progress.",
      };
  }
}

export function buildEmptyManuscriptModuleExecutionOverview(): ManuscriptModuleExecutionOverviewRecord {
  return {
    screening: createNotStartedModuleOverview("screening"),
    editing: createNotStartedModuleOverview("editing"),
    proofreading: createNotStartedModuleOverview("proofreading"),
  };
}

export function deriveManuscriptMainlineReadinessSummary(
  overview: ManuscriptModuleExecutionOverviewRecord,
): ManuscriptMainlineReadinessSummaryRecord {
  for (const module of MAINLINE_SETTLEMENT_MODULES) {
    const moduleOverview = overview[module];
    if (moduleOverview.observation_status === "failed_open") {
      return {
        observation_status: "failed_open",
        active_module: module,
        error:
          moduleOverview.error ??
          `${formatMainlineModuleLabel(module)} readiness observation failed open.`,
      };
    }

    if (moduleOverview.observation_status === "not_started") {
      return {
        observation_status: "reported",
        derived_status: "ready_for_next_step",
        next_module: module,
        reason: `The manuscript is ready for governed ${module}ing.`.replace(
          "proofreadinging",
          "proofreading",
        ),
      };
    }

    const settlement = moduleOverview.settlement;
    if (!settlement) {
      return {
        observation_status: "failed_open",
        active_module: module,
        error: `${formatMainlineModuleLabel(module)} readiness summary could not be derived because settlement is missing.`,
      };
    }

    if (settlement.derived_status === "business_completed_settled") {
      continue;
    }

    const shared = {
      observation_status: "reported" as const,
      active_module: module,
      recovery_ready_at: deriveModuleRecoveryReadyAt(moduleOverview),
      ...deriveModuleRuntimeBindingSummary(moduleOverview),
      reason: settlement.reason,
    };

    if (settlement.derived_status === "job_in_progress") {
      return {
        ...shared,
        derived_status: "in_progress",
      };
    }

    if (
      settlement.derived_status === "business_completed_follow_up_pending" ||
      settlement.derived_status === "business_completed_follow_up_running"
    ) {
      return {
        ...shared,
        derived_status: "waiting_for_follow_up",
      };
    }

    return {
      ...shared,
      derived_status: "attention_required",
    };
  }

  return {
    observation_status: "reported",
    derived_status: "completed",
    reason: "Screening, editing, and proofreading are all settled.",
  };
}

export function deriveManuscriptMainlineAttentionHandoffPack(input: {
  overview: ManuscriptModuleExecutionOverviewRecord;
  readiness: ManuscriptMainlineReadinessSummaryRecord;
  attemptLedger: ManuscriptMainlineAttemptLedgerRecord;
}): ManuscriptMainlineAttentionHandoffPackRecord {
  try {
    return deriveManuscriptMainlineAttentionHandoffPackUnsafe(input);
  } catch (error) {
    return {
      observation_status: "failed_open",
      attention_items: [],
      error:
        error instanceof Error
          ? error.message
          : "Unknown manuscript attention and handoff observation error.",
    };
  }
}

function deriveModuleRecoveryReadyAt(
  overview: ModuleExecutionOverviewRecord,
): string | undefined {
  if (overview.latest_snapshot?.agent_execution.observation_status !== "reported") {
    return undefined;
  }

  return overview.latest_snapshot.agent_execution.log?.recovery_summary.recovery_ready_at;
}

function deriveModuleRuntimeBindingSummary(
  overview: ModuleExecutionOverviewRecord,
): Pick<
  ManuscriptMainlineReadinessSummaryRecord,
  "runtime_binding_status" | "runtime_binding_issue_count"
> {
  const observation = overview.latest_snapshot?.runtime_binding_readiness;
  if (!observation || observation.observation_status !== "reported" || !observation.report) {
    return {};
  }

  return {
    runtime_binding_status: observation.report.status,
    runtime_binding_issue_count: observation.report.issues.length,
  };
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

function deriveManuscriptMainlineAttentionHandoffPackUnsafe(input: {
  overview: ManuscriptModuleExecutionOverviewRecord;
  readiness: ManuscriptMainlineReadinessSummaryRecord;
  attemptLedger: ManuscriptMainlineAttemptLedgerRecord;
}): ManuscriptMainlineAttentionHandoffPackRecord {
  const { overview, readiness, attemptLedger } = input;

  if (readiness.observation_status !== "reported" || !readiness.derived_status) {
    return {
      observation_status: "failed_open",
      attention_items: [],
      error:
        readiness.error ??
        "Mainline attention and handoff pack could not be derived because readiness is unavailable.",
    };
  }

  const focusModule = readiness.active_module;
  const fromModule = deriveAttentionPackFromModule(readiness);
  const toModule = deriveAttentionPackToModule(readiness);
  const evidenceModule = focusModule ?? fromModule;
  const evidence = evidenceModule
    ? resolveAttentionPackEvidence({
        overview: overview[evidenceModule],
        attemptLedgerItem: selectLatestAttemptLedgerItemForModule(
          attemptLedger,
          evidenceModule,
        ),
      })
    : {};
  const attentionItems = focusModule
    ? buildAttentionItemsForModule({
        module: focusModule,
        overview: overview[focusModule],
        attemptLedgerItem: selectLatestAttemptLedgerItemForModule(
          attemptLedger,
          focusModule,
        ),
      })
    : [];

  const shared = {
    observation_status: "reported" as const,
    attention_items: attentionItems,
    ...(focusModule ? { focus_module: focusModule } : {}),
    ...(fromModule ? { from_module: fromModule } : {}),
    ...(toModule ? { to_module: toModule } : {}),
    ...(evidence.latest_job_id ? { latest_job_id: evidence.latest_job_id } : {}),
    ...(evidence.latest_snapshot_id
      ? { latest_snapshot_id: evidence.latest_snapshot_id }
      : {}),
    ...(evidence.recovery_ready_at
      ? { recovery_ready_at: evidence.recovery_ready_at }
      : {}),
    ...(evidence.runtime_binding_status
      ? { runtime_binding_status: evidence.runtime_binding_status }
      : {}),
    ...(typeof evidence.runtime_binding_issue_count === "number"
      ? { runtime_binding_issue_count: evidence.runtime_binding_issue_count }
      : {}),
    ...(readiness.reason ? { reason: readiness.reason } : {}),
  };

  switch (readiness.derived_status) {
    case "ready_for_next_step":
      return {
        ...shared,
        attention_status: "clear",
        handoff_status: "ready_now",
      };
    case "in_progress":
      return {
        ...shared,
        attention_status: "monitoring",
        handoff_status: "blocked_by_in_progress",
      };
    case "waiting_for_follow_up":
      return {
        ...shared,
        attention_status: "monitoring",
        handoff_status: "blocked_by_follow_up",
      };
    case "attention_required":
      return {
        ...shared,
        attention_status: "action_required",
        handoff_status: "blocked_by_attention",
      };
    case "completed":
      return {
        ...shared,
        attention_status: "clear",
        handoff_status: "completed",
      };
  }
}

function deriveAttentionPackFromModule(
  readiness: ManuscriptMainlineReadinessSummaryRecord,
): MainlineSettlementModule | undefined {
  if (readiness.observation_status !== "reported" || !readiness.derived_status) {
    return undefined;
  }

  if (readiness.derived_status === "ready_for_next_step") {
    return derivePreviousMainlineModule(readiness.next_module);
  }

  if (readiness.derived_status === "completed") {
    return "proofreading";
  }

  return readiness.active_module;
}

function deriveAttentionPackToModule(
  readiness: ManuscriptMainlineReadinessSummaryRecord,
): MainlineSettlementModule | undefined {
  if (readiness.observation_status !== "reported" || !readiness.derived_status) {
    return undefined;
  }

  if (readiness.derived_status === "ready_for_next_step") {
    return readiness.next_module;
  }

  if (readiness.derived_status === "completed") {
    return undefined;
  }

  return deriveNextMainlineModule(readiness.active_module);
}

function derivePreviousMainlineModule(
  module?: MainlineSettlementModule,
): MainlineSettlementModule | undefined {
  if (!module) {
    return undefined;
  }

  const moduleIndex = MAINLINE_SETTLEMENT_MODULES.indexOf(module);
  if (moduleIndex <= 0) {
    return undefined;
  }

  return MAINLINE_SETTLEMENT_MODULES[moduleIndex - 1];
}

function deriveNextMainlineModule(
  module?: MainlineSettlementModule,
): MainlineSettlementModule | undefined {
  if (!module) {
    return undefined;
  }

  const moduleIndex = MAINLINE_SETTLEMENT_MODULES.indexOf(module);
  if (moduleIndex < 0 || moduleIndex === MAINLINE_SETTLEMENT_MODULES.length - 1) {
    return undefined;
  }

  return MAINLINE_SETTLEMENT_MODULES[moduleIndex + 1];
}

function selectLatestAttemptLedgerItemForModule(
  ledger: ManuscriptMainlineAttemptLedgerRecord,
  module: MainlineSettlementModule,
): MainlineAttemptLedgerItemRecord | undefined {
  if (ledger.observation_status !== "reported") {
    return undefined;
  }

  return ledger.items.find((item) => item.module === module);
}

function resolveAttentionPackEvidence(input: {
  overview: ModuleExecutionOverviewRecord;
  attemptLedgerItem?: MainlineAttemptLedgerItemRecord;
}): Pick<
  ManuscriptMainlineAttentionHandoffPackRecord,
  | "latest_job_id"
  | "latest_snapshot_id"
  | "recovery_ready_at"
  | "runtime_binding_status"
  | "runtime_binding_issue_count"
> {
  const runtimeBindingSummary = deriveModuleRuntimeBindingSummary(input.overview);

  return {
    latest_job_id: input.attemptLedgerItem?.job_id ?? input.overview.latest_job?.id,
    latest_snapshot_id:
      input.attemptLedgerItem?.snapshot_id ?? input.overview.latest_snapshot?.id,
    recovery_ready_at:
      input.attemptLedgerItem?.recovery_ready_at ??
      deriveModuleRecoveryReadyAt(input.overview),
    runtime_binding_status:
      input.attemptLedgerItem?.runtime_binding_status ??
      runtimeBindingSummary.runtime_binding_status,
    runtime_binding_issue_count:
      input.attemptLedgerItem?.runtime_binding_issue_count ??
      runtimeBindingSummary.runtime_binding_issue_count,
  };
}

function buildAttentionItemsForModule(input: {
  module: MainlineSettlementModule;
  overview: ModuleExecutionOverviewRecord;
  attemptLedgerItem?: MainlineAttemptLedgerItemRecord;
}): MainlineAttentionItemRecord[] {
  const items: MainlineAttentionItemRecord[] = [];
  const settlementItem = deriveSettlementAttentionItem(input);
  if (settlementItem) {
    items.push(settlementItem);
  }

  const runtimeItem = deriveRuntimeBindingAttentionItem(input);
  if (runtimeItem) {
    items.push(runtimeItem);
  }

  return items.slice(0, 3);
}

function deriveSettlementAttentionItem(input: {
  module: MainlineSettlementModule;
  overview: ModuleExecutionOverviewRecord;
  attemptLedgerItem?: MainlineAttemptLedgerItemRecord;
}): MainlineAttentionItemRecord | undefined {
  if (input.overview.observation_status !== "reported" || !input.overview.settlement) {
    return undefined;
  }

  const mapped = mapSettlementToAttentionItem(input.overview.settlement.derived_status);
  if (!mapped) {
    return undefined;
  }

  return {
    module: input.module,
    kind: mapped.kind,
    severity: mapped.severity,
    job_id: input.attemptLedgerItem?.job_id ?? input.overview.latest_job?.id,
    snapshot_id:
      input.attemptLedgerItem?.snapshot_id ?? input.overview.latest_snapshot?.id,
    recovery_ready_at:
      input.attemptLedgerItem?.recovery_ready_at ??
      deriveModuleRecoveryReadyAt(input.overview),
    summary: input.overview.settlement.reason,
  };
}

function deriveRuntimeBindingAttentionItem(input: {
  module: MainlineSettlementModule;
  overview: ModuleExecutionOverviewRecord;
  attemptLedgerItem?: MainlineAttemptLedgerItemRecord;
}): MainlineAttentionItemRecord | undefined {
  const runtimeBindingStatus =
    input.attemptLedgerItem?.runtime_binding_status ??
    deriveModuleRuntimeBindingSummary(input.overview).runtime_binding_status;
  const runtimeBindingIssueCount =
    input.attemptLedgerItem?.runtime_binding_issue_count ??
    deriveModuleRuntimeBindingSummary(input.overview).runtime_binding_issue_count;

  if (runtimeBindingStatus !== "degraded" && runtimeBindingStatus !== "missing") {
    return undefined;
  }

  return {
    module: input.module,
    kind:
      runtimeBindingStatus === "missing"
        ? "runtime_binding_missing"
        : "runtime_binding_degraded",
    severity:
      runtimeBindingStatus === "missing" ? "action_required" : "monitoring",
    job_id: input.attemptLedgerItem?.job_id ?? input.overview.latest_job?.id,
    snapshot_id:
      input.attemptLedgerItem?.snapshot_id ?? input.overview.latest_snapshot?.id,
    summary:
      runtimeBindingStatus === "missing"
        ? `Runtime binding readiness is missing${formatRuntimeIssueSuffix(runtimeBindingIssueCount)}.`
        : `Runtime binding readiness is degraded${formatRuntimeIssueSuffix(runtimeBindingIssueCount)}.`,
  };
}

function mapSettlementToAttentionItem(
  status: ModuleMainlineSettlementDerivedStatus,
):
  | {
      kind: MainlineAttentionItemKind;
      severity: MainlineAttentionItemSeverity;
    }
  | undefined {
  switch (status) {
    case "job_in_progress":
      return {
        kind: "job_in_progress",
        severity: "monitoring",
      };
    case "business_completed_follow_up_pending":
      return {
        kind: "follow_up_pending",
        severity: "monitoring",
      };
    case "business_completed_follow_up_running":
      return {
        kind: "follow_up_running",
        severity: "monitoring",
      };
    case "business_completed_follow_up_retryable":
      return {
        kind: "follow_up_retryable",
        severity: "action_required",
      };
    case "business_completed_follow_up_failed":
      return {
        kind: "follow_up_failed",
        severity: "action_required",
      };
    case "business_completed_unlinked":
      return {
        kind: "settlement_unlinked",
        severity: "action_required",
      };
    case "job_failed":
      return {
        kind: "job_failed",
        severity: "action_required",
      };
    case "business_completed_settled":
    case "not_started":
      return undefined;
  }
}

function formatRuntimeIssueSuffix(issueCount?: number): string {
  if (typeof issueCount !== "number") {
    return "";
  }

  return issueCount === 1 ? " (1 issue)" : ` (${issueCount} issues)`;
}
