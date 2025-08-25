# Component Documentation

> Generated on: 2025-08-22T17:33:38.770Z
>
> This documentation is automatically generated from your React components.

## Overview

This document describes the React components used in the Property Management System.

## Components

### AddPropertyModal

Step 1: Property Type

**File:** `src/components/AddPropertyModal.tsx`

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean;` | Yes | Prop: isOpen |
| `onClose` | `()` | Yes | Prop: onClose |

#### Usage Example

```tsx

<AddPropertyModal
  isOpen={/* boolean; */}

  onClose={/* () */}

/>

```

---

### AddUnitModal

Basic validation

**File:** `src/components/AddUnitModal.tsx`

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | Yes | isOpen prop of type boolean |
| `onClose` | `() => void` | Yes | onClose prop of type () => void |
| `onSuccess` | `: () => void` | No | onSuccess prop of type : () => void |
| `propertyId` | `string` | Yes | propertyId prop of type string |
| `property` | `: {` | No | property prop of type : { |
| `address_line1` | `string` | Yes | address_line1 prop of type string |
| `address_line2` | `: string` | No | address_line2 prop of type : string |
| `address_line3` | `: string` | No | address_line3 prop of type : string |
| `city` | `string` | Yes | city prop of type string |
| `state` | `string` | Yes | state prop of type string |
| `postal_code` | `string` | Yes | postal_code prop of type string |
| `country` | `string` | Yes | country prop of type string |

#### Usage Example

```tsx

<AddUnitModal
  isOpen={/* boolean */}

  onClose={/* () => void */}

  propertyId={/* string */}

  address_line1={/* string */}

  city={/* string */}

  state={/* string */}

  postal_code={/* string */}

  country={/* string */}

  // onSuccess={/* : () => void */}

  // property={/* : { */}

  // address_line2={/* : string */}

  // address_line3={/* : string */}

/>

```

---

### BankingDetailsModal

Fetch bank accounts when modal opens

**File:** `src/components/BankingDetailsModal.tsx`

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | Yes | isOpen prop of type boolean |
| `onClose` | `() => void` | Yes | onClose prop of type () => void |
| `onSuccess` | `() => void` | Yes | onSuccess prop of type () => void |
| `property` | `PropertyWithDetails` | Yes | property prop of type PropertyWithDetails |

#### Usage Example

```tsx

<BankingDetailsModal
  isOpen={/* boolean */}

  onClose={/* () => void */}

  onSuccess={/* () => void */}

  property={/* PropertyWithDetails */}

/>

```

---

### BasicAddressAutocomplete

Sample US addresses for demonstration

**File:** `src/components/BasicAddressAutocomplete.tsx`

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `string` | Yes | Current value |
| `onChange` | `(value: string) => void` | Yes | onChange prop of type (value: string) => void |
| `onPlaceSelect` | `: (place: {` | No | onPlaceSelect prop of type : (place: { |
| `address` | `string` | Yes | address prop of type string |
| `city` | `string` | Yes | city prop of type string |
| `state` | `string` | Yes | state prop of type string |
| `postalCode` | `string` | Yes | postalCode prop of type string |
| `country` | `string` | Yes | country prop of type string |

#### Usage Example

```tsx

<BasicAddressAutocomplete
  value={/* string */}

  onChange={/* (value: string) => void */}

  address={/* string */}

  city={/* string */}

  state={/* string */}

  postalCode={/* string */}

  country={/* string */}

  // onPlaceSelect={/* : (place: { */}

/>

```

---

### CreateBankAccountModal

If response is not JSON, use status text

**File:** `src/components/CreateBankAccountModal.tsx`

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | Yes | isOpen prop of type boolean |
| `onClose` | `() => void` | Yes | onClose prop of type () => void |
| `onSuccess` | `(newAccount: any) => void` | Yes | onSuccess prop of type (newAccount: any) => void |

#### Usage Example

```tsx

<CreateBankAccountModal
  isOpen={/* boolean */}

  onClose={/* () => void */}

  onSuccess={/* (newAccount: any) => void */}

/>

```

---

### CreateOwnerModal

Basic Information

**File:** `src/components/CreateOwnerModal.tsx`

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | Yes | isOpen prop of type boolean |
| `onClose` | `() => void` | Yes | onClose prop of type () => void |
| `onCreateOwner` | `(ownerData: any) => void` | Yes | onCreateOwner prop of type (ownerData: any) => void |
| `isLoading` | `boolean` | Yes | isLoading prop of type boolean |
| `error` | `string | null` | Yes | Error state or message |

#### Usage Example

```tsx

<CreateOwnerModal
  isOpen={/* boolean */}

  onClose={/* () => void */}

  onCreateOwner={/* (ownerData: any) => void */}

  isLoading={/* boolean */}

  error={/* string | null */}

/>

```

---

### CreateStaffModal

If response is not JSON, use status text

**File:** `src/components/CreateStaffModal.tsx`

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | Yes | isOpen prop of type boolean |
| `onClose` | `() => void` | Yes | onClose prop of type () => void |
| `onSuccess` | `(newStaff: any) => void` | Yes | onSuccess prop of type (newStaff: any) => void |

#### Usage Example

```tsx

<CreateStaffModal
  isOpen={/* boolean */}

  onClose={/* () => void */}

  onSuccess={/* (newStaff: any) => void */}

/>

```

---

### EditOwnerModal

Basic Information

**File:** `src/components/EditOwnerModal.tsx`

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | Yes | isOpen prop of type boolean |
| `onClose` | `() => void` | Yes | onClose prop of type () => void |
| `onUpdateOwner` | `(ownerData: any) => void` | Yes | onUpdateOwner prop of type (ownerData: any) => void |
| `ownerData` | `any` | Yes | ownerData prop of type any |
| `isUpdating` | `: boolean` | No | isUpdating prop of type : boolean |

#### Usage Example

```tsx

<EditOwnerModal
  isOpen={/* boolean */}

  onClose={/* () => void */}

  onUpdateOwner={/* (ownerData: any) => void */}

  ownerData={/* any */}

  // isUpdating={/* : boolean */}

/>

```

---

### EditPropertyModal

primary_owner removed - now determined from ownerships table

**File:** `src/components/EditPropertyModal.tsx`

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | Yes | isOpen prop of type boolean |
| `onClose` | `() => void` | Yes | onClose prop of type () => void |
| `onSuccess` | `() => void` | Yes | onSuccess prop of type () => void |
| `property` | `PropertyWithDetails` | Yes | property prop of type PropertyWithDetails |

#### Usage Example

```tsx

<EditPropertyModal
  isOpen={/* boolean */}

  onClose={/* () => void */}

  onSuccess={/* () => void */}

  property={/* PropertyWithDetails */}

/>

```

---

### GoogleMapsDebug

Check immediately

**File:** `src/components/GoogleMapsDebug.tsx`

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `google` | `!!googleAvailable` | Yes | Prop: google |
| `maps` | `!!mapsAvailable` | Yes | Prop: maps |
| `places` | `!!placesAvailable` | Yes | Prop: places |
| `fullObject` | `window.google` | Yes | Prop: fullObject |

#### Usage Example

```tsx

<GoogleMapsDebug
  google={/* !!googleAvailable */}

  maps={/* !!mapsAvailable */}

  places={/* !!placesAvailable */}

  fullObject={/* window.google */}

/>

```

---

### GooglePlacesAutocomplete

Optionally, you could poll for a short time if you expect the script to load after mount

**File:** `src/components/GooglePlacesAutocomplete.tsx`

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `string` | Yes | Current value |
| `onChange` | `(value: string) => void` | Yes | onChange prop of type (value: string) => void |
| `onPlaceSelect` | `: (place: {` | No | onPlaceSelect prop of type : (place: { |
| `address` | `string` | Yes | address prop of type string |
| `city` | `string` | Yes | city prop of type string |
| `state` | `string` | Yes | state prop of type string |
| `postalCode` | `string` | Yes | postalCode prop of type string |
| `country` | `string` | Yes | country prop of type string |

#### Usage Example

```tsx

<GooglePlacesAutocomplete
  value={/* string */}

  onChange={/* (value: string) => void */}

  address={/* string */}

  city={/* string */}

  state={/* string */}

  postalCode={/* string */}

  country={/* string */}

  // onPlaceSelect={/* : (place: { */}

/>

```

---

### AddressAutocomplete

React component

**File:** `src/components/HybridAddressAutocomplete.tsx`

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `string` | Yes | Current value |
| `onChange` | `(value: string) => void` | Yes | onChange prop of type (value: string) => void |
| `onPlaceSelect` | `: (place: {` | No | onPlaceSelect prop of type : (place: { |
| `address` | `string` | Yes | address prop of type string |
| `city` | `string` | Yes | city prop of type string |
| `state` | `string` | Yes | state prop of type string |
| `postalCode` | `string` | Yes | postalCode prop of type string |
| `country` | `string` | Yes | country prop of type string |

#### Usage Example

```tsx

<HybridAddressAutocomplete
  value={/* string */}

  onChange={/* (value: string) => void */}

  address={/* string */}

  city={/* string */}

  state={/* string */}

  postalCode={/* string */}

  country={/* string */}

  // onPlaceSelect={/* : (place: { */}

/>

```

---

### LiveAddressAutocomplete

Clear previous timeout

**File:** `src/components/LiveAddressAutocomplete.tsx`

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `string` | Yes | Current value |
| `onChange` | `(value: string) => void` | Yes | onChange prop of type (value: string) => void |
| `onPlaceSelect` | `: (place: {` | No | onPlaceSelect prop of type : (place: { |
| `address` | `string` | Yes | address prop of type string |
| `city` | `string` | Yes | city prop of type string |
| `state` | `string` | Yes | state prop of type string |
| `postalCode` | `string` | Yes | postalCode prop of type string |
| `country` | `string` | Yes | country prop of type string |

#### Usage Example

```tsx

<LiveAddressAutocomplete
  value={/* string */}

  onChange={/* (value: string) => void */}

  address={/* string */}

  city={/* string */}

  state={/* string */}

  postalCode={/* string */}

  country={/* string */}

  // onPlaceSelect={/* : (place: { */}

/>

```

---

### Sidebar

React component

**File:** `src/components/layout/sidebar.tsx`

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `callbackUrl` | `'/auth/signin'` | Yes | Prop: callbackUrl |

#### Usage Example

```tsx

<sidebar
  callbackUrl={/* '/auth/signin' */}

/>

```

---

### PropertyFiles

Mock files data - in a real app, this would come from your database

**File:** `src/components/property/PropertyFiles.tsx`

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `propertyId` | `string` | Yes | propertyId prop of type string |
| `isMockData` | `: boolean` | No | isMockData prop of type : boolean |

#### Usage Example

```tsx

<PropertyFiles
  propertyId={/* string */}

  // isMockData={/* : boolean */}

/>

```

---

### PropertyFinancials

Mock financial data - in a real app, this would come from your database

**File:** `src/components/property/PropertyFinancials.tsx`

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `propertyId` | `string` | Yes | propertyId prop of type string |
| `isMockData` | `: boolean` | No | isMockData prop of type : boolean |

#### Usage Example

```tsx

<PropertyFinancials
  propertyId={/* string */}

  // isMockData={/* : boolean */}

/>

```

---

### PropertySummary

Call the callback to refresh the property data

**File:** `src/components/property/PropertySummary.tsx`

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `property` | `PropertyWithDetails` | Yes | property prop of type PropertyWithDetails |
| `onPropertyUpdate` | `: () => void` | No | onPropertyUpdate prop of type : () => void |

#### Usage Example

```tsx

<PropertySummary
  property={/* PropertyWithDetails */}

  // onPropertyUpdate={/* : () => void */}

/>

```

---

### PropertyUnits

Mock units data - fallback when API is not available

**File:** `src/components/property/PropertyUnits.tsx`

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `propertyId` | `string` | Yes | propertyId prop of type string |
| `isMockData` | `: boolean` | No | isMockData prop of type : boolean |
| `property` | `: PropertyWithDetails` | No | property prop of type : PropertyWithDetails |
| `onUnitsChange` | `: () => void` | No | onUnitsChange prop of type : () => void |

#### Usage Example

```tsx

<PropertyUnits
  propertyId={/* string */}

  // isMockData={/* : boolean */}

  // property={/* : PropertyWithDetails */}

  // onUnitsChange={/* : () => void */}

/>

```

---

### PropertyVendors

Mock vendors data - in a real app, this would come from your database

**File:** `src/components/property/PropertyVendors.tsx`

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `propertyId` | `string` | Yes | propertyId prop of type string |
| `isMockData` | `: boolean` | No | isMockData prop of type : boolean |

#### Usage Example

```tsx

<PropertyVendors
  propertyId={/* string */}

  // isMockData={/* : boolean */}

/>

```

---

### Providers

React component

**File:** `src/components/providers.tsx`

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `children` | `React.ReactNode` | Yes | Prop: children |

#### Usage Example

```tsx

<providers
  children={/* React.ReactNode */}

/>

```

---

### Dropdown

Dropdown component (Headless UI Listbox)
  Props:
  - value: selected value
  - onChange: function to call with new value
  - options: array of { value, label }
  - placeholder: string to show when no value is selected

**File:** `src/components/ui/Dropdown.tsx`

No props defined.

---

### Button

React component

**File:** `src/components/ui/button.tsx`

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `visible` | `outline-none` | Yes | Prop: visible |
| `visible` | `ring-2` | Yes | Prop: visible |
| `visible` | `ring-ring` | Yes | Prop: visible |
| `visible` | `ring-offset-2` | Yes | Prop: visible |
| `disabled` | `pointer-events-none` | Yes | Prop: disabled |
| `disabled` | `opacity-50"` | Yes | Prop: disabled |
| `variants` | `{` | Yes | Prop: variants |
| `variant` | `{` | Yes | Prop: variant |
| `default` | `"bg-primary` | Yes | Prop: default |
| `hover` | `bg-primary/90"` | Yes | Prop: hover |
| `destructive` | `"bg-destructive` | Yes | Prop: destructive |
| `hover` | `bg-destructive/90"` | Yes | Prop: hover |
| `outline` | `"border` | Yes | Prop: outline |
| `hover` | `bg-accent` | Yes | Prop: hover |
| `hover` | `text-accent-foreground"` | Yes | Prop: hover |
| `secondary` | `"bg-secondary` | Yes | Prop: secondary |
| `hover` | `bg-secondary/80"` | Yes | Prop: hover |
| `ghost` | `"hover:bg-accent` | Yes | Prop: ghost |
| `hover` | `text-accent-foreground"` | Yes | Prop: hover |
| `link` | `"text-primary` | Yes | Prop: link |
| `hover` | `underline"` | Yes | Prop: hover |
| `size` | `{` | Yes | Prop: size |
| `default` | `"h-10` | Yes | Prop: default |
| `sm` | `"h-9` | Yes | Prop: sm |
| `lg` | `"h-11` | Yes | Prop: lg |
| `icon` | `"h-10` | Yes | Prop: icon |
| `defaultVariants` | `{` | Yes | Prop: defaultVariants |
| `variant` | `"default"` | Yes | Prop: variant |
| `size` | `"default"` | Yes | Prop: size |

#### Usage Example

```tsx

<button
  visible={/* outline-none */}

  visible={/* ring-2 */}

  visible={/* ring-ring */}

  visible={/* ring-offset-2 */}

  disabled={/* pointer-events-none */}

  disabled={/* opacity-50" */}

  variants={/* { */}

  variant={/* { */}

  default={/* "bg-primary */}

  hover={/* bg-primary/90" */}

  destructive={/* "bg-destructive */}

  hover={/* bg-destructive/90" */}

  outline={/* "border */}

  hover={/* bg-accent */}

  hover={/* text-accent-foreground" */}

  secondary={/* "bg-secondary */}

  hover={/* bg-secondary/80" */}

  ghost={/* "hover:bg-accent */}

  hover={/* text-accent-foreground" */}

  link={/* "text-primary */}

  hover={/* underline" */}

  size={/* { */}

  default={/* "h-10 */}

  sm={/* "h-9 */}

  lg={/* "h-11 */}

  icon={/* "h-10 */}

  defaultVariants={/* { */}

  variant={/* "default" */}

  size={/* "default" */}

/>

```

---

### MockDataIndicator

React component

**File:** `src/components/ui/mock-data-indicator.tsx`

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isMockData` | `boolean` | Yes | isMockData prop of type boolean |
| `className` | `: string` | No | className prop of type : string |
| `showIcon` | `: boolean` | No | showIcon prop of type : boolean |
| `variant` | `: 'badge' | 'banner' | 'inline'` | No | Visual variant |

#### Usage Example

```tsx

<mock-data-indicator
  isMockData={/* boolean */}

  // className={/* : string */}

  // showIcon={/* : boolean */}

  // variant={/* : 'badge' | 'banner' | 'inline' */}

/>

```

---

### Tabs

React component

**File:** `src/components/ui/tabs.tsx`

No props defined.

---

## Component Guidelines

### Naming Conventions

- Component names use PascalCase
- File names match component names
- Props interfaces are named `{ComponentName}Props`

### Best Practices

1. Use TypeScript for type safety
2. Define prop interfaces for all components
3. Include JSDoc comments for complex components
4. Use consistent prop naming conventions
5. Provide default values for optional props
6. Handle loading and error states appropriately

### Common Props

- `children`: Child components or content
- `className`: CSS class names for styling
- `onClick`: Click event handlers
- `onChange`: Change event handlers
- `value`: Current value for controlled components
- `disabled`: Disabled state
- `loading`: Loading state
- `error`: Error state or message
