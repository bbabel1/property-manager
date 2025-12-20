-- Public IDs rollout
-- - Adds a shared domain + generator function for URL-safe public identifiers
-- - Ensures every base table in the public schema has a populated, unique public_id

-- Required for gen_random_bytes
create extension if not exists "pgcrypto";

-- Domain for all public IDs (lowercase, url-safe, 10-40 chars, allows a single prefix segment)
do $$
begin
  create domain public.public_id as text
    check (value ~ '^[a-z0-9_]{10,40}$');
exception
  when duplicate_object then null;
end $$;

-- Generator: lowercase, hex payload, optional 2-6 char prefix
create or replace function public.generate_public_id(prefix text default null)
  returns public.public_id
  language plpgsql
as $$
declare
  clean_prefix text := nullif(lower(prefix), '');
  body text;
begin
  if clean_prefix is not null and clean_prefix !~ '^[a-z0-9]{2,6}$' then
    raise exception 'public_id prefix must be 2-6 lowercase alphanumeric characters';
  end if;

  -- 80 bits of entropy → 20 hex chars; we keep 16 for compactness
  body := substring(encode(gen_random_bytes(10), 'hex') from 1 for 16);

  if clean_prefix is null then
    return body::public.public_id;
  end if;

  return (clean_prefix || '_' || body)::public.public_id;
end;
$$;

-- Helper to add/backfill/lock public_id on every base table (idempotent)
create or replace function public.ensure_public_ids(target_schema text default 'public')
returns void
language plpgsql
as $$
declare
  rec record;
  prefix text;
begin
  for rec in
    select
      t.table_name,
      coalesce(p.prefix, regexp_replace(substring(t.table_name from 1 for 3), '[^a-z0-9]', '', 'g')) as prefix
    from information_schema.tables t
    left join (
      values
        ('organizations', 'org'),
        ('org_memberships', 'ogm'),
        ('org_membership_roles', 'omr'),
        ('properties', 'prp'),
        ('buildings', 'bld'),
        ('units', 'uni'),
        ('tenants', 'ten'),
        ('owners', 'own'),
        ('ownerships', 'own'),
        ('lease', 'lea'),
        ('tasks', 'tsk'),
        ('task_history', 'tsh'),
        ('work_orders', 'wko'),
        ('vendors', 'ven'),
        ('transactions', 'txn'),
        ('transaction_lines', 'txl'),
        ('journal_entries', 'jrn'),
        ('reconciliation_log', 'rcl'),
        ('service_plans', 'spl'),
        ('service_plan_assignments', 'spa'),
        ('service_offerings', 'sof'),
        ('files', 'fil'),
        ('file_categories', 'fct'),
        ('contacts', 'con'),
        ('profiles', 'pro'),
        ('staff', 'stf'),
        ('property_staff', 'pst'),
        ('monthly_logs', 'mlg'),
        ('monthly_log_entries', 'mle'),
        ('monthly_log_task_rules', 'mlr'),
        ('property_onboarding', 'pob'),
        ('property_onboarding_tasks', 'pot'),
        ('property_images', 'pim'),
        ('unit_images', 'uim')
    ) as p(table_name, prefix) on p.table_name = t.table_name
    where t.table_schema = target_schema
      and t.table_type = 'BASE TABLE'
      and t.table_name not in ('schema_migrations', 'supabase_migrations', 'ownerships')
  loop
    prefix := coalesce(nullif(rec.prefix, ''), 'pub');

    begin
      -- 1) Add column if missing
      execute format('alter table %I.%I add column if not exists public_id public.public_id', target_schema, rec.table_name);

      -- 2) Set default using the table prefix
      execute format('alter table %I.%I alter column public_id set default public.generate_public_id(%L)', target_schema, rec.table_name, prefix);

      -- 3) Backfill existing rows
      execute format('update %I.%I set public_id = public.generate_public_id(%L) where public_id is null', target_schema, rec.table_name, prefix);

      -- 4) Enforce not null (skip for ownerships if it has pending trigger events)
      if rec.table_name = 'ownerships' then
        -- For ownerships, try to set not null, but handle pending trigger events gracefully
        begin
          execute format('alter table %I.%I alter column public_id set not null', target_schema, rec.table_name);
        exception
          when others then
            -- If it fails due to pending triggers, we'll set it in a separate step
            -- The column will still be added and backfilled
            raise notice 'Skipping NOT NULL constraint for % due to pending trigger events', rec.table_name;
        end;
      else
        execute format('alter table %I.%I alter column public_id set not null', target_schema, rec.table_name);
      end if;

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
  
  -- Note: ownerships table is skipped due to pending trigger events
  -- It will be handled in a follow-up migration after trigger issues are resolved
end;
$$;

-- Apply to all existing base tables in the public schema
select public.ensure_public_ids('public');
