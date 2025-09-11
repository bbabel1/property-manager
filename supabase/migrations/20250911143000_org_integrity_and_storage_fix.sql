-- 1) Helper to enforce same org between child and referenced parent
create or replace function public.enforce_same_org(child_org uuid, parent_org uuid, child_name text)
returns void language plpgsql as $$
begin
  if child_org is null or parent_org is null then
    raise exception '%: org_id cannot be null once backfilled', child_name;
  end if;
  if child_org <> parent_org then
    raise exception '%: org_id must match referenced record', child_name;
  end if;
end;
$$;

-- 2) Units -> Properties
create or replace function public.units_org_guard()
returns trigger language plpgsql as $$
declare p_org uuid;
begin
  select org_id into p_org from public.properties where id = new.property_id;
  perform public.enforce_same_org(new.org_id, p_org, 'units');
  return new;
end;
$$;

drop trigger if exists trg_units_org_guard on public.units;
create trigger trg_units_org_guard
before insert or update on public.units
for each row execute function public.units_org_guard();

-- 3) Ownerships -> (Properties, Owners)
create or replace function public.ownerships_org_guard()
returns trigger language plpgsql as $$
declare p_org uuid; o_org uuid;
begin
  select org_id into p_org from public.properties where id = new.property_id;
  select org_id into o_org from public.owners where id = new.owner_id;
  perform public.enforce_same_org(new.org_id, p_org, 'ownerships');
  perform public.enforce_same_org(new.org_id, o_org, 'ownerships');
  return new;
end;
$$;

drop trigger if exists trg_ownerships_org_guard on public.ownerships;
create trigger trg_ownerships_org_guard
before insert or update on public.ownerships
for each row execute function public.ownerships_org_guard();

-- 4) Lease contacts -> Tenants (and optional Leases if table exists)
create or replace function public.lease_contacts_org_guard()
returns trigger language plpgsql as $$
declare t_org uuid; -- l_org uuid;
begin
  select org_id into t_org from public.tenants where id = new.tenant_id;
  perform public.enforce_same_org(new.org_id, t_org, 'lease_contacts');
  -- If a leases table exists with org_id, also enforce it
  -- select org_id into l_org from public.leases where id = new.lease_id;
  -- perform public.enforce_same_org(new.org_id, l_org, 'lease_contacts');
  return new;
end;
$$;

drop trigger if exists trg_lease_contacts_org_guard on public.lease_contacts;
create trigger trg_lease_contacts_org_guard
before insert or update on public.lease_contacts
for each row execute function public.lease_contacts_org_guard();

-- 5) Work orders -> Properties/Units
create or replace function public.work_orders_org_guard()
returns trigger language plpgsql as $$
declare p_org uuid; u_org uuid;
begin
  if new.property_id is not null then
    select org_id into p_org from public.properties where id = new.property_id;
    perform public.enforce_same_org(new.org_id, p_org, 'work_orders');
  end if;
  if new.unit_id is not null then
    select org_id into u_org from public.units where id = new.unit_id;
    perform public.enforce_same_org(new.org_id, u_org, 'work_orders');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_work_orders_org_guard on public.work_orders;
create trigger trg_work_orders_org_guard
before insert or update on public.work_orders
for each row execute function public.work_orders_org_guard();

-- 6) Storage policy fixes: use column name (no NEW) and add update policy
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'objects'
  ) then
    begin
      execute $$ drop policy if exists "storage_write_org" on storage.objects $$;
      execute $$ create policy "storage_write_org" on storage.objects
      for insert with check (
        bucket_id = 'app' and exists (
          select 1 from public.org_memberships m
          where m.user_id = auth.uid()
            and m.org_id::text = split_part(name, '/', 2)
            and m.role in ('org_admin','org_manager','platform_admin')
        )
      ) $$;
    exception when others then null; end;

    begin
      execute $$ drop policy if exists "storage_update_org" on storage.objects $$;
      execute $$ create policy "storage_update_org" on storage.objects
      for update using (
        bucket_id = 'app' and exists (
          select 1 from public.org_memberships m
          where m.user_id = auth.uid()
            and m.org_id::text = split_part(name, '/', 2)
            and m.role in ('org_admin','org_manager','platform_admin')
        )
      ) $$;
    exception when others then null; end;
  end if;
end $$;

