# Add Lease Form - Field and Behavior Reference

This document outlines the complete field structure, validation rules, and interactive behaviors of the Add Lease form, matching Buildium's functionality while using our application's design system.

## Overview

The Add Lease form is a **single-page form** that displays all sections at once, matching Buildium's form layout. All sections are visible simultaneously, allowing users to fill out the form in any order. The form consists of the following sections:

1. **Lease Details** - Property, Unit, Lease Type, and Dates
2. **Lease Contacts** - Tenants and Cosigners
3. **Rent** - Rent amount, cycle, account, and due date
4. **Rent Proration** - Optional first/last month proration
5. **Security Deposit** - Deposit amount and due date
6. **Charges** - Additional lease charges and notes
7. **Lease Documents** - File upload for lease documents

## Form Structure

### Section 1: Lease Details

#### Fields

| Field    | Type   | Required | Validation                                  | Behavior                                                                                                                            |
| -------- | ------ | -------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Property | Select | Yes      | Must select from active properties          | - Loads all active properties from database<br>- Shows property name and address<br>- On selection, filters units for that property |
| Unit     | Select | Yes      | Must select from units in selected property | - Disabled until property is selected<br>- Shows unit number or unit name<br>- Cleared when property changes                        |

#### Validation Rules

- Both property and unit must be selected to proceed
- Unit dropdown is disabled until a property is selected
- If no units exist for a property, shows "No units found" message

#### Dynamic Behaviors

- **Property Selection**: Automatically loads units for the selected property
- **Unit Reset**: When property changes, unit selection is cleared
- **Loading States**: Shows loading spinner while fetching properties/units

---

### Section 2: Lease Contacts

#### Fields

| Field           | Type         | Required | Validation                           | Behavior                                                                                 |
| --------------- | ------------ | -------- | ------------------------------------ | ---------------------------------------------------------------------------------------- |
| Start Date      | DatePicker   | Yes      | Must be a valid date                 | - Uses date picker component<br>- Format: YYYY-MM-DD                                     |
| End Date        | DatePicker   | Yes      | Must be on or after start date       | - Uses date picker component<br>- Minimum date set to start date<br>- Format: YYYY-MM-DD |
| Lease Type      | Select       | No       | One of: Fixed, MonthToMonth, Renewal | - Default: "Fixed"<br>- Dropdown selection                                               |
| Payment Due Day | Number Input | No       | Integer between 1-31                 | - Optional day of month for rent due date<br>- Validates range 1-31                      |

#### Validation Rules

- Start date and end date are required
- End date must be on or after start date (enforced by date picker)
- Payment due day must be between 1 and 31 if provided

#### Dynamic Behaviors

- **End Date Constraint**: End date picker automatically sets minimum date to start date
- **Date Format**: Dates are stored in ISO format (YYYY-MM-DD)

---

### Section 3: Rent

#### Fields

| Field                      | Type           | Required | Validation                                             | Behavior                                                                                            |
| -------------------------- | -------------- | -------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Monthly Rent               | Currency Input | No       | Positive number or null                                | - Currency formatting ($X,XXX.XX)<br>- Accepts numeric input with formatting<br>- Can be left empty |
| Rent Cycle                 | Select         | No       | One of: Monthly, Weekly, Biweekly, Quarterly, Annually | - Default: "Monthly"<br>- Affects recurring transaction frequency                                   |
| Security Deposit           | Currency Input | No       | Positive number or null                                | - Currency formatting<br>- Can be left empty                                                        |
| Prorated First Month Rent  | Currency Input | No       | Positive number or null                                | - Optional proration amount<br>- Currency formatting                                                |
| Prorated Last Month Rent   | Currency Input | No       | Positive number or null                                | - Optional proration amount<br>- Currency formatting                                                |
| Additional Charges (Notes) | Textarea       | No       | Free text                                              | - Multi-line text input<br>- Optional notes about additional charges                                |

#### Validation Rules

- All currency fields accept positive numbers or can be empty
- No required fields in this step (all optional)

#### Dynamic Behaviors

- **Currency Formatting**: Automatically formats input as currency ($X,XXX.XX)
- **Rent Schedule Creation**: If rent amount is provided, automatically creates:
  - A rent schedule entry with the lease term
  - A recurring transaction for monthly rent
- **Rent Cycle Mapping**: Maps UI values to database enum values:
  - `Monthly` → `Monthly`
  - `Weekly` → `Weekly`
  - `Biweekly` → `Every2Weeks`
  - `Quarterly` → `Quarterly`
  - `Annually` → `Yearly`

---

### Section 4: Rent Proration

#### Existing Tenants Section

| Field          | Type          | Required | Validation         | Behavior                                                                                               |
| -------------- | ------------- | -------- | ------------------ | ------------------------------------------------------------------------------------------------------ |
| Search Input   | Text Input    | No       | Free text          | - Debounced search (300ms delay)<br>- Searches by first name, last name, or email                      |
| Tenant Results | Checkbox List | No       | Multiple selection | - Shows matching tenants with name and email<br>- Checkbox selection<br>- Visual feedback on selection |

