create table if not exists human_review_diff_items (
  id uuid primary key default gen_random_uuid(),
  module text not null check (
    module in ('proofreading', 'editing', 'screening_reserved')
  ),
  manuscript_id uuid not null,
  baseline_asset_id uuid not null,
  working_asset_id uuid not null,
  final_asset_id uuid,
  source text not null check (
    source in (
      'ai_suggestion',
      'human_added',
      'human_overrode_ai',
      'human_reverted_ai'
    )
  ),
  content_decision text not null check (
    content_decision in ('unconfirmed', 'keep', 'reject', 'defer')
  ),
  governance_intents jsonb not null default
    '{"rule_candidate": false, "knowledge_candidate": false}'::jsonb,
  apply_capability text not null check (
    apply_capability in (
      'auto_apply_revert',
      'keep_only_no_safe_revert',
      'unsafe_needs_manual_review'
    )
  ),
  complexity_flags jsonb not null default '[]'::jsonb,
  status text not null check (
    status in (
      'pending',
      'confirmed',
      'blocks_publish',
      'published_writeback_done',
      'writeback_failed',
      'stale_after_reextract'
    )
  ),
  before_text text,
  after_text text,
  summary text,
  location jsonb,
  note text,
  extraction_revision integer,
  backflow_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint human_review_diff_items_manuscript_id_fkey
    foreign key (manuscript_id) references manuscripts(id) on delete cascade,
  constraint human_review_diff_items_baseline_asset_id_fkey
    foreign key (baseline_asset_id) references document_assets(id) on delete restrict,
  constraint human_review_diff_items_working_asset_id_fkey
    foreign key (working_asset_id) references document_assets(id) on delete restrict,
  constraint human_review_diff_items_final_asset_id_fkey
    foreign key (final_asset_id) references document_assets(id) on delete set null
);

create table if not exists human_review_backflow_attempts (
  id uuid primary key default gen_random_uuid(),
  diff_item_id uuid not null,
  target text not null check (target in ('rule_candidate', 'knowledge_candidate')),
  status text not null check (status in ('pending', 'succeeded', 'failed')),
  learning_candidate_id uuid,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint human_review_backflow_attempts_diff_item_id_fkey
    foreign key (diff_item_id) references human_review_diff_items(id) on delete cascade,
  constraint human_review_backflow_attempts_learning_candidate_id_fkey
    foreign key (learning_candidate_id) references learning_candidates(id) on delete set null,
  constraint human_review_backflow_attempts_diff_target_unique
    unique (diff_item_id, target)
);

create index if not exists human_review_diff_items_manuscript_id_idx
  on human_review_diff_items (manuscript_id);

create index if not exists human_review_diff_items_manuscript_module_idx
  on human_review_diff_items (manuscript_id, module);

create index if not exists human_review_diff_items_working_asset_id_idx
  on human_review_diff_items (working_asset_id);

create index if not exists human_review_diff_items_final_asset_id_idx
  on human_review_diff_items (final_asset_id);

create index if not exists human_review_diff_items_status_idx
  on human_review_diff_items (status);

create index if not exists human_review_backflow_attempts_diff_item_id_idx
  on human_review_backflow_attempts (diff_item_id);

create index if not exists human_review_backflow_attempts_status_idx
  on human_review_backflow_attempts (status);
