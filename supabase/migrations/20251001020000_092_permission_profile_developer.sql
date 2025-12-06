-- Add global Developer permission profile with full access

begin;

do $$ declare
  pid uuid;
begin
  -- Insert or fetch Developer profile (global, is_system)
  insert into public.permission_profiles (org_id, name, description, is_system)
  values (null, 'Developer', 'Full access to all actions', true)
  on conflict (org_id, name) do update set updated_at = now()
  returning id into pid;

  if pid is null then
    select id into pid from public.permission_profiles where org_id is null and name = 'Developer' limit 1;
  end if;

  if pid is not null then
    -- Reset permissions and insert full set
    delete from public.permission_profile_permissions where profile_id = pid;

    insert into public.permission_profile_permissions (profile_id, permission)
    values
      (pid, 'properties.read'),
      (pid, 'properties.write'),
      (pid, 'owners.read'),
      (pid, 'owners.write'),
      (pid, 'leases.read'),
      (pid, 'leases.write'),
      (pid, 'monthly_logs.read'),
      (pid, 'monthly_logs.write'),
      (pid, 'monthly_logs.approve'),
      (pid, 'monthly_logs.send_statement');
  end if;
end $$;

commit;
