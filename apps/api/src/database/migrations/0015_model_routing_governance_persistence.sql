create table if not exists model_routing_policy_scopes (
  id uuid primary key default gen_random_uuid(),
  scope_kind text not null,
  scope_value text not null,
  active_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint model_routing_policy_scopes_scope_kind_check
    check (scope_kind in ('module', 'template_family')),
  constraint model_routing_policy_scopes_scope_kind_scope_value_key
    unique (scope_kind, scope_value)
);

create table if not exists model_routing_policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_scope_id uuid not null,
  version_no integer not null,
  primary_model_id uuid not null,
  fallback_model_ids uuid[] not null default '{}'::uuid[],
  evidence_links jsonb not null default '[]'::jsonb,
  notes text,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint model_routing_policy_versions_policy_scope_id_fkey
    foreign key (policy_scope_id) references model_routing_policy_scopes(id) on delete cascade,
  constraint model_routing_policy_versions_primary_model_id_fkey
    foreign key (primary_model_id) references model_registry(id) on delete restrict,
  constraint model_routing_policy_versions_version_no_check
    check (version_no > 0),
  constraint model_routing_policy_versions_status_check
    check (
      status in (
        'draft',
        'pending_review',
        'approved',
        'active',
        'rejected',
        'rolled_back',
        'superseded'
      )
    ),
  constraint model_routing_policy_versions_policy_scope_id_version_no_key
    unique (policy_scope_id, version_no)
);

create index if not exists model_routing_policy_versions_policy_scope_status_version_idx
  on model_routing_policy_versions (policy_scope_id, status, version_no desc);

create unique index if not exists model_routing_policy_versions_active_policy_scope_uidx
  on model_routing_policy_versions (policy_scope_id)
  where status = 'active';

create table if not exists model_routing_policy_decisions (
  id uuid primary key default gen_random_uuid(),
  policy_scope_id uuid not null,
  policy_version_id uuid not null,
  decision_kind text not null,
  actor_id text,
  actor_role text,
  reason text,
  evidence_links jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint model_routing_policy_decisions_policy_scope_id_fkey
    foreign key (policy_scope_id) references model_routing_policy_scopes(id) on delete cascade,
  constraint model_routing_policy_decisions_policy_version_id_fkey
    foreign key (policy_version_id) references model_routing_policy_versions(id) on delete cascade,
  constraint model_routing_policy_decisions_decision_kind_check
    check (
      decision_kind in (
        'create_draft',
        'update_draft',
        'submit_for_review',
        'approve',
        'reject',
        'activate',
        'rollback',
        'supersede'
      )
    )
);

create index if not exists model_routing_policy_decisions_policy_scope_created_at_idx
  on model_routing_policy_decisions (policy_scope_id, created_at asc);

alter table if exists model_routing_policy_scopes
  add constraint model_routing_policy_scopes_active_version_id_fkey
    foreign key (active_version_id) references model_routing_policy_versions(id) on delete set null;
