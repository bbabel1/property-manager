# Auth Data Cleanup Checklist

Goal: normalize roles and remove invalid/NULL org mappings to keep RLS consistent.

1) Identify NULL org_ids on org-scoped tables (should be rare after backfills):
```sql
select 'org_memberships' as table_name, count(*) from public.org_memberships where org_id is null
union all
select 'org_membership_roles', count(*) from public.org_membership_roles where org_id is null
union all
select 'monthly_logs', count(*) from public.monthly_logs where org_id is null;
```
- Remediate by deleting orphaned rows or backfilling with the correct org_id; enforce NOT NULL if possible after cleanup.

2) Normalize AppRole strings in membership tables:
```sql
update public.org_memberships
set role = lower(regexp_replace(role, '[^a-z0-9]+', '_', 'g'))
where role is not null;

update public.org_membership_roles
set role = lower(regexp_replace(role, '[^a-z0-9]+', '_', 'g'))
where role is not null;
```
- Validate roles against the AppRole set (`platform_admin, org_admin, org_manager, org_staff, owner_portal, tenant_portal, vendor_portal`) and quarantine unknowns.

3) Deduplicate memberships:
```sql
delete from public.org_membership_roles r
using (
  select user_id, org_id, role, row_number() over (partition by user_id, org_id, role order by created_at) as rn
  from public.org_membership_roles
) d
where r.user_id = d.user_id and r.org_id = d.org_id and r.role = d.role and d.rn > 1;
```

4) Regenerate JWT claims after cleanup:
- Rotate sessions or trigger re-auth so new `org_roles/org_ids` claims propagate.

5) Verify RLS after cleanup:
- Spot check org-scoped tables to ensure rows now have org_id and are enforced by policies.
