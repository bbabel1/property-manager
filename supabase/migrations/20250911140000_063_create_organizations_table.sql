-- Create organizations table for multi-tenancy support
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add RLS policy
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.set_organizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_organizations_updated_at();

-- Create org_memberships table for user-organization relationships
CREATE TABLE IF NOT EXISTS public.org_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- Add RLS policy
ALTER TABLE public.org_memberships ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_memberships_org_id ON public.org_memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_id ON public.org_memberships(user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.set_org_memberships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_org_memberships_updated_at
  BEFORE UPDATE ON public.org_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.set_org_memberships_updated_at();
