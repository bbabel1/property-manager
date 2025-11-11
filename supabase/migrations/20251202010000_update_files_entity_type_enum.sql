-- Update files.entity_type to use a dedicated enum that matches UI terminology
-- While preserving existing data mapped from legacy Buildium entity types.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'files_entity_type_enum'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.files_entity_type_enum AS ENUM (
            'Properties',
            'Units',
            'Leases',
            'Tenants',
            'Rental Owners',
            'Associations',
            'Association Owners',
            'Association Units',
            'Ownership Accounts',
            'Accounts',
            'Vendors'
        );
    END IF;
END
$$;

ALTER TABLE public.files
    ALTER COLUMN entity_type TYPE public.files_entity_type_enum
    USING (
        CASE entity_type::text
            WHEN 'Properties' THEN 'Properties'
            WHEN 'Units' THEN 'Units'
            WHEN 'Leases' THEN 'Leases'
            WHEN 'Tenants' THEN 'Tenants'
            WHEN 'Rental Owners' THEN 'Rental Owners'
            WHEN 'Associations' THEN 'Associations'
            WHEN 'Association Owners' THEN 'Association Owners'
            WHEN 'Association Units' THEN 'Association Units'
            WHEN 'Ownership Accounts' THEN 'Ownership Accounts'
            WHEN 'Accounts' THEN 'Accounts'
            WHEN 'Vendors' THEN 'Vendors'
            WHEN 'Rental' THEN 'Properties'
            WHEN 'PublicAsset' THEN 'Properties'
            WHEN 'RentalUnit' THEN 'Units'
            WHEN 'Lease' THEN 'Leases'
            WHEN 'Tenant' THEN 'Tenants'
            WHEN 'RentalOwner' THEN 'Rental Owners'
            WHEN 'Association' THEN 'Associations'
            WHEN 'AssociationOwner' THEN 'Association Owners'
            WHEN 'AssociationUnit' THEN 'Association Units'
            WHEN 'OwnershipAccount' THEN 'Ownership Accounts'
            WHEN 'Account' THEN 'Accounts'
            WHEN 'Vendor' THEN 'Vendors'
            ELSE 'Properties'
        END
    )::public.files_entity_type_enum;

COMMENT ON COLUMN public.files.entity_type IS 'UI-friendly enum representing the entity the file is associated with (e.g. Properties, Units, Leases).';
