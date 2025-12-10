-- Compliance Management Tables Migration
-- Creates all tables, enums, indexes, triggers, and RLS policies for compliance management

SET check_function_bodies = false;

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE "public"."compliance_asset_type" AS ENUM (
    'elevator',
    'boiler',
    'facade',
    'gas_piping',
    'sprinkler',
    'generic',
    'other'
);

CREATE TYPE "public"."compliance_jurisdiction" AS ENUM (
    'NYC_DOB',
    'NYC_HPD',
    'FDNY',
    'NYC_DEP',
    'OTHER'
);

CREATE TYPE "public"."compliance_item_status" AS ENUM (
    'not_started',
    'scheduled',
    'in_progress',
    'inspected',
    'filed',
    'accepted',
    'accepted_with_defects',
    'failed',
    'overdue',
    'closed'
);

CREATE TYPE "public"."compliance_item_source" AS ENUM (
    'manual',
    'dob_sync',
    'hpd_sync',
    'fdny_sync',
    'open_data_sync'
);

CREATE TYPE "public"."compliance_event_type" AS ENUM (
    'inspection',
    'filing',
    'correction',
    'violation_clearance'
);

CREATE TYPE "public"."compliance_violation_agency" AS ENUM (
    'DOB',
    'HPD',
    'FDNY',
    'DEP',
    'OTHER'
);

CREATE TYPE "public"."compliance_violation_status" AS ENUM (
    'open',
    'in_progress',
    'cleared',
    'closed'
);

CREATE TYPE "public"."compliance_work_order_role" AS ENUM (
    'primary',
    'related'
);

CREATE TYPE "public"."external_sync_source" AS ENUM (
    'dob_now',
    'nyc_open_data',
    'hpd',
    'fdny'
);

CREATE TYPE "public"."external_sync_status" AS ENUM (
    'idle',
    'running',
    'error'
);

CREATE TYPE "public"."compliance_applies_to" AS ENUM (
    'property',
    'asset',
    'both'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- compliance_program_templates: System-wide template definitions
CREATE TABLE IF NOT EXISTS "public"."compliance_program_templates" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "code" character varying(100) NOT NULL,
    "name" character varying(255) NOT NULL,
    "jurisdiction" "public"."compliance_jurisdiction" NOT NULL,
    "frequency_months" integer NOT NULL,
    "lead_time_days" integer DEFAULT 30 NOT NULL,
    "applies_to" "public"."compliance_applies_to" NOT NULL,
    "severity_score" integer CHECK (severity_score >= 1 AND severity_score <= 5) NOT NULL,
    "notes" text,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "compliance_program_templates_code_key" UNIQUE ("code"),
    CONSTRAINT "compliance_program_templates_pkey" PRIMARY KEY ("id")
);

-- compliance_programs: Org-specific program instances (with overrides)
CREATE TABLE IF NOT EXISTS "public"."compliance_programs" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "org_id" uuid NOT NULL,
    "template_id" uuid,
    "code" character varying(100) NOT NULL,
    "name" character varying(255) NOT NULL,
    "jurisdiction" "public"."compliance_jurisdiction" NOT NULL,
    "frequency_months" integer NOT NULL,
    "lead_time_days" integer DEFAULT 30 NOT NULL,
    "applies_to" "public"."compliance_applies_to" NOT NULL,
    "severity_score" integer CHECK (severity_score >= 1 AND severity_score <= 5) NOT NULL,
    "is_enabled" boolean DEFAULT true NOT NULL,
    "override_fields" jsonb DEFAULT '{}'::jsonb,
    "notes" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "compliance_programs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "compliance_programs_org_id_code_key" UNIQUE ("org_id", "code"),
    CONSTRAINT "compliance_programs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT,
    CONSTRAINT "compliance_programs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."compliance_program_templates"("id") ON DELETE SET NULL
);

-- compliance_assets: Regulated things (elevators, boilers, etc.)
CREATE TABLE IF NOT EXISTS "public"."compliance_assets" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "property_id" uuid NOT NULL,
    "org_id" uuid NOT NULL,
    "asset_type" "public"."compliance_asset_type" NOT NULL,
    "name" character varying(255) NOT NULL,
    "location_notes" text,
    "external_source" character varying(100),
    "external_source_id" character varying(255),
    "active" boolean DEFAULT true NOT NULL,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "compliance_assets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "compliance_assets_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT,
    CONSTRAINT "compliance_assets_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE
);

