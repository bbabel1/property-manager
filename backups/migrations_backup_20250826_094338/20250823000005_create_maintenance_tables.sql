-- Create maintenance and task tables for Buildium API integration
-- Migration: 20250823000005_create_maintenance_tables.sql
-- Description: Creates tasks and work orders tables for maintenance management

-- Create Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buildium_task_id INTEGER UNIQUE,
  property_id UUID REFERENCES properties(id),
  unit_id UUID REFERENCES units(id),
  subject VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(20) DEFAULT 'open',
  assigned_to VARCHAR(255),
  estimated_cost DECIMAL(10,2),
  actual_cost DECIMAL(10,2),
  scheduled_date TIMESTAMP WITH TIME ZONE,
  completed_date TIMESTAMP WITH TIME ZONE,
  category VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add comments to document the tasks table
COMMENT ON TABLE tasks IS 'Maintenance tasks and work items for properties and units';
COMMENT ON COLUMN tasks.buildium_task_id IS 'Buildium API task ID for synchronization';
COMMENT ON COLUMN tasks.property_id IS 'Property the task is associated with';
COMMENT ON COLUMN tasks.unit_id IS 'Unit the task is associated with (optional)';
COMMENT ON COLUMN tasks.subject IS 'Task subject/title';
COMMENT ON COLUMN tasks.description IS 'Detailed task description';
COMMENT ON COLUMN tasks.priority IS 'Task priority: low, medium, high, urgent';
COMMENT ON COLUMN tasks.status IS 'Task status: open, in_progress, completed, cancelled';
COMMENT ON COLUMN tasks.assigned_to IS 'Person assigned to the task';
COMMENT ON COLUMN tasks.estimated_cost IS 'Estimated cost for the task';
COMMENT ON COLUMN tasks.actual_cost IS 'Actual cost incurred for the task';
COMMENT ON COLUMN tasks.scheduled_date IS 'When the task is scheduled to be performed';
COMMENT ON COLUMN tasks.completed_date IS 'When the task was completed';
COMMENT ON COLUMN tasks.category IS 'Task category (e.g., plumbing, electrical, hvac)';
COMMENT ON COLUMN tasks.notes IS 'Additional notes about the task';

