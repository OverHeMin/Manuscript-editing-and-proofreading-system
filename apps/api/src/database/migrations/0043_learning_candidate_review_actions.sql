alter table learning_candidates
  add column if not exists review_actions jsonb not null default '[]'::jsonb;
