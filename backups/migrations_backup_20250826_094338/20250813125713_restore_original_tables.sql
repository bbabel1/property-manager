-- Migration: Restore Original Property Manager Tables
-- Date: 2024-01-15
-- Description: Restores all the original tables that were accidentally deleted

-- Create properties table
CREATE TABLE IF NOT EXISTS "properties" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(127) NOT NULL,
  "structure_description" TEXT,
  "address_line1" VARCHAR(100) NOT NULL,
  "address_line2" VARCHAR(100),
  "address_line3" VARCHAR(100),
  "city" VARCHAR(100),
  "state" VARCHAR(100),
  "postal_code" VARCHAR(20) NOT NULL,
  "buildium_property_id" INTEGER,
  "rental_owner_ids" INTEGER[],
  "reserve" NUMERIC,
  "year_built" INTEGER,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  "country" VARCHAR(100) NOT NULL,
  "rental_sub_type" VARCHAR(50),
  "operating_bank_account_id" UUID,
  "primary_owner" VARCHAR(255),
  "status" VARCHAR(20) DEFAULT 'Active' NOT NULL
);

-- Create units table
CREATE TABLE IF NOT EXISTS "units" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "property_id" UUID NOT NULL REFERENCES "properties"("id"),
  "unit_number" VARCHAR(30) NOT NULL,
  "unit_size" INTEGER,
  "market_rent" NUMERIC,
  "address_line1" VARCHAR(100) NOT NULL,
  "address_line2" VARCHAR(100),
  "address_line3" VARCHAR(100),
  "city" VARCHAR(100),
  "state" VARCHAR(100),
  "postal_code" VARCHAR(20) NOT NULL,
  "country" VARCHAR(100) NOT NULL,
  "unit_bedrooms" VARCHAR(20),
  "unit_bathrooms" VARCHAR(20),
  "description" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create owners table
