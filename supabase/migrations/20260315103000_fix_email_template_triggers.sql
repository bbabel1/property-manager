-- Fix email template audit triggers so service-role updates don't null out user tracking

-- Preserve provided created_by_user_id when auth.uid() is unavailable (service role / system tasks)
CREATE OR REPLACE FUNCTION public.set_email_template_created_by()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.created_by_user_id = auth.uid();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fall back to the previous updated_by_user_id when auth.uid() is NULL
CREATE OR REPLACE FUNCTION public.set_email_template_updated_by()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by_user_id = auth.uid();
  ELSIF NEW.updated_by_user_id IS NULL THEN
    NEW.updated_by_user_id = OLD.updated_by_user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
