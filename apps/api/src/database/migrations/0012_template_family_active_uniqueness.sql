create unique index if not exists template_families_active_manuscript_type_uidx
  on template_families (manuscript_type)
  where status = 'active';
