-- Enable RLS and add org-scoped policies for new service catalog tables

alter table if exists public.service_offerings enable row level security;
alter table if exists public.service_plan_offerings enable row level security;
alter table if exists public.service_plan_default_pricing enable row level security;
alter table if exists public.property_service_pricing enable row level security;
alter table if exists public.billing_events enable row level security;
alter table if exists public.service_automation_rules enable row level security;
alter table if exists public.property_automation_overrides enable row level security;
alter table if exists public.service_fee_history enable row level security;

-- Service offerings: readable to org members (global catalog), writable to admins
drop policy if exists service_offerings_read on public.service_offerings;
create policy service_offerings_read on public.service_offerings
  for select using (true);

-- Plan defaults and plan mappings: readable to all, writable to admins (assumes admin functions exist)
drop policy if exists service_plan_default_pricing_read on public.service_plan_default_pricing;
create policy service_plan_default_pricing_read on public.service_plan_default_pricing
  for select using (true);

drop policy if exists service_plan_offerings_read on public.service_plan_offerings;
create policy service_plan_offerings_read on public.service_plan_offerings
  for select using (true);

-- Property scoped tables: restrict to org of the property
drop policy if exists property_service_pricing_rw on public.property_service_pricing;
create policy property_service_pricing_rw on public.property_service_pricing
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_service_pricing.property_id
        and public.is_org_member(auth.uid(), p.org_id)
    )
  )
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_service_pricing.property_id
        and public.is_org_member(auth.uid(), p.org_id)
    )
  );

drop policy if exists billing_events_rw on public.billing_events;
create policy billing_events_rw on public.billing_events
  using (
    exists (
      select 1 from public.properties p
      where p.id = billing_events.property_id
        and public.is_org_member(auth.uid(), p.org_id)
    )
  )
  with check (
    exists (
      select 1 from public.properties p
      where p.id = billing_events.property_id
        and public.is_org_member(auth.uid(), p.org_id)
    )
  );

drop policy if exists service_fee_history_rw on public.service_fee_history;
create policy service_fee_history_rw on public.service_fee_history
  using (
    exists (
      select 1 from public.transactions t
      join public.monthly_logs ml on ml.id = t.monthly_log_id
      join public.properties p on p.id = ml.property_id
      where t.id = service_fee_history.transaction_id
        and public.is_org_member(auth.uid(), p.org_id)
    )
  );

drop policy if exists property_automation_overrides_rw on public.property_automation_overrides;
create policy property_automation_overrides_rw on public.property_automation_overrides
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_automation_overrides.property_id
        and public.is_org_member(auth.uid(), p.org_id)
    )
  )
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_automation_overrides.property_id
        and public.is_org_member(auth.uid(), p.org_id)
    )
  );

drop policy if exists service_automation_rules_read on public.service_automation_rules;
create policy service_automation_rules_read on public.service_automation_rules
  for select using (true);
