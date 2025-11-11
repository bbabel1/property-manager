# Files Page Implementation Plan

## Overview

This document outlines the plan to recreate the Buildium Files page functionality in our property management application, starting with adding a "Files" navigation tab in the sidebar and building a comprehensive file management interface.

## Analysis of Buildium Files Page

### Key Features Observed:

Based on analysis of Buildium's Files page at `/manager/app/files`, examination of the UI structure, and component analysis:

#### Main Files Table Structure:

From detailed screenshot and component analysis:

1. **Table Columns:**
   - **Checkbox column** (for bulk selection)
   - **TITLE column** with:
     - File icon (PDF/document icon visible)
     - File name as primary text (e.g., "Lease document update")
     - Description/subtitle below title in lighter text (e.g., "Updated description")
   - **SHARING column** with:
     - Sharing icon indicator (three people icon visible for shared files)
     - Shows sharing status visually
   - **CATEGORY column** (e.g., "Leases", "Uncategorized", "Board Meetings")
   - **LOCATION column** showing contextual information:
     - Property name with type (e.g., "74 Grove Street (Single family home) - 1 Lease")
     - Unit/lease details (e.g., "88 Main Street | Brandon Michael - 1A Lease")
     - Contact names (e.g., "Danny G Tenant")
     - Association names (e.g., "The 550 Metropolitan Avenue Condominium Ass")
   - Additional metadata column (likely "Last Updated", "Uploaded By", or file size)

2. **Filtering & Search UI:**
   - **LOCATION** dropdown filter (shows "All" option)
   - **CATEGORY** dropdown filter (shows "All Categories" option)
   - **UPLOADED** dropdown filter (shows "Last 60 days" option)
   - Date picker input field (displays date like "9/4/2025")
   - "Add filter option" link for additional filter options
   - Results count display (e.g., "5 matches")

3. **Action Buttons:**
   - **"Upload account"** button (top right, green/primary button style)
   - **"+ Compose email"** floating action button (bottom right, blue button)
   - Individual file action menus (per row)

4. **File Detail View:**
   - Component: `bd-file-preview-detailed` (AngularJS component)
   - Opens when clicking on a file row
   - Likely displays:
     - Full file metadata
     - File preview (for supported formats)
     - Sharing options and controls
     - Edit/delete actions

#### Sharing Features Analysis:

From the SHARING column and UI patterns observed:

1. **Sharing Indicators:**
   - Visual icon indicator (three people icon) appears in SHARING column for shared files
   - Suggests files can be shared with multiple entities/contacts
   - Sharing status is visible at table level

2. **Sharing Options (Inferred):**
   - Files can be shared with:
     - Tenants (via lease association)
     - Owners (via property association)
     - Staff members
     - External contacts
   - Sharing may include:
     - Email sharing (indicated by "+ Compose email" button)
     - Link sharing (public/private links)
     - Permission-based access control
     - Sharing history/audit trail

3. **Email Integration:**
   - "+ Compose email" floating action button suggests email-based sharing
   - Files can likely be attached to emails
   - May support bulk email with multiple files

4. **Sharing Management:**
   - Sharing settings likely editable in file detail view
   - May include:
     - Add/remove shared contacts
     - Set sharing permissions (view-only, download, etc.)
     - Generate shareable links
     - Expiration dates for shared links

## Implementation Plan

### Phase 1: Navigation & Basic Structure

#### 1.1 Add Files Navigation Item

**File:** `src/components/layout/app-sidebar.tsx`

- Add "Files" navigation item to `NAV_ITEMS` array
- Use `FileText` or `Files` icon from lucide-react
- Route to `/files`
- Position: After Tenants, before Accounting (or as preferred)

```typescript
{ id: 'files', label: 'Files', href: '/files', icon: FileText },
```

#### 1.2 Create Files Page Route

**File:** `src/app/(protected)/files/page.tsx`

- Create new page component
- Use `AppSidebarLayout` wrapper
- Set page title to "Files"
- Initial structure with header and placeholder

### Phase 2: Files Table Component

#### 2.1 Create Files Table Component

**File:** `src/components/files/FilesTable.tsx`

**Features:**

- Display files in sortable table
- Columns:
  - File Name (clickable to view)
  - Category (with badge/chip)
  - Entity Type (badge)
  - Entity Name (link to entity detail page)
  - Uploaded Date (formatted)
  - Uploaded By
  - File Size (formatted)
  - Actions (dropdown menu)

**Pattern to follow:**

- Reference `TenantFilesPanel.tsx` for table structure
- Use existing UI components: `Table`, `DropdownMenu`, `ActionButton`
- Implement row click handler for view action

#### 2.2 Create Files List API Endpoint

**File:** `src/app/api/files/list/route.ts` (or extend existing `/api/files/route.ts`)

