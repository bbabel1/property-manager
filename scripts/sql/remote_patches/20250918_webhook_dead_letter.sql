-- Webhook dead-letter support and dashboard query helper

-- Add attempts counter and index status
DO $$ BEGIN
  ALTER TABLE public.buildium_webhook_events
    ADD COLUMN IF NOT EXISTS attempts integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS dead_letter boolean DEFAULT false;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'buildium_webhook_events' AND column_name = 'status'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON public.buildium_webhook_events(status)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'buildium_webhook_events' AND column_name = 'dead_letter'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_webhook_events_dead_letter ON public.buildium_webhook_events(dead_letter) WHERE dead_letter = true';
  END IF;
END $$;

-- Optional view for dashboarding
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'buildium_webhook_events' AND column_name = 'status'
  ) THEN
    EXECUTE 'CREATE OR REPLACE VIEW public.v_buildium_webhook_dead_letters AS '
         || 'SELECT id, event_id, event_type, status, attempts, error, received_at, processed_at '
         || 'FROM public.buildium_webhook_events '
         || 'WHERE (status = ''failed'' AND attempts >= 3) OR dead_letter = true;';
  END IF;
END $$;
