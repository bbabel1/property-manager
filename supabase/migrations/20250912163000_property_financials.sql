-- Function: get_property_financials(property_id uuid, as_of date)
-- Returns a compact JSON object with balances for the Property Details → Financials tab
-- Cash balance derives from bank accounts (is_bank_account = true) and excludes accounts flagged to be excluded
-- Availability = cash - reserve - security deposits (currently 0 unless modeled via dedicated GL)

CREATE OR REPLACE FUNCTION public.get_property_financials(p_property_id uuid, p_as_of date DEFAULT current_date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_cash numeric := 0;
  v_reserve numeric := 0;
  v_secdep numeric := 0; -- placeholder; wire to a specific GL category if modeled
  v_available numeric := 0;
  v_last_reconciled timestamptz := NULL; -- optional: populate when reconciliation log exists
BEGIN
  -- Cash balance by summing bank accounts lines for the property
  SELECT COALESCE(SUM(
           CASE WHEN tl.posting_type = 'Debit' THEN tl.amount ELSE 0 END
         ) - SUM(
           CASE WHEN tl.posting_type = 'Credit' THEN tl.amount ELSE 0 END
         ), 0)
    INTO v_cash
  FROM public.transaction_lines tl
  JOIN public.gl_accounts ga ON ga.id = tl.gl_account_id
  WHERE tl.property_id = p_property_id
    AND tl.date <= p_as_of
    AND ga.is_bank_account = true
    AND COALESCE(ga.exclude_from_cash_balances, false) = false;

  -- Reserve from properties table
  SELECT COALESCE(reserve, 0) INTO v_reserve FROM public.properties WHERE id = p_property_id;

  v_available := COALESCE(v_cash,0) - COALESCE(v_reserve,0) - COALESCE(v_secdep,0);

  RETURN jsonb_build_object(
    'as_of', p_as_of,
    'cash_balance', COALESCE(v_cash,0),
    'security_deposits', COALESCE(v_secdep,0),
    'reserve', COALESCE(v_reserve,0),
    'available_balance', COALESCE(v_available,0),
    'last_reconciled_at', v_last_reconciled
  );
END;
$$;

COMMENT ON FUNCTION public.get_property_financials(uuid, date) IS 'Financial snapshot for a property as of date, for UI consumption';

