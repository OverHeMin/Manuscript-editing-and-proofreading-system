create table if not exists agent_runtimes (
  id text primary key,
  name text not null,
  adapter text not null,
  status text not null,
  sandbox_profile_id text,
  allowed_modules module_type[] not null default '{}'::module_type[],
  runtime_slot text,
  admin_only boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_runtimes_adapter_check
    check (adapter in ('internal_prompt', 'deepagents')),
  constraint agent_runtimes_status_check
    check (status in ('draft', 'active', 'archived')),
  constraint agent_runtimes_admin_only_check
    check (admin_only = true)
);

create index if not exists agent_runtimes_status_adapter_runtime_slot_idx
  on agent_runtimes (status, adapter, runtime_slot, id);

create index if not exists agent_runtimes_allowed_modules_gin_idx
  on agent_runtimes using gin (allowed_modules);

create table if not exists tool_gateway_tools (
  id text primary key,
  name text not null,
  scope text not null,
  access_mode text not null,
  admin_only boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tool_gateway_tools_scope_check
    check (
      scope in (
        'manuscripts',
        'assets',
        'knowledge',
        'templates',
        'audit',
        'browser_qa',
        'benchmark',
        'deploy_verification'
      )
    ),
  constraint tool_gateway_tools_access_mode_check
    check (access_mode in ('read', 'write')),
  constraint tool_gateway_tools_admin_only_check
    check (admin_only = true)
);

create index if not exists tool_gateway_tools_scope_name_idx
  on tool_gateway_tools (scope, name, id);

create table if not exists sandbox_profiles (
  id text primary key,
  name text not null,
  status text not null,
  sandbox_mode text not null,
  network_access boolean not null,
  approval_required boolean not null,
  allowed_tool_ids text[],
  admin_only boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sandbox_profiles_status_check
    check (status in ('draft', 'active', 'archived')),
  constraint sandbox_profiles_sandbox_mode_check
    check (sandbox_mode in ('read_only', 'workspace_write', 'full_access')),
  constraint sandbox_profiles_admin_only_check
    check (admin_only = true)
);

create index if not exists sandbox_profiles_name_status_idx
  on sandbox_profiles (name, status, id);

create table if not exists agent_profiles (
  id text primary key,
  name text not null,
  role_key text not null,
  status text not null,
  module_scope module_type[],
  manuscript_types manuscript_type[],
  description text,
  admin_only boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_profiles_role_key_check
    check (role_key in ('superpowers', 'gstack', 'subagent')),
  constraint agent_profiles_status_check
    check (status in ('draft', 'published', 'archived')),
  constraint agent_profiles_admin_only_check
    check (admin_only = true)
);

create index if not exists agent_profiles_role_key_name_status_idx
  on agent_profiles (role_key, name, status, id);

create table if not exists tool_permission_policies (
  id text primary key,
  name text not null,
  status text not null,
  default_mode text not null,
  allowed_tool_ids text[] not null default '{}'::text[],
  high_risk_tool_ids text[],
  write_requires_confirmation boolean not null,
  admin_only boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tool_permission_policies_status_check
    check (status in ('draft', 'active', 'archived')),
  constraint tool_permission_policies_default_mode_check
    check (default_mode in ('read', 'write')),
  constraint tool_permission_policies_admin_only_check
    check (admin_only = true)
);

create index if not exists tool_permission_policies_name_status_idx
  on tool_permission_policies (name, status, id);

create table if not exists runtime_bindings (
  id text primary key,
  module module_type not null,
  manuscript_type manuscript_type not null,
  template_family_id text not null,
  runtime_id text not null,
  sandbox_profile_id text not null,
  agent_profile_id text not null,
  tool_permission_policy_id text not null,
  prompt_template_id text not null,
  skill_package_ids text[] not null default '{}'::text[],
  execution_profile_id text,
  verification_check_profile_ids text[] not null default '{}'::text[],
  evaluation_suite_ids text[] not null default '{}'::text[],
  release_check_profile_id text,
  status text not null,
  version integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint runtime_bindings_status_check
    check (status in ('draft', 'active', 'archived')),
  constraint runtime_bindings_version_check
    check (version > 0)
);

create unique index if not exists runtime_bindings_scope_version_uidx
  on runtime_bindings (module, manuscript_type, template_family_id, version);

create index if not exists runtime_bindings_scope_status_version_idx
  on runtime_bindings (module, manuscript_type, template_family_id, status, version, id);

create table if not exists agent_execution_logs (
  id text primary key,
  manuscript_id text not null,
  module module_type not null,
  triggered_by text not null,
  runtime_id text not null,
  sandbox_profile_id text not null,
  agent_profile_id text not null,
  runtime_binding_id text not null,
  tool_permission_policy_id text not null,
  execution_snapshot_id text,
  knowledge_item_ids text[] not null default '{}'::text[],
  verification_check_profile_ids text[] not null default '{}'::text[],
  evaluation_suite_ids text[] not null default '{}'::text[],
  release_check_profile_id text,
  verification_evidence_ids text[] not null default '{}'::text[],
  status text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  constraint agent_execution_logs_status_check
    check (status in ('queued', 'running', 'completed', 'failed'))
);

create index if not exists agent_execution_logs_manuscript_module_started_at_idx
  on agent_execution_logs (manuscript_id, module, started_at, id);
