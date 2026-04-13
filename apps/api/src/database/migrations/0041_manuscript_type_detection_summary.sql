alter table manuscripts
  add column if not exists manuscript_type_detection_summary jsonb;
