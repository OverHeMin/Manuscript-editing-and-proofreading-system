alter table execution_snapshots
  add column if not exists quality_findings_summary jsonb;
