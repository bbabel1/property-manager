-- Phase 9: Drop compatibility views for legacy RBAC names

begin;

drop view if exists public.permission_profiles;
drop view if exists public.permission_profile_permissions;
drop view if exists public.user_permission_profiles;

commit;
