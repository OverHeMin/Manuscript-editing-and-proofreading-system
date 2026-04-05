alter table if exists agent_execution_logs
  add column if not exists orchestration_status text not null default 'not_required',
  add column if not exists orchestration_attempt_count integer not null default 0,
  add column if not exists orchestration_max_attempts integer not null default 3,
  add column if not exists orchestration_last_error text,
  add column if not exists orchestration_last_attempt_started_at timestamptz,
  add column if not exists orchestration_last_attempt_finished_at timestamptz;

alter table if exists agent_execution_logs
  drop constraint if exists agent_execution_logs_orchestration_status_check;

alter table if exists agent_execution_logs
  add constraint agent_execution_logs_orchestration_status_check
    check (
      orchestration_status in (
        'not_required',
        'pending',
        'running',
        'retryable',
        'completed',
        'failed'
      )
    );

alter table if exists agent_execution_logs
  drop constraint if exists agent_execution_logs_orchestration_attempt_count_check;

alter table if exists agent_execution_logs
  add constraint agent_execution_logs_orchestration_attempt_count_check
    check (orchestration_attempt_count >= 0);

alter table if exists agent_execution_logs
  drop constraint if exists agent_execution_logs_orchestration_max_attempts_check;

alter table if exists agent_execution_logs
  add constraint agent_execution_logs_orchestration_max_attempts_check
    check (orchestration_max_attempts > 0);
