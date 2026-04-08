alter table editorial_rules
  add column if not exists explanation_payload jsonb not null default '{}'::jsonb,
  add column if not exists linkage_payload jsonb not null default '{}'::jsonb,
  add column if not exists projection_payload jsonb not null default '{}'::jsonb;

alter table learning_candidates
  add column if not exists candidate_payload jsonb not null default '{}'::jsonb,
  add column if not exists suggested_rule_object text,
  add column if not exists suggested_template_family_id uuid,
  add column if not exists suggested_journal_template_id uuid;

do $$
begin
  if exists (
    select 1
    from pg_type
    where typname = 'learning_writeback_target'
  ) then
    alter type learning_writeback_target
      add value if not exists 'editorial_rule_draft';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'learning_candidates_suggested_journal_requires_family_check'
  ) then
    alter table learning_candidates
      add constraint learning_candidates_suggested_journal_requires_family_check
      check (
        suggested_journal_template_id is null
        or suggested_template_family_id is not null
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'learning_candidates_suggested_template_family_id_fkey'
  ) then
    alter table learning_candidates
      add constraint learning_candidates_suggested_template_family_id_fkey
      foreign key (suggested_template_family_id)
      references template_families(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'learning_candidates_suggested_family_journal_template_id_fkey'
  ) then
    alter table learning_candidates
      add constraint learning_candidates_suggested_family_journal_template_id_fkey
      foreign key (suggested_template_family_id, suggested_journal_template_id)
      references journal_template_profiles(template_family_id, id)
      on delete set null;
  end if;
end
$$;

create index if not exists learning_candidates_status_type_updated_at_idx
  on learning_candidates (status, type, updated_at desc, id);
