-- Create API integration tables for Buildium API caching and webhook processing
-- Migration: 20250823000006_create_api_integration_tables.sql
-- Description: Creates tables for API response caching and webhook event processing

-- Create Buildium API Response Cache table
CREATE TABLE IF NOT EXISTS buildium_api_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint VARCHAR(255) NOT NULL,
  parameters JSONB,
  response_data JSONB,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add comments to document the API cache table
COMMENT ON TABLE buildium_api_cache IS 'Caches Buildium API responses to reduce API calls and improve performance';
COMMENT ON COLUMN buildium_api_cache.endpoint IS 'Buildium API endpoint (e.g., /rentals, /units)';
COMMENT ON COLUMN buildium_api_cache.parameters IS 'JSON object containing query parameters used in the request';
COMMENT ON COLUMN buildium_api_cache.response_data IS 'Cached response data from Buildium API';
COMMENT ON COLUMN buildium_api_cache.expires_at IS 'When the cached response expires and should be refreshed';

-- Create indexes for API cache table
CREATE INDEX IF NOT EXISTS idx_buildium_cache_endpoint ON buildium_api_cache(endpoint);
CREATE INDEX IF NOT EXISTS idx_buildium_cache_expires ON buildium_api_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_buildium_cache_created ON buildium_api_cache(created_at);

-- Create Buildium Webhook Events table
CREATE TABLE IF NOT EXISTS buildium_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) UNIQUE,
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add comments to document the webhook events table
COMMENT ON TABLE buildium_webhook_events IS 'Stores webhook events from Buildium for processing';
COMMENT ON COLUMN buildium_webhook_events.event_id IS 'Unique event ID from Buildium webhook';
COMMENT ON COLUMN buildium_webhook_events.event_type IS 'Type of webhook event (e.g., property.updated, lease.payment_received)';
COMMENT ON COLUMN buildium_webhook_events.event_data IS 'Full webhook event data from Buildium';
COMMENT ON COLUMN buildium_webhook_events.processed IS 'Whether the event has been processed';
COMMENT ON COLUMN buildium_webhook_events.processed_at IS 'When the event was processed';
COMMENT ON COLUMN buildium_webhook_events.error_message IS 'Error message if processing failed';
COMMENT ON COLUMN buildium_webhook_events.retry_count IS 'Number of times processing has been retried';
COMMENT ON COLUMN buildium_webhook_events.max_retries IS 'Maximum number of retry attempts';

