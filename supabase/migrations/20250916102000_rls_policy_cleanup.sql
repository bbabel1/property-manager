-- RLS policy cleanup to reduce permissive duplicates and fix auth.* evaluation
-- Goal: clear "Multiple Permissive Policies" and "Auth RLS Initialization Plan" warnings
-- Safe to run repeatedly; all drops are IF EXISTS.

-- 1) Bank accounts: remove legacy permissive defaults (superseded by org-aware policies)
drop policy if exists "Enable read access for all users" on public.bank_accounts;
drop policy if exists "Enable insert access for authenticated users" on public.bank_accounts;
drop policy if exists "Enable update access for authenticated users" on public.bank_accounts;
drop policy if exists "Enable delete access for authenticated users" on public.bank_accounts;

-- 2) Owners/Properties/Units/Work Orders: drop legacy permissive defaults
drop policy if exists "Enable read access for all users" on public.owners;
drop policy if exists "Enable insert access for authenticated users" on public.owners;
drop policy if exists "Enable update access for authenticated users" on public.owners;
drop policy if exists "Enable delete access for authenticated users" on public.owners;

drop policy if exists "Enable read access for all users" on public.properties;
drop policy if exists "Enable insert access for authenticated users" on public.properties;
drop policy if exists "Enable update access for authenticated users" on public.properties;
drop policy if exists "Enable delete access for authenticated users" on public.properties;

drop policy if exists "Enable read access for all users" on public.units;
drop policy if exists "Enable insert access for authenticated users" on public.units;
drop policy if exists "Enable update access for authenticated users" on public.units;
drop policy if exists "Enable delete access for authenticated users" on public.units;

drop policy if exists "Enable read access for all users" on public.work_orders;
drop policy if exists "Enable insert access for authenticated users" on public.work_orders;
drop policy if exists "Enable update access for authenticated users" on public.work_orders;
drop policy if exists "Enable delete access for authenticated users" on public.work_orders;

-- 3) Rent schedules: keep single consolidated policy; remove duplicates
drop policy if exists "rent_schedules_delete_policy" on public.rent_schedules;
drop policy if exists "rent_schedules_insert_policy" on public.rent_schedules;
drop policy if exists "rent_schedules_read_policy" on public.rent_schedules;
drop policy if exists "rent_schedules_update_policy" on public.rent_schedules;
-- Intentionally keep: "Allow all operations on rent_schedules"

-- 4) Reconciliation log: rebuild policy using (select auth.uid()) to avoid per-row evaluation
drop policy if exists rl_org_read on public.reconciliation_log;
create policy rl_org_read on public.reconciliation_log
for select using (
  exists (
    select 1
    from public.properties p
    join public.org_memberships m on m.org_id = p.org_id
    where p.id = reconciliation_log.property_id
      and m.user_id = (select auth.uid())
  )
);

-- 5) Sync operations: adjust auth.role usage to initialized form (no behavior change)
drop policy if exists "Service role can manage sync operations" on public.sync_operations;
create policy "Service role can manage sync operations" on public.sync_operations
  for all using ((select auth.role()) = 'service_role');

