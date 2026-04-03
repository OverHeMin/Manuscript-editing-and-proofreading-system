alter table if exists evaluation_runs
  add column if not exists governed_source jsonb;
