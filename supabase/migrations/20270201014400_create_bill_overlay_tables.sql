-- Bill overlays: applications and approval workflow (requires Phase 1 foundation)

begin;

-- Enum for approval lifecycle
do $$
begin
  create type public.approval_state_enum as enum ('draft', 'pending_approval', 'approved', 'rejected');
exception
  when duplicate_object then null;
end $$;

-- bill_applications join table (payments/credits applied to bills)
create table if not exists public.bill_applications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  bill_transaction_id uuid not null references public.transactions(id) on delete cascade,
  source_transaction_id uuid not null references public.transactions(id) on delete cascade,
  source_type varchar(20) not null,
  applied_amount numeric(15,2) not null,
  applied_at timestamptz not null default now(),
  created_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_bill_applications_bill_source unique (bill_transaction_id, source_transaction_id),
  constraint chk_bill_applications_amount_positive check (applied_amount > 0),
  constraint chk_bill_applications_no_self_application check (bill_transaction_id <> source_transaction_id),
  constraint chk_bill_applications_source_type_valid check (source_type in ('payment','credit','refund'))
);

create index if not exists idx_bill_applications_bill on public.bill_applications(bill_transaction_id);
create index if not exists idx_bill_applications_source on public.bill_applications(source_transaction_id);
create index if not exists idx_bill_applications_org on public.bill_applications(org_id);
create index if not exists idx_bill_applications_source_type on public.bill_applications(source_type, source_transaction_id);

