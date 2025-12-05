-- Add Buildium subcategory tracking to tasks
alter table public.tasks
  add column if not exists buildium_subcategory_id integer;

comment on column public.tasks.buildium_subcategory_id is 'Buildium SubCategory.Id for task category';
