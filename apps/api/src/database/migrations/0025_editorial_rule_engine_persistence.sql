alter table prompt_templates
  add column if not exists template_kind text,
  add column if not exists system_instructions text,
  add column if not exists task_frame text,
  add column if not exists hard_rule_summary text,
  add column if not exists allowed_content_operations text[] not null default '{}'::text[],
  add column if not exists forbidden_operations text[] not null default '{}'::text[],
  add column if not exists manual_review_policy text,
  add column if not exists output_contract text,
  add column if not exists report_style text;

alter table execution_profiles
  add column if not exists rule_set_id text;

alter table knowledge_items
  add column if not exists projection_source jsonb;

create table if not exists editorial_rule_sets (
  id uuid primary key default gen_random_uuid(),
  template_family_id uuid not null references template_families(id) on delete cascade,
  module module_type not null,
  version_no integer not null,
  status registry_asset_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint editorial_rule_sets_template_family_module_version_key
    unique (template_family_id, module, version_no)
);

create table if not exists editorial_rules (
  id uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references editorial_rule_sets(id) on delete cascade,
  order_no integer not null,
  rule_type text not null,
  execution_mode text not null,
  scope jsonb not null default '{}'::jsonb,
  trigger jsonb not null default '{}'::jsonb,
  action jsonb not null default '{}'::jsonb,
  confidence_policy text not null,
  severity text not null,
  enabled boolean not null default true,
  example_before text,
  example_after text,
  manual_review_reason_template text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint editorial_rules_rule_set_order_no_key
    unique (rule_set_id, order_no)
);

create index if not exists editorial_rule_sets_template_family_module_status_idx
  on editorial_rule_sets (template_family_id, module, status);

create index if not exists editorial_rules_rule_set_order_idx
  on editorial_rules (rule_set_id, order_no);
