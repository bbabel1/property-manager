

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "hypopg" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "index_advisor" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."FeeFrequency" AS ENUM (
    'Monthly',
    'Annually'
);


ALTER TYPE "public"."FeeFrequency" OWNER TO "postgres";


CREATE TYPE "public"."FeeType" AS ENUM (
    'Percentage',
    'Flat Rate'
);


ALTER TYPE "public"."FeeType" OWNER TO "postgres";


CREATE TYPE "public"."ServicePlan" AS ENUM (
    'Full',
    'Basic',
    'A-la-carte'
);


ALTER TYPE "public"."ServicePlan" OWNER TO "postgres";


CREATE TYPE "public"."appliance_service_type_enum" AS ENUM (
    'Maintenance',
    'Repair',
    'Replacement',
    'Installation',
    'Inspection',
    'Other'
);


ALTER TYPE "public"."appliance_service_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."appliance_type_enum" AS ENUM (
    'Refrigerator',
    'Freezer',
    'Stove',
    'Microwave',
    'Dishwasher',
    'Washer/Dryer'
);


ALTER TYPE "public"."appliance_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."bank_account_type_enum" AS ENUM (
    'checking',
    'savings',
    'money_market',
    'certificate_of_deposit'
);


ALTER TYPE "public"."bank_account_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."bathroom_enum" AS ENUM (
    '1',
    '1.5',
    '2',
    '2.5',
    '3',
    '3.5',
    '4+',
    '4.5',
    '5',
    '5+'
);


ALTER TYPE "public"."bathroom_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."bathroom_enum" IS 'Enumeration of bathroom counts for rental units (1-5, 1.5-4.5, 5+)';



CREATE TYPE "public"."bedroom_enum" AS ENUM (
    'Studio',
    '1',
    '2',
    '3',
    '4',
    '5+',
    '6',
    '7',
    '8',
    '9+'
);


ALTER TYPE "public"."bedroom_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."bedroom_enum" IS 'Enumeration of bedroom counts for rental units (Studio, 1-8, 9+)';



CREATE TYPE "public"."buildium_bank_account_type" AS ENUM (
    'Checking',
    'Savings',
    'MoneyMarket',
    'CertificateOfDeposit'
);


ALTER TYPE "public"."buildium_bank_account_type" OWNER TO "postgres";


COMMENT ON TYPE "public"."buildium_bank_account_type" IS 'Buildium bank account types';



CREATE TYPE "public"."buildium_bill_status" AS ENUM (
    'Pending',
    'Paid',
    'Overdue',
    'Cancelled',
    'PartiallyPaid'
);


ALTER TYPE "public"."buildium_bill_status" OWNER TO "postgres";


COMMENT ON TYPE "public"."buildium_bill_status" IS 'Buildium bill status values';



CREATE TYPE "public"."buildium_lease_contact_role" AS ENUM (
    'Tenant',
    'Cosigner',
    'Guarantor'
);


ALTER TYPE "public"."buildium_lease_contact_role" OWNER TO "postgres";


COMMENT ON TYPE "public"."buildium_lease_contact_role" IS 'Buildium lease contact roles';



CREATE TYPE "public"."buildium_lease_status" AS ENUM (
    'Future',
    'Active',
    'Past',
    'Cancelled'
);


ALTER TYPE "public"."buildium_lease_status" OWNER TO "postgres";


COMMENT ON TYPE "public"."buildium_lease_status" IS 'Buildium lease status values';



CREATE TYPE "public"."buildium_payment_method" AS ENUM (
    'Check',
    'Cash',
    'CreditCard',
    'BankTransfer',
    'OnlinePayment'
);


ALTER TYPE "public"."buildium_payment_method" OWNER TO "postgres";


COMMENT ON TYPE "public"."buildium_payment_method" IS 'Buildium payment method types';



CREATE TYPE "public"."buildium_property_type" AS ENUM (
    'Rental',
    'Association',
    'Commercial'
);


ALTER TYPE "public"."buildium_property_type" OWNER TO "postgres";


COMMENT ON TYPE "public"."buildium_property_type" IS 'Buildium property types for API integration';



CREATE TYPE "public"."buildium_sync_status_type" AS ENUM (
    'pending',
    'syncing',
    'synced',
    'failed',
    'conflict'
);


ALTER TYPE "public"."buildium_sync_status_type" OWNER TO "postgres";


COMMENT ON TYPE "public"."buildium_sync_status_type" IS 'Buildium sync status values';



CREATE TYPE "public"."buildium_task_priority" AS ENUM (
    'Low',
    'Medium',
    'High',
    'Critical'
);


ALTER TYPE "public"."buildium_task_priority" OWNER TO "postgres";


COMMENT ON TYPE "public"."buildium_task_priority" IS 'Buildium task priority levels';



CREATE TYPE "public"."buildium_task_status" AS ENUM (
    'Open',
    'InProgress',
    'Completed',
    'Cancelled',
    'OnHold'
);


ALTER TYPE "public"."buildium_task_status" OWNER TO "postgres";


COMMENT ON TYPE "public"."buildium_task_status" IS 'Buildium task status values';



CREATE TYPE "public"."buildium_unit_type" AS ENUM (
    'Apartment',
    'Condo',
    'House',
    'Townhouse',
    'Office',
    'Retail',
    'Warehouse',
    'Other'
);


ALTER TYPE "public"."buildium_unit_type" OWNER TO "postgres";


COMMENT ON TYPE "public"."buildium_unit_type" IS 'Buildium unit types for API integration';



CREATE TYPE "public"."buildium_vendor_category" AS ENUM (
    'Contractor',
    'Maintenance',
    'Utilities',
    'Insurance',
    'Legal',
    'Accounting',
    'Marketing',
    'Other'
);


ALTER TYPE "public"."buildium_vendor_category" OWNER TO "postgres";


COMMENT ON TYPE "public"."buildium_vendor_category" IS 'Buildium vendor category types';



CREATE TYPE "public"."buildium_webhook_event_type" AS ENUM (
    'PropertyCreated',
    'PropertyUpdated',
    'PropertyDeleted',
    'UnitCreated',
    'UnitUpdated',
    'UnitDeleted',
    'OwnerCreated',
    'OwnerUpdated',
    'OwnerDeleted',
    'LeaseCreated',
    'LeaseUpdated',
    'LeaseDeleted',
    'BillCreated',
    'BillUpdated',
    'BillPaid',
    'TaskCreated',
    'TaskUpdated',
    'TaskCompleted'
);


ALTER TYPE "public"."buildium_webhook_event_type" OWNER TO "postgres";


COMMENT ON TYPE "public"."buildium_webhook_event_type" IS 'Buildium webhook event types';



CREATE TYPE "public"."countries" AS ENUM (
    'Afghanistan',
    'Albania',
    'Algeria',
    'Andorra',
    'Angola',
    'Antigua and Barbuda',
    'Argentina',
    'Armenia',
    'Australia',
    'Austria',
    'Azerbaijan',
    'Bahamas',
    'Bahrain',
    'Bangladesh',
    'Barbados',
    'Belarus',
    'Belgium',
    'Belize',
    'Benin',
    'Bhutan',
    'Bolivia',
    'Bosnia and Herzegovina',
    'Botswana',
    'Brazil',
    'Brunei',
    'Bulgaria',
    'Burkina Faso',
    'Burundi',
    'Cambodia',
    'Cameroon',
    'Canada',
    'Cape Verde',
    'Central African Republic',
    'Chad',
    'Chile',
    'China',
    'Colombia',
    'Comoros',
    'Congo (Republic of the Congo)',
    'Costa Rica',
    'Croatia',
    'Cuba',
    'Cyprus',
    'Czech Republic (Czechia)',
    'Democratic Republic of the Congo',
    'Denmark',
    'Djibouti',
    'Dominica',
    'Dominican Republic',
    'East Timor (Timor-Leste)',
    'Ecuador',
    'Egypt',
    'El Salvador',
    'Equatorial Guinea',
    'Eritrea',
    'Estonia',
    'Eswatini',
    'Ethiopia',
    'Fiji',
    'Finland',
    'France',
    'Gabon',
    'Gambia',
    'Georgia',
    'Germany',
    'Ghana',
    'Greece',
    'Grenada',
    'Guatemala',
    'Guinea',
    'Guinea-Bissau',
    'Guyana',
    'Haiti',
    'Honduras',
    'Hungary',
    'Iceland',
    'India',
    'Indonesia',
    'Iran',
    'Iraq',
    'Ireland',
    'Israel',
    'Italy',
    'Ivory Coast (Côte d''Ivoire)',
    'Jamaica',
    'Japan',
    'Jordan',
    'Kazakhstan',
    'Kenya',
    'Kiribati',
    'Korea (North Korea)',
    'Korea (South Korea)',
    'Kosovo',
    'Kuwait',
    'Kyrgyzstan',
    'Laos',
    'Latvia',
    'Lebanon',
    'Lesotho',
    'Liberia',
    'Libya',
    'Liechtenstein',
    'Lithuania',
    'Luxembourg',
    'Madagascar',
    'Malawi',
    'Malaysia',
    'Maldives',
    'Mali',
    'Malta',
    'Marshall Islands',
    'Mauritania',
    'Mauritius',
    'Mexico',
    'Micronesia',
    'Moldova',
    'Monaco',
    'Mongolia',
    'Montenegro',
    'Morocco',
    'Mozambique',
    'Myanmar (Burma)',
    'Namibia',
    'Nauru',
    'Nepal',
    'Netherlands',
    'New Zealand',
    'Nicaragua',
    'Niger',
    'Nigeria',
    'North Macedonia',
    'Norway',
    'Oman',
    'Pakistan',
    'Palau',
    'Palestine',
    'Panama',
    'Papua New Guinea',
    'Paraguay',
    'Peru',
    'Philippines',
    'Poland',
    'Portugal',
    'Qatar',
    'Romania',
    'Russia',
    'Rwanda',
    'Saint Kitts and Nevis',
    'Saint Lucia',
    'Saint Vincent and the Grenadines',
    'Samoa',
    'San Marino',
    'São Tomé and Príncipe',
    'Saudi Arabia',
    'Senegal',
    'Serbia',
    'Seychelles',
    'Sierra Leone',
    'Singapore',
    'Slovakia',
    'Slovenia',
    'Solomon Islands',
    'Somalia',
    'South Africa',
    'South Sudan',
    'Spain',
    'Sri Lanka',
    'Sudan',
    'Suriname',
    'Sweden',
    'Switzerland',
    'Syria',
    'Taiwan',
    'Tajikistan',
    'Tanzania',
    'Thailand',
    'Togo',
    'Tonga',
    'Trinidad and Tobago',
    'Tunisia',
    'Turkey',
    'Turkmenistan',
    'Tuvalu',
    'Uganda',
    'Ukraine',
    'United Arab Emirates',
    'United Kingdom',
    'United States',
    'Uruguay',
    'Uzbekistan',
    'Vanuatu',
    'Vatican City (Holy See)',
    'Venezuela',
    'Vietnam',
    'Yemen',
    'Zambia',
    'Zimbabwe'
);


ALTER TYPE "public"."countries" OWNER TO "postgres";


COMMENT ON TYPE "public"."countries" IS 'Comprehensive list of all world countries for standardized country selection';



CREATE TYPE "public"."entity_type_enum" AS ENUM (
    'Rental',
    'Company'
);


ALTER TYPE "public"."entity_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."etf_account_type_enum" AS ENUM (
    'Checking',
    'Saving'
);


ALTER TYPE "public"."etf_account_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."inspection_status_enum" AS ENUM (
    'Scheduled',
    'Completed'
);


ALTER TYPE "public"."inspection_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."inspection_type_enum" AS ENUM (
    'Periodic',
    'Move-In',
    'Move-Out'
);


ALTER TYPE "public"."inspection_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."lease_contact_role_enum" AS ENUM (
    'Tenant',
    'Cosigner'
);


ALTER TYPE "public"."lease_contact_role_enum" OWNER TO "postgres";


CREATE TYPE "public"."lease_contact_status_enum" AS ENUM (
    'Future',
    'Active',
    'Past'
);


ALTER TYPE "public"."lease_contact_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."payment_method_enum" AS ENUM (
    'Check',
    'Cash',
    'MoneyOrder',
    'CashierCheck',
    'DirectDeposit',
    'CreditCard',
    'ElectronicPayment'
);


ALTER TYPE "public"."payment_method_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."payment_method_enum" IS 'Normalized payment methods for transactions';



CREATE TYPE "public"."property_status" AS ENUM (
    'Active',
    'Inactive'
);


ALTER TYPE "public"."property_status" OWNER TO "postgres";


COMMENT ON TYPE "public"."property_status" IS 'Status of a property: Active or Inactive';



CREATE TYPE "public"."property_type_enum" AS ENUM (
    'Condo',
    'Co-op',
    'Condop',
    'Rental Building',
    'Townhouse',
    'Mult-Family'
);


ALTER TYPE "public"."property_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."rent_cycle_enum" AS ENUM (
    'Monthly',
    'Weekly',
    'Every2Weeks',
    'Quarterly',
    'Yearly',
    'Every2Months',
    'Daily',
    'Every6Months'
);


ALTER TYPE "public"."rent_cycle_enum" OWNER TO "postgres";


CREATE TYPE "public"."sync_source_enum" AS ENUM (
    'local',
    'buildium'
);


ALTER TYPE "public"."sync_source_enum" OWNER TO "postgres";


CREATE TYPE "public"."task_kind_enum" AS ENUM (
    'owner',
    'resident',
    'contact',
    'todo',
    'other'
);


ALTER TYPE "public"."task_kind_enum" OWNER TO "postgres";


CREATE TYPE "public"."transaction_type_enum" AS ENUM (
    'Bill',
    'Charge',
    'Credit',
    'Payment',
    'JournalEntry'
);


ALTER TYPE "public"."transaction_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."unit_status_enum" AS ENUM (
    'Occupied',
    'Vacant',
    'Inactive'
);


ALTER TYPE "public"."unit_status_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_owner_total_properties"("owner_uuid" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM public.ownerships o
    JOIN public.properties p ON o.property_id = p.id
    WHERE o.owner_id = owner_uuid
    AND p.status != 'Inactive'
  );
END$$;


ALTER FUNCTION "public"."calculate_owner_total_properties"("owner_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_owner_total_units"("owner_uuid" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(p.total_units), 0)
    FROM public.ownerships o
    JOIN public.properties p ON o.property_id = p.id
    WHERE o.owner_id = owner_uuid
  );
END$$;