-- compliance_items: Per-period "to-do" items
CREATE TABLE IF NOT EXISTS "public"."compliance_items" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "property_id" uuid NOT NULL,
    "asset_id" uuid,
    "program_id" uuid NOT NULL,
    "org_id" uuid NOT NULL,
    "period_start" date NOT NULL,
    "period_end" date NOT NULL,
    "due_date" date NOT NULL,
    "status" "public"."compliance_item_status" DEFAULT 'not_started' NOT NULL,
    "source" "public"."compliance_item_source" DEFAULT 'manual' NOT NULL,
    "external_tracking_number" character varying(255),
    "result" character varying(100),
    "defect_flag" boolean DEFAULT false NOT NULL,
    "next_action" text,
    "primary_work_order_id" uuid,
    "notes" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "compliance_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "compliance_items_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."compliance_assets"("id") ON DELETE CASCADE,
    CONSTRAINT "compliance_items_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT,
    CONSTRAINT "compliance_items_primary_work_order_id_fkey" FOREIGN KEY ("primary_work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE SET NULL,
    CONSTRAINT "compliance_items_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."compliance_programs"("id") ON DELETE RESTRICT,
    CONSTRAINT "compliance_items_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE
);

-- compliance_item_work_orders: Join table for item-work order relationships
CREATE TABLE IF NOT EXISTS "public"."compliance_item_work_orders" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "item_id" uuid NOT NULL,
    "work_order_id" uuid NOT NULL,
    "org_id" uuid NOT NULL,
    "role" "public"."compliance_work_order_role" DEFAULT 'related' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "compliance_item_work_orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "compliance_item_work_orders_item_id_work_order_id_key" UNIQUE ("item_id", "work_order_id"),
    CONSTRAINT "compliance_item_work_orders_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."compliance_items"("id") ON DELETE CASCADE,
    CONSTRAINT "compliance_item_work_orders_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT,
    CONSTRAINT "compliance_item_work_orders_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE
);

-- compliance_events: Raw history from DOB/HPD APIs
CREATE TABLE IF NOT EXISTS "public"."compliance_events" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "property_id" uuid NOT NULL,
    "asset_id" uuid,
    "item_id" uuid,
    "org_id" uuid NOT NULL,
    "event_type" "public"."compliance_event_type" NOT NULL,
    "inspection_type" character varying(255),
    "inspection_date" date,
    "filed_date" date,
    "compliance_status" character varying(100),
    "defects" boolean DEFAULT false NOT NULL,
    "inspector_name" character varying(255),
    "inspector_company" character varying(255),
    "external_tracking_number" character varying(255),
    "raw_source" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "compliance_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "compliance_events_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."compliance_assets"("id") ON DELETE CASCADE,
    CONSTRAINT "compliance_events_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."compliance_items"("id") ON DELETE SET NULL,
    CONSTRAINT "compliance_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT,
    CONSTRAINT "compliance_events_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE
);

-- compliance_violations: Violations from agencies
CREATE TABLE IF NOT EXISTS "public"."compliance_violations" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "property_id" uuid NOT NULL,
    "asset_id" uuid,
    "org_id" uuid NOT NULL,
    "agency" "public"."compliance_violation_agency" NOT NULL,
    "violation_number" character varying(255) NOT NULL,
    "issue_date" date NOT NULL,
    "description" text NOT NULL,
    "severity_score" integer CHECK (severity_score >= 1 AND severity_score <= 5),
    "status" "public"."compliance_violation_status" DEFAULT 'open' NOT NULL,
    "cure_by_date" date,
    "cleared_date" date,
    "linked_item_id" uuid,
    "linked_work_order_id" uuid,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "compliance_violations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "compliance_violations_org_id_violation_number_key" UNIQUE ("org_id", "violation_number"),
    CONSTRAINT "compliance_violations_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."compliance_assets"("id") ON DELETE CASCADE,
    CONSTRAINT "compliance_violations_linked_item_id_fkey" FOREIGN KEY ("linked_item_id") REFERENCES "public"."compliance_items"("id") ON DELETE SET NULL,
    CONSTRAINT "compliance_violations_linked_work_order_id_fkey" FOREIGN KEY ("linked_work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE SET NULL,
    CONSTRAINT "compliance_violations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT,
    CONSTRAINT "compliance_violations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE
);

