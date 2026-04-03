alter table if exists runtime_bindings
  add column if not exists verification_check_profile_ids text[] not null default '{}'::text[],
  add column if not exists evaluation_suite_ids text[] not null default '{}'::text[],
  add column if not exists release_check_profile_id text;

alter table if exists agent_execution_logs
  add column if not exists verification_check_profile_ids text[] not null default '{}'::text[],
  add column if not exists evaluation_suite_ids text[] not null default '{}'::text[],
  add column if not exists release_check_profile_id text;
