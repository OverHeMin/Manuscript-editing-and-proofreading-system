alter table journal_template_profiles
  add column if not exists target_model_version_id text,
  add column if not exists target_model_version_no integer,
  add column if not exists journal_format_target_model jsonb,
  add column if not exists target_model_versions jsonb not null default '[]'::jsonb;
