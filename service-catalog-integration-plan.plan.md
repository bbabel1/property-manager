<!-- 6247718c-0b33-453d-8832-4377eb4575ab 454052a6-4efe-4baf-84b9-291d3ae5d47e -->

# Service Catalog Integration Implementation Plan

## Scope/Outcome

Integrate brochure services into a unified ServiceOffering catalog, align to plans (A-la-Carte, Basic, Full, Custom), add flexible pricing (per-property, per-unit, percent-of-rent, job-cost, hourly), extend automation with event triggers, consolidate management fees, and enrich profitability dashboards with service-level metrics—backward compatible via dual-write and feature flags.

## Current State (Key Points)

1. **Plans**: Full/Basic/A-la-carte (no Custom) in `properties.service_plan`, `units.service_plan`
2. **Offerings**: Legacy `management_services_enum` (Rent Collection, Maintenance, Turnovers, Compliance, Bill Pay, Condition Reports, Renewals) stored on properties/units; many brochure services missing
3. **Pricing**: Flat/percent per property/unit; no per-service pricing, hourly, or job-cost
4. **Logic**: `management-service.ts` assigns services; no service-level pricing or plan inclusion rules
5. **Fees**: `monthly-logs/.../management-fees` uses `fee_dollar_amount`/`fee_percentage`; no service-level billing
6. **Automation**: Recurring engine/tasks not plan/service-aware
7. **Dashboards**: No service-level revenue/cost/margin/utilization

## Target Catalog Mapping (Brochure → Offerings)

### Financial Management

- Preventative Maintenance → **Maintenance/Repair** (existing)
- Rent Invoicing & Collection → **Rent Collection** (existing)
- Budget Planning → **Budget Planning** (new)
- Monthly & Annual Reporting → **Reporting** (expand existing)
- Automated Bill Pay & Escrow → **Bill Pay & Escrow** (new)
- Mortgage Escrow Audit → **Escrow Audit** (new)

### Property Care

- Maintenance/Repair → **Maintenance/Repair** (existing)
- 24/7 Emergency Response → **Emergency Response** (new)
- Apartment Turnover → **Turnover** (existing)
- Condition Reports/Inspections → **Inspections** (extend: Move-In/Out/Annual)
- Property Insurance → **Property Insurance** (new)

### Resident Services

- Resident Support → **Resident Support Desk** (new)
- Resident Portal & App → **Portal** (existing)
- Leasing Services → **Leasing/Placement** (existing)
- Board Package Prep → **Board Package** (new)
- Lease Renewals → **Renewal** (existing)
- Move-In/Out Coordination → **Move Coordination** (new)
- Renters Insurance → **Renters Insurance** (new)

### Compliance & Legal

- Regulatory Compliance Management → **Compliance Audit** (existing)
- Tax & 1099 Support → **Tax & 1099** (new)
- Legal Support & Eviction Liaison → **Legal/Eviction Liaison** (new)

### Plan Defaults

- **A-la-Carte**: None required (pick individually)
- **Basic**: Rent Invoicing & Collection, Bill Pay & Escrow, Escrow Audit, Reporting, Resident Support Desk, Portal, Board Package, Lease Renewals, Move Coordination, Turnover, Condition Reports, Budget Planning
- **Full**: Basic + Emergency Response, Maintenance/Repair, Compliance Audit, Tax & 1099, Legal/Eviction Liaison
- **Custom**: User-defined bundles with overrides

## Implementation Tasks

### Phase 1: Service Catalog Expansion

#### 1.1 Extend ServicePlan Enum

**File**: `supabase/migrations/[timestamp]_add_custom_service_plan.sql`

- Add `'Custom'` to `service_plan_enum`:
  ```sql
  ALTER TYPE service_plan_enum ADD VALUE IF NOT EXISTS 'Custom';
  ```
- Update TypeScript types in `src/types/units.ts`:
  - Change `ServicePlan` type to include `'Custom'`
  - Update `SERVICE_PLAN_OPTIONS` constant to include `'Custom'`

#### 1.2 Create Comprehensive ServiceOffering Catalog

**File**: `supabase/migrations/[timestamp]_expand_service_offerings.sql`

- Ensure `btree_gist` extension for exclusion constraints:

  ```sql
  CREATE EXTENSION IF NOT EXISTS btree_gist;
  ```

- Create enums for type safety:

  ```sql
  CREATE TYPE billing_basis_enum AS ENUM (
    'per_property', 'per_unit', 'percent_rent', 'job_cost', 'hourly', 'one_time'
  );
  CREATE TYPE billing_frequency_enum AS ENUM (
    'monthly', 'annually', 'one_time', 'per_event', 'per_job', 'quarterly'
  );
  CREATE TYPE applies_to_enum AS ENUM (
    'property', 'unit', 'owner', 'building'
  );
  CREATE TYPE bill_on_enum AS ENUM (
    'calendar_day', 'event', 'job_close', 'lease_event', 'time_log'
  );
  CREATE TYPE rent_basis_enum AS ENUM (
    'scheduled', 'billed', 'collected'
  );
  ```

