do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'table_evidence_source_kind'
  ) then
    create type table_evidence_source_kind as enum ('docx_upload');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'table_evidence_parser'
  ) then
    create type table_evidence_parser as enum ('python_docx_ooxml');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'table_evidence_fidelity_status'
  ) then
    create type table_evidence_fidelity_status as enum (
      'pending',
      'confirmed',
      'needs_review'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'table_evidence_confirmation_status'
  ) then
    create type table_evidence_confirmation_status as enum (
      'pending',
      'confirmed',
      'needs_review'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'table_evidence_binding_target_type'
  ) then
    create type table_evidence_binding_target_type as enum (
      'knowledge_revision',
      'editorial_rule',
      'rule_draft'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'table_evidence_binding_role'
  ) then
    create type table_evidence_binding_role as enum (
      'source_evidence',
      'example',
      'rule_basis',
      'format_requirement'
    );
  end if;
end
$$;

alter type knowledge_content_block_type add value if not exists 'table_evidence_block';

create table if not exists table_evidence_source_files (
  id text primary key,
  storage_key text not null,
  file_name text not null,
  mime_type text not null,
  byte_length integer not null,
  sha256 text not null,
  uploaded_by text not null,
  uploaded_at timestamptz not null default now(),
  constraint table_evidence_source_files_byte_length_check
    check (byte_length > 0)
);

create unique index if not exists table_evidence_source_files_sha256_file_name_key
  on table_evidence_source_files (sha256 asc, file_name asc);

create table if not exists table_evidence_assets (
  id text primary key,
  title text not null,
  source_file_asset_id text not null,
  source_file_name text not null,
  source_kind table_evidence_source_kind not null default 'docx_upload',
  parser table_evidence_parser not null default 'python_docx_ooxml',
  parser_version text not null,
  active_revision_id text,
  fidelity_status table_evidence_fidelity_status not null default 'pending',
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint table_evidence_assets_source_file_asset_id_fkey
    foreign key (source_file_asset_id)
    references table_evidence_source_files(id)
    on delete restrict
);

create table if not exists table_evidence_revisions (
  id text primary key,
  table_evidence_asset_id text not null,
  revision_no integer not null,
  source_snapshot jsonb not null,
  correction_patch jsonb not null,
  confirmed_snapshot jsonb,
  ai_table_package jsonb,
  fidelity_report jsonb not null,
  confirmation_status table_evidence_confirmation_status not null default 'pending',
  confirmed_by text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint table_evidence_revisions_asset_id_fkey
    foreign key (table_evidence_asset_id)
    references table_evidence_assets(id)
    on delete cascade,
  constraint table_evidence_revisions_asset_revision_no_key
    unique (table_evidence_asset_id, revision_no),
  constraint table_evidence_revisions_asset_id_id_key
    unique (table_evidence_asset_id, id),
  constraint table_evidence_revisions_revision_no_check
    check (revision_no > 0),
  constraint table_evidence_revisions_confirmed_payload_check
    check (
      confirmation_status <> 'confirmed'
      or (
        confirmed_snapshot is not null
        and ai_table_package is not null
        and confirmed_by is not null
        and confirmed_at is not null
      )
    )
);

alter table table_evidence_assets
  drop constraint if exists table_evidence_assets_active_revision_id_fkey;

alter table table_evidence_assets
  add constraint table_evidence_assets_active_revision_id_fkey
  foreign key (id, active_revision_id)
  references table_evidence_revisions(table_evidence_asset_id, id)
  on delete set null (active_revision_id);

create table if not exists table_evidence_bindings (
  id text primary key,
  table_evidence_asset_id text not null,
  table_evidence_revision_id text not null,
  target_type table_evidence_binding_target_type not null,
  target_id text not null,
  binding_role table_evidence_binding_role not null,
  created_at timestamptz not null default now(),
  constraint table_evidence_bindings_asset_id_fkey
    foreign key (table_evidence_asset_id)
    references table_evidence_assets(id)
    on delete cascade,
  constraint table_evidence_bindings_revision_id_fkey
    foreign key (table_evidence_revision_id)
    references table_evidence_revisions(id)
    on delete restrict,
  constraint table_evidence_bindings_asset_revision_id_fkey
    foreign key (table_evidence_asset_id, table_evidence_revision_id)
    references table_evidence_revisions(table_evidence_asset_id, id)
    on delete restrict,
  constraint table_evidence_bindings_target_revision_role_key
    unique (
      target_type,
      target_id,
      table_evidence_revision_id,
      binding_role
    )
);

create index if not exists table_evidence_assets_active_revision_idx
  on table_evidence_assets (active_revision_id asc);

create index if not exists table_evidence_assets_fidelity_status_idx
  on table_evidence_assets (fidelity_status asc, updated_at desc, id asc);

create index if not exists table_evidence_revisions_asset_created_idx
  on table_evidence_revisions (table_evidence_asset_id asc, created_at desc, id asc);

create index if not exists table_evidence_revisions_confirmation_idx
  on table_evidence_revisions (confirmation_status asc, created_at desc, id asc);

create index if not exists table_evidence_bindings_target_idx
  on table_evidence_bindings (target_type asc, target_id asc, created_at desc, id asc);

create index if not exists table_evidence_bindings_revision_idx
  on table_evidence_bindings (table_evidence_revision_id asc, created_at desc, id asc);