#### New Tenants Section

| Field                | Type        | Required        | Validation          | Behavior                                                                                                   |
| -------------------- | ----------- | --------------- | ------------------- | ---------------------------------------------------------------------------------------------------------- |
| First Name           | Text Input  | Yes (if adding) | Non-empty string    | - Required for each new tenant<br>- Text input                                                             |
| Last Name            | Text Input  | Yes (if adding) | Non-empty string    | - Required for each new tenant<br>- Text input                                                             |
| Email                | Email Input | No              | Valid email format  | - Optional email address<br>- Email validation                                                             |
| Phone                | Tel Input   | No              | Phone number format | - Optional phone number<br>- Text input                                                                    |
| Role                 | Checkbox    | No              | Tenant or Cosigner  | - Checkbox: "Mark as primary tenant"<br>- If checked: role = "Tenant"<br>- If unchecked: role = "Cosigner" |
| Same as Unit Address | Implicit    | Yes             | Boolean             | - Default: true<br>- Used for address assignment                                                           |

#### Validation Rules

- At least one tenant must be added (existing or new)
- New tenants require first name and last name
- Email format validation (if provided)

#### Dynamic Behaviors

- **Debounced Search**: Tenant search waits 300ms after typing stops
- **Search Results**: Shows up to 10 matching tenants
- **Multiple Selection**: Can select multiple existing tenants
- **Add/Remove**: Can dynamically add or remove new tenant entries
- **Role Assignment**: Checkbox determines if tenant is primary (rent responsible)
- **Visual Feedback**: Selected tenants shown as badges
- **Loading States**: Shows spinner while searching

#### Tenant Data Structure

- **Existing Tenants**: Linked via `tenant_id` with role "Tenant" and `is_rent_responsible: true`
- **New Tenants**: Created as `new_people` array with contact information:
  - Creates contact record
  - Creates tenant record linked to contact
  - Links to lease via `lease_contacts`

---

### Section 5: Security Deposit

#### Fields

| Field         | Type           | Required            | Validation              | Behavior                                                                                         |
| ------------- | -------------- | ------------------- | ----------------------- | ------------------------------------------------------------------------------------------------ |
| Amount        | Currency Input | No                  | Positive number or null | - Currency formatting<br>- Auto-populated from rent amount if not touched<br>- Can be left empty |
| Next Due Date | Date Input     | Yes (if amount set) | Valid date              | - Date picker<br>- Required when deposit amount is set                                           |

---

### Section 6: Charges

#### Fields

| Field         | Type     | Required | Validation | Behavior                                                             |
| ------------- | -------- | -------- | ---------- | -------------------------------------------------------------------- |
| Lease Charges | Textarea | No       | Free text  | - Multi-line text input<br>- Optional notes about additional charges |

---

### Section 7: Lease Documents

#### Fields

| Field       | Type       | Required | Validation                    | Behavior                                                                                    |
| ----------- | ---------- | -------- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| File Upload | File Input | No       | Up to 10 files, max 25MB each | - Drag & drop or browse<br>- Supports PDF and images<br>- Files upload after lease is saved |

#### Summary Section

Displays read-only summary of all entered information:

- Property name
- Unit number
- Start date
- End date
- Rent amount (formatted)
- Security deposit (formatted)

#### Options Section

| Field              | Type   | Required | Validation | Behavior                                                                                    |
| ------------------ | ------ | -------- | ---------- | ------------------------------------------------------------------------------------------- |
| Sync to Buildium   | Switch | No       | Boolean    | - Default: true<br>- Toggles Buildium sync                                                  |
| Send Welcome Email | Switch | No       | Boolean    | - Default: true<br>- Disabled if Buildium sync is off<br>- Sends welcome email via Buildium |

#### Validation Rules

- All previous step validations must pass
- At least one tenant must be added

#### Dynamic Behaviors

- **Sync Toggle**: Enables/disables Buildium integration
- **Welcome Email**: Automatically disabled when Buildium sync is off
- **Form Submission**: Validates all data and creates lease via API

---

## Form Layout

### Single-Page Design

The form uses a **single-page layout** where all sections are visible at once, matching Buildium's form structure. Users can scroll through all sections and fill them out in any order.

### Form Header

- **Title**: "Add Lease"
- **Sync to Buildium Checkbox**: Toggle to enable/disable Buildium sync
- **Action Buttons**: Cancel and Save buttons in the header (always visible)

### Section Organization

- **Vertical Layout**: All sections stack vertically with consistent spacing
- **Section Headers**: Each section has a clear header with title
- **Visual Separation**: Sections use borders and background colors to distinguish them
- **Conditional Display**: Proration section only shows when applicable

### Validation

Form validates all required fields on submit:

- Property and unit required
- Start and end dates required
- At least one tenant required
- Rent account required when rent amount is set
- Deposit account required when deposit amount is set
- Rent due date required when rent amount is set
- Deposit due date required when deposit amount is set

