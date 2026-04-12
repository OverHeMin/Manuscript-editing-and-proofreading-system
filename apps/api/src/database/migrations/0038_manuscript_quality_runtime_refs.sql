alter table if exists runtime_bindings
  add column if not exists quality_package_version_ids text[] not null default '{}'::text[];

alter table if exists execution_snapshots
  add column if not exists quality_packages jsonb;
