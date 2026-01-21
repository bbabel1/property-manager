---
name: Dashboard KPI Customization
overview: Design and implement a comprehensive Dashboard KPI Customization feature enabling users to add, edit, duplicate, delete, and reorder KPI cards through a guided builder interface. The system will support a large extensible metric catalog, user-specific layouts, and org-scoped permissions.
todos:
  - id: db-schema
    content: Create database migration for dashboard_cards, dashboard_metric_registry tables with RLS policies
    status: pending
  - id: seed-metrics
    content: Create seed migration with 50+ metrics across all domains (leasing, rent roll, maintenance, accounting, compliance, etc.)
    status: pending
    dependencies:
      - db-schema
  - id: types-schemas
    content: Define TypeScript types (dashboard.ts) and Zod schemas (dashboard.ts) for cards, metrics, and API contracts
    status: pending
  - id: metric-calculator
    content: Implement metric calculation engine (metric-calculator.ts, query-builders.ts, timeframe-resolver.ts)
    status: pending
    dependencies:
      - db-schema
      - types-schemas
  - id: api-routes
    content: "Implement API routes: GET/POST /cards, PUT/DELETE /cards/[id], GET /metrics, GET /cards/[id]/value, POST /layout"
    status: pending
    dependencies:
      - db-schema
      - types-schemas
  - id: dashboard-hooks
    content: "Create hooks: useDashboardCards, useDashboardCardValue, update useDashboardMetrics"
    status: pending
    dependencies:
      - api-routes
  - id: dashboard-components
    content: "Build dashboard components: DashboardCardsGrid, KPICard, DashboardEditToolbar with edit mode toggle"
    status: pending
    dependencies:
      - dashboard-hooks
  - id: drag-drop
    content: Integrate @dnd-kit for drag-and-drop card reordering in edit mode
    status: pending
    dependencies:
      - dashboard-components
  - id: kpi-builder
    content: "Implement KPI Builder wizard (7 steps: source, metric, timeframe, filters, grouping, display, preview)"
    status: pending
    dependencies:
      - dashboard-components
      - metric-calculator
  - id: metric-library
    content: Build MetricLibrary component with search, categories, favorites, and recommended metrics
    status: pending
    dependencies:
      - kpi-builder
  - id: filter-builder
    content: Build FilterBuilder component with dynamic filter UI based on metric supported_filters
    status: pending
    dependencies:
      - kpi-builder
  - id: dashboard-page-integration
    content: Update dashboard page.tsx to integrate custom cards with existing hardcoded KPIs, add edit mode
    status: pending
    dependencies:
      - dashboard-components
      - drag-drop
  - id: analytics
    content: Add analytics tracking for all dashboard customization events (edit mode, add/edit/delete cards, builder steps)
    status: pending
    dependencies:
      - dashboard-page-integration
      - kpi-builder
  - id: unit-tests
    content: Write unit tests for metric calculator, query builders, and schema validation
    status: pending
    dependencies:
      - metric-calculator
      - types-schemas
  - id: integration-tests
    content: Write integration tests for API routes, CRUD operations, and permission checks
    status: pending
    dependencies:
      - api-routes
  - id: e2e-tests
    content: "Write E2E tests for full user flows: edit mode, add card, reorder, save/cancel"
    status: pending
    dependencies:
      - dashboard-page-integration
      - kpi-builder
  - id: mobile-responsive
    content: Ensure all components are mobile responsive, especially drag-and-drop and builder modal
    status: pending
    dependencies:
      - dashboard-components
      - kpi-builder
  - id: documentation
    content: Create user guide and developer documentation for dashboard customization feature
    status: pending
    dependencies:
      - dashboard-page-integration
  - id: feature-flag
    content: Add feature flag (ENABLE_DASHBOARD_CUSTOMIZATION) and rollout plan
    status: pending
    dependencies:
      - dashboard-page-integration
---

# Dashboard KPI Customization Implementation Plan

## 1. Architecture Overview

### 1.1 System Components

