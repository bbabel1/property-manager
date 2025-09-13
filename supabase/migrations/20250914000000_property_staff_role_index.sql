-- Add composite index for property_staff lookups by property and role
CREATE INDEX IF NOT EXISTS idx_property_staff_property_role ON public.property_staff(property_id, role);