---

## API Integration

### Endpoint

- **Create Lease**: `POST /api/leases` or `POST /api/leases?syncBuildium=true`

### Request Payload Structure

```typescript
{
  property_id: string;
  unit_id: string;
  lease_from_date: string; // ISO date format
  lease_to_date: string; // ISO date format
  lease_type: string; // "Fixed" | "MonthToMonth" | "Renewal"
  payment_due_day: number | null;
  rent_amount: number | null;
  security_deposit: number | null;
  lease_charges: string | null;
  prorated_first_month_rent: number | null;
  prorated_last_month_rent: number | null;
  syncBuildium: boolean;
  send_welcome_email: boolean;
  contacts?: Array<{
    tenant_id: string;
    role: string;
    is_rent_responsible: boolean;
  }>;
  new_people?: Array<{
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    role: string;
    same_as_unit_address: boolean;
  }>;
  rent_schedules?: Array<{
    start_date: string;
    end_date: string;
    total_amount: number;
    rent_cycle: string;
    status: string;
    backdate_charges: boolean;
  }>;
  recurring_transactions?: Array<{
    amount: number;
    memo: string;
    frequency: string;
    start_date: string;
    gl_account_id: string | null;
  }>;
}
```

### Response Handling

- **Success**: Closes modal, refreshes lease list, shows success state
- **Error**: Displays error message in form, allows user to correct and retry

---

## Field-Level Validation

### Real-time Validation

- Currency fields: Format as user types
- Date fields: Validate date format and constraints
- Email fields: Validate email format
- Required fields: Show error on blur if empty

### Submission Validation

- All required fields must be filled
- Date constraints must be met
- At least one tenant must be added
- Form shows error message if validation fails

---

## Responsive Design

### Breakpoints

- **Mobile (< 640px)**: Single column layout, full-width inputs
- **Tablet (640px - 1024px)**: Two-column grid where appropriate
- **Desktop (> 1024px)**: Optimal spacing and layout

### Mobile Optimizations

- Touch-friendly input sizes
- Full-width buttons on mobile
- Scrollable modal content
- Optimized date picker for touch

### Tablet Optimizations

- Two-column grid for date fields
- Optimized spacing
- Maintains readability

### Desktop Optimizations

- Maximum width constraint (56rem)
- Optimal spacing and padding
- Hover states for interactive elements

---

## Error Handling

### Error Display

- **Inline Errors**: Field-level validation messages
- **Step Errors**: Validation message at top of step
- **Submission Errors**: Error alert at top of form

### Error Recovery

- User can correct errors and retry
- Form state is preserved on error
- Navigation remains functional during errors

---

## Accessibility

### Keyboard Navigation

- Tab order follows form flow
- Enter key submits current step
- Escape key closes modal
- Arrow keys navigate date picker

### Screen Reader Support

- All fields have associated labels
- Error messages are announced
- Progress indicator announces current step
- Button states are announced

### Focus Management

- Focus moves to first field on step change
- Focus returns to trigger button on close
- Error fields receive focus when shown

---

## State Management

### Form State

- All form data stored in React state
- State persists during navigation
- State cleared on modal close
- State reset on successful submission

### Loading States

- Properties/units loading
- Tenant search loading
- Form submission loading

### Error States

- Field-level errors
- Step-level errors
- Submission errors

---

## Design System Integration

### Colors

- Uses theme variables for consistent coloring
- Primary color for active states
- Destructive color for errors
- Muted colors for disabled states

### Typography

- Consistent font sizes and weights
- Proper text hierarchy
- Readable line heights

### Spacing

- Consistent padding and margins
- Grid-based layout
- Responsive spacing

### Components

- Uses shared UI components (Button, Input, Select, etc.)
- Consistent component styling
- Theme-aware components

---

## Future Enhancements

Potential improvements for future iterations:

1. **File Upload**: Add lease document upload capability
2. **Advanced Rent Schedules**: Support for multiple rent schedule periods
3. **Recurring Charges**: Add UI for additional recurring charges
4. **Lease Templates**: Save and reuse lease templates
5. **Bulk Tenant Import**: Import multiple tenants from CSV
6. **Validation Improvements**: More granular field-level validation
7. **Auto-save**: Save draft leases automatically
8. **Lease Preview**: Preview lease before creation

---

## Testing Checklist

### Functional Testing

- [ ] Property selection loads units
- [ ] Date validation works correctly
- [ ] Currency formatting works
- [ ] Tenant search returns results
- [ ] Form submission creates lease
- [ ] Error handling displays correctly
- [ ] Navigation between steps works

### Validation Testing

- [ ] Required fields prevent progression
- [ ] Date constraints enforced
- [ ] Email validation works
- [ ] Currency validation works
- [ ] Tenant requirement enforced

### Responsive Testing

- [ ] Mobile layout works
- [ ] Tablet layout works
- [ ] Desktop layout works
- [ ] Touch interactions work

### Accessibility Testing

- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Focus management correct
- [ ] Error announcements work
