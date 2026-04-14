alter table if exists model_routing_policy_versions
  add column if not exists temperature numeric(3,2);

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'model_routing_policy_versions'
      and constraint_name = 'model_routing_policy_versions_temperature_check'
  ) then
    alter table model_routing_policy_versions
      add constraint model_routing_policy_versions_temperature_check
      check (temperature is null or (temperature >= 0 and temperature <= 1));
  end if;
end
$$;
