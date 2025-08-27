-- Update owners table tax fields to match Buildium API mapping
-- Migration: 20250825202106_update_owners_table_tax_fields.sql
-- Description: Remove redundant tax fields and add tax_include1099 field to align with Buildium API

-- Remove redundant tax fields that are not part of the Buildium mapping
ALTER TABLE owners DROP COLUMN IF EXISTS tax_id;
ALTER TABLE owners DROP COLUMN IF EXISTS tax_address_line_1;
ALTER TABLE owners DROP COLUMN IF EXISTS tax_address_line_2;
ALTER TABLE owners DROP COLUMN IF EXISTS tax_address_line_3;
ALTER TABLE owners DROP COLUMN IF EXISTS tax_payer_name;

-- Add the new tax_include1099 field for Buildium 1099 reporting
ALTER TABLE owners ADD COLUMN IF NOT EXISTS tax_include1099 BOOLEAN DEFAULT false;

-- Add comment to document the new field
COMMENT ON COLUMN owners.tax_include1099 IS 'Indicates whether this owner should be included in 1099 tax reporting (maps to Buildium IncludeIn1099)';

-- Create index for better performance when querying by 1099 inclusion
CREATE INDEX IF NOT EXISTS idx_owners_tax_include1099 ON owners(tax_include1099);

-- Log the migration completion
DO $$
BEGIN
    RAISE NOTICE 'Updated owners table tax fields:';
    RAISE NOTICE '- Removed redundant fields: tax_id, tax_address_line_1, tax_address_line_2, tax_address_line_3, tax_payer_name';
    RAISE NOTICE '- Added new field: tax_include1099 (boolean, default false)';
    RAISE NOTICE '';
    RAISE NOTICE 'Buildium to Database mapping for owners table:';
    RAISE NOTICE '- TaxInformation.AddressLine1 -> tax_address_line1';
    RAISE NOTICE '- TaxInformation.AddressLine2 -> tax_address_line2';
    RAISE NOTICE '- TaxInformation.AddressLine3 -> tax_address_line3';
    RAISE NOTICE '- TaxInformation.City -> tax_city';
    RAISE NOTICE '- TaxInformation.State -> tax_state';
    RAISE NOTICE '- TaxInformation.PostalCode -> tax_postal_code';
    RAISE NOTICE '- TaxInformation.Country -> tax_country';
    RAISE NOTICE '- TaxInformation.TaxPayerIdType -> tax_payer_type';
    RAISE NOTICE '- TaxInformation.TaxPayerId -> tax_payer_id';
    RAISE NOTICE '- TaxInformation.TaxPayerName1 -> tax_payer_name1';
    RAISE NOTICE '- TaxInformation.TaxPayerName2 -> tax_payer_name2';
    RAISE NOTICE '- TaxInformation.IncludeIn1099 -> tax_include1099';
    RAISE NOTICE '- ManagementAgreementStartDate -> management_agreement_start_date';
    RAISE NOTICE '- ManagementAgreementEndDate -> management_agreement_end_date';
    RAISE NOTICE '- Comment -> comment';
END $$;