```javascript
┌─────────────────────────────────────────────────────────────┐
│                    Dashboard Page                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  KPI Cards (Customizable Grid)                       │   │
│  │  - Edit Mode Toggle                                   │   │
│  │  - Drag & Drop Reorder                                │   │
│  │  - Card Actions (Edit/Duplicate/Delete)              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              KPI Builder (Fullscreen Modal)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Step 1  │→ │  Step 2  │→ │  Step 3 │→ │  Step 4 │    │
│  │  Source  │  │  Metric  │  │ Timeframe│  │ Filters │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │  Step 5  │→ │  Step 6  │→ │  Step 7 │                  │
│  │ Grouping │  │  Display │  │  Preview │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Layer                                 │
│  - GET  /api/dashboard/[orgId]/cards                        │
│  - POST /api/dashboard/[orgId]/cards                        │
│  - PUT  /api/dashboard/[orgId]/cards/[id]                   │
│  - DELETE /api/dashboard/[orgId]/cards/[id]                 │
│  - GET  /api/dashboard/metrics                              │
│  - POST /api/dashboard/[orgId]/layout                       │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Database Layer                              │
│  - dashboard_cards (user card configs)                      │
│  - dashboard_metric_registry (metric definitions)          │
│  - dashboard_layouts (user layout preferences)              │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow

1. **Dashboard Load**: Fetch user's saved cards → Render in grid → Apply layout order
2. **Edit Mode**: Enable drag-drop → Show edit controls → Track changes in draft state
3. **KPI Builder**: Step-by-step wizard → Validate each step → Preview live → Save to draft
4. **Save**: Validate all cards → Batch update database → Refresh dashboard → Show success toast

## 2. Database Schema

### 2.1 Migration: `supabase/migrations/YYYYMMDDHHMMSS_create_dashboard_customization.sql`

```sql
-- Metric registry (system-defined, read-only for users)
create table if not exists public.dashboard_metric_registry (
  id uuid primary key default gen_random_uuid(),
  metric_id text not null unique, -- stable identifier (e.g., 'total_rent_collected')
  display_name text not null,
  description text,
  domain text not null, -- 'leasing', 'rent_roll', 'maintenance', 'accounting', 'compliance'
  entity_type text, -- 'property', 'lease', 'transaction', 'work_order', etc.
  aggregation_type text not null, -- 'sum', 'avg', 'count', 'distinct_count', 'median'
  supported_filters jsonb not null default '[]'::jsonb, -- ['property_id', 'lease_status', ...]
  supported_time_grains jsonb not null default '[]'::jsonb, -- ['day', 'month', 'quarter', 'year']
  required_permissions text[], -- ['org_staff', 'org_manager']
  format_type text not null default 'number', -- 'currency', 'percent', 'integer', 'decimal', 'compact'
  default_timeframe text, -- 'thisMonth', 'lastMonth', 'thisQuarter', etc.
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_metric_registry_domain on public.dashboard_metric_registry(domain);
create index idx_metric_registry_active on public.dashboard_metric_registry(is_active);

-- User's custom KPI cards
create table if not exists public.dashboard_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  metric_id text not null references public.dashboard_metric_registry(metric_id) on delete restrict,
  title_override text, -- user's custom title (defaults to metric display_name)
  timeframe text not null, -- 'thisMonth', 'lastMonth', 'custom', etc.
  custom_range_start date,
  custom_range_end date,
  filters jsonb not null default '{}'::jsonb, -- { property_id: ['id1', 'id2'], lease_status: ['active'] }
  grouping jsonb, -- { by: 'property', grain: 'month' } or null for single value
  formatting jsonb not null default '{}'::jsonb, -- { format_type: 'currency', decimals: 2, show_delta: true }
  layout_position integer not null, -- order in grid (assigned by server, no default)
  config_version integer not null default 1, -- for schema evolution
  deleted_at timestamptz, -- soft delete for deactivated metrics
  deletion_reason text, -- 'metric_deactivated', 'user_deleted', etc.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, org_id, layout_position) -- prevent duplicate positions
);

