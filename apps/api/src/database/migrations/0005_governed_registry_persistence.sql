do $$
begin
  if not exists (select 1 from pg_type where typname = 'knowledge_review_action') then
    create type knowledge_review_action as enum (
      'submitted_for_review',
      'approved',
      'rejected'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'learning_writeback_target') then
    create type learning_writeback_target as enum (
      'knowledge_item',
      'module_template',
      'prompt_template',
      'skill_package'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'learning_writeback_status') then
    create type learning_writeback_status as enum (
      'draft',
      'applied',
      'archived'
    );
  end if;
end
$$;

alter table knowledge_items
  add column if not exists source_learning_candidate_id uuid;

alter table module_templates
  add column if not exists source_learning_candidate_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'knowledge_items_source_learning_candidate_id_fkey'
  ) then
    alter table knowledge_items
      add constraint knowledge_items_source_learning_candidate_id_fkey
      foreign key (source_learning_candidate_id)
      references learning_candidates(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'module_templates_source_learning_candidate_id_fkey'
  ) then
    alter table module_templates
      add constraint module_templates_source_learning_candidate_id_fkey
      foreign key (source_learning_candidate_id)
      references learning_candidates(id)
      on delete set null;
  end if;
end
$$;

create table if not exists knowledge_review_actions (
  id uuid primary key default gen_random_uuid(),
  knowledge_item_id uuid not null,
  action knowledge_review_action not null,
  actor_role text not null,
  review_note text,
  created_at timestamptz not null default now(),
  constraint knowledge_review_actions_knowledge_item_id_fkey
    foreign key (knowledge_item_id) references knowledge_items(id) on delete cascade,
  constraint knowledge_review_actions_actor_role_fkey
    foreign key (actor_role) references roles(key) on delete restrict
);

create table if not exists learning_writebacks (
  id uuid primary key default gen_random_uuid(),
  learning_candidate_id uuid not null,
  target_type learning_writeback_target not null,
  status learning_writeback_status not null default 'draft',
  created_draft_asset_id text,
  created_by text not null,
  created_at timestamptz not null default now(),
  applied_by text,
  applied_at timestamptz,
  constraint learning_writebacks_learning_candidate_id_fkey
    foreign key (learning_candidate_id) references learning_candidates(id) on delete cascade
);

create index if not exists knowledge_review_actions_knowledge_item_id_created_at_idx
  on knowledge_review_actions (knowledge_item_id, created_at);

create index if not exists learning_writebacks_candidate_target_status_idx
  on learning_writebacks (learning_candidate_id, target_type, status);

create index if not exists module_templates_template_family_id_module_status_idx
  on module_templates (template_family_id, module, status);
