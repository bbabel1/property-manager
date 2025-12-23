-- Ensure bank balance RPC functions have consistent definer ownership and execute grants
-- across all environments.
--
-- Notes:
-- - CREATE OR REPLACE FUNCTION preserves existing owner and privileges; this migration
--   makes both explicit to avoid drift.
-- - SECURITY DEFINER is only effective if the owner has the required privileges.

begin;

-- Ensure functions are owned by a role with the expected privileges (typically postgres).
alter function public.gl_account_balance_as_of(uuid, uuid, date, uuid) owner to postgres;
alter function public.v_gl_account_balances_as_of(uuid, date) owner to postgres;

-- Ensure expected roles can execute these RPC functions.
grant execute on function public.gl_account_balance_as_of(uuid, uuid, date, uuid) to authenticated, service_role;
grant execute on function public.v_gl_account_balances_as_of(uuid, date) to authenticated, service_role;

commit;


