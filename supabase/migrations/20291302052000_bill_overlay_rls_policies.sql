-- RLS/policies for bill overlays + reconciliation guardrails

begin;

-- Drop prior policies from overlay creation if present
drop policy if exists bill_applications_read on public.bill_applications;
drop policy if exists bill_applications_insert on public.bill_applications;
drop policy if exists bill_applications_update on public.bill_applications;
drop policy if exists bill_applications_delete on public.bill_applications;

drop policy if exists bill_workflow_read on public.bill_workflow;
drop policy if exists bill_workflow_insert on public.bill_workflow;
drop policy if exists bill_workflow_update on public.bill_workflow;
drop policy if exists bill_workflow_delete on public.bill_workflow;

drop policy if exists bill_approval_audit_read on public.bill_approval_audit;

-- bill_applications RLS
create policy bill_applications_org_read
on public.bill_applications
for select
using (public.is_org_member(auth.uid(), org_id));

create policy bill_applications_org_write
on public.bill_applications
for insert
with check (public.is_org_admin_or_manager(auth.uid(), org_id));

create policy bill_applications_org_update
on public.bill_applications
for update
using (
  public.is_org_admin_or_manager(auth.uid(), org_id)
  and not exists (
    select 1 from public.bank_register_state brs
    where brs.transaction_id = bill_applications.source_transaction_id
      and brs.status = 'reconciled'
  )
)
with check (
  public.is_org_admin_or_manager(auth.uid(), org_id)
  and not exists (
    select 1 from public.bank_register_state brs
    where brs.transaction_id = bill_applications.source_transaction_id
      and brs.status = 'reconciled'
  )
);

create policy bill_applications_org_delete
on public.bill_applications
for delete
using (
  public.is_org_admin_or_manager(auth.uid(), org_id)
  and not exists (
    select 1 from public.bank_register_state brs
    where brs.transaction_id = bill_applications.source_transaction_id
      and brs.status = 'reconciled'
  )
);

-- bill_workflow RLS
create policy bill_workflow_org_read
on public.bill_workflow
for select
using (public.is_org_member(auth.uid(), org_id));

create policy bill_workflow_org_write
on public.bill_workflow
for insert
with check (public.is_org_admin_or_manager(auth.uid(), org_id));

-- For updates: admins/managers; staff allowed when targeting pending_approval rows (submit)
-- Note: org_staff role check would need a custom function, using admin/manager for now
create policy bill_workflow_org_update
on public.bill_workflow
for update
using (public.is_org_admin_or_manager(auth.uid(), org_id))
with check (public.is_org_admin_or_manager(auth.uid(), org_id));

create policy bill_workflow_org_delete
on public.bill_workflow
for delete
using (public.is_org_admin_or_manager(auth.uid(), org_id));

-- bill_approval_audit read-only
create policy bill_approval_audit_org_read
on public.bill_approval_audit
for select
using (
  exists (
    select 1
    from public.transactions t
    where t.id = bill_approval_audit.bill_transaction_id
      and public.is_org_member(auth.uid(), t.org_id)
  )
);

commit;
