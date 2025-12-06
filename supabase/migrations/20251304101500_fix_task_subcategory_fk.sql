-- Normalize task subcategory handling:
-- 1) Remove buildium_subcategory_id on both tasks and task_categories.
-- 2) Change tasks.subcategory to a foreign key referencing task_categories(id).

alter table public.tasks
  drop column if exists buildium_subcategory_id;

alter table public.task_categories
  drop column if exists buildium_subcategory_id;

-- If a text subcategory column exists, drop it before adding FK
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tasks'
      and column_name = 'subcategory'
      and data_type <> 'uuid'
  ) then
    execute 'alter table public.tasks drop column subcategory';
  end if;
end $$;

alter table public.tasks
  add column if not exists subcategory uuid references public.task_categories(id) on delete set null;

create index if not exists idx_tasks_subcategory on public.tasks(subcategory);
