-- Migrate existing service data to new catalog
-- Part of Phase 7.1: Schema Creation & Initial Backfill
-- Maps legacy management_services_enum to new service_offerings and backfills plan defaults

BEGIN;

-- Map existing management_services_enum values to new service_offerings
-- This creates a mapping table for reference, then updates service_offerings if needed

-- Ensure all legacy services are mapped to new offerings
-- Rent Collection -> RENT_COLLECTION (already exists)
-- Maintenance -> MAINTENANCE_REPAIR (already exists)
-- Turnovers -> TURNOVER (already exists)
-- Compliance -> COMPLIANCE_AUDIT (already exists)
-- Bill Pay -> BILL_PAY_ESCROW (already exists)
-- Condition Reports -> INSPECTIONS (already exists)
-- Renewals -> RENEWAL (already exists)

-- Backfill service_plan_default_pricing with plan-level pricing defaults
-- Basic Plan: 2.5% of monthly gross rent
DO $$
DECLARE
  basic_plan_offering_id uuid;
BEGIN
  -- Get the offering ID for plan-level fee (we'll use a special offering or create one)
  -- For Basic plan, the plan fee is percent_rent at 2.5%
  SELECT id INTO basic_plan_offering_id 
  FROM service_offerings 
  WHERE code = 'RENT_COLLECTION' 
  LIMIT 1;
  
  IF basic_plan_offering_id IS NOT NULL THEN
    INSERT INTO service_plan_default_pricing (
      service_plan, offering_id, billing_basis, default_rate, default_freq,
      min_amount, max_amount, bill_on, rent_basis, min_monthly_fee, plan_fee_percent,
      is_included, is_required
    ) VALUES (
      'Basic', basic_plan_offering_id, 'percent_rent', 2.5, 'monthly',
      NULL, NULL, 'calendar_day', 'scheduled', NULL, 2.5,
      true, true
    ) ON CONFLICT (service_plan, offering_id) DO UPDATE SET
      plan_fee_percent = 2.5,
      rent_basis = 'scheduled';
  END IF;
END $$;

-- Full Plan: 4% of monthly gross rent
DO $$
DECLARE
  full_plan_offering_id uuid;
BEGIN
  SELECT id INTO full_plan_offering_id 
  FROM service_offerings 
  WHERE code = 'RENT_COLLECTION' 
  LIMIT 1;
  
  IF full_plan_offering_id IS NOT NULL THEN
    INSERT INTO service_plan_default_pricing (
      service_plan, offering_id, billing_basis, default_rate, default_freq,
      min_amount, max_amount, bill_on, rent_basis, min_monthly_fee, plan_fee_percent,
      is_included, is_required
    ) VALUES (
      'Full', full_plan_offering_id, 'percent_rent', 4.0, 'monthly',
      NULL, NULL, 'calendar_day', 'scheduled', NULL, 4.0,
      true, true
    ) ON CONFLICT (service_plan, offering_id) DO UPDATE SET
      plan_fee_percent = 4.0,
      rent_basis = 'scheduled';
  END IF;
END $$;

-- Migrate properties.included_services to property_service_pricing
-- Map each service in the array to the corresponding service_offering
DO $$
DECLARE
  prop_rec RECORD;
  service_name TEXT;
  offering_id_val uuid;
  service_mapping JSONB := jsonb_build_object(
    'Rent Collection', 'RENT_COLLECTION',
    'Maintenance', 'MAINTENANCE_REPAIR',
    'Turnovers', 'TURNOVER',
    'Compliance', 'COMPLIANCE_AUDIT',
    'Bill Pay', 'BILL_PAY_ESCROW',
    'Condition Reports', 'INSPECTIONS',
    'Renewals', 'RENEWAL'
  );
BEGIN
  FOR prop_rec IN 
    SELECT id, active_services, service_plan, org_id
    FROM properties
    WHERE active_services IS NOT NULL AND array_length(active_services, 1) > 0
  LOOP
    -- Process each service in the array
    FOREACH service_name IN ARRAY prop_rec.active_services
    LOOP
      -- Get the offering code from mapping
      DECLARE
        offering_code TEXT;
      BEGIN
        offering_code := service_mapping->>service_name;
        
        IF offering_code IS NOT NULL THEN
          -- Get the offering ID
          SELECT id INTO offering_id_val
          FROM service_offerings
          WHERE code = offering_code
          LIMIT 1;
          
          IF offering_id_val IS NOT NULL THEN
            -- Check if pricing record already exists
            IF NOT EXISTS (
              SELECT 1 FROM property_service_pricing
              WHERE property_id = prop_rec.id
                AND unit_id IS NULL
                AND offering_id = offering_id_val
                AND is_active = true
                AND effective_end IS NULL
            ) THEN
              -- Get default pricing from plan or offering
              DECLARE
                default_basis billing_basis_enum;
                default_rate_val numeric(12,2);
                default_freq_val billing_frequency_enum;
                default_bill_on bill_on_enum;
                default_rent_basis_val rent_basis_enum;
              BEGIN
                -- Try to get from plan defaults first
                SELECT 
                  spd.billing_basis,
                  spd.default_rate,
                  spd.default_freq,
                  spd.bill_on,
                  spd.rent_basis
                INTO
                  default_basis,
                  default_rate_val,
                  default_freq_val,
                  default_bill_on,
                  default_rent_basis_val
                FROM service_plan_default_pricing spd
                WHERE spd.service_plan = prop_rec.service_plan
                  AND spd.offering_id = offering_id_val
                LIMIT 1;
                
                -- Fall back to offering defaults if no plan default
                IF default_basis IS NULL THEN
                  SELECT 
                    so.billing_basis,
                    so.default_rate,
                    so.default_freq,
                    so.bill_on,
                    so.default_rent_basis
                  INTO
                    default_basis,
                    default_rate_val,
                    default_freq_val,
                    default_bill_on,
                    default_rent_basis_val
                  FROM service_offerings so
                  WHERE so.id = offering_id_val;
                END IF;
                
                -- Insert pricing record
                INSERT INTO property_service_pricing (
                  property_id,
                  unit_id,
                  offering_id,
                  billing_basis,
                  rate,
                  billing_frequency,
                  bill_on,
                  rent_basis,
                  is_active,
                  effective_start,
                  effective_end
                ) VALUES (
                  prop_rec.id,
                  NULL,
                  offering_id_val,
                  COALESCE(default_basis, 'per_property'),
                  default_rate_val,
                  COALESCE(default_freq_val, 'monthly'),
                  COALESCE(default_bill_on, 'calendar_day'),
                  default_rent_basis_val,
                  true,
                  now(),
                  NULL
                ) ON CONFLICT DO NOTHING;
              END;
            END IF;
          END IF;
        END IF;
      END;
    END LOOP;
  END LOOP;
END $$;

-- Migrate units.active_services to property_service_pricing
-- Parse text field (JSON or comma-separated) and create pricing records
DO $$
DECLARE
  unit_rec RECORD;
  service_array TEXT[];
  service_name TEXT;
  offering_id_val uuid;
  service_mapping JSONB := jsonb_build_object(
    'Rent Collection', 'RENT_COLLECTION',
    'Maintenance', 'MAINTENANCE_REPAIR',
    'Turnovers', 'TURNOVER',
    'Compliance', 'COMPLIANCE_AUDIT',
    'Bill Pay', 'BILL_PAY_ESCROW',
    'Condition Reports', 'INSPECTIONS',
    'Renewals', 'RENEWAL'
  );
BEGIN
  FOR unit_rec IN 
    SELECT id, property_id, active_services, service_plan, org_id
    FROM units
    WHERE active_services IS NOT NULL AND active_services != ''
  LOOP
    -- Parse active_services (try JSON first, then comma-separated)
    BEGIN
      service_array := ARRAY(SELECT jsonb_array_elements_text(active_services::jsonb));
    EXCEPTION
      WHEN OTHERS THEN
        -- Not JSON, try comma-separated
        service_array := string_to_array(trim(unit_rec.active_services), ',');
    END;
    
    -- Process each service
    FOREACH service_name IN ARRAY service_array
    LOOP
      service_name := trim(service_name);
      
      DECLARE
        offering_code TEXT;
      BEGIN
        offering_code := service_mapping->>service_name;
        
        IF offering_code IS NOT NULL THEN
          SELECT id INTO offering_id_val
          FROM service_offerings
          WHERE code = offering_code
          LIMIT 1;
          
          IF offering_id_val IS NOT NULL THEN
            -- Check if pricing record already exists
            IF NOT EXISTS (
              SELECT 1 FROM property_service_pricing
              WHERE property_id = unit_rec.property_id
                AND unit_id = unit_rec.id
                AND offering_id = offering_id_val
                AND is_active = true
                AND effective_end IS NULL
            ) THEN
              -- Get default pricing
              DECLARE
                default_basis billing_basis_enum;
                default_rate_val numeric(12,2);
                default_freq_val billing_frequency_enum;
                default_bill_on bill_on_enum;
                default_rent_basis_val rent_basis_enum;
              BEGIN
                -- Try plan defaults
                SELECT 
                  spd.billing_basis,
                  spd.default_rate,
                  spd.default_freq,
                  spd.bill_on,
                  spd.rent_basis
                INTO
                  default_basis,
                  default_rate_val,
                  default_freq_val,
                  default_bill_on,
                  default_rent_basis_val
                FROM service_plan_default_pricing spd
                WHERE spd.service_plan = unit_rec.service_plan
                  AND spd.offering_id = offering_id_val
                LIMIT 1;
                
                -- Fall back to offering defaults
                IF default_basis IS NULL THEN
                  SELECT 
                    so.billing_basis,
                    so.default_rate,
                    so.default_freq,
                    so.bill_on,
                    so.default_rent_basis
                  INTO
                    default_basis,
                    default_rate_val,
                    default_freq_val,
                    default_bill_on,
                    default_rent_basis_val
                  FROM service_offerings so
                  WHERE so.id = offering_id_val;
                END IF;
                
                -- Insert pricing record
                INSERT INTO property_service_pricing (
                  property_id,
                  unit_id,
                  offering_id,
                  billing_basis,
                  rate,
                  billing_frequency,
                  bill_on,
                  rent_basis,
                  is_active,
                  effective_start,
                  effective_end
                ) VALUES (
                  unit_rec.property_id,
                  unit_rec.id,
                  offering_id_val,
                  COALESCE(default_basis, 'per_unit'),
                  default_rate_val,
                  COALESCE(default_freq_val, 'monthly'),
                  COALESCE(default_bill_on, 'calendar_day'),
                  default_rent_basis_val,
                  true,
                  now(),
                  NULL
                ) ON CONFLICT DO NOTHING;
              END;
            END IF;
          END IF;
        END IF;
      END;
    END LOOP;
  END LOOP;
END $$;

-- Link existing "management fee" transactions to LEGACY_MGMT_FEE pseudo-offering
DO $$
DECLARE
  legacy_offering_id uuid;
BEGIN
  -- Get the legacy offering ID
  SELECT id INTO legacy_offering_id
  FROM service_offerings
  WHERE code = 'LEGACY_MGMT_FEE'
  LIMIT 1;
  
  IF legacy_offering_id IS NOT NULL THEN
    -- Update transactions that have "management fee" in memo but no service_offering_id
    -- Note: This will be done in Phase 5.3 when we add the columns, so we'll just prepare the data here
    -- For now, we'll create a note that this needs to be done after Phase 5.3
    RAISE NOTICE 'Legacy offering ID found: %. Update transactions in Phase 5.3.', legacy_offering_id;
  END IF;
END $$;

COMMIT;

