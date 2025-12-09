-- Implement previously stubbed webhook handler functions for Buildium events
-- Functions covered: lease payment, owner/property/unit updates, task status changes
-- The handlers prefer idempotent upserts keyed on Buildium IDs and will
-- raise when required identifiers are missing to surface actionable errors.

-- Helper: normalize boolean-ish text to boolean
CREATE OR REPLACE FUNCTION public._parse_bool(p_value text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_value IS NULL OR length(btrim(p_value)) = 0 THEN
    RETURN NULL;
  END IF;
  RETURN lower(p_value) IN ('true', 't', '1', 'yes', 'y', 'on');
END;
$$;

-- Helper: safe timestamp parsing
CREATE OR REPLACE FUNCTION public._parse_timestamptz(p_value text)
RETURNS timestamptz
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_value IS NULL OR length(btrim(p_value)) = 0 THEN
    RETURN NULL;
  END IF;
  RETURN p_value::timestamptz;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

-- Helper: safe date parsing
CREATE OR REPLACE FUNCTION public._parse_date(p_value text)
RETURNS date
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_value IS NULL OR length(btrim(p_value)) = 0 THEN
    RETURN NULL;
  END IF;
  RETURN p_value::date;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;


-- Lease payment webhook -> transactions (idempotent on buildium_transaction_id)
CREATE OR REPLACE FUNCTION public.handle_lease_payment_webhook(event_data jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment_id integer;
  v_buildium_lease_id integer;
  v_local_lease_id bigint;
  v_amount numeric;
  v_payment_date date;
  v_tenant_id integer;
  v_org_id uuid;
  v_payment_method text;
  v_now timestamptz := now();
BEGIN
  v_payment_id := COALESCE(
    NULLIF(event_data->>'paymentId', '')::integer,
    NULLIF(event_data->>'PaymentId', '')::integer,
    NULLIF(event_data->>'transactionId', '')::integer,
    NULLIF(event_data->>'TransactionId', '')::integer,
    NULLIF(event_data->>'id', '')::integer,
    NULLIF(event_data->>'eventId', '')::integer
  );
  IF v_payment_id IS NULL THEN
    RAISE EXCEPTION 'lease payment webhook missing payment identifier';
  END IF;

  v_buildium_lease_id := COALESCE(
    NULLIF(event_data->>'leaseId', '')::integer,
    NULLIF(event_data->>'LeaseId', '')::integer
  );
  v_amount := COALESCE(
    NULLIF(event_data->>'paymentAmount', '')::numeric,
    NULLIF(event_data->>'PaymentAmount', '')::numeric,
    NULLIF(event_data->>'amount', '')::numeric,
    NULLIF(event_data#>>'{data,amount}', '')::numeric
  );
  IF v_amount IS NULL THEN
    RAISE EXCEPTION 'lease payment webhook missing amount for payment %', v_payment_id;
  END IF;

  v_payment_date := COALESCE(
    public._parse_date(event_data->>'paymentDate'),
    public._parse_date(event_data->>'PaymentDate'),
    public._parse_date(event_data->>'date'),
    public._parse_timestamptz(event_data->>'timestamp')::date
  );
  IF v_payment_date IS NULL THEN
    v_payment_date := CURRENT_DATE;
  END IF;

  v_tenant_id := COALESCE(
    NULLIF(event_data->>'tenantId', '')::integer,
    NULLIF(event_data->>'TenantId', '')::integer
  );

  IF v_buildium_lease_id IS NOT NULL THEN
    SELECT l.id, l.org_id INTO v_local_lease_id, v_org_id
    FROM lease l
    WHERE l.buildium_lease_id = v_buildium_lease_id
    LIMIT 1;
  END IF;

  v_payment_method := COALESCE(event_data->>'paymentMethod', event_data->>'PaymentMethod');
  IF v_payment_method IS NOT NULL THEN
    v_payment_method := initcap(replace(v_payment_method, '_', ''));
  END IF;

  INSERT INTO transactions (
    buildium_transaction_id,
    buildium_lease_id,
    lease_id,
    date,
    paid_date,
    total_amount,
    transaction_type,
    status,
    payee_tenant_id,
    memo,
    payment_method,
    org_id,
    email_receipt,
    print_receipt,
    updated_at,
    created_at
  ) VALUES (
    v_payment_id,
    v_buildium_lease_id,
    v_local_lease_id,
    v_payment_date,
    v_payment_date,
    v_amount,
    'Payment'::public.transaction_type_enum,
    'Paid'::public.transaction_status_enum,
    v_tenant_id,
    event_data->>'memo',
    CASE
      WHEN v_payment_method IN ('Check', 'Cash', 'MoneyOrder', 'CashierCheck', 'DirectDeposit', 'CreditCard', 'ElectronicPayment') THEN v_payment_method::public.payment_method_enum
      ELSE NULL
    END,
    v_org_id,
    COALESCE((event_data->>'emailReceipt')::boolean, false),
    COALESCE((event_data->>'printReceipt')::boolean, false),
    v_now,
    v_now
  )
  ON CONFLICT (buildium_transaction_id) DO UPDATE SET
    buildium_lease_id = EXCLUDED.buildium_lease_id,
    lease_id = COALESCE(EXCLUDED.lease_id, transactions.lease_id),
    date = EXCLUDED.date,
    paid_date = EXCLUDED.paid_date,
    total_amount = EXCLUDED.total_amount,
    transaction_type = EXCLUDED.transaction_type,
    status = EXCLUDED.status,
    payee_tenant_id = COALESCE(EXCLUDED.payee_tenant_id, transactions.payee_tenant_id),
    memo = COALESCE(EXCLUDED.memo, transactions.memo),
    payment_method = COALESCE(EXCLUDED.payment_method, transactions.payment_method),
    org_id = COALESCE(EXCLUDED.org_id, transactions.org_id),
    email_receipt = COALESCE(EXCLUDED.email_receipt, transactions.email_receipt),
    print_receipt = COALESCE(EXCLUDED.print_receipt, transactions.print_receipt),
    updated_at = EXCLUDED.updated_at;
END;
$$;


-- Owner update webhook -> owners (+contact patch when present)
CREATE OR REPLACE FUNCTION public.handle_owner_webhook_update(event_data jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_buildium_owner_id integer;
  v_owner_id uuid;
  v_contact_id bigint;
  v_now timestamptz := now();
  v_is_active boolean;
BEGIN
  v_buildium_owner_id := COALESCE(
    NULLIF(event_data->>'ownerId', '')::integer,
    NULLIF(event_data->>'OwnerId', '')::integer,
    NULLIF(event_data->>'id', '')::integer,
    NULLIF(event_data#>>'{Owner,Id}', '')::integer
  );
  IF v_buildium_owner_id IS NULL THEN
    RAISE EXCEPTION 'owner webhook missing OwnerId';
  END IF;

  SELECT o.id, o.contact_id INTO v_owner_id, v_contact_id
  FROM owners o
  WHERE o.buildium_owner_id = v_buildium_owner_id
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'owner with Buildium id % not found', v_buildium_owner_id;
  END IF;

  v_is_active := CASE
    WHEN event_data ? 'isActive' THEN public._parse_bool(event_data->>'isActive')
    WHEN event_data ? 'is_active' THEN public._parse_bool(event_data->>'is_active')
    ELSE NULL
  END;

  UPDATE owners
  SET
    management_agreement_start_date = COALESCE(public._parse_date(event_data->>'managementAgreementStartDate'), management_agreement_start_date),
    management_agreement_end_date = COALESCE(public._parse_date(event_data->>'managementAgreementEndDate'), management_agreement_end_date),
    tax_payer_name1 = COALESCE(NULLIF(event_data#>>'{tax,primaryName}', ''), tax_payer_name1),
    tax_payer_name2 = COALESCE(NULLIF(event_data#>>'{tax,secondaryName}', ''), tax_payer_name2),
    tax_payer_id = COALESCE(NULLIF(event_data#>>'{tax,taxPayerId}', ''), tax_payer_id),
    tax_include1099 = COALESCE(public._parse_bool(event_data#>>'{tax,include1099}'), tax_include1099),
    tax_address_line1 = COALESCE(NULLIF(event_data#>>'{tax,address,AddressLine1}', ''), tax_address_line1),
    tax_address_line2 = COALESCE(NULLIF(event_data#>>'{tax,address,AddressLine2}', ''), tax_address_line2),
    tax_address_line3 = COALESCE(NULLIF(event_data#>>'{tax,address,AddressLine3}', ''), tax_address_line3),
    tax_city = COALESCE(NULLIF(event_data#>>'{tax,address,City}', ''), tax_city),
    tax_state = COALESCE(NULLIF(event_data#>>'{tax,address,State}', ''), tax_state),
    tax_postal_code = COALESCE(NULLIF(event_data#>>'{tax,address,PostalCode}', ''), tax_postal_code),
    tax_country = COALESCE(NULLIF(event_data#>>'{tax,address,Country}', ''), tax_country),
    is_active = COALESCE(v_is_active, is_active),
    buildium_updated_at = COALESCE(
      public._parse_timestamptz(event_data->>'updatedAt'),
      public._parse_timestamptz(event_data->>'ModifiedDate'),
      buildium_updated_at
    ),
    updated_at = v_now
  WHERE owners.id = v_owner_id;

  IF v_contact_id IS NOT NULL THEN
    UPDATE contacts
    SET
      primary_email = COALESCE(NULLIF(event_data->>'email', ''), primary_email),
      alt_email = COALESCE(NULLIF(event_data->>'alternateEmail', ''), alt_email),
      primary_phone = COALESCE(
        NULLIF(event_data#>>'{phoneNumbers,Mobile}', ''),
        NULLIF(event_data#>>'{phoneNumbers,Home}', ''),
        NULLIF(event_data#>>'{phoneNumbers,Work}', ''),
        primary_phone
      ),
      alt_phone = COALESCE(
        NULLIF(event_data#>>'{phoneNumbers,Work}', ''),
        NULLIF(event_data#>>'{phoneNumbers,Home}', ''),
        alt_phone
      ),
      first_name = COALESCE(NULLIF(event_data->>'firstName', ''), first_name),
      last_name = COALESCE(NULLIF(event_data->>'lastName', ''), last_name),
      company_name = COALESCE(NULLIF(event_data->>'companyName', ''), company_name),
      updated_at = v_now
    WHERE id = v_contact_id;
  END IF;
END;
$$;


-- Property update webhook -> properties
CREATE OR REPLACE FUNCTION public.handle_property_webhook_update(event_data jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_buildium_property_id integer;
  v_property_id uuid;
  v_now timestamptz := now();
  v_is_active boolean;
  v_status public.property_status;
  v_country public.countries;
  v_country_text text;
BEGIN
  v_buildium_property_id := COALESCE(
    NULLIF(event_data->>'propertyId', '')::integer,
    NULLIF(event_data->>'PropertyId', '')::integer,
    NULLIF(event_data->>'id', '')::integer,
    NULLIF(event_data#>>'{Property,Id}', '')::integer
  );
  IF v_buildium_property_id IS NULL THEN
    RAISE EXCEPTION 'property webhook missing PropertyId';
  END IF;

  SELECT p.id INTO v_property_id
  FROM properties p
  WHERE p.buildium_property_id = v_buildium_property_id
  LIMIT 1;

  IF v_property_id IS NULL THEN
    RAISE EXCEPTION 'property with Buildium id % not found', v_buildium_property_id;
  END IF;

  v_is_active := CASE
    WHEN event_data ? 'isActive' THEN public._parse_bool(event_data->>'isActive')
    WHEN event_data ? 'is_active' THEN public._parse_bool(event_data->>'is_active')
    ELSE NULL
  END;

  v_status := CASE
    WHEN lower(COALESCE(event_data->>'status', event_data->>'Status', '')) = 'inactive' THEN 'Inactive'::public.property_status
    WHEN event_data ? 'status' OR event_data ? 'Status' THEN 'Active'::public.property_status
    ELSE NULL
  END;

  v_country_text := COALESCE(
    NULLIF(event_data#>>'{address,Country}', ''),
    NULLIF(event_data#>>'{Address,Country}', ''),
    NULLIF(event_data->>'country', '')
  );
  IF v_country_text IS NOT NULL THEN
    BEGIN
      v_country := v_country_text::public.countries;
    EXCEPTION WHEN others THEN
      v_country := NULL;
    END;
  END IF;

  UPDATE properties
  SET
    name = COALESCE(NULLIF(event_data->>'name', ''), NULLIF(event_data#>>'{Name}', ''), name),
    address_line1 = COALESCE(
      NULLIF(event_data#>>'{address,AddressLine1}', ''),
      NULLIF(event_data#>>'{Address,AddressLine1}', ''),
      NULLIF(event_data->>'address_line1', ''),
      address_line1
    ),
    address_line2 = COALESCE(
      NULLIF(event_data#>>'{address,AddressLine2}', ''),
      NULLIF(event_data#>>'{Address,AddressLine2}', ''),
      NULLIF(event_data->>'address_line2', ''),
      address_line2
    ),
    address_line3 = COALESCE(
      NULLIF(event_data#>>'{address,AddressLine3}', ''),
      NULLIF(event_data#>>'{Address,AddressLine3}', ''),
      NULLIF(event_data->>'address_line3', ''),
      address_line3
    ),
    city = COALESCE(
      NULLIF(event_data#>>'{address,City}', ''),
      NULLIF(event_data#>>'{Address,City}', ''),
      NULLIF(event_data->>'city', ''),
      city
    ),
    state = COALESCE(
      NULLIF(event_data#>>'{address,State}', ''),
      NULLIF(event_data#>>'{Address,State}', ''),
      NULLIF(event_data->>'state', ''),
      state
    ),
    postal_code = COALESCE(
      NULLIF(event_data#>>'{address,PostalCode}', ''),
      NULLIF(event_data#>>'{Address,PostalCode}', ''),
      NULLIF(event_data->>'postal_code', ''),
      postal_code
    ),
    country = COALESCE(v_country, country),
    status = COALESCE(v_status, status),
    is_active = COALESCE(v_is_active, is_active),
    buildium_property_id = v_buildium_property_id,
    buildium_updated_at = COALESCE(
      public._parse_timestamptz(event_data->>'ModifiedDate'),
      public._parse_timestamptz(event_data->>'updatedAt'),
      buildium_updated_at
    ),
    updated_at = v_now
  WHERE id = v_property_id;
END;
$$;


-- Task status change webhook -> tasks
CREATE OR REPLACE FUNCTION public.handle_task_status_webhook(event_data jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_buildium_task_id integer;
  v_task_id uuid;
  v_status text;
  v_completed_at timestamptz;
  v_now timestamptz := now();
BEGIN
  v_buildium_task_id := COALESCE(
    NULLIF(event_data->>'taskId', '')::integer,
    NULLIF(event_data->>'TaskId', '')::integer,
    NULLIF(event_data->>'id', '')::integer,
    NULLIF(event_data#>>'{Task,Id}', '')::integer
  );
  IF v_buildium_task_id IS NULL THEN
    RAISE EXCEPTION 'task status webhook missing TaskId';
  END IF;

  SELECT t.id INTO v_task_id
  FROM tasks t
  WHERE t.buildium_task_id = v_buildium_task_id
  LIMIT 1;

  IF v_task_id IS NULL THEN
    RAISE EXCEPTION 'task with Buildium id % not found', v_buildium_task_id;
  END IF;

  v_status := COALESCE(
    NULLIF(event_data->>'status', ''),
    NULLIF(event_data->>'Status', ''),
    NULLIF(event_data#>>'{Task,Status}', '')
  );
  v_completed_at := COALESCE(
    public._parse_timestamptz(event_data->>'completedAt'),
    public._parse_timestamptz(event_data->>'CompletedDate'),
    public._parse_timestamptz(event_data#>>'{Task,CompletedDate}')
  );

  IF v_status IS NOT NULL AND lower(v_status) IN ('completed', 'done', 'closed') AND v_completed_at IS NULL THEN
    v_completed_at := v_now;
  END IF;

  UPDATE tasks
  SET
    status = COALESCE(v_status, status),
    completed_date = COALESCE(v_completed_at, completed_date),
    updated_at = v_now
  WHERE id = v_task_id;
END;
$$;


-- Unit update webhook -> units (requires property lookup)
CREATE OR REPLACE FUNCTION public.handle_unit_webhook_update(event_data jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_buildium_unit_id integer;
  v_unit_id uuid;
  v_buildium_property_id integer;
  v_property_id uuid;
  v_now timestamptz := now();
  v_is_active boolean;
  v_status public.unit_status_enum;
BEGIN
  v_buildium_unit_id := COALESCE(
    NULLIF(event_data->>'unitId', '')::integer,
    NULLIF(event_data->>'UnitId', '')::integer,
    NULLIF(event_data->>'id', '')::integer,
    NULLIF(event_data#>>'{Unit,Id}', '')::integer
  );
  IF v_buildium_unit_id IS NULL THEN
    RAISE EXCEPTION 'unit webhook missing UnitId';
  END IF;

  v_buildium_property_id := COALESCE(
    NULLIF(event_data->>'propertyId', '')::integer,
    NULLIF(event_data->>'PropertyId', '')::integer,
    NULLIF(event_data#>>'{Property,Id}', '')::integer
  );

  SELECT u.id, u.property_id INTO v_unit_id, v_property_id
  FROM units u
  WHERE u.buildium_unit_id = v_buildium_unit_id
  LIMIT 1;

  IF v_unit_id IS NULL THEN
    RAISE EXCEPTION 'unit with Buildium id % not found', v_buildium_unit_id;
  END IF;

  IF v_buildium_property_id IS NOT NULL THEN
    SELECT p.id INTO v_property_id
    FROM properties p
    WHERE p.buildium_property_id = v_buildium_property_id
    LIMIT 1;

    IF v_property_id IS NULL THEN
      RAISE EXCEPTION 'property % referenced by unit % not found', v_buildium_property_id, v_buildium_unit_id;
    END IF;
  END IF;

  v_is_active := CASE
    WHEN event_data ? 'isActive' THEN public._parse_bool(event_data->>'isActive')
    WHEN event_data ? 'is_active' THEN public._parse_bool(event_data->>'is_active')
    ELSE NULL
  END;

  v_status := CASE
    WHEN lower(COALESCE(event_data->>'status', event_data->>'Status', '')) = 'inactive' THEN 'Inactive'::public.unit_status_enum
    WHEN lower(COALESCE(event_data->>'status', event_data->>'Status', '')) = 'occupied' THEN 'Occupied'::public.unit_status_enum
    WHEN event_data ? 'status' OR event_data ? 'Status' THEN 'Vacant'::public.unit_status_enum
    ELSE NULL
  END;

  UPDATE units
  SET
    unit_number = COALESCE(NULLIF(event_data->>'unitNumber', ''), NULLIF(event_data#>>'{UnitNumber}', ''), unit_number),
    unit_size = COALESCE(NULLIF(event_data->>'unitSize', '')::integer, unit_size),
    market_rent = COALESCE(NULLIF(event_data->>'marketRent', '')::numeric, market_rent),
    description = COALESCE(NULLIF(event_data->>'description', ''), description),
    address_line1 = COALESCE(
      NULLIF(event_data#>>'{address,AddressLine1}', ''),
      NULLIF(event_data#>>'{Address,AddressLine1}', ''),
      NULLIF(event_data->>'address_line1', ''),
      address_line1
    ),
    address_line2 = COALESCE(
      NULLIF(event_data#>>'{address,AddressLine2}', ''),
      NULLIF(event_data#>>'{Address,AddressLine2}', ''),
      NULLIF(event_data->>'address_line2', ''),
      address_line2
    ),
    address_line3 = COALESCE(
      NULLIF(event_data#>>'{address,AddressLine3}', ''),
      NULLIF(event_data#>>'{Address,AddressLine3}', ''),
      NULLIF(event_data->>'address_line3', ''),
      address_line3
    ),
    city = COALESCE(
      NULLIF(event_data#>>'{address,City}', ''),
      NULLIF(event_data#>>'{Address,City}', ''),
      NULLIF(event_data->>'city', ''),
      city
    ),
    state = COALESCE(
      NULLIF(event_data#>>'{address,State}', ''),
      NULLIF(event_data#>>'{Address,State}', ''),
      NULLIF(event_data->>'state', ''),
      state
    ),
    postal_code = COALESCE(
      NULLIF(event_data#>>'{address,PostalCode}', ''),
      NULLIF(event_data#>>'{Address,PostalCode}', ''),
      NULLIF(event_data->>'postal_code', ''),
      postal_code
    ),
    buildium_unit_id = v_buildium_unit_id,
    buildium_property_id = COALESCE(v_buildium_property_id, buildium_property_id),
    property_id = COALESCE(v_property_id, property_id),
    status = COALESCE(v_status, status),
    is_active = COALESCE(v_is_active, is_active),
    buildium_updated_at = COALESCE(
      public._parse_timestamptz(event_data->>'ModifiedDate'),
      public._parse_timestamptz(event_data->>'updatedAt'),
      buildium_updated_at
    ),
    updated_at = v_now
  WHERE id = v_unit_id;
END;
$$;
