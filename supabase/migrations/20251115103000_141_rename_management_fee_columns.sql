-- Rename management fee columns to fee_dollar_amount for properties and units.

-- Properties table updates
ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_management_fee_check;

ALTER TABLE public.properties
  RENAME COLUMN management_fee TO fee_dollar_amount;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_fee_dollar_amount_check
  CHECK (fee_dollar_amount IS NULL OR fee_dollar_amount >= 0);

COMMENT ON COLUMN public.properties.fee_dollar_amount IS 'Management fee dollar amount.';

-- Units table updates
ALTER TABLE public.units
  RENAME COLUMN management_fee TO fee_dollar_amount;

COMMENT ON COLUMN public.units.fee_dollar_amount IS 'Management fee dollar amount.';
