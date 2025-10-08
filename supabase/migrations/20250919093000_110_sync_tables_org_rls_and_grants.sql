-- Tighten RLS and privileges for sync tables
-- - Scope access by org_id via org_memberships
-- - Restrict writes to elevated org roles
-- - Remove permissive USING (true) policies
-- - Revoke broad grants from anon/authenticated

set check_function_bodies = off;

-- 1) Ensure org_id columns exist for scoping
alter table if exists public.sync_operations
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists idx_sync_operations_org on public.sync_operations(org_id);

alter table if exists public.buildium_sync_status
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists idx_buildium_sync_status_org on public.buildium_sync_status(org_id);

alter table if exists public.buildium_sync_runs
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists idx_buildium_sync_runs_org on public.buildium_sync_runs(org_id);

alter table if exists public.buildium_webhook_events
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists idx_buildium_webhook_events_org on public.buildium_webhook_events(org_id);

-- 2) Enable RLS where missing
alter table if exists public.buildium_sync_runs enable row level security;

-- 3) Drop permissive/legacy policies if present
do $$
begin
  -- sync_operations legacy policies
  if exists (select 1 from pg_policies where schemaname='public' and tablename='sync_operations' and policyname='Users can view sync operations for their org') then
    execute 'drop policy "Users can view sync operations for their org" on public.sync_operations';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='sync_operations' and policyname='Service role can manage sync operations') then
    execute 'drop policy "Service role can manage sync operations" on public.sync_operations';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='sync_operations' and policyname='sync_operations_consolidated_all') then
    execute 'drop policy "sync_operations_consolidated_all" on public.sync_operations';
  end if;

  -- buildium_sync_status permissive policies
  if exists (select 1 from pg_policies where schemaname='public' and tablename='buildium_sync_status' and policyname='Enable read access for all users') then
    execute 'drop policy "Enable read access for all users" on public.buildium_sync_status';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='buildium_sync_status' and policyname='Enable insert access for authenticated users') then
    execute 'drop policy "Enable insert access for authenticated users" on public.buildium_sync_status';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='buildium_sync_status' and policyname='Enable update access for authenticated users') then
    execute 'drop policy "Enable update access for authenticated users" on public.buildium_sync_status';
  end if;

  -- buildium_webhook_events permissive policies
  if exists (select 1 from pg_policies where schemaname='public' and tablename='buildium_webhook_events' and policyname='Enable read access for all users') then
    execute 'drop policy "Enable read access for all users" on public.buildium_webhook_events';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='buildium_webhook_events' and policyname='Enable insert access for authenticated users') then
    execute 'drop policy "Enable insert access for authenticated users" on public.buildium_webhook_events';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='buildium_webhook_events' and policyname='Enable update access for authenticated users') then
    execute 'drop policy "Enable update access for authenticated users" on public.buildium_webhook_events';
  end if;
end $$;

-- 4) Create org-scoped RLS policies (read: org members; write: elevated roles)

-- sync_operations
drop policy if exists "sync_operations_read_in_org" on public.sync_operations;
create policy "sync_operations_read_in_org" on public.sync_operations
  for select using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = auth.uid() and m.org_id = sync_operations.org_id
    )
  );

drop policy if exists "sync_operations_insert_admins" on public.sync_operations;
create policy "sync_operations_insert_admins" on public.sync_operations
  for insert with check (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = auth.uid() and m.org_id = sync_operations.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );

drop policy if exists "sync_operations_update_admins" on public.sync_operations;
create policy "sync_operations_update_admins" on public.sync_operations
  for update using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = auth.uid() and m.org_id = sync_operations.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );

drop policy if exists "sync_operations_delete_admins" on public.sync_operations;
create policy "sync_operations_delete_admins" on public.sync_operations
  for delete using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = auth.uid() and m.org_id = sync_operations.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );

drop policy if exists "sync_operations_service_role_all" on public.sync_operations;
create policy "sync_operations_service_role_all" on public.sync_operations
  for all using ((select auth.role()) = 'service_role');

-- buildium_sync_status
drop policy if exists "buildium_sync_status_read_in_org" on public.buildium_sync_status;
create policy "buildium_sync_status_read_in_org" on public.buildium_sync_status
  for select using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = auth.uid() and m.org_id = buildium_sync_status.org_id
    )
  );

drop policy if exists "buildium_sync_status_insert_admins" on public.buildium_sync_status;
create policy "buildium_sync_status_insert_admins" on public.buildium_sync_status
  for insert with check (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = auth.uid() and m.org_id = buildium_sync_status.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );

drop policy if exists "buildium_sync_status_update_admins" on public.buildium_sync_status;
create policy "buildium_sync_status_update_admins" on public.buildium_sync_status
  for update using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = auth.uid() and m.org_id = buildium_sync_status.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );

