# SectionDetail Component

A reusable component for displaying section information with consistent formatting, edit functionality, and flexible layouts.

## Features

- **Consistent Styling**: Standardized section headers, borders, and field layouts
- **Edit Functionality**: Built-in edit button with hover states
- **Flexible Layouts**: Support for 1-4 column grids
- **Multiple Variants**: Compact, default, and spacious spacing options
- **Custom Content**: Ability to use custom children instead of fields
- **Accessibility**: Proper ARIA labels and keyboard navigation

## Basic Usage

```tsx
import { SectionDetail } from '@/components/ui/section-detail';

<SectionDetail
  title="Contact Information"
  fields={[
    { label: 'EMAIL', value: 'user@example.com' },
    { label: 'PHONE', value: '(555) 123-4567' },
    { label: 'ADDRESS', value: '123 Main St, City, State 12345' },
  ]}
  onEdit={() => console.log('Edit clicked')}
/>;
```

## Contact Information Convenience Component

For contact information specifically, use the `ContactInfoSection` component:

```tsx
import { ContactInfoSection } from '@/components/ui/section-detail';

<ContactInfoSection
  email="user@example.com"
  phone="(555) 123-4567"
  address={{
    line1: '123 Main Street',
    line2: 'Apt 4B',
    city: 'New York',
    state: 'NY',
    postal: '10001',
  }}
  onEdit={handleEdit}
/>;
```

## Props

### SectionDetail

| Prop                  | Type                                   | Default          | Description                           |
| --------------------- | -------------------------------------- | ---------------- | ------------------------------------- |
| `title`               | `string`                               | -                | Section title displayed in the header |
| `fields`              | `SectionDetailField[]`                 | `[]`             | Array of field objects to display     |
| `onEdit`              | `() => void`                           | -                | Callback when edit button is clicked  |
| `editing`             | `boolean`                              | `false`          | Whether the section is in edit mode   |
| `editButtonAriaLabel` | `string`                               | `"Edit {title}"` | ARIA label for edit button            |
| `className`           | `string`                               | `""`             | Additional CSS classes                |
| `children`            | `React.ReactNode`                      | -                | Custom content (overrides fields)     |
| `columns`             | `1 \| 2 \| 3 \| 4`                     | `3`              | Number of columns in the grid         |
| `variant`             | `'default' \| 'compact' \| 'spacious'` | `'default'`      | Spacing variant                       |

### SectionDetailField

| Prop        | Type                        | Default | Description                              |
| ----------- | --------------------------- | ------- | ---------------------------------------- |
| `label`     | `string`                    | -       | Field label (displayed in uppercase)     |
| `value`     | `string \| React.ReactNode` | -       | Field value content                      |
| `className` | `string`                    | -       | Additional CSS classes for the field     |
| `span`      | `1 \| 2 \| 3`               | -       | Number of columns this field should span |

### ContactInfoSection

| Prop        | Type                    | Default | Description                                           |
| ----------- | ----------------------- | ------- | ----------------------------------------------------- |
| `email`     | `string \| null`        | -       | Primary email address                                 |
| `phone`     | `string \| null`        | -       | Primary phone number                                  |
| `address`   | `AddressObject \| null` | -       | Address object with line1, line2, city, state, postal |
| `onEdit`    | `() => void`            | -       | Edit callback                                         |
| `editing`   | `boolean`               | `false` | Edit mode state                                       |
| `className` | `string`                | `""`    | Additional CSS classes                                |

### AddressObject

| Prop     | Type     | Default | Description                       |
| -------- | -------- | ------- | --------------------------------- |
| `line1`  | `string` | -       | Primary address line              |
| `line2`  | `string` | -       | Secondary address line (optional) |
| `city`   | `string` | -       | City name                         |
| `state`  | `string` | -       | State or province                 |
| `postal` | `string` | -       | Postal or ZIP code                |

## Examples

### Different Column Layouts

```tsx
// 2-column layout
<SectionDetail
  title="Financial Summary"
  fields={[
    { label: 'CASH BALANCE', value: '$5.00' },
    { label: 'AVAILABLE BALANCE', value: '$-95.00' }
  ]}
  columns={2}
  onEdit={handleEdit}
/>

// 4-column layout
<SectionDetail
  title="Unit Information"
  fields={[
    { label: 'UNIT', value: '5A' },
    { label: 'STATUS', value: 'Occupied' },
    { label: 'RENT', value: '$2,500' },
    { label: 'SQUARE FT', value: '1,200' }
  ]}
  columns={4}
  onEdit={handleEdit}
/>
```

### Different Variants

```tsx
// Compact spacing
<SectionDetail
  title="Quick Info"
  fields={[
    { label: 'ID', value: '8037' },
    { label: 'STATUS', value: 'Active' }
  ]}
  variant="compact"
  onEdit={handleEdit}
/>

// Spacious spacing
<SectionDetail
  title="Detailed Information"
  fields={[
    { label: 'CREATED', value: 'January 15, 2024' },
    { label: 'LAST UPDATED', value: 'October 10, 2025' }
  ]}
  variant="spacious"
  onEdit={handleEdit}
/>
```

### Custom Content

```tsx
<SectionDetail title="Custom Section" onEdit={handleEdit}>
  <div className="py-4 text-center">
    <p className="text-muted-foreground">Custom content goes here</p>
  </div>
</SectionDetail>
```

### Field Spanning

```tsx
<SectionDetail
  title="Mixed Layout"
  fields={[
    { label: 'NAME', value: 'John Doe', span: 2 },
    { label: 'STATUS', value: 'Active' },
    { label: 'NOTES', value: 'Important notes here...', span: 3 },
  ]}
  columns={3}
  onEdit={handleEdit}
/>
```

## Migration Guide

### From Existing Contact Information Sections

**Before:**

```tsx
<div className="mb-4 flex items-center gap-3 border-b border-border pb-3">
  <h2 className="text-lg font-semibold text-foreground">Contact information</h2>
  <EditLink onClick={() => setEditing(true)} />
</div>
<Card>
  <CardContent className="p-6">
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 text-sm">
      <div>
        <div className="mb-1 text-xs font-medium text-muted-foreground">EMAIL</div>
        <div className="text-foreground">{email || '—'}</div>
      </div>
      {/* ... more fields */}
    </div>
  </CardContent>
</Card>
```

**After:**

```tsx
<ContactInfoSection
  email={email}
  phone={phone}
  address={address}
  onEdit={() => setEditing(true)}
  editing={editing}
/>
```

## Styling

The component uses Tailwind CSS classes and follows the design system:

- **Header**: `text-lg font-semibold text-foreground` with bottom border
- **Edit Button**: Ghost variant with hover states
- **Labels**: `text-xs font-medium text-muted-foreground uppercase`
- **Values**: `text-foreground`
- **Card**: Standard card styling with edit mode indicators

## Accessibility

- Edit button includes proper ARIA labels
- Semantic HTML structure with proper headings
- Keyboard navigation support
- Screen reader friendly field labels and values
