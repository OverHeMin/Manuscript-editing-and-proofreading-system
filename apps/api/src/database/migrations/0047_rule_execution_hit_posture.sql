do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'governed_execution_hit_posture'
  ) then
    create type governed_execution_hit_posture as enum (
      'candidate_change',
      'inspect_only'
    );
  end if;

  if not exists (
    select 1 from pg_type where typname = 'governed_hit_decision_source'
  ) then
    create type governed_hit_decision_source as enum (
      'manual_feedback',
      'execution_hit'
    );
  end if;
end
$$;

alter table governed_hit_review_items
  add column if not exists candidate_posture governed_execution_hit_posture,
  add column if not exists decision_source governed_hit_decision_source;

update governed_hit_review_items
set
  candidate_posture = case
    when candidate_posture is not null then candidate_posture
    when coalesce(origin_payload->>'source', '') in (
      'manual_review_item',
      'content_rule_candidate',
      'quality_finding'
    ) then 'candidate_change'::governed_execution_hit_posture
    when coalesce(origin_payload->>'source', '') in (
      'table_inspection_finding',
      'failed_check'
    ) then 'inspect_only'::governed_execution_hit_posture
    else candidate_posture
  end,
  decision_source = case
    when decision_source is not null then decision_source
    when coalesce(origin_payload->>'autoRecorded', 'false') = 'true'
      then 'execution_hit'::governed_hit_decision_source
    else 'manual_feedback'::governed_hit_decision_source
  end;

alter table governed_hit_review_items
  alter column decision_source set default 'manual_feedback';