-- Trigger to keep updated_at current
create trigger trg_dashboard_cards_updated_at
before update on public.dashboard_cards
for each row
execute function public.set_updated_at();

create trigger trg_dashboard_metric_registry_updated_at
before update on public.dashboard_metric_registry
for each row
execute function public.set_updated_at();

create index idx_dashboard_cards_user_org on public.dashboard_cards(user_id, org_id);
create index idx_dashboard_cards_metric on public.dashboard_cards(metric_id);
create index idx_dashboard_cards_position on public.dashboard_cards(user_id, org_id, layout_position);

-- RLS Policies
alter table public.dashboard_metric_registry enable row level security;
create policy "metric_registry_read_all" on public.dashboard_metric_registry
  for select using (true); -- read-only for all authenticated users

alter table public.dashboard_cards enable row level security;
create policy "dashboard_cards_user_all" on public.dashboard_cards
  for all using (auth.uid() = user_id and org_id in (
    select org_id from public.org_memberships where user_id = auth.uid()
  ));

-- Views for easier querying
create or replace view v_dashboard_cards_with_metrics as
select
  c.*,
  m.display_name as metric_display_name,
  m.description as metric_description,
  m.domain,
  m.aggregation_type,
  m.format_type as default_format_type
from public.dashboard_cards c
join public.dashboard_metric_registry m on c.metric_id = m.metric_id
where m.is_active = true;
```

### 2.2 Seed Data: Initial Metric Registry

Create `supabase/migrations/YYYYMMDDHHMMSS_seed_dashboard_metrics.sql` with 50+ metrics across domains:

- **Leasing**: Total leases, Active leases, Occupancy rate, Expiring leases (30/60/90 days), Renewal rate
- **Rent Roll**: Monthly rent roll, Collected rent, Outstanding rent, Collection rate, Average rent per unit
- **Maintenance**: Open work orders, Urgent work orders, Completed this month, Average resolution time
- **Accounting**: Total revenue, Total expenses, Net income, Accounts receivable, Accounts payable
- **Compliance**: Overdue filings, Upcoming deadlines, Active programs, Compliance rate
- **Properties**: Total properties, Total units, Occupied units, Available units, Average occupancy

## 3. TypeScript Types & Schemas

### 3.1 Core Types: `src/types/dashboard.ts`

```typescript
export type MetricDomain = 
  | 'leasing' 
  | 'rent_roll' 
  | 'maintenance' 
  | 'accounting' 
  | 'compliance' 
  | 'properties'
  | 'tenants'
  | 'bills'
  | 'tasks'
  | 'renewals'
  | 'staff'
  | 'users';

export type AggregationType = 
  | 'sum' 
  | 'avg' 
  | 'count' 
  | 'distinct_count' 
  | 'median';

export type TimeframePreset = 
  | 'thisMonth' 
  | 'lastMonth' 
  | 'thisQuarter' 
  | 'lastQuarter' 
  | 'thisYear' 
  | 'lastYear' 
  | 'trailing7Days' 
  | 'trailing30Days' 
  | 'trailing90Days' 
  | 'custom';

export type FormatType = 
  | 'currency' 
  | 'percent' 
  | 'integer' 
  | 'decimal' 
  | 'compact';

export type FilterOperator = 
  | 'equals' 
  | 'in_list' 
  | 'not_in_list' 
  | 'range' 
  | 'contains';

export interface DashboardMetric {
  id: string;
  metric_id: string;
  display_name: string;
  description: string | null;
  domain: MetricDomain;
  entity_type: string | null;
  aggregation_type: AggregationType;
  supported_filters: string[];
  supported_time_grains: string[];
  required_permissions: string[];
  format_type: FormatType;
  default_timeframe: TimeframePreset;
  is_active: boolean;
}

