alter table execution_snapshots
  add column if not exists agent_execution_log_id text;