**Features:**

- GET endpoint with query parameters:
  - `entityType` (optional filter)
  - `entityId` (optional, when filtering to specific entity)
  - `categoryId` (optional filter)
  - `search` (text search)
  - `page` (pagination)
  - `limit` (pagination)
  - `sortBy` (column to sort)
  - `sortOrder` (asc/desc)
- Return paginated file list with metadata
- Include entity relationship data (entity names, etc.)
- Support org-level file listing (all files for organization)

**Response Structure:**

```typescript
{
  success: true,
  data: FileRowWithEntity[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  }
}
```

### Phase 3: Filtering & Search

#### 3.1 Create Files Filters Component

**File:** `src/components/files/FilesFilters.tsx`

**Features:**

- Entity type dropdown filter
- Category dropdown filter
- Search input (file name/title)
- Date range picker (optional)
- Clear filters button

**Integration:**

- Use existing filter patterns from other pages
- Debounce search input
- Update URL query params for shareable filters
- Sync filters with API calls

#### 3.2 Enhance Files Page with Filters

**File:** `src/app/(protected)/files/page.tsx`

- Add filter state management
- Integrate `FilesFilters` component
- Handle URL query params
- Pass filters to API calls

### Phase 4: File Upload

#### 4.1 Create Global File Upload Dialog

**File:** `src/components/files/FileUploadDialog.tsx`

**Features:**

- Multi-step upload flow:
  1. File selection (drag & drop or file picker)
  2. Entity selection (Property, Lease, Tenant, etc.)
  3. Entity instance selection (specific property/lease/etc.)
  4. Category selection
  5. Metadata (title, description)
  6. Privacy settings
- Preview selected file
- Progress indicator during upload
- Error handling

**Pattern to follow:**

- Reference `BillFileUploadDialog.tsx` for upload pattern
- Use `/api/files/upload` endpoint
- Support multiple file types
- Validate file size/type

#### 4.2 Add Upload Button

- Add "Upload File" button to Files page header
- Open `FileUploadDialog` on click

### Phase 5: File Actions & Modals

#### 5.1 Create File View Modal

**File:** `src/components/files/FileViewModal.tsx`

**Features:**

- Display file metadata
- File preview (for images, PDFs, etc.)
- Download button
- Edit button (opens edit modal)
- Delete button (with confirmation)
- Share/Email button

#### 5.2 Create File Edit Modal

**File:** `src/components/files/FileEditModal.tsx`

**Features:**

- Edit file name/title
- Edit description
- Change category
- Change entity association (optional)
- Update privacy settings
- Save changes via API

**API Endpoint:**

- Extend `/api/files/[id]/route.ts` with PUT method
- Use `updateFile` from `src/lib/files.ts`

#### 5.3 Implement File Actions

**Actions dropdown menu items:**

- View (opens view modal)
- Download (triggers download)
- Edit (opens edit modal)
- Share/Email (opens sharing dialog)
- Delete (confirmation dialog, then delete)

**API Endpoints:**

- View: `/api/files/[id]/link` or `/api/files/[id]/presign` for signed URL
- Download: Same as view
- Delete: `/api/files/[id]/route.ts` DELETE method
- Email: New endpoint `/api/files/[id]/email` or client-side email link

#### 5.4 Create File Sharing Modal

**File:** `src/components/files/FileSharingModal.tsx`

**Features:**

- Display current sharing status
- List of entities/contacts file is shared with
- Add/remove sharing recipients
- Share via email:
  - Email recipient selection
  - Subject and message composition
  - Attach file to email
- Generate shareable link:
  - Public link (anyone with link can access)
  - Private link (requires authentication)
  - Link expiration settings
  - Access permissions (view, download)
- Share history/audit log

**Sharing Options:**

- Share with specific entities:
  - Tenants (select from list)
  - Owners (select from list)
  - Staff members (select from list)
  - External contacts (email addresses)
- Bulk share to multiple recipients
- Set sharing permissions:
  - View only
  - View and download
  - Edit (if applicable)
- Share link settings:
  - Generate unique link
  - Set expiration date
  - Password protection (optional)
  - Access tracking

**Integration:**

- Use existing contact/tenant/owner data
- Integrate with email system if available
- Store sharing relationships in database
- Track sharing activity in audit log

### Phase 6: Enhanced Features

#### 6.1 File Categories Management

- Display category badges in table
- Allow filtering by category
- Support category creation (if needed)
- Sync with Buildium categories if applicable

#### 6.2 Entity Linking

- Show entity names as links
- Navigate to entity detail pages on click
- Display entity type badges with appropriate styling

#### 6.3 Bulk Actions

- Multi-select files
- Bulk delete
- Bulk category assignment
- Bulk download (zip)

#### 6.4 Sorting & Pagination

