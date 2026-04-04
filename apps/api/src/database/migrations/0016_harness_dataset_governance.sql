create table if not exists harness_gold_set_families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  module module_type not null,
  manuscript_types manuscript_type[] not null default '{}'::manuscript_type[],
  measure_focus text not null,
  template_family_id uuid,
  admin_only boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint harness_gold_set_families_template_family_id_fkey
    foreign key (template_family_id) references template_families(id) on delete set null
);

create index if not exists harness_gold_set_families_module_created_at_idx
  on harness_gold_set_families (module, created_at desc);

create table if not exists harness_rubric_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version_no integer not null,
  status text not null,
  module module_type not null,
  manuscript_types manuscript_type[] not null default '{}'::manuscript_type[],
  scoring_dimensions jsonb not null default '[]'::jsonb,
  hard_gate_rules text[] not null default '{}'::text[],
  failure_anchors text[] not null default '{}'::text[],
  borderline_examples text[] not null default '{}'::text[],
  judge_prompt text,
  created_by text not null,
  created_at timestamptz not null default now(),
  published_by text,
  published_at timestamptz,
  archived_by text,
  archived_at timestamptz,
  constraint harness_rubric_definitions_status_check
    check (status in ('draft', 'published', 'archived')),
  constraint harness_rubric_definitions_version_no_check
    check (version_no > 0),
  constraint harness_rubric_definitions_name_version_no_key
    unique (name, version_no)
);

create index if not exists harness_rubric_definitions_name_status_version_idx
  on harness_rubric_definitions (name, status, version_no desc);

create table if not exists harness_gold_set_versions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  version_no integer not null,
  status text not null,
  rubric_definition_id uuid,
  item_count integer not null default 0,
  deidentification_gate_passed boolean not null default false,
  human_review_gate_passed boolean not null default false,
  items jsonb not null default '[]'::jsonb,
  publication_notes text,
  created_by text not null,
  created_at timestamptz not null default now(),
  published_by text,
  published_at timestamptz,
  archived_by text,
  archived_at timestamptz,
  constraint harness_gold_set_versions_family_id_fkey
    foreign key (family_id) references harness_gold_set_families(id) on delete cascade,
  constraint harness_gold_set_versions_rubric_definition_id_fkey
    foreign key (rubric_definition_id) references harness_rubric_definitions(id) on delete set null,
  constraint harness_gold_set_versions_status_check
    check (status in ('draft', 'published', 'archived')),
  constraint harness_gold_set_versions_item_count_check
    check (item_count >= 0),
  constraint harness_gold_set_versions_version_no_check
    check (version_no > 0),
  constraint harness_gold_set_versions_family_id_version_no_key
    unique (family_id, version_no)
);

create index if not exists harness_gold_set_versions_family_status_version_idx
  on harness_gold_set_versions (family_id, status, version_no desc);

create table if not exists harness_dataset_publications (
  id uuid primary key default gen_random_uuid(),
  gold_set_version_id uuid not null,
  export_format text not null,
  status text not null,
  output_uri text,
  deidentification_gate_passed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint harness_dataset_publications_gold_set_version_id_fkey
    foreign key (gold_set_version_id) references harness_gold_set_versions(id) on delete cascade,
  constraint harness_dataset_publications_export_format_check
    check (export_format in ('json', 'jsonl')),
  constraint harness_dataset_publications_status_check
    check (status in ('succeeded', 'failed'))
);

create index if not exists harness_dataset_publications_version_created_at_idx
  on harness_dataset_publications (gold_set_version_id, created_at desc);
