-- Public IDs rollout (sequential, per table)
-- - Adds a shared domain + generator for simple, incrementing public identifiers
-- - Ensures every base table in the public schema has a populated, unique public_id

-- Drop all variants of old function
drop function if exists public.generate_public_id(text) cascade;
drop function if exists public.generate_public_id(prefix text) cascade;

-- Domain for all public IDs (positive integers)
-- If old text domain exists, we'll work with sequences but return as text for compatibility
do $$
begin
  -- Check if domain exists as text type
  if not exists (
    select 1 from pg_type t
    join pg_type base on base.oid = t.typbasetype
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'public_id'
    and base.typname = 'bigint'
  ) then
    -- Domain doesn't exist or is text type - create/keep as needed
    -- If it's text, we'll work with it; if it doesn't exist, create as bigint
    if not exists (
      select 1 from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = 'public_id'
    ) then
      create domain public.public_id as bigint
        check (value > 0);
    end if;
  end if;
exception
  when duplicate_object then null;
end $$;

-- Generator: returns next value from the table-specific sequence
-- Works with both text and bigint domains
create or replace function public.generate_public_id(target_table text)
  returns public.public_id
  language plpgsql
as $$
declare
  seq_name text := format('public.%I_public_id_seq', target_table);
  result bigint;
begin
  -- Ensure sequence exists
  execute format('create sequence if not exists public.%I_public_id_seq start with 1 increment by 1 minvalue 1', target_table);
  
  execute format('select nextval(%L)::bigint', seq_name) into result;
  
  -- Cast to public_id domain (works for both text and bigint base types)
  return result::public.public_id;
end;
$$;

-- Helper to add/backfill/lock public_id on every base table (idempotent)
create or replace function public.ensure_public_ids(target_schema text default 'public')
returns void
language plpgsql
as $$
declare
  rec record;
begin
  for rec in
    select t.table_name
    from information_schema.tables t
    where t.table_schema = target_schema
      and t.table_type = 'BASE TABLE'
      and t.table_name not in ('schema_migrations', 'supabase_migrations')
  loop
    begin
      -- 0) Ensure sequence exists starting at 1
      execute format('create sequence if not exists public.%I_public_id_seq start with 1 increment by 1 minvalue 1', rec.table_name);

      -- 1) Add column if missing
      execute format('alter table %I.%I add column if not exists public_id public.public_id', target_schema, rec.table_name);

      -- 2) Set default using the table-specific sequence via generator
      execute format('alter table %I.%I alter column public_id set default public.generate_public_id(%L)', target_schema, rec.table_name, rec.table_name);

      -- 3) Backfill existing rows
      execute format('update %I.%I set public_id = public.generate_public_id(%L) where public_id is null', target_schema, rec.table_name, rec.table_name);

      -- 4) Enforce not null
      execute format('alter table %I.%I alter column public_id set not null', target_schema, rec.table_name);

      -- 5) Enforce uniqueness (adds backing index)
      begin
        execute format('alter table %I.%I add constraint %I unique (public_id)', target_schema, rec.table_name, rec.table_name || '_public_id_key');
      exception
        when duplicate_object then null;
      end;
    exception
      when others then
        -- Log the error but continue with other tables
        raise notice 'Error processing table %: %', rec.table_name, sqlerrm;
    end;
  end loop;
end;
$$;

-- Apply to all existing base tables in the public schema
select public.ensure_public_ids('public');