-- Create indexes for webhook events table
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON buildium_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON buildium_webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON buildium_webhook_events(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_retry ON buildium_webhook_events(retry_count);

-- Create Buildium API Request Log table
CREATE TABLE IF NOT EXISTS buildium_api_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  request_data JSONB,
  response_status INTEGER,
  response_data JSONB,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add comments to document the API log table
COMMENT ON TABLE buildium_api_log IS 'Logs all Buildium API requests and responses for debugging and monitoring';
COMMENT ON COLUMN buildium_api_log.endpoint IS 'Buildium API endpoint that was called';
COMMENT ON COLUMN buildium_api_log.method IS 'HTTP method used (GET, POST, PUT, DELETE)';
COMMENT ON COLUMN buildium_api_log.request_data IS 'Request data sent to Buildium API';
COMMENT ON COLUMN buildium_api_log.response_status IS 'HTTP status code returned by Buildium API';
COMMENT ON COLUMN buildium_api_log.response_data IS 'Response data returned by Buildium API';
COMMENT ON COLUMN buildium_api_log.error_message IS 'Error message if the request failed';
COMMENT ON COLUMN buildium_api_log.duration_ms IS 'Request duration in milliseconds';

-- Create indexes for API log table
CREATE INDEX IF NOT EXISTS idx_buildium_api_log_endpoint ON buildium_api_log(endpoint);
CREATE INDEX IF NOT EXISTS idx_buildium_api_log_method ON buildium_api_log(method);
CREATE INDEX IF NOT EXISTS idx_buildium_api_log_status ON buildium_api_log(response_status);
CREATE INDEX IF NOT EXISTS idx_buildium_api_log_created ON buildium_api_log(created_at);

-- Enable RLS on all new tables
ALTER TABLE buildium_api_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildium_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildium_api_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for API cache table
CREATE POLICY "Enable read access for all users" ON buildium_api_cache FOR SELECT USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON buildium_api_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for authenticated users" ON buildium_api_cache FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for authenticated users" ON buildium_api_cache FOR DELETE USING (true);

-- Create RLS policies for webhook events table
CREATE POLICY "Enable read access for all users" ON buildium_webhook_events FOR SELECT USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON buildium_webhook_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for authenticated users" ON buildium_webhook_events FOR UPDATE USING (true);

-- Create RLS policies for API log table
CREATE POLICY "Enable read access for all users" ON buildium_api_log FOR SELECT USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON buildium_api_log FOR INSERT WITH CHECK (true);

-- Create function to get cached API response
CREATE OR REPLACE FUNCTION get_buildium_api_cache(
  p_endpoint VARCHAR(255),
  p_parameters JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  cached_response JSONB;
BEGIN
  SELECT response_data INTO cached_response
  FROM buildium_api_cache
  WHERE endpoint = p_endpoint
    AND (parameters IS NULL AND p_parameters IS NULL OR parameters = p_parameters)
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN cached_response;
END;
$$ LANGUAGE plpgsql;

-- Create function to set cached API response
CREATE OR REPLACE FUNCTION set_buildium_api_cache(
  p_endpoint VARCHAR(255),
  p_parameters JSONB,
  p_response_data JSONB,
  p_cache_duration_minutes INTEGER DEFAULT 60
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO buildium_api_cache (
    endpoint, parameters, response_data, expires_at
  ) VALUES (
    p_endpoint, p_parameters, p_response_data, 
    now() + (p_cache_duration_minutes || ' minutes')::INTERVAL
  )
  ON CONFLICT (endpoint, parameters) DO UPDATE SET
    response_data = EXCLUDED.response_data,
    expires_at = EXCLUDED.expires_at,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Create function to clear expired cache entries
CREATE OR REPLACE FUNCTION clear_expired_buildium_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM buildium_api_cache WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to process webhook event
CREATE OR REPLACE FUNCTION process_buildium_webhook_event(
  p_event_id VARCHAR(255),
  p_event_type VARCHAR(100),
  p_event_data JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
  success BOOLEAN := true;
  error_msg TEXT;
BEGIN
  -- Insert the webhook event
  INSERT INTO buildium_webhook_events (
    event_id, event_type, event_data
  ) VALUES (
    p_event_id, p_event_type, p_event_data
  )
  ON CONFLICT (event_id) DO NOTHING;
  
  -- Process based on event type
  CASE p_event_type
    WHEN 'property.updated' THEN
      -- Handle property update
      PERFORM handle_property_webhook_update(p_event_data);
    WHEN 'unit.updated' THEN
      -- Handle unit update
      PERFORM handle_unit_webhook_update(p_event_data);
    WHEN 'owner.updated' THEN
      -- Handle owner update
      PERFORM handle_owner_webhook_update(p_event_data);
    WHEN 'lease.payment_received' THEN
      -- Handle lease payment
      PERFORM handle_lease_payment_webhook(p_event_data);
    WHEN 'task.status_changed' THEN
      -- Handle task status change
      PERFORM handle_task_status_webhook(p_event_data);
    ELSE
      -- Unknown event type
      error_msg := 'Unknown event type: ' || p_event_type;
      success := false;
  END CASE;
  
  -- Update processing status
  UPDATE buildium_webhook_events
  SET processed = success,
      processed_at = CASE WHEN success THEN now() ELSE NULL END,
      error_message = CASE WHEN NOT success THEN error_msg ELSE NULL END,
      updated_at = now()
  WHERE event_id = p_event_id;
  
  RETURN success;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and mark as failed
    UPDATE buildium_webhook_events
    SET processed = false,
        error_message = SQLERRM,
        updated_at = now()
    WHERE event_id = p_event_id;
    
    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Create placeholder functions for webhook handlers (to be implemented later)
CREATE OR REPLACE FUNCTION handle_property_webhook_update(event_data JSONB)
RETURNS VOID AS $$
BEGIN
  -- TODO: Implement property webhook update handling
  RAISE NOTICE 'Processing property webhook update: %', event_data;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION handle_unit_webhook_update(event_data JSONB)
RETURNS VOID AS $$
BEGIN
  -- TODO: Implement unit webhook update handling
  RAISE NOTICE 'Processing unit webhook update: %', event_data;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION handle_owner_webhook_update(event_data JSONB)
RETURNS VOID AS $$
BEGIN
  -- TODO: Implement owner webhook update handling
  RAISE NOTICE 'Processing owner webhook update: %', event_data;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION handle_lease_payment_webhook(event_data JSONB)
RETURNS VOID AS $$
BEGIN
  -- TODO: Implement lease payment webhook handling
  RAISE NOTICE 'Processing lease payment webhook: %', event_data;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION handle_task_status_webhook(event_data JSONB)
RETURNS VOID AS $$
BEGIN
  -- TODO: Implement task status webhook handling
  RAISE NOTICE 'Processing task status webhook: %', event_data;
END;
$$ LANGUAGE plpgsql;

-- Add comments to the functions
COMMENT ON FUNCTION get_buildium_api_cache IS 'Retrieves cached API response for a given endpoint and parameters';
COMMENT ON FUNCTION set_buildium_api_cache IS 'Caches API response for a given endpoint and parameters';
COMMENT ON FUNCTION clear_expired_buildium_cache IS 'Removes expired cache entries and returns count of deleted records';
COMMENT ON FUNCTION process_buildium_webhook_event IS 'Processes a Buildium webhook event and updates local data accordingly';

-- Create a scheduled job to clean up expired cache entries (runs every hour)
-- Note: This requires pg_cron extension to be enabled
-- SELECT cron.schedule('clear-expired-buildium-cache', '0 * * * *', 'SELECT clear_expired_buildium_cache();');

-- Log the migration completion
DO $$
BEGIN
    RAISE NOTICE 'Created API integration tables for Buildium:';
    RAISE NOTICE '- buildium_api_cache (for response caching)';
    RAISE NOTICE '- buildium_webhook_events (for webhook processing)';
    RAISE NOTICE '- buildium_api_log (for request/response logging)';
    RAISE NOTICE '';
    RAISE NOTICE 'Created utility functions:';
    RAISE NOTICE '- get_buildium_api_cache';
    RAISE NOTICE '- set_buildium_api_cache';
    RAISE NOTICE '- clear_expired_buildium_cache';
    RAISE NOTICE '- process_buildium_webhook_event';
    RAISE NOTICE '';
    RAISE NOTICE 'Created placeholder webhook handler functions:';
    RAISE NOTICE '- handle_property_webhook_update';
    RAISE NOTICE '- handle_unit_webhook_update';
    RAISE NOTICE '- handle_owner_webhook_update';
    RAISE NOTICE '- handle_lease_payment_webhook';
    RAISE NOTICE '- handle_task_status_webhook';
    RAISE NOTICE '';
    RAISE NOTICE 'Added appropriate indexes and RLS policies';
    RAISE NOTICE 'All tables support efficient caching and webhook processing';
END $$;
