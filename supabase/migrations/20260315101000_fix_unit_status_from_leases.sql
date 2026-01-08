-- Migration: Keep unit.status in sync with lease activity
-- Description:
--   - Adds a helper function to derive a unit's status from its leases
--   - Adds a trigger on public.lease to call the helper whenever leases change
--   - Backfills existing units based on current lease data

-- Helper: recompute a single unit's status from its leases.
-- Rules:
--   * If any lease for the unit has status = 'Active' (case-insensitive) → unit.status = 'Occupied'
--   * Otherwise, if the unit is not explicitly 'Inactive' → unit.status = 'Vacant'
--   * Units marked 'Inactive' are never auto-toggled by this helper.
CREATE OR REPLACE FUNCTION public.refresh_unit_status_from_leases(p_unit_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_unit_id uuid := p_unit_id;
  v_has_active boolean := false;
  v_current_status public.unit_status_enum;
BEGIN
  IF v_unit_id IS NULL THEN
    RETURN;
  END IF;

  -- Load current unit status; if unit does not exist, nothing to do.
  SELECT status
  INTO v_current_status
  FROM public.units
  WHERE id = v_unit_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Do not override explicitly inactive units.
  IF v_current_status = 'Inactive' THEN
    RETURN;
  END IF;

  -- Check for any active lease on this unit (case-insensitive match on status).
  SELECT EXISTS (
    SELECT 1
    FROM public.lease l
    WHERE l.unit_id = v_unit_id
      AND upper(coalesce(l.status, '')) = 'ACTIVE'
  )
  INTO v_has_active;

  IF v_has_active AND v_current_status <> 'Occupied' THEN
    UPDATE public.units
    SET status = 'Occupied',
        updated_at = now()
    WHERE id = v_unit_id;
  ELSIF NOT v_has_active AND v_current_status <> 'Vacant' THEN
    UPDATE public.units
    SET status = 'Vacant',
        updated_at = now()
    WHERE id = v_unit_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.refresh_unit_status_from_leases(uuid) IS
'Derives unit.status from related leases: Active leases → Occupied, no active leases → Vacant (unless unit is explicitly Inactive).';

-- Trigger function: call refresh_unit_status_from_leases whenever leases change.
CREATE OR REPLACE FUNCTION public.trigger_refresh_unit_status_from_lease()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.refresh_unit_status_from_leases(NEW.unit_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- If the lease moved between units, refresh both.
    IF NEW.unit_id IS DISTINCT FROM OLD.unit_id THEN
      PERFORM public.refresh_unit_status_from_leases(OLD.unit_id);
    END IF;
    PERFORM public.refresh_unit_status_from_leases(NEW.unit_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_unit_status_from_leases(OLD.unit_id);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.trigger_refresh_unit_status_from_lease() IS
'Lease table trigger: keeps units.status in sync with active leases.';

-- Create trigger on public.lease to keep unit status in sync.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trigger_lease_unit_status_sync'
  ) THEN
    CREATE TRIGGER trigger_lease_unit_status_sync
      AFTER INSERT OR UPDATE OR DELETE ON public.lease
      FOR EACH ROW
      EXECUTE FUNCTION public.trigger_refresh_unit_status_from_lease();
  END IF;
END;
$$;

-- Backfill: recompute unit.status for all units that are referenced by leases.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT unit_id
    FROM public.lease
    WHERE unit_id IS NOT NULL
  LOOP
    PERFORM public.refresh_unit_status_from_leases(r.unit_id);
  END LOOP;
END;
$$;

