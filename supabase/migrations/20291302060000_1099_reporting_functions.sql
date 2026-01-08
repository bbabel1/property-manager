-- 1099 calculation helpers
begin;

create or replace function calculate_vendor_1099_total(
  p_vendor_id uuid,
  p_tax_year integer
) returns numeric as $$
declare
  v_payment_total numeric;
  v_credit_total numeric;
begin
  -- Sum payments applied to bills for this vendor, excluding voided bills
  select coalesce(sum(ba.applied_amount), 0) into v_payment_total
  from bill_applications ba
  join transactions t on t.id = ba.source_transaction_id
  join transactions b on b.id = ba.bill_transaction_id
  left join bill_workflow bw on bw.bill_transaction_id = b.id
  where ba.source_type = 'payment'
    and b.vendor_id = p_vendor_id
    and extract(year from t.date) = p_tax_year
    and (bw.approval_state is null or bw.approval_state <> 'voided');

  -- Sum credits/refunds applied to reduce totals
  select coalesce(sum(ba.applied_amount), 0) into v_credit_total
  from bill_applications ba
  join transactions t on t.id = ba.source_transaction_id
  join transactions b on b.id = ba.bill_transaction_id
  left join bill_workflow bw on bw.bill_transaction_id = b.id
  where ba.source_type in ('credit', 'refund')
    and b.vendor_id = p_vendor_id
    and extract(year from t.date) = p_tax_year
    and (bw.approval_state is null or bw.approval_state <> 'voided');

  return greatest(0, v_payment_total - v_credit_total);
end;
$$ language plpgsql stable;

comment on function calculate_vendor_1099_total(uuid, integer) is
  'Calculates 1099 total for a vendor for a tax year based on bill applications (payments minus credits/refunds), excluding voided bills.';

-- Threshold helper: returns vendors over a given threshold (default 600) for a tax year
create or replace function list_1099_candidates(
  p_tax_year integer,
  p_threshold numeric default 600
) returns table (
  vendor_id uuid,
  org_id uuid,
  vendor_name text,
  total numeric,
  include_1099 boolean
) as $$
begin
  return query
  select
    v.id,
    v.org_id,
    coalesce(c.display_name, c.company_name, v.name) as vendor_name,
    calculate_vendor_1099_total(v.id, p_tax_year) as total,
    coalesce(v.include_1099, false) as include_1099
  from vendors v
  left join contacts c on c.id = v.contact_id
  where calculate_vendor_1099_total(v.id, p_tax_year) >= p_threshold
    and coalesce(v.include_1099, false) = true;
end;
$$ language plpgsql stable;

comment on function list_1099_candidates(integer, numeric) is
  'Lists vendors flagged for 1099 with totals at or above the threshold.';

commit;
