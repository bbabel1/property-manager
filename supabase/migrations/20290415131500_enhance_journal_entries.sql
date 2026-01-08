-- Denormalize journal_entries with org/property/unit scope and tighten access

begin;

alter table public.journal_entries
  add column if not exists org_id uuid references public.organizations(id),
  add column if not exists property_id uuid references public.properties(id) on delete set null,
  add column if not exists unit_id uuid references public.units(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_journal_entries_unit_requires_property'
  ) then
    alter table public.journal_entries
      add constraint chk_journal_entries_unit_requires_property
      check (unit_id is null or property_id is not null)
      not valid;
  end if;
end $$;

-- Org guards using existing enforce_same_org helper
create or replace function public.journal_entries_property_org_guard()
returns trigger language plpgsql as $$
declare p_org uuid;
begin
  select org_id into p_org from public.properties where id = new.property_id;
  perform public.enforce_same_org(new.org_id, p_org, 'journal_entries');
  return new;
end;
$$;

drop trigger if exists journal_entries_property_org_guard on public.journal_entries;
create trigger journal_entries_property_org_guard
  before insert or update on public.journal_entries
  for each row
  when (new.property_id is not null)
  execute function public.journal_entries_property_org_guard();

create or replace function public.journal_entries_unit_org_guard()
returns trigger language plpgsql as $$
declare u_org uuid;
begin
  select org_id into u_org from public.units where id = new.unit_id;
  perform public.enforce_same_org(new.org_id, u_org, 'journal_entries');
  return new;
end;
$$;

drop trigger if exists journal_entries_unit_org_guard on public.journal_entries;
create trigger journal_entries_unit_org_guard
  before insert or update on public.journal_entries
  for each row
  when (new.unit_id is not null)
  execute function public.journal_entries_unit_org_guard();

-- Backfill org/property/unit from transaction header where possible
update public.journal_entries je
set org_id = coalesce(je.org_id, t.org_id),
    property_id = coalesce(je.property_id, t.property_id),
    unit_id = coalesce(je.unit_id, t.unit_id)
from public.transactions t
where je.transaction_id = t.id
  and (je.org_id is null or je.property_id is null or je.unit_id is null);

-- Indexes for scoped querying
create index if not exists idx_journal_entries_org_id on public.journal_entries(org_id);
create index if not exists idx_journal_entries_property_id on public.journal_entries(property_id) where property_id is not null;
create index if not exists idx_journal_entries_unit_id on public.journal_entries(unit_id) where unit_id is not null;
create index if not exists idx_journal_entries_org_property_unit on public.journal_entries(org_id, property_id, unit_id);

-- RLS: tighten to org membership + scoped property/unit visibility
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'journal_entries') then
    drop policy if exists journal_entries_tenant_select on public.journal_entries;
    drop policy if exists journal_entries_tenant_insert on public.journal_entries;
    drop policy if exists journal_entries_tenant_update on public.journal_entries;
    drop policy if exists journal_entries_tenant_delete on public.journal_entries;

    create policy journal_entries_tenant_select on public.journal_entries
      for select using (
        public.is_org_member((select auth.uid()), org_id)
        and (
          property_id is null
          or exists (
            select 1 from public.properties p
            where p.id = journal_entries.property_id
              and p.org_id = journal_entries.org_id
          )
        )
        and (
          unit_id is null
          or exists (
            select 1 from public.units u
            join public.properties p on p.id = u.property_id
            where u.id = journal_entries.unit_id
              and p.org_id = journal_entries.org_id
          )
        )
      );

    create policy journal_entries_tenant_insert on public.journal_entries
      for insert with check (
        public.is_org_member((select auth.uid()), org_id)
        and (
          property_id is null
          or exists (
            select 1 from public.properties p
            where p.id = journal_entries.property_id
              and p.org_id = journal_entries.org_id
          )
        )
        and (
          unit_id is null
          or exists (
            select 1 from public.units u
            join public.properties p on p.id = u.property_id
            where u.id = journal_entries.unit_id
              and p.org_id = journal_entries.org_id
          )
        )
      );

    create policy journal_entries_tenant_update on public.journal_entries
      for update using (
        public.is_org_member((select auth.uid()), org_id)
      )
      with check (
        public.is_org_member((select auth.uid()), org_id)
        and (
          property_id is null
          or exists (
            select 1 from public.properties p
            where p.id = journal_entries.property_id
              and p.org_id = journal_entries.org_id
          )
        )
        and (
          unit_id is null
          or exists (
            select 1 from public.units u
            join public.properties p on p.id = u.property_id
            where u.id = journal_entries.unit_id
              and p.org_id = journal_entries.org_id
          )
        )
      );

    create policy journal_entries_tenant_delete on public.journal_entries
      for delete using (
        public.is_org_member((select auth.uid()), org_id)
      );
  end if;
end $$;

alter table public.journal_entries validate constraint chk_journal_entries_unit_requires_property;

commit;
