import type { DateInputProps } from '@/components/ui/date-input';

/**
 * Centralized configuration for the shared `<DateInput />` component.
 *
 * All date entry across the app should use `<DateInput />` so we maintain the
 * month/day/year dropdown experience and consistent validation.
 */

type DateInputPropOverrides = Omit<DateInputProps, 'value' | 'onChange'>;

export const DATE_PICKER_CONFIG = {
  /**
   * Flag for feature checks. When true, teams should wire up `<DateInput />`
   * instead of native `<input type="date">`.
   */
  useDateInputComponent: true,

  /**
   * Default props that mirror the global UX requirements (current year plus a
   * 10-year lookback, allow picking up to 10 years ahead).
   */
  defaultProps: {
    pastYearRange: 10,
    futureYearRange: 10,
  } satisfies Partial<DateInputProps>,

  /**
   * Helper to build `<DateInput />` props with the shared defaults applied.
   */
  createDateInputProps: (
    value: string | null,
    onChange: (value: string) => void,
    overrides?: Partial<DateInputPropOverrides>,
  ): DateInputProps => ({
    value: value || '',
    onChange,
    ...DATE_PICKER_CONFIG.defaultProps,
    ...overrides,
  }),
} as const;

/**
 * Usage:
 *
 * ```tsx
 * import { DateInput } from '@/components/ui/date-input';
 * import { DATE_PICKER_CONFIG } from '@/lib/date-picker-config';
 *
 * <DateInput {...DATE_PICKER_CONFIG.createDateInputProps(date, setDate)} id="start-date" />;
 * ```
 */

export default DATE_PICKER_CONFIG;
