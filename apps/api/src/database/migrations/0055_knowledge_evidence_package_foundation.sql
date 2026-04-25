do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'knowledge_evidence_package_status'
  ) then
    create type knowledge_evidence_package_status as enum (
      'raw',
      'captured',
      'non_authoritative',
      'authoritative',
      'linked_to_rule',
      'retired'
    );
  end if;

  if not exists (
    select 1 from pg_type where typname = 'knowledge_evidence_package_kind'
  ) then
    create type knowledge_evidence_package_kind as enum (
      'official_guideline_text',
      'official_sample_screenshot',
      'word_sample_table',
      'wps_sample_table',
      'docx_sample_table',
      'correct_example',
      'incorrect_example',
      'object_symbol_sample',
      'journal_article_example',
      'operator_annotation'
    );
  end if;

  if not exists (
    select 1 from pg_type where typname = 'knowledge_evidence_authority_level'
  ) then
    create type knowledge_evidence_authority_level as enum (
      'official_journal_guideline',
      'official_journal_sample',
      'journal_published_recent_article',
      'institutional_editorial_standard',
      'operator_curated_experience'
    );
  end if;
end
$$;

alter type knowledge_revision_binding_kind add value if not exists 'target_model_block';

create table if not exists knowledge_evidence_packages (
  id text primary key,
  knowledge_item_id text not null,
  revision_id text,
  status knowledge_evidence_package_status not null default 'raw',
  evidence_kind knowledge_evidence_package_kind not null,
  authority_level knowledge_evidence_authority_level not null,
  source_label text not null,
  source_payload jsonb not null default '{}'::jsonb,
  binding_targets jsonb,
  linked_rule_ids text[] not null default '{}'::text[],
  linked_target_model_block_ids text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_evidence_packages_revision_id_fkey
    foreign key (revision_id) references knowledge_revisions(id) on delete set null
);

create index if not exists knowledge_evidence_packages_knowledge_item_status_idx
  on knowledge_evidence_packages (knowledge_item_id, status, created_at desc, id);

create index if not exists knowledge_evidence_packages_revision_id_idx
  on knowledge_evidence_packages (revision_id);
