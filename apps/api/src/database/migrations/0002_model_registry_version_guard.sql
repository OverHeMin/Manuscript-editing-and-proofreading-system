do $$
begin
  if exists (
    select 1
    from model_registry
    group by provider, model_name, coalesce(model_version, '')
    having count(*) > 1
  ) then
    raise exception 'Duplicate logical model_registry rows exist for provider/model_name/model_version.';
  end if;
end
$$;

update model_registry
set model_version = ''
where model_version is null;

alter table model_registry
  alter column model_version set default '';

alter table model_registry
  alter column model_version set not null;

alter table audit_logs
  alter column metadata drop default;

alter table audit_logs
  alter column metadata drop not null;
