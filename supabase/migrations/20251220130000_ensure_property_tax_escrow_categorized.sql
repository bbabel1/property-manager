-- Migration: Ensure Property Tax Escrow accounts are categorized as 'deposit'
-- Purpose: Fix escrow tracking for Property Tax Escrow journal entries
DO $$
DECLARE
  v_account_id UUID;
BEGIN
  -- Find Property Tax Escrow accounts that aren't categorized as 'deposit'
  FOR v_account_id IN
    SELECT ga.id
    FROM gl_accounts ga
    WHERE ga.name ILIKE '%property tax escrow%'
       OR ga.name ILIKE '%tax escrow%'
      AND NOT EXISTS (
        SELECT 1
        FROM gl_account_category gac
        WHERE gac.gl_account_id = ga.id
          AND gac.category = 'deposit'::gl_category
      )
  LOOP
    -- Categorize as 'deposit'
    INSERT INTO gl_account_category (gl_account_id, category)
    VALUES (v_account_id, 'deposit'::gl_category)
    ON CONFLICT (gl_account_id) DO UPDATE
    SET category = 'deposit'::gl_category;
    
    RAISE NOTICE 'Categorized Property Tax Escrow account % as deposit', v_account_id;
  END LOOP;
END $$;

COMMENT ON FUNCTION public.monthly_log_transaction_bundle(uuid) IS
'Updated to preserve sign for deposit account transactions: Credit = positive (deposit), Debit = negative (withdrawal).';