export interface DashboardCardConfig {
  id: string;
  user_id: string;
  org_id: string;
  metric_id: string;
  title_override: string | null;
  timeframe: TimeframePreset;
  custom_range_start: string | null;
  custom_range_end: string | null;
  filters: Record<string, unknown>;
  grouping: { by: string; grain: string } | null;
  formatting: {
    format_type?: FormatType;
    decimals?: number;
    show_delta?: boolean;
    show_sparkline?: boolean;
    show_timestamp?: boolean;
  };
  layout_position: number;
  config_version: number;
  created_at: string;
  updated_at: string;
}

export interface DashboardCardWithMetric extends DashboardCardConfig {
  metric_display_name: string;
  metric_description: string | null;
  domain: MetricDomain;
  aggregation_type: AggregationType;
  default_format_type: FormatType;
}

export interface MetricValue {
  value: number | null;
  previous_value?: number | null;
  delta?: number | null;
  delta_percent?: number | null;
  trend_data?: Array<{ date: string; value: number }>;
  last_updated: string;
  error?: string | null;
}
```

### 3.2 Zod Schemas: `src/schemas/dashboard.ts`

```typescript
import { z } from 'zod';

export const DashboardCardCreateSchema = z.object({
  metric_id: z.string().min(1),
  title_override: z.string().max(100).optional().nullable(),
  timeframe: z.enum(['thisMonth', 'lastMonth', 'thisQuarter', 'lastQuarter', 'thisYear', 'lastYear', 'trailing7Days', 'trailing30Days', 'trailing90Days', 'custom']),
  custom_range_start: z.string().date().optional().nullable(),
  custom_range_end: z.string().date().optional().nullable(),
  filters: z.record(z.unknown()).default({}),
  grouping: z.object({ by: z.string(), grain: z.string() }).optional().nullable(),
  formatting: z.object({
    format_type: z.enum(['currency', 'percent', 'integer', 'decimal', 'compact']).optional(),
    decimals: z.number().int().min(0).max(4).optional(),
    show_delta: z.boolean().optional(),
    show_sparkline: z.boolean().optional(),
    show_timestamp: z.boolean().optional(),
  }).default({}),
  layout_position: z.number().int().min(0),
});

export const DashboardCardUpdateSchema = DashboardCardCreateSchema.partial().extend({
  id: z.string().uuid(),
});