- Create `service_offerings` table with enum types:

  ```sql
  CREATE TABLE service_offerings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name varchar(100) NOT NULL,
    category varchar(50) NOT NULL, -- 'Property Care', 'Financial Management', 'Resident Services', 'Compliance & Legal'
    description text,
    billing_basis billing_basis_enum NOT NULL,
    default_rate numeric(12,2), -- Flat rate or percentage value
    default_freq billing_frequency_enum NOT NULL,
    min_amount numeric(12,2), -- Minimum fee cap
    max_amount numeric(12,2), -- Maximum fee cap
    applies_to applies_to_enum NOT NULL,
    bill_on bill_on_enum NOT NULL,
    markup_pct numeric(5,2), -- For job-cost basis
    markup_pct_cap numeric(5,2), -- Maximum markup percentage
    hourly_rate numeric(12,2), -- For hourly basis
    hourly_min_hours numeric(5,2), -- Minimum billable hours
    default_rent_basis rent_basis_enum DEFAULT 'scheduled', -- For percent_rent basis
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    -- Check constraints for basis-specific fields
    CONSTRAINT check_percent_rent_has_rate CHECK (
      billing_basis != 'percent_rent' OR default_rate IS NOT NULL
    ),
    CONSTRAINT check_job_cost_has_markup CHECK (
      billing_basis != 'job_cost' OR markup_pct IS NOT NULL
    ),
    CONSTRAINT check_hourly_has_rate CHECK (
      billing_basis != 'hourly' OR (hourly_rate IS NOT NULL AND hourly_min_hours IS NOT NULL)
    )
  );
  CREATE INDEX idx_service_offerings_category ON service_offerings(category);
  CREATE INDEX idx_service_offerings_billing_basis ON service_offerings(billing_basis);
  ```

- Create pseudo-offering for legacy fees (inactive, excluded from plan mappings):

  ```sql
  INSERT INTO service_offerings (code, name, category, billing_basis, default_freq, applies_to, bill_on, is_active)
  VALUES ('LEGACY_MGMT_FEE', 'Legacy Management Fee', 'Financial Management', 'percent_rent', 'monthly', 'property', 'calendar_day', false)
  ON CONFLICT (code) DO NOTHING;
  ```

- Seed service offerings with brochure mappings (see Target Catalog Mapping section above)

#### 1.3 Service-Plan Mapping Table

**File**: Same migration as 1.2

- Create `service_plan_offerings` junction table:

  ```sql
  CREATE TABLE service_plan_offerings (
    service_plan service_plan_enum NOT NULL,
    offering_id uuid REFERENCES service_offerings(id),
    is_included boolean DEFAULT true,
    is_optional boolean DEFAULT false,
    PRIMARY KEY (service_plan, offering_id)
  );
  CREATE INDEX idx_service_plan_offerings_plan ON service_plan_offerings(service_plan);
  CREATE INDEX idx_service_plan_offerings_offering ON service_plan_offerings(offering_id);
  ```

- Populate with brochure mappings:
  - **Basic**: Rent Invoicing & Collection, Bill Pay & Escrow, Escrow Audit, Reporting, Resident Support Desk, Portal, Board Package, Lease Renewals, Move Coordination, Turnover, Condition Reports, Budget Planning (all `is_included = true`, `is_optional = false`)
  - **Full**: All Basic services + Emergency Response, Maintenance/Repair, Compliance Audit, Tax & 1099, Legal/Eviction Liaison (all `is_included = true`, `is_optional = false`)
  - **A-la-Carte**: All services available individually (`is_included = false`, `is_optional = true`)
  - **Custom**: None by default (no seed data; configured per property)
  - **Exclude**: LEGACY_MGMT_FEE pseudo-offering from all plan mappings

### Phase 2: Pricing Model Implementation

#### 2.1 Create Pricing Configuration Tables

**File**: `supabase/migrations/[timestamp]_service_pricing_config.sql`

- Create `service_plan_default_pricing` table for plan-level defaults:

  ```sql
  CREATE TABLE service_plan_default_pricing (
    service_plan service_plan_enum NOT NULL,
    offering_id uuid REFERENCES service_offerings(id),
    billing_basis billing_basis_enum NOT NULL,
    default_rate numeric(12,2),
    default_freq billing_frequency_enum NOT NULL,
    min_amount numeric(12,2),
    max_amount numeric(12,2),
    bill_on bill_on_enum NOT NULL,
    rent_basis rent_basis_enum DEFAULT 'scheduled', -- For percent_rent basis
    min_monthly_fee numeric(12,2), -- For percent_rent plans (Basic/Full)
    plan_fee_percent numeric(5,2), -- For Basic (2.5%) and Full (4%) plans
    markup_pct numeric(5,2), -- For job-cost basis
    markup_pct_cap numeric(5,2), -- Maximum markup percentage
    hourly_rate numeric(12,2), -- For hourly basis
    hourly_min_hours numeric(5,2), -- Minimum billable hours
    is_included boolean DEFAULT true,
    is_required boolean DEFAULT false,
    PRIMARY KEY (service_plan, offering_id),
    -- Ensure plan_fee_percent is set for Basic/Full plan fees
    CONSTRAINT check_plan_fee_percent CHECK (
      (service_plan NOT IN ('Basic', 'Full') AND billing_basis != 'percent_rent')
      OR plan_fee_percent IS NOT NULL
    ),
    -- Ensure rent_basis is NOT NULL for percent_rent
    CONSTRAINT check_rent_basis_not_null CHECK (
      billing_basis != 'percent_rent' OR rent_basis IS NOT NULL
    )
  );
  CREATE INDEX idx_plan_default_pricing_plan ON service_plan_default_pricing(service_plan);
  CREATE INDEX idx_plan_default_pricing_offering ON service_plan_default_pricing(offering_id);
  ```

