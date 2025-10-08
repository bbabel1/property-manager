# Date Picker Migration Guide

## Overview

We have standardized on using native HTML date inputs (`type="date"`) instead of the custom `DatePicker` component for better consistency, accessibility, and user experience across the application.

## Current Status

### ✅ Forms Updated to Native Date Inputs

- **Receive Payment Form** (`src/components/leases/ReceivePaymentForm.tsx`)
- **Enter Charge Form** (`src/components/leases/EnterChargeForm.tsx`)
- **Add New Lease Form** (`src/components/units/LeaseSection.tsx`)

### 🔄 Forms Still Using Custom DatePicker (Need Migration)

- Tenant Personal Info Editor (`src/components/tenants/TenantPersonalInfoInlineEditor.tsx`)
- Edit Owner Modal (`src/EditOwnerModal.tsx`, `src/components/EditOwnerModal.tsx`)
- Create Owner Modal (`src/CreateOwnerModal.tsx`, `src/components/CreateOwnerModal.tsx`)
- Edit Tenant Contact Modal (`src/components/tenants/EditTenantContactModal.tsx`)
- Withhold Deposit Form (`src/components/leases/WithholdDepositForm.tsx`)
- Recurring Payment Form (`src/components/leases/RecurringPaymentForm.tsx`)
- Issue Refund Form (`src/components/leases/IssueRefundForm.tsx`)
- Issue Credit Form (`src/components/leases/IssueCreditForm.tsx`)
- Recurring Charge Form (`src/components/leases/RecurringChargeForm.tsx`)
- Rent Schedule Form (`src/components/leases/RentScheduleForm.tsx`)

### ✅ Forms Already Using Native Date Inputs

- Lease Header Meta (`src/components/leases/LeaseHeaderMeta.tsx`)
- Tenant Move In Editor (`src/components/leases/TenantMoveInEditor.tsx`)
- Start Continue Reconciliation (`src/components/StartContinueReconciliation.tsx`)
- Date Range Controls (`src/components/DateRangeControls.tsx`)

## Migration Pattern

### Before (Custom DatePicker)

```tsx
import { DatePicker } from '@/components/ui/date-picker';

<DatePicker value={date} onChange={setDate} placeholder="YYYY-MM-DD" />;
```

### After (Native Date Input)

```tsx
import { Input } from '@/components/ui/input';

<Input type="date" value={date || ''} onChange={(e) => setDate(e.target.value)} />;
```

### Using the Helper Function

```tsx
import { Input } from '@/components/ui/input';
import { DATE_PICKER_CONFIG } from '@/lib/date-picker-config';

<Input {...DATE_PICKER_CONFIG.createDateInputProps(date, setDate)} />;
```

## Benefits of Native Date Inputs

1. **Consistency**: Same date picker experience across all browsers
2. **Accessibility**: Better screen reader support and keyboard navigation
3. **Mobile Friendly**: Native mobile date pickers on mobile devices
4. **Simpler Code**: Less complex state management and parsing
5. **Performance**: No custom JavaScript for date parsing and validation

## Configuration

Global configuration is available in `src/lib/date-picker-config.ts`:

```tsx
import { DATE_PICKER_CONFIG } from '@/lib/date-picker-config';

// Check if native inputs are enabled
DATE_PICKER_CONFIG.useNativeDateInput; // true

// Get standardized props
const props = DATE_PICKER_CONFIG.createDateInputProps(date, setDate, 'custom-class');
```

## Migration Checklist

For each form using custom DatePicker:

- [ ] Remove `DatePicker` import
- [ ] Replace `<DatePicker>` with `<Input type="date">`
- [ ] Update value prop to handle null/undefined (use `|| ''`)
- [ ] Update onChange to use `e.target.value`
- [ ] Test date selection and validation
- [ ] Verify form submission works correctly
- [ ] Check accessibility (screen readers, keyboard navigation)

## Testing

After migration, verify:

1. Date picker opens correctly in browser
2. Date selection works properly
3. Form validation still works
4. Mobile date picker appears on mobile devices
5. Screen readers can access the date input
6. Keyboard navigation works (Tab to focus, Enter to open picker)

## Future Considerations

- Consider deprecating the custom `DatePicker` component once all forms are migrated
- Add ESLint rules to prevent usage of custom DatePicker
- Consider adding TypeScript types for date input props
