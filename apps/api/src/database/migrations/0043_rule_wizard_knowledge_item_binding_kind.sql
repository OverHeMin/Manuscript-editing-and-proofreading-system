do $$
begin
  if not exists (
    select 1
    from pg_enum
    where enumtypid = 'knowledge_revision_binding_kind'::regtype
      and enumlabel = 'knowledge_item'
  ) then
    alter type knowledge_revision_binding_kind add value 'knowledge_item';
  end if;
end
$$;
