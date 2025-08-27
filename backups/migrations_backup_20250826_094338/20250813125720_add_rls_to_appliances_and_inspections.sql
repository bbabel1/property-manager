-- Migration: Add RLS policies to appliances and inspections tables

-- Enable RLS only if tables exist
DO $$
BEGIN
    -- Check if appliances table exists and enable RLS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appliances') THEN
        ALTER TABLE "appliances" ENABLE ROW LEVEL SECURITY;
        
        -- Allow all operations for now (can be restricted later)
        CREATE POLICY "Allow all operations on appliances" ON "appliances"
          FOR ALL USING (true);
    END IF;
    
    -- Check if inspections table exists and enable RLS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inspections') THEN
        ALTER TABLE "inspections" ENABLE ROW LEVEL SECURITY;
        
        -- Allow all operations for now (can be restricted later)
        CREATE POLICY "Allow all operations on inspections" ON "inspections"
          FOR ALL USING (true);
    END IF;
END $$;
