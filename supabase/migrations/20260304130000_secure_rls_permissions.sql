-- Harden RLS and privileges for permission profiles and monthly log task rules

-- Ensure RLS is enabled
alter table if exists public.permission_profiles enable row level security;
alter table if exists public.permission_profile_permissions enable row level security;
alter table if exists public.user_permission_profiles enable row level security;
alter table if exists public.monthly_log_task_rules enable row level security;
alter table if exists public.monthly_log_task_rule_runs enable row level security;
alter table if exists public.monthly_logs enable row level security;

-- Drop legacy permissive policies if they remain on core tables
do $$
begin
  -- tasks
  perform 1 from pg_policies where schemaname='public' and tablename='tasks' and policyname='Enable read access for all users';
  if found then drop policy "Enable read access for all users" on public.tasks; end if;
  perform 1 from pg_policies where schemaname='public' and tablename='tasks' and policyname='Enable insert access for authenticated users';
  if found then drop policy "Enable insert access for authenticated users" on public.tasks; end if;
  perform 1 from pg_policies where schemaname='public' and tablename='tasks' and policyname='Enable update access for authenticated users';
  if found then drop policy "Enable update access for authenticated users" on public.tasks; end if;

  -- staff
  perform 1 from pg_policies where schemaname='public' and tablename='staff' and policyname='Enable read access for all users';
  if found then drop policy "Enable read access for all users" on public.staff; end if;
  perform 1 from pg_policies where schemaname='public' and tablename='staff' and policyname='Enable insert access for authenticated users';
  if found then drop policy "Enable insert access for authenticated users" on public.staff; end if;
  perform 1 from pg_policies where schemaname='public' and tablename='staff' and policyname='Enable update access for authenticated users';
  if found then drop policy "Enable update access for authenticated users" on public.staff; end if;

  -- lease
  perform 1 from pg_policies where schemaname='public' and tablename='lease' and policyname='Enable read access for all users';
  if found then drop policy "Enable read access for all users" on public.lease; end if;
  perform 1 from pg_policies where schemaname='public' and tablename='lease' and policyname='Enable insert access for authenticated users';
  if found then drop policy "Enable insert access for authenticated users" on public.lease; end if;
  perform 1 from pg_policies where schemaname='public' and tablename='lease' and policyname='Enable update access for authenticated users';
  if found then drop policy "Enable update access for authenticated users" on public.lease; end if;
end$$;

-- permission_profiles
drop policy if exists permission_profiles_read on public.permission_profiles;
drop policy if exists permission_profiles_write on public.permission_profiles;
drop policy if exists permission_profiles_update on public.permission_profiles;
drop policy if exists permission_profiles_delete on public.permission_profiles;

create policy permission_profiles_read on public.permission_profiles
for select using (
  (org_id is null and public.is_platform_admin(auth.uid()))
  or (org_id is not null and public.is_org_member(auth.uid(), org_id))
);

create policy permission_profiles_write on public.permission_profiles
for insert with check (
  org_id is not null
  and (
    public.is_org_admin_or_manager(auth.uid(), org_id)
    or public.is_platform_admin(auth.uid())
  )
);

create policy permission_profiles_update on public.permission_profiles
for update using (
  (org_id is null and public.is_platform_admin(auth.uid()))
  or (org_id is not null and public.is_org_admin_or_manager(auth.uid(), org_id))
) with check (
  org_id is not null
  and (
    public.is_org_admin_or_manager(auth.uid(), org_id)
    or public.is_platform_admin(auth.uid())
  )
);

create policy permission_profiles_delete on public.permission_profiles
for delete using (
  (org_id is null and public.is_platform_admin(auth.uid()))
  or (org_id is not null and public.is_org_admin_or_manager(auth.uid(), org_id))
);

-- permission_profile_permissions
drop policy if exists permission_profile_permissions_read on public.permission_profile_permissions;
drop policy if exists permission_profile_permissions_write on public.permission_profile_permissions;
drop policy if exists permission_profile_permissions_update on public.permission_profile_permissions;
drop policy if exists permission_profile_permissions_delete on public.permission_profile_permissions;

