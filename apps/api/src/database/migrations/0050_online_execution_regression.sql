do $$
begin
  if not exists (
    select 1
    from pg_enum
    where enumtypid = 'evaluation_suite_type'::regtype
      and enumlabel = 'module_regression_suite'
  ) then
    alter type evaluation_suite_type add value 'module_regression_suite';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumtypid = 'evaluation_suite_type'::regtype
      and enumlabel = 'scope_regression_suite'
  ) then
    alter type evaluation_suite_type add value 'scope_regression_suite';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumtypid = 'evaluation_suite_type'::regtype
      and enumlabel = 'rule_family_regression_suite'
  ) then
    alter type evaluation_suite_type add value 'rule_family_regression_suite';
  end if;
end
$$;
