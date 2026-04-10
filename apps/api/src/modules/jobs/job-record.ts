export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type JobBatchLifecycleStatus =
  | "queued"
  | "running"
  | "completed"
  | "cancelled";

export type JobBatchSettlementStatus =
  | "in_progress"
  | "succeeded"
  | "partial_success"
  | "failed"
  | "cancelled";

export type JobBatchItemStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type JobBatchRestartPostureStatus =
  | "fresh"
  | "resumed_after_restart";

export interface JobBatchRestartPostureRecord {
  status: JobBatchRestartPostureStatus;
  reason: string;
  resumed_item_count?: number;
  observed_at: string;
}

export interface JobBatchItemRecord {
  item_id: string;
  title: string;
  file_name: string;
  manuscript_id: string;
  upload_job_id: string;
  status: JobBatchItemStatus;
  attempt_count: number;
  error_message?: string;
  resumed_after_restart?: boolean;
  updated_at: string;
}

export interface JobBatchStateRecord {
  items: JobBatchItemRecord[];
  restart_posture: JobBatchRestartPostureRecord;
}

export interface JobBatchProgressRecord {
  lifecycle_status: JobBatchLifecycleStatus;
  settlement_status: JobBatchSettlementStatus;
  total_count: number;
  queued_count: number;
  running_count: number;
  succeeded_count: number;
  failed_count: number;
  cancelled_count: number;
  remaining_count: number;
  restart_posture: JobBatchRestartPostureRecord;
  items: JobBatchItemRecord[];
}

export type ManuscriptModule =
  | "upload"
  | "screening"
  | "editing"
  | "proofreading"
  | "pdf_consistency"
  | "learning"
  | "manual";

export interface JobRecord {
  id: string;
  manuscript_id?: string;
  module: ManuscriptModule;
  job_type: string;
  status: JobStatus;
  requested_by: string;
  payload?: Record<string, unknown>;
  attempt_count: number;
  started_at?: string;
  finished_at?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface JobViewRecord extends JobRecord {
  execution_tracking: import("../manuscripts/manuscript-mainline-settlement.ts").JobExecutionTrackingObservationRecord;
  batch_progress?: JobBatchProgressRecord;
}
