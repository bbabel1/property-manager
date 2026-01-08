-- Foundation: stable A/P config, org_id backfill/constraint, and atomic bill prerequisites

begin;

-- 1) Stable A/P account configuration (org-level control account + resolver helper)
alter table public.organizations
  add column if not exists ap_gl_account_id uuid references public.gl_accounts(id);

create index if not exists idx_organizations_ap_gl_account_id
  on public.organizations(ap_gl_account_id);

create or replace function public.resolve_ap_gl_account_id(p_org_id uuid)
returns uuid
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select ap_gl_account_id from public.organizations where id = p_org_id),
    (select id from public.gl_accounts where org_id = p_org_id and sub_type = 'AccountsPayable' limit 1),
    (select id from public.gl_accounts where org_id = p_org_id and name ilike 'Accounts Payable' limit 1)
  );
$$;

comment on function public.resolve_ap_gl_account_id(uuid) is
  'Returns the org-scoped Accounts Payable GL account using org config, sub_type AccountsPayable, then name fallback.';

-- Backfill ap_gl_account_id using the resolver (only when resolvable)
update public.organizations o
set ap_gl_account_id = resolved.ap_gl_account_id
from (
  select id as org_id, public.resolve_ap_gl_account_id(id) as ap_gl_account_id
  from public.organizations
) resolved
where o.id = resolved.org_id
  and o.ap_gl_account_id is null
  and resolved.ap_gl_account_id is not null;

-- 2) Ensure org_id on transactions (focus on Bills, but enforce globally)
-- Header property -> org
update public.transactions t
set org_id = p.org_id
from public.properties p
where t.property_id = p.id
  and t.org_id is null
  and p.org_id is not null;

-- Header unit -> org
update public.transactions t
set org_id = u.org_id
from public.units u
where t.unit_id = u.id
  and t.org_id is null
  and u.org_id is not null;

-- Header lease -> org
update public.transactions t
set org_id = l.org_id
from public.lease l
where t.lease_id = l.id
  and t.org_id is null
  and l.org_id is not null;

-- Header bank_gl_account -> org
update public.transactions t
set org_id = ga.org_id
from public.gl_accounts ga
where t.bank_gl_account_id = ga.id
  and t.org_id is null
  and ga.org_id is not null;

-- Bill linkage -> org
update public.transactions t
set org_id = parent.org_id
from public.transactions parent
where t.bill_transaction_id = parent.id
  and t.org_id is null
  and parent.org_id is not null;

-- Lines (property) -> org
update public.transactions t
set org_id = src.org_id
from (
  select distinct on (tl.transaction_id) tl.transaction_id, p.org_id
  from public.transaction_lines tl
  join public.properties p on p.id = tl.property_id
  where p.org_id is not null
) src
where t.id = src.transaction_id
  and t.org_id is null;

-- Lines (unit) -> org
update public.transactions t
set org_id = src.org_id
from (
  select distinct on (tl.transaction_id) tl.transaction_id, u.org_id
  from public.transaction_lines tl
  join public.units u on u.id = tl.unit_id
  where u.org_id is not null
) src
where t.id = src.transaction_id
  and t.org_id is null;

-- Lines (lease) -> org
update public.transactions t
set org_id = src.org_id
from (
  select distinct on (tl.transaction_id) tl.transaction_id, l.org_id
  from public.transaction_lines tl
  join public.lease l on l.id = tl.lease_id
  where l.org_id is not null
) src
where t.id = src.transaction_id
  and t.org_id is null;

-- Lines (gl_account) -> org
update public.transactions t
set org_id = src.org_id
from (
  select distinct on (tl.transaction_id) tl.transaction_id, ga.org_id
  from public.transaction_lines tl
  join public.gl_accounts ga on ga.id = tl.gl_account_id
  where ga.org_id is not null
) src
where t.id = src.transaction_id
  and t.org_id is null;

-- If a single org exists, fill remaining nulls with it; otherwise abort before adding constraint
do $$
declare
  v_org uuid;
  v_org_count int;
  v_remaining int;
begin
  select count(*) into v_org_count from public.organizations;
  if v_org_count = 1 then
    select id into v_org from public.organizations limit 1;
    update public.transactions set org_id = v_org where org_id is null;
  end if;

  select count(*) into v_remaining from public.transactions where org_id is null;
  if v_remaining > 0 then
    raise exception 'transactions.org_id is still null for % row(s); backfill required before enforcing NOT NULL', v_remaining;
  end if;
end $$;

alter table public.transactions
  alter column org_id set not null;

-- Explicit guard for Bills (redundant with NOT NULL, but documents intent)
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_transactions_bill_requires_org'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint chk_transactions_bill_requires_org
      check (transaction_type <> 'Bill' or org_id is not null)
      not valid;
  end if;
end $$;

alter table public.transactions validate constraint chk_transactions_bill_requires_org;

commit;

-- Rollback guidance (manual):
--   alter table public.transactions drop constraint if exists chk_transactions_bill_requires_org;
--   alter table public.transactions alter column org_id drop not null;
--   drop function if exists public.resolve_ap_gl_account_id(uuid);
--   drop index if exists idx_organizations_ap_gl_account_id;
--   alter table public.organizations drop column if exists ap_gl_account_id;