-- external_sync_state: Track sync progress per org and source
CREATE TABLE IF NOT EXISTS "public"."external_sync_state" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "org_id" uuid NOT NULL,
    "source" "public"."external_sync_source" NOT NULL,
    "last_cursor" text,
    "last_seen_at" timestamp with time zone,
    "last_run_at" timestamp with time zone,
    "status" "public"."external_sync_status" DEFAULT 'idle' NOT NULL,
    "last_error" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "external_sync_state_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "external_sync_state_org_id_source_key" UNIQUE ("org_id", "source"),
    CONSTRAINT "external_sync_state_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT
);

-- ============================================================================
-- ADD BIN TO PROPERTIES TABLE
-- ============================================================================

ALTER TABLE "public"."properties" 
    ADD COLUMN IF NOT EXISTS "bin" character varying(20);

-- Note: BIN validation is handled in the application layer to allow flexibility
-- for existing data and edge cases where borough may be unset

-- ============================================================================
-- INDEXES
-- ============================================================================

-- compliance_program_templates
CREATE INDEX IF NOT EXISTS "idx_compliance_program_templates_code" ON "public"."compliance_program_templates"("code");
CREATE INDEX IF NOT EXISTS "idx_compliance_program_templates_jurisdiction" ON "public"."compliance_program_templates"("jurisdiction");
CREATE INDEX IF NOT EXISTS "idx_compliance_program_templates_is_active" ON "public"."compliance_program_templates"("is_active");

-- compliance_programs
CREATE INDEX IF NOT EXISTS "idx_compliance_programs_org_id" ON "public"."compliance_programs"("org_id");
CREATE INDEX IF NOT EXISTS "idx_compliance_programs_template_id" ON "public"."compliance_programs"("template_id");
CREATE INDEX IF NOT EXISTS "idx_compliance_programs_jurisdiction" ON "public"."compliance_programs"("jurisdiction");
CREATE INDEX IF NOT EXISTS "idx_compliance_programs_is_enabled" ON "public"."compliance_programs"("is_enabled") WHERE "is_enabled" = true;

-- compliance_assets
CREATE INDEX IF NOT EXISTS "idx_compliance_assets_property_id" ON "public"."compliance_assets"("property_id");
CREATE INDEX IF NOT EXISTS "idx_compliance_assets_org_id" ON "public"."compliance_assets"("org_id");
CREATE INDEX IF NOT EXISTS "idx_compliance_assets_asset_type" ON "public"."compliance_assets"("asset_type");
CREATE INDEX IF NOT EXISTS "idx_compliance_assets_active" ON "public"."compliance_assets"("active") WHERE "active" = true;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_compliance_assets_org_external_unique" ON "public"."compliance_assets"("org_id", "external_source", "external_source_id") WHERE ("external_source" IS NOT NULL AND "external_source_id" IS NOT NULL);

-- compliance_items
CREATE INDEX IF NOT EXISTS "idx_compliance_items_property_id" ON "public"."compliance_items"("property_id");
CREATE INDEX IF NOT EXISTS "idx_compliance_items_asset_id" ON "public"."compliance_items"("asset_id") WHERE "asset_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_compliance_items_program_id" ON "public"."compliance_items"("program_id");
CREATE INDEX IF NOT EXISTS "idx_compliance_items_org_id" ON "public"."compliance_items"("org_id");
CREATE INDEX IF NOT EXISTS "idx_compliance_items_due_date" ON "public"."compliance_items"("due_date");
CREATE INDEX IF NOT EXISTS "idx_compliance_items_status" ON "public"."compliance_items"("status");
CREATE INDEX IF NOT EXISTS "idx_compliance_items_org_due_status" ON "public"."compliance_items"("org_id", "due_date", "status") WHERE "status" IN ('overdue', 'not_started', 'scheduled');
CREATE INDEX IF NOT EXISTS "idx_compliance_items_property_overdue" ON "public"."compliance_items"("property_id", "status") WHERE "status" = 'overdue';
CREATE UNIQUE INDEX IF NOT EXISTS "idx_compliance_items_org_external_tracking_unique" ON "public"."compliance_items"("org_id", "external_tracking_number") WHERE "external_tracking_number" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_compliance_items_period_unique" ON "public"."compliance_items"("program_id", "property_id", "asset_id", "period_start", "period_end") NULLS NOT DISTINCT;

