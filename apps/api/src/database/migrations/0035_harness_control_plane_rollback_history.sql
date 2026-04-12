create table if not exists harness_environment_rollbacks (
  id text primary key,
  module module_type not null,
  manuscript_type manuscript_type not null,
  template_family_id text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists harness_environment_rollbacks_scope_created_at_idx
  on harness_environment_rollbacks (
    module,
    manuscript_type,
    template_family_id,
    created_at desc,
    id desc
  );