- Create `property_service_pricing` table with effective dating and enum consistency:

  ```sql
  CREATE TABLE property_service_pricing (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id uuid NOT NULL REFERENCES properties(id),
    unit_id uuid REFERENCES units(id), -- NULL for property-level
    offering_id uuid REFERENCES service_offerings(id),
    billing_basis billing_basis_enum NOT NULL,
    rate numeric(12,2), -- Flat rate or percentage value
    billing_frequency billing_frequency_enum NOT NULL,
    min_amount numeric(12,2), -- Minimum fee cap
    max_amount numeric(12,2), -- Maximum fee cap
    bill_on bill_on_enum NOT NULL,
    rent_basis rent_basis_enum DEFAULT 'scheduled', -- For percent_rent basis; NOT NULL when billing_basis='percent_rent'
    min_monthly_fee numeric(12,2), -- For percent_rent plans
    markup_pct numeric(5,2), -- For job-cost basis
    markup_pct_cap numeric(5,2), -- Maximum markup percentage
    hourly_rate numeric(12,2), -- For hourly basis
    hourly_min_hours numeric(5,2), -- Minimum billable hours
    is_active boolean DEFAULT true,
    effective_start timestamptz NOT NULL DEFAULT now(),
    effective_end timestamptz, -- NULL means currently active
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    -- Ensure rent_basis is NOT NULL for percent_rent
    CONSTRAINT check_rent_basis_not_null CHECK (
      billing_basis != 'percent_rent' OR rent_basis IS NOT NULL
    ),
    -- Exclusion constraint to prevent overlapping effective periods (requires btree_gist)
    EXCLUDE USING gist (
      property_id WITH =,
      unit_id WITH =,
      offering_id WITH =,
      tstzrange(effective_start, effective_end, '[)') WITH &&
    ) WHERE (unit_id IS NOT NULL),
    EXCLUDE USING gist (
      property_id WITH =,
      offering_id WITH =,
      tstzrange(effective_start, effective_end, '[)') WITH &&
    ) WHERE (unit_id IS NULL)
  );
  CREATE INDEX idx_property_service_pricing_property ON property_service_pricing(property_id);
  CREATE INDEX idx_property_service_pricing_unit ON property_service_pricing(unit_id) WHERE unit_id IS NOT NULL;
  CREATE INDEX idx_property_service_pricing_offering ON property_service_pricing(offering_id);
  CREATE INDEX idx_property_service_pricing_active ON property_service_pricing(property_id, unit_id, offering_id, is_active) WHERE is_active = true;
  CREATE INDEX idx_property_service_pricing_effective ON property_service_pricing USING gist (tstzrange(effective_start, effective_end));
  ```

- Create `billing_events` table early for dashboard and invoice generation:
  ```sql
  CREATE TABLE billing_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    property_id uuid REFERENCES properties(id),
    unit_id uuid REFERENCES units(id), -- NULL for property-level
    offering_id uuid REFERENCES service_offerings(id),
    plan_id service_plan_enum, -- For plan-level fees
    period_start date NOT NULL,
    period_end date NOT NULL,
    amount numeric(12,2) NOT NULL,
    source_basis billing_basis_enum NOT NULL, -- How amount was calculated
    rent_basis rent_basis_enum, -- For percent_rent calculations
    rent_amount numeric(12,2), -- Base rent used for calculation
    calculated_at timestamptz DEFAULT now(),
    invoiced_at timestamptz, -- When included in invoice
    transaction_id uuid REFERENCES transactions(id), -- Link to actual transaction
    created_at timestamptz DEFAULT now(),
    -- Prevent double-billing (includes org_id in uniqueness)
    UNIQUE(org_id, period_start, offering_id, property_id, unit_id)
  );
  CREATE INDEX idx_billing_events_org_period ON billing_events(org_id, period_start, offering_id);
  CREATE INDEX idx_billing_events_offering ON billing_events(offering_id);
  CREATE INDEX idx_billing_events_property ON billing_events(property_id);
  CREATE INDEX idx_billing_events_unit ON billing_events(unit_id) WHERE unit_id IS NOT NULL;
  CREATE INDEX idx_billing_events_plan ON billing_events(plan_id) WHERE plan_id IS NOT NULL;
  ```

#### 2.2 Pricing Calculation Logic

**File**: `src/lib/service-pricing.ts` (new)

- Implement `getActiveServicePricing()` function:
  - Fetch pricing config with effective dating
  - Query `property_service_pricing` where `is_active = true` and `effective_start <= now() AND (effective_end IS NULL OR effective_end > now())`
  - Fall back to `service_plan_default_pricing` if no property/unit override
  - Return pricing config with all fields (rate, frequency, min/max, rent_basis, etc.)

- Implement `calculateServiceFee()` function:
  - Check property/unit-level overrides first (`property_service_pricing`)
  - Fall back to plan defaults (`service_plan_default_pricing`)
  - Handle percentage-of-rent:
    - Single active lease: Use scheduled rent (exclude other charges)
    - Multiple active leases: Sum scheduled rent, cap at market rent
    - No active lease: Fee = $0 (or market_rent fallback if configured)
    - Apply `min_monthly_fee` if calculated fee is below minimum
    - Respect `rent_basis` (scheduled/billed/collected)
  - Handle percentage-of-cost:
    - Requires job cost
    - Apply `markup_pct` with `markup_pct_cap` maximum
  - Handle hourly rates:
    - Requires time tracking
    - Apply `hourly_min_hours` minimum
  - Apply `min_amount` and `max_amount` caps
  - Edge cases:
    - Zero-rent units: Use `min_monthly_fee` or fallback flat rate
    - Vacant units: Suspend per-unit fees except readiness tasks
    - Multiple leases: Sum scheduled rent capped at market rent
    - No active lease: Fee = $0

#### 2.3 Pricing Override Management

**File**: `src/app/api/service-pricing/route.ts` (new)

