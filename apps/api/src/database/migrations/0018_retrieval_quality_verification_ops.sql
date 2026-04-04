do $$
begin
  if exists (
    select 1 from pg_type where typname = 'verification_check_type'
  ) and not exists (
    select 1
    from pg_enum enum_values
    join pg_type enum_type on enum_type.oid = enum_values.enumtypid
    where enum_type.typname = 'verification_check_type'
      and enum_values.enumlabel = 'retrieval_quality'
  ) then
    alter type verification_check_type add value 'retrieval_quality';
  end if;
end
$$;

alter table verification_evidence
  add column if not exists retrieval_snapshot_id uuid;

alter table verification_evidence
  add column if not exists retrieval_quality_run_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'verification_evidence_retrieval_snapshot_id_fkey'
  ) then
    alter table verification_evidence
      add constraint verification_evidence_retrieval_snapshot_id_fkey
      foreign key (retrieval_snapshot_id)
      references knowledge_retrieval_snapshots(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'verification_evidence_retrieval_quality_run_id_fkey'
  ) then
    alter table verification_evidence
      add constraint verification_evidence_retrieval_quality_run_id_fkey
      foreign key (retrieval_quality_run_id)
      references knowledge_retrieval_quality_runs(id)
      on delete set null;
  end if;
end
$$;

create index if not exists verification_evidence_retrieval_snapshot_id_idx
  on verification_evidence (retrieval_snapshot_id);

create index if not exists verification_evidence_retrieval_quality_run_id_idx
  on verification_evidence (retrieval_quality_run_id);
