# Date Input Guidance

## Overview

All date entry across Property Manager now uses the shared [`<DateInput />`](../src/components/ui/date-input.tsx) component. It replaces native `<input type="date">` fields and legacy date pickers with a consistent month/day/year dropdown experience that is easier to navigate across months and years.

## Why `<DateInput />`?

1. **Usability** – dedicated dropdowns for month, day, and year make it simple to jump between dates without fiddly calendar navigation.
2. **Consistency** – every flow exposes the same interface and default year range (current year, plus a 10-year lookback and 10-year lookahead).
3. **Accessibility** – keyboard-friendly popover and clear labelling, with built-in support for clearing a date.
4. **Submission safety** – the component keeps an ISO `YYYY-MM-DD` value in sync behind the scenes, so forms submit the right payload.

## Basic Usage

```tsx
import { DateInput } from '@/components/ui/date-input';

function Example() {
  const [moveInDate, setMoveInDate] = useState('');

  return (
    <DateInput
      id="move-in-date"
      value={moveInDate}
      onChange={setMoveInDate}
      placeholder="mm/dd/yyyy"
    />
  );
}
```

The component is controlled; pass the current ISO value (`YYYY-MM-DD`) and handle the updated value in `onChange`.

## Shared Defaults

Leverage `DATE_PICKER_CONFIG` to keep behaviour aligned with the rest of the product:

```tsx
import { DateInput } from '@/components/ui/date-input';
import { DATE_PICKER_CONFIG } from '@/lib/date-picker-config';

<DateInput
  {...DATE_PICKER_CONFIG.createDateInputProps(date, setDate)}
  id="statement-date"
  placeholder="mm/dd/yyyy"
/>;
```

The helper injects the default 10-year lookback/lookahead ranges. You can override any prop by passing a third argument.

## Tips

- Use `containerClassName` to control layout widths when the surrounding flex/grid styles need it.
- Pass `hideClear` if a flow should prevent clearing the existing date.
- When the field participates in a plain HTML `<form>`, provide a `name` prop so the hidden ISO input submits with the rest of the form.
- Components that previously relied on native browser calendars should now import `DateInput`; avoid mixing `type="date"` fields to keep the UX consistent.
- The legacy `<DatePicker />` export now delegates to `<DateInput />` for backward compatibility. Prefer importing `DateInput` directly in new code so you can opt into the helper utilities and props without the wrapper.

## Testing Checklist

- Keyboard access: Tab into the field and use Enter/Space to open the popover.
- Selection flow: choosing month/day/year updates the visible text and persists the ISO value.
- Clearing: the Clear action resets the value (unless disabled via `hideClear`).
- Form submission: when used inside a form, verify the hidden ISO value posts correctly.
