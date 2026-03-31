do $$
begin
  if exists (select 1 from pg_type where typname = 'learning_candidate_type') then
    begin
      alter type learning_candidate_type add value if not exists 'skill_update_candidate';
    exception
      when duplicate_object then null;
    end;
  end if;

  if not exists (select 1 from pg_type where typname = 'human_feedback_type') then
    create type human_feedback_type as enum (
      'manual_confirmation',
      'manual_correction',
      'manual_rejection'
    );
  end if;

  if not exists (
    select 1 from pg_type where typname = 'learning_candidate_source_kind'
  ) then
    create type learning_candidate_source_kind as enum (
      'human_feedback',
      'evaluation_experiment'
    );
  end if;

  if not exists (
    select 1 from pg_type where typname = 'learning_candidate_snapshot_kind'
  ) then
    create type learning_candidate_snapshot_kind as enum (
      'execution_snapshot',
      'reviewed_case_snapshot'
    );
  end if;
end
$$;

alter table learning_candidates
  add column if not exists governed_provenance_kind learning_candidate_source_kind,
  add column if not exists governed_feedback_record_id text,
  add column if not exists governed_evaluation_run_id text,
  add column if not exists governed_evidence_pack_id text,
  add column if not exists created_by text;

update learning_candidates
set created_by = coalesce(created_by, 'system-migration')
where created_by is null;

alter table learning_candidates
  alter column created_by set not null;

create table if not exists reviewed_case_snapshots (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null,
  module manuscript_module not null,
  manuscript_type manuscript_type not null,
  human_final_asset_id uuid not null,
  deidentification_passed boolean not null,
  annotated_asset_id uuid,
  snapshot_asset_id uuid not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  constraint reviewed_case_snapshots_manuscript_id_fkey
    foreign key (manuscript_id) references manuscripts(id) on delete cascade,
  constraint reviewed_case_snapshots_human_final_asset_id_fkey
    foreign key (human_final_asset_id) references document_assets(id) on delete restrict,
  constraint reviewed_case_snapshots_annotated_asset_id_fkey
    foreign key (annotated_asset_id) references document_assets(id) on delete set null,
  constraint reviewed_case_snapshots_snapshot_asset_id_fkey
    foreign key (snapshot_asset_id) references document_assets(id) on delete restrict
);

create table if not exists human_feedback_records (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null,
  module manuscript_module not null,
  snapshot_id text not null,
  feedback_type human_feedback_type not null,
  feedback_text text,
  created_by text not null,
  created_at timestamptz not null default now(),
  constraint human_feedback_records_manuscript_id_fkey
    foreign key (manuscript_id) references manuscripts(id) on delete cascade,
  constraint human_feedback_records_snapshot_id_fkey
    foreign key (snapshot_id) references execution_snapshots(id) on delete cascade
);

create table if not exists learning_candidate_source_links (
  id uuid primary key default gen_random_uuid(),
  learning_candidate_id uuid not null,
  source_kind learning_candidate_source_kind not null,
  snapshot_kind learning_candidate_snapshot_kind not null,
  snapshot_id text not null,
  feedback_record_id uuid,
  evaluation_run_id text,
  evidence_pack_id text,
  source_asset_id uuid not null,
  created_at timestamptz not null default now(),
  constraint learning_candidate_source_links_learning_candidate_id_fkey
    foreign key (learning_candidate_id) references learning_candidates(id) on delete cascade,
  constraint learning_candidate_source_links_feedback_record_id_fkey
    foreign key (feedback_record_id) references human_feedback_records(id) on delete set null,
  constraint learning_candidate_source_links_source_asset_id_fkey
    foreign key (source_asset_id) references document_assets(id) on delete restrict
);

create index if not exists reviewed_case_snapshots_manuscript_created_at_idx
  on reviewed_case_snapshots (manuscript_id, created_at, id);

create index if not exists human_feedback_records_snapshot_created_at_idx
  on human_feedback_records (snapshot_id, created_at, id);

create index if not exists learning_candidate_source_links_candidate_created_at_idx
  on learning_candidate_source_links (learning_candidate_id, created_at, id);
