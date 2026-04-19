do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'governed_hit_feedback_category'
  ) then
    create type governed_hit_feedback_category as enum (
      'missed_hit',
      'incorrect_hit',
      'missing_knowledge'
    );
  end if;

  if not exists (
    select 1 from pg_type where typname = 'governed_hit_review_item_status'
  ) then
    create type governed_hit_review_item_status as enum (
      'submitted',
      'accepted_change_only',
      'rejected_as_false_positive',
      'routed_rule_candidate',
      'routed_knowledge_candidate',
      'routed_prompt_candidate',
      'archived_as_evidence_only'
    );
  end if;

  if not exists (
    select 1 from pg_type where typname = 'review_item_review_status'
  ) then
    create type review_item_review_status as enum (
      'pending',
      'decided',
      'routed'
    );
  end if;

  if not exists (
    select 1 from pg_type where typname = 'governed_hit_review_route'
  ) then
    create type governed_hit_review_route as enum (
      'rule_candidate',
      'knowledge_candidate',
      'prompt_template_candidate'
    );
  end if;
end
$$;

create table if not exists governed_hit_review_items (
  id text primary key,
  source_status governed_hit_review_item_status not null default 'submitted',
  review_status review_item_review_status not null default 'pending',
  module module_type not null,
  manuscript_id uuid,
  manuscript_type manuscript_type not null,
  snapshot_id text not null,
  source_asset_id uuid,
  title text not null,
  summary text,
  excerpt text,
  location jsonb not null default '{}'::jsonb,
  risk_level residual_issue_risk_level,
  suggestion text,
  rationale text,
  related_rule_ids text[] not null default '{}'::text[],
  related_knowledge_item_ids text[] not null default '{}'::text[],
  feedback_category governed_hit_feedback_category not null,
  feedback_record_id uuid not null,
  recommended_route governed_hit_review_route not null,
  learning_candidate_id uuid,
  origin_payload jsonb not null default '{}'::jsonb,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint governed_hit_review_items_manuscript_id_fkey
    foreign key (manuscript_id) references manuscripts(id) on delete cascade,
  constraint governed_hit_review_items_snapshot_id_fkey
    foreign key (snapshot_id) references execution_snapshots(id) on delete cascade,
  constraint governed_hit_review_items_source_asset_id_fkey
    foreign key (source_asset_id) references document_assets(id) on delete set null,
  constraint governed_hit_review_items_feedback_record_id_fkey
    foreign key (feedback_record_id) references human_feedback_records(id) on delete restrict,
  constraint governed_hit_review_items_learning_candidate_id_fkey
    foreign key (learning_candidate_id) references learning_candidates(id) on delete set null
);

create index if not exists governed_hit_review_items_snapshot_created_at_idx
  on governed_hit_review_items (snapshot_id, created_at desc, id);

create index if not exists governed_hit_review_items_review_status_updated_at_idx
  on governed_hit_review_items (review_status, updated_at desc, id);

create index if not exists governed_hit_review_items_route_review_status_updated_at_idx
  on governed_hit_review_items (
    recommended_route,
    review_status,
    updated_at desc,
    id
  );

create index if not exists governed_hit_review_items_feedback_record_id_idx
  on governed_hit_review_items (feedback_record_id);
