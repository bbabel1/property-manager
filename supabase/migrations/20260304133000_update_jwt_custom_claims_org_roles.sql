-- Update jwt_custom_claims to include org_roles map and preferred_org_id
DO $$
BEGIN
  DROP FUNCTION IF EXISTS public.jwt_custom_claims();

  CREATE OR REPLACE FUNCTION public.jwt_custom_claims()
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  AS $func$
    with role_rows as (
      -- Prefer multi-role table when present
      select org_id, role
      from public.org_membership_roles
      where user_id = (select auth.uid())
      union all
      -- Fallback to primary role when no multi-role rows exist for the org
      select m.org_id, m.role
      from public.org_memberships m
      where m.user_id = (select auth.uid())
        and not exists (
          select 1
          from public.org_membership_roles r
          where r.user_id = m.user_id and r.org_id = m.org_id
        )
    ),
    org_roles as (
      select org_id, jsonb_agg(distinct role) roles
      from role_rows
      group by org_id
    ),
    org_roles_map as (
      select coalesce(jsonb_object_agg(org_id::text, roles), '{}'::jsonb) as roles_map
      from org_roles
    ),
    org_ids_list as (
      select coalesce(jsonb_agg(distinct org_id), '[]'::jsonb) as ids_list
      from org_roles
    )
    select jsonb_build_object(
      'org_roles', (select roles_map from org_roles_map),
      'org_ids', (select ids_list from org_ids_list),
      'preferred_org_id', (select org_id from org_roles limit 1)
    );
  $func$;
END
$$;
