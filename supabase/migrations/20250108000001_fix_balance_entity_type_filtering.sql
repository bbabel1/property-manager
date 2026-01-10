-- Update gl_account_balance_as_of() to filter by entity type
-- Property-scoped queries default to 'Rental' entity type
-- Global queries can filter by provided entity type (optional parameter)

begin;

create or replace function public.gl_account_balance_as_of(
  p_org_id uuid,
  p_gl_account_id uuid,
  p_as_of date,
  p_property_id uuid default null,
  p_entity_type public.entity_type_enum default null
) returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_property record;
  v_bank_tx numeric := 0;
  v_lines_balance numeric := 0;
  v_entity_type_filter public.entity_type_enum;
begin
  -- Enforce caller context to avoid cross-org leakage while bypassing RLS.
  if (select auth.uid()) is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if not public.is_org_member((select auth.uid()), p_org_id) then
    raise exception 'FORBIDDEN';
  end if;

  -- Ensure the GL account belongs to this org.
  if not exists (
    select 1 from public.gl_accounts ga
    where ga.id = p_gl_account_id
      and ga.org_id = p_org_id
  ) then
    raise exception 'gl_account_id % not found in org %', p_gl_account_id, p_org_id;
  end if;

  -- Determine entity type filter:
  --   - If property_id is provided, default to 'Rental' unless explicitly overridden
  --   - If property_id is null, use provided p_entity_type (or null = all types)
  if p_property_id is not null then
    v_entity_type_filter := coalesce(p_entity_type, 'Rental'::public.entity_type_enum);
  else
    v_entity_type_filter := p_entity_type;
  end if;

  if p_property_id is null then
    -- Global balance: transaction_lines + header-level bank transactions.
    select coalesce(sum(
      case when lower(coalesce(tl.posting_type, '')) = 'debit' then abs(coalesce(tl.amount, 0)) else 0 end
      -
      case when lower(coalesce(tl.posting_type, '')) = 'credit' then abs(coalesce(tl.amount, 0)) else 0 end
    ), 0)::numeric
    into v_lines_balance
    from public.transaction_lines tl
    where tl.gl_account_id = p_gl_account_id
      and tl.date <= p_as_of
      and (v_entity_type_filter is null or tl.account_entity_type = v_entity_type_filter);

    -- Sum transactions that explicitly point at this bank GL (header field).
    -- Note: transactions table doesn't have entity_type, so we include all
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
  else
    -- Property-scoped balance: guard property record first.
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

    -- Property-scoped queries filter by Rental entity type by default
    select coalesce(sum(
      case when lower(coalesce(tl.posting_type, '')) = 'debit' then abs(coalesce(tl.amount, 0)) else 0 end
      -
      case when lower(coalesce(tl.posting_type, '')) = 'credit' then abs(coalesce(tl.amount, 0)) else 0 end
    ), 0)::numeric
    into v_lines_balance
    from public.transaction_lines tl
    where tl.gl_account_id = p_gl_account_id
      and tl.date <= p_as_of
      and tl.account_entity_type = v_entity_type_filter
      and (
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
        -- include lines even when entity linkage is missing, but still filter by entity type.
        or (p_gl_account_id = v_property.operating_bank_gl_account_id)
        or (p_gl_account_id = v_property.deposit_trust_gl_account_id)
      );
  end if;

  return coalesce(v_lines_balance, 0)::numeric + coalesce(v_bank_tx, 0);
end;
$$;

comment on function public.gl_account_balance_as_of(uuid, uuid, date, uuid, public.entity_type_enum) is
'Returns debit-minus-credit balance for a GL account up to an as-of date, org-scoped. When property_id is provided, defaults to filtering by Rental entity type. Global queries can optionally filter by entity_type. Includes transaction_lines + transactions.bank_gl_account_id (deposits minus payments). SECURITY DEFINER with org membership guard.';

commit;




