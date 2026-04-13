create table if not exists governed_content_modules (
  id uuid primary key,
  module_class text not null,
  name text not null,
  category text not null,
  manuscript_type_scope manuscript_type[] not null default '{}'::manuscript_type[],
  execution_module_scope module_type[] not null default '{}'::module_type[],
  applicable_sections text[] not null default '{}'::text[],
  summary text not null,
  guidance text[] not null default '{}'::text[],
  examples jsonb not null default '[]'::jsonb,
  evidence_level text,
  risk_level text,
  source_task_id uuid references rule_package_extraction_tasks(id) on delete set null,
  source_candidate_id uuid references rule_package_extraction_candidates(id) on delete set null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists template_compositions (
  id uuid primary key,
  name text not null,
  manuscript_type manuscript_type not null,
  journal_scope text,
  general_module_ids uuid[] not null default '{}'::uuid[],
  medical_module_ids uuid[] not null default '{}'::uuid[],
  execution_module_scope module_type[] not null default '{}'::module_type[],
  notes text,
  source_task_id uuid references rule_package_extraction_tasks(id) on delete set null,
  source_candidate_ids uuid[] not null default '{}'::uuid[],
  version_no integer not null default 1,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists governed_content_modules_class_status_updated_at_idx
  on governed_content_modules (module_class, status, updated_at desc);

create index if not exists template_compositions_manuscript_status_updated_at_idx
  on template_compositions (manuscript_type, status, updated_at desc);
