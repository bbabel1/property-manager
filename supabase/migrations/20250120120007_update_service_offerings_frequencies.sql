-- Update service offerings to use new enum values
-- Part of Phase 1.2: Service Catalog Expansion (follow-up)
-- Updates default_freq to use newly added enum values after they're committed

BEGIN;

-- Update offerings that should use new enum values
UPDATE service_offerings
SET default_freq = 'per_job'
WHERE code IN ('MAINTENANCE_REPAIR', 'TURNOVER')
  AND default_freq = 'Monthly';

UPDATE service_offerings
SET default_freq = 'per_event'
WHERE code IN ('EMERGENCY_RESPONSE', 'INSPECTIONS', 'LEASING_PLACEMENT', 'BOARD_PACKAGE', 'RENEWAL', 'MOVE_COORDINATION', 'LEGAL_EVICTION')
  AND default_freq = 'Monthly';

UPDATE service_offerings
SET default_freq = 'quarterly'
WHERE code = 'ESCROW_AUDIT'
  AND default_freq = 'Annual';

UPDATE service_offerings
SET default_freq = 'one_time'
WHERE code IN ('BUDGET_PLANNING', 'INSPECTIONS', 'LEASING_PLACEMENT', 'BOARD_PACKAGE', 'MOVE_COORDINATION', 'COMPLIANCE_AUDIT')
  AND default_freq IN ('Monthly', 'Annual');

UPDATE service_offerings
SET default_freq = 'annually'
WHERE code IN ('BUDGET_PLANNING', 'PROPERTY_INSURANCE', 'COMPLIANCE_AUDIT', 'TAX_1099')
  AND default_freq = 'Annual';

UPDATE service_offerings
SET default_freq = 'monthly'
WHERE code IN ('RENT_COLLECTION', 'REPORTING', 'BILL_PAY_ESCROW', 'RESIDENT_SUPPORT', 'PORTAL', 'RENTERS_INSURANCE')
  AND default_freq = 'Monthly';

COMMIT;