export const DashboardLayoutUpdateSchema = z.object({
  card_positions: z.array(z.object({
    id: z.string().uuid(),
    position: z.number().int().min(0),
  })),
});
```

## 4. Component Architecture

### 4.1 Dashboard Page Updates: `src/app/(protected)/dashboard/page.tsx`

**Changes:**

- Add "Edit Dashboard" button in PageHeader
- Wrap KPI cards in `DashboardCardsGrid` component
- Add edit mode state management
- Integrate drag-and-drop for reordering
- Add card action menus (Edit/Duplicate/Delete)

**Key additions:**

```typescript
const [isEditMode, setIsEditMode] = useState(false);
const [draftCards, setDraftCards] = useState<DashboardCardWithMetric[]>([]);
const { data: customCards, isLoading: cardsLoading } = useDashboardCards(orgId);
```

### 4.2 New Components

#### `src/components/dashboard/DashboardCardsGrid.tsx`

- Grid layout with responsive columns (1-4 based on screen size)
- Drag-and-drop reordering using `@dnd-kit/sortable`
- Edit mode toggle
- Empty state when no cards
- Loading skeletons

#### `src/components/dashboard/KPICard.tsx`

- Renders single KPI card with value, title, optional delta/trend
- Kebab menu for Edit/Duplicate/Delete
- Loading and error states
- Click handler for drill-down (if applicable)

#### `src/components/dashboard/KPIBuilder.tsx`

- Fullscreen modal wizard
- 7-step guided flow:

1. Select Data Source (domain picker)
2. Select Metric (searchable library)
3. Configure Timeframe (presets + custom range)
4. Apply Filters (dynamic based on metric)
5. Set Aggregation & Grouping (if applicable)
6. Customize Display (title, format, options)
7. Preview & Validate

- Form state management with React Hook Form + Zod
- Live preview panel
- Save/Cancel actions

#### `src/components/dashboard/MetricLibrary.tsx`

- Searchable metric list
- Category filters (by domain)
- Favorites/recent metrics
- Recommended metrics section
- Metric detail tooltips

#### `src/components/dashboard/FilterBuilder.tsx`

- Dynamic filter UI based on metric's `supported_filters`
- Property multi-select
- Status dropdowns
- Date range pickers
- Applied filters summary with clear buttons

#### `src/components/dashboard/DashboardEditToolbar.tsx`

- Edit mode controls
- "Add KPI Card" button
- "Reset to Default" option
- "Save Changes" / "Cancel" buttons
- Unsaved changes indicator

### 4.3 Hooks

#### `src/hooks/useDashboardCards.ts`

```typescript
export function useDashboardCards(orgId: string | null) {
  // Fetch user's custom cards
  // Handle loading/error states
  // Return cards sorted by layout_position
}
```

#### `src/hooks/useDashboardCardValue.ts`

```typescript
export function useDashboardCardValue(
  card: DashboardCardConfig,
  orgId: string
) {
  // Fetch metric value for card
  // Handle timeframe calculations
  // Apply filters
  // Return MetricValue with loading/error states
}
```

#### `src/hooks/useDashboardMetrics.ts` (update existing)

- Add support for custom cards alongside hardcoded KPIs
- Merge both data sources

## 5. API Routes

### 5.1 `src/app/api/dashboard/[orgId]/cards/route.ts`

**GET** - Fetch user's cards:

```typescript
export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { user } = await requireAuth();
  const { orgId } = await params;
  await requireOrg(orgId);
  
  // Query v_dashboard_cards_with_metrics
  // Filter by user_id and org_id
  // Order by layout_position
  // Return cards array
}
```

**POST** - Create new card:

```typescript
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { user } = await requireAuth();
  const { orgId } = await params;
  await requireOrg(orgId);
  
  const body = await req.json();
  const data = sanitizeAndValidate(body, DashboardCardCreateSchema);
  
  // Validate metric exists and user has permissions
  // Insert card with next available position
  // Return created card
}
```

### 5.2 `src/app/api/dashboard/[orgId]/cards/[id]/route.ts`

**PUT** - Update card:

```typescript
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ orgId: string; id: string }> }
) {
  // Validate ownership
  // Update card
  // Return updated card
}
```

**DELETE** - Delete card:

```typescript
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ orgId: string; id: string }> }
) {
  // Validate ownership
  // Delete card
  // Reorder remaining cards
  // Return success
}
```

### 5.3 `src/app/api/dashboard/metrics/route.ts`

**GET** - Fetch metric registry:

```typescript
export async function GET(req: Request) {
  await requireAuth();
  
  // Query dashboard_metric_registry
  // Filter by is_active = true
  // Check user permissions for each metric
  // Return filtered metrics array
}
```

### 5.4 `src/app/api/dashboard/[orgId]/cards/[id]/value/route.ts`

**GET** - Fetch metric value for card:

```typescript
export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string; id: string }> }
) {
  // Load card config
  // Load metric definition
  // Calculate timeframe dates
  // Build query with filters
  // Execute aggregation
  // Return MetricValue
}
```

### 5.5 `src/app/api/dashboard/[orgId]/layout/route.ts`

**POST** - Update card positions:

```typescript
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const body = await req.json();
  const data = sanitizeAndValidate(body, DashboardLayoutUpdateSchema);
  
  // Validate all cards belong to user
  // Batch update positions in transaction
  // Return success
}
```

## 6. Metric Calculation Engine

### 6.1 `src/lib/dashboard/metric-calculator.ts`

Core function to compute metric values:

```typescript
export async function calculateMetricValue(
  metric: DashboardMetric,
  card: DashboardCardConfig,
  orgId: string,
  supabase: TypedSupabaseClient
): Promise<MetricValue> {
  // 1. Resolve timeframe dates
  const { startDate, endDate } = resolveTimeframe(card.timeframe, card.custom_range_start, card.custom_range_end);
  
  // 2. Build base query based on entity_type
  let query = buildBaseQuery(metric.entity_type, orgId, startDate, endDate);
  
  // 3. Apply filters
  query = applyFilters(query, card.filters, metric.supported_filters);
  
  // 4. Apply aggregation
  const result = await applyAggregation(query, metric.aggregation_type);
  
  // 5. Calculate delta if show_delta is enabled
  const previousValue = card.formatting.show_delta 
    ? await calculatePreviousPeriod(metric, card, orgId, supabase)
    : null;
  
  // 6. Format and return
  return {
    value: result,
    previous_value: previousValue,
    delta: previousValue !== null ? result - previousValue : null,
    delta_percent: previousValue !== null && previousValue !== 0 
      ? ((result - previousValue) / previousValue) * 100 
      : null,
    last_updated: new Date().toISOString(),
  };
}
```

### 6.2 Query Builders: `src/lib/dashboard/query-builders.ts`

- `buildPropertyQuery()` - Properties/units metrics
- `buildLeaseQuery()` - Lease/rent roll metrics
- `buildTransactionQuery()` - Financial metrics
- `buildWorkOrderQuery()` - Maintenance metrics
- `buildComplianceQuery()` - Compliance metrics

Each builder:

- Accepts org_id, date range, filters
- Returns Supabase query builder
- Handles RLS automatically

## 7. UX Flow & States

### 7.1 Edit Mode Entry

1. User clicks "Edit Dashboard" button
2. Dashboard enters edit mode:

- Cards become draggable
- Kebab menus appear on each card
- Toolbar shows at top
- "Add KPI Card" button visible

3. Draft state initialized from saved cards

### 7.2 KPI Builder Flow

1. **Step 1: Select Data Source**

- Domain cards (Leasing, Rent Roll, Maintenance, etc.)
- Each shows description and metric count
- Click to proceed

2. **Step 2: Select Metric**

- Search box at top
- Category tabs (All, Favorites, Recent)
- Metric cards with name, description, example
- "Recommended" section for new users
- Click metric to proceed

3. **Step 3: Configure Timeframe**

- Preset buttons (This Month, Last Month, etc.)
- Custom range toggle
- Date pickers for custom range
- Timezone indicator
- Default selected based on metric

4. **Step 4: Apply Filters**

- Dynamic filter UI based on `supported_filters`
- Property multi-select (if applicable)
- Status dropdowns (if applicable)
- "Clear all" button
- Applied filters summary

5. **Step 5: Aggregation & Grouping**

- Aggregation selector (if multiple supported)
- Grouping toggle (by property, by month, etc.)
- Preview shows how grouping affects display

6. **Step 6: Customize Display**

- Title input (pre-filled with metric name)
- Format selector (currency, percent, etc.)
- Decimal places
- Toggles: Show delta, Show sparkline, Show timestamp

7. **Step 7: Preview & Validate**

- Live preview card showing computed value
- Loading state while calculating
- Error state if validation fails
- "Save Card" button (disabled if errors)

### 7.3 Save Behavior (Draft Mode)

- All edits stored in component state (draft)
- "Save Changes" button in toolbar
- Clicking Save:

1. Validates all cards
2. Batch updates database (cards + positions)
3. Shows success toast
4. Exits edit mode
5. Refreshes dashboard

- "Cancel" button:

1. Discards all draft changes
2. Reverts to saved state
3. Exits edit mode

- Unsaved changes indicator (dot on Save button)

## 8. Permissions & Security

### 8.1 Role-Based Access

- **View-only**: `org_staff`, `org_manager`, `org_admin` can view dashboard
- **Edit**: `org_manager`, `org_admin` can create/edit cards
- **Org defaults**: `org_admin` can set org-level default layout (future)

### 8.2 Metric-Level Permissions

- Each metric has `required_permissions` array
- Filter metrics in library based on user's roles
- Show locked state for restricted metrics with explanation
- Hide metrics user cannot access

### 8.3 RLS Enforcement

- All queries scoped to user's org memberships
- Card ownership enforced at database level
- Metric registry read-only for all authenticated users

## 9. Performance & Scalability

### 9.1 Metric Value Fetching Strategy

**Initial approach**: Per-card queries (simple, clear)

- Each card fetches its value independently
- Parallel requests for all cards
- Cache results for 30 seconds

**Future optimization**: Batch endpoint

- Single endpoint accepts array of card IDs
- Returns values for all cards
- Reduces round trips

### 9.2 Caching Strategy

- **Metric registry**: Cache in memory (changes rarely)
- **Card configs**: Cache in React state, invalidate on save
- **Metric values**: Cache for 30 seconds, invalidate on data changes
- **Use React Query** for automatic caching and refetching

### 9.3 Rate Limiting

- Live preview: Throttle to 500ms debounce
- Metric library search: 300ms debounce
- API endpoints: Use existing `checkRateLimit()` middleware

## 10. Edge Cases & Error Handling

### 10.1 Empty States

- **No cards**: Show empty state with "Add your first KPI" CTA
- **No data for timeframe**: Show "No data available" with timeframe info
- **Metric deprecation**: Show warning, offer to replace with similar metric

### 10.2 Error States

- **API errors**: Show error message in card, retry button
- **Invalid filters**: Disable save, show validation errors
- **Permission denied**: Hide metric or show locked state
- **Deleted entities**: Filter out invalid references, show warning

### 10.3 Data Freshness

- Show "Last updated" timestamp on cards
- Warning indicator if data > 1 hour old
- Refresh button per card or global refresh

### 10.4 Mobile Responsiveness

- Drag-and-drop: Touch-friendly, larger hit areas
- Builder: Fullscreen modal, scrollable steps
- Cards: Stack vertically on mobile, 1-2 columns

## 11. Testing Strategy

### 11.1 Unit Tests

- `src/lib/dashboard/__tests__/metric-calculator.test.ts`
- Timeframe resolution
- Filter application
- Aggregation calculations
- Edge cases (empty data, null values)
- `src/lib/dashboard/__tests__/query-builders.test.ts`
- Query construction for each entity type
- Filter application
- Date range handling
- `src/schemas/__tests__/dashboard.test.ts`
- Schema validation
- Required/optional fields
- Type coercion

### 11.2 Integration Tests

- `tests/integration/dashboard-cards.test.ts`
- CRUD operations
- Position updates
- Permission checks
- RLS enforcement
- `tests/integration/metric-calculation.test.ts`
- End-to-end metric value calculation
- Multiple cards, multiple metrics
- Filter combinations

### 11.3 E2E Tests (Playwright)

- `tests/e2e/dashboard-customization.spec.ts`
- Edit mode toggle
- Add new card via builder
- Drag-and-drop reorder
- Edit existing card
- Duplicate card
- Delete card
- Save and cancel flows
- Mobile interactions

## 12. Analytics & Telemetry

### 12.1 Events to Track

```typescript
// Dashboard events
'dashboard_edit_mode_entered'
'dashboard_edit_mode_exited'
'dashboard_card_added'
'dashboard_card_edited'
'dashboard_card_duplicated'
'dashboard_card_deleted'
'dashboard_cards_reordered'
'dashboard_layout_saved'
'dashboard_layout_reset'
'dashboard_card_preview_loaded'
'dashboard_card_preview_error'

