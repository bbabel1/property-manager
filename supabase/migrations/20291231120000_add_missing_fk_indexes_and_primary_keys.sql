-- Add missing indexes for frequently-queried foreign keys
-- Add primary keys where missing
-- This addresses Supabase linter INFO-level suggestions for performance

BEGIN;

-- ============================================================================
-- 1. Add indexes for frequently-queried foreign keys
-- ============================================================================

-- billing_events: assignment_id (frequently queried for service plan assignments)
CREATE INDEX IF NOT EXISTS idx_billing_events_assignment_id 
  ON public.billing_events(assignment_id)
  WHERE assignment_id IS NOT NULL;

-- compliance_items: primary_work_order_id
CREATE INDEX IF NOT EXISTS idx_compliance_items_primary_work_order_id 
  ON public.compliance_items(primary_work_order_id)
  WHERE primary_work_order_id IS NOT NULL;

-- compliance_property_program_overrides: assigned_by (user_id)
CREATE INDEX IF NOT EXISTS idx_compliance_property_program_overrides_assigned_by 
  ON public.compliance_property_program_overrides(assigned_by)
  WHERE assigned_by IS NOT NULL;

-- compliance_violations: linked_item_id and linked_work_order_id
CREATE INDEX IF NOT EXISTS idx_compliance_violations_linked_item_id 
  ON public.compliance_violations(linked_item_id)
  WHERE linked_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_compliance_violations_linked_work_order_id 
  ON public.compliance_violations(linked_work_order_id)
  WHERE linked_work_order_id IS NOT NULL;

-- email_templates: created_by_user_id and updated_by_user_id
CREATE INDEX IF NOT EXISTS idx_email_templates_created_by_user_id 
  ON public.email_templates(created_by_user_id)
  WHERE created_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_templates_updated_by_user_id 
  ON public.email_templates(updated_by_user_id)
  WHERE updated_by_user_id IS NOT NULL;

-- files: category (foreign key to file_categories)
CREATE INDEX IF NOT EXISTS idx_files_category 
  ON public.files(category)
  WHERE category IS NOT NULL;

-- gl_account_balances: gl_account_id and property_id (already have unique constraint, but add indexes for queries)
-- Note: These might already exist, but adding IF NOT EXISTS is safe
CREATE INDEX IF NOT EXISTS idx_gl_account_balances_gl_account_id 
  ON public.gl_account_balances(gl_account_id);

CREATE INDEX IF NOT EXISTS idx_gl_account_balances_property_id 
  ON public.gl_account_balances(property_id)
  WHERE property_id IS NOT NULL;

-- journal_entries: transaction_id
CREATE INDEX IF NOT EXISTS idx_journal_entries_transaction_id 
  ON public.journal_entries(transaction_id)
  WHERE transaction_id IS NOT NULL;

-- lease: org_id (critical for multi-tenant queries)
CREATE INDEX IF NOT EXISTS idx_lease_org_id 
  ON public.lease(org_id);

-- monthly_log_task_rules: assigned_to_staff_id and category_id
CREATE INDEX IF NOT EXISTS idx_monthly_log_task_rules_assigned_to_staff_id 
  ON public.monthly_log_task_rules(assigned_to_staff_id)
  WHERE assigned_to_staff_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_monthly_log_task_rules_category_id 
  ON public.monthly_log_task_rules(category_id)
  WHERE category_id IS NOT NULL;

-- monthly_logs: tenant_id
CREATE INDEX IF NOT EXISTS idx_monthly_logs_tenant_id 
  ON public.monthly_logs(tenant_id)
  WHERE tenant_id IS NOT NULL;

-- owners: user_id
CREATE INDEX IF NOT EXISTS idx_owners_user_id 
  ON public.owners(user_id)
  WHERE user_id IS NOT NULL;

-- property_notes: created_by
CREATE INDEX IF NOT EXISTS idx_property_notes_created_by 
  ON public.property_notes(created_by)
  WHERE created_by IS NOT NULL;

-- reconciliation_log: performed_by
CREATE INDEX IF NOT EXISTS idx_reconciliation_log_performed_by 
  ON public.reconciliation_log(performed_by)
  WHERE performed_by IS NOT NULL;

-- recurring_transactions: lease_id
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_lease_id 
  ON public.recurring_transactions(lease_id)
  WHERE lease_id IS NOT NULL;

-- service_plan_assignments: property_id and unit_id
CREATE INDEX IF NOT EXISTS idx_service_plan_assignments_property_id 
  ON public.service_plan_assignments(property_id)
  WHERE property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_plan_assignments_unit_id 
  ON public.service_plan_assignments(unit_id)
  WHERE unit_id IS NOT NULL;

-- tenants: user_id
CREATE INDEX IF NOT EXISTS idx_tenants_user_id 
  ON public.tenants(user_id)
  WHERE user_id IS NOT NULL;

-- transactions: unit_id, paid_to_tenant_id, paid_to_vendor_id, bill_transaction_id
CREATE INDEX IF NOT EXISTS idx_transactions_unit_id 
  ON public.transactions(unit_id)
  WHERE unit_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_paid_to_tenant_id 
  ON public.transactions(paid_to_tenant_id)
  WHERE paid_to_tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_paid_to_vendor_id 
  ON public.transactions(paid_to_vendor_id)
  WHERE paid_to_vendor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_bill_transaction_id 
  ON public.transactions(bill_transaction_id)
  WHERE bill_transaction_id IS NOT NULL;

-- ============================================================================
-- 2. Add primary keys where missing
-- ============================================================================

-- gl_account_balances: Add primary key (property_id can be NULL, so use id column)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'gl_account_balances_pkey'
  ) THEN
    -- Add id column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'gl_account_balances'
      AND column_name = 'id'
    ) THEN
      ALTER TABLE public.gl_account_balances
        ADD COLUMN id uuid DEFAULT gen_random_uuid() NOT NULL;
    END IF;
    
    -- Create primary key on id
    ALTER TABLE public.gl_account_balances
      ADD CONSTRAINT gl_account_balances_pkey 
      PRIMARY KEY (id);
  END IF;
END $$;

-- role_permissions: Check if it needs a primary key
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'role_permissions'
  ) THEN
    -- Check if primary key exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'role_permissions_pkey'
      AND conrelid = 'public.role_permissions'::regclass
    ) THEN
      -- Check if both columns exist
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'role_permissions'
        AND column_name = 'role_id'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'role_permissions'
        AND column_name = 'permission_id'
      ) THEN
        -- Create composite primary key
        ALTER TABLE public.role_permissions
          ADD CONSTRAINT role_permissions_pkey 
          PRIMARY KEY (role_id, permission_id);
      END IF;
    END IF;
  END IF;
END $$;

-- property_staff: Already has composite PRIMARY KEY, no action needed
-- (The linter might be confused, but the table has: PRIMARY KEY (property_id, staff_id, role))

COMMIT;

