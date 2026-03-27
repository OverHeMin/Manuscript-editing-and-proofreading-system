export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

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
