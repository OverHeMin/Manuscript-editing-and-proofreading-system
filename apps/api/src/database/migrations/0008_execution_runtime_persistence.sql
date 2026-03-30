create table if not exists execution_profiles (
  id text primary key,
  module module_type not null,
  manuscript_type manuscript_type not null,
  template_family_id text not null,
  module_template_id text not null,
  prompt_template_id text not null,
  skill_package_ids text[] not null default '{}'::text[],
  knowledge_binding_mode text not null,
  status text not null,
  version integer not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint execution_profiles_knowledge_binding_mode_check
    check (knowledge_binding_mode in ('profile_only', 'profile_plus_dynamic')),
  constraint execution_profiles_status_check
    check (status in ('draft', 'active', 'archived')),
  constraint execution_profiles_version_check
    check (version > 0)
);

create unique index if not exists execution_profiles_scope_version_idx
  on execution_profiles (module, manuscript_type, template_family_id, version);

create index if not exists execution_profiles_module_manuscript_family_status_idx
  on execution_profiles (module, manuscript_type, template_family_id, status);

create table if not exists knowledge_binding_rules (
  id text primary key,
  knowledge_item_id text not null,
  module module_type not null,
  manuscript_types manuscript_type[],
  template_family_ids text[],
  module_template_ids text[],
  sections text[] not null default '{}'::text[],
  risk_tags text[] not null default '{}'::text[],
  priority integer not null default 0,
  binding_purpose text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_binding_rules_binding_purpose_check
    check (binding_purpose in ('required', 'recommended', 'risk_guardrail', 'section_specific')),
  constraint knowledge_binding_rules_status_check
    check (status in ('draft', 'active', 'archived'))
);

create index if not exists knowledge_binding_rules_module_status_priority_idx
  on knowledge_binding_rules (module, status, priority desc, id);

create table if not exists execution_snapshots (
  id text primary key,
  manuscript_id text not null,
  module module_type not null,
  job_id text not null,
  execution_profile_id text not null,
  module_template_id text not null,
  module_template_version_no integer not null,
  prompt_template_id text not null,
  prompt_template_version text not null,
  skill_package_ids text[] not null default '{}'::text[],
  skill_package_versions text[] not null default '{}'::text[],
  model_id text not null,
  model_version text,
  knowledge_item_ids text[] not null default '{}'::text[],
  created_asset_ids text[] not null default '{}'::text[],
  draft_snapshot_id text,
  created_at timestamptz not null default now()
);

create index if not exists execution_snapshots_manuscript_module_created_at_idx
  on execution_snapshots (manuscript_id, module, created_at, id);

create table if not exists knowledge_hit_logs (
  id text primary key,
  snapshot_id text not null,
  knowledge_item_id text not null,
  match_source_id text,
  binding_rule_id text,
  match_source text not null,
  match_reasons text[] not null default '{}'::text[],
  score double precision,
  section text,
  created_at timestamptz not null default now(),
  constraint knowledge_hit_logs_match_source_check
    check (match_source in ('binding_rule', 'template_binding', 'dynamic_routing', 'draft_snapshot_reuse'))
);

create index if not exists knowledge_hit_logs_snapshot_created_at_idx
  on knowledge_hit_logs (snapshot_id, created_at, id);
