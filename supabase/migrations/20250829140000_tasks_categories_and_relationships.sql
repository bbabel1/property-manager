-- Tasks v2: kinds, relationships, categories hierarchy, and Buildium fallbacks
-- This migration aligns the local schema to support importing Buildium Owner/Resident/To-Do/Contact requests

-- 1) Enum for task kinds
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'task_kind_enum' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.task_kind_enum AS ENUM ('owner','resident','contact','todo','other');
  END IF;
END $$;

-- 2) Extend task_categories with hierarchy and subcategory support
ALTER TABLE public.task_categories
  ADD COLUMN IF NOT EXISTS parent_id uuid NULL,
  ADD COLUMN IF NOT EXISTS buildium_subcategory_id integer NULL;

ALTER TABLE public.task_categories
  ADD CONSTRAINT task_categories_parent_fk
  FOREIGN KEY (parent_id) REFERENCES public.task_categories(id) ON DELETE SET NULL;

-- Helpful uniqueness constraints for Buildium mappings
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_categories_buildium_category_id
  ON public.task_categories(buildium_category_id)
  WHERE buildium_category_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_categories_buildium_subcategory_id
  ON public.task_categories(buildium_subcategory_id)
  WHERE buildium_subcategory_id IS NOT NULL;

-- 3) Add Buildium contact mapping to contacts
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS buildium_contact_id integer NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_buildium_contact_id
  ON public.contacts(buildium_contact_id)
  WHERE buildium_contact_id IS NOT NULL;

-- 4) Extend tasks with discriminator, relationships, and Buildium fallback IDs
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS task_kind public.task_kind_enum NULL,
  ADD COLUMN IF NOT EXISTS task_category_id uuid NULL,
  ADD COLUMN IF NOT EXISTS requested_by_contact_id integer NULL,
  ADD COLUMN IF NOT EXISTS requested_by_type text NULL,
  ADD COLUMN IF NOT EXISTS requested_by_buildium_id integer NULL,
  ADD COLUMN IF NOT EXISTS owner_id uuid NULL,
  ADD COLUMN IF NOT EXISTS tenant_id uuid NULL,
  ADD COLUMN IF NOT EXISTS lease_id integer NULL,
  ADD COLUMN IF NOT EXISTS assigned_to_staff_id integer NULL,
  -- Buildium fallback/entity IDs for later backfill
  ADD COLUMN IF NOT EXISTS buildium_property_id integer NULL,
  ADD COLUMN IF NOT EXISTS buildium_unit_id integer NULL,
  ADD COLUMN IF NOT EXISTS buildium_owner_id integer NULL,
  ADD COLUMN IF NOT EXISTS buildium_tenant_id integer NULL,
  ADD COLUMN IF NOT EXISTS buildium_lease_id integer NULL,
  ADD COLUMN IF NOT EXISTS buildium_assigned_to_user_id integer NULL;

-- 5) Add FKs on new task columns
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_task_category_fk
  FOREIGN KEY (task_category_id) REFERENCES public.task_categories(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_requested_by_contact_fk
  FOREIGN KEY (requested_by_contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_owner_fk
  FOREIGN KEY (owner_id) REFERENCES public.owners(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_lease_fk
  FOREIGN KEY (lease_id) REFERENCES public.lease(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_assigned_to_staff_fk
  FOREIGN KEY (assigned_to_staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;

-- 6) Indexes for performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_buildium_task_id_unique
  ON public.tasks(buildium_task_id)
  WHERE buildium_task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_task_category_id ON public.tasks(task_category_id);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_id ON public.tasks(owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_id ON public.tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_lease_id ON public.tasks(lease_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to_staff_id ON public.tasks(assigned_to_staff_id);
CREATE INDEX IF NOT EXISTS idx_tasks_kind_status ON public.tasks(task_kind, status);

-- 7) Enforce category for To-Do tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_todo_requires_category'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_todo_requires_category
      CHECK (task_kind <> 'todo'::public.task_kind_enum OR task_category_id IS NOT NULL);
  END IF;
END $$;
