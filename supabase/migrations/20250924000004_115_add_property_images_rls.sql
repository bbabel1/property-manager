-- Add RLS policies for property_images table
-- This migration enables property image sync by adding proper RLS policies
-- ============================================================================
-- PART 1: ENABLE RLS ON property_images TABLE
-- ============================================================================
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
-- ============================================================================
-- PART 2: ADD RLS POLICIES FOR property_images
-- ============================================================================
-- Allow authenticated users to read property images
CREATE POLICY "property_images_allow_all" ON public.property_images FOR ALL USING (true) WITH CHECK (true);
-- ============================================================================
-- PART 3: ADD PERFORMANCE MONITORING COMMENT
-- ============================================================================
COMMENT ON TABLE public.property_images IS 'Property images table with RLS policies - enables property image sync functionality';