-- Fix balance calculation functions to filter by account_entity_type
-- This ensures Rental and Company transactions are calculated separately

begin;

-- Fix gl_account_balance_as_of to accept optional entity_type filter
create or replace function public.gl_account_balance_as_of(
  p_org_id uuid,
  p_gl_account_id uuid,
  p_as_of date,
  p_property_id uuid default null,
  p_entity_type public.entity_type_enum default null
) returns numeric
language plpgsql
stable
as $$
declare
  v_property record;
  v_bank_tx numeric := 0;
begin
  -- Ensure the GL account belongs to this org.
  if not exists (
    select 1 from public.gl_accounts ga
    where ga.id = p_gl_account_id
      and ga.org_id = p_org_id
  ) then
    raise exception 'gl_account_id % not found in org %', p_gl_account_id, p_org_id;
  end if;

  if p_property_id is not null then
    select
      p.id,
      p.org_id,
      p.buildium_property_id,
      p.operating_bank_gl_account_id,
      p.deposit_trust_gl_account_id
    into v_property
    from public.properties p
    where p.id = p_property_id;

    if not found then
      raise exception 'property_id % not found', p_property_id;
    end if;

    if v_property.org_id <> p_org_id then
      raise exception 'property_id % not in org %', p_property_id, p_org_id;
    end if;
  end if;

  -- Sum transactions that explicitly point at this bank GL (header field).
  -- Only include for global queries (property_id is null)
  -- Note: transactions table doesn't have entity_type, so we include all for global queries
  if p_property_id is null then
    select coalesce(sum(
      case
        when lower(coalesce(t.transaction_type::text, '')) in (
          'payment',
          'electronicfundstransfer',
          'applydeposit',
          'refund',
          'unreversedpayment',
          'unreversedelectronicfundstransfer',
          'reverseelectronicfundstransfer',
          'reversepayment'
        ) then -abs(coalesce(t.total_amount, 0))
        when lower(coalesce(t.transaction_type::text, '')) in (
          'deposit',
          'ownercontribution',
          'unreversedownercontribution',
          'generaljournalentry'
        ) then abs(coalesce(t.total_amount, 0))
        else 0
      end
    ), 0)::numeric
    into v_bank_tx
    from public.transactions t
    where t.bank_gl_account_id = p_gl_account_id
      and t.org_id = p_org_id
      and t.date <= p_as_of;
  end if;

  return coalesce((
    select
      coalesce(sum(case when lower(coalesce(tl.posting_type, '')) = 'debit' then abs(coalesce(tl.amount, 0)) else 0 end), 0)
      -
      coalesce(sum(case when lower(coalesce(tl.posting_type, '')) = 'credit' then abs(coalesce(tl.amount, 0)) else 0 end), 0)
    from public.transaction_lines tl
    where tl.gl_account_id = p_gl_account_id
      and tl.date <= p_as_of
      -- Filter by entity type: for property queries, default to Rental; otherwise use provided filter or include all
      and (
        p_property_id is not null 
          -- For property-scoped queries, only include Rental entity type
          ? tl.account_entity_type = 'Rental'::public.entity_type_enum
          -- For global queries, filter by provided entity type or include all if null
          : (p_entity_type is null or tl.account_entity_type = p_entity_type)
      )
      and (
        p_property_id is null
        or (
          -- Inclusion rules: property_id, unit->property, lease->property, buildium_lease_id, buildium_property_id fallback
          tl.property_id = v_property.id
          or (tl.unit_id is not null and exists (
            select 1 from public.units u
            where u.id = tl.unit_id and u.property_id = v_property.id
          ))
          or (tl.lease_id is not null and exists (
            select 1 from public.lease l
            where l.id = tl.lease_id and l.property_id = v_property.id
          ))
          or (tl.buildium_lease_id is not null and exists (
            select 1 from public.lease l2
            where l2.buildium_lease_id = tl.buildium_lease_id and l2.property_id = v_property.id
          ))
          or (v_property.buildium_property_id is not null and tl.buildium_property_id = v_property.buildium_property_id)
          -- Bank GL special-case: if this GL account is the property's operating/deposit bank GL,
          -- include lines even when entity linkage is missing, but only Rental entity type
          or (
            (p_gl_account_id = v_property.operating_bank_gl_account_id
             or p_gl_account_id = v_property.deposit_trust_gl_account_id)
            and tl.account_entity_type = 'Rental'::public.entity_type_enum
          )
        )
      )
  ), 0)::numeric + coalesce(v_bank_tx, 0);
end;
$$;

comment on function public.gl_account_balance_as_of(uuid, uuid, date, uuid, public.entity_type_enum) is
'Returns debit-minus-credit balance for a GL account up to an as-of date, org-scoped. 
Includes transaction_lines + transactions.bank_gl_account_id (deposits minus payments). 
When property_id is provided, includes linked lines for that property and filters by Rental entity type.
When p_entity_type is provided, filters transaction_lines by that entity type.';

commit;
