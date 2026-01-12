-- Pin search_path on remaining flagged routines.

ALTER PROCEDURE public.refresh_gl_account_balances(uuid, date)
  SET search_path = public;

ALTER FUNCTION public.fn_units_copy_address_from_property()
  SET search_path = public;
