create table if not exists harness_redaction_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  redaction_mode text not null,
  structured_fields text[] not null default '{}'::text[],
  allow_raw_payload_export boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint harness_redaction_profiles_name_key
    unique (name),
  constraint harness_redaction_profiles_redaction_mode_check
    check (redaction_mode in ('structured_only', 'metadata_only', 'bounded_excerpt'))
);

create table if not exists harness_integrations (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  display_name text not null,
  execution_mode text not null,
  fail_open boolean not null default true,
  redaction_profile_id uuid not null,
  feature_flag_keys text[] not null default '{}'::text[],
  result_envelope_version text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint harness_integrations_kind_key
    unique (kind),
  constraint harness_integrations_redaction_profile_id_fkey
    foreign key (redaction_profile_id)
    references harness_redaction_profiles(id)
    on delete restrict,
  constraint harness_integrations_kind_check
    check (kind in ('promptfoo', 'langfuse_oss', 'simple_evals_local', 'judge_reliability_local')),
  constraint harness_integrations_execution_mode_check
    check (execution_mode in ('local_cli', 'self_hosted_http')),
  constraint harness_integrations_feature_flag_keys_check
    check (cardinality(feature_flag_keys) > 0)
);

create index if not exists harness_integrations_kind_updated_at_idx
  on harness_integrations (kind, updated_at desc);

create index if not exists harness_integrations_redaction_profile_id_idx
  on harness_integrations (redaction_profile_id);

create table if not exists harness_integration_feature_flag_changes (
  id uuid primary key default gen_random_uuid(),
  adapter_id uuid not null,
  flag_key text not null,
  enabled boolean not null,
  changed_by text not null,
  change_reason text,
  created_at timestamptz not null default now(),
  constraint harness_integration_feature_flag_changes_adapter_id_fkey
    foreign key (adapter_id)
    references harness_integrations(id)
    on delete cascade
);

create index if not exists harness_integration_feature_flag_changes_adapter_created_at_idx
  on harness_integration_feature_flag_changes (adapter_id, created_at desc, id desc);

create index if not exists harness_integration_feature_flag_changes_flag_key_created_at_idx
  on harness_integration_feature_flag_changes (flag_key, created_at desc, id desc);

create table if not exists harness_execution_audits (
  id uuid primary key default gen_random_uuid(),
  adapter_id uuid not null,
  trigger_kind text not null,
  input_reference text not null,
  dataset_id text,
  artifact_uri text,
  status text not null,
  degradation_reason text,
  result_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint harness_execution_audits_adapter_id_fkey
    foreign key (adapter_id)
    references harness_integrations(id)
    on delete cascade,
  constraint harness_execution_audits_trigger_kind_check
    check (trigger_kind in ('operator_requested', 'api_requested')),
  constraint harness_execution_audits_status_check
    check (status in ('succeeded', 'degraded', 'failed')),
  constraint harness_execution_audits_degradation_reason_check
    check (
      (status = 'succeeded' and degradation_reason is null)
      or (status in ('degraded', 'failed') and degradation_reason is not null)
    )
);

create index if not exists harness_execution_audits_adapter_created_at_idx
  on harness_execution_audits (adapter_id, created_at desc, id desc);

create index if not exists harness_execution_audits_dataset_created_at_idx
  on harness_execution_audits (dataset_id, created_at desc, id desc);
