create table if not exists rule_package_extraction_tasks (
  id uuid primary key,
  task_name text not null,
  manuscript_type manuscript_type not null,
  original_file_name text not null,
  edited_file_name text not null,
  journal_key text,
  source_session_id text not null,
  status text not null,
  candidate_count integer not null default 0,
  pending_confirmation_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rule_package_extraction_candidates (
  id uuid primary key,
  task_id uuid not null references rule_package_extraction_tasks(id) on delete cascade,
  package_id text not null,
  package_kind text not null,
  title text not null,
  confirmation_status text not null,
  suggested_destination text not null,
  candidate_payload jsonb not null,
  semantic_draft_payload jsonb not null default '{}'::jsonb,
  intake_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rule_package_extraction_tasks_status_created_at_idx
  on rule_package_extraction_tasks (status, created_at desc);

create index if not exists rule_package_extraction_candidates_task_confirmed_idx
  on rule_package_extraction_candidates (task_id, confirmation_status, created_at desc);
