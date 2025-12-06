-- Adds org_ids and roles into JWT custom claims
create or replace function public.jwt_custom_claims()
returns jsonb language sql stable security definer as $$
  with user_orgs as (
    select org_id from public.org_memberships where user_id = auth.uid()
    union
    select org_id from public.org_membership_roles where user_id = auth.uid()
  ),
  user_roles as (
    -- Prefer explicit multi-role table; fallback to legacy org_memberships
    select role from public.org_membership_roles where user_id = auth.uid()
    union
    select role from public.org_memberships where user_id = auth.uid()
  )
  select coalesce(
    jsonb_build_object(
      'org_ids', (
        select coalesce(jsonb_agg(distinct org_id), '[]'::jsonb)
        from user_orgs
      ),
      'roles', (
        select coalesce(jsonb_agg(distinct role), '[]'::jsonb)
        from user_roles
      )
    ),
    '{}'::jsonb
  );
$$;
