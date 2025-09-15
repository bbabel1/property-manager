-- RLS Performance Fixes: avoid per-row evaluation of auth.* functions
-- Context: Supabase recommends replacing auth.*() in RLS expressions with
--          (select auth.*()) so the value is computed once per statement.
-- This migration is idempotent: it drops and recreates policies as needed.

-- =============================
-- 1) Initial-schema policies that used auth.role()
-- =============================

-- bank_accounts
drop policy if exists "Allow authenticated users to delete bank accounts" on public.bank_accounts;
create policy "Allow authenticated users to delete bank accounts" on public.bank_accounts
  for delete using ((select auth.role()) = 'authenticated');

-- tenants
drop policy if exists tenants_delete_policy on public.tenants;
create policy tenants_delete_policy on public.tenants
  for delete using ((select auth.role()) = 'authenticated');
drop policy if exists tenants_insert_policy on public.tenants;
create policy tenants_insert_policy on public.tenants
  for insert with check ((select auth.role()) = 'authenticated');
drop policy if exists tenants_read_policy on public.tenants;
create policy tenants_read_policy on public.tenants
  for select using ((select auth.role()) = 'authenticated');
drop policy if exists tenants_update_policy on public.tenants;
create policy tenants_update_policy on public.tenants
  for update using ((select auth.role()) = 'authenticated');

-- contacts
drop policy if exists contacts_delete_policy on public.contacts;
create policy contacts_delete_policy on public.contacts
  for delete using ((select auth.role()) = 'authenticated');
drop policy if exists contacts_insert_policy on public.contacts;
create policy contacts_insert_policy on public.contacts
  for insert with check ((select auth.role()) = 'authenticated');
drop policy if exists contacts_read_policy on public.contacts;
create policy contacts_read_policy on public.contacts
  for select using ((select auth.role()) = 'authenticated');
drop policy if exists contacts_update_policy on public.contacts;
create policy contacts_update_policy on public.contacts
  for update using ((select auth.role()) = 'authenticated');

-- gl_accounts
drop policy if exists gl_accounts_delete_policy on public.gl_accounts;
create policy gl_accounts_delete_policy on public.gl_accounts
  for delete using ((select auth.role()) = 'authenticated');

-- property_ownerships_cache
drop policy if exists property_ownerships_cache_delete_policy on public.property_ownerships_cache;
create policy property_ownerships_cache_delete_policy on public.property_ownerships_cache
  for delete using ((select auth.role()) = 'authenticated');
drop policy if exists property_ownerships_cache_insert_policy on public.property_ownerships_cache;
create policy property_ownerships_cache_insert_policy on public.property_ownerships_cache
  for insert with check ((select auth.role()) = 'authenticated');
drop policy if exists property_ownerships_cache_read_policy on public.property_ownerships_cache;
create policy property_ownerships_cache_read_policy on public.property_ownerships_cache
  for select using ((select auth.role()) = 'authenticated');
drop policy if exists property_ownerships_cache_update_policy on public.property_ownerships_cache;
create policy property_ownerships_cache_update_policy on public.property_ownerships_cache
  for update using ((select auth.role()) = 'authenticated');

-- tenant_notes (from later migration; also used auth.role())
drop policy if exists tenant_notes_read_policy on public.tenant_notes;
create policy tenant_notes_read_policy on public.tenant_notes
  for select using ((select auth.role()) = 'authenticated');
drop policy if exists tenant_notes_insert_policy on public.tenant_notes;
create policy tenant_notes_insert_policy on public.tenant_notes
  for insert with check ((select auth.role()) = 'authenticated');
drop policy if exists tenant_notes_update_policy on public.tenant_notes;
create policy tenant_notes_update_policy on public.tenant_notes
  for update using ((select auth.role()) = 'authenticated');
drop policy if exists tenant_notes_delete_policy on public.tenant_notes;
create policy tenant_notes_delete_policy on public.tenant_notes
  for delete using ((select auth.role()) = 'authenticated');

