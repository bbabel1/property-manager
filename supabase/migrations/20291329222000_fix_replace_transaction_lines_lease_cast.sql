-- Ensure replace_transaction_lines casts lease_id to bigint (matches lease PK) instead of uuid
begin;

create or replace function replace_transaction_lines(
  p_transaction_id uuid,
  p_lines jsonb,
  p_validate_balance boolean default true
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line_record jsonb;
  v_now timestamptz := now();
  v_property_id uuid;
  v_unit_id uuid;
  v_account_entity_type public.entity_type_enum;
  v_account_entity_id integer;
  v_prop_in uuid;
  v_unit_in uuid;
  v_account_entity_type_in public.entity_type_enum;
  v_account_entity_id_in integer;
begin
  -- Lock and fetch scope defaults from transaction header
  select property_id, unit_id, account_entity_type, account_entity_id
  into v_property_id, v_unit_id, v_account_entity_type, v_account_entity_id
  from public.transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Transaction % not found', p_transaction_id;
  end if;

  -- Delete existing lines
  delete from transaction_lines
  where transaction_id = p_transaction_id;

  -- Insert new lines from JSONB array
  for v_line_record in select * from jsonb_array_elements(p_lines)
  loop
    v_prop_in := coalesce(
      nullif((v_line_record->>'property_id')::text, 'null')::uuid,
      v_property_id
    );
    v_unit_in := coalesce(
      nullif((v_line_record->>'unit_id')::text, 'null')::uuid,
      v_unit_id
    );

    if v_property_id is not null and v_prop_in is distinct from v_property_id then
      raise exception 'Line property_id must match transaction property_id';
    end if;

    if v_unit_id is not null and v_unit_in is distinct from v_unit_id then
      raise exception 'Line unit_id must match transaction unit_id';
    end if;

    if v_unit_in is not null and v_prop_in is null then
      raise exception 'Line unit_id requires property_id';
    end if;

    v_account_entity_type_in := coalesce(
      nullif(v_line_record->>'account_entity_type', 'null')::public.entity_type_enum,
      v_account_entity_type,
      'Rental'::public.entity_type_enum
    );
    v_account_entity_id_in := coalesce(
      nullif((v_line_record->>'account_entity_id')::text, 'null')::integer,
      v_account_entity_id
    );

    insert into transaction_lines (
      transaction_id,
      gl_account_id,
      amount,
      posting_type,
      memo,
      account_entity_type,
      account_entity_id,
      property_id,
      unit_id,
      lease_id,
      buildium_property_id,
      buildium_unit_id,
      buildium_lease_id,
      date,
      created_at,
      updated_at,
      reference_number,
      is_cash_posting
    ) values (
      p_transaction_id,
      (v_line_record->>'gl_account_id')::uuid,
      (v_line_record->>'amount')::numeric,
      (v_line_record->>'posting_type')::text,
      nullif(v_line_record->>'memo', 'null'),
      v_account_entity_type_in,
      v_account_entity_id_in,
      v_prop_in,
      v_unit_in,
      nullif((v_line_record->>'lease_id')::text, 'null')::bigint,
      nullif((v_line_record->>'buildium_property_id')::text, 'null')::integer,
      nullif((v_line_record->>'buildium_unit_id')::text, 'null')::integer,
      nullif((v_line_record->>'buildium_lease_id')::text, 'null')::integer,
      coalesce((v_line_record->>'date')::date, current_date),
      coalesce((v_line_record->>'created_at')::timestamptz, v_now),
      coalesce((v_line_record->>'updated_at')::timestamptz, v_now),
      nullif(v_line_record->>'reference_number', 'null'),
      coalesce((v_line_record->>'is_cash_posting')::boolean, false)
    );
  end loop;

  -- Validate balance if requested
  if p_validate_balance then
    perform validate_transaction_balance(p_transaction_id);
  end if;

exception
  when others then
    raise;
end;
$$;

commit;
