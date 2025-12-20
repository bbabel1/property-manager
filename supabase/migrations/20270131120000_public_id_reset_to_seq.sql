-- Reset existing public_id values to simple sequential integers starting at 1 per table.
-- This migration:
-- - Ensures a per-table sequence exists.
-- - Rewrites public_id columns to bigint (no prefixes).
-- - Backfills every row with nextval() so values are compact integers.
-- - Resets defaults and uniqueness constraints.

do $$
declare
  rec record;
  seq_name text;
  has_created_at boolean;
  has_id boolean;
  order_by text;
begin
  for rec in
    select table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'public_id'
      -- Skip problematic tables that might be views or have special constraints
      and table_name not in ('owners_list_cache')
  loop
    begin
    seq_name := format('public.%I_public_id_seq', rec.table_name);

    -- Ensure sequence exists and starts at 1
    execute format('create sequence if not exists %s start with 1 increment by 1 minvalue 1 cache 1', seq_name);

    -- Drop existing default to avoid conflicts during type change
    execute format('alter table public.%I alter column public_id drop default', rec.table_name);

    -- Check if column is text type and convert to bigint if needed
    -- We'll handle the type conversion before backfilling
    declare
      col_type text;
    begin
      select data_type into col_type
      from information_schema.columns
      where table_schema = 'public'
        and table_name = rec.table_name
        and column_name = 'public_id';
      
      if col_type = 'text' then
        -- Convert text column to bigint, extracting numbers or using row_number
        -- First, temporarily drop NOT NULL constraint if it exists
        begin
          execute format('alter table public.%I alter column public_id drop not null', rec.table_name);
        exception
          when others then
            -- Constraint might not exist, that's fine
            null;
        end;
        
        -- Try to convert type with USING clause that extracts numbers
        begin
          execute format('
            alter table public.%I 
            alter column public_id type bigint 
            using (
              case
                when public_id ~ ''^[0-9]+$'' then public_id::bigint
                when public_id ~ ''[0-9]+'' then regexp_replace(public_id, ''[^0-9]'', '''', ''g'')::bigint
                else 1::bigint
              end
            )
          ', rec.table_name);
        exception
          when others then
            -- If that fails, drop and recreate column (without NOT NULL initially)
            raise notice 'Type conversion using clause failed for %, recreating column: %', rec.table_name, sqlerrm;
            execute format('alter table public.%I drop column public_id', rec.table_name);
            execute format('alter table public.%I add column public_id bigint', rec.table_name);
        end;
      end if;
    end;

    -- Determine deterministic ordering: prefer created_at, then id, else ctid
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = rec.table_name and column_name = 'created_at'
    ) into has_created_at;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = rec.table_name and column_name = 'id'
    ) into has_id;

    order_by := null;
    if has_created_at then
      order_by := 'created_at';
    end if;
    if has_id then
      order_by := coalesce(order_by || ', ', '') || 'id';
    end if;
    if order_by is null then
      order_by := 'ctid';
    else
      order_by := order_by || ', ctid'; -- tie-breaker for determinism
    end if;

    -- Reset sequence to 1 so nextval starts at 2 after we setval to max
    -- (We'll set it to max after backfilling, so this is just initialization)
    execute format('select setval(%L, 1, false)', seq_name);

    -- Backfill deterministically using row_number over chosen ordering
    -- Update all rows, including those with NULL public_id
    execute format(
      'with ordered as (
         select ctid, row_number() over (order by %s) as rn
         from public.%I
       )
       update public.%I t
       set public_id = o.rn
       from ordered o
       where t.ctid = o.ctid
         and (t.public_id is null or t.public_id != o.rn)',
      order_by,
      rec.table_name,
      rec.table_name
    );

    -- Ensure column type is bigint (should already be bigint if we converted above)
    -- If it's still not bigint, convert it now
    declare
      col_type text;
    begin
      select data_type into col_type
      from information_schema.columns
      where table_schema = 'public'
        and table_name = rec.table_name
        and column_name = 'public_id';
      
      if col_type != 'bigint' then
        execute format('alter table public.%I alter column public_id type bigint using public_id::bigint', rec.table_name);
      end if;
    end;

    -- Set default to the table-specific sequence
    execute format('alter table public.%I alter column public_id set default nextval(%L)', rec.table_name, seq_name);

    -- Enforce not null
    execute format('alter table public.%I alter column public_id set not null', rec.table_name);

    -- Ensure uniqueness constraint exists
    declare
      constraint_exists boolean;
      constraint_name text := rec.table_name || '_public_id_key';
    begin
      -- Check if constraint already exists
      select exists (
        select 1 from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = 'public'
          and t.relname = rec.table_name
          and c.conname = constraint_name
      ) into constraint_exists;
      
      if not constraint_exists then
        execute format('alter table public.%I add constraint %I unique (public_id)', rec.table_name, constraint_name);
      end if;
    exception
      when duplicate_object then
        -- Constraint already exists, that's fine
        null;
    end;

    -- Align sequence with the current max value so next insert is max+1
    -- Use 1 as minimum (sequences can't be set to 0)
    execute format('select setval(%L, greatest(coalesce((select max(public_id) from public.%I), 0), 1), true)', seq_name, rec.table_name);
    
    exception
      when others then
        -- Log the error but continue with other tables
        raise notice 'Error processing table %: %', rec.table_name, sqlerrm;
    end;
  end loop;
end;
$$;
