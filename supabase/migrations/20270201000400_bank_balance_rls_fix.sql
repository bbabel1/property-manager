-- Make balance functions run with definer rights so RLS on transactions/transaction_lines
-- doesn't block authenticated users when computing bank balances.
begin;

create or replace function public.gl_account_balance_as_of(
  p_org_id uuid,
  p_gl_account_id uuid,
  p_as_of date,
  p_property_id uuid default null
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
      and tl.date <= p_as_of;

    -- Sum transactions that explicitly point at this bank GL (header field).
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

    select coalesce(sum(
      case when lower(coalesce(tl.posting_type, '')) = 'debit' then abs(coalesce(tl.amount, 0)) else 0 end
      -
      case when lower(coalesce(tl.posting_type, '')) = 'credit' then abs(coalesce(tl.amount, 0)) else 0 end
    ), 0)::numeric
    into v_lines_balance
    from public.transaction_lines tl
    where tl.gl_account_id = p_gl_account_id
      and tl.date <= p_as_of
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
        -- include lines even when entity linkage is missing.
        or (p_gl_account_id = v_property.operating_bank_gl_account_id)
        or (p_gl_account_id = v_property.deposit_trust_gl_account_id)
      );
  end if;

  return coalesce(v_lines_balance, 0)::numeric + coalesce(v_bank_tx, 0);
end;
$$;

comment on function public.gl_account_balance_as_of(uuid, uuid, date, uuid) is
'Returns debit-minus-credit balance for a GL account up to an as-of date, org-scoped. Includes transaction_lines + transactions.bank_gl_account_id (deposits minus payments). When property_id is provided, includes linked lines for that property. SECURITY DEFINER with org membership guard.';

