create table if not exists proofreading_pass_runs (
  id text primary key,
  manuscript_id uuid not null references manuscripts(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  snapshot_id text references execution_snapshots(id) on delete set null,
  pass_no integer not null check (pass_no > 0),
  pass_kind text not null check (
    pass_kind in (
      'medical_facts_and_terminology',
      'structure_logic_and_consistency',
      'data_statistics_units_and_tables',
      'language_style_punctuation_and_format',
      'residual_synthesis'
    )
  ),
  status text not null check (
    status in ('queued', 'running', 'completed', 'failed', 'skipped')
  ),
  model_id text not null,
  model_version text,
  input_context_digest text,
  rule_ids text[] not null default '{}',
  knowledge_item_ids text[] not null default '{}',
  quality_package_ids text[] not null default '{}',
  prompt_template_id text,
  skill_package_ids text[] not null default '{}',
  output jsonb,
  error_message text,
  retry_count integer not null default 0 check (retry_count >= 0),
  started_at timestamptz not null,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, pass_no)
);

create index if not exists proofreading_pass_runs_manuscript_idx
  on proofreading_pass_runs (manuscript_id, pass_no);

create index if not exists proofreading_pass_runs_snapshot_idx
  on proofreading_pass_runs (snapshot_id);
