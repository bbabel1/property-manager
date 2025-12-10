-- Seed Default Compliance Programs
-- Creates compliance_program_templates and enables them for all existing orgs
-- Also creates trigger to auto-enable templates for new orgs

SET check_function_bodies = false;

-- ============================================================================
-- INSERT COMPLIANCE PROGRAM TEMPLATES
-- ============================================================================

INSERT INTO "public"."compliance_program_templates" (
    "code",
    "name",
    "jurisdiction",
    "frequency_months",
    "lead_time_days",
    "applies_to",
    "severity_score",
    "notes",
    "is_active"
) VALUES
-- Elevator Programs
('NYC_ELV_CAT1', 'Elevator – 1-Year / Category 1 Test', 'NYC_DOB', 12, 30, 'asset', 4, 'Annual Category 1 elevator test required by NYC DOB', true),
('NYC_ELV_CAT5', 'Elevator – 5-Year / Category 5 Test', 'NYC_DOB', 60, 90, 'asset', 5, '5-year Category 5 elevator test required by NYC DOB', true),

-- Boiler Programs
('NYC_BOILER_ANNUAL', 'Boiler Annual Inspection', 'NYC_DOB', 12, 30, 'asset', 4, 'Annual boiler inspection required by NYC DOB', true),

-- Facade Programs
('NYC_FACADE_LL11', 'Facade Inspection – Local Law 11', 'NYC_DOB', 60, 180, 'property', 5, '5-year facade inspection required by Local Law 11', true),

-- Gas Piping Programs
('NYC_GAS_PIPING', 'Gas Piping Inspection', 'NYC_DOB', 12, 30, 'property', 3, 'Gas piping inspection required by NYC DOB', true),

-- Sprinkler Programs
('NYC_SPRINKLER_ANNUAL', 'Sprinkler System Annual Inspection', 'FDNY', 12, 30, 'asset', 4, 'Annual sprinkler system inspection required by FDNY', true),

-- HPD Programs
('NYC_HPD_REGISTRATION', 'HPD Annual Registration', 'NYC_HPD', 12, 60, 'property', 2, 'Annual HPD registration required', true)
ON CONFLICT ("code") DO NOTHING;

-- ============================================================================
-- ENABLE TEMPLATES FOR EXISTING ORGS
-- ============================================================================

-- Insert enabled compliance_programs for all existing orgs
INSERT INTO "public"."compliance_programs" (
    "org_id",
    "template_id",
    "code",
    "name",
    "jurisdiction",
    "frequency_months",
    "lead_time_days",
    "applies_to",
    "severity_score",
    "is_enabled",
    "notes"
)
SELECT
    o.id as org_id,
    t.id as template_id,
    t.code,
    t.name,
    t.jurisdiction,
    t.frequency_months,
    t.lead_time_days,
    t.applies_to,
    t.severity_score,
    true as is_enabled,
    t.notes
FROM "public"."organizations" o
CROSS JOIN "public"."compliance_program_templates" t
WHERE t.is_active = true
ON CONFLICT ("org_id", "code") DO UPDATE SET
    "is_enabled" = EXCLUDED."is_enabled",
    "updated_at" = now();

-- ============================================================================
-- FUNCTION TO AUTO-ENABLE TEMPLATES FOR NEW ORGS
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."auto_enable_compliance_programs_for_new_org"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- When a new organization is created, automatically enable all active compliance program templates
    INSERT INTO "public"."compliance_programs" (
        "org_id",
        "template_id",
        "code",
        "name",
        "jurisdiction",
        "frequency_months",
        "lead_time_days",
        "applies_to",
        "severity_score",
        "is_enabled",
        "notes"
    )
    SELECT
        NEW.id as org_id,
        t.id as template_id,
        t.code,
        t.name,
        t.jurisdiction,
        t.frequency_months,
        t.lead_time_days,
        t.applies_to,
        t.severity_score,
        true as is_enabled,
        t.notes
    FROM "public"."compliance_program_templates" t
    WHERE t.is_active = true
    ON CONFLICT ("org_id", "code") DO NOTHING;

    RETURN NEW;
END;
$$;

-- ============================================================================
-- TRIGGER TO AUTO-ENABLE FOR NEW ORGS
-- ============================================================================

DROP TRIGGER IF EXISTS "trigger_auto_enable_compliance_programs" ON "public"."organizations";

CREATE TRIGGER "trigger_auto_enable_compliance_programs"
    AFTER INSERT ON "public"."organizations"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."auto_enable_compliance_programs_for_new_org"();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION "public"."auto_enable_compliance_programs_for_new_org"() IS 'Automatically enables all active compliance program templates for newly created organizations';