drop policy if exists "buildium_sync_status_delete_admins" on public.buildium_sync_status;
create policy "buildium_sync_status_delete_admins" on public.buildium_sync_status
  for delete using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = auth.uid() and m.org_id = buildium_sync_status.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );

drop policy if exists "buildium_sync_status_service_role_all" on public.buildium_sync_status;
create policy "buildium_sync_status_service_role_all" on public.buildium_sync_status
  for all using ((select auth.role()) = 'service_role');

-- buildium_sync_runs
drop policy if exists "buildium_sync_runs_read_in_org" on public.buildium_sync_runs;
create policy "buildium_sync_runs_read_in_org" on public.buildium_sync_runs
  for select using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = auth.uid() and m.org_id = buildium_sync_runs.org_id
    )
  );

drop policy if exists "buildium_sync_runs_insert_admins" on public.buildium_sync_runs;
create policy "buildium_sync_runs_insert_admins" on public.buildium_sync_runs
  for insert with check (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = auth.uid() and m.org_id = buildium_sync_runs.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );

drop policy if exists "buildium_sync_runs_update_admins" on public.buildium_sync_runs;
create policy "buildium_sync_runs_update_admins" on public.buildium_sync_runs
  for update using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = auth.uid() and m.org_id = buildium_sync_runs.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );

drop policy if exists "buildium_sync_runs_delete_admins" on public.buildium_sync_runs;
create policy "buildium_sync_runs_delete_admins" on public.buildium_sync_runs
  for delete using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = auth.uid() and m.org_id = buildium_sync_runs.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );

drop policy if exists "buildium_sync_runs_service_role_all" on public.buildium_sync_runs;
create policy "buildium_sync_runs_service_role_all" on public.buildium_sync_runs
  for all using ((select auth.role()) = 'service_role');

-- buildium_webhook_events
alter table if exists public.buildium_webhook_events enable row level security;

drop policy if exists "buildium_webhook_events_read_in_org" on public.buildium_webhook_events;
create policy "buildium_webhook_events_read_in_org" on public.buildium_webhook_events
  for select using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = auth.uid() and m.org_id = buildium_webhook_events.org_id
    )
  );

drop policy if exists "buildium_webhook_events_insert_admins" on public.buildium_webhook_events;
create policy "buildium_webhook_events_insert_admins" on public.buildium_webhook_events
  for insert with check (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = auth.uid() and m.org_id = buildium_webhook_events.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );

drop policy if exists "buildium_webhook_events_update_admins" on public.buildium_webhook_events;
create policy "buildium_webhook_events_update_admins" on public.buildium_webhook_events
  for update using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = auth.uid() and m.org_id = buildium_webhook_events.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );

drop policy if exists "buildium_webhook_events_delete_admins" on public.buildium_webhook_events;
create policy "buildium_webhook_events_delete_admins" on public.buildium_webhook_events
  for delete using (
    exists (
      select 1 from public.org_memberships m
      where m.user_id = auth.uid() and m.org_id = buildium_webhook_events.org_id
        and m.role in ('org_admin','org_manager','platform_admin')
    )
  );

drop policy if exists "buildium_webhook_events_service_role_all" on public.buildium_webhook_events;
create policy "buildium_webhook_events_service_role_all" on public.buildium_webhook_events
  for all using ((select auth.role()) = 'service_role');

-- 5) Revoke broad grants and only allow minimal SELECT for authenticated, full for service_role
do $$
begin
  -- sync_operations
  execute 'revoke all on table public.sync_operations from anon';
  execute 'revoke all on table public.sync_operations from authenticated';
  execute 'grant select on table public.sync_operations to authenticated';
  execute 'grant all on table public.sync_operations to service_role';

  -- buildium_sync_status
  execute 'revoke all on table public.buildium_sync_status from anon';
  execute 'revoke all on table public.buildium_sync_status from authenticated';
  execute 'grant select on table public.buildium_sync_status to authenticated';
  execute 'grant all on table public.buildium_sync_status to service_role';

  -- buildium_sync_runs
  execute 'revoke all on table public.buildium_sync_runs from anon';
  execute 'revoke all on table public.buildium_sync_runs from authenticated';
  execute 'grant select on table public.buildium_sync_runs to authenticated';
  execute 'grant all on table public.buildium_sync_runs to service_role';

  -- buildium_webhook_events
  execute 'revoke all on table public.buildium_webhook_events from anon';
  execute 'revoke all on table public.buildium_webhook_events from authenticated';
  execute 'grant select on table public.buildium_webhook_events to authenticated';
  execute 'grant all on table public.buildium_webhook_events to service_role';
end $$;

-- Note: backfilling org_id for existing rows is left to a dedicated data migration
-- once mapping between buildium_id/local_id and organizations is established.