-- compliance_item_work_orders
CREATE INDEX IF NOT EXISTS "idx_compliance_item_work_orders_item_id" ON "public"."compliance_item_work_orders"("item_id");
CREATE INDEX IF NOT EXISTS "idx_compliance_item_work_orders_work_order_id" ON "public"."compliance_item_work_orders"("work_order_id");
CREATE INDEX IF NOT EXISTS "idx_compliance_item_work_orders_org_id" ON "public"."compliance_item_work_orders"("org_id");

-- compliance_events
CREATE INDEX IF NOT EXISTS "idx_compliance_events_property_id" ON "public"."compliance_events"("property_id");
CREATE INDEX IF NOT EXISTS "idx_compliance_events_asset_id" ON "public"."compliance_events"("asset_id") WHERE "asset_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_compliance_events_item_id" ON "public"."compliance_events"("item_id") WHERE "item_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_compliance_events_org_id" ON "public"."compliance_events"("org_id");
CREATE INDEX IF NOT EXISTS "idx_compliance_events_external_tracking_number" ON "public"."compliance_events"("external_tracking_number") WHERE "external_tracking_number" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_compliance_events_inspection_date" ON "public"."compliance_events"("inspection_date");
-- Index for recent events (date filtering handled in queries, not in index predicate)
CREATE INDEX IF NOT EXISTS "idx_compliance_events_property_recent" ON "public"."compliance_events"("property_id", "inspection_date");
CREATE INDEX IF NOT EXISTS "idx_compliance_events_asset_history" ON "public"."compliance_events"("asset_id", "inspection_date") WHERE "asset_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_compliance_events_org_external_tracking_unique" ON "public"."compliance_events"("org_id", "external_tracking_number") WHERE "external_tracking_number" IS NOT NULL;

-- compliance_violations
CREATE INDEX IF NOT EXISTS "idx_compliance_violations_property_id" ON "public"."compliance_violations"("property_id");
CREATE INDEX IF NOT EXISTS "idx_compliance_violations_asset_id" ON "public"."compliance_violations"("asset_id") WHERE "asset_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_compliance_violations_org_id" ON "public"."compliance_violations"("org_id");
CREATE INDEX IF NOT EXISTS "idx_compliance_violations_violation_number" ON "public"."compliance_violations"("violation_number");
CREATE INDEX IF NOT EXISTS "idx_compliance_violations_status" ON "public"."compliance_violations"("status");
CREATE INDEX IF NOT EXISTS "idx_compliance_violations_issue_date" ON "public"."compliance_violations"("issue_date");
CREATE INDEX IF NOT EXISTS "idx_compliance_violations_cure_by_date" ON "public"."compliance_violations"("cure_by_date");
CREATE INDEX IF NOT EXISTS "idx_compliance_violations_org_open" ON "public"."compliance_violations"("org_id", "status", "cure_by_date") WHERE "status" = 'open';
CREATE INDEX IF NOT EXISTS "idx_compliance_violations_property_active" ON "public"."compliance_violations"("property_id", "status") WHERE "status" IN ('open', 'in_progress');

-- external_sync_state
CREATE INDEX IF NOT EXISTS "idx_external_sync_state_org_id" ON "public"."external_sync_state"("org_id");
CREATE INDEX IF NOT EXISTS "idx_external_sync_state_source" ON "public"."external_sync_state"("source");
CREATE INDEX IF NOT EXISTS "idx_external_sync_state_last_run_at" ON "public"."external_sync_state"("last_run_at");

-- properties.bin
CREATE INDEX IF NOT EXISTS "idx_properties_bin" ON "public"."properties"("bin") WHERE "bin" IS NOT NULL;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to check org_id consistency
CREATE OR REPLACE FUNCTION "public"."check_compliance_org_consistency"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    property_org_id uuid;
    asset_org_id uuid;
    program_org_id uuid;
    item_org_id uuid;
    work_order_org_id uuid;