-- =============================
-- 2) Org-aware policies that used auth.uid()
--     Recreate them with (select auth.uid())
-- =============================

-- Owners
drop policy if exists "owners_read_in_org" on public.owners;
create policy "owners_read_in_org" on public.owners
  for select using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid()) and m.org_id = owners.org_id
    )
  );
drop policy if exists "owners_write_admins" on public.owners;
create policy "owners_write_admins" on public.owners
  for insert with check (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid())
        and m.org_id = owners.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );
drop policy if exists "owners_update_admins" on public.owners;
create policy "owners_update_admins" on public.owners
  for update using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid())
        and m.org_id = owners.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );

-- Ownerships
drop policy if exists "ownerships_read_in_org" on public.ownerships;
create policy "ownerships_read_in_org" on public.ownerships
  for select using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid()) and m.org_id = ownerships.org_id
    )
  );
drop policy if exists "ownerships_write_admins" on public.ownerships;
create policy "ownerships_write_admins" on public.ownerships
  for insert with check (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid())
        and m.org_id = ownerships.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );
drop policy if exists "ownerships_update_admins" on public.ownerships;
create policy "ownerships_update_admins" on public.ownerships
  for update using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid())
        and m.org_id = ownerships.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );

-- Bank accounts (org scoped)
drop policy if exists "bank_accounts_read_in_org" on public.bank_accounts;
create policy "bank_accounts_read_in_org" on public.bank_accounts
  for select using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid()) and m.org_id = bank_accounts.org_id
    )
  );
drop policy if exists "bank_accounts_write_admins" on public.bank_accounts;
create policy "bank_accounts_write_admins" on public.bank_accounts
  for insert with check (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid())
        and m.org_id = bank_accounts.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );
drop policy if exists "bank_accounts_update_admins" on public.bank_accounts;
create policy "bank_accounts_update_admins" on public.bank_accounts
  for update using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid())
        and m.org_id = bank_accounts.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );

-- GL accounts (org scoped)
drop policy if exists "gl_accounts_read_in_org" on public.gl_accounts;
create policy "gl_accounts_read_in_org" on public.gl_accounts
  for select using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid()) and m.org_id = gl_accounts.org_id
    )
  );
drop policy if exists "gl_accounts_write_admins" on public.gl_accounts;
create policy "gl_accounts_write_admins" on public.gl_accounts
  for insert with check (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid())
        and m.org_id = gl_accounts.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );
drop policy if exists "gl_accounts_update_admins" on public.gl_accounts;
create policy "gl_accounts_update_admins" on public.gl_accounts
  for update using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid())
        and m.org_id = gl_accounts.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );

-- Transactions (org scoped)
drop policy if exists "transactions_read_in_org" on public.transactions;
create policy "transactions_read_in_org" on public.transactions
  for select using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid()) and m.org_id = transactions.org_id
    )
  );
drop policy if exists "transactions_write_admins" on public.transactions;
create policy "transactions_write_admins" on public.transactions
  for insert with check (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid())
        and m.org_id = transactions.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );
drop policy if exists "transactions_update_admins" on public.transactions;
create policy "transactions_update_admins" on public.transactions
  for update using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid())
        and m.org_id = transactions.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );

-- Work orders (org scoped)
drop policy if exists "work_orders_read_in_org" on public.work_orders;
create policy "work_orders_read_in_org" on public.work_orders
  for select using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid()) and m.org_id = work_orders.org_id
    )
  );
drop policy if exists "work_orders_write_admins" on public.work_orders;
create policy "work_orders_write_admins" on public.work_orders
  for insert with check (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid())
        and m.org_id = work_orders.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );
drop policy if exists "work_orders_update_admins" on public.work_orders;
create policy "work_orders_update_admins" on public.work_orders
  for update using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid())
        and m.org_id = work_orders.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );

