-- Enforce immutability and server-generated public_id values
-- - Prevent updates to public_id after insert
-- - Force inserts to use the table-specific sequence (ignores supplied values)
-- - Ensure defaults/constraints/sequences are aligned

create or replace function public.prevent_public_id_update()
returns trigger
language plpgsql
as $$
begin
  if new.public_id is distinct from old.public_id then
    raise exception 'public_id is immutable and cannot be updated';
  end if;
  return new;
end;
$$;

create or replace function public.force_public_id_on_insert()
returns trigger
language plpgsql
as $$
declare
  seq_name text := format('public.%I_public_id_seq', tg_table_name);
begin
  -- Always assign from sequence; ignore provided value
  new.public_id := nextval(seq_name);
  return new;
end;
$$;

do $$
declare
  rec record;
  seq_name text;
  constraint_name text;
  trig_update text;
  trig_insert text;
begin
  for rec in
    select table_schema, table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'public_id'
  loop
    seq_name := format('public.%I_public_id_seq', rec.table_name);
    constraint_name := format('%s_public_id_key', rec.table_name);
    trig_update := format('%s_public_id_immutable', rec.table_name);
    trig_insert := format('%s_public_id_set', rec.table_name);

    -- Ensure sequence exists
    execute format('create sequence if not exists %s start with 1 increment by 1 minvalue 1', seq_name);

    -- Ensure default uses the sequence
    execute format('alter table %I.%I alter column public_id set default nextval(%L)', rec.table_schema, rec.table_name, seq_name);

    -- Enforce NOT NULL and uniqueness
    execute format('alter table %I.%I alter column public_id set not null', rec.table_schema, rec.table_name);
    if not exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = rec.table_schema
        and t.relname = rec.table_name
        and c.conname = constraint_name
    ) and not exists (
      select 1
      from pg_class idx
      join pg_namespace ns on ns.oid = idx.relnamespace
      where ns.nspname = rec.table_schema
        and idx.relname = constraint_name
        and idx.relkind = 'i'
    ) then
      -- Guard against existing constraints/indexes (error 42710/42P07) so the migration is idempotent
      begin
        execute format('alter table %I.%I add constraint %I unique (public_id)', rec.table_schema, rec.table_name, constraint_name);
      exception
        when duplicate_object or duplicate_table then null;
      end;
    end if;

    -- Drop and recreate triggers to avoid duplicates
    execute format('drop trigger if exists %I on %I.%I', trig_update, rec.table_schema, rec.table_name);
    execute format('drop trigger if exists %I on %I.%I', trig_insert, rec.table_schema, rec.table_name);

    -- Block updates to public_id
    execute format(
      'create trigger %I before update on %I.%I for each row when (new.public_id is distinct from old.public_id) execute function public.prevent_public_id_update()',
      trig_update, rec.table_schema, rec.table_name
    );

    -- Force inserts to use sequence (ignore supplied values)
    execute format(
      'create trigger %I before insert on %I.%I for each row execute function public.force_public_id_on_insert()',
      trig_insert, rec.table_schema, rec.table_name
    );

    -- Align sequence to current max (only for numeric public_id columns)
    begin
      execute format('select setval(%L, greatest(coalesce((select max(public_id)::bigint from %I.%I), 1), 1))', seq_name, rec.table_schema, rec.table_name);
    exception
      when others then
        -- Skip setval if public_id is not numeric (e.g., text type)
        null;
    end;
  end loop;
end;
$$;
