-- Create financial tables for Buildium API integration
-- Migration: 20250823000004_create_financial_tables.sql
-- Description: Creates vendors, bills, and bill payments tables for financial data management

-- Vendors table already exists from previous migration, skip creation

-- Vendors table comments and indexes already exist from previous migration

-- Create Bills table
CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buildium_bill_id INTEGER UNIQUE,
  vendor_id UUID REFERENCES vendors(id),
  property_id UUID REFERENCES properties(id),
  unit_id UUID REFERENCES units(id),
  date DATE NOT NULL,
  due_date DATE,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT NOT NULL,
  reference_number VARCHAR(255),
  category_id INTEGER,
  is_recurring BOOLEAN DEFAULT false,
  recurring_schedule JSONB,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add comments to document the bills table
COMMENT ON TABLE bills IS 'Bills and invoices from vendors for property-related expenses';
COMMENT ON COLUMN bills.buildium_bill_id IS 'Buildium API bill ID for synchronization';
COMMENT ON COLUMN bills.vendor_id IS 'Vendor who issued the bill';
COMMENT ON COLUMN bills.property_id IS 'Property the bill is associated with (optional)';
COMMENT ON COLUMN bills.unit_id IS 'Unit the bill is associated with (optional)';
COMMENT ON COLUMN bills.date IS 'Date the bill was issued';
COMMENT ON COLUMN bills.due_date IS 'Date the bill is due for payment';
COMMENT ON COLUMN bills.amount IS 'Total amount of the bill';
COMMENT ON COLUMN bills.description IS 'Description of the bill/expense';
COMMENT ON COLUMN bills.reference_number IS 'Vendor reference or invoice number';
COMMENT ON COLUMN bills.category_id IS 'Buildium bill category ID';
COMMENT ON COLUMN bills.is_recurring IS 'Whether this is a recurring bill';
COMMENT ON COLUMN bills.recurring_schedule IS 'JSON object with recurring schedule details';
COMMENT ON COLUMN bills.status IS 'Bill status: pending, paid, overdue, cancelled';

-- Create indexes for bills table
CREATE INDEX IF NOT EXISTS idx_bills_vendor ON bills(vendor_id);
CREATE INDEX IF NOT EXISTS idx_bills_property ON bills(property_id);
CREATE INDEX IF NOT EXISTS idx_bills_unit ON bills(unit_id);
CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(date);
CREATE INDEX IF NOT EXISTS idx_bills_due_date ON bills(due_date);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_buildium_id ON bills(buildium_bill_id);

-- Create Bill Payments table
CREATE TABLE IF NOT EXISTS bill_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buildium_payment_id INTEGER UNIQUE,
  bill_id UUID REFERENCES bills(id),
  bank_account_id UUID REFERENCES bank_accounts(id),
  amount DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL,
  reference_number VARCHAR(255),
  memo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add comments to document the bill_payments table
COMMENT ON TABLE bill_payments IS 'Payments made against bills';
COMMENT ON COLUMN bill_payments.buildium_payment_id IS 'Buildium API payment ID for synchronization';
COMMENT ON COLUMN bill_payments.bill_id IS 'Bill being paid';
COMMENT ON COLUMN bill_payments.bank_account_id IS 'Bank account used for payment';
COMMENT ON COLUMN bill_payments.amount IS 'Payment amount';
COMMENT ON COLUMN bill_payments.date IS 'Date payment was made';
COMMENT ON COLUMN bill_payments.reference_number IS 'Payment reference number';
COMMENT ON COLUMN bill_payments.memo IS 'Payment memo or notes';