CREATE TABLE IF NOT EXISTS "owners" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "first_name" VARCHAR(127),
  "last_name" VARCHAR(127),
  "is_company" BOOLEAN DEFAULT false NOT NULL,
  "company_name" VARCHAR(127),
  "date_of_birth" DATE,
  "management_agreement_start_date" DATE,
  "management_agreement_end_date" DATE,
  "email" VARCHAR(255),
  "alternate_email" VARCHAR(255),
  "phone_home" VARCHAR(20),
  "phone_work" VARCHAR(20),
  "phone_mobile" VARCHAR(20),
  "phone_fax" VARCHAR(20),
  "address_line1" VARCHAR(100) NOT NULL,
  "address_line2" VARCHAR(100),
  "address_line3" VARCHAR(100),
  "city" VARCHAR(100),
  "state" VARCHAR(100),
  "postal_code" VARCHAR(20) NOT NULL,
  "country" VARCHAR(100) NOT NULL,
  "comment" TEXT,
  "tax_payer_id" VARCHAR(255),
  "tax_payer_type" VARCHAR(10),
  "tax_payer_name1" VARCHAR(40),
  "tax_payer_name2" VARCHAR(40),
  "tax_address_line1" VARCHAR(100),
  "tax_address_line2" VARCHAR(100),
  "tax_address_line3" VARCHAR(100),
  "tax_city" VARCHAR(100),
  "tax_state" VARCHAR(100),
  "tax_postal_code" VARCHAR(20),
  "tax_country" VARCHAR(100),
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create ownership table
CREATE TABLE IF NOT EXISTS "ownership" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "primary" BOOLEAN DEFAULT false,
  "ownership_percentage" NUMERIC,
  "disbursement_percentage" NUMERIC,
  "owner_name" VARCHAR(255),
  "owner_id" UUID NOT NULL REFERENCES "owners"("id"),
  "property_id" UUID NOT NULL REFERENCES "properties"("id"),
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create Staff table
CREATE TABLE IF NOT EXISTS "Staff" (
  "id" BIGSERIAL PRIMARY KEY,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "role" VARCHAR(50) DEFAULT 'PROPERTY_MANAGER' NOT NULL,
  "isActive" BOOLEAN DEFAULT true NOT NULL,
  "createdAt" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

-- Create PropertyStaff table
CREATE TABLE IF NOT EXISTS "PropertyStaff" (
  "id" BIGSERIAL PRIMARY KEY,
  "propertyId" UUID NOT NULL REFERENCES "properties"("id"),
  "staffId" BIGINT NOT NULL REFERENCES "Staff"("id"),
  "role" VARCHAR(50) DEFAULT 'PROPERTY_MANAGER' NOT NULL,
  "assignedAt" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create Lease table
CREATE TABLE IF NOT EXISTS "Lease" (
  "id" BIGSERIAL PRIMARY KEY,
  "propertyId" UUID NOT NULL REFERENCES "properties"("id"),
  "startDate" TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  "endDate" TIMESTAMP WITHOUT TIME ZONE,
  "status" VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
  "depositAmt" NUMERIC,
  "notes" TEXT,
  "createdAt" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  "unitId" UUID NOT NULL REFERENCES "units"("id")
);

-- Create LeaseContact table
CREATE TABLE IF NOT EXISTS "LeaseContact" (
  "id" BIGSERIAL PRIMARY KEY,
  "leaseId" BIGINT NOT NULL REFERENCES "Lease"("id"),
  "role" VARCHAR(20) NOT NULL,
  "fullName" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "dateOfBirth" TIMESTAMP WITHOUT TIME ZONE,
  "isRentResponsible" BOOLEAN DEFAULT false NOT NULL,
  "createdAt" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

-- Create bank_accounts table
CREATE TABLE IF NOT EXISTS "bank_accounts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "buildium_bank_id" INTEGER,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "bank_account_type" VARCHAR(20) NOT NULL,
  "country" VARCHAR(100) NOT NULL,
  "account_number" VARCHAR(255),
  "routing_number" VARCHAR(255),
  "enable_remote_check_printing" BOOLEAN DEFAULT false NOT NULL,
  "enable_local_check_printing" BOOLEAN DEFAULT false NOT NULL,
  "check_layout_type" VARCHAR(50),
  "signature_heading" VARCHAR(255),
  "fractional_number" VARCHAR(255),
  "bank_information_line1" VARCHAR(255),
  "bank_information_line2" VARCHAR(255),
  "bank_information_line3" VARCHAR(255),
  "bank_information_line4" VARCHAR(255),
  "bank_information_line5" VARCHAR(255),
  "company_information_line1" VARCHAR(255),
  "company_information_line2" VARCHAR(255),
  "company_information_line3" VARCHAR(255),
  "company_information_line4" VARCHAR(255),
  "company_information_line5" VARCHAR(255),
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "properties_name_idx" ON "properties"("name");
CREATE INDEX IF NOT EXISTS "units_property_id_idx" ON "units"("property_id");
CREATE INDEX IF NOT EXISTS "units_property_id_unit_number_key" ON "units"("property_id", "unit_number");
CREATE INDEX IF NOT EXISTS "Staff_lastName_firstName_idx" ON "Staff"("lastName", "firstName");
CREATE INDEX IF NOT EXISTS "PropertyStaff_propertyId_idx" ON "PropertyStaff"("propertyId");
CREATE INDEX IF NOT EXISTS "PropertyStaff_staffId_idx" ON "PropertyStaff"("staffId");
CREATE INDEX IF NOT EXISTS "PropertyStaff_propertyId_staffId_role_key" ON "PropertyStaff"("propertyId", "staffId", "role");
CREATE INDEX IF NOT EXISTS "Lease_propertyId_idx" ON "Lease"("propertyId");
CREATE INDEX IF NOT EXISTS "Lease_unitId_status_idx" ON "Lease"("unitId", "status");
CREATE INDEX IF NOT EXISTS "LeaseContact_leaseId_role_idx" ON "LeaseContact"("leaseId", "role");
CREATE INDEX IF NOT EXISTS "owners_last_name_first_name_idx" ON "owners"("last_name", "first_name");
CREATE INDEX IF NOT EXISTS "ownership_owner_id_idx" ON "ownership"("owner_id");
CREATE INDEX IF NOT EXISTS "ownership_property_id_idx" ON "ownership"("property_id");
CREATE INDEX IF NOT EXISTS "ownership_owner_id_property_id_key" ON "ownership"("owner_id", "property_id");

-- Add foreign key constraints (without IF NOT EXISTS)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'properties_operating_bank_account_id_fkey') THEN
        ALTER TABLE "properties" ADD CONSTRAINT "properties_operating_bank_account_id_fkey" 
        FOREIGN KEY ("operating_bank_account_id") REFERENCES "bank_accounts"("id");
    END IF;
END $$;

-- Enable RLS on all tables
ALTER TABLE "properties" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "units" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "owners" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ownership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Staff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PropertyStaff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lease" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaseContact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bank_accounts" ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies (you may want to customize these based on your needs)
CREATE POLICY "Enable read access for all users" ON "properties" FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON "units" FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON "owners" FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON "ownership" FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON "Staff" FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON "PropertyStaff" FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON "Lease" FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON "LeaseContact" FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON "bank_accounts" FOR SELECT USING (true);
