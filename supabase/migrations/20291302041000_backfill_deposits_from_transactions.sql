-- Data backfill for deposit overlays (deposit_meta + deposit_items)
-- Idempotent: guarded by deposit_migration_marker table per migration_name.

create table if not exists public.deposit_migration_marker (
  id uuid primary key default gen_random_uuid(),
  migration_name text unique not null,
  completed_at timestamptz not null default now(),
  rows_processed integer not null
);

comment on table public.deposit_migration_marker is 'Tracks completion of one-off deposit backfills to keep them idempotent.';

create or replace function backfill_deposit_meta_from_transactions()
returns integer
language plpgsql
as $$
declare
  marker_exists boolean;
  processed_count integer := 0;
  tx_record record;
  deposit_id_val text;
  deposit_status_val deposit_status_enum;
begin
  select exists(
    select 1 from public.deposit_migration_marker where migration_name = 'backfill_deposit_meta_v1'
  )
  into marker_exists;

  if marker_exists then
    raise notice 'Backfill already completed, skipping';
    return 0;
  end if;

  for tx_record in
    select
      t.id,
      t.org_id,
      t.bank_gl_account_id,
      t.buildium_transaction_id
    from public.transactions t
    where t.transaction_type = 'Deposit'
      and not exists (select 1 from public.deposit_meta dm where dm.transaction_id = t.id)
  loop
    if tx_record.org_id is null then
      raise notice 'Skipping transaction % due to missing org_id', tx_record.id;
      continue;
    end if;

    if tx_record.bank_gl_account_id is null then
      raise notice 'Skipping transaction % due to missing bank_gl_account_id', tx_record.id;
      continue;
    end if;

    select case
      when exists (
        select 1
        from public.transaction_lines tl
        join public.gl_accounts ga on ga.id = tl.gl_account_id
        join public.bank_register_entries bre on bre.transaction_line_id = tl.id
        where tl.transaction_id = tx_record.id
          and ga.is_bank_account = true
          and tl.posting_type = 'Debit'
          and bre.status = 'reconciled'
      ) then 'reconciled'::deposit_status_enum
      else 'posted'::deposit_status_enum
    end
    into deposit_status_val;

    select generate_deposit_id(tx_record.id) into deposit_id_val;

    insert into public.deposit_meta (transaction_id, deposit_id, status, buildium_deposit_id)
    values (tx_record.id, deposit_id_val, deposit_status_val, tx_record.buildium_transaction_id)
    on conflict (transaction_id) do update
      set deposit_id = excluded.deposit_id,
          status = excluded.status,
          buildium_deposit_id = coalesce(excluded.buildium_deposit_id, public.deposit_meta.buildium_deposit_id),
          updated_at = now();

    processed_count := processed_count + 1;
  end loop;

  insert into public.deposit_migration_marker (migration_name, rows_processed)
  values ('backfill_deposit_meta_v1', processed_count)
  on conflict (migration_name) do update
    set completed_at = now(), rows_processed = excluded.rows_processed;

  return processed_count;
end;
$$;

create or replace function backfill_deposit_items_from_transaction_payment_transactions()
returns integer
language plpgsql
as $$
declare
  marker_exists boolean;
  processed_count integer := 0;
  link_record record;
begin
  select exists(
    select 1 from public.deposit_migration_marker where migration_name = 'backfill_deposit_items_v1'
  )
  into marker_exists;

  if marker_exists then
    raise notice 'Backfill already completed, skipping';
    return 0;
  end if;

  for link_record in
    select
      tpt.transaction_id as deposit_transaction_id,
      tpt.buildium_payment_transaction_id,
      tpt.amount,
      (
        select id from public.transactions
        where buildium_transaction_id = tpt.buildium_payment_transaction_id
        limit 1
      ) as payment_transaction_id
    from public.transaction_payment_transactions tpt
    join public.transactions t on t.id = tpt.transaction_id
    where t.transaction_type = 'Deposit'
      and tpt.buildium_payment_transaction_id is not null
      and not exists (
        select 1 from public.deposit_items di
        where di.deposit_transaction_id = tpt.transaction_id
          and (
            di.payment_transaction_id = (
              select id from public.transactions
              where buildium_transaction_id = tpt.buildium_payment_transaction_id
              limit 1
            )
            or di.buildium_payment_transaction_id = tpt.buildium_payment_transaction_id
          )
      )
  loop
    if link_record.payment_transaction_id is null then
      raise notice 'Skipping link for deposit % due to missing payment transaction', link_record.deposit_transaction_id;
      continue;
    end if;

    begin
      -- Check if either unique constraint would be violated before inserting
      if not exists (
        select 1 from public.deposit_items di
        where di.payment_transaction_id = link_record.payment_transaction_id
           or (link_record.buildium_payment_transaction_id is not null
               and di.buildium_payment_transaction_id = link_record.buildium_payment_transaction_id)
      ) then
        insert into public.deposit_items (
          deposit_transaction_id,
          payment_transaction_id,
          buildium_payment_transaction_id,
          amount
        )
        values (
          link_record.deposit_transaction_id,
          link_record.payment_transaction_id,
          link_record.buildium_payment_transaction_id,
          link_record.amount
        )
        on conflict (payment_transaction_id) do nothing;
      end if;
    exception
      when unique_violation then
        raise notice 'Skipping duplicate deposit item for payment %', link_record.payment_transaction_id;
    end;

    processed_count := processed_count + 1;
  end loop;

  insert into public.deposit_migration_marker (migration_name, rows_processed)
  values ('backfill_deposit_items_v1', processed_count)
  on conflict (migration_name) do update
    set completed_at = now(), rows_processed = excluded.rows_processed;

  return processed_count;
end;
$$;

-- Execute idempotent backfills
select backfill_deposit_meta_from_transactions();
select backfill_deposit_items_from_transaction_payment_transactions();
