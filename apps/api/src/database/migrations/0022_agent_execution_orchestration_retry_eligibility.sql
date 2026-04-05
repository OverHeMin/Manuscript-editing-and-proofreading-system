alter table if exists agent_execution_logs
  add column if not exists orchestration_next_retry_at timestamptz;
