-- 1) Add org_id to additional domain tables (nullable for backfill)
alter table public.owners         add column if not exists org_id uuid references public.organizations(id) on delete restrict;
alter table public.ownerships     add column if not exists org_id uuid references public.organizations(id) on delete restrict;
alter table public.bank_accounts  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
alter table public.gl_accounts    add column if not exists org_id uuid references public.organizations(id) on delete restrict;
alter table public.transactions   add column if not exists org_id uuid references public.organizations(id) on delete restrict;
alter table public.work_orders    add column if not exists org_id uuid references public.organizations(id) on delete restrict;
alter table public.tenants        add column if not exists org_id uuid references public.organizations(id) on delete restrict;
alter table public.lease_contacts add column if not exists org_id uuid references public.organizations(id) on delete restrict;

-- Optional: map portal users directly
alter table public.owners  add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.tenants add column if not exists user_id uuid references auth.users(id) on delete set null;

-- 2) Indexes for scoping
create index if not exists idx_owners_org          on public.owners(org_id);
create index if not exists idx_ownerships_org      on public.ownerships(org_id);
create index if not exists idx_bank_accounts_org   on public.bank_accounts(org_id);
create index if not exists idx_gl_accounts_org     on public.gl_accounts(org_id);
create index if not exists idx_transactions_org    on public.transactions(org_id);
create index if not exists idx_work_orders_org     on public.work_orders(org_id);
create index if not exists idx_tenants_org         on public.tenants(org_id);
create index if not exists idx_lease_contacts_org  on public.lease_contacts(org_id);

-- 3) Enable RLS
alter table public.owners         enable row level security;
alter table public.ownerships     enable row level security;
alter table public.bank_accounts  enable row level security;
alter table public.gl_accounts    enable row level security;
alter table public.transactions   enable row level security;
alter table public.work_orders    enable row level security;
alter table public.tenants        enable row level security;
alter table public.lease_contacts enable row level security;

-- 4) Drop permissive default policies where present
do $$ begin
  -- Owners
  if exists (select 1 from pg_policies where schemaname='public' and tablename='owners' and policyname='Enable read access for all users') then
    drop policy "Enable read access for all users" on public.owners; end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='owners' and policyname='Enable insert access for authenticated users') then
    drop policy "Enable insert access for authenticated users" on public.owners; end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='owners' and policyname='Enable update access for authenticated users') then
    drop policy "Enable update access for authenticated users" on public.owners; end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='owners' and policyname='Enable delete access for authenticated users') then
    drop policy "Enable delete access for authenticated users" on public.owners; end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='owners' and policyname='Owners read policy') then
    drop policy "Owners read policy" on public.owners; end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='owners' and policyname='Owners insert policy') then
    drop policy "Owners insert policy" on public.owners; end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='owners' and policyname='Owners update policy') then
    drop policy "Owners update policy" on public.owners; end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='owners' and policyname='Owners delete policy') then
    drop policy "Owners delete policy" on public.owners; end if;

  -- Ownerships
  if exists (select 1 from pg_policies where schemaname='public' and tablename='ownerships' and policyname='Ownerships read policy') then
    drop policy "Ownerships read policy" on public.ownerships; end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='ownerships' and policyname='Ownerships insert policy') then
    drop policy "Ownerships insert policy" on public.ownerships; end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='ownerships' and policyname='Ownerships update policy') then
    drop policy "Ownerships update policy" on public.ownerships; end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='ownerships' and policyname='Ownerships delete policy') then
    drop policy "Ownerships delete policy" on public.ownerships; end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='ownerships' and policyname='ownerships_read_policy') then
    drop policy "ownerships_read_policy" on public.ownerships; end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='ownerships' and policyname='ownerships_insert_policy') then
    drop policy "ownerships_insert_policy" on public.ownerships; end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='ownerships' and policyname='ownerships_update_policy') then
    drop policy "ownerships_update_policy" on public.ownerships; end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='ownerships' and policyname='ownerships_delete_policy') then
    drop policy "ownerships_delete_policy" on public.ownerships; end if;
