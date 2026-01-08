-- Bill void/reversal workflow: add voided state and helper to reverse bills safely

begin;

-- Ensure approval_state_enum has voided
do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'voided' and enumtypid = 'approval_state_enum'::regtype
  ) then
    alter type public.approval_state_enum add value if not exists 'voided';
  end if;
end $$;

-- Void a bill by creating a reversing transaction and updating workflow/audit
create or replace function public.void_bill(
  p_bill_transaction_id uuid,
  p_user_id uuid,
  p_reason text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reversal_id uuid;
  v_bill transactions%rowtype;
  v_workflow_state public.approval_state_enum;
  v_now timestamptz := now();
  v_reconciliation_block int;
begin
  -- Load bill (lock row to prevent concurrent mutation)
  select * into v_bill
  from public.transactions
  where id = p_bill_transaction_id
    and transaction_type = 'Bill'
  for update;

  if not found then
    raise exception 'Bill transaction not found: %', p_bill_transaction_id;
  end if;

  -- Guard: any reconciled payment applications block void
  select 1 into v_reconciliation_block
  from public.bill_applications ba
  join public.bank_register_state brs
    on brs.transaction_id = ba.source_transaction_id
  where ba.bill_transaction_id = p_bill_transaction_id
    and brs.status = 'reconciled'
  limit 1;

  if v_reconciliation_block is not null then
    raise exception 'Cannot void bill with reconciled payments';
  end if;

  -- Capture current workflow state (if present)
  select approval_state into v_workflow_state
  from public.bill_workflow
  where bill_transaction_id = p_bill_transaction_id;

  -- Create reversal transaction header
  insert into public.transactions (
    org_id,
    transaction_type,
    date,
    total_amount,
    vendor_id,
    reference_number,
    memo,
    status,
    reversal_of_transaction_id,
    created_at,
    updated_at,
    property_id,
    unit_id,
    account_entity_type,
    account_entity_id
  )
  values (
    v_bill.org_id,
    'Bill',
    current_date,
    v_bill.total_amount,
    v_bill.vendor_id,
    v_bill.reference_number,
    coalesce('Void: ' || v_bill.memo, 'Void'),
    'Cancelled'::public.transaction_status_enum,
    p_bill_transaction_id,
    v_now,
    v_now,
    v_bill.property_id,
    v_bill.unit_id,
    v_bill.account_entity_type,
    v_bill.account_entity_id
  )
  returning id into v_reversal_id;

  -- Insert reversing lines (flip posting type, keep positive amounts)
  insert into public.transaction_lines (
    transaction_id,
    gl_account_id,
    amount,
    posting_type,
    memo,
    account_entity_type,
    account_entity_id,
    property_id,
    unit_id,
    buildium_property_id,
    buildium_unit_id,
    buildium_lease_id,
    date,
    created_at,
    updated_at,
    reference_number
  )
  select
    v_reversal_id,
    tl.gl_account_id,
    abs(tl.amount),
    case when tl.posting_type = 'Debit' then 'Credit' else 'Debit' end,
    coalesce('Void: ' || tl.memo, 'Void'),
    tl.account_entity_type,
    tl.account_entity_id,
    tl.property_id,
    tl.unit_id,
    tl.buildium_property_id,
    tl.buildium_unit_id,
    tl.buildium_lease_id,
    current_date,
    v_now,
    v_now,
    tl.reference_number
  from public.transaction_lines tl
  where tl.transaction_id = p_bill_transaction_id;

  -- Mark workflow as voided if present
  update public.bill_workflow
    set approval_state = 'voided',
        voided_by_user_id = p_user_id,
        voided_at = v_now,
        void_reason = p_reason,
        reversal_transaction_id = v_reversal_id,
        updated_at = v_now
  where bill_transaction_id = p_bill_transaction_id;

  -- Update original bill status
  update public.transactions
    set status = 'Cancelled',
        updated_at = v_now
  where id = p_bill_transaction_id;

  -- Audit entry
  insert into public.bill_approval_audit (
    bill_transaction_id,
    action,
    from_state,
    to_state,
    user_id,
    notes,
    created_at
  )
  values (
    p_bill_transaction_id,
    'voided',
    v_workflow_state,
    'voided',
    p_user_id,
    p_reason,
    v_now
  );

  return v_reversal_id;
exception
  when others then
    raise;
end;
$$;

comment on function public.void_bill(uuid, uuid, text) is
  'Voids a bill by creating a reversing Bill transaction, updating workflow to voided, and auditing the action. Blocks when reconciled payments exist.';

commit;