create policy permission_profile_permissions_read on public.permission_profile_permissions
for select using (
  exists (
    select 1 from public.permission_profiles p
    where p.id = permission_profile_permissions.profile_id
      and (
        (p.org_id is null and public.is_platform_admin(auth.uid()))
        or (p.org_id is not null and public.is_org_member(auth.uid(), p.org_id))
      )
  )
);

create policy permission_profile_permissions_write on public.permission_profile_permissions
for insert with check (
  exists (
    select 1 from public.permission_profiles p
    where p.id = permission_profile_permissions.profile_id
      and p.org_id is not null
      and (
        public.is_org_admin_or_manager(auth.uid(), p.org_id)
        or public.is_platform_admin(auth.uid())
      )
  )
);

create policy permission_profile_permissions_update on public.permission_profile_permissions
for update using (
  exists (
    select 1 from public.permission_profiles p
    where p.id = permission_profile_permissions.profile_id
      and (
        (p.org_id is null and public.is_platform_admin(auth.uid()))
        or (p.org_id is not null and public.is_org_admin_or_manager(auth.uid(), p.org_id))
      )
  )
) with check (
  exists (
    select 1 from public.permission_profiles p
    where p.id = permission_profile_permissions.profile_id
      and p.org_id is not null
      and (
        public.is_org_admin_or_manager(auth.uid(), p.org_id)
        or public.is_platform_admin(auth.uid())
      )
  )
);

create policy permission_profile_permissions_delete on public.permission_profile_permissions
for delete using (
  exists (
    select 1 from public.permission_profiles p
    where p.id = permission_profile_permissions.profile_id
      and (
        (p.org_id is null and public.is_platform_admin(auth.uid()))
        or (p.org_id is not null and public.is_org_admin_or_manager(auth.uid(), p.org_id))
      )
  )
);

-- user_permission_profiles
drop policy if exists user_permission_profiles_read on public.user_permission_profiles;
drop policy if exists user_permission_profiles_write on public.user_permission_profiles;
drop policy if exists user_permission_profiles_update on public.user_permission_profiles;
drop policy if exists user_permission_profiles_delete on public.user_permission_profiles;

create policy user_permission_profiles_read on public.user_permission_profiles
for select using (
  public.is_org_member(auth.uid(), user_permission_profiles.org_id)
);

create policy user_permission_profiles_write on public.user_permission_profiles
for insert with check (
  public.is_org_admin_or_manager(auth.uid(), user_permission_profiles.org_id)
  or public.is_platform_admin(auth.uid())
);

create policy user_permission_profiles_update on public.user_permission_profiles
for update using (
  public.is_org_admin_or_manager(auth.uid(), user_permission_profiles.org_id)
  or public.is_platform_admin(auth.uid())
) with check (
  public.is_org_admin_or_manager(auth.uid(), user_permission_profiles.org_id)
  or public.is_platform_admin(auth.uid())
);

create policy user_permission_profiles_delete on public.user_permission_profiles
for delete using (
  public.is_org_admin_or_manager(auth.uid(), user_permission_profiles.org_id)
  or public.is_platform_admin(auth.uid())
);

-- monthly_log_task_rules
drop policy if exists monthly_log_task_rules_read on public.monthly_log_task_rules;
drop policy if exists monthly_log_task_rules_write on public.monthly_log_task_rules;
drop policy if exists monthly_log_task_rules_update on public.monthly_log_task_rules;
drop policy if exists monthly_log_task_rules_delete on public.monthly_log_task_rules;

create policy monthly_log_task_rules_read on public.monthly_log_task_rules
for select using (
  public.is_org_member(auth.uid(), monthly_log_task_rules.org_id)
);

create policy monthly_log_task_rules_write on public.monthly_log_task_rules
for insert with check (
  public.is_org_admin_or_manager(auth.uid(), monthly_log_task_rules.org_id)
  or public.is_platform_admin(auth.uid())
);

create policy monthly_log_task_rules_update on public.monthly_log_task_rules
for update using (
  public.is_org_admin_or_manager(auth.uid(), monthly_log_task_rules.org_id)
  or public.is_platform_admin(auth.uid())
) with check (
  public.is_org_admin_or_manager(auth.uid(), monthly_log_task_rules.org_id)
  or public.is_platform_admin(auth.uid())
);

