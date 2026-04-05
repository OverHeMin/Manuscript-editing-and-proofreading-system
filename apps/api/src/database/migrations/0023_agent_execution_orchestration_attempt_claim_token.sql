alter table if exists agent_execution_logs
  add column if not exists orchestration_attempt_claim_token text;
