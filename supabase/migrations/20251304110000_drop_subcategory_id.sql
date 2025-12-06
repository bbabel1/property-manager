-- Clean up duplicate subcategory column on tasks

-- Drop the stray subcategory_id column if present
alter table public.tasks
  drop column if exists subcategory_id;

-- Ensure subcategory is the single FK to task_categories(id)
alter table public.tasks
  add column if not exists subcategory uuid references public.task_categories(id) on delete set null;

create index if not exists idx_tasks_subcategory on public.tasks(subcategory);
