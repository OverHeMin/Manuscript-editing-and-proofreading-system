do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'knowledge_content_block_type'
  ) then
    create type knowledge_content_block_type as enum (
      'text_block',
      'table_block',
      'image_block'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'knowledge_content_block_status'
  ) then
    create type knowledge_content_block_status as enum (
      'active',
      'archived'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'knowledge_semantic_layer_status'
  ) then
    create type knowledge_semantic_layer_status as enum (
      'not_generated',
      'pending_confirmation',
      'confirmed',
      'stale'
    );
  end if;
end
$$;

create table if not exists knowledge_revision_content_blocks (
  id text primary key,
  revision_id text not null,
  block_type knowledge_content_block_type not null,
  order_no integer not null,
  status knowledge_content_block_status not null default 'active',
  content_payload jsonb not null default '{}'::jsonb,
  table_semantics jsonb,
  image_understanding jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_revision_content_blocks_revision_id_fkey
    foreign key (revision_id) references knowledge_revisions(id) on delete cascade,
  constraint knowledge_revision_content_blocks_revision_order_no_key
    unique (revision_id, order_no),
  constraint knowledge_revision_content_blocks_order_no_check
    check (order_no >= 0)
);

create index if not exists knowledge_revision_content_blocks_revision_id_order_no_idx
  on knowledge_revision_content_blocks (revision_id asc, order_no asc, id asc);

create index if not exists knowledge_revision_content_blocks_status_idx
  on knowledge_revision_content_blocks (status asc);

create index if not exists knowledge_revision_content_blocks_block_type_idx
  on knowledge_revision_content_blocks (block_type asc);

create table if not exists knowledge_semantic_layers (
  revision_id text primary key,
  status knowledge_semantic_layer_status not null default 'not_generated',
  page_summary text,
  retrieval_terms text[] not null default '{}'::text[],
  retrieval_snippets text[] not null default '{}'::text[],
  table_semantics jsonb,
  image_understanding jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_semantic_layers_revision_id_fkey
    foreign key (revision_id) references knowledge_revisions(id) on delete cascade
);

create index if not exists knowledge_semantic_layers_status_idx
  on knowledge_semantic_layers (status asc);
