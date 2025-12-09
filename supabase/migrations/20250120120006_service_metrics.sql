-- Create service-level metrics materialized views
-- Part of Phase 6.1: Service-Level Metrics Views
-- Creates materialized views for revenue, cost, and profitability tracking

BEGIN;

-- Ensure btree_gist extension (should already exist from Phase 2)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Revenue by property/unit/owner/offering
-- Note: billing_events table (created in Phase 2.1) serves as the source of truth for revenue tracking

CREATE MATERIALIZED VIEW IF NOT EXISTS v_service_revenue_by_property AS
SELECT 
  be.org_id,
  be.property_id,
  be.offering_id,
  be.period_start,
  be.period_end,
  SUM(be.amount) as revenue_amount,
  COUNT(DISTINCT be.unit_id) FILTER (WHERE be.unit_id IS NOT NULL) as unit_count,
  COUNT(DISTINCT be.id) as billing_event_count
FROM billing_events be
WHERE be.invoiced_at IS NOT NULL
GROUP BY be.org_id, be.property_id, be.offering_id, be.period_start, be.period_end;

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_revenue_by_property_unique 
  ON v_service_revenue_by_property (org_id, property_id, offering_id, period_start, period_end);

CREATE MATERIALIZED VIEW IF NOT EXISTS v_service_revenue_by_unit AS
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_revenue_by_unit_unique 
  ON v_service_revenue_by_unit (org_id, property_id, unit_id, offering_id, period_start, period_end);

CREATE MATERIALIZED VIEW IF NOT EXISTS v_service_revenue_by_owner AS
SELECT 
  be.org_id,
  p.id as property_id,
  o.owner_id,
  be.offering_id,
  be.period_start,
  be.period_end,
  SUM(be.amount * COALESCE(o.ownership_percentage, 100) / 100) as revenue_amount
FROM billing_events be
JOIN properties p ON p.id = be.property_id
LEFT JOIN ownerships o ON o.property_id = p.id
WHERE be.invoiced_at IS NOT NULL
GROUP BY be.org_id, p.id, o.owner_id, be.offering_id, be.period_start, be.period_end;

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_revenue_by_owner_unique 
  ON v_service_revenue_by_owner (org_id, property_id, owner_id, offering_id, period_start, period_end);

CREATE MATERIALIZED VIEW IF NOT EXISTS v_service_revenue_by_offering AS
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_revenue_by_offering_unique 
  ON v_service_revenue_by_offering (org_id, offering_id, period_start, period_end);

-- Cost tracking (simplified - cost data will be populated separately)
-- Note: job_id column can be added to billing_events in a future migration if needed
-- For now, this view provides the structure but costs will be calculated separately
CREATE MATERIALIZED VIEW IF NOT EXISTS v_service_costs AS
SELECT 
  be.org_id,
  be.property_id,
  be.unit_id,
  be.offering_id,
  be.period_start,
  be.period_end,
  -- Job-cost basis: placeholder for future work order integration
  0::numeric(12,2) as job_cost_amount,
  -- Hourly basis: placeholder for future time log integration  
  0::numeric(12,2) as hourly_cost_amount,
  -- Total cost: placeholder
  0::numeric(12,2) as total_cost_amount
FROM billing_events be
GROUP BY be.org_id, be.property_id, be.unit_id, be.offering_id, be.period_start, be.period_end;

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_costs_unique 
  ON v_service_costs (org_id, property_id, unit_id, offering_id, period_start, period_end);

-- Combined profitability view
CREATE MATERIALIZED VIEW IF NOT EXISTS v_service_profitability AS
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_profitability_unique 
  ON v_service_profitability (org_id, property_id, unit_id, offering_id, period_start, period_end);

-- Create indexes on base tables for performance (join keys)
-- Note: Some indexes may already exist from Phase 2.1, but ensuring they're present
CREATE INDEX IF NOT EXISTS idx_service_revenue_org_period 
  ON billing_events(org_id, period_start, offering_id);

CREATE INDEX IF NOT EXISTS idx_service_revenue_property 
  ON billing_events(property_id, period_start);

CREATE INDEX IF NOT EXISTS idx_service_revenue_unit 
  ON billing_events(unit_id, period_start) 
  WHERE unit_id IS NOT NULL;

COMMENT ON MATERIALIZED VIEW v_service_revenue_by_property IS 'Service revenue aggregated by property, offering, and period.';
COMMENT ON MATERIALIZED VIEW v_service_revenue_by_unit IS 'Service revenue aggregated by unit, offering, and period.';
COMMENT ON MATERIALIZED VIEW v_service_revenue_by_owner IS 'Service revenue allocated to owners based on ownership percentage.';
COMMENT ON MATERIALIZED VIEW v_service_revenue_by_offering IS 'Service revenue aggregated by offering and period.';
COMMENT ON MATERIALIZED VIEW v_service_costs IS 'Service costs from work orders (job-cost) and time logs (hourly).';
COMMENT ON MATERIALIZED VIEW v_service_profitability IS 'Service profitability (revenue, cost, margin) by unit, offering, and period.';

COMMIT;