- GET: Fetch pricing configuration for property/unit (with effective dating)
- PUT: Update pricing overrides (creates new effective-dated record, sets `effective_end` on previous)
- POST: Create custom pricing for A-la-Carte services (creates new effective-dated record)
- DELETE: Deactivate pricing (sets `effective_end` to now())

### Phase 3: Service Configuration Integration

#### 3.1 Extend Property/Unit Configuration

**File**: `supabase/migrations/[timestamp]_extend_service_config.sql`

- **No schema changes needed** - Custom plan offerings are stored in `property_service_pricing` table with `is_active = true`
- Query active offerings via `property_service_pricing` where `is_active = true` and `effective_start <= now() AND (effective_end IS NULL OR effective_end > now())`
- Custom plan configuration is managed entirely through `property_service_pricing` records (no JSONB)

#### 3.2 Update ManagementService Class

**File**: `src/lib/management-service.ts`

- Extend `ManagementServiceConfig` interface:
  - Add `service_offerings: ServiceOffering[]`
  - Add `pricing_config: ServicePricingConfig[]`
  - Add `plan_defaults: ServicePlanDefaults`
- Update `getServiceConfiguration()` to:
  - Fetch service offerings from catalog (`service_offerings`)
  - Apply plan-based inclusion rules (`service_plan_offerings`)
  - For Custom plan: Load active offerings from `property_service_pricing` (is_active + effective window)
  - Load pricing configuration from `property_service_pricing` (with effective dating)
- Add `getServicePricing()` method
- Add feature flag support: `USE_NEW_SERVICE_CATALOG` (env var, for dual-read/write later)

#### 3.3 Service Configuration UI

**File**: `src/components/management/ServiceOfferingConfig.tsx` (new)

- Display service offerings by category
- Show plan-based inclusions (`service_plan_offerings`)
- Allow selection for A-la-Carte and Custom plans
- Display pricing for each service (from `property_service_pricing` or defaults)
- Allow pricing overrides (creates new effective-dated records)
- Show effective dating for pricing changes

### Phase 4: Automation Logic Extension

#### 4.1 Service-Based Recurring Task Rules

**File**: `supabase/migrations/[timestamp]_service_automation_rules.sql`

- Create enums for automation rules:

  ```sql
  CREATE TYPE automation_rule_type_enum AS ENUM (
    'recurring_task', 'recurring_charge', 'workflow_trigger'
  );
  CREATE TYPE automation_frequency_enum AS ENUM (
    'monthly', 'quarterly', 'annually', 'on_event', 'weekly', 'biweekly'
  );
  ```

- Extend `monthly_log_task_rules` table:
  ```sql
  ALTER TABLE monthly_log_task_rules
    ADD COLUMN IF NOT EXISTS service_offering_id uuid REFERENCES service_offerings(id),
    ADD COLUMN IF NOT EXISTS trigger_on_service_activation boolean DEFAULT false;
  CREATE INDEX idx_monthly_log_task_rules_offering ON monthly_log_task_rules(service_offering_id) WHERE service_offering_id IS NOT NULL;
  ```
- Create `service_automation_rules` table with enum types:

  ```sql
  CREATE TABLE service_automation_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    offering_id uuid REFERENCES service_offerings(id),
    rule_type automation_rule_type_enum NOT NULL,
    frequency automation_frequency_enum NOT NULL,
    task_template jsonb,
    charge_template jsonb,
    conditions jsonb,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
  CREATE INDEX idx_automation_rules_offering ON service_automation_rules(offering_id);
  CREATE INDEX idx_automation_rules_active ON service_automation_rules(offering_id, is_active) WHERE is_active = true;
  ```

- Create `property_automation_overrides` table for per-property/unit automation rule overrides (normalized, avoid unbounded JSON):
  ```sql
  CREATE TABLE property_automation_overrides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id uuid REFERENCES properties(id),
    unit_id uuid REFERENCES units(id), -- NULL for property-level
    offering_id uuid REFERENCES service_offerings(id),
    rule_id uuid REFERENCES service_automation_rules(id),
    override_config jsonb NOT NULL, -- Specific override configuration (bounded schema)
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(property_id, unit_id, offering_id, rule_id)
  );
  CREATE INDEX idx_automation_overrides_property ON property_automation_overrides(property_id);
  CREATE INDEX idx_automation_overrides_unit ON property_automation_overrides(unit_id) WHERE unit_id IS NOT NULL;
  CREATE INDEX idx_automation_overrides_offering ON property_automation_overrides(offering_id);
  ```

#### 4.2 Automation Engine Updates

**File**: `src/lib/service-automation.ts` (new)

- Implement `generateServiceBasedTasks()`:
  - Check active service offerings for property/unit (from `property_service_pricing` with effective dating)
  - Apply automation rules for each active service (`service_automation_rules`)
  - Check for property/unit overrides (`property_automation_overrides`)
  - Generate recurring tasks based on service configuration
  - Respect effective dating (only generate for active periods)
  - Skip inactive offerings

- Implement `generateServiceBasedCharges()`:
  - Calculate service fees based on pricing model (via `service-pricing.ts`)
  - Create `billing_events` records first
  - Prevent duplicate billing (check `billing_events` uniqueness on org_id, period_start, offering_id, property_id, unit_id)
  - Create recurring charges for monthly services
  - Handle one-time service charges
  - Respect effective dates

- Integrate with existing `generateRecurringCharges()`

#### 4.3 Service Event Handlers

**File**: `src/lib/service-events.ts` (new)

- Handle service activation/deactivation events
- Trigger automation rules on service changes
- Create initial tasks/charges when service activated (next billing cycle, no proration)
- Clean up tasks/charges when service deactivated
- Handle mid-period activation: Bill starting next period only (no proration)

