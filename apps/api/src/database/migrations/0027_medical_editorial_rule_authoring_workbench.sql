create table if not exists journal_template_profiles (
  id uuid primary key default gen_random_uuid(),
  template_family_id uuid not null references template_families(id) on delete cascade,
  journal_key text not null,
  journal_name text not null,
  status template_family_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journal_template_profiles_template_family_journal_key_key
    unique (template_family_id, journal_key)
);

create index if not exists journal_template_profiles_template_family_status_idx
  on journal_template_profiles (template_family_id, status);

create unique index if not exists journal_template_profiles_family_id_uidx
  on journal_template_profiles (template_family_id, id);

alter table manuscripts
  add column if not exists current_journal_template_id uuid;

alter table editorial_rule_sets
  add column if not exists journal_template_id uuid;

alter table editorial_rules
  add column if not exists rule_object text not null default 'generic',
  add column if not exists selector jsonb not null default '{}'::jsonb,
  add column if not exists authoring_payload jsonb not null default '{}'::jsonb,
  add column if not exists evidence_level evidence_level;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'editorial_rule_sets_template_family_module_version_key'
  ) then
    alter table editorial_rule_sets
      drop constraint editorial_rule_sets_template_family_module_version_key;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'editorial_rule_sets_family_journal_module_version_key'
  ) then
    alter table editorial_rule_sets
      add constraint editorial_rule_sets_family_journal_module_version_key
      unique (template_family_id, journal_template_id, module, version_no);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'manuscripts_current_journal_template_family_match_check'
  ) then
    alter table manuscripts
      add constraint manuscripts_current_journal_template_family_match_check
      check (
        current_journal_template_id is null
        or current_template_family_id is not null
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'manuscripts_current_family_journal_template_id_fkey'
  ) then
    alter table manuscripts
      add constraint manuscripts_current_family_journal_template_id_fkey
      foreign key (current_template_family_id, current_journal_template_id)
      references journal_template_profiles(template_family_id, id)
      on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'editorial_rule_sets_family_journal_template_id_fkey'
  ) then
    alter table editorial_rule_sets
      add constraint editorial_rule_sets_family_journal_template_id_fkey
      foreign key (template_family_id, journal_template_id)
      references journal_template_profiles(template_family_id, id)
      on delete restrict;
  end if;
end
$$;

create index if not exists manuscripts_current_journal_template_id_idx
  on manuscripts (current_journal_template_id);

create unique index if not exists editorial_rule_sets_base_scope_version_uidx
  on editorial_rule_sets (template_family_id, module, version_no)
  where journal_template_id is null;

create index if not exists editorial_rule_sets_journal_template_module_status_idx
  on editorial_rule_sets (journal_template_id, module, status);
