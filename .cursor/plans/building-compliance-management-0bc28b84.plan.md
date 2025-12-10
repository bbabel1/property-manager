<!-- 0bc28b84-5a1c-4d45-abe4-cdca1c8942fa cd066035-dfd9-4678-9671-42a7342f3d4f -->
Building Compliance Management Implementation Plan
Overview
Build a unified compliance management system for NYC regulatory obligations. The system will track compliance assets (elevators, boilers, facades, etc.), sync data from NYC APIs, generate recurring compliance tasks, and provide dashboards at portfolio, property, and asset levels.

Phase 0: Cross-Cutting Design System & UX Standards
0.1 Compliance UX Guidelines
Define compliance UX principles: always show next required action; always show context (property → asset → program → event); never bury critical risk beyond 1 click. Document standard status colors/badges (Overdue, Due soon, On track, Cleared).
0.2 Design Tokens & Patterns
Extend design system for compliance: badges for status/severity/agency; filter chips (jurisdiction, program, time range); compact regulatory tables with consistent date formats and external-link icons; iconography for elevator, boiler, façade, violation, inspection, task.

Phase 1: Database Schema & Core Models
1.1 Create Compliance Tables Migration
File: supabase/migrations/[timestamp]_create_compliance_tables.sql

Create core tables with enhanced constraints and indexes:

compliance_assets - Regulated things (elevators, boilers, etc.)
Fields: id, property_id (FK), org_id (FK), asset_type (enum), name, location_notes, external_source, external_source_id, active, metadata (jsonb), created_at, updated_at
Org consistency check: BEFORE INSERT/UPDATE trigger ensures org_id matches property.org_id
Unique indexes: (org_id, external_source, external_source_id) - per-org unique external IDs
Indexes: property_id, org_id, asset_type
RLS: Simple policy using JWT org_id claim: org_id = (auth.jwt()->>'org_id')::uuid (service role bypass for jobs)
compliance_program_templates - System-wide template definitions
Fields: id, code (unique), name, jurisdiction (enum), frequency_months, lead_time_days, applies_to (enum: property|asset|both), severity_score (1-5), notes, is_active, created_at, updated_at
Purpose: Seed templates that all orgs inherit; no org_id (system-wide)
compliance_programs - Org-specific program instances (with overrides)
Fields: id, org_id (FK), template_id (FK nullable), code, name, jurisdiction (enum), frequency_months, lead_time_days, applies_to (enum), severity_score (1-5), is_enabled, override_fields (jsonb), notes, created_at, updated_at
Org consistency: Check constraint ensures org_id matches if template_id references template
Unique indexes: (org_id, code) - unique code per org
Indexes: org_id, template_id, jurisdiction
Inheritance: resolve fields using org overrides when present, else template defaults
RLS: Simple policy: org_id = (auth.jwt()->>'org_id')::uuid
compliance_items - Per-period "to-do" items
Fields: id, property_id (FK), asset_id (FK nullable), program_id (FK), org_id (FK), period_start (date), period_end (date), due_date (date), status (enum), source (enum), external_tracking_number, result, defect_flag, next_action, primary_work_order_id (FK nullable), notes, created_at, updated_at
Org consistency checks:
BEFORE INSERT/UPDATE trigger ensures org_id matches property.org_id
If asset_id set, ensure asset.org_id matches property.org_id
If program_id set, ensure program.org_id matches property.org_id
Unique index: (program_id, property_id, asset_id, period_start, period_end) - prevents duplicate items (asset_id nullable handled via NULLS NOT DISTINCT)
Unique index: (org_id, external_tracking_number) WHERE external_tracking_number IS NOT NULL - per-org unique external IDs
Partial indexes:
(org_id, due_date, status) WHERE status IN ('overdue', 'not_started', 'scheduled') - hot query for dashboard
(property_id, status) WHERE status = 'overdue' - property-level overdue items
Indexes: property_id, asset_id, program_id, org_id, due_date, status
RLS: Simple policy: org_id = (auth.jwt()->>'org_id')::uuid
compliance_item_work_orders - Join table for item-work order relationships
Fields: id, item_id (FK), work_order_id (FK), org_id (FK), role (enum: primary, related), created_at
Org consistency checks:
BEFORE INSERT/UPDATE trigger ensures item.org_id = org_id
BEFORE INSERT/UPDATE trigger ensures work_order.org_id = org_id
Unique index: (item_id, work_order_id) - prevent duplicate links
Indexes: item_id, work_order_id, org_id
RLS: Simple policy: org_id = (auth.jwt()->>'org_id')::uuid
compliance_events - Raw history from DOB/HPD APIs
Fields: id, property_id (FK), asset_id (FK nullable), item_id (FK nullable), org_id (FK), event_type (enum), inspection_type, inspection_date (date), filed_date (date), compliance_status, defects (bool), inspector_name, inspector_company, external_tracking_number, raw_source (jsonb), created_at, updated_at
Org consistency checks:
BEFORE INSERT/UPDATE trigger ensures org_id matches property.org_id
If asset_id set, ensure asset.org_id matches property.org_id
If item_id set, ensure item.org_id matches property.org_id
Unique index: (org_id, external_tracking_number) WHERE external_tracking_number IS NOT NULL - per-org unique external IDs
Partial indexes:
(property_id, inspection_date) WHERE inspection_date >= CURRENT_DATE - INTERVAL '1 year' - recent inspections
(asset_id, inspection_date) WHERE asset_id IS NOT NULL - asset history
Indexes: property_id, asset_id, item_id, org_id, external_tracking_number, inspection_date
RLS: Simple policy: org_id = (auth.jwt()->>'org_id')::uuid
compliance_violations - Violations from agencies
Fields: id, property_id (FK), asset_id (FK nullable), org_id (FK), agency (enum), violation_number, issue_date (date), description, severity_score, status (enum), cure_by_date (date), cleared_date (date), linked_item_id (FK nullable), linked_work_order_id (FK nullable), created_at, updated_at
Org consistency checks:
BEFORE INSERT/UPDATE trigger ensures org_id matches property.org_id
If asset_id set, ensure asset.org_id matches property.org_id
Unique index: (org_id, violation_number) - per-org unique violation numbers
Partial indexes:
(org_id, status, cure_by_date) WHERE status = 'open' - open violations
(property_id, status) WHERE status IN ('open', 'in_progress') - active violations
Indexes: property_id, asset_id, org_id, violation_number, status, issue_date, cure_by_date
RLS: Simple policy: org_id = (auth.jwt()->>'org_id')::uuid
external_sync_state - Track sync progress per org and source
Fields: id, org_id (FK), source (enum: dob_now, nyc_open_data, hpd, fdny), last_cursor (text), last_seen_at (timestamp), last_run_at (timestamp), status (enum: idle, running, error), last_error (text), created_at, updated_at
Unique index: (org_id, source) - one state per org+source (ensure enum values match actual source keys you’ll store; add more granular keys if needed)
Indexes: org_id, source, last_run_at
RLS: Simple policy: org_id = (auth.jwt()->>'org_id')::uuid (service role bypass for jobs)
Enums to create:

compliance_asset_type: elevator, boiler, facade, gas_piping, sprinkler, generic, other
compliance_jurisdiction: NYC_DOB, NYC_HPD, FDNY, NYC_DEP, OTHER
compliance_item_status: not_started, scheduled, in_progress, inspected, filed, accepted, accepted_with_defects, failed, overdue, closed
compliance_item_source: manual, dob_sync, hpd_sync, fdny_sync, open_data_sync
compliance_event_type: inspection, filing, correction, violation_clearance
compliance_violation_agency: DOB, HPD, FDNY, DEP, OTHER
compliance_violation_status: open, in_progress, cleared, closed
compliance_work_order_role: primary, related
external_sync_source: dob_now, nyc_open_data, hpd, fdny
external_sync_status: idle, running, error
Add to properties table:

bin VARCHAR(20) - Building Identification Number (nullable, indexed)
Check constraint: (city = 'New York' OR borough IN ('Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island')) THEN bin IS NOT NULL - Enforce BIN requirement only for confirmed NYC properties. Handle validation in application layer for edge cases where borough may be unset but property is NYC.
Functions to create:

check_compliance_org_consistency() - Trigger function for org_id consistency checks
resolve_compliance_program(org_id, template_id) - Returns org program with template fallback (field precedence: org override → template default)
map_event_status_to_item_status(event_type, compliance_status) - Deterministic status mapping function
1.2 Create TypeScript Types
File: src/types/compliance.ts

Create TypeScript interfaces matching database schema:

ComplianceAsset, ComplianceProgram, ComplianceItem, ComplianceEvent, ComplianceViolation
Enum types matching database enums
Insert/Update types for each table
Query result types with relationships
1.3 Create Database Service Layer
File: src/lib/compliance-service.ts

Service class with methods:

