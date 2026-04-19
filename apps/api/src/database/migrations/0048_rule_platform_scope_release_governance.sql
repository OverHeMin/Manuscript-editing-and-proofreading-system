alter table editorial_rule_sets
  add column if not exists release_scope jsonb,
  add column if not exists candidate_validation_run_id text references evaluation_runs(id) on delete set null,
  add column if not exists candidate_validation_evidence_pack_id text references evaluation_evidence_packs(id) on delete set null,
  add column if not exists online_regression_run_id text references evaluation_runs(id) on delete set null,
  add column if not exists online_regression_evidence_pack_id text references evaluation_evidence_packs(id) on delete set null,
  add column if not exists rollback_rule_set_id uuid references editorial_rule_sets(id) on delete set null;

alter table editorial_rules
  add column if not exists priority integer not null default 100;
