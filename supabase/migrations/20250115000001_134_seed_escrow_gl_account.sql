-- Migration: Ensure escrow GL account exists and is properly categorized
-- Purpose: Validate escrow tracking infrastructure for monthly logs
DO $$
DECLARE v_escrow_account_id UUID;
v_org_id UUID;
BEGIN -- Get the first org_id (for single-tenant systems, this is fine)
-- For multi-tenant, this would need to run per org
SELECT id INTO v_org_id
FROM organizations
LIMIT 1;
IF v_org_id IS NULL THEN RAISE NOTICE 'No organization found, skipping escrow GL account setup';
RETURN;
END IF;
-- Check if escrow GL account exists
SELECT id INTO v_escrow_account_id
FROM gl_accounts
WHERE (
        name ILIKE '%escrow%'
        OR name ILIKE '%security deposit%'
    )
    AND org_id = v_org_id
LIMIT 1;
IF v_escrow_account_id IS NULL THEN -- Create default escrow GL account
-- Note: buildium_gl_account_id is required, using a placeholder value
INSERT INTO gl_accounts (
        org_id,
        buildium_gl_account_id,
        name,
        type,
        account_number,
        description,
        is_active,
        updated_at
    )
VALUES (
        v_org_id,
        999999,
        -- Placeholder buildium ID for manually created account
        'Tenant Security Deposits Held',
        'Liability',
        '2100',
        'Liability account for tenant security deposits held in escrow',
        true,
        NOW()
    )
RETURNING id INTO v_escrow_account_id;
RAISE NOTICE 'Created escrow GL account: %',
v_escrow_account_id;
ELSE RAISE NOTICE 'Escrow GL account already exists: %',
v_escrow_account_id;
END IF;
-- Ensure it's categorized as 'deposit'
INSERT INTO gl_account_category (gl_account_id, category)
VALUES (v_escrow_account_id, 'deposit'::gl_category) ON CONFLICT (gl_account_id) DO
UPDATE
SET category = 'deposit'::gl_category;
RAISE NOTICE 'Escrow GL account configured with deposit category';
END $$;
-- Add comment for documentation
COMMENT ON TABLE gl_account_category IS 'Categorizes GL accounts for specific use cases. Category ''deposit'' is used for escrow/security deposit accounts in monthly log escrow tracking.';