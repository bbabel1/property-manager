-- Phase 1: Payment lifecycle database schema
-- - Payment intents with idempotency
-- - Payment projection table
-- - Manual payment events and unified event view
-- - Payer restriction tables with method junction
-- - Failure code lookup and derived lifecycle views

BEGIN;

-- Optional enum for payment_intent.state (keeps other lifecycle columns as text)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'payment_intent_state_enum'
  ) THEN
    CREATE TYPE public.payment_intent_state_enum AS ENUM (
      'created',
      'submitted',
      'pending',
      'authorized',
      'settled',
      'failed'
    );
    COMMENT ON TYPE public.payment_intent_state_enum IS 'Lifecycle states for payment intents; used for validation while keeping flexibility for other lifecycle tables.';
  END IF;
END $$;

-- payment_intent: idempotency gate before Buildium calls
CREATE TABLE IF NOT EXISTS public.payment_intent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  payer_id uuid,
  payer_type text,
  amount numeric NOT NULL,
  payment_method public.payment_method_enum,
  state public.payment_intent_state_enum NOT NULL DEFAULT 'created',
  gateway_provider text,
  gateway_intent_id text,
  allocation_plan jsonb,
  bypass_udf boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_intent_idempotency_unique UNIQUE (org_id, idempotency_key),
  CONSTRAINT payment_intent_org_scope UNIQUE (org_id, id)
);

CREATE INDEX IF NOT EXISTS payment_intent_org_state_idx ON public.payment_intent(org_id, state);

COMMENT ON TABLE public.payment_intent IS 'Payment intent records decoupled from transactions; enforces idempotency before hitting gateways.';
COMMENT ON COLUMN public.payment_intent.org_id IS 'Organization scope for RLS.';
COMMENT ON COLUMN public.payment_intent.idempotency_key IS 'Idempotency key for duplicate prevention before calling external gateways.';
COMMENT ON COLUMN public.payment_intent.payer_id IS 'Payer reference (tenant/contact/etc).';
COMMENT ON COLUMN public.payment_intent.payer_type IS 'Payer type descriptor (tenant, contact, owner, etc).';
COMMENT ON COLUMN public.payment_intent.amount IS 'Intended payment amount.';
COMMENT ON COLUMN public.payment_intent.payment_method IS 'Requested payment method (payment_method_enum).';
COMMENT ON COLUMN public.payment_intent.state IS 'Lifecycle state for the intent; validated via payment_intent_state_enum.';
COMMENT ON COLUMN public.payment_intent.gateway_provider IS 'Gateway/provider handling the intent (buildium, stripe, etc).';
COMMENT ON COLUMN public.payment_intent.gateway_intent_id IS 'Provider-side intent identifier.';
COMMENT ON COLUMN public.payment_intent.allocation_plan IS 'Reserved for tenant ledger allocation plan.';
COMMENT ON COLUMN public.payment_intent.bypass_udf IS 'Explicit override to bypass Undeposited Funds handling for online methods.';
COMMENT ON COLUMN public.payment_intent.metadata IS 'Arbitrary metadata for the intent.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    DROP TRIGGER IF EXISTS set_payment_intent_updated_at ON public.payment_intent;
    CREATE TRIGGER set_payment_intent_updated_at
      BEFORE UPDATE ON public.payment_intent
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

