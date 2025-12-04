# Enhanced Greys Design System

## Overview

The enhanced greys system provides improved contrast, readability, and visual hierarchy throughout the application. This system replaces lighter greys (often with opacity) with more substantial mid-grey tones for better definition and clarity.

**Key Principle**: Use the right shade level instead of opacity modifiers. For example, use `bg-slate-100` instead of `bg-slate-50/50` for better visibility.

## Color Scale

### Backgrounds

- **Subtle backgrounds**: `bg-slate-50` → Use `bg-slate-100` for better visibility
- **Panel backgrounds**: `bg-slate-50/50` → Use `bg-slate-100` for more definition
- **Container backgrounds**: `bg-slate-50/30` → Use `bg-slate-100` for clarity
- **Navigation pills**: `bg-gray-100` → Use `bg-slate-200` for more substantial appearance

### Borders

- **Subtle borders**: `border-slate-200` → Use `border-slate-300` for better definition
- **Standard borders**: `border-slate-200` → Use `border-slate-300` for clarity
- **Strong borders**: `border-slate-300` → Use `border-slate-400` for emphasis
- **Dashed borders**: `border-slate-300` → Use `border-slate-400` for visibility

### Text Colors

- **Muted text**: `text-slate-500` → Use `text-slate-600` for better readability
- **Secondary text**: `text-slate-500` → Use `text-slate-600` for improved contrast
- **Icons**: `text-slate-600` → Use `text-slate-700` for clearer visibility
- **Labels**: `text-slate-700` → Use `text-slate-800` for stronger emphasis

### Hover States

- **Subtle hover**: `hover:bg-slate-50` → Use `hover:bg-slate-200` for clearer feedback
- **Button hover**: Add `hover:bg-slate-200` for ghost buttons
- **Card hover**: Add `hover:bg-slate-50` and `hover:border-slate-400` for interactive cards

## Migration Guide

### Before → After

```tsx
// Backgrounds
className="bg-slate-50/50"        → className="bg-slate-100"
className="bg-slate-50/30"        → className="bg-slate-100"
className="bg-gray-100"           → className="bg-slate-200"

// Borders
className="border-slate-200"      → className="border-slate-300"
className="border-slate-300"      → className="border-slate-400" (for emphasis)

// Text
className="text-slate-500"        → className="text-slate-600"
className="text-slate-600"        → className="text-slate-700" (for icons/labels)
className="text-slate-700"        → className="text-slate-800" (for emphasis)

// Hover States
className="hover:bg-slate-50"     → className="hover:bg-slate-200"
```

## Usage Examples

### Navigation Pills

```tsx
<TabsTrigger className="bg-slate-200 text-slate-700 hover:bg-slate-300 data-[state=active]:bg-white data-[state=active]:shadow-sm">
  Tab Label
</TabsTrigger>
```

### Card Containers

```tsx
<div className="rounded-lg border border-slate-300 bg-slate-100 p-3">Content</div>
```

### Task/Item Cards

```tsx
<div className="border border-slate-300 bg-white p-3 transition hover:border-slate-400 hover:bg-slate-50">
  Task Item
</div>
```

### Empty States

```tsx
<div className="border border-dashed border-slate-400 bg-slate-100 p-6 text-slate-600">
  No items yet
</div>
```

## CSS Variables

The enhanced greys are also available through CSS variables in `styles/tokens.css`:

- `--border`: Enhanced to use `gray-300` (was `gray-200`)
- `--border-subtle`: Enhanced to use `gray-300` (was `gray-200`)
- `--border-strong`: Enhanced to use `gray-400` (was `gray-300`)
- `--card-border`: Enhanced to use `gray-300` (was `gray-200`)
- `--text-muted`: Enhanced to use `gray-600` (was `gray-500`)
- `--muted-foreground`: Enhanced to use `gray-600` (was `gray-500`)
- `--muted`: Enhanced to use `#f1f5f9` (was `#f6f8fc`)
- `--surface-panel-border`: Enhanced to use `gray-200` (was `gray-100`)

These CSS variables automatically apply the enhanced greys to components using semantic tokens.

## Benefits

1. **Improved Contrast**: Better readability against white backgrounds
2. **Clearer Hierarchy**: More defined visual separation between elements
3. **Better Accessibility**: Meets WCAG 2.1 Level AA contrast requirements
4. **Modern Aesthetic**: Aligns with contemporary design systems (Tailwind, Material Design)
5. **Consistent Experience**: Unified greyscale system across all components

## Components Using Enhanced Greys

- Monthly Log Tasks Panel
- Transaction Tabs (Assigned/Unassigned)
- Navigation Pills
- Recurring Tasks Component
- Enhanced Header
- Stage Navigation
- Card Containers
- Empty States
