-- Phase 7: Refresh core RLS policies to use RBAC helpers (no org_memberships.role dependency)

begin;

-- Helper function to conditionally create org-scoped RLS policies
create or replace function public.create_org_policies_if_table_exists(
  p_table_name text,
  p_read_policy_name text,
  p_write_policy_name text,
  p_update_policy_name text,
  p_delete_policy_name text default null
)
returns void
language plpgsql
as $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = p_table_name
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = p_table_name and column_name = 'org_id'
  ) then
    execute format('drop policy if exists %I on public.%I', p_read_policy_name, p_table_name);
    execute format('drop policy if exists %I on public.%I', p_write_policy_name, p_table_name);
    execute format('drop policy if exists %I on public.%I', p_update_policy_name, p_table_name);
    if p_delete_policy_name is not null then
      execute format('drop policy if exists %I on public.%I', p_delete_policy_name, p_table_name);
    end if;
    
    execute format('create policy %I on public.%I for select using (public.is_org_member(auth.uid(), org_id))', p_read_policy_name, p_table_name);
    execute format('create policy %I on public.%I for insert with check (public.is_org_admin_or_manager(auth.uid(), org_id))', p_write_policy_name, p_table_name);
    execute format('create policy %I on public.%I for update using (public.is_org_admin_or_manager(auth.uid(), org_id))', p_update_policy_name, p_table_name);
    if p_delete_policy_name is not null then
      execute format('create policy %I on public.%I for delete using (public.is_org_admin_or_manager(auth.uid(), org_id))', p_delete_policy_name, p_table_name);
    end if;
  end if;
end;
$$;

-- Helpers
-- read: is_org_member
-- write/update/delete: is_org_admin_or_manager (or is_org_admin)

-- Apply policies conditionally (only if table exists and has org_id column)
select public.create_org_policies_if_table_exists('bank_accounts', 'bank_accounts_org_read', 'bank_accounts_org_write', 'bank_accounts_org_update');
select public.create_org_policies_if_table_exists('owners', 'owners_org_read', 'owners_org_write', 'owners_org_update');
select public.create_org_policies_if_table_exists('ownerships', 'ownerships_org_read', 'ownerships_org_write', 'ownerships_org_update');
select public.create_org_policies_if_table_exists('properties', 'properties_org_read', 'properties_org_write', 'properties_org_update');
select public.create_org_policies_if_table_exists('units', 'units_org_read', 'units_org_write', 'units_org_update');
select public.create_org_policies_if_table_exists('tenants', 'tenants_org_read', 'tenants_org_write', 'tenants_org_update');
select public.create_org_policies_if_table_exists('transactions', 'transactions_org_read', 'transactions_org_write', 'transactions_org_update');
select public.create_org_policies_if_table_exists('work_orders', 'work_orders_org_read', 'work_orders_org_write', 'work_orders_org_update');
select public.create_org_policies_if_table_exists('lease', 'lease_org_read', 'lease_org_write', 'lease_org_update', 'lease_org_delete');
select public.create_org_policies_if_table_exists('lease_contacts', 'lease_contacts_org_read', 'lease_contacts_org_write', 'lease_contacts_org_update');
select public.create_org_policies_if_table_exists('gl_accounts', 'gl_accounts_org_read', 'gl_accounts_org_write', 'gl_accounts_org_update');

-- Clean up helper function
drop function if exists public.create_org_policies_if_table_exists(text, text, text, text, text);

commit;
