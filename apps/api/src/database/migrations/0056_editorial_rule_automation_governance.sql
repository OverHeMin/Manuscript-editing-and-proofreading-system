do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'editorial_rule_domain'
  ) then
    create type editorial_rule_domain as enum (
      'page_structure',
      'title_heading',
      'abstract_keywords',
      'front_matter',
      'body_paragraph',
      'references',
      'declarations',
      'table',
      'image_symbol',
      'object_symbol',
      'journal_override'
    );
  end if;

  if not exists (
    select 1 from pg_type where typname = 'editorial_rule_automation_grade'
  ) then
    create type editorial_rule_automation_grade as enum ('A', 'B', 'C', 'D');
  end if;

  if not exists (
    select 1 from pg_type where typname = 'editorial_rule_scope_layer'
  ) then
    create type editorial_rule_scope_layer as enum ('general', 'medical', 'journal');
  end if;
end
$$;

alter table editorial_rules
  add column if not exists rule_domain editorial_rule_domain,
  add column if not exists structured_action jsonb,
  add column if not exists automation_grade editorial_rule_automation_grade not null default 'C',
  add column if not exists scope_layer editorial_rule_scope_layer,
  add column if not exists gold_sample_gate jsonb;

create index if not exists editorial_rules_domain_grade_idx
  on editorial_rules (rule_domain, automation_grade);

create index if not exists editorial_rules_scope_layer_idx
  on editorial_rules (scope_layer);
