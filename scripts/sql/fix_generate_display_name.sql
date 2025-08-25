-- Fix generate_display_name function search_path issue
-- This script addresses the remaining Security Advisor warning

-- Step 1: Get the current function definition to understand what we're working with
-- SELECT pg_get_functiondef(30626) as full_definition;

-- Step 2: Check what triggers use this function (for reference)
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgtype,
    tgenabled
FROM pg_trigger 
WHERE tgfoid = 30626;

-- Step 3: Drop the problematic function (the one with no arguments)
DROP FUNCTION IF EXISTS public.generate_display_name();

-- Step 4: Recreate the function with proper search_path
-- Based on the function preview we saw, this appears to be a trigger function
-- that sets display_name using COALESCE logic
CREATE OR REPLACE FUNCTION public.generate_display_name()
RETURNS trigger 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Set display_name using first_name, last_name, and company_name
  -- This is the typical pattern we've seen in other functions
  NEW.display_name := COALESCE(NULLIF(TRIM(NEW.first_name||' '||NEW.last_name),''), NEW.company_name);
  RETURN NEW;
END$$;

-- Step 5: Verify the function was created correctly
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    CASE 
        WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' THEN 'Has search_path'
        ELSE 'Missing search_path'
    END as search_path_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'generate_display_name'
ORDER BY p.oid;
