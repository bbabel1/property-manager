-- Enhance GL accounts to support property/unit scoping with org-safe constraints and visibility
-- - Adds optional property_id / unit_id
-- - Validates scope belongs to org and unit implies property
-- - Enforces scoped uniqueness for account_number
-- - Adds supporting indexes and RLS updates
-- - Backfills scope only when deterministically derived from transaction_lines

begin;

-- New optional scope columns
alter table public.gl_accounts
  add column if not exists property_id uuid references public.properties(id) on delete set null,
  add column if not exists unit_id uuid references public.units(id) on delete set null;

-- Unit-level accounts must also be property-scoped
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_gl_accounts_unit_requires_property'
  ) then
    alter table public.gl_accounts
      add constraint chk_gl_accounts_unit_requires_property
      check (unit_id is null or property_id is not null)
      not valid;
  end if;
end $$;

-- Prevent cross-org leakage for scoped accounts via trigger function
create or replace function public.validate_gl_account_scope()
returns trigger
language plpgsql
as $$
begin
  -- Validate property belongs to org
  if new.property_id is not null then
    if not exists (
      select 1
      from public.properties p
      where p.id = new.property_id
        and p.org_id = new.org_id
    ) then
      raise exception 'Property % does not belong to org %', new.property_id, new.org_id;
    end if;
  end if;

  -- Validate unit belongs to org and property
  if new.unit_id is not null then
    if not exists (
      select 1
      from public.units u
      join public.properties p on p.id = u.property_id
      where u.id = new.unit_id
        and p.org_id = new.org_id
        and (new.property_id is null or new.property_id = u.property_id)
    ) then
      raise exception 'Unit % does not belong to org % or specified property', new.unit_id, new.org_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_gl_account_scope on public.gl_accounts;
create trigger trg_validate_gl_account_scope
  before insert or update on public.gl_accounts
  for each row
  execute function public.validate_gl_account_scope();

-- Replace global uniqueness with scoped uniqueness
drop index if exists uniq_gl_accounts_account_number_not_null;

create unique index if not exists uq_gl_accounts_company_account_number
  on public.gl_accounts (org_id, account_number)
  where property_id is null and unit_id is null and org_id is not null;

create unique index if not exists uq_gl_accounts_property_account_number
  on public.gl_accounts (org_id, account_number, property_id)
  where property_id is not null and unit_id is null and org_id is not null;

create unique index if not exists uq_gl_accounts_unit_account_number
  on public.gl_accounts (org_id, account_number, property_id, unit_id)
  where unit_id is not null and org_id is not null;

-- Supporting indexes for scoped lookups
create index if not exists idx_gl_accounts_property_id
  on public.gl_accounts (property_id)
  where property_id is not null;

create index if not exists idx_gl_accounts_unit_id
  on public.gl_accounts (unit_id)
  where unit_id is not null;

create index if not exists idx_gl_accounts_org_property_unit
  on public.gl_accounts (org_id, property_id, unit_id);

-- Deterministic backfill from transaction_lines: only when a single property/unit is used
with unit_candidates as (
  select tl.gl_account_id, (array_agg(DISTINCT tl.unit_id))[1] as unit_id
  from public.transaction_lines tl
  where tl.gl_account_id is not null
    and tl.unit_id is not null
  group by tl.gl_account_id
  having count(distinct tl.unit_id) = 1
), property_candidates as (
  select tl.gl_account_id, (array_agg(DISTINCT tl.property_id))[1] as property_id
  from public.transaction_lines tl
  where tl.gl_account_id is not null
    and tl.property_id is not null
  group by tl.gl_account_id
  having count(distinct tl.property_id) = 1
), scoped as (
  select
    g.id as gl_account_id,
    uc.unit_id,
    coalesce(u.property_id, pc.property_id) as property_id
  from public.gl_accounts g
  left join unit_candidates uc on uc.gl_account_id = g.id
  left join public.units u on u.id = uc.unit_id
  left join property_candidates pc on pc.gl_account_id = g.id
  left join public.properties p on p.id = coalesce(u.property_id, pc.property_id)
  where (uc.unit_id is not null or pc.property_id is not null)
    and (uc.unit_id is null or u.org_id = g.org_id)
    and (coalesce(u.property_id, pc.property_id) is null or (p.id is not null and p.org_id = g.org_id))
    and (uc.unit_id is null or pc.property_id is null or pc.property_id = u.property_id)
)
update public.gl_accounts g
set
  unit_id = coalesce(g.unit_id, s.unit_id),
  property_id = coalesce(g.property_id, s.property_id)
from scoped s
where g.id = s.gl_account_id
  and (
    (g.unit_id is null and s.unit_id is not null)
    or (g.property_id is null and s.property_id is not null)
  );

alter table public.gl_accounts validate constraint chk_gl_accounts_unit_requires_property;

-- RLS: include scoped visibility in existing org policies
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'gl_accounts') then
    drop policy if exists gl_accounts_org_read on public.gl_accounts;
    drop policy if exists gl_accounts_org_update on public.gl_accounts;
    drop policy if exists gl_accounts_org_write on public.gl_accounts;

    create policy gl_accounts_org_read
      on public.gl_accounts for select
      using (
        public.is_org_member((select auth.uid()), org_id)
        and (
          property_id is null
          or exists (
            select 1 from public.properties p
            where p.id = gl_accounts.property_id
              and p.org_id = gl_accounts.org_id
          )
        )
        and (
          unit_id is null
          or exists (
            select 1
            from public.units u
            join public.properties p on p.id = u.property_id
            where u.id = gl_accounts.unit_id
              and p.org_id = gl_accounts.org_id
          )
        )
      );

    create policy gl_accounts_org_update
      on public.gl_accounts for update
      using (
        public.is_org_admin_or_manager((select auth.uid()), org_id)
        and (
          property_id is null
          or exists (
            select 1 from public.properties p
            where p.id = gl_accounts.property_id
              and p.org_id = gl_accounts.org_id
          )
        )
        and (
          unit_id is null
          or exists (
            select 1
            from public.units u
            join public.properties p on p.id = u.property_id
            where u.id = gl_accounts.unit_id
              and p.org_id = gl_accounts.org_id
          )
        )
      )
      with check (
        public.is_org_admin_or_manager((select auth.uid()), org_id)
        and (
          property_id is null
          or exists (
            select 1 from public.properties p
            where p.id = gl_accounts.property_id
              and p.org_id = gl_accounts.org_id
          )
        )
        and (
          unit_id is null
          or exists (
            select 1
            from public.units u
            join public.properties p on p.id = u.property_id
            where u.id = gl_accounts.unit_id
              and p.org_id = gl_accounts.org_id
          )
        )
      );

    create policy gl_accounts_org_write
      on public.gl_accounts for insert
      with check (
        public.is_org_admin_or_manager((select auth.uid()), org_id)
        and (
          property_id is null
          or exists (
            select 1 from public.properties p
            where p.id = gl_accounts.property_id
              and p.org_id = gl_accounts.org_id
          )
        )
        and (
          unit_id is null
          or exists (
            select 1
            from public.units u
            join public.properties p on p.id = u.property_id
            where u.id = gl_accounts.unit_id
              and p.org_id = gl_accounts.org_id
          )
        )
      );
  end if;
end $$;

commit;
