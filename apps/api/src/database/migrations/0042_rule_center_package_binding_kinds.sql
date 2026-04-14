do $$
begin
  if not exists (
    select 1
    from pg_enum
    where enumtypid = 'knowledge_revision_binding_kind'::regtype
      and enumlabel = 'general_package'
  ) then
    alter type knowledge_revision_binding_kind add value 'general_package';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumtypid = 'knowledge_revision_binding_kind'::regtype
      and enumlabel = 'medical_package'
  ) then
    alter type knowledge_revision_binding_kind add value 'medical_package';
  end if;
end
$$;