-- Tenants (org scoped policies added later; keep alongside initial role-based policies)
drop policy if exists "tenants_read_in_org" on public.tenants;
create policy "tenants_read_in_org" on public.tenants
  for select using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid()) and m.org_id = tenants.org_id
    )
  );
drop policy if exists "tenants_write_admins" on public.tenants;
create policy "tenants_write_admins" on public.tenants
  for insert with check (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid())
        and m.org_id = tenants.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );
drop policy if exists "tenants_update_admins" on public.tenants;
create policy "tenants_update_admins" on public.tenants
  for update using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid())
        and m.org_id = tenants.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );

-- Lease contacts (org scoped)
drop policy if exists "lease_contacts_read_in_org" on public.lease_contacts;
create policy "lease_contacts_read_in_org" on public.lease_contacts
  for select using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid()) and m.org_id = lease_contacts.org_id
    )
  );
drop policy if exists "lease_contacts_write_admins" on public.lease_contacts;
create policy "lease_contacts_write_admins" on public.lease_contacts
  for insert with check (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid())
        and m.org_id = lease_contacts.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );
drop policy if exists "lease_contacts_update_admins" on public.lease_contacts;
create policy "lease_contacts_update_admins" on public.lease_contacts
  for update using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid())
        and m.org_id = lease_contacts.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );

-- Portal scoping helpers
drop policy if exists "owners_self" on public.owners;
create policy "owners_self" on public.owners
  for select using (
    owners.user_id = (select auth.uid())
    or exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid()) and m.org_id = owners.org_id
    )
  );

drop policy if exists "properties_visible_to_owner" on public.properties;
create policy "properties_visible_to_owner" on public.properties
  for select using (
    exists (
      select 1
      from public.ownerships po
      join public.owners o on o.id = po.owner_id
      where po.property_id = properties.id
        and o.user_id = (select auth.uid())
    )
  );

drop policy if exists "lease_contacts_visible_to_tenant" on public.lease_contacts;
create policy "lease_contacts_visible_to_tenant" on public.lease_contacts
  for select using (
    exists (
      select 1 from public.tenants t
      where t.id = lease_contacts.tenant_id and t.user_id = (select auth.uid())
    )
  );

-- org_memberships self and admin policies
drop policy if exists "memberships_self_read" on public.org_memberships;
create policy "memberships_self_read" on public.org_memberships
  for select using (user_id = (select auth.uid()));

drop policy if exists "memberships_admin_read" on public.org_memberships;
create policy "memberships_admin_read" on public.org_memberships
  for select using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid())
        and m.org_id = org_memberships.org_id
        and m.role in ('org_admin','platform_admin')
    )
  );

drop policy if exists "memberships_admin_write" on public.org_memberships;
create policy "memberships_admin_write" on public.org_memberships
  for insert with check (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid())
        and m.org_id = org_memberships.org_id
        and m.role in ('org_admin','platform_admin')
    )
  );

drop policy if exists "memberships_admin_update" on public.org_memberships;
create policy "memberships_admin_update" on public.org_memberships
  for update using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = (select auth.uid())
        and m.org_id = org_memberships.org_id
        and m.role in ('org_admin','platform_admin')
    )
  );

-- storage.objects dynamic policies (if table exists)
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
            where m.user_id = (select auth.uid())
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
            where m.user_id = (select auth.uid())
              and m.org_id::text = split_part(name, ''/'', 2)
              and m.role in (''org_admin'',''org_manager'',''platform_admin'')
          )
        )';
    exception when others then null; end;
  end if;
end $$;

-- =============================
-- 3) Profile and membership helpers from RBAC migration
-- =============================

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using ((select auth.uid()) = user_id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using ((select auth.uid()) = user_id);

drop policy if exists "select my memberships" on public.org_memberships;
create policy "select my memberships" on public.org_memberships
  for select using ((select auth.uid()) = user_id);

