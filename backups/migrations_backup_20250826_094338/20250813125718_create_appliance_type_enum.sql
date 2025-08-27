-- Migration: Create appliance_type_enum

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appliance_type_enum') THEN
    CREATE TYPE appliance_type_enum AS ENUM ('Refrigerator', 'Freezer', 'Stove', 'Microwave', 'Dishwasher', 'Washer/Dryer');
  END IF;
END$$;
