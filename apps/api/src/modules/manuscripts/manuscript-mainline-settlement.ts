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