### Phase 5: Management Services & Fees Consolidation

#### 5.1 Current Implementation Analysis

**Files to Review**:

- `src/app/api/monthly-logs/[logId]/management-fees/route.ts`
- `src/app/api/monthly-logs/[logId]/management-fees/generate/route.ts`
- `src/lib/monthly-log-calculations.ts`

**Findings**:

- Fees calculated from `fee_dollar_amount` or `fee_percentage`
- Stored as transactions with memo "management fee"
- No service-level breakdown
- No distinction between plan fee and individual service fees

#### 5.2 Refactored Fee Calculation

**File**: `src/lib/service-fee-calculation.ts` (new)

- Implement `calculateManagementFees()`:
  - For Basic/Full plans: Calculate percentage of rent via `service_plan_default_pricing.plan_fee_percent`
  - Apply `min_monthly_fee` for percent_rent plans
  - For A-la-Carte: Sum individual service fees (from `property_service_pricing`)
  - For Custom: Calculate based on custom configuration (`property_service_pricing`)
  - Edge cases:
    - Zero rent: Use `min_monthly_fee` or $0
    - Multiple leases: Sum scheduled rent capped at market rent
    - Vacant units: Suspend per-unit fees except readiness tasks
    - No active lease: Fee = $0

- Implement `generateServiceFeeTransactions()`:
  - Create `billing_events` records first (with org_id, period_start, offering_id, property_id, unit_id)
  - Create separate transactions for each service fee (or aggregated plan fee)
  - Link transactions to `service_offering_id` and `plan_id`
  - Set `fee_category` (plan_fee, service_fee, override, legacy)
  - Store `legacy_memo` for backward compatibility
  - Support both aggregated (plan fee) and itemized (service fees) views
- Maintain backward compatibility with existing fee structure

#### 5.3 Fee Transaction Schema Updates

**File**: `supabase/migrations/[timestamp]_service_fee_tracking.sql`

- Create enum for fee categories:

  ```sql
  CREATE TYPE fee_category_enum AS ENUM (
    'plan_fee', 'service_fee', 'override', 'legacy'
  );
  ```

- Add columns to `transactions` table:

  ```sql
  ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS service_offering_id uuid REFERENCES service_offerings(id),
    ADD COLUMN IF NOT EXISTS plan_id service_plan_enum,
    ADD COLUMN IF NOT EXISTS fee_category fee_category_enum,
    ADD COLUMN IF NOT EXISTS legacy_memo text; -- Preserve original memo for backward compatibility
  ```

- Create indexes for service fee queries:

  ```sql
  CREATE INDEX idx_transactions_service_offering ON transactions(service_offering_id) WHERE service_offering_id IS NOT NULL;
  CREATE INDEX idx_transactions_plan_id ON transactions(plan_id) WHERE plan_id IS NOT NULL;
  CREATE INDEX idx_transactions_fee_category ON transactions(fee_category) WHERE fee_category IS NOT NULL;
  ```

- Create view for backward compatibility (aggregates plan fees):

  ```sql
  CREATE VIEW v_legacy_management_fees AS
  SELECT
    monthly_log_id,
    SUM(total_amount) as total_management_fee,
    plan_id,
    array_agg(DISTINCT service_offering_id) FILTER (WHERE service_offering_id IS NOT NULL) as offering_ids
  FROM transactions
  WHERE fee_category IN ('plan_fee', 'legacy')
    AND memo ILIKE '%management fee%'
  GROUP BY monthly_log_id, plan_id;
  ```

- Create `service_fee_history` table for audit trail:

  ```sql
  CREATE TABLE service_fee_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id uuid REFERENCES transactions(id),
    billing_event_id uuid REFERENCES billing_events(id),
    offering_id uuid REFERENCES service_offerings(id),
    plan_id service_plan_enum,
    amount numeric(12,2) NOT NULL,
    calculation_details jsonb, -- Store calculation inputs for audit
    created_at timestamptz DEFAULT now()
  );
  CREATE INDEX idx_fee_history_transaction ON service_fee_history(transaction_id);
  CREATE INDEX idx_fee_history_billing_event ON service_fee_history(billing_event_id);
  ```

- Pseudo-offering `LEGACY_MGMT_FEE` already created in Phase 1.2 (inactive, excluded from plan mappings)

#### 5.4 Consolidation Strategy

- Keep existing `fee_dollar_amount`/`fee_percentage` for backward compatibility
- Add new service-level fee tracking alongside existing structure
- Migrate existing fees to new structure gradually (via Phase 7)
- Update UI to show both aggregated and itemized views
- Use `v_legacy_management_fees` view for backward compatibility

### Phase 6: Profitability Dashboard Enhancement

#### 6.1 Service-Level Metrics Views

**File**: `supabase/migrations/[timestamp]_service_metrics.sql`

