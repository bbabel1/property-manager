# Dashboard Smoke Test Checklist

**Date**: 2025-01-31  
**Purpose**: Verify dashboard functionality after cleanup migration and view fixes

---

## Pre-Test Setup

1. Ensure migrations are applied:
   - `20291225000000_cleanup_unused_schema.sql`
   - `20291225000003_fix_dashboard_kpis_view.sql`

2. Access dashboard with a user that has org access

---

## Test Checklist

### 1. KPI Cards (Top Section)

**Test**: Verify KPI cards display correctly

- [ ] **Total Properties**: Shows correct count
- [ ] **Total Units**: Shows correct count
- [ ] **Occupied Units**: Shows correct count
- [ ] **Available Units**: Shows correct count
- [ ] **Occupancy Rate**: Shows correct percentage
- [ ] **Monthly Rent Roll**: Shows correct amount
- [ ] **Active Leases**: Shows correct count
- [ ] **Growth Rate**: Shows percentage or null (if no previous month data)
- [ ] **Open Work Orders**: Shows correct count
- [ ] **Urgent Work Orders**: Shows correct count

**Expected Behavior**:
- If `v_dashboard_kpis` view works: Data loads from view
- If view fails: Fallback to `buildKpisFromTables()` should work
- No errors in console or network requests

**Verification Query**:
```sql
-- Check if view exists and has data
SELECT * FROM v_dashboard_kpis WHERE org_id = '<your-org-id>';
```

---

### 2. Renewals Section

**Test**: Verify lease renewals summary displays

- [ ] **Critical (0-30 days)**: Shows correct count
- [ ] **Upcoming (31-60 days)**: Shows correct count
- [ ] **Future (61-90 days)**: Shows correct count

**Expected Behavior**:
- Data loads from `v_lease_renewals_summary` view
- No errors if view is empty (should show 0s)

**Verification Query**:
```sql
SELECT * FROM v_lease_renewals_summary WHERE org_id = '<your-org-id>';
```

---

### 3. Onboarding Section

**Test**: Verify onboarding section handles missing view gracefully

- [ ] **In Progress**: Shows 0 or null (view was dropped)
- [ ] **Pending Approval**: Shows 0 or null
- [ ] **Overdue**: Shows 0 or null

**Expected Behavior**:
- Should return `null` gracefully (view was dropped in cleanup)
- No errors in console
- UI should handle null/empty state

**Note**: This is expected behavior since `v_property_onboarding_summary` was dropped along with `property_onboarding` tables.

---

### 4. Recent Transactions

**Test**: Verify recent transactions list displays

- [ ] **Transaction List**: Shows recent transactions (last 7 days by default)
- [ ] **Transaction Details**: Date, amount, memo, type display correctly
- [ ] **Sorting**: Transactions sorted by date (newest first)
- [ ] **Limit**: Shows max 50 transactions

**Expected Behavior**:
- Data loads from `v_recent_transactions_ranked` view
- No errors if no transactions

**Verification Query**:
```sql
SELECT * FROM v_recent_transactions_ranked 
WHERE org_id = '<your-org-id>' 
ORDER BY date DESC, created_at DESC 
LIMIT 50;
```

---

### 5. Work Orders

**Test**: Verify active work orders list displays

- [ ] **Work Order List**: Shows top 5 active work orders
- [ ] **Work Order Details**: Subject, description, priority, status display correctly
- [ ] **Ranking**: Work orders ranked correctly

**Expected Behavior**:
- Data loads from `v_active_work_orders_ranked` view
- Shows top 5 (rn <= 5)
- No errors if no work orders

**Verification Query**:
```sql
SELECT * FROM v_active_work_orders_ranked 
WHERE org_id = '<your-org-id>' AND rn <= 5
ORDER BY rn;
```

---

### 6. Expiring Leases

**Test**: Verify expiring leases buckets display