end $$;

-- 5) Org-scoped policies (read = any org member; write = managers/admins)
-- Owners
drop policy if exists "owners_read_in_org" on public.owners;
create policy "owners_read_in_org" on public.owners
for select using (
  exists (
    select 1 from public.org_memberships m
    where m.user_id = auth.uid() and m.org_id = owners.org_id
  )
);

drop policy if exists "owners_write_admins" on public.owners;
create policy "owners_write_admins" on public.owners
for insert with check (
  exists (
    select 1 from public.org_memberships m
    where m.user_id = auth.uid() and m.org_id = owners.org_id and m.role in ('org_admin','org_manager','platform_admin')
  )
);
drop policy if exists "owners_update_admins" on public.owners;
create policy "owners_update_admins" on public.owners
for update using (
  exists (
    select 1 from public.org_memberships m
    where m.user_id = auth.uid() and m.org_id = owners.org_id and m.role in ('org_admin','org_manager','platform_admin')
  )
);

-- Ownerships (join table)
drop policy if exists "ownerships_read_in_org" on public.ownerships;
create policy "ownerships_read_in_org" on public.ownerships
for select using (
  exists (
    select 1 from public.org_memberships m
    where m.user_id = auth.uid() and m.org_id = ownerships.org_id
  )
);
drop policy if exists "ownerships_write_admins" on public.ownerships;
create policy "ownerships_write_admins" on public.ownerships
for insert with check (
  exists (
    select 1 from public.org_memberships m
    where m.user_id = auth.uid() and m.org_id = ownerships.org_id and m.role in ('org_admin','org_manager','platform_admin')
  )
);
drop policy if exists "ownerships_update_admins" on public.ownerships;
create policy "ownerships_update_admins" on public.ownerships
for update using (
  exists (
    select 1 from public.org_memberships m
    where m.user_id = auth.uid() and m.org_id = ownerships.org_id and m.role in ('org_admin','org_manager','platform_admin')
  )
);

-- Bank accounts
drop policy if exists "bank_accounts_read_in_org" on public.bank_accounts;
create policy "bank_accounts_read_in_org" on public.bank_accounts
for select using (exists (select 1 from public.org_memberships m where m.user_id = auth.uid() and m.org_id = bank_accounts.org_id));
drop policy if exists "bank_accounts_write_admins" on public.bank_accounts;
create policy "bank_accounts_write_admins" on public.bank_accounts
for insert with check (exists (select 1 from public.org_memberships m where m.user_id = auth.uid() and m.org_id = bank_accounts.org_id and m.role in ('org_admin','org_manager','platform_admin')));
drop policy if exists "bank_accounts_update_admins" on public.bank_accounts;
create policy "bank_accounts_update_admins" on public.bank_accounts
for update using (exists (select 1 from public.org_memberships m where m.user_id = auth.uid() and m.org_id = bank_accounts.org_id and m.role in ('org_admin','org_manager','platform_admin')));

-- GL accounts
drop policy if exists "gl_accounts_read_in_org" on public.gl_accounts;
create policy "gl_accounts_read_in_org" on public.gl_accounts
for select using (exists (select 1 from public.org_memberships m where m.user_id = auth.uid() and m.org_id = gl_accounts.org_id));
drop policy if exists "gl_accounts_write_admins" on public.gl_accounts;
create policy "gl_accounts_write_admins" on public.gl_accounts
for insert with check (exists (select 1 from public.org_memberships m where m.user_id = auth.uid() and m.org_id = gl_accounts.org_id and m.role in ('org_admin','org_manager','platform_admin')));
drop policy if exists "gl_accounts_update_admins" on public.gl_accounts;
create policy "gl_accounts_update_admins" on public.gl_accounts
for update using (exists (select 1 from public.org_memberships m where m.user_id = auth.uid() and m.org_id = gl_accounts.org_id and m.role in ('org_admin','org_manager','platform_admin')));

