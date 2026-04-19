create table if not exists editorial_rule_activation_metrics (
  rule_id uuid not null,
  rule_set_id uuid not null,
  metric_key text not null,
  metric_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint editorial_rule_activation_metrics_pkey
    primary key (rule_id, metric_key),
  constraint editorial_rule_activation_metrics_rule_id_fkey
    foreign key (rule_id) references editorial_rules(id) on delete cascade,
  constraint editorial_rule_activation_metrics_rule_set_id_fkey
    foreign key (rule_set_id) references editorial_rule_sets(id) on delete cascade
);

create index if not exists editorial_rule_activation_metrics_rule_set_metric_idx
  on editorial_rule_activation_metrics (rule_set_id, metric_key, rule_id);