- [ ] **0-30 days bucket**: Shows correct counts by stage
- [ ] **31-60 days bucket**: Shows correct counts by stage
- [ ] **61-90 days bucket**: Shows correct counts by stage
- [ ] **All bucket**: Shows total counts

**Expected Behavior**:
- Data loads from `lease` table directly (not a view)
- Buckets calculated correctly based on `lease_to_date`
- Stages: notStarted, offers, renewals, moveOuts

**Verification Query**:
```sql
SELECT 
  id, 
  lease_to_date, 
  renewal_offer_status, 
  status,
  lease_to_date - CURRENT_DATE AS days_until_expiry
FROM lease
WHERE org_id = '<your-org-id>'
  AND status IN ('active', 'Active', 'ACTIVE')
  AND lease_to_date IS NOT NULL
  AND lease_to_date >= CURRENT_DATE
  AND lease_to_date <= CURRENT_DATE + INTERVAL '90 days'
ORDER BY lease_to_date;
```

---

## Error Scenarios to Test

### 1. View Missing (Fallback Test)

**Test**: Temporarily drop `v_dashboard_kpis` to test fallback

```sql
-- Temporarily drop view (for testing only)
DROP VIEW IF EXISTS v_dashboard_kpis CASCADE;
```

- [ ] Dashboard still loads
- [ ] KPI cards show data from fallback (`buildKpisFromTables`)
- [ ] No errors in console
- [ ] Recreate view after test: Run migration `20291225000003_fix_dashboard_kpis_view.sql`

### 2. Empty Data

**Test**: Verify dashboard handles empty states

- [ ] No properties: Shows 0s for all KPIs
- [ ] No leases: Shows 0 for active leases, empty renewals
- [ ] No transactions: Shows empty transaction list
- [ ] No work orders: Shows empty work order list

---

## Network Request Verification

Check browser DevTools Network tab:

- [ ] `/api/dashboard/[orgId]` request succeeds (200 status)
- [ ] Response time is reasonable (< 2 seconds)
- [ ] No 500 errors
- [ ] Response JSON structure is correct

**Expected Response Structure**:
```json
{
  "kpis": {
    "org_id": "...",
    "total_properties": 0,
    "total_units": 0,
    "occupied_units": 0,
    "available_units": 0,
    "occupancy_rate": 0,
    "monthly_rent_roll": 0,
    "active_leases": 0,
    "growth_rate": null,
    "open_work_orders": 0,
    "urgent_work_orders": 0
  },
  "renewals": {
    "critical_30": 0,
    "upcoming_60": 0,
    "future_90": 0
  },
  "onboarding": null,
  "transactions": [...],
  "workOrders": [...],
  "expiringLeases": {
    "buckets": [...]
  }
}
```

---

## Console Error Check

- [ ] No JavaScript errors in browser console
- [ ] No React errors or warnings
- [ ] No network errors (CORS, 404, 500, etc.)

---

## Performance Check

- [ ] Dashboard loads in < 3 seconds
- [ ] No long-running queries (> 5 seconds)
- [ ] No memory leaks (check over multiple page loads)

---

## Post-Test Verification

After testing, verify views are working:

```sql
-- Check all dashboard views exist
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public' 
  AND table_name IN (
    'v_dashboard_kpis',
    'v_lease_renewals_summary',
    'v_recent_transactions_ranked',
    'v_active_work_orders_ranked'
  );
```

---

## Test Results Template

```
Date: __________
Tester: __________
Environment: [ ] Local [ ] Staging [ ] Production

KPI Cards: [ ] Pass [ ] Fail - Notes: __________
Renewals: [ ] Pass [ ] Fail - Notes: __________
Onboarding: [ ] Pass [ ] Fail - Notes: __________
Recent Transactions: [ ] Pass [ ] Fail - Notes: __________
Work Orders: [ ] Pass [ ] Fail - Notes: __________
Expiring Leases: [ ] Pass [ ] Fail - Notes: __________

Overall: [ ] Pass [ ] Fail
Issues Found: __________
```

---

**Last Updated**: 2025-01-31