BEGIN
    -- Check property.org_id matches
    IF TG_TABLE_NAME = 'compliance_assets' THEN
        SELECT org_id INTO property_org_id FROM public.properties WHERE id = NEW.property_id;
        IF property_org_id IS NULL THEN
            RAISE EXCEPTION 'Property % does not exist', NEW.property_id;
        END IF;
        IF NEW.org_id != property_org_id THEN
            RAISE EXCEPTION 'compliance_assets.org_id (%) must match property.org_id (%)', NEW.org_id, property_org_id;
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'compliance_items' THEN
        SELECT org_id INTO property_org_id FROM public.properties WHERE id = NEW.property_id;
        IF property_org_id IS NULL THEN
            RAISE EXCEPTION 'Property % does not exist', NEW.property_id;
        END IF;
        IF NEW.org_id != property_org_id THEN
            RAISE EXCEPTION 'compliance_items.org_id (%) must match property.org_id (%)', NEW.org_id, property_org_id;
        END IF;

        -- Check asset.org_id if asset_id is set
        IF NEW.asset_id IS NOT NULL THEN
            SELECT org_id INTO asset_org_id FROM public.compliance_assets WHERE id = NEW.asset_id;
            IF asset_org_id IS NULL THEN
                RAISE EXCEPTION 'Asset % does not exist', NEW.asset_id;
            END IF;
            IF asset_org_id != property_org_id THEN
                RAISE EXCEPTION 'Asset.org_id (%) must match property.org_id (%)', asset_org_id, property_org_id;
            END IF;
        END IF;

        -- Check program.org_id
        SELECT org_id INTO program_org_id FROM public.compliance_programs WHERE id = NEW.program_id;
        IF program_org_id IS NULL THEN
            RAISE EXCEPTION 'Program % does not exist', NEW.program_id;
        END IF;
        IF program_org_id != property_org_id THEN
            RAISE EXCEPTION 'compliance_items.org_id (%) must match program.org_id (%)', NEW.org_id, program_org_id;
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'compliance_events' THEN
        SELECT org_id INTO property_org_id FROM public.properties WHERE id = NEW.property_id;
        IF property_org_id IS NULL THEN
            RAISE EXCEPTION 'Property % does not exist', NEW.property_id;
        END IF;
        IF NEW.org_id != property_org_id THEN
            RAISE EXCEPTION 'compliance_events.org_id (%) must match property.org_id (%)', NEW.org_id, property_org_id;
        END IF;

        IF NEW.asset_id IS NOT NULL THEN
            SELECT org_id INTO asset_org_id FROM public.compliance_assets WHERE id = NEW.asset_id;
            IF asset_org_id IS NULL THEN
                RAISE EXCEPTION 'Asset % does not exist', NEW.asset_id;
            END IF;
            IF asset_org_id != property_org_id THEN
                RAISE EXCEPTION 'Asset.org_id (%) must match property.org_id (%)', asset_org_id, property_org_id;
            END IF;
        END IF;

        IF NEW.item_id IS NOT NULL THEN
            SELECT org_id INTO item_org_id FROM public.compliance_items WHERE id = NEW.item_id;
            IF item_org_id IS NULL THEN
                RAISE EXCEPTION 'Item % does not exist', NEW.item_id;
            END IF;
            IF item_org_id != property_org_id THEN
                RAISE EXCEPTION 'Item.org_id (%) must match property.org_id (%)', item_org_id, property_org_id;
            END IF;
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'compliance_violations' THEN
        SELECT org_id INTO property_org_id FROM public.properties WHERE id = NEW.property_id;
        IF property_org_id IS NULL THEN
            RAISE EXCEPTION 'Property % does not exist', NEW.property_id;
        END IF;
        IF NEW.org_id != property_org_id THEN
            RAISE EXCEPTION 'compliance_violations.org_id (%) must match property.org_id (%)', NEW.org_id, property_org_id;
        END IF;

        IF NEW.asset_id IS NOT NULL THEN
            SELECT org_id INTO asset_org_id FROM public.compliance_assets WHERE id = NEW.asset_id;
            IF asset_org_id IS NULL THEN
                RAISE EXCEPTION 'Asset % does not exist', NEW.asset_id;
            END IF;
            IF asset_org_id != property_org_id THEN
                RAISE EXCEPTION 'Asset.org_id (%) must match property.org_id (%)', asset_org_id, property_org_id;
            END IF;
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'compliance_item_work_orders' THEN
        SELECT org_id INTO item_org_id FROM public.compliance_items WHERE id = NEW.item_id;
        IF item_org_id IS NULL THEN
            RAISE EXCEPTION 'Item % does not exist', NEW.item_id;
        END IF;
        IF NEW.org_id != item_org_id THEN
            RAISE EXCEPTION 'compliance_item_work_orders.org_id (%) must match item.org_id (%)', NEW.org_id, item_org_id;
        END IF;

        SELECT org_id INTO work_order_org_id FROM public.work_orders WHERE id = NEW.work_order_id;
        IF work_order_org_id IS NULL THEN
            RAISE EXCEPTION 'Work order % does not exist', NEW.work_order_id;
        END IF;
        IF work_order_org_id != item_org_id THEN
            RAISE EXCEPTION 'Work order.org_id (%) must match item.org_id (%)', work_order_org_id, item_org_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Function to resolve compliance program with template fallback