-- Create indexes for tasks table
CREATE INDEX IF NOT EXISTS idx_tasks_property ON tasks(property_id);
CREATE INDEX IF NOT EXISTS idx_tasks_unit ON tasks(unit_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled ON tasks(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
CREATE INDEX IF NOT EXISTS idx_tasks_buildium_id ON tasks(buildium_task_id);

-- Create Work Orders table
CREATE TABLE IF NOT EXISTS work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buildium_work_order_id INTEGER UNIQUE,
  property_id UUID REFERENCES properties(id),
  unit_id UUID REFERENCES units(id),
  subject VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(20) DEFAULT 'open',
  assigned_to VARCHAR(255),
  estimated_cost DECIMAL(10,2),
  actual_cost DECIMAL(10,2),
  scheduled_date TIMESTAMP WITH TIME ZONE,
  completed_date TIMESTAMP WITH TIME ZONE,
  category VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add comments to document the work_orders table
COMMENT ON TABLE work_orders IS 'Work orders for maintenance and repair work';
COMMENT ON COLUMN work_orders.buildium_work_order_id IS 'Buildium API work order ID for synchronization';
COMMENT ON COLUMN work_orders.property_id IS 'Property the work order is associated with';
COMMENT ON COLUMN work_orders.unit_id IS 'Unit the work order is associated with (optional)';
COMMENT ON COLUMN work_orders.subject IS 'Work order subject/title';
COMMENT ON COLUMN work_orders.description IS 'Detailed work order description';
COMMENT ON COLUMN work_orders.priority IS 'Work order priority: low, medium, high, urgent';
COMMENT ON COLUMN work_orders.status IS 'Work order status: open, in_progress, completed, cancelled';
COMMENT ON COLUMN work_orders.assigned_to IS 'Person assigned to the work order';
COMMENT ON COLUMN work_orders.estimated_cost IS 'Estimated cost for the work';
COMMENT ON COLUMN work_orders.actual_cost IS 'Actual cost incurred for the work';
COMMENT ON COLUMN work_orders.scheduled_date IS 'When the work is scheduled to be performed';
COMMENT ON COLUMN work_orders.completed_date IS 'When the work was completed';
COMMENT ON COLUMN work_orders.category IS 'Work order category (e.g., plumbing, electrical, hvac)';
COMMENT ON COLUMN work_orders.notes IS 'Additional notes about the work order';

-- Create indexes for work_orders table
CREATE INDEX IF NOT EXISTS idx_work_orders_property ON work_orders(property_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_unit ON work_orders(unit_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_priority ON work_orders(priority);
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned ON work_orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_work_orders_scheduled ON work_orders(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_work_orders_category ON work_orders(category);
CREATE INDEX IF NOT EXISTS idx_work_orders_buildium_id ON work_orders(buildium_work_order_id);

-- Create Task Categories table
CREATE TABLE IF NOT EXISTS task_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buildium_category_id INTEGER UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(7), -- Hex color code
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add comments to document the task_categories table
COMMENT ON TABLE task_categories IS 'Categories for organizing tasks';
COMMENT ON COLUMN task_categories.buildium_category_id IS 'Buildium API category ID for synchronization';
COMMENT ON COLUMN task_categories.name IS 'Category name';
COMMENT ON COLUMN task_categories.description IS 'Category description';
COMMENT ON COLUMN task_categories.color IS 'Hex color code for UI display';
COMMENT ON COLUMN task_categories.is_active IS 'Whether the category is active';

-- Create indexes for task_categories table
CREATE INDEX IF NOT EXISTS idx_task_categories_name ON task_categories(name);
CREATE INDEX IF NOT EXISTS idx_task_categories_active ON task_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_task_categories_buildium_id ON task_categories(buildium_category_id);

-- Create Task History table
CREATE TABLE IF NOT EXISTS task_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buildium_history_id INTEGER UNIQUE,
  task_id UUID REFERENCES tasks(id),
  status VARCHAR(20) NOT NULL,
  notes TEXT,
  completed_date TIMESTAMP WITH TIME ZONE,
  assigned_to VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add comments to document the task_history table
COMMENT ON TABLE task_history IS 'History of status changes and updates for tasks';
COMMENT ON COLUMN task_history.buildium_history_id IS 'Buildium API history ID for synchronization';
COMMENT ON COLUMN task_history.task_id IS 'Task this history entry belongs to';
COMMENT ON COLUMN task_history.status IS 'Status at this point in history';
COMMENT ON COLUMN task_history.notes IS 'Notes about this status change';
COMMENT ON COLUMN task_history.completed_date IS 'When the task was completed (if applicable)';
COMMENT ON COLUMN task_history.assigned_to IS 'Person assigned at this point';

-- Create indexes for task_history table
CREATE INDEX IF NOT EXISTS idx_task_history_task ON task_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_history_status ON task_history(status);
CREATE INDEX IF NOT EXISTS idx_task_history_buildium_id ON task_history(buildium_history_id);

-- Create Task History Files table
CREATE TABLE IF NOT EXISTS task_history_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buildium_file_id INTEGER UNIQUE,
  task_history_id UUID REFERENCES task_history(id),
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(100),
  file_size INTEGER,
  file_url TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add comments to document the task_history_files table
COMMENT ON TABLE task_history_files IS 'Files attached to task history entries';
COMMENT ON COLUMN task_history_files.buildium_file_id IS 'Buildium API file ID for synchronization';
COMMENT ON COLUMN task_history_files.task_history_id IS 'Task history entry this file belongs to';
COMMENT ON COLUMN task_history_files.file_name IS 'Name of the file';
COMMENT ON COLUMN task_history_files.file_type IS 'MIME type of the file';
COMMENT ON COLUMN task_history_files.file_size IS 'Size of the file in bytes';
COMMENT ON COLUMN task_history_files.file_url IS 'URL to access the file';
COMMENT ON COLUMN task_history_files.description IS 'Description of the file';

-- Create indexes for task_history_files table
CREATE INDEX IF NOT EXISTS idx_task_history_files_history ON task_history_files(task_history_id);
CREATE INDEX IF NOT EXISTS idx_task_history_files_type ON task_history_files(file_type);
CREATE INDEX IF NOT EXISTS idx_task_history_files_buildium_id ON task_history_files(buildium_file_id);

-- Enable RLS on all new tables
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_history_files ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tasks table
CREATE POLICY "Enable read access for all users" ON tasks FOR SELECT USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for authenticated users" ON tasks FOR UPDATE USING (true);

-- Create RLS policies for work_orders table
CREATE POLICY "Enable read access for all users" ON work_orders FOR SELECT USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON work_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for authenticated users" ON work_orders FOR UPDATE USING (true);

-- Create RLS policies for task_categories table
CREATE POLICY "Enable read access for all users" ON task_categories FOR SELECT USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON task_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for authenticated users" ON task_categories FOR UPDATE USING (true);

-- Create RLS policies for task_history table
CREATE POLICY "Enable read access for all users" ON task_history FOR SELECT USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON task_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for authenticated users" ON task_history FOR UPDATE USING (true);

-- Create RLS policies for task_history_files table
CREATE POLICY "Enable read access for all users" ON task_history_files FOR SELECT USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON task_history_files FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for authenticated users" ON task_history_files FOR UPDATE USING (true);

-- Create function to map local task to Buildium format
CREATE OR REPLACE FUNCTION map_task_to_buildium(p_task_id UUID)
RETURNS JSONB AS $$
DECLARE
  task_record RECORD;
  buildium_data JSONB;
BEGIN
  SELECT * INTO task_record FROM tasks WHERE id = p_task_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task with ID % not found', p_task_id;
  END IF;
  
  buildium_data := jsonb_build_object(
    'PropertyId', task_record.property_id,
    'UnitId', task_record.unit_id,
    'Subject', task_record.subject,
    'Description', COALESCE(task_record.description, ''),
    'Priority', COALESCE(task_record.priority, 'medium'),
    'AssignedTo', COALESCE(task_record.assigned_to, ''),
    'EstimatedCost', task_record.estimated_cost,
    'ScheduledDate', task_record.scheduled_date,
    'Category', COALESCE(task_record.category, ''),
    'Notes', COALESCE(task_record.notes, '')
  );
  
  RETURN buildium_data;
END;
$$ LANGUAGE plpgsql;

-- Create function to map local work order to Buildium format
CREATE OR REPLACE FUNCTION map_work_order_to_buildium(p_work_order_id UUID)
RETURNS JSONB AS $$
DECLARE
  work_order_record RECORD;
  buildium_data JSONB;
BEGIN
  SELECT * INTO work_order_record FROM work_orders WHERE id = p_work_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work order with ID % not found', p_work_order_id;
  END IF;
  
  buildium_data := jsonb_build_object(
    'PropertyId', work_order_record.property_id,
    'UnitId', work_order_record.unit_id,
    'Subject', work_order_record.subject,
    'Description', COALESCE(work_order_record.description, ''),
    'Priority', COALESCE(work_order_record.priority, 'medium'),
    'AssignedTo', COALESCE(work_order_record.assigned_to, ''),
    'EstimatedCost', work_order_record.estimated_cost,
    'ScheduledDate', work_order_record.scheduled_date,
    'Category', COALESCE(work_order_record.category, ''),
    'Notes', COALESCE(work_order_record.notes, '')
  );
  
  RETURN buildium_data;
END;
$$ LANGUAGE plpgsql;

-- Add comments to the mapping functions
COMMENT ON FUNCTION map_task_to_buildium IS 'Maps a local task record to Buildium API format';
COMMENT ON FUNCTION map_work_order_to_buildium IS 'Maps a local work order record to Buildium API format';

-- Log the migration completion
DO $$
BEGIN
    RAISE NOTICE 'Created maintenance and task tables for Buildium API integration:';
    RAISE NOTICE '- tasks (with categories and history)';
    RAISE NOTICE '- work_orders';
    RAISE NOTICE '- task_categories';
    RAISE NOTICE '- task_history';
    RAISE NOTICE '- task_history_files';
    RAISE NOTICE '';
    RAISE NOTICE 'Created mapping functions:';
    RAISE NOTICE '- map_task_to_buildium';
    RAISE NOTICE '- map_work_order_to_buildium';
    RAISE NOTICE '';
    RAISE NOTICE 'Added appropriate indexes and RLS policies';
    RAISE NOTICE 'All tables support Buildium ID synchronization';
END $$;