ALTER FUNCTION "public"."calculate_owner_total_units"("owner_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clear_expired_buildium_cache"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM buildium_api_cache WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."clear_expired_buildium_cache"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."clear_expired_buildium_cache"() IS 'Removes expired cache entries and returns count of deleted records';



CREATE OR REPLACE FUNCTION "public"."count_active_units_for_property"("property_uuid" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM public.units
    WHERE property_id = property_uuid
    AND status != 'Inactive'
  );
END$$;


ALTER FUNCTION "public"."count_active_units_for_property"("property_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_duplicate_buildium_ids"("table_name" "text", "buildium_field" "text") RETURNS TABLE("buildium_id" integer, "count" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY EXECUTE format('
    SELECT %I::INTEGER, COUNT(*)::BIGINT
    FROM %I
    WHERE %I IS NOT NULL
    GROUP BY %I
    HAVING COUNT(*) > 1
  ', buildium_field, table_name, buildium_field, buildium_field);
END;
$$;


ALTER FUNCTION "public"."find_duplicate_buildium_ids"("table_name" "text", "buildium_field" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_duplicate_ownerships"() RETURNS TABLE("owner_id" "uuid", "property_id" "uuid", "count" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT o.owner_id, o.property_id, COUNT(*)::BIGINT
  FROM ownerships o
  GROUP BY o.owner_id, o.property_id
  HAVING COUNT(*) > 1;
END;
$$;


ALTER FUNCTION "public"."find_duplicate_ownerships"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_duplicate_units"() RETURNS TABLE("property_id" "uuid", "unit_number" character varying, "count" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT u.property_id, u.unit_number, COUNT(*)::BIGINT
  FROM units u
  GROUP BY u.property_id, u.unit_number
  HAVING COUNT(*) > 1;
END;
$$;


ALTER FUNCTION "public"."find_duplicate_units"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_display_name"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.display_name := COALESCE(NULLIF(TRIM(NEW.first_name||' '||NEW.last_name),''), NEW.company_name);
  RETURN NEW;
END$$;


ALTER FUNCTION "public"."generate_display_name"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_display_name"("first_name" "text", "last_name" "text", "company_name" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN COALESCE(NULLIF(TRIM(first_name||' '||last_name),''), company_name);
END$$;


ALTER FUNCTION "public"."generate_display_name"("first_name" "text", "last_name" "text", "company_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_buildium_api_cache"("p_endpoint" character varying, "p_parameters" "jsonb" DEFAULT NULL::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_buildium_api_cache"("p_endpoint" character varying, "p_parameters" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_buildium_api_cache"("p_endpoint" character varying, "p_parameters" "jsonb") IS 'Retrieves cached API response for a given endpoint and parameters';



CREATE OR REPLACE FUNCTION "public"."gl_account_activity"("p_from" "date", "p_to" "date") RETURNS TABLE("gl_account_id" "uuid", "account_number" "text", "name" "text", "debits" numeric, "credits" numeric, "net_change" numeric)
    LANGUAGE "sql" STABLE
    AS $$
  SELECT 
    ga.id,
    ga.account_number,
    ga.name,
    COALESCE(SUM(CASE WHEN tl.posting_type = 'Debit' THEN tl.amount ELSE 0 END), 0)::numeric AS debits,
    COALESCE(SUM(CASE WHEN tl.posting_type = 'Credit' THEN tl.amount ELSE 0 END), 0)::numeric AS credits,
    (COALESCE(SUM(CASE WHEN tl.posting_type = 'Debit' THEN tl.amount ELSE 0 END), 0) -
     COALESCE(SUM(CASE WHEN tl.posting_type = 'Credit' THEN tl.amount ELSE 0 END), 0))::numeric AS net_change
  FROM public.gl_accounts ga
  LEFT JOIN public.transaction_lines tl 
    ON tl.gl_account_id = ga.id AND tl.date >= p_from AND tl.date <= p_to
  GROUP BY ga.id, ga.account_number, ga.name
  ORDER BY ga.account_number NULLS FIRST, ga.name;
$$;


ALTER FUNCTION "public"."gl_account_activity"("p_from" "date", "p_to" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gl_trial_balance_as_of"("p_as_of_date" "date") RETURNS TABLE("gl_account_id" "uuid", "buildium_gl_account_id" integer, "account_number" "text", "name" "text", "type" "text", "sub_type" "text", "debits" numeric, "credits" numeric, "balance" numeric)
    LANGUAGE "sql" STABLE
    AS $$
  SELECT 
    ga.id,
    ga.buildium_gl_account_id,
    ga.account_number,
    ga.name,
    ga.type,
    ga.sub_type,
    COALESCE(SUM(CASE WHEN tl.posting_type = 'Debit' THEN tl.amount ELSE 0 END), 0)::numeric AS debits,
    COALESCE(SUM(CASE WHEN tl.posting_type = 'Credit' THEN tl.amount ELSE 0 END), 0)::numeric AS credits,
    (COALESCE(SUM(CASE WHEN tl.posting_type = 'Debit' THEN tl.amount ELSE 0 END), 0) -
     COALESCE(SUM(CASE WHEN tl.posting_type = 'Credit' THEN tl.amount ELSE 0 END), 0))::numeric AS balance
  FROM public.gl_accounts ga
  LEFT JOIN public.transaction_lines tl 
    ON tl.gl_account_id = ga.id AND tl.date <= p_as_of_date
  GROUP BY ga.id, ga.buildium_gl_account_id, ga.account_number, ga.name, ga.type, ga.sub_type
  ORDER BY ga.account_number NULLS FIRST, ga.name;
$$;


ALTER FUNCTION "public"."gl_trial_balance_as_of"("p_as_of_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_lease_payment_webhook"("event_data" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- TODO: Implement lease payment webhook handling
  RAISE NOTICE 'Processing lease payment webhook: %', event_data;
END;
$$;


ALTER FUNCTION "public"."handle_lease_payment_webhook"("event_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_owner_webhook_update"("event_data" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- TODO: Implement owner webhook update handling
  RAISE NOTICE 'Processing owner webhook update: %', event_data;
END;
$$;


ALTER FUNCTION "public"."handle_owner_webhook_update"("event_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_property_webhook_update"("event_data" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- TODO: Implement property webhook update handling
  RAISE NOTICE 'Processing property webhook update: %', event_data;
END;
$$;


ALTER FUNCTION "public"."handle_property_webhook_update"("event_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_task_status_webhook"("event_data" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- TODO: Implement task status webhook handling
  RAISE NOTICE 'Processing task status webhook: %', event_data;
END;
$$;


ALTER FUNCTION "public"."handle_task_status_webhook"("event_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_unit_webhook_update"("event_data" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- TODO: Implement unit webhook update handling
  RAISE NOTICE 'Processing unit webhook update: %', event_data;
END;
$$;


ALTER FUNCTION "public"."handle_unit_webhook_update"("event_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_valid_country"("val" "text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v public.countries;
BEGIN
  IF val IS NULL THEN
    RETURN true;
  END IF;
  BEGIN
    v := val::public.countries;
    RETURN true;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;
END;
$$;


ALTER FUNCTION "public"."is_valid_country"("val" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_valid_country"("val" "public"."countries") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$ SELECT TRUE $$;


ALTER FUNCTION "public"."is_valid_country"("val" "public"."countries") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."map_bill_to_buildium"("p_bill_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  bill_record RECORD;
  buildium_data JSONB;
BEGIN
  SELECT * INTO bill_record FROM bills WHERE id = p_bill_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bill with ID % not found', p_bill_id;
  END IF;
  
  buildium_data := jsonb_build_object(
    'VendorId', bill_record.vendor_id,
    'PropertyId', bill_record.property_id,
    'UnitId', bill_record.unit_id,
    'Date', bill_record.date,
    'DueDate', bill_record.due_date,
    'Amount', bill_record.amount,
    'Description', bill_record.description,
    'ReferenceNumber', COALESCE(bill_record.reference_number, ''),
    'CategoryId', bill_record.category_id,
    'IsRecurring', COALESCE(bill_record.is_recurring, false),
    'RecurringSchedule', bill_record.recurring_schedule
  );
  
  RETURN buildium_data;
END;
$$;


ALTER FUNCTION "public"."map_bill_to_buildium"("p_bill_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."map_bill_to_buildium"("p_bill_id" "uuid") IS 'Maps a local bill record to Buildium API format';



CREATE OR REPLACE FUNCTION "public"."map_owner_to_buildium"("p_owner_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  owner_record RECORD;
  buildium_data JSONB;
BEGIN
  SELECT * INTO owner_record FROM owners WHERE id = p_owner_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Owner with ID % not found', p_owner_id;
  END IF;
  
  buildium_data := jsonb_build_object(
    'FirstName', COALESCE(owner_record.first_name, ''),
    'LastName', COALESCE(owner_record.last_name, ''),
    'Email', COALESCE(owner_record.email, ''),
    'PhoneNumber', COALESCE(owner_record.phone_home, owner_record.phone_mobile, ''),
    'Address', jsonb_build_object(
      'AddressLine1', owner_record.address_line1,
      'AddressLine2', COALESCE(owner_record.address_line2, ''),
      'City', COALESCE(owner_record.city, ''),
      'State', COALESCE(owner_record.state, ''),
      'PostalCode', owner_record.postal_code,
      'Country', COALESCE(owner_record.country, 'United States')
    ),
    'TaxId', COALESCE(owner_record.tax_id, ''),
    'IsActive', COALESCE(owner_record.is_active, true)
  );
  
  RETURN buildium_data;
END;
$$;


ALTER FUNCTION "public"."map_owner_to_buildium"("p_owner_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."map_owner_to_buildium"("p_owner_id" "uuid") IS 'Maps a local owner record to Buildium API format';



CREATE OR REPLACE FUNCTION "public"."map_property_to_buildium"("p_property_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  property_record RECORD;
  buildium_data JSONB;
BEGIN
  SELECT * INTO property_record FROM properties WHERE id = p_property_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property with ID % not found', p_property_id;
  END IF;
  
  buildium_data := jsonb_build_object(
    'Name', property_record.name,
    'Address', jsonb_build_object(
      'AddressLine1', property_record.address_line1,
      'AddressLine2', COALESCE(property_record.address_line2, ''),
      'City', COALESCE(property_record.city, ''),
      'State', COALESCE(property_record.state, ''),
      'PostalCode', property_record.postal_code,
      'Country', COALESCE(property_record.country, 'United States')
    ),
    'PropertyType', COALESCE(property_record.property_type, 'MultiFamilyTwoToFourUnits'),
    'YearBuilt', property_record.year_built,
    'SquareFootage', property_record.square_footage,
    'Bedrooms', property_record.bedrooms,
    'Bathrooms', property_record.bathrooms,
    'Description', COALESCE(property_record.structure_description, ''),
    'IsActive', COALESCE(property_record.is_active, true)
  );
  
  RETURN buildium_data;
END;
$$;


ALTER FUNCTION "public"."map_property_to_buildium"("p_property_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."map_property_to_buildium"("p_property_id" "uuid") IS 'Maps a local property record to Buildium API format';



CREATE OR REPLACE FUNCTION "public"."map_task_to_buildium"("p_task_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  task_record RECORD;
  buildium_data JSONB;
BEGIN
  SELECT * INTO task_record FROM tasks WHERE id = p_task_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task with ID % not found', p_task_id;
  END IF;
  
  buildium_data := jsonb_build_object(
    'PropertyId', task_record.property_id,
    'UnitId', task_record.unit_id,
    'Subject', task_record.subject,
    'Description', COALESCE(task_record.description, ''),
    'Priority', COALESCE(task_record.priority, 'medium'),
    'AssignedTo', COALESCE(task_record.assigned_to, ''),
    'EstimatedCost', task_record.estimated_cost,
    'ScheduledDate', task_record.scheduled_date,
    'Category', COALESCE(task_record.category, ''),
    'Notes', COALESCE(task_record.notes, '')
  );
  
  RETURN buildium_data;
END;
$$;


ALTER FUNCTION "public"."map_task_to_buildium"("p_task_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."map_task_to_buildium"("p_task_id" "uuid") IS 'Maps a local task record to Buildium API format';



CREATE OR REPLACE FUNCTION "public"."map_unit_to_buildium"("p_unit_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  unit_record RECORD;
  buildium_data JSONB;
BEGIN
  SELECT * INTO unit_record FROM units WHERE id = p_unit_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unit with ID % not found', p_unit_id;
  END IF;
  
  buildium_data := jsonb_build_object(
    'PropertyId', unit_record.property_id,
    'UnitNumber', unit_record.unit_number,
    'UnitType', COALESCE(unit_record.unit_type, 'Apartment'),
    'Bedrooms', unit_record.unit_bedrooms,
    'Bathrooms', unit_record.unit_bathrooms,
    'SquareFootage', unit_record.square_footage,
    'MarketRent', unit_record.market_rent,
    'Description', COALESCE(unit_record.description, ''),
    'IsActive', COALESCE(unit_record.is_active, true)
  );
  
  RETURN buildium_data;
END;
$$;


ALTER FUNCTION "public"."map_unit_to_buildium"("p_unit_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."map_unit_to_buildium"("p_unit_id" "uuid") IS 'Maps a local unit record to Buildium API format';



CREATE OR REPLACE FUNCTION "public"."map_vendor_to_buildium"("p_vendor_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  vendor_record RECORD;
  buildium_data JSONB;
BEGIN
  SELECT * INTO vendor_record FROM vendors WHERE id = p_vendor_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor with ID % not found', p_vendor_id;
  END IF;
  
  buildium_data := jsonb_build_object(
    'Name', vendor_record.name,
    'CategoryId', vendor_record.category_id,
    'ContactName', COALESCE(vendor_record.contact_name, ''),
    'Email', COALESCE(vendor_record.email, ''),
    'PhoneNumber', COALESCE(vendor_record.phone_number, ''),
    'Address', jsonb_build_object(
      'AddressLine1', COALESCE(vendor_record.address_line1, ''),
      'AddressLine2', COALESCE(vendor_record.address_line2, ''),
      'City', COALESCE(vendor_record.city, ''),
      'State', COALESCE(vendor_record.state, ''),
      'PostalCode', COALESCE(vendor_record.postal_code, ''),
      'Country', COALESCE(vendor_record.country, '')
    ),
    'TaxId', COALESCE(vendor_record.tax_id, ''),
    'Notes', COALESCE(vendor_record.notes, ''),
    'IsActive', COALESCE(vendor_record.is_active, true)
  );
  
  RETURN buildium_data;
END;
$$;


ALTER FUNCTION "public"."map_vendor_to_buildium"("p_vendor_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."map_vendor_to_buildium"("p_vendor_id" "uuid") IS 'Maps a local vendor record to Buildium API format';



CREATE OR REPLACE FUNCTION "public"."map_work_order_to_buildium"("p_work_order_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  work_order_record RECORD;
  buildium_data JSONB;
BEGIN
  SELECT * INTO work_order_record FROM work_orders WHERE id = p_work_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work order with ID % not found', p_work_order_id;
  END IF;
  
  buildium_data := jsonb_build_object(
    'PropertyId', work_order_record.property_id,
    'UnitId', work_order_record.unit_id,
    'Subject', work_order_record.subject,
    'Description', COALESCE(work_order_record.description, ''),
    'Priority', COALESCE(work_order_record.priority, 'medium'),
    'AssignedTo', COALESCE(work_order_record.assigned_to, ''),
    'EstimatedCost', work_order_record.estimated_cost,
    'ScheduledDate', work_order_record.scheduled_date,
    'Category', COALESCE(work_order_record.category, ''),
    'Notes', COALESCE(work_order_record.notes, '')
  );
  
  RETURN buildium_data;
END;
$$;


ALTER FUNCTION "public"."map_work_order_to_buildium"("p_work_order_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."map_work_order_to_buildium"("p_work_order_id" "uuid") IS 'Maps a local work order record to Buildium API format';



CREATE OR REPLACE FUNCTION "public"."normalize_country"("val" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v text;
BEGIN
  IF val IS NULL THEN RETURN NULL; END IF;
  v := trim(val);
  IF v = '' THEN RETURN NULL; END IF;
  -- lowercase, strip punctuation, collapse whitespace
  v := lower(v);
  v := regexp_replace(v, '[\.]', '', 'g');         -- remove dots
  v := regexp_replace(v, '[_-]', ' ', 'g');         -- underscores/hyphens to space
  v := regexp_replace(v, '\s+', ' ', 'g');         -- collapse spaces
  v := trim(v);

  -- canonical mappings
  IF v IN ('us','u s','usa','u s a','united states','united states of america','unitedstates') THEN
    RETURN 'United States';
  ELSIF v IN ('uk','u k','united kingdom','great britain') THEN
    RETURN 'United Kingdom';
  ELSIF v IN ('uae','u a e','united arab emirates') THEN
    RETURN 'United Arab Emirates';
  ELSIF v IN ('czech republic','czechia') THEN
    RETURN 'Czech Republic (Czechia)';
  ELSIF v IN ('ivory coast','cote divoire','cote d ivoire') THEN
    RETURN 'Ivory Coast (Côte d''Ivoire)';
  ELSIF v = 'north korea' THEN
    RETURN 'Korea (North Korea)';
  ELSIF v = 'south korea' THEN
    RETURN 'Korea (South Korea)';
  ELSIF v = 'macedonia' THEN
    RETURN 'North Macedonia';
  ELSIF v = 'burma' THEN
    RETURN 'Myanmar (Burma)';
  ELSIF v IN ('sao tome and principe','sao tome & principe') THEN
    RETURN 'São Tomé and Príncipe';
  ELSIF v = 'vatican city' THEN
    RETURN 'Vatican City (Holy See)';
  ELSIF v IN ('saint kitts and nevis','st kitts and nevis','st. kitts and nevis') THEN
    RETURN 'Saint Kitts and Nevis';
  ELSIF v IN ('saint lucia','st lucia','st. lucia') THEN
    RETURN 'Saint Lucia';
  ELSIF v IN ('saint vincent and the grenadines','st vincent and the grenadines','st. vincent and the grenadines') THEN
    RETURN 'Saint Vincent and the Grenadines';
  ELSIF v IN ('democratic republic of congo','congo drc','dr congo') THEN
    RETURN 'Democratic Republic of the Congo';
  ELSIF v IN ('republic of the congo','congo') THEN
    RETURN 'Congo (Republic of the Congo)';
  ELSE
    RETURN NULL;
  END IF;
END;
$$;


ALTER FUNCTION "public"."normalize_country"("val" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_buildium_webhook_event"("p_event_id" character varying, "p_event_type" character varying, "p_event_data" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."process_buildium_webhook_event"("p_event_id" character varying, "p_event_type" character varying, "p_event_data" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."process_buildium_webhook_event"("p_event_id" character varying, "p_event_type" character varying, "p_event_data" "jsonb") IS 'Processes a Buildium webhook event and updates local data accordingly';



CREATE OR REPLACE FUNCTION "public"."set_buildium_api_cache"("p_endpoint" character varying, "p_parameters" "jsonb", "p_response_data" "jsonb", "p_cache_duration_minutes" integer DEFAULT 60) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."set_buildium_api_cache"("p_endpoint" character varying, "p_parameters" "jsonb", "p_response_data" "jsonb", "p_cache_duration_minutes" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."set_buildium_api_cache"("p_endpoint" character varying, "p_parameters" "jsonb", "p_response_data" "jsonb", "p_cache_duration_minutes" integer) IS 'Caches API response for a given endpoint and parameters';



CREATE OR REPLACE FUNCTION "public"."set_buildium_property_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Auto-populate buildium_property_id from the related property
    -- when units table has buildium_property_id column
    -- and properties table has buildium_property_id column
    SELECT buildium_property_id INTO NEW.buildium_property_id
    FROM properties
    WHERE id = NEW.property_id;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_buildium_property_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_buildium_property_id"("p_entity_type" character varying, "p_entity_id" "uuid", "p_buildium_property_id" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE 
    v_search_path text;
BEGIN 
    -- Capture the current search path before modifying
    v_search_path := current_setting('search_path');
    
    -- Explicitly set a secure search path
    SET LOCAL search_path TO pg_catalog, public;
    
    UPDATE public.properties 
    SET buildium_property_id = p_buildium_property_id 
    WHERE id = p_entity_id 
      AND entity_type = p_entity_type;
    
    -- Restore the original search path
    SET LOCAL search_path TO v_search_path;
END;
$$;


ALTER FUNCTION "public"."set_buildium_property_id"("p_entity_type" character varying, "p_entity_id" "uuid", "p_buildium_property_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_contacts_to_olc"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.upsert_owners_list_cache(o.id)
  FROM public.owners o
  WHERE o.contact_id = NEW.id;
  RETURN NEW;
END$$;


ALTER FUNCTION "public"."trg_contacts_to_olc"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_contacts_to_poc"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.property_ownerships_cache t
     SET display_name  = COALESCE(NULLIF(TRIM(NEW.first_name||' '||NEW.last_name),''), NEW.company_name),
         primary_email = NEW.primary_email,
         updated_at = NOW()
  FROM public.owners o
  JOIN public.ownerships ow ON ow.owner_id = o.id
  WHERE o.contact_id = NEW.id
    AND t.ownership_id = ow.id;
  RETURN NEW;
END$$;


ALTER FUNCTION "public"."trg_contacts_to_poc"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_owners_to_cache"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.upsert_owners_list_cache(COALESCE(NEW.id, OLD.id));
  RETURN NEW;
END$$;


ALTER FUNCTION "public"."trg_owners_to_cache"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_ownerships_to_cache"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.upsert_property_ownerships_cache(COALESCE(NEW.id, OLD.id));
  RETURN NEW;
END$$;


ALTER FUNCTION "public"."trg_ownerships_to_cache"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_update_owner_total_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Do nothing for now - this prevents infinite recursion
  -- The ownership functionality will work without these calculations
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."trigger_update_owner_total_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_update_ownerships_from_properties"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Do nothing for now - this prevents infinite recursion
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_update_ownerships_from_properties"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_update_property_total_units"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Handle INSERT
  IF TG_OP = 'INSERT' THEN
    PERFORM public.update_property_total_units(NEW.property_id);
    RETURN NEW;
  END IF;
  
  -- Handle UPDATE
  IF TG_OP = 'UPDATE' THEN
    -- If property_id changed, update both old and new property
    IF OLD.property_id != NEW.property_id THEN
      PERFORM public.update_property_total_units(OLD.property_id);
      PERFORM public.update_property_total_units(NEW.property_id);
    ELSE
      -- If only status changed, update the property
      PERFORM public.update_property_total_units(NEW.property_id);
    END IF;
    RETURN NEW;
  END IF;
  
  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    PERFORM public.update_property_total_units(OLD.property_id);
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END$$;


ALTER FUNCTION "public"."trigger_update_property_total_units"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_update_property_unit_counts"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Handle INSERT
  IF TG_OP = 'INSERT' THEN
    PERFORM public.update_property_unit_counts(NEW.property_id);
    RETURN NEW;
  END IF;
  
  -- Handle UPDATE
  IF TG_OP = 'UPDATE' THEN
    -- Update counts for both old and new property_id (in case property changed)
    IF OLD.property_id != NEW.property_id THEN
      PERFORM public.update_property_unit_counts(OLD.property_id);
      PERFORM public.update_property_unit_counts(NEW.property_id);
    ELSE
      PERFORM public.update_property_unit_counts(NEW.property_id);
    END IF;
    RETURN NEW;
  END IF;
  
  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    PERFORM public.update_property_unit_counts(OLD.property_id);
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END$$;


ALTER FUNCTION "public"."trigger_update_property_unit_counts"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_update_property_unit_counts"() IS 'Trigger function to automatically update property unit counts when units are modified';



CREATE OR REPLACE FUNCTION "public"."update_all_owners_total_fields"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  owner_record RECORD;
BEGIN
  FOR owner_record IN SELECT DISTINCT owner_id FROM public.ownerships LOOP
    PERFORM public.update_owner_total_fields(owner_record.owner_id);
  END LOOP;
END$$;


ALTER FUNCTION "public"."update_all_owners_total_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_all_properties_total_units"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  property_record RECORD;
BEGIN
  FOR property_record IN SELECT id FROM public.properties LOOP
    PERFORM public.update_property_total_units(property_record.id);
  END LOOP;
END$$;


ALTER FUNCTION "public"."update_all_properties_total_units"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_buildium_sync_status"("p_entity_type" character varying, "p_entity_id" "uuid", "p_buildium_id" integer, "p_status" character varying, "p_error_message" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Set a strict, empty search path to prevent schema resolution surprises
    SET search_path = '';
    
    INSERT INTO public.buildium_sync_status (
        entity_type, entity_id, buildium_id, sync_status, error_message, last_synced_at, updated_at
    ) VALUES (
        p_entity_type, p_entity_id, p_buildium_id, p_status, p_error_message, 
        CASE WHEN p_status = 'synced' THEN now() ELSE NULL END, now()
    )
    ON CONFLICT (entity_type, entity_id) DO UPDATE SET
        buildium_id = EXCLUDED.buildium_id,
        sync_status = EXCLUDED.sync_status,
        error_message = EXCLUDED.error_message,
        last_synced_at = EXCLUDED.last_synced_at,
        updated_at = now();
END;
$$;


ALTER FUNCTION "public"."update_buildium_sync_status"("p_entity_type" character varying, "p_entity_id" "uuid", "p_buildium_id" integer, "p_status" character varying, "p_error_message" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_buildium_sync_status"("p_entity_type" character varying, "p_entity_id" "uuid", "p_buildium_id" integer, "p_status" character varying, "p_error_message" "text") IS 'Updates the sync status for a given entity with Buildium API';



CREATE OR REPLACE FUNCTION "public"."update_owner_total_fields"("owner_uuid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.ownerships
  SET 
    total_units = public.calculate_owner_total_units(owner_uuid),
    total_properties = public.calculate_owner_total_properties(owner_uuid)
  WHERE owner_id = owner_uuid;
END$$;


ALTER FUNCTION "public"."update_owner_total_fields"("owner_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_property_total_units"("property_uuid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.properties
  SET total_units = public.count_active_units_for_property(property_uuid)
  WHERE id = property_uuid;
END$$;


ALTER FUNCTION "public"."update_property_total_units"("property_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_property_unit_counts"("property_uuid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.properties
  SET 
    total_units = (
      SELECT COUNT(*)
      FROM public.units
      WHERE property_id = property_uuid
    ),
    total_active_units = (
      SELECT COUNT(*)
      FROM public.units
      WHERE property_id = property_uuid
      AND status != 'Inactive'
    ),
    total_occupied_units = (
      SELECT COUNT(*)
      FROM public.units
      WHERE property_id = property_uuid
      AND status = 'Occupied'
    ),
    total_vacant_units = (
      SELECT COUNT(*)
      FROM public.units
      WHERE property_id = property_uuid
      AND status = 'Vacant'
    ),
    total_inactive_units = (
      SELECT COUNT(*)
      FROM public.units
      WHERE property_id = property_uuid
      AND status = 'Inactive'
    )
  WHERE id = property_uuid;
END$$;


ALTER FUNCTION "public"."update_property_unit_counts"("property_uuid" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_property_unit_counts"("property_uuid" "uuid") IS 'Updates all unit count fields (total, active, occupied, vacant, inactive) for a property - removed redundant vacant_units_count';



CREATE OR REPLACE FUNCTION "public"."update_rent_schedules_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_rent_schedules_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_owners_list_cache"("p_owner_id" "uuid") RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
INSERT INTO public.owners_list_cache AS t (
  owner_id, contact_id, display_name, primary_email, primary_phone,
  management_agreement_start_date, management_agreement_end_date, updated_at
)
SELECT
  o.id,
  c.id,
  COALESCE(NULLIF(TRIM(c.first_name||' '||c.last_name),''), c.company_name) AS display_name,
  c.primary_email,
  c.primary_phone,
  o.management_agreement_start_date,
  o.management_agreement_end_date,
  NOW()
FROM public.owners o
JOIN public.contacts c ON c.id = o.contact_id
WHERE o.id = p_owner_id
ON CONFLICT (owner_id) DO UPDATE
  SET contact_id  = excluded.contact_id,
      display_name= excluded.display_name,
      primary_email=excluded.primary_email,
      primary_phone=excluded.primary_phone,
      management_agreement_start_date = excluded.management_agreement_start_date,
      management_agreement_end_date   = excluded.management_agreement_end_date,
      updated_at = NOW();
$$;


ALTER FUNCTION "public"."upsert_owners_list_cache"("p_owner_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_property_ownerships_cache"("p_ownership_id" "uuid") RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
INSERT INTO public.property_ownerships_cache AS t (
  ownership_id, property_id, owner_id, contact_id, display_name, primary_email,
        "primary", ownership_percentage, disbursement_percentage, updated_at
)
SELECT
  ow.id, ow.property_id, ow.owner_id, c.id,
  COALESCE(NULLIF(TRIM(c.first_name||' '||c.last_name),''), c.company_name),
  c.primary_email,
  ow."primary", ow.ownership_percentage, ow.disbursement_percentage,
  NOW()
FROM public.ownerships ow
JOIN public.owners o   ON o.id = ow.owner_id
JOIN public.contacts c ON c.id = o.contact_id
WHERE ow.id = p_ownership_id
ON CONFLICT (ownership_id) DO UPDATE
  SET property_id  = excluded.property_id,
      owner_id     = excluded.owner_id,
      contact_id   = excluded.contact_id,
      display_name = excluded.display_name,
      primary_email= excluded.primary_email,
      "primary"     = excluded."primary",
      ownership_percentage    = excluded.ownership_percentage,
      disbursement_percentage = excluded.disbursement_percentage,
      updated_at = NOW();
$$;


ALTER FUNCTION "public"."upsert_property_ownerships_cache"("p_ownership_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."lease" (
    "id" bigint NOT NULL,
    "property_id" "uuid" NOT NULL,
    "lease_from_date" timestamp without time zone NOT NULL,
    "lease_to_date" timestamp without time zone,
    "status" character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    "security_deposit" numeric,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "buildium_lease_id" integer,
    "unit_number" character varying(50),
    "lease_type" character varying(50),
    "term_type" character varying(50),
    "renewal_offer_status" character varying(50),
    "is_eviction_pending" boolean DEFAULT false,
    "current_number_of_occupants" integer,
    "payment_due_day" integer,
    "automatically_move_out_tenants" boolean DEFAULT false,
    "buildium_created_at" timestamp with time zone,
    "buildium_updated_at" timestamp with time zone,
    "rent_amount" numeric,
    "buildium_property_id" integer,
    "buildium_unit_id" integer
);


ALTER TABLE "public"."lease" OWNER TO "postgres";


COMMENT ON COLUMN "public"."lease"."created_at" IS 'Local creation timestamp';



COMMENT ON COLUMN "public"."lease"."updated_at" IS 'Local update timestamp';



COMMENT ON COLUMN "public"."lease"."buildium_lease_id" IS 'Buildium API lease ID for synchronization';



COMMENT ON COLUMN "public"."lease"."unit_number" IS 'Unit number from Buildium';



COMMENT ON COLUMN "public"."lease"."lease_type" IS 'Type of lease (Fixed, Month-to-Month, etc.)';



COMMENT ON COLUMN "public"."lease"."term_type" IS 'Term type (Standard, etc.)';



COMMENT ON COLUMN "public"."lease"."renewal_offer_status" IS 'Status of renewal offer';



COMMENT ON COLUMN "public"."lease"."is_eviction_pending" IS 'Whether eviction is pending';



COMMENT ON COLUMN "public"."lease"."current_number_of_occupants" IS 'Current number of occupants';



COMMENT ON COLUMN "public"."lease"."payment_due_day" IS 'Day of month when payment is due';



COMMENT ON COLUMN "public"."lease"."automatically_move_out_tenants" IS 'Whether to automatically move out tenants';



COMMENT ON COLUMN "public"."lease"."buildium_created_at" IS 'When the lease was created in Buildium';



COMMENT ON COLUMN "public"."lease"."buildium_updated_at" IS 'When the lease was last updated in Buildium';



COMMENT ON COLUMN "public"."lease"."rent_amount" IS 'Monthly rent amount';



COMMENT ON COLUMN "public"."lease"."buildium_property_id" IS 'Direct reference to Buildium property ID for this lease';



COMMENT ON COLUMN "public"."lease"."buildium_unit_id" IS 'Direct reference to Buildium unit ID for this lease';



CREATE SEQUENCE IF NOT EXISTS "public"."Lease_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."Lease_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."Lease_id_seq" OWNED BY "public"."lease"."id";



CREATE TABLE IF NOT EXISTS "public"."staff" (
    "id" bigint NOT NULL,
    "role" character varying(50) DEFAULT 'PROPERTY_MANAGER'::character varying NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "buildium_user_id" integer
);


ALTER TABLE "public"."staff" OWNER TO "postgres";


COMMENT ON COLUMN "public"."staff"."created_at" IS 'Local creation timestamp';



COMMENT ON COLUMN "public"."staff"."updated_at" IS 'Local update timestamp';



COMMENT ON COLUMN "public"."staff"."buildium_user_id" IS 'Stores the user ID from Buildium system';



CREATE SEQUENCE IF NOT EXISTS "public"."Staff_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."Staff_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."Staff_id_seq" OWNED BY "public"."staff"."id";



CREATE TABLE IF NOT EXISTS "public"."appliance_service_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "appliance_id" "uuid" NOT NULL,
    "buildium_service_history_id" integer,
    "service_date" "date" NOT NULL,
    "service_type" "public"."appliance_service_type_enum" NOT NULL,
    "description" "text",
    "cost" numeric(12,2),
    "vendor_name" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."appliance_service_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."appliance_service_history" IS 'Service and maintenance history records for appliances';



COMMENT ON COLUMN "public"."appliance_service_history"."buildium_service_history_id" IS 'Buildium API service history ID for synchronization';



CREATE TABLE IF NOT EXISTS "public"."appliances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "name" character varying(127) NOT NULL,
    "type" character varying(100) NOT NULL,
    "model_number" character varying(100),
    "manufacturer" character varying(100),
    "serial_number" character varying(100),
    "warranty_expiration_date" "date",
    "last_service_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "buildium_appliance_id" integer,
    "installation_date" "date",
    "is_active" boolean DEFAULT true,
    "description" "text",
    "property_id" "uuid"
);


ALTER TABLE "public"."appliances" OWNER TO "postgres";


COMMENT ON COLUMN "public"."appliances"."buildium_appliance_id" IS 'Buildium API appliance ID for synchronization';



COMMENT ON COLUMN "public"."appliances"."installation_date" IS 'Date the appliance was installed';



COMMENT ON COLUMN "public"."appliances"."is_active" IS 'Whether the appliance is currently active';



COMMENT ON COLUMN "public"."appliances"."property_id" IS 'Local property UUID (convenience link)';



CREATE TABLE IF NOT EXISTS "public"."bank_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buildium_bank_id" integer NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "account_number" character varying(255),
    "routing_number" character varying(255),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "balance" numeric(15,2) DEFAULT 0.00,
    "buildium_balance" numeric(15,2) DEFAULT 0.00,
    "gl_account" "uuid" NOT NULL,
    "country" "public"."countries" DEFAULT 'United States'::"public"."countries" NOT NULL,
    "check_printing_info" "jsonb",
    "electronic_payments" "jsonb",
    "last_source" "public"."sync_source_enum",
    "last_source_ts" timestamp with time zone,
    "bank_account_type" "public"."bank_account_type_enum"
);


ALTER TABLE "public"."bank_accounts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."bank_accounts"."buildium_bank_id" IS 'Buildium API bank account ID for synchronization';



COMMENT ON COLUMN "public"."bank_accounts"."is_active" IS 'Whether the bank account is active or inactive';



COMMENT ON COLUMN "public"."bank_accounts"."balance" IS 'Current balance of the bank account in local system';



COMMENT ON COLUMN "public"."bank_accounts"."buildium_balance" IS 'Current balance of the bank account from Buildium API';



COMMENT ON COLUMN "public"."bank_accounts"."gl_account" IS 'Reference to the associated general ledger account';



CREATE TABLE IF NOT EXISTS "public"."bill_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buildium_category_id" integer,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bill_categories" OWNER TO "postgres";


COMMENT ON TABLE "public"."bill_categories" IS 'Categories for organizing bills and expenses';



COMMENT ON COLUMN "public"."bill_categories"."buildium_category_id" IS 'Buildium API category ID for synchronization';



COMMENT ON COLUMN "public"."bill_categories"."name" IS 'Category name';



COMMENT ON COLUMN "public"."bill_categories"."description" IS 'Category description';



COMMENT ON COLUMN "public"."bill_categories"."is_active" IS 'Whether the category is active';



CREATE TABLE IF NOT EXISTS "public"."buildium_api_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "endpoint" character varying(255) NOT NULL,
    "parameters" "jsonb",
    "response_data" "jsonb",
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."buildium_api_cache" OWNER TO "postgres";


COMMENT ON TABLE "public"."buildium_api_cache" IS 'Caches Buildium API responses to reduce API calls and improve performance';



COMMENT ON COLUMN "public"."buildium_api_cache"."endpoint" IS 'Buildium API endpoint (e.g., /rentals, /units)';



COMMENT ON COLUMN "public"."buildium_api_cache"."parameters" IS 'JSON object containing query parameters used in the request';



COMMENT ON COLUMN "public"."buildium_api_cache"."response_data" IS 'Cached response data from Buildium API';



COMMENT ON COLUMN "public"."buildium_api_cache"."expires_at" IS 'When the cached response expires and should be refreshed';



CREATE TABLE IF NOT EXISTS "public"."buildium_api_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "endpoint" character varying(255) NOT NULL,
    "method" character varying(10) NOT NULL,
    "request_data" "jsonb",
    "response_status" integer,
    "response_data" "jsonb",
    "error_message" "text",
    "duration_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."buildium_api_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."buildium_api_log" IS 'Logs all Buildium API requests and responses for debugging and monitoring';



COMMENT ON COLUMN "public"."buildium_api_log"."endpoint" IS 'Buildium API endpoint that was called';



COMMENT ON COLUMN "public"."buildium_api_log"."method" IS 'HTTP method used (GET, POST, PUT, DELETE)';



COMMENT ON COLUMN "public"."buildium_api_log"."request_data" IS 'Request data sent to Buildium API';



COMMENT ON COLUMN "public"."buildium_api_log"."response_status" IS 'HTTP status code returned by Buildium API';



COMMENT ON COLUMN "public"."buildium_api_log"."response_data" IS 'Response data returned by Buildium API';



COMMENT ON COLUMN "public"."buildium_api_log"."error_message" IS 'Error message if the request failed';



COMMENT ON COLUMN "public"."buildium_api_log"."duration_ms" IS 'Request duration in milliseconds';



CREATE TABLE IF NOT EXISTS "public"."buildium_sync_status" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" character varying(50) NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "buildium_id" integer,
    "last_synced_at" timestamp with time zone,
    "sync_status" character varying(20) DEFAULT 'pending'::character varying,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."buildium_sync_status" OWNER TO "postgres";


COMMENT ON TABLE "public"."buildium_sync_status" IS 'Tracks synchronization status between local entities and Buildium API';



COMMENT ON COLUMN "public"."buildium_sync_status"."entity_type" IS 'Type of entity being synced (property, unit, owner, lease, bank_account)';



COMMENT ON COLUMN "public"."buildium_sync_status"."entity_id" IS 'Local entity UUID';



COMMENT ON COLUMN "public"."buildium_sync_status"."buildium_id" IS 'Buildium API entity ID';



COMMENT ON COLUMN "public"."buildium_sync_status"."sync_status" IS 'Current sync status: pending, synced, or failed';



CREATE TABLE IF NOT EXISTS "public"."buildium_webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" character varying(255),
    "event_type" character varying(100) NOT NULL,
    "event_data" "jsonb" NOT NULL,
    "processed" boolean DEFAULT false,
    "processed_at" timestamp with time zone,
    "error_message" "text",
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."buildium_webhook_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."buildium_webhook_events" IS 'Stores webhook events from Buildium for processing';



COMMENT ON COLUMN "public"."buildium_webhook_events"."event_id" IS 'Unique event ID from Buildium webhook';



COMMENT ON COLUMN "public"."buildium_webhook_events"."event_type" IS 'Type of webhook event (e.g., property.updated, lease.payment_received)';



COMMENT ON COLUMN "public"."buildium_webhook_events"."event_data" IS 'Full webhook event data from Buildium';



COMMENT ON COLUMN "public"."buildium_webhook_events"."processed" IS 'Whether the event has been processed';



COMMENT ON COLUMN "public"."buildium_webhook_events"."processed_at" IS 'When the event was processed';



COMMENT ON COLUMN "public"."buildium_webhook_events"."error_message" IS 'Error message if processing failed';



COMMENT ON COLUMN "public"."buildium_webhook_events"."retry_count" IS 'Number of times processing has been retried';



COMMENT ON COLUMN "public"."buildium_webhook_events"."max_retries" IS 'Maximum number of retry attempts';



CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" bigint NOT NULL,
    "is_company" boolean DEFAULT false NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "company_name" "text",
    "primary_email" "text",
    "alt_email" "text",
    "primary_phone" "text",
    "alt_phone" "text",
    "date_of_birth" "date",
    "primary_address_line_1" "text",
    "primary_address_line_2" "text",
    "primary_address_line_3" "text",
    "primary_city" "text",
    "primary_state" "text",
    "primary_postal_code" "text",
    "primary_country" "public"."countries" DEFAULT 'United States'::"public"."countries",
    "alt_address_line_1" "text",
    "alt_address_line_2" "text",
    "alt_address_line_3" "text",
    "alt_city" "text",
    "alt_state" "text",
    "alt_postal_code" "text",
    "alt_country" "public"."countries",
    "mailing_preference" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "display_name" "text",
    "buildium_contact_id" integer
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


COMMENT ON TABLE "public"."contacts" IS 'Contacts table - RLS temporarily disabled for NextAuth integration';



COMMENT ON COLUMN "public"."contacts"."primary_country" IS 'Primary address country - uses standardized countries enum';



COMMENT ON COLUMN "public"."contacts"."alt_country" IS 'Alternative address country - uses standardized countries enum';



COMMENT ON COLUMN "public"."contacts"."display_name" IS 'Auto-generated display name: first_name + last_name for individuals, company_name for companies';



CREATE SEQUENCE IF NOT EXISTS "public"."contacts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."contacts_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."contacts_id_seq" OWNED BY "public"."contacts"."id";



CREATE TABLE IF NOT EXISTS "public"."gl_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buildium_gl_account_id" integer NOT NULL,
    "account_number" character varying(50),
    "name" character varying(255) NOT NULL,
    "description" "text",
    "type" character varying(50) NOT NULL,
    "sub_type" character varying(50),
    "is_default_gl_account" boolean DEFAULT false,
    "default_account_name" character varying(255),
    "is_contra_account" boolean DEFAULT false,
    "is_bank_account" boolean DEFAULT false,
    "cash_flow_classification" character varying(50),
    "exclude_from_cash_balances" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "buildium_parent_gl_account_id" integer,
    "is_credit_card_account" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "sub_accounts" "uuid"[] DEFAULT '{}'::"uuid"[]
);


ALTER TABLE "public"."gl_accounts" OWNER TO "postgres";


COMMENT ON TABLE "public"."gl_accounts" IS 'General ledger accounts from Buildium';



COMMENT ON COLUMN "public"."gl_accounts"."buildium_gl_account_id" IS 'Unique identifier from Buildium API';



COMMENT ON COLUMN "public"."gl_accounts"."type" IS 'Account type: Income, Liability, Asset, Expense, Equity';



COMMENT ON COLUMN "public"."gl_accounts"."sub_type" IS 'Account subtype: CurrentLiability, Income, etc.';



COMMENT ON COLUMN "public"."gl_accounts"."buildium_parent_gl_account_id" IS 'Buildium API parent GL account ID for hierarchical relationships';



COMMENT ON COLUMN "public"."gl_accounts"."sub_accounts" IS 'Array of UUIDs referencing child GL accounts. Each UUID represents a sub-account linked to this GL account.';



CREATE TABLE IF NOT EXISTS "public"."gl_import_cursors" (
    "key" "text" NOT NULL,
    "last_imported_at" timestamp with time zone DEFAULT '1970-01-01 00:00:00+00'::timestamp with time zone NOT NULL,
    "window_days" integer DEFAULT 7 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."gl_import_cursors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inspections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "type" "public"."inspection_type_enum" NOT NULL,
    "property" character varying(127) NOT NULL,
    "unit" character varying(30) NOT NULL,
    "inspection_date" "date" NOT NULL,
    "status" "public"."inspection_status_enum" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."inspections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."owners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "management_agreement_start_date" "date",
    "management_agreement_end_date" "date",
    "comment" "text",
    "tax_payer_name1" character varying(40),
    "tax_payer_name2" character varying(40),
    "tax_address_line1" character varying(100),
    "tax_address_line2" character varying(100),
    "tax_address_line3" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "etf_account_type" "public"."etf_account_type_enum",
    "etf_account_number" numeric,
    "etf_routing_number" numeric,
    "contact_id" bigint,
    "tax_payer_id" "text",
    "tax_payer_type" "text",
    "tax_city" "text",
    "tax_state" "text",
    "tax_postal_code" "text",
    "tax_country" "public"."countries",
    "last_contacted" timestamp with time zone,
    "buildium_owner_id" integer,
    "is_active" boolean DEFAULT true,
    "buildium_created_at" timestamp with time zone,
    "buildium_updated_at" timestamp with time zone,
    "tax_include1099" boolean DEFAULT false
);


ALTER TABLE "public"."owners" OWNER TO "postgres";


COMMENT ON TABLE "public"."owners" IS 'Owners table - RLS temporarily disabled for NextAuth integration';



COMMENT ON COLUMN "public"."owners"."tax_country" IS 'Tax address country - uses standardized countries enum';



COMMENT ON COLUMN "public"."owners"."last_contacted" IS 'Timestamp of when this owner was last contacted';



COMMENT ON COLUMN "public"."owners"."buildium_owner_id" IS 'Buildium API owner ID for synchronization';



COMMENT ON COLUMN "public"."owners"."is_active" IS 'Whether the owner is active in Buildium';



COMMENT ON COLUMN "public"."owners"."buildium_created_at" IS 'Timestamp when owner was created in Buildium';



COMMENT ON COLUMN "public"."owners"."buildium_updated_at" IS 'Timestamp when owner was last updated in Buildium';



COMMENT ON COLUMN "public"."owners"."tax_include1099" IS 'Indicates whether this owner should be included in 1099 tax reporting (maps to Buildium IncludeIn1099)';



CREATE TABLE IF NOT EXISTS "public"."properties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(127) NOT NULL,
    "structure_description" "text",
    "address_line1" character varying(100) NOT NULL,
    "address_line2" character varying(100),
    "address_line3" character varying(100),
    "city" character varying(100),
    "state" character varying(100),
    "postal_code" character varying(20) NOT NULL,
    "buildium_property_id" integer,
    "rental_owner_ids" integer[],
    "reserve" numeric,
    "year_built" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "country" "public"."countries" NOT NULL,
    "operating_bank_account_id" "uuid",
    "primary_owner" character varying(255),
    "status" "public"."property_status" DEFAULT 'Active'::"public"."property_status" NOT NULL,
    "deposit_trust_account_id" "uuid",
    "total_units" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true,
    "buildium_created_at" timestamp with time zone,
    "buildium_updated_at" timestamp with time zone,
    "rental_type" character varying(50),
    "total_inactive_units" integer DEFAULT 0 NOT NULL,
    "total_occupied_units" integer DEFAULT 0 NOT NULL,
    "total_active_units" integer DEFAULT 0 NOT NULL,
    "total_vacant_units" integer DEFAULT 0 NOT NULL,
    "occupancy_rate" numeric(5,2) GENERATED ALWAYS AS (
CASE
    WHEN ("total_active_units" > 0) THEN "round"((((("total_active_units" - "total_vacant_units"))::numeric / ("total_active_units")::numeric) * (100)::numeric), 2)
    ELSE (0)::numeric
END) STORED,
    "borough" character varying(100),
    "neighborhood" character varying(100),
    "longitude" numeric(10,8),
    "latitude" numeric(11,8),
    "location_verified" boolean DEFAULT false,
    "property_type" "public"."property_type_enum",
    CONSTRAINT "check_total_active_units_non_negative" CHECK (("total_active_units" >= 0)),
    CONSTRAINT "check_total_active_units_not_exceed_total" CHECK (("total_active_units" <= "total_units")),
    CONSTRAINT "check_total_inactive_units_non_negative" CHECK (("total_inactive_units" >= 0)),
    CONSTRAINT "check_total_inactive_units_not_exceed_total" CHECK (("total_inactive_units" <= "total_units")),
    CONSTRAINT "check_total_occupied_units_non_negative" CHECK (("total_occupied_units" >= 0)),
    CONSTRAINT "check_total_occupied_units_not_exceed_total" CHECK (("total_occupied_units" <= "total_units")),
    CONSTRAINT "check_total_vacant_units_non_negative" CHECK (("total_vacant_units" >= 0)),
    CONSTRAINT "check_total_vacant_units_not_exceed_total" CHECK (("total_vacant_units" <= "total_units"))
);


ALTER TABLE "public"."properties" OWNER TO "postgres";


COMMENT ON COLUMN "public"."properties"."updated_at" IS 'Timestamp when property was last updated, defaults to now() on insert';



COMMENT ON COLUMN "public"."properties"."country" IS 'Property address country - uses standardized countries enum';



COMMENT ON COLUMN "public"."properties"."status" IS 'Current status of the property';



COMMENT ON COLUMN "public"."properties"."deposit_trust_account_id" IS 'References the bank account used for deposit trust funds';



COMMENT ON COLUMN "public"."properties"."total_units" IS 'Count of active units (status != Inactive) for this property';



COMMENT ON COLUMN "public"."properties"."is_active" IS 'Whether the property is active in Buildium';



COMMENT ON COLUMN "public"."properties"."buildium_created_at" IS 'Timestamp when property was created in Buildium';



COMMENT ON COLUMN "public"."properties"."buildium_updated_at" IS 'Timestamp when property was last updated in Buildium';



COMMENT ON COLUMN "public"."properties"."rental_type" IS 'The main rental type from Buildium (Rental, Association, Commercial)';



COMMENT ON COLUMN "public"."properties"."total_inactive_units" IS 'Count of related units with status = Inactive';



COMMENT ON COLUMN "public"."properties"."total_occupied_units" IS 'Count of related units with status = Occupied';



COMMENT ON COLUMN "public"."properties"."total_active_units" IS 'Count of related units with status IN (Occupied, Vacant)';



COMMENT ON COLUMN "public"."properties"."total_vacant_units" IS 'Count of related units with status = Vacant. Maintained by triggers.';



COMMENT ON COLUMN "public"."properties"."occupancy_rate" IS 'Calculated occupancy rate as percentage: (total_active_units - total_vacant_units) / total_active_units * 100';



COMMENT ON COLUMN "public"."properties"."borough" IS 'Borough or district where the property is located';



COMMENT ON COLUMN "public"."properties"."neighborhood" IS 'Neighborhood or area within the borough';



COMMENT ON COLUMN "public"."properties"."longitude" IS 'Longitude coordinate for property location';



COMMENT ON COLUMN "public"."properties"."latitude" IS 'Latitude coordinate for property location';



COMMENT ON COLUMN "public"."properties"."location_verified" IS 'Whether the location coordinates have been verified';



COMMENT ON COLUMN "public"."properties"."property_type" IS 'UI property type (enum). NULL represents None.';



CREATE TABLE IF NOT EXISTS "public"."units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "unit_number" character varying(30) NOT NULL,
    "unit_size" integer,
    "market_rent" numeric,
    "address_line1" character varying(100) NOT NULL,
    "address_line2" character varying(100),
    "address_line3" character varying(100),
    "city" character varying(100),
    "state" character varying(100),
    "postal_code" character varying(20) NOT NULL,
    "country" "public"."countries" NOT NULL,
    "unit_bedrooms" "public"."bedroom_enum",
    "unit_bathrooms" "public"."bathroom_enum",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "last_inspection_date" "date",
    "next_inspection_date" "date",
    "status" "public"."unit_status_enum" DEFAULT 'Vacant'::"public"."unit_status_enum" NOT NULL,
    "service_start" "date",
    "service_end" "date",
    "service_plan" "public"."ServicePlan",
    "fee_type" "public"."FeeType",
    "fee_percent" numeric,
    "management_fee" numeric,
    "fee_frequency" "public"."FeeFrequency",
    "active_services" "text",
    "fee_notes" "text",
    "buildium_unit_id" integer,
    "buildium_property_id" integer,
    "unit_type" character varying(50),
    "is_active" boolean DEFAULT true,
    "buildium_created_at" timestamp with time zone,
    "buildium_updated_at" timestamp with time zone,
    "building_name" "text"
);


ALTER TABLE "public"."units" OWNER TO "postgres";


COMMENT ON COLUMN "public"."units"."country" IS 'Unit address country - uses standardized countries enum';



COMMENT ON COLUMN "public"."units"."buildium_unit_id" IS 'Unique identifier from Buildium API';



COMMENT ON COLUMN "public"."units"."buildium_property_id" IS 'Buildium property ID this unit belongs to';



COMMENT ON COLUMN "public"."units"."unit_type" IS 'Type of unit from Buildium (Apartment, Condo, House, etc.)';



COMMENT ON COLUMN "public"."units"."is_active" IS 'Whether the unit is active in Buildium';



COMMENT ON COLUMN "public"."units"."buildium_created_at" IS 'When the unit was created in Buildium';



COMMENT ON COLUMN "public"."units"."buildium_updated_at" IS 'When the unit was last updated in Buildium';



COMMENT ON COLUMN "public"."units"."building_name" IS 'Building name for units in multi-building properties';



CREATE TABLE IF NOT EXISTS "public"."vendors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buildium_vendor_id" integer,
    "buildium_category_id" integer,
    "tax_id" character varying(255),
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "website" character varying(255),
    "insurance_provider" character varying(255),
    "insurance_policy_number" character varying(255),
    "insurance_expiration_date" "date",
    "tax_address_line1" character varying(255),
    "tax_address_line2" character varying(255),
    "tax_address_line3" character varying(255),
    "tax_address_city" character varying(100),
    "tax_address_state" character varying(100),
    "tax_address_postal_code" character varying(20),
    "tax_address_country" character varying(100),
    "comments" "text",
    "account_number" character varying(255),
    "tax_payer_type" character varying(50),
    "tax_payer_name1" character varying(255),
    "tax_payer_name2" character varying(255),
    "include_1099" boolean,
    "gl_account" "uuid",
    "expense_gl_account_id" integer,
    "vendor_category" "uuid",
    "contact_id" bigint NOT NULL
);


ALTER TABLE "public"."vendors" OWNER TO "postgres";


COMMENT ON TABLE "public"."vendors" IS 'Vendors/suppliers with accounting linkage and tax/insurance metadata';



COMMENT ON COLUMN "public"."vendors"."buildium_vendor_id" IS 'Buildium API vendor ID for synchronization';



COMMENT ON COLUMN "public"."vendors"."buildium_category_id" IS 'Buildium vendor category id (source of truth from Buildium)';



COMMENT ON COLUMN "public"."vendors"."tax_id" IS 'Tax identification number';



COMMENT ON COLUMN "public"."vendors"."is_active" IS 'Whether the vendor is active';



COMMENT ON COLUMN "public"."vendors"."website" IS 'Vendor website URL';



COMMENT ON COLUMN "public"."vendors"."insurance_provider" IS 'Insurance provider for the vendor';



COMMENT ON COLUMN "public"."vendors"."insurance_policy_number" IS 'Insurance policy number for the vendor';



COMMENT ON COLUMN "public"."vendors"."insurance_expiration_date" IS 'Date when insurance coverage expires';



COMMENT ON COLUMN "public"."vendors"."tax_address_line1" IS 'Tax address line 1';



COMMENT ON COLUMN "public"."vendors"."tax_address_line2" IS 'Tax address line 2';



COMMENT ON COLUMN "public"."vendors"."tax_address_line3" IS 'Tax address line 3';



COMMENT ON COLUMN "public"."vendors"."tax_address_city" IS 'Tax address city';



COMMENT ON COLUMN "public"."vendors"."tax_address_state" IS 'Tax address state or region';



COMMENT ON COLUMN "public"."vendors"."tax_address_postal_code" IS 'Tax address postal/ZIP code';



COMMENT ON COLUMN "public"."vendors"."tax_address_country" IS 'Tax address country (free text; consider enum constraint later)';



COMMENT ON COLUMN "public"."vendors"."comments" IS 'Internal comments about the vendor';



COMMENT ON COLUMN "public"."vendors"."account_number" IS 'Account or reference number with the vendor';



COMMENT ON COLUMN "public"."vendors"."tax_payer_type" IS 'Tax payer type (e.g., SSN, EIN, etc.)';



COMMENT ON COLUMN "public"."vendors"."tax_payer_name1" IS 'Primary tax payer name';



COMMENT ON COLUMN "public"."vendors"."tax_payer_name2" IS 'Secondary tax payer name';



COMMENT ON COLUMN "public"."vendors"."include_1099" IS 'Whether the vendor should be included in 1099 reporting';



COMMENT ON COLUMN "public"."vendors"."gl_account" IS 'Reference to the associated general ledger account';



COMMENT ON COLUMN "public"."vendors"."expense_gl_account_id" IS 'External expense GL account identifier (e.g., Buildium GLAccount.Id)';



COMMENT ON COLUMN "public"."vendors"."vendor_category" IS 'Local FK to vendor_categories table (one-to-many)';



COMMENT ON COLUMN "public"."vendors"."contact_id" IS 'FK to contacts.id for the vendor primary contact';



CREATE OR REPLACE VIEW "public"."invalid_country_values" AS
 SELECT 'contacts'::"text" AS "table_name",
    ("contacts"."id")::"text" AS "id",
    'primary_country'::"text" AS "column_name",
    ("contacts"."primary_country")::"text" AS "value"
   FROM "public"."contacts"
  WHERE (NOT "public"."is_valid_country"(("contacts"."primary_country")::"text"))
UNION ALL
 SELECT 'contacts'::"text" AS "table_name",
    ("contacts"."id")::"text" AS "id",
    'alt_country'::"text" AS "column_name",
    ("contacts"."alt_country")::"text" AS "value"
   FROM "public"."contacts"
  WHERE (NOT "public"."is_valid_country"(("contacts"."alt_country")::"text"))
UNION ALL
 SELECT 'owners'::"text" AS "table_name",
    ("owners"."id")::"text" AS "id",
    'tax_country'::"text" AS "column_name",
    ("owners"."tax_country")::"text" AS "value"
   FROM "public"."owners"
  WHERE (NOT "public"."is_valid_country"(("owners"."tax_country")::"text"))
UNION ALL
 SELECT 'properties'::"text" AS "table_name",
    ("properties"."id")::"text" AS "id",
    'country'::"text" AS "column_name",
    ("properties"."country")::"text" AS "value"
   FROM "public"."properties"
  WHERE (NOT "public"."is_valid_country"(("properties"."country")::"text"))
UNION ALL
 SELECT 'units'::"text" AS "table_name",
    ("units"."id")::"text" AS "id",
    'country'::"text" AS "column_name",
    ("units"."country")::"text" AS "value"
   FROM "public"."units"
  WHERE (NOT "public"."is_valid_country"(("units"."country")::"text"))
UNION ALL
 SELECT 'vendors'::"text" AS "table_name",
    ("vendors"."id")::"text" AS "id",
    'tax_address_country'::"text" AS "column_name",
    ("vendors"."tax_address_country")::"text" AS "value"
   FROM "public"."vendors"
  WHERE (NOT "public"."is_valid_country"(("vendors"."tax_address_country")::"text"));


ALTER VIEW "public"."invalid_country_values" OWNER TO "postgres";


COMMENT ON VIEW "public"."invalid_country_values" IS 'Lists rows/columns where country values are not valid enum labels; uses vendors.tax_address_country after vendor country removal.';



CREATE TABLE IF NOT EXISTS "public"."journal_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buildium_gl_entry_id" integer,
    "transaction_id" "uuid",
    "date" "date" NOT NULL,
    "memo" "text",
    "check_number" "text",
    "total_amount" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."journal_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lease_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lease_id" bigint NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "role" character varying(20) DEFAULT 'Tenant'::character varying NOT NULL,
    "status" character varying(20) DEFAULT 'Active'::character varying NOT NULL,
    "move_in_date" "date",
    "is_rent_responsible" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "move_out_date" "date",
    "notice_given_date" "date"
);


ALTER TABLE "public"."lease_contacts" OWNER TO "postgres";


COMMENT ON TABLE "public"."lease_contacts" IS 'Join table linking leases to tenants with role and status';



COMMENT ON COLUMN "public"."lease_contacts"."role" IS 'Role of the contact in the lease (Tenant, Cosigner, Guarantor)';



COMMENT ON COLUMN "public"."lease_contacts"."status" IS 'Status of the contact in the lease (Future, Active, Past)';



COMMENT ON COLUMN "public"."lease_contacts"."move_out_date" IS 'Date when the tenant moved out of the property';



COMMENT ON COLUMN "public"."lease_contacts"."notice_given_date" IS 'Date when the tenant gave notice of intent to move out';



CREATE TABLE IF NOT EXISTS "public"."lease_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lease_id" bigint NOT NULL,
    "buildium_lease_id" bigint,
    "buildium_note_id" bigint,
    "subject" "text",
    "body" "text",
    "is_private" boolean,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."lease_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lease_recurring_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lease_id" bigint NOT NULL,
    "buildium_lease_id" bigint,
    "buildium_recurring_id" bigint,
    "amount" numeric,
    "description" "text",
    "frequency" "text",
    "start_date" "date",
    "end_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."lease_recurring_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."owners_list_cache" (
    "owner_id" "uuid" NOT NULL,
    "contact_id" bigint NOT NULL,
    "display_name" "text",
    "primary_email" "text",
    "primary_phone" "text",
    "management_agreement_start_date" "date",
    "management_agreement_end_date" "date",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."owners_list_cache" OWNER TO "postgres";


COMMENT ON TABLE "public"."owners_list_cache" IS 'Owners list cache table - RLS disabled for trigger operations';



CREATE TABLE IF NOT EXISTS "public"."ownerships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "primary" boolean DEFAULT false NOT NULL,
    "ownership_percentage" numeric(5,2) NOT NULL,
    "disbursement_percentage" numeric(5,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "total_units" integer DEFAULT 0 NOT NULL,
    "total_properties" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "ownerships_disbursement_percentage_check" CHECK ((("disbursement_percentage" >= (0)::numeric) AND ("disbursement_percentage" <= (100)::numeric))),
    CONSTRAINT "ownerships_ownership_percentage_check" CHECK ((("ownership_percentage" >= (0)::numeric) AND ("ownership_percentage" <= (100)::numeric)))
);


ALTER TABLE "public"."ownerships" OWNER TO "postgres";


COMMENT ON TABLE "public"."ownerships" IS 'Ownerships table - RLS temporarily disabled for NextAuth integration';



COMMENT ON COLUMN "public"."ownerships"."total_units" IS 'Sum of total_units from all properties owned by this owner';



COMMENT ON COLUMN "public"."ownerships"."total_properties" IS 'Count of active properties (status != Inactive) owned by this owner';



CREATE TABLE IF NOT EXISTS "public"."property_ownerships_cache" (
    "ownership_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "contact_id" bigint NOT NULL,
    "display_name" "text",
    "primary_email" "text",
    "primary" boolean DEFAULT false NOT NULL,
    "ownership_percentage" numeric(5,2) NOT NULL,
    "disbursement_percentage" numeric(5,2) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."property_ownerships_cache" OWNER TO "postgres";


COMMENT ON TABLE "public"."property_ownerships_cache" IS 'Property ownerships cache table - RLS disabled for trigger operations';



CREATE TABLE IF NOT EXISTS "public"."property_staff" (
    "property_id" "uuid" NOT NULL,
    "staff_id" bigint NOT NULL,
    "role" "text" DEFAULT 'PROPERTY_MANAGER'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."property_staff" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rent_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lease_id" bigint NOT NULL,
    "buildium_rent_id" integer,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "total_amount" numeric NOT NULL,
    "rent_cycle" "public"."rent_cycle_enum" NOT NULL,
    "backdate_charges" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."rent_schedules" OWNER TO "postgres";


COMMENT ON COLUMN "public"."rent_schedules"."start_date" IS 'Start date of the rent schedule';



COMMENT ON COLUMN "public"."rent_schedules"."end_date" IS 'End date of the rent schedule (null for ongoing)';



COMMENT ON COLUMN "public"."rent_schedules"."total_amount" IS 'Total amount for this rent schedule';



COMMENT ON COLUMN "public"."rent_schedules"."rent_cycle" IS 'Rent cycle (Monthly, Weekly, etc.)';



COMMENT ON COLUMN "public"."rent_schedules"."backdate_charges" IS 'Whether charges should be backdated';



CREATE TABLE IF NOT EXISTS "public"."sync_operations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" character varying(10) NOT NULL,
    "entity" character varying(20) NOT NULL,
    "buildium_id" integer NOT NULL,
    "local_id" "uuid",
    "status" character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    "data" "jsonb" NOT NULL,
    "dependencies" "text"[],
    "error" "text",
    "attempts" integer DEFAULT 0 NOT NULL,
    "last_attempt" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "sync_operations_entity_check" CHECK ((("entity")::"text" = ANY ((ARRAY['property'::character varying, 'unit'::character varying, 'lease'::character varying, 'tenant'::character varying, 'contact'::character varying, 'owner'::character varying])::"text"[]))),
    CONSTRAINT "sync_operations_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['PENDING'::character varying, 'IN_PROGRESS'::character varying, 'COMPLETED'::character varying, 'FAILED'::character varying, 'ROLLED_BACK'::character varying])::"text"[]))),
    CONSTRAINT "sync_operations_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['CREATE'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[])))
);


ALTER TABLE "public"."sync_operations" OWNER TO "postgres";


COMMENT ON TABLE "public"."sync_operations" IS 'Tracks sync operations for error recovery and monitoring';



COMMENT ON COLUMN "public"."sync_operations"."type" IS 'Type of operation: CREATE, UPDATE, DELETE';



COMMENT ON COLUMN "public"."sync_operations"."entity" IS 'Entity type being synced';



COMMENT ON COLUMN "public"."sync_operations"."buildium_id" IS 'Buildium ID for the entity';



COMMENT ON COLUMN "public"."sync_operations"."local_id" IS 'Local database ID after successful creation';



COMMENT ON COLUMN "public"."sync_operations"."status" IS 'Current status of the operation';



COMMENT ON COLUMN "public"."sync_operations"."data" IS 'Original Buildium data for the operation';



COMMENT ON COLUMN "public"."sync_operations"."dependencies" IS 'IDs of operations this depends on';



COMMENT ON COLUMN "public"."sync_operations"."error" IS 'Error message if operation failed';



COMMENT ON COLUMN "public"."sync_operations"."attempts" IS 'Number of retry attempts made';



CREATE TABLE IF NOT EXISTS "public"."task_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buildium_category_id" integer,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "color" character varying(7),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "parent_id" "uuid",
    "buildium_subcategory_id" integer
);


ALTER TABLE "public"."task_categories" OWNER TO "postgres";


COMMENT ON TABLE "public"."task_categories" IS 'Categories for organizing tasks';



COMMENT ON COLUMN "public"."task_categories"."buildium_category_id" IS 'Buildium API category ID for synchronization';



COMMENT ON COLUMN "public"."task_categories"."name" IS 'Category name';



COMMENT ON COLUMN "public"."task_categories"."description" IS 'Category description';



COMMENT ON COLUMN "public"."task_categories"."color" IS 'Hex color code for UI display';



COMMENT ON COLUMN "public"."task_categories"."is_active" IS 'Whether the category is active';



CREATE TABLE IF NOT EXISTS "public"."task_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buildium_history_id" integer,
    "task_id" "uuid",
    "status" character varying(20) NOT NULL,
    "notes" "text",
    "completed_date" timestamp with time zone,
    "assigned_to" character varying(255),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."task_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."task_history" IS 'History of status changes and updates for tasks';



COMMENT ON COLUMN "public"."task_history"."buildium_history_id" IS 'Buildium API history ID for synchronization';



COMMENT ON COLUMN "public"."task_history"."task_id" IS 'Task this history entry belongs to';



COMMENT ON COLUMN "public"."task_history"."status" IS 'Status at this point in history';



COMMENT ON COLUMN "public"."task_history"."notes" IS 'Notes about this status change';



COMMENT ON COLUMN "public"."task_history"."completed_date" IS 'When the task was completed (if applicable)';



COMMENT ON COLUMN "public"."task_history"."assigned_to" IS 'Person assigned at this point';



CREATE TABLE IF NOT EXISTS "public"."task_history_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buildium_file_id" integer,
    "task_history_id" "uuid",
    "file_name" character varying(255) NOT NULL,
    "file_type" character varying(100),
    "file_size" integer,
    "file_url" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."task_history_files" OWNER TO "postgres";


COMMENT ON TABLE "public"."task_history_files" IS 'Files attached to task history entries';



COMMENT ON COLUMN "public"."task_history_files"."buildium_file_id" IS 'Buildium API file ID for synchronization';



COMMENT ON COLUMN "public"."task_history_files"."task_history_id" IS 'Task history entry this file belongs to';



COMMENT ON COLUMN "public"."task_history_files"."file_name" IS 'Name of the file';



COMMENT ON COLUMN "public"."task_history_files"."file_type" IS 'MIME type of the file';



COMMENT ON COLUMN "public"."task_history_files"."file_size" IS 'Size of the file in bytes';



COMMENT ON COLUMN "public"."task_history_files"."file_url" IS 'URL to access the file';



COMMENT ON COLUMN "public"."task_history_files"."description" IS 'Description of the file';



CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buildium_task_id" integer,
    "property_id" "uuid",
    "unit_id" "uuid",
    "subject" character varying(255) NOT NULL,
    "description" "text",
    "priority" character varying(20) DEFAULT 'medium'::character varying,
    "status" character varying(20) DEFAULT 'open'::character varying,
    "assigned_to" character varying(255),
    "estimated_cost" numeric(10,2),
    "actual_cost" numeric(10,2),
    "scheduled_date" timestamp with time zone,
    "completed_date" timestamp with time zone,
    "category" character varying(100),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "task_kind" "public"."task_kind_enum",
    "task_category_id" "uuid",
    "requested_by_contact_id" integer,
    "requested_by_type" "text",
    "requested_by_buildium_id" integer,
    "owner_id" "uuid",
    "tenant_id" "uuid",
    "lease_id" integer,
    "assigned_to_staff_id" integer,
    "buildium_property_id" integer,
    "buildium_unit_id" integer,
    "buildium_owner_id" integer,
    "buildium_tenant_id" integer,
    "buildium_lease_id" integer,
    "buildium_assigned_to_user_id" integer,
    CONSTRAINT "tasks_todo_requires_category" CHECK ((("task_kind" <> 'todo'::"public"."task_kind_enum") OR ("task_category_id" IS NOT NULL)))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


COMMENT ON TABLE "public"."tasks" IS 'Maintenance tasks and work items for properties and units';



COMMENT ON COLUMN "public"."tasks"."buildium_task_id" IS 'Buildium API task ID for synchronization';



COMMENT ON COLUMN "public"."tasks"."property_id" IS 'Property the task is associated with';



COMMENT ON COLUMN "public"."tasks"."unit_id" IS 'Unit the task is associated with (optional)';



COMMENT ON COLUMN "public"."tasks"."subject" IS 'Task subject/title';



COMMENT ON COLUMN "public"."tasks"."description" IS 'Detailed task description';



COMMENT ON COLUMN "public"."tasks"."priority" IS 'Task priority: low, medium, high, urgent';



COMMENT ON COLUMN "public"."tasks"."status" IS 'Task status: open, in_progress, completed, cancelled';



COMMENT ON COLUMN "public"."tasks"."assigned_to" IS 'Person assigned to the task';



COMMENT ON COLUMN "public"."tasks"."estimated_cost" IS 'Estimated cost for the task';



COMMENT ON COLUMN "public"."tasks"."actual_cost" IS 'Actual cost incurred for the task';



COMMENT ON COLUMN "public"."tasks"."scheduled_date" IS 'When the task is scheduled to be performed';



COMMENT ON COLUMN "public"."tasks"."completed_date" IS 'When the task was completed';



COMMENT ON COLUMN "public"."tasks"."category" IS 'Task category (e.g., plumbing, electrical, hvac)';



COMMENT ON COLUMN "public"."tasks"."notes" IS 'Additional notes about the task';



CREATE TABLE IF NOT EXISTS "public"."tenant_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "buildium_tenant_id" integer,
    "buildium_note_id" integer,
    "subject" "text",
    "note" "text",
    "buildium_created_at" timestamp with time zone,
    "buildium_updated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tenant_notes" OWNER TO "postgres";


COMMENT ON TABLE "public"."tenant_notes" IS 'Local cache of Buildium tenant notes for offline access and search';



COMMENT ON COLUMN "public"."tenant_notes"."buildium_tenant_id" IS 'Buildium Tenant Id';



COMMENT ON COLUMN "public"."tenant_notes"."buildium_note_id" IS 'Buildium Note Id';



CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" bigint NOT NULL,
    "buildium_tenant_id" integer,
    "emergency_contact_name" "text",
    "emergency_contact_relationship" "text",
    "emergency_contact_phone" "text",
    "emergency_contact_email" "text",
    "comment" "text",
    "tax_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "sms_opt_in_status" boolean
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


COMMENT ON TABLE "public"."tenants" IS 'Tenant information linked to contacts';



COMMENT ON COLUMN "public"."tenants"."buildium_tenant_id" IS 'Unique identifier from Buildium API';



COMMENT ON COLUMN "public"."tenants"."sms_opt_in_status" IS 'SMS opt-in status mapped from Buildium (boolean)';



CREATE TABLE IF NOT EXISTS "public"."transaction_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_entity_id" integer,
    "account_entity_type" "public"."entity_type_enum" NOT NULL,
    "buildium_unit_id" integer,
    "date" "date" NOT NULL,
    "memo" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "transaction_id" "uuid",
    "gl_account_id" "uuid",
    "amount" numeric,
    "posting_type" character varying(10) NOT NULL,
    "property_id" "uuid",
    "unit_id" "uuid",
    "buildium_property_id" integer,
    "lease_id" bigint,
    "buildium_lease_id" integer,
    CONSTRAINT "journal_entries_posting_type_check" CHECK ((("posting_type")::"text" = ANY (ARRAY[('Credit'::character varying)::"text", ('Debit'::character varying)::"text"])))
);


ALTER TABLE "public"."transaction_lines" OWNER TO "postgres";


COMMENT ON TABLE "public"."transaction_lines" IS 'Transaction line items representing individual GL account postings within a transaction';



COMMENT ON COLUMN "public"."transaction_lines"."buildium_unit_id" IS 'Direct reference to Buildium unit ID';



COMMENT ON COLUMN "public"."transaction_lines"."transaction_id" IS 'Reference to the parent transaction';



COMMENT ON COLUMN "public"."transaction_lines"."gl_account_id" IS 'Reference to the GL account';



COMMENT ON COLUMN "public"."transaction_lines"."amount" IS 'Amount for this journal entry line';



COMMENT ON COLUMN "public"."transaction_lines"."posting_type" IS 'Indicates whether this line item is a Credit or Debit entry for proper double-entry bookkeeping';



COMMENT ON COLUMN "public"."transaction_lines"."property_id" IS 'Reference to local property record';



COMMENT ON COLUMN "public"."transaction_lines"."unit_id" IS 'Reference to local unit record';



COMMENT ON COLUMN "public"."transaction_lines"."buildium_property_id" IS 'Direct reference to Buildium property ID';



COMMENT ON COLUMN "public"."transaction_lines"."lease_id" IS 'Reference to local lease record';



COMMENT ON COLUMN "public"."transaction_lines"."buildium_lease_id" IS 'Direct reference to Buildium lease ID';



CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buildium_transaction_id" integer,
    "date" "date" NOT NULL,
    "transaction_type" "public"."transaction_type_enum" NOT NULL,
    "total_amount" numeric NOT NULL,
    "check_number" character varying(50),
    "payee_tenant_id" integer,
    "payment_method" "public"."payment_method_enum",
    "memo" "text",
    "buildium_bill_id" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "lease_id" bigint,
    "due_date" "date",
    "vendor_id" "uuid",
    "category_id" "uuid",
    "reference_number" character varying(255),
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "is_recurring" boolean DEFAULT false,
    "recurring_schedule" "jsonb",
    "buildium_lease_id" integer
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


COMMENT ON TABLE "public"."transactions" IS 'All financial transactions including bills, charges, credits, and payments. Use lease_id to connect to lease records. Bills and other property-level transactions may have lease_id = NULL.';



COMMENT ON COLUMN "public"."transactions"."lease_id" IS 'Reference to local lease record';



COMMENT ON COLUMN "public"."transactions"."due_date" IS 'Due date for bill transactions';



COMMENT ON COLUMN "public"."transactions"."vendor_id" IS 'Reference to vendor for bill transactions';



COMMENT ON COLUMN "public"."transactions"."category_id" IS 'Reference to bill category';



COMMENT ON COLUMN "public"."transactions"."reference_number" IS 'Reference number for bill transactions';



COMMENT ON COLUMN "public"."transactions"."status" IS 'Status of bill transaction (pending, paid, etc.)';



COMMENT ON COLUMN "public"."transactions"."is_recurring" IS 'Whether this is a recurring bill';



COMMENT ON COLUMN "public"."transactions"."recurring_schedule" IS 'JSON schedule for recurring bills';



COMMENT ON COLUMN "public"."transactions"."buildium_lease_id" IS 'Direct reference to Buildium lease ID for this transaction';



CREATE TABLE IF NOT EXISTS "public"."unit_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "buildium_image_id" integer NOT NULL,
    "name" "text",
    "description" "text",
    "file_type" "text",
    "file_size" integer,
    "is_private" boolean,
    "href" "text",
    "sort_index" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."unit_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unit_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "buildium_note_id" integer NOT NULL,
    "subject" "text",
    "body" "text",
    "is_private" boolean,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."unit_notes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_gl_trial_balance" AS
 SELECT "ga"."id" AS "gl_account_id",
    "ga"."buildium_gl_account_id",
    "ga"."account_number",
    "ga"."name",
    "ga"."type",
    "ga"."sub_type",
    COALESCE("sum"(
        CASE
            WHEN (("tl"."posting_type")::"text" = 'Debit'::"text") THEN "tl"."amount"
            ELSE (0)::numeric
        END), (0)::numeric) AS "debits",
    COALESCE("sum"(
        CASE
            WHEN (("tl"."posting_type")::"text" = 'Credit'::"text") THEN "tl"."amount"
            ELSE (0)::numeric
        END), (0)::numeric) AS "credits",
    (COALESCE("sum"(
        CASE
            WHEN (("tl"."posting_type")::"text" = 'Debit'::"text") THEN "tl"."amount"
            ELSE (0)::numeric
        END), (0)::numeric) - COALESCE("sum"(
        CASE
            WHEN (("tl"."posting_type")::"text" = 'Credit'::"text") THEN "tl"."amount"
            ELSE (0)::numeric
        END), (0)::numeric)) AS "balance"
   FROM ("public"."gl_accounts" "ga"
     LEFT JOIN "public"."transaction_lines" "tl" ON (("tl"."gl_account_id" = "ga"."id")))
  GROUP BY "ga"."id", "ga"."buildium_gl_account_id", "ga"."account_number", "ga"."name", "ga"."type", "ga"."sub_type";


ALTER VIEW "public"."v_gl_trial_balance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendor_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buildium_category_id" integer,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vendor_categories" OWNER TO "postgres";


COMMENT ON TABLE "public"."vendor_categories" IS 'Categories for organizing vendors';



COMMENT ON COLUMN "public"."vendor_categories"."buildium_category_id" IS 'Buildium API category ID for synchronization';



COMMENT ON COLUMN "public"."vendor_categories"."name" IS 'Category name';



COMMENT ON COLUMN "public"."vendor_categories"."description" IS 'Category description';



COMMENT ON COLUMN "public"."vendor_categories"."is_active" IS 'Whether the category is active';



CREATE TABLE IF NOT EXISTS "public"."work_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buildium_work_order_id" integer,
    "property_id" "uuid",
    "unit_id" "uuid",
    "subject" character varying(255) NOT NULL,
    "description" "text",
    "priority" character varying(20) DEFAULT 'medium'::character varying,
    "status" character varying(20) DEFAULT 'open'::character varying,
    "assigned_to" character varying(255),
    "estimated_cost" numeric(10,2),
    "actual_cost" numeric(10,2),
    "scheduled_date" timestamp with time zone,
    "completed_date" timestamp with time zone,
    "category" character varying(100),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."work_orders" OWNER TO "postgres";


COMMENT ON TABLE "public"."work_orders" IS 'Work orders for maintenance and repair work';



COMMENT ON COLUMN "public"."work_orders"."buildium_work_order_id" IS 'Buildium API work order ID for synchronization';



COMMENT ON COLUMN "public"."work_orders"."property_id" IS 'Property the work order is associated with';



COMMENT ON COLUMN "public"."work_orders"."unit_id" IS 'Unit the work order is associated with (optional)';



COMMENT ON COLUMN "public"."work_orders"."subject" IS 'Work order subject/title';



COMMENT ON COLUMN "public"."work_orders"."description" IS 'Detailed work order description';



COMMENT ON COLUMN "public"."work_orders"."priority" IS 'Work order priority: low, medium, high, urgent';



COMMENT ON COLUMN "public"."work_orders"."status" IS 'Work order status: open, in_progress, completed, cancelled';



COMMENT ON COLUMN "public"."work_orders"."assigned_to" IS 'Person assigned to the work order';



COMMENT ON COLUMN "public"."work_orders"."estimated_cost" IS 'Estimated cost for the work';



COMMENT ON COLUMN "public"."work_orders"."actual_cost" IS 'Actual cost incurred for the work';



COMMENT ON COLUMN "public"."work_orders"."scheduled_date" IS 'When the work is scheduled to be performed';



COMMENT ON COLUMN "public"."work_orders"."completed_date" IS 'When the work was completed';



COMMENT ON COLUMN "public"."work_orders"."category" IS 'Work order category (e.g., plumbing, electrical, hvac)';



COMMENT ON COLUMN "public"."work_orders"."notes" IS 'Additional notes about the work order';



ALTER TABLE ONLY "public"."contacts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."contacts_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."lease" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."Lease_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."staff" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."Staff_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."lease"
    ADD CONSTRAINT "Lease_buildium_lease_id_key" UNIQUE ("buildium_lease_id");



ALTER TABLE ONLY "public"."lease"
    ADD CONSTRAINT "Lease_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "Staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appliance_service_history"
    ADD CONSTRAINT "appliance_service_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appliances"
    ADD CONSTRAINT "appliances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bill_categories"
    ADD CONSTRAINT "bill_categories_buildium_category_id_key" UNIQUE ("buildium_category_id");



ALTER TABLE ONLY "public"."bill_categories"
    ADD CONSTRAINT "bill_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."buildium_api_cache"
    ADD CONSTRAINT "buildium_api_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."buildium_api_log"
    ADD CONSTRAINT "buildium_api_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lease"
    ADD CONSTRAINT "buildium_lease_id_unique" UNIQUE ("buildium_lease_id");



ALTER TABLE ONLY "public"."buildium_sync_status"
    ADD CONSTRAINT "buildium_sync_status_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."buildium_webhook_events"
    ADD CONSTRAINT "buildium_webhook_events_event_id_key" UNIQUE ("event_id");



ALTER TABLE ONLY "public"."buildium_webhook_events"
    ADD CONSTRAINT "buildium_webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gl_accounts"
    ADD CONSTRAINT "gl_accounts_buildium_gl_account_id_key" UNIQUE ("buildium_gl_account_id");



ALTER TABLE ONLY "public"."gl_accounts"
    ADD CONSTRAINT "gl_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gl_import_cursors"
    ADD CONSTRAINT "gl_import_cursors_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."inspections"
    ADD CONSTRAINT "inspections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_buildium_gl_entry_id_key" UNIQUE ("buildium_gl_entry_id");



ALTER TABLE ONLY "public"."transaction_lines"
    ADD CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lease"
    ADD CONSTRAINT "lease_buildium_lease_id_unique" UNIQUE ("buildium_lease_id");



ALTER TABLE ONLY "public"."lease_contacts"
    ADD CONSTRAINT "lease_contacts_lease_id_tenant_id_key" UNIQUE ("lease_id", "tenant_id");



ALTER TABLE ONLY "public"."lease_contacts"
    ADD CONSTRAINT "lease_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lease_notes"
    ADD CONSTRAINT "lease_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lease_recurring_transactions"
    ADD CONSTRAINT "lease_recurring_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."owners_list_cache"
    ADD CONSTRAINT "owners_list_cache_pkey" PRIMARY KEY ("owner_id");



ALTER TABLE ONLY "public"."owners"
    ADD CONSTRAINT "owners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ownerships"
    ADD CONSTRAINT "ownerships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ownerships"
    ADD CONSTRAINT "ownerships_property_id_owner_id_key" UNIQUE ("property_id", "owner_id");



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_buildium_property_id_unique" UNIQUE ("buildium_property_id");



COMMENT ON CONSTRAINT "properties_buildium_property_id_unique" ON "public"."properties" IS 'Ensures each Buildium property ID can only exist once in the database';



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_ownerships_cache"
    ADD CONSTRAINT "property_ownerships_cache_pkey" PRIMARY KEY ("ownership_id");



ALTER TABLE ONLY "public"."property_staff"
    ADD CONSTRAINT "property_staff_pkey" PRIMARY KEY ("property_id", "staff_id", "role");



ALTER TABLE ONLY "public"."rent_schedules"
    ADD CONSTRAINT "rent_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sync_operations"
    ADD CONSTRAINT "sync_operations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_categories"
    ADD CONSTRAINT "task_categories_buildium_category_id_key" UNIQUE ("buildium_category_id");



ALTER TABLE ONLY "public"."task_categories"
    ADD CONSTRAINT "task_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_history"
    ADD CONSTRAINT "task_history_buildium_history_id_key" UNIQUE ("buildium_history_id");



ALTER TABLE ONLY "public"."task_history_files"
    ADD CONSTRAINT "task_history_files_buildium_file_id_key" UNIQUE ("buildium_file_id");



ALTER TABLE ONLY "public"."task_history_files"
    ADD CONSTRAINT "task_history_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_history"
    ADD CONSTRAINT "task_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_buildium_task_id_key" UNIQUE ("buildium_task_id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_notes"
    ADD CONSTRAINT "tenant_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_buildium_tenant_id_key" UNIQUE ("buildium_tenant_id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_buildium_transaction_id_unique" UNIQUE ("buildium_transaction_id");



COMMENT ON CONSTRAINT "transactions_buildium_transaction_id_unique" ON "public"."transactions" IS 'Ensures each Buildium transaction ID is unique in the system';



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."unit_images"
    ADD CONSTRAINT "unit_images_buildium_image_id_key" UNIQUE ("buildium_image_id");



ALTER TABLE ONLY "public"."unit_images"
    ADD CONSTRAINT "unit_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."unit_notes"
    ADD CONSTRAINT "unit_notes_buildium_note_id_key" UNIQUE ("buildium_note_id");



ALTER TABLE ONLY "public"."unit_notes"
    ADD CONSTRAINT "unit_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "units_buildium_unit_id_key" UNIQUE ("buildium_unit_id");



ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "units_buildium_unit_id_unique" UNIQUE ("buildium_unit_id");



ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendor_categories"
    ADD CONSTRAINT "vendor_categories_buildium_category_id_key" UNIQUE ("buildium_category_id");



ALTER TABLE ONLY "public"."vendor_categories"
    ADD CONSTRAINT "vendor_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_buildium_vendor_id_key" UNIQUE ("buildium_vendor_id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."vendors"
    ADD CONSTRAINT "vendors_tax_address_country_is_valid" CHECK ("public"."is_valid_country"(("tax_address_country")::"text")) NOT VALID;



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_buildium_work_order_id_key" UNIQUE ("buildium_work_order_id");



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id");



CREATE INDEX "Lease_propertyId_idx" ON "public"."lease" USING "btree" ("property_id");



CREATE INDEX "Lease_unitId_status_idx" ON "public"."lease" USING "btree" ("unit_id", "status");



CREATE INDEX "Staff_buildium_user_id_idx" ON "public"."staff" USING "btree" ("buildium_user_id");



CREATE INDEX "appliance_service_history_appliance_id_idx" ON "public"."appliance_service_history" USING "btree" ("appliance_id");



CREATE INDEX "appliance_service_history_buildium_id_idx" ON "public"."appliance_service_history" USING "btree" ("buildium_service_history_id");



CREATE INDEX "appliances_buildium_appliance_id_idx" ON "public"."appliances" USING "btree" ("buildium_appliance_id");



CREATE INDEX "appliances_name_idx" ON "public"."appliances" USING "btree" ("name");



CREATE INDEX "appliances_property_id_idx" ON "public"."appliances" USING "btree" ("property_id");



CREATE INDEX "appliances_unit_id_idx" ON "public"."appliances" USING "btree" ("unit_id");



CREATE INDEX "bank_accounts_name_idx" ON "public"."bank_accounts" USING "btree" ("name");



CREATE INDEX "idx_bank_accounts_bank_account_type" ON "public"."bank_accounts" USING "btree" ("bank_account_type");



CREATE INDEX "idx_bank_accounts_buildium_bank_id" ON "public"."bank_accounts" USING "btree" ("buildium_bank_id");



CREATE INDEX "idx_bank_accounts_buildium_id" ON "public"."bank_accounts" USING "btree" ("buildium_bank_id");



CREATE INDEX "idx_bank_accounts_gl_account" ON "public"."bank_accounts" USING "btree" ("gl_account");



CREATE INDEX "idx_bank_accounts_last_source" ON "public"."bank_accounts" USING "btree" ("last_source");



CREATE INDEX "idx_bank_accounts_last_source_ts" ON "public"."bank_accounts" USING "btree" ("last_source_ts" DESC);



CREATE INDEX "idx_bank_accounts_name" ON "public"."bank_accounts" USING "btree" ("name");



CREATE INDEX "idx_bill_categories_active" ON "public"."bill_categories" USING "btree" ("is_active");



CREATE INDEX "idx_bill_categories_buildium_id" ON "public"."bill_categories" USING "btree" ("buildium_category_id");



CREATE INDEX "idx_bill_categories_name" ON "public"."bill_categories" USING "btree" ("name");



CREATE INDEX "idx_buildium_api_log_created" ON "public"."buildium_api_log" USING "btree" ("created_at");



CREATE INDEX "idx_buildium_api_log_endpoint" ON "public"."buildium_api_log" USING "btree" ("endpoint");



CREATE INDEX "idx_buildium_api_log_method" ON "public"."buildium_api_log" USING "btree" ("method");



CREATE INDEX "idx_buildium_api_log_status" ON "public"."buildium_api_log" USING "btree" ("response_status");



CREATE INDEX "idx_buildium_cache_created" ON "public"."buildium_api_cache" USING "btree" ("created_at");



CREATE INDEX "idx_buildium_cache_endpoint" ON "public"."buildium_api_cache" USING "btree" ("endpoint");



CREATE INDEX "idx_buildium_cache_expires" ON "public"."buildium_api_cache" USING "btree" ("expires_at");



CREATE INDEX "idx_buildium_sync_buildium_id" ON "public"."buildium_sync_status" USING "btree" ("buildium_id");



CREATE INDEX "idx_buildium_sync_entity" ON "public"."buildium_sync_status" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_buildium_sync_last_synced" ON "public"."buildium_sync_status" USING "btree" ("last_synced_at");



CREATE INDEX "idx_buildium_sync_status" ON "public"."buildium_sync_status" USING "btree" ("sync_status");



CREATE UNIQUE INDEX "idx_contacts_buildium_contact_id" ON "public"."contacts" USING "btree" ("buildium_contact_id") WHERE ("buildium_contact_id" IS NOT NULL);



CREATE INDEX "idx_contacts_name" ON "public"."contacts" USING "btree" ("last_name", "first_name");



CREATE INDEX "idx_contacts_primary_email" ON "public"."contacts" USING "btree" ("primary_email");



CREATE INDEX "idx_gl_accounts_active" ON "public"."gl_accounts" USING "btree" ("is_active");



CREATE INDEX "idx_gl_accounts_buildium_id" ON "public"."gl_accounts" USING "btree" ("buildium_gl_account_id");



CREATE INDEX "idx_gl_accounts_sub_accounts" ON "public"."gl_accounts" USING "gin" ("sub_accounts");



CREATE INDEX "idx_gl_accounts_type" ON "public"."gl_accounts" USING "btree" ("type");



CREATE INDEX "idx_journal_entries_gl_account_id" ON "public"."transaction_lines" USING "btree" ("gl_account_id");



CREATE INDEX "idx_journal_entries_transaction_id" ON "public"."transaction_lines" USING "btree" ("transaction_id");



CREATE INDEX "idx_lease_buildium_id" ON "public"."lease" USING "btree" ("buildium_lease_id");



CREATE INDEX "idx_lease_buildium_property_id" ON "public"."lease" USING "btree" ("buildium_property_id");



COMMENT ON INDEX "public"."idx_lease_buildium_property_id" IS 'Index on buildium_property_id for efficient lease queries by property';



CREATE INDEX "idx_lease_buildium_unit_id" ON "public"."lease" USING "btree" ("buildium_unit_id");



COMMENT ON INDEX "public"."idx_lease_buildium_unit_id" IS 'Index on buildium_unit_id for efficient lease queries by unit';



CREATE INDEX "idx_lease_contacts_lease_id" ON "public"."lease_contacts" USING "btree" ("lease_id");



CREATE INDEX "idx_lease_contacts_move_out_date" ON "public"."lease_contacts" USING "btree" ("move_out_date");



CREATE INDEX "idx_lease_contacts_notice_given_date" ON "public"."lease_contacts" USING "btree" ("notice_given_date");



CREATE INDEX "idx_lease_contacts_tenant_id" ON "public"."lease_contacts" USING "btree" ("tenant_id");



CREATE INDEX "idx_lease_notes_buildium_note_id" ON "public"."lease_notes" USING "btree" ("buildium_note_id");



CREATE INDEX "idx_lease_notes_lease_id" ON "public"."lease_notes" USING "btree" ("lease_id");



CREATE INDEX "idx_lease_recurring_buildium_recurring_id" ON "public"."lease_recurring_transactions" USING "btree" ("buildium_recurring_id");



CREATE INDEX "idx_lease_recurring_lease_id" ON "public"."lease_recurring_transactions" USING "btree" ("lease_id");



CREATE INDEX "idx_olc_display_name" ON "public"."owners_list_cache" USING "btree" ("display_name");



CREATE INDEX "idx_olc_email_lower" ON "public"."owners_list_cache" USING "btree" ("lower"("primary_email"));



CREATE INDEX "idx_owners_active" ON "public"."owners" USING "btree" ("is_active");



CREATE INDEX "idx_owners_buildium_id" ON "public"."owners" USING "btree" ("buildium_owner_id");



CREATE INDEX "idx_owners_buildium_owner_id" ON "public"."owners" USING "btree" ("buildium_owner_id");



CREATE INDEX "idx_owners_buildium_updated" ON "public"."owners" USING "btree" ("buildium_updated_at");



CREATE INDEX "idx_owners_contact_id" ON "public"."owners" USING "btree" ("contact_id");



CREATE INDEX "idx_owners_last_contacted" ON "public"."owners" USING "btree" ("last_contacted");



CREATE INDEX "idx_owners_tax_include1099" ON "public"."owners" USING "btree" ("tax_include1099");



CREATE INDEX "idx_ownerships_owner_id" ON "public"."ownerships" USING "btree" ("owner_id");



CREATE INDEX "idx_ownerships_property_id" ON "public"."ownerships" USING "btree" ("property_id");



CREATE INDEX "idx_poc_display_name" ON "public"."property_ownerships_cache" USING "btree" ("display_name");



CREATE INDEX "idx_poc_email_lower" ON "public"."property_ownerships_cache" USING "btree" ("lower"("primary_email"));



CREATE INDEX "idx_poc_property" ON "public"."property_ownerships_cache" USING "btree" ("property_id");



CREATE INDEX "idx_properties_active" ON "public"."properties" USING "btree" ("is_active");



CREATE INDEX "idx_properties_borough" ON "public"."properties" USING "btree" ("borough");



CREATE INDEX "idx_properties_buildium_property_id" ON "public"."properties" USING "btree" ("buildium_property_id");



CREATE INDEX "idx_properties_buildium_updated" ON "public"."properties" USING "btree" ("buildium_updated_at");



CREATE INDEX "idx_properties_location" ON "public"."properties" USING "btree" ("latitude", "longitude") WHERE (("latitude" IS NOT NULL) AND ("longitude" IS NOT NULL));



CREATE INDEX "idx_properties_neighborhood" ON "public"."properties" USING "btree" ("neighborhood");



CREATE INDEX "idx_properties_total_active_units" ON "public"."properties" USING "btree" ("total_active_units");



CREATE INDEX "idx_properties_total_inactive_units" ON "public"."properties" USING "btree" ("total_inactive_units");



CREATE INDEX "idx_properties_total_occupied_units" ON "public"."properties" USING "btree" ("total_occupied_units");



CREATE INDEX "idx_properties_total_vacant_units" ON "public"."properties" USING "btree" ("total_vacant_units");



CREATE INDEX "idx_properties_type" ON "public"."properties" USING "btree" ("property_type");



CREATE INDEX "idx_property_staff_property_id" ON "public"."property_staff" USING "btree" ("property_id");



CREATE INDEX "idx_property_staff_staff_id" ON "public"."property_staff" USING "btree" ("staff_id");



CREATE INDEX "idx_rent_schedules_buildium_id" ON "public"."rent_schedules" USING "btree" ("buildium_rent_id");



CREATE INDEX "idx_rent_schedules_end_date" ON "public"."rent_schedules" USING "btree" ("end_date");



CREATE INDEX "idx_rent_schedules_lease_id" ON "public"."rent_schedules" USING "btree" ("lease_id");



CREATE INDEX "idx_rent_schedules_start_date" ON "public"."rent_schedules" USING "btree" ("start_date");



CREATE INDEX "idx_sync_operations_created_at" ON "public"."sync_operations" USING "btree" ("created_at");



CREATE INDEX "idx_sync_operations_entity_buildium_id" ON "public"."sync_operations" USING "btree" ("entity", "buildium_id");



CREATE INDEX "idx_sync_operations_status" ON "public"."sync_operations" USING "btree" ("status");



CREATE INDEX "idx_task_categories_active" ON "public"."task_categories" USING "btree" ("is_active");



CREATE UNIQUE INDEX "idx_task_categories_buildium_category_id" ON "public"."task_categories" USING "btree" ("buildium_category_id") WHERE ("buildium_category_id" IS NOT NULL);



CREATE INDEX "idx_task_categories_buildium_id" ON "public"."task_categories" USING "btree" ("buildium_category_id");



CREATE UNIQUE INDEX "idx_task_categories_buildium_subcategory_id" ON "public"."task_categories" USING "btree" ("buildium_subcategory_id") WHERE ("buildium_subcategory_id" IS NOT NULL);



CREATE INDEX "idx_task_categories_name" ON "public"."task_categories" USING "btree" ("name");



CREATE INDEX "idx_task_history_buildium_id" ON "public"."task_history" USING "btree" ("buildium_history_id");



CREATE INDEX "idx_task_history_files_buildium_id" ON "public"."task_history_files" USING "btree" ("buildium_file_id");



CREATE INDEX "idx_task_history_files_history" ON "public"."task_history_files" USING "btree" ("task_history_id");



CREATE INDEX "idx_task_history_files_type" ON "public"."task_history_files" USING "btree" ("file_type");



CREATE INDEX "idx_task_history_status" ON "public"."task_history" USING "btree" ("status");



CREATE INDEX "idx_task_history_task" ON "public"."task_history" USING "btree" ("task_id");



CREATE INDEX "idx_tasks_assigned" ON "public"."tasks" USING "btree" ("assigned_to");



CREATE INDEX "idx_tasks_assigned_to_staff_id" ON "public"."tasks" USING "btree" ("assigned_to_staff_id");



CREATE INDEX "idx_tasks_buildium_id" ON "public"."tasks" USING "btree" ("buildium_task_id");



CREATE UNIQUE INDEX "idx_tasks_buildium_task_id_unique" ON "public"."tasks" USING "btree" ("buildium_task_id") WHERE ("buildium_task_id" IS NOT NULL);



CREATE INDEX "idx_tasks_category" ON "public"."tasks" USING "btree" ("category");



CREATE INDEX "idx_tasks_kind_status" ON "public"."tasks" USING "btree" ("task_kind", "status");



CREATE INDEX "idx_tasks_lease_id" ON "public"."tasks" USING "btree" ("lease_id");



CREATE INDEX "idx_tasks_owner_id" ON "public"."tasks" USING "btree" ("owner_id");



CREATE INDEX "idx_tasks_priority" ON "public"."tasks" USING "btree" ("priority");



CREATE INDEX "idx_tasks_property" ON "public"."tasks" USING "btree" ("property_id");



CREATE INDEX "idx_tasks_scheduled" ON "public"."tasks" USING "btree" ("scheduled_date");



CREATE INDEX "idx_tasks_status" ON "public"."tasks" USING "btree" ("status");



CREATE INDEX "idx_tasks_task_category_id" ON "public"."tasks" USING "btree" ("task_category_id");



CREATE INDEX "idx_tasks_tenant_id" ON "public"."tasks" USING "btree" ("tenant_id");



CREATE INDEX "idx_tasks_unit" ON "public"."tasks" USING "btree" ("unit_id");



CREATE INDEX "idx_tenant_notes_buildium_ids" ON "public"."tenant_notes" USING "btree" ("buildium_tenant_id", "buildium_note_id");



CREATE INDEX "idx_tenant_notes_tenant_id" ON "public"."tenant_notes" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenants_buildium_id" ON "public"."tenants" USING "btree" ("buildium_tenant_id");



CREATE INDEX "idx_tenants_contact_id" ON "public"."tenants" USING "btree" ("contact_id");



CREATE INDEX "idx_transaction_lines_buildium_lease_id" ON "public"."transaction_lines" USING "btree" ("buildium_lease_id");



CREATE INDEX "idx_transaction_lines_buildium_property_id" ON "public"."transaction_lines" USING "btree" ("buildium_property_id");



CREATE INDEX "idx_transaction_lines_buildium_unit_id" ON "public"."transaction_lines" USING "btree" ("buildium_unit_id");



CREATE INDEX "idx_transaction_lines_lease_id" ON "public"."transaction_lines" USING "btree" ("lease_id");



CREATE INDEX "idx_transaction_lines_property_id" ON "public"."transaction_lines" USING "btree" ("property_id");



CREATE INDEX "idx_transaction_lines_transaction_id" ON "public"."transaction_lines" USING "btree" ("transaction_id");



CREATE INDEX "idx_transaction_lines_unit_id" ON "public"."transaction_lines" USING "btree" ("unit_id");



CREATE INDEX "idx_transactions_buildium_lease_id" ON "public"."transactions" USING "btree" ("buildium_lease_id");



CREATE INDEX "idx_transactions_buildium_transaction_id" ON "public"."transactions" USING "btree" ("buildium_transaction_id");



CREATE INDEX "idx_transactions_category_id" ON "public"."transactions" USING "btree" ("category_id");



CREATE INDEX "idx_transactions_due_date" ON "public"."transactions" USING "btree" ("due_date");



CREATE INDEX "idx_transactions_lease_id" ON "public"."transactions" USING "btree" ("lease_id");



CREATE INDEX "idx_transactions_status" ON "public"."transactions" USING "btree" ("status");



CREATE INDEX "idx_transactions_vendor_id" ON "public"."transactions" USING "btree" ("vendor_id");



CREATE INDEX "idx_units_active" ON "public"."units" USING "btree" ("is_active");



CREATE INDEX "idx_units_buildium_id" ON "public"."units" USING "btree" ("buildium_unit_id");



CREATE INDEX "idx_units_buildium_updated" ON "public"."units" USING "btree" ("buildium_updated_at");



CREATE INDEX "idx_units_type" ON "public"."units" USING "btree" ("unit_type");



CREATE INDEX "idx_vendor_categories_active" ON "public"."vendor_categories" USING "btree" ("is_active");



CREATE INDEX "idx_vendor_categories_buildium_id" ON "public"."vendor_categories" USING "btree" ("buildium_category_id");



CREATE INDEX "idx_vendor_categories_name" ON "public"."vendor_categories" USING "btree" ("name");



CREATE INDEX "idx_vendors_active" ON "public"."vendors" USING "btree" ("is_active");



CREATE INDEX "idx_vendors_buildium_id" ON "public"."vendors" USING "btree" ("buildium_vendor_id");



CREATE INDEX "idx_vendors_category" ON "public"."vendors" USING "btree" ("buildium_category_id");



CREATE INDEX "idx_vendors_contact_id" ON "public"."vendors" USING "btree" ("contact_id");



CREATE INDEX "idx_vendors_expense_gl_account_id" ON "public"."vendors" USING "btree" ("expense_gl_account_id");



CREATE INDEX "idx_vendors_gl_account" ON "public"."vendors" USING "btree" ("gl_account");



CREATE INDEX "idx_vendors_vendor_category" ON "public"."vendors" USING "btree" ("vendor_category");



CREATE INDEX "idx_webhook_events_created" ON "public"."buildium_webhook_events" USING "btree" ("created_at");



CREATE INDEX "idx_webhook_events_processed" ON "public"."buildium_webhook_events" USING "btree" ("processed");



CREATE INDEX "idx_webhook_events_retry" ON "public"."buildium_webhook_events" USING "btree" ("retry_count");



CREATE INDEX "idx_webhook_events_type" ON "public"."buildium_webhook_events" USING "btree" ("event_type");



CREATE INDEX "idx_work_orders_assigned" ON "public"."work_orders" USING "btree" ("assigned_to");



CREATE INDEX "idx_work_orders_buildium_id" ON "public"."work_orders" USING "btree" ("buildium_work_order_id");



CREATE INDEX "idx_work_orders_category" ON "public"."work_orders" USING "btree" ("category");



CREATE INDEX "idx_work_orders_priority" ON "public"."work_orders" USING "btree" ("priority");



CREATE INDEX "idx_work_orders_property" ON "public"."work_orders" USING "btree" ("property_id");



CREATE INDEX "idx_work_orders_scheduled" ON "public"."work_orders" USING "btree" ("scheduled_date");



CREATE INDEX "idx_work_orders_status" ON "public"."work_orders" USING "btree" ("status");



CREATE INDEX "idx_work_orders_unit" ON "public"."work_orders" USING "btree" ("unit_id");



CREATE INDEX "inspections_property_idx" ON "public"."inspections" USING "btree" ("property");



CREATE INDEX "inspections_unit_id_idx" ON "public"."inspections" USING "btree" ("unit_id");



CREATE INDEX "inspections_unit_idx" ON "public"."inspections" USING "btree" ("unit");



CREATE INDEX "journal_entries_account_entity_id_idx" ON "public"."transaction_lines" USING "btree" ("account_entity_id");



CREATE INDEX "journal_entries_buildium_unit_id_idx" ON "public"."transaction_lines" USING "btree" ("buildium_unit_id");



CREATE INDEX "properties_deposit_trust_account_id_idx" ON "public"."properties" USING "btree" ("deposit_trust_account_id");



CREATE INDEX "properties_name_idx" ON "public"."properties" USING "btree" ("name");



CREATE INDEX "rent_schedules_lease_id_idx" ON "public"."rent_schedules" USING "btree" ("lease_id");



CREATE INDEX "unit_images_unit_id_idx" ON "public"."unit_images" USING "btree" ("unit_id");



CREATE INDEX "unit_notes_unit_id_idx" ON "public"."unit_notes" USING "btree" ("unit_id");



CREATE INDEX "units_property_id_idx" ON "public"."units" USING "btree" ("property_id");



CREATE INDEX "units_property_id_unit_number_key" ON "public"."units" USING "btree" ("property_id", "unit_number");



CREATE UNIQUE INDEX "uq_contacts_primary_email_lower" ON "public"."contacts" USING "btree" ("lower"("primary_email")) WHERE ("primary_email" IS NOT NULL);



CREATE UNIQUE INDEX "uq_owners_contact_id" ON "public"."owners" USING "btree" ("contact_id");



CREATE OR REPLACE TRIGGER "contacts_to_olc" AFTER UPDATE OF "first_name", "last_name", "company_name", "primary_email", "primary_phone" ON "public"."contacts" FOR EACH ROW EXECUTE FUNCTION "public"."trg_contacts_to_olc"();



CREATE OR REPLACE TRIGGER "contacts_to_poc" AFTER UPDATE OF "first_name", "last_name", "company_name", "primary_email" ON "public"."contacts" FOR EACH ROW EXECUTE FUNCTION "public"."trg_contacts_to_poc"();



CREATE OR REPLACE TRIGGER "owners_to_cache" AFTER INSERT OR UPDATE ON "public"."owners" FOR EACH ROW EXECUTE FUNCTION "public"."trg_owners_to_cache"();



CREATE OR REPLACE TRIGGER "ownerships_to_cache" AFTER INSERT OR UPDATE ON "public"."ownerships" FOR EACH ROW EXECUTE FUNCTION "public"."trg_ownerships_to_cache"();



CREATE OR REPLACE TRIGGER "set_gl_import_cursors_updated_at" BEFORE UPDATE ON "public"."gl_import_cursors" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_journal_entries_updated_at" BEFORE UPDATE ON "public"."journal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_appliances_updated_at" BEFORE UPDATE ON "public"."appliances" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_bank_accounts_updated_at" BEFORE UPDATE ON "public"."bank_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_bill_categories_updated_at" BEFORE UPDATE ON "public"."bill_categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_buildium_api_cache_updated_at" BEFORE UPDATE ON "public"."buildium_api_cache" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_buildium_sync_status_updated_at" BEFORE UPDATE ON "public"."buildium_sync_status" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_buildium_webhook_events_updated_at" BEFORE UPDATE ON "public"."buildium_webhook_events" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_contacts_display_name" BEFORE INSERT OR UPDATE ON "public"."contacts" FOR EACH ROW EXECUTE FUNCTION "public"."generate_display_name"();



CREATE OR REPLACE TRIGGER "trg_contacts_updated_at" BEFORE UPDATE ON "public"."contacts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_gl_accounts_updated_at" BEFORE UPDATE ON "public"."gl_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_inspections_updated_at" BEFORE UPDATE ON "public"."inspections" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_lease_contacts_updated_at" BEFORE UPDATE ON "public"."lease_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_lease_updated_at" BEFORE UPDATE ON "public"."lease" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_olc_updated_at" BEFORE UPDATE ON "public"."owners_list_cache" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_owners_list_cache_updated_at" BEFORE UPDATE ON "public"."owners_list_cache" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_owners_updated_at" BEFORE UPDATE ON "public"."owners" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ownerships_updated_at" BEFORE UPDATE ON "public"."ownerships" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_poc_updated_at" BEFORE UPDATE ON "public"."property_ownerships_cache" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_properties_updated_at" BEFORE UPDATE ON "public"."properties" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_property_ownerships_cache_updated_at" BEFORE UPDATE ON "public"."property_ownerships_cache" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_property_staff_updated_at" BEFORE UPDATE ON "public"."property_staff" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_rent_schedules_updated_at" BEFORE UPDATE ON "public"."rent_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_set_buildium_property_id" BEFORE INSERT OR UPDATE ON "public"."units" FOR EACH ROW EXECUTE FUNCTION "public"."set_buildium_property_id"();



CREATE OR REPLACE TRIGGER "trg_staff_updated_at" BEFORE UPDATE ON "public"."staff" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sync_operations_updated_at" BEFORE UPDATE ON "public"."sync_operations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_task_categories_updated_at" BEFORE UPDATE ON "public"."task_categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_task_history_files_updated_at" BEFORE UPDATE ON "public"."task_history_files" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_task_history_updated_at" BEFORE UPDATE ON "public"."task_history" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tasks_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tenants_updated_at" BEFORE UPDATE ON "public"."tenants" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_transaction_lines_updated_at" BEFORE UPDATE ON "public"."transaction_lines" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_transactions_updated_at" BEFORE UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_unit_images_updated_at" BEFORE UPDATE ON "public"."unit_images" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_unit_notes_updated_at" BEFORE UPDATE ON "public"."unit_notes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_units_updated_at" BEFORE UPDATE ON "public"."units" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_vendor_categories_updated_at" BEFORE UPDATE ON "public"."vendor_categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_vendors_updated_at" BEFORE UPDATE ON "public"."vendors" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_work_orders_updated_at" BEFORE UPDATE ON "public"."work_orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_ownerships_total_fields_delete" AFTER DELETE ON "public"."ownerships" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_update_owner_total_fields"();



CREATE OR REPLACE TRIGGER "trigger_ownerships_total_fields_insert" AFTER INSERT ON "public"."ownerships" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_update_owner_total_fields"();



CREATE OR REPLACE TRIGGER "trigger_ownerships_total_fields_update" AFTER UPDATE ON "public"."ownerships" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_update_owner_total_fields"();



CREATE OR REPLACE TRIGGER "trigger_properties_update_ownerships" AFTER UPDATE ON "public"."properties" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_update_ownerships_from_properties"();



CREATE OR REPLACE TRIGGER "trigger_units_comprehensive_counts" AFTER INSERT OR DELETE OR UPDATE ON "public"."units" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_update_property_unit_counts"();



CREATE OR REPLACE TRIGGER "trigger_update_rent_schedules_updated_at" BEFORE UPDATE ON "public"."rent_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."update_rent_schedules_updated_at"();



ALTER TABLE ONLY "public"."lease"
    ADD CONSTRAINT "Lease_propertyId_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");



ALTER TABLE ONLY "public"."lease"
    ADD CONSTRAINT "Lease_unitId_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."appliance_service_history"
    ADD CONSTRAINT "appliance_service_history_appliance_id_fkey" FOREIGN KEY ("appliance_id") REFERENCES "public"."appliances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appliances"
    ADD CONSTRAINT "appliances_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appliances"
    ADD CONSTRAINT "appliances_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_gl_account_fkey" FOREIGN KEY ("gl_account") REFERENCES "public"."gl_accounts"("id");



ALTER TABLE ONLY "public"."inspections"
    ADD CONSTRAINT "inspections_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_lines"
    ADD CONSTRAINT "journal_entries_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_lines"
    ADD CONSTRAINT "journal_entries_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "public"."lease"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_lines"
    ADD CONSTRAINT "journal_entries_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_lines"
    ADD CONSTRAINT "journal_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_transaction_id_fkey1" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_lines"
    ADD CONSTRAINT "journal_entries_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lease_contacts"
    ADD CONSTRAINT "lease_contacts_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "public"."lease"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lease_contacts"
    ADD CONSTRAINT "lease_contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lease_notes"
    ADD CONSTRAINT "lease_notes_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "public"."lease"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lease_recurring_transactions"
    ADD CONSTRAINT "lease_recurring_transactions_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "public"."lease"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."owners"
    ADD CONSTRAINT "owners_contact_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ownerships"
    ADD CONSTRAINT "ownerships_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ownerships"
    ADD CONSTRAINT "ownerships_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_deposit_trust_account_id_fkey" FOREIGN KEY ("deposit_trust_account_id") REFERENCES "public"."bank_accounts"("id");



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_operating_bank_account_id_fkey" FOREIGN KEY ("operating_bank_account_id") REFERENCES "public"."bank_accounts"("id");



ALTER TABLE ONLY "public"."property_staff"
    ADD CONSTRAINT "property_staff_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_staff"
    ADD CONSTRAINT "property_staff_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rent_schedules"
    ADD CONSTRAINT "rent_schedules_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "public"."lease"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_categories"
    ADD CONSTRAINT "task_categories_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."task_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_history_files"
    ADD CONSTRAINT "task_history_files_task_history_id_fkey" FOREIGN KEY ("task_history_id") REFERENCES "public"."task_history"("id");



ALTER TABLE ONLY "public"."task_history"
    ADD CONSTRAINT "task_history_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assigned_to_staff_fk" FOREIGN KEY ("assigned_to_staff_id") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_lease_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."lease"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_owner_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_requested_by_contact_fk" FOREIGN KEY ("requested_by_contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_task_category_fk" FOREIGN KEY ("task_category_id") REFERENCES "public"."task_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."tenant_notes"
    ADD CONSTRAINT "tenant_notes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."bill_categories"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "public"."lease"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id");



ALTER TABLE ONLY "public"."unit_images"
    ADD CONSTRAINT "unit_images_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unit_notes"
    ADD CONSTRAINT "unit_notes_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "units_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_gl_account_fkey" FOREIGN KEY ("gl_account") REFERENCES "public"."gl_accounts"("id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_vendor_category_fkey" FOREIGN KEY ("vendor_category") REFERENCES "public"."vendor_categories"("id");



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



CREATE POLICY "Allow all operations on appliances" ON "public"."appliances" USING (true);



CREATE POLICY "Allow all operations on inspections" ON "public"."inspections" USING (true);



CREATE POLICY "Allow all operations on journal_entries" ON "public"."transaction_lines" USING (true);



CREATE POLICY "Allow all operations on rent_schedules" ON "public"."rent_schedules" USING (true);



CREATE POLICY "Allow all operations on transactions" ON "public"."transactions" USING (true);



CREATE POLICY "Allow authenticated users to delete bank accounts" ON "public"."bank_accounts" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to insert bank accounts" ON "public"."bank_accounts" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to update bank accounts" ON "public"."bank_accounts" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to view bank accounts" ON "public"."bank_accounts" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable delete access for authenticated users" ON "public"."bank_accounts" FOR DELETE USING (true);



CREATE POLICY "Enable delete access for authenticated users" ON "public"."buildium_api_cache" FOR DELETE USING (true);



CREATE POLICY "Enable delete access for authenticated users" ON "public"."lease" FOR DELETE USING (true);



CREATE POLICY "Enable delete access for authenticated users" ON "public"."owners" FOR DELETE USING (true);



CREATE POLICY "Enable delete access for authenticated users" ON "public"."properties" FOR DELETE USING (true);



CREATE POLICY "Enable delete access for authenticated users" ON "public"."staff" FOR DELETE USING (true);



CREATE POLICY "Enable delete access for authenticated users" ON "public"."units" FOR DELETE USING (true);



CREATE POLICY "Enable insert access for authenticated users" ON "public"."bank_accounts" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert access for authenticated users" ON "public"."bill_categories" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert access for authenticated users" ON "public"."buildium_api_cache" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert access for authenticated users" ON "public"."buildium_api_log" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert access for authenticated users" ON "public"."buildium_sync_status" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert access for authenticated users" ON "public"."buildium_webhook_events" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert access for authenticated users" ON "public"."lease" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert access for authenticated users" ON "public"."owners" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert access for authenticated users" ON "public"."properties" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert access for authenticated users" ON "public"."staff" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert access for authenticated users" ON "public"."task_categories" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert access for authenticated users" ON "public"."task_history" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert access for authenticated users" ON "public"."task_history_files" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert access for authenticated users" ON "public"."tasks" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert access for authenticated users" ON "public"."units" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert access for authenticated users" ON "public"."vendor_categories" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert access for authenticated users" ON "public"."vendors" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert access for authenticated users" ON "public"."work_orders" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable read access for all users" ON "public"."bank_accounts" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."bill_categories" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."buildium_api_cache" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."buildium_api_log" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."buildium_sync_status" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."buildium_webhook_events" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."lease" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."owners" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."properties" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."staff" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."task_categories" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."task_history" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."task_history_files" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."tasks" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."units" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."vendor_categories" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."vendors" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."work_orders" FOR SELECT USING (true);



CREATE POLICY "Enable update access for authenticated users" ON "public"."bank_accounts" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Enable update access for authenticated users" ON "public"."bill_categories" FOR UPDATE USING (true);



CREATE POLICY "Enable update access for authenticated users" ON "public"."buildium_api_cache" FOR UPDATE USING (true);



CREATE POLICY "Enable update access for authenticated users" ON "public"."buildium_sync_status" FOR UPDATE USING (true);



CREATE POLICY "Enable update access for authenticated users" ON "public"."buildium_webhook_events" FOR UPDATE USING (true);



CREATE POLICY "Enable update access for authenticated users" ON "public"."lease" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Enable update access for authenticated users" ON "public"."owners" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Enable update access for authenticated users" ON "public"."properties" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Enable update access for authenticated users" ON "public"."staff" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Enable update access for authenticated users" ON "public"."task_categories" FOR UPDATE USING (true);



CREATE POLICY "Enable update access for authenticated users" ON "public"."task_history" FOR UPDATE USING (true);



CREATE POLICY "Enable update access for authenticated users" ON "public"."task_history_files" FOR UPDATE USING (true);



CREATE POLICY "Enable update access for authenticated users" ON "public"."tasks" FOR UPDATE USING (true);



CREATE POLICY "Enable update access for authenticated users" ON "public"."units" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Enable update access for authenticated users" ON "public"."vendor_categories" FOR UPDATE USING (true);



CREATE POLICY "Enable update access for authenticated users" ON "public"."vendors" FOR UPDATE USING (true);



CREATE POLICY "Enable update access for authenticated users" ON "public"."work_orders" FOR UPDATE USING (true);



CREATE POLICY "Owners delete policy" ON "public"."owners" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Owners insert policy" ON "public"."owners" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Owners list cache delete policy" ON "public"."owners_list_cache" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Owners list cache insert policy" ON "public"."owners_list_cache" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Owners list cache read policy" ON "public"."owners_list_cache" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Owners list cache update policy" ON "public"."owners_list_cache" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Owners read policy" ON "public"."owners" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Owners update policy" ON "public"."owners" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Ownerships delete policy" ON "public"."ownerships" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Ownerships insert policy" ON "public"."ownerships" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Ownerships read policy" ON "public"."ownerships" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Ownerships update policy" ON "public"."ownerships" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Property ownerships cache delete policy" ON "public"."property_ownerships_cache" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Property ownerships cache insert policy" ON "public"."property_ownerships_cache" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Property ownerships cache read policy" ON "public"."property_ownerships_cache" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Property ownerships cache update policy" ON "public"."property_ownerships_cache" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage sync operations" ON "public"."sync_operations" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Users can view sync operations for their org" ON "public"."sync_operations" FOR SELECT USING (true);



ALTER TABLE "public"."appliance_service_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "appliance_service_history_delete" ON "public"."appliance_service_history" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "appliance_service_history_insert" ON "public"."appliance_service_history" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "appliance_service_history_read" ON "public"."appliance_service_history" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "appliance_service_history_update" ON "public"."appliance_service_history" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."appliances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bank_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bill_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."buildium_api_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."buildium_api_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."buildium_sync_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."buildium_webhook_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "contacts_delete_policy" ON "public"."contacts" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "contacts_insert_policy" ON "public"."contacts" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "contacts_read_policy" ON "public"."contacts" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "contacts_update_policy" ON "public"."contacts" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."gl_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gl_accounts_delete_policy" ON "public"."gl_accounts" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



COMMENT ON POLICY "gl_accounts_delete_policy" ON "public"."gl_accounts" IS 'Allows authenticated users to delete GL accounts';



CREATE POLICY "gl_accounts_insert_policy" ON "public"."gl_accounts" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



COMMENT ON POLICY "gl_accounts_insert_policy" ON "public"."gl_accounts" IS 'Allows authenticated users to insert GL accounts';



CREATE POLICY "gl_accounts_read_policy" ON "public"."gl_accounts" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



COMMENT ON POLICY "gl_accounts_read_policy" ON "public"."gl_accounts" IS 'Allows authenticated users to read GL accounts';



CREATE POLICY "gl_accounts_update_policy" ON "public"."gl_accounts" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



COMMENT ON POLICY "gl_accounts_update_policy" ON "public"."gl_accounts" IS 'Allows authenticated users to update GL accounts';



ALTER TABLE "public"."inspections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lease" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lease_contacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lease_contacts_delete_policy" ON "public"."lease_contacts" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



COMMENT ON POLICY "lease_contacts_delete_policy" ON "public"."lease_contacts" IS 'Allows authenticated users to delete lease contacts';



CREATE POLICY "lease_contacts_insert_policy" ON "public"."lease_contacts" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



COMMENT ON POLICY "lease_contacts_insert_policy" ON "public"."lease_contacts" IS 'Allows authenticated users to insert lease contacts';



CREATE POLICY "lease_contacts_read_policy" ON "public"."lease_contacts" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



COMMENT ON POLICY "lease_contacts_read_policy" ON "public"."lease_contacts" IS 'Allows authenticated users to read lease contacts';



CREATE POLICY "lease_contacts_update_policy" ON "public"."lease_contacts" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



COMMENT ON POLICY "lease_contacts_update_policy" ON "public"."lease_contacts" IS 'Allows authenticated users to update lease contacts';



ALTER TABLE "public"."owners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."owners_list_cache" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "owners_list_cache_delete_policy" ON "public"."owners_list_cache" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "owners_list_cache_insert_policy" ON "public"."owners_list_cache" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "owners_list_cache_read_policy" ON "public"."owners_list_cache" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "owners_list_cache_update_policy" ON "public"."owners_list_cache" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."ownerships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ownerships_delete_policy" ON "public"."ownerships" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "ownerships_insert_policy" ON "public"."ownerships" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "ownerships_read_policy" ON "public"."ownerships" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "ownerships_update_policy" ON "public"."ownerships" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."properties" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."property_ownerships_cache" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "property_ownerships_cache_delete_policy" ON "public"."property_ownerships_cache" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "property_ownerships_cache_insert_policy" ON "public"."property_ownerships_cache" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "property_ownerships_cache_read_policy" ON "public"."property_ownerships_cache" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "property_ownerships_cache_update_policy" ON "public"."property_ownerships_cache" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."property_staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rent_schedules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rent_schedules_delete_policy" ON "public"."rent_schedules" FOR DELETE USING (true);



CREATE POLICY "rent_schedules_insert_policy" ON "public"."rent_schedules" FOR INSERT WITH CHECK (true);



CREATE POLICY "rent_schedules_read_policy" ON "public"."rent_schedules" FOR SELECT USING (true);



CREATE POLICY "rent_schedules_update_policy" ON "public"."rent_schedules" FOR UPDATE USING (true);



ALTER TABLE "public"."staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sync_operations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_history_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_notes_delete_policy" ON "public"."tenant_notes" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "tenant_notes_insert_policy" ON "public"."tenant_notes" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "tenant_notes_read_policy" ON "public"."tenant_notes" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "tenant_notes_update_policy" ON "public"."tenant_notes" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenants_delete_policy" ON "public"."tenants" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



COMMENT ON POLICY "tenants_delete_policy" ON "public"."tenants" IS 'Allows authenticated users to delete tenants';



CREATE POLICY "tenants_insert_policy" ON "public"."tenants" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



COMMENT ON POLICY "tenants_insert_policy" ON "public"."tenants" IS 'Allows authenticated users to insert tenants';



CREATE POLICY "tenants_read_policy" ON "public"."tenants" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



COMMENT ON POLICY "tenants_read_policy" ON "public"."tenants" IS 'Allows authenticated users to read tenants';



CREATE POLICY "tenants_update_policy" ON "public"."tenants" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



COMMENT ON POLICY "tenants_update_policy" ON "public"."tenants" IS 'Allows authenticated users to update tenants';



ALTER TABLE "public"."transaction_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."units" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vendor_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vendors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_orders" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



































































































































































































GRANT ALL ON FUNCTION "public"."calculate_owner_total_properties"("owner_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_owner_total_properties"("owner_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_owner_total_properties"("owner_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_owner_total_units"("owner_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_owner_total_units"("owner_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_owner_total_units"("owner_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."clear_expired_buildium_cache"() TO "anon";
GRANT ALL ON FUNCTION "public"."clear_expired_buildium_cache"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clear_expired_buildium_cache"() TO "service_role";



GRANT ALL ON FUNCTION "public"."count_active_units_for_property"("property_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."count_active_units_for_property"("property_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_active_units_for_property"("property_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_duplicate_buildium_ids"("table_name" "text", "buildium_field" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."find_duplicate_buildium_ids"("table_name" "text", "buildium_field" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_duplicate_buildium_ids"("table_name" "text", "buildium_field" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_duplicate_ownerships"() TO "anon";
GRANT ALL ON FUNCTION "public"."find_duplicate_ownerships"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_duplicate_ownerships"() TO "service_role";



GRANT ALL ON FUNCTION "public"."find_duplicate_units"() TO "anon";
GRANT ALL ON FUNCTION "public"."find_duplicate_units"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_duplicate_units"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_display_name"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_display_name"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_display_name"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_display_name"("first_name" "text", "last_name" "text", "company_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_display_name"("first_name" "text", "last_name" "text", "company_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_display_name"("first_name" "text", "last_name" "text", "company_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_buildium_api_cache"("p_endpoint" character varying, "p_parameters" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."get_buildium_api_cache"("p_endpoint" character varying, "p_parameters" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_buildium_api_cache"("p_endpoint" character varying, "p_parameters" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."gl_account_activity"("p_from" "date", "p_to" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."gl_account_activity"("p_from" "date", "p_to" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gl_account_activity"("p_from" "date", "p_to" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."gl_trial_balance_as_of"("p_as_of_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."gl_trial_balance_as_of"("p_as_of_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gl_trial_balance_as_of"("p_as_of_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_lease_payment_webhook"("event_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."handle_lease_payment_webhook"("event_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_lease_payment_webhook"("event_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_owner_webhook_update"("event_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."handle_owner_webhook_update"("event_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_owner_webhook_update"("event_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_property_webhook_update"("event_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."handle_property_webhook_update"("event_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_property_webhook_update"("event_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_task_status_webhook"("event_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."handle_task_status_webhook"("event_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_task_status_webhook"("event_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_unit_webhook_update"("event_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."handle_unit_webhook_update"("event_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_unit_webhook_update"("event_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_valid_country"("val" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_valid_country"("val" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_valid_country"("val" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_valid_country"("val" "public"."countries") TO "anon";
GRANT ALL ON FUNCTION "public"."is_valid_country"("val" "public"."countries") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_valid_country"("val" "public"."countries") TO "service_role";



GRANT ALL ON FUNCTION "public"."map_bill_to_buildium"("p_bill_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."map_bill_to_buildium"("p_bill_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."map_bill_to_buildium"("p_bill_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."map_owner_to_buildium"("p_owner_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."map_owner_to_buildium"("p_owner_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."map_owner_to_buildium"("p_owner_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."map_property_to_buildium"("p_property_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."map_property_to_buildium"("p_property_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."map_property_to_buildium"("p_property_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."map_task_to_buildium"("p_task_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."map_task_to_buildium"("p_task_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."map_task_to_buildium"("p_task_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."map_unit_to_buildium"("p_unit_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."map_unit_to_buildium"("p_unit_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."map_unit_to_buildium"("p_unit_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."map_vendor_to_buildium"("p_vendor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."map_vendor_to_buildium"("p_vendor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."map_vendor_to_buildium"("p_vendor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."map_work_order_to_buildium"("p_work_order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."map_work_order_to_buildium"("p_work_order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."map_work_order_to_buildium"("p_work_order_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_country"("val" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_country"("val" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_country"("val" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_buildium_webhook_event"("p_event_id" character varying, "p_event_type" character varying, "p_event_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."process_buildium_webhook_event"("p_event_id" character varying, "p_event_type" character varying, "p_event_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_buildium_webhook_event"("p_event_id" character varying, "p_event_type" character varying, "p_event_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_buildium_api_cache"("p_endpoint" character varying, "p_parameters" "jsonb", "p_response_data" "jsonb", "p_cache_duration_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."set_buildium_api_cache"("p_endpoint" character varying, "p_parameters" "jsonb", "p_response_data" "jsonb", "p_cache_duration_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_buildium_api_cache"("p_endpoint" character varying, "p_parameters" "jsonb", "p_response_data" "jsonb", "p_cache_duration_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_buildium_property_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_buildium_property_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_buildium_property_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_buildium_property_id"("p_entity_type" character varying, "p_entity_id" "uuid", "p_buildium_property_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."set_buildium_property_id"("p_entity_type" character varying, "p_entity_id" "uuid", "p_buildium_property_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_buildium_property_id"("p_entity_type" character varying, "p_entity_id" "uuid", "p_buildium_property_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_contacts_to_olc"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_contacts_to_olc"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_contacts_to_olc"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_contacts_to_poc"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_contacts_to_poc"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_contacts_to_poc"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_owners_to_cache"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_owners_to_cache"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_owners_to_cache"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_ownerships_to_cache"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_ownerships_to_cache"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_ownerships_to_cache"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_update_owner_total_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_update_owner_total_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_update_owner_total_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_update_ownerships_from_properties"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_update_ownerships_from_properties"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_update_ownerships_from_properties"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_update_property_total_units"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_update_property_total_units"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_update_property_total_units"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_update_property_unit_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_update_property_unit_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_update_property_unit_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_all_owners_total_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_all_owners_total_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_all_owners_total_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_all_properties_total_units"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_all_properties_total_units"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_all_properties_total_units"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_buildium_sync_status"("p_entity_type" character varying, "p_entity_id" "uuid", "p_buildium_id" integer, "p_status" character varying, "p_error_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_buildium_sync_status"("p_entity_type" character varying, "p_entity_id" "uuid", "p_buildium_id" integer, "p_status" character varying, "p_error_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_buildium_sync_status"("p_entity_type" character varying, "p_entity_id" "uuid", "p_buildium_id" integer, "p_status" character varying, "p_error_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_owner_total_fields"("owner_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_owner_total_fields"("owner_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_owner_total_fields"("owner_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_property_total_units"("property_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_property_total_units"("property_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_property_total_units"("property_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_property_unit_counts"("property_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_property_unit_counts"("property_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_property_unit_counts"("property_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_rent_schedules_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_rent_schedules_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_rent_schedules_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_owners_list_cache"("p_owner_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_owners_list_cache"("p_owner_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_owners_list_cache"("p_owner_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_property_ownerships_cache"("p_ownership_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_property_ownerships_cache"("p_ownership_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_property_ownerships_cache"("p_ownership_id" "uuid") TO "service_role";
























GRANT ALL ON TABLE "public"."lease" TO "anon";
GRANT ALL ON TABLE "public"."lease" TO "authenticated";
GRANT ALL ON TABLE "public"."lease" TO "service_role";



GRANT ALL ON SEQUENCE "public"."Lease_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."Lease_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."Lease_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."staff" TO "anon";
GRANT ALL ON TABLE "public"."staff" TO "authenticated";
GRANT ALL ON TABLE "public"."staff" TO "service_role";



GRANT ALL ON SEQUENCE "public"."Staff_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."Staff_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."Staff_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."appliance_service_history" TO "anon";
GRANT ALL ON TABLE "public"."appliance_service_history" TO "authenticated";
GRANT ALL ON TABLE "public"."appliance_service_history" TO "service_role";



GRANT ALL ON TABLE "public"."appliances" TO "anon";
GRANT ALL ON TABLE "public"."appliances" TO "authenticated";
GRANT ALL ON TABLE "public"."appliances" TO "service_role";



GRANT ALL ON TABLE "public"."bank_accounts" TO "anon";
GRANT ALL ON TABLE "public"."bank_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."bill_categories" TO "anon";
GRANT ALL ON TABLE "public"."bill_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."bill_categories" TO "service_role";



GRANT ALL ON TABLE "public"."buildium_api_cache" TO "anon";
GRANT ALL ON TABLE "public"."buildium_api_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."buildium_api_cache" TO "service_role";



GRANT ALL ON TABLE "public"."buildium_api_log" TO "anon";
GRANT ALL ON TABLE "public"."buildium_api_log" TO "authenticated";
GRANT ALL ON TABLE "public"."buildium_api_log" TO "service_role";



GRANT ALL ON TABLE "public"."buildium_sync_status" TO "anon";
GRANT ALL ON TABLE "public"."buildium_sync_status" TO "authenticated";
GRANT ALL ON TABLE "public"."buildium_sync_status" TO "service_role";



GRANT ALL ON TABLE "public"."buildium_webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."buildium_webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."buildium_webhook_events" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."contacts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."contacts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."contacts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."gl_accounts" TO "anon";
GRANT ALL ON TABLE "public"."gl_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."gl_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."gl_import_cursors" TO "anon";
GRANT ALL ON TABLE "public"."gl_import_cursors" TO "authenticated";
GRANT ALL ON TABLE "public"."gl_import_cursors" TO "service_role";



GRANT ALL ON TABLE "public"."inspections" TO "anon";
GRANT ALL ON TABLE "public"."inspections" TO "authenticated";
GRANT ALL ON TABLE "public"."inspections" TO "service_role";



GRANT ALL ON TABLE "public"."owners" TO "anon";
GRANT ALL ON TABLE "public"."owners" TO "authenticated";
GRANT ALL ON TABLE "public"."owners" TO "service_role";



GRANT ALL ON TABLE "public"."properties" TO "anon";
GRANT ALL ON TABLE "public"."properties" TO "authenticated";
GRANT ALL ON TABLE "public"."properties" TO "service_role";



GRANT ALL ON TABLE "public"."units" TO "anon";
GRANT ALL ON TABLE "public"."units" TO "authenticated";
GRANT ALL ON TABLE "public"."units" TO "service_role";



GRANT ALL ON TABLE "public"."vendors" TO "anon";
GRANT ALL ON TABLE "public"."vendors" TO "authenticated";
GRANT ALL ON TABLE "public"."vendors" TO "service_role";



GRANT ALL ON TABLE "public"."invalid_country_values" TO "anon";
GRANT ALL ON TABLE "public"."invalid_country_values" TO "authenticated";
GRANT ALL ON TABLE "public"."invalid_country_values" TO "service_role";



GRANT ALL ON TABLE "public"."journal_entries" TO "anon";
GRANT ALL ON TABLE "public"."journal_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_entries" TO "service_role";



GRANT ALL ON TABLE "public"."lease_contacts" TO "anon";
GRANT ALL ON TABLE "public"."lease_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."lease_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."lease_notes" TO "anon";
GRANT ALL ON TABLE "public"."lease_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."lease_notes" TO "service_role";



GRANT ALL ON TABLE "public"."lease_recurring_transactions" TO "anon";
GRANT ALL ON TABLE "public"."lease_recurring_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."lease_recurring_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."owners_list_cache" TO "anon";
GRANT ALL ON TABLE "public"."owners_list_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."owners_list_cache" TO "service_role";



GRANT ALL ON TABLE "public"."ownerships" TO "anon";
GRANT ALL ON TABLE "public"."ownerships" TO "authenticated";
GRANT ALL ON TABLE "public"."ownerships" TO "service_role";



GRANT ALL ON TABLE "public"."property_ownerships_cache" TO "anon";
GRANT ALL ON TABLE "public"."property_ownerships_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."property_ownerships_cache" TO "service_role";



GRANT ALL ON TABLE "public"."property_staff" TO "anon";
GRANT ALL ON TABLE "public"."property_staff" TO "authenticated";
GRANT ALL ON TABLE "public"."property_staff" TO "service_role";



GRANT ALL ON TABLE "public"."rent_schedules" TO "anon";
GRANT ALL ON TABLE "public"."rent_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."rent_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."sync_operations" TO "anon";
GRANT ALL ON TABLE "public"."sync_operations" TO "authenticated";
GRANT ALL ON TABLE "public"."sync_operations" TO "service_role";



GRANT ALL ON TABLE "public"."task_categories" TO "anon";
GRANT ALL ON TABLE "public"."task_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."task_categories" TO "service_role";



GRANT ALL ON TABLE "public"."task_history" TO "anon";
GRANT ALL ON TABLE "public"."task_history" TO "authenticated";
GRANT ALL ON TABLE "public"."task_history" TO "service_role";



GRANT ALL ON TABLE "public"."task_history_files" TO "anon";
GRANT ALL ON TABLE "public"."task_history_files" TO "authenticated";
GRANT ALL ON TABLE "public"."task_history_files" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_notes" TO "anon";
GRANT ALL ON TABLE "public"."tenant_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_notes" TO "service_role";



GRANT ALL ON TABLE "public"."tenants" TO "anon";
GRANT ALL ON TABLE "public"."tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."tenants" TO "service_role";



GRANT ALL ON TABLE "public"."transaction_lines" TO "anon";
GRANT ALL ON TABLE "public"."transaction_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_lines" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."unit_images" TO "anon";
GRANT ALL ON TABLE "public"."unit_images" TO "authenticated";
GRANT ALL ON TABLE "public"."unit_images" TO "service_role";



GRANT ALL ON TABLE "public"."unit_notes" TO "anon";
GRANT ALL ON TABLE "public"."unit_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."unit_notes" TO "service_role";



GRANT ALL ON TABLE "public"."v_gl_trial_balance" TO "anon";
GRANT ALL ON TABLE "public"."v_gl_trial_balance" TO "authenticated";
GRANT ALL ON TABLE "public"."v_gl_trial_balance" TO "service_role";



GRANT ALL ON TABLE "public"."vendor_categories" TO "anon";
GRANT ALL ON TABLE "public"."vendor_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."vendor_categories" TO "service_role";



GRANT ALL ON TABLE "public"."work_orders" TO "anon";
GRANT ALL ON TABLE "public"."work_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."work_orders" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
