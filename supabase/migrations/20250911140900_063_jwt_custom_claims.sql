-- JWT custom claims function (org_ids, roles) for Supabase Auth
create or replace function public.jwt_custom_claims()
returns jsonb language sql stable security definer as $$
  select coalesce(
    jsonb_build_object(
      'org_ids', (
        select coalesce(jsonb_agg(org_id), '[]'::jsonb)
        from public.org_memberships
        where user_id = auth.uid()
      ),
      'roles', (
        select coalesce(jsonb_agg(role), '[]'::jsonb)
        from public.org_memberships
        where user_id = auth.uid()
      )
    ),
    '{}'::jsonb
  );
$$;