CREATE OR REPLACE FUNCTION "public"."resolve_compliance_program"(
    p_org_id uuid,
    p_template_id uuid
)
RETURNS TABLE (
    id uuid,
    org_id uuid,
    template_id uuid,
    code varchar,
    name varchar,
    jurisdiction compliance_jurisdiction,
    frequency_months integer,
    lead_time_days integer,
    applies_to compliance_applies_to,
    severity_score integer,
    is_enabled boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(cp.id, cpt.id::uuid) as id,
        COALESCE(cp.org_id, p_org_id) as org_id,
        COALESCE(cp.template_id, cpt.id) as template_id,
        COALESCE(cp.code, cpt.code) as code,
        COALESCE(cp.name, cpt.name) as name,
        COALESCE(cp.jurisdiction, cpt.jurisdiction) as jurisdiction,
        COALESCE(cp.frequency_months, cpt.frequency_months) as frequency_months,
        COALESCE(cp.lead_time_days, cpt.lead_time_days) as lead_time_days,
        COALESCE(cp.applies_to, cpt.applies_to) as applies_to,
        COALESCE(cp.severity_score, cpt.severity_score) as severity_score,
        COALESCE(cp.is_enabled, true) as is_enabled
    FROM public.compliance_program_templates cpt
    LEFT JOIN public.compliance_programs cp ON cp.template_id = cpt.id AND cp.org_id = p_org_id AND cp.is_enabled = true
    WHERE cpt.id = p_template_id AND cpt.is_active = true
    LIMIT 1;
END;
$$;

-- Function to map event status to item status (deterministic)
CREATE OR REPLACE FUNCTION "public"."map_event_status_to_item_status"(
    p_event_type compliance_event_type,
    p_compliance_status varchar
)
RETURNS compliance_item_status
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- Deterministic mapping based on event type and compliance status
    IF p_event_type = 'inspection' THEN
        IF p_compliance_status ILIKE '%accepted%' AND p_compliance_status ILIKE '%defect%' THEN
            RETURN 'accepted_with_defects';
        ELSIF p_compliance_status ILIKE '%accepted%' OR p_compliance_status ILIKE '%passed%' THEN
            RETURN 'accepted';
        ELSIF p_compliance_status ILIKE '%failed%' OR p_compliance_status ILIKE '%rejected%' THEN
            RETURN 'failed';
        ELSE
            RETURN 'inspected';
        END IF;
    ELSIF p_event_type = 'filing' THEN
        RETURN 'filed';
    ELSIF p_event_type = 'correction' THEN
        RETURN 'in_progress';
    ELSIF p_event_type = 'violation_clearance' THEN
        RETURN 'accepted';
    ELSE
        RETURN 'inspected';
    END IF;
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger for org_id consistency checks
CREATE TRIGGER "check_compliance_assets_org_consistency"
    BEFORE INSERT OR UPDATE ON "public"."compliance_assets"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."check_compliance_org_consistency"();

CREATE TRIGGER "check_compliance_items_org_consistency"
    BEFORE INSERT OR UPDATE ON "public"."compliance_items"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."check_compliance_org_consistency"();

CREATE TRIGGER "check_compliance_events_org_consistency"
    BEFORE INSERT OR UPDATE ON "public"."compliance_events"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."check_compliance_org_consistency"();

CREATE TRIGGER "check_compliance_violations_org_consistency"
    BEFORE INSERT OR UPDATE ON "public"."compliance_violations"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."check_compliance_org_consistency"();

CREATE TRIGGER "check_compliance_item_work_orders_org_consistency"
    BEFORE INSERT OR UPDATE ON "public"."compliance_item_work_orders"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."check_compliance_org_consistency"();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER "update_compliance_program_templates_updated_at"
    BEFORE UPDATE ON "public"."compliance_program_templates"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE TRIGGER "update_compliance_programs_updated_at"
    BEFORE UPDATE ON "public"."compliance_programs"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE TRIGGER "update_compliance_assets_updated_at"
    BEFORE UPDATE ON "public"."compliance_assets"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE TRIGGER "update_compliance_items_updated_at"
    BEFORE UPDATE ON "public"."compliance_items"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE TRIGGER "update_compliance_events_updated_at"
    BEFORE UPDATE ON "public"."compliance_events"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE TRIGGER "update_compliance_violations_updated_at"
    BEFORE UPDATE ON "public"."compliance_violations"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE TRIGGER "update_external_sync_state_updated_at"
    BEFORE UPDATE ON "public"."external_sync_state"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE "public"."compliance_program_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."compliance_programs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."compliance_assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."compliance_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."compliance_item_work_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."compliance_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."compliance_violations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."external_sync_state" ENABLE ROW LEVEL SECURITY;

-- Templates: Read-only for all authenticated users
CREATE POLICY "compliance_program_templates_select" ON "public"."compliance_program_templates"
    FOR SELECT
    USING (true);

-- Programs: Org-scoped using JWT org_id
CREATE POLICY "compliance_programs_select" ON "public"."compliance_programs"
    FOR SELECT
    USING (org_id = (auth.jwt()->>'org_id')::uuid);

CREATE POLICY "compliance_programs_insert" ON "public"."compliance_programs"
    FOR INSERT
    WITH CHECK (org_id = (auth.jwt()->>'org_id')::uuid);

CREATE POLICY "compliance_programs_update" ON "public"."compliance_programs"
    FOR UPDATE
    USING (org_id = (auth.jwt()->>'org_id')::uuid)
    WITH CHECK (org_id = (auth.jwt()->>'org_id')::uuid);

CREATE POLICY "compliance_programs_delete" ON "public"."compliance_programs"
    FOR DELETE
    USING (org_id = (auth.jwt()->>'org_id')::uuid);

-- Assets: Org-scoped using JWT org_id
CREATE POLICY "compliance_assets_select" ON "public"."compliance_assets"
    FOR SELECT
    USING (org_id = (auth.jwt()->>'org_id')::uuid);

CREATE POLICY "compliance_assets_insert" ON "public"."compliance_assets"
    FOR INSERT
    WITH CHECK (org_id = (auth.jwt()->>'org_id')::uuid);

CREATE POLICY "compliance_assets_update" ON "public"."compliance_assets"
    FOR UPDATE
    USING (org_id = (auth.jwt()->>'org_id')::uuid)
    WITH CHECK (org_id = (auth.jwt()->>'org_id')::uuid);

CREATE POLICY "compliance_assets_delete" ON "public"."compliance_assets"
    FOR DELETE
    USING (org_id = (auth.jwt()->>'org_id')::uuid);

-- Items: Org-scoped using JWT org_id
CREATE POLICY "compliance_items_select" ON "public"."compliance_items"
    FOR SELECT
    USING (org_id = (auth.jwt()->>'org_id')::uuid);

CREATE POLICY "compliance_items_insert" ON "public"."compliance_items"
    FOR INSERT
    WITH CHECK (org_id = (auth.jwt()->>'org_id')::uuid);

CREATE POLICY "compliance_items_update" ON "public"."compliance_items"
    FOR UPDATE
    USING (org_id = (auth.jwt()->>'org_id')::uuid)
    WITH CHECK (org_id = (auth.jwt()->>'org_id')::uuid);

CREATE POLICY "compliance_items_delete" ON "public"."compliance_items"
    FOR DELETE
    USING (org_id = (auth.jwt()->>'org_id')::uuid);

-- Item Work Orders: Org-scoped using JWT org_id
CREATE POLICY "compliance_item_work_orders_select" ON "public"."compliance_item_work_orders"
    FOR SELECT
    USING (org_id = (auth.jwt()->>'org_id')::uuid);

CREATE POLICY "compliance_item_work_orders_insert" ON "public"."compliance_item_work_orders"
    FOR INSERT
    WITH CHECK (org_id = (auth.jwt()->>'org_id')::uuid);

CREATE POLICY "compliance_item_work_orders_update" ON "public"."compliance_item_work_orders"
    FOR UPDATE
    USING (org_id = (auth.jwt()->>'org_id')::uuid)
    WITH CHECK (org_id = (auth.jwt()->>'org_id')::uuid);

CREATE POLICY "compliance_item_work_orders_delete" ON "public"."compliance_item_work_orders"
    FOR DELETE
    USING (org_id = (auth.jwt()->>'org_id')::uuid);

-- Events: Org-scoped using JWT org_id
CREATE POLICY "compliance_events_select" ON "public"."compliance_events"
    FOR SELECT
    USING (org_id = (auth.jwt()->>'org_id')::uuid);

CREATE POLICY "compliance_events_insert" ON "public"."compliance_events"
    FOR INSERT
    WITH CHECK (org_id = (auth.jwt()->>'org_id')::uuid);

CREATE POLICY "compliance_events_update" ON "public"."compliance_events"
    FOR UPDATE
    USING (org_id = (auth.jwt()->>'org_id')::uuid)
    WITH CHECK (org_id = (auth.jwt()->>'org_id')::uuid);

CREATE POLICY "compliance_events_delete" ON "public"."compliance_events"
    FOR DELETE
    USING (org_id = (auth.jwt()->>'org_id')::uuid);

-- Violations: Org-scoped using JWT org_id
CREATE POLICY "compliance_violations_select" ON "public"."compliance_violations"
    FOR SELECT
    USING (org_id = (auth.jwt()->>'org_id')::uuid);

CREATE POLICY "compliance_violations_insert" ON "public"."compliance_violations"
    FOR INSERT
    WITH CHECK (org_id = (auth.jwt()->>'org_id')::uuid);

CREATE POLICY "compliance_violations_update" ON "public"."compliance_violations"
    FOR UPDATE
    USING (org_id = (auth.jwt()->>'org_id')::uuid)
    WITH CHECK (org_id = (auth.jwt()->>'org_id')::uuid);

CREATE POLICY "compliance_violations_delete" ON "public"."compliance_violations"
    FOR DELETE
    USING (org_id = (auth.jwt()->>'org_id')::uuid);

-- Sync State: Org-scoped using JWT org_id (service role bypass handled by Supabase)
CREATE POLICY "external_sync_state_select" ON "public"."external_sync_state"
    FOR SELECT
    USING (org_id = (auth.jwt()->>'org_id')::uuid);

CREATE POLICY "external_sync_state_insert" ON "public"."external_sync_state"
    FOR INSERT
    WITH CHECK (org_id = (auth.jwt()->>'org_id')::uuid);

CREATE POLICY "external_sync_state_update" ON "public"."external_sync_state"
    FOR UPDATE
    USING (org_id = (auth.jwt()->>'org_id')::uuid)
    WITH CHECK (org_id = (auth.jwt()->>'org_id')::uuid);

CREATE POLICY "external_sync_state_delete" ON "public"."external_sync_state"
    FOR DELETE
    USING (org_id = (auth.jwt()->>'org_id')::uuid);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE "public"."compliance_program_templates" IS 'System-wide compliance program templates that all orgs inherit';
COMMENT ON TABLE "public"."compliance_programs" IS 'Org-specific compliance programs with optional template overrides';
COMMENT ON TABLE "public"."compliance_assets" IS 'Regulated assets (elevators, boilers, facades, etc.) that require compliance tracking';
COMMENT ON TABLE "public"."compliance_items" IS 'Per-period compliance obligations (to-do items) generated from programs';
COMMENT ON TABLE "public"."compliance_item_work_orders" IS 'Join table linking compliance items to work orders';
COMMENT ON TABLE "public"."compliance_events" IS 'Raw compliance event history from NYC APIs (inspections, filings, corrections)';
COMMENT ON TABLE "public"."compliance_violations" IS 'Compliance violations from NYC agencies (DOB, HPD, FDNY, etc.)';
COMMENT ON TABLE "public"."external_sync_state" IS 'Tracks sync progress per org and external data source for incremental syncing';

COMMENT ON COLUMN "public"."properties"."bin" IS 'Building Identification Number (BIN) - Required for NYC properties';
COMMENT ON FUNCTION "public"."check_compliance_org_consistency"() IS 'Trigger function to ensure org_id consistency across compliance tables';
COMMENT ON FUNCTION "public"."resolve_compliance_program"(uuid, uuid) IS 'Resolves compliance program with org overrides and template fallback';
COMMENT ON FUNCTION "public"."map_event_status_to_item_status"("public"."compliance_event_type", varchar) IS 'Deterministic mapping from compliance event status to item status';

