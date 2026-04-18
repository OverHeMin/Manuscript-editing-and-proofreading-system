do $$
begin
  if exists (
    select 1 from pg_type where typname = 'learning_candidate_source_kind'
  ) and not exists (
    select 1
    from pg_enum enum_values
    join pg_type enum_type on enum_type.oid = enum_values.enumtypid
    where enum_type.typname = 'learning_candidate_source_kind'
      and enum_values.enumlabel = 'residual_issue'
  ) then
    alter type learning_candidate_source_kind add value 'residual_issue';
  end if;

  if exists (
    select 1 from pg_type where typname = 'learning_candidate_type'
  ) and not exists (
    select 1
    from pg_enum enum_values
    join pg_type enum_type on enum_type.oid = enum_values.enumtypid
    where enum_type.typname = 'learning_candidate_type'
      and enum_values.enumlabel = 'knowledge_candidate'
  ) then
    alter type learning_candidate_type add value 'knowledge_candidate';
  end if;
end
$$;

do $$
begin
  if exists (
    select 1 from pg_type where typname = 'verification_check_type'
  ) and not exists (
    select 1
    from pg_enum enum_values
    join pg_type enum_type on enum_type.oid = enum_values.enumtypid
    where enum_type.typname = 'verification_check_type'
      and enum_values.enumlabel = 'residual_issue_validation'
  ) then
    alter type verification_check_type add value 'residual_issue_validation';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'residual_issue_source_stage'
  ) then
    create type residual_issue_source_stage as enum (
      'quality_engine',
      'rule_residual',
      'model_residual'
    );
  end if;

  if not exists (
    select 1 from pg_type where typname = 'residual_confidence_band'
  ) then
    create type residual_confidence_band as enum (
      'L0_observation',
      'L1_review_pending',
      'L2_candidate_ready',
      'L3_strongly_reusable'
    );
  end if;

  if not exists (
    select 1 from pg_type where typname = 'residual_issue_risk_level'
  ) then
    create type residual_issue_risk_level as enum (
      'low',
      'medium',
      'high',
      'critical'
    );
  end if;

  if not exists (
    select 1 from pg_type where typname = 'residual_issue_route'
  ) then
    create type residual_issue_route as enum (
      'rule_candidate',
      'knowledge_candidate',
      'prompt_template_candidate',
      'manual_only',
      'evidence_only'
    );
  end if;

  if not exists (
    select 1 from pg_type where typname = 'residual_issue_status'
  ) then
    create type residual_issue_status as enum (
      'observed',
      'validation_pending',
      'candidate_ready',
      'validation_failed',
      'manual_only',
      'evidence_only',
      'candidate_created',
      'archived'
    );
  end if;

  if not exists (
    select 1 from pg_type where typname = 'residual_harness_validation_status'
  ) then
    create type residual_harness_validation_status as enum (
      'not_required',
      'queued',
      'passed',
      'failed'
    );
  end if;
end
$$;

create table if not exists residual_issues (
  id text primary key,
  module module_type not null,
  manuscript_id uuid not null,
  manuscript_type manuscript_type not null,
  job_id uuid,
  execution_snapshot_id text not null,
  agent_execution_log_id text,
  output_asset_id uuid,
  execution_profile_id text,
  runtime_binding_id text,
  prompt_template_id text,
  retrieval_snapshot_id uuid,
  issue_type text not null,
  source_stage residual_issue_source_stage not null,
  excerpt text,
  location jsonb not null default '{}'::jsonb,
  suggestion text,
  rationale text,
  related_rule_ids text[] not null default '{}'::text[],
  related_knowledge_item_ids text[] not null default '{}'::text[],
  related_quality_issue_ids text[] not null default '{}'::text[],
  novelty_key text not null,
  recurrence_count integer not null default 1,
  model_confidence double precision,
  signal_breakdown jsonb not null default '{}'::jsonb,
  system_confidence_band residual_confidence_band not null,
  risk_level residual_issue_risk_level not null default 'low',
  recommended_route residual_issue_route not null,
  status residual_issue_status not null default 'observed',
  harness_validation_status residual_harness_validation_status not null default 'not_required',
  harness_run_id text,
  harness_evidence_pack_id text,
  learning_candidate_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint residual_issues_manuscript_id_fkey
    foreign key (manuscript_id) references manuscripts(id) on delete cascade,
  constraint residual_issues_job_id_fkey
    foreign key (job_id) references jobs(id) on delete set null,
  constraint residual_issues_output_asset_id_fkey
    foreign key (output_asset_id) references document_assets(id) on delete set null,
  constraint residual_issues_learning_candidate_id_fkey
    foreign key (learning_candidate_id) references learning_candidates(id) on delete set null,
  constraint residual_issues_recurrence_count_check
    check (recurrence_count >= 1),
  constraint residual_issues_model_confidence_check
    check (
      model_confidence is null
      or (model_confidence >= 0 and model_confidence <= 1)
    )
);

create index if not exists residual_issues_execution_snapshot_created_at_idx
  on residual_issues (execution_snapshot_id, created_at desc, id);

create index if not exists residual_issues_novelty_key_created_at_idx
  on residual_issues (novelty_key, created_at desc, id);

create index if not exists residual_issues_route_validation_updated_at_idx
  on residual_issues (
    recommended_route,
    harness_validation_status,
    updated_at desc,
    id
  );
