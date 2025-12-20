-- Clears cached financial fields for a given property and relies on get_property_financials to recompute.
-- Replace :property_id with your target UUID.

update public.properties
set cash_balance = null,
    security_deposits = null,
    available_balance = null
where id = :property_id;

-- Optionally call a recalculation routine if available:
-- select fn_recalculate_property_financials(:property_id);
