create table if not exists model_routing_policies (
  singleton_key text primary key,
  system_default_model_id uuid,
  module_defaults jsonb not null default '{}'::jsonb,
  template_overrides jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint model_routing_policies_singleton_key_check
    check (singleton_key = 'default'),
  constraint model_routing_policies_system_default_model_id_fkey
    foreign key (system_default_model_id) references model_registry(id) on delete set null
);
