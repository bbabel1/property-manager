-- Phase 4: RBAC helpers updated to new schema and compatibility with legacy data
-- - Rework is_org_member / is_org_admin / is_org_admin_or_manager to use membership_roles + roles
--   with fallback to org_memberships (role text) for compatibility during transition.
-- - Add has_permission helper that evaluates role->permission mappings.

begin;

create or replace function public.is_org_member(p_user_id uuid, p_org_id uuid)
returns boolean
language plpgsql
security definer
volatile
set search_path = public as $$
begin
  set local row_security = off;
  return exists (
    select 1
    from public.membership_roles mr
    where mr.user_id = p_user_id
      and mr.org_id = p_org_id
  )
  or exists (
    select 1
    from public.org_memberships om
    where om.user_id = p_user_id
      and om.org_id = p_org_id
  );
end;
$$;

create or replace function public.is_org_admin(p_user_id uuid, p_org_id uuid)
returns boolean
language plpgsql
security definer
volatile
set search_path = public as $$
begin
  set local row_security = off;
  return exists (
    select 1
    from public.membership_roles mr
    join public.roles r on r.id = mr.role_id
    where mr.user_id = p_user_id
      and mr.org_id = p_org_id
      and r.name in ('org_admin', 'platform_admin')
  )
  or exists (
    select 1
    from public.org_memberships om
    where om.user_id = p_user_id
      and om.org_id = p_org_id
      and om.role in ('org_admin', 'platform_admin')
  );
end;
$$;

create or replace function public.is_org_admin_or_manager(p_user_id uuid, p_org_id uuid)
returns boolean
language plpgsql
security definer
volatile
set search_path = public as $$
begin
  set local row_security = off;
  return exists (
    select 1
    from public.membership_roles mr
    join public.roles r on r.id = mr.role_id
    where mr.user_id = p_user_id
      and mr.org_id = p_org_id
      and r.name in ('org_admin', 'org_manager', 'platform_admin')
  )
  or exists (
    select 1
    from public.org_memberships om
    where om.user_id = p_user_id
      and om.org_id = p_org_id
      and om.role in ('org_admin', 'org_manager', 'platform_admin')
  );
end;
$$;

-- Check if a user has a permission in an org via assigned roles
create or replace function public.has_permission(p_user_id uuid, p_org_id uuid, p_permission_key text)
returns boolean
language plpgsql
security definer
volatile
set search_path = public as $$
begin
  set local row_security = off;
  return exists (
    select 1
    from public.membership_roles mr
    join public.roles r on r.id = mr.role_id
    join public.role_permissions rp on rp.role_id = r.id
    left join public.permissions perms on perms.id = rp.permission_id
    where mr.user_id = p_user_id
      and mr.org_id = p_org_id
      and (
        (perms.key = p_permission_key)
        or (perms.id is null and rp.permission = p_permission_key)
      )
  );
end;
$$;

grant execute on function public.is_org_member(uuid, uuid) to authenticated;
grant execute on function public.is_org_admin(uuid, uuid) to authenticated;
grant execute on function public.is_org_admin_or_manager(uuid, uuid) to authenticated;
grant execute on function public.has_permission(uuid, uuid, text) to authenticated;

comment on function public.is_org_member is 'Checks if a user is a member of an org. Uses SECURITY DEFINER to bypass RLS. Prefers membership_roles; falls back to org_memberships during transition.';
comment on function public.is_org_admin is 'Checks if a user has admin role in an org. Uses SECURITY DEFINER. Prefers membership_roles/roles; falls back to org_memberships.role during transition.';
comment on function public.is_org_admin_or_manager is 'Checks if a user has admin or manager role in an org. Uses SECURITY DEFINER. Prefers membership_roles/roles; falls back to org_memberships.role during transition.';
comment on function public.has_permission is 'Checks if a user has a permission in an org via role -> role_permissions -> permissions.';

commit;
