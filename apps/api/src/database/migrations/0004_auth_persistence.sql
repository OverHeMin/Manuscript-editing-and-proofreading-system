do $$
begin
  if not exists (select 1 from pg_type where typname = 'auth_provider') then
    create type auth_provider as enum (
      'local',
      'ldap',
      'sso'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'user_status') then
    create type user_status as enum (
      'active',
      'disabled',
      'locked'
    );
  end if;
end
$$;

create table if not exists users (
  id text primary key,
  username text not null,
  display_name text not null,
  role_key text not null,
  password_hash text not null,
  status user_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_role_key_fkey
    foreign key (role_key) references roles(key) on delete restrict,
  constraint users_username_normalized_ck
    check (username = lower(username))
);

create table if not exists auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  provider auth_provider not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  refresh_at timestamptz not null,
  ip_address inet,
  user_agent text,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint auth_sessions_user_id_fkey
    foreign key (user_id) references users(id) on delete cascade
);

create table if not exists login_attempts (
  username text primary key,
  failure_count integer not null default 0,
  first_failed_at timestamptz not null,
  last_failed_at timestamptz not null,
  locked_until timestamptz,
  constraint login_attempts_username_normalized_ck
    check (username = lower(username))
);

create unique index if not exists users_username_idx
  on users (username);

create index if not exists auth_sessions_user_id_idx
  on auth_sessions (user_id);

create index if not exists auth_sessions_active_expires_at_idx
  on auth_sessions (expires_at)
  where revoked_at is null;