create or replace function public.v_gl_account_balances_as_of(
  p_org_id uuid,
  p_as_of date
) returns table (
  org_id uuid,
  gl_account_id uuid,
  property_id uuid,
  as_of_date date,
  debits numeric,
  credits numeric,
  balance numeric,
  lines_count bigint,
  account_number text,
  name text,
  type text,
  sub_type text,
  is_active boolean,
  is_bank_account boolean,
  is_credit_card_account boolean,
  is_contra_account boolean,
  exclude_from_cash_balances boolean,
  buildium_gl_account_id integer,
  buildium_parent_gl_account_id integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if not public.is_org_member((select auth.uid()), p_org_id) then
    raise exception 'FORBIDDEN';
  end if;

  return query
  with accounts as (
    select
      ga.id,
      ga.org_id,
      ga.account_number,
      ga.name,
      ga.type,
      ga.sub_type,
      ga.is_active,
      ga.is_bank_account,
      ga.is_credit_card_account,
      ga.is_contra_account,
      coalesce(ga.exclude_from_cash_balances, false) as exclude_from_cash_balances,
      ga.buildium_gl_account_id,
      ga.buildium_parent_gl_account_id
    from public.gl_accounts ga
    where ga.org_id = p_org_id
  ),
  global_agg as (
    select
      tl.gl_account_id,
      coalesce(sum(case when lower(coalesce(tl.posting_type, '')) = 'debit' then abs(coalesce(tl.amount, 0)) else 0 end), 0)::numeric as debits,
      coalesce(sum(case when lower(coalesce(tl.posting_type, '')) = 'credit' then abs(coalesce(tl.amount, 0)) else 0 end), 0)::numeric as credits,
      count(*)::bigint as lines_count
    from public.transaction_lines tl
    join accounts a on a.id = tl.gl_account_id
    where tl.date <= p_as_of
    group by tl.gl_account_id
  ),
  bank_tx_agg as (
    select
      t.bank_gl_account_id as gl_account_id,
      sum(
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
      )::numeric as net,
      count(*)::bigint as tx_count
    from public.transactions t
    join accounts a on a.id = t.bank_gl_account_id
    where t.date <= p_as_of
    group by t.bank_gl_account_id
  ),
  properties_in_org as (
    select
      p.id,
      p.buildium_property_id,
      p.operating_bank_gl_account_id,
      p.deposit_trust_gl_account_id
    from public.properties p
    where p.org_id = p_org_id
  ),
  property_agg as (
    select
      p.id as property_id,
      tl.gl_account_id,
      coalesce(sum(case when lower(coalesce(tl.posting_type, '')) = 'debit' then abs(coalesce(tl.amount, 0)) else 0 end), 0)::numeric as debits,
      coalesce(sum(case when lower(coalesce(tl.posting_type, '')) = 'credit' then abs(coalesce(tl.amount, 0)) else 0 end), 0)::numeric as credits,
      count(*)::bigint as lines_count
    from properties_in_org p
    join public.transaction_lines tl
      on tl.date <= p_as_of
    join accounts a on a.id = tl.gl_account_id
    where
      (
        tl.property_id = p.id
        or (tl.unit_id is not null and exists (
          select 1 from public.units u
          where u.id = tl.unit_id and u.property_id = p.id
        ))
        or (tl.lease_id is not null and exists (
          select 1 from public.lease l
          where l.id = tl.lease_id and l.property_id = p.id
        ))
        or (tl.buildium_lease_id is not null and exists (
          select 1 from public.lease l2
          where l2.buildium_lease_id = tl.buildium_lease_id and l2.property_id = p.id
        ))
        or (p.buildium_property_id is not null and tl.buildium_property_id = p.buildium_property_id)
        or (p.operating_bank_gl_account_id is not null and tl.gl_account_id = p.operating_bank_gl_account_id)
        or (p.deposit_trust_gl_account_id is not null and tl.gl_account_id = p.deposit_trust_gl_account_id)
      )
    group by p.id, tl.gl_account_id
  )
  -- Global (property_id null)
  select
    a.org_id as org_id,
    a.id as gl_account_id,
    null::uuid as property_id,
    p_as_of as as_of_date,
    coalesce(g.debits, 0)::numeric as debits,
    coalesce(g.credits, 0)::numeric as credits,
    (coalesce(g.debits, 0) - coalesce(g.credits, 0) + coalesce(bt.net, 0))::numeric as balance,
    coalesce(g.lines_count, 0)::bigint + coalesce(bt.tx_count, 0)::bigint as lines_count,
    a.account_number,
    a.name,
    a.type,
    a.sub_type,
    a.is_active,
    a.is_bank_account,
    a.is_credit_card_account,
    a.is_contra_account,
    a.exclude_from_cash_balances,
    a.buildium_gl_account_id,
    a.buildium_parent_gl_account_id
  from accounts a
  left join global_agg g on g.gl_account_id = a.id
  left join bank_tx_agg bt on bt.gl_account_id = a.id

  union all

  -- Property-scoped rows (all accounts x all properties in org, left-joined to aggregates)
  select
    a.org_id as org_id,
    a.id as gl_account_id,
    p.id as property_id,
    p_as_of as as_of_date,
    coalesce(pa.debits, 0)::numeric as debits,
    coalesce(pa.credits, 0)::numeric as credits,
    (coalesce(pa.debits, 0) - coalesce(pa.credits, 0))::numeric as balance,
    coalesce(pa.lines_count, 0)::bigint as lines_count,
    a.account_number,
    a.name,
    a.type,
    a.sub_type,
    a.is_active,
    a.is_bank_account,
    a.is_credit_card_account,
    a.is_contra_account,
    a.exclude_from_cash_balances,
    a.buildium_gl_account_id,
    a.buildium_parent_gl_account_id
  from accounts a
  cross join properties_in_org p
  left join property_agg pa
    on pa.property_id = p.id and pa.gl_account_id = a.id;
end;
$$;

comment on function public.v_gl_account_balances_as_of(uuid, date) is
'Org-scoped GL balances as-of date. Global rows include transaction_lines plus transactions.bank_gl_account_id (deposits minus payments). Property rows remain transaction_line scoped. SECURITY DEFINER with org membership guard.';

commit;