- Sortable table columns
- Pagination controls
- Page size selector
- Total count display

## Database Considerations

### Existing Schema

The application already has:

- `files` table with comprehensive structure
- `file_links` table for polymorphic associations
- `file_categories` table for categorization

### Potential Enhancements

- Verify indexes for common queries (org_id, entity_type, entity_id, category)
- Consider full-text search index on file_name/title if needed

## API Design

### New/Enhanced Endpoints

1. **GET /api/files/list**
   - List all files for organization with filtering
   - Pagination support
   - Include entity metadata (entity type, location, sharing status, Buildium identifiers)

2. **GET /api/files/[id]**
   - Get single file details
   - Already exists, may need enhancement

3. **PUT /api/files/[id]**
   - Update file metadata
   - May need to be created or enhanced

4. **DELETE /api/files/[id]**
   - Soft delete file
   - May need to be created or enhanced

5. **PUT /api/files/[id]/sharing**
   - Toggle Buildium tenant/owner portal sharing for a synced file
   - Requires `buildium_file_id`; payload must include both tenant and rental owner flags

## UI/UX Considerations

### Design Patterns

- Follow existing table patterns from `TenantFilesPanel`, `BillFileAttachmentsCard`
- Use consistent spacing and typography
- Match existing modal/dialog patterns
- Ensure responsive design

### Accessibility

- Proper ARIA labels on all interactive elements
- Keyboard navigation support
- Screen reader friendly table structure
- Focus management in modals

### Performance

- Implement pagination to limit initial load
- Lazy load file previews
- Debounce search inputs
- Cache filter options where possible

## Testing Checklist

- [ ] Files table displays correctly
- [ ] Filtering by entity type works
- [ ] Filtering by category works
- [ ] Search functionality works
- [ ] File upload flow works end-to-end
- [ ] File edit updates correctly
- [ ] File delete works (soft delete)
- [ ] File download works
- [ ] File view modal displays correctly
- [ ] Entity links navigate correctly
- [ ] Pagination works
- [ ] Sorting works
- [ ] Responsive design on mobile
- [ ] Error handling for API failures
- [ ] Loading states display correctly

## Migration Considerations

### Data Migration

- Existing files should appear in new Files page
- Verify entity associations are correct
- Ensure categories are properly linked

### Buildium Integration

- Files synced from Buildium should appear
- Buildium file IDs should be preserved
- New uploads for entities with Buildium IDs must immediately push the binary to Buildium (property/unit/tenant/vendor/etc.) and persist returned IDs
- Sync status indicators if applicable

## Implementation Order

1. **Navigation & Page Structure** (Phase 1)
2. **Basic Table Display** (Phase 2)
3. **API Endpoints** (Phase 2)
4. **Filtering & Search** (Phase 3)
5. **File Upload** (Phase 4)
6. **File Actions** (Phase 5)
7. **Enhanced Features** (Phase 6)

## Files to Create/Modify

### New Files

- `src/app/(protected)/files/page.tsx`
- `src/components/files/FilesTable.tsx`
- `src/components/files/FilesFilters.tsx`
- `src/components/files/FileUploadDialog.tsx`
- `src/components/files/FileViewModal.tsx`
- `src/components/files/FileEditModal.tsx`
- `src/app/api/files/list/route.ts` (or enhance existing)

### Modified Files

- `src/components/layout/app-sidebar.tsx` (add navigation item)
- `src/app/api/files/[id]/route.ts` (enhance with PUT/DELETE if needed)
- `src/lib/files.ts` (may need helper functions for org-wide queries)

## Notes

- Buildium Files page uses AngularJS, which makes dynamic inspection challenging
- Plan based on typical PM file management patterns and existing codebase patterns
- Can refine based on actual Buildium page features discovered during implementation
- Should align with existing file upload/management patterns in the codebase

## Additional Findings from Page Exploration

### Sharing Feature Details:

- **Visual Indicators**: Sharing status shown in table via icon (three people icon)
- **Email Integration**: Prominent "+ Compose email" button suggests primary sharing method is email
- **Sharing Column**: Dedicated column in table shows sharing status at a glance
- **File Detail View**: Sharing options likely managed in the file detail/preview modal

### Table Structure Details:

- **Rich Location Data**: Location column shows hierarchical information (Property → Unit → Lease → Contact)
- **Subtitle Support**: Files can have descriptions shown as subtitles under the title
- **Bulk Selection**: Checkbox column enables bulk operations
- **Action Context**: Different action buttons may appear based on file context or selection

### Filtering Details:

- **Date-Based Filtering**: "Last 60 days" suggests date range filtering capability
- **Multi-Filter Support**: Multiple filters can be applied simultaneously
- **Extensible Filters**: "Add filter option" suggests additional filter types available

These observations should be incorporated into the implementation to match Buildium's functionality closely.