// Builder events
'kpi_builder_opened'
'kpi_builder_step_completed' // with step number
'kpi_builder_metric_searched'
'kpi_builder_metric_selected'
'kpi_builder_filters_applied'
'kpi_builder_preview_generated'
'kpi_builder_saved'
'kpi_builder_cancelled'
```

### 12.2 Implementation

Update `src/lib/dashboard-telemetry.ts`:

```typescript
import { track } from '@/lib/analytics';

export function emitDashboardTelemetry(
  event: DashboardTelemetryEvent,
  payload: DashboardTelemetryPayload
) {
  track(event, payload);
  // Optionally persist to database
}
```

## 13. Rollout Plan

### 13.1 Feature Flag

Add to `.env`:

```javascript
ENABLE_DASHBOARD_CUSTOMIZATION=true
```

Check in code:

```typescript
const isCustomizationEnabled = process.env.ENABLE_DASHBOARD_CUSTOMIZATION === 'true';
```

### 13.2 Phased Rollout

1. **Phase 1: Beta (Week 1-2)**

- Enable for `platform_admin` and select `org_admin` users
- Collect feedback on builder UX
- Monitor performance

2. **Phase 2: Org Admins (Week 3)**

- Enable for all `org_admin` users
- Monitor adoption and errors

3. **Phase 3: All Users (Week 4)**

- Enable for `org_manager` and `org_staff`
- Full feature availability

### 13.3 Migration Strategy

- Existing dashboard continues to work (hardcoded KPIs)
- Custom cards are additive (shown alongside defaults)
- Users can hide default cards by not adding them to custom layout
- No data migration needed (new feature)

## 14. Documentation Updates

### 14.1 User Documentation

- `docs/user-guides/dashboard-customization.md`
- How to enter edit mode
- How to add/edit/delete cards
- How to use the KPI builder
- Metric catalog reference
- Troubleshooting

### 14.2 Developer Documentation

- `docs/architecture/dashboard-customization.md`
- System architecture
- Adding new metrics
- Metric calculation patterns
- API reference

### 14.3 API Documentation

- Update `docs/api-documentation.md` with new endpoints
- Request/response examples
- Error codes

## 15. Definition of Done

- [ ] All database migrations applied and tested
- [ ] Metric registry seeded with 50+ metrics
- [ ] All TypeScript types defined and exported
- [ ] All Zod schemas created and tested
- [ ] Dashboard page updated with edit mode
- [ ] All components implemented and styled
- [ ] Drag-and-drop reordering working
- [ ] KPI builder wizard complete (7 steps)
- [ ] All API routes implemented with auth/validation
- [ ] Metric calculation engine working
- [ ] RLS policies tested
- [ ] Unit tests passing (>80% coverage)
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Mobile responsive
- [ ] Analytics events tracked
- [ ] Performance baseline met (<2s load time)
- [ ] Documentation updated
- [ ] Feature flag ready
- [ ] Code review completed
- [ ] No console errors
- [ ] TypeScript strict mode passes
- [ ] Linter passes

## 16. File Structure Summary

```javascript
src/
├── app/
│   ├── (protected)/
│   │   └── dashboard/
│   │       └── page.tsx (updated)
│   └── api/
│       └── dashboard/
│           ├── [orgId]/
│           │   ├── cards/
│           │   │   ├── route.ts (GET, POST)
│           │   │   └── [id]/
│           │   │       ├── route.ts (PUT, DELETE)
│           │   │       └── value/route.ts (GET)
│           │   └── layout/route.ts (POST)
│           └── metrics/route.ts (GET)
├── components/
│   └── dashboard/
│       ├── DashboardCardsGrid.tsx
│       ├── KPICard.tsx
│       ├── KPIBuilder.tsx
│       ├── MetricLibrary.tsx
│       ├── FilterBuilder.tsx
│       └── DashboardEditToolbar.tsx
├── hooks/
│   ├── useDashboardCards.ts
│   ├── useDashboardCardValue.ts
│   └── useDashboardMetrics.ts (updated)
├── lib/
│   └── dashboard/
│       ├── metric-calculator.ts
│       ├── query-builders.ts
│       └── timeframe-resolver.ts
├── schemas/
│   └── dashboard.ts
└── types/
    └── dashboard.ts

supabase/migrations/
├── YYYYMMDDHHMMSS_create_dashboard_customization.sql
└── YYYYMMDDHHMMSS_seed_dashboard_metrics.sql
```

## 17. Timeline Estimate

- **Database schema & migrations**: 1 day
- **TypeScript types & schemas**: 1 day
- **Metric calculation engine**: 3 days
- **API routes**: 2 days
- **Dashboard components**: 5 days
- **KPI Builder wizard**: 5 days
- **Drag-and-drop integration**: 2 days