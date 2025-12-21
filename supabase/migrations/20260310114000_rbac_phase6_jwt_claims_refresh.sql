-- Phase 6: Refresh JWT claims to use membership_roles/roles

begin;

create or replace function public.jwt_custom_claims()
returns jsonb
language sql
stable
security definer
as $$
  with membership_orgs as (
    select org_id from public.membership_roles where user_id = auth.uid()
  ),
  legacy_orgs as (
    select org_id from public.org_memberships where user_id = auth.uid()
  ),
  all_orgs as (
    select org_id from membership_orgs
    union
    select org_id from legacy_orgs
  ),
  user_roles as (
    select distinct r.name as role
    from public.membership_roles mr
    join public.roles r on r.id = mr.role_id
    where mr.user_id = auth.uid()
  )
  select coalesce(
    jsonb_build_object(
      'org_ids', (
        select coalesce(jsonb_agg(distinct org_id), '[]'::jsonb)
        from all_orgs
      ),
      'roles', (
        select coalesce(jsonb_agg(distinct role), '[]'::jsonb)
        from user_roles
      )
    ),
    '{}'::jsonb
  );
$$;

commit;
