do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'ai_provider_test_status'
  ) then
    create type ai_provider_test_status as enum (
      'unknown',
      'passed',
      'failed'
    );
  end if;
end
$$;

create table if not exists ai_provider_connections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  provider_kind text not null,
  compatibility_mode text not null,
  base_url text not null,
  enabled boolean not null default true,
  connection_metadata jsonb not null default '{}'::jsonb,
  last_test_status ai_provider_test_status not null default 'unknown',
  last_test_at timestamptz,
  last_error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_provider_connections_provider_kind_name_id_idx
  on ai_provider_connections (provider_kind asc, name asc, id asc);

create table if not exists ai_provider_credentials (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null,
  credential_ciphertext text not null,
  credential_mask text not null,
  credential_version integer not null default 1,
  last_rotated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_provider_credentials_connection_id_fkey
    foreign key (connection_id) references ai_provider_connections(id) on delete cascade,
  constraint ai_provider_credentials_connection_id_key unique (connection_id),
  constraint ai_provider_credentials_credential_version_check check (credential_version > 0)
);

alter table model_registry
  add column if not exists connection_id uuid;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'model_registry'
      and constraint_name = 'model_registry_connection_id_fkey'
  ) then
    alter table model_registry
      add constraint model_registry_connection_id_fkey
      foreign key (connection_id) references ai_provider_connections(id) on delete set null;
  end if;
end
$$;
