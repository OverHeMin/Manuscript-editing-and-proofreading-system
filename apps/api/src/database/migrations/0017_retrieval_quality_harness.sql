create table if not exists knowledge_retrieval_index_entries (
  id uuid primary key default gen_random_uuid(),
  knowledge_item_id text not null,
  module module_type not null,
  manuscript_types manuscript_type[] not null default '{}'::manuscript_type[],
  template_family_id text,
  title text not null,
  source_text text not null,
  source_hash text not null,
  embedding_provider text not null,
  embedding_model text not null,
  embedding_dimensions integer not null,
  embedding_storage_backend text not null default 'double_precision_array',
  embedding_vector double precision[] not null default '{}'::double precision[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_retrieval_index_entries_embedding_dimensions_check
    check (embedding_dimensions > 0),
  constraint knowledge_retrieval_index_entries_embedding_storage_backend_check
    check (embedding_storage_backend in ('double_precision_array')),
  constraint knowledge_retrieval_index_entries_knowledge_item_source_hash_key
    unique (knowledge_item_id, source_hash)
);

create index if not exists knowledge_retrieval_index_entries_module_updated_at_idx
  on knowledge_retrieval_index_entries (module, updated_at desc);

create index if not exists knowledge_retrieval_index_entries_template_family_updated_at_idx
  on knowledge_retrieval_index_entries (template_family_id, updated_at desc);

create table if not exists knowledge_retrieval_snapshots (
  id uuid primary key default gen_random_uuid(),
  module module_type not null,
  manuscript_id text,
  manuscript_type manuscript_type,
  template_family_id text,
  query_text text not null,
  query_context jsonb not null default '{}'::jsonb,
  retriever_config jsonb not null default '{}'::jsonb,
  retrieved_items jsonb not null default '[]'::jsonb,
  reranked_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_retrieval_snapshots_module_created_at_idx
  on knowledge_retrieval_snapshots (module, created_at desc);

create index if not exists knowledge_retrieval_snapshots_template_family_created_at_idx
  on knowledge_retrieval_snapshots (template_family_id, created_at desc);

create table if not exists knowledge_retrieval_quality_runs (
  id uuid primary key default gen_random_uuid(),
  gold_set_version_id text not null,
  module module_type not null,
  template_family_id text,
  retrieval_snapshot_ids text[] not null default '{}'::text[],
  retriever_config jsonb not null default '{}'::jsonb,
  reranker_config jsonb,
  metric_summary jsonb not null default '{}'::jsonb,
  created_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_retrieval_quality_runs_gold_set_created_at_idx
  on knowledge_retrieval_quality_runs (gold_set_version_id, created_at desc);

create index if not exists knowledge_retrieval_quality_runs_module_template_created_at_idx
  on knowledge_retrieval_quality_runs (module, template_family_id, created_at desc);
