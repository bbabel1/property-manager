-- Add human-readable subcategory name for tasks
alter table public.tasks
  add column if not exists subcategory text;

comment on column public.tasks.subcategory is 'Display name for task subcategory (Buildium SubCategory.Name)';
