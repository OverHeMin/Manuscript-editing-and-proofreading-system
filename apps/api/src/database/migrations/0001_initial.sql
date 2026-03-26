create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'manuscript_status') then
    create type manuscript_status as enum (
      'draft',
      'uploaded',
      'processing',
      'awaiting_review',
      'completed',
      'archived'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'manuscript_type') then
    create type manuscript_type as enum (
      'clinical_study',
      'review',
      'systematic_review',
      'meta_analysis',
      'case_report',
      'guideline_interpretation',
      'expert_consensus',
      'diagnostic_study',
      'basic_research',
      'nursing_study',
      'methodology_paper',
      'brief_report',
      'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'document_asset_status') then
    create type document_asset_status as enum (
      'created',
      'active',
      'superseded',
      'archived'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'document_asset_type') then
    create type document_asset_type as enum (
      'original',
      'normalized_docx',
      'screening_report',
      'edited_docx',
      'proofreading_draft_report',
      'final_proof_issue_report',
      'final_proof_annotated_docx',
      'pdf_consistency_report',
      'human_final_docx',
      'learning_snapshot_attachment'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'manuscript_module') then
    create type manuscript_module as enum (
      'upload',
      'screening',
      'editing',
      'proofreading',
      'pdf_consistency',
      'learning',
      'manual'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type job_status as enum (
      'queued',
      'running',
      'completed',
      'failed',
      'cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'template_family_status') then
    create type template_family_status as enum (
      'draft',
      'active',
      'archived'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'module_type') then
    create type module_type as enum (
      'screening',
      'editing',
      'proofreading'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'module_template_status') then
    create type module_template_status as enum (
      'draft',
      'published',
      'archived'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'knowledge_item_status') then
    create type knowledge_item_status as enum (
      'draft',
      'pending_review',
      'approved',
      'deprecated',
      'superseded',
      'archived'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'knowledge_kind') then
    create type knowledge_kind as enum (
      'rule',
      'case_pattern',
      'checklist',
      'prompt_snippet',
      'reference',
      'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'evidence_level') then
    create type evidence_level as enum (
      'low',
      'medium',
      'high',
      'expert_opinion',
      'unknown'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'knowledge_source_type') then
    create type knowledge_source_type as enum (
      'paper',
      'guideline',
      'book',
      'website',
      'internal_case',
      'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'manuscript_module_scope') then
    create type manuscript_module_scope as enum (
      'any',
      'upload',
      'screening',
      'editing',
      'proofreading',
      'pdf_consistency',
      'learning',
      'manual'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'learning_candidate_type') then
    create type learning_candidate_type as enum (
      'rule_candidate',
      'case_pattern_candidate',
      'template_update_candidate',
      'prompt_optimization_candidate',
      'checklist_update_candidate'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'learning_candidate_status') then
    create type learning_candidate_status as enum (
      'draft',
      'pending_review',
      'approved',
      'rejected',
      'archived'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'model_provider') then
    create type model_provider as enum (
      'openai',
      'anthropic',
      'google',
      'azure_openai',
      'local',
      'other'
    );
  end if;
end
$$;

create table if not exists roles (
  key text primary key,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists template_families (
  id uuid primary key default gen_random_uuid(),
  manuscript_type manuscript_type not null,
  name text not null,
  status template_family_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint template_families_manuscript_type_name_key unique (manuscript_type, name)
);

create table if not exists manuscripts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  manuscript_type manuscript_type not null,
  status manuscript_status not null default 'draft',
  created_by text not null,
  current_screening_asset_id uuid,
  current_editing_asset_id uuid,
  current_proofreading_asset_id uuid,
  current_template_family_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manuscripts_current_template_family_id_fkey
    foreign key (current_template_family_id) references template_families(id) on delete set null
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid,
  module manuscript_module not null,
  job_type text not null,
  status job_status not null default 'queued',
  requested_by text not null,
  payload jsonb,
  attempt_count integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_manuscript_id_fkey
    foreign key (manuscript_id) references manuscripts(id) on delete set null
);

create table if not exists document_assets (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null,
  asset_type document_asset_type not null,
  status document_asset_status not null default 'created',
  storage_key text not null,
  mime_type text not null,
  parent_asset_id uuid,
  source_module manuscript_module not null,
  source_job_id uuid,
  created_by text not null,
  version_no integer not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_assets_manuscript_id_fkey
    foreign key (manuscript_id) references manuscripts(id) on delete cascade,
  constraint document_assets_parent_asset_id_fkey
    foreign key (parent_asset_id) references document_assets(id) on delete set null,
  constraint document_assets_source_job_id_fkey
    foreign key (source_job_id) references jobs(id) on delete set null,
  constraint document_assets_manuscript_id_asset_type_version_no_key
    unique (manuscript_id, asset_type, version_no)
);

alter table manuscripts
  add constraint manuscripts_current_screening_asset_id_fkey
  foreign key (current_screening_asset_id) references document_assets(id) on delete set null;

alter table manuscripts
  add constraint manuscripts_current_editing_asset_id_fkey
  foreign key (current_editing_asset_id) references document_assets(id) on delete set null;

alter table manuscripts
  add constraint manuscripts_current_proofreading_asset_id_fkey
  foreign key (current_proofreading_asset_id) references document_assets(id) on delete set null;

create table if not exists module_templates (
  id uuid primary key default gen_random_uuid(),
  template_family_id uuid not null,
  module module_type not null,
  manuscript_type manuscript_type not null,
  version_no integer not null,
  status module_template_status not null default 'draft',
  prompt text not null,
  checklist text[] not null default '{}'::text[],
  section_requirements text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint module_templates_template_family_id_fkey
    foreign key (template_family_id) references template_families(id) on delete cascade,
  constraint module_templates_template_family_id_module_version_no_key
    unique (template_family_id, module, version_no)
);

create table if not exists knowledge_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  canonical_text text not null,
  summary text,
  knowledge_kind knowledge_kind not null,
  status knowledge_item_status not null default 'draft',
  module_scope manuscript_module_scope not null,
  manuscript_types manuscript_type[] not null default '{}'::manuscript_type[],
  sections text[] not null default '{}'::text[],
  risk_tags text[] not null default '{}'::text[],
  discipline_tags text[] not null default '{}'::text[],
  evidence_level evidence_level,
  source_type knowledge_source_type,
  source_link text,
  effective_at timestamptz,
  expires_at timestamptz,
  aliases text[] not null default '{}'::text[],
  template_bindings text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists learning_candidates (
  id uuid primary key default gen_random_uuid(),
  type learning_candidate_type not null,
  status learning_candidate_status not null default 'draft',
  module manuscript_module not null,
  manuscript_type manuscript_type not null,
  human_final_asset_id uuid,
  annotated_asset_id uuid,
  snapshot_asset_id uuid,
  title text,
  proposal_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_candidates_human_final_asset_id_fkey
    foreign key (human_final_asset_id) references document_assets(id) on delete set null,
  constraint learning_candidates_annotated_asset_id_fkey
    foreign key (annotated_asset_id) references document_assets(id) on delete set null,
  constraint learning_candidates_snapshot_asset_id_fkey
    foreign key (snapshot_asset_id) references document_assets(id) on delete set null
);

create table if not exists model_registry (
  id uuid primary key default gen_random_uuid(),
  provider model_provider not null,
  model_name text not null,
  model_version text,
  allowed_modules module_type[] not null default '{}'::module_type[],
  is_prod_allowed boolean not null default false,
  cost_profile jsonb,
  rate_limit jsonb,
  fallback_model_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint model_registry_fallback_model_id_fkey
    foreign key (fallback_model_id) references model_registry(id) on delete set null,
  constraint model_registry_provider_model_name_model_version_key
    unique (provider, model_name, model_version)
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id text,
  role_key text,
  action text not null,
  target_table text,
  target_id text,
  manuscript_id uuid,
  job_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint audit_logs_role_key_fkey
    foreign key (role_key) references roles(key) on delete set null,
  constraint audit_logs_manuscript_id_fkey
    foreign key (manuscript_id) references manuscripts(id) on delete set null,
  constraint audit_logs_job_id_fkey
    foreign key (job_id) references jobs(id) on delete set null
);

create index if not exists manuscripts_status_idx
  on manuscripts (status);

create index if not exists document_assets_manuscript_id_idx
  on document_assets (manuscript_id);

create index if not exists knowledge_items_status_module_scope_idx
  on knowledge_items (status, module_scope);

create index if not exists knowledge_items_manuscript_types_gin_idx
  on knowledge_items using gin (manuscript_types);

create index if not exists knowledge_items_risk_tags_gin_idx
  on knowledge_items using gin (risk_tags);

create index if not exists module_templates_manuscript_type_module_idx
  on module_templates (manuscript_type, module);
