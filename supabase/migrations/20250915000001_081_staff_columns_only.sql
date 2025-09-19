-- Fallback: add staff profile columns without altering role types
set check_function_bodies = off;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='staff' and column_name='user_id') then
    alter table public.staff add column user_id uuid null references auth.users(id);
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='staff' and column_name='first_name') then
    alter table public.staff add column first_name text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='staff' and column_name='last_name') then
    alter table public.staff add column last_name text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='staff' and column_name='email') then
    alter table public.staff add column email text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='staff' and column_name='phone') then
    alter table public.staff add column phone text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='staff' and column_name='title') then
    alter table public.staff add column title text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='staff' and column_name='buildium_staff_id') then
    alter table public.staff add column buildium_staff_id integer;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='staff' and column_name='created_at') then
    alter table public.staff add column created_at timestamptz default now() not null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='staff' and column_name='updated_at') then
    alter table public.staff add column updated_at timestamptz default now() not null;
  end if;
end $$;

create unique index if not exists staff_buildium_staff_id_key on public.staff(buildium_staff_id) where buildium_staff_id is not null;
create index if not exists staff_user_id_idx on public.staff(user_id);
create unique index if not exists staff_email_key on public.staff(lower(email)) where email is not null;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists trg_staff_updated_at on public.staff;
    create trigger trg_staff_updated_at before update on public.staff for each row execute function public.set_updated_at();
  end if;
end $$;