- **Note**: `billing_events` table (created in Phase 2.1) serves as the source of truth for revenue tracking
- Create materialized views that join `billing_events` with payments, jobs, and time logs (use `REFRESH CONCURRENTLY`):

  ```sql
  -- Revenue by property/unit/owner/offering
  CREATE MATERIALIZED VIEW v_service_revenue_by_property AS
  SELECT
    be.org_id,
    be.property_id,
    be.offering_id,
    be.period_start,
    be.period_end,
    SUM(be.amount) as revenue_amount,
    COUNT(DISTINCT be.unit_id) as unit_count,
    COUNT(DISTINCT be.id) as billing_event_count
  FROM billing_events be
  WHERE be.invoiced_at IS NOT NULL
  GROUP BY be.org_id, be.property_id, be.offering_id, be.period_start, be.period_end;

  CREATE UNIQUE INDEX ON v_service_revenue_by_property (org_id, property_id, offering_id, period_start, period_end);

  CREATE MATERIALIZED VIEW v_service_revenue_by_unit AS
  SELECT
    be.org_id,
    be.property_id,
    be.unit_id,
    be.offering_id,
    be.period_start,
    be.period_end,
    SUM(be.amount) as revenue_amount,
    COUNT(be.id) as billing_event_count
  FROM billing_events be
  WHERE be.unit_id IS NOT NULL AND be.invoiced_at IS NOT NULL
  GROUP BY be.org_id, be.property_id, be.unit_id, be.offering_id, be.period_start, be.period_end;

  CREATE UNIQUE INDEX ON v_service_revenue_by_unit (org_id, property_id, unit_id, offering_id, period_start, period_end);

  CREATE MATERIALIZED VIEW v_service_revenue_by_owner AS
  SELECT
    be.org_id,
    p.id as property_id,
    po.owner_id,
    be.offering_id,
    be.period_start,
    be.period_end,
    SUM(be.amount * COALESCE(po.ownership_percentage, 100) / 100) as revenue_amount
  FROM billing_events be
  JOIN properties p ON p.id = be.property_id
  LEFT JOIN property_owners po ON po.property_id = p.id
  WHERE be.invoiced_at IS NOT NULL
  GROUP BY be.org_id, p.id, po.owner_id, be.offering_id, be.period_start, be.period_end;

  CREATE UNIQUE INDEX ON v_service_revenue_by_owner (org_id, property_id, owner_id, offering_id, period_start, period_end);

  CREATE MATERIALIZED VIEW v_service_revenue_by_offering AS
  SELECT
    be.org_id,
    be.offering_id,
    so.name as offering_name,
    so.category,
    be.period_start,
    be.period_end,
    SUM(be.amount) as revenue_amount,
    COUNT(DISTINCT be.property_id) as property_count,
    COUNT(DISTINCT be.unit_id) FILTER (WHERE be.unit_id IS NOT NULL) as unit_count
  FROM billing_events be
  JOIN service_offerings so ON so.id = be.offering_id
  WHERE be.invoiced_at IS NOT NULL
  GROUP BY be.org_id, be.offering_id, so.name, so.category, be.period_start, be.period_end;

  CREATE UNIQUE INDEX ON v_service_revenue_by_offering (org_id, offering_id, period_start, period_end);

  -- Cost tracking (join with work orders/jobs for job-cost basis, time logs for hourly)
  CREATE MATERIALIZED VIEW v_service_costs AS
  SELECT
    be.org_id,
    be.property_id,
    be.unit_id,
    be.offering_id,
    be.period_start,
    be.period_end,
    -- Job-cost basis: sum from work orders
    SUM(CASE
      WHEN be.source_basis = 'job_cost' THEN wo.total_cost
      ELSE 0
    END) as job_cost_amount,
    -- Hourly basis: sum from time logs
    SUM(CASE
      WHEN be.source_basis = 'hourly' THEN tl.hours * tl.rate
      ELSE 0
    END) as hourly_cost_amount,
    -- Total cost
    COALESCE(SUM(CASE
      WHEN be.source_basis = 'job_cost' THEN wo.total_cost
      WHEN be.source_basis = 'hourly' THEN tl.hours * tl.rate
      ELSE 0
    END), 0) as total_cost_amount
  FROM billing_events be
  LEFT JOIN work_orders wo ON wo.id = be.job_id AND be.source_basis = 'job_cost'
  LEFT JOIN time_logs tl ON tl.billing_event_id = be.id AND be.source_basis = 'hourly'
  GROUP BY be.org_id, be.property_id, be.unit_id, be.offering_id, be.period_start, be.period_end;

  CREATE UNIQUE INDEX ON v_service_costs (org_id, property_id, unit_id, offering_id, period_start, period_end);

  -- Combined profitability view
  CREATE MATERIALIZED VIEW v_service_profitability AS
  SELECT
    rev.org_id,
    rev.property_id,
    rev.unit_id,
    rev.offering_id,
    rev.period_start,
    rev.period_end,
    rev.revenue_amount,
    COALESCE(cost.total_cost_amount, 0) as cost_amount,
    rev.revenue_amount - COALESCE(cost.total_cost_amount, 0) as margin_amount,
    CASE
      WHEN rev.revenue_amount > 0
      THEN (rev.revenue_amount - COALESCE(cost.total_cost_amount, 0)) / rev.revenue_amount * 100
      ELSE 0
    END as margin_percentage
  FROM v_service_revenue_by_unit rev
  LEFT JOIN v_service_costs cost ON
    cost.org_id = rev.org_id AND
    cost.property_id = rev.property_id AND
    cost.unit_id = rev.unit_id AND
    cost.offering_id = rev.offering_id AND
    cost.period_start = rev.period_start AND
    cost.period_end = rev.period_end;

  CREATE UNIQUE INDEX ON v_service_profitability (org_id, property_id, unit_id, offering_id, period_start, period_end);

  -- Create indexes on base tables for performance (join keys)
  CREATE INDEX idx_service_revenue_org_period ON billing_events(org_id, period_start, offering_id);
  CREATE INDEX idx_service_revenue_property ON billing_events(property_id, period_start);
  CREATE INDEX idx_service_revenue_unit ON billing_events(unit_id, period_start) WHERE unit_id IS NOT NULL;
  ```

#### 6.2 Revenue Calculation Jobs

**File**: `src/server/jobs/calculate-service-revenue.ts` (new)

