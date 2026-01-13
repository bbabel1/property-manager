-- Refresh jwt_custom_claims to avoid missing table errors and include org metadata
-- This version:
-- - Uses membership_roles + roles (new RBAC) and falls back to org_memberships (legacy)
-- - Returns org_ids, roles, org_roles map, and preferred_org_id
-- - Avoids references to dropped org_membership_roles table
begin;

create or replace function public.jwt_custom_claims()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  org_list jsonb := '[]'::jsonb;
  roles_list jsonb := '[]'::jsonb;
  org_roles_map jsonb := '{}'::jsonb;
  preferred_org text := null;
begin
  with membership_orgs as (
    select org_id from public.membership_roles where user_id = auth.uid()
  ),
  legacy_orgs as (
    select org_id from public.org_memberships where user_id = auth.uid()
  ),
  all_orgs as (
    select distinct org_id from (
      select org_id from membership_orgs
      union all
      select org_id from legacy_orgs
    ) s
    where org_id is not null
  ),
  role_rows as (
    select mr.org_id, r.name as role
    from public.membership_roles mr
    join public.roles r on r.id = mr.role_id
    where mr.user_id = auth.uid()
    union all
    -- legacy rows contribute orgs even if no role mapping exists
    select om.org_id, null::text as role
    from public.org_memberships om
    where om.user_id = auth.uid()
  ),
  org_roles_cte as (
    select org_id, jsonb_agg(distinct role) filter (where role is not null) as roles
    from role_rows
    group by org_id
  )
  select
    (select coalesce(jsonb_agg(distinct org_id), '[]'::jsonb) from all_orgs),
    (select coalesce(jsonb_agg(distinct role) filter (where role is not null), '[]'::jsonb) from role_rows),
    (select coalesce(jsonb_object_agg(org_id::text, coalesce(roles, '[]'::jsonb)), '{}'::jsonb) from org_roles_cte),
    (select org_id::text from org_roles_cte limit 1)
  into org_list, roles_list, org_roles_map, preferred_org;

  return jsonb_build_object(
    'org_ids', org_list,
    'roles', roles_list,
    'org_roles', org_roles_map,
    'preferred_org_id', preferred_org
  );
exception
  when undefined_table then
    -- If supporting tables are missing, fall back to empty claims to avoid hard failures
    return '{}'::jsonb;
end;
$$;

commit;