-- Transactions
drop policy if exists "transactions_read_in_org" on public.transactions;
create policy "transactions_read_in_org" on public.transactions
for select using (exists (select 1 from public.org_memberships m where m.user_id = auth.uid() and m.org_id = transactions.org_id));
drop policy if exists "transactions_write_admins" on public.transactions;
create policy "transactions_write_admins" on public.transactions
for insert with check (exists (select 1 from public.org_memberships m where m.user_id = auth.uid() and m.org_id = transactions.org_id and m.role in ('org_admin','org_manager','platform_admin')));
drop policy if exists "transactions_update_admins" on public.transactions;
create policy "transactions_update_admins" on public.transactions
for update using (exists (select 1 from public.org_memberships m where m.user_id = auth.uid() and m.org_id = transactions.org_id and m.role in ('org_admin','org_manager','platform_admin')));

-- Work orders
drop policy if exists "work_orders_read_in_org" on public.work_orders;
create policy "work_orders_read_in_org" on public.work_orders
for select using (exists (select 1 from public.org_memberships m where m.user_id = auth.uid() and m.org_id = work_orders.org_id));
drop policy if exists "work_orders_write_admins" on public.work_orders;
create policy "work_orders_write_admins" on public.work_orders
for insert with check (exists (select 1 from public.org_memberships m where m.user_id = auth.uid() and m.org_id = work_orders.org_id and m.role in ('org_admin','org_manager','platform_admin')));
drop policy if exists "work_orders_update_admins" on public.work_orders;
create policy "work_orders_update_admins" on public.work_orders
for update using (exists (select 1 from public.org_memberships m where m.user_id = auth.uid() and m.org_id = work_orders.org_id and m.role in ('org_admin','org_manager','platform_admin')));

-- Tenants
drop policy if exists "tenants_read_in_org" on public.tenants;
create policy "tenants_read_in_org" on public.tenants
for select using (exists (select 1 from public.org_memberships m where m.user_id = auth.uid() and m.org_id = tenants.org_id));
drop policy if exists "tenants_write_admins" on public.tenants;
create policy "tenants_write_admins" on public.tenants
for insert with check (exists (select 1 from public.org_memberships m where m.user_id = auth.uid() and m.org_id = tenants.org_id and m.role in ('org_admin','org_manager','platform_admin')));
drop policy if exists "tenants_update_admins" on public.tenants;
create policy "tenants_update_admins" on public.tenants
for update using (exists (select 1 from public.org_memberships m where m.user_id = auth.uid() and m.org_id = tenants.org_id and m.role in ('org_admin','org_manager','platform_admin')));

-- Lease contacts (tenant linkage)
drop policy if exists "lease_contacts_read_in_org" on public.lease_contacts;
create policy "lease_contacts_read_in_org" on public.lease_contacts
for select using (exists (select 1 from public.org_memberships m where m.user_id = auth.uid() and m.org_id = lease_contacts.org_id));
drop policy if exists "lease_contacts_write_admins" on public.lease_contacts;
create policy "lease_contacts_write_admins" on public.lease_contacts
for insert with check (exists (select 1 from public.org_memberships m where m.user_id = auth.uid() and m.org_id = lease_contacts.org_id and m.role in ('org_admin','org_manager','platform_admin')));
drop policy if exists "lease_contacts_update_admins" on public.lease_contacts;
create policy "lease_contacts_update_admins" on public.lease_contacts
for update using (exists (select 1 from public.org_memberships m where m.user_id = auth.uid() and m.org_id = lease_contacts.org_id and m.role in ('org_admin','org_manager','platform_admin')));

-- 6) Portal scoping
-- Owners: allow owner_portal users to read their own owner row
drop policy if exists "owners_self" on public.owners;
create policy "owners_self" on public.owners
for select using (
  (auth.uid() is not null and owners.user_id = auth.uid())
  or exists (
    select 1 from public.org_memberships m
    where m.user_id = auth.uid() and m.org_id = owners.org_id
  )
);

