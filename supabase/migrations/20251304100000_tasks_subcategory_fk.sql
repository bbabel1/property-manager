-- Ensure tasks store subcategory as a FK to task_categories instead of a raw Buildium ID
alter table public.tasks
  add column if not exists subcategory_id uuid references public.task_categories(id) on delete set null;

create index if not exists idx_tasks_subcategory_id on public.tasks(subcategory_id);

-- Clean up incorrect interim column
alter table public.tasks
  drop column if exists buildium_subcategory_id;
