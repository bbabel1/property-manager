-- Fix generate_display_name function search_path issue
DROP FUNCTION IF EXISTS public.generate_display_name();

CREATE OR REPLACE FUNCTION public.generate_display_name()
RETURNS trigger 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.display_name := COALESCE(NULLIF(TRIM(NEW.first_name||' '||NEW.last_name),''), NEW.company_name);
  RETURN NEW;
END$$;