-- bill_workflow (approval lifecycle overlay, 1:1 with bill transaction)
create table if not exists public.bill_workflow (
  bill_transaction_id uuid primary key references public.transactions(id) on delete cascade,
  org_id uuid not null references public.organizations(id),
  approval_state public.approval_state_enum not null default 'draft',
  submitted_by_user_id uuid references auth.users(id),
  submitted_at timestamptz,
  approved_by_user_id uuid references auth.users(id),
  approved_at timestamptz,
  rejected_by_user_id uuid references auth.users(id),
  rejected_at timestamptz,
  rejection_reason text,
  voided_by_user_id uuid references auth.users(id),
  voided_at timestamptz,
  void_reason text,
  reversal_transaction_id uuid references public.transactions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bill_workflow_org on public.bill_workflow(org_id);
create index if not exists idx_bill_workflow_state on public.bill_workflow(approval_state);

-- bill_approval_audit (history)
create table if not exists public.bill_approval_audit (
  id uuid primary key default gen_random_uuid(),
  bill_transaction_id uuid not null references public.transactions(id) on delete cascade,
  action varchar(20) not null,
  from_state public.approval_state_enum,
  to_state public.approval_state_enum,
  user_id uuid references auth.users(id),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_bill_approval_audit_bill on public.bill_approval_audit(bill_transaction_id);
create index if not exists idx_bill_approval_audit_created_at on public.bill_approval_audit(created_at);

-- Org guard for bill_applications
create or replace function public.bill_applications_org_guard()
returns trigger
language plpgsql
as $$
declare
  v_bill_org uuid;
  v_source_org uuid;
begin
  select org_id into v_bill_org from public.transactions where id = new.bill_transaction_id;
  select org_id into v_source_org from public.transactions where id = new.source_transaction_id;
  perform public.enforce_same_org(new.org_id, v_bill_org, 'bill_applications');
  perform public.enforce_same_org(new.org_id, v_source_org, 'bill_applications');
  return new;
end;
$$;

drop trigger if exists trg_bill_applications_org_guard on public.bill_applications;
create trigger trg_bill_applications_org_guard
  before insert or update on public.bill_applications
  for each row
  execute function public.bill_applications_org_guard();

-- Update updated_at
drop trigger if exists trg_bill_applications_updated_at on public.bill_applications;
create trigger trg_bill_applications_updated_at
  before update on public.bill_applications
  for each row
  execute function public.update_updated_at_column();

drop trigger if exists trg_bill_workflow_updated_at on public.bill_workflow;
create trigger trg_bill_workflow_updated_at
  before update on public.bill_workflow
  for each row
  execute function public.update_updated_at_column();

-- Org guard for bill_workflow
create or replace function public.bill_workflow_org_guard()
returns trigger
language plpgsql
as $$
declare
  v_bill_org uuid;
begin
  select org_id into v_bill_org from public.transactions where id = new.bill_transaction_id;
  perform public.enforce_same_org(new.org_id, v_bill_org, 'bill_workflow');
  return new;
end;
$$;

drop trigger if exists trg_bill_workflow_org_guard on public.bill_workflow;
create trigger trg_bill_workflow_org_guard
  before insert or update on public.bill_workflow
  for each row
  execute function public.bill_workflow_org_guard();

-- Validation function for bill applications (limits vs bill/source totals)
create or replace function public.validate_bill_application(
  p_bill_id uuid,
  p_source_id uuid,
  p_amount numeric
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill_total numeric;
  v_source_total numeric;
  v_applied_to_bill numeric;
  v_applied_from_source numeric;
  v_credit_applications numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Application amount must be greater than zero';
  end if;

  select abs(total_amount) into v_bill_total from public.transactions where id = p_bill_id;
  if v_bill_total is null then
    raise exception 'Bill % not found', p_bill_id;
  end if;

  select abs(total_amount) into v_source_total from public.transactions where id = p_source_id;
  if v_source_total is null then
    raise exception 'Source transaction % not found', p_source_id;
  end if;

  select coalesce(sum(applied_amount), 0) into v_applied_to_bill
  from public.bill_applications
  where bill_transaction_id = p_bill_id;

  select coalesce(sum(applied_amount), 0) into v_applied_from_source
  from public.bill_applications
  where source_transaction_id = p_source_id;

  if (v_applied_from_source + p_amount) > v_source_total then
    raise exception 'Application amount exceeds source total. Applied: %, Total: %',
      v_applied_from_source + p_amount, v_source_total;
  end if;

  select coalesce(sum(applied_amount), 0) into v_credit_applications
  from public.bill_applications
  where bill_transaction_id = p_bill_id
    and source_type in ('credit','refund');

  if (v_applied_to_bill + p_amount - v_credit_applications) > v_bill_total then
    raise exception 'Application amount exceeds bill total. Applied: %, Total: %, Credits: %',
      v_applied_to_bill + p_amount, v_bill_total, v_credit_applications;
  end if;
end;
$$;

-- Recompute bill status from applications
create or replace function public.recompute_bill_status(p_bill_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill_total numeric;
  v_payment_total numeric;
  v_credit_total numeric;
  v_net_payable numeric;
  v_new_status public.transaction_status_enum;
  v_due_date date;
  v_tx_type public.transaction_type_enum;
begin
  select transaction_type, abs(total_amount), due_date
  into v_tx_type, v_bill_total, v_due_date
  from public.transactions
  where id = p_bill_transaction_id;

  if v_tx_type is null then
    raise exception 'Bill % not found', p_bill_transaction_id;
  end if;

  if v_tx_type <> 'Bill' then
    return;
  end if;

  select coalesce(sum(applied_amount), 0) into v_payment_total
  from public.bill_applications
  where bill_transaction_id = p_bill_transaction_id
    and source_type = 'payment';

  select coalesce(sum(applied_amount), 0) into v_credit_total
  from public.bill_applications
  where bill_transaction_id = p_bill_transaction_id
    and source_type in ('credit','refund');

  v_net_payable := v_bill_total - v_payment_total - v_credit_total;

  if v_net_payable <= 0 then
    v_new_status := 'Paid';
    update public.transactions
      set paid_date = coalesce(paid_date, current_date)
      where id = p_bill_transaction_id
        and paid_date is null;
  elsif v_payment_total > 0 then
    v_new_status := 'Partially paid';
  elsif v_due_date is not null and v_due_date < current_date then
    v_new_status := 'Overdue';
  else
    v_new_status := 'Due';
  end if;

  update public.transactions
    set status = v_new_status, updated_at = now()
    where id = p_bill_transaction_id;
end;
$$;

-- Trigger wrapper to recompute after changes
create or replace function public.trg_recompute_bill_status()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_bill_status(old.bill_transaction_id);
    return old;
  else
    perform public.recompute_bill_status(new.bill_transaction_id);
    return new;
  end if;
end;
$$;

drop trigger if exists trg_bill_applications_recompute_status on public.bill_applications;
create trigger trg_bill_applications_recompute_status
  after insert or update or delete on public.bill_applications
  for each row
  execute function public.trg_recompute_bill_status();

-- Validation trigger for bill_applications
create or replace function public.trg_bill_applications_validate()
returns trigger
language plpgsql
as $$
begin
  perform public.validate_bill_application(new.bill_transaction_id, new.source_transaction_id, new.applied_amount);
  return new;
end;
$$;

drop trigger if exists trg_bill_applications_validate on public.bill_applications;
create trigger trg_bill_applications_validate
  before insert or update on public.bill_applications
  for each row
  execute function public.trg_bill_applications_validate();

-- RLS
alter table public.bill_applications enable row level security;
alter table public.bill_workflow enable row level security;
alter table public.bill_approval_audit enable row level security;

-- bill_applications policies (org-scoped)
drop policy if exists bill_applications_read on public.bill_applications;
create policy bill_applications_read
  on public.bill_applications
  for select
  using (public.is_org_member(auth.uid(), org_id));

drop policy if exists bill_applications_insert on public.bill_applications;
create policy bill_applications_insert
  on public.bill_applications
  for insert
  with check (public.is_org_member(auth.uid(), org_id));

drop policy if exists bill_applications_update on public.bill_applications;
create policy bill_applications_update
  on public.bill_applications
  for update
  using (public.is_org_member(auth.uid(), org_id))
  with check (public.is_org_member(auth.uid(), org_id));

drop policy if exists bill_applications_delete on public.bill_applications;
create policy bill_applications_delete
  on public.bill_applications
  for delete
  using (public.is_org_member(auth.uid(), org_id));

-- bill_workflow policies (org-scoped)
drop policy if exists bill_workflow_read on public.bill_workflow;
create policy bill_workflow_read
  on public.bill_workflow
  for select
  using (public.is_org_member(auth.uid(), org_id));

drop policy if exists bill_workflow_insert on public.bill_workflow;
create policy bill_workflow_insert
  on public.bill_workflow
  for insert
  with check (public.is_org_member(auth.uid(), org_id));

drop policy if exists bill_workflow_update on public.bill_workflow;
create policy bill_workflow_update
  on public.bill_workflow
  for update
  using (public.is_org_member(auth.uid(), org_id))
  with check (public.is_org_member(auth.uid(), org_id));

drop policy if exists bill_workflow_delete on public.bill_workflow;
create policy bill_workflow_delete
  on public.bill_workflow
  for delete
  using (public.is_org_member(auth.uid(), org_id));

-- bill_approval_audit policies (org-scoped read-only via transaction org)
drop policy if exists bill_approval_audit_read on public.bill_approval_audit;
create policy bill_approval_audit_read
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
