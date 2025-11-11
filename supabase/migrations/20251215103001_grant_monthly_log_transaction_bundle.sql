-- Ensure the monthly log bundle RPC is callable from PostgREST clients.
grant execute on function public.monthly_log_transaction_bundle(uuid) to service_role;
grant execute on function public.monthly_log_transaction_bundle(uuid) to authenticated;
grant execute on function public.monthly_log_transaction_bundle(uuid) to anon;
grant execute on function public.monthly_log_transaction_bundle(uuid) to supabase_admin;