getAssetsByProperty(propertyId, orgId)
getItemsByProperty(propertyId, orgId, filters?)
getViolationsByProperty(propertyId, orgId, filters?)
createAsset(data)
updateItemStatus(itemId, status, orgId)
linkItemToWorkOrder(itemId, workOrderId, orgId)
getPortfolioSummary(orgId, filters?) - Aggregates for dashboard
Phase 2: NYC API Integration
2.1 Create NYC API Client
File: src/lib/nyc-api-client.ts

Client class for NYC data sources:

DOBNowClient - DOB NOW API wrapper
NYCOpenDataClient - NYC Open Data API wrapper
HPDClient - HPD API wrapper (if available)
FDNYClient - FDNY API wrapper (if available)
Methods:

fetchElevatorDevices(bin) - Get elevators by BIN
fetchElevatorFilings(deviceId) - Get filing history
fetchBoilerFilings(bin) - Get boiler filings
fetchViolations(bin, agency?) - Get violations by BIN
Handle rate limiting, pagination, error handling
File: src/lib/env.ts

Add NYC API configuration:

NYC_OPEN_DATA_API_KEY (optional, for rate limits)
DOB_NOW_API_BASE_URL
NYC_OPEN_DATA_BASE_URL
2.2 Create Sync Service
File: src/lib/compliance-sync-service.ts

Service to sync NYC data:

syncPropertyCompliance(propertyId, orgId) - Main sync entry point
syncElevatorsByBIN(bin, propertyId, orgId) - Sync elevator devices and filings
syncBoilersByBIN(bin, propertyId, orgId) - Sync boiler filings
syncViolationsByBIN(bin, propertyId, orgId) - Sync violations
mapNYCDataToComplianceEvents(nycData, propertyId, assetId?) - Transform NYC data
upsertComplianceAsset(nycDevice, propertyId, orgId) - Create/update assets
updateComplianceItemsFromEvents(events, orgId) - Update item statuses from events
Use advisory locks per org+source to avoid concurrent sync runs
2.3 Create Sync API Route
File: src/app/api/compliance/sync/route.ts

POST endpoint:

POST /api/compliance/sync - Manual sync trigger
Body: { propertyId?, orgId, force?: boolean }
Calls ComplianceSyncService.syncPropertyCompliance()
Returns sync summary
2.4 Create Scheduled Sync Job
File: supabase/functions/nightly-compliance-sync/index.ts

Edge function for nightly sync:

Fetches all active properties with BIN
Calls sync service for each property
Logs sync results
Handles errors gracefully
Uses advisory locks per org+source to prevent double-runs
File: scripts/cron/compliance-sync.ts

Alternative cron script (if preferred over Edge Function):

Similar logic, runs via cron scheduler
Phase 3: Compliance Program & Item Generation
3.1 Seed Default Compliance Programs
File: supabase/migrations/[timestamp]_seed_compliance_programs.sql

Insert default NYC compliance programs:

Elevator Category 1 Test (annual, 12 months)
Elevator Category 5 Test (5-year, 60 months)
Boiler Annual Inspection (12 months)
Facade LL11 Inspection (5-year, 60 months)
Gas Piping Inspection (varies)
Sprinkler Inspection (annual, 12 months)
Seed compliance_program_templates, then insert corresponding compliance_programs rows (is_enabled=true) for existing orgs; add hook/job to auto-enable templates for newly created orgs.
3.2 Create Item Generation Service
File: src/lib/compliance-item-generator.ts

Service to generate compliance items:

generateItemsForProperty(propertyId, orgId) - Generate all expected items
generateItemsForAsset(assetId, orgId) - Generate items for specific asset
generateItemsForProgram(programId, propertyId, assetId?, orgId) - Generate items for program
Logic: For each program, calculate periods (period_start, period_end, due_date) based on frequency_months and lead_time_days (timezone-aware)
Skip if item already exists for that period/program/asset combination (unique index guards races)
Use advisory locks per org when generating to avoid concurrent runs
3.3 Create Scheduled Item Generation Job
File: scripts/cron/generate-compliance-items.ts

Cron script:

Runs monthly
Generates compliance items for all active properties/assets
Creates items for upcoming periods (next 12 months)
Wrap in advisory lock to prevent overlapping executions
Phase 4: UI - Portfolio Compliance Dashboard
4.1 Create Dashboard Page
File: src/app/(protected)/compliance/page.tsx

Portfolio-level dashboard:

Summary chips: Open Violations, Overdue Items, Due in Next 30 Days, Average Risk Score
Main table: One row per property with compliance metrics
Filters: Jurisdiction, Program, Status, Borough, Owner
Click row → navigate to property compliance page
File: src/components/compliance/PortfolioComplianceTable.tsx

Reusable table component:

Columns: Property name/address, Borough, Compliance assets count, Open violations, Overdue items, Due next 30 days, Last elevator inspection, Status indicator (red/yellow/green)
Uses existing UI primitives (Card, Badge, Button)
File: src/components/compliance/ComplianceSummaryCards.tsx

Summary card components:

StatCard for each metric
Uses existing Card component
4.2 Create API Route for Dashboard Data
File: src/app/api/compliance/portfolio/route.ts

GET endpoint:

GET /api/compliance/portfolio?orgId=...&filters=...
Returns aggregated compliance data for dashboard
Uses ComplianceService.getPortfolioSummary()
Include pagination defaults and max limits; enforce org scoping via JWT org_id
4.3 Smart Defaults & Saved Views
Default filter: Status = Overdue OR Due in 30 days, sorted by highest risk. Allow saved views (e.g., “NYC – DOB Only”, “My Buildings”, “High-Risk Compliance Only”). Persist last view in local storage.
4.4 Quick Actions
Per property row quick actions: View Compliance (primary), Sync Now (permissioned), Create Work Order (prefilled with compliance context) via 3-dot menu.
4.5 Visual Hierarchy & Scannability
Layout emphasis: left = property name/address/borough; middle = chips for Overdue/Due soon/Open violations; right = sparkline/trend indicator. Lock first column on horizontal scroll.
4.6 Global Compliance Search
Add search bar with autocomplete across properties, assets, violation numbers, tracking numbers; suggestions grouped by type.

Phase 5: UI - Property Compliance Page
5.1 Add Compliance Tab to Property Detail
File: src/app/(protected)/properties/[id]/compliance/page.tsx

Property-level compliance page:

Header: Property address, BIN, borough, summary chips
Section A: Timeline/Calendar of inspections
Section B: Compliance Checklist Table
Section C: Violations list
Export "Compliance Snapshot PDF" button
File: src/components/compliance/PropertyComplianceHeader.tsx

Header component with chips and export button

File: src/components/compliance/ComplianceTimeline.tsx

Timeline component showing past/upcoming inspections

File: src/components/compliance/ComplianceChecklistTable.tsx

Main checklist table:

Columns: Program, Asset, Period, Due date, Status badge, Last event, Next action
Filters: Program, Status, Asset type
Links to item detail and external DOB records
File: src/components/compliance/ViolationsList.tsx

Violations list component:

Columns: Violation number, Agency, Issued date, Description, Status, Cure-by date, Linked work order
5.2 Update Property Layout
File: src/app/(protected)/properties/[id]/layout.tsx (create if doesn't exist)

Add "Compliance" tab to property detail navigation:

Overview | Financials | Units | Work Orders | Compliance
Or update existing tab structure if tabs are in a different file.

5.3 Create API Routes
File: src/app/api/compliance/properties/[propertyId]/route.ts

GET endpoint:

GET /api/compliance/properties/[propertyId]
Returns compliance data for property (items, violations, assets, events)
Include pagination defaults and max limits; enforce org scoping via JWT org_id
5.4 Story at a Glance
Narrative panel summarizing compliance posture in plain language (e.g., overdue items, upcoming due, open violations with cure dates), derived from items + violations.
5.5 Intelligent Grouping & Tabs
Domain tabs: All | Elevators | Boilers | Facade | Gas Piping | HPD; each shows relevant programs/assets to keep tables focused.
5.6 Progressive Disclosure
Default table shows core columns only; row expand reveals last event summary, links to Asset Detail and DOB record; avoid navigation unless requested.
5.7 Contextual Empty & Error States
Empty states guiding next steps (e.g., add BIN + run first sync); error states with last successful sync timestamp and “Retry Sync”.

Phase 6: UI - Asset Detail Page
6.1 Create Asset Detail Page
File: src/app/(protected)/compliance/assets/[assetId]/page.tsx

Asset detail page:

Header: Asset name, Device ID, Property + BIN, external links
Tabs: Overview, Inspections & Filings, Violations, Documents
Overview tab: Last inspection, next due, open violations, summary chips
Inspections tab: History table with tracking numbers, dates, status, inspector info
Violations tab: Filtered violations for this asset
Documents tab: File upload/display (reuse existing file components)
File: src/components/compliance/AssetDetailHeader.tsx

Header component with external links

File: src/components/compliance/AssetInspectionsTable.tsx

Inspections history table

6.2 Create API Route
File: src/app/api/compliance/assets/[assetId]/route.ts

GET endpoint:

GET /api/compliance/assets/[assetId]
Returns asset details with related items, events, violations
Include pagination defaults and max limits; enforce org scoping via JWT org_id
6.3 Health Indicator
Top widget with health score (0–100), status text, time since last inspection, days until next due.
6.4 Timeline Visualization
Linear timeline showing past inspections (colored dots), violations (red icons), upcoming due items; hover reveals details and links.
6.5 Cross-Links
In inspection table, tracking numbers link to ComplianceItemDetailModal for that period and “open in DOB” icon for external context.
6.6 Operator Shortcuts
Buttons: Schedule Work Order (prefilled property/asset/item), Log Manual Event (for internal events not in NYC data).

Phase 7: UI - Compliance Item Detail
7.1 Create Item Detail Modal/Page
File: src/components/compliance/ComplianceItemDetailModal.tsx

Modal component (or separate page):

Full DOB history for item (all related compliance_events)
Current status, due date, mapped violations
Assign to staff member (if user management exists)
Link/create work order button
Upload documents
Mark resolved/accepted
File: src/app/api/compliance/items/[itemId]/route.ts

GET/PATCH endpoints:

GET /api/compliance/items/[itemId] - Get item details
PATCH /api/compliance/items/[itemId] - Update item (status, notes, work order link)
Enforce org scoping via JWT org_id
7.2 Clear Primary CTA
Primary action varies by status (e.g., not_started → Schedule inspection; inspected → Log filing; accepted_with_defects → Create corrective work order; overdue → Mark as scheduled/Acknowledge).
7.3 Audit Trail & Comments
History of status changes with actor/timestamp; inline comments for internal notes.
7.4 Inline Violation & Work Order Summary
Summary cards for linked violations (status, cure-by) and linked work orders (status).
7.5 Keyboard & Power-User Support
Enter to save, Esc to close, defined tab order for fast data entry.

Phase 8: Integration & Polish
8.1 Link to Work Orders
Update work orders to show linked compliance items:

Add compliance item badge/link in work order detail
Show compliance context in work order creation
8.2 Add Notifications/Alerts
File: src/lib/compliance-alerts.ts

Alert service:

Check for overdue items daily
Check for items due in next 30 days
Send notifications (email/in-app) for violations
8.3 Update Documentation
File: docs/compliance-management-guide.md

Documentation:

How to set up NYC API access
How compliance items are generated
How sync works
How to use the dashboards
File: docs/database/database-schema.md

Update with new compliance tables
8.4 Performance & Perceived Speed
Skeleton loaders for tables/cards; optimistic UI for fast actions (status updates, notes).
8.5 Accessibility & Readability
WCAG contrast for badges; keyboard-navigable rows; consistent, localized date formats (e.g., MMM DD, YYYY).
8.6 Tour / Onboarding for New Users
Guided tour Portfolio → Property → Item Detail; tooltips for severity score, health score, program codes.
8.7 Telemetry for UX Iteration
Track filter/view usage, bounce points, manual vs sync status changes to refine defaults and add contextual help.

Implementation Order
Phase 0 - Cross-cutting design system & UX standards
Phase 1 - Database schema (foundation)
Phase 2 - NYC API integration & credentials management (data source + settings)
Phase 3 - Item generation (automation)
Phase 4 - Portfolio dashboard & navigation (high-level view)
Phase 5 - Property compliance page (detail view)
Phase 6 - Asset detail (deep dive)
Phase 7 - Item detail (task management)
Phase 8 - Integration & polish

Key Design Decisions
Org-scoped RLS: All compliance tables use org_id = auth.jwt()->>'org_id' with service role bypass for jobs (consistent, no property join dependency)
External source tracking: Store raw NYC API responses in compliance_events.raw_source for audit/debug
Item generation: Generate compliance_items proactively based on org_compliance_programs (enabled only), applying template overrides; update status from events
Work order integration: Link compliance items to work orders for operational workflow (join table, optional primary_work_order_id)
UI patterns: Reuse existing PageShell, Card, Badge, Table components for consistency; add compliance-specific tokens/badges/icons
Sync strategy: Nightly sync job + manual trigger API endpoint with advisory locks and incremental state
BIN requirement: Add BIN to properties table (NYC-only constraint)

Dependencies
Existing properties table (with org_id, borough)
Existing work_orders table (for linking)
Existing UI component library (PageShell, Card, Badge, etc.)
Supabase Edge Functions or cron infrastructure for scheduled jobs
NYC API access (DOB NOW, NYC Open Data)

Testing Considerations
Test RLS policies ensure org isolation (JWT org_id) and service role bypass
Test sync service handles missing BIN gracefully
Test item generation doesn't create duplicates and respects advisory locks
Test UI filters and pagination (with limits)
Test work order linking
Test external API rate limiting and error handling
Test UX flows: saved views, quick actions, health/timeline widgets, empty/error states, keyboard shortcuts, accessibility contrast and focus order

Define compliance UX guidelines (next action, context chain, critical risk ≤1 click) and compliance design tokens/patterns (status/agency badges, filter chips, compact table rules, icons).

Add portfolio UX: smart defaults/saved views, per-row quick actions, visual hierarchy (chips + sparkline, locked first column), global compliance search with typed autocomplete.

Add property UX: “Story at a Glance” narrative, domain tabs (All/Elevators/Boilers/Facade/Gas Piping/HPD), progressive disclosure row expand (last event + links), contextual empty/error states with retry sync.

Add asset UX: health indicator (score/status, last/next), timeline visualization, DOB links in inspection rows, operator shortcuts (schedule work order, log manual event).

Add item UX: status-driven primary CTA, audit trail + comments, inline violation/work-order summaries, keyboard shortcuts (Enter save, Esc close, tab order).

### To-dos

- [ ] Define compliance UX guidelines (next action, context chain, critical risk ≤1 click) and compliance design tokens/patterns (status/agency badges, filter chips, compact table rules, icons).
- [ ] Create database migration with compliance_assets, compliance_program_templates, compliance_programs, compliance_items, compliance_item_work_orders, compliance_events, compliance_violations, external_sync_state; enums, indexes, org consistency triggers, JWT org_id RLS (service role bypass), properties.bin + NYC-only check.
- [ ] Create TypeScript types in src/types/compliance.ts and service layer in src/lib/compliance-service.ts with CRUD and portfolio aggregation.
- [ ] Create NYC API client in src/lib/nyc-api-client.ts for DOB NOW, NYC Open Data, HPD, FDNY; add API config to src/lib/env.ts.
- [ ] Create compliance sync service in src/lib/compliance-sync-service.ts to sync NYC data, map to compliance_events, update compliance_items (idempotent via external IDs), with advisory locks and external_sync_state.
- [ ] Create sync API route at src/app/api/compliance/sync/route.ts and nightly sync job (Edge Function or cron) with per-org+source advisory locks.
- [ ] Create migration to seed default compliance_program_templates and insert enabled compliance_programs for existing orgs; hook/job to auto-enable for new orgs.

- [ ] Create compliance item generator in src/lib/compliance-item-generator.ts (timezone-aware periods, lead times, advisory lock, unique index guard).
- [ ] Add portfolio UX: smart defaults/saved views, per-row quick actions, visual hierarchy (chips + sparkline, locked first column), global compliance search with typed autocomplete.
- [ ] Create portfolio compliance dashboard at src/app/(protected)/compliance/page.tsx with summary cards, property table, filters; API at src/app/api/compliance/portfolio/route.ts with pagination limits and org scoping.
- [ ] Create property compliance page at src/app/(protected)/properties/[id]/compliance/page.tsx with timeline, checklist, violations; add Compliance tab to property layout.
- [ ] Add property UX: “Story at a Glance” narrative, domain tabs (All/Elevators/Boilers/Facade/Gas Piping/HPD), progressive disclosure row expand (last event + links), contextual empty/error states with retry sync.
- [ ] Create asset detail page at src/app/(protected)/compliance/assets/[assetId]/page.tsx with tabs for overview, inspections, violations, documents.
- [ ] Add asset UX: health indicator (score/status, last/next), timeline visualization, DOB links in inspection rows, operator shortcuts (schedule work order, log manual event).
- [ ] Create compliance item detail modal/page component and API routes for viewing/editing items and linking to work orders (org-scoped, paginated).
- [ ] Add item UX: status-driven primary CTA, audit trail + comments, inline violation/work-order summaries, keyboard shortcuts (Enter save, Esc close, tab order).
- [ ] Add work order linking UI, compliance alerts service, update documentation, onboarding tour/tooltips, telemetry for filter/view usage and manual vs sync changes, accessibility/contrast checks, skeleton loaders/optimistic UI, and final integration testing.