-- Properties visible to owner via ownerships link (additional select-only access)
drop policy if exists "properties_visible_to_owner" on public.properties;
create policy "properties_visible_to_owner" on public.properties
for select using (
  exists (
    select 1
    from public.ownerships po
    join public.owners o on o.id = po.owner_id
    where po.property_id = properties.id
      and o.user_id = auth.uid()
  )
);

-- Tenants portal: see own lease_contacts rows (if user_id mapped)
drop policy if exists "lease_contacts_visible_to_tenant" on public.lease_contacts;
create policy "lease_contacts_visible_to_tenant" on public.lease_contacts
for select using (
  exists (
    select 1 from public.tenants t
    where t.id = lease_contacts.tenant_id and t.user_id = auth.uid()
  )
);

-- 7) Harden org_memberships (admin can manage within org)
drop policy if exists "memberships_self_read" on public.org_memberships;
create policy "memberships_self_read" on public.org_memberships
for select using (user_id = auth.uid());

drop policy if exists "memberships_admin_read" on public.org_memberships;
create policy "memberships_admin_read" on public.org_memberships
for select using (
  exists (
    select 1 from public.org_memberships m
    where m.user_id = auth.uid()
      and m.org_id = org_memberships.org_id
      and m.role in ('org_admin','platform_admin')
  )
);

drop policy if exists "memberships_admin_write" on public.org_memberships;
create policy "memberships_admin_write" on public.org_memberships
for insert with check (
  exists (
    select 1 from public.org_memberships m
    where m.user_id = auth.uid()
      and m.org_id = org_memberships.org_id
      and m.role in ('org_admin','platform_admin')
  )
);

drop policy if exists "memberships_admin_update" on public.org_memberships;
create policy "memberships_admin_update" on public.org_memberships
for update using (
  exists (
    select 1 from public.org_memberships m
    where m.user_id = auth.uid()
      and m.org_id = org_memberships.org_id
      and m.role in ('org_admin','platform_admin')
  )
);

-- 8) JWT helper for SSR: get my claims
create or replace function public.get_my_claims()
returns jsonb language sql stable security definer as $$
  select public.jwt_custom_claims();
$$;

-- 9) Storage isolation (only if storage.objects exists); using org/{org_id}/... convention in bucket 'app'
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'objects'
  ) then
    begin
      execute 'drop policy if exists "storage_read_org" on storage.objects';
      execute 'create policy "storage_read_org" on storage.objects
        for select using (
          bucket_id = ''app'' and exists (
            select 1 from public.org_memberships m
            where m.user_id = auth.uid()
              and m.org_id::text = split_part(storage.objects.name, ''/'', 2)
          )
        )';
    exception when others then null; end;

    begin
      execute 'drop policy if exists "storage_write_org" on storage.objects';
      execute 'create policy "storage_write_org" on storage.objects
        for insert with check (
          bucket_id = ''app'' and exists (
            select 1 from public.org_memberships m
            where m.user_id = auth.uid()
              and m.org_id::text = split_part(name, ''/'', 2)
              and m.role in (''org_admin'',''org_manager'',''platform_admin'')
          )
        )';
    exception when others then null; end;
  end if;
end $$;

-- 10) Note: After backfill, enforce NOT NULL on org_id columns (run separately):
-- alter table public.owners         alter column org_id set not null;
-- alter table public.ownerships     alter column org_id set not null;
-- alter table public.bank_accounts  alter column org_id set not null;
-- alter table public.gl_accounts    alter column org_id set not null;
-- alter table public.transactions   alter column org_id set not null;
-- alter table public.work_orders    alter column org_id set not null;
-- alter table public.tenants        alter column org_id set not null;
-- alter table public.lease_contacts alter column org_id set not null;
