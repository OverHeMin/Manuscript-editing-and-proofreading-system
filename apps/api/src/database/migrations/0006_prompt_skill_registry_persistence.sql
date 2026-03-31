do $$
begin
  if not exists (select 1 from pg_type where typname = 'registry_asset_status') then
    create type registry_asset_status as enum (
      'draft',
      'published',
      'archived'
    );
  end if;
end
$$;

create table if not exists prompt_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version text not null,
  status registry_asset_status not null default 'draft',
  module module_type not null,
  manuscript_types manuscript_type[],
  rollback_target_version text,
  source_learning_candidate_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prompt_templates_name_module_version_key
    unique (name, module, version),
  constraint prompt_templates_source_learning_candidate_id_fkey
    foreign key (source_learning_candidate_id) references learning_candidates(id) on delete set null
);

create table if not exists skill_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version text not null,
  scope text not null default 'admin_only',
  status registry_asset_status not null default 'draft',
  applies_to_modules module_type[] not null default '{}'::module_type[],
  dependency_tools text[] not null default '{}'::text[],
  source_learning_candidate_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint skill_packages_name_version_key
    unique (name, version),
  constraint skill_packages_scope_check
    check (scope = 'admin_only'),
  constraint skill_packages_source_learning_candidate_id_fkey
    foreign key (source_learning_candidate_id) references learning_candidates(id) on delete set null
);

create index if not exists prompt_templates_module_name_status_idx
  on prompt_templates (module, name, status);

create index if not exists skill_packages_name_status_idx
  on skill_packages (name, status);
