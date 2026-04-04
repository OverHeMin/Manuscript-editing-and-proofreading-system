alter table if exists agent_execution_logs
  add column if not exists routing_policy_version_id uuid,
  add column if not exists routing_policy_scope_kind text,
  add column if not exists routing_policy_scope_value text,
  add column if not exists resolved_model_id uuid,
  add column if not exists fallback_model_id uuid,
  add column if not exists fallback_trigger text;
