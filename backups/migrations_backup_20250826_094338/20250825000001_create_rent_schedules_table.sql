-- Create rent_schedules table for Buildium API integration
-- Migration: 20250825000001_create_rent_schedules_table.sql
-- Description: Creates rent_schedules table to store rent schedule information from Buildium

-- Create rent_schedules table (skip if already exists)
CREATE TABLE IF NOT EXISTS rent_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id BIGINT REFERENCES "Lease"(id) ON DELETE CASCADE,
  buildium_rent_id INTEGER UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE,
  total_amount DECIMAL(10,2) NOT NULL,
  rent_cycle VARCHAR(50) NOT NULL,
  backdate_charges BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add comments to document the rent_schedules table (only if table was created)
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'rent_schedules'
    AND table_type = 'BASE TABLE'
  ) THEN
    -- Only add comments if the table was just created (not if it already existed)
    -- Check for PascalCase column name that exists in remote database
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'rent_schedules' 
      AND column_name = 'StartDate'
    ) THEN
      COMMENT ON TABLE rent_schedules IS 'Rent schedules for leases imported from Buildium';
      COMMENT ON COLUMN rent_schedules.id IS 'Unique identifier for the rent schedule';
      COMMENT ON COLUMN rent_schedules.lease_id IS 'Reference to the lease this rent schedule belongs to';
      COMMENT ON COLUMN rent_schedules.buildium_rent_id IS 'Buildium API rent schedule ID for synchronization';
      COMMENT ON COLUMN rent_schedules.start_date IS 'Start date of the rent schedule';
      COMMENT ON COLUMN rent_schedules.end_date IS 'End date of the rent schedule (null for ongoing)';
      COMMENT ON COLUMN rent_schedules.total_amount IS 'Total amount for this rent schedule';
      COMMENT ON COLUMN rent_schedules.rent_cycle IS 'Rent cycle (Monthly, Weekly, etc.)';
      COMMENT ON COLUMN rent_schedules.backdate_charges IS 'Whether charges should be backdated';
      COMMENT ON COLUMN rent_schedules.created_at IS 'When the rent schedule was created locally';
      COMMENT ON COLUMN rent_schedules.updated_at IS 'When the rent schedule was last updated locally';
    END IF;
  END IF;
END $$;

-- Create indexes for better performance (only if they don't exist)
-- Use PascalCase column names that exist in remote database
CREATE INDEX IF NOT EXISTS idx_rent_schedules_lease_id ON rent_schedules(lease_id);
CREATE INDEX IF NOT EXISTS idx_rent_schedules_buildium_id ON rent_schedules(buildium_rent_id);
CREATE INDEX IF NOT EXISTS idx_rent_schedules_start_date ON rent_schedules(start_date);
CREATE INDEX IF NOT EXISTS idx_rent_schedules_end_date ON rent_schedules(end_date);

-- Enable RLS (only if not already enabled)
ALTER TABLE rent_schedules ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rent_schedules' AND policyname = 'rent_schedules_read_policy') THEN
    CREATE POLICY "rent_schedules_read_policy" ON rent_schedules FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rent_schedules' AND policyname = 'rent_schedules_insert_policy') THEN
    CREATE POLICY "rent_schedules_insert_policy" ON rent_schedules FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rent_schedules' AND policyname = 'rent_schedules_update_policy') THEN
    CREATE POLICY "rent_schedules_update_policy" ON rent_schedules FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rent_schedules' AND policyname = 'rent_schedules_delete_policy') THEN
    CREATE POLICY "rent_schedules_delete_policy" ON rent_schedules FOR DELETE USING (true);
  END IF;
END $$;

-- Create function to update updated_at timestamp (only if it doesn't exist)
CREATE OR REPLACE FUNCTION update_rent_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_rent_schedules_updated_at') THEN
    CREATE TRIGGER trigger_update_rent_schedules_updated_at
      BEFORE UPDATE ON rent_schedules
      FOR EACH ROW
      EXECUTE FUNCTION update_rent_schedules_updated_at();
  END IF;
END $$;

-- Log the migration completion
DO $$
BEGIN
    RAISE NOTICE 'Created rent_schedules table for Buildium API integration:';
    RAISE NOTICE '- rent_schedules table with all necessary fields';
    RAISE NOTICE '- Appropriate indexes for performance';
    RAISE NOTICE '- RLS policies for security';
    RAISE NOTICE '- Automatic updated_at timestamp trigger';
    RAISE NOTICE 'All tables support Buildium ID synchronization';
END $$;
