create table if not exists manuscript_quality_package_versions (
  id text primary key,
  package_name text not null,
  package_kind text not null,
  target_scopes text[] not null default '{}'::text[],
  version integer not null,
  status text not null,
  manifest jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manuscript_quality_package_versions_kind_check
    check (
      package_kind in ('general_style_package', 'medical_analyzer_package')
    ),
  constraint manuscript_quality_package_versions_status_check
    check (status in ('draft', 'published', 'archived')),
  constraint manuscript_quality_package_versions_version_check
    check (version > 0)
);

create unique index if not exists manuscript_quality_package_versions_scope_version_uidx
  on manuscript_quality_package_versions (package_kind, package_name, target_scopes, version);

create index if not exists manuscript_quality_package_versions_scope_status_idx
  on manuscript_quality_package_versions (package_kind, status, package_name, version, id);

create index if not exists manuscript_quality_package_versions_target_scopes_gin_idx
  on manuscript_quality_package_versions using gin (target_scopes);
