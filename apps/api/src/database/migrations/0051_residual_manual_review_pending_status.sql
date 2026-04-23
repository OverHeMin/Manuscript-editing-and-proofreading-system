do
$$
begin
  if exists (
    select 1 from pg_type where typname = 'residual_issue_status'
  ) then
    alter type residual_issue_status add value if not exists 'manual_review_pending';
  end if;
end
$$;
