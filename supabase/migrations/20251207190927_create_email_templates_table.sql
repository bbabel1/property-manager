-- Migration: Create email_templates table
-- Purpose: Centralized email template management system for organizations
-- Supports customizable email templates with dynamic variable substitution

-- Create enum for template status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_template_status') THEN
    CREATE TYPE public.email_template_status AS ENUM ('active', 'inactive', 'archived');
  END IF;
END
$$;

-- Create enum for template keys (extensible)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_template_key') THEN
    CREATE TYPE public.email_template_key AS ENUM ('monthly_rental_statement');
  END IF;
END
$$;

-- Create email_templates table
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL, -- Using TEXT instead of enum for easier extension
  name TEXT NOT NULL,
  description TEXT,
  subject_template TEXT NOT NULL,
  body_html_template TEXT NOT NULL,
  body_text_template TEXT,
  available_variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Constraints
  CONSTRAINT email_templates_org_key_unique UNIQUE(org_id, template_key),
  CONSTRAINT email_templates_template_key_check CHECK (template_key IN ('monthly_rental_statement')),
  CONSTRAINT email_templates_subject_length CHECK (char_length(subject_template) <= 500),
  CONSTRAINT email_templates_html_length CHECK (char_length(body_html_template) <= 50000),
  CONSTRAINT email_templates_text_length CHECK (body_text_template IS NULL OR char_length(body_text_template) <= 50000),
  CONSTRAINT email_templates_name_length CHECK (char_length(name) <= 255),
  CONSTRAINT email_templates_description_length CHECK (description IS NULL OR char_length(description) <= 1000)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_templates_org_id ON public.email_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_org_key ON public.email_templates(org_id, template_key);
CREATE INDEX IF NOT EXISTS idx_email_templates_org_key_active ON public.email_templates(org_id, template_key) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_email_templates_status ON public.email_templates(org_id, status) WHERE status = 'active';

-- Add updated_at trigger
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    CREATE TRIGGER trg_email_templates_updated_at
      BEFORE UPDATE ON public.email_templates
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;

-- Trigger to set created_by_user_id on INSERT (prevents spoofing)
CREATE OR REPLACE FUNCTION public.set_email_template_created_by()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set if auth.uid() is available (not NULL) and not already set
  -- This allows migrations to set it explicitly
  -- During migrations, auth.uid() will be NULL, so we preserve the INSERT value
  IF auth.uid() IS NOT NULL THEN
    IF NEW.created_by_user_id IS NULL THEN
      NEW.created_by_user_id = auth.uid();
    END IF;
  END IF;
  -- If auth.uid() is NULL (migration context), preserve whatever was set in INSERT
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_email_templates_created_by
  BEFORE INSERT ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_email_template_created_by();

-- Trigger to set updated_by_user_id on UPDATE (prevents spoofing)
CREATE OR REPLACE FUNCTION public.set_email_template_updated_by()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set if auth.uid() is available (not NULL)
  -- This allows migrations to set it explicitly
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by_user_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_email_templates_updated_by
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_email_template_updated_by();

-- Trigger to prevent template_key changes after creation
CREATE OR REPLACE FUNCTION public.prevent_email_template_key_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.template_key IS DISTINCT FROM NEW.template_key THEN
    RAISE EXCEPTION 'template_key cannot be changed after creation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_email_templates_prevent_key_change
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.prevent_email_template_key_change();

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- SELECT: Users with org membership can read templates for their orgs
DROP POLICY IF EXISTS email_templates_select_org_members ON public.email_templates;
CREATE POLICY email_templates_select_org_members ON public.email_templates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = auth.uid() AND m.org_id = email_templates.org_id
    )
  );

-- INSERT: Only org_admin/org_manager can create, must set org_id from session
DROP POLICY IF EXISTS email_templates_insert_admins ON public.email_templates;
CREATE POLICY email_templates_insert_admins ON public.email_templates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = auth.uid() 
        AND m.org_id = email_templates.org_id
        AND m.role IN ('org_admin', 'org_manager', 'platform_admin')
    )
  );

-- UPDATE: Only org_admin/org_manager can update, cannot change org_id
DROP POLICY IF EXISTS email_templates_update_admins ON public.email_templates;
CREATE POLICY email_templates_update_admins ON public.email_templates
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = auth.uid() 
        AND m.org_id = email_templates.org_id
        AND m.role IN ('org_admin', 'org_manager', 'platform_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = auth.uid() 
        AND m.org_id = email_templates.org_id
        AND m.role IN ('org_admin', 'org_manager', 'platform_admin')
    )
    AND email_templates.org_id = (SELECT org_id FROM public.email_templates WHERE id = email_templates.id)
  );

-- DELETE: Only org_admin/org_manager can delete (soft delete via status = 'archived' preferred)
DROP POLICY IF EXISTS email_templates_delete_admins ON public.email_templates;
CREATE POLICY email_templates_delete_admins ON public.email_templates
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = auth.uid() 
        AND m.org_id = email_templates.org_id
        AND m.role IN ('org_admin', 'org_manager', 'platform_admin')
    )
  );

-- Comments for documentation
COMMENT ON TABLE public.email_templates IS 'Email templates for organizations with dynamic variable substitution support';
COMMENT ON COLUMN public.email_templates.template_key IS 'Unique identifier for template type (e.g., monthly_rental_statement). Must be unique per org.';
COMMENT ON COLUMN public.email_templates.subject_template IS 'Email subject template with {{variable}} placeholders. Max 500 characters.';
COMMENT ON COLUMN public.email_templates.body_html_template IS 'HTML email body template with {{variable}} placeholders. Max 50000 characters.';
COMMENT ON COLUMN public.email_templates.body_text_template IS 'Plain text email body template with {{variable}} placeholders. Max 50000 characters. Optional.';
COMMENT ON COLUMN public.email_templates.available_variables IS 'JSONB array of available variable definitions with metadata (key, description, source, format, required, nullDefault, example)';
COMMENT ON COLUMN public.email_templates.status IS 'Template status: active (usable), inactive (hidden), archived (soft deleted)';
COMMENT ON COLUMN public.email_templates.created_by_user_id IS 'User who created the template. Set automatically via trigger.';
COMMENT ON COLUMN public.email_templates.updated_by_user_id IS 'User who last updated the template. Set automatically via trigger.';