- Monthly job to refresh materialized views using `REFRESH MATERIALIZED VIEW CONCURRENTLY`:
  - Refresh `v_service_revenue_by_property`
  - Refresh `v_service_revenue_by_unit`
  - Refresh `v_service_revenue_by_owner`
  - Refresh `v_service_revenue_by_offering`
  - Refresh `v_service_costs`
  - Refresh `v_service_profitability`
- Note: Revenue data comes from `billing_events` table (populated during fee calculation)
- Costs are calculated by joining `billing_events` with work orders (job-cost) and time logs (hourly)

#### 6.3 Dashboard API Extensions

**File**: `src/app/api/dashboard/[orgId]/service-metrics/route.ts` (new)

- GET endpoint returning:
  - Service revenue by property/unit/owner (from materialized views)
  - Service costs and margins (from `v_service_profitability`)
  - Service utilization metrics (from `billing_events` count)
  - Top performing services (from `v_service_revenue_by_offering`)
  - Service profitability trends (time-series from materialized views)

#### 6.4 Dashboard UI Components

**File**: `src/components/dashboard/ServiceProfitabilityCard.tsx` (new)

- Display service-level revenue, cost, margin (from `v_service_profitability`)
- Show utilization metrics (billing event counts)
- Filter by property, unit, owner, service offering
- Time period selector (monthly, quarterly, annually)
- Link to detailed service breakdown

### Phase 7: Data Migration & Backward Compatibility

#### 7.1 Schema Creation & Initial Backfill (Early - After Phase 2)

**File**: `supabase/migrations/[timestamp]_migrate_existing_services.sql`

- Map existing `management_services_enum` values to new `service_offerings`:
  - Create mapping records in `service_offerings` for all existing enum values
  - Map to appropriate brochure service names (see Target Catalog Mapping)
- Backfill `service_plan_offerings` with Basic/Full plan defaults (see Plan Defaults section)
- Backfill `service_plan_default_pricing` with plan-level pricing defaults:
  - Basic: 2.5% of monthly gross rent (`plan_fee_percent = 2.5`), `min_monthly_fee` as configured
  - Full: 4% of monthly gross rent (`plan_fee_percent = 4.0`), `min_monthly_fee` as configured
- Migrate `properties.included_services` to `property_service_pricing`:
  - For each service in `included_services` array, create `property_service_pricing` record
  - Set `is_active = true`, `effective_start = now()`
  - Link to appropriate `service_offerings` via mapping
- Migrate `units.active_services` to `property_service_pricing`:
  - Parse `active_services` text (JSON or comma-separated)
  - For each service, create `property_service_pricing` record
  - Set `is_active = true`, `effective_start = now()`
  - Link to appropriate `service_offerings` via mapping
- Preserve existing fee calculations during transition
- Create legacy fee mapping: Link existing "management fee" transactions to pseudo-offering (`LEGACY_MGMT_FEE`)

#### 7.2 Dual-Write Implementation (Early - After Phase 7.1)

**File**: `src/lib/service-compatibility.ts` (new)

- Implement dual-write functions:
  - `writeServiceFeeDual()` - Writes to both old and new structures
  - `readServiceFeeDual()` - Reads from new structure, falls back to old
  - `migrateLegacyConfig()` - Converts old config to new format
- Update `src/lib/management-service.ts`:
  - Add feature flag check: `USE_NEW_SERVICE_CATALOG` (env var)
  - When enabled, use new `service_offerings` catalog
  - When disabled, use legacy `management_services_enum`
  - Dual-write: Always write to new structure, conditionally read from new
- Update `src/app/api/monthly-logs/[logId]/management-fees/generate/route.ts`:
  - Add feature flag check
  - When enabled, create `billing_events` and link transactions to `service_offering_id`
  - When disabled, use existing fee calculation logic
  - Dual-write: Always create `billing_events` when flag is on, conditionally use for transaction creation
- Add feature flag configuration in environment variables: `USE_NEW_SERVICE_CATALOG=true/false`

#### 7.3 Backward Compatibility Layer

**File**: `src/lib/service-compatibility.ts` (continued)

- Provide compatibility functions:
  - `getLegacyServiceList()` - Returns old enum format from new catalog
  - `getLegacyFeeCalculation()` - Uses old fee logic when feature flag disabled
  - `convertLegacyToNew()` - Converts legacy config to new format for migration
- Create compatibility views:
  - `v_legacy_management_fees` - Aggregates plan fees for backward compatibility (already created in Phase 5.3)
  - `v_legacy_service_list` - Returns services in old enum format

#### 7.4 Full Cutover (Late - After Phase 6)

**File**: `supabase/migrations/[timestamp]_complete_migration_cutover.sql`

- Validate all data has been migrated successfully:
  - Check all properties have corresponding `property_service_pricing` records
  - Check all units have corresponding `property_service_pricing` records
  - Verify `billing_events` are being created for all fee calculations
  - Compare legacy fee totals with new fee totals (should match)
  - Check for duplicate billing events per period/offering/property/unit/org
  - Validate no overlapping effective ranges in `property_service_pricing`
- Update all remaining API endpoints to use new structure
- Remove feature flags (or set default to enabled)
- Create migration validation report
- Archive legacy fee calculation logic (keep for reference, mark as deprecated)

### Phase 8: Testing & Validation

#### 8.1 Unit Tests

**Files**: `src/lib/__tests__/service-pricing.test.ts`, `src/lib/__tests__/service-automation.test.ts`

- Test pricing calculations for all models:
  - Flat per-property, flat per-unit
  - Percentage of rent (with `min_monthly_fee`, multiple leases, no lease, rent_basis rules)
  - Percentage of cost (with markup caps)
  - Hourly (with minimum hours)
