-- Deterministic backfill for canonical PaidBy/PaidTo.
-- Guardrails:
-- - Only fill rows where canonical fields are currently null.
-- - PaidBy: only when lines share a single property/unit context.
-- - PaidTo: only when a single counterparty (vendor or tenant) is present.
-- - Leaves ambiguous rows untouched. Logs counts.

begin;

-- Backfill PaidBy from transaction_lines when a single property/unit context exists.
with line_ctx as (
  select
    tl.transaction_id,
    min(tl.buildium_property_id) as prop_id,
    min(tl.buildium_unit_id) as unit_id,
    count(distinct tl.buildium_property_id) as prop_count,
    count(distinct tl.buildium_unit_id) as unit_count
  from public.transaction_lines tl
  group by tl.transaction_id
),
updatable as (
  select
    lc.transaction_id,
    lc.prop_id,
    lc.unit_id
  from line_ctx lc
  where lc.prop_count = 1
    and (lc.unit_count = 1 or lc.unit_count = 0)
)
update public.transactions t
set
  paid_by_accounting_entity_id = u.prop_id,
  paid_by_accounting_entity_type = 'Rental',
  paid_by_accounting_unit_id = u.unit_id
from updatable u
where t.id = u.transaction_id
  and t.paid_by_accounting_entity_id is null
  and t.paid_by_accounting_unit_id is null
  and t.paid_by_label is null;

-- Backfill PaidTo when exactly one counterparty is present (vendor or tenant).
update public.transactions t
set
  paid_to_vendor_id = case
    when t.paid_to_vendor_id is null and t.paid_to_tenant_id is null and t.vendor_id is not null then t.vendor_id
    else t.paid_to_vendor_id
  end,
  paid_to_tenant_id = case
    when t.paid_to_vendor_id is null and t.paid_to_tenant_id is null and t.tenant_id is not null then t.tenant_id
    else t.paid_to_tenant_id
  end,
  paid_to_name = case
    when t.paid_to_name is null and t.vendor_id is not null then t.paid_to_name
    when t.paid_to_name is null and t.tenant_id is not null then t.paid_to_name
    else t.paid_to_name
  end
where (t.paid_to_vendor_id is null and t.paid_to_tenant_id is null)
  and (
    (t.vendor_id is not null and t.tenant_id is null)
    or (t.vendor_id is null and t.tenant_id is not null)
  );

-- Report counts (printed in migration output).
do $$
declare
  set_paid_by int;
  set_paid_to int;
  ambiguous_paid_by int;
  ambiguous_paid_to int;
begin
  select count(*) into set_paid_by from public.transactions
    where paid_by_accounting_entity_id is not null;
  select count(*) into set_paid_to from public.transactions
    where paid_to_vendor_id is not null or paid_to_tenant_id is not null;
  select count(*) into ambiguous_paid_by from public.transaction_lines tl
    group by tl.transaction_id
    having count(distinct tl.buildium_property_id) > 1
       or count(distinct tl.buildium_unit_id) > 1;
  select count(*) into ambiguous_paid_to from public.transactions
    where (vendor_id is not null and tenant_id is not null);

  raise notice 'paid_by set rows: %', set_paid_by;
  raise notice 'paid_to set rows: %', set_paid_to;
  raise notice 'ambiguous paid_by (multi property/unit) rows: %', ambiguous_paid_by;
  raise notice 'ambiguous paid_to (both vendor and tenant) rows: %', ambiguous_paid_to;
end $$;

commit;

