# Compliance Management UX Guidelines

## Core Principles

### 1. Always Show Next Required Action

- Every compliance view must prominently display the next action needed
- Status badges should indicate urgency (Overdue, Due Soon, On Track)
- Primary CTAs should be context-aware based on item status
- Never bury critical actions beyond 1 click

### 2. Maintain Context Chain

- Always show the full context: Property → Asset → Program → Event
- Breadcrumbs or header should show current location in hierarchy
- Related items should be easily accessible (e.g., violations linked to items)
- External links (DOB NOW, NYC Open Data) should be clearly marked

### 3. Critical Risk Visibility

- Critical risk indicators (overdue items, open violations) must be visible within 1 click from any view
- Portfolio dashboard should highlight buildings with compliance issues
- Color coding: Red (overdue/critical), Yellow (due soon/warning), Green (on track/cleared)
- Risk scores and severity indicators should be prominent

## Design Tokens & Patterns

### Status Badges

**Compliance Item Status:**

- `not_started` - Gray badge, "Not Started"
- `scheduled` - Blue badge, "Scheduled"
- `in_progress` - Yellow badge, "In Progress"
- `inspected` - Purple badge, "Inspected"
- `filed` - Blue badge, "Filed"
- `accepted` - Green badge, "Accepted"
- `accepted_with_defects` - Orange badge, "Accepted w/ Defects"
- `failed` - Red badge, "Failed"
- `overdue` - Red badge with warning icon, "Overdue"
- `closed` - Gray badge, "Closed"

**Violation Status:**

- `open` - Red badge, "Open"
- `in_progress` - Yellow badge, "In Progress"
- `cleared` - Green badge, "Cleared"
- `closed` - Gray badge, "Closed"

**Agency Badges:**

- `DOB` - Blue badge with building icon
- `HPD` - Green badge with home icon
- `FDNY` - Red badge with fire icon
- `DEP` - Blue badge with water icon
- `OTHER` - Gray badge

### Filter Chips

**Jurisdiction Filters:**

- NYC_DOB, NYC_HPD, FDNY, NYC_DEP, OTHER
- Multi-select chips with checkmarks
- Active filters highlighted with primary color

**Program Filters:**

- Elevators, Boilers, Facade, Gas Piping, Sprinkler
- Grouped by asset type
- Show count of items per program

**Status Filters:**

- Overdue, Due Soon (next 30 days), On Track, All
- Quick filter buttons above table
- Default: Show Overdue + Due Soon

**Time Range Filters:**

- Last 30 days, Last 90 days, Last year, All time
- Dropdown or date picker

### Compact Table Rules

**Standard Columns:**

- Date columns: Format as "MMM DD, YYYY" (e.g., "Jan 15, 2025")
- Status columns: Badge component, max width 120px
- External links: Icon button, opens in new tab
- Actions: 3-dot menu for row actions

**Table Density:**

- Default row height: 48px
- Compact mode: 40px (for large lists)
- Hover state: Subtle background highlight
- Selected state: Primary color border-left

**Responsive Behavior:**

- Mobile: Stack columns, show most important first
- Tablet: Show 4-5 core columns
- Desktop: Show all columns, allow horizontal scroll
- Lock first column (property/asset name) on scroll

### Iconography

**Asset Type Icons:**

- `elevator` - Elevator icon (lucide: ArrowUpDown)
- `boiler` - Flame icon (lucide: Flame)
- `facade` - Building icon (lucide: Building2)
- `gas_piping` - Pipe icon (lucide: Pipe)
- `sprinkler` - Droplet icon (lucide: Droplet)
- `generic` - File icon (lucide: FileText)

**Action Icons:**

- Schedule inspection - Calendar icon (lucide: Calendar)
- View DOB record - External link icon (lucide: ExternalLink)
- Create work order - Wrench icon (lucide: Wrench)
- Upload document - Upload icon (lucide: Upload)
- View details - Eye icon (lucide: Eye)

**Status Indicators:**

- Overdue - AlertCircle icon (lucide: AlertCircle)
- Due soon - Clock icon (lucide: Clock)
- On track - CheckCircle icon (lucide: CheckCircle)
- Violation - AlertTriangle icon (lucide: AlertTriangle)

## Color Palette

**Status Colors:**

- Critical/Overdue: `hsl(var(--destructive))` (Red)
- Warning/Due Soon: `hsl(var(--warning))` (Yellow/Orange)
- Success/On Track: `hsl(var(--success))` (Green)
- Info/Scheduled: `hsl(var(--primary))` (Blue)
- Neutral/Closed: `hsl(var(--muted-foreground))` (Gray)

**Agency Colors:**

- DOB: Blue (`hsl(217, 91%, 60%)`)
- HPD: Green (`hsl(142, 71%, 45%)`)
- FDNY: Red (`hsl(0, 84%, 60%)`)
- DEP: Blue (`hsl(199, 89%, 48%)`)

## Typography

**Headers:**

- Page title: `text-2xl font-bold`
- Section title: `text-lg font-semibold`
- Table header: `text-sm font-medium text-muted-foreground`

**Body:**

- Default: `text-sm`
- Compact: `text-xs`
- Emphasis: `font-medium`

## Spacing & Layout

**Card Padding:**

- Default: `p-6`
- Compact: `p-4`

**Table Spacing:**

- Row gap: `gap-4` (16px)
- Column gap: `gap-2` (8px)
- Section gap: `gap-6` (24px)

**Filter Bar:**

- Height: 48px
- Padding: `px-4 py-2`
- Gap between filters: `gap-2`

## Accessibility

**WCAG 2.1 Level AA Compliance:**

- Text contrast: Minimum 4.5:1 for normal text, 3:1 for large text
- UI components: Minimum 3:1 contrast for borders and interactive elements
- Focus indicators: Visible focus rings on all interactive elements
- Keyboard navigation: All actions accessible via keyboard
- Screen reader labels: ARIA labels for all icons and status indicators

**Keyboard Shortcuts:**

- Enter: Save/Submit form
- Esc: Close modal/dialog
- Tab: Navigate through form fields
- Arrow keys: Navigate table rows (when focused)

## Empty States

**No Compliance Data:**

- Icon: Building2 with muted color
- Title: "No compliance data yet"
- Description: "Add a BIN to your property and run your first sync to get started"
- CTA: "Add BIN" or "Sync Now"

**No Items Found (Filtered):**

- Icon: Search with muted color
- Title: "No items match your filters"
- Description: "Try adjusting your filters to see more results"
- CTA: "Clear Filters"

## Error States

**Sync Failed:**

- Icon: AlertCircle with destructive color
- Title: "Sync failed"
- Description: "Last sync: [timestamp]. Error: [error message]"
- CTA: "Retry Sync"

**API Error:**

- Icon: WifiOff with muted color
- Title: "Unable to connect to NYC APIs"
- Description: "Check your API credentials in Settings → Integrations"
- CTA: "Check Settings"
