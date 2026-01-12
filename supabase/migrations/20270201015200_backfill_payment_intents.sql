-- Backfill payment_intent and payment projections from existing payment transactions
-- Uses Buildium internal transaction fields for lifecycle derivation (not transaction_status)

begin;

with base as (
  select
    t.id as transaction_id,
    t.org_id,
    t.total_amount as amount,
    t.payment_method,
    tenant.id as payer_id,
    case when tenant.id is not null then 'tenant' else null end as payer_type,
    t.buildium_transaction_id,
    t.is_internal_transaction,
    t.internal_transaction_is_pending,
    t.internal_transaction_result_code,
    t.internal_transaction_result_date,
    t.created_at,
    bfc.raw_code as failure_code,
    case
      when bfc.raw_code is not null then 'failed'
      when coalesce(t.is_internal_transaction, false) = true
           and coalesce(t.internal_transaction_is_pending, false) = true then 'pending'
      when coalesce(t.is_internal_transaction, false) = true
           and coalesce(t.internal_transaction_is_pending, false) = false then 'settled'
      when coalesce(t.is_internal_transaction, false) = false then 'settled'
      else 'submitted'
    end as derived_state,
    case
      when bfc.raw_code is not null then null
      when coalesce(t.is_internal_transaction, false) = true
           and coalesce(t.internal_transaction_is_pending, false) = false
        then coalesce(t.internal_transaction_result_date::timestamptz, t.created_at)
      when coalesce(t.is_internal_transaction, false) = false then t.created_at
      else null
    end as settled_at,
    concat_ws(
      ':',
      'backfill',
      'payment',
      t.org_id::text,
      coalesce(t.buildium_transaction_id::text, t.id::text)
    ) as backfill_idempotency_key
  from public.transactions t
  left join public.buildium_failure_codes bfc
    on bfc.raw_code = t.internal_transaction_result_code
  left join public.tenants tenant
    on tenant.buildium_tenant_id = t.payee_tenant_id
  where lower(t.transaction_type::text) = 'payment'
),
inserted_intents as (
  insert into public.payment_intent (
    org_id,
    idempotency_key,
    amount,
    payment_method,
    state,
    gateway_provider,
    gateway_intent_id,
    payer_id,
    payer_type,
    created_at,
    submitted_at,
    updated_at
  )
  select
    b.org_id,
    b.backfill_idempotency_key,
    b.amount,
    b.payment_method,
    b.derived_state::public.payment_intent_state_enum,
    'buildium',
    case when b.buildium_transaction_id is not null then b.buildium_transaction_id::text else null end,
    b.payer_id,
    b.payer_type,
    coalesce(b.created_at, now()),
    coalesce(b.settled_at, b.created_at),
    now()
  from base b
  where not exists (
    select 1
    from public.payment_intent pi
    where pi.org_id = b.org_id
      and (pi.idempotency_key = b.backfill_idempotency_key
           or pi.gateway_intent_id = coalesce(b.buildium_transaction_id::text, b.backfill_idempotency_key))
  )
  returning org_id, id, idempotency_key
),
intent_lookup as (
  select
    b.*,
    coalesce(pi.id, ins.id) as intent_id
  from base b
  left join public.payment_intent pi
    on pi.org_id = b.org_id
   and (pi.idempotency_key = b.backfill_idempotency_key
        or pi.gateway_intent_id = coalesce(b.buildium_transaction_id::text, b.backfill_idempotency_key))
  left join inserted_intents ins
    on ins.org_id = b.org_id
   and ins.idempotency_key = b.backfill_idempotency_key
),
updated_intents as (
  update public.payment_intent pi
    set state = il.derived_state::public.payment_intent_state_enum,
        submitted_at = coalesce(pi.submitted_at, il.settled_at, pi.created_at),
        updated_at = now()
  from intent_lookup il
  where pi.id = il.intent_id
    and pi.state <> il.derived_state::public.payment_intent_state_enum
  returning pi.id
),
inserted_payments as (
  insert into public.payment (
    payment_intent_id,
    transaction_id,
    org_id,
    gateway_transaction_id,
    state,
    normalized_state,
    amount,
    payment_method,
    payer_id,
    payer_type,
    settled_at,
    created_at,
    updated_at
  )
  select
    il.intent_id,
    il.transaction_id,
    il.org_id,
    case when il.buildium_transaction_id is not null then il.buildium_transaction_id::text else null end,
    il.derived_state,
    il.derived_state,
    il.amount,
    il.payment_method,
    il.payer_id,
    il.payer_type,
    il.settled_at,
    coalesce(il.created_at, now()),
    now()
  from intent_lookup il
  where il.intent_id is not null
    and not exists (
      select 1 from public.payment p where p.transaction_id = il.transaction_id
    )
  returning id
)
select
  (select count(*) from inserted_intents) as intents_inserted,
  (select count(*) from updated_intents) as intents_updated,
  (select count(*) from inserted_payments) as payments_inserted;

commit;
