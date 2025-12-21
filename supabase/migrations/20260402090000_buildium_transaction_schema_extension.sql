-- Align transactions with Buildium transaction schema
-- Adds missing header fields, journal line fidelity, and deposit/payment split storage.

-- Transaction header enhancements
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS buildium_last_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_method_raw text,
  ADD COLUMN IF NOT EXISTS payee_buildium_id integer,
  ADD COLUMN IF NOT EXISTS payee_buildium_type text,
  ADD COLUMN IF NOT EXISTS payee_name text,
  ADD COLUMN IF NOT EXISTS payee_href text,
  ADD COLUMN IF NOT EXISTS is_internal_transaction boolean,
  ADD COLUMN IF NOT EXISTS internal_transaction_is_pending boolean,
  ADD COLUMN IF NOT EXISTS internal_transaction_result_date date,
  ADD COLUMN IF NOT EXISTS internal_transaction_result_code text,
  ADD COLUMN IF NOT EXISTS buildium_unit_id integer,
  ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS buildium_unit_number text,
  ADD COLUMN IF NOT EXISTS buildium_application_id integer,
  ADD COLUMN IF NOT EXISTS unit_agreement_id integer,
  ADD COLUMN IF NOT EXISTS unit_agreement_type text,
  ADD COLUMN IF NOT EXISTS unit_agreement_href text,
  ADD COLUMN IF NOT EXISTS bank_gl_account_buildium_id integer;

COMMENT ON COLUMN public.transactions.buildium_last_updated_at IS 'LastUpdatedDateTime from Buildium for sync freshness.';
COMMENT ON COLUMN public.transactions.payment_method_raw IS 'Raw PaymentMethod value from Buildium PaymentDetail.';
COMMENT ON COLUMN public.transactions.payee_buildium_id IS 'Payee.Id from Buildium PaymentDetail.';
COMMENT ON COLUMN public.transactions.payee_buildium_type IS 'Payee.Type from Buildium PaymentDetail.';
COMMENT ON COLUMN public.transactions.payee_name IS 'Payee.Name from Buildium PaymentDetail.';
COMMENT ON COLUMN public.transactions.payee_href IS 'Payee.Href from Buildium PaymentDetail.';
COMMENT ON COLUMN public.transactions.is_internal_transaction IS 'PaymentDetail.IsInternalTransaction flag.';
COMMENT ON COLUMN public.transactions.internal_transaction_is_pending IS 'PaymentDetail.InternalTransactionStatus.IsPending.';
COMMENT ON COLUMN public.transactions.internal_transaction_result_date IS 'PaymentDetail.InternalTransactionStatus.ResultDate.';
COMMENT ON COLUMN public.transactions.internal_transaction_result_code IS 'PaymentDetail.InternalTransactionStatus.ResultCode.';
COMMENT ON COLUMN public.transactions.buildium_unit_id IS 'UnitId associated with the transaction.';
COMMENT ON COLUMN public.transactions.unit_id IS 'Local unit reference when available.';
COMMENT ON COLUMN public.transactions.buildium_unit_number IS 'UnitNumber from Buildium payloads.';
COMMENT ON COLUMN public.transactions.buildium_application_id IS 'Application.Id from Buildium transaction payloads.';
COMMENT ON COLUMN public.transactions.unit_agreement_id IS 'UnitAgreement.Id from Buildium transaction payloads.';
COMMENT ON COLUMN public.transactions.unit_agreement_type IS 'UnitAgreement.Type from Buildium transaction payloads.';
COMMENT ON COLUMN public.transactions.unit_agreement_href IS 'UnitAgreement.Href from Buildium transaction payloads.';
COMMENT ON COLUMN public.transactions.bank_gl_account_buildium_id IS 'BankGLAccountId from Buildium DepositDetails for lookup to gl_accounts.';

-- Journal line fidelity
ALTER TABLE public.transaction_lines
  ADD COLUMN IF NOT EXISTS reference_number text,
  ADD COLUMN IF NOT EXISTS is_cash_posting boolean,
  ADD COLUMN IF NOT EXISTS accounting_entity_type_raw text;

COMMENT ON COLUMN public.transaction_lines.reference_number IS 'ReferenceNumber from Buildium Journal line.';
COMMENT ON COLUMN public.transaction_lines.is_cash_posting IS 'IsCashPosting flag from Buildium Journal line.';
COMMENT ON COLUMN public.transaction_lines.accounting_entity_type_raw IS 'Raw AccountingEntityType from Buildium Journal line.';

-- Deposit/payment splits
CREATE TABLE IF NOT EXISTS public.transaction_payment_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE CASCADE,
  buildium_payment_transaction_id integer,
  accounting_entity_id integer,
  accounting_entity_type text,
  accounting_entity_href text,
  accounting_unit_id integer,
  accounting_unit_href text,
  amount numeric,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transaction_payment_transactions_tx
  ON public.transaction_payment_transactions(transaction_id);

COMMENT ON TABLE public.transaction_payment_transactions IS 'PaymentTransactions inside Buildium DepositDetails; tracks splits and accounting entities.';
