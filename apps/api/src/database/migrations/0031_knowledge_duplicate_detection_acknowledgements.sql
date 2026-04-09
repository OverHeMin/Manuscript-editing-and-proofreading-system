do $$
begin
  if not exists (select 1 from pg_type where typname = 'knowledge_duplicate_severity') then
    create type knowledge_duplicate_severity as enum (
      'exact',
      'high',
      'possible'
    );
  end if;
end
$$;

create table if not exists knowledge_duplicate_acknowledgements (
  id text primary key,
  revision_id text not null,
  matched_asset_ids text[] not null default '{}'::text[],
  highest_severity knowledge_duplicate_severity not null,
  acknowledged_by_role text not null,
  created_at timestamptz not null default now(),
  constraint knowledge_duplicate_acknowledgements_revision_id_fkey
    foreign key (revision_id) references knowledge_revisions(id) on delete cascade,
  constraint knowledge_duplicate_acknowledgements_acknowledged_by_role_fkey
    foreign key (acknowledged_by_role) references roles(key) on delete restrict
);

create index if not exists knowledge_duplicate_acknowledgements_revision_created_at_idx
  on knowledge_duplicate_acknowledgements (revision_id, created_at desc);
