-- Ensure post_transaction respects receipt flag defaults when callers omit them
begin;

create or replace function public.post_transaction(
  p_header jsonb,
  p_lines jsonb,
  p_idempotency_key text default null,
  p_validate_balance boolean default true
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction_id uuid;
  v_existing_id uuid;
  v_header public.transactions;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'p_lines must be a jsonb array'
      using errcode = '22023';
  end if;

  if p_idempotency_key is not null then
    select id into v_existing_id
    from public.transactions
    where idempotency_key = p_idempotency_key;

    if v_existing_id is not null then
      return v_existing_id;
    end if;
  end if;

  v_header := jsonb_populate_record(null::public.transactions, coalesce(p_header, '{}'::jsonb));
  v_header.id := coalesce(v_header.id, gen_random_uuid());
  v_header.idempotency_key := coalesce(p_idempotency_key, v_header.idempotency_key);
  v_header.created_at := coalesce(v_header.created_at, now());
  v_header.updated_at := coalesce(v_header.updated_at, now());
  v_header.date := coalesce(v_header.date, current_date);
  
  -- Ensure receipt flags have defaults (handle NULL from jsonb_populate_record when field is missing)
  if v_header.email_receipt is null then
    v_header.email_receipt := false;
  end if;
  if v_header.print_receipt is null then
    v_header.print_receipt := false;
  end if;

  insert into public.transactions
  select v_header.*
  returning id into v_transaction_id;

  perform replace_transaction_lines(
    v_transaction_id,
    p_lines,
    p_validate_balance
  );

  return v_transaction_id;
exception
  when others then
    raise;
end;
$$;

comment on function public.post_transaction(jsonb, jsonb, text, boolean) is
  'Atomically inserts a transaction header (with optional idempotency) and replaces all lines via replace_transaction_lines()';

commit;