create policy monthly_log_task_rules_delete on public.monthly_log_task_rules
for delete using (
  public.is_org_admin_or_manager(auth.uid(), monthly_log_task_rules.org_id)
  or public.is_platform_admin(auth.uid())
);

-- monthly_log_task_rule_runs
drop policy if exists monthly_log_task_rule_runs_read on public.monthly_log_task_rule_runs;
drop policy if exists monthly_log_task_rule_runs_write on public.monthly_log_task_rule_runs;
drop policy if exists monthly_log_task_rule_runs_update on public.monthly_log_task_rule_runs;
drop policy if exists monthly_log_task_rule_runs_delete on public.monthly_log_task_rule_runs;

create policy monthly_log_task_rule_runs_read on public.monthly_log_task_rule_runs
for select using (
  exists (
    select 1 from public.monthly_log_task_rules r
    where r.id = monthly_log_task_rule_runs.rule_id
      and public.is_org_member(auth.uid(), r.org_id)
  )
);

create policy monthly_log_task_rule_runs_write on public.monthly_log_task_rule_runs
for insert with check (
  exists (
    select 1 from public.monthly_log_task_rules r
    where r.id = monthly_log_task_rule_runs.rule_id
      and (
        public.is_org_admin_or_manager(auth.uid(), r.org_id)
        or public.is_platform_admin(auth.uid())
      )
  )
);

create policy monthly_log_task_rule_runs_update on public.monthly_log_task_rule_runs
for update using (
  exists (
    select 1 from public.monthly_log_task_rules r
    where r.id = monthly_log_task_rule_runs.rule_id
      and (
        public.is_org_admin_or_manager(auth.uid(), r.org_id)
        or public.is_platform_admin(auth.uid())
      )
  )
) with check (
  exists (
    select 1 from public.monthly_log_task_rules r
    where r.id = monthly_log_task_rule_runs.rule_id
      and (
        public.is_org_admin_or_manager(auth.uid(), r.org_id)
        or public.is_platform_admin(auth.uid())
      )
  )
);

create policy monthly_log_task_rule_runs_delete on public.monthly_log_task_rule_runs
for delete using (
  exists (
    select 1 from public.monthly_log_task_rules r
    where r.id = monthly_log_task_rule_runs.rule_id
      and (
        public.is_org_admin_or_manager(auth.uid(), r.org_id)
        or public.is_platform_admin(auth.uid())
      )
  )
);

-- monthly_logs policies (missing)
drop policy if exists monthly_logs_read on public.monthly_logs;
drop policy if exists monthly_logs_write on public.monthly_logs;
drop policy if exists monthly_logs_update on public.monthly_logs;
drop policy if exists monthly_logs_delete on public.monthly_logs;

create policy monthly_logs_read on public.monthly_logs
for select using (
  public.is_org_member(auth.uid(), monthly_logs.org_id)
);

create policy monthly_logs_write on public.monthly_logs
for insert with check (
  public.is_org_admin_or_manager(auth.uid(), monthly_logs.org_id)
  or public.is_platform_admin(auth.uid())
);

create policy monthly_logs_update on public.monthly_logs
for update using (
  public.is_org_admin_or_manager(auth.uid(), monthly_logs.org_id)
  or public.is_platform_admin(auth.uid())
) with check (
  public.is_org_admin_or_manager(auth.uid(), monthly_logs.org_id)
  or public.is_platform_admin(auth.uid())
);

create policy monthly_logs_delete on public.monthly_logs
for delete using (
  public.is_org_admin_or_manager(auth.uid(), monthly_logs.org_id)
  or public.is_platform_admin(auth.uid())
);

-- Remove anon grants on sensitive tables
revoke all on public.permission_profiles from anon;
revoke all on public.permission_profile_permissions from anon;
revoke all on public.user_permission_profiles from anon;
revoke all on public.monthly_log_task_rules from anon;
revoke all on public.monthly_log_task_rule_runs from anon;
revoke all on public.monthly_logs from anon;