ALTER TABLE public.payment_intent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_intent_select ON public.payment_intent;
CREATE POLICY payment_intent_select ON public.payment_intent
  FOR SELECT USING (public.is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS payment_intent_insert ON public.payment_intent;
CREATE POLICY payment_intent_insert ON public.payment_intent
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND public.is_org_member(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS payment_intent_update ON public.payment_intent;
CREATE POLICY payment_intent_update ON public.payment_intent
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND public.is_org_member(auth.uid(), org_id)
  ) WITH CHECK (
    auth.uid() IS NOT NULL AND public.is_org_member(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS payment_intent_delete ON public.payment_intent;
CREATE POLICY payment_intent_delete ON public.payment_intent
  FOR DELETE USING (
    auth.uid() IS NOT NULL AND public.is_org_member(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS payment_intent_service_role_all ON public.payment_intent;
CREATE POLICY payment_intent_service_role_all ON public.payment_intent
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Lookup table for normalizing Buildium failure codes
CREATE TABLE IF NOT EXISTS public.buildium_failure_codes (
  raw_code text PRIMARY KEY,
  normalized_code text NOT NULL,
  failure_category text,
  description text
);

COMMENT ON TABLE public.buildium_failure_codes IS 'Maps Buildium internal_transaction_result_code values to normalized failure reasons.';
COMMENT ON COLUMN public.buildium_failure_codes.normalized_code IS 'Normalized failure identifier (e.g., insufficient_funds, account_closed).';
COMMENT ON COLUMN public.buildium_failure_codes.failure_category IS 'Higher-level failure grouping (nsf, account_issue, system_error, authorization).';

INSERT INTO public.buildium_failure_codes (raw_code, normalized_code, failure_category, description) VALUES
  ('NSF', 'insufficient_funds', 'nsf', 'Non-sufficient funds'),
  ('AccountClosed', 'account_closed', 'account_issue', 'Account closed'),
  ('InsufficientFunds', 'insufficient_funds', 'nsf', 'Insufficient funds'),
  ('InvalidAccount', 'invalid_account', 'account_issue', 'Invalid account'),
  ('StopPayment', 'stop_payment', 'account_issue', 'Stop payment requested'),
  ('RevokedAuthorization', 'revoked_authorization', 'account_issue', 'Authorization revoked'),
  ('R01', 'insufficient_funds', 'nsf', 'ACH: Insufficient funds'),
  ('R02', 'account_closed', 'account_issue', 'ACH: Account closed'),
  ('R03', 'unable_to_locate_account', 'account_issue', 'ACH: Unable to locate account'),
  ('R29', 'corporate_customer_advised_not_authorized', 'authorization', 'ACH: Corporate customer advised not authorized'),
  ('R51', 'item_exceeds_withdrawal_limit', 'account_issue', 'ACH: Item exceeds withdrawal limit')
ON CONFLICT (raw_code) DO UPDATE
SET normalized_code = EXCLUDED.normalized_code,
    failure_category = EXCLUDED.failure_category,
    description = EXCLUDED.description;

-- payer_restrictions: scoped restrictions on payers/payment methods
CREATE TABLE IF NOT EXISTS public.payer_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  payer_id uuid,
  payer_type text,
  restriction_type text NOT NULL,
  restricted_until timestamptz,
  reason text,
  source_event_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payer_restrictions_org_scope UNIQUE (org_id, id)
);

CREATE INDEX IF NOT EXISTS payer_restrictions_org_payer_idx ON public.payer_restrictions(org_id, payer_id);
CREATE INDEX IF NOT EXISTS payer_restrictions_org_restricted_until_idx ON public.payer_restrictions(org_id, restricted_until);
CREATE INDEX IF NOT EXISTS payer_restrictions_type_idx ON public.payer_restrictions(restriction_type);

COMMENT ON TABLE public.payer_restrictions IS 'Payer-level restriction records (eft disabled, method disabled) with optional expirations.';
COMMENT ON COLUMN public.payer_restrictions.restriction_type IS 'Restriction type (eft_disabled, payment_method_disabled, etc).';
COMMENT ON COLUMN public.payer_restrictions.restricted_until IS 'Restriction expiry; NULL means persistent until cleared.';
COMMENT ON COLUMN public.payer_restrictions.source_event_id IS 'Originating event (buildium_webhook_events.id or manual_payment_events.id).';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    DROP TRIGGER IF EXISTS set_payer_restrictions_updated_at ON public.payer_restrictions;
    CREATE TRIGGER set_payer_restrictions_updated_at
      BEFORE UPDATE ON public.payer_restrictions
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

ALTER TABLE public.payer_restrictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payer_restrictions_select ON public.payer_restrictions;
CREATE POLICY payer_restrictions_select ON public.payer_restrictions
  FOR SELECT USING (public.is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS payer_restrictions_insert ON public.payer_restrictions;
CREATE POLICY payer_restrictions_insert ON public.payer_restrictions
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND public.is_org_member(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS payer_restrictions_update ON public.payer_restrictions;
CREATE POLICY payer_restrictions_update ON public.payer_restrictions
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND public.is_org_member(auth.uid(), org_id)
  ) WITH CHECK (
    auth.uid() IS NOT NULL AND public.is_org_member(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS payer_restrictions_delete ON public.payer_restrictions;
CREATE POLICY payer_restrictions_delete ON public.payer_restrictions
  FOR DELETE USING (
    auth.uid() IS NOT NULL AND public.is_org_member(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS payer_restrictions_service_role_all ON public.payer_restrictions;
CREATE POLICY payer_restrictions_service_role_all ON public.payer_restrictions
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- payer_restriction_methods: junction for method/group enforcement
CREATE TABLE IF NOT EXISTS public.payer_restriction_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  payer_restriction_id uuid NOT NULL,
  payment_method public.payment_method_enum NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payer_restriction_methods_unique_method UNIQUE (payer_restriction_id, payment_method),
  CONSTRAINT payer_restriction_methods_parent_fk FOREIGN KEY (org_id, payer_restriction_id)
    REFERENCES public.payer_restrictions(org_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS payer_restriction_methods_restriction_idx ON public.payer_restriction_methods(payer_restriction_id);
CREATE INDEX IF NOT EXISTS payer_restriction_methods_payment_method_idx ON public.payer_restriction_methods(payment_method);
CREATE INDEX IF NOT EXISTS payer_restriction_methods_org_method_idx ON public.payer_restriction_methods(org_id, payment_method);

COMMENT ON TABLE public.payer_restriction_methods IS 'Junction table listing restricted payment methods per payer_restriction.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    DROP TRIGGER IF EXISTS set_payer_restriction_methods_updated_at ON public.payer_restriction_methods;
    CREATE TRIGGER set_payer_restriction_methods_updated_at
      BEFORE UPDATE ON public.payer_restriction_methods
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

ALTER TABLE public.payer_restriction_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payer_restriction_methods_select ON public.payer_restriction_methods;
CREATE POLICY payer_restriction_methods_select ON public.payer_restriction_methods
  FOR SELECT USING (public.is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS payer_restriction_methods_insert ON public.payer_restriction_methods;
CREATE POLICY payer_restriction_methods_insert ON public.payer_restriction_methods
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND public.is_org_member(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS payer_restriction_methods_update ON public.payer_restriction_methods;
CREATE POLICY payer_restriction_methods_update ON public.payer_restriction_methods
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND public.is_org_member(auth.uid(), org_id)
  ) WITH CHECK (
    auth.uid() IS NOT NULL AND public.is_org_member(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS payer_restriction_methods_delete ON public.payer_restriction_methods;
CREATE POLICY payer_restriction_methods_delete ON public.payer_restriction_methods
  FOR DELETE USING (
    auth.uid() IS NOT NULL AND public.is_org_member(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS payer_restriction_methods_service_role_all ON public.payer_restriction_methods;
CREATE POLICY payer_restriction_methods_service_role_all ON public.payer_restriction_methods
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- payment: thin projection over transactions with lifecycle metadata
CREATE TABLE IF NOT EXISTS public.payment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id uuid NOT NULL,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE RESTRICT,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  gateway_transaction_id text,
  state text,
  normalized_state text,
  amount numeric,
  payment_method public.payment_method_enum,
  payer_id uuid,
  payer_type text,
  returned_at timestamptz,
  raw_return_reason_code text,
  normalized_return_reason_code text,
  disputed_at timestamptz,
  chargeback_id text,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_intent_fk FOREIGN KEY (org_id, payment_intent_id) REFERENCES public.payment_intent(org_id, id) ON DELETE CASCADE,
  CONSTRAINT payment_transaction_unique UNIQUE (transaction_id),
  CONSTRAINT payment_gateway_transaction_unique UNIQUE (org_id, gateway_transaction_id),
  CONSTRAINT payment_org_scope UNIQUE (org_id, id)
);

CREATE INDEX IF NOT EXISTS payment_org_state_idx ON public.payment(org_id, state);
CREATE INDEX IF NOT EXISTS payment_org_intent_idx ON public.payment(org_id, payment_intent_id);

COMMENT ON TABLE public.payment IS 'Lifecycle projection for transactions; enforces one payment per transaction and guards duplicate gateway ids.';
COMMENT ON COLUMN public.payment.gateway_transaction_id IS 'Gateway transaction identifier (e.g., Buildium transaction id).';
COMMENT ON COLUMN public.payment.normalized_state IS 'Normalized lifecycle state; derive via view from transaction fields.';
COMMENT ON COLUMN public.payment.settled_at IS 'Derived settlement timestamp (result date for internal transactions, created_at for non-internal).';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    DROP TRIGGER IF EXISTS set_payment_updated_at ON public.payment;
    CREATE TRIGGER set_payment_updated_at
      BEFORE UPDATE ON public.payment
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

ALTER TABLE public.payment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_select ON public.payment;
CREATE POLICY payment_select ON public.payment
  FOR SELECT USING (public.is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS payment_insert ON public.payment;
CREATE POLICY payment_insert ON public.payment
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND public.is_org_member(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS payment_update ON public.payment;
CREATE POLICY payment_update ON public.payment
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND public.is_org_member(auth.uid(), org_id)
  ) WITH CHECK (
    auth.uid() IS NOT NULL AND public.is_org_member(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS payment_delete ON public.payment;
CREATE POLICY payment_delete ON public.payment
  FOR DELETE USING (
    auth.uid() IS NOT NULL AND public.is_org_member(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS payment_service_role_all ON public.payment;
CREATE POLICY payment_service_role_all ON public.payment
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- manual_payment_events: immutable manual lifecycle events
CREATE TABLE IF NOT EXISTS public.manual_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  payment_intent_id uuid,
  payment_id uuid,
  raw_event_type text NOT NULL,
  normalized_event_type text,
  event_data jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT manual_payment_events_intent_fk FOREIGN KEY (org_id, payment_intent_id) REFERENCES public.payment_intent(org_id, id) ON DELETE SET NULL,
  CONSTRAINT manual_payment_events_payment_fk FOREIGN KEY (org_id, payment_id) REFERENCES public.payment(org_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS manual_payment_events_org_intent_idx ON public.manual_payment_events(org_id, payment_intent_id);
CREATE INDEX IF NOT EXISTS manual_payment_events_org_payment_idx ON public.manual_payment_events(org_id, payment_id);

COMMENT ON TABLE public.manual_payment_events IS 'Manual lifecycle events (returns, chargebacks, reversals) kept separate from external webhook log.';
COMMENT ON COLUMN public.manual_payment_events.raw_event_type IS 'Raw event type, e.g., return.nsf, chargeback.initiated.';
COMMENT ON COLUMN public.manual_payment_events.normalized_event_type IS 'Normalized/manual-friendly event type.';

ALTER TABLE public.manual_payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS manual_payment_events_select ON public.manual_payment_events;
CREATE POLICY manual_payment_events_select ON public.manual_payment_events
  FOR SELECT USING (public.is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS manual_payment_events_insert ON public.manual_payment_events;
CREATE POLICY manual_payment_events_insert ON public.manual_payment_events
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND public.is_org_member(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS manual_payment_events_update ON public.manual_payment_events;
CREATE POLICY manual_payment_events_update ON public.manual_payment_events
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND public.is_org_member(auth.uid(), org_id)
  ) WITH CHECK (
    auth.uid() IS NOT NULL AND public.is_org_member(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS manual_payment_events_delete ON public.manual_payment_events;
CREATE POLICY manual_payment_events_delete ON public.manual_payment_events
  FOR DELETE USING (
    auth.uid() IS NOT NULL AND public.is_org_member(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS manual_payment_events_service_role_all ON public.manual_payment_events;
CREATE POLICY manual_payment_events_service_role_all ON public.manual_payment_events
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Unified payment events view (Buildium webhook log + manual events)
CREATE OR REPLACE VIEW public.payment_events AS
SELECT
  'buildium'::text AS provider,
  bwe.org_id,
  bwe.id AS source_event_id,
  NULL::uuid AS payment_intent_id,
  NULL::uuid AS payment_id,
  bwe.event_name AS raw_event_type,
  COALESCE(bwe.event_name, bwe.event_type) AS normalized_event_type,
  COALESCE(
    bwe.event_data->'Data'->'PaymentDetail'->'InternalTransactionStatus'->>'ResultCode',
    bwe.event_data->'InternalTransactionStatus'->>'ResultCode',
    bwe.event_data->>'InternalTransactionResultCode',
    bwe.event_data->'Data'->>'InternalTransactionResultCode'
  ) AS raw_result_code,
  bfc.normalized_code AS normalized_result_code,
  COALESCE(bwe.event_data, bwe.payload) AS event_data,
  bwe.event_created_at AS occurred_at,
  bwe.created_at
FROM public.buildium_webhook_events bwe
LEFT JOIN public.buildium_failure_codes bfc
  ON bfc.raw_code = COALESCE(
    bwe.event_data->'Data'->'PaymentDetail'->'InternalTransactionStatus'->>'ResultCode',
    bwe.event_data->'InternalTransactionStatus'->>'ResultCode',
    bwe.event_data->>'InternalTransactionResultCode',
    bwe.event_data->'Data'->>'InternalTransactionResultCode'
  )
UNION ALL
SELECT
  'manual'::text AS provider,
  mpe.org_id,
  mpe.id AS source_event_id,
  mpe.payment_intent_id,
  mpe.payment_id,
  mpe.raw_event_type,
  COALESCE(mpe.normalized_event_type, mpe.raw_event_type) AS normalized_event_type,
  NULL::text AS raw_result_code,
  NULL::text AS normalized_result_code,
  mpe.event_data,
  mpe.occurred_at,
  mpe.created_at
FROM public.manual_payment_events mpe;

COMMENT ON VIEW public.payment_events IS 'Unified payment event log combining Buildium webhooks and manual lifecycle events.';

-- Derived payment lifecycle projection (normalized state + settlement timestamp)
CREATE OR REPLACE VIEW public.payment_lifecycle_projection AS
SELECT
  p.*,
  t.is_internal_transaction,
  t.internal_transaction_is_pending,
  t.internal_transaction_result_date,
  t.internal_transaction_result_code AS raw_result_code,
  bfc.normalized_code AS normalized_result_code,
  CASE
    WHEN t.internal_transaction_result_code IS NOT NULL THEN 'failed'
    WHEN COALESCE(t.is_internal_transaction, false) = TRUE AND COALESCE(t.internal_transaction_is_pending, false) = TRUE THEN 'pending'
    WHEN COALESCE(t.is_internal_transaction, false) = TRUE AND COALESCE(t.internal_transaction_is_pending, false) = FALSE THEN 'settled'
    WHEN COALESCE(t.is_internal_transaction, false) = FALSE THEN 'settled'
    ELSE 'submitted'
  END AS derived_normalized_state,
  CASE
    WHEN t.internal_transaction_result_code IS NOT NULL THEN NULL
    WHEN COALESCE(t.is_internal_transaction, false) = TRUE AND COALESCE(t.internal_transaction_is_pending, false) = FALSE
      THEN COALESCE(t.internal_transaction_result_date::timestamptz, t.created_at)
    WHEN COALESCE(t.is_internal_transaction, false) = FALSE
      THEN t.created_at
    ELSE NULL
  END AS derived_settled_at
FROM public.payment p
LEFT JOIN public.transactions t ON t.id = p.transaction_id
LEFT JOIN public.buildium_failure_codes bfc ON bfc.raw_code = t.internal_transaction_result_code;

COMMENT ON VIEW public.payment_lifecycle_projection IS 'Adds derived lifecycle state/settlement timestamps from transactions to payment rows.';

COMMIT;
