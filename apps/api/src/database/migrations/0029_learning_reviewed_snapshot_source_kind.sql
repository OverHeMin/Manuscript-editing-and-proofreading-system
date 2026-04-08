do $$
begin
  if exists (
    select 1 from pg_type where typname = 'learning_candidate_source_kind'
  ) then
    alter type learning_candidate_source_kind
      add value if not exists 'reviewed_case_snapshot';
  end if;
end
$$;
