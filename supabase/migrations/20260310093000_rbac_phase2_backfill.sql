-- Phase 2: RBAC backfill (permissions + role_id dual write + org_membership_roles sync)

begin;

-- 1) Seed permissions from existing profile-permission text
insert into public.permissions (org_id, key, description, category, is_system)
select distinct pp.org_id,
       ppp.permission as key,
       null::text as description,
       null::text as category,
       (pp.org_id is null) as is_system
from public.permission_profile_permissions ppp
join public.permission_profiles pp on pp.id = ppp.profile_id
left join public.permissions p2
  on p2.key = ppp.permission
 and coalesce(p2.org_id, '00000000-0000-0000-0000-000000000000') = coalesce(pp.org_id, '00000000-0000-0000-0000-000000000000')
where p2.id is null;

-- 2) Backfill permission_profile_permissions.permission_id
update public.permission_profile_permissions ppp
set permission_id = (
  select perms.id
  from public.permission_profiles pp
  join public.permissions perms
    on perms.key = ppp.permission
   and coalesce(perms.org_id, '00000000-0000-0000-0000-000000000000') = coalesce(pp.org_id, '00000000-0000-0000-0000-000000000000')
  where pp.id = ppp.profile_id
  limit 1
)
where ppp.permission_id is null;

-- 3) Backfill user_permission_profiles.role_id (dual write)
update public.user_permission_profiles upp
set role_id = profile_id
where role_id is null;

-- 4) Sync org_membership_roles (text) into user_permission_profiles where possible
-- Map on org_id + role name to a matching permission_profile name (assumes names align)
insert into public.user_permission_profiles (user_id, org_id, profile_id, role_id, created_at, updated_at)
select omr.user_id,
       omr.org_id,
       pp.id as profile_id,
       pp.id as role_id,
       now(),
       now()
from public.org_membership_roles omr
join public.permission_profiles pp
  on pp.org_id = omr.org_id
 and pp.name = omr.role
left join public.user_permission_profiles upp
  on upp.user_id = omr.user_id
 and upp.org_id = omr.org_id
 and upp.profile_id = pp.id
where upp.user_id is null;

commit;
