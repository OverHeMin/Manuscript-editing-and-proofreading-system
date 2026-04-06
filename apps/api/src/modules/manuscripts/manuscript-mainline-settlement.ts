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