- Test service plan inclusion rules
- Test automation rule triggers
- Test fee calculation logic (Basic/Full/A-la-Carte/Custom)
- Test effective dating logic
- Test edge cases:
  - Zero rent, vacant units
  - Multiple leases (sum capped at market rent)
  - No active lease (fee = $0)
  - Proration rules (no proration, next cycle activation)

#### 8.2 Integration Tests

**Files**: `tests/integration/service-configuration.test.ts`

- Test property/unit service configuration
- Test pricing override logic
- Test automation rule execution
- Test dashboard metrics calculation
- Test dual-write functionality
- Test migration scripts

#### 8.3 Data Validation Scripts

**File**: `scripts/validate-service-migration.ts`

- Validate service catalog completeness
- Validate pricing configuration integrity
- Validate no overlapping effective ranges in `property_service_pricing`
- Validate rent_basis parity checks (NOT NULL when billing_basis='percent_rent')
- Validate duplicate billing event check per period/offering/property/unit/org
- Validate dashboard totals sanity (revenue matches billing_events, costs match work orders/time logs)
- Generate validation report

## Execution Order (Reconciled)

1. **Phase 1**: Service Catalog Expansion (catalog + enums)
2. **Phase 2**: Pricing Model Implementation (pricing tables, billing_events, logic stubs)
3. **Phase 7.1**: Schema Creation & Initial Backfill (backfill mappings)
4. **Phase 7.2**: Dual-Write Implementation (dual-write flag + compatibility helpers)
5. **Phase 3**: Service Configuration Integration (config integration + UI)
6. **Phase 4**: Automation Logic Extension (automation)
7. **Phase 5**: Management Services & Fees Consolidation (fee consolidation)
8. **Phase 6**: Profitability Dashboard Enhancement (dashboards)
9. **Phase 7.4**: Full Cutover (cutover)
10. **Phase 8**: Testing & Validation (tests/validation)

## Design Principles

1. **No JSONB for Core Relationships**: Use relational tables (`property_service_pricing`) instead of JSONB for queryability and indexing
2. **Billing Events as Revenue Source of Truth**: Use `billing_events` table for all revenue tracking; prevent double-billing via uniqueness constraint (includes org_id)
3. **Effective Dating via Ranges**: Use `tstzrange` exclusion constraints to prevent overlapping periods; no proration; next-cycle activation
4. **Backward Compatibility**: Via feature flag (`USE_NEW_SERVICE_CATALOG`) and pseudo-offering (`LEGACY_MGMT_FEE`)
5. **Percent-of-Rent Rules**:
   - Single lease → scheduled rent (exclude other charges)
   - Multiple leases → sum scheduled rent capped at market rent
   - No lease → $0 (or market_rent fallback if configured)
   - Apply `min_monthly_fee` for percent_rent plans
6. **Enum Consistency**: Use enums throughout (billing_basis, billing_frequency, bill_on, etc.) to prevent drift
7. **Materialized Views**: Use `REFRESH CONCURRENTLY` with unique indexes for performance
8. **Operational Requirements**:
   - Ensure `btree_gist` extension for exclusion constraints
   - Add `rent_basis NOT NULL` constraint when `billing_basis='percent_rent'`
   - `plan_fee_percent` required on plan-fee rows (Basic/Full)
   - Billing events uniqueness includes `org_id`
   - Keep legacy pseudo-offering inactive and out of plan mappings

## Resolved Questions

1. **Custom plan pricing**: Stored as individual `property_service_pricing` records (not JSONB)
2. **Percentage-of-rent calculation**:
   - Single active lease: Use scheduled rent (exclude other charges)
   - Multiple active leases: Sum scheduled rent capped at market rent
   - No active lease: Fee = $0 (or market_rent fallback if configured)
   - Apply `min_monthly_fee` for percent_rent plans
3. **Service activation billing**: New services activated mid-cycle begin billing on the next scheduled billing cycle (no proration)
4. **Proration**: No proration for mid-period activation/deactivation (bill starting next period only)
5. **Automation rules**: Live at service offering level (default) with optional property/unit overrides via `property_automation_overrides`

### To-dos

- [ ] Phase 1: Expand service catalog - Add Custom plan, create service_offerings table, create service_plan_offerings mapping, migrate existing services
- [ ] Phase 2: Implement pricing models - Create property_service_pricing table, implement pricing calculation logic, create pricing API endpoints
- [ ] Phase 7.1: Schema creation & initial backfill - Create new tables, backfill mappings, enable dual-write
- [ ] Phase 7.2: Dual-write implementation - Implement feature-flagged dual-write in management-service.ts and fee generation endpoints
- [ ] Phase 3: Integrate service configuration - Extend property/unit config (no schema changes), update ManagementService class, create ServiceOfferingConfig UI component
- [ ] Phase 4: Extend automation logic - Create service_automation_rules table with enums, implement service-based task/charge generation, create service event handlers
- [ ] Phase 5: Consolidate Management Services & Fees - Analyze current implementation, refactor fee calculation, update transaction schema with plan_id and legacy mapping, implement backward compatibility
- [ ] Phase 6: Enhance profitability dashboards - Create materialized views from billing_events, implement revenue calculation jobs, create dashboard API and UI components
- [ ] Phase 7.3: Backward compatibility layer - Create compatibility functions and views
- [ ] Phase 7.4: Full cutover - Complete migration, remove feature flags, validate data integrity
- [ ] Phase 8: Testing and validation - Write unit tests, integration tests, create data validation scripts
