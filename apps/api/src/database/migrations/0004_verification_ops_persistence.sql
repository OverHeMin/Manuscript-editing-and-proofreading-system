do $$
begin
  if not exists (select 1 from pg_type where typname = 'verification_check_type') then
    create type verification_check_type as enum (
      'browser_qa',
      'benchmark',
      'deploy_verification'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'registry_asset_status') then
    create type registry_asset_status as enum (
      'draft',
      'published',
      'archived'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'evaluation_suite_status') then
    create type evaluation_suite_status as enum (
      'draft',
      'active',
      'archived'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'evaluation_suite_type') then
    create type evaluation_suite_type as enum (
      'regression',
      'release_gate'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'verification_evidence_kind') then
    create type verification_evidence_kind as enum (
      'url',
      'artifact'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'evaluation_run_status') then
    create type evaluation_run_status as enum (
      'queued',
      'running',
      'passed',
      'failed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'frozen_experiment_lane') then
    create type frozen_experiment_lane as enum (
      'baseline',
      'candidate'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'evaluation_run_item_failure_kind') then
    create type evaluation_run_item_failure_kind as enum (
      'governance_failed',
      'runtime_failed',
      'scoring_failed',
      'regression_failed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'evaluation_decision_status') then
    create type evaluation_decision_status as enum (
      'recommended',
      'needs_review',
      'rejected'
    );
  end if;
end
$$;

create table if not exists evaluation_sample_sets (
  id text primary key,
  name text not null,
  module module_type not null,
  manuscript_types manuscript_type[] not null default '{}'::manuscript_type[],
  risk_tags text[],
  sample_count integer not null default 0,
  source_policy jsonb not null,
  status registry_asset_status not null default 'draft',
  admin_only boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evaluation_sample_sets_sample_count_nonnegative check (sample_count >= 0)
);

create table if not exists evaluation_sample_set_items (
  id text primary key,
  sample_set_id text not null,
  manuscript_id text not null,
  snapshot_asset_id text not null,
  reviewed_case_snapshot_id text not null,
  module module_type not null,
  manuscript_type manuscript_type not null,
  risk_tags text[],
  created_at timestamptz not null default now(),
  constraint evaluation_sample_set_items_sample_set_id_fkey
    foreign key (sample_set_id) references evaluation_sample_sets(id) on delete cascade
);

create table if not exists verification_check_profiles (
  id text primary key,
  name text not null,
  check_type verification_check_type not null,
  status registry_asset_status not null default 'draft',
  tool_ids text[],
  admin_only boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists release_check_profiles (
  id text primary key,
  name text not null,
  check_type verification_check_type not null,
  status registry_asset_status not null default 'draft',
  verification_check_profile_ids text[] not null default '{}'::text[],
  admin_only boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists evaluation_suites (
  id text primary key,
  name text not null,
  suite_type evaluation_suite_type not null,
  status evaluation_suite_status not null default 'draft',
  verification_check_profile_ids text[] not null default '{}'::text[],
  module_scope module_type[],
  module_scope_is_any boolean not null default false,
  requires_production_baseline boolean not null default false,
  supports_ab_comparison boolean not null default false,
  hard_gate_policy jsonb not null,
  score_weights jsonb not null,
  admin_only boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists verification_evidence (
  id text primary key,
  kind verification_evidence_kind not null,
  label text not null,
  uri text,
  artifact_asset_id text,
  check_profile_id text,
  created_at timestamptz not null
);

create table if not exists evaluation_runs (
  id text primary key,
  suite_id text not null,
  sample_set_id text,
  baseline_binding jsonb,
  candidate_binding jsonb,
  release_check_profile_id text,
  run_item_count integer not null default 0,
  status evaluation_run_status not null default 'queued',
  evidence_ids text[] not null default '{}'::text[],
  started_at timestamptz not null,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evaluation_runs_run_item_count_nonnegative check (run_item_count >= 0),
  constraint evaluation_runs_suite_id_fkey
    foreign key (suite_id) references evaluation_suites(id) on delete cascade,
  constraint evaluation_runs_sample_set_id_fkey
    foreign key (sample_set_id) references evaluation_sample_sets(id) on delete set null
);

create table if not exists evaluation_run_items (
  id text primary key,
  evaluation_run_id text not null,
  sample_set_item_id text not null,
  lane frozen_experiment_lane not null,
  result_asset_id text,
  hard_gate_passed boolean,
  weighted_score double precision,
  failure_kind evaluation_run_item_failure_kind,
  failure_reason text,
  diff_summary text,
  requires_human_review boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evaluation_run_items_evaluation_run_id_fkey
    foreign key (evaluation_run_id) references evaluation_runs(id) on delete cascade,
  constraint evaluation_run_items_sample_set_item_id_fkey
    foreign key (sample_set_item_id) references evaluation_sample_set_items(id) on delete cascade
);

create table if not exists evaluation_evidence_packs (
  id text primary key,
  experiment_run_id text not null,
  summary_status evaluation_decision_status not null,
  score_summary text,
  regression_summary text,
  failure_summary text,
  cost_summary text,
  latency_summary text,
  created_at timestamptz not null,
  constraint evaluation_evidence_packs_experiment_run_id_fkey
    foreign key (experiment_run_id) references evaluation_runs(id) on delete cascade
);

create table if not exists evaluation_promotion_recommendations (
  id text primary key,
  experiment_run_id text not null,
  evidence_pack_id text not null,
  status evaluation_decision_status not null,
  decision_reason text,
  learning_candidate_ids text[],
  created_at timestamptz not null,
  constraint evaluation_promotion_recommendations_experiment_run_id_fkey
    foreign key (experiment_run_id) references evaluation_runs(id) on delete cascade,
  constraint evaluation_promotion_recommendations_evidence_pack_id_fkey
    foreign key (evidence_pack_id) references evaluation_evidence_packs(id) on delete cascade
);

create index if not exists evaluation_sample_sets_module_status_idx
  on evaluation_sample_sets (module, status);
create index if not exists evaluation_sample_set_items_sample_set_id_idx
  on evaluation_sample_set_items (sample_set_id);
create index if not exists verification_check_profiles_status_idx
  on verification_check_profiles (status);
create index if not exists release_check_profiles_status_idx
  on release_check_profiles (status);
create index if not exists evaluation_suites_status_idx
  on evaluation_suites (status);
create index if not exists evaluation_runs_suite_id_started_at_idx
  on evaluation_runs (suite_id, started_at desc);
create index if not exists evaluation_run_items_evaluation_run_id_idx
  on evaluation_run_items (evaluation_run_id);
create index if not exists evaluation_evidence_packs_experiment_run_id_idx
  on evaluation_evidence_packs (experiment_run_id);
create index if not exists evaluation_promotion_recommendations_experiment_run_id_idx
  on evaluation_promotion_recommendations (experiment_run_id);
