begin;

-- Link uploaded files to transactions without overloading the files.entity_id (Buildium) column.
create table if not exists public.transaction_files (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.organizations(id) on delete cascade,
    transaction_id uuid not null references public.transactions(id) on delete cascade,
    file_id uuid not null references public.files(id) on delete cascade,
    added_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists transaction_files_tx_file_uniq
    on public.transaction_files(transaction_id, file_id);

create index if not exists idx_transaction_files_org on public.transaction_files(org_id);
create index if not exists idx_transaction_files_tx on public.transaction_files(transaction_id);
create index if not exists idx_transaction_files_file on public.transaction_files(file_id);

alter table public.transaction_files enable row level security;

-- RLS: org-scoped access via membership
drop policy if exists transaction_files_select_org on public.transaction_files;
create policy transaction_files_select_org on public.transaction_files
for select using (
    exists (
        select 1
        from public.org_memberships m
        where m.org_id = transaction_files.org_id
          and m.user_id = auth.uid()
    )
);

drop policy if exists transaction_files_insert_org on public.transaction_files;
create policy transaction_files_insert_org on public.transaction_files
for insert with check (
    exists (
        select 1
        from public.org_memberships m
        where m.org_id = transaction_files.org_id
          and m.user_id = auth.uid()
    )
);

drop policy if exists transaction_files_update_org on public.transaction_files;
create policy transaction_files_update_org on public.transaction_files
for update using (
    exists (
        select 1
        from public.org_memberships m
        where m.org_id = transaction_files.org_id
          and m.user_id = auth.uid()
    )
);

drop policy if exists transaction_files_delete_org on public.transaction_files;
create policy transaction_files_delete_org on public.transaction_files
for delete using (
    exists (
        select 1
        from public.org_memberships m
        where m.org_id = transaction_files.org_id
          and m.user_id = auth.uid()
    )
);

-- Trigger to keep updated_at fresh
do $$
begin
  create trigger trg_transaction_files_updated_at
    before update on public.transaction_files
    for each row
    execute function public.set_updated_at();
exception
  when duplicate_object then null;
end $$;

comment on table public.transaction_files is 'Join table linking files to transactions (org-scoped).';
comment on column public.transaction_files.org_id is 'Organization owning the transaction and file.';
comment on column public.transaction_files.transaction_id is 'Local transaction id (uuid).';
comment on column public.transaction_files.file_id is 'File id stored in public.files.';
comment on column public.transaction_files.added_by is 'User who attached the file.';

commit;