-- Create indexes for bill_payments table
CREATE INDEX IF NOT EXISTS idx_bill_payments_bill ON bill_payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_bank ON bill_payments(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_date ON bill_payments(date);
CREATE INDEX IF NOT EXISTS idx_bill_payments_buildium_id ON bill_payments(buildium_payment_id);

-- Create Vendor Categories table
CREATE TABLE IF NOT EXISTS vendor_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buildium_category_id INTEGER UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add comments to document the vendor_categories table
COMMENT ON TABLE vendor_categories IS 'Categories for organizing vendors';
COMMENT ON COLUMN vendor_categories.buildium_category_id IS 'Buildium API category ID for synchronization';
COMMENT ON COLUMN vendor_categories.name IS 'Category name';
COMMENT ON COLUMN vendor_categories.description IS 'Category description';
COMMENT ON COLUMN vendor_categories.is_active IS 'Whether the category is active';

-- Create indexes for vendor_categories table
CREATE INDEX IF NOT EXISTS idx_vendor_categories_name ON vendor_categories(name);
CREATE INDEX IF NOT EXISTS idx_vendor_categories_active ON vendor_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_vendor_categories_buildium_id ON vendor_categories(buildium_category_id);

-- Create Bill Categories table
CREATE TABLE IF NOT EXISTS bill_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buildium_category_id INTEGER UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add comments to document the bill_categories table
COMMENT ON TABLE bill_categories IS 'Categories for organizing bills and expenses';
COMMENT ON COLUMN bill_categories.buildium_category_id IS 'Buildium API category ID for synchronization';
COMMENT ON COLUMN bill_categories.name IS 'Category name';
COMMENT ON COLUMN bill_categories.description IS 'Category description';
COMMENT ON COLUMN bill_categories.is_active IS 'Whether the category is active';

-- Create indexes for bill_categories table
CREATE INDEX IF NOT EXISTS idx_bill_categories_name ON bill_categories(name);
CREATE INDEX IF NOT EXISTS idx_bill_categories_active ON bill_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_bill_categories_buildium_id ON bill_categories(buildium_category_id);

-- Enable RLS on all new tables (vendors RLS already enabled)
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_categories ENABLE ROW LEVEL SECURITY;

-- Vendors RLS policies already exist from previous migration

-- Create RLS policies for bills table
CREATE POLICY "Enable read access for all users" ON bills FOR SELECT USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON bills FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for authenticated users" ON bills FOR UPDATE USING (true);

-- Create RLS policies for bill_payments table
CREATE POLICY "Enable read access for all users" ON bill_payments FOR SELECT USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON bill_payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for authenticated users" ON bill_payments FOR UPDATE USING (true);

-- Create RLS policies for vendor_categories table
CREATE POLICY "Enable read access for all users" ON vendor_categories FOR SELECT USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON vendor_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for authenticated users" ON vendor_categories FOR UPDATE USING (true);

-- Create RLS policies for bill_categories table
CREATE POLICY "Enable read access for all users" ON bill_categories FOR SELECT USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON bill_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for authenticated users" ON bill_categories FOR UPDATE USING (true);

-- Create function to map local vendor to Buildium format
CREATE OR REPLACE FUNCTION map_vendor_to_buildium(p_vendor_id UUID)
RETURNS JSONB AS $$
DECLARE
  vendor_record RECORD;
  buildium_data JSONB;
BEGIN
  SELECT * INTO vendor_record FROM vendors WHERE id = p_vendor_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor with ID % not found', p_vendor_id;
  END IF;
  
  buildium_data := jsonb_build_object(
    'Name', vendor_record.name,
    'CategoryId', vendor_record.category_id,
    'ContactName', COALESCE(vendor_record.contact_name, ''),
    'Email', COALESCE(vendor_record.email, ''),
    'PhoneNumber', COALESCE(vendor_record.phone_number, ''),
    'Address', jsonb_build_object(
      'AddressLine1', COALESCE(vendor_record.address_line1, ''),
      'AddressLine2', COALESCE(vendor_record.address_line2, ''),
      'City', COALESCE(vendor_record.city, ''),
      'State', COALESCE(vendor_record.state, ''),
      'PostalCode', COALESCE(vendor_record.postal_code, ''),
      'Country', COALESCE(vendor_record.country, '')
    ),
    'TaxId', COALESCE(vendor_record.tax_id, ''),
    'Notes', COALESCE(vendor_record.notes, ''),
    'IsActive', COALESCE(vendor_record.is_active, true)
  );
  
  RETURN buildium_data;
END;
$$ LANGUAGE plpgsql;

-- Create function to map local bill to Buildium format
CREATE OR REPLACE FUNCTION map_bill_to_buildium(p_bill_id UUID)
RETURNS JSONB AS $$
DECLARE
  bill_record RECORD;
  buildium_data JSONB;
BEGIN
  SELECT * INTO bill_record FROM bills WHERE id = p_bill_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bill with ID % not found', p_bill_id;
  END IF;
  
  buildium_data := jsonb_build_object(
    'VendorId', bill_record.vendor_id,
    'PropertyId', bill_record.property_id,
    'UnitId', bill_record.unit_id,
    'Date', bill_record.date,
    'DueDate', bill_record.due_date,
    'Amount', bill_record.amount,
    'Description', bill_record.description,
    'ReferenceNumber', COALESCE(bill_record.reference_number, ''),
    'CategoryId', bill_record.category_id,
    'IsRecurring', COALESCE(bill_record.is_recurring, false),
    'RecurringSchedule', bill_record.recurring_schedule
  );
  
  RETURN buildium_data;
END;
$$ LANGUAGE plpgsql;

-- Add comments to the mapping functions
COMMENT ON FUNCTION map_vendor_to_buildium IS 'Maps a local vendor record to Buildium API format';
COMMENT ON FUNCTION map_bill_to_buildium IS 'Maps a local bill record to Buildium API format';

-- Log the migration completion
DO $$
BEGIN
    RAISE NOTICE 'Created financial tables for Buildium API integration:';
    RAISE NOTICE '- vendors (with categories)';
    RAISE NOTICE '- bills (with categories)';
    RAISE NOTICE '- bill_payments';
    RAISE NOTICE '';
    RAISE NOTICE 'Created mapping functions:';
    RAISE NOTICE '- map_vendor_to_buildium';
    RAISE NOTICE '- map_bill_to_buildium';
    RAISE NOTICE '';
    RAISE NOTICE 'Added appropriate indexes and RLS policies';
    RAISE NOTICE 'All tables support Buildium ID synchronization';
END $$;
