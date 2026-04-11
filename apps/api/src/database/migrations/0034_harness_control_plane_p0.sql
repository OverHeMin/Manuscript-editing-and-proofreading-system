create table if not exists retrieval_presets (
  id text primary key,
  module module_type not null,
  manuscript_type manuscript_type not null,
  template_family_id text not null,
  name text not null,
  top_k integer not null,
  section_filters text[] not null default '{}'::text[],
  risk_tag_filters text[] not null default '{}'::text[],
  rerank_enabled boolean not null default false,
  citation_required boolean not null default true,
  min_retrieval_score double precision,
  status text not null,
  version integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint retrieval_presets_top_k_check
    check (top_k > 0),
  constraint retrieval_presets_min_retrieval_score_check
    check (
      min_retrieval_score is null
      or (min_retrieval_score >= 0 and min_retrieval_score <= 1)
    ),
  constraint retrieval_presets_status_check
    check (status in ('draft', 'active', 'archived')),
  constraint retrieval_presets_version_check
    check (version > 0)
);

create unique index if not exists retrieval_presets_scope_version_uidx
  on retrieval_presets (module, manuscript_type, template_family_id, version);

create index if not exists retrieval_presets_scope_status_version_idx
  on retrieval_presets (module, manuscript_type, template_family_id, status, version, id);

create unique index if not exists retrieval_presets_active_scope_uidx
  on retrieval_presets (module, manuscript_type, template_family_id)
  where status = 'active';

create table if not exists manual_review_policies (
  id text primary key,
  module module_type not null,
  manuscript_type manuscript_type not null,
  template_family_id text not null,
  name text not null,
  min_confidence_threshold double precision not null,
  high_risk_force_review boolean not null default true,
  conflict_force_review boolean not null default true,
  insufficient_knowledge_force_review boolean not null default true,
  module_blocklist_rules text[] not null default '{}'::text[],
  status text not null,
  version integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manual_review_policies_min_confidence_threshold_check
    check (min_confidence_threshold >= 0 and min_confidence_threshold <= 1),
  constraint manual_review_policies_status_check
    check (status in ('draft', 'active', 'archived')),
  constraint manual_review_policies_version_check
    check (version > 0)
);

create unique index if not exists manual_review_policies_scope_version_uidx
  on manual_review_policies (module, manuscript_type, template_family_id, version);

create index if not exists manual_review_policies_scope_status_version_idx
  on manual_review_policies (module, manuscript_type, template_family_id, status, version, id);

create unique index if not exists manual_review_policies_active_scope_uidx
  on manual_review_policies (module, manuscript_type, template_family_id)
  where status = 'active';
