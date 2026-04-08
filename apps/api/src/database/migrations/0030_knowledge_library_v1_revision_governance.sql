do $$
begin
  if not exists (select 1 from pg_type where typname = 'knowledge_asset_status') then
    create type knowledge_asset_status as enum (
      'active',
      'archived'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'knowledge_revision_status') then
    create type knowledge_revision_status as enum (
      'draft',
      'pending_review',
      'approved',
      'superseded',
      'archived'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'knowledge_revision_binding_kind') then
    create type knowledge_revision_binding_kind as enum (
      'template_family',
      'module_template',
      'section',
      'journal_template'
    );
  end if;
end
$$;

create table if not exists knowledge_assets (
  id text primary key,
  status knowledge_asset_status not null default 'active',
  current_revision_id text,
  current_approved_revision_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knowledge_revisions (
  id text primary key,
  asset_id text not null,
  revision_no integer not null,
  status knowledge_revision_status not null default 'draft',
  title text not null,
  canonical_text text not null,
  summary text,
  knowledge_kind knowledge_kind not null,
  module_scope manuscript_module_scope not null,
  manuscript_types manuscript_type[] not null default '{}'::manuscript_type[],
  sections text[] not null default '{}'::text[],
  risk_tags text[] not null default '{}'::text[],
  discipline_tags text[] not null default '{}'::text[],
  evidence_level evidence_level,
  source_type knowledge_source_type,
  source_link text,
  effective_at timestamptz,
  expires_at timestamptz,
  aliases text[] not null default '{}'::text[],
  source_learning_candidate_id uuid,
  projection_source jsonb,
  based_on_revision_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_revisions_asset_id_fkey
    foreign key (asset_id) references knowledge_assets(id) on delete cascade,
  constraint knowledge_revisions_source_learning_candidate_id_fkey
    foreign key (source_learning_candidate_id) references learning_candidates(id) on delete set null,
  constraint knowledge_revisions_asset_id_revision_no_key
    unique (asset_id, revision_no)
);

create table if not exists knowledge_revision_bindings (
  id text primary key,
  revision_id text not null,
  binding_kind knowledge_revision_binding_kind not null,
  binding_target_id text not null,
  binding_target_label text not null,
  created_at timestamptz not null default now(),
  constraint knowledge_revision_bindings_revision_id_fkey
    foreign key (revision_id) references knowledge_revisions(id) on delete cascade
);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'knowledge_review_actions_knowledge_item_id_fkey'
  ) then
    alter table knowledge_review_actions
      drop constraint knowledge_review_actions_knowledge_item_id_fkey;
  end if;
end
$$;

alter table knowledge_review_actions
  alter column knowledge_item_id type text using knowledge_item_id::text;

alter table knowledge_review_actions
  add column if not exists revision_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'knowledge_review_actions_revision_id_fkey'
  ) then
    alter table knowledge_review_actions
      add constraint knowledge_review_actions_revision_id_fkey
      foreign key (revision_id) references knowledge_revisions(id) on delete set null;
  end if;
end
$$;

create index if not exists knowledge_assets_status_updated_at_idx
  on knowledge_assets (status, updated_at desc, id);

create index if not exists knowledge_assets_current_approved_revision_id_idx
  on knowledge_assets (current_approved_revision_id);

create index if not exists knowledge_revisions_asset_revision_no_idx
  on knowledge_revisions (asset_id, revision_no desc, id desc);

create index if not exists knowledge_revisions_status_updated_at_idx
  on knowledge_revisions (status, updated_at desc, id);

create index if not exists knowledge_revisions_asset_status_updated_at_idx
  on knowledge_revisions (asset_id, status, updated_at desc, id);

create index if not exists knowledge_revision_bindings_revision_id_created_at_idx
  on knowledge_revision_bindings (revision_id, created_at, id);

create index if not exists knowledge_review_actions_revision_id_created_at_idx
  on knowledge_review_actions (revision_id, created_at, id);
