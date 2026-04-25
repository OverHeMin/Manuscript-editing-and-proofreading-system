alter table manuscripts
  add column if not exists editing_completion_gate_summary jsonb;
