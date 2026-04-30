do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'knowledge_review_action'
      and e.enumlabel = 'archived'
  ) then
    alter type knowledge_review_action add value 'archived';
  end if;

  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'knowledge_review_action'
      and e.enumlabel = 'restored'
  ) then
    alter type knowledge_review_action add value 'restored';
  end if;
end
$$;
